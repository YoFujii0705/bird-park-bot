const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const sheetsManager = require('../../config/sheets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('仲良くなった鳥に贈り物をします🎁')
        .addStringOption(option =>
            option.setName('bird')
                .setDescription('贈り物をする鳥の名前')
                .setRequired(true)),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const birdName = interaction.options.getString('bird');

            await interaction.deferReply();

            // 鳥が鳥類園にいるかチェック
            const zooManager = require('../utils/zooManager');
            const birdInfo = this.findBirdInZoo(birdName, guildId);
            
            if (!birdInfo) {
                await interaction.editReply({
                    content: `🔍 "${birdName}" は現在この鳥類園にいないようです。\n\`/zoo view\` で現在いる鳥を確認してください。`
                });
                return;
            }

            // 好感度チェック
            const affinities = await sheetsManager.getUserAffinity(userId, guildId);
            const birdAffinity = affinities[birdInfo.bird.name];
            
            if (!birdAffinity || birdAffinity.level < 5) {
                const currentLevel = birdAffinity ? birdAffinity.level : 0;
                const currentHearts = '💖'.repeat(currentLevel) + '🤍'.repeat(5) + '🤍'.repeat(5);  // 10個表示
                
                await interaction.editReply({
                    content: `💔 ${birdInfo.bird.name}とはまだ贈り物ができるほど仲良くありません。\n\n現在の好感度: ${currentHearts} (Lv.${currentLevel})\n\n餌やりを続けて好感度レベル3にしましょう！`
                });
                return;
            }

            // ユーザーの贈り物インベントリを取得
            const gifts = await sheetsManager.getUserGifts(userId, guildId);
            const availableGifts = Object.entries(gifts).filter(([name, count]) => count > 0);
            
            if (availableGifts.length === 0) {
                await interaction.editReply({
                    content: '🎁 贈り物がありません。\n\n鳥たちと仲良くなることで贈り物を手に入れることができます。'
                });
                return;
            }

            // 鳥が既に持っている贈り物をチェック
            const birdCurrentGifts = await sheetsManager.getBirdGifts(birdInfo.bird.name, guildId);
            const userGiftsToThisBird = birdCurrentGifts.filter(gift => gift.giverId === userId);
            
            if (userGiftsToThisBird.length >= 3) {
                await interaction.editReply({
                    content: `💝 ${birdInfo.bird.name}にはすでに3つの贈り物をしています。\n\n一羽の鳥には最大3個まで贈り物ができます。`
                });
                return;
            }

            // 贈り物選択メニューを作成
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_gift')
                .setPlaceholder('贈り物を選んでください...')
                .addOptions(
                    availableGifts.slice(0, 25).map(([name, count]) => ({
                        label: `${name} (${count}個)`,
                        value: name,
                        emoji: this.getGiftEmoji(name)
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('🎁 贈り物を選択')
                .setDescription(`**${birdInfo.bird.name}**に贈り物をしましょう！\n\n${birdInfo.bird.name}は現在${userGiftsToThisBird.length}/3個の贈り物を持っています。`)
                .setColor(0xFF69B4)
                .addFields({
                    name: '💝 現在の贈り物',
                    value: userGiftsToThisBird.length > 0 
                        ? userGiftsToThisBird.map(gift => `${this.getGiftEmoji(gift.name)} ${gift.name}`).join('\n')
                        : 'まだ贈り物はありません',
                    inline: false
                });

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // 選択の待機
            try {
                const confirmation = await response.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id,
                    time: 60000
                });

                await this.processGiftGiving(confirmation, birdInfo, guildId);

            } catch (error) {
                await interaction.editReply({
                    content: '🕐 時間切れです。もう一度お試しください。',
                    components: []
                });
            }

        } catch (error) {
            console.error('贈り物コマンドエラー:', error);
            
            const errorMessage = '贈り物の実行中にエラーが発生しました。';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    async processGiftGiving(interaction, birdInfo, guildId) {
        try {
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const selectedGift = interaction.values[0];
            const birdName = birdInfo.bird.name;
            const area = birdInfo.area;

            await interaction.deferUpdate();

            // 贈り物キャプション生成
            const caption = this.generateGiftCaption(selectedGift, birdName, userName);

            // データベースに記録
            await sheetsManager.logBirdGift(
                birdName,
                selectedGift,
                userId,
                userName,
                caption,
                guildId
            );

            // ユーザーのインベントリから贈り物を減らす
            await sheetsManager.logGiftInventory(
                userId,
                userName,
                selectedGift,
                -1,
                `${birdName}への贈り物`,
                guildId
            );

            // 成功メッセージ
            const embed = new EmbedBuilder()
                .setTitle('🎁 贈り物完了！')
                .setDescription(`**${birdName}**に**${selectedGift}**を贈りました！`)
                .setColor(0x00FF00)
                .addFields({
                    name: '💝 贈り物の様子',
                    value: caption,
                    inline: false
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: []
            });

        } catch (error) {
            console.error('贈り物処理エラー:', error);
            await interaction.editReply({
                content: '贈り物の処理中にエラーが発生しました。',
                components: []
            });
        }
    },

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

    getGiftEmoji(giftName) {
        const emojiMap = {
            'どんぐり': '🌰',
            '美しい羽根': '🪶',
            '小枝': '🌿',
            'きれいな木の実': '🫐',
            '苔玉': '🟢',
            '花の種': '🌱',
            '綺麗な石': '💎',
            '蝶の羽': '🦋',
            'クローバー': '🍀',
            '花冠': '🌸',
            '美しい貝殻': '🐚',
            '真珠': '🤍',
            '水晶': '💎',
            '流木': '🪵',
            '水草': '🌊',
            '小さな鈴': '🔔',
            '小さなビーズ': '⚪',
            '虹色の羽根': '🌈',
            'ハート型の石': '💖',
            '四つ葉のクローバー': '🍀',
            '特別な鈴': '🔔',
        　  'なにかの化石': '🦐',
            '光る石': '✨'
        };
        
        return emojiMap[giftName] || '🎁';
    },

    generateGiftCaption(giftName, birdName, userName) {
        const captions = {
            // 🌲 森林エリアの贈り物
            'どんぐり': `綺麗などんぐり。${birdName}は${userName}さんからもらったこの宝物を大切にくわえて持ち歩いています。時々コロコロと転がして遊んでいるようです。`,
            
            '美しい羽根': `美しく輝く羽根。${birdName}は自分の羽繕いに活用して、${userName}さんのセンスに感動しているようです。時折くちばしにくわえて風にはためかせているようです。`,
            
            '小枝': `特別な小枝。${birdName}は${userName}さんからの贈り物を巣の一番良い場所に飾っています。他の鳥たちも羨ましそうに見ています。`,
            
            'きれいな木の実': `宝石のように美しい木の実。${birdName}は${userName}さんからもらった木の実を大切に保管し、時々取り出しては嬉しそうに眺めています。`,
            
            '苔玉': `ふわふわの苔玉。${birdName}は${userName}さんからの柔らかい贈り物を羽の下に隠して、お昼寝の時の枕にしているようです。`,
            
            '小さな鈴': `可愛らしい鈴。${birdName}が動くたびに優しい音が鳴り、${userName}さんのことを思い出しているようです。森に美しいメロディーが響いています。`,
            
            '森の宝石': `森で見つけた美しい宝石。${birdName}は${userName}さんからの特別な贈り物を陽の光にかざして、虹色に輝く様子を楽しんでいます。`,

            // 🌾 草原エリアの贈り物
            '花の種': `希少な花の種。${birdName}は${userName}さんからもらった種を大切に埋めて、いつか美しい花を咲かせることを夢見ているようです。`,
            
            '綺麗な石': `キラキラと光る美しい石。${birdName}は${userName}さんからもらった宝石を太陽にかざして楽しんでいます。草原に虹色の光が踊っています。`,
            
            '蝶の羽': `美しい蝶の羽。${birdName}は${userName}さんからの贈り物を見て、自分も蝶のように軽やかに舞いたくなったようです。とても嬉しそうです。`,
            
            'クローバー': `可愛い三つ葉のクローバー。${birdName}は${userName}さんが摘んでくれたクローバーを巣の一番奥に飾っています。時々食べてしまいたくなるそうです。`,
            
            '花冠': `美しい花冠。${birdName}は${userName}さんが作ってくれた花冠を誇らしげに身に着けています。草原で一番美しい鳥になりました。`,
            
            '小さなビーズ': `カラフルなビーズ。${birdName}は${userName}さんからもらった色とりどりのビーズを並べて、自分だけの宝物コレクションを作っています。`,
            
            'なにかの化石': `草原で見つけたなにかの化石。${birdName}は${userName}さんからの貴重な贈り物を胸に抱いて、古い時代に心を寄せているようです。`,

            // 🌊 水辺エリアの贈り物
            '美しい貝殻': `海から流れ着いた美しい貝殻。${birdName}は${userName}さんからの贈り物を耳に当てて、波の音を聞いているようです。遠い海を思い出しているのかもしれません。`,
            
            '真珠': `美しく輝く真珠。${birdName}は${userName}さんからの特別な贈り物を胸に抱いて大切にしています。月光に照らされて神秘的に輝いています。`,
            
            '水晶': `透明で美しい水晶。${birdName}は${userName}さんからもらった水晶を通して水面を見つめ、光の屈折を楽しんでいるようです。科学者のような表情です。`,
            
            '流木': `滑らかに磨かれた流木。${birdName}は${userName}さんからの贈り物を止まり木として使っています。長い旅をしてきた木の温もりを感じているようです。`,
            
            '水草': `美しい水草。${birdName}は${userName}さんがくれた水草を巣に編み込んで、水辺らしい素敵な住まいを作っています。`,
            
            '小さな巻貝': `可愛らしい巻貝。${birdName}は${userName}さんからもらった巻貝をくるくると回して遊んでいます。時々中から小さな音が聞こえてくるようです。`,
            
            '波の欠片': `波しぶきが結晶化した美しい欠片。${birdName}は${userName}さんからの神秘的な贈り物を見つめて、水の精霊の存在を感じているようです。`,

            // ✨ 共通の特別な贈り物
            '虹色の羽根': `虹色に輝く神秘的な羽根。${birdName}は${userName}さんからの魔法のような贈り物に感動し、いつか羽の持ち主に出会いたいと思っているようです。`,
            
            'ハート型の石': `愛らしいハート型の石。${birdName}は${userName}さんの愛情を感じて、いつもより美しく鳴いています。愛の歌声が響いています。`,
            
            '四つ葉のクローバー': `幸運の四つ葉のクローバー。${birdName}は${userName}さんからの幸運の贈り物を大切に保管しています。きっと素晴らしいことが起こるでしょう。`,
            
            '特別な鈴': `魔法がかかった特別な鈴。${birdName}が羽ばたくたびに天使のような美しい音色が響き、${userName}さんとの絆を歌っているようです。`,
            
            '光る石': `夜になると優しく光る不思議な石。${birdName}は${userName}さんからもらった光る石を見つめて、星空との会話を楽しんでいるようです。夜が楽しみになりました。`
        };

        // デフォルトキャプション（新しい贈り物が追加された場合の安全策）
        return captions[giftName] || `素敵な${giftName}。${birdName}は${userName}さんからの心のこもった贈り物をとても大切にしています。二人の絆がより深まったようです。`;
    }
};
