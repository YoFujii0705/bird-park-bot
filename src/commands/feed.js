const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');
const sheetsManager = require('../../config/sheets');
const achievementHelper = require('../utils/achievementHelper'); // 🆕 追加

// 🎁 人間から鳥への贈り物（人工的・意図的なもの）
const HUMAN_TO_BIRD_GIFTS = {
    森林: [
        '綺麗なビー玉', '小さな鈴', '色とりどりのリボン', 
        '手作りの巣箱', '特別な枝', '小さな鏡',
        '美しい羽根飾り', '手編みの小さな巣材'
    ],
    草原: [
        '花で編んだ花冠', 'カラフルなビーズ', '小さな風車',
        '手作りの草笛', '色鮮やかな紐', '小さな鈴',
        '羽根でできたお守り', '花の種のネックレス'
    ],
    水辺: [
        '磨いた貝殻', '美しいガラス玉', '小さな流木アート',
        '手作りの水草飾り', '綺麗に磨いた石', '貝殻の風鈴',
        '水晶のペンダント', '真珠のような玉'
    ],
    共通: [
        '虹色のリボン', 'ハート型の小石', '特別な羽根',
        '手作りのお守り', '光る小さな宝石', '音の鳴る玩具',
        '温かい毛糸', '小さな楽器'
    ]
};

// 🌿 鳥から人間への贈り物（自然由来・偶然の発見）
const BIRD_TO_HUMAN_GIFTS = {
    森林: [
        'どんぐり', '美しい羽根', '珍しい木の実', 
        '苔の付いた小枝', '森の小石', '不思議な種',
        '朽ちた美しい木片', '虫食いの葉っぱ（芸術的）',
        '鳥が集めた小さな宝物', '森で見つけた化石'
    ],
    草原: [
        '花の種', '美しい小石', '蝶の羽根（自然に落ちたもの）',
        'クローバー', '草で編んだ輪', '露で濡れた花びら',
        '風に飛ばされた美しい葉', '草原の小さな貝殻化石',
        '鳥が見つけた古い硬貨', '自然に形作られた小枝'
    ],
    水辺: [
        '美しい貝殻', '丸い小石', '流木',
        '水草', '小さな巻貝', '波で磨かれたガラス片',
        '川底の美しい砂', '水に濡れた美しい羽根',
        '鳥が拾った真珠', '水辺で見つけた琥珀色の石'
    ],
    特別: [
        '虹色の羽根', 'ハート型の自然石', '四つ葉のクローバー',
        '天然の水晶', '古い時代のコイン', '隕石の欠片',
        '化石化した木の実', '自然に穴の開いた石',
        '完璧な巻貝', '二股に分かれた小枝'
    ]
};

// 🎨 キャプション生成も分ける
const HUMAN_GIFT_CAPTIONS = {
    感謝: [
        '(鳥名)はこの(贈り物名)をとても気に入ったようです。(ユーザー名)からもらった大切な宝物',
        '(鳥名)が(贈り物名)を大切そうに眺めています。(ユーザー名)への感謝の気持ちでいっぱいです',
        '(贈り物名)を受け取った(鳥名)は幸せそうに鳴いています。(ユーザー名)との絆がより深まりました'
    ],
    愛用: [
        '(鳥名)は(贈り物名)をいつも身につけています。(ユーザー名)からの愛情を感じながら',
        '(贈り物名)は(鳥名)のお気に入りになりました。(ユーザー名)を思い出す特別なアイテム',
        '(鳥名)が(贈り物名)で遊んでいます。(ユーザー名)との楽しい思い出と共に'
    ],
    誇り: [
        '(鳥名)は(贈り物名)を他の鳥に自慢しているようです。(ユーザー名)からの特別な贈り物',
        '(贈り物名)を身につけた(鳥名)は誇らしげです。(ユーザー名)との特別な関係の証',
        '(鳥名)は(贈り物名)を宝物のように大切にしています。(ユーザー名)への愛情の表れ'
    ]
};

