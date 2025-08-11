const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const nestSystem = require('../utils/nestSystem');
const bondLevelManager = require('../utils/bondLevelManager');
const sheetsManager = require('../../config/sheets');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nest')
        .setDescription('ネスト建設・管理システム🏠')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('新しいネストを建設します')
                .addStringOption(option =>
                    option.setName('bird')
                        .setDescription('ネストを建設する鳥の名前')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('所有しているネストを表示します'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('visit')
                .setDescription('特定の鳥のネストを詳細表示します')
                .addStringOption(option =>
                    option.setName('bird')
                        .setDescription('訪問する鳥の名前')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('change')
                .setDescription('ネストのタイプを変更します')
                .addStringOption(option =>
                    option.setName('bird')
                        .setDescription('ネストを変更する鳥の名前')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;
            const userName = interaction.user.username;

            console.log(`🏠 ネストコマンド実行: ${subcommand} by ${userName}`);

            switch (subcommand) {
                case 'create':
                    await this.handleNestCreate(interaction, guildId, userId, userName);
                    break;
                case 'view':
                    await this.handleNestView(interaction, guildId, userId);
                    break;
                case 'visit':
                    await this.handleNestVisit(interaction, guildId, userId);
                    break;
                case 'change':
                    await this.handleNestChange(interaction, guildId, userId);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ 無効なサブコマンドです',
                        ephemeral: true
                    });
            }

        } catch (error) {
            console.error('ネストコマンドエラー:', error);
            await this.handleError(interaction, error);
        }
    },

    // ネスト建設処理
    async handleNestCreate(interaction, guildId, userId, userName) {
        try {
            const birdName = interaction.options.getString('bird');
            console.log(`🏗️ ネスト建設要求: ${birdName}`);

            await interaction.deferReply();

            // 鳥が鳥類園にいるかチェック
            const birdInfo = this.findBirdInZoo(birdName, guildId);
            if (!birdInfo) {
                await interaction.editReply({
                    content: `🔍 "${birdName}" は現在この鳥類園にいないようです。\n\`/zoo view\` で現在いる鳥を確認してください。`
                });
                return;
            }

            const actualBirdName = birdInfo.bird.name;
            const area = birdInfo.area;

            console.log(`🔍 鳥発見: ${actualBirdName} (${area}エリア)`);

            // ネスト建設可能チェック
            const buildCheck = await nestSystem.canBuildNest(userId, actualBirdName, guildId);
            if (!buildCheck.canBuild) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ ネスト建設不可')
                    .setDescription(buildCheck.message)
                    .setColor(0xFF0000);

                if (buildCheck.reason === 'AFFINITY_REQUIRED') {
                    errorEmbed.addFields({
                        name: '📋 必要な条件',
                        value: `• ${actualBirdName}との好感度レベル10達成\n• ${actualBirdName}との絆レベル1達成`,
                        inline: false
                    });
                } else if (buildCheck.reason === 'BOND_LEVEL_REQUIRED') {
                    errorEmbed.addFields({
                        name: '📋 必要な条件',
                        value: `• ${actualBirdName}との絆レベル1達成\n好物の餌やりを続けて絆を深めましょう`,
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }

            // ガチャ形式でネストオプションを生成
            const nestOptions = nestSystem.generateNestOptions(area);
            console.log(`🎲 ネストオプション生成: ${nestOptions.join(', ')}`);

            // 選択メニューを作成
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`nest_select_${actualBirdName}_${userId}`)
                .setPlaceholder('ネストタイプを選択してください...')
                .addOptions(
                    nestOptions.map((nestType, index) => ({
                        label: nestType,
                        description: `${area}エリアの${nestType}`,
                        value: nestType,
                        emoji: this.getNestEmoji(nestType)
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle(`🏗️ ${actualBirdName}のネスト建設`)
                .setDescription(`**${actualBirdName}**が${area}エリアで気に入った場所を3つ見つけました！\nどのネストタイプを建設しますか？`)
                .addFields({
                    name: '🎯 建設条件',
                    value: `✅ 好感度レベル10達成済み\n✅ 絆レベル1達成済み\n✅ 同種ネスト未所持\n✅ 最大所持数未満`,
                    inline: false
                })
                .addFields({
                    name: '⚠️ 重要事項',
                    value: '一度建設したネストは削除できません（最大5個まで）',
                    inline: false
                })
                .setColor(this.getAreaColor(area))
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // 選択メニューの処理を設定
            this.setupNestSelectionHandler(interaction.client, actualBirdName, userId, guildId, userName, area);

        } catch (error) {
            console.error('ネスト建設処理エラー:', error);
            throw error;
        }
    },

    // ネスト選択ハンドラー設定
    setupNestSelectionHandler(client, birdName, userId, guildId, userName, area) {
        const filter = i => i.customId.startsWith(`nest_select_${birdName}_${userId}`) && i.user.id === userId;
        
        const collector = client.on('interactionCreate', async interaction => {
            if (!interaction.isStringSelectMenu()) return;
            if (!filter(interaction)) return;

            try {
                await interaction.deferUpdate();

                const selectedNestType = interaction.values[0];
                console.log(`🎯 ネストタイプ選択: ${selectedNestType}`);

                // ネスト建設実行
                const buildResult = await nestSystem.buildNest(
                    userId,
                    userName,
                    birdName,
                    selectedNestType,
                    guildId,
                    client
                );

                if (buildResult.success) {
                    const successEmbed = new EmbedBuilder()
                        .setTitle('🎉 ネスト建設完了！')
                        .setDescription(`**${birdName}**の**${selectedNestType}**が完成しました！`)
                        .addFields({
                            name: '🏠 建設されたネスト',
                            value: `${this.getNestEmoji(selectedNestType)} **${selectedNestType}**`,
                            inline: true
                        })
                        .addFields({
                            name: '📍 エリア',
                            value: `${this.getAreaEmoji(area)} ${area}エリア`,
                            inline: true
                        })
                        .addFields({
                            name: '🔗 専用チャンネル',
                            value: `<#${buildResult.channelId}>`,
                            inline: true
                        })
                        .addFields({
                            name: '✨ 利用可能な機能',
                            value: `• 贈り物の自動展示\n• ネスト固有イベント\n• ${birdName}との特別な時間`,
                            inline: false
                        })
                        .setColor(0x00FF00)
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [successEmbed],
                        components: []
                    });

                    // ログ記録
                    await logger.logEvent(
                        'ネスト建設',
                        `${userName}が${birdName}の${selectedNestType}を建設`,
                        birdName,
                        guildId
                    );
                }

            } catch (error) {
                console.error('ネスト選択エラー:', error);
                
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ ネスト建設失敗')
                    .setDescription(error.message || 'ネストの建設中にエラーが発生しました')
                    .setColor(0xFF0000);

                await interaction.editReply({
                    embeds: [errorEmbed],
                    components: []
                });
            }
        });
    },

    // ネスト一覧表示
    async handleNestView(interaction, guildId, userId) {
        try {
            await interaction.deferReply();

            const userNests = await nestSystem.getUserNests(userId, guildId);

            if (userNests.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🏠 所有ネスト一覧')
                    .setDescription('まだネストを建設していません。\n絆レベル1以上の鳥との間でネストを建設できます。')
                    .setColor(0x808080);

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏠 ${interaction.user.username}さんの所有ネスト`)
                .setDescription(`現在 **${userNests.length}/5** 個のネストを所有しています`)
                .setColor(0x00AE86);

            userNests.forEach((nest, index) => {
                const channelText = nest.チャンネルID ? `<#${nest.チャンネルID}>` : '未設定';
                const customName = nest.カスタム名 ? ` (${nest.カスタム名})` : '';
                
                embed.addFields({
                    name: `${index + 1}. ${nest.鳥名}${customName}`,
                    value: `${this.getNestEmoji(nest.ネストタイプ)} **${nest.ネストタイプ}**\n🔗 ${channelText}`,
                    inline: true
                });
            });

            embed.addFields({
                name: '💡 ヒント',
                value: '• `/nest visit bird:鳥名` でネストの詳細を確認\n• `/nest change bird:鳥名` でネストタイプを変更',
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('ネスト一覧表示エラー:', error);
            throw error;
        }
    },

    // ネスト訪問
    async handleNestVisit(interaction, guildId, userId) {
        try {
            const birdName = interaction.options.getString('bird');
            await interaction.deferReply();

            const nest = await sheetsManager.getBirdNest(userId, birdName, guildId);
            if (!nest) {
                await interaction.editReply({
                    content: `❌ ${birdName}のネストは建設されていません。`
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏠 ${nest.鳥名}のネスト`)
                .setDescription(`${this.getNestEmoji(nest.ネストタイプ)} **${nest.ネストタイプ}**`)
                .addFields({
                    name: '🐦 住人',
                    value: nest.カスタム名 ? `${nest.鳥名} (${nest.カスタム名})` : nest.鳥名,
                    inline: true
                })
                .addFields({
                    name: '🏗️ 建設日',
                    value: new Date(nest.日時).toLocaleDateString('ja-JP'),
                    inline: true
                })
                .addFields({
                    name: '🔗 専用チャンネル',
                    value: nest.チャンネルID ? `<#${nest.チャンネルID}>` : '未設定',
                    inline: true
                })
                .setColor(0x00AE86)
                .setTimestamp();

            // 所持ネストリストを表示
            if (nest.所持ネストリスト && nest.所持ネストリスト.length > 1) {
                const ownedNests = nest.所持ネストリスト
                    .map(nestType => `${this.getNestEmoji(nestType)} ${nestType}`)
                    .join('\n');
                
                embed.addFields({
                    name: '🎁 所持ネストコレクション',
                    value: ownedNests,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('ネスト訪問エラー:', error);
            throw error;
        }
    },

    // ネストタイプ変更
    async handleNestChange(interaction, guildId, userId) {
        try {
            const birdName = interaction.options.getString('bird');
            await interaction.deferReply();

            const nest = await sheetsManager.getBirdNest(userId, birdName, guildId);
            if (!nest) {
                await interaction.editReply({
                    content: `❌ ${birdName}のネストは建設されていません。`
                });
                return;
            }

            const ownedNests = nest.所持ネストリスト || [nest.ネストタイプ];
            if (ownedNests.length <= 1) {
                await interaction.editReply({
                    content: `❌ ${birdName}は1つのネストタイプしか所持していません。\n新しいネストタイプは絆レベルアップ時に獲得できます。`
                });
                return;
            }

            // 現在のネスト以外の選択肢を作成
            const availableNests = ownedNests.filter(nestType => nestType !== nest.ネストタイプ);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`nest_change_${birdName}_${userId}`)
                .setPlaceholder('変更するネストタイプを選択...')
                .addOptions(
                    availableNests.map(nestType => ({
                        label: nestType,
                        description: `${birdName}の${nestType}に変更`,
                        value: nestType,
                        emoji: this.getNestEmoji(nestType)
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle(`🔄 ${nest.鳥名}のネスト変更`)
                .setDescription(`現在: **${nest.ネストタイプ}**\n\n所持している別のネストタイプに変更できます。`)
                .setColor(0xFFA500);

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // 変更選択ハンドラー設定
            this.setupNestChangeHandler(interaction.client, birdName, userId, guildId);

        } catch (error) {
            console.error('ネスト変更エラー:', error);
            throw error;
        }
    },

    // ネスト変更ハンドラー設定
    setupNestChangeHandler(client, birdName, userId, guildId) {
        const filter = i => i.customId.startsWith(`nest_change_${birdName}_${userId}`) && i.user.id === userId;
        
        client.on('interactionCreate', async interaction => {
            if (!interaction.isStringSelectMenu()) return;
            if (!filter(interaction)) return;

            try {
                await interaction.deferUpdate();

                const newNestType = interaction.values[0];
                console.log(`🔄 ネストタイプ変更: ${birdName} -> ${newNestType}`);

                const changeResult = await nestSystem.changeNestType(userId, birdName, newNestType, guildId);

                if (changeResult.success) {
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ ネスト変更完了')
                        .setDescription(changeResult.message)
                        .addFields({
                            name: '🔄 変更内容',
                            value: `${this.getNestEmoji(changeResult.oldType)} ${changeResult.oldType}\n⬇️\n${this.getNestEmoji(changeResult.newType)} ${changeResult.newType}`,
                            inline: false
                        })
                        .setColor(0x00FF00)
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [successEmbed],
                        components: []
                    });
                }

            } catch (error) {
                console.error('ネスト変更選択エラー:', error);
                
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ ネスト変更失敗')
                    .setDescription(error.message || 'ネストの変更中にエラーが発生しました')
                    .setColor(0xFF0000);

                await interaction.editReply({
                    embeds: [errorEmbed],
                    components: []
                });
            }
        });
    },

    // 鳥類園から鳥を検索
    findBirdInZoo(birdName, guildId) {
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState(guildId);
        
        for (const area of ['森林', '草原', '水辺']) {
            const bird = zooState[area].find(b => 
                b.name === birdName || b.name.includes(birdName) || birdName.includes(b.name)
            );
            if (bird) {
                return { bird, area };
            }
        }
        return null;
    },

    // ネストの絵文字を取得
    getNestEmoji(nestType) {
        const emojiMap = {
            // 森林エリア
            '苔むした庭': '🌿',
            '古木の大穴': '🕳️',
            '木漏れ日の巣': '☀️',
            '妖精の隠れ家': '🧚',
            '樹海の宮殿': '🏰',
            'きのこの家': '🍄',
            '蔦の回廊': '🌿',
            '森の神殿': '⛩️',
            
            // 草原エリア
            '花畑の巣': '🌸',
            '軒先の鳥かご': '🏠',
            '風車小屋': '🎡',
            '蝶の舞台': '🦋',
            '虹の丘': '🌈',
            '星見台': '⭐',
            '花冠の宮殿': '👑',
            'そよ風の家': '💨',
            
            // 水辺エリア
            '蓮池の巣': '🪷',
            '滝のしぶきの巣': '💧',
            '真珠の洞窟': '🤍',
            '虹の水辺': '🌈',
            '水晶の泉': '💎',
            '貝殻の宮殿': '🐚',
            '流木の隠れ家': '🪵',
            '月光の池': '🌙'
        };
        
        return emojiMap[nestType] || '🏠';
    },

    // エリア別の色を取得
    getAreaColor(area) {
        const colors = {
            '森林': 0x228B22,
            '草原': 0x9ACD32,
            '水辺': 0x4169E1
        };
        return colors[area] || 0x808080;
    },

    // エリア別の絵文字を取得
    getAreaEmoji(area) {
        const emojis = {
            '森林': '🌲',
            '草原': '🌾',
            '水辺': '🌊'
        };
        return emojis[area] || '📍';
    },

    // エラーハンドリング
    async handleError(interaction, error) {
        console.error('ネストコマンドエラー:', error);
        
        const errorMessage = error.message || 'ネストコマンドの実行中にエラーが発生しました。';
        
        try {
            if (interaction.deferred) {
                await interaction.editReply({ content: `❌ ${errorMessage}` });
            } else {
                await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true });
            }
        } catch (replyError) {
            console.error('エラーメッセージ送信失敗:', replyError);
        }
    }
};
