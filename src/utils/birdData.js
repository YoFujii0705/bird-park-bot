const sheetsManager = require('../../config/sheets');

class BirdDataManager {
    constructor() {
        this.birds = [];
        this.initialized = false;
    }

    // 初期化
    async initialize() {
        try {
            this.birds = await sheetsManager.getBirds();
            this.initialized = true;
            console.log(`✅ 鳥データを読み込みました: ${this.birds.length}種`);
        } catch (error) {
            console.error('鳥データ初期化エラー:', error);
            this.initialized = false;
        }
    }

    // データ再読み込み
    async refresh() {
        await this.initialize();
    }

    // 全鳥データ取得
    getAllBirds() {
        return this.birds;
    }

    // ランダムな鳥を取得
    getRandomBird() {
        if (this.birds.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * this.birds.length);
        return this.birds[randomIndex];
    }

    // 複数のランダムな鳥を取得
    getRandomBirds(count) {
        if (this.birds.length === 0) return [];
        
        const shuffled = [...this.birds].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, this.birds.length));
    }

    // 条件に合う鳥を検索
    searchBirds(conditions) {
        return this.birds.filter(bird => {
            return Object.entries(conditions).every(([key, value]) => {
                if (!value || !bird[key]) return true;
                
                // 複数値対応（カンマ区切り）
                const birdValues = bird[key].split('、').map(v => v.trim());
                const searchValues = value.split('、').map(v => v.trim());
                
                return searchValues.some(searchValue => 
                    birdValues.some(birdValue => 
                        birdValue.includes(searchValue) || searchValue.includes(birdValue)
                    )
                );
            });
        });
    }

// より堅牢な季節検索（様々なデータ形式に対応）
getBirdsBySeason(season) {
    return this.birds.filter(bird => {
        if (!bird.季節) return false;
        
        // 季節データを正規化
        const seasonData = bird.季節.toString().toLowerCase();
        const targetSeason = season.toLowerCase();
        
        // 様々なパターンでマッチングを試行
        const patterns = [
            // 1. 単純な部分一致
            () => seasonData.includes(targetSeason),
            
            // 2. 区切り文字で分割してチェック
            () => {
                const seasons = seasonData.split(/[、,\s\-\/]+/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
                return seasons.some(s => s.includes(targetSeason) || targetSeason.includes(s));
            },
            
            // 3. より緩い一致（ひらがな・カタカナ混在対応）
            () => {
                const normalizedSeason = seasonData.replace(/[ヶケ]/g, '').replace(/\s+/g, '');
                const normalizedTarget = targetSeason.replace(/[ヶケ]/g, '').replace(/\s+/g, '');
                return normalizedSeason.includes(normalizedTarget);
            }
        ];
        
        // いずれかのパターンでマッチすればOK
        return patterns.some(pattern => {
            try {
                return pattern();
            } catch (error) {
                console.warn(`パターンマッチングエラー: ${bird.名前}`, error);
                return false;
            }
        });
    });
}

// 季節データの形式を調査するメソッド
analyzeSeasonDataFormats() {
    console.log('=== 季節データ形式分析 ===');
    
    const formats = {};
    const examples = {};
    
    this.birds.forEach(bird => {
        if (bird.季節) {
            const format = this.categorizeSeasonFormat(bird.季節);
            formats[format] = (formats[format] || 0) + 1;
            
            if (!examples[format]) {
                examples[format] = [];
            }
            if (examples[format].length < 3) {
                examples[format].push(`${bird.名前}: "${bird.季節}"`);
            }
        }
    });
    
    console.log('\n📊 季節データ形式の分布:');
    Object.entries(formats).forEach(([format, count]) => {
        console.log(`  ${format}: ${count}件`);
        console.log(`    例: ${examples[format].join(', ')}`);
    });
    
    return { formats, examples };
}

// 季節データの形式を分類
categorizeSeasonFormat(seasonStr) {
    const str = seasonStr.toString();
    
    if (str.includes('、')) return '全角カンマ区切り';
    if (str.includes(',')) return '半角カンマ区切り';
    if (str.includes('-')) return 'ハイフン区切り';
    if (str.includes('/')) return 'スラッシュ区切り';
    if (str.includes(' ')) return 'スペース区切り';
    if (str.length === 1) return '単一季節';
    
    return 'その他の形式';
}

    // 環境に合う鳥を取得
    getBirdsByEnvironment(environment) {
        return this.birds.filter(bird => {
            const environments = bird.環境.split('、').map(e => e.trim());
            return environments.includes(environment);
        });
    }

    // 渡り区分で鳥を取得
    getBirdsByMigration(migration) {
        return this.birds.filter(bird => bird.渡り区分 === migration);
    }

    // 鳥類園用のエリア別鳥取得
    getBirdsForZooArea(area) {
        const areaMapping = {
            '森林': ['森林', '高山'],
            '草原': ['農耕地', '草地', '裸地', '市街・住宅地'],
            '水辺': ['河川・湖沼', '海']
        };

        const environments = areaMapping[area] || [];
        return this.birds.filter(bird => {
            const birdEnvironments = bird.環境.split('、').map(e => e.trim());
            return environments.some(env => birdEnvironments.includes(env));
        });
    }

    // 今日の季節を取得
    getCurrentSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return '春';
        if (month >= 6 && month <= 8) return '夏';
        if (month >= 9 && month <= 11) return '秋';
        return '冬';
    }

