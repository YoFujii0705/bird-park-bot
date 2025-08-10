// WeatherManager.js - 鳥類園Bot用天気管理システム

const https = require('https');

class WeatherManager {
    constructor() {
        this.apiKey = process.env.WEATHER_API_KEY;
        this.location = process.env.WEATHER_LOCATION || 'Tokyo,JP';
        this.cache = null;
        this.cacheTime = null;
        this.cacheExpiry = 30 * 60 * 1000; // 30分キャッシュ
        
        console.log(`🌤️ WeatherManager初期化: 地域=${this.location}, APIキー=${this.apiKey ? '設定済み' : '未設定'}`);
    }

    // ===========================================
    // 🌤️ 基本的な天気取得機能
    // ===========================================

    /**
     * 現在の天気を取得（メインメソッド）
     */
    async getCurrentWeather() {
        try {
            // キャッシュチェック
            if (this.cache && this.cacheTime && (Date.now() - this.cacheTime) < this.cacheExpiry) {
                console.log('🌤️ 天気データ: キャッシュから取得');
                return this.cache;
            }

            console.log('🌤️ 天気データ: APIから新規取得');
            const weatherData = await this.fetchWeatherData();
            
            // キャッシュ保存
            this.cache = weatherData;
            this.cacheTime = Date.now();
            
            console.log(`🌤️ 天気取得成功: ${weatherData.condition} (${weatherData.temperature}°C)`);
            return weatherData;
            
        } catch (error) {
            console.error('❌ 天気取得エラー:', error.message);
            
            // フォールバックデータを返す
            return this.getFallbackWeather();
        }
    }

