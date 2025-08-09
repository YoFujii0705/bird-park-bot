const birdData = require('./birdData');
const logger = require('./logger');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class ZooManager {
    constructor() {
        this.serverZoos = new Map(); // Map<サーバーID, 鳥類園データ>
        this.recentlyLeftBirds = new Map();
        this.isInitialized = false;
        this.isProcessing = false;
        this.scheduledTasks = [];
        this.dataPath = './data/zoos/';
        
        // データディレクトリを作成
        this.ensureDataDirectory();
    }

    // データディレクトリ確保
    ensureDataDirectory() {
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
            console.log('📁 鳥類園データディレクトリを作成しました');
        }
    }

    // 鳥類園管理システム初期化
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🏞️ 鳥類園管理システムを初期化中...');
        
        try {
            // 既存の全サーバーデータを読み込み
            await this.loadAllServerZoos();
            
            // 自動管理開始
            this.startAutomaticManagement();
            
            this.isInitialized = true;
            console.log('✅ 鳥類園管理システムの初期化完了');
            
        } catch (error) {
            console.error('❌ 鳥類園初期化エラー:', error);
            throw error;
        }
    }

    // 全サーバーデータ読み込み
    async loadAllServerZoos() {
        try {
            const files = fs.readdirSync(this.dataPath);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            for (const file of jsonFiles) {
                const guildId = path.basename(file, '.json');
                await this.loadServerZoo(guildId);
            }
            
            console.log(`📂 ${jsonFiles.length}個のサーバー鳥類園データを読み込みました`);
        } catch (error) {
            console.error('全サーバーデータ読み込みエラー:', error);
        }
    }

    // サーバー別データ読み込み
    async loadServerZoo(guildId) {
        const filePath = path.join(this.dataPath, `${guildId}.json`);
        
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                // 日付オブジェクトの復元
                this.restoreDates(data);
                
                this.serverZoos.set(guildId, data);
                console.log(`📖 サーバー ${guildId} のデータを読み込みました`);
                return data;
            }
        } catch (error) {
            console.error(`サーバー ${guildId} のデータ読み込みエラー:`, error);
        }
        
        return null;
    }

    // 日付オブジェクトの復元
    restoreDates(data) {
    if (data.lastUpdate) data.lastUpdate = new Date(data.lastUpdate);
    
    ['森林', '草原', '水辺'].forEach(area => {
        if (data[area]) {
            data[area].forEach(bird => {
                if (bird.entryTime) bird.entryTime = new Date(bird.entryTime);
                if (bird.lastFed) bird.lastFed = new Date(bird.lastFed);
                if (bird.scheduledDeparture) bird.scheduledDeparture = new Date(bird.scheduledDeparture);
                if (bird.hungerStartTime) bird.hungerStartTime = new Date(bird.hungerStartTime);
                
                if (bird.feedHistory) {
                    bird.feedHistory.forEach(feed => {
                        if (feed.time) feed.time = new Date(feed.time);
                    });
                }
            });
        }
    });
    
    // 🆕 見学鳥の日付復元を追加
    if (data.visitors) {
        data.visitors.forEach(visitor => {
            if (visitor.entryTime) visitor.entryTime = new Date(visitor.entryTime);
            if (visitor.lastFed) visitor.lastFed = new Date(visitor.lastFed);
            if (visitor.scheduledDeparture) visitor.scheduledDeparture = new Date(visitor.scheduledDeparture);
            
            if (visitor.feedHistory) {
                visitor.feedHistory.forEach(feed => {
                    if (feed.time) feed.time = new Date(feed.time);
                });
            }
        });
    }
    
    // 🆕 優先入園キューの日付復元も追加
    if (data.priorityQueue) {
        data.priorityQueue.forEach(item => {
            if (item.addedTime) item.addedTime = new Date(item.addedTime);
        });
    }
    
    if (data.events) {
        data.events.forEach(event => {
            if (event.timestamp) event.timestamp = new Date(event.timestamp);
        });
    }
}

// 2. 🆕 見学鳥チェックメソッド（完全版）
async checkVisitorBirds(guildId) {
    try {
        const zooState = this.getZooState(guildId);
        if (!zooState.visitors || !zooState.isInitialized) return false;
        
        const now = new Date();
        let changesOccurred = false;
        
        console.log(`🔍 サーバー ${guildId} の見学鳥チェック開始 (${zooState.visitors.length}羽)`);
        
        for (let i = zooState.visitors.length - 1; i >= 0; i--) {
            const visitor = zooState.visitors[i];
            
            console.log(`🔍 ${visitor.name}: 予定終了時刻 ${visitor.scheduledDeparture}, 現在時刻 ${now}`);
            
            if (now >= visitor.scheduledDeparture) {
                console.log(`⏰ ${visitor.name}の見学時間が終了 - 退園処理開始`);
                await this.removeVisitorBird(guildId, i);
                changesOccurred = true;
            } else {
                // 活動更新
                if (Math.random() < 0.3) {
                    visitor.activity = `見学中：${this.generateVisitorActivity(visitor.name)}`;
                }
                
                // 🆕 見学中のランダムイベント（確率的に発生）
                if (Math.random() < 0.15) { // 15%の確率
                    await this.generateVisitorEvent(guildId, visitor);
                }
            }
        }
        
        console.log(`🔍 サーバー ${guildId} の見学鳥チェック完了 (変更: ${changesOccurred})`);
        return changesOccurred;
        
    } catch (error) {
        console.error(`サーバー ${guildId} の見学鳥チェックエラー:`, error);
        return false;
    }
}
    // サーバー別データ保存
    async saveServerZoo(guildId) {
        const zooState = this.getZooState(guildId);
        const filePath = path.join(this.dataPath, `${guildId}.json`);
        
        try {
            fs.writeFileSync(filePath, JSON.stringify(zooState, null, 2));
            console.log(`💾 サーバー ${guildId} のデータを保存しました`);
        } catch (error) {
            console.error(`サーバー ${guildId} のデータ保存エラー:`, error);
        }
    }

    // サーバー別鳥類園データ取得
    getZooState(guildId) {
        if (!this.serverZoos.has(guildId)) {
            // 新しいサーバーの場合、初期データを作成
            const newZooState = {
                森林: [],
                草原: [],
                水辺: [],
                lastUpdate: new Date(),
                events: [],
                isInitialized: false,
                guildId: guildId
            };
            this.serverZoos.set(guildId, newZooState);
        }
        return this.serverZoos.get(guildId);
    }

    // サーバー別初期化
    async initializeServer(guildId) {
        // まずファイルから読み込み試行
        let zooState = await this.loadServerZoo(guildId);
        
        if (!zooState) {
            // ファイルがない場合は新規作成
            zooState = this.getZooState(guildId);
        }
        
        if (zooState.isInitialized) return;
        
        console.log(`🏞️ サーバー ${guildId} の鳥類園を初期化中...`);
        
        try {
            await this.populateAllAreas(guildId);
            zooState.isInitialized = true;
            
            console.log(`✅ サーバー ${guildId} の鳥類園初期化完了`);
            
            // 初期化完了イベント
            await this.addEvent(guildId, 'システム', 'この鳥類園が開園しました！', '');
            
            // データ保存
            await this.saveServerZoo(guildId);
            
        } catch (error) {
            console.error(`❌ サーバー ${guildId} の鳥類園初期化エラー:`, error);
            throw error;
        }
    }

    // サーバー別全エリア鳥配置
 async populateAllAreas(guildId) {
    const zooState = this.getZooState(guildId);
    const areas = ['森林', '草原', '水辺'];
    
    for (const area of areas) {
        zooState[area] = await this.populateArea(area, 5, guildId); // ← guildIdを渡す
        console.log(`✅ サーバー ${guildId} - ${area}エリア: ${zooState[area].length}羽配置完了`);
    }
    
    zooState.lastUpdate = new Date();
}
            
