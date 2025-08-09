const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sheetsManager = require('../../config/sheets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('collection')
        .setDescription('鳥たちからもらった贈り物のコレクションを確認します🎁')
        .addSubcommand(subcommand =>
            subcommand
                .setName('gifts')
                .setDescription('もらった贈り物を確認します'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('memories')
                .setDescription('特別な思い出を確認します'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('全てのコレクションを確認します')),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const serverId = interaction.guild.id;

            await interaction.deferReply();

            switch (subcommand) {
                case 'gifts':
                    await this.handleGiftsCommand(interaction, userId, userName, serverId);
                    break;
                case 'memories':
                    await this.handleMemoriesCommand(interaction, userId, userName, serverId);
                    break;
                case 'all':
                    await this.handleAllCommand(interaction, userId, userName, serverId);
                    break;
            }

        } catch (error) {
            console.error('コレクションコマンドエラー:', error);
            
            const errorMessage = 'コレクション情報の取得中にエラーが発生しました。';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 贈り物コレクション表示
    async handleGiftsCommand(interaction, userId, userName, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
            // ユーザーの贈り物インベントリを取得
            const inventorySheet = sheetsManager.sheets.giftsInventory;
            const inventoryRows = await inventorySheet.getRows();
            
            const userGifts = inventoryRows.filter(row => 
                row.get('ユーザーID') === userId && 
                row.get('サーバーID') === serverId &&
                parseInt(row.get('個数')) > 0
            );
            
            console.log('🔍 デバッグ - ユーザー贈り物データ:');
            userGifts.forEach((gift, index) => {
                console.log(`${index}: 贈り物名=${gift.get('贈り物名')}, 取得経緯=${gift.get('取得経緯')}, 個数=${gift.get('個数')}`);
            });

            if (userGifts.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🎁 贈り物コレクション')
                    .setDescription('まだ鳥たちから贈り物をもらっていません。\n鳥たちと仲良くなって、素敵な贈り物をもらいましょう！')
                    .setColor(0x808080)
                    .addFields({
                        name: '💡 贈り物をもらうには',
                        value: '• 同じ鳥に餌をあげて好感度を上げましょう\n• 好感度が高い鳥は贈り物をくれることがあります\n• 贈り物は鳥の種類やエリアによって変わります',
                        inline: false
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // 鳥からもらった贈り物のみをフィルタリング
            const giftsFromBirds = userGifts.filter(gift => {
                const source = gift.get('取得経緯') || '';
                // 「好感度」を含む場合は鳥からの贈り物
                return source.includes('好感度') || source.includes('絆') || source.includes('から');
            });

            console.log('🎁 鳥からの贈り物:', giftsFromBirds.length);

            if (giftsFromBirds.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🎁 鳥からの贈り物コレクション')
                    .setDescription('まだ鳥たちから贈り物をもらっていません。\n餌やりで好感度を上げて、鳥たちからの贈り物をもらいましょう！')
                    .setColor(0x808080)
                    .addFields({
                        name: '💡 鳥からの贈り物をもらうには',
                        value: '• `/feed` で同じ鳥に何度も餌をあげて好感度を上げる\n• 好感度レベル5で特別な贈り物がもらえます\n• その後も贈り物をもらえるチャンスがあります',
                        inline: false
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // 贈り物をカテゴリ別に分類
            const giftsByCategory = this.categorizeGifts(giftsFromBirds);
            
            const embed = new EmbedBuilder()
                .setTitle('🎁 鳥からの贈り物コレクション')
                .setDescription(`${userName}さんが鳥たちからもらった贈り物: **${giftsFromBirds.length}種類**`)
                .setColor(0xFFD700)
                .setTimestamp();

            // カテゴリ別で表示
            for (const [category, gifts] of Object.entries(giftsByCategory)) {
                const giftList = gifts
                    .map(gift => {
                        const count = parseInt(gift.get('個数')) || 1;
                        const source = gift.get('取得経緯') || '';
                        
                        // 贈り主を取得経緯から抽出
                        let fromBird = 'unknown';
                        if (source.includes('との深い絆')) {
                            const match = source.match(/(.+?)との深い絆/);
                            if (match) fromBird = match[1];
                        } else if (source.includes('から')) {
                            const match = source.match(/(.+?)から/);
                            if (match) fromBird = match[1];
                        }
                        
                        return `${this.getGiftEmoji(gift.get('贈り物名'))} **${gift.get('贈り物名')}** ×${count}\n*${fromBird}より*`;
                    })
                    .join('\n\n');

                embed.addFields({
                    name: `${this.getCategoryEmoji(category)} ${category}`,
                    value: giftList,
                    inline: false
                });
            }

            // 統計情報を追加
            const totalGifts = giftsFromBirds.reduce((sum, gift) => sum + (parseInt(gift.get('個数')) || 1), 0);
            const uniqueSources = new Set();
            giftsFromBirds.forEach(gift => {
                const source = gift.get('取得経緯') || '';
                if (source.includes('との深い絆')) {
                    const match = source.match(/(.+?)との深い絆/);
                    if (match) uniqueSources.add(match[1]);
                }
            });

            embed.addFields({
                name: '📊 統計',
                value: `総数: ${totalGifts}個 | 種類: ${giftsFromBirds.length}種 | 贈り主: ${uniqueSources.size}羽`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('贈り物表示エラー:', error);
            await interaction.editReply({ content: '贈り物の表示中にエラーが発生しました。' });
        }
    },

    // 特別な思い出表示
    async handleMemoriesCommand(interaction, userId, userName, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
            // 特別な思い出を取得（仮実装 - 実際のデータ構造に合わせて調整）
            const embed = new EmbedBuilder()
                .setTitle('💭 特別な思い出')
                .setDescription(`${userName}さんの鳥類園での思い出`)
                .setColor(0x87CEEB)
                .addFields({
                    name: '🚧 開発中',
                    value: 'この機能は現在開発中です。\n今後、鳥たちとの特別な思い出を記録できるようになります！',
                    inline: false
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('思い出表示エラー:', error);
            await interaction.editReply({ content: '思い出の表示中にエラーが発生しました。' });
        }
    },

    // 全コレクション表示（ページ分割対応）
    async handleAllCommand(interaction, userId, userName, serverId) {
        try {
            // 最初に贈り物コレクションを表示
            await this.handleGiftsCommand(interaction, userId, userName, serverId);
            
            // 削除：ボタンでの切り替え機能は一旦削除
            // 今後実装予定としてコメントアウト
            /*
            // ボタンで他のコレクションに切り替え可能
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('collection_gifts')
                        .setLabel('贈り物')
                        .setEmoji('🎁')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('collection_memories')
                        .setLabel('思い出')
                        .setEmoji('💭')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('collection_stats')
                        .setLabel('統計')
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.followUp({ 
                content: '📋 他のコレクションを見るにはボタンをクリックしてください',
                components: [row],
                ephemeral: true
            });
            */

        } catch (error) {
            console.error('全コレクション表示エラー:', error);
            await interaction.editReply({ content: '全コレクションの表示中にエラーが発生しました。' });
        }
    },

    // 贈り物をカテゴリ別に分類
    categorizeGifts(gifts) {
        const categories = {
            '自然の贈り物': [],
            '手作りの贈り物': [],
            '珍しい発見': [],
            'その他': []
        };

        gifts.forEach(gift => {
            const giftName = gift.get('贈り物名');
            const category = this.determineGiftCategory(giftName);
            categories[category].push(gift);
        });

        // 空のカテゴリを削除
        Object.keys(categories).forEach(key => {
            if (categories[key].length === 0) {
                delete categories[key];
            }
        });

        return categories;
    },

    // 贈り物のカテゴリを判定
    determineGiftCategory(giftName) {
        if (giftName.includes('木の実') || giftName.includes('種') || giftName.includes('花') || giftName.includes('葉')) {
            return '自然の贈り物';
        }
        if (giftName.includes('巣') || giftName.includes('枝') || giftName.includes('織り') || giftName.includes('編み')) {
            return '手作りの贈り物';
        }
        if (giftName.includes('石') || giftName.includes('羽根') || giftName.includes('宝石') || giftName.includes('珍しい')) {
            return '珍しい発見';
        }
        return 'その他';
    },

    // 贈り物の絵文字を取得
    getGiftEmoji(giftName) {
        if (giftName.includes('木の実')) return '🌰';
        if (giftName.includes('花')) return '🌸';
        if (giftName.includes('羽根')) return '🪶';
        if (giftName.includes('石')) return '💎';
        if (giftName.includes('種')) return '🌱';
        if (giftName.includes('枝')) return '🌿';
        if (giftName.includes('葉')) return '🍃';
        if (giftName.includes('巣')) return '🪹';
        return '🎁';
    },

    // カテゴリの絵文字を取得
    getCategoryEmoji(category) {
        const emojis = {
            '自然の贈り物': '🌿',
            '手作りの贈り物': '🛠️',
            '珍しい発見': '💎',
            'その他': '📦'
        };
        return emojis[category] || '📦';
    }
};
