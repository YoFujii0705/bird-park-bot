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
        
        if (data.events) {
            data.events.forEach(event => {
                if (event.timestamp) event.timestamp = new Date(event.timestamp);
            });
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

    // サーバー別鳥移動チェック
    async checkBirdMigration(guildId) {
        if (this.isProcessing) return;
        
        const zooState = this.getZooState(guildId);
        if (!zooState.isInitialized) return;

        try {
            const now = new Date();
            let migrationOccurred = false;

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

 async removeBird(guildId, area, index) {
    const zooState = this.getZooState(guildId);
    const bird = zooState[area][index];
    zooState[area].splice(index, 1);
    
    // 退園した鳥を記録 ← 追加
    this.addRecentlyLeftBird(guildId, bird.name);
    
    await logger.logZoo('退園', area, bird.name, '', '', guildId);
    
    await this.addEvent(
        guildId,
        'お別れ',
        `${bird.name}が旅立っていきました。また会える日まで...👋`,
        bird.name
    );
}

    // サーバー別新鳥追加
async addNewBirdToArea(guildId, area) {
    const newBirds = await this.populateArea(area, 1, guildId); // ← guildIdを渡す
    
    if (newBirds.length > 0) {
        const zooState = this.getZooState(guildId);
        zooState[area].push(newBirds[0]);
        
        await logger.logZoo('入園', area, newBirds[0].name, '', '', guildId);
        
        await this.addEvent(
            guildId,
            '新入り',
            `${newBirds[0].name}が新しく${area}エリアに仲間入りしました！🎉`,
            newBirds[0].name
        );
    } else {
        console.warn(`⚠️ サーバー ${guildId} の ${area}エリアに追加できる新しい鳥が見つかりません`);
    }
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

    // サーバー別全鳥取得
    getAllBirds(guildId) {
        const zooState = this.getZooState(guildId);
        return [
            ...zooState.森林,
            ...zooState.草原,
            ...zooState.水辺
        ];
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
            `${bird.name}が珍しい形の雲を指差して興奮しています`
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
            `朝霧の中を${bird.name}が幻想的に舞っています`,
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

    // 統計情報取得（サーバー別）
    getStatistics(guildId) {
        const allBirds = this.getAllBirds(guildId);
        const zooState = this.getZooState(guildId);
        
        return {
            totalBirds: allBirds.length,
            areaDistribution: {
                森林: zooState.森林.length,
                草原: zooState.草原.length,
                水辺: zooState.水辺.length
            },
            averageStay: this.calculateAverageStay(allBirds),
            hungryBirds: allBirds.filter(b => b.isHungry).length,
            recentEvents: zooState.events.slice(-5),
            lastUpdate: zooState.lastUpdate
        };
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