async populateArea(area, targetCount, guildId = null) {
    const suitableBirds = birdData.getBirdsForZooArea(area);
    
    if (suitableBirds.length === 0) {
        console.warn(`⚠️ ${area}エリアに適した鳥が見つかりません`);
        return [];
    }

    // 既存の鳥をチェック（全エリア + 最近退園した鳥）
    let existingBirds = [];
    let recentlyLeft = [];
    
    if (guildId) {
        const allBirds = this.getAllBirds(guildId);
        existingBirds = allBirds.map(b => b.name);
        recentlyLeft = this.getRecentlyLeftBirds(guildId);
    }

    const selectedBirds = [];
    const maxAttempts = targetCount * 5;
    let attempts = 0;

    while (selectedBirds.length < targetCount && attempts < maxAttempts) {
        const randomBird = suitableBirds[Math.floor(Math.random() * suitableBirds.length)];
        
        // 重複チェック（全エリア + 最近退園）
        if (!selectedBirds.some(b => b.name === randomBird.名前) && 
            !existingBirds.includes(randomBird.名前) &&
            !recentlyLeft.includes(randomBird.名前)) {
            const birdInstance = this.createBirdInstance(randomBird, area);
            selectedBirds.push(birdInstance);
        }
        attempts++;
    }

    return selectedBirds;
} 

// 最近退園した鳥のリストを取得
getRecentlyLeftBirds(guildId) {
    if (!this.recentlyLeftBirds.has(guildId)) {
        this.recentlyLeftBirds.set(guildId, []);
    }
    return this.recentlyLeftBirds.get(guildId).map(bird => bird.name);
}

// 退園した鳥を記録
addRecentlyLeftBird(guildId, birdName) {
    const recentList = this.getRecentlyLeftBirds(guildId);
    recentList.push({
        name: birdName,
        leftTime: new Date()
    });
    
    // 24時間以上前の記録を削除
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.recentlyLeftBirds.set(guildId, 
        recentList.filter(bird => bird.leftTime > oneDayAgo)
    );
}

    // 鳥インスタンス作成（既存のメソッドをそのまま使用）
    createBirdInstance(birdData, area) {
        return {
            name: birdData.名前,
            data: birdData,
            area: area,
            entryTime: new Date(),
            lastFed: null,
            lastFedBy: null,
            feedCount: 0,
            feedHistory: [],
            activity: this.generateActivity(area),
            mood: this.getRandomMood(),
            stayExtension: 0,
            scheduledDeparture: this.calculateDepartureTime(),
            isHungry: false,
            hungerNotified: false
        };
    }

    // 出発時間計算（既存）
    calculateDepartureTime() {
        const minDays = 2;
        const maxDays = 5;
        const daysToStay = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
        
        const departureTime = new Date();
        departureTime.setDate(departureTime.getDate() + daysToStay);
        
        return departureTime;
    }

    // 自動管理開始
    startAutomaticManagement() {
        console.log('🔄 全サーバー鳥類園の自動管理を開始...');
        
        // 鳥の入れ替え（30分に1回チェック）
        const migrationTask = cron.schedule('*/30 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.checkBirdMigration(guildId);
            }
        }, { scheduled: false });

        // 活動更新（30分に1回）
        const activityTask = cron.schedule('*/30 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.updateBirdActivities(guildId);
            }
        }, { scheduled: false });

        // 空腹通知（15分に1回チェック）
        const hungerTask = cron.schedule('*/15 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.checkHungerStatus(guildId);
            }
        }, { scheduled: false });

        // 自動保存（10分に1回）
        const saveTask = cron.schedule('*/10 * * * *', async () => {
            await this.saveAllServerZoos();
        }, { scheduled: false });

        // ランダムイベント（2時間に1回）
        const eventTask = cron.schedule('0 */2 * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                if (Math.random() < 0.7) {
                    await this.generateRandomEvent(guildId);
                }
            }
        }, { scheduled: false });

        // タスク開始
        migrationTask.start();
        activityTask.start();
        hungerTask.start();
        saveTask.start();
        eventTask.start();

        this.scheduledTasks = [migrationTask, activityTask, hungerTask, saveTask, eventTask];
        
        console.log('✅ 自動管理タスクを開始しました');
    }

    // 全サーバーデータ保存
    async saveAllServerZoos() {
        for (const guildId of this.serverZoos.keys()) {
            await this.saveServerZoo(guildId);
        }
        console.log('🔄 全サーバーのデータを自動保存しました');
    }

    // 🔧 checkBirdMigrationメソッド内の見学鳥チェック部分を修正
async checkBirdMigration(guildId) {
    if (this.isProcessing) return;
    
    const zooState = this.getZooState(guildId);
    if (!zooState.isInitialized) return;

    try {
        const now = new Date();
        let migrationOccurred = false;

        // 🆕 見学鳥のチェックを最初に実行
        const visitorChanges = await this.checkVisitorBirds(guildId);
        if (visitorChanges) {
            migrationOccurred = true;
        }

        for (const area of ['森林', '草原', '水辺']) {
            const birds = zooState[area];
            
            for (let i = birds.length - 1; i >= 0; i--) {
                const bird = birds[i];
                const actualDeparture = new Date(bird.scheduledDeparture.getTime() + (bird.stayExtension * 24 * 60 * 60 * 1000));
                
                if (now >= actualDeparture) {
                    await this.removeBird(guildId, area, i);
                    migrationOccurred = true;
                }
            }
            
            if (zooState[area].length < 5) {
                await this.addNewBirdToArea(guildId, area);
                migrationOccurred = true;
            }
        }

        if (migrationOccurred) {
            zooState.lastUpdate = new Date();
            await this.saveServerZoo(guildId);
            console.log(`🔄 サーバー ${guildId} の鳥類園構成が更新されました`);
        }

    } catch (error) {
        console.error(`サーバー ${guildId} の鳥移動チェックエラー:`, error);
    }
}
 // 🆕 既存のremoveBirdメソッドを拡張
