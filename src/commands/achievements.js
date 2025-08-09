// achievements.js - 新しいユーティリティファイル

const sheetsManager = require('../../config/sheets');

class AchievementManager {
    constructor() {
        this.achievements = ACHIEVEMENTS; // 上記の称号定義を使用
        this.rarityColors = RARITY_COLORS;
    }

    // ユーザーの統計データを取得
    async getUserStats(userId, serverId) {
        try {
            // 餌やり統計
            const feedStats = await this.getFeedingStats(userId, serverId);
            
            // 好感度統計
            const affinityStats = await this.getAffinityStats(userId, serverId);
            
            // 贈り物統計
            const giftStats = await this.getGiftStats(userId, serverId);
            
            // ガチャ統計
            const gachaStats = await this.getGachaStats(userId, serverId);
            
            return {
                ...feedStats,
                ...affinityStats,
                ...giftStats,
                ...gachaStats
            };
            
        } catch (error) {
            console.error('ユーザー統計取得エラー:', error);
            return {};
        }
    },

    // 餌やり統計取得
    async getFeedingStats(userId, serverId) {
        const sheet = sheetsManager.sheets.feedLog;
        const rows = await sheet.getRows();
        
        const userFeeds = rows.filter(row => 
            row.get('ユーザーID') === userId && row.get('サーバーID') === serverId
        );
        
        const uniqueBirds = new Set(userFeeds.map(row => row.get('鳥名')));
        const totalFeeds = userFeeds.length;
        
        // 時間別統計
        const morningFeeds = userFeeds.filter(row => {
            const hour = new Date(row.get('日時')).getHours();
            return hour >= 7 && hour < 9;
        }).length;
        
        const lateFeeds = userFeeds.filter(row => {
            const hour = new Date(row.get('日時')).getHours();
            return hour >= 20 && hour < 22;
        }).length;
        
        // エリア別統計（zooLogから取得）
        const zooSheet = sheetsManager.sheets.zooLog;
        const zooRows = await zooSheet.getRows();
        const userZooActions = zooRows.filter(row => 
            row.get('ユーザーID') === userId && 
            row.get('サーバーID') === serverId &&
            row.get('アクション') === 'エリア表示'
        );
        
        const exploredAreas = new Set(userZooActions.map(row => row.get('エリア')));
        
        return {
            totalFeeds,
            uniqueBirdsFed: uniqueBirds.size,
            morningFeeds,
            lateFeeds,
            allAreasExplored: exploredAreas.size >= 3 ? 1 : 0
        };
    },

    // 好感度統計取得
    async getAffinityStats(userId, serverId) {
        const sheet = sheetsManager.sheets.userAffinity;
        const rows = await sheet.getRows();
        
        const userAffinities = rows.filter(row => 
            row.get('ユーザーID') === userId && row.get('サーバーID') === serverId
        );
        
        // 最新の各鳥の好感度を取得
        const latestAffinities = {};
        userAffinities.forEach(row => {
            const birdName = row.get('鳥名');
            const level = parseInt(row.get('好感度レベル')) || 0;
            const date = new Date(row.get('日時'));
            
            if (!latestAffinities[birdName] || date > latestAffinities[birdName].date) {
                latestAffinities[birdName] = { level, date };
            }
        });
        
        const maxAffinityBirds = Object.values(latestAffinities).filter(a => a.level >= 5).length;
        const level10Birds = Object.values(latestAffinities).filter(a => a.level >= 10).length;
        
        return {
            maxAffinityBirds,
            level10Birds
        };
    },

    // 贈り物統計取得
    async getGiftStats(userId, serverId) {
        // 受け取った贈り物
        const inventorySheet = sheetsManager.sheets.giftsInventory;
        const inventoryRows = await inventorySheet.getRows();
        
        const receivedGifts = inventoryRows.filter(row => 
            row.get('ユーザーID') === userId && 
            row.get('サーバーID') === serverId &&
            parseInt(row.get('個数')) > 0
        );
        
        const totalGiftsReceived = receivedGifts.reduce((sum, row) => 
            sum + (parseInt(row.get('個数')) || 0), 0
        );
        
        // 贈った贈り物
        const birdGiftsSheet = sheetsManager.sheets.birdGifts;
        const birdGiftsRows = await birdGiftsSheet.getRows();
        
        const givenGifts = birdGiftsRows.filter(row => 
            row.get('贈り主ユーザーID') === userId && row.get('サーバーID') === serverId
        );
        
        const totalGiftsGiven = givenGifts.length;
        
        return {
            totalGiftsReceived,
            totalGiftsGiven
        };
    },

