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
                'キャッチコピー', '説明文', '好物', '食べられる餌','夜行性'
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

            // 🆕 新しいシート - 好感度システム（絆餌やり回数列を追加）
this.sheets.userAffinity = await this.getOrCreateSheet('user_affinity', [
    '日時', 'ユーザーID', 'ユーザー名', '鳥名', '好感度レベル', '餌やり回数', '絆餌やり回数', 'サーバーID'
]);

            // 🆕 新しいシート - ユーザーの贈り物インベントリ
            this.sheets.giftsInventory = await this.getOrCreateSheet('gifts_inventory', [
                '日時', 'ユーザーID', 'ユーザー名', '贈り物名', '個数', '取得経緯', 'サーバーID'
            ]);

            // 🆕 新しいシート - 鳥への贈り物（G列キャプション追加版）
this.sheets.birdGifts = await this.getOrCreateSheet('bird_gifts', [
    '鳥名', '贈り物名', '贈り主ユーザーID', '贈り主ユーザー名', '贈呈日時', 'サーバーID', 'キャプション'
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

            // config/sheets.js の修正が必要
this.sheets.userMemories = await this.getOrCreateSheet('user_memories', [
    '日時', 'ユーザーID', 'ユーザー名', '鳥名', '思い出種類', 'カテゴリ', 
    'レアリティ', '内容', 'アイコン', '詳細', 'サーバーID'  // 🆕 レアリティ列を追加
]);
            // 絆レベルについて
this.sheets.bondLevels = await this.getOrCreateSheet('bond_levels', [
    '日時', 'ユーザーID', 'ユーザー名', '鳥名', '絆レベル', 
    '絆餌やり回数', 'サーバーID'
]);
            // 🏠 ネストシステム用シート
this.sheets.userNests = await this.getOrCreateSheet('user_nests', [
    '日時', 'ユーザーID', 'ユーザー名', '鳥名', 'カスタム名', 
    'ネストタイプ', '所持ネストリスト', 'チャンネルID', 'サーバーID'
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

    async addLog(sheetName, data) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets[sheetName];
        if (!sheet) {
            console.error(`シート "${sheetName}" が見つかりません`);
            return false;
        }
        
        // 🔧 userNestsの場合は独自の日時フィールドを持つので、自動追加しない
        let logData;
        if (sheetName === 'userNests') {
            logData = {
                日時: new Date().toLocaleString('ja-JP'),
                ...data
            };
        } else if (sheetName === 'birdGifts') {
            logData = data;
        } else {
            logData = {
                日時: new Date().toLocaleString('ja-JP'),
                ...data
            };
        }
        
        console.log(`📝 ${sheetName}シートに記録するデータ:`, logData);
        
        await sheet.addRow(logData);
        
        console.log(`✅ ${sheetName}シートに記録完了`);
        return true;
    } catch (error) {
        console.error(`ログ追加エラー (${sheetName}):`, error);
        console.error('データ:', data);
        console.error('エラースタック:', error.stack);
        return false;
    }
}

    // 以下、既存のメソッドはそのまま（すべてに ensureInitialized() を追加）

    // 🏠 ネストシステム関連メソッドを追加

/**
 * ユーザーのネスト情報を取得
 */
async getUserNests(userId, serverId) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.userNests;
        if (!sheet) {
            console.error('userNests シートが見つかりません');
            return [];
        }
        
        const rows = await sheet.getRows();
        
        const userNests = rows.filter(row => 
            row.get('ユーザーID') === userId && 
            row.get('サーバーID') === serverId
        );
        
        return userNests.map(row => ({
            日時: row.get('日時'),
            ユーザーID: row.get('ユーザーID'),
            ユーザー名: row.get('ユーザー名'),
            鳥名: row.get('鳥名'),
            カスタム名: row.get('カスタム名') || '',
            ネストタイプ: row.get('ネストタイプ'),
            所持ネストリスト: JSON.parse(row.get('所持ネストリスト') || '[]'),
            チャンネルID: row.get('チャンネルID') || '',
            サーバーID: row.get('サーバーID')
        }));
    } catch (error) {
        console.error('ユーザーネスト取得エラー:', error);
        return [];
    }
}

/**
 * 特定の鳥のネスト情報を取得
 */
async getBirdNest(userId, birdName, serverId) {
    try {
        const userNests = await this.getUserNests(userId, serverId);
        return userNests.find(nest => nest.鳥名 === birdName) || null;
    } catch (error) {
        console.error('鳥ネスト取得エラー:', error);
        return null;
    }
}