async removeBird(guildId, area, index) {
    const zooState = this.getZooState(guildId);
    const bird = zooState[area][index];
    
    // 記憶データを保存
    await this.saveBirdMemory(bird, area, guildId);
    
    zooState[area].splice(index, 1);
    
    // 退園した鳥を記録
    this.addRecentlyLeftBird(guildId, bird.name);
    
    await logger.logZoo('退園', area, bird.name, '', '', guildId);
    
    // 特別な退園メッセージ
    let departureMessage = `${bird.name}が旅立っていきました。`;
    
    if (bird.receivedGifts && bird.receivedGifts.length > 0) {
        departureMessage += `贈り物を大切に持って帰りました。`;
    }
    
    if (bird.visitCount > 1) {
        departureMessage += `「また必ず戻ってきます」と言っているようです。`;
    } else {
        departureMessage += `また会える日まで...👋`;
    }
    
    await this.addEvent(
        guildId,
        'お別れ',
        departureMessage,
        bird.name
    );
}

    // 🔧 addNewBirdToAreaメソッドの修正版
async addNewBirdToArea(guildId, area) {
    // まず優先キューをチェック
    const zooState = this.getZooState(guildId);
    if (zooState.priorityQueue && zooState.priorityQueue.length > 0) {
        const priorityBird = zooState.priorityQueue.shift();
        
        // 優先鳥を配置
        const birdDataManager = require('./birdData');
        const birdDataAll = birdDataManager.getAllBirds();
        const targetBird = birdDataAll.find(b => b.名前 === priorityBird.birdName);
        
        if (targetBird) {
            // 🆕 見学中の同じ鳥がいる場合、見学を終了
            await this.removeVisitorIfExists(guildId, targetBird.名前);
            
            // 記憶システム対応
            const birdInstance = await this.createBirdInstanceWithMemory(targetBird, area, guildId);
            zooState[area].push(birdInstance);
            
            await logger.logZoo('優先入園', area, targetBird.名前, '', '', guildId);
            
            await this.addEvent(
                guildId,
                '優先入園',
                `${targetBird.名前}が見学の思い出を胸に、優先的に${area}エリアに入園しました！🌟`,
                targetBird.名前
            );
            
            return;
        }
    }
    
    // 通常の新鳥追加（記憶システム対応）
    const newBirds = await this.populateArea(area, 1, guildId);
    
    if (newBirds.length > 0) {
        // 記憶システムを適用
        const birdWithMemory = await this.createBirdInstanceWithMemory(newBirds[0].data, area, guildId);
        // 元のbirdインスタンスのプロパティをコピー
        Object.assign(birdWithMemory, newBirds[0], {
            receivedGifts: birdWithMemory.receivedGifts,
            specialMemories: birdWithMemory.specialMemories,
            friendUsers: birdWithMemory.friendUsers,
            visitCount: birdWithMemory.visitCount,
            isReturningVisitor: birdWithMemory.isReturningVisitor,
            activity: birdWithMemory.activity
        });
        
        zooState[area].push(birdWithMemory);
        
        await logger.logZoo('入園', area, birdWithMemory.name, '', '', guildId);
        
        // 特別な入園メッセージ
        let entryMessage = `${birdWithMemory.name}が新しく${area}エリアに仲間入りしました！🎉`;
        
        if (birdWithMemory.isReturningVisitor) {
            entryMessage = `${birdWithMemory.name}が${birdWithMemory.visitCount}回目の来訪で${area}エリアに入園しました！🎊`;
            
            if (birdWithMemory.receivedGifts && birdWithMemory.receivedGifts.length > 0) {
                entryMessage += `\n大切な贈り物を持って戻ってきました💝`;
            }
        }
        
        await this.addEvent(
            guildId,
            birdWithMemory.isReturningVisitor ? '再訪問' : '新入り',
            entryMessage,
            birdWithMemory.name
        );
    } else {
        console.warn(`⚠️ サーバー ${guildId} の ${area}エリアに追加できる新しい鳥が見つかりません`);
    }
}

    // 🆕 見学中の同じ鳥を削除するメソッド
async removeVisitorIfExists(guildId, birdName) {
    try {
        const zooState = this.getZooState(guildId);
        if (!zooState.visitors) return false;
        
        const visitorIndex = zooState.visitors.findIndex(visitor => visitor.name === birdName);
        
        if (visitorIndex !== -1) {
            const visitor = zooState.visitors[visitorIndex];
            
            // 見学鳥を削除
            zooState.visitors.splice(visitorIndex, 1);
            
            await this.addEvent(
                guildId,
                '見学終了→入園',
                `${birdName}が見学を終了して正式入園しました！ようこそ！🏡`,
                birdName
            );
            
            console.log(`🔄 サーバー ${guildId} - ${birdName} の見学を終了（優先入園のため）`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('見学鳥削除エラー:', error);
        return false;
    }
}

// 🆕 見学鳥を含む統計情報
// 🔧 統計情報も修正
getStatistics(guildId) {
    const allBirds = this.getAllBirds(guildId); // 見学鳥は除外
    const zooState = this.getZooState(guildId);
    const visitors = zooState.visitors || [];
    
    return {
        totalBirds: allBirds.length,
        areaDistribution: {
            森林: zooState.森林.length,
            草原: zooState.草原.length,
            水辺: zooState.水辺.length
        },
        visitors: visitors.length,
        priorityQueue: (zooState.priorityQueue || []).length,
        averageStay: this.calculateAverageStay(allBirds),
        hungryBirds: allBirds.filter(b => b.isHungry).length,
        recentEvents: zooState.events.slice(-5),
        lastUpdate: zooState.lastUpdate
    };
}

    // サーバー別活動更新
    async updateBirdActivities(guildId) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.isInitialized) return;

            for (const area of ['森林', '草原', '水辺']) {
                zooState[area].forEach(bird => {
                    if (Math.random() < 0.3) {
                        bird.activity = this.generateActivity(area);
                        
                        if (Math.random() < 0.2) {
                            bird.mood = this.getRandomMood();
                        }
                    }
                });
            }
        } catch (error) {
            console.error(`サーバー ${guildId} の活動更新エラー:`, error);
        }
    }

    // サーバー別空腹チェック
    async checkHungerStatus(guildId) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.isInitialized) return;

            if (this.isSleepTime()) return;
            
            const now = new Date();
                
            for (const area of ['森林', '草原', '水辺']) {
                for (const bird of zooState[area]) {
                    const hungryThreshold = 4 * 60 * 60 * 1000; // 4時間
                    const lastFeedTime = bird.lastFed || bird.entryTime;
                    
                    if ((now - lastFeedTime) > hungryThreshold) {
                        if (!bird.isHungry) {
                            bird.isHungry = true;
                            bird.hungerNotified = false;
                            bird.activity = this.generateHungryActivity(area);
                            
                            if (Math.random() < 0.70) {
                                await this.addEvent(
                                    guildId,
                                    '空腹通知',
                                    `${bird.name}がお腹を空かせているようです！🍽️ \`/feed bird:${bird.name} food:[餌の種類]\` で餌をあげてみましょう`,
                                    bird.name
                                );
                                bird.hungerNotified = true;
                            }
                            
                            console.log(`🍽️ サーバー ${guildId} - ${bird.name} が空腹になりました (${area}エリア)`);
                        }
                    } else {
                        if (bird.isHungry) {
                            bird.isHungry = false;
                            bird.activity = this.generateActivity(area);
                            console.log(`😊 サーバー ${guildId} - ${bird.name} が満腹になりました (${area}エリア)`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`サーバー ${guildId} の空腹状態チェックエラー:`, error);
        }
    }

    // サーバー別ランダムイベント
    async generateRandomEvent(guildId) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.isInitialized) return;

            const allBirds = this.getAllBirds(guildId);
            if (allBirds.length === 0) return;

            const eventTypes = ['interaction', 'discovery', 'weather', 'special'];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const event = await this.createEvent(eventType, allBirds);
            
            if (event) {
                await this.addEvent(guildId, event.type, event.content, event.relatedBird);
                console.log(`🎪 サーバー ${guildId} でランダムイベント発生: ${event.type}`);
            }

        } catch (error) {
            console.error(`サーバー ${guildId} のランダムイベント生成エラー:`, error);
        }
    }

    // サーバー別イベント追加
    async addEvent(guildId, type, content, relatedBird = '') {
        const zooState = this.getZooState(guildId);
        
        const event = {
            type,
            content,
            relatedBird,
            timestamp: new Date()
        };

        zooState.events.push(event);

        if (zooState.events.length > 20) {
            zooState.events = zooState.events.slice(-20);
        }

        await logger.logEvent(type, content, relatedBird, guildId);
    }

    // 🔧 getAllBirdsメソッドも修正（見学鳥は除外）
