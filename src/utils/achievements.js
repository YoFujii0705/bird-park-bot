// 称号システムの設計（贈り物分離版）
const sheetsManager = require('../../config/sheets');

const ACHIEVEMENTS = {
    // 🍽️ 餌やり関連の称号
    feeding: {
        'はじめての餌やり': {
            condition: 'totalFeeds',
            requirement: 1,
            description: '初めて鳥に餌をあげました',
            emoji: '🍽️',
            rarity: 'common'
        },
        '鳥好き': {
            condition: 'totalFeeds', 
            requirement: 10,
            description: '合計10回餌をあげました',
            emoji: '🐦',
            rarity: 'common'
        },
        '鳥マスター': {
            condition: 'totalFeeds',
            requirement: 50,
            description: '合計50回餌をあげました',
            emoji: '🎯',
            rarity: 'uncommon'
        },
        '鳥の友': {
            condition: 'totalFeeds',
            requirement: 100,
            description: '合計100回餌をあげました',
            emoji: '👑',
            rarity: 'rare'
        },
        '鳥類園の守護者': {
            condition: 'totalFeeds',
            requirement: 500,
            description: '合計500回餌をあげました',
            emoji: '🛡️',
            rarity: 'legendary'
        }
    },

    // 💝 好感度関連の称号
    affinity: {
        'はじめての絆': {
            condition: 'maxAffinityBirds',
            requirement: 1,
            description: '1羽と好感度レベル5に到達しました',
            emoji: '💖',
            rarity: 'common'
        },
        '愛鳥家': {
            condition: 'maxAffinityBirds',
            requirement: 3,
            description: '3羽と好感度レベル5に到達しました', 
            emoji: '💕',
            rarity: 'uncommon'
        },
        '鳥たちの癒やし': {
            condition: 'maxAffinityBirds',
            requirement: 10,
            description: '10羽と好感度レベル5に到達しました',
            emoji: '🤝',
            rarity: 'rare'
        },
        '永遠のパートナー': {
            condition: 'maxAffinityBirds',
            requirement: 20,
            description: '20羽と好感度レベル5に到達しました',
            emoji: '🗣️',
            rarity: 'epic'
        }
    },

    // 🎁 人間→鳥への贈り物関連の称号
    giving: {
        'はじめての贈り物': {
            condition: 'totalGiftsGiven',
            requirement: 1,
            description: '初めて鳥に贈り物をしました',
            emoji: '🎁',
            rarity: 'common'
        },
        '心優しき隣人': {
            condition: 'totalGiftsGiven',
            requirement: 5,
            description: '鳥に5個の贈り物をしました',
            emoji: '🎊',
            rarity: 'uncommon'
        },
        '創造的な贈与者': {
            condition: 'totalGiftsGiven',
            requirement: 15,
            description: '鳥に15個の贈り物をしました',
            emoji: '💝',
            rarity: 'rare'
        },
        '鳥たちを見守る光': {
            condition: 'totalGiftsGiven',
            requirement: 50,
            description: '鳥に50個の贈り物をしました',
            emoji: '👑',
            rarity: 'epic'
        }
    },

    // 🌿 鳥→人間からの贈り物関連の称号
    receiving: {
        'はじめての宝物': {
            condition: 'totalGiftsReceived',
            requirement: 1,
            description: '初めて鳥から贈り物をもらいました',
            emoji: '🌟',
            rarity: 'common'
        },
        '自然の恵みコレクター': {
            condition: 'totalGiftsReceived',
            requirement: 5,
            description: '鳥から5個の贈り物をもらいました',
            emoji: '📦',
            rarity: 'uncommon'
        },
        'ちょっとした宝物庫': {
            condition: 'totalGiftsReceived',
            requirement: 15,
            description: '鳥から15個の贈り物をもらいました',
            emoji: '💎',
            rarity: 'rare'
        },
        '愛されし者': {
            condition: 'totalGiftsReceived',
            requirement: 30,
            description: '鳥から30個の贈り物をもらいました',
            emoji: '✨',
            rarity: 'epic'
        },
        '鳥たちの仲間': {
            condition: 'totalGiftsReceived',
            requirement: 100,
            description: '鳥から100個の贈り物をもらいました',
            emoji: '🌈',
            rarity: 'legendary'
        }
    },

    // 💫 贈り物バランス関連の称号
    giftBalance: {
        '心の交流': {
            condition: 'multiCondition',
            requirements: {
                totalGiftsGiven: 10,
                totalGiftsReceived: 10
            },
            description: '鳥との間で10個ずつ贈り物を交換しました',
            emoji: '💫',
            rarity: 'rare'
        },
        '真の友情': {
            condition: 'multiCondition',
            requirements: {
                totalGiftsGiven: 25,
                totalGiftsReceived: 25,
                maxAffinityBirds: 5
            },
            description: '多くの鳥と深い友情を築きました',
            emoji: '🌺',
            rarity: 'epic'
        }
    },

    // 🏞️ 鳥類園関連の称号
    zoo: {
        '鳥類園探検家': {
            condition: 'uniqueBirdsFed',
            requirement: 10,
            description: '10種類の異なる鳥に餌をあげました',
            emoji: '🔍',
            rarity: 'uncommon'
        },
        '全エリア制覇': {
            condition: 'allAreasExplored',
            requirement: 1,
            description: '全てのエリアで餌やりをしました',
            emoji: '🗺️',
            rarity: 'rare'
        },
        '早起きの鳥好き': {
            condition: 'morningFeeds',
            requirement: 10,
            description: '朝7-9時に10回餌やりをしました',
            emoji: '🌅',
            rarity: 'uncommon'
        },
        '夜の配給者': {
            condition: 'lateFeeds', 
            requirement: 5,
            description: '夜20-22時に5回餌やりをしました',
            emoji: '🌙',
            rarity: 'rare'
        }
    },

    // 🎲 ガチャ関連の称号
    gacha: {
        'ガチャ初心者': {
            condition: 'totalGachas',
            requirement: 1,
            description: '初めてガチャを回しました',
            emoji: '🎰',
            rarity: 'common'
        },
        'ガチャ愛好家': {
            condition: 'totalGachas',
            requirement: 20,
            description: '20回ガチャを回しました',
            emoji: '🎯',
            rarity: 'uncommon'
        },
        '熱心な招待者': {
            condition: 'visitorsInvited',
            requirement: 5,
            description: '5羽を見学に招待しました',
            emoji: '👥',
            rarity: 'rare'
        }
    },

    // 🌟 特別な称号
    special: {
        '伝説の愛鳥家': {
            condition: 'multiCondition',
            requirements: {
                totalFeeds: 200,
                maxAffinityBirds: 15,
                totalGiftsGiven: 20
            },
            description: '餌やり200回、好感度最大15羽、贈り物20個の偉業を達成',
            emoji: '👑',
            rarity: 'legendary'
        },
        '鳥類園の功労者': {
            condition: 'multiCondition',
            requirements: {
                totalFeeds: 1000,
                uniqueBirdsFed: 50,
                visitorsInvited: 20
            },
            description: '鳥類園に多大な貢献をしました',
            emoji: '🏆',
            rarity: 'mythic'
        },
        '自然と人の架け橋': {
            condition: 'multiCondition',
            requirements: {
                totalGiftsGiven: 50,
                totalGiftsReceived: 50,
                maxAffinityBirds: 25
            },
            description: '人と鳥の間で究極の絆を築きました',
            emoji: '🌍',
            rarity: 'mythic'
        }
    }
};

