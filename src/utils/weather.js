const https = require('https');

class WeatherManager {
    constructor() {
        this.apiKey = process.env.WEATHER_API_KEY;
        this.location = process.env.WEATHER_LOCATION || 'Tokyo,JP';
        this.cache = null;
        this.cacheTime = null;
        this.cacheExpiry = 30 * 60 * 1000; // 30分キャッシュ
    }

    // 現在の天気を取得
    async getCurrentWeather() {
        try {
            // キャッシュチェック
            if (this.cache && this.cacheTime && (Date.now() - this.cacheTime) < this.cacheExpiry) {
                return this.cache;
            }

            const weatherData = await this.fetchWeatherData();
            
            // キャッシュ保存
            this.cache = weatherData;
            this.cacheTime = Date.now();
            
            return weatherData;
        } catch (error) {
            console.error('天気取得エラー:', error);
            return {
                condition: 'unknown',
                description: '天気情報取得不可',
                temperature: null
            };
        }
    }

    // APIから天気データ取得
    fetchWeatherData() {
        return new Promise((resolve, reject) => {
            if (!this.apiKey) {
                reject(new Error('WEATHER_API_KEY が設定されていません'));
                return;
            }

            const url = `https://api.openweathermap.org/data/2.5/weather?q=${this.location}&appid=${this.apiKey}&units=metric&lang=ja`;
            
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
                        
                        resolve({
                            condition: condition,
                            description: weather.weather[0].description,
                            temperature: Math.round(weather.main.temp),
                            humidity: weather.main.humidity,
                            windSpeed: weather.wind?.speed || 0
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    // 天気を4つのカテゴリに分類
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

    // 天気による鳥の行動傾向を取得
getBirdBehavior(condition) {
    const behaviors = {
        sunny: {
            mood: 'active',
            description: [
                '晴天で活発',
                '太陽の下で元気いっぱい', 
                '暖かい日差しを楽しんでいます',
                '青空の下で気持ちよさそう',
                '晴れた空に向かって歌っています'
            ],
            activityBonus: 1.2
        },
        rainy: {
            mood: 'calm',
            description: [
                '雨で静か',
                '雨宿り中でおとなしめ',
                '雨の音を楽しんでいるようです',
                '雨粒を避けて軒下に集合中',
                '雨上がりを心待ちにしています'
            ],
            activityBonus: 0.8
        },
        cloudy: {
            mood: 'normal',
            description: [
                '曇天で普通',
                '雲の隙間を気にしているようす',
                '曇り空でも元気に過ごしています',
                '涼しい雲陰を喜んでいるようです',
                '時々空を見上げています'
            ],
            activityBonus: 1.0
        },
        snowy: {
            mood: 'sleepy',
            description: [
                '雪で眠そう',
                '雪景色に見とれています',
                '雪の結晶を不思議そうに見ています',
                '雪の中でも元気に過ごしています',
                '雪玉で遊んでいるようです'
            ],
            activityBonus: 0.7
        },
        stormy: {
            mood: 'hiding',
            description: [
                '嵐で隠れている',
                '安全な場所で嵐をやり過ごしています',
                '風に負けずに踏ん張っています',
                '嵐が去るのを待っています',
                '仲間と寄り添って嵐をしのいでいます'
            ],
            activityBonus: 0.5
        },
        foggy: {
            mood: 'mysterious',
            description: [
                '霧で神秘的',
                '霧の中をゆっくり移動しています',
                '霧に包まれて幻想的です',
                '霧の向こうを探索しています',
                '霧の静寂を楽しんでいるようです'
            ],
            activityBonus: 0.9
        }
    };

    const behavior = behaviors[condition] || behaviors.cloudy;
    
    // descriptionが配列の場合はランダム選択
    if (Array.isArray(behavior.description)) {
        const randomIndex = Math.floor(Math.random() * behavior.description.length);
        behavior.description = behavior.description[randomIndex];
    }
    
    return behavior;
}

    // 天気絵文字を取得
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
}

module.exports = new WeatherManager();