    // ガチャ統計取得
    async getGachaStats(userId, serverId) {
        const sheet = sheetsManager.sheets.gachaLog;
        const rows = await sheet.getRows();
        
        const userGachas = rows.filter(row => 
            row.get('ユーザーID') === userId && row.get('サーバーID') === serverId
        );
        
        const totalGachas = userGachas.length;
        
        // 見学招待数（イベントログから取得）
        const eventsSheet = sheetsManager.sheets.events;
        const eventRows = await eventsSheet.getRows();
        
        const visitorsInvited = eventRows.filter(row => 
            row.get('サーバーID') === serverId &&
            row.get('イベント種類') === '見学招待' &&
            row.get('内容').includes(userId) // ユーザー名が含まれているかチェック
        ).length;
        
        return {
            totalGachas,
            visitorsInvited
        };
    },

    // 称号チェック
    async checkAchievements(userId, userName, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
            const stats = await this.getUserStats(userId, serverId);
            const newAchievements = [];
            
            // 既存の称号を取得
            const existingAchievements = await this.getUserAchievements(userId, serverId);
            
            // 全ての称号をチェック
            for (const [category, achievements] of Object.entries(this.achievements)) {
                for (const [title, achievement] of Object.entries(achievements)) {
                    
                    // 既に取得済みかチェック
                    if (existingAchievements.includes(title)) continue;
                    
                    // 条件チェック
                    const isEarned = this.checkAchievementCondition(achievement, stats);
                    
                    if (isEarned) {
                        newAchievements.push({
                            title,
                            ...achievement,
                            category
                        });
                        
                        // スプレッドシートに記録
                        await sheetsManager.logAchievement(
                            userId,
                            userName,
                            title,
                            achievement.description,
                            serverId
                        );
                    }
                }
            }
            
            return newAchievements;
            
        } catch (error) {
            console.error('称号チェックエラー:', error);
            return [];
        }
    },

    // 称号条件の判定
    checkAchievementCondition(achievement, stats) {
        switch (achievement.condition) {
            case 'totalFeeds':
                return stats.totalFeeds >= achievement.requirement;
                
            case 'maxAffinityBirds':
                return stats.maxAffinityBirds >= achievement.requirement;
                
            case 'totalGiftsReceived':
                return stats.totalGiftsReceived >= achievement.requirement;
                
            case 'totalGiftsGiven':
                return stats.totalGiftsGiven >= achievement.requirement;
                
            case 'uniqueBirdsFed':
                return stats.uniqueBirdsFed >= achievement.requirement;
                
            case 'allAreasExplored':
                return stats.allAreasExplored >= achievement.requirement;
                
            case 'morningFeeds':
                return stats.morningFeeds >= achievement.requirement;
                
            case 'lateFeeds':
                return stats.lateFeeds >= achievement.requirement;
                
            case 'totalGachas':
                return stats.totalGachas >= achievement.requirement;
                
            case 'visitorsInvited':
                return stats.visitorsInvited >= achievement.requirement;
                
            case 'multiCondition':
                return Object.entries(achievement.requirements).every(([key, value]) => 
                    stats[key] >= value
                );
                
            default:
                return false;
        }
    },

    // ユーザーの既存称号取得
    async getUserAchievements(userId, serverId) {
        try {
            const sheet = sheetsManager.sheets.userAchievements;
            const rows = await sheet.getRows();
            
            return rows
                .filter(row => 
                    row.get('ユーザーID') === userId && row.get('サーバーID') === serverId
                )
                .map(row => row.get('称号名'));
                
        } catch (error) {
            console.error('既存称号取得エラー:', error);
            return [];
        }
    }
}

module.exports = new AchievementManager();
