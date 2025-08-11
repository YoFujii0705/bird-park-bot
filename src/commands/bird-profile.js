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
        console.log('🔥 NEW VERSION - bird-profile コマンドが実行されました');
        
        try {
            const guildId = interaction.guild.id;
            const birdName = interaction.options.getString('bird');

            console.log(`🔍 対象の鳥: ${birdName}, サーバー: ${guildId}`);

            await interaction.deferReply();

            // 鳥が鳥類園にいるかチェック
            console.log('🔍 鳥類園をチェック中...');
            
            let birdInfo;
            try {
                birdInfo = this.findBirdInZoo(birdName, guildId);
                console.log('🔍 findBirdInZoo 結果:', birdInfo);
            } catch (findError) {
                console.error('🔍 findBirdInZoo エラー:', findError);
                await interaction.editReply({ content: '鳥類園の確認中にエラーが発生しました。' });
                return;
            }
            
            if (!birdInfo) {
                console.log('🔍 鳥が見つかりませんでした');
                await interaction.editReply({
                    content: `🔍 "${birdName}" は現在この鳥類園にいないようです。\n\`/zoo view\` で現在いる鳥を確認してください。`
                });
                return;
            }

            console.log('🔍 鳥が見つかりました:', birdInfo);

            // 鳥の基本情報を取得
            const bird = birdInfo.bird;
            const area = birdInfo.area;

            console.log('🔍 鳥データベースから詳細情報を取得中...');
            let birdDetails = null;
            try {
                birdDetails = await this.getBirdDetails(birdName);
                console.log(`🔍 ${birdName}の詳細データ:`, birdDetails);
            } catch (error) {
                console.error('🔍 鳥詳細取得エラー:', error);
            }
            
            console.log(`🔍 zooの鳥データ:`, bird);

            console.log('🔍 贈り物データを取得中...');
            let birdGifts = [];
            try {
                birdGifts = await sheetsManager.getBirdGifts(birdName, guildId);
                console.log(`🔍 ${birdName}の贈り物データ:`, birdGifts);
            } catch (error) {
                console.error('🔍 贈り物取得エラー:', error);
            }
            
            // 贈り物を贈り主別にグループ化（修正版）
            const giftsByGiver = {};
            birdGifts.forEach(gift => {
                const giverName = gift.giver || '不明'; // 🔧 修正: gift.giver を使用
                if (!giftsByGiver[giverName]) {
                    giftsByGiver[giverName] = [];
                }
                giftsByGiver[giverName].push(gift);
            });

            console.log('🔍 好感度データを取得中...');
            let allAffinities = [];
            try {
                allAffinities = await this.getAllUserAffinities(birdName, guildId);
                console.log('🔍 好感度データ:', allAffinities);
            } catch (error) {
                console.error('🔍 好感度取得エラー:', error);
            }

            console.log('🔍 Embed作成中...');
            
            // 餌情報を処理
            console.log('🔍 餌情報を処理中...');
            let favoriteFood = '不明';
            try {
                const rawFood = birdDetails?.好物 || bird.好物;
                console.log('🔍 生の餌データ:', rawFood);
                favoriteFood = this.extractFavoriteFood(rawFood);
                console.log('🔍 処理後の餌データ:', favoriteFood);
            } catch (error) {
                console.error('🔍 餌処理エラー:', error);
            }

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
                    value: favoriteFood || '不明', // 🔧 修正: 処理済みの餌データを使用
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
                if (latestGift && latestGift.caption) {
                    const latestGiver = latestGift.giver || '不明'; // 🔧 修正: gift.giver を使用
                    const latestCaption = latestGift.caption || '';
                    embed.addFields({
                        name: '✨ 最新の贈り物',
                        value: `${this.getGiftEmoji(latestGift.name)} **${latestGift.name}** from ${latestGiver}\n*${latestCaption}*`,
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

            // 好感度情報を追加（上位3名、重複排除）
            if (allAffinities.length > 0) {
                // ユーザーIDで重複排除し、最高レベルのみ保持
                const uniqueAffinities = {};
                allAffinities.forEach(affinity => {
                    const userId = affinity.userId;
                    if (!uniqueAffinities[userId] || uniqueAffinities[userId].level < affinity.level) {
                        uniqueAffinities[userId] = affinity;
                    }
                });

                const topAffinities = Object.values(uniqueAffinities)
                    .sort((a, b) => b.level - a.level || b.feedCount - a.feedCount)
                    .slice(0, 3);
                
                if (topAffinities.length > 0) {
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
            }

            // 🆕 絆レベル情報を追加
if (allAffinities.length > 0) {
    // 現在のユーザーの好感度をチェック
    const currentUserAffinity = allAffinities.find(affinity => affinity.userId === interaction.user.id);
    
    if (currentUserAffinity && currentUserAffinity.level >= 10) {
        console.log('🔗 絆レベル情報を取得中...');
        try {
            const bondLevelManager = require('../utils/bondLevelManager');
            const bondData = await bondLevelManager.getCurrentBondLevel(
                interaction.user.id, 
                birdName, 
                guildId
            );
            
            if (bondData && bondData.bondLevel > 0) {
                // 次の絆レベルまでの必要回数を計算
                const nextLevelRequired = bondLevelManager.getRequiredFeedsForBondLevel(bondData.bondLevel + 1);
                const remaining = nextLevelRequired - bondData.bondFeedCount;
                
                let bondText = `🔗 **絆レベル ${bondData.bondLevel}**\n`;
                bondText += `餌やり通算: ${bondData.bondFeedCount}回\n`;
                
                if (remaining > 0) {
                    bondText += `次の絆レベルまで: ${remaining.toFixed(1)}回\n\n`;
                } else {
                    bondText += '\n';
                }
                
                // 解放された機能を表示
                const unlockedFeatures = bondLevelManager.getUnlockedFeatures(bondData.bondLevel);
                if (unlockedFeatures.length > 0) {
                    bondText += '**解放済み機能:**\n';
                    bondText += unlockedFeatures.join('\n');
                } else {
                    bondText += '**解放予定機能:**\n';
                    bondText += '🏠 ネスト建設 (絆Lv.1)\n';
                    bondText += '🚶 レア散歩ルート (絆Lv.3)\n';
                    bondText += '🌟 特別散歩ルート (絆Lv.5)';
                }
                
                embed.addFields({
                    name: '🤝 あなたとの絆',
                    value: bondText,
                    inline: false
                });
                
                // ネスト情報があれば表示
                const sheetsManager = require('../../config/sheets');
                const nestInfo = await sheetsManager.getBirdNest(interaction.user.id, birdName, guildId);
                if (nestInfo) {
                    const nestEmoji = this.getNestEmoji(nestInfo.ネストタイプ);
                    let nestText = `${nestEmoji} **${nestInfo.ネストタイプ}**\n`;
                    
                    if (nestInfo.チャンネルID) {
                        nestText += `🔗 <#${nestInfo.チャンネルID}>`;
                    }
                    
                    if (nestInfo.カスタム名) {
                        nestText += `\n📝 "${nestInfo.カスタム名}"`;
                    }
                    
                    embed.addFields({
                        name: '🏠 専用ネスト',
                        value: nestText,
                        inline: false
                    });
                }
            }
        } catch (error) {
            console.error('🔗 絆レベル情報取得エラー:', error);
        }
    }
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
                text: `${birdName}は${area}エリアで幸せに過ごしています`
            })
            .setTimestamp();

            console.log('🔍 応答送信中...');
            await interaction.editReply({
                embeds: [embed]
            });
            
            console.log('🔍 bird-profile コマンド完了');

        } catch (error) {
            console.error('鳥プロフィール表示エラー:', error);
            console.error('エラースタック:', error.stack);
            
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

    // 鳥データベースから詳細情報を取得
    async getBirdDetails(birdName) {
        try {
            const birdData = require('../utils/birdData');
            if (!birdData.initialized) {
                await birdData.initialize();
            }
            
            const allBirds = birdData.getAllBirds();
            return allBirds.find(bird => bird.名前 === birdName);
        } catch (error) {
            console.error('鳥詳細情報取得エラー:', error);
            return null;
        }
    },

    // 全ユーザーの好感度情報を取得
    async getAllUserAffinities(birdName, guildId) {
        try {
            const allAffinities = await sheetsManager.getAllUserAffinities(birdName, guildId);
            return allAffinities || [];
        } catch (error) {
            console.error('好感度情報取得エラー:', error);
            return [];
        }
    },

    // 餌情報を抽出・整形
    extractFavoriteFood(foodData) {
        if (!foodData) return '不明';
        
        // 既に絵文字付きの場合はそのまま返す
        if (foodData.includes('🥜') || foodData.includes('🌿') || foodData.includes('🐛') || 
            foodData.includes('🐟') || foodData.includes('🍯') || foodData.includes('🌾') || foodData.includes('🐁')) {
            return foodData;
        }
        
        // 絵文字なしの場合は絵文字を追加
        const foods = foodData.split(',').map(food => food.trim());
        const formattedFoods = foods.map(food => {
            const emoji = this.getFoodEmoji(food);
            return `${emoji}${food}`;
        });
        
        return formattedFoods.join(', ');
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
            '森林': 0x228B22,
            '草原': 0x9ACD32,
            '水辺': 0x4169E1
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

    // 贈り物の絵文字を取得
    getGiftEmoji(giftName) {
        const emojiMap = {
            // 森林エリアの贈り物
            '綺麗なビー玉': '🔮',
            '小さな鈴': '🔔',
            '色とりどりのリボン': '🎀',
            '手作りの巣箱': '🏠',
            '特別な枝': '🌿',
            '小さな鏡': '🪞',
            '美しい羽根飾り': '🪶',
            '手編みの小さな巣材': '🧶',

            // 草原エリアの贈り物
            '花で編んだ花冠': '🌸',
            'カラフルなビーズ': '🔴',
            '小さな風車': '🎡',
            '手作りの草笛': '🎵',
            '色鮮やかな紐': '🧵',
            '羽根でできたお守り': '🪶',
            '花の種のネックレス': '🌱',

            // 水辺エリアの贈り物
            '磨いた貝殻': '🐚',
            '美しいガラス玉': '🔮',
            '小さな流木アート': '🪵',
            '手作りの水草飾り': '🌊',
            '綺麗に磨いた石': '💎',
            '貝殻の風鈴': '🎐',
            '水晶のペンダント': '💎',
            '真珠のような玉': '🤍',

            // 共通の特別な贈り物
            '虹色のリボン': '🌈',
            'ハート型の小石': '💖',
            '特別な羽根': '🪶',
            '手作りのお守り': '🍀',
            '光る小さな宝石': '✨',
            '音の鳴る玩具': '🎵',
            '温かい毛糸': '🧶',
            '小さな楽器': '🎼',
            '波の欠片': '🌊'
        };
        
        return emojiMap[giftName] || '🎁';
    },

    // ネストの絵文字を取得するメソッドも追加
getNestEmoji(nestType) {
    const emojiMap = {
        // 森林エリア
        '苔むした庭': '🌿',
        '古木の大穴': '🕳️',
        '木漏れ日の巣': '☀️',
        '妖精の隠れ家': '🧚',
        '樹海の宮殿': '🏰',
        'きのこの家': '🍄',
        '蔦の回廊': '🌿',
        '森の神殿': '⛩️',
        
        // 草原エリア
        '花畑の巣': '🌸',
        '軒先の鳥かご': '🏠',
        '風車小屋': '🎡',
        '蝶の舞台': '🦋',
        '虹の丘': '🌈',
        '星見台': '⭐',
        '花冠の宮殿': '👑',
        'そよ風の家': '💨',
        
        // 水辺エリア
        '蓮池の巣': '🪷',
        '滝のしぶきの巣': '💧',
        '真珠の洞窟': '🤍',
        '虹の水辺': '🌈',
        '水晶の泉': '💎',
        '貝殻の宮殿': '🐚',
        '流木の隠れ家': '🪵',
        '月光の池': '🌙'
    };
    
    return emojiMap[nestType] || '🏠';
},

    // 滞在期間を計算
    getStayDuration(bird) {
        return '2日目 / 3-5日間滞在予定';
    }
};
