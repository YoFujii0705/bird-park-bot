// 🌟 人間主語の思い出システム

// 思い出の種類とパターン
const MEMORY_PATTERNS = {
    // 🍽️ 餌やりの思い出
    feeding: {
        'はじめての餌やり': {
            condition: (action) => action.type === 'feed' && action.isFirstTime,
            memory: (userName, birdName, details) => 
                `初めて${birdName}に${details.food}をあげた日。緊張したけど、喜んで食べてくれて嬉しかった。`,
            icon: '🍽️'
        },
        '好物発見': {
            condition: (action) => action.type === 'feed' && action.preference === 'favorite' && action.isFirstFavorite,
            memory: (userName, birdName, details) => 
                `${birdName}の好物が${details.food}だと分かった日。あんなに喜んでくれるなんて、発見できて良かった！`,
            icon: '🌟'
        },
        '雨の日の餌やり': {
            condition: (action) => action.type === 'feed' && action.weather === 'rainy',
            memory: (userName, birdName, details) => 
                `雨の日に${birdName}に${details.food}をあげた。濡れながらも来てくれて、${birdName}も嬉しそうだった。`,
            icon: '🌧️'
        },
        '早朝の餌やり': {
            condition: (action) => action.type === 'feed' && action.hour >= 6 && action.hour < 8,
            memory: (userName, birdName, details) => 
                `早起きして${birdName}に${details.food}をあげた朝。朝日の中で食べる姿がとても美しかった。`,
            icon: '🌅'
        },
        '夜の餌やり': {
            condition: (action) => action.type === 'feed' && action.hour >= 20,
            memory: (userName, birdName, details) => 
                `夜遅くに${birdName}に${details.food}をあげた。月明かりの下、静かに食べる姿が印象的だった。`,
            icon: '🌙'
        },
        '100回目の餌やり': {
            condition: (action) => action.type === 'feed' && action.totalFeeds === 100,
            memory: (userName, birdName, details) => 
                `${birdName}への100回目の餌やり。こんなに長く続けられるなんて、自分でも驚いている。`,
            icon: '💯'
        }
    },

    // 💝 好感度の思い出
    affinity: {
        '絆の始まり': {
            condition: (action) => action.type === 'affinity' && action.newLevel === 5,
            memory: (userName, birdName, details) => 
                `${birdName}との絆が深まった日。好感度レベル5になって、本当の友達になれた気がする。`,
            icon: '💖'
        },
        '完全な信頼': {
            condition: (action) => action.type === 'affinity' && action.newLevel === 10,
            memory: (userName, birdName, details) => 
                `${birdName}が完全に心を開いてくれた日。最高レベルの信頼関係を築けて、とても感動した。`,
            icon: '👑'
        }
    },

    // 🎁 贈り物の思い出
    gifts: {
        '初めての贈り物': {
            condition: (action) => action.type === 'gift_given' && action.isFirst,
            memory: (userName, birdName, details) => 
                `初めて${birdName}に${details.giftName}をプレゼントした日。あんなに喜んでくれるなんて、贈り物って素敵だな。`,
            icon: '🎁'
        },
        '特別な贈り物': {
            condition: (action) => action.type === 'gift_given' && action.giftCount >= 5,
            memory: (userName, birdName, details) => 
                `${birdName}に${details.giftName}をあげた。もう${action.giftCount}個目の贈り物。いつも大切にしてくれて嬉しい。`,
            icon: '💝'
        },
        '初めてもらった贈り物': {
            condition: (action) => action.type === 'gift_received' && action.isFirstReceived,
            memory: (userName, birdName, details) => 
                `${birdName}から初めて${details.giftName}をもらった日。鳥からこんな素敵な贈り物がもらえるなんて、夢みたい！`,
            icon: '🌟'
        },
        '珍しい贈り物': {
            condition: (action) => action.type === 'gift_received' && action.rarity === 'rare',
            memory: (userName, birdName, details) => 
                `${birdName}から珍しい${details.giftName}をもらった。こんな特別なものを見つけて持ってきてくれるなんて。`,
            icon: '💎'
        }
    },

    // 🌈 特別な出来事の思い出
    events: {
        '虹の日': {
            condition: (action) => action.type === 'special_weather' && action.weather === 'rainbow',
            memory: (userName, birdName, details) => 
                `${birdName}と一緒に虹を見た日。虹が出た時、${birdName}も空を見上げていて、同じものを見ているんだと思った。`,
            icon: '🌈'
        },
        '初雪の日': {
            condition: (action) => action.type === 'special_weather' && action.weather === 'first_snow',
            memory: (userName, birdName, details) => 
                `今年初めての雪の日、${birdName}に会いに行った。雪の中でも元気そうで、ほっとした。`,
            icon: '❄️'
        },
        '誕生日': {
            condition: (action) => action.type === 'special_day' && action.day === 'birthday',
            memory: (userName, birdName, details) => 
                `自分の誕生日に${birdName}に会いに行った。なんだか${birdName}も一緒にお祝いしてくれているような気がした。`,
            icon: '🎂'
        },
        '記念日': {
            condition: (action) => action.type === 'anniversary',
            memory: (userName, birdName, details) => 
                `${birdName}と知り合って${details.days}日目の記念日。こんなに長く友達でいられるなんて嬉しい。`,
            icon: '🎊'
        }
    },

    // 📝 記録の思い出
    milestones: {
        '10種類目の鳥': {
            condition: (action) => action.type === 'milestone' && action.milestone === 'birds_10',
            memory: (userName, birdName, details) => 
                `${birdName}が10種類目に餌をあげた鳥になった。こんなにたくさんの鳥と友達になれるなんて。`,
            icon: '🔟'
        },
        '全エリア制覇': {
            condition: (action) => action.type === 'milestone' && action.milestone === 'all_areas',
            memory: (userName, birdName, details) => 
                `${birdName}のおかげで、ついに全エリアで餌やりができた。森林、草原、水辺、全部楽しい！`,
            icon: '🗺️'
        }
    },

    // 🎵 感情的な思い出
    emotional: {
        '感動的な瞬間': {
            condition: (action) => action.type === 'emotional' && action.emotion === 'moved',
            memory: (userName, birdName, details) => 
                `${birdName}が美しく歌っている姿を見て、思わず涙が出そうになった。こんな美しい瞬間に立ち会えて幸せ。`,
            icon: '🎵'
        },
        '心配した日': {
            condition: (action) => action.type === 'emotional' && action.emotion === 'worried',
            memory: (userName, birdName, details) => 
                `${birdName}の元気がなくて心配した日。でも翌日には元気になっていて、本当に安心した。`,
            icon: '😌'
        },
        '嬉しい再会': {
            condition: (action) => action.type === 'emotional' && action.emotion === 'reunion',
            memory: (userName, birdName, details) => 
                `しばらく会えなかった${birdName}と再会した日。覚えていてくれて、とても嬉しかった。`,
            icon: '🤗'
        }
    }
};