/**
 * ネスト建設を記録（デバッグ版）
 */
async logNestCreation(userId, userName, birdName, customName, nestType, ownedNests, channelId, serverId) {
    try {
        console.log(`📝 logNestCreation 開始:`, {
            userId,
            userName,
            birdName,
            customName,
            nestType,
            ownedNests,
            channelId,
            serverId
        });
        
        // 同じ鳥のネストが既に存在するかチェック
        const existingNest = await this.getBirdNest(userId, birdName, serverId);
        if (existingNest) {
            throw new Error('この鳥のネストは既に建設済みです');
        }
        
        const logData = {
            ユーザーID: userId,
            ユーザー名: userName,
            鳥名: birdName,
            カスタム名: customName || '',
            ネストタイプ: nestType,
            所持ネストリスト: JSON.stringify(ownedNests),
            チャンネルID: channelId || '',
            サーバーID: serverId  // 🔧 確実にサーバーIDを設定
        };
        
        console.log(`📝 記録するデータ:`, logData);
        
        const result = await this.addLog('userNests', logData);
        
        console.log(`✅ ネスト建設記録完了: ${userName} -> ${birdName} (${nestType})`);
        return result;
    } catch (error) {
        console.error('ネスト建設記録エラー:', error);
        console.error('エラースタック:', error.stack);
        throw error;
    }
}

/**
 * ネストタイプを変更
 */
async updateNestType(userId, birdName, newNestType, serverId) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.userNests;
        const rows = await sheet.getRows();
        
        const nestRow = rows.find(row => 
            row.get('ユーザーID') === userId && 
            row.get('鳥名') === birdName && 
            row.get('サーバーID') === serverId
        );
        
        if (!nestRow) {
            throw new Error('ネストが見つかりません');
        }
        
        nestRow.set('ネストタイプ', newNestType);
        nestRow.set('日時', new Date().toLocaleString('ja-JP'));
        await nestRow.save();
        
        console.log(`✅ ネストタイプ変更: ${birdName} -> ${newNestType}`);
        return true;
    } catch (error) {
        console.error('ネストタイプ変更エラー:', error);
        throw error;
    }
}

/**
 * ユーザーの所持ネスト数を取得
 */
async getUserNestCount(userId, serverId) {
    try {
        const userNests = await this.getUserNests(userId, serverId);
        return userNests.length;
    } catch (error) {
        console.error('ネスト数取得エラー:', error);
        return 0;
    }
}

/**
 * チャンネルIDを更新
 */
async updateNestChannelId(userId, birdName, channelId, serverId) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.userNests;
        const rows = await sheet.getRows();
        
        const nestRow = rows.find(row => 
            row.get('ユーザーID') === userId && 
            row.get('鳥名') === birdName && 
            row.get('サーバーID') === serverId
        );
        
        if (!nestRow) {
            throw new Error('ネストが見つかりません');
        }
        
        nestRow.set('チャンネルID', channelId);
        await nestRow.save();
        
        console.log(`✅ ネストチャンネルID更新: ${birdName} -> ${channelId}`);
        return true;
    } catch (error) {
        console.error('チャンネルID更新エラー:', error);
        throw error;
    }
}

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
    try {
        console.log(`🔍 logBirdGift呼び出し: ${birdName}, ${giftName}, ${giverId}, ${giverName}, ${serverId}`);
        
        return await this.addLog('birdGifts', {
            鳥名: birdName,
            贈り物名: giftName,
            送り主ユーザーID: giverId,        // 🔧 修正：実際のヘッダー名に合わせる
            送り主ユーザー名: giverName,      // 🔧 修正：実際のヘッダー名に合わせる
            贈呈日時: new Date().toLocaleString('ja-JP'),
            サーバーID: serverId,
            キャプション: caption
        });
    } catch (error) {
        console.error('鳥への贈り物ログエラー:', error);
        return false;
    }
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
                    giver: row.get('送り主ユーザー名'),      // 🔧 修正: D列
                    giverId: row.get('送り主ユーザーID'),    // 🔧 修正: C列
                    caption: row.get('キャプション'),        // G列
                    date: row.get('贈呈日時')              // 🔧 修正: E列
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

    // 🆕 ユーザーが鳥からもらった贈り物を取得（修正版）
    async getUserReceivedGifts(userId, serverId) {
        try {
            await this.ensureInitialized();
            
            const sheet = this.sheets.birdGiftsReceived;
            if (!sheet) {
                console.error('birdGiftsReceived シートが見つかりません');
                return [];
            }
            
            const rows = await sheet.getRows();
            
            return rows
                .filter(row => 
                    row.get('ユーザーID') === userId && row.get('サーバーID') === serverId
                )
                .map(row => ({
                    日時: row.get('日時'),
                    鳥名: row.get('鳥名'),
                    贈り物名: row.get('贈り物名'),
                    好感度レベル: row.get('好感度レベル'),
                    エリア: row.get('エリア')
                }))
                .sort((a, b) => new Date(b.日時) - new Date(a.日時));
                
        } catch (error) {
            console.error('鳥からもらった贈り物取得エラー:', error);
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

    /**
 * 特定の鳥に対する全ユーザーの好感度情報を取得
 * @param {string} birdName - 鳥の名前
 * @param {string} serverId - サーバーID
 * @returns {Array} 好感度情報のリスト
 */
async getAllUserAffinities(birdName, serverId) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.userAffinity;
        if (!sheet) {
            console.error('userAffinity シートが見つかりません');
            return [];
        }
        
        const rows = await sheet.getRows();
        
        // 指定された鳥とサーバーの好感度データを抽出
        const affinities = rows.filter(row => 
            row.get('鳥名') === birdName && 
            row.get('サーバーID') === serverId &&
            parseInt(row.get('好感度レベル')) > 0  // レベル0は除外
        );

        // 好感度情報を整形して返す
        return affinities.map(affinity => ({
            userId: affinity.get('ユーザーID'),
            userName: affinity.get('ユーザー名'),
            level: parseInt(affinity.get('好感度レベル')) || 0,
            feedCount: parseInt(affinity.get('餌やり回数')) || 0
        }));

    } catch (error) {
        console.error('全ユーザー好感度取得エラー:', error);
        return [];
    }
}