// レアリティ別の色設定
const RARITY_COLORS = {
    common: 0x808080,      // グレー
    uncommon: 0x00FF00,    // 緑
    rare: 0x0080FF,        // 青  
    epic: 0x8000FF,        // 紫
    legendary: 0xFFD700,   // ゴールド
    mythic: 0xFF69B4       // ピンク
};

class AchievementManager {
    constructor() {
        this.achievements = ACHIEVEMENTS;
        this.rarityColors = RARITY_COLORS;
    }

    // ユーザーの統計データを取得
    async getUserStats(userId, serverId) {
        try {
            // 餌やり統計
            const feedStats = await this.getFeedingStats(userId, serverId);
            
            // 好感度統計
            const affinityStats = await this.getAffinityStats(userId, serverId);
            
            // 贈り物統計（分離版）
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
    }

    // 餌やり統計取得
    async getFeedingStats(userId, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
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
            
            // エリア別統計（既存のfeed_logから推測）
            const areas = new Set();
            userFeeds.forEach(row => {
                // 鳥名からエリアを推測（実際のエリア情報がない場合の代替）
                areas.add('推測エリア'); // 実装時は適切なロジックに置き換え
            });
            
            return {
                totalFeeds,
                uniqueBirdsFed: uniqueBirds.size,
                morningFeeds,
                lateFeeds,
                allAreasExplored: areas.size >= 3 ? 1 : 0
            };
        } catch (error) {
            console.error('餌やり統計取得エラー:', error);
            return {
                totalFeeds: 0,
                uniqueBirdsFed: 0,
                morningFeeds: 0,
                lateFeeds: 0,
                allAreasExplored: 0
            };
        }
    }

