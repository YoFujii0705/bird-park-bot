const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class SheetsManager {
    constructor() {
        this.doc = null;
        this.sheets = {};
        this.isAuthInitialized = false;
        this.isInitialized = false;
        // 🆕 コンストラクタでは認証を実行しない
    }

    // 🆕 認証の遅延初期化
    initializeAuth() {
        if (this.isAuthInitialized) return;
        
        try {
            // 環境変数の存在確認
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
                throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL が設定されていません');
            }
            if (!process.env.GOOGLE_PRIVATE_KEY) {
                throw new Error('GOOGLE_PRIVATE_KEY が設定されていません');
            }
            if (!process.env.GOOGLE_SHEETS_ID) {
                throw new Error('GOOGLE_SHEETS_ID が設定されていません');
            }

            const serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            
            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, serviceAccountAuth);
            this.isAuthInitialized = true;
            
        } catch (error) {
            console.error('Google Sheets認証エラー:', error);
            throw error;
        }
    }

    // シート接続・初期化
    async initialize() {
        if (this.isInitialized) return;
        
        // 🆕 ここで初めて認証を実行
        this.initializeAuth();
        
        try {
            await this.doc.loadInfo();
            console.log('✅ Google Sheetsに接続しました:', this.doc.title);
            
            // 既存シート
            this.sheets.birds = await this.getOrCreateSheet('birds', [
                '名前', '全長', '全長区分', '色', '季節', '渡り区分', '環境', 
                'キャッチコピー', '説明文', '好物', '食べられる餌'
            ]);
            
            this.sheets.gachaLog = await this.getOrCreateSheet('gacha_log', [
                '日時', 'ユーザーID', 'ユーザー名', 'コマンド', '鳥名', '詳細', 'サーバーID'
            ]);
            
            this.sheets.searchLog = await this.getOrCreateSheet('search_log', [
                '日時', 'ユーザーID', 'ユーザー名', '検索条件', '結果数', 'サーバーID'
            ]);
            
            this.sheets.zooLog = await this.getOrCreateSheet('zoo_log', [
                '日時', 'アクション', 'エリア', '鳥名', 'ユーザーID', 'ユーザー名', 'サーバーID'
            ]);
            
            this.sheets.feedLog = await this.getOrCreateSheet('feed_log', [
                '日時', 'ユーザーID', 'ユーザー名', '鳥名', '餌', '効果', 'サーバーID'
            ]);
            
            this.sheets.events = await this.getOrCreateSheet('events', [
                '日時', 'イベント種類', '内容', '関連する鳥', 'サーバーID'
            ]);

            // 🆕 新しいシート - 好感度システム
            this.sheets.userAffinity = await this.getOrCreateSheet('user_affinity', [
                '日時', 'ユーザーID', 'ユーザー名', '鳥名', '好感度レベル', '餌やり回数', 'サーバーID'
            ]);

            // 🆕 新しいシート - ユーザーの贈り物インベントリ
            this.sheets.giftsInventory = await this.getOrCreateSheet('gifts_inventory', [
                '日時', 'ユーザーID', 'ユーザー名', '贈り物名', '個数', '取得経緯', 'サーバーID'
            ]);

            // 🆕 新しいシート - 鳥への贈り物
            this.sheets.birdGifts = await this.getOrCreateSheet('bird_gifts', [
                '日時', '鳥名', '贈り物名', '贈り主ユーザーID', '贈り主ユーザー名', 'キャプション', 'サーバーID'
            ]);

            // 🆕 新しいシート - ユーザー称号
            this.sheets.userAchievements = await this.getOrCreateSheet('user_achievements', [
                '日時', 'ユーザーID', 'ユーザー名', '称号名', '取得条件', 'サーバーID'
            ]);

            this.sheets.birdMemory = await this.getOrCreateSheet('bird_memory', [
    '日時', '鳥名', 'サーバーID', 'サーバー名', '来訪回数', '最後の訪問日時', 
    '贈り物リスト', '特別な思い出', '友達ユーザーリスト', '好きなエリア'
　　　　　　　　]);

            // 🆕 新しいシート - 鳥からもらった贈り物（コレクション用）
            this.sheets.birdGiftsReceived = await this.getOrCreateSheet('bird_gifts_received', [
                '日時', 'ユーザーID', 'ユーザー名', '鳥名', '贈り物名', '好感度レベル', 'エリア', 'サーバーID'
            ]);

            // 🆕 新しいシート - ユーザーの思い出
            this.sheets.userMemories = await this.getOrCreateSheet('user_memories', [
                '日時', 'ユーザーID', 'ユーザー名', '鳥名', '思い出種類', 'カテゴリ', '内容', 'アイコン', '詳細', 'サーバーID'
            ]);

            this.isInitialized = true;
            console.log('✅ 全シートの初期化完了');
            
        } catch (error) {
            console.error('シート初期化エラー:', error);
            throw error;
        }
    }

    // 🆕 安全な初期化チェック
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    // シート取得または作成
    async getOrCreateSheet(title, headers) {
        try {
            let sheet = this.doc.sheetsByTitle[title];
            
            if (!sheet) {
                console.log(`シート "${title}" を作成中...`);
                sheet = await this.doc.addSheet({ title, headerValues: headers });
            } else {
                await sheet.loadHeaderRow();
            }
            
            return sheet;
        } catch (error) {
            console.error(`シート "${title}" の取得/作成エラー:`, error);
            throw error;
        }
    }

    // 🆕 ログ追加（安全性チェック付き）
    async addLog(sheetName, data) {
        try {
            await this.ensureInitialized();
            
            const sheet = this.sheets[sheetName];
            if (!sheet) {
                console.error(`シート "${sheetName}" が見つかりません`);
                return false;
            }
            
            const logData = {
                日時: new Date().toLocaleString('ja-JP'),
                ...data
            };
            
            await sheet.addRow(logData);
            return true;
        } catch (error) {
            console.error(`ログ追加エラー (${sheetName}):`, error);
            return false;
        }
    }

    // 以下、既存のメソッドはそのまま（すべてに ensureInitialized() を追加）

    async logAffinity(userId, userName, birdName, affinityLevel, feedCount, serverId) {
        return await this.addLog('userAffinity', {
            ユーザーID: userId,
            ユーザー名: userName,
            鳥名: birdName,
            好感度レベル: affinityLevel,
            餌やり回数: feedCount,
            サーバーID: serverId
        });
    }

    async logGiftInventory(userId, userName, giftName, quantity, source, serverId) {
        return await this.addLog('giftsInventory', {
            ユーザーID: userId,
            ユーザー名: userName,
            贈り物名: giftName,
            個数: quantity,
            取得経緯: source,
            サーバーID: serverId
        });
    }

    async logBirdGift(birdName, giftName, giverId, giverName, caption, serverId) {
        return await this.addLog('birdGifts', {
            鳥名: birdName,
            贈り物名: giftName,
            贈り主ユーザーID: giverId,
            贈り主ユーザー名: giverName,
            キャプション: caption,
            サーバーID: serverId
        });
    }

    async logAchievement(userId, userName, achievementName, condition, serverId) {
        return await this.addLog('userAchievements', {
            ユーザーID: userId,
            ユーザー名: userName,
            称号名: achievementName,
            取得条件: condition,
            サーバーID: serverId
        });
    }

    async getUserAffinity(userId, serverId) {
        try {
            await this.ensureInitialized();
            
            const sheet = this.sheets.userAffinity;
            const rows = await sheet.getRows();
            
            const userAffinities = {};
            rows.forEach(row => {
                if (row.get('ユーザーID') === userId && row.get('サーバーID') === serverId) {
                    const birdName = row.get('鳥名');
                    userAffinities[birdName] = {
                        level: parseInt(row.get('好感度レベル')) || 0,
                        feedCount: parseFloat(row.get('餌やり回数')) || 0
                    };
                }
            });
            
            return userAffinities;
        } catch (error) {
            console.error('好感度データ取得エラー:', error);
            return {};
        }
    }

    async getUserGifts(userId, serverId) {
        try {
            await this.ensureInitialized();
            
            const sheet = this.sheets.giftsInventory;
            const rows = await sheet.getRows();
            
            const gifts = {};
            rows.forEach(row => {
                if (row.get('ユーザーID') === userId && row.get('サーバーID') === serverId) {
                    const giftName = row.get('贈り物名');
                    const quantity = parseInt(row.get('個数')) || 0;
                    gifts[giftName] = (gifts[giftName] || 0) + quantity;
                }
            });
            
            return gifts;
        } catch (error) {
            console.error('贈り物インベントリ取得エラー:', error);
            return {};
        }
    }

    async getBirdGifts(birdName, serverId) {
        try {
            await this.ensureInitialized();
            
            const sheet = this.sheets.birdGifts;
            const rows = await sheet.getRows();
            
            const gifts = [];
            rows.forEach(row => {
                if (row.get('鳥名') === birdName && row.get('サーバーID') === serverId) {
                    gifts.push({
                        name: row.get('贈り物名'),
                        giver: row.get('贈り主ユーザー名'),
                        giverId: row.get('贈り主ユーザーID'),
                        caption: row.get('キャプション'),
                        date: row.get('日時')
                    });
                }
            });
            
            return gifts;
        } catch (error) {
            console.error('鳥の贈り物取得エラー:', error);
            return [];
        }
    }

    async getBirds() {
        try {
            await this.ensureInitialized();
            
            const sheet = this.sheets.birds;
            const rows = await sheet.getRows();
            
            return rows.map(row => ({
                名前: row.get('名前'),
                全長: row.get('全長'),
                全長区分: row.get('全長区分'),
                色: row.get('色'),
                季節: row.get('季節'),
                渡り区分: row.get('渡り区分'),
                環境: row.get('環境'),
                キャッチコピー: row.get('キャッチコピー'),
                説明文: row.get('説明文'),
                好物: row.get('好物'),
                食べられる餌: row.get('食べられる餌')
            }));
        } catch (error) {
            console.error('鳥データ取得エラー:', error);
            return [];
        }
    }

    // 🆕 鳥の記憶ログ追加
