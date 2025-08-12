const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sheets = require('../../config/sheets');

class BondLevelManager {
    constructor() {
        // 絆レベル必要回数（企画書通り）
        this.bondLevelRequirements = {
            1: 15,
            2: 35,   // +20
            3: 60,   // +25
            4: 90,   // +30
            // 以降は5回ずつ増加
        };
    }

    // 絆レベル必要回数を計算
    getRequiredFeedCount(targetLevel) {
        if (this.bondLevelRequirements[targetLevel]) {
            return this.bondLevelRequirements[targetLevel];
        }
        
        // レベル5以降は5回ずつ増加
        if (targetLevel >= 5) {
            let total = 90; // レベル4までの累計
            for (let level = 5; level <= targetLevel; level++) {
                total += 30 + (level - 4) * 5; // 30 + 5, 30 + 10, 30 + 15, ...
            }
            return total;
        }
        
        return 0;
    }

    // 絆餌やり回数を増加
    async incrementBondFeedCount(userId, userName, birdName, serverId) {
        try {
            // 現在の絆餌やり回数を取得
            const currentCount = await this.getBondFeedCount(userId, birdName, serverId);
            const newCount = currentCount + 1;

            // user_affinityシートを更新（絆餌やり回数列）
            await sheets.updateBondFeedCount(userId, birdName, newCount, serverId);

            console.log(`🔗 絆餌やり回数更新: ${userName} -> ${birdName} (${newCount}回)`);
            return newCount;

        } catch (error) {
            console.error('絆餌やり回数増加エラー:', error);
            return 0;
        }
    }

    // 現在の絆餌やり回数を取得
    async getBondFeedCount(userId, birdName, serverId) {
        try {
            const affinityData = await sheets.getUserAffinityData(userId, birdName, serverId);
            return parseInt(affinityData?.絆餌やり回数) || 0;
        } catch (error) {
            console.error('絆餌やり回数取得エラー:', error);
            return 0;
        }
    }

    // 現在の絆レベルを取得
    async getCurrentBondLevel(userId, birdName, serverId) {
        try {
            const affinityData = await sheets.getUserAffinityData(userId, birdName, serverId);
            return parseInt(affinityData?.絆レベル) || 0;
        } catch (error) {
            console.error('絆レベル取得エラー:', error);
            return 0;
        }
    }

    // 絆レベルアップをチェック
    async checkBondLevelUp(userId, userName, birdName, currentFeedCount, serverId, client) {
        try {
            const currentBondLevel = await this.getCurrentBondLevel(userId, birdName, serverId);
            const targetLevel = currentBondLevel + 1;
            const requiredCount = this.getRequiredFeedCount(targetLevel);

            console.log(`🔍 絆レベルチェック: ${birdName} (現在${currentBondLevel} -> 目標${targetLevel}, 必要${requiredCount}, 現在${currentFeedCount})`);

            if (currentFeedCount >= requiredCount) {
                // 絆レベルアップ！
                await this.processBondLevelUp(userId, userName, birdName, targetLevel, serverId, client);
                
                return {
                    leveledUp: true,
                    newLevel: targetLevel,
                    requiredCount: requiredCount
                };
            }

            return {
                leveledUp: false,
                currentLevel: currentBondLevel,
                nextLevel: targetLevel,
                currentCount: currentFeedCount,
                requiredCount: requiredCount
            };

        } catch (error) {
            console.error('絆レベルアップチェックエラー:', error);
            return { leveledUp: false };
        }
    }

    // 絆レベルアップ時の処理
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
            const ownedNests = await this.getUserOwnedNestTypes(userId, serverId);

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
            return areaNeststTypes.filter(nestType => !ownedNests.includes(nestType));

        } catch (error) {
            console.error('未所持ネスト取得エラー:', error);
            return [];
        }
    }

    // ユーザーの所持ネストタイプを取得
    async getUserOwnedNestTypes(userId, serverId) {
        try {
            const sheets = require('../../config/sheets');
            return await sheets.getUserOwnedNestTypes(userId, serverId);
        } catch (error) {
            console.error('所持ネスト取得エラー:', error);
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
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

            // 通知チャンネルに送信
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

    // 鳥のエリアを取得
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
            const sheets = require('../../config/sheets');
            
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
            const sheets = require('../../config/sheets');
            await sheets.logBondLevel(userId, userName, birdName, bondLevel, serverId);
        } catch (error) {
            console.error('絆レベル更新エラー:', error);
        }
    }

    // 現在の絆レベルを取得
    async getCurrentBondLevel(userId, birdName, serverId) {
        try {
            const sheets = require('../../config/sheets');
            return await sheets.getUserBondLevel(userId, birdName, serverId);
        } catch (error) {
            console.error('絆レベル取得エラー:', error);
            return 0;
        }
    }

    // 絆レベル特典をチェック
    async checkBondLevelRewards(userId, userName, birdName, bondLevel, serverId) {
        // 将来の拡張用（散歩ルート解放など）
        console.log(`🎁 絆レベル${bondLevel}特典チェック: ${birdName}`);
    }

    // 解放された機能を取得
    getUnlockedFeatures(bondLevel) {
        const features = [];
        if (bondLevel >= 1) features.push('ネスト建設');
        if (bondLevel >= 3) features.push('レア散歩ルート');
        if (bondLevel >= 5) features.push('特別散歩ルート');
        if (bondLevel >= 10) features.push('最高級散歩ルート');
        return features;
    }

    // 絆レベル別写真名を取得
    getBondLevelPhotoName(bondLevel) {
        const photoGifts = {
            1: '初めての絆の写真',
            3: '信頼の写真',
            5: '深い絆の写真',
            10: '魂の繋がりの写真',
            15: '永遠の瞬間の写真',
            20: '奇跡の写真'
        };
        return photoGifts[bondLevel] || null;
    }

    // 好感度レベル10をチェック
    async hasMaxAffinity(userId, birdName, serverId) {
        try {
            const sheets = require('../../config/sheets');
            const affinities = await sheets.getUserAffinity(userId, serverId);
            return affinities[birdName]?.level >= 10;
        } catch (error) {
            console.error('好感度チェックエラー:', error);
            return false;
        }
    }

    // ネスト建設可能かチェック
    async canBuildNest(userId, birdName, serverId) {
        const currentBondLevel = await this.getCurrentBondLevel(userId, birdName, serverId);
        return currentBondLevel >= 1;
    }
}

// シングルトンインスタンス
const bondLevelManager = new BondLevelManager();

module.exports = bondLevelManager;