/**
 * 絆レベルをログに記録（統合版）
 */
async logBondLevel(userId, userName, birdName, bondLevel, bondFeedCount, serverId) {
    try {
        console.log(`📊 絆レベル記録開始:`, {
            userId, userName, birdName, bondLevel, bondFeedCount, serverId
        });
        
        const logData = {
            ユーザーID: userId,
            ユーザー名: userName,
            鳥名: birdName,
            絆レベル: bondLevel,
            絆餌やり回数: bondFeedCount || 0,  // 未定義の場合は0
            サーバーID: serverId
        };
        
        console.log(`📊 記録するデータ:`, logData);
        
        const result = await this.addLog('bondLevels', logData);
        
        console.log(`📊 絆レベル記録完了:`, result);
        
        return result;
        
    } catch (error) {
        console.error('絆レベル記録エラー:', error);
        console.error('エラースタック:', error.stack);
        return false;
    }
}
    
/**
 * ユーザーの絆レベル情報を取得（統合版）
 */
async getUserBondLevel(userId, birdName, serverId) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.bondLevels;
        if (!sheet) {
            console.error('bondLevels シートが見つかりません');
            return null;
        }
        
        const rows = await sheet.getRows();
        
        console.log(`🔍 絆レベル検索: ${userId} - ${birdName} - ${serverId}`);
        
        // 最新の絆レベル記録を取得
        let latestBond = null;
        rows.forEach(row => {
            const rowUserId = row.get('ユーザーID');
            const rowBirdName = row.get('鳥名');
            const rowServerId = row.get('サーバーID');
            
            if (rowUserId === userId && 
                rowBirdName === birdName && 
                rowServerId === serverId) {
                
                const rowDate = new Date(row.get('日時'));
                if (!latestBond || rowDate > new Date(latestBond.日時)) {
                    latestBond = {
                        日時: row.get('日時'),
                        bondLevel: parseInt(row.get('絆レベル')) || 0,
                        bondFeedCount: parseFloat(row.get('絆餌やり回数')) || 0
                    };
                }
            }
        });
        
        console.log(`🔍 最終的な絆レベル結果:`, latestBond);
        
        // bondLevelManagerで期待される形式で返す
        return latestBond ? {
            bondLevel: latestBond.bondLevel,
            bondFeedCount: latestBond.bondFeedCount
        } : {
            bondLevel: 0,
            bondFeedCount: 0
        };
        
    } catch (error) {
        console.error('絆レベル取得エラー:', error);
        console.error('エラースタック:', error.stack);
        return {
            bondLevel: 0,
            bondFeedCount: 0
        };
    }
}

    /**
 * 特定の鳥に対するユーザーの好感度データを取得
 */
