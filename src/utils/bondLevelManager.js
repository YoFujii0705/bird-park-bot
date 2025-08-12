const sheetsManager = require('../../config/sheets');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class BondLevelManager {
    constructor() {
        // 企画書通りの段階的増加（15→20→25→30→35...）
        this.bondLevelRequirements = {};
        this.calculateBondLevelRequirements();
    }

    // 絆レベル必要回数を計算
    calculateBondLevelRequirements() {
        let totalRequired = 0;
        
        for (let level = 1; level <= 50; level++) { // 十分な上限を設定
            let requiredForThisLevel;
            
            if (level === 1) {
                requiredForThisLevel = 15;
            } else if (level === 2) {
                requiredForThisLevel = 20;
            } else if (level === 3) {
                requiredForThisLevel = 25;
            } else if (level === 4) {
                requiredForThisLevel = 30;
            } else {
                // レベル5以降は5回ずつ増加
                requiredForThisLevel = 30 + (level - 4) * 5;
            }
            
            totalRequired += requiredForThisLevel;
            this.bondLevelRequirements[level] = totalRequired;
        }
        
        console.log('🔗 絆レベル必要回数テーブル作成完了');
    }

    // 現在の絆レベルを取得
    async getCurrentBondLevel(userId, birdName, serverId) {
        try {
            const bondData = await sheetsManager.getUserBondLevel(userId, birdName, serverId);
            return bondData || { bondLevel: 0, bondFeedCount: 0 };
        } catch (error) {
            console.error('絆レベル取得エラー:', error);
            return { bondLevel: 0, bondFeedCount: 0 };
        }
    }

    // 🔧 feed.jsとの競合を避けるため、このメソッドは削除
    // processBondLevel は feed.js で直接実装されているため、
    // ここでは計算ロジックとユーティリティ機能のみ提供

    // 絆レベル特典をチェック
    async checkBondLevelRewards(userId, userName, birdName, bondLevel, serverId) {
        try {
            console.log(`🎁 絆レベル${bondLevel}特典チェック - ${birdName}`);
            
            // きりのいいレベルで「写真」確定入手
            if (bondLevel % 5 === 0 || bondLevel === 1 || bondLevel === 3 || bondLevel === 10) {
                const photoName = this.getBondLevelPhotoName(bondLevel);
                
                // gifts_inventoryに写真を追加
                await sheetsManager.logGiftInventory(
                    userId, userName, photoName, 1,
                    `${birdName}との絆レベル${bondLevel}達成特典`,
                    serverId
                );
                
                console.log(`📸 ${userName}が${photoName}を獲得しました`);
            }
            
        } catch (error) {
            console.error('絆レベル特典チェックエラー:', error);
        }
    }

    // 絆レベル別写真名を取得
    getBondLevelPhotoName(bondLevel) {
        const photoNames = {
            1: '初めての絆の写真',
            3: '信頼の写真',
            5: '深い絆の写真',
            10: '魂の繋がりの写真',
            15: '永遠の瞬間の写真',
            20: '奇跡の写真',
            25: '運命の写真',
            30: '無限の愛の写真'
        };
        
        return photoNames[bondLevel] || `絆レベル${bondLevel}の記念写真`;
    }

    // 解放された機能を取得
    getUnlockedFeatures(bondLevel) {
        const features = [];
        
        if (bondLevel >= 1) {
            features.push('🏠 ネスト建設');
        }
        if (bondLevel >= 3) {
            features.push('🚶 レア散歩ルート');
        }
        if (bondLevel >= 5) {
            features.push('🌟 特別散歩ルート');
        }
        if (bondLevel >= 10) {
            features.push('👑 最高級散歩ルート');
        }
        
        return features;
    }

    // ネスト建設可能かチェック
    async canBuildNest(userId, birdName, serverId) {
        try {
            const currentBond = await this.getCurrentBondLevel(userId, birdName, serverId);
            return currentBond.bondLevel >= 1;
        } catch (error) {
            console.error('ネスト建設可能チェックエラー:', error);
            return false;
        }
    }

    // 好感度レベル10達成済みかチェック
    async hasMaxAffinity(userId, birdName, serverId) {
        try {
            const affinities = await sheetsManager.getUserAffinity(userId, serverId);
            const birdAffinity = affinities[birdName];
            return birdAffinity && birdAffinity.level >= 10;
        } catch (error) {
            console.error('好感度チェックエラー:', error);
            return false;
        }
    }

    // 絆レベル要件を取得
    getRequiredFeedsForBondLevel(targetBondLevel) {
        return this.bondLevelRequirements[targetBondLevel] || 999999;
    }

    // 絆レベルアップ時の処理を拡張
    async processBondLevelUp(userId, userName, birdName, newBondLevel, serverId, client) {
        try {
            console.log(`🌟 絆レベルアップ処理: ${userName} -> ${birdName} (レベル${newBondLevel})`);

            // 1. データベースに絆レベルを記録
            await this.updateBondLevel(userId, userName, birdName, newBondLevel, serverId);

            // 2. ネストガチャを発動（レベル1以上で毎回）
            if (newBondLevel >= 1) {
                await this.triggerNestGacha(userId, userName, birdName, newBondLevel, serverId, client);
            }

            // 3. 特別な報酬（写真など）
            if (this.isSpecialBondLevel(newBondLevel)) {
                await this.grantSpecialBondReward(userId, userName, birdName, newBondLevel, serverId);
            }

            return {
                success: true,
                newLevel: newBondLevel,
                nestGachaTriggered: newBondLevel >= 1
            };

        } catch (error) {
            console.error('絆レベルアップ処理エラー:', error);
            throw error;
        }
    }

    // ネストガチャを発動
    async triggerNestGacha(userId, userName, birdName, bondLevel, serverId, client) {
        try {
            console.log(`🎰 ネストガチャ発動: ${birdName} (絆レベル${bondLevel})`);

            // 鳥のエリアを取得
            const birdArea = this.getBirdArea(birdName, serverId);
            
            // そのエリアの未所持ネストを取得
            const availableNests = await this.getAvailableNestsForArea(userId, birdArea, serverId);
            
            if (availableNests.length === 0) {
                console.log(`❌ ${birdArea}エリアの未所持ネストがありません`);
                return;
            }

            // ランダムに3種類選択（重複なし）
            const nestOptions = this.selectRandomNests(availableNests, 3);

            // ガチャ結果をDiscordで表示
            await this.displayNestGacha(userId, userName, birdName, bondLevel, birdArea, nestOptions, serverId, client);

        } catch (error) {
            console.error('ネストガチャエラー:', error);
        }
    }

    // エリア別の未所持ネスト取得
    async getAvailableNestsForArea(userId, area, serverId) {
        try {
            // 現在の所持ネストリストを取得
            const userNests = await sheets.getUserNests(userId, serverId);
            const ownedNestTypes = userNests.map(nest => nest.ネストタイプ);

            // エリア別ネストタイプ定義
            const nestTypes = {
                森林: [
                    '苔むした庭', '古木の大穴', '木漏れ日の巣', '妖精の隠れ家',
                    '樹海の宮殿', 'きのこの家', '蔦の回廊', '森の神殿'
                ],
                草原: [
                    '花畑の巣', '軒先の鳥かご', '風車小屋', '蝶の舞台',
                    '虹の丘', '星見台', '花冠の宮殿', 'そよ風の家'
                ],
                水辺: [
                    '蓮池の巣', '滝のしぶきの巣', '真珠の洞窟', '虹の水辺',
                    '水晶の泉', '貝殻の宮殿', '流木の隠れ家', '月光の池'
                ]
            };

            const areaNeststTypes = nestTypes[area] || nestTypes.森林;
            
            // 未所持のネストタイプのみ返す
            return areaNeststTypes.filter(nestType => !ownedNestTypes.includes(nestType));

        } catch (error) {
            console.error('未所持ネスト取得エラー:', error);
            return [];
        }
    }

    // ランダムにネストを選択
    selectRandomNests(availableNests, count) {
        const shuffled = [...availableNests].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, availableNests.length));
    }

    // ネストガチャをDiscordで表示
    async displayNestGacha(userId, userName, birdName, bondLevel, area, nestOptions, serverId, client) {
        try {
            // ガチャ画面のEmbed
            const embed = {
                title: `🌟 絆レベル${bondLevel}達成！ネスト解放ガチャ 🏠`,
                description: `**${birdName}**との絆が深まり、${area}エリアの新しいネストが解放されました！\n\n以下の3つから1つを選んでください：`,
                color: 0xFF6B6B,
                fields: nestOptions.map((nestType, index) => ({
                    name: `${index + 1}. ${nestType}`,
                    value: this.getNestDescription(nestType),
                    inline: false
                })),
                footer: {
                    text: `${userName}さん専用 | 絆レベル${bondLevel}報酬`
                },
                timestamp: new Date().toISOString()
            };

            // 選択ボタンを作成
            const buttons = nestOptions.map((nestType, index) => 
                new ButtonBuilder()
                    .setCustomId(`nest_gacha_${index}_${userId}_${birdName}_${nestType}_${bondLevel}`)
                    .setLabel(`${index + 1}. ${nestType}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🏠')
            );

            const row = new ActionRowBuilder().addComponents(buttons);

            // 専用チャンネルまたはメインチャンネルに送信
            const channel = await this.getNotificationChannel(serverId, client);
            if (channel) {
                await channel.send({
                    content: `<@${userId}> 🎉`,
                    embeds: [embed],
                    components: [row]
                });
            }

        } catch (error) {
            console.error('ネストガチャ表示エラー:', error);
        }
    }

    // ネストの簡単な説明を取得
    getNestDescription(nestType) {
        const descriptions = {
            // 森林エリア
            '苔むした庭': '静寂に包まれた緑豊かな庭園',
            '古木の大穴': '長い歴史を刻んだ古木の洞',
            '木漏れ日の巣': '美しい光と影が踊る森の巣',
            '妖精の隠れ家': '小さな妖精たちに守られた秘密の場所',
            '樹海の宮殿': '深い森の奥にある神秘的な宮殿',
            'きのこの家': '巨大なきのこの中の不思議な住まい',
            '蔦の回廊': '蔦に覆われた美しい回廊',
            '森の神殿': '森の精霊が宿る神聖な神殿',

            // 草原エリア
            '花畑の巣': '色鮮やかな花々に囲まれた華やかな巣',
            '軒先の鳥かご': '職人の技が光る美しい鳥かご',
            '風車小屋': '風の歌声が響く牧歌的な小屋',
            '蝶の舞台': '蝶々と一緒に舞い踊る特別な舞台',
            '虹の丘': '虹がかかる美しい丘の上の巣',
            '星見台': '満天の星空を眺められる特別な場所',
            '花冠の宮殿': '花の冠に包まれた優雅な宮殿',
            'そよ風の家': 'やわらかな風に包まれた心地よい家',

            // 水辺エリア
            '蓮池の巣': '静かな池のほとりの美しい巣',
            '滝のしぶきの巣': '爽やかな滝のしぶきに包まれた巣',
            '真珠の洞窟': '真珠の輝きに満ちた幻想的な洞窟',
            '虹の水辺': '虹色に輝く神秘的な水辺',
            '水晶の泉': '透明な水晶のように美しい泉',
            '貝殻の宮殿': '美しい貝殻で装飾された海の宮殿',
            '流木の隠れ家': '自然の造形美が光る流木の家',
            '月光の池': '月光に照らされた幻想的な池'
        };

        return descriptions[nestType] || '特別なネスト';
    }

    // 通知チャンネルを取得
    async getNotificationChannel(serverId, client) {
        try {
            const guild = client.guilds.cache.get(serverId);
            if (!guild) return null;

            // 専用ネストカテゴリ内のチャンネルを優先
            const nestCategory = guild.channels.cache.find(
                channel => channel.name === '🏠 専用ネスト' && channel.type === 4
            );

            if (nestCategory) {
                const nestChannels = guild.channels.cache.filter(
                    channel => channel.parentId === nestCategory.id && channel.type === 0
                );
                if (nestChannels.size > 0) {
                    return nestChannels.first();
                }
            }

            // フォールバック: 鳥類園チャンネル
            return guild.channels.cache.find(
                channel => channel.name.includes('鳥類園') || channel.name.includes('zoo')
            ) || guild.systemChannel;

        } catch (error) {
            console.error('通知チャンネル取得エラー:', error);
            return null;
        }
    }

    // 鳥のエリアを取得（nestSystem.jsから移植）
    getBirdArea(birdName, guildId) {
        try {
            // zooManagerから取得を試行
            try {
                const zooManager = require('./zooManager');
                const zooState = zooManager.getZooState(guildId);
                
                for (const area of ['森林', '草原', '水辺']) {
                    const bird = zooState[area]?.find(b => 
                        b.name === birdName || b.name.includes(birdName) || birdName.includes(b.name)
                    );
                    if (bird) {
                        return area;
                    }
                }
            } catch (zooError) {
                console.log('zooManagerが見つからないため、鳥名からエリアを推定します');
            }
            
            // 鳥名から推定
            const waterBirds = ['カモ', 'サギ', 'アホウドリ', 'ペリカン', 'ウミネコ', 'カワセミ'];
            const forestBirds = ['キツツキ', 'フクロウ', 'ヤマガラ', 'ウグイス', 'キビタキ'];
            
            if (waterBirds.some(bird => birdName.includes(bird))) {
                return '水辺';
            } else if (forestBirds.some(bird => birdName.includes(bird))) {
                return '森林';
            }
            
            return '森林'; // デフォルト
        } catch (error) {
            console.error('鳥エリア取得エラー:', error);
            return '森林';
        }
    }

    // 特別な絆レベルかチェック
    isSpecialBondLevel(level) {
        return [1, 3, 5, 10, 15, 20].includes(level);
    }

    // 特別な絆レベル報酬を付与
    async grantSpecialBondReward(userId, userName, birdName, bondLevel, serverId) {
        try {
            // 写真の贈り物を付与
            const photoGifts = {
                1: '初めての絆の写真',
                3: '信頼の写真',
                5: '深い絆の写真',
                10: '魂の繋がりの写真',
                15: '永遠の瞬間の写真',
                20: '奇跡の写真'
            };

            const photoName = photoGifts[bondLevel];
            if (photoName) {
                await sheets.logGift(
                    birdName,           // giver (鳥から)
                    userId,             // receiver
                    photoName,          // gift name
                    `${birdName}との絆レベル${bondLevel}達成記念`, // caption
                    serverId
                );

                console.log(`📸 特別報酬付与: ${userName} <- ${photoName} (絆レベル${bondLevel})`);
            }

        } catch (error) {
            console.error('特別報酬付与エラー:', error);
        }
    }

    // データベースに絆レベルを更新
    async updateBondLevel(userId, userName, birdName, bondLevel, serverId) {
        try {
            // スプレッドシートに絆レベル情報を記録
            await sheets.logBondLevel(userId, userName, birdName, bondLevel, serverId);
        } catch (error) {
            console.error('絆レベル更新エラー:', error);
        }
    }
}

// シングルトンインスタンス
const bondLevelManager = new BondLevelManager();

module.exports = bondLevelManager;
