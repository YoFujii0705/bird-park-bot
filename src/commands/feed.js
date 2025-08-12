const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');
const sheetsManager = require('../../config/sheets');
const achievementHelper = require('../utils/achievementHelper');

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
            
            // 🌙 睡眠時間チェック
            const sleepCheck = this.checkBirdSleepTime();
            if (sleepCheck.isSleeping) {
                await interaction.reply({
                    content: sleepCheck.message,
                    ephemeral: true
                });
                return;
            }

            // 🔄 鳥データ初期化チェック
            if (!birdData.initialized) {
                await interaction.reply({
                    content: '🔄 鳥データを読み込み中です...少々お待ちください',
                    ephemeral: true
                });
                await birdData.initialize();
            }

            // 🏗️ 動物園初期化
            const zooManager = require('../utils/zooManager');
            await zooManager.initializeServer(guildId);

            // 📝 コマンド引数取得
            const birdName = interaction.options.getString('bird');
            const food = interaction.options.getString('food');

            // 🔍 鳥の検索（複数候補対応）
            const birdInfo = await this.findBirdInZoo(birdName, guildId, interaction);
            
            // 複数候補の場合は処理終了（セレクトメニューで継続）
            if (birdInfo === 'MULTIPLE_CANDIDATES') {
                return;
            }
            
            if (!birdInfo) {
                await interaction.reply({
                    content: `🔍 "${birdName}" は現在この鳥類園にいないようです。\n\`/zoo view\` で現在いる鳥を確認してください。`,
                    ephemeral: true
                });
                return;
            }

            // ⏰ クールダウンチェック（ネスト鳥は除外）
            const cooldownResult = this.checkFeedingCooldown(birdInfo.bird, interaction.user.id, birdInfo.isFromNest);
            if (!cooldownResult.canFeed) {
                await interaction.reply({
                    content: `⏰ ${birdInfo.bird.name}にはまだ餌をあげられません。\n次回餌やり可能時刻: ${cooldownResult.nextFeedTime}`,
                    ephemeral: true
                });
                return;
            }

            // 🍽️ 餌やり処理
            const preference = birdData.getFoodPreference(birdInfo.bird.originalName || birdInfo.bird.name, food);
            const feedResult = this.processFeedingResult(birdInfo, food, preference, interaction.user);
            this.updateBirdAfterFeeding(birdInfo.bird, food, preference, interaction.user.id);

            // 💖 好感度処理
            const affinityResult = await this.processAffinity(
                interaction.user.id, 
                interaction.user.username, 
                birdInfo.bird.originalName || birdInfo.bird.name, 
                preference, 
                guildId
            );

            // 📊 結果表示
            const embed = this.createFeedingResultEmbed(birdInfo, food, feedResult, affinityResult);
            await interaction.reply({ embeds: [embed] });

            // 📋 ログ記録
            await logger.logFeedWithServer(
                interaction.user.id,
                interaction.user.username,
                birdInfo.bird.originalName || birdInfo.bird.name,
                food,
                feedResult.effect,
                interaction.guild.id
            );

            // 🎯 非同期処理を開始
            this.startAsyncProcesses(interaction, birdInfo, feedResult, affinityResult, guildId);

            // ✨ 特別イベントチェック
            this.checkForSpecialEvents(birdInfo, food, preference, interaction, guildId);

            // 💾 動物園状態保存
            await zooManager.saveServerZoo(guildId);

        } catch (error) {
            console.error('餌やりコマンドエラー:', error);
            await this.handleExecuteError(interaction, error);
        }
    },

    // 🎯 非同期処理を整理したメソッド
    startAsyncProcesses(interaction, birdInfo, feedResult, affinityResult, guildId) {
        // 🏆 称号チェック（1.5秒後）
        setTimeout(async () => {
            try {
                const newAchievements = await achievementHelper.checkAndNotifyAchievements(
                    interaction,
                    interaction.user.id,
                    interaction.user.username,
                    guildId
                );
                
                if (newAchievements.length > 0) {
                    console.log(`🏆 ${interaction.user.username}が${newAchievements.length}個の称号を獲得しました`);
                }
            } catch (error) {
                console.error('称号チェックエラー:', error);
            }
        }, 1500);

        // 🎁 好感度MAX通知（2秒後）
        if (affinityResult.levelUp && affinityResult.newLevel >= 5) {
            setTimeout(async () => {
                try {
                    await this.sendAffinityMaxNotification(interaction, birdInfo.bird.originalName || birdInfo.bird.name, birdInfo.area);
                } catch (error) {
                    console.error('好感度MAX通知エラー:', error);
                }
            }, 2000);
        }

        // 🎁 鳥からの贈り物チェック（3.5秒後）
        setTimeout(async () => {
            try {
                await this.handleBirdGiftProcess(interaction, birdInfo, affinityResult, guildId);
            } catch (error) {
                console.error('鳥からの贈り物チェックエラー:', error);
            }
        }, 3500);

        // 💭 餌やり思い出生成（7秒後）
        setTimeout(async () => {
            try {
                await this.handleFeedingMemory(interaction, birdInfo, feedResult, affinityResult, guildId);
            } catch (error) {
                console.error('餌やり思い出生成エラー:', error);
            }
        }, 7000);

        // 💖 好感度アップ思い出生成（8秒後）
        if (affinityResult.levelUp) {
            setTimeout(async () => {
                try {
                    await this.handleAffinityMemory(interaction, birdInfo, affinityResult, guildId);
                } catch (error) {
                    console.error('好感度思い出生成エラー:', error);
                }
            }, 8000);
        }
    },

    // 🎁 鳥からの贈り物処理
    async handleBirdGiftProcess(interaction, birdInfo, affinityResult, guildId) {
        if (affinityResult && affinityResult.newLevel >= 3) {
            const birdGift = await this.checkBirdGiftToUser(
                interaction,
                interaction.user.id,
                interaction.user.username,
                birdInfo.bird.originalName || birdInfo.bird.name,
                affinityResult.newLevel,
                birdInfo.area,
                guildId
            );
            
            if (birdGift) {
                await this.sendBirdGiftNotification(interaction, birdInfo.bird.originalName || birdInfo.bird.name, birdGift);
                
                // 贈り物の思い出生成（1秒後）
                setTimeout(async () => {
                    try {
                        await this.handleGiftReceivedMemory(interaction, birdInfo, birdGift, affinityResult, guildId);
                    } catch (error) {
                        console.error('贈り物思い出生成エラー:', error);
                    }
                }, 1000);
            }
        }
    },

    // 💭 餌やり思い出生成
    async handleFeedingMemory(interaction, birdInfo, feedResult, affinityResult, guildId) {
        const memoryManager = require('../utils/humanMemoryManager');
        const weatherManager = require('../utils/weather');
        
        const currentWeather = await weatherManager.getCurrentWeather();
        
        const actionData = {
            type: 'feed',
            preference: birdData.getFoodPreference(birdInfo.bird.originalName || birdInfo.bird.name, interaction.options.getString('food')),
            food: interaction.options.getString('food'),
            isFirstTime: birdInfo.bird.feedCount === 1,
            isFirstFavorite: this.isFirstFavoriteFood(birdInfo.bird, interaction.options.getString('food')),
            weather: currentWeather.condition,
            weatherDescription: currentWeather.description,
            temperature: currentWeather.temperature,
            hour: new Date().getHours(),
            totalFeeds: birdInfo.bird.feedCount,
            details: {
                food: interaction.options.getString('food'),
                area: birdInfo.area,
                effect: feedResult.effect,
                weather: currentWeather.condition,
                weatherDescription: currentWeather.description,
                temperature: currentWeather.temperature
            }
        };
        
        const newMemory = await memoryManager.createMemory(
            interaction.user.id,
            interaction.user.username,
            birdInfo.bird.originalName || birdInfo.bird.name,
            actionData,
            guildId
        );
        
        if (newMemory) {
            await memoryManager.sendMemoryNotification(interaction, newMemory);
        }
    },

    // 💖 好感度アップ思い出生成
    async handleAffinityMemory(interaction, birdInfo, affinityResult, guildId) {
        const memoryManager = require('../utils/humanMemoryManager');
        
        const affinityActionData = {
            type: 'affinity',
            newLevel: affinityResult.newLevel,
            previousLevel: affinityResult.previousLevel,
            details: {
                newLevel: affinityResult.newLevel,
                birdName: birdInfo.bird.originalName || birdInfo.bird.name
            }
        };
        
        const affinityMemory = await memoryManager.createMemory(
            interaction.user.id,
            interaction.user.username,
            birdInfo.bird.originalName || birdInfo.bird.name,
            affinityActionData,
            guildId
        );
        
        if (affinityMemory) {
            await memoryManager.sendMemoryNotification(interaction, affinityMemory);
        }
    },

   // 🎁 贈り物受取思い出生成
    async handleGiftReceivedMemory(interaction, birdInfo, birdGift, affinityResult, guildId) {
        const memoryManager = require('../utils/humanMemoryManager');
        
        const receivedGifts = await sheetsManager.getUserReceivedGifts ? 
            await sheetsManager.getUserReceivedGifts(interaction.user.id, guildId) : [];
        const isFirstReceived = receivedGifts.length === 1;
        
        const giftActionData = {
            type: 'gift_received',
            isFirstReceived: isFirstReceived,
            rarity: birdGift.giftName.includes('虹色') || birdGift.giftName.includes('四つ葉') ? 'rare' : 'common',
            details: {
                giftName: birdGift.giftName,
                birdName: birdInfo.bird.originalName || birdInfo.bird.name,
                area: birdInfo.area,
                affinityLevel: affinityResult.newLevel
            }
        };
        
        const giftMemory = await memoryManager.createMemory(
            interaction.user.id,
            interaction.user.username,
            birdInfo.bird.originalName || birdInfo.bird.name,
            giftActionData,
            guildId
        );
        
        if (giftMemory) {
            await memoryManager.sendMemoryNotification(interaction, giftMemory);
        }
    },

    // 🍽️ 餌やり結果処理
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

    // 🐦 鳥の状態更新
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

    // 🎭 餌やり後の活動生成
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

    // 📊 餌やり結果Embed作成
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
                { name: '📍 場所', value: `${area}${birdInfo.isFromNest ? ' (あなたのネスト)' : 'エリア'}`, inline: true },
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

        // 💖 好感度情報表示（修正版）
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
            
            // 🆕 絆レベル表示（修正版）
            if (affinityResult.newLevel >= 10 && affinityResult.bondResult) {
                const bondResult = affinityResult.bondResult;
                
                if (bondResult.error) {
                    // エラーが発生した場合
                    affinityText += `\n\n🔗 **絆システム**`;
                    affinityText += `\n❌ 絆レベル処理でエラーが発生しました`;
                    affinityText += `\n再度餌やりをお試しください`;
                } else if (bondResult.isProcessing) {
                    // 処理中の場合（この状態は基本的になくなる）
                    affinityText += `\n\n🔗 **絆システム起動！**`;
                    affinityText += `\n⏳ 絆レベル処理中...`;
                    affinityText += `\n好物餌やりで絆レベルが上がります！`;
                } else {
                    // 通常の絆レベル表示
                    affinityText += `\n\n🔗 **絆レベル ${bondResult.newBondLevel}**`;
                    affinityText += `\n絆: ${bondResult.newBondFeedCount}回`;
                    
                    if (bondResult.bondLevelUp) {
                        affinityText += '\n✨ 絆レベルアップ！';
                        
                        // 🆕 絆レベルアップ時のネストガチャ通知
                        affinityText += '\n🎰 ネストガチャが利用可能になりました！';
                        affinityText += '\n`/nest gacha` でネストを獲得しましょう！';
                    }
                    
                    // 次の絆レベルまでの進捗
                    if (bondResult.requiredForNextBond && bondResult.requiredForNextBond > bondResult.newBondFeedCount) {
                        const remaining = bondResult.requiredForNextBond - bondResult.newBondFeedCount;
                        affinityText += `\n次の絆レベルまで: ${remaining.toFixed(1)}回`;
                    }
                    
                    // 絆レベル特典表示
                    if (bondResult.newBondLevel >= 1) {
                        affinityText += '\n🏠 ネスト建設可能！';
                    }
                    if (bondResult.newBondLevel >= 3) {
                        affinityText += '\n🚶 レア散歩ルート解放！';
                    }
                    if (bondResult.newBondLevel >= 5) {
                        affinityText += '\n🌟 特別散歩ルート解放！';
                    }
                    if (bondResult.newBondLevel >= 10) {
                        affinityText += '\n👑 最高級散歩ルート解放！';
                    }
                }
            } else if (affinityResult.newLevel >= 10) {
                affinityText += '\n\n🔗 **絆システム解放済み**';
                affinityText += '\n好物餌やりで絆レベルが上がります！';
            } else {
                // 次のレベルまでの進捗
                if (affinityResult.requiredForNext) {
                    const remaining = affinityResult.requiredForNext - affinityResult.newFeedCount;
                    affinityText += `\n次のレベルまで: ${remaining.toFixed(1)}回`;
                }
            }
            
            // 贈り物解放通知
            if (affinityResult.newLevel >= 3) {
                affinityText += '\n🎁 贈り物可能！';
            } else if (affinityResult.newLevel >= 2) {
                affinityText += '\n🎁 もうすぐ贈り物可能！';
            } else if (affinityResult.newLevel >= 1) {  
                affinityText += '\n🎁 あと少しで贈り物可能！';
            }
            
            embed.addFields({
                name: '💝 好感度',
                value: affinityText,
                inline: false
            });
        }

        // 📊 統計情報
        const feedCount = bird.feedCount || 1;
        embed.addFields({
            name: '📊 餌やり統計',
            value: `この鳥への餌やり回数: ${feedCount}回`,
            inline: false
        });

        return embed;
    },

    // 🔍 好物初回チェック
    isFirstFavoriteFood(bird, food) {
        if (!bird.feedHistory) return false;
        const birdData = require('../utils/birdData');
        const preference = birdData.getFoodPreference(bird.originalName || bird.name, food);
        return preference === 'favorite' && !bird.feedHistory.some(h => h.preference === 'favorite');
    },

    // 💖 好感度処理メソッド（絆レベル表示修正版）
    async processAffinity(userId, userName, birdName, preference, serverId) {
        try {
            // 現在の好感度を取得
            const affinities = await sheetsManager.getUserAffinity(userId, serverId);
            const currentAffinity = affinities[birdName] || { level: 0, feedCount: 0 };
            
            // 餌やり回数を増加（小数点対応）
            let feedIncrement = 1;
            
            // 好物の場合は1.5倍ボーナス（絆レベル時も継続）
            if (preference === 'favorite') {
                feedIncrement = 1.5;
            }
            
            let newFeedCount = currentAffinity.feedCount + feedIncrement;
            let newLevel = currentAffinity.level;
            let levelUp = false;
            
            // 好感度レベルアップ判定（最大レベル10）
            while (newLevel < 10) {
                const requiredFeeds = this.getRequiredFeedsForLevel(newLevel + 1);
                
                if (newFeedCount >= requiredFeeds) {
                    newLevel++;
                    levelUp = true;
                } else {
                    break;
                }
            }
            
            // スプレッドシートに好感度記録
            await sheetsManager.logAffinity(userId, userName, birdName, newLevel, Math.round(newFeedCount * 10) / 10, serverId);
            
            // 🆕 絆レベル処理（修正版）
            let bondResult = null;
            if (newLevel >= 10) {
                try {
                    // 🔧 修正: 同期的に絆レベル処理を実行
                    bondResult = await this.processBondLevel(userId, userName, birdName, feedIncrement, serverId);
                    console.log('🔗 絆レベル処理完了:', bondResult);
                } catch (error) {
                    console.error('絆レベル処理エラー:', error);
                    // エラーの場合は処理中状態を返す
                    bondResult = {
                        bondLevelUp: false,
                        newBondLevel: 0,
                        newBondFeedCount: feedIncrement,
                        previousBondLevel: 0,
                        requiredForNextBond: this.getRequiredFeedsForBondLevel(1),
                        isProcessing: true,
                        error: true
                    };
                }
            }
            
            return {
                levelUp,
                newLevel,
                newFeedCount: Math.round(newFeedCount * 10) / 10,
                previousLevel: currentAffinity.level,
                feedIncrement,
                requiredForNext: newLevel < 10 ? this.getRequiredFeedsForLevel(newLevel + 1) : null,
                bondResult: bondResult
            };
            
        } catch (error) {
            console.error('好感度処理エラー:', error);
            return { levelUp: false, newLevel: 0, newFeedCount: 1, previousLevel: 0, bondResult: null };
        }
    },

    // 🆕 同期版絆レベル処理メソッド（修正版）
    async processBondLevel(userId, userName, birdName, feedIncrement, serverId) {
        try {
            console.log(`🔗 絆レベル処理開始 - ${birdName}, サーバー: ${serverId}`);
            
            const sheetsManager = require('../../config/sheets');
            
            // 現在の絆レベルを取得
            const currentBond = await sheetsManager.getUserBondLevel(userId, birdName, serverId) || { 
                bondLevel: 0, 
                bondFeedCount: 0 
            };
            
            console.log(`🔗 現在の絆レベル:`, currentBond);
            
            // 絆餌やり回数を増加
            let newBondFeedCount = currentBond.bondFeedCount + feedIncrement;
            let newBondLevel = currentBond.bondLevel;
            let bondLevelUp = false;
            
            console.log(`🔗 新しい絆餌やり回数: ${newBondFeedCount}`);
            
            // 絆レベルアップ判定
            while (true) {
                const requiredFeeds = this.getRequiredFeedsForBondLevel(newBondLevel + 1);
                console.log(`🔗 レベル${newBondLevel + 1}に必要な回数: ${requiredFeeds}`);
                
                if (newBondFeedCount >= requiredFeeds) {
                    newBondLevel++;
                    bondLevelUp = true;
                    console.log(`🔗 絆レベルアップ！ ${birdName}: Lv.${newBondLevel}`);
                    
                    // 絆レベル特典チェック
                    await this.checkBondLevelRewards(userId, userName, birdName, newBondLevel, serverId);
                } else {
                    break;
                }
            }
            
            // 🔧 絆レベルをスプレッドシートに記録（サーバーID修正）
            console.log(`🔗 絆レベル記録: ${userName} -> ${birdName} Lv.${newBondLevel} (${newBondFeedCount}回) サーバー:${serverId}`);
            
            await sheetsManager.logBondLevel(
                userId, 
                userName, 
                birdName, 
                newBondLevel, 
                Math.round(newBondFeedCount * 10) / 10, 
                serverId
            );
            
            console.log(`🔗 絆レベル処理完了 - ${birdName}: Lv.${newBondLevel}`);
            
            return {
                bondLevelUp,
                newBondLevel,
                newBondFeedCount: Math.round(newBondFeedCount * 10) / 10,
                previousBondLevel: currentBond.bondLevel,
                requiredForNextBond: this.getRequiredFeedsForBondLevel(newBondLevel + 1),
                isProcessing: false // 🔧 修正: 処理完了フラグ
            };
            
        } catch (error) {
            console.error('絆レベル処理エラー:', error);
            console.error('エラースタック:', error.stack);
            throw error; // エラーを上位に伝播
        }
    },

    // 📈 レベル別必要餌やり回数計算
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

    // 🆕 絆レベル別必要餌やり回数計算
    getRequiredFeedsForBondLevel(targetBondLevel) {
        if (targetBondLevel <= 0) return 0;
        
        // 企画書通りの段階的増加（15→20→25→30→35...）
        let totalRequired = 0;
        for (let level = 1; level <= targetBondLevel; level++) {
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
        }
        
        return totalRequired;
    },

    // 🆕 絆レベル特典チェック
    async checkBondLevelRewards(userId, userName, birdName, bondLevel, serverId) {
        try {
            console.log(`🎁 絆レベル${bondLevel}特典チェック - ${birdName}`);
            
            const sheetsManager = require('../../config/sheets');
            
            // きりのいいレベルで「写真」確定入手
            if (bondLevel % 5 === 0) {
                const photoName = this.getBondLevelPhotoName(bondLevel);
                
                // gifts_inventoryに写真を追加
                await sheetsManager.logGiftInventory(
                    userId, userName, photoName, 1,
                    `${birdName}との絆レベル${bondLevel}達成特典`,
                    serverId
                );
                
                console.log(`📸 ${userName}が${photoName}を獲得しました`);
            }
            
            // レベル1: ネスト建設権利解放
            if (bondLevel === 1) {
                console.log(`🏠 ${userName}が${birdName}のネスト建設権利を獲得しました`);
                // ここで将来的にネスト建設フラグを設定
            }
            
        } catch (error) {
            console.error('絆レベル特典チェックエラー:', error);
        }
    },

    // 🆕 絆レベル別写真名取得
    getBondLevelPhotoName(bondLevel) {
        const photoNames = {
            5: '深い絆の写真',
            10: '魂の繋がりの写真',
            15: '永遠の瞬間の写真',
            20: '奇跡の写真',
            25: '運命の写真',
            30: '無限の愛の写真'
        };
        
        return photoNames[bondLevel] || `絆レベル${bondLevel}の記念写真`;
    },

    // 💖 好感度MAX通知
    async sendAffinityMaxNotification(interaction, birdName, area) {
        try {
            // 人間→鳥用の贈り物カテゴリから選択
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

    // 🔍 改良版鳥検索メソッド（複数候補対応）
    async findBirdInZoo(birdName, guildId, interaction = null) {
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState(guildId);
        
        // すべてのエリアの鳥を収集（ネスト情報も含む）
        const allBirds = [];
        for (const area of ['森林', '草原', '水辺']) {
            zooState[area].forEach(bird => {
                allBirds.push({ bird, area, isFromNest: false });
            });
        }

        // 🆕 ネストにいる鳥も検索対象に追加
        try {
            const sheetsManager = require('../../config/sheets');
            const userNests = await sheetsManager.getUserNests ? 
                await sheetsManager.getUserNests(interaction?.user?.id, guildId) : [];
            
            userNests.forEach(nest => {
                // ネスト鳥が動物園にもいるかチェック
                const existsInZoo = allBirds.some(({ bird }) => bird.name === nest.birdName);
                if (!existsInZoo) {
                    // ネスト専用の鳥オブジェクトを作成
                    const nestBird = {
                        name: nest.customName || nest.birdName,
                        originalName: nest.birdName,
                        mood: 'happy',
                        activity: `${nest.nestType}で安らいでいます`,
                        feedCount: 0,
                        lastFed: null,
                        lastFedBy: null,
                        isHungry: false
                    };
                    allBirds.push({ 
                        bird: nestBird, 
                        area: nest.nestType, 
                        isFromNest: true,
                        nestInfo: nest
                    });
                }
            });
        } catch (error) {
            console.error('ネスト鳥検索エラー:', error);
        }

        // 検索パターンを優先順位順に実行
        const searchPatterns = [
            // 1. 完全一致（最優先）
            (birds, name) => birds.filter(({ bird }) => 
                bird.name === name || bird.originalName === name
            ),
            // 2. 前方一致
            (birds, name) => birds.filter(({ bird }) => 
                bird.name.startsWith(name) || name.startsWith(bird.name) ||
                (bird.originalName && (bird.originalName.startsWith(name) || name.startsWith(bird.originalName)))
            ),
            // 3. 部分一致（長い名前優先）
            (birds, name) => {
                const matches = birds.filter(({ bird }) => 
                    bird.name.includes(name) || name.includes(bird.name) ||
                    (bird.originalName && (bird.originalName.includes(name) || name.includes(bird.originalName)))
                );
                return matches.sort((a, b) => b.bird.name.length - a.bird.name.length);
            }
        ];

        for (const searchFn of searchPatterns) {
            const matches = searchFn(allBirds, birdName);
            if (matches.length > 0) {
                // 複数候補がある場合はセレクトメニューで選択
                if (matches.length > 1 && interaction) {
                    return await this.handleMultipleBirdCandidates(matches, birdName, interaction);
                }
                
                console.log(`🎯 鳥発見: ${matches[0].bird.name}${matches[0].isFromNest ? ' (ネスト)' : ''}`);
                return matches[0];
            }
        }
        
        console.log(`❌ 鳥が見つかりません: ${birdName}`);
        return null;
    },

    // 🆕 複数鳥候補のセレクトメニュー処理
    async handleMultipleBirdCandidates(candidates, searchName, interaction) {
        const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
        
        // 最大25個まで（Discord制限）
        const limitedCandidates = candidates.slice(0, 25);
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('bird_feed_select')
            .setPlaceholder(`"${searchName}"で複数の鳥が見つかりました...`)
            .addOptions(
                limitedCandidates.map((candidate, index) => ({
                    label: candidate.bird.name,
                    description: `${candidate.area}${candidate.isFromNest ? ' (あなたのネスト)' : 'エリア'} - ${candidate.bird.activity || '待機中'}`,
                    value: `bird_feed_${index}`
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // 候補一覧を一時保存（セッション管理）
        if (!global.birdSelectionCache) global.birdSelectionCache = new Map();
        const sessionKey = `${interaction.user.id}_${interaction.guild.id}`;
        global.birdSelectionCache.set(sessionKey, {
            candidates: limitedCandidates,
            originalCommand: 'feed',
            timestamp: Date.now()
        });

        await interaction.reply({
            content: `🔍 **"${searchName}"** で複数の鳥が見つかりました。餌をあげる鳥を選択してください：`,
            components: [row],
            ephemeral: true
        });

        return 'MULTIPLE_CANDIDATES'; // 特別な戻り値
    },

    // ⏰ 餌やりクールダウンチェック（修正版 - ネスト対応）
    checkFeedingCooldown(bird, userId, isFromNest = false) {
        // 🆕 ネストにいる鳥は常時餌やり可能
        if (isFromNest) {
            console.log(`🏠 ネスト鳥 ${bird.name} - 常時餌やり可能`);
            return { canFeed: true };
        }

        const now = new Date();
        const cooldownMinutes = 10;
        
        // 🔧 修正: lastFedまたはlastFedByがnullの場合はクールダウンなし
        if (!bird.lastFed || !bird.lastFedBy) {
            console.log(`🔧 クールダウンチェック: ${bird.name} - lastFed or lastFedBy is null, allowing feed`);
            return { canFeed: true };
        }

        // 同じユーザーが最後に餌をあげた場合のみクールダウンチェック
        if (bird.lastFedBy === userId) {
            const timeDiff = now - bird.lastFed;
            const minutesPassed = Math.floor(timeDiff / (1000 * 60));
            
            console.log(`🔧 クールダウンチェック: ${bird.name} - 同じユーザー(${userId}), ${minutesPassed}分経過`);
            
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

        console.log(`🔧 クールダウンチェック: ${bird.name} - 餌やり可能`);
        return { canFeed: true };
    },

    // 🌙 鳥の睡眠時間チェック
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
    },

    // 🎁 鳥からの贈り物チェック
    async checkBirdGiftToUser(interaction, userId, userName, birdName, affinityLevel, area, guildId) {
        try {
            // 好感度が5以上の場合のみ贈り物チャンス
            if (affinityLevel < 3) return null;
            
            // 贈り物確率
            let giftChance = 0;
            if (affinityLevel >= 3) giftChance = 0.01; // 1%
            if (affinityLevel >= 4) giftChance = 0.05; // 5%
            if (affinityLevel >= 5) giftChance = 0.10; // 10%
            if (affinityLevel >= 6) giftChance = 0.15; // 15%
            if (affinityLevel >= 7) giftChance = 0.20; // 20%
            if (affinityLevel >= 8) giftChance = 0.25; // 25%
            if (affinityLevel >= 9) giftChance = 0.30; // 30%
            if (affinityLevel >= 10) giftChance = 0.35; // 35%
            
            console.log(`🎲 ${birdName}(好感度${affinityLevel}) 贈り物チャンス: ${(giftChance * 100).toFixed(0)}%`);
            
            // ランダムチェック
            const roll = Math.random();
            console.log(`🎯 ロール結果: ${(roll * 100).toFixed(1)}% (必要: ${(giftChance * 100).toFixed(0)}%以下)`);
            
            if (roll > giftChance) {
                console.log(`❌ 贈り物なし (${(roll * 100).toFixed(1)}% > ${(giftChance * 100).toFixed(0)}%)`);
                return null;
            }
            
            // 鳥→人間用の贈り物カテゴリから選択
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

    // 💌 鳥→人間の贈り物メッセージ生成
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
                `${birdName}が${giftName}をくちばしにくわえて、あなたの前に置きました。`,
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

    // 🎁 鳥からの贈り物通知送信
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

    // 🎨 贈り物名から絵文字取得（鳥→人間用）
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

    // ✨ 特別イベントチェック
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
                            birdInfo.bird.originalName || birdInfo.bird.name,
                            guildId
                        );
                    })
                    .catch(error => {
                        console.error('特別イベント送信エラー:', error);
                    });
            }, 3000);
        }
    },

    // 🎊 特別イベント生成
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

    // ❌ エラーハンドリング
    async handleExecuteError(interaction, error) {
        await logger.logError('餌やりコマンド', error, {
            userId: interaction.user.id,
            birdName: interaction.options.getString('bird'),
            food: interaction.options.getString('food'),
            guildId: interaction.guild.id
        });

        const errorMessage = '餌やりの実行中にエラーが発生しました。';
        
        try {
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (replyError) {
            console.error('エラーメッセージ送信失敗:', replyError);
        }
    }
};

// 🔚 モジュールエクスポート終了