async getUserAffinityData(userId, birdName, serverId) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.userAffinity;
        if (!sheet) {
            console.error('userAffinity シートが見つかりません');
            return null;
        }
        
        const rows = await sheet.getRows();
        
        // 最新の好感度記録を取得
        let latestAffinity = null;
        rows.forEach(row => {
            if (row.get('ユーザーID') === userId && 
                row.get('鳥名') === birdName && 
                row.get('サーバーID') === serverId) {
                
                const rowDate = new Date(row.get('日時'));
                if (!latestAffinity || rowDate > new Date(latestAffinity.日時)) {
                    latestAffinity = {
                        日時: row.get('日時'),
                        好感度レベル: parseInt(row.get('好感度レベル')) || 0,
                        餌やり回数: parseFloat(row.get('餌やり回数')) || 0,
                        絆餌やり回数: parseFloat(row.get('絆餌やり回数')) || 0
                    };
                }
            }
        });
        
        return latestAffinity;
        
    } catch (error) {
        console.error('好感度データ取得エラー:', error);
        return null;
    }
}

/**
 * 絆餌やり回数を更新
 */
async updateBondFeedCount(userId, birdName, newBondFeedCount, serverId) {
    try {
        await this.ensureInitialized();
        
        const sheet = this.sheets.userAffinity;
        const rows = await sheet.getRows();
        
        // 最新の好感度記録を見つけて更新
        let targetRow = null;
        let latestDate = null;
        
        rows.forEach(row => {
            if (row.get('ユーザーID') === userId && 
                row.get('鳥名') === birdName && 
                row.get('サーバーID') === serverId) {
                
                const rowDate = new Date(row.get('日時'));
                if (!latestDate || rowDate > latestDate) {
                    latestDate = rowDate;
                    targetRow = row;
                }
            }
        });
        
        if (targetRow) {
            // 既存の行に絆餌やり回数列を追加/更新
            targetRow.set('絆餌やり回数', newBondFeedCount);
            targetRow.set('日時', new Date().toLocaleString('ja-JP'));
            await targetRow.save();
            
            console.log(`✅ 絆餌やり回数更新: ${birdName} -> ${newBondFeedCount}`);
            return true;
        } else {
            console.error(`❌ 対象の好感度記録が見つかりません: ${userId} - ${birdName}`);
            return false;
        }
        
    } catch (error) {
        console.error('絆餌やり回数更新エラー:', error);
        return false;
    }
}
    
    // ネスト取得を記録
    async logNestAcquisition(userId, userName, birdName, nestType, bondLevel, acquisitionMethod, updatedNestList, serverId) {
        try {
            const data = [
                new Date().toISOString(),
                userId,
                userName,
                birdName,
                nestType,
                bondLevel,
                acquisitionMethod, // 'bond_level_gacha', 'holiday_distribution', etc.
                JSON.stringify(updatedNestList), // 現在の所持ネストリスト
                serverId
            ];

            await this.appendToSheet('nestAcquisitions', data);
            console.log(`🏠 ネスト取得記録: ${userName} -> ${nestType} (${acquisitionMethod})`);

        } catch (error) {
            console.error('ネスト取得記録エラー:', error);
            throw error;
        }
    }

    // ユーザーの所持ネストリストを取得
    async getUserOwnedNestTypes(userId, serverId) {
        try {
            const sheet = await this.getSheet('nestAcquisitions');
            const rows = await sheet.getRows();
            
            // 該当ユーザーのネスト取得記録を取得
            const userNestRecords = rows.filter(row => 
                row.get('ユーザーID') === userId &&
                row.get('サーバーID') === serverId
            );

            if (userNestRecords.length === 0) {
                return []; // 所持ネストなし
            }

            // 最新の所持ネストリストを返す
            const latestRecord = userNestRecords[userNestRecords.length - 1];
            const nestListStr = latestRecord.get('所持ネストリスト') || '[]';
            
            try {
                return JSON.parse(nestListStr);
            } catch (parseError) {
                console.error('ネストリスト解析エラー:', parseError);
                return [];
            }

        } catch (error) {
            console.error('所持ネスト取得エラー:', error);
            return [];
        }
    }

    // 絆レベル1以上のユーザーを取得（記念日配布用）
    async getUsersWithBondLevel(minBondLevel, serverId) {
        try {
            const sheet = await this.getSheet('bondLevels');
            const rows = await sheet.getRows();
            
            // サーバー内の全ユーザーの最新絆レベルを取得
            const userBondMap = new Map();
            
            rows.forEach(row => {
                if (row.get('サーバーID') !== serverId) return;
                
                const userId = row.get('ユーザーID');
                const birdName = row.get('鳥名');
                const bondLevel = parseInt(row.get('絆レベル')) || 0;
                
                const key = `${userId}_${birdName}`;
                if (!userBondMap.has(key) || userBondMap.get(key).bondLevel < bondLevel) {
                    userBondMap.set(key, {
                        userId,
                        userName: row.get('ユーザー名'),
                        birdName,
                        bondLevel
                    });
                }
            });

            // 指定絆レベル以上のユーザーのみフィルタ
            return Array.from(userBondMap.values())
                .filter(record => record.bondLevel >= minBondLevel);

        } catch (error) {
            console.error('絆レベルユーザー取得エラー:', error);
            return [];
        }
    }

    // ネスト変更を記録
    async logNestChange(userId, userName, birdName, oldNestType, newNestType, serverId) {
        try {
            const data = [
                new Date().toISOString(),
                userId,
                userName,
                birdName,
                oldNestType,
                newNestType,
                'manual_change', // 変更方法
                serverId
            ];

            await this.appendToSheet('nestChanges', data);
            console.log(`🔄 ネスト変更記録: ${userName} -> ${birdName} (${oldNestType} → ${newNestType})`);

        } catch (error) {
            console.error('ネスト変更記録エラー:', error);
            throw error;
        }
    }

    // シートに行を追加（汎用）
    async appendToSheet(sheetName, data) {
        try {
            const sheet = await this.getSheet(sheetName);
            await sheet.addRow(this.arrayToRowData(data, sheetName));
        } catch (error) {
            console.error(`シート追加エラー (${sheetName}):`, error);
            throw error;
        }
    }

    // 配列をシート行データに変換
    arrayToRowData(dataArray, sheetName) {
        const columnMappings = {
            bondLevels: ['日時', 'ユーザーID', 'ユーザー名', '鳥名', '絆レベル', '達成日時', 'サーバーID'],
            nestAcquisitions: ['日時', 'ユーザーID', 'ユーザー名', '鳥名', 'ネストタイプ', '絆レベル', '取得方法', '所持ネストリスト', 'サーバーID'],
            nestChanges: ['日時', 'ユーザーID', 'ユーザー名', '鳥名', '旧ネストタイプ', '新ネストタイプ', '変更方法', 'サーバーID'],
            holidayNests: ['日時', 'ユーザーID', 'ユーザー名', '記念日名', 'ネストタイプ', '配布日時', 'サーバーID']
        };

        const columns = columnMappings[sheetName];
        if (!columns) {
            throw new Error(`未知のシート名: ${sheetName}`);
        }

        const rowData = {};
        columns.forEach((column, index) => {
            rowData[column] = dataArray[index] || '';
        });

        return rowData;
    }

    // シートを取得または作成
    async getSheet(sheetName) {
        try {
            // まずシートの存在をチェック
            const sheetInfo = await this.doc.sheetsById;
            
            // シートが存在しない場合は作成
            let sheet = Object.values(sheetInfo).find(s => s.title === sheetName);
            
            if (!sheet) {
                console.log(`📋 新しいシート作成: ${sheetName}`);
                sheet = await this.doc.addSheet({
                    title: sheetName,
                    headerValues: this.getSheetHeaders(sheetName)
                });
            }

            return sheet;

        } catch (error) {
            console.error(`シート取得エラー (${sheetName}):`, error);
            throw error;
        }
    }

    // シートのヘッダーを取得
    getSheetHeaders(sheetName) {
        const headers = {
            bondLevels: ['日時', 'ユーザーID', 'ユーザー名', '鳥名', '絆レベル', '達成日時', 'サーバーID'],
            nestAcquisitions: ['日時', 'ユーザーID', 'ユーザー名', '鳥名', 'ネストタイプ', '絆レベル', '取得方法', '所持ネストリスト', 'サーバーID'],
            nestChanges: ['日時', 'ユーザーID', 'ユーザー名', '鳥名', '旧ネストタイプ', '新ネストタイプ', '変更方法', 'サーバーID'],
            holidayNests: ['日時', 'ユーザーID', 'ユーザー名', '記念日名', 'ネストタイプ', '配布日時', 'サーバーID']
        };

        return headers[sheetName] || ['日時', 'データ'];
    }
}

module.exports = new SheetsManager();