// 思い出の管理クラス
class HumanMemoryManager {
    constructor() {
        this.memoryPatterns = MEMORY_PATTERNS;
    }

    // 🌟 新しい思い出の生成
    async createMemory(userId, userName, birdName, actionData, guildId) {
        try {
            // 条件に合う思い出パターンをチェック
            for (const [category, patterns] of Object.entries(this.memoryPatterns)) {
                for (const [memoryType, config] of Object.entries(patterns)) {
                    
                    if (config.condition(actionData)) {
                        // 思い出を生成
                        const memory = {
                            id: this.generateMemoryId(),
                            type: memoryType,
                            category: category,
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
                        
                        console.log(`💭 新しい思い出が生まれました: ${memoryType}`);
                        return memory;
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

    // スプレッドシートに思い出を保存
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
                内容: memory.content,
                アイコン: memory.icon,
                詳細: JSON.stringify(memory.details),
                サーバーID: guildId
            });
            
        } catch (error) {
            console.error('思い出保存エラー:', error);
        }
    }

    // ユーザーの思い出を取得
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

    // 🎁 贈り物履歴の取得（何をあげたかの記録）
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
                    日時: row.get('日時'),
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

    // 思い出の通知を送信
    async sendMemoryNotification(interaction, memory) {
        try {
            const embed = new EmbedBuilder()
                .setTitle(`${memory.icon} 新しい思い出`)
                .setDescription(`**${memory.birdName}**との思い出が追加されました`)
                .addFields({
                    name: `💭 ${memory.type}`,
                    value: memory.content,
                    inline: false
                })
                .setColor(0x87CEEB)
                .setTimestamp();

            setTimeout(() => {
                interaction.followUp({ embeds: [embed] });
            }, 6000); // 6秒後に送信
            
        } catch (error) {
            console.error('思い出通知エラー:', error);
        }
    }
}

module.exports = new HumanMemoryManager();
