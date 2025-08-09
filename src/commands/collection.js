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
                console.log(`${index}: 贈り物名="${gift.get('贈り物名')}", 取得経緯="${gift.get('取得経緯')}", 個数=${gift.get('個数')}`);
            });

            console.log(`📊 総贈り物数: ${userGifts.length}`);

            // デバッグ情報を埋め込みに追加
            const debugInfo = userGifts.map(gift => 
                `• ${gift.get('贈り物名')}: "${gift.get('取得経緯')}"`
            ).join('\n');

            console.log('デバッグ情報:\n', debugInfo);

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
                console.log(`🔍 贈り物フィルタチェック: "${gift.get('贈り物名')}" - 取得経緯: "${source}"`);
                
                // より広い条件で鳥からの贈り物を判定
                return source.includes('好感度') || 
                       source.includes('絆') || 
                       source.includes('からの贈り物') ||
                       source.includes('贈り物(好感度') ||
                       source.includes('から') ||
                       source.includes('プレゼント');
            });

            console.log('🎁 鳥からの贈り物:', giftsFromBirds.length);
            console.log('🎁 フィルタ結果:', giftsFromBirds.map(g => g.get('贈り物名')));

            if (giftsFromBirds.length === 0) {
                // デバッグ用: 一時的にすべての贈り物を表示
                const embed = new EmbedBuilder()
                    .setTitle('🎁 鳥からの贈り物コレクション (デバッグ)')
                    .setDescription(`**デバッグモード**: 全贈り物データを表示します`)
                    .setColor(0xFFA500);

                if (userGifts.length > 0) {
                    const allGiftsText = userGifts.map(gift => 
                        `• **${gift.get('贈り物名')}** ×${gift.get('個数')}\n  取得経緯: "${gift.get('取得経緯')}"`
                    ).join('\n\n');

                    embed.addFields({
                        name: '📋 全贈り物データ',
                        value: allGiftsText,
                        inline: false
                    });
                } else {
                    embed.addFields({
                        name: '❌ 問題',
                        value: 'スプレッドシートに贈り物データが見つかりません。',
                        inline: false
                    });
                }

                embed.addFields({
                    name: '💡 解決方法',
                    value: '上記のデータを確認して、フィルタリング条件を調整します。\n管理者に報告してください。',
                    inline: false
                });

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

    // 贈り物名でカテゴリ分類
    categorizeGiftsByName(giftNames) {
        const categories = {
            '自然の贈り物': [],
            '手作りの贈り物': [],
            '珍しい発見': [],
            'その他': []
        };

        giftNames.forEach(giftName => {
            const category = this.determineGiftCategory(giftName);
            categories[category].push(giftName);
        });

        // 空のカテゴリを削除
        Object.keys(categories).forEach(key => {
            if (categories[key].length === 0) {
                delete categories[key];
            }
        });

        return categories;
    },

    // 特別な思い出表示
    async handleMemoriesCommand(interaction, userId, userName, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
            const memoryManager = require('../utils/humanMemoryManager');
            
            // ユーザーの思い出を取得
            const memories = await memoryManager.getUserMemories(userId, serverId);
            
            // 贈り物履歴も取得
            const giftHistory = await memoryManager.getGiftHistory(userId, serverId);
            
            console.log('💭 ユーザーの思い出データ:', memories.length);
            console.log('🎁 贈り物履歴:', giftHistory.length);

            if (memories.length === 0 && giftHistory.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('💭 思い出アルバム')
                    .setDescription('まだ思い出がありません。\n鳥類園で過ごす時間が増えると、きっと素敵な思い出が生まれますよ！')
                    .setColor(0x87CEEB)
                    .addFields({
                        name: '💡 思い出を作るには',
                        value: '• 鳥に継続して餌をあげる\n• 好感度を上げて絆を深める\n• 贈り物を交換する\n• 特別な条件で活動する',
                        inline: false
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('💭 思い出アルバム')
                .setDescription(`${userName}さんの鳥類園での思い出`)
                .setColor(0x87CEEB)
                .setTimestamp();

            // 最新の思い出を表示（最大10個）
            if (memories.length > 0) {
                const recentMemories = memories.slice(0, 10);
                const memoriesText = recentMemories
                    .map(memory => `${memory.icon} **${memory.type}**\n${memory.content}\n*${memory.birdName}との思い出 - ${memory.createdAt}*`)
                    .join('\n\n');

                embed.addFields({
                    name: '🌟 特別な思い出',
                    value: memoriesText,
                    inline: false
                });

                if (memories.length > 10) {
                    embed.addFields({
                        name: '📚 その他',
                        value: `他に${memories.length - 10}個の思い出があります`,
                        inline: false
                    });
                }
            }

            // 最近の贈り物履歴を表示（最大5個）
            if (giftHistory.length > 0) {
                const recentGifts = giftHistory.slice(0, 5);
                const giftsText = recentGifts
                    .map(gift => {
                        if (gift.type === 'given') {
                            return `🎁 ${gift.鳥名}に**${gift.贈り物名}**をプレゼント\n*${gift.日時}*`;
                        } else {
                            return `🌟 ${gift.鳥名}から**${gift.贈り物名}**をもらった\n*${gift.日時}*`;
                        }
                    })
                    .join('\n\n');

                embed.addFields({
                    name: '🎁 最近の贈り物',
                    value: giftsText,
                    inline: false
                });

                if (giftHistory.length > 5) {
                    embed.addFields({
                        name: '📦 その他の贈り物',
                        value: `他に${giftHistory.length - 5}件の贈り物記録があります`,
                        inline: false
                    });
                }
            }

            // 統計情報
            const totalGiven = giftHistory.filter(g => g.type === 'given').length;
            const totalReceived = giftHistory.filter(g => g.type === 'received').length;
            const uniqueBirds = new Set([
                ...memories.map(m => m.birdName),
                ...giftHistory.map(g => g.鳥名)
            ]).size;

            embed.addFields({
                name: '📊 思い出の統計',
                value: `特別な思い出: ${memories.length}個\n贈った贈り物: ${totalGiven}個\nもらった贈り物: ${totalReceived}個\n思い出のある鳥: ${uniqueBirds}羽`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('思い出表示エラー:', error);
            await interaction.editReply({ content: '思い出の表示中にエラーが発生しました。' });
        }
    },

    // 全コレクション表示（贈り物+思い出の統合版）
    async handleAllCommand(interaction, userId, userName, serverId) {
        try {
            const memoryManager = require('../utils/humanMemoryManager');
            
            // 鳥からの贈り物を取得
            const receivedGifts = await sheetsManager.getUserReceivedGifts(userId, serverId);
            
            // 思い出を取得
            const memories = await memoryManager.getUserMemories(userId, serverId);
            
            // 贈り物履歴も取得
            const giftHistory = await memoryManager.getGiftHistory(userId, serverId);

            const embed = new EmbedBuilder()
                .setTitle('📚 コレクション総覧')
                .setDescription(`${userName}さんの鳥類園コレクション`)
                .setColor(0x9370DB)
                .setTimestamp();

            // 🎁 鳥からの贈り物サマリー
            if (receivedGifts.length > 0) {
                const giftCounts = {};
                receivedGifts.forEach(gift => {
                    const giftName = gift.贈り物名;
                    giftCounts[giftName] = (giftCounts[giftName] || 0) + 1;
                });
                
                const totalGifts = Object.values(giftCounts).reduce((sum, count) => sum + count, 0);
                const uniqueGivers = new Set(receivedGifts.map(gift => gift.鳥名)).size;
                
                const recentGifts = receivedGifts.slice(0, 3)
                    .map(gift => `${this.getGiftEmoji(gift.贈り物名)} ${gift.贈り物名} (${gift.鳥名})`)
                    .join('\n');

                embed.addFields({
                    name: '🎁 鳥からの贈り物',
                    value: `**${Object.keys(giftCounts).length}種類** (総数${totalGifts}個, ${uniqueGivers}羽から)\n\n📋 最近の贈り物:\n${recentGifts}`,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '🎁 鳥からの贈り物',
                    value: 'まだ贈り物をもらっていません',
                    inline: false
                });
            }

            // 💭 思い出サマリー
            if (memories.length > 0) {
                const recentMemories = memories.slice(0, 3)
                    .map(memory => `${memory.icon} ${memory.type} (${memory.birdName})`)
                    .join('\n');

                embed.addFields({
                    name: '💭 特別な思い出',
                    value: `**${memories.length}個の思い出**\n\n📋 最近の思い出:\n${recentMemories}`,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '💭 特別な思い出',
                    value: 'まだ特別な思い出がありません',
                    inline: false
                });
            }

            // 🎊 贈り物履歴サマリー
            if (giftHistory.length > 0) {
                const totalGiven = giftHistory.filter(g => g.type === 'given').length;
                const totalReceived = giftHistory.filter(g => g.type === 'received').length;

                embed.addFields({
                    name: '🎊 贈り物交換履歴',
                    value: `贈った贈り物: ${totalGiven}個\nもらった贈り物: ${totalReceived}個`,
                    inline: false
                });
            }

            // 📊 総合統計
            const uniqueBirds = new Set([
                ...receivedGifts.map(g => g.鳥名),
                ...memories.map(m => m.birdName),
                ...giftHistory.map(g => g.鳥名)
            ]).size;

            embed.addFields({
                name: '📊 総合統計',
                value: `思い出のある鳥: **${uniqueBirds}羽**\n特別な思い出: **${memories.length}個**\n鳥からの贈り物: **${receivedGifts.length}個**`,
                inline: false
            });

            // 詳細確認のヒント
            embed.addFields({
                name: '💡 詳細確認',
                value: '`/collection gifts` - 贈り物詳細\n`/collection memories` - 思い出詳細',
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

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
