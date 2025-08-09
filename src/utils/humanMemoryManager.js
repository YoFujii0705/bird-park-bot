// 🌟 人間主語の思い出システム（確率システム実装版）
const { EmbedBuilder } = require('discord.js');

// 🎲 思い出の希少度別確率設定
const MEMORY_RARITY = {
    guaranteed: {
        probability: 1.0,    // 100% (重要なマイルストーン)
        color: 0xFF1493,     // ピンク
        name: '特別な思い出',
        emoji: '⭐'
    },
    legendary: {
        probability: 0.02,   // 2% (奇跡的な瞬間)
        color: 0xFFD700,     // 金
        name: '伝説的な思い出',
        emoji: '🟡'
    },
    epic: {
        probability: 0.05,   // 5% (完璧な条件)
        color: 0x9900FF,     // 紫
        name: 'エピックな思い出',
        emoji: '🟣'
    },
    rare: {
        probability: 0.08,   // 8% (特殊天気)
        color: 0x0066FF,     // 青
        name: 'レアな思い出',
        emoji: '🔵'
    },
    uncommon: {
        probability: 0.15,   // 15% (天気条件など)
        color: 0x00FF00,     // 緑
        name: '珍しい思い出',
        emoji: '🟢'
    },
    common: {
        probability: 0.3,    // 30% (基本的な思い出)
        color: 0x808080,     // グレー
        name: 'よくある思い出',
        emoji: '⚪'
    }
};