    // 好感度統計取得
    async getAffinityStats(userId, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
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
        } catch (error) {
            console.error('好感度統計取得エラー:', error);
            return {
                maxAffinityBirds: 0,
                level10Birds: 0
            };
        }
    }

    // 🔧 贈り物統計取得（分離版）
    async getGiftStats(userId, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
            // 🎁 人間→鳥への贈り物（gifts_inventoryから取得した数 = 使用可能アイテム数）
            const inventorySheet = sheetsManager.sheets.giftsInventory;
            const inventoryRows = await inventorySheet.getRows();
            
            const giftItems = inventoryRows.filter(row => 
                row.get('ユーザーID') === userId && 
                row.get('サーバーID') === serverId &&
                parseInt(row.get('個数')) > 0
            );
            
            // 実際に鳥に贈った回数（bird_giftsシートから）
            const birdGiftsSheet = sheetsManager.sheets.birdGifts;
            const birdGiftsRows = await birdGiftsSheet.getRows();
            
            const givenGifts = birdGiftsRows.filter(row => 
                row.get('贈り主ユーザーID') === userId && row.get('サーバーID') === serverId
            );
            
            // 🌿 鳥→人間への贈り物（bird_gifts_receivedシートから）
            const receivedGiftsSheet = sheetsManager.sheets.birdGiftsReceived;
            const receivedGiftsRows = await receivedGiftsSheet.getRows();
            
            const receivedGifts = receivedGiftsRows.filter(row => 
                row.get('ユーザーID') === userId && row.get('サーバーID') === serverId
            );
            
            return {
                totalGiftsGiven: givenGifts.length,        // 人間→鳥への贈り物回数
                totalGiftsReceived: receivedGifts.length   // 鳥→人間への贈り物回数
            };
            
        } catch (error) {
            console.error('贈り物統計取得エラー:', error);
            return {
                totalGiftsGiven: 0,
                totalGiftsReceived: 0
            };
        }
    }

    // ガチャ統計取得
    async getGachaStats(userId, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
            const sheet = sheetsManager.sheets.gachaLog;
            const rows = await sheet.getRows();
            
            const userGachas = rows.filter(row => 
                row.get('ユーザーID') === userId && row.get('サーバーID') === serverId
            );
            
            const totalGachas = userGachas.length;
            
            // 見学招待数（gachaLogの詳細から推測）
            const visitorsInvited = userGachas.filter(row => 
                row.get('詳細') && row.get('詳細').includes('見学')
            ).length;
            
            return {
                totalGachas,
                visitorsInvited
            };
        } catch (error) {
            console.error('ガチャ統計取得エラー:', error);
            return {
                totalGachas: 0,
                visitorsInvited: 0
            };
        }
    }

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
    }

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
    }

    // ユーザーの既存称号取得
    async getUserAchievements(userId, serverId) {
        try {
            await sheetsManager.ensureInitialized();
            
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
