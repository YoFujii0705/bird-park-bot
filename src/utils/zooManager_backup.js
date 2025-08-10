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

    // 🔧 修正版: 日付オブジェクトの復元（見学鳥対応）
    restoreDates(data) {
        if (data.lastUpdate) data.lastUpdate = new Date(data.lastUpdate);
        
        // 通常の鳥の日付復元
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
        
        // 🆕 見学鳥の日付復元
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
        
        // 🆕 優先入園キューの日付復元
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
                visitors: [], // 🆕 見学鳥リスト追加
                priorityQueue: [], // 🆕 優先入園キュー追加
                lastUpdate: new Date(),
                events: [],
                isInitialized: false,
                guildId: guildId
            };
            this.serverZoos.set(guildId, newZooState);
        }
        return this.serverZoos.get(guildId);
    }

    // 全サーバーデータ保存
    async saveAllServerZoos() {
        for (const guildId of this.serverZoos.keys()) {
            await this.saveServerZoo(guildId);
        }
        console.log('🔄 全サーバーのデータを自動保存しました');
    }

    // 全鳥取得（見学鳥除外）
    getAllBirds(guildId) {
        const zooState = this.getZooState(guildId);
        return [
            ...zooState.森林,
            ...zooState.草原,
            ...zooState.水辺
        ];
    }

    // 見学鳥を含む全鳥取得
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

    // 統計情報取得
    getStatistics(guildId) {
        const allBirds = this.getAllBirds(guildId);
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

    // 平均滞在時間計算
    calculateAverageStay(birds) {
        if (birds.length === 0) return 0;
        
        const now = new Date();
        const totalStayHours = birds.reduce((sum, bird) => {
            const stayTime = now - bird.entryTime;
            return sum + (stayTime / (1000 * 60 * 60));
        }, 0);
        
        return Math.round(totalStayHours / birds.length);
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

// ===========================================
    // 見学鳥管理システム
    // ===========================================

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

    // 🆕 見学鳥のチェック（メインの処理）
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
                    
                    // 見学中のランダムイベント
                    if (Math.random() < 0.15) {
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

    // 🆕 見学鳥の退園処理
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
                `${visitor.name}が「きっとまた来ます」と約束しているかのようです💫`,
                `${visitor.name}が満足そうな表情で帰っていきました😊`
            ];
            
            const message = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];
            
            await this.addEvent(guildId, '見学終了', message, visitor.name);
            
            // 優先入園権の付与（80%の確率）
            if (Math.random() < 0.8) {
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

    // 🆕 見学中のランダムイベント生成
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
                            `${visitor.name}と${randomResident.name}が仲良く並んで休んでいます`
                        ];
                        eventContent = interactions[Math.floor(Math.random() * interactions.length)];
                        relatedBirds = `${visitor.name}, ${randomResident.name}`;
                    }
                    break;
                    
                case 'discovery':
                    const discoveries = [
                        `${visitor.name}がお気に入りの場所を見つけたようです`,
                        `${visitor.name}が興味深そうに園内を探索しています`,
                        `${visitor.name}が美しい景色に見とれています`
                    ];
                    eventContent = discoveries[Math.floor(Math.random() * discoveries.length)];
                    break;
                    
                case 'activity':
                    const activities = [
                        `${visitor.name}が楽しそうに羽を広げています`,
                        `${visitor.name}が園内の雰囲気を満喫しています`,
                        `${visitor.name}が心地よさそうに過ごしています`
                    ];
                    eventContent = activities[Math.floor(Math.random() * activities.length)];
                    break;
                    
                case 'impression':
                    const impressions = [
                        `${visitor.name}がこの園をとても気に入ったようです`,
                        `${visitor.name}が「また来たい」と思っているようです`,
                        `${visitor.name}が園の美しさに魅了されています`
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

    // 見学時間計算
    calculateVisitDuration() {
        // 30%の確率で短時間見学（1-2時間）、70%の確率で通常見学（2-4時間）
        if (Math.random() < 0.3) {
            return Math.floor(Math.random() * 2 + 1); // 1-2時間
        } else {
            return Math.floor(Math.random() * 3 + 2); // 2-4時間
        }
    }

    // 見学終了時間計算
    calculateVisitorDeparture() {
        const now = new Date();
        const duration = this.calculateVisitDuration();
        const departure = new Date(now.getTime() + duration * 60 * 60 * 1000);
        console.log(`🔍 見学時間計算: ${duration}時間 (${now} → ${departure})`);
        return departure;
    }

    // 見学鳥の活動生成
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

    // 見学イベントのスケジュール
    scheduleVisitorEvents(guildId, visitorBird) {
        const visitDurationMs = visitorBird.visitDuration * 60 * 60 * 1000;
        
        // 見学時間の1/4経過後に最初のイベント
        const firstEventDelay = Math.max(15 * 60 * 1000, visitDurationMs * 0.25);
        setTimeout(async () => {
            await this.generateVisitorEvent(guildId, visitorBird);
        }, firstEventDelay);
        
        // 見学時間の1/2経過後に2回目のイベント
        if (visitDurationMs > 60 * 60 * 1000) {
            const secondEventDelay = visitDurationMs * 0.5;
            setTimeout(async () => {
                await this.generateVisitorEvent(guildId, visitorBird);
            }, secondEventDelay);
        }
        
        console.log(`📅 ${visitorBird.name}の見学イベントをスケジュール設定完了 (見学時間: ${visitorBird.visitDuration}時間)`);
    }

// ===========================================
    // デバッグ機能とメンテナンス
    // ===========================================

    // 🆕 見学鳥の状態確認
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
                activity: visitor.activity,
                isExpired: now >= visitor.scheduledDeparture
            }))
        };
    }

    // 🆕 手動で見学鳥をチェック
    async manualVisitorCheck(guildId) {
        console.log(`🧪 サーバー ${guildId} で手動見学鳥チェックを実行...`);
        
        // まず現在の状況を記録
        const beforeStatus = this.getVisitorStatus(guildId);
        console.log(`🔍 チェック前: ${beforeStatus.totalVisitors}羽の見学鳥`);
        
        // チェック実行
        const result = await this.checkVisitorBirds(guildId);
        
        // チェック後の状況を確認
        const afterStatus = this.getVisitorStatus(guildId);
        console.log(`🔍 チェック後: ${afterStatus.totalVisitors}羽の見学鳥`);
        
        // データ保存
        await this.saveServerZoo(guildId);
        
        return {
            checkResult: result,
            beforeCount: beforeStatus.totalVisitors,
            afterCount: afterStatus.totalVisitors,
            removed: beforeStatus.totalVisitors - afterStatus.totalVisitors,
            currentStatus: afterStatus
        };
    }

    // 🆕 見学鳥の強制退園
    async forceRemoveAllVisitors(guildId) {
        const zooState = this.getZooState(guildId);
        if (!zooState.visitors) return 0;
        
        const count = zooState.visitors.length;
        console.log(`🧪 ${count}羽の見学鳥を強制退園開始...`);
        
        // 逆順で削除（インデックスのずれを防ぐため）
        for (let i = zooState.visitors.length - 1; i >= 0; i--) {
            const visitor = zooState.visitors[i];
            console.log(`🧪 強制退園: ${visitor.name} (インデックス: ${i})`);
            await this.removeVisitorBird(guildId, i);
        }
        
        // 念のため配列をクリア
        zooState.visitors = [];
        
        // データ保存
        await this.saveServerZoo(guildId);
        
        console.log(`🧪 サーバー ${guildId} の見学鳥を${count}羽強制退園完了`);
        return count;
    }

    // 🆕 見学鳥の時間延長
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

    // 🆕 期限切れ見学鳥の強制削除
    async forceRemoveExpiredVisitors(guildId) {
        const zooState = this.getZooState(guildId);
        if (!zooState.visitors) return 0;
        
        const now = new Date();
        let removedCount = 0;
        
        console.log(`🧪 期限切れ見学鳥をチェック中...`);
        
        for (let i = zooState.visitors.length - 1; i >= 0; i--) {
            const visitor = zooState.visitors[i];
            if (now >= visitor.scheduledDeparture) {
                console.log(`🧪 期限切れ発見: ${visitor.name} (予定: ${visitor.scheduledDeparture}, 現在: ${now})`);
                await this.removeVisitorBird(guildId, i);
                removedCount++;
            }
        }
        
        await this.saveServerZoo(guildId);
        console.log(`🧪 ${removedCount}羽の期限切れ見学鳥を削除完了`);
        return removedCount;
    }

    // 🆕 見学鳥データの修復
    async repairVisitorData(guildId) {
        const zooState = this.getZooState(guildId);
        let repairCount = 0;
        
        console.log(`🔧 見学鳥データの修復開始...`);
        
        if (!zooState.visitors) {
            zooState.visitors = [];
            console.log(`🔧 見学鳥配列を初期化しました`);
            repairCount++;
        }
        
        // 無効なデータをチェック・修復
        for (let i = zooState.visitors.length - 1; i >= 0; i--) {
            const visitor = zooState.visitors[i];
            
            // 必須データが欠けている場合は削除
            if (!visitor.name || !visitor.scheduledDeparture || !visitor.entryTime) {
                console.log(`🔧 無効な見学鳥データを削除: ${visitor.name || 'Unknown'}`);
                zooState.visitors.splice(i, 1);
                repairCount++;
                continue;
            }
            
            // 日付オブジェクトが文字列になっている場合は修復
            if (typeof visitor.scheduledDeparture === 'string') {
                visitor.scheduledDeparture = new Date(visitor.scheduledDeparture);
                console.log(`🔧 ${visitor.name}の退園予定時刻を修復`);
                repairCount++;
            }
            
            if (typeof visitor.entryTime === 'string') {
                visitor.entryTime = new Date(visitor.entryTime);
                console.log(`🔧 ${visitor.name}の入園時刻を修復`);
                repairCount++;
            }
        }
        
        await this.saveServerZoo(guildId);
        console.log(`🔧 見学鳥データの修復完了 (${repairCount}項目修復)`);
        return repairCount;
    }

    // 🆕 完全診断とメンテナンス
    async fullMaintenanceCheck(guildId) {
        console.log(`🔧 サーバー ${guildId} の完全メンテナンス開始...`);
        
        const results = {
            repaired: 0,
            expired: 0,
            errors: []
        };
        
        try {
            // 1. データ修復
            results.repaired = await this.repairVisitorData(guildId);
            
            // 2. 期限切れチェック
            results.expired = await this.forceRemoveExpiredVisitors(guildId);
            
            // 3. 手動チェック実行
            const checkResult = await this.manualVisitorCheck(guildId);
            results.manualCheck = checkResult;
            
            console.log(`🔧 完全メンテナンス完了:`, results);
            
        } catch (error) {
            console.error(`🔧 メンテナンス中にエラー:`, error);
            results.errors.push(error.message);
        }
        
        return results;
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

// ===========================================
    // 自動管理システム
    // ===========================================

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

    // 🔧 修正版: 鳥の移動チェック（見学鳥チェック付き）
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

            // 通常の鳥の退園チェック
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
                
                // 空きがあれば新しい鳥を追加
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

    // ===========================================
    // 鳥の基本管理機能
    // ===========================================

    // サーバー別初期化
    async initializeServer(guildId) {
        let zooState = await this.loadServerZoo(guildId);
        
        if (!zooState) {
            zooState = this.getZooState(guildId);
        }
        
        if (zooState.isInitialized) return;
        
        console.log(`🏞️ サーバー ${guildId} の鳥類園を初期化中...`);
        
        try {
            await this.populateAllAreas(guildId);
            zooState.isInitialized = true;
            
            console.log(`✅ サーバー ${guildId} の鳥類園初期化完了`);
            
            await this.addEvent(guildId, 'システム', 'この鳥類園が開園しました！', '');
            await this.saveServerZoo(guildId);
            
        } catch (error) {
            console.error(`❌ サーバー ${guildId} の鳥類園初期化エラー:`, error);
            throw error;
        }
    }

    // 全エリア鳥配置
    async populateAllAreas(guildId) {
        const zooState = this.getZooState(guildId);
        const areas = ['森林', '草原', '水辺'];
        
        for (const area of areas) {
            zooState[area] = await this.populateArea(area, 5, guildId);
            console.log(`✅ サーバー ${guildId} - ${area}エリア: ${zooState[area].length}羽配置完了`);
        }
        
        zooState.lastUpdate = new Date();
    }

    // エリア別鳥配置
    async populateArea(area, targetCount, guildId = null) {
        const suitableBirds = birdData.getBirdsForZooArea(area);
        
        if (suitableBirds.length === 0) {
            console.warn(`⚠️ ${area}エリアに適した鳥が見つかりません`);
            return [];
        }

        // 既存の鳥をチェック
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

    // 鳥インスタンス作成
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

    // 出発時間計算
    calculateDepartureTime() {
        const minDays = 2;
        const maxDays = 5;
        const daysToStay = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
        
        const departureTime = new Date();
        departureTime.setDate(departureTime.getDate() + daysToStay);
        
        return departureTime;
    }

    // 鳥の退園処理
    async removeBird(guildId, area, index) {
        const zooState = this.getZooState(guildId);
        const bird = zooState[area][index];
        
        // 記憶データを保存（シンプル版）
        await this.saveBirdMemory(bird, area, guildId);
        
        zooState[area].splice(index, 1);
        
        // 退園した鳥を記録
        this.addRecentlyLeftBird(guildId, bird.name);
        
        await logger.logZoo('退園', area, bird.name, '', '', guildId);
        
        let departureMessage = `${bird.name}が旅立っていきました。また会える日まで...👋`;
        
        await this.addEvent(guildId, 'お別れ', departureMessage, bird.name);
    }

    // 新しい鳥をエリアに追加
    async addNewBirdToArea(guildId, area) {
        const zooState = this.getZooState(guildId);
        
        // 優先キューをチェック
        if (zooState.priorityQueue && zooState.priorityQueue.length > 0) {
            const priorityBird = zooState.priorityQueue.shift();
            
            const birdDataManager = require('./birdData');
            const birdDataAll = birdDataManager.getAllBirds();
            const targetBird = birdDataAll.find(b => b.名前 === priorityBird.birdName);
            
            if (targetBird) {
                await this.removeVisitorIfExists(guildId, targetBird.名前);
                
                const birdInstance = this.createBirdInstance(targetBird, area);
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
        
        // 通常の新鳥追加
        const newBirds = await this.populateArea(area, 1, guildId);
        
        if (newBirds.length > 0) {
            zooState[area].push(newBirds[0]);
            
            await logger.logZoo('入園', area, newBirds[0].name, '', '', guildId);
            
            await this.addEvent(
                guildId,
                '新入り',
                `${newBirds[0].name}が新しく${area}エリアに仲間入りしました！🎉`,
                newBirds[0].name
            );
        }
    }

    // 見学中の同じ鳥を削除
    async removeVisitorIfExists(guildId, birdName) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.visitors) return false;
            
            const visitorIndex = zooState.visitors.findIndex(visitor => visitor.name === birdName);
            
            if (visitorIndex !== -1) {
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

    // 最近退園した鳥のリスト取得
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

    // ===========================================
    // その他のヘルパー機能
    // ===========================================

    // 記憶保存（シンプル版）
    async saveBirdMemory(bird, area, guildId) {
        console.log(`💾 ${bird.name}の記憶データ保存をスキップ（Sheetsマネージャー未設定）`);
    }

    // 活動生成
    generateActivity(area) {
        const activities = {
            '森林': ['木の枝で休んでいます', '木の実を探しています', '美しい声でさえずっています',
                '羽繕いをしています', '枝から枝へ飛び移っています', '虫を捕まえています',
                '巣の材料を集めています', '木陰で涼んでいます', '葉っぱと戯れています',
                '高い枝の上で見張りをしています','木の幹をコツコツと叩いて音を楽しんでいます',
                '新緑の香りを楽しんでいるようです','森の奥深くから美しいメロディを奏でています',
                  'こけに覆われた枝で羽を休めています','落ち葉を掻き分けて何かを探しています',
                  '樹液の匂いに誘われてやってきました','木漏れ日の中で美しく羽ばたいています',
                  '苔むした岩の上で瞑想しているようです','森の深い静寂に耳を澄ませています',
                  '古い切り株を興味深そうに調べています','蜘蛛の巣に付いた露を眺めています',
                  '木の洞を覗き込んで探索しています','倒木を足場にして森を見渡しています'],
            '草原': ['草地を歩き回っています', '種を探しています', '気持ちよさそうに日向ぼっこしています',
                '他の鳥と遊んでいます', '風に羽を広げています', '地面で餌を探しています',
                'のんびりと過ごしています', '花の蜜を吸っています', '芝生の上を転がっています',
                '青空を見上げています','蝶を追いかけて遊んでいます','草花の種を器用に選り分けています',
                '仲間と一緒に草原を散歩しています','風に舞う花粉を追いかけています','背の高い草に隠れてかくれんぼをしています',
                  '丘の頂上で風を感じています','野花の間を縫うように歩いています','温かい土の上で砂浴びを楽しんでいます',
                  '朝露に濡れた草葉を歩いています','広い空を見上げて飛び立つタイミングを計っています',
                  'タンポポの綿毛を羽で飛ばして遊んでいます','草原の小道をのんびりと散策しています','遠くの山並みを眺めて思いにふけっています'],
            '水辺': ['水面に映る自分を見ています', '魚を狙っています', '水浴びを楽しんでいます',
                '水辺を静かに歩いています', '小さな波と戯れています', '羽を乾かしています',
                '水草の間を優雅に泳ぎ回っています', '石の上で休んでいます', '水面をそっと歩いています',
                '水面に落ちた葉っぱで遊んでいます','自分の影を水面で確認しています',
                '小さな渦を作って楽しんでいます','水滴を羽で弾いて遊んでいます','岸辺の砂利を脚で探っています',
                  '浅瀬でぱちゃぱちゃと水遊びしています','水辺の葦の影で涼んでいます','自分の羽に水滴を付けて輝かせています',
                  '流れに身を任せて気持ちよさそうです','水面に映る雲を不思議そうに見つめています','小さな貝殻を見つけてつついています',
                  '川底の小石を羽で動かして遊んでいます']
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
                '枝の上で小さくお腹を鳴らしています',
                'お腹を鳴らしながら木の根元を掘り返しています',
                '樹皮の隙間になにかないか必死に探しています',
                '他の鳥の食事を羨ましそうに見つめています',
                '空腹で普段より低い声で鳴いています',
                '木の実の殻だけでも食べられないか調べています',
                'お腹が空いて羽を小刻みに震わせています',
                '落ち葉の下に何か食べ物がないか探り続けています',
                '空腹で木の枝にとまる力も弱くなっています'
            ],
            '草原': [
                '地面をつついて何か食べ物を探しています',
                'お腹を空かせてそわそわしています',
                '餌を求めて草むらを探しています',
                '空腹で少し疲れているようです',
                'お腹がぺこぺこで羽を垂らして歩いています',
                '種を探して地面を夢中で掘っています',
                '空腹で少しふらつきながら歩いています',
                'お腹を空かせて小さく鳴き続けています',
                '空腹で草の根っこまで掘り起こしています',
                'お腹を空かせて地面に耳を当てています',
                '種の殻だけでも拾い集めています',
                '空腹でいつもより頻繁に首を振っています',
                '茎をくちばしでつついて汁を吸おうとしています',
                'お腹が鳴る度に小さく震えています',
                '他の鳥が残した食べかすを探しています',
                '空腹でゆっくりと歩いています'
            ],
            '水辺': [
                '水面を見つめて魚を探しています',
                'お腹を空かせて水辺をうろうろしています',
                '餌を求めて浅瀬を歩き回っています',
                '空腹で羽を垂らしています',
                'お腹を空かせて水面をじっと見つめています',
                '空腹で普段より低い位置で泳いでいます',
                '魚の気配を必死に探っています',
                'お腹が空いて水辺をとぼとぼ歩いています',
                '水の中の小さな虫も見逃さないよう集中しています',
                'お腹を空かせて水面に顔を近づけて探っています',
                '普段食べない水草も口にしてみています',
                '空腹で水に映る魚の影も追いかけています',
                '岸辺の泥の中になにかいないか探しています',
                'お腹が空いて水面を歩く歩幅が小さくなっています',
                '他の水鳥が食べているものを真似しようとしています',
                '空腹で水面を叩いて何か出てこないか試しています'
            ]
        };

        const activities = hungryActivities[area] || hungryActivities['森林'];
        return activities[Math.floor(Math.random() * activities.length)];
    }

    getRandomMood() {
        const moods = ['happy', 'normal', 'sleepy', 'excited', 'calm'];
        return moods[Math.floor(Math.random() * moods.length)];
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
            `${bird1.name}と${bird2.name}が互いの存在に安らぎを感じているようです`,
            `${bird1.name}と${bird2.name}が羽の美しさを競い合っています`,
            `${bird1.name}が${bird2.name}に新しい鳴き方を教えています`,
            `${bird1.name}と${bird2.name}が並んで夢の話をしているようです`,
            `${bird1.name}と${bird2.name}が互いの好きな食べ物について話し合っています`,
            `${bird1.name}が${bird2.name}と一緒にダンスを踊っています`,
            `${bird1.name}と${bird2.name}が翼を広げて大きさを比べています`,
            `${bird1.name}と${bird2.name}が互いの巣作りの技術を披露しています`,
            `${bird1.name}が${bird2.name}と静かに寄り添って休んでいます`,
            `${bird1.name}と${bird2.name}が競争しながら餌を探しています`,
            `${bird1.name}と${bird2.name}が夕暮れ時の思い出を語り合っています`
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
            `${bird.name}が珍しい形の雲を指差して興奮しています`,
            `${bird.name}が珍しい色の小石を見つけて喜んでいます`,
            `${bird.name}が古い鳥の巣跡を発見しました`,
            `${bird.name}が風で飛んできた種を興味深そうに調べています`,
            `${bird.name}が自分だけの秘密の水飲み場を見つけたようです`,
            `${bird.name}が珍しい形の枝を巣の材料として選んでいます`,
            `${bird.name}が光る虫を見つけて目を輝かせています`,
            `${bird.name}が池に落ちた花びらを美しそうに眺めています`,
            `${bird.name}が見たことのない蝶を発見して追いかけています`,
            `${bird.name}が特別な香りのする花を見つけました`,
            `${bird.name}が自分の影と遊んでいるようです`
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
            `${bird.name}が雨上がりの新鮮な空気を深く吸い込んでいます`,
            `雨粒が羽に当たる感触を、${bird.name}が楽しんでいます`,
            `霧の中を${bird.name}が神秘的にゆっくりと歩いています`,
            `陽だまりで${bird.name}が幸せそうに羽を温めています`,
            `強い風に${bird.name}が羽を広げて自然の力を感じています`,
            `雪が積もった枝で${bird.name}が雪玉を作って遊んでいます`,
            `黄金の光に照らされて、${bird.name}の羽が輝いています`,
            `小雨の中で${bird.name}が雨音のリズムに合わせて踊っています`,
            `曇り空の下で${bird.name}が静かに瞑想しています`,
            `暖かい風に${bird.name}が羽を震わせて喜んでいます`,
            `雨上がりの虹を${bird.name}が見つめて感動しているようです`
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
            `${bird.name}が感謝の気持ちを込めて美しく舞い踊っています`,
            `${bird.name}が訪問者のために特別な羽ばたきパフォーマンスを披露しています`,
            `${bird.name}が今まで見せたことのない優雅な着地を決めました`,
            `${bird.name}が記念日を祝うかのように華麗に舞っています`,
            `${bird.name}が特別な日の贈り物として美しい羽根を落としました`,
            `${bird.name}が訪問者との絆を感じて特別な鳴き声で応えています`,
            `${bird.name}が感謝の気持ちを羽の動きで表現しています`,
            `${bird.name}が普段は見せない特別な表情を浮かべています`,
            `${bird.name}が記念撮影のポーズを取ってあげているようです`,
            `${bird.name}が特別な日だからと羽を特別美しく整えてくれています`,
            `${bird.name}が訪問者だけのために秘密の隠れ場所を案内してくれました`
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
        `${bird.name}が枝の上で器用にバランスを取りながら眠っています`,
        `${bird.name}が羽を膨らませて暖かく眠っています`,
        `${bird.name}が片足立ちで器用にバランスを取りながら眠っています`,
        `${bird.name}が仲間の体温を感じながら安心して眠っています`,
        `${bird.name}が風に揺れる枝の上でも落ちずに眠り続けています`,
        `${bird.name}が小さくくちばしを羽の中に埋めて眠っています`,
        `${bird.name}が夜露に濡れないよう葉の下で眠っています`,
        `${bird.name}が朝まで安全な場所でぐっすりと眠っています`,
        `${bird.name}が静かな夜の中で規則正しい寝息を立てています`,
        `${bird.name}が暖かい巣の中で丸くなって眠っています`,
        `${bird.name}が星明かりの下で穏やかな表情で眠っています`
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
        `${bird.name}が美味しい夢を見て満足そうな表情を浮かべています`,
        `${bird.name}が夢の中で仲間と遊んでいるのか、嬉しそうな表情をしています`,
        `${bird.name}が幸せそうな夢を見て、小さく笑っているようです`,
        `${bird.name}が夢の中で歌を歌っているのか、くちばしを小さく動かしています`,
        `${bird.name}が夢の中で温かい巣にいるのか、嬉しそうに羽を震わせています`,
        `${bird.name}が楽しい夢を見て小さく羽ばたく真似をしています`,
        `${bird.name}が夢の中で友達と出会っているのか、嬉しそうです`
        
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
        `${bird.name}が夜の美しさに見とれているようです`,
        `${bird.name}が夜の鳥類園を静かに見守っています`,
        `${bird.name}が月の位置を確認しながら時を過ごしています`,
        `${bird.name}が夜風の音に耳を傾けて過ごしています`,
        `${bird.name}が星座の並びを眺めながら夜警を続けています`,
        `${bird.name}が夜の香りを嗅ぎながら辺りの様子を伺っています`,
        `${bird.name}が月光に照らされた羽を美しく輝かせながら佇んでいます`,
        `${bird.name}が夜の静けさの中で瞑想するように過ごしています`,
        `${bird.name}が遠くの街明かりを眺めています`,
        `${bird.name}が夜露が降りる前に羽の手入れをしています`,
        `${bird.name}が夜明け前の特別な空気を楽しんでいます`
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
        `${bird.name}が夜の森の番人として佇んでいます`,
        `${bird.name}が夜の世界で本領を発揮して活動しています`,
        `${bird.name}が暗闇を縫って静かに移動しています`,
        `${bird.name}が夜の獲物の気配を鋭く察知しています`,
        `${bird.name}が月明かりを利用して狩りをしています`,
        `${bird.name}が夜の森の音を全て聞き分けているようです`,
        `${bird.name}が完全な静寂の中を音もなく飛び回っています`,
        `${bird.name}が夜の王者としての威厳を示しています`,
        `${bird.name}が暗闇の中で獲物を待ち伏せています`,
        `${bird.name}が夜の冷たい空気を羽で感じながら活動しています`
        
    ];

    return {
        type: '夜行性の活動',
        content: nocturnalEvents[Math.floor(Math.random() * nocturnalEvents.length)],
        relatedBird: bird.name
    };
}


    // 夜間判定
    isSleepTime() {
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        const hour = jstTime.getHours();
        return hour >= 22 || hour < 7;
    }

    // イベント追加
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

    // 活動更新
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
                                `${bird.name}がお腹を空かせているようです！🍽️ \`/feed bird:${bird.name} food:[餌の種類]\` でごはんをあげてみましょう`,
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

    // ランダムイベント生成
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
}

module.exports = new ZooManager();
