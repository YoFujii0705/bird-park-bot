const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class SheetsManager {
    constructor() {
        this.doc = null;
        this.sheets = {};
        this.initializeAuth();
    }

    // 認証初期化
    initializeAuth() {
        try {
            const serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, serviceAccountAuth);
        } catch (error) {
            console.error('Google Sheets認証エラー:', error);
            throw error;
        }
    }

    // シート接続・初期化
    async initialize() {
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

            console.log('✅ 全シートの初期化完了');
        } catch (error) {
            console.error('シート初期化エラー:', error);
            throw error;
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

    // ログ追加
    async addLog(sheetName, data) {
        try {
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

    // 🆕 好感度ログ追加
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

    // 🆕 贈り物インベントリログ追加
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

    // 🆕 鳥への贈り物ログ追加
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

    // 🆕 称号ログ追加
    async logAchievement(userId, userName, achievementName, condition, serverId) {
        return await this.addLog('userAchievements', {
            ユーザーID: userId,
            ユーザー名: userName,
            称号名: achievementName,
            取得条件: condition,
            サーバーID: serverId
        });
    }

    // 🆕 好感度データ取得
    async getUserAffinity(userId, serverId) {
        try {
            const sheet = this.sheets.userAffinity;
            const rows = await sheet.getRows();
            
            const userAffinities = {};
            rows.forEach(row => {
                if (row.get('ユーザーID') === userId && row.get('サーバーID') === serverId) {
                    const birdName = row.get('鳥名');
                    userAffinities[birdName] = {
                        level: parseInt(row.get('好感度レベル')) || 0,
                        feedCount: parseInt(row.get('餌やり回数')) || 0
                    };
                }
            });
            
            return userAffinities;
        } catch (error) {
            console.error('好感度データ取得エラー:', error);
            return {};
        }
    }

    // 🆕 ユーザーの贈り物インベントリ取得
    async getUserGifts(userId, serverId) {
        try {
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

    // 🆕 鳥の贈り物取得
    async getBirdGifts(birdName, serverId) {
        try {
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

    // 既存メソッド
    async getBirds() {
        try {
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
}

module.exports = new SheetsManager();