    /**
     * APIから天気データ取得
     */
    fetchWeatherData() {
        return new Promise((resolve, reject) => {
            if (!this.apiKey) {
                reject(new Error('WEATHER_API_KEY が設定されていません'));
                return;
            }

            const url = `https://api.openweathermap.org/data/2.5/weather?q=${this.location}&appid=${this.apiKey}&units=metric&lang=ja`;
            
            console.log(`🌐 OpenWeatherMap API呼び出し: ${this.location}`);
            
            https.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const weather = JSON.parse(data);
                        
                        if (weather.cod !== 200) {
                            reject(new Error(`API Error: ${weather.message}`));
                            return;
                        }

                        const condition = this.categorizeWeather(weather.weather[0].main, weather.weather[0].id);
                        
                        const weatherData = {
                            condition: condition,
                            description: weather.weather[0].description,
                            temperature: Math.round(weather.main.temp),
                            humidity: weather.main.humidity,
                            windSpeed: weather.wind?.speed || 0,
                            pressure: weather.main.pressure,
                            visibility: weather.visibility ? Math.round(weather.visibility / 1000) : null,
                            cloudiness: weather.clouds?.all || 0,
                            sunrise: new Date(weather.sys.sunrise * 1000),
                            sunset: new Date(weather.sys.sunset * 1000),
                            cityName: weather.name,
                            country: weather.sys.country,
                            timestamp: new Date(),
                            source: 'api'
                        };
                        
                        resolve(weatherData);
                        
                    } catch (error) {
                        reject(new Error(`JSON解析エラー: ${error.message}`));
                    }
                });
                
            }).on('error', (error) => {
                reject(new Error(`HTTP通信エラー: ${error.message}`));
            });
        });
    }

    /**
     * フォールバック天気データ（API失敗時）
     */
    getFallbackWeather() {
        const now = new Date();
        const hour = now.getHours();
        const month = now.getMonth() + 1;
        
        // 時間と季節に基づく仮想天気
        let condition = 'cloudy';
        let temperature = 20;
        let description = '曇り';
        
        // 季節による基本気温設定
        if (month >= 12 || month <= 2) {
            temperature = Math.random() < 0.7 ? Math.floor(Math.random() * 10) + 2 : Math.floor(Math.random() * 5) + 12; // 冬: 2-12°C or 12-17°C
        } else if (month >= 3 && month <= 5) {
            temperature = Math.floor(Math.random() * 15) + 10; // 春: 10-25°C
        } else if (month >= 6 && month <= 8) {
            temperature = Math.floor(Math.random() * 15) + 20; // 夏: 20-35°C
        } else {
            temperature = Math.floor(Math.random() * 15) + 12; // 秋: 12-27°C
        }
        
        // 時間による天気傾向
        if (hour >= 6 && hour <= 18) {
            const rand = Math.random();
            if (rand < 0.4) {
                condition = 'sunny';
                description = '晴れ';
            } else if (rand < 0.7) {
                condition = 'cloudy';
                description = '曇り';
            } else {
                condition = 'rainy';
                description = '雨';
                temperature -= 3; // 雨の日は涼しい
            }
        } else {
            condition = 'cloudy';
            description = '曇り';
            temperature -= 2; // 夜は涼しい
        }
        
        console.log(`🌤️ フォールバック天気生成: ${description} (${temperature}°C)`);
        
        return {
            condition: condition,
            description: description,
            temperature: temperature,
            humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
            windSpeed: Math.random() * 10, // 0-10 m/s
            pressure: Math.floor(Math.random() * 100) + 1000, // 1000-1100 hPa
            visibility: Math.floor(Math.random() * 10) + 5, // 5-15 km
            cloudiness: Math.floor(Math.random() * 100), // 0-100%
            sunrise: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0),
            sunset: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0),
            cityName: 'Tokyo',
            country: 'JP',
            timestamp: new Date(),
            source: 'fallback'
        };
    }

    // ===========================================
    // 🌤️ 天気分類・解析機能
    // ===========================================

    /**
     * 天気を6つのカテゴリに分類
     */
    categorizeWeather(main, id) {
        // OpenWeatherMap の条件IDに基づく分類
        if (id >= 200 && id < 300) return 'stormy';   // 雷雨
        if (id >= 300 && id < 600) return 'rainy';    // 雨・霧雨
        if (id >= 600 && id < 700) return 'snowy';    // 雪
        if (id >= 700 && id < 800) return 'foggy';    // 霧・もや
        if (id === 800) return 'sunny';               // 快晴
        if (id > 800) return 'cloudy';                // 曇り
        
        return 'unknown';
    }

    /**
     * 天気による鳥の行動傾向を取得
     */
    getBirdBehavior(condition) {
        const behaviors = {
            sunny: {
                mood: 'active',
                description: [
                    '晴天で活発',
                    '太陽の下で元気いっぱい', 
                    '暖かい日差しを楽しんでいます',
                    '青空の下で気持ちよさそう',
                    '晴れた空に向かって歌っています',
                    '日光浴を満喫しています',
                    '暖かさに誘われて活動的です'
                ],
                activityBonus: 1.3,
                feedingBonus: 1.1
            },
            rainy: {
                mood: 'calm',
                description: [
                    '雨で静か',
                    '雨宿り中でおとなしめ',
                    '雨の音を楽しんでいるようです',
                    '雨粒を避けて軒下に集合中',
                    '雨上がりを心待ちにしています',
                    '雨に濡れないよう上手に過ごしています',
                    '雨の日の特別な静けさを味わっています'
                ],
                activityBonus: 0.7,
                feedingBonus: 0.9
            },
            cloudy: {
                mood: 'normal',
                description: [
                    '曇天で普通',
                    '雲の隙間を気にしているようす',
                    '曇り空でも元気に過ごしています',
                    '涼しい雲陰を喜んでいるようです',
                    '時々空を見上げています',
                    '穏やかな曇り空を楽しんでいます',
                    '雲の流れを眺めています'
                ],
                activityBonus: 1.0,
                feedingBonus: 1.0
            },
            snowy: {
                mood: 'sleepy',
                description: [
                    '雪で眠そう',
                    '雪景色に見とれています',
                    '雪の結晶を不思議そうに見ています',
                    '雪の中でも元気に過ごしています',
                    '雪玉で遊んでいるようです',
                    '雪化粧した世界を堪能しています',
                    '雪の静寂を楽しんでいます'
                ],
                activityBonus: 0.6,
                feedingBonus: 1.2
            },
            stormy: {
                mood: 'hiding',
                description: [
                    '嵐で隠れている',
                    '安全な場所で嵐をやり過ごしています',
                    '風に負けずに踏ん張っています',
                    '嵐が去るのを待っています',
                    '仲間と寄り添って嵐をしのいでいます',
                    '嵐の迫力に圧倒されています',
                    '安全第一で身を守っています'
                ],
                activityBonus: 0.4,
                feedingBonus: 0.8
            },
            foggy: {
                mood: 'mysterious',
                description: [
                    '霧で神秘的',
                    '霧の中をゆっくり移動しています',
                    '霧に包まれて幻想的です',
                    '霧の向こうを探索しています',
                    '霧の静寂を楽しんでいるようです',
                    '神秘的な霧の世界を満喫しています',
                    '霧の中の特別な雰囲気を味わっています'
                ],
                activityBonus: 0.8,
                feedingBonus: 0.95
            }
        };

        const behavior = behaviors[condition] || behaviors.cloudy;
        
        // descriptionが配列の場合はランダム選択
        if (Array.isArray(behavior.description)) {
            const randomIndex = Math.floor(Math.random() * behavior.description.length);
            behavior.selectedDescription = behavior.description[randomIndex];
        } else {
            behavior.selectedDescription = behavior.description;
        }
        
        return behavior;
    }

    /**
     * 天気絵文字を取得
     */
    getWeatherEmoji(condition) {
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
     * 気温による分類
     */
    getTemperatureCategory(temperature) {
        if (temperature < 0) return { category: '氷点下', emoji: '🥶' };
        if (temperature < 5) return { category: '厳寒', emoji: '❄️' };
        if (temperature < 10) return { category: '寒冷', emoji: '🌨️' };
        if (temperature < 15) return { category: '涼しい', emoji: '🌤️' };
        if (temperature < 20) return { category: '快適', emoji: '😊' };
        if (temperature < 25) return { category: '暖かい', emoji: '🌞' };
        if (temperature < 30) return { category: '温暖', emoji: '☀️' };
        if (temperature < 35) return { category: '暑い', emoji: '🔥' };
        return { category: '酷暑', emoji: '🌡️' };
    }

    /**
     * 風速による分類
     */
    getWindCategory(windSpeed) {
        if (windSpeed < 1) return { category: '無風', emoji: '🍃' };
        if (windSpeed < 3) return { category: 'そよ風', emoji: '🌿' };
        if (windSpeed < 7) return { category: '軽風', emoji: '🌾' };
        if (windSpeed < 12) return { category: '軟風', emoji: '🌸' };
        if (windSpeed < 20) return { category: '強風', emoji: '💨' };
        return { category: '暴風', emoji: '🌪️' };
    }

    /**
     * 湿度による分類
     */
    getHumidityCategory(humidity) {
        if (humidity < 30) return { category: '乾燥', emoji: '🏜️' };
        if (humidity < 50) return { category: '快適', emoji: '😌' };
        if (humidity < 70) return { category: 'やや高湿度', emoji: '💧' };
        if (humidity < 85) return { category: '高湿度', emoji: '🌫️' };
        return { category: '多湿', emoji: '💦' };
    }

    // ===========================================
    // 🌤️ 詳細情報・統計機能
    // ===========================================

    /**
     * 詳細な天気情報を取得
     */
    async getDetailedWeather() {
        const weather = await this.getCurrentWeather();
        
        return {
            ...weather,
            temperatureInfo: this.getTemperatureCategory(weather.temperature),
            windInfo: this.getWindCategory(weather.windSpeed),
            humidityInfo: this.getHumidityCategory(weather.humidity),
            birdBehavior: this.getBirdBehavior(weather.condition),
            emoji: this.getWeatherEmoji(weather.condition)
        };
    }

    /**
     * 天気統計情報
     */
    getWeatherStats() {
        return {
            cacheStatus: {
                hasCache: !!this.cache,
                cacheAge: this.cacheTime ? Math.floor((Date.now() - this.cacheTime) / 1000) : null,
                cacheExpiry: Math.floor(this.cacheExpiry / 1000)
            },
            configuration: {
                location: this.location,
                hasApiKey: !!this.apiKey,
                apiKeyLength: this.apiKey ? this.apiKey.length : 0
            },
            lastWeather: this.cache ? {
                condition: this.cache.condition,
                temperature: this.cache.temperature,
                source: this.cache.source,
                timestamp: this.cache.timestamp
            } : null
        };
    }

    /**
     * キャッシュクリア
     */
    clearCache() {
        console.log('🌤️ 天気キャッシュをクリアしました');
        this.cache = null;
        this.cacheTime = null;
    }

    /**
     * 設定情報の確認
     */
    validateConfiguration() {
        const issues = [];
        
        if (!this.apiKey) {
            issues.push('WEATHER_API_KEY が設定されていません');
        }
        
        if (!this.location) {
            issues.push('WEATHER_LOCATION が設定されていません');
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues,
            config: {
                location: this.location,
                hasApiKey: !!this.apiKey,
                cacheExpiry: this.cacheExpiry
            }
        };
    }

    // ===========================================
    // 🌤️ テスト・デバッグ機能
    // ===========================================

    /**
     * WeatherManager機能テスト
     */
    async testWeatherManager() {
        console.log('🧪 WeatherManager機能テスト開始...');
        
        const results = {
            timestamp: new Date().toISOString(),
            tests: {}
        };

        try {
            // 1. 設定確認テスト
            console.log('📍 設定確認テスト...');
            const configValidation = this.validateConfiguration();
            results.tests.configuration = {
                success: configValidation.isValid,
                result: configValidation,
                message: configValidation.isValid ? '設定は正常です' : `設定に問題があります: ${configValidation.issues.join(', ')}`
            };

            // 2. 天気取得テスト
            console.log('📍 天気取得テスト...');
            const weather = await this.getCurrentWeather();
            results.tests.weatherFetch = {
                success: !!weather,
                result: weather,
                message: weather ? `天気取得成功: ${weather.condition} (${weather.source})` : '天気取得失敗'
            };

            // 3. 詳細情報テスト
            console.log('📍 詳細情報テスト...');
            const detailedWeather = await this.getDetailedWeather();
            results.tests.detailedWeather = {
                success: !!detailedWeather,
                result: detailedWeather,
                message: detailedWeather ? `詳細情報取得成功` : '詳細情報取得失敗'
            };

            // 4. 分類機能テスト
            console.log('📍 分類機能テスト...');
            const behavior = this.getBirdBehavior(weather.condition);
            const emoji = this.getWeatherEmoji(weather.condition);
            results.tests.categorization = {
                success: !!(behavior && emoji),
                result: { behavior, emoji },
                message: `分類成功: ${weather.condition} → ${emoji} (${behavior.mood})`
            };

            console.log('✅ WeatherManager機能テスト完了');
            results.overall = { success: true, message: 'すべてのテストが完了しました' };

        } catch (error) {
            console.error('❌ WeatherManagerテストエラー:', error);
            results.overall = { success: false, message: `テスト中にエラーが発生: ${error.message}` };
        }

        return results;
    }
}

module.exports = new WeatherManager();