getAllBirds(guildId) {
    const zooState = this.getZooState(guildId);
    return [
        ...zooState.森林,
        ...zooState.草原,
        ...zooState.水辺
        // 見学鳥は含めない（別で管理）
    ];
}

    // 🆕 見学鳥を含む全鳥取得メソッド（必要に応じて）
getAllBirdsIncludingVisitors(guildId) {
    const zooState = this.getZooState(guildId);
    const allBirds = [
        ...zooState.森林,
        ...zooState.草原,
        ...zooState.水辺
    ];
    
    if (zooState.visitors) {
        allBirds.push(...zooState.visitors);
    }
    
    return allBirds;
}

    // 既存のヘルパーメソッド（変更なし）
    generateActivity(area) {
        const activities = {
            '森林': [
                '木の枝で休んでいます', '木の実を探しています', '美しい声でさえずっています',
                '羽繕いをしています', '枝から枝へ飛び移っています', '虫を捕まえています',
                '巣の材料を集めています', '木陰で涼んでいます', '葉っぱと戯れています',
                '高い枝の上で見張りをしています','木の幹をコツコツと叩いて音を楽しんでいます',
                '新緑の香りを楽しんでいるようです','森の奥深くから美しいメロディを奏でています'
            ],
            '草原': [
                '草地を歩き回っています', '種を探しています', '気持ちよさそうに日向ぼっこしています',
                '他の鳥と遊んでいます', '風に羽を広げています', '地面で餌を探しています',
                'のんびりと過ごしています', '花の蜜を吸っています', '芝生の上を転がっています',
                '青空を見上げています','蝶を追いかけて遊んでいます','草花の種を器用に選り分けています',
                '仲間と一緒に草原を散歩しています'
            ],
            '水辺': [
                '水面に映る自分を見ています', '魚を狙っています', '水浴びを楽しんでいます',
                '水辺を静かに歩いています', '小さな波と戯れています', '羽を乾かしています',
                '水草の中を泳いでいます', '石の上で休んでいます', '水面をそっと歩いています',
                '水面に落ちた葉っぱで遊んでいます','自分の影を水面で確認しています',
                '小さな渦を作って楽しんでいます','水滴を羽で弾いて遊んでいます'
            ]
        };

        const areaActivities = activities[area] || activities['森林'];
        return areaActivities[Math.floor(Math.random() * areaActivities.length)];
    }

    generateHungryActivity(area) {
        const hungryActivities = {
            '森林': [
                'お腹を空かせて餌を探し回っています',
                '木の枝で寂しそうに鳴いています', 
                '餌を求めてあちこち見回しています',
                'お腹がぺこぺこで元気がありません',
                '木の実が落ちていないか必死に探しています',
                'お腹の音が森に響いているようです',
                '他の鳥が食べている様子を羨ましそうに見ています',
                '枝の上で小さくお腹を鳴らしています'
            ],
            '草原': [
                '地面をつついて何か食べ物を探しています',
                'お腹を空かせてそわそわしています',
                '餌を求めて草むらを探しています',
                '空腹で少し疲れているようです',
                'お腹がぺこぺこで羽を垂らして歩いています',
                '種を探して地面を夢中で掘っています',
                '空腹で少しふらつきながら歩いています',
                'お腹を空かせて小さく鳴き続けています'
            ],
            '水辺': [
                '水面を見つめて魚を探しています',
                'お腹を空かせて水辺をうろうろしています',
                '餌を求めて浅瀬を歩き回っています',
                '空腹で羽を垂らしています',
                'お腹を空かせて水面をじっと見つめています',
                '空腹で普段より低い位置で泳いでいます',
                '魚の気配を必死に探っています',
                'お腹が空いて水辺をとぼとぼ歩いています'
            ]
        };

        const activities = hungryActivities[area] || hungryActivities['森林'];
        return activities[Math.floor(Math.random() * activities.length)];
    }

    getRandomMood() {
        const moods = ['happy', 'normal', 'sleepy', 'excited', 'calm'];
        return moods[Math.floor(Math.random() * moods.length)];
    }

    // 夜間判定メソッドを改良
