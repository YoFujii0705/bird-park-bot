const achievementManager = require('./achievements');
const { EmbedBuilder } = require('discord.js');

/**
 * 称号チェックとお知らせのヘルパー関数
 */
class AchievementHelper {
    
    /**
     * ユーザーの行動後に称号をチェックし、新規称号があれば通知
     */
    async checkAndNotifyAchievements(interaction, userId, userName, serverId) {
        try {
            const newAchievements = await achievementManager.checkAchievements(userId, userName, serverId);
            
            if (newAchievements.length > 0) {
                // 新しい称号を取得した場合の通知
                await this.sendAchievementNotification(interaction, newAchievements, userName);
                return newAchievements;
            }
            
            return [];
            
        } catch (error) {
            console.error('称号チェックエラー:', error);
            return [];
        }
    }

    /**
     * 称号取得通知を送信
     */
    async sendAchievementNotification(interaction, achievements, userName) {
        try {
            if (achievements.length === 1) {
                // 単一称号の場合
                const achievement = achievements[0];
                const embed = new EmbedBuilder()
                    .setTitle('🏆 称号獲得！')
                    .setDescription(`**${userName}**さんが新しい称号を獲得しました！`)
                    .setColor(this.getRarityColor(achievement.rarity))
                    .addFields({
                        name: `${achievement.emoji} ${achievement.title}`,
                        value: `*${achievement.description}*\n\n**レアリティ**: ${this.getRarityName(achievement.rarity)}`,
                        inline: false
                    })
                    .setFooter({ text: `カテゴリ: ${this.getCategoryName(achievement.category)}` })
                    .setTimestamp();

                await interaction.followUp({ embeds: [embed] });
                
            } else {
                // 複数称号の場合
                const embed = new EmbedBuilder()
                    .setTitle('🎉 複数称号獲得！')
                    .setDescription(`**${userName}**さんが **${achievements.length}個** の称号を同時獲得しました！`)
                    .setColor(0xFFD700);

                achievements.forEach(achievement => {
                    embed.addFields({
                        name: `${achievement.emoji} ${achievement.title}`,
                        value: `*${achievement.description}*`,
                        inline: true
                    });
                });

                embed.setTimestamp();
                await interaction.followUp({ embeds: [embed] });
            }

        } catch (error) {
            console.error('称号通知送信エラー:', error);
        }
    }

    /**
     * レアリティから色を取得
     */
    getRarityColor(rarity) {
        const colors = {
            common: 0x808080,      // グレー
            uncommon: 0x00FF00,    // 緑
            rare: 0x0080FF,        // 青  
            epic: 0x8000FF,        // 紫
            legendary: 0xFFD700,   // ゴールド
            mythic: 0xFF69B4       // ピンク
        };
        return colors[rarity] || 0x808080;
    }

    /**
     * レアリティ名を取得
     */
    getRarityName(rarity) {
        const names = {
            common: 'コモン',
            uncommon: 'アンコモン',
            rare: 'レア',
            epic: 'エピック',
            legendary: 'レジェンダリー',
            mythic: 'ミシック'
        };
        return names[rarity] || 'コモン';
    }

    /**
     * カテゴリ名を取得
     */
    getCategoryName(category) {
        const names = {
            feeding: '餌やり',
            affinity: '好感度',
            gifts: '贈り物',
            zoo: '鳥類園',
            gacha: 'ガチャ',
            special: '特別'
        };
        return names[category] || 'その他';
    }

    /**
     * 進捗バーを作成
     */
    createProgressBar(current, total, length = 10) {
        const percentage = Math.min(100, (current / total) * 100);
        const filledLength = Math.round((percentage / 100) * length);
        const emptyLength = length - filledLength;
        
        return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    }

    /**
     * 次の称号までの進捗を取得
     */
    async getNextAchievementProgress(userId, serverId) {
        try {
            const stats = await achievementManager.getUserStats(userId, serverId);
            const userAchievements = await achievementManager.getUserAchievements(userId, serverId);
            
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
            
            return progressList.slice(0, 3); // 上位3つを返す
            
        } catch (error) {
            console.error('次の称号進捗取得エラー:', error);
            return [];
        }
    }

    /**
     * 進捗計算
     */
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
    }
}

module.exports = new AchievementHelper();
