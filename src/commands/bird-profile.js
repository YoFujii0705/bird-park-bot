const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sheetsManager = require('../../config/sheets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bird-profile')
        .setDescription('鳥の詳細なプロフィールを表示します🐦')
        .addStringOption(option =>
            option.setName('bird')
                .setDescription('プロフィールを見たい鳥の名前')
                .setRequired(true)),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const birdName = interaction.options.getString('bird');

            await interaction.deferReply();

            // 鳥が鳥類園にいるかチェック
            const birdInfo = this.findBirdInZoo(birdName, guildId);
            
            if (!birdInfo) {
                await interaction.editReply({
                    content: `🔍 "${birdName}" は現在この鳥類園にいないようです。\n\`/zoo view\` で現在いる鳥を確認してください。`
                });
                return;
            }

            // 鳥の基本情報を取得
            const bird = birdInfo.bird;
            const area = birdInfo.area;

            // 鳥が現在持っている贈り物を取得
            const birdGifts = await sheetsManager.getBirdGifts(birdName, guildId);
            
            // 贈り物を贈り主別にグループ化
            const giftsByGiver = {};
            birdGifts.forEach(gift => {
                if (!giftsByGiver[gift.giverName]) {
                    giftsByGiver[gift.giverName] = [];
                }
                giftsByGiver[gift.giverName].push(gift);
            });

            // ユーザーごとの好感度情報を取得（複数ユーザー分）
            const allAffinities = await this.getAllUserAffinities(birdName, guildId);

            // プロフィール埋め込みを作成
            const embed = new EmbedBuilder()
                .setTitle(`🐦 ${birdName} のプロフィール`)
                .setColor(this.getAreaColor(area))
                .addFields({
                    name: '📍 現在の滞在場所',
                    value: `${this.getAreaEmoji(area)} **${area}エリア**`,
                    inline: true
                })
                .addFields({
                    name: '🕐 滞在期間',
                    value: this.getStayDuration(bird),
                    inline: true
                })
                .addFields({
                    name: '🍽️ 好きな餌',
                    value: `${this.getFoodEmoji(bird.favoriteFood)} **${bird.favoriteFood}**`,
                    inline: true
                });

            // 贈り物情報を追加
            if (birdGifts.length > 0) {
                const giftSummary = this.createGiftSummary(giftsByGiver);
                embed.addFields({
                    name: `🎁 身につけている贈り物 (${birdGifts.length}個)`,
                    value: giftSummary,
                    inline: false
                });

                // 最新の贈り物を特別表示
                const latestGift = birdGifts[birdGifts.length - 1];
                if (latestGift) {
                    embed.addFields({
                        name: '✨ 最新の贈り物',
                        value: `${this.getGiftEmoji(latestGift.name)} **${latestGift.name}** from ${latestGift.giverName}\n*${latestGift.caption}*`,
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: '🎁 身につけている贈り物',
                    value: 'まだ贈り物はありません',
                    inline: false
                });
            }

            // 好感度情報を追加（上位3名）
            if (allAffinities.length > 0) {
                const topAffinities = allAffinities
                    .sort((a, b) => b.level - a.level || b.feedCount - a.feedCount)
                    .slice(0, 3);
                
                const affinityText = topAffinities.map((affinity, index) => {
                    const medal = ['🥇', '🥈', '🥉'][index];
                    const hearts = '💖'.repeat(affinity.level) + '🤍'.repeat(Math.max(0, 10 - affinity.level));
                    return `${medal} **${affinity.userName}** - Lv.${affinity.level}\n${hearts}`;
                }).join('\n\n');

                embed.addFields({
                    name: '💝 親しい人たち',
                    value: affinityText,
                    inline: false
                });
            }

            // 特別な状態やメモリー情報があれば追加
            const birdMemory = await sheetsManager.getBirdMemory(birdName, guildId);
            if (birdMemory && birdMemory.特別な思い出) {
                embed.addFields({
                    name: '🌟 特別な思い出',
                    value: birdMemory.特別な思い出,
                    inline: false
                });
            }

            embed.setFooter({ 
                text: `${birdName}は${area}エリアで幸せに過ごしています`,
                iconURL: 'https://example.com/bird-icon.png' // お好みのアイコンURL
            })
            .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('鳥プロフィール表示エラー:', error);
            
            const errorMessage = '鳥のプロフィール表示中にエラーが発生しました。';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 鳥類園から鳥を検索
    findBirdInZoo(birdName, guildId) {
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState(guildId);
        
        for (const area of ['森林', '草原', '水辺']) {
            const bird = zooState[area].find(b => 
                b.name.includes(birdName) || birdName.includes(b.name)
            );
            if (bird) {
                return { bird, area };
            }
        }
        return null;
    },

    // 全ユーザーの好感度情報を取得
    async getAllUserAffinities(birdName, guildId) {
        try {
            // この関数はsheetsManagerに追加する必要があります
            // 一旦、既存の関数で代替実装
            const allAffinities = await sheetsManager.getAllUserAffinities(birdName, guildId);
            return allAffinities || [];
        } catch (error) {
            console.error('好感度情報取得エラー:', error);
            return [];
        }
    },

    // 贈り物サマリーを作成
    createGiftSummary(giftsByGiver) {
        const summary = [];
        
        for (const [giverName, gifts] of Object.entries(giftsByGiver)) {
            const giftList = gifts.map(gift => `${this.getGiftEmoji(gift.name)} ${gift.name}`).join(' ');
            summary.push(`**${giverName}さんから:**\n${giftList}`);
        }
        
        return summary.join('\n\n') || 'まだ贈り物はありません';
    },

    // エリア別の色を取得
    getAreaColor(area) {
        const colors = {
            '森林': 0x228B22,    // フォレストグリーン
            '草原': 0x9ACD32,    // イエローグリーン
            '水辺': 0x4169E1     // ロイヤルブルー
        };
        return colors[area] || 0x808080;
    },

    // エリア別の絵文字を取得
    getAreaEmoji(area) {
        const emojis = {
            '森林': '🌲',
            '草原': '🌾',
            '水辺': '🌊'
        };
        return emojis[area] || '📍';
    },

    // 餌の絵文字を取得
    getFoodEmoji(food) {
        const emojis = {
            '麦': '🌾',
            '虫': '🐛',
            '魚': '🐟',
            '花蜜': '🍯',
            '木の実': '🥜',
            '青菜': '🌿',
            'ねずみ': '🐁'
        };
        return emojis[food] || '🍽️';
    },

    // 贈り物の絵文字を取得（gift.jsと同じ関数）
    getGiftEmoji(giftName) {
        const emojiMap = {
            // 🌲 森林エリアの贈り物
            '綺麗なビー玉': '🔮',
            '小さな鈴': '🔔',
            '色とりどりのリボン': '🎀',
            '手作りの巣箱': '🏠',
            '特別な枝': '🌿',
            '小さな鏡': '🪞',
            '美しい羽根飾り': '🪶',
            '手編みの小さな巣材': '🧶',

            // 🌾 草原エリアの贈り物
            '花で編んだ花冠': '🌸',
            'カラフルなビーズ': '🔴',
            '小さな風車': '🎡',
            '手作りの草笛': '🎵',
            '色鮮やかな紐': '🧵',
            '羽根でできたお守り': '🪶',
            '花の種のネックレス': '🌱',

            // 🌊 水辺エリアの贈り物
            '磨いた貝殻': '🐚',
            '美しいガラス玉': '🔮',
            '小さな流木アート': '🪵',
            '手作りの水草飾り': '🌊',
            '綺麗に磨いた石': '💎',
            '貝殻の風鈴': '🎐',
            '水晶のペンダント': '💎',
            '真珠のような玉': '🤍',

            // ✨ 共通の特別な贈り物
            '虹色のリボン': '🌈',
            'ハート型の小石': '💖',
            '特別な羽根': '🪶',
            '手作りのお守り': '🍀',
            '光る小さな宝石': '✨',
            '音の鳴る玩具': '🎵',
            '温かい毛糸': '🧶',
            '小さな楽器': '🎼'
        };
        
        return emojiMap[giftName] || '🎁';
    },

    // 滞在期間を計算（概算）
    getStayDuration(bird) {
        // zooManagerから滞在開始時間を取得できる場合の実装例
        // 実際の実装はzooManagerの構造に合わせて調整してください
        return '2日目 / 3-5日間滞在予定';
    }
};
