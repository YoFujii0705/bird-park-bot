const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sheetsManager = require('../../config/sheets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('collection')
        .setDescription('鳥たちからもらった贈り物のコレクションを確認します🎁')
        .addSubcommand(subcommand =>
            subcommand
                .setName('gifts')
                .setDescription('鳥からもらった贈り物を確認します'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('given')
                .setDescription('鳥にあげた贈り物を確認します'))
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
                case 'given':
                    await this.handleGivenGiftsCommand(interaction, userId, userName, serverId);
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

    // 鳥からもらった贈り物表示
    async handleGiftsCommand(interaction, userId, userName, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
            // 🔧 正しいシートから鳥からもらった贈り物を取得
            const receivedGifts = await sheetsManager.getUserReceivedGifts(userId, serverId);
            
            console.log('🔍 鳥からもらった贈り物データ:', receivedGifts.length);

            if (receivedGifts.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🎁 鳥からの贈り物コレクション')
                    .setDescription('まだ鳥たちから贈り物をもらっていません。\n餌やりで好感度を上げて、鳥たちからの贈り物をもらいましょう！')
                    .setColor(0x808080)
                    .addFields({
                        name: '💡 鳥からの贈り物をもらうには',
                        value: '• `/feed` で同じ鳥に何度も餌をあげて好感度を上げる\n• 好感度レベル5以上で贈り物をもらえるチャンスが発生\n• 好感度が高いほど贈り物をもらいやすくなります',
                        inline: false
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // 贈り物を統計処理（同じ贈り物は個数としてカウント）
            const giftCounts = {};
            const giftDetails = {};
            
            receivedGifts.forEach(gift => {
                const giftName = gift.贈り物名;
                giftCounts[giftName] = (giftCounts[giftName] || 0) + 1;
                
                if (!giftDetails[giftName]) {
                    giftDetails[giftName] = {
                        贈り物名: giftName,
                        最初の贈り主: gift.鳥名,
                        最新の日時: gift.日時,
                        エリア: gift.エリア,
                        贈り主リスト: []
                    };
                }
                giftDetails[giftName].贈り主リスト.push(gift.鳥名);
            });

            // 贈り物をカテゴリ別に分類
            const giftsByCategory = this.categorizeGiftsByName(Object.keys(giftCounts));
            
            const embed = new EmbedBuilder()
                .setTitle('🎁 鳥からの贈り物コレクション')
                .setDescription(`${userName}さんが鳥たちからもらった贈り物: **${Object.keys(giftCounts).length}種類**`)
                .setColor(0xFFD700)
                .setTimestamp();

            // カテゴリ別で表示
            for (const [category, giftNames] of Object.entries(giftsByCategory)) {
                const giftList = giftNames
                    .map(giftName => {
                        const count = giftCounts[giftName];
                        const detail = giftDetails[giftName];
                        const uniqueGivers = [...new Set(detail.贈り主リスト)];
                        
                        return `${this.getGiftEmoji(giftName)} **${giftName}** ×${count}\n*${uniqueGivers.join(', ')}より*`;
                    })
                    .join('\n\n');

                embed.addFields({
                    name: `${this.getCategoryEmoji(category)} ${category}`,
                    value: giftList,
                    inline: false
                });
            }

            // 統計情報を追加
            const totalGifts = Object.values(giftCounts).reduce((sum, count) => sum + count, 0);
            const uniqueGivers = new Set(receivedGifts.map(gift => gift.鳥名)).size;

            embed.addFields({
                name: '📊 統計',
                value: `総数: ${totalGifts}個 | 種類: ${Object.keys(giftCounts).length}種 | 贈り主: ${uniqueGivers}羽`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('贈り物表示エラー:', error);
            await interaction.editReply({ content: '贈り物の表示中にエラーが発生しました。' });
        }
    },

    // 🔧 鳥にあげた贈り物表示（安全なデバッグ版）
async handleGivenGiftsCommand(interaction, userId, userName, serverId) {
    try {
        await sheetsManager.ensureInitialized();
        
        console.log('🔍 鳥にあげた贈り物を取得中...', { userId, serverId });
        
        // 🔧 直接sheetsManagerから取得
        const sheet = sheetsManager.sheets.birdGifts;
        const rows = await sheet.getRows();
        
        console.log('🔍 bird_gifts シートの全行数:', rows.length);
        
        // 🔧 デバッグ: 最初の行の全データを確認
        if (rows.length > 0) {
            const firstRow = rows[0];
            console.log('🔍 最初の行の全データ:', firstRow._rawData);
            
            // 利用可能なヘッダーを確認
            try {
                const headers = sheet.headerValues;
                console.log('🔍 シートのヘッダー:', headers);
            } catch (e) {
                console.log('🔍 ヘッダー取得エラー:', e.message);
            }
        }
        
        const givenGifts = rows
            .filter(row => {
                // 🔧 すべての可能な列名で試行
                const possibleUserIdKeys = ['送り主ユーザーID', '贈り主ユーザーID', 'ユーザーID'];
                let rowUserId = null;
                
                for (const key of possibleUserIdKeys) {
                    try {
                        const value = row.get(key);
                        if (value) {
                            rowUserId = value;
                            break;
                        }
                    } catch (e) {
                        // この列名は存在しない
                        continue;
                    }
                }
                
                const rowServerId = row.get('サーバーID');
                console.log('🔍 行データ確認:', { rowUserId, rowServerId, targetUserId: userId, targetServerId: serverId });
                return rowUserId === userId && rowServerId === serverId;
            })
            .map(row => ({
                日時: row.get('贈呈日時') || row.get('日時'),
                鳥名: row.get('鳥名'),
                贈り物名: row.get('贈り物名'),
                キャプション: row.get('キャプション') || ''
            }))
            .sort((a, b) => new Date(b.日時) - new Date(a.日時));

        console.log('🎁 鳥にあげた贈り物データ:', givenGifts.length, givenGifts);

        if (givenGifts.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('🎁 鳥にあげた贈り物')
                .setDescription('まだ鳥に贈り物をしていません。\n好感度レベル5以上の鳥に贈り物をしてみましょう！')
                .setColor(0x808080)
                .addFields({
                    name: '💡 鳥に贈り物をするには',
                    value: '• 同じ鳥に餌をあげて好感度レベル5にする\n• 好感度5で贈り物用アイテムを思いつく\n• `/gift bird:(鳥名)` で贈り物をする',
                    inline: false
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // 贈り物を鳥別に統計処理
        const giftsByBird = {};
        const giftCounts = {};
        
        givenGifts.forEach(gift => {
            const birdName = gift.鳥名;
            const giftName = gift.贈り物名;
            
            if (!giftsByBird[birdName]) {
                giftsByBird[birdName] = [];
            }
            giftsByBird[birdName].push(gift);
            
            giftCounts[giftName] = (giftCounts[giftName] || 0) + 1;
        });

        const embed = new EmbedBuilder()
            .setTitle('🎁 鳥にあげた贈り物')
            .setDescription(`${userName}さんが鳥たちにあげた贈り物: **${givenGifts.length}個** (${Object.keys(giftsByBird).length}羽に)`)
            .setColor(0xFF69B4)
            .setTimestamp();

        // 鳥別で表示（最大5羽）
        const topBirds = Object.entries(giftsByBird)
            .sort(([,a], [,b]) => b.length - a.length)
            .slice(0, 5);

        for (const [birdName, gifts] of topBirds) {
            const giftList = gifts
                .map(gift => {
                    const captionText = gift.キャプション && gift.キャプション.trim() 
                        ? `"${gift.キャプション.substring(0, 50)}${gift.キャプション.length > 50 ? '...' : ''}"`
                        : '';
                    
                    return `${this.getGiftEmojiFromName(gift.贈り物名)} **${gift.贈り物名}**\n*${gift.日時}*${captionText ? `\n${captionText}` : ''}`;
                })
                .join('\n\n');

            embed.addFields({
                name: `🐦 ${birdName} (${gifts.length}個)`,
                value: giftList,
                inline: false
            });
        }

        // 残りの鳥がいる場合
        if (Object.keys(giftsByBird).length > 5) {
            const remainingBirds = Object.keys(giftsByBird).length - 5;
            embed.addFields({
                name: '📋 その他',
                value: `他に${remainingBirds}羽の鳥に贈り物をしています`,
                inline: false
            });
        }

        // 統計情報
        const uniqueBirds = Object.keys(giftsByBird).length;
        const totalGifts = givenGifts.length;
        const uniqueGiftTypes = Object.keys(giftCounts).length;

        embed.addFields({
            name: '📊 統計',
            value: `総数: ${totalGifts}個 | 種類: ${uniqueGiftTypes}種 | 贈り先: ${uniqueBirds}羽`,
            inline: false
        });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('鳥にあげた贈り物表示エラー:', error);
        await interaction.editReply({ content: '鳥にあげた贈り物の表示中にエラーが発生しました。' });
    }
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
    
    // 🔧 全コレクション表示（安全なデバッグ版）
async handleAllCommand(interaction, userId, userName, serverId) {
    try {
        const memoryManager = require('../utils/humanMemoryManager');
        
        // 鳥からの贈り物を取得
        const receivedGifts = await sheetsManager.getUserReceivedGifts(userId, serverId);
        
        // 思い出を取得
        const memories = await memoryManager.getUserMemories(userId, serverId);
        
        // 🔧 鳥にあげた贈り物を直接取得
        console.log('🔍 鳥にあげた贈り物を取得中...', { userId, serverId });
        
        const sheet = sheetsManager.sheets.birdGifts;
        const rows = await sheet.getRows();
        
        // 🔧 デバッグ: 最初の行の全データを確認（安全に）
        if (rows.length > 0) {
            const firstRow = rows[0];
            console.log('🔍 All - 最初の行の全データ:', firstRow._rawData);
            
            // 利用可能なヘッダーを確認
            try {
                const headers = sheet.headerValues;
                console.log('🔍 All - シートのヘッダー:', headers);
            } catch (e) {
                console.log('🔍 All - ヘッダー取得エラー:', e.message);
            }
        }
        
        const givenGifts = rows
            .filter(row => {
                // 🔧 すべての可能な列名で試行
                const possibleUserIdKeys = ['送り主ユーザーID', '贈り主ユーザーID', 'ユーザーID'];
                let rowUserId = null;
                
                for (const key of possibleUserIdKeys) {
                    try {
                        const value = row.get(key);
                        if (value) {
                            rowUserId = value;
                            break;
                        }
                    } catch (e) {
                        // この列名は存在しない
                        continue;
                    }
                }
                
                const rowServerId = row.get('サーバーID');
                console.log('🔍 All - 行データ確認:', { rowUserId, rowServerId, targetUserId: userId, targetServerId: serverId });
                return rowUserId === userId && rowServerId === serverId;
            })
            .map(row => ({
                日時: row.get('贈呈日時') || row.get('日時'),
                鳥名: row.get('鳥名'),
                贈り物名: row.get('贈り物名'),
                キャプション: row.get('キャプション') || ''
            }));

        console.log('🎁 All - 鳥にあげた贈り物データ:', givenGifts.length);

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

        // 🎊 贈り物履歴サマリー（修正版）
        embed.addFields({
            name: '🎊 贈り物交換履歴',
            value: `贈った贈り物: **${givenGifts.length}個**\nもらった贈り物: **${receivedGifts.length}個**`,
            inline: false
        });

        // 📊 総合統計
        const uniqueBirds = new Set([
            ...receivedGifts.map(g => g.鳥名),
            ...memories.map(m => m.birdName),
            ...givenGifts.map(g => g.鳥名)
        ]).size;

        embed.addFields({
            name: '📊 総合統計',
            value: `思い出のある鳥: **${uniqueBirds}羽**\n特別な思い出: **${memories.length}個**\n鳥からの贈り物: **${receivedGifts.length}個**`,
            inline: false
        });

        // 詳細確認のヒント
        embed.addFields({
            name: '💡 詳細確認',
            value: '`/collection gifts` - 鳥からもらった贈り物\n`/collection given` - 鳥にあげた贈り物\n`/collection memories` - 思い出詳細',
            inline: false
        });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('全コレクション表示エラー:', error);
        await interaction.editReply({ content: '全コレクションの表示中にエラーが発生しました。' });
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
    
    // 贈り物の絵文字を取得（鳥→人間）
    getGiftEmoji(giftName) {
        if (giftName.includes('木の実')) return '🌰';
        if (giftName.includes('花')) return '🌸';
        if (giftName.includes('羽根')) return '🪶';
        if (giftName.includes('石')) return '💎';
        if (giftName.includes('種')) return '🌱';
        if (giftName.includes('枝')) return '🌿';
        if (giftName.includes('葉')) return '🍃';
        if (giftName.includes('巣')) return '🪹';
        if (giftName.includes('貝')) return '🐚';
        if (giftName.includes('真珠')) return '🦪';
        if (giftName.includes('水晶')) return '💎';
        if (giftName.includes('流木')) return '🪵';
        if (giftName.includes('クローバー')) return '🍀';
        return '🎁';
    },

    // 贈り物名から絵文字取得（人間→鳥用）
    getGiftEmojiFromName(giftName) {
        const emojiMap = {
            // 人間→鳥の贈り物用絵文字
            '綺麗なビー玉': '🔮',
            '小さな鈴': '🔔',
            '色とりどりのリボン': '🎀',
            '手作りの巣箱': '🏠',
            '特別な枝': '🌿',
            '小さな鏡': '🪞',
            '美しい羽根飾り': '🪶',
            '手編みの小さな巣材': '🧶',
            '花で編んだ花冠': '🌸',
            'カラフルなビーズ': '🔴',
            '小さな風車': '🎡',
            '手作りの草笛': '🎵',
            '色鮮やかな紐': '🧵',
            '羽根でできたお守り': '🪶',
            '花の種のネックレス': '🌱',
            '磨いた貝殻': '🐚',
            '美しいガラス玉': '🔮',
            '小さな流木アート': '🪵',
            '手作りの水草飾り': '🌊',
            '綺麗に磨いた石': '💎',
            '貝殻の風鈴': '🎐',
            '水晶のペンダント': '💎',
            '真珠のような玉': '🤍',
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

    // カテゴリの絵文字を取得
    getCategoryEmoji(category) {
        const emojiMap = {
            '自然の贈り物': '🌿',
            '手作りの贈り物': '🎨',
            '珍しい発見': '💎',
            'その他': '📦'
        };
        return emojiMap[category] || '📦';
    }
};