const BIRD_GIFT_MESSAGES = {
    発見: [
        '(鳥名)が(エリア)で(贈り物名)を見つけて、あなたにプレゼントしました！',
        '(鳥名)が散歩中に発見した(贈り物名)。きっとあなたが喜ぶと思ったのでしょう',
        '(エリア)を探索していた(鳥名)が、特別な(贈り物名)を見つけて贈ってくれました'
    ],
    感謝: [
        '(鳥名)があなたへの感謝の気持ちを込めて(贈り物名)を贈っています',
        'いつも美味しい餌をくれるあなたに、(鳥名)が(贈り物名)をプレゼント！',
        '(鳥名)があなたとの友情の証として(贈り物名)を差し出しています'
    ],
    偶然: [
        '(鳥名)が偶然見つけた美しい(贈り物名)。なぜかあなたに渡したくなったようです',
        '(贈り物名)を見た瞬間、(鳥名)はあなたのことを思い浮かべました',
        '(鳥名)が(贈り物名)を見つけた時、直感的にあなたへの贈り物だと感じたようです'
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('feed')
        .setDescription('鳥類園の鳥に餌をあげます🍽️')
        .addStringOption(option =>
            option.setName('bird')
                .setDescription('餌をあげる鳥の名前')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('food')
                .setDescription('あげる餌の種類')
                .addChoices(
                    { name: '🌾 麦', value: '麦' },
                    { name: '🐛 虫', value: '虫' },
                    { name: '🐟 魚', value: '魚' },
                    { name: '🍯 花蜜', value: '花蜜' },
                    { name: '🥜 木の実', value: '木の実' },
                    { name: '🌿 青菜', value: '青菜' },
                    { name: '🐁 ねずみ', value: 'ねずみ' }
                )
                .setRequired(true)),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            
            const sleepCheck = this.checkBirdSleepTime();
            if (sleepCheck.isSleeping) {
                await interaction.reply({
                    content: sleepCheck.message,
                    ephemeral: true
                });
                return;
            }

            if (!birdData.initialized) {
                await interaction.reply({
                    content: '🔄 鳥データを読み込み中です...少々お待ちください',
                    ephemeral: true
                });
                await birdData.initialize();
            }

            const zooManager = require('../utils/zooManager');
            await zooManager.initializeServer(guildId);

            const birdName = interaction.options.getString('bird');
            const food = interaction.options.getString('food');

            const birdInfo = this.findBirdInZoo(birdName, guildId);
            
            if (!birdInfo) {
                await interaction.reply({
                    content: `🔍 "${birdName}" は現在この鳥類園にいないようです。\n\`/zoo view\` で現在いる鳥を確認してください。`,
                    ephemeral: true
                });
                return;
            }

            const cooldownResult = this.checkFeedingCooldown(birdInfo.bird, interaction.user.id);
            if (!cooldownResult.canFeed) {
                await interaction.reply({
                    content: `⏰ ${birdInfo.bird.name}にはまだ餌をあげられません。\n次回餌やり可能時刻: ${cooldownResult.nextFeedTime}`,
                    ephemeral: true
                });
                return;
            }

            const preference = birdData.getFoodPreference(birdName, food);
            const feedResult = this.processFeedingResult(birdInfo, food, preference, interaction.user);

            this.updateBirdAfterFeeding(birdInfo.bird, food, preference, interaction.user.id);

            // 🆕 好感度システム処理
            const affinityResult = await this.processAffinity(
                interaction.user.id, 
                interaction.user.username, 
                birdInfo.bird.name, 
                preference, 
                guildId
            );

            const embed = this.createFeedingResultEmbed(birdInfo, food, feedResult, affinityResult);
            await interaction.reply({ embeds: [embed] });

            await logger.logFeedWithServer(
                interaction.user.id,
                interaction.user.username,
                birdName,
                food,
                feedResult.effect,
                interaction.guild.id
            );

            // 🆕 称号チェック & 通知
            setTimeout(async () => {
                const newAchievements = await achievementHelper.checkAndNotifyAchievements(
                    interaction,
                    interaction.user.id,
                    interaction.user.username,
                    guildId
                );
                
                if (newAchievements.length > 0) {
                    console.log(`🏆 ${interaction.user.username}が${newAchievements.length}個の称号を獲得しました`);
                }
            }, 1500); // 1.5秒後に称号チェック

            // 🆕 思い出システム - 餌やり後の思い出チェック
            setTimeout(async () => {
                const memoryManager = require('../utils/humanMemoryManager');
                
                // 餌やりアクションデータを構築
                const actionData = {
                    type: 'feed',
                    preference: preference,
                    food: food,
                    isFirstTime: bird.feedCount === 1,
                    isFirstFavorite: preference === 'favorite' && !bird.feedHistory.some(h => h.preference === 'favorite'),
                    weather: this.getCurrentWeather(), // 天気情報
                    hour: new Date().getHours(),
                    totalFeeds: bird.feedCount,
                    details: {
                        food: food,
                        area: birdInfo.area,
                        effect: feedResult.effect
                    }
                };
                
                // 思い出生成をチェック
                const newMemory = await memoryManager.createMemory(
                    interaction.user.id,
                    interaction.user.username,
                    birdInfo.bird.name,
                    actionData,
                    guildId
                );
                
                // 思い出が生成された場合は通知
                if (newMemory) {
                    await memoryManager.sendMemoryNotification(interaction, newMemory);
                }
                
            }, 7000); // 7秒後に思い出チェック

            // 🆕 好感度アップ時の思い出生成
            if (affinityResult.levelUp) {
                setTimeout(async () => {
                    const memoryManager = require('../utils/humanMemoryManager');
                    
                    const affinityActionData = {
                        type: 'affinity',
                        newLevel: affinityResult.newLevel,
                        previousLevel: affinityResult.previousLevel,
                        details: {
                            newLevel: affinityResult.newLevel,
                            birdName: birdInfo.bird.name
                        }
                    };
                    
                    const affinityMemory = await memoryManager.createMemory(
                        interaction.user.id,
                        interaction.user.username,
                        birdInfo.bird.name,
                        affinityActionData,
                        guildId
                    );
                    
                    if (affinityMemory) {
                        await memoryManager.sendMemoryNotification(interaction, affinityMemory);
                    }
                    
                }, 8000); // 8秒後

            // 🆕 鳥からユーザーへの贈り物チェック
            setTimeout(async () => {
                if (affinityResult && affinityResult.newLevel >= 5) {
                    const birdGift = await this.checkBirdGiftToUser(
                        interaction,
                        interaction.user.id,
                        interaction.user.username,
                        birdInfo.bird.name,
                        affinityResult.newLevel,
                        birdInfo.area,
                        guildId
                    );
                    
                    if (birdGift) {
                        await this.sendBirdGiftNotification(interaction, birdInfo.bird.name, birdGift);
                    }
                }
            }, 3500); // 3.5秒後に贈り物チェック

            this.checkForSpecialEvents(birdInfo, food, preference, interaction, guildId);

            // 🆕 好感度MAXになった場合の贈り物通知（ユーザーから鳥への贈り物解放）
            if (affinityResult.levelUp && affinityResult.newLevel >= 5) {
                await this.sendAffinityMaxNotification(interaction, birdInfo.bird.name, birdInfo.area);
            }

            await zooManager.saveServerZoo(guildId);

        } catch (error) {
            console.error('餌やりコマンドエラー:', error);
            await logger.logError('餌やりコマンド', error, {
                userId: interaction.user.id,
                birdName: interaction.options.getString('bird'),
                food: interaction.options.getString('food'),
                guildId: interaction.guild.id
            });

            const errorMessage = '餌やりの実行中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 🆕 改良版好感度処理メソッド
    async processAffinity(userId, userName, birdName, preference, serverId) {
        try {
            // 現在の好感度を取得
            const affinities = await sheetsManager.getUserAffinity(userId, serverId);
            const currentAffinity = affinities[birdName] || { level: 0, feedCount: 0 };
            
            // 餌やり回数を増加（小数点対応）
            let feedIncrement = 1;
            
            // 好物の場合は1.5倍ボーナス
            if (preference === 'favorite') {
                feedIncrement = 1.5;
            }
            
            let newFeedCount = currentAffinity.feedCount + feedIncrement;
            let newLevel = currentAffinity.level;
            let levelUp = false;
            
            // レベルアップ判定（最大レベル10）
            while (newLevel < 10) {
                const requiredFeeds = this.getRequiredFeedsForLevel(newLevel + 1);
                
                if (newFeedCount >= requiredFeeds) {
                    newLevel++;
                    levelUp = true;
                } else {
                    break;
                }
            }
            
            // スプレッドシートに記録（小数点は四捨五入）
            await sheetsManager.logAffinity(userId, userName, birdName, newLevel, Math.round(newFeedCount * 10) / 10, serverId);
            
            return {
                levelUp,
                newLevel,
                newFeedCount: Math.round(newFeedCount * 10) / 10,
                previousLevel: currentAffinity.level,
                feedIncrement,
                requiredForNext: newLevel < 10 ? this.getRequiredFeedsForLevel(newLevel + 1) : null
            };
            
        } catch (error) {
            console.error('好感度処理エラー:', error);
            return { levelUp: false, newLevel: 0, newFeedCount: 1, previousLevel: 0 };
        }
    },

    // 🆕 レベル別必要餌やり回数計算（滞在期間考慮版）
    getRequiredFeedsForLevel(targetLevel) {
        const levelRequirements = {
            1: 2,      // レベル0→1: 2回
            2: 4,      // レベル1→2: 2回追加 (累計4回)
            3: 7,      // レベル2→3: 3回追加 (累計7回)
            4: 11,     // レベル3→4: 4回追加 (累計11回)
            5: 16,     // レベル4→5: 5回追加 (累計16回) ← 贈り物解放
            6: 22,     // レベル5→6: 6回追加 (累計22回)
            7: 29,     // レベル6→7: 7回追加 (累計29回)
            8: 37,     // レベル7→8: 8回追加 (累計37回)
            9: 46,     // レベル8→9: 9回追加 (累計46回)
            10: 56     // レベル9→10: 10回追加 (累計56回)
        };
        
        return levelRequirements[targetLevel] || 999;
    },

    async checkBirdGiftToUser(interaction, userId, userName, birdName, affinityLevel, area, guildId) {
    try {
        // 好感度が5以上の場合のみ贈り物チャンス
        if (affinityLevel < 5) return null;
        
        // 贈り物確率
        let giftChance = 0;
        if (affinityLevel >= 5) giftChance = 0.30; // 30%
        if (affinityLevel >= 6) giftChance = 0.35; // 35%
        if (affinityLevel >= 7) giftChance = 0.45; // 45%
        if (affinityLevel >= 8) giftChance = 0.55; // 55%
        if (affinityLevel >= 9) giftChance = 0.65; // 65%
        if (affinityLevel >= 10) giftChance = 0.75; // 75%
        
        console.log(`🎲 ${birdName}(好感度${affinityLevel}) 贈り物チャンス: ${(giftChance * 100).toFixed(0)}%`);
        
        // ランダムチェック
        const roll = Math.random();
        console.log(`🎯 ロール結果: ${(roll * 100).toFixed(1)}% (必要: ${(giftChance * 100).toFixed(0)}%以下)`);
        
        if (roll > giftChance) {
            console.log(`❌ 贈り物なし (${(roll * 100).toFixed(1)}% > ${(giftChance * 100).toFixed(0)}%)`);
            return null;
        }
        
        // 🔧 鳥→人間用の贈り物カテゴリから選択
        const areaGifts = BIRD_TO_HUMAN_GIFTS[area] || [];
        const specialGifts = BIRD_TO_HUMAN_GIFTS.特別;
        
        // 好感度が高いほど特別な贈り物の確率が上がる
        let giftPool = [...areaGifts];
        if (affinityLevel >= 8) {
            giftPool = [...giftPool, ...specialGifts];
        }
        
        const selectedGift = giftPool[Math.floor(Math.random() * giftPool.length)];
        
        // bird_gifts_receivedに記録
        await sheetsManager.logBirdGiftReceived(
            userId, userName, birdName, selectedGift, affinityLevel, area, guildId
        );
        
        console.log(`🎁 ${birdName}が${userName}に${selectedGift}をプレゼント！（bird_gifts_receivedシートに記録）`);
        
        return {
            giftName: selectedGift,
            message: this.generateBirdGiftMessage(birdName, selectedGift, area)
        };
        
    } catch (error) {
        console.error('鳥からの贈り物チェックエラー:', error);
        return null;
    }
},
    // 3. 鳥→人間の贈り物メッセージ生成
generateBirdGiftMessage(birdName, giftName, area) {
    const messages = {
        森林: [
            `${birdName}が森の奥で${giftName}を見つけて、あなたにプレゼントしました！`,
            `${birdName}が${giftName}を見つけて、嬉しそうにあなたに差し出しています。`,
            `森を散歩していた${birdName}が発見した${giftName}。あなたへの感謝の気持ちです。`,
            `${birdName}が木々の間で${giftName}を見つけました。きっとあなたが喜ぶと思ったのでしょう。`
        ],
        草原: [
            `${birdName}が草原で${giftName}を見つけて、あなたにくれました！`,
            `${birdName}が${giftName}をくちばしに咥えて、あなたの前に置きました。`,
            `風に吹かれる草原で、${birdName}が${giftName}を見つけて贈ってくれました。`,
            `${birdName}が花畑を歩いていて偶然見つけた${giftName}。あなたとの友情の証です。`
        ],
        水辺: [
            `${birdName}が水辺で拾った${giftName}をあなたにプレゼント！`,
            `${birdName}が清らかな水辺で見つけた${giftName}。大切な友達への贈り物です。`,
            `波打ち際で${birdName}が発見した${giftName}。あなたとの絆の証です。`,
            `${birdName}が水面に映る${giftName}を見つけて、そっと拾ってくれました。`
        ]
    };
    
    const areaMessages = messages[area] || messages.森林;
    return areaMessages[Math.floor(Math.random() * areaMessages.length)];
},

    // 🆕 贈り物通知の送信
    async sendBirdGiftNotification(interaction, birdName, giftInfo) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🎁 鳥からの贈り物！')
                .setDescription(giftInfo.message)
                .addFields({
                    name: '🎊 受け取った贈り物',
                    value: `${this.getGiftEmojiFromName(giftInfo.giftName)} **${giftInfo.giftName}**`,
                    inline: false
                })
                .setColor(0x87CEEB)
                .setFooter({ text: `${birdName}からの心のこもった贈り物です` })
                .setTimestamp();

            setTimeout(() => {
                interaction.followUp({ embeds: [embed] });
            }, 4000); // 4秒後に送信

        } catch (error) {
            console.error('鳥からの贈り物通知エラー:', error);
        }
    },

    // 4. 贈り物名から絵文字取得（鳥→人間用）
getGiftEmojiFromName(giftName) {
    const emojiMap = {
        // 森林の自然物
        'どんぐり': '🌰',
        '美しい羽根': '🪶',
        '珍しい木の実': '🫐',
        '苔の付いた小枝': '🌿',
        '森の小石': '🪨',
        '不思議な種': '🌱',
        '朽ちた美しい木片': '🪵',
        '虫食いの葉っぱ（芸術的）': '🍃',
        '鳥が集めた小さな宝物': '💎',
        '森で見つけた化石': '🦕',
        
        // 草原の自然物
        '花の種': '🌱',
        '美しい小石': '🪨',
        '蝶の羽根（自然に落ちたもの）': '🦋',
        'クローバー': '🍀',
        '草で編んだ輪': '⭕',
        '露で濡れた花びら': '🌸',
        '風に飛ばされた美しい葉': '🍃',
        '草原の小さな貝殻化石': '🐚',
        '鳥が見つけた古い硬貨': '🪙',
        '自然に形作られた小枝': '🌿',
        
        // 水辺の自然物
        '美しい貝殻': '🐚',
        '丸い小石': '🪨',
        '流木': '🪵',
        '水草': '🌊',
        '小さな巻貝': '🐌',
        '波で磨かれたガラス片': '🔮',
        '川底の美しい砂': '⏳',
        '水に濡れた美しい羽根': '🪶',
        '鳥が拾った真珠': '🤍',
        '水辺で見つけた琥珀色の石': '🟡',
        
        // 特別な自然物
        '虹色の羽根': '🌈',
        'ハート型の自然石': '💖',
        '四つ葉のクローバー': '🍀',
        '天然の水晶': '💎',
        '古い時代のコイン': '🪙',
        '隕石の欠片': '☄️',
        '化石化した木の実': '🌰',
        '自然に穴の開いた石': '🕳️',
        '完璧な巻貝': '🐚',
        '二股に分かれた小枝': '🌿'
    };
    
    return emojiMap[giftName] || '🎁';
},

    // 🆕 改良版好感度MAX通知（レベル5から）
    // 1. sendAffinityMaxNotification メソッド内
async sendAffinityMaxNotification(interaction, birdName, area) {
    try {
        // 🔧 人間→鳥用の贈り物カテゴリから選択
        const areaGifts = HUMAN_TO_BIRD_GIFTS[area] || [];
        const commonGifts = HUMAN_TO_BIRD_GIFTS.共通;
        const allGifts = [...areaGifts, ...commonGifts];
        
        const randomGift = allGifts[Math.floor(Math.random() * allGifts.length)];
        
        const embed = new EmbedBuilder()
            .setTitle('💖 深い絆が生まれました！')
            .setDescription(`**${birdName}**があなたを真の友達として認めました！\n\n🎁 **${birdName}**のことを考えながら歩いていると**${randomGift}**を贈ってあげようと思い立ちました！\n\nさっそく${birdName}に贈り物をしましょう。\n\`/gift bird:${birdName}\` で贈り物をしてみましょう！`)
            .setColor(0xFF69B4)
            .setTimestamp();

        // gifts_inventoryに記録（人間→鳥用アイテム）
        await sheetsManager.logGiftInventory(
            interaction.user.id,
            interaction.user.username,
            randomGift,
            1,
            `${birdName}との深い絆で獲得(好感度5)`,
            interaction.guild.id
        );

        setTimeout(() => {
            interaction.followUp({ embeds: [embed] });
        }, 2000);

    } catch (error) {
        console.error('好感度MAX通知エラー:', error);
    }
},
    
    findBirdInZoo(birdName, guildId) {
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState(guildId);
        
        for (const area of ['森林', '草原', '水辺']) {
            const bird = zooState[area].find(b => 
                b.name.includes(birdName) || birdName.includes(b.name)
            );
            if (bird) {
                return { bird, area };
            }
        }
        return null;
    },

    checkFeedingCooldown(bird, userId) {
        const now = new Date();
        const cooldownMinutes = 10;
        
        if (!bird.lastFed) {
            return { canFeed: true };
        }

        if (bird.lastFedBy === userId) {
            const timeDiff = now - bird.lastFed;
            const minutesPassed = Math.floor(timeDiff / (1000 * 60));
            
            if (minutesPassed < cooldownMinutes) {
                const nextFeedTime = new Date(bird.lastFed.getTime() + cooldownMinutes * 60 * 1000);
                return { 
                    canFeed: false, 
                    nextFeedTime: nextFeedTime.toLocaleTimeString('ja-JP', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })
                };
            }
        }

        return { canFeed: true };
    },

    processFeedingResult(birdInfo, food, preference, user) {
        const results = {
            favorite: {
                effect: '大喜び',
                message: 'は大好物の餌に大喜びしています！✨',
                moodChange: 'happy',
                specialChance: 0.15,
                getStayExtension: () => {
                    return Math.random() < 0.9 ? 3 : 6;
                }
            },
            acceptable: {
                effect: '満足',
                message: 'は餌をおいしそうに食べました！',
                moodChange: 'normal',
                specialChance: 0.05,
                getStayExtension: () => {
                    return Math.random() < 0.7 ? 1 : 0;
                }
            },
            dislike: {
                effect: '微妙',
                message: 'は餌をつついてみましたが、あまり興味がないようです...',
                moodChange: 'normal',
                specialChance: 0.02,
                getStayExtension: () => 0
            }
        };

        const result = results[preference] || results.acceptable;
        result.stayExtension = result.getStayExtension();
        
        return result;
    },

    updateBirdAfterFeeding(bird, food, preference, userId) {
        const now = new Date();
        const result = this.processFeedingResult(null, food, preference, null);
        
        bird.lastFed = now;
        bird.lastFedBy = userId;
        bird.feedCount = (bird.feedCount || 0) + 1;
        bird.mood = result.moodChange;
        
        if (result.stayExtension > 0) {
            if (!bird.stayExtensionHours) bird.stayExtensionHours = 0;
            bird.stayExtensionHours += result.stayExtension;
        }
        
        bird.activity = this.generateFeedingActivity(food, preference);
        
        if (!bird.feedHistory) bird.feedHistory = [];
        bird.feedHistory.push({
            food,
            preference,
            time: now,
            fedBy: userId
        });

        bird.isHungry = false;
    },

    generateFeedingActivity(food, preference) {
        const activities = {
            favorite: [
                'とても満足そうにしています',
                '嬉しそうに羽ばたいています',
                'ご機嫌で歌っています',
                '幸せそうに羽繕いしています',
                '大満足で踊るように歩いています',
                '感謝するように美しく鳴いています',
                '至福の表情で羽を広げています'
            ],
            acceptable: [
                'おなかいっぱいで休んでいます',
                '満足そうに過ごしています',
                '穏やかに過ごしています',
                'のんびりしています',
                'コクリコクリとうなずいています',
                '静かに消化中のようです'
            ],
            dislike: [
                '別の餌を探しているようです',
                '少し困惑しているようです',
                '他の餌に興味を示しています',
                '様子を見ています',
                '物思いに暮れています',
                '首をかしげて考え込んでいます'
            ]
        };

        const activityList = activities[preference] || activities.acceptable;
        return activityList[Math.floor(Math.random() * activityList.length)];
    },

    // 🆕 拡張された結果表示（改良版好感度情報）- 修正版
    createFeedingResultEmbed(birdInfo, food, result, affinityResult) {
        const { bird, area } = birdInfo;
        
        const foodEmojis = {
            '麦': '🌾', '🌾麦': '🌾',
            '虫': '🐛', '🐛虫': '🐛',
            '魚': '🐟', '🐟魚': '🐟',
            '花蜜': '🍯', '🍯花蜜': '🍯',
            '木の実': '🥜', '🥜木の実': '🥜',
            '青菜': '🌿', '🌿青菜': '🌿',
            'ねずみ': '🐁', '🐁ねずみ': '🐁'
        };
        
        const effectColors = {
            '大喜び': 0xFF69B4,
            '満足': 0x00FF00,
            '微妙': 0xFFA500
        };

        const embed = new EmbedBuilder()
            .setTitle(`🍽️ 餌やり結果`)
            .setDescription(`**${bird.name}**${result.message}`)
            .setColor(effectColors[result.effect] || 0x00AE86)
            .addFields(
                { name: '🐦 鳥', value: bird.name, inline: true },
                { name: '📍 場所', value: `${area}エリア`, inline: true },
                { name: '🍽️ 餌', value: `${foodEmojis[food]} ${food}`, inline: true },
                { name: '😊 反応', value: result.effect, inline: true },
                { 
                    name: '📅 効果', 
                    value: result.stayExtension > 0 ? `滞在期間 +${result.stayExtension}時間` : '効果なし', 
                    inline: true 
                },
                { name: '🎭 現在の様子', value: bird.activity, inline: true }
            )
            .setTimestamp();

        // 🆕 改良版好感度情報
        if (affinityResult) {
            const maxHearts = 10;
            const hearts = '💖'.repeat(affinityResult.newLevel) + '🤍'.repeat(maxHearts - affinityResult.newLevel);
            
            let affinityText = `${hearts}\nLv.${affinityResult.newLevel}/10 (${affinityResult.newFeedCount}回)`;
            
            if (affinityResult.levelUp) {
                affinityText += '\n✨ レベルアップ！';
            }
            
            // 好物ボーナス表示
            if (affinityResult.feedIncrement > 1) {
                affinityText += '\n🌟 好物ボーナス！(×1.5)';
            }
            
            // 次のレベルまでの進捗
            if (affinityResult.newLevel < 10 && affinityResult.requiredForNext) {
                const remaining = affinityResult.requiredForNext - affinityResult.newFeedCount;
                affinityText += `\n次のレベルまで: ${remaining.toFixed(1)}回`;
            }
            
            // 贈り物解放通知
            if (affinityResult.newLevel >= 5) {
                affinityText += '\n🎁 贈り物可能！';
            } else if (affinityResult.newLevel >= 4) {
                affinityText += '\n🎁 もうすぐ贈り物可能！';
            } else if (affinityResult.newLevel >= 3) {  
                affinityText += '\n🎁 あと少しで贈り物可能！';
            }
            
            embed.addFields({
                name: '💝 好感度',
                value: affinityText,
                inline: false
            });
        }

        const feedCount = bird.feedCount || 1;
        embed.addFields({
            name: '📊 餌やり統計',
            value: `この鳥への餌やり回数: ${feedCount}回`,
            inline: false
        });

        return embed;
    },
    
    checkForSpecialEvents(birdInfo, food, preference, interaction, guildId) {
        const result = this.processFeedingResult(birdInfo, food, preference, interaction.user);
        
        if (Math.random() < result.specialChance) {
            const event = this.generateSpecialEvent(birdInfo, food, preference, interaction.user);
            
            setTimeout(() => {
                interaction.followUp({ embeds: [event.embed] })
                    .then(() => {
                        return logger.logEvent(
                            '餌やりイベント',
                            event.description,
                            birdInfo.bird.name,
                            guildId
                        );
                    })
                    .catch(error => {
                        console.error('特別イベント送信エラー:', error);
                    });
            }, 3000);
        }
    },

    generateSpecialEvent(birdInfo, food, preference, user) {
        const { bird, area } = birdInfo;
        const events = {
            favorite: [
                {
                    type: '仲良し',
                    description: `${bird.name}が${user.username}さんのあとをついてきます！`,
                    effect: '特別な絆が生まれました'
                },
                {
                    type: '歌声',
                    description: `${bird.name}が美しい歌声を披露しています♪`,
                    effect: 'エリア全体が音楽に包まれています'
                }
            ],
            acceptable: [
                {
                    type: '探索',
                    description: `${bird.name}が新しい場所を発見したようです`,
                    effect: 'エリア内で新しいスポットを見つけました'
                }
            ],
            dislike: [
                {
                    type: '学習',
                    description: `${bird.name}が好みを学習したようです`,
                    effect: '次回はもっと好みに合う餌が分かるかもしれません'
                }
            ]
        };

        const eventList = events[preference] || events.acceptable;
        const selectedEvent = eventList[Math.floor(Math.random() * eventList.length)];

        const embed = new EmbedBuilder()
            .setTitle('✨ 特別なできごと！')
            .setDescription(selectedEvent.description)
            .addFields({
                name: '🎊 効果',
                value: selectedEvent.effect,
                inline: false
            })
            .setColor(0xFFD700)
            .setTimestamp();

        return {
            embed,
            description: selectedEvent.description
        };
    },

    checkBirdSleepTime() {
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        const hour = jstTime.getHours();
        
        if (hour >= 22 || hour < 7) {
            const sleepMessages = [
                '😴 鳥たちはぐっすり眠っています...静かに見守りましょう',
                '🌙 夜間は鳥たちの睡眠時間です。朝7時以降に餌やりができます',
                '💤 Zzz... 鳥たちは夢の中。起こさないであげてくださいね',
                '🌃 夜の鳥類園は静寂に包まれています。鳥たちは朝まで休息中です',
                '⭐ 星空の下、鳥たちは安らかに眠っています'
            ];
            
            const randomMessage = sleepMessages[Math.floor(Math.random() * sleepMessages.length)];
            
            return {
                isSleeping: true,
                message: `${randomMessage}\n🌅 餌やり再開時刻: 朝7:00 (JST)`
            };
        }
        
        return { isSleeping: false };
    }
};