// 今日の鳥を取得（季節に合った鳥・日付ベース固定）- 改良版
getTodaysBird() {
    const currentSeason = this.getCurrentSeason();
    const seasonalBirds = this.getBirdsBySeason(currentSeason);
    
    if (seasonalBirds.length === 0) {
        return this.getRandomBird();
    }
    
    // より確実な日付ベースのシード生成
    const today = new Date();
    // エポック時間からの日数を計算（より確実な一意性）
    const epochStart = new Date('2020-01-01').getTime();
    const todayTime = today.getTime();
    const daysSinceEpoch = Math.floor((todayTime - epochStart) / (1000 * 60 * 60 * 24));
    
    console.log(`🗓️ DEBUG - エポックからの日数: ${daysSinceEpoch}`);
    
    // より良いハッシュ関数を使用
    const seed = this.betterHash(daysSinceEpoch.toString());
    console.log(`🎲 DEBUG - シード値: ${seed}`);
    
    // シードベースのランダム選択
    const randomIndex = Math.abs(seed) % seasonalBirds.length;
    console.log(`🎯 DEBUG - インデックス: ${randomIndex} / ${seasonalBirds.length}`);
    console.log(`🌸 DEBUG - 現在の季節: ${currentSeason}`);
    console.log(`🐦 DEBUG - 季節の鳥リスト: ${seasonalBirds.map(b => b.名前).join(', ')}`);
    
    const selectedBird = seasonalBirds[randomIndex];
    console.log(`✨ DEBUG - 選ばれた鳥: ${selectedBird.名前}`);
    
    return selectedBird;
}

// より良いハッシュ関数
betterHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash;
}

// デバッグ用：複数日のシミュレーション
simulateMultipleDays(days = 10) {
    console.log('=== 複数日シミュレーション ===');
    const results = [];
    
    for (let i = 0; i < days; i++) {
        const testDate = new Date();
        testDate.setDate(testDate.getDate() + i);
        
        // 一時的に日付を変更してテスト
        const originalGetTime = Date.prototype.getTime;
        Date.prototype.getTime = () => testDate.getTime();
        
        const bird = this.getTodaysBird();
        results.push({
            date: testDate.toLocaleDateString('ja-JP'),
            bird: bird?.名前
        });
        
        // 元に戻す
        Date.prototype.getTime = originalGetTime;
    }
    
    console.table(results);
    
    // 重複チェック
    const birdCounts = {};
    results.forEach(r => {
        birdCounts[r.bird] = (birdCounts[r.bird] || 0) + 1;
    });
    
    console.log('🔍 鳥の出現回数:');
    console.table(birdCounts);
    
    return results;
}

