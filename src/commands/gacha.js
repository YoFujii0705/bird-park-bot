const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
const birdData = require('../utils/birdData');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gacha')
        .setDescription('鳥ガチャを回します！🐦')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('召喚する鳥の数（1-10羽）')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)),

    async execute(interaction) {
        try {
            // データ初期化チェック
            if (!birdData.initialized) {
                await interaction.reply({
                    content: '🔄 鳥データを読み込み中です...少々お待ちください',
                    ephemeral: true
                });
                await birdData.initialize();
            }

            const count = interaction.options.getInteger('count') || 1;
            const birds = birdData.getRandomBirds(count);

            if (birds.length === 0) {
                await interaction.reply({
                    content: '❌ 鳥データが見つかりませんでした。管理者に連絡してください。',
                    ephemeral: true
                });
                return;
            }

            // 単体ガチャ
            if (count === 1) {
                const bird = birds[0];
                const embed = this.createBirdEmbed(bird);
                const buttons = this.createVisitButtons(bird.名前);
                
                await interaction.reply({ 
                    embeds: [embed], 
                    components: [buttons] 
                });
                
                // ログ記録
                await logger.logGachaWithServer(
                    interaction.user.id,
                    interaction.user.username,
                    '単体ガチャ',
                    bird.名前,
                    interaction.guild.id
                );

                // ボタン待機
                this.handleSingleBirdVisit(interaction, bird);
            } 
            // 複数ガチャ
            else {
                const embed = this.createMultipleBirdsEmbed(birds, count);
                const selectMenu = this.createBirdSelectMenu(birds);
                
                await interaction.reply({ 
                    embeds: [embed], 
                    components: [selectMenu] 
                });
                
                // ログ記録
                const birdNames = birds.map(b => b.名前).join(', ');
                await logger.logGachaWithServer(
                    interaction.user.id,
                    interaction.user.username,
                    `${count}連ガチャ`,
                    birdNames,
                    interaction.guild.id
                );

                // 選択待機
                this.handleMultipleBirdVisit(interaction, birds);
            }

        } catch (error) {
            console.error('ガチャコマンドエラー:', error);
            
            const errorMessage = 'ガチャの実行中にエラーが発生しました。';
            if (interaction.replied) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 単体ガチャ用ボタン作成
    createVisitButtons(birdName) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`visit_yes_${birdName}`)
                    .setLabel('見学に呼ぶ')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🏞️'),
                new ButtonBuilder()
                    .setCustomId(`visit_no_${birdName}`)
                    .setLabel('呼ばない')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );
    },

    // 複数ガチャ用選択メニュー作成
    createBirdSelectMenu(birds) {
        const options = birds.map((bird, index) => ({
            label: bird.名前,
            value: bird.名前,
            description: `${bird.キャッチコピー}`,
            emoji: this.getBirdEmoji(bird)
        }));

        // 「呼ばない」オプションも追加
        options.push({
            label: '誰も呼ばない',
            value: 'none',
            description: '今回は見学に呼びません',
            emoji: '❌'
        });

        return new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_visitor_bird')
                    .setPlaceholder('見学に呼ぶ鳥を選んでください...')
                    .addOptions(options.slice(0, 25)) // Discord制限
            );
    },

    // 鳥の特徴に応じた絵文字選択
    getBirdEmoji(bird) {
        const environment = bird.環境;
        if (environment.includes('森林')) return '🌲';
        if (environment.includes('水辺') || environment.includes('海')) return '🌊';
        if (environment.includes('草原') || environment.includes('農耕地')) return '🌾';
        if (environment.includes('高山')) return '⛰️';
        return '🐦';
    },

    // 単体ガチャのボタン処理
    async handleSingleBirdVisit(interaction, bird) {
        try {
            const response = await interaction.fetchReply();
            const confirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 60000
            });

            const isVisit = confirmation.customId.startsWith('visit_yes');
            
            if (isVisit) {
                await this.inviteBirdToZoo(confirmation, bird, interaction.guild.id);
            } else {
                await confirmation.update({
                    content: `${bird.名前}を見学に呼ばないことにしました。また機会があればぜひ！`,
                    embeds: [],
                    components: []
                });
            }

        } catch (error) {
            if (error.code === 'InteractionCollectorError') {
                console.log('ボタン操作がタイムアウトしました');
                // タイムアウト時はボタンを無効化
                try {
                    const embed = this.createBirdEmbed(bird);
                    embed.addFields({
                        name: '⏰ タイムアウト',
                        value: '見学招待の時間が過ぎました。',
                        inline: false
                    });
                    
                    await interaction.editReply({
                        embeds: [embed],
                        components: []
                    });
                } catch (editError) {
                    console.log('タイムアウト時の更新に失敗しました');
                }
            } else {
                console.error('見学ボタン処理エラー:', error);
            }
        }
    },

    // 複数ガチャの選択処理
    async handleMultipleBirdVisit(interaction, birds) {
        try {
            const response = await interaction.fetchReply();
            const confirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 60000
            });

            const selectedBirdName = confirmation.values[0];
            
            if (selectedBirdName === 'none') {
                await confirmation.update({
                    content: '今回は誰も見学に呼ばないことにしました。また機会があればぜひ！',
                    embeds: [],
                    components: []
                });
                return;
            }

            const selectedBird = birds.find(b => b.名前 === selectedBirdName);
            if (selectedBird) {
                await this.inviteBirdToZoo(confirmation, selectedBird, interaction.guild.id);
            }

        } catch (error) {
            if (error.code === 'InteractionCollectorError') {
                console.log('選択操作がタイムアウトしました');
                try {
                    const embed = this.createMultipleBirdsEmbed(birds, birds.length);
                    embed.addFields({
                        name: '⏰ タイムアウト',
                        value: '見学招待の時間が過ぎました。',
                        inline: false
                    });
                    
                    await interaction.editReply({
                        embeds: [embed],
                        components: []
                    });
                } catch (editError) {
                    console.log('タイムアウト時の更新に失敗しました');
                }
            } else {
                console.error('見学選択処理エラー:', error);
            }
        }
    },

    // 鳥を鳥類園に招待
    async inviteBirdToZoo(interaction, bird, guildId) {
        try {
            const zooManager = require('../utils/zooManager');
            
            // 見学鳥として追加
            await zooManager.addVisitorBird(guildId, bird, interaction.user.id, interaction.user.username);
            
            const embed = new EmbedBuilder()
                .setTitle('🎉 見学招待成功！')
                .setDescription(`**${bird.名前}**が${interaction.guild.name}の鳥類園に見学にやってきました！`)
                .setColor(0x00FF00)
                .addFields(
                    {
                        name: '🎭 現在の様子',
                        value: this.generateVisitorActivity(bird),
                        inline: false
                    },
                    {
                        name: '⏰ 見学時間',
                        value: '約2-4時間の予定です',
                        inline: true
                    },
                    {
                        name: '🎁 特典',
                        value: '見学後、この鳥の入園優先度がアップします！',
                        inline: true
                    }
                )
                .setTimestamp();

            await interaction.update({
                embeds: [embed],
                components: []
            });

            // 見学イベントログ
            await logger.logEvent(
                '見学招待',
                `${interaction.user.username}さんが${bird.名前}を見学に招待しました`,
                bird.名前,
                guildId
            );

        } catch (error) {
            console.error('見学招待エラー:', error);
            try {
                await interaction.update({
                    content: '見学招待中にエラーが発生しました。もう一度お試しください。',
                    embeds: [],
                    components: []
                });
            } catch (updateError) {
                console.log('エラー応答に失敗しました');
            }
        }
    },

    // 見学鳥の活動生成
    generateVisitorActivity(bird) {
        const activities = [
            `${bird.名前}が鳥類園の様子を興味深そうに見回しています`,
            `${bird.名前}が先住の鳥たちに挨拶をしています`,
            `${bird.名前}がお気に入りの場所を見つけたようです`,
            `${bird.名前}が鳥類園の環境をとても気に入ったようです`,
            `${bird.名前}が他の鳥たちと楽しそうに交流しています`,
            `${bird.名前}がリラックスしてからだを揺さぶっています`,
            `${bird.名前}が鳥類園の美しさに感動しているようです`
        ];
        
        return activities[Math.floor(Math.random() * activities.length)];
    },

    // 単体鳥用Embed作成
    createBirdEmbed(bird) {
        const colorMap = {
            '茶系': 0x8B4513,
            '白系': 0xFFFFFF,
            '黒系': 0x2F4F4F,
            '赤系': 0xFF6347,
            '黄系': 0xFFD700,
            '青系': 0x4169E1,
            '緑系': 0x228B22,
            '灰系': 0x808080
        };

        const mainColor = bird.色.split('、')[0];
        const embedColor = colorMap[mainColor] || 0x00AE86;

        const embed = new EmbedBuilder()
            .setTitle(`🐦 ${bird.名前}`)
            .setColor(embedColor)
            .setDescription(`*${bird.キャッチコピー}*\n\n${bird.説明文}`)
            .addFields(
                { name: '📏 全長', value: `${bird.全長} (${bird.全長区分})`, inline: true },
                { name: '🎨 色', value: bird.色, inline: true },
                { name: '📅 季節', value: bird.季節, inline: true },
                { name: '✈️ 渡り', value: bird.渡り区分, inline: true },
                { name: '🏞️ 環境', value: bird.環境, inline: true },
                { name: '🍽️ 好物', value: bird.好物 || '設定なし', inline: true }
            )
            .setTimestamp();

        // 見学招待の案内を追加
        embed.addFields({
            name: '🏞️ 見学招待',
            value: `${bird.名前}を鳥類園に見学に呼びますか？`,
            inline: false
        });

        return embed;
    },

    // 複数鳥用Embed作成
    createMultipleBirdsEmbed(birds, count) {
        const embed = new EmbedBuilder()
            .setTitle(`🐦✨ ${count}連ガチャ結果！`)
            .setColor(0x00AE86)
            .setDescription(`${count}羽の鳥が現れました！\n\n💡 その中から1羽を選んで見学に呼ぶことができます。`)
            .setTimestamp();

        const birdList = birds.map((bird, index) => {
            return `${index + 1}. **${bird.名前}** (${bird.全長区分})\n*${bird.キャッチコピー}*`;
        }).join('\n\n');

        embed.addFields({
            name: '召喚された鳥たち',
            value: birdList,
            inline: false
        });

        return embed;
    }
};
