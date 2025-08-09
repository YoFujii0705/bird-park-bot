const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const birdData = require('../utils/birdData');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zoo')
        .setDescription('オリジナル鳥類園の様子を見ます🏞️')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('鳥類園全体を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('area')
                .setDescription('特定エリアの詳細を表示')
                .addStringOption(option =>
                    option.setName('area')
                        .setDescription('表示するエリア')
                        .addChoices(
                            { name: '森林エリア', value: '森林' },
                            { name: '草原エリア', value: '草原' },
                            { name: '水辺エリア', value: '水辺' }
                        )
                        .setRequired(true))),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            
            const zooManager = require('../utils/zooManager');
            await zooManager.initializeServer(guildId);
            
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'view':
                    await this.handleViewCommand(interaction, guildId);
                    break;
                case 'area':
                    await this.handleAreaCommand(interaction, guildId);
                    break;
            }

        } catch (error) {
            console.error('鳥類園コマンドエラー:', error);
            
            const errorMessage = '鳥類園の表示中にエラーが発生しました。';
            try {
                if (interaction.replied) {
                    await interaction.followUp({ content: errorMessage, flags: 64 });
                } else {
                    await interaction.reply({ content: errorMessage, flags: 64 });
                }
            } catch (replyError) {
                console.log('インタラクションタイムアウト:', replyError.code);
            }
        }
    },

    async handleViewCommand(interaction, guildId) {
        const embed = await this.createZooOverviewEmbed(guildId);
        const buttons = this.createZooButtons();
        
        await interaction.reply({ 
            embeds: [embed], 
            components: [buttons] 
        });
        
        await logger.logZoo('全体表示', '全体', '', interaction.user.id, interaction.user.username, guildId);
    },

    async handleAreaCommand(interaction, guildId) {
        const area = interaction.options.getString('area');
        const embed = await this.createAreaDetailEmbed(area, guildId);
        
        await interaction.reply({ embeds: [embed] });
        
        await logger.logZoo('エリア表示', area, '', interaction.user.id, interaction.user.username, guildId);
    },

    // 🆕 見学鳥対応版全体表示
    async createZooOverviewEmbed(guildId) {
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState(guildId);
        
        // 見学鳥をエリア別に振り分け
        const visitorsByArea = await this.distributeVisitorsToAreas(guildId);
        
        const totalResidents = zooState.森林.length + zooState.草原.length + zooState.水辺.length;
        const totalVisitors = (zooState.visitors || []).length;
        const totalBirds = totalResidents + totalVisitors;
        
        const embed = new EmbedBuilder()
            .setTitle('🏞️ オリジナル鳥類園')
            .setDescription(`現在 **${totalBirds}羽** の鳥たちが園内で過ごしています\n${totalVisitors > 0 ? `(👀 見学中: ${totalVisitors}羽)` : ''}`)
            .setColor(0x228B22)
            .setTimestamp();

        const areas = [
            { name: '🌲 森林エリア', key: '森林', emoji: '🌳' },
            { name: '🌾 草原エリア', key: '草原', emoji: '🌱' },
            { name: '🌊 水辺エリア', key: '水辺', emoji: '💧' }
        ];

        areas.forEach(area => {
            const residents = zooState[area.key];
            const visitors = visitorsByArea[area.key] || [];
            const allBirds = [...residents, ...visitors];
            
            let birdList = '';
            
            // 住民の鳥
            if (residents.length > 0) {
                birdList += residents.map(bird => {
                    const sizeEmoji = this.getSizeEmoji(bird.data.全長区分);
                    return `${sizeEmoji} ${bird.name}`;
                }).join('\n');
            }
            
            // 見学中の鳥
            if (visitors.length > 0) {
                if (birdList) birdList += '\n';
                birdList += visitors.map(bird => {
                    const sizeEmoji = this.getSizeEmoji(bird.data.全長区分);
                    return `👀 ${sizeEmoji} ${bird.name} (見学中)`;
                }).join('\n');
            }
            
            if (!birdList) {
                birdList = '(現在いません)';
            }

            embed.addFields({
                name: `${area.emoji} ${area.name} (${residents.length}/5${visitors.length > 0 ? ` +${visitors.length}羽` : ''})`,
                value: birdList,
                inline: true
            });
        });

        // 見学情報の詳細
        if (totalVisitors > 0) {
            const visitorsInfo = (zooState.visitors || []).map(visitor => {
                const remainingTime = this.getRemainingVisitTime(visitor.scheduledDeparture);
                return `• ${visitor.name} (残り${remainingTime})`;
            }).join('\n');
            
            embed.addFields({
                name: '👀 見学中の鳥たち',
                value: visitorsInfo,
                inline: false
            });
        }

        embed.setFooter({ 
            text: `最終更新: ${zooState.lastUpdate.toLocaleString('ja-JP')}` 
        });

        return embed;
    },

    // 🆕 見学鳥をエリア別に振り分け
    async distributeVisitorsToAreas(guildId) {
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState(guildId);
        const visitors = zooState.visitors || [];
        
        const visitorsByArea = {
            森林: [],
            草原: [],
            水辺: []
        };
        
        visitors.forEach(visitor => {
            const birdEnvironment = visitor.data.環境;
            let targetArea;
            
            // 鳥の環境に基づいてエリア決定
            if (birdEnvironment.includes('森林') || birdEnvironment.includes('高山')) {
                targetArea = '森林';
            } else if (birdEnvironment.includes('河川・湖沼') || birdEnvironment.includes('海')) {
                targetArea = '水辺';
            } else {
                targetArea = '草原'; // 農耕地、草地、市街地など
            }
            
            visitorsByArea[targetArea].push(visitor);
        });
        
        return visitorsByArea;
    },

    // 🆕 見学鳥対応版エリア詳細
    async createAreaDetailEmbed(area, guildId) {
        const areaInfo = {
            '森林': { emoji: '🌲', description: '高い木々に囲まれた静かなエリア', color: 0x228B22 },
            '草原': { emoji: '🌾', description: '開けた草地で鳥たちが自由に過ごすエリア', color: 0x9ACD32 },
            '水辺': { emoji: '🌊', description: '池や小川がある水鳥たちのエリア', color: 0x4682B4 }
        };

        const info = areaInfo[area];
        const zooManager = require('../utils/zooManager');
        const zooState = zooManager.getZooState(guildId);
        const residents = zooState[area];
        
        // 見学鳥を取得
        const visitorsByArea = await this.distributeVisitorsToAreas(guildId);
        const visitors = visitorsByArea[area] || [];
        
        const allBirds = [...residents, ...visitors];
        const sleepStatus = this.checkSleepTime();

        const embed = new EmbedBuilder()
            .setTitle(`${info.emoji} ${area}エリア詳細`)
            .setDescription(sleepStatus.isSleeping ? 
                `${info.description}\n🌙 現在は夜間のため、鳥たちは静かに眠っています` : 
                info.description)
            .setColor(sleepStatus.isSleeping ? 0x2F4F4F : info.color)
            .setTimestamp();

        if (allBirds.length === 0) {
            embed.addFields({
                name: '現在の状況',
                value: '現在このエリアには鳥がいません',
                inline: false
            });
        } else {
            let birdIndex = 1;
            
            // 住民の鳥を表示
            for (const bird of residents) {
                const stayDuration = this.getStayDuration(bird.entryTime);
                let activityText;
                
                if (sleepStatus.isSleeping) {
                    const sleepActivity = await this.generateSleepActivity(bird, area);
                    activityText = `😴 ${sleepActivity}\n📅 滞在期間: ${stayDuration}`;
                } else {
                    activityText = `${bird.activity}\n📅 滞在期間: ${stayDuration}`;
                }
                
                embed.addFields({
                    name: `${birdIndex}. ${this.getSizeEmoji(bird.data.全長区分)} ${bird.name}`,
                    value: activityText,
                    inline: true
                });
                birdIndex++;
            }
            
            // 見学中の鳥を表示
            for (const visitor of visitors) {
                const remainingTime = this.getRemainingVisitTime(visitor.scheduledDeparture);
                const inviterText = visitor.inviterName ? ` (${visitor.inviterName}さんの招待)` : '';
                
                let activityText;
                if (sleepStatus.isSleeping) {
                    const sleepActivity = await this.generateVisitorSleepActivity(visitor, area);
                    activityText = `😴 ${sleepActivity}\n👀 見学残り時間: ${remainingTime}${inviterText}`;
                } else {
                    activityText = `👀 ${visitor.activity}\n⏰ 見学残り時間: ${remainingTime}${inviterText}`;
                }
                
                embed.addFields({
                    name: `${birdIndex}. 👀 ${this.getSizeEmoji(visitor.data.全長区分)} ${visitor.name} (見学中)`,
                    value: activityText,
                    inline: true
                });
                birdIndex++;
            }
        }

        return embed;
    },

    // 🆕 見学残り時間計算（修正版）
    getRemainingVisitTime(scheduledDeparture) {
        const now = new Date();
        
        // scheduledDepartureがDateオブジェクトでない場合の対処
        let departureTime;
        if (scheduledDeparture instanceof Date) {
            departureTime = scheduledDeparture;
        } else if (typeof scheduledDeparture === 'string') {
            departureTime = new Date(scheduledDeparture);
        } else {
            console.warn('無効なscheduledDeparture:', scheduledDeparture);
            return 'データエラー';
        }
        
        const remaining = departureTime - now;
        
        if (remaining <= 0) {
            return 'まもなく終了';
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `約${hours}時間${minutes}分`;
        } else {
            return `約${minutes}分`;
        }
    },

    // 🆕 見学鳥の睡眠活動生成
    async generateVisitorSleepActivity(visitor, area) {
        const sleepActivities = [
            '見学で疲れて安らかに眠っています',
            '新しい環境に慣れて穏やかに眠っています',
            '明日もここにいたいと夢見ているようです',
            '住民の鳥たちと一緒に仲良く眠っています',
            '見学の思い出を夢に見ながら眠っています',
            'ここの心地よさに感動して深く眠っています',
            '招待してくれた人への感謝を胸に眠っています',
            '鳥類園の美しさに包まれて眠っています'
        ];
        
        return sleepActivities[Math.floor(Math.random() * sleepActivities.length)];
    },

    // 既存のメソッドはそのまま
    checkSleepTime() {
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        const hour = jstTime.getHours();
        
        if (hour >= 22 || hour < 7) {
            return { isSleeping: true };
        }
        
        return { isSleeping: false };
    },

    async generateSleepActivity(bird, area) {
        try {
            const weatherManager = require('../utils/weather');
            const weather = await weatherManager.getCurrentWeather();
            
            const weatherSleepActivities = {
            sunny: [
                     '満天の星空の下で気持ちよく眠っています',
                     '月明かりが照らす中で安らかに眠っています',
                     '清々しい夜空を感じながら眠っています',
                     '穏やかな夜の空気の中で深く眠っています'
                   ],
            cloudy: [
                     '雲に覆われた静かな夜に眠っています',
                     '曇り空の下で落ち着いて休んでいます',
                     '雲間から見える星を眺めながら眠っています',
                     '雲の隙間を通る月光の下で眠っています'
                   ],
            rainy: [
                     '雨音を聞きながら安らかに眠っています',
                     '雨宿りをしながら静かに眠っています',
                     '雨の夜の涼しさの中で深く眠っています',
                     '雨粒の音に包まれて眠っています',
                     '雨のリズムに合わせて深い眠りについています',
                     '雨の匂いを感じながら穏やかに眠っています',
                     '雨雲の下で心地よく丸くなっています',
                     '雨の恵みに感謝しながら眠っているようです'
                   ],
            snowy: [
                     '雪景色の中で静かに眠っています',
                     '雪に包まれて暖かく眠っています',
                     '雪の結晶が舞い散る中で眠っています',
                     '雪明かりの下で安らかに眠っています',
                     '雪の毛布に包まれて幸せそうに眠っています',
                     '雪化粧した世界で特別な夢を見ているようです',
                     '雪の静寂に包まれて深い眠りについています',
                     '雪の結晶を数えながら眠りについたようです'
                    ],
            stormy: [
                    '嵐を避けて安全な場所で眠っています',
                    '風雨から身を守って眠っています',
                    '嵐が過ぎるのを待ちながら眠っています',
                    '嵐の夜も安心して眠りについています',
                    '強い風に負けず安全な場所で休んでいます',
                    '嵐の音を遠くに聞きながら静かに眠っています',
                    '明日の晴天を夢見て嵐をやり過ごしています'
                    ],
            foggy: [
                    '霧に包まれて神秘的に眠っています',
                    '霧の中でひっそりと眠っています',
                    '霧の静寂の中で安らかに眠っています',
                    '霧のベールに守られて眠っています',
                    '幻想的な霧の世界で夢心地です',
                    '霧の湿り気を感じながら深く眠っています',
                    '霧に包まれた秘密の場所で休んでいます'
                   ]
};

            if (weather.condition !== 'unknown' && weatherSleepActivities[weather.condition]) {
                const weatherActivities = weatherSleepActivities[weather.condition];
                return weatherActivities[Math.floor(Math.random() * weatherActivities.length)];
            }
        } catch (error) {
            console.log('天気取得エラー（睡眠ステータス）:', error.message);
        }

        const sleepActivities = {
            '森林': [
                '羽を丸めて枝の上で眠っています',
                '頭を羽の下に隠して休んでいます',
                '木の洞で安全に眠っています',
                '仲間と寄り添って眠っています',
                '片脚で立ったまま器用に眠っています',
                '羽繕いをしてから眠りにつきました',
                '月明かりの下で静かに休んでいます',
                '夜露に濡れながらも深く眠っています'
            ],
            '草原': [
                '草むらの中で身を寄せ合って眠っています',
                '地面に座り込んで丸くなって眠っています',
                '風に揺れる草に包まれて眠っています',
                '星空を見上げてから眠りについたようです',
                '羽を広げて地面を温めながら眠っています',
                '夜の静寂の中でぐっすりと眠っています',
                '脚を羽にしまって丸い毛玉のようになっています',
                '朝露が降りる前に夢の中です'
            ],
            '水辺': [
                '水面近くの岩の上で眠っています',
                '片脚を上げたまま器用に眠っています',
                '首を背中に回して眠っています',
                '水際で波音を聞きながら眠っています',
                '羽に顔を埋めて眠っています',
                'さざ波の音に包まれて安らかに眠っています',
                '水草の間で身を隠して眠っています',
                '月光が水面に映る中で静かに休んでいます'
            ]
        };

        const areaActivities = sleepActivities[area] || sleepActivities['森林'];
        return areaActivities[Math.floor(Math.random() * areaActivities.length)];
    },

    getStayDuration(entryTime) {
        const now = new Date();
        const diff = now - entryTime;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) {
            return `${days}日${hours}時間`;
        } else {
            return `${hours}時間`;
        }
    },

    getSizeEmoji(size) {
        const sizeEmojis = {
            '小': '🐤',
            '中': '🐦',
            '大': '🦅',
            '特大': '🦢'
        };
        return sizeEmojis[size] || '🐦';
    },

    createZooButtons() {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('zoo_forest')
                    .setLabel('🌲 森林エリア')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('zoo_grassland')
                    .setLabel('🌾 草原エリア')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('zoo_waterside')
                    .setLabel('🌊 水辺エリア')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('zoo_refresh')
                    .setLabel('🔄 更新')
                    .setStyle(ButtonStyle.Primary)
            );
        
        return row;
    }
};
