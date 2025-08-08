const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');
const sheetsManager = require('../../config/sheets'); // 🆕 追加

// 🆕 贈り物カテゴリ定義
const GIFT_CATEGORIES = {
    森林: ['どんぐり', '美しい羽根', '小枝', 'きれいな木の実', '苔玉', '小さな鈴', '森の宝石'],
    草原: ['花の種', '綺麗な石', '蝶の羽', 'クローバー', '花冠', '小さなビーズ', '草原の真珠'],
    水辺: ['美しい貝殻', '真珠', '水晶', '流木', '水草', '小さな巻貝', '波の欠片'],
    共通: ['虹色の羽根', 'ハート型の石', '四つ葉のクローバー', '特別な鈴', '光る石']
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

            this.checkForSpecialEvents(birdInfo, food, preference, interaction, guildId);

            // 🆕 好感度MAXになった場合の贈り物通知
            if (affinityResult.levelUp && affinityResult.newLevel >= 3) {
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


    // 🆕 改良版好感度MAX通知（レベル5から）
    async sendAffinityMaxNotification(interaction, birdName, area) {
        try {
            // エリアに応じた贈り物を選択
            const areaGifts = GIFT_CATEGORIES[area] || [];
            const commonGifts = GIFT_CATEGORIES.共通;
            const allGifts = [...areaGifts, ...commonGifts];
            
            const randomGift = allGifts[Math.floor(Math.random() * allGifts.length)];
            
            const embed = new EmbedBuilder()
                .setTitle('💖 深い絆が生まれました！')
                .setDescription(`**${birdName}**があなたを真の友達として認めました！\n\n🎁 **${randomGift}**を手に入れました！\n\n今度は${birdName}に贈り物をしてあげることができます。\n\`/gift bird:${birdName}\` で贈り物をしてみましょう！`)
                .setColor(0xFF69B4)
                .setTimestamp();

            // 贈り物をインベントリに追加
            await sheetsManager.logGiftInventory(
                interaction.user.id,
                interaction.user.username,
                randomGift,
                1,
                `${birdName}との深い絆で獲得`,
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
        const cooldownMinutes = 30;
        
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

    // 🆕 拡張された結果表示（改良版好感度情報）
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

        // 🆕 改良版好感度情報
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
        }
        
        embed.addFields({
            name: '💝 好感度',
            value: affinityText,
            inline: false
        });

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
                    description: `${bird.name}が${user.username}さんをとても気に入ったようです！`,
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