async logBirdMemory(birdName, serverId, serverName, visitCount, giftsList, memories, friendUsers, favoriteArea) {
    return await this.addLog('birdMemory', {
        鳥名: birdName,
        サーバーID: serverId,
        サーバー名: serverName,
        来訪回数: visitCount,
        最後の訪問日時: new Date().toLocaleString('ja-JP'),
        贈り物リスト: giftsList,
        特別な思い出: memories,
        友達ユーザーリスト: friendUsers,
        好きなエリア: favoriteArea
    });
}

    // 🆕 鳥の記憶データ取得
async getBirdMemory(birdName, serverId) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.birdMemory;
        const rows = await sheet.getRows();
        
        // 最新の記録を取得
        let latestMemory = null;
        rows.forEach(row => {
            if (row.get('鳥名') === birdName && row.get('サーバーID') === serverId) {
                const rowDate = new Date(row.get('最後の訪問日時'));
                if (!latestMemory || rowDate > new Date(latestMemory.最後の訪問日時)) {
                    latestMemory = {
                        鳥名: row.get('鳥名'),
                        サーバーID: row.get('サーバーID'),
                        サーバー名: row.get('サーバー名'),
                        来訪回数: parseInt(row.get('来訪回数')) || 0,
                        最後の訪問日時: row.get('最後の訪問日時'),
                        贈り物リスト: row.get('贈り物リスト') || '',
                        特別な思い出: row.get('特別な思い出') || '',
                        友達ユーザーリスト: row.get('友達ユーザーリスト') || '',
                        好きなエリア: row.get('好きなエリア') || ''
                    };
                }
            }
        });
        
        return latestMemory;
    } catch (error) {
        console.error('鳥の記憶データ取得エラー:', error);
        return null;
    }
}

    // 🆕 鳥の記憶データ更新