isSleepTime() {
    const now = new Date();
    const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    const hour = jstTime.getHours();
    return hour >= 22 || hour < 7;
}

    // イベント作成メソッド（既存のものを流用）
    async createEvent(eventType, allBirds) {
        switch (eventType) {
            case 'interaction':
                return this.createInteractionEvent(allBirds);
            case 'discovery':
                return this.createDiscoveryEvent(allBirds);
            case 'weather':
                return this.createWeatherEvent(allBirds);
            case 'special':
                return this.createSpecialEvent(allBirds);
            default:
                return null;
        }
    }

    createInteractionEvent(allBirds) {
        if (allBirds.length < 2) return null;

        const bird1 = allBirds[Math.floor(Math.random() * allBirds.length)];
        const bird2 = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        if (bird1.name === bird2.name) return null;

        const interactions = [
            `${bird1.name}と${bird2.name}が仲良くおしゃべりしています`,
            `${bird1.name}が${bird2.name}に何かを教えているようです`,
            `${bird1.name}と${bird2.name}が一緒に遊んでいます`,
            `${bird1.name}と${bird2.name}が美しいデュエットを奏でています`,
            `${bird1.name}と${bird2.name}が羽を重ね合わせて絆を深めています`,
            `${bird1.name}が${bird2.name}に秘密の場所を案内しているようです`,
            `${bird1.name}と${bird2.name}が夕日を一緒に眺めています`,
            `${bird1.name}と${bird2.name}が互いの羽繕いをし合っています`,
            `${bird1.name}が${bird2.name}と鳴き声で会話を楽しんでいます`,
            `${bird1.name}と${bird2.name}が仲良く並んで休憩しています`,
            `${bird1.name}が${bird2.name}におすすめの餌場を教えています`,
            `${bird1.name}と${bird2.name}が一緒に空を舞っています`,
            `${bird1.name}が${bird2.name}の美しい羽を褒めているようです`,
            `${bird1.name}と${bird2.name}が昔話をしているようです`,
            `${bird1.name}と${bird2.name}が互いを気遣い合っています`,
            `${bird1.name}が${bird2.name}と楽しそうに追いかけっこをしています`,
            `${bird1.name}と${bird2.name}が一緒に新しい歌を作っているようです`,
            `${bird1.name}が${bird2.name}に面白い話を聞かせています`,
            `${bird1.name}と${bird2.name}が心を通わせる特別な瞬間を過ごしています`,
            `${bird1.name}と${bird2.name}が互いの存在に安らぎを感じているようです`
        ];

        return {
            type: '交流',
            content: interactions[Math.floor(Math.random() * interactions.length)],
            relatedBird: `${bird1.name}, ${bird2.name}`
        };
    }

    createDiscoveryEvent(allBirds) {
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        const discoveries = [
            `${bird.name}が珍しい木の実を発見しました`,
            `${bird.name}が新しい隠れ家を見つけたようです`,
            `${bird.name}が美しい羽根を落としていきました`,
            `${bird.name}が興味深い行動を見せています`,
            `${bird.name}が四つ葉のクローバーを見つけて喜んでいます`,
            `${bird.name}が虹色に光る水滴を発見して見とれています`,
            `${bird.name}が珍しい形の雲を見つけて興奮しています`
        ];

        return {
            type: '発見',
            content: discoveries[Math.floor(Math.random() * discoveries.length)],
            relatedBird: bird.name
        };
    }

    createWeatherEvent(allBirds) {
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        const weatherEvents = [
            `暖かい日差しの中、${bird.name}が気持ちよさそうに羽を広げています`,
            `そよ風に乗って、${bird.name}が優雅に舞っています`,
            `雨上がりの清々しい空気を、${bird.name}が楽しんでいます`,
            `薄雲の隙間から差す光を、${bird.name}が見つめています`,
            `霧の中を${bird.name}が幻想的に舞っています`,
            `${bird.name}が雨上がりの新鮮な空気を深く吸い込んでいます`
        ];

        return {
            type: '天気',
            content: weatherEvents[Math.floor(Math.random() * weatherEvents.length)],
            relatedBird: bird.name
        };
    }

    createSpecialEvent(allBirds) {
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        const specialEvents = [
            `${bird.name}が珍しい鳴き声を披露しています`,
            `${bird.name}が普段とは違う場所にいます`,
            `${bird.name}が特別な羽ばたきを見せています`,
            `${bird.name}が訪問者に興味を示しているようです`,
            `${bird.name}が訪問者に向かって特別な挨拶をしています`,
            `${bird.name}が今日だけの特別な羽の模様を見せています`,
            `${bird.name}が感謝の気持ちを込めて美しく舞い踊っています`
        ];

        return {
            type: '特別',
            content: specialEvents[Math.floor(Math.random() * specialEvents.length)],
            relatedBird: bird.name
        };
    }

// 夜間専用のイベント作成メソッドを追加
async createNightEvent(eventType, allBirds) {
    switch (eventType) {
        case 'sleep':
            return this.createSleepEvent(allBirds);
        case 'dream':
            return this.createDreamEvent(allBirds);
        case 'night_watch':
            return this.createNightWatchEvent(allBirds);
        case 'nocturnal':
            return this.createNocturnalEvent(allBirds);
        default:
            return null;
    }
}

// 夜間イベント: 睡眠
createSleepEvent(allBirds) {
    const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
    
    const sleepEvents = [
        `${bird.name}が安らかに眠っています💤`,
        `${bird.name}が羽の中に頭を埋めて深く眠っています`,
        `${bird.name}が静かな寝息を立てています`,
        `${bird.name}が暖かい場所で丸くなって眠っています`,
        `${bird.name}が月明かりの下で穏やかに休んでいます`,
        `${bird.name}が仲間と寄り添って眠っています`,
        `${bird.name}が枝の上で器用にバランスを取りながら眠っています`
    ];

    return {
        type: '夜間の休息',
        content: sleepEvents[Math.floor(Math.random() * sleepEvents.length)],
        relatedBird: bird.name
    };
}

// 夜間イベント: 夢
createDreamEvent(allBirds) {
    const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
    
    const dreamEvents = [
        `${bird.name}が楽しそうな夢を見ているようです✨`,
        `${bird.name}が寝言で小さく鳴いています`,
        `${bird.name}が夢の中で空を飛んでいるのか、羽をひらひらと動かしています`,
        `${bird.name}が夢の中で美味しい餌を食べているようです`,
        `${bird.name}が夢の中で仲間と遊んでいるのか、嬉しそうな表情をしています`,
        `${bird.name}が幸せそうな夢を見て、小さく笑っているようです`,
        `${bird.name}が夢の中で歌を歌っているのか、くちばしを小さく動かしています`
    ];

    return {
        type: '夢の中',
        content: dreamEvents[Math.floor(Math.random() * dreamEvents.length)],
        relatedBird: bird.name
    };
}

// 夜間イベント: 夜間見回り
createNightWatchEvent(allBirds) {
    const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
    
    const watchEvents = [
        `${bird.name}が夜警として静かに辺りを見回っています🌙`,
        `${bird.name}が月の光を浴びながら優雅に佇んでいます`,
        `${bird.name}が夜風に羽を揺らしながら静かに過ごしています`,
        `${bird.name}が星空を見上げて何かを考えているようです`,
        `${bird.name}が夜の静寂を楽しんでいるようです`,
        `${bird.name}が月光で銀色に輝く羽を披露しています`,
        `${bird.name}が夜の美しさに見とれているようです`
    ];

    return {
        type: '夜間の見回り',
        content: watchEvents[Math.floor(Math.random() * watchEvents.length)],
        relatedBird: bird.name
    };
}

// 夜間イベント: 夜行性の活動
createNocturnalEvent(allBirds) {
    // フクロウなど夜行性の鳥がいる場合の特別イベント
    const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
    
    const nocturnalEvents = [
        `${bird.name}が夜の闇の中で静かに活動しています🦉`,
        `${bird.name}が夜の獲物を探しているようです`,
        `${bird.name}が暗闇の中を器用に飛び回っています`,
        `${bird.name}が夜の世界の王者のように堂々としています`,
        `${bird.name}が月明かりを頼りに狩りの準備をしています`,
        `${bird.name}が夜の静寂の中で鋭い目を光らせています`,
        `${bird.name}が夜の森の番人として佇んでいます`
    ];

    return {
        type: '夜行性の活動',
        content: nocturnalEvents[Math.floor(Math.random() * nocturnalEvents.length)],
        relatedBird: bird.name
    };
}

