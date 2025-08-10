const birdData = require('./birdData');
const logger = require('./logger');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const LunarPhase = require('lunarphase-js'); // 🆕 月齢ライブラリ

// 🔧 コンストラクタの修正部分（既存のコンストラクタに追加）
class ZooManager {
    constructor() {
        // 既存のコンストラクタ内容...
        this.serverZoos = new Map();
        this.recentlyLeftBirds = new Map();
        this.isInitialized = false;
        this.isProcessing = false;
        this.scheduledTasks = [];
        this.dataPath = './data/zoos/';
        
        // 🆕 Phase 1で必要な依存関係（安全に初期化）
        this.weatherManager = this.safeRequire('./weatherManager');
        this.sheetsManager = this.safeRequire('./sheetsManager');
        
        // 🆕 時間帯定義（JST基準）
        this.timeSlots = {
            dawn: { start: 5, end: 7, name: '早朝', emoji: '🌅' },
            morning: { start: 7, end: 11, name: '朝', emoji: '🌄' },
            noon: { start: 11, end: 15, name: '昼', emoji: '🏞️' },
            evening: { start: 15, end: 19, name: '夕', emoji: '🌇' },
            night: { start: 19, end: 22, name: '夜', emoji: '🌃' },
            sleep: { start: 22, end: 5, name: '就寝時間', emoji: '🌙' }
        };

        // 🆕 月齢定義
        this.moonPhases = {
            'New': { name: '新月', emoji: '🌑' },
            'Waxing Crescent': { name: '三日月', emoji: '🌒' },
            'First Quarter': { name: '上弦の月', emoji: '🌓' },
            'Waxing Gibbous': { name: '十三夜月', emoji: '🌔' },
            'Full': { name: '満月', emoji: '🌕' },
            'Waning Gibbous': { name: '寝待月', emoji: '🌖' },
            'Last Quarter': { name: '下弦の月', emoji: '🌗' },
            'Waning Crescent': { name: '二十六夜月', emoji: '🌘' }
        };

        // 🆕 記念日定義
        this.specialDays = {
            '1-1': { name: '元日', emoji: '🎍', message: '新年の特別な日' },
            '1-2': { name: '初夢の日', emoji: '💭', message: '初夢を見る特別な日' },
            '2-3': { name: '節分', emoji: '👹', message: '邪気を払う日' },
            '2-14': { name: 'バレンタインデー', emoji: '💝', message: '愛を伝える日' },
            '3-3': { name: 'ひな祭り', emoji: '🎎', message: '女の子の健やかな成長を願う日' },
            '3-21': { name: '春分の日', emoji: '🌸', message: '昼と夜の長さが等しくなる日' },
            '4-1': { name: 'エイプリルフール', emoji: '🃏', message: 'いたずらな気分の日' },
            '4-29': { name: '昭和の日', emoji: '🌿', message: '自然に親しむ日' },
            '5-5': { name: 'こどもの日', emoji: '🎏', message: '子供の健やかな成長を願う日' },
            '5-10': { name: '愛鳥週間開始', emoji: '🐦', message: '鳥たちを大切にする週間の始まり' },
            '7-7': { name: '七夕', emoji: '🎋', message: '願いが叶う特別な夜' },
            '8-11': { name: '山の日', emoji: '⛰️', message: '山に親しむ日' },
            '9-23': { name: '秋分の日', emoji: '🍂', message: '秋の深まりを感じる日' },
            '10-31': { name: 'ハロウィン', emoji: '🎃', message: '魔法にかかった特別な夜' },
            '11-15': { name: '七五三', emoji: '👘', message: '成長を祝う日' },
            '12-25': { name: 'クリスマス', emoji: '🎄', message: '聖なる夜' },
            '12-31': { name: '大晦日', emoji: '🎆', message: '一年を締めくくる特別な日' }
        };

        // 🆕 通過する可能性がある鳥のデータ
        this.migratoryBirds = [
            // 渡り鳥
            { name: 'ツバメ', type: 'migratory', description: '春の訪れを告げる' },
            { name: 'ハクチョウ', type: 'migratory', description: '優雅に空を舞う' },
            { name: 'ガン', type: 'migratory', description: 'V字編隊で飛ぶ' },
            { name: 'ツル', type: 'migratory', description: '美しい鳴き声を響かせながら' },
            { name: 'チョウゲンボウ', type: 'migratory', description: '鋭い眼光で下を見つめながら' },
            { name: 'ヒバリ', type: 'migratory', description: '高らかに歌いながら' },
            { name: 'ムクドリ', type: 'flock', description: '大群で空を埋め尽くしながら' },
            { name: 'カラス', type: 'flock', description: '賢そうな様子で' },
            { name: 'スズメ', type: 'flock', description: 'にぎやかにさえずりながら' },
            { name: 'ヒヨドリ', type: 'flock', description: '活発に動き回りながら' },
            // 季節限定
            { name: 'アマツバメ', type: 'migratory', season: 'summer', description: '夏空を縦横無尽に駆け抜けながら' },
            { name: 'オオハクチョウ', type: 'migratory', season: 'winter', description: '厳かな姿で' },
            { name: 'マガン', type: 'migratory', season: 'autumn', description: '秋空に響く鳴き声と共に' },
            { name: 'ナベヅル', type: 'migratory', season: 'winter', description: '威厳ある姿で' }
        ];

        this.ensureDataDirectory();
    }

// 🆕 安全なrequire（モジュールが存在しない場合はnullを返す）
    safeRequire(modulePath) {
        try {
            return require(modulePath);
        } catch (error) {
            console.warn(`⚠️ モジュール ${modulePath} が見つかりません。一部機能が制限されます。`);
            return null;
        }
    }

    // 🆕 月齢ライブラリの安全な読み込み
    safeRequireLunarPhase() {
        try {
            return require('lunarphase-js');
        } catch (error) {
            console.warn('⚠️ lunarphase-js が見つかりません。簡易月齢計算を使用します。');
            return null;
        }
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
    // 🆕 Phase 1: 基本機能 - 時間・月齢・季節取得
    // ===========================================

    /**
     * 現在の時間帯を取得（JST基準）
     */
    getCurrentTimeSlot() {
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        const hour = jstTime.getHours();
        
        console.log(`🕐 現在時刻(JST): ${jstTime.getHours()}:${jstTime.getMinutes().toString().padStart(2, '0')}`);
        
        for (const [key, slot] of Object.entries(this.timeSlots)) {
            if (key === 'sleep') {
                if (hour >= slot.start || hour < slot.end) {
                    console.log(`⏰ 判定結果: ${slot.name} (${slot.start}:00-${slot.end}:00)`);
                    return { key, ...slot };
                }
            } else {
                if (hour >= slot.start && hour < slot.end) {
                    console.log(`⏰ 判定結果: ${slot.name} (${slot.start}:00-${slot.end}:00)`);
                    return { key, ...slot };
                }
            }
        }
        
        console.log(`⚠️ 時間帯判定失敗: ${hour}時`);
        return { key: 'unknown', start: 0, end: 24, name: '不明', emoji: '❓' };
    }

    /**
     * 現在の月齢を取得
     */
    getCurrentMoonPhase() {
        const LunarPhase = this.safeRequireLunarPhase();
        
        if (LunarPhase) {
            try {
                const today = new Date();
                const lunarPhase = LunarPhase.Moon.lunarPhase(today);
                const phaseName = LunarPhase.Moon.lunarPhaseEmoji(today, {
                    'New': 'New',
                    'Waxing Crescent': 'Waxing Crescent', 
                    'First Quarter': 'First Quarter',
                    'Waxing Gibbous': 'Waxing Gibbous',
                    'Full': 'Full',
                    'Waning Gibbous': 'Waning Gibbous',
                    'Last Quarter': 'Last Quarter',
                    'Waning Crescent': 'Waning Crescent'
                });
                
                const moonInfo = this.moonPhases[phaseName] || this.moonPhases['New'];
                
                console.log(`🌙 月齢(ライブラリ): ${moonInfo.name} (${phaseName})`);
                
                return {
                    key: phaseName.replace(' ', '_').toLowerCase(),
                    englishName: phaseName,
                    ...moonInfo,
                    lunarAge: lunarPhase,
                    source: 'library'
                };
                
            } catch (error) {
                console.error('月齢ライブラリエラー:', error);
            }
        }
        
        // フォールバック: 簡易計算
        return this.getSimpleMoonPhase();
    }

    /**
     * 簡易月齢計算（フォールバック用）
     */
    getSimpleMoonPhase() {
        const now = new Date();
        const knownNewMoon = new Date('2024-01-11');
        const daysDiff = Math.floor((now - knownNewMoon) / (1000 * 60 * 60 * 24));
        const moonCycle = 29.53;
        const phase = (daysDiff % moonCycle) / moonCycle;
        
        let moonPhase;
        if (phase < 0.125 || phase >= 0.875) {
            moonPhase = { key: 'new', englishName: 'New', ...this.moonPhases['New'] };
        } else if (phase >= 0.125 && phase < 0.25) {
            moonPhase = { key: 'waxing_crescent', englishName: 'Waxing Crescent', ...this.moonPhases['Waxing Crescent'] };
        } else if (phase >= 0.25 && phase < 0.375) {
            moonPhase = { key: 'first_quarter', englishName: 'First Quarter', ...this.moonPhases['First Quarter'] };
        } else if (phase >= 0.375 && phase < 0.625) {
            moonPhase = { key: 'full', englishName: 'Full', ...this.moonPhases['Full'] };
        } else if (phase >= 0.625 && phase < 0.75) {
            moonPhase = { key: 'waning_gibbous', englishName: 'Waning Gibbous', ...this.moonPhases['Waning Gibbous'] };
        } else {
            moonPhase = { key: 'waning_crescent', englishName: 'Waning Crescent', ...this.moonPhases['Waning Crescent'] };
        }
        
        moonPhase.source = 'simple_calculation';
        console.log(`🌙 月齢(簡易計算): ${moonPhase.name}`);
        return moonPhase;
    }

    /**
     * 現在の季節情報を取得（月別詳細）
     */
    getCurrentSeason() {
        const now = new Date();
        const month = now.getMonth() + 1;
        
        const seasonDetails = {
            1: { season: '冬', detail: '厳冬', emoji: '❄️', description: '寒さが最も厳しい時期' },
            2: { season: '冬', detail: '晩冬', emoji: '🌨️', description: '春の気配を感じ始める時期' },
            3: { season: '春', detail: '早春', emoji: '🌸', description: '桜が咲き始める美しい時期' },
            4: { season: '春', detail: '盛春', emoji: '🌺', description: '花々が満開となる華やかな時期' },
            5: { season: '春', detail: '晩春', emoji: '🌿', description: '新緑が美しく輝く時期' },
            6: { season: '夏', detail: '初夏', emoji: '☀️', description: '爽やかな風が心地よい時期' },
            7: { season: '夏', detail: '盛夏', emoji: '🌞', description: '暑さが最も厳しい時期' },
            8: { season: '夏', detail: '晩夏', emoji: '🌻', description: '夏の終わりを感じる時期' },
            9: { season: '秋', detail: '初秋', emoji: '🍂', description: '涼しい風が心地よい時期' },
            10: { season: '秋', detail: '中秋', emoji: '🍁', description: '紅葉が美しく色づく時期' },
            11: { season: '秋', detail: '晩秋', emoji: '🥀', description: '落ち葉が舞い散る時期' },
            12: { season: '冬', detail: '初冬', emoji: '🌨️', description: '寒さが増してくる時期' }
        };
        
        const seasonInfo = seasonDetails[month];
        console.log(`🍂 季節: ${seasonInfo.detail} (${seasonInfo.season})`);
        
        return seasonInfo;
    }

    /**
     * 特別な日（記念日）を取得
     */
    getSpecialDay() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const dayKey = `${month}-${day}`;
        
        const specialDay = this.specialDays[dayKey] || null;
        
        if (specialDay) {
            console.log(`🎉 今日は特別な日: ${specialDay.name}`);
        } else {
            console.log(`📅 今日は通常の日です (${month}/${day})`);
        }
        
        return specialDay;
    }

