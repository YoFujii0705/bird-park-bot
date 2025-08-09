// 称号システムの設計

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

    // 🎁 贈り物関連の称号
    gifts: {
        'はじめての贈り物': {
            condition: 'totalGiftsGiven',
            requirement: 1,
            description: '初めて鳥に贈り物をしました',
            emoji: '🎁',
            rarity: 'common'
        },
        '贈り物コレクター': {
            condition: 'totalGiftsReceived',
            requirement: 5,
            description: '鳥から5個の贈り物をもらいました',
            emoji: '📦',
            rarity: 'uncommon'
        },
        '愛されし者': {
            condition: 'totalGiftsReceived',
            requirement: 20,
            description: '鳥から20個の贈り物をもらいました',
            emoji: '💎',
            rarity: 'rare'
        },
        '心優しき贈り主': {
            condition: 'totalGiftsGiven',
            requirement: 10,
            description: '鳥に10個の贈り物をしました',
            emoji: '🎊',
            rarity: 'uncommon'
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
        '伝説の鳥使い': {
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