// ランダムイベント生成メソッドを修正
async generateRandomEvent(guildId) {
    try {
        const zooState = this.getZooState(guildId);
        if (!zooState.isInitialized) return;

        const allBirds = this.getAllBirds(guildId);
        if (allBirds.length === 0) return;

        let event;
        
        // 夜間かどうかで異なるイベントを生成
        if (this.isSleepTime()) {
            // 夜間イベント（22時〜7時）
            const nightEventTypes = ['sleep', 'dream', 'night_watch', 'nocturnal'];
            const eventType = nightEventTypes[Math.floor(Math.random() * nightEventTypes.length)];
            event = await this.createNightEvent(eventType, allBirds);
            console.log(`🌙 サーバー ${guildId} で夜間イベント発生: ${eventType}`);
        } else {
            // 昼間イベント（7時〜22時）
            const dayEventTypes = ['interaction', 'discovery', 'weather', 'special'];
            const eventType = dayEventTypes[Math.floor(Math.random() * dayEventTypes.length)];
            event = await this.createEvent(eventType, allBirds);
            console.log(`☀️ サーバー ${guildId} で昼間イベント発生: ${eventType}`);
        }
        
        if (event) {
            await this.addEvent(guildId, event.type, event.content, event.relatedBird);
        }

    } catch (error) {
        console.error(`サーバー ${guildId} のランダムイベント生成エラー:`, error);
    }
}