// 思い出の種類とパターン（レアリティ付き）
const MEMORY_PATTERNS = {
    // 🍽️ 餌やりの思い出
    feeding: {
        'はじめての餌やり': {
            condition: (action) => action.type === 'feed' && action.isFirstTime,
            memory: (userName, birdName, details) => 
                `初めて${birdName}に${details.food}をあげた日。緊張したけど、喜んで食べてくれて嬉しかった。`,
            icon: '🍽️',
            rarity: 'guaranteed' // 重要なので必ず生成
        },
        '好物発見': {
            condition: (action) => action.type === 'feed' && action.preference === 'favorite' && action.isFirstFavorite,
            memory: (userName, birdName, details) => 
                `${birdName}の好物が${details.food}だと分かった日。あんなに喜んでくれるなんて、発見できて良かった！`,
            icon: '🌟',
            rarity: 'common'
        },
        '雨の日の餌やり': {
            condition: (action) => action.type === 'feed' && (action.weather === 'rainy' || action.weather === 'drizzle'),
            memory: (userName, birdName, details) => 
                `雨の日に${birdName}に${details.food}をあげた。${details.weatherDescription}の中、濡れながらも来てくれて、${birdName}も嬉しそうだった。`,
            icon: '🌧️',
            rarity: 'uncommon'
        },
        '雪の日の餌やり': {
            condition: (action) => action.type === 'feed' && action.weather === 'snow',
            memory: (userName, birdName, details) => 
                `雪の日に${birdName}に${details.food}をあげた。${details.weatherDescription}の中、${birdName}が雪をかぶりながら食べる姿が美しかった。`,
            icon: '❄️',
            rarity: 'rare'
        },
        '虹の日の餌やり': {
            condition: (action) => action.type === 'feed' && action.weather === 'rainbow',
            memory: (userName, birdName, details) => 
                `虹が出た日に${birdName}に${details.food}をあげた。${details.weatherDescription}の下で、${birdName}と一緒に虹を見上げた特別な瞬間。`,
            icon: '🌈',
            rarity: 'legendary'
        },
        '霧の日の餌やり': {
            condition: (action) => action.type === 'feed' && action.weather === 'foggy',
            memory: (userName, birdName, details) => 
                `霧の深い日に${birdName}に${details.food}をあげた。${details.weatherDescription}の中、幻想的な雰囲気で過ごした静かな時間。`,
            icon: '🌫️',
            rarity: 'rare'
        },
        '暴風の日の餌やり': {
            condition: (action) => action.type === 'feed' && action.weather === 'stormy',
            memory: (userName, birdName, details) => 
                `嵐の日に${birdName}に${details.food}をあげた。${details.weatherDescription}で大変だったけど、${birdName}が心配で駆けつけた。`,
            icon: '⛈️',
            rarity: 'rare'
        },
        '暑い日の餌やり': {
            condition: (action) => action.type === 'feed' && action.temperature >= 30,
            memory: (userName, birdName, details) => 
                `暑い日（${details.temperature}°C）に${birdName}に${details.food}をあげた。暑さでぐったりしていた${birdName}が少し元気になってくれた。`,
            icon: '🌡️',
            rarity: 'uncommon'
        },
        '寒い日の餌やり': {
            condition: (action) => action.type === 'feed' && action.temperature <= 5,
            memory: (userName, birdName, details) => 
                `寒い日（${details.temperature}°C）に${birdName}に${details.food}をあげた。${birdName}は寒そうだったけど少しは寒さが和らいだかな。`,
            icon: '🥶',
            rarity: 'uncommon'
        },
        '早朝の餌やり': {
            condition: (action) => action.type === 'feed' && action.hour >= 6 && action.hour < 8,
            memory: (userName, birdName, details) => 
                `早起きして${birdName}に${details.food}をあげた朝。朝日の中で食べる姿がとても美しかった。`,
            icon: '🌅',
            rarity: 'uncommon'
        },
        '夜の餌やり': {
            condition: (action) => action.type === 'feed' && action.hour >= 20,
            memory: (userName, birdName, details) => 
                `夜遅くに${birdName}に${details.food}をあげた。月明かりの下、静かに食べる姿が印象的だった。`,
            icon: '🌙',
            rarity: 'uncommon'
        },
        '完璧な晴天': {
            condition: (action) => action.type === 'feed' && action.weather === 'sunny' && action.temperature >= 20 && action.temperature <= 25,
            memory: (userName, birdName, details) => 
                `完璧な晴天の日に${birdName}に${details.food}をあげた。${details.weatherDescription}で、${birdName}も私も最高の気分だった。`,
            icon: '☀️',
            rarity: 'epic'
        },
        '満月の夜': {
            condition: (action) => action.type === 'feed' && action.hour >= 20 && action.weather === 'clear',
            memory: (userName, birdName, details) => 
                `満月の夜に${birdName}に${details.food}をあげた。月明かりに照らされた${birdName}の姿が神秘的だった。`,
            icon: '🌕',
            rarity: 'epic'
        },
        '雨上がりの虹': {
            condition: (action) => action.type === 'feed' && action.weather === 'rainbow',
            memory: (userName, birdName, details) => 
                `雨上がりに虹が出た日、${birdName}に${details.food}をあげた。${birdName}と一緒に見上げた虹は、希望の象徴のように美しかった。`,
            icon: '🌈',
            rarity: 'legendary'
        },
        '100回目の餌やり': {
            condition: (action) => action.type === 'feed' && action.totalFeeds === 100,
            memory: (userName, birdName, details) => 
                `${birdName}への100回目の餌やり。こんなに長く続けられるなんて、自分でも驚いている。`,
            icon: '💯',
            rarity: 'guaranteed' // マイルストーンなので確実に
        }
    },

    // 💝 好感度の思い出
    affinity: {
        '絆の始まり': {
            condition: (action) => action.type === 'affinity' && action.newLevel === 5,
            memory: (userName, birdName, details) => 
                `${birdName}との絆が深まった日。なんだか、本当の友達になれた気がする。`,
            icon: '💖',
            rarity: 'guaranteed' // 重要なマイルストーン
        },
        '完全な信頼': {
            condition: (action) => action.type === 'affinity' && action.newLevel === 10,
            memory: (userName, birdName, details) => 
                `${birdName}が完全に心を開いてくれた日。最高レベルの信頼関係を築けて、とても感動した。`,
            icon: '👑',
            rarity: 'guaranteed' // 最高の達成なので確実に
        }
    },

    // 🎁 贈り物の思い出
    gifts: {
        '初めての贈り物': {
            condition: (action) => action.type === 'gift_given' && action.isFirst,
            memory: (userName, birdName, details) => 
                `初めて${birdName}に${details.giftName}をプレゼントした日。あんなに喜んでくれるなんて嬉しい誤算だった。`,
            icon: '🎁',
            rarity: 'guaranteed' // 初回は確実に
        },
        '特別な贈り物': {
            condition: (action) => action.type === 'gift_given' && action.giftCount >= 5,
            memory: (userName, birdName, details) => 
                `${birdName}に${details.giftName}をあげた。もう${action.giftCount}個目の贈り物。いつも大切にしてくれて嬉しい。`,
            icon: '💝',
            rarity: 'common'
        },
        '初めてもらった贈り物': {
            condition: (action) => action.type === 'gift_received' && action.isFirstReceived,
            memory: (userName, birdName, details) => 
                `${birdName}から初めて${details.giftName}をもらった日。こんなに素敵な贈り物がもらえるなんて、夢みたい！`,
            icon: '🌟',
            rarity: 'guaranteed' // 初回は確実に
        },
        '珍しい贈り物': {
            condition: (action) => action.type === 'gift_received' && action.rarity === 'rare',
            memory: (userName, birdName, details) => 
                `${birdName}から珍しい${details.giftName}をもらった。こんな特別なものを見つけて持ってきてくれるなんて。`,
            icon: '💎',
            rarity: 'rare' // レアアイテムはレア思い出
        }
    }
};