async updateBirdMemory(birdName, serverId, serverName, updates) {
    try {
        // 既存データを取得
        const existingMemory = await this.getBirdMemory(birdName, serverId);
        
        // データ統合
        const newData = {
            鳥名: birdName,
            サーバーID: serverId,
            サーバー名: serverName,
            来訪回数: (existingMemory?.来訪回数 || 0) + 1,
            最後の訪問日時: new Date().toLocaleString('ja-JP'),
            贈り物リスト: updates.贈り物リスト || existingMemory?.贈り物リスト || '',
            特別な思い出: updates.特別な思い出 || existingMemory?.特別な思い出 || '',
            友達ユーザーリスト: updates.友達ユーザーリスト || existingMemory?.友達ユーザーリスト || '',
            好きなエリア: updates.好きなエリア || existingMemory?.好きなエリア || ''
        };
        
        // 新しい記録として追加
        return await this.addLog('birdMemory', newData);
        
    } catch (error) {
        console.error('鳥の記憶データ更新エラー:', error);
        return false;
    }
}

    // 🆕 鳥からもらった贈り物を記録
    async logBirdGiftReceived(userId, userName, birdName, giftName, affinityLevel, area, serverId) {
        return await this.addLog('birdGiftsReceived', {
            ユーザーID: userId,
            ユーザー名: userName,
            鳥名: birdName,
            贈り物名: giftName,
            好感度レベル: affinityLevel,
            エリア: area,
            サーバーID: serverId
        });
    }

    // 🆕 ユーザーが鳥からもらった贈り物を取得
    async getUserReceivedGifts(userId, serverId) {
        try {
            await this.ensureInitialized();
            
            const sheet = this.sheets.birdGiftsReceived;
            const rows = await sheet.getRows();
            
            return rows.filter(row => 
                row.get('ユーザーID') === userId && row.get('サーバーID') === serverId
            ).map(row => ({
                日時: row.get('日時'),
                鳥名: row.get('鳥名'),
                贈り物名: row.get('贈り物名'),
                好感度レベル: row.get('好感度レベル'),
                エリア: row.get('エリア')
            }));
            
        } catch (error) {
            console.error('受け取った贈り物取得エラー:', error);
            return [];
        }
    }

// 🆕 全サーバーでの鳥の来訪履歴取得
async getBirdVisitHistory(birdName) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.birdMemory;
        const rows = await sheet.getRows();
        
        const visitHistory = [];
        rows.forEach(row => {
            if (row.get('鳥名') === birdName) {
                visitHistory.push({
                    サーバーID: row.get('サーバーID'),
                    サーバー名: row.get('サーバー名'),
                    来訪回数: parseInt(row.get('来訪回数')) || 0,
                    最後の訪問日時: row.get('最後の訪問日時'),
                    贈り物数: (row.get('贈り物リスト') || '').split(',').filter(g => g.trim()).length
                });
            }
        });
        
        // 最後の訪問日時でソート
        return visitHistory.sort((a, b) => new Date(b.最後の訪問日時) - new Date(a.最後の訪問日時));
        
    } catch (error) {
        console.error('鳥の来訪履歴取得エラー:', error);
        return [];
    }
}
    
}

module.exports = new SheetsManager();
