// src/utils/nestNotificationSystem.js

const cron = require('node-cron');
const sheets = require('../../config/sheets');

class NestNotificationSystem {
    constructor() {
        this.client = null;
        this.isRunning = false;
    }

    // 初期化
    initialize(client) {
        this.client = client;
        this.startScheduler();
        console.log('✅ ネスト通知システムを初期化しました');
    }

    // スケジューラー開始
    startScheduler() {
        if (this.isRunning) return;

        // 毎日18:00に実行
        cron.schedule('0 18 * * *', async () => {
            console.log('🕕 夕方のネスト通知を開始します...');
            await this.sendEveningNotifications();
        }, {
            timezone: 'Asia/Tokyo'
        });

        this.isRunning = true;
        console.log('⏰ ネスト通知スケジューラーが開始されました (毎日18:00)');
    }

    // 夕方の通知送信
    async sendEveningNotifications() {
        try {
            // 全サーバーのネスト情報を取得
            const allNests = await this.getAllNestsData();
            
            console.log(`📊 ${allNests.length}個のネストに通知を送信中...`);

            for (const nest of allNests) {
                try {
                    await this.sendNestNotification(nest);
                    
                    // レート制限対策で少し待機
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`ネスト通知エラー (${nest.鳥名}):`, error);
                }
            }

            console.log('✅ 夕方のネスト通知完了');

        } catch (error) {
            console.error('夕方通知システムエラー:', error);
        }
    }

    // 全ネストデータ取得
    async getAllNestsData() {
        try {
            await sheets.ensureInitialized();
            
            const sheet = sheets.sheets.userNests;
            if (!sheet) return [];

            const rows = await sheet.getRows();
            
            return rows.map(row => ({
                ユーザーID: row.get('ユーザーID'),
                ユーザー名: row.get('ユーザー名'),
                鳥名: row.get('鳥名'),
                カスタム名: row.get('カスタム名') || '',
                ネストタイプ: row.get('ネストタイプ'),
                チャンネルID: row.get('チャンネルID'),
                サーバーID: row.get('サーバーID')
            })).filter(nest => nest.チャンネルID && nest.サーバーID);

        } catch (error) {
            console.error('ネストデータ取得エラー:', error);
            return [];
        }
    }

    // 個別ネスト通知送信
    async sendNestNotification(nest) {
        try {
            const channel = await this.client.channels.fetch(nest.チャンネルID);
            if (!channel) return;

            // 贈り物データを取得
            const gifts = await sheets.getBirdGifts(nest.鳥名, nest.サーバーID);
            const userGifts = gifts.filter(gift => gift.giverId === nest.ユーザーID);

            // 夕方の様子を生成
            const eveningActivity = this.generateEveningActivity(nest.鳥名, nest.ネストタイプ);
            const nestMood = this.generateEveningMood(nest.ネストタイプ, userGifts.length);

            const embed = {
                title: `🌅 ${nest.鳥名}の夕方の様子`,
                description: nestMood,
                color: this.getEveningColor(),
                fields: [
                    {
                        name: '🐦 今の様子',
                        value: eveningActivity,
                        inline: false
                    }
                ],
                timestamp: new Date(),
                footer: {
                    text: '毎日18:00の定期報告'
                }
            };

            // 特別なイベントをランダムで追加
            const specialEvent = this.generateSpecialEvent(nest.鳥名, nest.ネストタイプ, userGifts);
            if (specialEvent) {
                embed.fields.push({
                    name: '✨ 特別な出来事',
                    value: specialEvent,
                    inline: false
                });
            }

            // 贈り物への反応
            if (userGifts.length > 0) {
                const recentGift = userGifts[userGifts.length - 1]; // 最新の贈り物
                const giftReaction = this.generateGiftReaction(nest.鳥名, recentGift.name);
                
                embed.fields.push({
                    name: '💝 贈り物への反応',
                    value: giftReaction,
                    inline: false
                });
            }

            await channel.send({ embeds: [embed] });
            console.log(`📨 通知送信完了: ${nest.鳥名} (${nest.ユーザー名})`);

        } catch (error) {
            console.error(`個別通知エラー (${nest.鳥名}):`, error);
        }
    }

    // 夕方の活動生成
    generateEveningActivity(birdName, nestType) {
        const activities = {
            '蓮池の巣': [
                `${birdName}が夕日に照らされた池で静かに佇んでいます`,
                `${birdName}が蓮の花が閉じていく様子を眺めています`,
                `${birdName}が夕暮れの水面に映る自分の姿を見つめています`
            ],
            '苔むした庭': [
                `${birdName}が夕日で温まった苔の上でくつろいでいます`,
                `${birdName}が夜露に備えて羽を整えています`,
                `${birdName}が苔の間で夕涼みをしています`
            ],
            '花畑の巣': [
                `${birdName}が夕日に染まった花畑を散歩しています`,
                `${birdName}が閉じかけた花を優しく見守っています`,
                `${birdName}が花の香りを楽しみながら一日を振り返っています`
            ]
        };

        const typeActivities = activities[nestType] || [
            `${birdName}が夕日を眺めながらゆったりと過ごしています`,
            `${birdName}が一日の疲れを癒しています`,
            `${birdName}が平和な夕暮れ時を満喫しています`
        ];

        return typeActivities[Math.floor(Math.random() * typeActivities.length)];
    }

    // 夕方の雰囲気生成
    generateEveningMood(nestType, giftCount) {
        const baseMoods = {
            '蓮池の巣': '夕日が池面を金色に染め、蓮の花が静かに眠りにつく準備をしています。',
            '苔むした庭': '夕暮れの光が苔を優しく照らし、庭全体が温かな雰囲気に包まれています。',
            '花畑の巣': '夕日に照らされた花々が美しく輝き、甘い香りが夕風に乗って漂っています。'
        };

        return baseMoods[nestType] || '夕暮れの穏やかな時間が流れています。';
    }

    // 特別イベント生成（30%の確率）
    generateSpecialEvent(birdName, nestType, gifts) {
        if (Math.random() > 0.3) return null;

        const events = [
            `${birdName}が新しい場所を発見して喜んでいます`,
            `${birdName}が美しい羽根を見つけて大切にしまいました`,
            `${birdName}が小さな虫と友達になったようです`,
            `${birdName}が風に舞う花びらと踊っていました`,
            `${birdName}が雲の形を眺めて楽しんでいます`
        ];

        if (gifts.length > 0) {
            events.push(`${birdName}が贈り物を見つめて嬉しそうにしています`);
            events.push(`${birdName}が贈り物の配置を少し変えて楽しんでいます`);
        }

        return events[Math.floor(Math.random() * events.length)];
    }

    // 贈り物への反応生成
    generateGiftReaction(birdName, giftName) {
        const reactions = [
            `${birdName}は${giftName}をとても気に入っているようです`,
            `${birdName}が${giftName}の近くでよく過ごしています`,
            `${birdName}は${giftName}を見るたびに嬉しそうにしています`,
            `${birdName}が${giftName}を大切に眺めています`
        ];

        return reactions[Math.floor(Math.random() * reactions.length)];
    }

    // 夕方の色
    getEveningColor() {
        return 0xFF9800; // 夕日のオレンジ
    }

    // システム停止
    shutdown() {
        this.isRunning = false;
        console.log('🛑 ネスト通知システムを停止しました');
    }
}

module.exports = new NestNotificationSystem();