// 思い出の管理クラス
class HumanMemoryManager {
    constructor() {
        this.memoryPatterns = MEMORY_PATTERNS;
        this.rarityData = MEMORY_RARITY;
    }

    // 🌟 新しい思い出の生成（確率システム付き）
    async createMemory(userId, userName, birdName, actionData, guildId) {
        try {
            // 条件に合う思い出パターンをチェック
            for (const [category, patterns] of Object.entries(this.memoryPatterns)) {
                for (const [memoryType, config] of Object.entries(patterns)) {
                    
                    if (config.condition(actionData)) {
                        // 🎲 確率判定
                        const rarity = config.rarity || 'common';
                        const probability = this.rarityData[rarity].probability;
                        const roll = Math.random();
                        
                        console.log(`🎲 思い出確率チェック: ${memoryType} (${rarity}) - ${(probability * 100).toFixed(1)}% (ロール: ${(roll * 100).toFixed(1)}%)`);
                        
                        if (roll <= probability) {
                            // 思い出を生成
                            const memory = {
                                id: this.generateMemoryId(),
                                type: memoryType,
                                category: category,
                                rarity: rarity,
                                content: config.memory(userName, birdName, actionData.details || {}),
                                icon: config.icon,
                                birdName: birdName,
                                userId: userId,
                                userName: userName,
                                createdAt: new Date(),
                                details: actionData.details || {}
                            };

                            // スプレッドシートに保存
                            await this.saveMemoryToSheet(memory, guildId);
                            
                            console.log(`💭 新しい思い出が生まれました: ${memoryType} (${rarity})`);
                            return memory;
                        } else {
                            console.log(`❌ 思い出生成失敗: ${memoryType} (確率: ${(probability * 100).toFixed(1)}%, ロール: ${(roll * 100).toFixed(1)}%)`);
                            return null; // 確率失敗時はnullを返して処理を終了
                        }
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('思い出生成エラー:', error);
            return null;
        }
    }

    // 思い出ID生成
    generateMemoryId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // スプレッドシートに思い出を保存（レアリティ情報付き）
    async saveMemoryToSheet(memory, guildId) {
        try {
            const sheetsManager = require('../../config/sheets');
            await sheetsManager.ensureInitialized();
            
            // 新しいシート: user_memories
            const sheet = sheetsManager.sheets.userMemories;
            await sheet.addRow({
                日時: memory.createdAt.toLocaleString('ja-JP'),
                ユーザーID: memory.userId,
                ユーザー名: memory.userName,
                鳥名: memory.birdName,
                思い出種類: memory.type,
                カテゴリ: memory.category,
                レアリティ: memory.rarity, // 🆕 レアリティ情報を追加
                内容: memory.content,
                アイコン: memory.icon,
                詳細: JSON.stringify(memory.details),
                サーバーID: guildId
            });
            
        } catch (error) {
            console.error('思い出保存エラー:', error);
        }
    }

    // ユーザーの思い出を取得（レアリティ情報付き）
    async getUserMemories(userId, guildId) {
        try {
            const sheetsManager = require('../../config/sheets');
            await sheetsManager.ensureInitialized();
            
            const sheet = sheetsManager.sheets.userMemories;
            const rows = await sheet.getRows();
            
            return rows
                .filter(row => 
                    row.get('ユーザーID') === userId && row.get('サーバーID') === guildId
                )
                .map(row => ({
                    type: row.get('思い出種類'),
                    category: row.get('カテゴリ'),
                    rarity: row.get('レアリティ') || 'common', // 🆕 レアリティ情報
                    content: row.get('内容'),
                    icon: row.get('アイコン'),
                    birdName: row.get('鳥名'),
                    createdAt: row.get('日時'),
                    details: JSON.parse(row.get('詳細') || '{}')
                }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
        } catch (error) {
            console.error('思い出取得エラー:', error);
            return [];
        }
    }

    // 🎁 贈り物履歴の取得
    async getGiftHistory(userId, guildId) {
        try {
            const sheetsManager = require('../../config/sheets');
            await sheetsManager.ensureInitialized();
            
            // 鳥に贈った贈り物の履歴
            const birdGiftsSheet = sheetsManager.sheets.birdGifts;
            const birdGiftsRows = await birdGiftsSheet.getRows();
            
            const givenGifts = birdGiftsRows
                .filter(row => 
                    row.get('贈り主ユーザーID') === userId && row.get('サーバーID') === guildId
                )
                .map(row => ({
                    日時: row.get('贈呈日時') || row.get('日時'),
                    鳥名: row.get('鳥名'),
                    贈り物名: row.get('贈り物名'),
                    キャプション: row.get('キャプション'),
                    type: 'given'
                }));

            // 鳥からもらった贈り物の履歴
            const receivedGiftsSheet = sheetsManager.sheets.birdGiftsReceived;
            const receivedGiftsRows = await receivedGiftsSheet.getRows();
            
            const receivedGifts = receivedGiftsRows
                .filter(row => 
                    row.get('ユーザーID') === userId && row.get('サーバーID') === guildId
                )
                .map(row => ({
                    日時: row.get('日時'),
                    鳥名: row.get('鳥名'),
                    贈り物名: row.get('贈り物名'),
                    好感度レベル: row.get('好感度レベル'),
                    エリア: row.get('エリア'),
                    type: 'received'
                }));

            // 両方を合わせて時系列順にソート
            const allGifts = [...givenGifts, ...receivedGifts]
                .sort((a, b) => new Date(b.日時) - new Date(a.日時));

            return allGifts;
            
        } catch (error) {
            console.error('贈り物履歴取得エラー:', error);
            return [];
        }
    }

    // 思い出の通知を送信（レアリティ表示付き）
    async sendMemoryNotification(interaction, memory) {
        try {
            const rarityInfo = this.rarityData[memory.rarity];
            
            const embed = new EmbedBuilder()
                .setTitle(`${memory.icon} ${rarityInfo.emoji} 新しい思い出`)
                .setDescription(`**${memory.birdName}**との思い出が追加されました`)
                .addFields({
                    name: `💭 ${memory.type} (${rarityInfo.name})`,
                    value: memory.content,
                    inline: false
                })
                .setColor(rarityInfo.color)
                .setTimestamp();

            // レアリティが高いほど目立つ表示
            if (memory.rarity === 'legendary' || memory.rarity === 'epic') {
                embed.setFooter({ text: '✨ とても貴重な思い出です！' });
            }

            setTimeout(() => {
                interaction.followUp({ embeds: [embed] });
            }, 6000); // 6秒後に送信
            
        } catch (error) {
            console.error('思い出通知エラー:', error);
        }
    }

    // 🔍 レアリティ統計の取得
    async getMemoryRarityStats(userId, guildId) {
        try {
            const memories = await this.getUserMemories(userId, guildId);
            const stats = {};
            
            // レアリティ別カウント
            Object.keys(this.rarityData).forEach(rarity => {
                stats[rarity] = memories.filter(m => m.rarity === rarity).length;
            });
            
            return stats;
            
        } catch (error) {
            console.error('レアリティ統計取得エラー:', error);
            return {};
        }
    }
}

module.exports = new HumanMemoryManager();