    // ===========================================
    // 🆕 Phase 1: 夜行性チェック機能
    // ===========================================

    /**
     * 鳥が夜行性かどうかをチェック
     */
    async isNocturnalBird(birdName) {
        try {
            console.log(`🔍 夜行性チェック開始: ${birdName}`);
            
            // SheetsManagerが利用可能な場合のみシートをチェック
            if (this.sheetsManager) {
                const birds = await this.sheetsManager.getBirds();
                const bird = birds.find(b => b.名前 === birdName);
                
                if (bird && bird.夜行性) {
                    const isNocturnal = bird.夜行性 === 'TRUE' || bird.夜行性 === '1' || bird.夜行性 === 'はい';
                    console.log(`🔍 Sheets判定: ${birdName} -> ${isNocturnal ? '夜行性' : '昼行性'} (値: ${bird.夜行性})`);
                    return isNocturnal;
                }
                
                console.log(`⚠️ Sheetsにデータがない、フォールバック判定: ${birdName}`);
            } else {
                console.log(`⚠️ SheetsManager利用不可、フォールバック判定: ${birdName}`);
            }
            
            // フォールバック: コード内判定
            const nocturnalKeywords = [
                'フクロウ', 'みみずく', 'コノハズク', 'アオバズク', 
                'ヨタカ', 'ゴイサギ', 'トラフズク', 'コミミズク', 'シマフクロウ'
            ];
            
            const isNocturnalFallback = nocturnalKeywords.some(keyword => birdName.includes(keyword));
            console.log(`🔍 フォールバック判定: ${birdName} -> ${isNocturnalFallback ? '夜行性' : '昼行性'}`);
            
            return isNocturnalFallback;
            
        } catch (error) {
            console.error(`❌ 夜行性チェックエラー (${birdName}):`, error);
            
            // エラー時はフォールバック判定のみ
            const nocturnalKeywords = [
                'フクロウ', 'みみずく', 'コノハズク', 'アオバズク', 
                'ヨタカ', 'ゴイサギ', 'トラフズク', 'コミミズク', 'シマフクロウ'
            ];
            
            const isNocturnalFallback = nocturnalKeywords.some(keyword => birdName.includes(keyword));
            console.log(`🔍 エラー時フォールバック: ${birdName} -> ${isNocturnalFallback ? '夜行性' : '昼行性'}`);
            
            return isNocturnalFallback;
        }
    }

    /**
     * 夜行性の鳥がいるかチェック
     */
    async hasNocturnalBirds(allBirds) {
        for (const bird of allBirds) {
            if (await this.isNocturnalBird(bird.name)) {
                console.log(`🦉 夜行性の鳥発見: ${bird.name}`);
                return true;
            }
        }
        console.log(`🌅 夜行性の鳥はいません`);
        return false;
    }

    // ===========================================
    // 🆕 Phase 1: 長期滞在チェック機能
    // ===========================================

    /**
     * 長期滞在の鳥を取得（7日以上滞在）
     */
    getLongStayBirds(guildId) {
        const allBirds = this.getAllBirds(guildId);
        const now = new Date();
        const longStayThreshold = 7 * 24 * 60 * 60 * 1000; // 7日
        
        const longStayBirds = allBirds.filter(bird => {
            const stayDuration = now - bird.entryTime;
            return stayDuration >= longStayThreshold;
        });
        
        console.log(`🏡 サーバー ${guildId} の長期滞在鳥: ${longStayBirds.length}羽`);
        
        if (longStayBirds.length > 0) {
            longStayBirds.forEach(bird => {
                const stayDays = Math.floor((now - bird.entryTime) / (1000 * 60 * 60 * 24));
                console.log(`  📍 ${bird.name}: ${stayDays}日滞在中 (${bird.area}エリア)`);
            });
        }
        
        return longStayBirds;
    }

    /**
     * 鳥の滞在日数を計算
     */
    getBirdStayDays(bird) {
        const now = new Date();
        const stayDuration = now - bird.entryTime;
        return Math.floor(stayDuration / (1000 * 60 * 60 * 24));
    }

    // ===========================================
    // 🆕 Phase 1: システム情報取得機能
    // ===========================================

    /**
     * 現在のシステム状態を取得
     */
    getSystemStatus() {
        const timeSlot = this.getCurrentTimeSlot();
        const moonPhase = this.getCurrentMoonPhase();
        const season = this.getCurrentSeason();
        const specialDay = this.getSpecialDay();
        
        return {
            timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
            timeSlot: timeSlot,
            moonPhase: moonPhase,
            season: season,
            specialDay: specialDay,
            isNightTime: timeSlot.key === 'sleep',
            capabilities: {
                weatherManager: !!this.weatherManager,
                sheetsManager: !!this.sheetsManager,
                lunarPhase: moonPhase.source === 'library'
            }
        };
    }

    /**
     * 鳥類園の詳細状態を取得
     */
    getZooDetailedStatus(guildId) {
        const allBirds = this.getAllBirds(guildId);
        const longStayBirds = this.getLongStayBirds(guildId);
        const systemStatus = this.getSystemStatus();
        
        return {
            ...systemStatus,
            guildId: guildId,
            totalBirds: allBirds.length,
            longStayBirds: longStayBirds.length,
            birdDistribution: {
                森林: this.getZooState(guildId).森林.length,
                草原: this.getZooState(guildId).草原.length,
                水辺: this.getZooState(guildId).水辺.length
            },
            visitors: this.getZooState(guildId).visitors?.length || 0
        };
    }

    // ===========================================
    // 🆕 Phase 1: テスト・デバッグ機能
    // ===========================================

    /**
     * Phase 1機能のテスト実行
     */
    async testPhase1Functions(guildId) {
        console.log('🧪 Phase 1 機能テスト開始...');
        
        const results = {
            timestamp: new Date().toISOString(),
            tests: {}
        };
        
        try {
            // 1. 時間帯テスト
            console.log('📍 時間帯テスト...');
            const timeSlot = this.getCurrentTimeSlot();
            results.tests.timeSlot = {
                success: true,
                result: timeSlot,
                message: `現在の時間帯: ${timeSlot.name}`
            };
            
            // 2. 月齢テスト
            console.log('📍 月齢テスト...');
            const moonPhase = this.getCurrentMoonPhase();
            results.tests.moonPhase = {
                success: true,
                result: moonPhase,
                message: `現在の月齢: ${moonPhase.name} (${moonPhase.source})`
            };
            
            // 3. 季節テスト
            console.log('📍 季節テスト...');
            const season = this.getCurrentSeason();
            results.tests.season = {
                success: true,
                result: season,
                message: `現在の季節: ${season.detail}`
            };
            
            // 4. 記念日テスト
            console.log('📍 記念日テスト...');
            const specialDay = this.getSpecialDay();
            results.tests.specialDay = {
                success: true,
                result: specialDay,
                message: specialDay ? `今日は${specialDay.name}です` : '今日は通常の日です'
            };
            
            // 5. 夜行性チェックテスト
            console.log('📍 夜行性チェックテスト...');
            const allBirds = this.getAllBirds(guildId);
            if (allBirds.length > 0) {
                const testBird = allBirds[0];
                const isNocturnal = await this.isNocturnalBird(testBird.name);
                const hasNocturnal = await this.hasNocturnalBirds(allBirds);
                
                results.tests.nocturnalCheck = {
                    success: true,
                    result: { testBird: testBird.name, isNocturnal, hasNocturnal },
                    message: `${testBird.name}は${isNocturnal ? '夜行性' : '昼行性'}、園内に夜行性の鳥は${hasNocturnal ? 'います' : 'いません'}`
                };
            } else {
                results.tests.nocturnalCheck = {
                    success: false,
                    result: null,
                    message: '鳥がいないためテストできません'
                };
            }
            
            // 6. 長期滞在テスト
            console.log('📍 長期滞在テスト...');
            const longStayBirds = this.getLongStayBirds(guildId);
            results.tests.longStayCheck = {
                success: true,
                result: longStayBirds.map(bird => ({
                    name: bird.name,
                    area: bird.area,
                    stayDays: this.getBirdStayDays(bird)
                })),
                message: `長期滞在鳥: ${longStayBirds.length}羽`
            };
            
            console.log('✅ Phase 1 機能テスト完了');
            results.overall = { success: true, message: 'すべてのテストが完了しました' };
            
        } catch (error) {
            console.error('❌ Phase 1 テストエラー:', error);
            results.overall = { success: false, message: `テスト中にエラーが発生: ${error.message}` };
        }
        
        return results;
    }

    // ===========================================
    // 🆕 Phase 2: 新しいイベント生成機能
    // ===========================================