// 夜間は空腹チェックを停止する既存のメソッドを確認
async checkHungerStatus(guildId) {
    try {
        const zooState = this.getZooState(guildId);
        if (!zooState.isInitialized) return;

        // 夜間は空腹チェックをスキップ（鳥は寝ているため）
        if (this.isSleepTime()) {
            console.log(`🌙 サーバー ${guildId} - 夜間のため空腹チェックをスキップします`);
            return;
        }
        
        const now = new Date();
            
        for (const area of ['森林', '草原', '水辺']) {
            for (const bird of zooState[area]) {
                const hungryThreshold = 4 * 60 * 60 * 1000; // 4時間
                const lastFeedTime = bird.lastFed || bird.entryTime;
                
                if ((now - lastFeedTime) > hungryThreshold) {
                    if (!bird.isHungry) {
                        bird.isHungry = true;
                        bird.hungerNotified = false;
                        bird.activity = this.generateHungryActivity(area);
                        
                        if (Math.random() < 0.50) {
                            await this.addEvent(
                                guildId,
                                '空腹通知',
                                `${bird.name}がお腹を空かせているようです！🍽️ \`/feed bird:${bird.name} food:[餌の種類]\` で餌をあげてみましょう`,
                                bird.name
                            );
                            bird.hungerNotified = true;
                        }
                        
                        console.log(`🍽️ サーバー ${guildId} - ${bird.name} が空腹になりました (${area}エリア)`);
                    }
                } else {
                    if (bird.isHungry) {
                        bird.isHungry = false;
                        bird.activity = this.generateActivity(area);
                        console.log(`😊 サーバー ${guildId} - ${bird.name} が満腹になりました (${area}エリア)`);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`サーバー ${guildId} の空腹状態チェックエラー:`, error);
    }
}

    calculateAverageStay(birds) {
        if (birds.length === 0) return 0;
        
        const now = new Date();
        const totalStayHours = birds.reduce((sum, bird) => {
            const stayTime = now - bird.entryTime;
            return sum + (stayTime / (1000 * 60 * 60));
        }, 0);
        
        return Math.round(totalStayHours / birds.length);
    }

// 🆕 見学鳥を追加
async addVisitorBird(guildId, birdData, inviterId, inviterName) {
    try {
        console.log(`🔍 見学鳥追加開始: ${birdData.名前} (サーバー: ${guildId})`);
        
        const zooState = this.getZooState(guildId);
        console.log(`🔍 現在の見学鳥数: ${(zooState.visitors || []).length}`);
        
        // 見学鳥用の特別な鳥インスタンス作成
        const visitorBird = {
            name: birdData.名前,
            data: birdData,
            area: 'visitor',
            entryTime: new Date(),
            lastFed: null,
            lastFedBy: null,
            feedCount: 0,
            feedHistory: [],
            activity: `見学中：${this.generateVisitorActivity(birdData.名前)}`,
            mood: 'curious',
            isVisitor: true,
            inviterId: inviterId,
            inviterName: inviterName,
            visitDuration: this.calculateVisitDuration(),
            scheduledDeparture: this.calculateVisitorDeparture(),
            isHungry: false,
            hungerNotified: false
        };
        
        console.log(`🔍 見学終了予定時刻: ${visitorBird.scheduledDeparture}`);
        
        // 見学鳥リストに追加
        if (!zooState.visitors) {
            zooState.visitors = [];
            console.log('🔍 見学鳥リストを初期化しました');
        }
        
        zooState.visitors.push(visitorBird);
        console.log(`🔍 見学鳥追加後の数: ${zooState.visitors.length}`);
        
        // 優先入園リストに追加
        if (!zooState.priorityQueue) {
            zooState.priorityQueue = [];
        }
        zooState.priorityQueue.push({
            birdName: birdData.名前,
            priority: 'high',
            reason: '見学経験',
            addedTime: new Date(),
            inviterId: inviterId
        });
        
        console.log(`🔍 優先入園リストに追加: ${birdData.名前}`);
        
        // イベント記録
        await this.addEvent(
            guildId,
            '見学到着',
            `${birdData.名前}が${inviterName}さんの招待で見学にやってきました！`,
            birdData.名前
        );
        
        // 見学中の交流イベントをスケジュール
        this.scheduleVisitorEvents(guildId, visitorBird);
        
        console.log(`👀 サーバー ${guildId} - ${birdData.名前} が見学開始（成功）`);
        
        // データ保存
        await this.saveServerZoo(guildId);
        console.log(`💾 見学鳥データを保存しました`);
        
    } catch (error) {
        console.error('❌ 見学鳥追加エラー:', error);
        throw error;
    }
}

// 見学終了時間計算も修正
calculateVisitorDeparture() {
    const now = new Date();
    const duration = this.calculateVisitDuration(); // 2-4時間
    const departure = new Date(now.getTime() + duration * 60 * 60 * 1000);
    console.log(`🔍 見学時間計算: ${duration}時間 (${now} → ${departure})`);
    return departure;
}

// 🆕 見学時間計算（2-4時間）
calculateVisitDuration() {
    return Math.floor(Math.random() * 2 + 2); // 2-4時間
}

// 🆕 見学鳥の活動生成
generateVisitorActivity(birdName) {
    const activities = [
        `鳥類園の雰囲気を楽しんでいます`,
        `他の鳥たちと挨拶を交わしています`,
        `お気に入りの場所を見つけたようです`,
        `環境をとても気に入ったようです`,
        `住民の鳥たちと楽しく交流しています`,
        `また来たいと思っていそうです`,
        `鳥類園の美しさに見とれています`,
        `新しい友達ができて喜んでいます`
    ];
    
    return activities[Math.floor(Math.random() * activities.length)];
}

// 🔧 addVisitorBirdメソッドの見学イベントスケジュール部分を修正
scheduleVisitorEvents(guildId, visitorBird) {
    const visitDurationMs = visitorBird.visitDuration * 60 * 60 * 1000; // 見学時間をミリ秒に変換
    
    // 見学時間の1/4経過後に最初のイベント
    const firstEventDelay = Math.max(15 * 60 * 1000, visitDurationMs * 0.25); // 最低15分、または見学時間の1/4
    setTimeout(async () => {
        await this.generateVisitorEvent(guildId, visitorBird);
    }, firstEventDelay);
    
    // 見学時間の1/2経過後に2回目のイベント
    if (visitDurationMs > 60 * 60 * 1000) { // 1時間以上の見学の場合
        const secondEventDelay = visitDurationMs * 0.5;
        setTimeout(async () => {
            await this.generateVisitorEvent(guildId, visitorBird);
        }, secondEventDelay);
    }
    
    // 見学時間の3/4経過後に最終イベント
    if (visitDurationMs > 90 * 60 * 1000) { // 1.5時間以上の見学の場合
        const finalEventDelay = visitDurationMs * 0.75;
        setTimeout(async () => {
            const impressionEvents = [
                `${visitorBird.name}が園の素晴らしさに感動しています`,
                `${visitorBird.name}がもう少しここにいたいと思っているようです`,
                `${visitorBird.name}が今回の見学をとても楽しんでいます`
            ];
            const content = impressionEvents[Math.floor(Math.random() * impressionEvents.length)];
            await this.addEvent(guildId, '見学感想', content, visitorBird.name);
        }, finalEventDelay);
    }
    
    console.log(`📅 ${visitorBird.name}の見学イベントをスケジュール設定完了 (見学時間: ${visitorBird.visitDuration}時間)`);
}

// 🔧 見学時間の計算も少し調整
calculateVisitDuration() {
    // 30%の確率で短時間見学（1-2時間）、70%の確率で通常見学（2-4時間）
    if (Math.random() < 0.3) {
        return Math.floor(Math.random() * 2 + 1); // 1-2時間
    } else {
        return Math.floor(Math.random() * 3 + 2); // 2-4時間
    }
}

// 🆕 デバッグ用メソッド - 見学鳥の状態確認
getVisitorStatus(guildId) {
    const zooState = this.getZooState(guildId);
    if (!zooState.visitors) return { totalVisitors: 0, visitors: [] };
    
    const now = new Date();
    
    return {
        totalVisitors: zooState.visitors.length,
        visitors: zooState.visitors.map(visitor => ({
            name: visitor.name,
            inviterName: visitor.inviterName,
            entryTime: visitor.entryTime,
            scheduledDeparture: visitor.scheduledDeparture,
            remainingTime: Math.max(0, Math.floor((visitor.scheduledDeparture - now) / (60 * 1000))), // 分単位
            activity: visitor.activity
        }))
    };
}


// 🆕 手動で見学鳥をチェックするデバッグメソッド
async manualVisitorCheck(guildId) {
    console.log(`🧪 サーバー ${guildId} で手動見学鳥チェックを実行...`);
    const result = await this.checkVisitorBirds(guildId);
    const status = this.getVisitorStatus(guildId);
    
    return {
        checkResult: result,
        currentStatus: status
    };
}

    async forceRemoveAllVisitors(guildId) {
    const zooState = this.getZooState(guildId);
    if (!zooState.visitors) return 0;
    
    const count = zooState.visitors.length;
    
    for (let i = zooState.visitors.length - 1; i >= 0; i--) {
        await this.removeVisitorBird(guildId, i);
    }
    
    console.log(`🧪 サーバー ${guildId} の見学鳥を${count}羽強制退園させました`);
    return count;
}
    extendVisitorTime(guildId, birdName, hours = 1) {
    const zooState = this.getZooState(guildId);
    if (!zooState.visitors) return false;
    
    const visitor = zooState.visitors.find(v => v.name === birdName);
    if (visitor) {
        visitor.scheduledDeparture = new Date(visitor.scheduledDeparture.getTime() + hours * 60 * 60 * 1000);
        console.log(`🧪 ${birdName}の見学時間を${hours}時間延長しました`);
        return true;
    }
    
    return false;
}
    
// 🔧 removeVisitorBirdメソッドの修正版
async removeVisitorBird(guildId, index) {
    try {
        const zooState = this.getZooState(guildId);
        if (!zooState.visitors || index >= zooState.visitors.length || index < 0) {
            console.error(`❌ 無効な見学鳥インデックス: ${index} (総数: ${zooState.visitors?.length || 0})`);
            return;
        }
        
        const visitor = zooState.visitors[index];
        console.log(`🪽 ${visitor.name}の見学終了処理開始`);
        
        // 見学鳥を削除
        zooState.visitors.splice(index, 1);
        
        // お別れイベント
        const farewellMessages = [
            `${visitor.name}が見学を終えて帰っていきました。また来てくれるかな？🪽`,
            `${visitor.name}が素敵な思い出を胸に帰路につきました✨`,
            `${visitor.name}が「ありがとう」と言っているように見えます👋`,
            `${visitor.name}が名残惜しそうに振り返りながら去っていきました`,
            `${visitor.name}が「きっとまた来ます」と約束しているようです💫`,
            `${visitor.name}が満足そうな表情で帰っていきました😊`
        ];
        
        const message = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];
        
        await this.addEvent(guildId, '見学終了', message, visitor.name);
        
        // 🆕 優先入園権の確認・付与
        if (Math.random() < 0.7) { // 70%の確率で優先入園権を獲得
            if (!zooState.priorityQueue) {
                zooState.priorityQueue = [];
            }
            
            // 既に優先入園リストにいるかチェック
            const alreadyInQueue = zooState.priorityQueue.some(item => item.birdName === visitor.name);
            
            if (!alreadyInQueue) {
                zooState.priorityQueue.push({
                    birdName: visitor.name,
                    priority: 'high',
                    reason: '見学経験',
                    addedTime: new Date(),
                    inviterId: visitor.inviterId
                });
                
                await this.addEvent(
                    guildId,
                    '優先入園権獲得',
                    `${visitor.name}が見学の経験により優先入園権を獲得しました！🌟`,
                    visitor.name
                );
                
                console.log(`⭐ ${visitor.name}が優先入園権を獲得`);
            }
        }
        
        console.log(`✅ サーバー ${guildId} - ${visitor.name} の見学終了完了`);
        
    } catch (error) {
        console.error('見学鳥退園エラー:', error);
    }
}

async applyBirdMemory(bird, guildId) {
    try {
        // シンプルな記憶システム（Sheetsがない場合の代替）
        // 実際のSheetsマネージャーがある場合は元のコードを使用
        bird.visitCount = 1;
        bird.isReturningVisitor = false;
        bird.receivedGifts = [];
        bird.specialMemories = [];
        bird.friendUsers = [];
        
        return null;
        
    } catch (error) {
        console.error('鳥の記憶適用エラー:', error);
        return null;
    }
}
    
async saveBirdMemory(bird, area, guildId) {
    try {
        // シンプルな記憶保存（実際のSheetsマネージャーがある場合は元のコードを使用）
        console.log(`💾 ${bird.name}の記憶データ保存をスキップ（Sheetsマネージャー未設定）`);
        
    } catch (error) {
        console.error('鳥の記憶保存エラー:', error);
    }
}
    
async generateVisitorEvent(guildId, visitor) {
    try {
        const allBirds = this.getAllBirds(guildId);
        const eventTypes = ['interaction', 'discovery', 'activity', 'impression'];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        let eventContent = '';
        let relatedBirds = visitor.name;
        
        switch (eventType) {
            case 'interaction':
                if (allBirds.length > 0) {
                    const randomResident = allBirds[Math.floor(Math.random() * allBirds.length)];
                    const interactions = [
                        `見学中の${visitor.name}が${randomResident.name}とおしゃべりしています`,
                        `${visitor.name}が${randomResident.name}から園内を案内されています`,
                        `${randomResident.name}が${visitor.name}に挨拶をしています`,
                        `${visitor.name}と${randomResident.name}が仲良く並んで休んでいます`,
                        `${visitor.name}が${randomResident.name}の美しい羽に感心しています`,
                        `${randomResident.name}が${visitor.name}におすすめスポットを教えています`
                    ];
                    eventContent = interactions[Math.floor(Math.random() * interactions.length)];
                    relatedBirds = `${visitor.name}, ${randomResident.name}`;
                }
                break;
                
            case 'discovery':
                const discoveries = [
                    `${visitor.name}がお気に入りの場所を見つけたようです`,
                    `${visitor.name}が興味深そうに園内を探索しています`,
                    `${visitor.name}が美しい景色に見とれています`,
                    `${visitor.name}が新しい発見をして喜んでいます`,
                    `${visitor.name}が隠れた名所を発見したようです`,
                    `${visitor.name}が素敵な写真スポットを見つけました`
                ];
                eventContent = discoveries[Math.floor(Math.random() * discoveries.length)];
                break;
                
            case 'activity':
                const activities = [
                    `${visitor.name}が楽しそうに羽を広げています`,
                    `${visitor.name}が園内の雰囲気を満喫しています`,
                    `${visitor.name}が他の鳥たちの様子を興味深そうに観察しています`,
                    `${visitor.name}が心地よさそうに過ごしています`,
                    `${visitor.name}が自由に園内を散策しています`,
                    `${visitor.name}が リラックスした様子で羽休めしています`
                ];
                eventContent = activities[Math.floor(Math.random() * activities.length)];
                break;
                
            case 'impression':
                const impressions = [
                    `${visitor.name}がこの園をとても気に入ったようです`,
                    `${visitor.name}が「また来たい」と思っているようです`,
                    `${visitor.name}が住み心地の良さに感動しています`,
                    `${visitor.name}が園の美しさに魅了されています`,
                    `${visitor.name}が居心地の良さに驚いているようです`,
                    `${visitor.name}が他の鳥たちの優しさに感謝しているようです`
                ];
                eventContent = impressions[Math.floor(Math.random() * impressions.length)];
                break;
        }
        
        if (eventContent) {
            await this.addEvent(guildId, '見学中', eventContent, relatedBirds);
            console.log(`🎪 サーバー ${guildId} で見学イベント発生: ${eventType} - ${visitor.name}`);
        }
        
    } catch (error) {
        console.error('見学イベント生成エラー:', error);
    }
}
    
    // 🆕 既存のcreateBirdInstanceメソッドを拡張
async createBirdInstanceWithMemory(birdData, area, guildId) {
    const bird = this.createBirdInstance(birdData, area);
    
    // 記憶データを適用
    const memory = await this.applyBirdMemory(bird, guildId);
    
    // 記憶がある場合は特別な活動を設定
    if (memory) {
        bird.activity = this.generateReturningBirdActivity(bird, area);
    }
    
    return bird;
}

// 🆕 戻ってきた鳥の特別な活動生成
generateReturningBirdActivity(bird, area) {
    const activities = [
        '懐かしそうに辺りを見回しています',
        'ここに戻ってこれて嬉しそうです',
        '以前の記憶を思い出しているようです',
        '前回よりもリラックスしている様子です',
        '親しみを込めて挨拶をしているようです',
        '久しぶりの場所を味わっています',
        '思い出の場所を確認して回っています'
    ];
    
    if (bird.receivedGifts && bird.receivedGifts.length > 0) {
        const giftActivities = [
            `${bird.receivedGifts[0].giver}さんからの贈り物を大切に持っています`,
            '大切な贈り物を見せびらかしているようです',
            '贈り物を他の鳥たちに自慢しているようです',
            '贈り物のおかげで自信に満ちています'
        ];
        activities.push(...giftActivities);
    }
    
    return activities[Math.floor(Math.random() * activities.length)];
}
    
    // テスト用メソッド
    forceHungry(birdName = null, guildId) {
        const now = new Date();
        const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
        const zooState = this.getZooState(guildId);
        
        let count = 0;
        
        for (const area of ['森林', '草原', '水辺']) {
            for (const bird of zooState[area]) {
                if (!birdName || bird.name.includes(birdName) || birdName.includes(bird.name)) {
                    bird.lastFed = fiveHoursAgo;
                    bird.isHungry = true;
                    bird.hungerNotified = false;
                    bird.activity = this.generateHungryActivity(area);
                    count++;
                    
                    if (birdName) break;
                }
            }
            if (birdName && count > 0) break;
        }
        
        console.log(`🧪 サーバー ${guildId} で${count}羽の鳥を強制的に空腹状態にしました`);
        return count;
    }

    async manualHungerCheck(guildId) {
        console.log(`🧪 サーバー ${guildId} で手動空腹チェックを実行...`);
        await this.checkHungerStatus(guildId);
        return this.getHungerStatistics(guildId);
    }

    getHungerStatistics(guildId) {
        const allBirds = this.getAllBirds(guildId);
        const now = new Date();
        
        const stats = {
            totalBirds: allBirds.length,
            hungryBirds: 0,
            birdDetails: []
        };
        
        for (const bird of allBirds) {
            const lastFeedTime = bird.lastFed || bird.entryTime;
            const hoursSinceLastFeed = Math.floor((now - lastFeedTime) / (1000 * 60 * 60));
            
            if (bird.isHungry) {
                stats.hungryBirds++;
            }
            
            stats.birdDetails.push({
                name: bird.name,
                area: bird.area,
                isHungry: bird.isHungry,
                hoursSinceLastFeed: hoursSinceLastFeed,
                hungerNotified: bird.hungerNotified,
                activity: bird.activity
            });
        }
        
        return stats;
    }

    // システム終了時のクリーンアップ
    async shutdown() {
        console.log('🔄 鳥類園管理システムをシャットダウン中...');
        
        // 全データを保存
        await this.saveAllServerZoos();
        
        // スケジュールタスク停止
        this.scheduledTasks.forEach(task => {
            if (task && typeof task.destroy === 'function') {
                task.destroy();
            } else if (task && typeof task.stop === 'function') {
                task.stop();
            }
        });
        
        this.scheduledTasks = [];
        console.log('✅ 鳥類園管理システムのシャットダウン完了');
    }
}

module.exports = new ZooManager();
