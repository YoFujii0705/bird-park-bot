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
                `${visitor.name}が「きっとまた来ます」と約束しているようです💫`,
                `${visitor.name}が満足そうな表情で帰っていきました😊`
            ];
            
            const message = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];
            
            await this.addEvent(guildId, '見学終了', message, visitor.name);
            
            // 優先入園権の付与（70%の確率）
            if (Math.random() < 0.7) {
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
            '森林': ['木の枝で休んでいます', '木の実を探しています', '美しい声でさえずっています'],
            '草原': ['草地を歩き回っています', '種を探しています', '気持ちよさそうに日向ぼっこしています'],
            '水辺': ['水面に映る自分を見ています', '魚を狙っています', '水浴びを楽しんでいます']
        };

        const areaActivities = activities[area] || activities['森林'];
        return areaActivities[Math.floor(Math.random() * areaActivities.length)];
    }

    getRandomMood() {
        const moods = ['happy', 'normal', 'sleepy', 'excited', 'calm'];
        return moods[Math.floor(Math.random() * moods.length)];
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

    // 空腹チェック
    async checkHungerStatus(guildId) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.isInitialized || this.isSleepTime()) return;
            
            // 簡略化した空腹チェック
            console.log(`🍽️ サーバー ${guildId} の空腹チェック実行`);
            
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

            // 簡単なランダムイベント
            const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
            await this.addEvent(guildId, '日常', `${bird.name}が楽しそうに過ごしています`, bird.name);

        } catch (error) {
            console.error(`サーバー ${guildId} のランダムイベント生成エラー:`, error);
        }
    }
}

module.exports = new ZooManager();