    /**
     * 時間帯イベント生成
     */
    async createTimeBasedEvent(allBirds) {
        const timeSlot = this.getCurrentTimeSlot();
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        const timeEvents = {
            dawn: [
                `${timeSlot.emoji} 夜明けと共に、${bird.name}が美しい朝の歌を奏でています`,
                `${timeSlot.emoji} 朝日に照らされて、${bird.name}の羽が金色に輝いています`,
                `${timeSlot.emoji} 早朝の清々しい空気を、${bird.name}が深く吸い込んでいます`,
                `${timeSlot.emoji} 夜明けの静寂の中、${bird.name}が優雅に羽ばたいています`,
                `${timeSlot.emoji} 朝霧の中から${bird.name}が現れて、新しい一日を迎えています`
            ],
            morning: [
                `${timeSlot.emoji} 爽やかな朝、${bird.name}が活発に動き回っています`,
                `${timeSlot.emoji} 朝の光を浴びて、${bird.name}が元気よく鳴いています`,
                `${timeSlot.emoji} 朝食を求めて、${bird.name}が餌を探し始めました`,
                `${timeSlot.emoji} 朝のさえずりで、${bird.name}が仲間とコミュニケーションを取っています`,
                `${timeSlot.emoji} 朝露に濡れた草を、${bird.name}が歩いています`
            ],
            noon: [
                `${timeSlot.emoji} 昼下がり、${bird.name}がのんびりと過ごしています`,
                `${timeSlot.emoji} 暖かい昼間の陽だまりで、${bird.name}が気持ちよさそうにしています`,
                `${timeSlot.emoji} お昼時、${bird.name}が木陰で休憩しています`,
                `${timeSlot.emoji} 昼間の賑やかな時間を、${bird.name}が楽しんでいます`,
                `${timeSlot.emoji} 午後の暖かい日差しの中、${bird.name}が羽繕いをしています`
            ],
            evening: [
                `${timeSlot.emoji} 夕暮れ時、${bird.name}が美しい夕日を眺めています`,
                `${timeSlot.emoji} 夕焼け空を背景に、${bird.name}が幻想的に舞っています`,
                `${timeSlot.emoji} 一日の終わりに、${bird.name}が仲間と夕べの歌を歌っています`,
                `${timeSlot.emoji} 夕方の涼しい風を、${bird.name}が羽で感じています`,
                `${timeSlot.emoji} 夕暮れの静けさの中、${bird.name}が穏やかに過ごしています`
            ],
            night: [
                `${timeSlot.emoji} 夜の始まり、${bird.name}がねぐらの準備をしています`,
                `${timeSlot.emoji} 夜風に羽を揺らしながら、${bird.name}が静かに佇んでいます`,
                `${timeSlot.emoji} 星空の下で、${bird.name}が美しい夜の歌を奏でています`,
                `${timeSlot.emoji} 夜の静寂を楽しみながら、${bird.name}が月を見上げています`,
                `${timeSlot.emoji} 夜の帳が降りる中、${bird.name}が安らかに過ごしています`
            ]
        };

        const events = timeEvents[timeSlot.key] || timeEvents.noon;
        const eventContent = events[Math.floor(Math.random() * events.length)];

        return {
            type: `時間帯イベント(${timeSlot.name})`,
            content: eventContent,
            relatedBird: bird.name,
            timeSlot: timeSlot
        };
    }

    /**
     * 夜行性専用イベント生成
     */
    async createNocturnalSpecificEvent(allBirds) {
        const nocturnalBirds = [];
        
        for (const bird of allBirds) {
            if (await this.isNocturnalBird(bird.name)) {
                nocturnalBirds.push(bird);
            }
        }

        if (nocturnalBirds.length === 0) {
            console.log('🦉 夜行性の鳥がいないため、夜行性イベントはスキップします');
            return null;
        }

        const bird = nocturnalBirds[Math.floor(Math.random() * nocturnalBirds.length)];

        const nocturnalEvents = [
            `🦉 夜の王者${bird.name}が、鋭い目で辺りを見回しています`,
            `🦉 ${bird.name}が月光を頼りに、静かに獲物を探しています`,
            `🦉 夜の森で${bird.name}が、完全な静寂の中を飛び回っています`,
            `🦉 暗闇の中、${bird.name}が夜行性の本能を発揮しています`,
            `🦉 ${bird.name}が夜の世界で自由自在に活動しています`,
            `🦉 月明かりの下、${bird.name}が威厳に満ちた姿を見せています`,
            `🦉 夜の静寂を破らずに、${bird.name}が音もなく移動しています`,
            `🦉 ${bird.name}が夜の番人として、辺りを警戒しています`,
            `🦉 星空の下で、${bird.name}が夜の美しさを堪能しています`,
            `🦉 ${bird.name}が夜の冷たい空気を感じながら活動しています`,
             `🦉${bird.name}が夜の闇の中で静かに活動しています🦉`,
            `🦉${bird.name}が夜の獲物を探しているようです`,
           `🦉${bird.name}が暗闇の中を器用に飛び回っています`,
           `🦉${bird.name}が夜の世界の王者のように堂々としています`,
           `🦉${bird.name}が月明かりを頼りに狩りの準備をしています`,
           `🦉${bird.name}が夜の静寂の中で鋭い目を光らせています`,
           `🦉${bird.name}が夜の森の番人として佇んでいます`,
           `🦉${bird.name}が夜の世界で本領を発揮して活動しています`,
           `🦉${bird.name}が暗闇を縫って静かに移動しています`,
           `🦉${bird.name}が夜の獲物の気配を鋭く察知しています`,
           `🦉${bird.name}が月明かりを利用して狩りをしています`,
          `🦉${bird.name}が夜の森の音を全て聞き分けているようです`,
          `🦉${bird.name}が完全な静寂の中を音もなく飛び回っています`,
         `🦉${bird.name}が夜の王者としての威厳を示しています`,
         `🦉${bird.name}が暗闇の中で獲物を待ち伏せています`,
         `🦉${bird.name}が夜の冷たい空気を羽で感じながら活動しています`
        ];

        return {
            type: '夜行性専用イベント',
            content: nocturnalEvents[Math.floor(Math.random() * nocturnalEvents.length)],
            relatedBird: bird.name,
            isNocturnal: true
        };
    }

    /**
     * 天気連動イベント生成
     */
    async createWeatherBasedEvent(allBirds) {
        try {
            if (!this.weatherManager) {
                console.log('⚠️ WeatherManager利用不可、天気イベントをスキップします');
                return null;
            }

            const weather = await this.weatherManager.getCurrentWeather();
            const behavior = this.weatherManager.getBirdBehavior ? 
                this.weatherManager.getBirdBehavior(weather.condition) : null;
            
            // WeatherManagerにgetWeatherEmojiメソッドがない場合のフォールバック
            const emoji = this.weatherManager.getWeatherEmoji ? 
                this.weatherManager.getWeatherEmoji(weather.condition) : 
                this.getWeatherEmojiFallback(weather.condition);
            
            const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
            
            const weatherEvents = {
                sunny: [
                    `${emoji} 晴天の下、${bird.name}が羽を広げて日光浴を楽しんでいます`,
                    `${emoji} 暖かい日差しに誘われて、${bird.name}が活発に動き回っています`,
                    `${emoji} 青空を背景に、${bird.name}が美しく舞っています`,
                    `${emoji} 太陽の光で${bird.name}の羽が金色に輝いています`,
                    `${emoji} 晴れた空に向かって、${bird.name}が嬉しそうに鳴いています`
                ],
                rainy: [
                    `${emoji} 雨音を聞きながら、${bird.name}が軒下で静かに過ごしています`,
                    `${emoji} 雨粒が葉っぱに当たる音を、${bird.name}が興味深そうに聞いています`,
                    `${emoji} 雨宿り中の${bird.name}が、雨上がりを待ちわびているようです`,
                    `${emoji} 小雨の中、${bird.name}が濡れないよう上手に移動しています`,
                    `${emoji} 雨で潤った空気を、${bird.name}が深く吸い込んでいます`
                ],
                cloudy: [
                    `${emoji} 曇り空の下、${bird.name}が穏やかに過ごしています`,
                    `${emoji} 雲の隙間から差す光を、${bird.name}が見上げています`,
                    `${emoji} 涼しい曇り空を、${bird.name}が気持ちよさそうに眺めています`,
                    `${emoji} 時々雲が動くのを、${bird.name}が不思議そうに見つめています`
                ],
                snowy: [
                    `${emoji} 雪景色の中、${bird.name}が美しく映えています`,
                    `${emoji} 舞い散る雪を、${bird.name}が興味深そうに見上げています`,
                    `${emoji} 雪の結晶を羽で受け止めて、${bird.name}が遊んでいます`,
                    `${emoji} 雪化粧した木々の間を、${bird.name}が優雅に移動しています`
                ],
                stormy: [
                    `${emoji} 嵐の中、${bird.name}が安全な場所で身を寄せ合っています`,
                    `${emoji} 強風に負けじと、${bird.name}がしっかりと枝にとまっています`,
                    `${emoji} 嵐が去るのを、${bird.name}が辛抱強く待っています`
                ],
                foggy: [
                    `${emoji} 霧に包まれた幻想的な中を、${bird.name}がゆっくりと移動しています`,
                    `${emoji} 霧の向こうから${bird.name}の美しいシルエットが浮かび上がります`,
                    `${emoji} 霧の静寂の中で、${bird.name}が神秘的な雰囲気を醸し出しています`
                ]
            };

            const events = weatherEvents[weather.condition] || weatherEvents.cloudy;
            const eventContent = events[Math.floor(Math.random() * events.length)];

            return {
                type: `天気イベント(${weather.description})`,
                content: eventContent,
                relatedBird: bird.name,
                weather: weather
            };

        } catch (error) {
            console.error('天気連動イベント生成エラー:', error);
            return null;
        }
    }

    /**
     * 天気絵文字のフォールバック
     */
    getWeatherEmojiFallback(condition) {
        const emojis = {
            sunny: '☀️',
            rainy: '🌧️',
            cloudy: '☁️',
            snowy: '❄️',
            stormy: '⛈️',
            foggy: '🌫️',
            unknown: '❓'
        };
        return emojis[condition] || emojis.unknown;
    }

