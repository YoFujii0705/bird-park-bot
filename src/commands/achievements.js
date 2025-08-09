const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const achievementManager = require('../utils/achievements');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription('あなたの称号と統計を確認します🏆')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('取得済みの称号一覧を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('詳細な統計情報を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('progress')
                .setDescription('未取得称号の進捗を表示')),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const serverId = interaction.guild.id;

            await interaction.deferReply();

            switch (subcommand) {
                case 'list':
                    await this.handleListCommand(interaction, userId, userName, serverId);
                    break;
                case 'stats':
                    await this.handleStatsCommand(interaction, userId, userName, serverId);
                    break;
                case 'progress':
                    await this.handleProgressCommand(interaction, userId, userName, serverId);
                    break;
            }

        } catch (error) {
            console.error('称号コマンドエラー:', error);
            
            const errorMessage = '称号情報の取得中にエラーが発生しました。';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }, // ←コンマ追加

    async handleListCommand(interaction, userId, userName, serverId) {
        try {
            const userAchievements = await achievementManager.getUserAchievements(userId, serverId);
            const stats = await achievementManager.getUserStats(userId, serverId);

            if (userAchievements.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🏆 称号一覧')
                    .setDescription('まだ称号を取得していません。\n鳥類園で活動して称号を獲得しましょう！')
                    .setColor(0x808080)
                    .addFields({
                        name: '💡 ヒント',
                        value: '• 餌やりをして「はじめての餌やり」を獲得\n• ガチャを回して「ガチャ初心者」を獲得\n• 鳥と仲良くなって「はじめての絆」を獲得',
                        inline: false
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // 称号をレアリティ別に分類
            const achievementsByRarity = {};
            
            for (const achievementTitle of userAchievements) {
                const achievement = this.findAchievementByTitle(achievementTitle);
                if (achievement) {
                    const rarity = achievement.rarity;
                    if (!achievementsByRarity[rarity]) {
                        achievementsByRarity[rarity] = [];
                    }
                    achievementsByRarity[rarity].push({
                        title: achievementTitle,
                        ...achievement
                    });
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('🏆 称号一覧')
                .setDescription(`${userName}さんの獲得称号: **${userAchievements.length}個**`)
                .setColor(0xFFD700)
                .setTimestamp();

            // レアリティ順で表示
            const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
            const rarityNames = {
                'mythic': '🌟 神話',
                'legendary': '👑 伝説', 
                'epic': '💜 叙事詩',
                'rare': '💙 レア',
                'uncommon': '💚 アンコモン',
                'common': '🤍 コモン'
            };

            for (const rarity of rarityOrder) {
                if (achievementsByRarity[rarity]) {
                    const achievementList = achievementsByRarity[rarity]
                        .map(achievement => `${achievement.emoji} **${achievement.title}**\n*${achievement.description}*`)
                        .join('\n\n');

                    embed.addFields({
                        name: rarityNames[rarity],
                        value: achievementList,
                        inline: false
                    });
                }
            }

            // 総合ランク表示
            const rank = this.calculateUserRank(stats, userAchievements.length);
            embed.addFields({
                name: '🏅 総合ランク',
                value: `${rank.emoji} **${rank.name}**\n${rank.description}`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('称号一覧表示エラー:', error);
            await interaction.editReply({ content: '称号一覧の表示中にエラーが発生しました。' });
        }
    }, // ←コンマ追加

    async handleStatsCommand(interaction, userId, userName, serverId) {
        try {
            const stats = await achievementManager.getUserStats(userId, serverId);
            const userAchievements = await achievementManager.getUserAchievements(userId, serverId);

            const embed = new EmbedBuilder()
                .setTitle('📊 詳細統計')
                .setDescription(`${userName}さんの鳥類園活動記録`)
                .setColor(0x00AE86)
                .addFields(
                    {
                        name: '🍽️ 餌やり統計',
                        value: `• 総餌やり回数: **${stats.totalFeeds || 0}回**\n• 餌やりした鳥の種類: **${stats.uniqueBirdsFed || 0}種**\n• 早朝餌やり: **${stats.morningFeeds || 0}回**\n• 夜間餌やり: **${stats.lateFeeds || 0}回**`,
                        inline: true
                    },
                    {
                        name: '💝 友情統計',
                        value: `• 好感度最大の鳥: **${stats.maxAffinityBirds || 0}羽**\n• レベル10の鳥: **${stats.level10Birds || 0}羽**`,
                        inline: true
                    },
                    {
                        name: '🎁 贈り物統計',
                        value: `• 受け取った贈り物: **${stats.totalGiftsReceived || 0}個**\n• 贈った贈り物: **${stats.totalGiftsGiven || 0}個**`,
                        inline: true
                    },
                    {
                        name: '🎲 ガチャ統計', 
                        value: `• ガチャ回数: **${stats.totalGachas || 0}回**\n• 見学招待数: **${stats.visitorsInvited || 0}羽**`,
                        inline: true
                    },
                    {
                        name: '🏆 称号統計',
                        value: `• 取得済み称号: **${userAchievements.length}個**\n• 全称号数: **${this.getTotalAchievementCount()}個**\n• 達成率: **${Math.round((userAchievements.length / this.getTotalAchievementCount()) * 100)}%**`,
                        inline: true
                    },
                    {
                        name: '🗺️ 探索統計',
                        value: `• 全エリア制覇: **${stats.allAreasExplored ? 'はい' : 'いいえ'}**`,
                        inline: true
                    }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('統計表示エラー:', error);
            await interaction.editReply({ content: '統計情報の表示中にエラーが発生しました。' });
        }
    }, // ←コンマ追加

    async handleProgressCommand(interaction, userId, userName, serverId) {
        try {
            const stats = await achievementManager.getUserStats(userId, serverId);
            const userAchievements = await achievementManager.getUserAchievements(userId, serverId);

            const embed = new EmbedBuilder()
                .setTitle('📈 称号進捗')
                .setDescription(`${userName}さんの未取得称号の進捗状況`)
                .setColor(0xFFA500)
                .setTimestamp();

            const progressList = [];

            // 全ての称号をチェックして進捗を計算
            for (const [category, achievements] of Object.entries(achievementManager.achievements)) {
                for (const [title, achievement] of Object.entries(achievements)) {
                    
                    // 既に取得済みの称号はスキップ
                    if (userAchievements.includes(title)) continue;

                    const progress = this.calculateProgress(achievement, stats);
                    if (progress.percentage > 0) {
                        progressList.push({
                            title,
                            achievement,
                            progress,
                            category
                        });
                    }
                }
            }

            // 進捗率でソート
            progressList.sort((a, b) => b.progress.percentage - a.progress.percentage);

            if (progressList.length === 0) {
                embed.addFields({
                    name: '🎉 おめでとうございます！',
                    value: '進捗中の称号がありません。新しい活動を始めてみましょう！',
                    inline: false
                });
            } else {
                // 上位10個の進捗を表示
                const topProgress = progressList.slice(0, 10);
                
                for (const item of topProgress) {
                    const progressBar = this.createProgressBar(item.progress.percentage);
                    const progressText = `${progressBar} ${item.progress.current}/${item.progress.required} (${Math.round(item.progress.percentage)}%)\n*${item.achievement.description}*`;
                    
                    embed.addFields({
                        name: `${item.achievement.emoji} ${item.title}`,
                        value: progressText,
                        inline: false
                    });
                }

                if (progressList.length > 10) {
                    embed.addFields({
                        name: '📋 その他',
                        value: `他に${progressList.length - 10}個の称号が進行中です`,
                        inline: false
                    });
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('進捗表示エラー:', error);
            await interaction.editReply({ content: '進捗情報の表示中にエラーが発生しました。' });
        }
    }, // ←コンマ追加

    findAchievementByTitle(title) {
        for (const [category, achievements] of Object.entries(achievementManager.achievements)) {
            if (achievements[title]) {
                return achievements[title];
            }
        }
        return null;
    }, // ←コンマ追加

    calculateUserRank(stats, achievementCount) {
        const totalActivity = (stats.totalFeeds || 0) + (stats.totalGachas || 0) + (stats.maxAffinityBirds || 0) * 10 + achievementCount * 5;

        if (totalActivity >= 1000) {
            return { emoji: '🏆', name: '鳥類園マスター', description: '圧倒的な実績を持つ伝説の鳥愛好家' };
        } else if (totalActivity >= 500) {
            return { emoji: '👑', name: '鳥類園の隠者', description: '多くの鳥たちから信頼を勝ち取った者' };
        } else if (totalActivity >= 200) {
            return { emoji: '🎖️', name: '鳥類園の守護者', description: '鳥に愛され鳥を愛す者' };
        } else if (totalActivity >= 50) {
            return { emoji: '🥉', name: '無類の鳥好き', description: '鳥類園に親しんでいる愛好家' };
        } else {
            return { emoji: '🐣', name: '新米探索者', description: '鳥類園での冒険を始めたばかり' };
        }
    },

    calculateProgress(achievement, stats) {
        let current = 0;
        let required = 0;

        switch (achievement.condition) {
            case 'totalFeeds':
                current = stats.totalFeeds || 0;
                required = achievement.requirement;
                break;
            case 'maxAffinityBirds':
                current = stats.maxAffinityBirds || 0;
                required = achievement.requirement;
                break;
            case 'totalGiftsReceived':
                current = stats.totalGiftsReceived || 0;
                required = achievement.requirement;
                break;
            case 'totalGiftsGiven':
                current = stats.totalGiftsGiven || 0;
                required = achievement.requirement;
                break;
            case 'uniqueBirdsFed':
                current = stats.uniqueBirdsFed || 0;
                required = achievement.requirement;
                break;
            case 'totalGachas':
                current = stats.totalGachas || 0;
                required = achievement.requirement;
                break;
            case 'visitorsInvited':
                current = stats.visitorsInvited || 0;
                required = achievement.requirement;
                break;
            case 'morningFeeds':
                current = stats.morningFeeds || 0;
                required = achievement.requirement;
                break;
            case 'lateFeeds':
                current = stats.lateFeeds || 0;
                required = achievement.requirement;
                break;
            case 'allAreasExplored':
                current = stats.allAreasExplored || 0;
                required = achievement.requirement;
                break;
            case 'multiCondition':
                const progresses = Object.entries(achievement.requirements).map(([key, value]) => 
                    Math.min(100, ((stats[key] || 0) / value) * 100)
                );
                const minProgress = Math.min(...progresses);
                return {
                    current: Math.round(minProgress),
                    required: 100,
                    percentage: minProgress
                };
            default:
                return { current: 0, required: 1, percentage: 0 };
        }

        const percentage = Math.min(100, (current / required) * 100);
        return { current, required, percentage };
    }, // ←コンマ追加

    createProgressBar(percentage) {
        const barLength = 10;
        const filledLength = Math.round((percentage / 100) * barLength);
        const emptyLength = barLength - filledLength;
        
        return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    }, // ←コンマ追加

    getTotalAchievementCount() {
        let count = 0;
        for (const [category, achievements] of Object.entries(achievementManager.achievements)) {
            count += Object.keys(achievements).length;
        }
        return count;
    } // ←最後のメソッドはコンマなし
};