// 現在の季節データの詳細確認
debugSeasonalData() {
    const currentSeason = this.getCurrentSeason();
    const seasonalBirds = this.getBirdsBySeason(currentSeason);
    
    console.log('=== 季節データ詳細 ===');
    console.log(`現在の季節: ${currentSeason}`);
    console.log(`全鳥数: ${this.birds.length}`);
    console.log(`季節該当鳥数: ${seasonalBirds.length}`);
    
    console.log('\n季節該当鳥一覧:');
    seasonalBirds.forEach((bird, index) => {
        console.log(`${index}: ${bird.名前} (季節: ${bird.季節})`);
    });
    
    // アオバズクの情報を確認
    const aobazuku = this.birds.find(b => b.名前.includes('アオバズク'));
    if (aobazuku) {
        console.log('\n🦉 アオバズクの詳細:');
        console.log(`名前: ${aobazuku.名前}`);
        console.log(`季節: ${aobazuku.季節}`);
        console.log(`環境: ${aobazuku.環境}`);
    }
    
    return {
        currentSeason,
        totalBirds: this.birds.length,
        seasonalBirds: seasonalBirds.length,
        birds: seasonalBirds.map(b => b.名前)
    };
}

    // テーマガチャ用のランダム属性組み合わせ
    getRandomTheme() {
        const themes = {
            色: ['茶系', '白系', '黒系', '赤系', '黄系', '青系', '緑系', '灰系'],
            季節: ['春', '夏', '秋', '冬'],
            環境: ['市街・住宅地', '河川・湖沼', '農耕地', '海', '森林', '草地', '裸地', '高山'],
            渡り区分: ['夏鳥', '冬鳥', '留鳥', '漂鳥', '旅鳥'],
            全長区分: ['小', '中', '大', '特大']
        };

        const selectedThemes = {};
        const themeKeys = Object.keys(themes);
        const numThemes = Math.floor(Math.random() * 2) + 2; // 2-3個のテーマ

        for (let i = 0; i < numThemes; i++) {
            const randomKey = themeKeys[Math.floor(Math.random() * themeKeys.length)];
            if (!selectedThemes[randomKey]) {
                const values = themes[randomKey];
                selectedThemes[randomKey] = values[Math.floor(Math.random() * values.length)];
            }
        }

        return selectedThemes;
    }

    // 鳥の好物チェック（修正版）
    getFoodPreference(birdName, food) {
        // Discord表記からスプレッドシート表記への変換
        const foodMapping = {
            '種子': '麦',
            '蜜': '花蜜'
        };
        
        // 変換が必要な場合は変換
        const mappedFood = foodMapping[food] || food;
        
        // 部分一致で鳥を検索（feed.jsと同じロジック）
        const bird = this.birds.find(b => 
            b.名前.includes(birdName) || birdName.includes(b.名前)
        );
        
        if (!bird) {
            console.log(`⚠️ 鳥が見つかりません: ${birdName}`);
            return 'unknown';
        }
        
        console.log(`🔍 鳥発見: ${bird.名前}, 餌: ${mappedFood}`);
        
        // 好物チェック（全角・半角両方の区切り文字に対応）
        const favorites = bird.好物 ? bird.好物.split(/[、,]/).map(f => f.trim()) : [];
        console.log(`❤️ 好物: ${favorites.join(', ')}`);
        
        // 食べられる餌チェック（全角・半角両方の区切り文字に対応）
        const acceptable = bird.食べられる餌 ? bird.食べられる餌.split(/[、,]/).map(f => f.trim()) : [];
        console.log(`😊 食べられる餌: ${acceptable.join(', ')}`);
        
        // 絵文字除去して比較
        const cleanMappedFood = mappedFood.replace(/[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
        console.log(`🔍 DEBUG - 絵文字除去後の餌: "${cleanMappedFood}"`);
        
        // 好物チェック
        for (const fav of favorites) {
            const cleanFav = fav.replace(/[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
            console.log(`🔍 DEBUG - 絵文字除去後の好物: "${cleanFav}"`);
            
            if (cleanFav === cleanMappedFood || fav === mappedFood) {
                console.log(`✨ ${mappedFood}は好物です！`);
                return 'favorite';
            }
        }
        
        // 食べられる餌チェック
        for (const acc of acceptable) {
            const cleanAcc = acc.replace(/[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
            
            if (cleanAcc === cleanMappedFood || acc === mappedFood) {
                console.log(`😊 ${mappedFood}は食べられる餌です`);
                return 'acceptable';
            }
        }
        
        console.log(`😐 ${mappedFood}はあまり好きではないようです`);
        return 'dislike';
    }

    // 統計情報
    getStats() {
        return {
            total: this.birds.length,
            bySize: this.countBy('全長区分'),
            byColor: this.countBy('色'),
            bySeason: this.countBy('季節'),
            byMigration: this.countBy('渡り区分'),
            byEnvironment: this.countBy('環境')
        };
    }

    // 属性別カウント
    countBy(attribute) {
        const counts = {};
        this.birds.forEach(bird => {
            if (bird[attribute]) {
                const values = bird[attribute].split('、').map(v => v.trim());
                values.forEach(value => {
                    counts[value] = (counts[value] || 0) + 1;
                });
            }
        });
        return counts;
    }
}

module.exports = new BirdDataManager();