    /**
     * 季節イベント生成（月別詳細版）
     */
    async createSeasonalEvent(allBirds) {
        const seasonInfo = this.getCurrentSeason();
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        // 月別の詳細なイベント
        const monthlyEvents = {
            1: [ // 厳冬
                `${seasonInfo.emoji} 厳しい寒さの中、${bird.name}が羽を膨らませて暖を取っています`,
                `${seasonInfo.emoji} 雪景色が美しい中、${bird.name}が凛とした姿を見せています`,
                `${seasonInfo.emoji} 冬の澄んだ空気の中、${bird.name}が清々しく過ごしています`
            ],
            2: [ // 晩冬
                `${seasonInfo.emoji} 春の気配を感じて、${bird.name}が少し活発になってきました`,
                `${seasonInfo.emoji} 梅の香りに誘われて、${bird.name}が嬉しそうにしています`,
                `${seasonInfo.emoji} 日差しが暖かくなり、${bird.name}が春を待ちわびているようです`
            ],
            3: [ // 早春
                `${seasonInfo.emoji} 桜のつぼみを見つけて、${bird.name}が春の到来を喜んでいます`,
                `${seasonInfo.emoji} 暖かい春風を受けて、${bird.name}が嬉しそうに羽ばたいています`,
                `${seasonInfo.emoji} 新芽が出始めた木々で、${bird.name}が春の歌を奏でています`
            ],
            4: [ // 盛春
                `${seasonInfo.emoji} 満開の桜と一緒に、${bird.name}が美しく舞っています`,
                `${seasonInfo.emoji} 花々に囲まれて、${bird.name}が幸せそうに過ごしています`,
                `${seasonInfo.emoji} 春の盛りを感じて、${bird.name}が活発に動き回っています`
            ],
            5: [ // 晩春
                `${seasonInfo.emoji} 新緑の美しさに、${bird.name}が見とれています`,
                `${seasonInfo.emoji} 青葉若葉の中で、${bird.name}が爽やかに過ごしています`,
                `${seasonInfo.emoji} 緑豊かな季節を、${bird.name}が心から楽しんでいます`
            ],
            6: [ // 初夏
                `${seasonInfo.emoji} 初夏の爽やかな風を、${bird.name}が羽で感じています`,
                `${seasonInfo.emoji} 青空の下で、${bird.name}が元気いっぱいに活動しています`,
                `${seasonInfo.emoji} 梅雨入り前の美しい季節を、${bird.name}が満喫しています`
            ],
            7: [ // 盛夏
                `${seasonInfo.emoji} 夏の暑さを避けて、${bird.name}が木陰で涼んでいます`,
                `${seasonInfo.emoji} 夏の青空の下、${bird.name}が力強く飛んでいます`,
                `${seasonInfo.emoji} 暑い夏の日、${bird.name}が水浴びを楽しんでいます`
            ],
            8: [ // 晩夏
                `${seasonInfo.emoji} 夏の終わりを感じて、${bird.name}が少し寂しそうです`,
                `${seasonInfo.emoji} 夕涼みを楽しむように、${bird.name}が静かに過ごしています`,
                `${seasonInfo.emoji} 夏の思い出を胸に、${bird.name}が穏やかにしています`
            ],
            9: [ // 初秋
                `${seasonInfo.emoji} 涼しい風を感じて、${bird.name}が秋の到来を喜んでいます`,
                `${seasonInfo.emoji} 虫の音に耳を傾けて、${bird.name}が秋を感じています`,
                `${seasonInfo.emoji} 秋の気配に、${bird.name}が心地よさそうにしています`
            ],
            10: [ // 中秋
                `${seasonInfo.emoji} 紅葉の美しさに、${bird.name}が見とれています`,
                `${seasonInfo.emoji} 色づいた葉っぱの中で、${bird.name}が美しく映えています`,
                `${seasonInfo.emoji} 秋の深まりを感じて、${bird.name}が静かに過ごしています`
            ],
            11: [ // 晩秋
                `${seasonInfo.emoji} 落ち葉の絨毯の上を、${bird.name}が歩いています`,
                `${seasonInfo.emoji} 秋の終わりを感じて、${bird.name}が物思いにふけっています`,
                `${seasonInfo.emoji} 冬支度を始めるように、${bird.name}が準備をしています`
            ],
            12: [ // 初冬
                `${seasonInfo.emoji} 初冬の寒さに、${bird.name}が身を寄せ合っています`,
                `${seasonInfo.emoji} 冬の始まりを感じて、${bird.name}が静かに過ごしています`,
                `${seasonInfo.emoji} 年の瀬の慌ただしさの中、${bird.name}が穏やかにしています`
            ]
        };

        const month = new Date().getMonth() + 1;
        const events = monthlyEvents[month];
        const eventContent = events[Math.floor(Math.random() * events.length)];

        return {
            type: `季節イベント(${seasonInfo.detail})`,
            content: eventContent,
            relatedBird: bird.name,
            season: seasonInfo
        };
    }

    /**
     * 記念日・特別な日イベント生成
     */
    async createSpecialDayEvent(allBirds) {
        const specialDay = this.getSpecialDay();
        if (!specialDay) {
            console.log('🎉 今日は特別な日ではないため、記念日イベントはスキップします');
            return null;
        }

        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];

        const specialDayEvents = {
            '元日': `${specialDay.emoji} ${specialDay.name}の特別な朝、${bird.name}が新年の希望を込めて美しく鳴いています`,
            '節分': `${specialDay.emoji} ${specialDay.name}の日、${bird.name}が邪気を払うかのように力強く羽ばたいています`,
            'バレンタインデー': `${specialDay.emoji} ${specialDay.name}、${bird.name}が愛情深い鳴き声で仲間への愛を表現しています`,
            'ひな祭り': `${specialDay.emoji} ${specialDay.name}の日、${bird.name}が雅な雰囲気の中で優雅に舞っています`,
            '春分の日': `${specialDay.emoji} ${specialDay.name}、${bird.name}が昼と夜の平衡を感じているようです`,
            'こどもの日': `${specialDay.emoji} ${specialDay.name}、${bird.name}が子供たちの健やかな成長を願っているようです`,
            '愛鳥週間開始': `${specialDay.emoji} ${specialDay.name}、${bird.name}が特別に美しい姿を見せています`,
            '七夕': `${specialDay.emoji} ${specialDay.name}の夜、${bird.name}が星空に向かって願い事をしているようです`,
            'ハロウィン': `${specialDay.emoji} ${specialDay.name}の夜、${bird.name}が魔法にかかったように神秘的に舞っています`,
            'クリスマス': `${specialDay.emoji} ${specialDay.name}の聖なる夜、${bird.name}が天使のように美しく羽ばたいています`,
            '大晦日': `${specialDay.emoji} ${specialDay.name}、${bird.name}が一年の感謝を込めて特別な歌を奏でています`
        };

        const eventContent = specialDayEvents[specialDay.name] || 
            `${specialDay.emoji} ${specialDay.name}の特別な日、${bird.name}がお祝いの気持ちを込めて美しく舞っています`;

        return {
            type: `記念日イベント(${specialDay.name})`,
            content: eventContent,
            relatedBird: bird.name,
            specialDay: specialDay
        };
    }

    /**
     * 月齢イベント生成
     */
    async createMoonPhaseEvent(allBirds) {
        const moonPhase = this.getCurrentMoonPhase();
        const bird = allBirds[Math.floor(Math.random() * allBirds.length)];

        const moonEvents = {
            new: [
                `${moonPhase.emoji} ${moonPhase.name}の夜、${bird.name}が新しい始まりを感じているようです`,
                `${moonPhase.emoji} 暗い夜空の下で、${bird.name}が静寂を楽しんでいます`,
                `${moonPhase.emoji} ${moonPhase.name}の神秘的な夜、${bird.name}が特別な力を感じているようです`
            ],
            waxing_crescent: [
                `${moonPhase.emoji} ${moonPhase.name}の夜、${bird.name}が成長の兆しを感じているようです`,
                `${moonPhase.emoji} 細い月の光に照らされて、${bird.name}が美しく輝いています`,
                `${moonPhase.emoji} ${moonPhase.name}の優しい光の下で、${bird.name}が穏やかに過ごしています`
            ],
            first_quarter: [
                `${moonPhase.emoji} ${moonPhase.name}の夜、${bird.name}が調和の美しさを感じているようです`,
                `${moonPhase.emoji} 半月の光に照らされて、${bird.name}が静かに佇んでいます`,
                `${moonPhase.emoji} ${moonPhase.name}の安定した光の下で、${bird.name}が安らいでいます`
            ],
            full: [
                `${moonPhase.emoji} ${moonPhase.name}の夜、${bird.name}が月光に照らされて神々しく見えます`,
                `${moonPhase.emoji} 明るい月の下で、${bird.name}が特別な美しさを放っています`,
                `${moonPhase.emoji} ${moonPhase.name}の力強い光を受けて、${bird.name}が活力に満ちています`
            ],
            waning_gibbous: [
                `${moonPhase.emoji} ${moonPhase.name}の夜、${bird.name}が静かに思索にふけっています`,
                `${moonPhase.emoji} 欠けゆく月を見上げて、${bird.name}が物思いにふけっているようです`,
                `${moonPhase.emoji} ${moonPhase.name}の落ち着いた夜、${bird.name}が安らかに過ごしています`
            ]
        };

        // moonPhase.keyに基づいてイベントを選択
        const events = moonEvents[moonPhase.key] || moonEvents.new;
        const eventContent = events[Math.floor(Math.random() * events.length)];

        return {
            type: `月齢イベント(${moonPhase.name})`,
            content: eventContent,
            relatedBird: bird.name,
            moonPhase: moonPhase
        };
    }

    // ===========================================
    // 🆕 Phase 2: イベント統合・テスト機能
    // ===========================================

    /**
     * Phase 2機能のテスト実行
     */
    async testPhase2Functions(guildId) {
        console.log('🧪 Phase 2 イベント機能テスト開始...');
        
        const results = {
            timestamp: new Date().toISOString(),
            tests: {}
        };
        
        try {
            const allBirds = this.getAllBirds(guildId);
            if (allBirds.length === 0) {
                results.overall = { success: false, message: '鳥がいないためテストできません' };
                return results;
            }

            // 1. 時間帯イベントテスト
            console.log('📍 時間帯イベントテスト...');
            const timeEvent = await this.createTimeBasedEvent(allBirds);
            results.tests.timeBasedEvent = {
                success: !!timeEvent,
                result: timeEvent,
                message: timeEvent ? `成功: ${timeEvent.type}` : '失敗: イベント生成できず'
            };

            // 2. 夜行性イベントテスト
            console.log('📍 夜行性イベントテスト...');
            const nocturnalEvent = await this.createNocturnalSpecificEvent(allBirds);
            results.tests.nocturnalEvent = {
                success: true, // nullでも正常動作
                result: nocturnalEvent,
                message: nocturnalEvent ? `成功: ${nocturnalEvent.type}` : '夜行性の鳥がいないためスキップ'
            };

            // 3. 天気イベントテスト
            console.log('📍 天気イベントテスト...');
            const weatherEvent = await this.createWeatherBasedEvent(allBirds);
            results.tests.weatherEvent = {
                success: true, // nullでも正常動作
                result: weatherEvent,
                message: weatherEvent ? `成功: ${weatherEvent.type}` : 'WeatherManager利用不可またはエラー'
            };

            // 4. 季節イベントテスト
            console.log('📍 季節イベントテスト...');
            const seasonEvent = await this.createSeasonalEvent(allBirds);
            results.tests.seasonEvent = {
                success: !!seasonEvent,
                result: seasonEvent,
                message: seasonEvent ? `成功: ${seasonEvent.type}` : '失敗: イベント生成できず'
            };

            // 5. 記念日イベントテスト
            console.log('📍 記念日イベントテスト...');
            const specialEvent = await this.createSpecialDayEvent(allBirds);
            results.tests.specialDayEvent = {
                success: true, // nullでも正常動作
                result: specialEvent,
                message: specialEvent ? `成功: ${specialEvent.type}` : '今日は特別な日ではないためスキップ'
            };

            // 6. 月齢イベントテスト
            console.log('📍 月齢イベントテスト...');
            const moonEvent = await this.createMoonPhaseEvent(allBirds);
            results.tests.moonPhaseEvent = {
                success: !!moonEvent,
                result: moonEvent,
                message: moonEvent ? `成功: ${moonEvent.type}` : '失敗: イベント生成できず'
            };

            console.log('✅ Phase 2 イベント機能テスト完了');
            results.overall = { success: true, message: 'すべてのイベントテストが完了しました' };

        } catch (error) {
            console.error('❌ Phase 2 テストエラー:', error);
            results.overall = { success: false, message: `テスト中にエラーが発生: ${error.message}` };
        }

        return results;
    }

    // ===========================================
    // 🆕 Phase 3: 詳細なイベント機能
    // ===========================================

    /**
     * 気温連動イベント生成
     */
    async createTemperatureEvent(allBirds) {
        try {
            if (!this.weatherManager) {
                console.log('⚠️ WeatherManager利用不可、気温イベントをスキップします');
                return null;
            }

            const weather = await this.weatherManager.getCurrentWeather();
            const temp = weather.temperature;
            
            if (temp === null) {
                console.log('⚠️ 気温データ取得不可、気温イベントをスキップします');
                return null;
            }

            const bird = allBirds[Math.floor(Math.random() * allBirds.length)];

            let tempEvent = '';
            let tempCategory = '';

            if (temp < 0) {
                tempCategory = '氷点下';
                tempEvent = `🥶 氷点下の寒さ(${temp}°C)、${bird.name}が羽を大きく膨らませて寒さをしのいでいます`;
            } else if (temp < 5) {
                tempCategory = '厳寒';
                tempEvent = `❄️ とても寒い日(${temp}°C)、${bird.name}が仲間と寄り添って暖を取っています`;
            } else if (temp < 10) {
                tempCategory = '寒冷';
                tempEvent = `🌨️ 寒い日(${temp}°C)、${bird.name}が暖かい場所を探しています`;
            } else if (temp < 15) {
                tempCategory = '涼しい';
                tempEvent = `🌤️ 涼しい日(${temp}°C)、${bird.name}が活発に動き回っています`;
            } else if (temp < 20) {
                tempCategory = '快適';
                tempEvent = `😊 過ごしやすい気温(${temp}°C)、${bird.name}が心地よさそうに過ごしています`;
            } else if (temp < 25) {
                tempCategory = '暖かい';
                tempEvent = `🌞 暖かい日(${temp}°C)、${bird.name}が気持ちよさそうに日向ぼっこしています`;
            } else if (temp < 30) {
                tempCategory = '温暖';
                tempEvent = `☀️ 温かい日(${temp}°C)、${bird.name}が活発に飛び回っています`;
            } else if (temp < 35) {
                tempCategory = '暑い';
                tempEvent = `🔥 暑い日(${temp}°C)、${bird.name}が木陰で涼しさを求めています`;
            } else {
                tempCategory = '酷暑';
                tempEvent = `🌡️ 酷暑の日(${temp}°C)、${bird.name}が日陰でじっと暑さをしのいでいます`;
            }

            return {
                type: `気温イベント(${tempCategory})`,
                content: tempEvent,
                relatedBird: bird.name,
                temperature: temp,
                category: tempCategory
            };

        } catch (error) {
            console.error('気温イベント生成エラー:', error);
            return null;
        }
    }

    /**
     * 長期滞在イベント生成
     */
    async createLongStayEvent(guildId, allBirds) {
        const longStayBirds = this.getLongStayBirds(guildId);
        
        if (longStayBirds.length === 0) {
            console.log('🏡 長期滞在鳥がいないため、長期滞在イベントをスキップします');
            return null;
        }

        const bird = longStayBirds[Math.floor(Math.random() * longStayBirds.length)];
        const now = new Date();
        const stayDays = Math.floor((now - bird.entryTime) / (1000 * 60 * 60 * 24));

        const longStayEvents = [
            `🏡 ${bird.name}がこの鳥類園に来てから${stayDays}日が経ちました。すっかり家族のようです`,
            `🌟 長期滞在中の${bird.name}が、この場所をとても気に入っているようです(${stayDays}日目)`,
            `💖 ${bird.name}が${stayDays}日間も滞在して、みんなの人気者になっています`,
            `🎉 ${bird.name}の長期滞在記録更新中！${stayDays}日目の今日も元気です`,
            `🏠 ${bird.name}がこの鳥類園を第二の故郷のように感じているようです(${stayDays}日目)`,
            `⭐ ${stayDays}日間滞在している${bird.name}が、新入りの鳥たちの良いお手本になっています`,
            `🌈 長期滞在の${bird.name}が、この場所の特別な魅力を教えてくれているようです`,
            `🎯 ${bird.name}が${stayDays}日間の滞在で、園内の隠れスポットを全て知り尽くしているようです`,
            `🤝 ${bird.name}が長期滞在の先輩として、新しい鳥たちを温かく迎えています`,
            `📚 ${stayDays}日間の滞在で、${bird.name}がこの園の歴史の生き証人になっています`
        ];

        const eventContent = longStayEvents[Math.floor(Math.random() * longStayEvents.length)];

        return {
            type: `長期滞在イベント(${stayDays}日目)`,
            content: eventContent,
            relatedBird: bird.name,
            stayDays: stayDays
        };
    }

    /**
     * 風速連動イベント生成
     */
    async createWindEvent(allBirds) {
        try {
            if (!this.weatherManager) {
                console.log('⚠️ WeatherManager利用不可、風速イベントをスキップします');
                return null;
            }

            const weather = await this.weatherManager.getCurrentWeather();
            const windSpeed = weather.windSpeed;
            
            if (windSpeed === null || windSpeed === undefined) {
                console.log('⚠️ 風速データ取得不可、風速イベントをスキップします');
                return null;
            }

            const bird = allBirds[Math.floor(Math.random() * allBirds.length)];

            let windEvent = '';
            let windCategory = '';

            if (windSpeed < 1) {
                windCategory = '無風';
                windEvent = `🍃 無風の静かな日、${bird.name}が穏やかに羽を休めています`;
            } else if (windSpeed < 3) {
                windCategory = 'そよ風';
                windEvent = `🌿 そよ風が心地よく、${bird.name}が優雅に羽を広げています`;
            } else if (windSpeed < 7) {
                windCategory = '軽風';
                windEvent = `🌾 軽やかな風に乗って、${bird.name}が楽しそうに飛び回っています`;
            } else if (windSpeed < 12) {
                windCategory = '軟風';
                windEvent = `🌸 程よい風を感じて、${bird.name}が気持ちよさそうに過ごしています`;
            } else if (windSpeed < 20) {
                windCategory = '強風';
                windEvent = `💨 強い風の中、${bird.name}がしっかりと枝につかまっています`;
            } else {
                windCategory = '暴風';
                windEvent = `🌪️ 激しい風の中、${bird.name}が安全な場所に避難しています`;
            }

            return {
                type: `風速イベント(${windCategory})`,
                content: windEvent,
                relatedBird: bird.name,
                windSpeed: windSpeed,
                category: windCategory
            };

        } catch (error) {
            console.error('風速イベント生成エラー:', error);
            return null;
        }
    }

    /**
     * 湿度連動イベント生成
     */
    async createHumidityEvent(allBirds) {
        try {
            if (!this.weatherManager) {
                console.log('⚠️ WeatherManager利用不可、湿度イベントをスキップします');
                return null;
            }

            const weather = await this.weatherManager.getCurrentWeather();
            const humidity = weather.humidity;
            
            if (humidity === null || humidity === undefined) {
                console.log('⚠️ 湿度データ取得不可、湿度イベントをスキップします');
                return null;
            }

            const bird = allBirds[Math.floor(Math.random() * allBirds.length)];

            let humidityEvent = '';
            let humidityCategory = '';

            if (humidity < 30) {
                humidityCategory = '乾燥';
                humidityEvent = `🏜️ 乾燥した空気の中、${bird.name}が水を求めて動き回っています`;
            } else if (humidity < 50) {
                humidityCategory = '快適';
                humidityEvent = `😌 心地よい湿度で、${bird.name}が快適に過ごしています`;
            } else if (humidity < 70) {
                humidityCategory = 'やや高湿度';
                humidityEvent = `💧 少し湿った空気の中、${bird.name}が涼しげに過ごしています`;
            } else if (humidity < 85) {
                humidityCategory = '高湿度';
                humidityEvent = `🌫️ 湿度の高い日、${bird.name}が水浴びを楽しんでいます`;
            } else {
                humidityCategory = '多湿';
                humidityEvent = `💦 とても湿った空気の中、${bird.name}が涼しい場所を探しています`;
            }

            return {
                type: `湿度イベント(${humidityCategory})`,
                content: humidityEvent,
                relatedBird: bird.name,
                humidity: humidity,
                category: humidityCategory
            };

        } catch (error) {
            console.error('湿度イベント生成エラー:', error);
            return null;
        }
    }

    /**
     * 群れイベント生成（同じ種類の鳥が複数いる場合）
     */
    async createFlockEvent(allBirds) {
        // 同じ種類の鳥を集計
        const birdCounts = {};
        allBirds.forEach(bird => {
            birdCounts[bird.name] = (birdCounts[bird.name] || 0) + 1;
        });

        // 2羽以上いる種類を抽出
        const flockSpecies = Object.entries(birdCounts).filter(([name, count]) => count >= 2);
        
        if (flockSpecies.length === 0) {
            console.log('🐦 群れを形成できる鳥がいないため、群れイベントをスキップします');
            return null;
        }

        const [speciesName, count] = flockSpecies[Math.floor(Math.random() * flockSpecies.length)];

        const flockEvents = [
            `🐦‍⬛ ${count}羽の${speciesName}たちが美しい群れを作っています`,
            `🌟 ${speciesName}の群れが息の合った飛行を披露しています`,
            `🎵 ${count}羽の${speciesName}たちが合唱しているようです`,
            `🤝 ${speciesName}たちが群れで仲良く餌を探しています`,
            `💫 ${speciesName}の群れが同期して羽ばたく美しい光景が見られます`,
            `🔄 ${count}羽の${speciesName}たちが群れで移動しています`,
            `🎭 ${speciesName}たちが群れで遊んでいる様子が微笑ましいです`,
            `🌈 ${speciesName}の群れが虹のような美しい編隊を組んでいます`,
            `🎪 ${count}羽の${speciesName}たちが群れでアクロバット飛行を披露しています`,
            `💝 ${speciesName}たちが群れで互いを気遣い合っています`
        ];

        const eventContent = flockEvents[Math.floor(Math.random() * flockEvents.length)];

        return {
            type: `群れイベント(${speciesName} ${count}羽)`,
            content: eventContent,
            relatedBird: speciesName,
            flockSize: count
        };
    }

    /**
     * エリア間移動イベント生成
     */
    async createAreaMovementEvent(guildId) {
        const zooState = this.getZooState(guildId);
        const areas = ['森林', '草原', '水辺'];
        const sourceArea = areas[Math.floor(Math.random() * areas.length)];
        const targetArea = areas.filter(area => area !== sourceArea)[Math.floor(Math.random() * 2)];
        
        const sourceBirds = zooState[sourceArea];
        if (sourceBirds.length === 0) {
            console.log('🚶 移動可能な鳥がいないため、エリア間移動イベントをスキップします');
            return null;
        }

        const bird = sourceBirds[Math.floor(Math.random() * sourceBirds.length)];

        const movementEvents = [
            `🚶 ${bird.name}が${sourceArea}エリアから${targetArea}エリアへ散歩に出かけました`,
            `👀 ${bird.name}が${targetArea}エリアの様子を見に行っています`,
            `🌍 ${bird.name}が${sourceArea}エリアを離れて${targetArea}エリアを探索中です`,
            `🎯 ${bird.name}が${targetArea}エリアで新しい発見をしに行きました`,
            `🤝 ${bird.name}が${targetArea}エリアの仲間に挨拶をしに行っています`,
            `🔍 ${bird.name}が${sourceArea}エリアから${targetArea}エリアへ冒険に出発しました`,
            `💫 ${bird.name}が${targetArea}エリアの美しい景色を見に行っています`,
            `🎪 ${bird.name}が${sourceArea}エリアと${targetArea}エリアを行き来して楽しんでいます`,
            `🌟 ${bird.name}が${targetArea}エリアで新しい体験をしようとしています`,
            `🎭 ${bird.name}が${sourceArea}エリアから${targetArea}エリアへお出かけ中です`
        ];

        const eventContent = movementEvents[Math.floor(Math.random() * movementEvents.length)];

        return {
            type: `エリア間移動イベント(${sourceArea}→${targetArea})`,
            content: eventContent,
            relatedBird: bird.name,
            sourceArea: sourceArea,
            targetArea: targetArea
        };
    }

    // ===========================================
    // 🆕 Phase 3: テスト・統合機能
    // ===========================================

    /**
     * Phase 3機能のテスト実行
     */
    async testPhase3Functions(guildId) {
        console.log('🧪 Phase 3 詳細イベント機能テスト開始...');
        
        const results = {
            timestamp: new Date().toISOString(),
            tests: {}
        };
        
        try {
            const allBirds = this.getAllBirds(guildId);
            if (allBirds.length === 0) {
                results.overall = { success: false, message: '鳥がいないためテストできません' };
                return results;
            }

            // 1. 気温イベントテスト
            console.log('📍 気温イベントテスト...');
            const tempEvent = await this.createTemperatureEvent(allBirds);
            results.tests.temperatureEvent = {
                success: true,
                result: tempEvent,
                message: tempEvent ? `成功: ${tempEvent.type}` : 'WeatherManager利用不可またはエラー'
            };

            // 2. 長期滞在イベントテスト
            console.log('📍 長期滞在イベントテスト...');
            const longStayEvent = await this.createLongStayEvent(guildId, allBirds);
            results.tests.longStayEvent = {
                success: true,
                result: longStayEvent,
                message: longStayEvent ? `成功: ${longStayEvent.type}` : '長期滞在鳥がいないためスキップ'
            };

            // 3. 風速イベントテスト
            console.log('📍 風速イベントテスト...');
            const windEvent = await this.createWindEvent(allBirds);
            results.tests.windEvent = {
                success: true,
                result: windEvent,
                message: windEvent ? `成功: ${windEvent.type}` : 'WeatherManager利用不可またはエラー'
            };

            // 4. 湿度イベントテスト
            console.log('📍 湿度イベントテスト...');
            const humidityEvent = await this.createHumidityEvent(allBirds);
            results.tests.humidityEvent = {
                success: true,
                result: humidityEvent,
                message: humidityEvent ? `成功: ${humidityEvent.type}` : 'WeatherManager利用不可またはエラー'
            };

            // 5. 群れイベントテスト
            console.log('📍 群れイベントテスト...');
            const flockEvent = await this.createFlockEvent(allBirds);
            results.tests.flockEvent = {
                success: true,
                result: flockEvent,
                message: flockEvent ? `成功: ${flockEvent.type}` : '群れを形成できる鳥がいないためスキップ'
            };

            // 6. エリア間移動イベントテスト
            console.log('📍 エリア間移動イベントテスト...');
            const movementEvent = await this.createAreaMovementEvent(guildId);
            results.tests.movementEvent = {
                success: true,
                result: movementEvent,
                message: movementEvent ? `成功: ${movementEvent.type}` : '移動可能な鳥がいないためスキップ'
            };

            console.log('✅ Phase 3 詳細イベント機能テスト完了');
            results.overall = { success: true, message: 'すべての詳細イベントテストが完了しました' };

        } catch (error) {
            console.error('❌ Phase 3 テストエラー:', error);
            results.overall = { success: false, message: `テスト中にエラーが発生: ${error.message}` };
        }

        return results;
    }

    /**
     * 昼間のイベント生成
     */
    async generateDaytimeEvent(eventType, allBirds, guildId) {
        switch (eventType) {
            case 'weather_based':
                return await this.createWeatherBasedEvent(allBirds);
            case 'time_based':
                return await this.createTimeBasedEvent(allBirds);
            case 'seasonal':
                return await this.createSeasonalEvent(allBirds);
            case 'special_day':
                return await this.createSpecialDayEvent(allBirds);
            case 'temperature':
                return await this.createTemperatureEvent(allBirds);
            case 'wind':
                return await this.createWindEvent(allBirds);
            case 'humidity':
                return await this.createHumidityEvent(allBirds);
            case 'long_stay':
                return await this.createLongStayEvent(guildId, allBirds);
            case 'flock':
                return await this.createFlockEvent(allBirds);
            case 'area_movement':
                return await this.createAreaMovementEvent(guildId);
            case 'interaction':
                return this.createInteractionEvent(allBirds);
            case 'discovery':
                return this.createDiscoveryEvent(allBirds);
            default:
                return await this.createEvent(eventType, allBirds);
        }
    }

    // ===========================================
    // 🆕 Phase 4: 包括的な統計・分析機能
    // ===========================================

    /**
     * イベント統計情報取得
     */
    getEventStatistics(guildId) {
        const zooState = this.getZooState(guildId);
        const events = zooState.events || [];
        
        const stats = {
            total: events.length,
            byType: {},
            recent24h: 0,
            recent7days: 0,
            systemStatus: this.getSystemStatus(),
            birdStatus: {
                total: this.getAllBirds(guildId).length,
                longStay: this.getLongStayBirds(guildId).length,
                visitors: zooState.visitors?.length || 0
            }
        };

        // タイプ別統計
        events.forEach(event => {
            stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
        });

        // 時間範囲別統計
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        stats.recent24h = events.filter(event => 
            event.timestamp && new Date(event.timestamp) > oneDayAgo
        ).length;

        stats.recent7days = events.filter(event => 
            event.timestamp && new Date(event.timestamp) > sevenDaysAgo
        ).length;

        return stats;
    }

    /**
     * 手動でのイベント生成（管理者用）
     */
    async manualGenerateEvent(guildId, eventType = null) {
        const allBirds = this.getAllBirds(guildId);
        if (allBirds.length === 0) {
            return { success: false, message: '鳥がいません' };
        }

        let event = null;

        if (eventType) {
            console.log(`🎪 手動イベント生成: ${eventType}`);
            event = await this.generateDaytimeEvent(eventType, allBirds, guildId);
        } else {
            console.log(`🎪 手動ランダムイベント生成`);
            await this.generateRandomEvent(guildId);
            return { success: true, message: 'ランダムイベントを生成しました' };
        }

        if (event) {
            await this.addEvent(guildId, event.type, event.content, event.relatedBird);
            return { 
                success: true, 
                message: `${event.type}を生成しました`,
                event: event
            };
        } else {
            return { 
                success: false, 
                message: `${eventType}イベントを生成できませんでした（条件が満たされていない可能性があります）`
            };
        }
    }

    // ===========================================
    // 🆕 Phase 4: 最終テスト機能
    // ===========================================

    /**
     * 全Phase統合テスト
     */
    async testAllPhases(guildId) {
        console.log('🧪 全Phase統合テスト開始...');
        
        const results = {
            timestamp: new Date().toISOString(),
            phases: {}
        };

        try {
            // Phase 1テスト
            console.log('📍 Phase 1テスト実行...');
            results.phases.phase1 = await this.testPhase1Functions(guildId);

            // Phase 2テスト
            console.log('📍 Phase 2テスト実行...');
            results.phases.phase2 = await this.testPhase2Functions(guildId);

            // Phase 3テスト
            console.log('📍 Phase 3テスト実行...');
            results.phases.phase3 = await this.testPhase3Functions(guildId);

            // システム全体のテスト
            console.log('📍 システム統合テスト実行...');
            const systemStatus = this.getSystemStatus();
            const eventStats = this.getEventStatistics(guildId);
            
            results.systemIntegration = {
                success: true,
                systemStatus: systemStatus,
                eventStatistics: eventStats,
                message: '全システムが正常に動作しています'
            };

            // ランダムイベント生成テスト
            console.log('📍 ランダムイベント生成テスト...');
            const manualEventResult = await this.manualGenerateEvent(guildId);
            results.randomEventTest = {
                success: manualEventResult.success,
                result: manualEventResult,
                message: manualEventResult.message
            };

            console.log('✅ 全Phase統合テスト完了');
            results.overall = { 
                success: true, 
                message: '全ての機能が正常にテストされました',
                summary: {
                    phase1Success: results.phases.phase1.overall.success,
                    phase2Success: results.phases.phase2.overall.success,
                    phase3Success: results.phases.phase3.overall.success,
                    systemIntegrationSuccess: results.systemIntegration.success,
                    randomEventSuccess: results.randomEventTest.success
                }
            };

        } catch (error) {
            console.error('❌ 全Phase統合テストエラー:', error);
            results.overall = { 
                success: false, 
                message: `統合テスト中にエラーが発生: ${error.message}` 
            };
        }

        return results;
    }

    // ===========================================
    // 🆕 通過イベント（渡り鳥・群れ）システム
    // ===========================================

    /**
     * 通過イベント生成（レアイベント）
     */
    async createFlyoverEvent(allBirds) {
        // 通過イベントの発生確率は低く設定（レア感を演出）
        if (Math.random() > 0.15) { // 15%の確率でのみ生成を試行
            console.log('🌟 通過イベント: 確率により発生しませんでした');
            return null;
        }

        const season = this.getCurrentSeason();
        const timeSlot = this.getCurrentTimeSlot();
        
        // 夜間（就寝時間）は通過イベントを発生させない
        if (timeSlot.key === 'sleep') {
            console.log('🌙 夜間のため通過イベントはスキップします');
            return null;
        }

        // 季節に適した鳥を選択
        const availableBirds = this.migratoryBirds.filter(bird => {
            if (!bird.season) return true; // 季節指定なしは常に利用可能
            
            const currentSeason = season.season;
            return (
                (bird.season === 'spring' && currentSeason === '春') ||
                (bird.season === 'summer' && currentSeason === '夏') ||
                (bird.season === 'autumn' && currentSeason === '秋') ||
                (bird.season === 'winter' && currentSeason === '冬')
            );
        });

        if (availableBirds.length === 0) {
            console.log('🌟 季節に適した通過鳥がいません');
            return null;
        }

        const passingBird = availableBirds[Math.floor(Math.random() * availableBirds.length)];
        
        // 園内の鳥から見送り役をランダム選択
        const witnesseBird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        // 通過イベントの種類を決定
        const eventType = Math.random() < 0.6 ? 'single' : 'flock'; // 60%で単体、40%で群れ
        
        return await this.generateFlyoverEventContent(passingBird, witnesseBird, eventType, season, timeSlot);
    }

    /**
     * 通過イベントの内容生成
     */
    async generateFlyoverEventContent(passingBird, witnessBird, eventType, season, timeSlot) {
        const isFlockBird = passingBird.type === 'flock' || eventType === 'flock';
        const flockSize = isFlockBird ? this.generateFlockSize(passingBird.name) : 1;
        
        let eventContent = '';
        
        if (isFlockBird && flockSize > 1) {
            // 群れの通過イベント
            const flockEvents = [
                `✨ ${flockSize}羽の${passingBird.name}たちの群れが鳥類園の上空を通過中です！${witnessBird.name}が見送っています`,
                `🌟 ${passingBird.name}の大群（${flockSize}羽）が青空を横切っていきます。${witnessBird.name}が興味深そうに見上げています`,
                `⭐ 空の向こうから${passingBird.name}たちの群れ（${flockSize}羽）がやってきました！${witnessBird.name}が羨ましそうに眺めています`,
                `💫 ${flockSize}羽の${passingBird.name}たちが${passingBird.description}${timeSlot.emoji}の空を駆け抜けていきます。${witnessBird.name}も一緒に飛びたそうです`,
                `🌈 ${passingBird.name}の美しい編隊（${flockSize}羽）が園の上を優雅に通過。${witnessBird.name}が感動しているようです`,
                `🎪 ${flockSize}羽の${passingBird.name}たちが空中ショーのような飛行を披露！${witnessBird.name}が拍手しているかのようです`,
                `🎭 ${passingBird.name}の群れ（${flockSize}羽）が${season.emoji}の空に美しい軌跡を描いて去っていきます。${witnessBird.name}が名残惜しそうに見送っています`
            ];
            
            eventContent = flockEvents[Math.floor(Math.random() * flockEvents.length)];
            
        } else {
            // 単体の通過イベント
            const singleEvents = [
                `✨ 一羽の${passingBird.name}が鳥類園の上空を通過していきます。${witnessBird.name}が見上げて挨拶しています`,
                `🌟 ${passingBird.name}が${passingBird.description}園の上を飛んでいきました。${witnessBird.name}が羨ましそうに見ています`,
                `⭐ 風に乗った${passingBird.name}が園の空を横切っていきます。${witnessBird.name}が「いってらっしゃい」と言っているようです`,
                `💫 ${passingBird.name}が${timeSlot.emoji}の空を自由に飛んでいく姿を、${witnessBird.name}が憧れの眼差しで見つめています`,
                `🌈 優雅な${passingBird.name}が通り過ぎていきます。${witnessBird.name}が「また来てね」と手を振っているようです`,
                `🎪 ${passingBird.name}が${season.detail}の空に美しい弧を描いて飛んでいきます。${witnessBird.name}が感嘆しています`,
                `🎭 ${passingBird.name}が${passingBird.description}空の彼方へ消えていきました。${witnessBird.name}が長い間見送っています`
            ];
            
            eventContent = singleEvents[Math.floor(Math.random() * singleEvents.length)];
        }

        return {
            type: isFlockBird ? `通過イベント(${passingBird.name}の群れ)` : `通過イベント(${passingBird.name})`,
            content: eventContent,
            relatedBird: `${witnessBird.name} (見送り)`,
            passingBird: passingBird.name,
            isRareEvent: true,
            flockSize: isFlockBird ? flockSize : 1,
            season: season.detail,
            timeSlot: timeSlot.name
        };
    }

    /**
     * 群れのサイズを生成
     */
    generateFlockSize(birdName) {
        const flockSizes = {
            'ムクドリ': () => Math.floor(Math.random() * 100) + 50,  // 50-150羽
            'カラス': () => Math.floor(Math.random() * 20) + 10,     // 10-30羽
            'スズメ': () => Math.floor(Math.random() * 30) + 20,     // 20-50羽
            'ヒヨドリ': () => Math.floor(Math.random() * 15) + 10,   // 10-25羽
            'ツバメ': () => Math.floor(Math.random() * 25) + 15,     // 15-40羽
            'ガン': () => Math.floor(Math.random() * 30) + 20,       // 20-50羽
            'ハクチョウ': () => Math.floor(Math.random() * 10) + 5,  // 5-15羽
            'default': () => Math.floor(Math.random() * 20) + 10     // 10-30羽
        };

        const sizeGenerator = flockSizes[birdName] || flockSizes['default'];
        return sizeGenerator();
    }

    /**
     * 季節による渡り鳥の通過頻度調整
     */
    getSeasonalMigrationBonus() {
        const season = this.getCurrentSeason();
        const month = new Date().getMonth() + 1;
        
        // 渡りの季節（春・秋）は通過イベントの確率を上げる
        const migrationSeasons = {
            3: 1.5,  // 3月 - 春の渡り開始
            4: 2.0,  // 4月 - 春の渡りピーク
            5: 1.8,  // 5月 - 春の渡り終盤
            9: 1.8,  // 9月 - 秋の渡り開始
            10: 2.0, // 10月 - 秋の渡りピーク
            11: 1.5  // 11月 - 秋の渡り終盤
        };
        
        return migrationSeasons[month] || 1.0;
    }

    /**
     * 特別な通過イベント（記念日・特別な天気の日）
     */
    async createSpecialFlyoverEvent(allBirds) {
        const specialDay = this.getSpecialDay();
        const weather = this.weatherManager ? await this.weatherManager.getCurrentWeather() : null;
        
        // 特別な日の特別な通過イベント
        if (specialDay) {
            return await this.createHolidayFlyoverEvent(allBirds, specialDay);
        }
        
        // 特別な天気の通過イベント
        if (weather && (weather.condition === 'sunny' || weather.condition === 'stormy')) {
            return await this.createWeatherFlyoverEvent(allBirds, weather);
        }
        
        return null;
    }

    /**
     * 記念日の特別通過イベント
     */
    async createHolidayFlyoverEvent(allBirds, specialDay) {
        const witnessBird = allBirds[Math.floor(Math.random() * allBirds.length)];
        
        const holidayEvents = {
            '元日': `🎍 新年を祝うかのように、ツルたちの群れが鳥類園の上空を舞っています。${witnessBird.name}が新年の挨拶をしているようです`,
            'こどもの日': `🎏 こどもの日の空に、ツバメたちの群れが元気よく飛び回っています。${witnessBird.name}が子供たちの成長を願っているようです`,
            '七夕': `🎋 七夕の夜空に、ハクチョウたちが星に向かって飛んでいきます。${witnessBird.name}が願い事をしているようです`,
            'クリスマス': `🎄 クリスマスの特別な日に、美しい鳥たちの群れが聖なる空を舞っています。${witnessBird.name}がクリスマスの奇跡を感じているようです`
        };
        
        const eventContent = holidayEvents[specialDay.name] || 
            `${specialDay.emoji} ${specialDay.name}の特別な日に、祝福するような鳥たちの群れが空を舞っています。${witnessBird.name}が特別な日を感じているようです`;
        
        return {
            type: `特別通過イベント(${specialDay.name})`,
            content: eventContent,
            relatedBird: `${witnessBird.name} (見送り)`,
            isRareEvent: true,
            isSpecialDay: true,
            holiday: specialDay.name
        };
    }

    /**
     * 天気による特別通過イベント
     */
    async createWeatherFlyoverEvent(allBirds, weather) {
        const witnessBird = allBirds[Math.floor(Math.random() * allBirds.length)];
        const emoji = this.weatherManager.getWeatherEmoji(weather.condition);
        
        const weatherEvents = {
            sunny: [
                `${emoji} 快晴の青空に、鳥たちの群れが美しい編隊を組んで飛んでいます。${witnessBird.name}が青空の美しさに見とれています`,
                `${emoji} 太陽の光を浴びて、渡り鳥たちの羽が金色に輝いています。${witnessBird.name}が眩しそうに見上げています`
            ],
            stormy: [
                `${emoji} 嵐の合間を縫って、勇敢な鳥たちが空を駆け抜けていきます。${witnessBird.name}が心配そうに見守っています`,
                `${emoji} 激しい風の中を、力強く飛ぶ鳥たちの群れが通過していきます。${witnessBird.name}が勇気をもらっているようです`
            ]
        };
        
        const events = weatherEvents[weather.condition];
        if (!events) return null;
        
        const eventContent = events[Math.floor(Math.random() * events.length)];
        
        return {
            type: `天気通過イベント(${weather.condition})`,
            content: eventContent,
            relatedBird: `${witnessBird.name} (見送り)`,
            isRareEvent: true,
            weather: weather.condition
        };
    }

    /**
     * 昼間のイベント生成（通過イベント対応版）
     */
    async generateDaytimeEventWithFlyover(eventType, allBirds, guildId) {
        switch (eventType) {
            case 'flyover':
                return await this.createFlyoverEvent(allBirds);
            case 'special_flyover':
                return await this.createSpecialFlyoverEvent(allBirds);
            case 'weather_based':
                return await this.createWeatherBasedEvent(allBirds);
            case 'time_based':
                return await this.createTimeBasedEvent(allBirds);
            case 'seasonal':
                return await this.createSeasonalEvent(allBirds);
            case 'special_day':
                return await this.createSpecialDayEvent(allBirds);
            case 'temperature':
                return await this.createTemperatureEvent(allBirds);
            case 'wind':
                return await this.createWindEvent(allBirds);
            case 'humidity':
                return await this.createHumidityEvent(allBirds);
            case 'long_stay':
                return await this.createLongStayEvent(guildId, allBirds);
            case 'interaction':
                return this.createInteractionEvent(allBirds);
            case 'discovery':
                return this.createDiscoveryEvent(allBirds);
            default:
                return await this.createEvent(eventType, allBirds);
        }
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
    /**
     * 改良された自動管理開始
     */
    startAutomaticManagement() {
        console.log('🔄 改良された全サーバー鳥類園の自動管理を開始...');
        
        // 🔧 鳥の入れ替え（30分に1回チェック）
        const migrationTask = cron.schedule('*/30 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.checkBirdMigration(guildId);
            }
        }, { scheduled: false });

        // 🔧 活動更新（30分に1回）
        const activityTask = cron.schedule('*/30 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.updateBirdActivities(guildId);
            }
        }, { scheduled: false });

        // 🔧 空腹通知（15分に1回チェック）
        const hungerTask = cron.schedule('*/15 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                await this.checkHungerStatus(guildId);
            }
        }, { scheduled: false });

        // 🔧 自動保存（10分に1回）
        const saveTask = cron.schedule('*/10 * * * *', async () => {
            await this.saveAllServerZoos();
        }, { scheduled: false });

        // 🆕 改良されたランダムイベント（45分に1回、確率80%）
        const eventTask = cron.schedule('*/45 * * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                if (Math.random() < 0.8) {
                    await this.generateRandomEvent(guildId);
                }
            }
        }, { scheduled: false });

        // 🆕 特別な時間帯のイベント（6, 12, 18, 22時に実行、確率60%）
        const specialTimeTask = cron.schedule('0 6,12,18,22 * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                if (Math.random() < 0.6) {
                    const allBirds = this.getAllBirds(guildId);
                    if (allBirds.length > 0) {
                        const event = await this.createTimeBasedEvent(allBirds);
                        if (event) {
                            await this.addEvent(guildId, event.type, event.content, event.relatedBird);
                            console.log(`⏰ サーバー ${guildId} で特別時間帯イベント発生: ${event.type}`);
                        }
                    }
                }
            }
        }, { scheduled: false });

        // 🆕 記念日チェック（毎日0時に実行）
        const specialDayTask = cron.schedule('0 0 * * *', async () => {
            const specialDay = this.getSpecialDay();
            if (specialDay) {
                console.log(`🎉 今日は${specialDay.name}です！記念日イベントを増やします`);
                
                for (const guildId of this.serverZoos.keys()) {
                    const allBirds = this.getAllBirds(guildId);
                    if (allBirds.length > 0) {
                        const event = await this.createSpecialDayEvent(allBirds);
                        if (event) {
                            await this.addEvent(guildId, event.type, event.content, event.relatedBird);
                            console.log(`🎊 サーバー ${guildId} で記念日イベント発生: ${event.type}`);
                        }
                    }
                }
            }
        }, { scheduled: false });

        // 🆕 夜行性専用イベント（深夜1時に実行、確率40%）
        const nocturnalTask = cron.schedule('0 1 * * *', async () => {
            for (const guildId of this.serverZoos.keys()) {
                if (Math.random() < 0.4) {
                    const allBirds = this.getAllBirds(guildId);
                    const hasNocturnal = await this.hasNocturnalBirds(allBirds);
                    
                    if (hasNocturnal) {
                        const event = await this.createNocturnalSpecificEvent(allBirds);
                        if (event) {
                            await this.addEvent(guildId, event.type, event.content, event.relatedBird);
                            console.log(`🦉 サーバー ${guildId} で夜行性イベント発生: ${event.type}`);
                        }
                    }
                }
            }
        }, { scheduled: false });

        // タスク開始
        migrationTask.start();
        activityTask.start();
        hungerTask.start();
        saveTask.start();
        eventTask.start();
        specialTimeTask.start();
        specialDayTask.start();
        nocturnalTask.start();

        this.scheduledTasks = [
            migrationTask, activityTask, hungerTask, saveTask, 
            eventTask, specialTimeTask, specialDayTask, nocturnalTask
        ];
        
        console.log('✅ 改良された自動管理タスクを開始しました（8個のタスク）');
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

     /**
     * 包括的なランダムイベント生成（全Phase統合版）
     */
    /**
     * 改良されたランダムイベント生成（通過イベント追加版）
     */
    async generateRandomEvent(guildId) {
        try {
            const zooState = this.getZooState(guildId);
            if (!zooState.isInitialized) return;

            const allBirds = this.getAllBirds(guildId);
            if (allBirds.length === 0) return;

            const timeSlot = this.getCurrentTimeSlot();
            let event = null;

            console.log(`🎪 サーバー ${guildId} でランダムイベント生成開始 (${timeSlot.name})`);

            // 夜間の場合
            if (timeSlot.key === 'sleep') {
                const nightEventTypes = ['sleep', 'dream', 'night_watch', 'moon_phase'];
                
                const hasNocturnalBirds = await this.hasNocturnalBirds(allBirds);
                if (hasNocturnalBirds) {
                    nightEventTypes.push('nocturnal_specific', 'nocturnal_specific');
                }
                
                const eventType = nightEventTypes[Math.floor(Math.random() * nightEventTypes.length)];
                console.log(`🌙 夜間イベントタイプ: ${eventType}`);
                
                switch (eventType) {
                    case 'nocturnal_specific':
                        event = await this.createNocturnalSpecificEvent(allBirds);
                        break;
                    case 'moon_phase':
                        event = await this.createMoonPhaseEvent(allBirds);
                        break;
                    default:
                        event = await this.createNightEvent(eventType, allBirds);
                }
            } else {
                // 昼間の場合 - 通過イベントを追加
                const dayEventTypes = [
                    'interaction', 'discovery', 'weather_based', 'time_based', 
                    'seasonal', 'temperature', 'wind', 'humidity',
                    'flyover', 'special_flyover', 'long_stay' // 🆕 通過イベント追加
                ];
                
                // 渡りの季節ボーナス
                const migrationBonus = this.getSeasonalMigrationBonus();
                if (migrationBonus > 1.0) {
                    // 渡りの季節は通過イベントの確率を上げる
                    dayEventTypes.push('flyover', 'special_flyover');
                    console.log(`🦅 渡りの季節です！通過イベントの確率アップ (${migrationBonus}x)`);
                }
                
                const specialDay = this.getSpecialDay();
                if (specialDay) {
                    dayEventTypes.push('special_day', 'special_day', 'special_flyover');
                    console.log(`🎉 今日は${specialDay.name}です！`);
                }
                
                const longStayBirds = this.getLongStayBirds(guildId);
                if (longStayBirds.length > 0) {
                    dayEventTypes.push('long_stay', 'long_stay');
                }
                
                const eventType = dayEventTypes[Math.floor(Math.random() * dayEventTypes.length)];
                console.log(`☀️ 昼間イベントタイプ: ${eventType}`);
                
                event = await this.generateDaytimeEventWithFlyover(eventType, allBirds, guildId);
            }
            
            if (event) {
                await this.addEvent(guildId, event.type, event.content, event.relatedBird);
                
                if (event.isRareEvent) {
                    console.log(`⭐ サーバー ${guildId} でレアイベント発生: ${event.type} - ${event.relatedBird}`);
                } else {
                    console.log(`✅ サーバー ${guildId} でイベント発生: ${event.type} - ${event.relatedBird}`);
                }
            } else {
                console.log(`⚠️ サーバー ${guildId} でイベントが生成されませんでした`);
            }

        } catch (error) {
            console.error(`❌ サーバー ${guildId} のランダムイベント生成エラー:`, error);
        }
    }
}

module.exports = new ZooManager();
