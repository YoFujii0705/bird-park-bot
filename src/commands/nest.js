const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const bondLevelManager = require('../utils/bondLevelManager');
const sheets = require('../../config/sheets');

// 1. 最初にSlashCommandBuilderを定義
const data = new SlashCommandBuilder()
    .setName('nest')
    .setDescription('ネスト関連のコマンド')
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('新しいネストを建設します')
            .addStringOption(option =>
                option.setName('bird')
                    .setDescription('ネストを建設する鳥の名前')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('所有しているネストを表示します')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('visit')
            .setDescription('ネストの詳細を表示します')
            .addStringOption(option =>
                option.setName('bird')
                    .setDescription('訪問する鳥の名前')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('change')
            .setDescription('ネストのタイプを変更します')
            .addStringOption(option =>
                option.setName('bird')
                    .setDescription('ネストを変更する鳥の名前')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('新しいネストタイプ')
                    .setRequired(true)
            )
    );

// 2. execute関数を定義
async function execute(interaction) {
    try {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'create':
                await handleNestCreate(interaction);
                break;
            case 'view':
                await handleNestView(interaction);
                break;
            case 'visit':
                await handleNestVisit(interaction);
                break;
            case 'change':
                await handleNestChange(interaction);
                break;
            default:
                await interaction.reply('不明なサブコマンドです。');
        }
    } catch (error) {
        console.error('ネストコマンドエラー:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
        }
    }
}

// 3. ハンドラー関数を実装
async function handleNestCreate(interaction) {
    try {
        const birdName = interaction.options.getString('bird');
        const userId = interaction.user.id;
        const userName = interaction.user.displayName || interaction.user.username;
        const serverId = interaction.guild.id;
        
        // NestSystemインスタンスを作成
        const nestSystem = new NestSystem();
        
        // 建設可能かチェック
        const buildCheck = await nestSystem.canBuildNest(userId, birdName, serverId);
        
        if (!buildCheck.canBuild) {
            await interaction.reply({
                content: `❌ ネスト建設不可: ${buildCheck.message}`
            });
            return;
        }
        
        // 鳥のエリアを取得してネストタイプを生成
        const birdArea = nestSystem.getBirdArea(birdName, serverId);
        const nestOptions = nestSystem.generateNestOptions(birdArea);
        
        // ガチャ形式で3つの選択肢を提示
        const embed = {
            title: `🏗️ ${birdName}のネスト建設`,
            description: `${birdArea}エリアに適したネストタイプを選択してください：`,
            color: 0x4CAF50,
            fields: nestOptions.map((nestType, index) => ({
                name: `${index + 1}. ${nestType}`,
                value: '建設可能',
                inline: true
            })),
            footer: {
                text: '番号を選択してネストを建設してください'
            }
        };
        
        await interaction.reply({
            embeds: [embed],
            components: [{
                type: 1,
                components: nestOptions.map((nestType, index) => ({
                    type: 2,
                    style: 1,
                    label: `${index + 1}. ${nestType}`,
                    custom_id: `nest_select_${index}_${birdName}_${nestType}`
                }))
            }]
        });
        
    } catch (error) {
        console.error('ネスト建設エラー:', error);
        await interaction.reply({
            content: 'ネスト建設中にエラーが発生しました。'
        });
    }
}

async function handleNestView(interaction) {
    try {
        const userId = interaction.user.id;
        const serverId = interaction.guild.id;
        const nestSystem = new NestSystem();
        
        const userNests = await nestSystem.getUserNests(userId, serverId);
        
        if (userNests.length === 0) {
            await interaction.reply({
                content: '🏠 まだネストを建設していません。\n`/nest create` でネストを建設してみましょう！'
            });
            return;
        }
        
        const embed = {
            title: `🏠 ${interaction.user.displayName || interaction.user.username}さんのネスト一覧`,
            color: 0x8BC34A,
            fields: userNests.map(nest => ({
                name: `🐦 ${nest.鳥名}`,
                value: `**ネストタイプ**: ${nest.ネストタイプ}\n**カスタム名**: ${nest.カスタム名 || '未設定'}`,
                inline: true
            })),
            footer: {
                text: `所有ネスト数: ${userNests.length}/5`
            }
        };
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('ネスト表示エラー:', error);
        await interaction.reply({
            content: 'ネスト情報の取得中にエラーが発生しました。'
        });
    }
}

async function handleNestVisit(interaction) {
    try {
        const birdName = interaction.options.getString('bird');
        const userId = interaction.user.id;
        const serverId = interaction.guild.id;
        
        await interaction.deferReply(); // 処理時間を考慮
        
        const nestData = await sheets.getBirdNest(userId, birdName, serverId);
        
        if (!nestData) {
            await interaction.editReply({
                content: `❌ ${birdName}のネストが見つかりません。`
            });
            return;
        }
        
        // 🎁 贈り物データを取得
        const gifts = await sheets.getBirdGifts(birdName, serverId);
        const userGifts = gifts.filter(gift => gift.giverId === userId);
        
        // 🌤️ 現在の時間帯と天気を取得
        const timeInfo = getCurrentTimeAndWeather();
        
        // 🦅 鳥の現在の様子を生成（時間帯・天気・ネスト固有）
        const birdActivity = generateEnhancedBirdActivity(birdName, nestData.ネストタイプ, timeInfo, userGifts.length);
        
        // 🏠 ネストの雰囲気を生成（時間帯・贈り物数・季節対応）
        const nestAtmosphere = generateEnhancedNestAtmosphere(nestData.ネストタイプ, userGifts.length, timeInfo);
        
        // 🎁 贈り物展示システム（配置別）
        const giftDisplay = generateGiftDisplaySystem(userGifts, nestData.ネストタイプ);
        
        // 📊 ネスト統計情報
        const nestStats = generateNestStatistics(nestData, userGifts);
        
        const embed = {
            title: `🏠 ${nestData.ユーザー名}さんの${birdName}のネスト`,
            description: nestAtmosphere.description,
            color: getNestColor(nestData.ネストタイプ),
            fields: [
                {
                    name: `🐦 ${birdName}の様子 ${timeInfo.timeEmoji}`,
                    value: birdActivity,
                    inline: false
                }
            ],
            thumbnail: {
                url: getNestThumbnail(nestData.ネストタイプ)
            },
            footer: {
                text: `${nestData.ネストタイプ} • 建設日: ${nestData.日時 ? new Date(nestData.日時).toLocaleDateString('ja-JP') : '不明'} • ${timeInfo.currentTime}`
            }
        };
        
        // 🎁 贈り物展示フィールドを追加
        if (giftDisplay.fields.length > 0) {
            embed.fields.push(...giftDisplay.fields);
        } else {
            embed.fields.push({
                name: '🎁 贈り物展示スペース',
                value: `${birdName}はまだ贈り物をもらっていません。\n\`/gift bird:${birdName}\` で贈り物をあげてみましょう！`,
                inline: false
            });
        }
        
        // 📊 ネスト統計を追加
        if (nestStats.showStats) {
            embed.fields.push({
                name: '📊 ネスト情報',
                value: nestStats.stats,
                inline: true
            });
        }
        
        // 🌿 特別な環境効果
        const environmentalEffect = generateEnvironmentalEffect(nestData.ネストタイプ, timeInfo);
        if (environmentalEffect) {
            embed.fields.push({
                name: '🌿 環境の様子',
                value: environmentalEffect,
                inline: true
            });
        }
        
        // 🔗 専用チャンネルリンク
        if (nestData.チャンネルID) {
            embed.fields.push({
                name: '🔗 専用チャンネル',
                value: `<#${nestData.チャンネルID}>`,
                inline: true
            });
        }
        
        // 💫 特別なイベント情報
        const specialEvent = generateSpecialNestEvent(nestData.ネストタイプ, timeInfo, userGifts.length);
        if (specialEvent) {
            embed.fields.push({
                name: '✨ 特別なできごと',
                value: specialEvent,
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('ネスト詳細エラー:', error);
        
        // エラーハンドリングを修正
        if (interaction.deferred) {
            await interaction.editReply({ 
                content: 'ネスト詳細の取得中にエラーが発生しました。' 
            });
        } else if (!interaction.replied) {
            await interaction.reply({ 
                content: 'ネスト詳細の取得中にエラーが発生しました。',
                flags: [4096] // EPHEMERAL
            });
        }
    }
}

// 🎨 ネストタイプに応じた色を取得（修正版）
function getNestColor(nestType) {
    const colors = {
        '蓮池の巣': 0x4FC3F7,      // 水色
        '苔むした庭': 0x4CAF50,    // 緑
        '古木の大穴': 0x8D6E63,    // 茶色
        '花畑の巣': 0xE91E63,      // ピンク
        '樹海の宮殿': 0x2E7D32,    // 深緑
        '真珠の洞窟': 0x9C27B0,    // 紫
        '水晶の泉': 0x00BCD4,      // シアン
        '貝殻の宮殿': 0xFFB74D,    // オレンジ
        '虹の丘': 0xFF9800,        // オレンジ
        '星見台': 0x3F51B5,        // 藍色
        '木漏れ日の巣': 0x66BB6A,  // 明るい緑
        '妖精の隠れ家': 0xAB47BC,  // 薄紫
        'きのこの家': 0x8D6E63,    // 茶色
        '蔦の回廊': 0x4CAF50,      // 緑
        '森の神殿': 0x2E7D32,      // 深緑
        '軒先の鳥かご': 0xFFA726,  // オレンジ
        '風車小屋': 0x42A5F5,      // 青
        '蝶の舞台': 0xEC407A,      // ピンク
        '花冠の宮殿': 0xEF5350,    // 赤
        'そよ風の家': 0x26C6DA,    // 水色
        '滝のしぶきの巣': 0x29B6F6, // 明るい青
        '虹の水辺': 0xFF7043,      // オレンジレッド
        '流木の隠れ家': 0x8D6E63,  // 茶色
        '月光の池': 0x5C6BC0       // 紫青
    };
    
    return colors[nestType] || 0x8BC34A; // デフォルト色
}

// 🌤️ 現在の時間帯と天気情報を取得
function getCurrentTimeAndWeather() {
    const now = new Date();
    const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    const hour = jstTime.getHours();
    
    let timeSlot, timeEmoji;
    if (hour >= 5 && hour < 7) {
        timeSlot = 'dawn';
        timeEmoji = '🌅';
    } else if (hour >= 7 && hour < 11) {
        timeSlot = 'morning';
        timeEmoji = '🌄';
    } else if (hour >= 11 && hour < 15) {
        timeSlot = 'noon';
        timeEmoji = '🏞️';
    } else if (hour >= 15 && hour < 19) {
        timeSlot = 'evening';
        timeEmoji = '🌇';
    } else if (hour >= 19 && hour < 22) {
        timeSlot = 'night';
        timeEmoji = '🌃';
    } else {
        timeSlot = 'sleep';
        timeEmoji = '🌙';
    }
    
    // 季節情報も追加
    const month = jstTime.getMonth() + 1;
    let season;
    if (month >= 3 && month <= 5) season = '春';
    else if (month >= 6 && month <= 8) season = '夏';
    else if (month >= 9 && month <= 11) season = '秋';
    else season = '冬';
    
    return {
        timeSlot,
        timeEmoji,
        season,
        hour,
        currentTime: jstTime.toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Tokyo'
        })
    };
}

// 🦅 強化された鳥の活動生成（全ネストタイプ対応版）
function generateEnhancedBirdActivity(birdName, nestType, timeInfo, giftCount) {
    const timeActivities = {
        dawn: {
            '蓮池の巣': [
                `${birdName}が朝霧に包まれた蓮池で、水面に映る朝日を眺めています`,
                `${birdName}が蓮の花びらに宿る朝露を美しく見つめています`,
                `${birdName}が早朝の静寂の中、蓮池の神秘的な雰囲気を楽しんでいます`
            ],
            '苔むした庭': [
                `${birdName}が朝露に濡れた苔の上を、そっと歩いています`,
                `${birdName}が苔むした石の上で、朝の空気を深く吸い込んでいます`,
                `${birdName}が庭園の静寂に包まれて、瞑想しているようです`
            ],
            '花畑の巣': [
                `${birdName}が朝日に照らされた花々の間で、優雅に羽を広げています`,
                `${birdName}が花畑に響く小鳥のさえずりに耳を傾けています`,
                `${birdName}が朝の花の香りに包まれて、幸せそうにしています`
            ],
            '古木の大穴': [
                `${birdName}が古木の洞から朝日を眺め、新しい一日の始まりを感じています`,
                `${birdName}が古木の年輪を見つめながら、悠久の時の流れを感じています`,
                `${birdName}が朝の森の音に耳を澄ませ、自然との調和を楽しんでいます`
            ],
            '樹海の宮殿': [
                `${birdName}が宮殿の高い塔から朝霧に包まれた森を見渡しています`,
                `${birdName}が古代の石柱に止まり、宮殿に眠る歴史を感じています`,
                `${birdName}が宮殿の神秘的な力に触れ、特別な朝を迎えています`
            ],
            '真珠の洞窟': [
                `${birdName}が朝日に照らされた真珠の輝きに魅了されています`,
                `${birdName}が洞窟の奥で虹色の光に包まれて、幻想的な朝を過ごしています`,
                `${birdName}が真珠の反射する光の中で、美しい朝の舞を踊っています`
            ],
            '木漏れ日の巣': [
                `${birdName}が朝の木漏れ日を浴びて、光と影の美しいパターンを楽しんでいます`,
                `${birdName}が新緑の葉を通る朝日に包まれて、森の生命力を感じています`,
                `${birdName}が木々の間を縫う光の筋を追いかけて遊んでいます`
            ],
            '妖精の隠れ家': [
                `${birdName}が妖精たちと朝の挨拶を交わしているようです`,
                `${birdName}が隠れ家に舞い込む朝の光に、小さな虹を見つけて喜んでいます`,
                `${birdName}が妖精の魔法に守られた朝を、特別な気持ちで迎えています`
            ],
            'きのこの家': [
                `${birdName}が巨大なきのこの傘の下で、朝露を避けながら朝を迎えています`,
                `${birdName}がきのこの胞子が舞う幻想的な朝に、不思議な力を感じています`,
                `${birdName}がきのこの家の温かさに包まれて、安らかな朝を過ごしています`
            ],
            '軒先の鳥かご': [
                `${birdName}が美しい鳥かごから朝の街並みを眺めています`,
                `${birdName}が職人の技が光る細工を見つめて、芸術の美しさを感じています`,
                `${birdName}が朝の光に輝く金属の装飾に、工芸の素晴らしさを見出しています`
            ],
            '風車小屋': [
                `${birdName}が朝風に回る風車の音を聞きながら、穏やかな朝を迎えています`,
                `${birdName}が風車小屋の高い場所から、朝日に照らされた草原を見渡しています`,
                `${birdName}が風の歌声に合わせて、美しい朝の歌を奏でています`
            ],
            '蝶の舞台': [
                `${birdName}が朝の蝶たちと一緒に、美しい舞を披露しています`,
                `${birdName}が舞台の上で朝日を浴びて、華麗なパフォーマンスを見せています`,
                `${birdName}が蝶たちから舞のレッスンを受けているようです`
            ],
            '滝のしぶきの巣': [
                `${birdName}が朝日に輝く滝のしぶきの中で、虹色の光を楽しんでいます`,
                `${birdName}が滝の音をBGMに、爽やかな朝の時間を過ごしています`,
                `${birdName}が水しぶきに包まれて、自然のシャワーを楽しんでいます`
            ],
            '水晶の泉': [
                `${birdName}が水晶のように透明な泉で、朝の光の屈折を楽しんでいます`,
                `${birdName}が泉の底に沈む水晶を見つめて、その美しさに見とれています`,
                `${birdName}が水晶の泉の神秘的な力を感じて、特別な朝を迎えています`
            ]
        },
        
        morning: {
            '古木の大穴': [
                `${birdName}が古木の温もりに包まれながら、森の生き物たちと交流しています`,
                `${birdName}が木の洞の中で、長い歴史の物語を感じています`,
                `${birdName}が古木の枝に止まり、森全体を見守っています`
            ],
            '樹海の宮殿': [
                `${birdName}が宮殿の広間で、古代の知恵を学んでいるようです`,
                `${birdName}が宮殿の庭園で、魔法の植物と戯れています`,
                `${birdName}が宮殿の秘密の部屋を探検しています`
            ],
            '真珠の洞窟': [
                `${birdName}が真珠の光に包まれて、幻想的な午前を過ごしています`,
                `${birdName}が洞窟の奥で、真珠の歌声を聞いているようです`,
                `${birdName}が真珠の輝きの中で、美しい羽繕いをしています`
            ],
            '木漏れ日の巣': [
                `${birdName}が移ろう木漏れ日を追いかけて、森の中で遊んでいます`,
                `${birdName}が光と影の中で、自然のアートを楽しんでいます`,
                `${birdName}が葉っぱの隙間から差す光で、影絵遊びをしています`
            ],
            '妖精の隠れ家': [
                `${birdName}が妖精たちとお茶会を楽しんでいるようです`,
                `${birdName}が隠れ家の小さな家具を興味深そうに眺めています`,
                `${birdName}が妖精の魔法で、花を咲かせる手伝いをしています`
            ],
            'きのこの家': [
                `${birdName}がきのこの胞子で遊んで、ふわふわと舞い上がっています`,
                `${birdName}がきのこの家の地下室を探検しています`,
                `${birdName}がきのこの不思議な形に魅了されています`
            ]
        },
        
        sleep: {
            '古木の大穴': [
                `${birdName}が古木の洞の奥で、木の温もりに包まれて眠っています`,
                `${birdName}が古木の年輪を数えながら、穏やかに眠りについています`,
                `${birdName}が森の夜の音を子守歌に、深い眠りを楽しんでいます`
            ],
            '樹海の宮殿': [
                `${birdName}が宮殿の寝室で、古代の夢を見ているようです`,
                `${birdName}が月光に照らされた宮殿で、神秘的な眠りについています`,
                `${birdName}が宮殿の静寂に包まれて、魔法的な夢の世界にいます`
            ],
            '真珠の洞窟': [
                `${birdName}が真珠の優しい光に包まれて、安らかに眠っています`,
                `${birdName}が洞窟の奥で、真珠の子守歌を聞きながら眠っています`,
                `${birdName}が虹色の光の中で、美しい夢を見ています`
            ],
            '木漏れ日の巣': [
                `${birdName}が月光の木漏れ日に包まれて、幻想的な夜を過ごしています`,
                `${birdName}が夜の森の静寂の中で、自然と一体になって眠っています`,
                `${birdName}が葉っぱの間を通る月光を見ながら、穏やかに眠っています`
            ],
            '妖精の隠れ家': [
                `${birdName}が妖精たちに守られて、安全な夜を過ごしています`,
                `${birdName}が隠れ家の小さなベッドで、妖精と一緒に眠っています`,
                `${birdName}が妖精の魔法に包まれて、特別な夢を見ています`
            ],
            'きのこの家': [
                `${birdName}がきのこの傘の下で、自然のベッドに包まれて眠っています`,
                `${birdName}がきのこの家の温かさの中で、心地よい眠りについています`,
                `${birdName}がきのこの胞子の優しい香りに包まれて眠っています`
            ]
        }
    };

    // デフォルト活動（全ネストタイプ対応）
    const defaultActivities = {
        '蓮池の巣': `${birdName}が蓮池の美しさを堪能しています`,
        '苔むした庭': `${birdName}が苔むした庭で穏やかに過ごしています`,
        '古木の大穴': `${birdName}が古木の歴史を感じながら休んでいます`,
        '花畑の巣': `${birdName}が花畑の中で幸せそうにしています`,
        '樹海の宮殿': `${birdName}が宮殿の神秘的な雰囲気を楽しんでいます`,
        '真珠の洞窟': `${birdName}が真珠の輝きに見とれています`,
        '木漏れ日の巣': `${birdName}が美しい木漏れ日の中でリラックスしています`,
        '妖精の隠れ家': `${birdName}が妖精たちと楽しい時間を過ごしています`,
        'きのこの家': `${birdName}がきのこの家で不思議な体験をしています`,
        '蔦の回廊': `${birdName}が蔦に覆われた回廊を優雅に歩いています`,
        '森の神殿': `${birdName}が神殿の神聖な雰囲気に包まれています`,
        '軒先の鳥かご': `${birdName}が美しい鳥かごの中で上品に過ごしています`,
        '風車小屋': `${birdName}が風車の音を聞きながら心地よく過ごしています`,
        '蝶の舞台': `${birdName}が舞台の上で華麗なパフォーマンスを見せています`,
        '虹の丘': `${birdName}が丘の上で虹の美しさを楽しんでいます`,
        '星見台': `${birdName}が星見台から美しい景色を眺めています`,
        '花冠の宮殿': `${birdName}が花冠に包まれた宮殿で優雅に過ごしています`,
        'そよ風の家': `${birdName}がそよ風に包まれて心地よく過ごしています`,
        '滝のしぶきの巣': `${birdName}が滝のしぶきの中で爽快な時間を過ごしています`,
        '虹の水辺': `${birdName}が虹色に輝く水辺で美しい時間を過ごしています`,
        '水晶の泉': `${birdName}が水晶の泉の神秘的な美しさに魅了されています`,
        '貝殻の宮殿': `${birdName}が貝殻で装飾された宮殿で海の恵みを感じています`,
        '流木の隠れ家': `${birdName}が流木の隠れ家で自然の造形美を楽しんでいます`,
        '月光の池': `${birdName}が月光に照らされた池で幻想的な時間を過ごしています`
    };

    // 贈り物数による特別な活動
    if (giftCount >= 10) {
        return `${birdName}が数多くの贈り物に囲まれて、とても満足そうにしています✨ ` + 
               (timeActivities[timeInfo.timeSlot]?.[nestType]?.[0] || defaultActivities[nestType] || `${birdName}が幸せそうに過ごしています`);
    } else if (giftCount >= 5) {
        return `${birdName}が大切な贈り物を眺めながら、穏やかに過ごしています💝 ` + 
               (timeActivities[timeInfo.timeSlot]?.[nestType]?.[1] || defaultActivities[nestType] || `${birdName}が心地よく過ごしています`);
    }
    
    // 時間帯別の活動
    const activities = timeActivities[timeInfo.timeSlot]?.[nestType];
    if (activities) {
        return activities[Math.floor(Math.random() * activities.length)];
    }
    
    return defaultActivities[nestType] || `${birdName}が${nestType}で穏やかに過ごしています`;
}

// 🏠 強化されたネストの雰囲気生成（全ネストタイプ対応版）
function generateEnhancedNestAtmosphere(nestType, giftCount, timeInfo) {
    const baseAtmospheres = {
        '蓮池の巣': {
            base: '静かな池のほとりに佇む美しい巣です。蓮の花が咲き誇り、水面が穏やかに光っています。',
            morning: '朝日が蓮池を金色に染め、花びらに宿る露が宝石のように輝いています。',
            evening: '夕暮れの光が水面に反射し、蓮池全体が幻想的な色彩に包まれています。',
            night: '月光が蓮池を銀色に照らし、夜咲きの蓮が神秘的な美しさを放っています。'
        },
        '苔むした庭': {
            base: '緑豊かな苔に覆われた静寂な庭園の巣です。しっとりとした空気が心地よく流れています。',
            morning: '朝露に濡れた苔が新緑のじゅうたんのように美しく、清々しい香りが漂っています。',
            evening: '夕日が苔むした庭を柔らかく照らし、緑の陰影が美しい模様を描いています。',
            night: '月明かりが苔の緑を銀色に変え、夜の庭園が神秘的な静寂に包まれています。'
        },
        '花畑の巣': {
            base: '色鮮やかな花々に囲まれた華やかな巣です。甘い香りが風に乗って漂っています。',
            morning: '朝の光に花々が輝き、蜂や蝶が花から花へと舞い踊っています。',
            evening: '夕焼け空の下で花畑が黄金色に染まり、一日の終わりを美しく彩っています。',
            night: '夜風に花々が優しく揺れ、月光の下で夜香木が甘い香りを放っています。'
        },
        '古木の大穴': {
            base: '長い年月を重ねた古木の洞に作られた歴史ある巣です。木の温もりが感じられます。',
            morning: '朝日が古木の洞を暖かく照らし、長い歴史の重みと自然の力強さを感じさせます。',
            evening: '夕日が古木の年輪を浮かび上がらせ、悠久の時の流れを物語っています。',
            night: '月光が古木の洞に差し込み、静寂の中で自然の神秘を感じることができます。'
        },
        '樹海の宮殿': {
            base: '深い森の奥に佇む神秘的な宮殿のような巣です。古代の魔法が宿っているかのようです。',
            morning: '朝霧に包まれた宮殿が幻想的で、森の精霊たちの囁きが聞こえてきそうです。',
            evening: '夕暮れの光が宮殿の石造りを温かく照らし、古代の物語が蘇ってくるようです。',
            night: '星明かりの下で宮殿が神秘的に浮かび上がり、魔法の世界への扉が開かれそうです。'
        },
        '真珠の洞窟': {
            base: '美しい真珠で装飾された幻想的な洞窟の巣です。光が真珠に反射して虹色に輝いています。',
            morning: '朝の光が真珠に反射して洞窟全体が虹色に輝き、まるで宝石箱のようです。',
            evening: '夕日の光が真珠を通して洞窟内に美しい光の模様を描いています。',
            night: '月光が真珠の表面で踊り、洞窟が幻想的な光の宮殿と化しています。'
        },
        '木漏れ日の巣': {
            base: '木々の葉の間を縫って差し込む光が美しい巣です。光と影が織りなす自然のアートが楽しめます。',
            morning: '朝の木漏れ日が巣全体を温かく照らし、新緑の香りが心地よく漂っています。',
            evening: '夕方の木漏れ日が黄金色に輝き、森全体が魔法にかかったような美しさです。',
            night: '月光の木漏れ日が銀色の模様を描き、夜の森が幻想的な雰囲気に包まれています。'
        },
        '妖精の隠れ家': {
            base: '小さな妖精たちが住む隠れ家のような巣です。魔法の力で守られた特別な場所です。',
            morning: '朝の光に妖精たちが舞い踊り、隠れ家全体が魔法の輝きに包まれています。',
            evening: '夕暮れ時に妖精たちが集まり、隠れ家で小さなお祭りを開いているようです。',
            night: '夜になると妖精たちの魔法の光が隠れ家を照らし、夢のような美しさです。'
        },
        'きのこの家': {
            base: '巨大なきのこの中に作られた不思議な家のような巣です。森の神秘的な力を感じられます。',
            morning: '朝の光がきのこの傘を通して柔らかく差し込み、幻想的な雰囲気を作っています。',
            evening: '夕方になるときのこが淡く光り始め、森の魔法を感じることができます。',
            night: '夜にはきのこの家全体が神秘的に光り、まるで別世界にいるかのようです。'
        }
    };

    const atmosphere = baseAtmospheres[nestType];
    let description = atmosphere?.base || '素敵な巣です。';
    
    // 時間帯による雰囲気の変化
    if (timeInfo.timeSlot === 'dawn' || timeInfo.timeSlot === 'morning') {
        description = atmosphere?.morning || description;
    } else if (timeInfo.timeSlot === 'evening') {
        description = atmosphere?.evening || description;
    } else if (timeInfo.timeSlot === 'night' || timeInfo.timeSlot === 'sleep') {
        description = atmosphere?.night || description;
    }
    
    // 季節による追加要素
    const seasonalAdditions = {
        '春': '新緑の芽吹きが巣の周りを彩り、生命力に満ちています。',
        '夏': '緑豊かな自然が巣を包み、活気に満ちた雰囲気です。',
        '秋': '紅葉が巣の周りを美しく彩り、落ち着いた趣があります。',
        '冬': '雪化粧した景色が巣を幻想的に演出しています。'
    };
    
    description += ' ' + seasonalAdditions[timeInfo.season];
    
    return { description };
}

// 🎁 贈り物展示システム
function generateGiftDisplaySystem(userGifts, nestType) {
    if (userGifts.length === 0) {
        return { fields: [] };
    }
    
    // 贈り物を配置場所別に分類
    const displayPositions = {
        entrance: { name: '入口', emoji: '🚪', gifts: [] },
        center: { name: '中央', emoji: '⭐', gifts: [] },
        wall: { name: '壁', emoji: '🖼️', gifts: [] },
        floor: { name: '床', emoji: '🏺', gifts: [] },
        hanging: { name: '吊り下げ', emoji: '🎋', gifts: [] },
        secret: { name: '隠し場所', emoji: '🔮', gifts: [] }
    };
    
    // 贈り物を自動配置
    userGifts.forEach((gift, index) => {
        const positions = Object.keys(displayPositions);
        let position;
        
        if (index === 0) position = 'entrance'; // 最初の贈り物は入口
        else if (gift.name.includes('レア') || gift.name.includes('特別')) position = 'secret';
        else if (gift.name.includes('写真') || gift.name.includes('絵')) position = 'wall';
        else if (gift.name.includes('花') || gift.name.includes('葉')) position = 'hanging';
        else if (gift.name.includes('石') || gift.name.includes('貝')) position = 'floor';
        else position = positions[index % positions.length];
        
        displayPositions[position].gifts.push(gift);
    });
    
    const fields = [];
    
    // 各配置場所の贈り物を表示
    Object.entries(displayPositions).forEach(([key, position]) => {
        if (position.gifts.length > 0) {
            const giftList = position.gifts.map(gift => {
                const caption = gift.caption ? `\n  *「${gift.caption}」*` : '';
                return `• **${gift.name}**${caption}`;
            }).join('\n');
            
            fields.push({
                name: `${position.emoji} ${position.name}の展示 (${position.gifts.length}個)`,
                value: giftList,
                inline: position.gifts.length <= 2
            });
        }
    });
    
    return { fields };
}

// 📊 ネスト統計情報
function generateNestStatistics(nestData, userGifts) {
    const buildDate = nestData.日時 ? new Date(nestData.日時) : new Date();
    const daysSinceBuild = Math.floor((new Date() - buildDate) / (1000 * 60 * 60 * 24));
    
    const stats = [
        `🏠 築${daysSinceBuild}日目`,
        `🎁 贈り物: ${userGifts.length}個`,
        `✨ 特別度: ${getSpecialtyLevel(userGifts.length)}`
    ].join('\n');
    
    return {
        showStats: true,
        stats
    };
}

// 🌿 環境効果
function generateEnvironmentalEffect(nestType, timeInfo) {
    const effects = {
        '蓮池の巣': {
            morning: '🌸 蓮の花が朝日に向かって開花しています',
            evening: '🌅 水面に映る夕焼けが美しく揺らめいています',
            night: '🌙 月光が池面に銀の道筋を描いています'
        },
        '苔むした庭': {
            morning: '🌿 朝露に濡れた苔が生き生きと輝いています',
            evening: '🍃 夕風が苔の間を優しく通り抜けています',
            night: '✨ 夜霧が庭園を幻想的に包んでいます'
        },
        '花畑の巣': {
            morning: '🦋 朝の花畑に蝶々が舞い踊っています',
            evening: '🌺 夕日に照らされた花々が輝いています',
            night: '🌸 夜香木が甘い香りを漂わせています'
        }
    };
    
    return effects[nestType]?.[timeInfo.timeSlot] || null;
}

// ✨ 特別なネストイベント
function generateSpecialNestEvent(nestType, timeInfo, giftCount) {
    if (Math.random() > 0.3) return null; // 30%の確率で発生
    
    const specialEvents = {
        '蓮池の巣': [
            '池に小さな虹がかかり、神秘的な光景が広がっています',
            '蓮の花が一斉に開花し、甘い香りが辺り一面に漂っています',
            '池の水が特別に澄んでいて、底まで透けて見えています'
        ],
        '苔むした庭': [
            '苔の間から小さな白い花が顔を出しています',
            '庭園に虹色の露が宿り、宝石のように輝いています',
            '風が苔を撫でて、緑の波紋が美しく広がっています'
        ],
        '花畑の巣': [
            '花畑に珍しい色の蝶が舞い込んできています',
            '新種の花が咲き、甘くて特別な香りを放っています',
            '花々が風に合わせて美しいメロディーを奏でています'
        ]
    };
    
    const events = specialEvents[nestType];
    if (events) {
        return events[Math.floor(Math.random() * events.length)];
    }
    
    return null;
}

// 🎨 ネストのサムネイル画像URL（将来的に画像を用意する場合）
function getNestThumbnail(nestType) {
    // 現在は空文字列を返すが、将来的に画像URLを設定可能
    return '';
}

// ⭐ 特別度レベル計算
function getSpecialtyLevel(giftCount) {
    if (giftCount >= 20) return '伝説級';
    if (giftCount >= 15) return '豪華絢爛';
    if (giftCount >= 10) return '素晴らしい';
    if (giftCount >= 5) return '充実';
    if (giftCount >= 1) return '温かい';
    return '新築';
}

async function handleNestChange(interaction) {
    try {
        const birdName = interaction.options.getString('bird');
        const newNestType = interaction.options.getString('type');
        const userId = interaction.user.id;
        const userName = interaction.user.displayName || interaction.user.username;
        const serverId = interaction.guild.id;
        
        await interaction.deferReply();

        // 現在のネスト情報を取得
        const existingNest = await sheets.getBirdNest(userId, birdName, serverId);
        if (!existingNest) {
            await interaction.editReply({
                content: `❌ ${birdName}のネストが見つかりません。まず \`/nest create\` でネストを建設してください。`
            });
            return;
        }

        // 所持ネストリストを取得
        const ownedNestTypes = await sheets.getUserOwnedNestTypes(userId, serverId);
        
        if (ownedNestTypes.length === 0) {
            await interaction.editReply({
                content: `❌ 所持しているネストタイプがありません。絆レベルを上げてネストを取得してください。`
            });
            return;
        }

        // newNestTypeが指定されていない場合は選択肢を表示
        if (!newNestType) {
            await displayNestChangeOptions(interaction, birdName, ownedNestTypes, existingNest.ネストタイプ);
            return;
        }

        // 所持チェック
        if (!ownedNestTypes.includes(newNestType)) {
            await interaction.editReply({
                content: `❌ 「${newNestType}」は所持していません。\n\n**所持しているネスト:**\n${ownedNestTypes.map(nest => `• ${nest}`).join('\n')}`
            });
            return;
        }

        // 同じネストタイプチェック
        if (existingNest.ネストタイプ === newNestType) {
            await interaction.editReply({
                content: `❌ ${birdName}のネストは既に「${newNestType}」です。`
            });
            return;
        }

        // ネストタイプを変更
        const result = await changeNestType(userId, userName, birdName, existingNest.ネストタイプ, newNestType, serverId);
        
        if (result.success) {
            const successEmbed = {
                title: `🔄 ネスト変更完了！`,
                description: `${birdName}のネストを変更しました`,
                color: 0x00FF00,
                fields: [
                    {
                        name: '🏠 変更前',
                        value: result.oldType,
                        inline: true
                    },
                    {
                        name: '🏠 変更後',
                        value: result.newType,
                        inline: true
                    },
                    {
                        name: '🐦 対象の鳥',
                        value: birdName,
                        inline: true
                    }
                ],
                footer: {
                    text: `変更者: ${userName} | ${new Date().toLocaleString('ja-JP')}`
                },
                timestamp: new Date().toISOString()
            };

            await interaction.editReply({
                embeds: [successEmbed]
            });
        } else {
            await interaction.editReply({
                content: `❌ ネスト変更に失敗しました: ${result.message}`
            });
        }
        
    } catch (error) {
        console.error('ネスト変更エラー:', error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ エラーが発生しました。時間をおいて再度お試しください。'
            });
        } else {
            await interaction.reply({
                content: '❌ エラーが発生しました。時間をおいて再度お試しください。',
                ephemeral: true
            });
        }
    }
}

// ネスト変更選択肢を表示
async function displayNestChangeOptions(interaction, birdName, ownedNestTypes, currentNestType) {
    try {
        // 現在のネストタイプ以外を表示
        const availableNests = ownedNestTypes.filter(nest => nest !== currentNestType);
        
        if (availableNests.length === 0) {
            await interaction.editReply({
                content: `❌ ${birdName}は現在「${currentNestType}」にいます。\n他に変更できるネストがありません。絆レベルを上げて新しいネストを取得してください。`
            });
            return;
        }

        // 最大25個まで（Discordの制限）
        const displayNests = availableNests.slice(0, 25);
        
        const embed = {
            title: `🔄 ${birdName}のネスト変更`,
            description: `現在: **${currentNestType}**\n\n変更先を選択してください：`,
            color: 0x4CAF50,
            fields: displayNests.map((nestType, index) => ({
                name: `${index + 1}. ${nestType}`,
                value: getNestDescription(nestType),
                inline: true
            })),
            footer: {
                text: `所持ネスト数: ${ownedNestTypes.length}個`
            }
        };

        // 選択ボタンを作成（最大5個ずつ表示）
        const components = [];
        const maxButtonsPerRow = 5;
        
        for (let i = 0; i < displayNests.length; i += maxButtonsPerRow) {
            const rowNests = displayNests.slice(i, i + maxButtonsPerRow);
            const buttons = rowNests.map((nestType, rowIndex) => ({
                type: 2,
                style: 1,
                label: `${i + rowIndex + 1}. ${nestType.length > 20 ? nestType.substring(0, 17) + '...' : nestType}`,
                custom_id: `nest_change_${interaction.user.id}_${birdName}_${nestType}`
            }));
            
            components.push({
                type: 1,
                components: buttons
            });
        }

        await interaction.editReply({
            embeds: [embed],
            components: components
        });

    } catch (error) {
        console.error('ネスト変更選択肢表示エラー:', error);
        await interaction.editReply({
            content: '❌ 選択肢の表示中にエラーが発生しました。'
        });
    }
}

// ネストタイプを変更
async function changeNestType(userId, userName, birdName, oldNestType, newNestType, serverId) {
    try {
        console.log(`🔄 ネストタイプ変更: ${birdName} (${oldNestType} → ${newNestType})`);

        // データベース更新
        await sheets.updateNestType(userId, birdName, newNestType, serverId);
        
        // 変更ログを記録
        await sheets.logNestChange(userId, userName, birdName, oldNestType, newNestType, serverId);

        console.log(`✅ ネストタイプ変更完了: ${birdName} -> ${newNestType}`);

        return {
            success: true,
            oldType: oldNestType,
            newType: newNestType,
            message: `${birdName}のネストを${newNestType}に変更しました！`
        };

    } catch (error) {
        console.error('ネストタイプ変更エラー:', error);
        return {
            success: false,
            message: 'データベースの更新に失敗しました'
        };
    }
}

// ネストの説明を取得（前回作成した関数を再利用）
function getNestDescription(nestType) {
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

class NestSystem {
    constructor() {
        // エリア別ネストタイプ（企画書通り）
        this.nestTypes = {
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

        // 記念日限定ネスト（将来実装用）
        this.holidayNests = [
            'バレンタインのハート巣', '七夕の星空巣', 'クリスマスの雪の巣',
            '桜祭りの花見巣', '鯉のぼりの青空巣'
        ];
    }

    // ネスト建設可能かチェック
    async canBuildNest(userId, birdName, serverId) {
        try {
            // 1. 好感度レベル10チェック
            const hasMaxAffinity = await bondLevelManager.hasMaxAffinity(userId, birdName, serverId);
            if (!hasMaxAffinity) {
                return {
                    canBuild: false,
                    reason: 'AFFINITY_REQUIRED',
                    message: 'この鳥との好感度レベル10が必要です'
                };
            }

            // 2. 絆レベル1チェック
            const canBuildNest = await bondLevelManager.canBuildNest(userId, birdName, serverId);
            if (!canBuildNest) {
                return {
                    canBuild: false,
                    reason: 'BOND_LEVEL_REQUIRED',
                    message: 'この鳥との絆レベル1が必要です'
                };
            }

            // 3. 同じ鳥のネスト未所持チェック
            const existingNest = await sheets.getBirdNest(userId, birdName, serverId);
            if (existingNest) {
                return {
                    canBuild: false,
                    reason: 'ALREADY_EXISTS',
                    message: 'この鳥のネストは既に建設済みです'
                };
            }

            // 4. 最大所持数チェック（5個まで）
            const nestCount = await sheets.getUserNestCount(userId, serverId);
            if (nestCount >= 5) {
                return {
                    canBuild: false,
                    reason: 'MAX_NESTS',
                    message: 'ネストは最大5個まで建設できます'
                };
            }

            return {
                canBuild: true,
                message: 'ネスト建設可能です'
            };

        } catch (error) {
            console.error('ネスト建設可能チェックエラー:', error);
            return {
                canBuild: false,
                reason: 'ERROR',
                message: 'チェック中にエラーが発生しました'
            };
        }
    }

    // ガチャ形式でネストタイプを選択
    generateNestOptions(area) {
        const availableNests = this.nestTypes[area] || this.nestTypes.森林;
        
        // ランダムに3つ選択
        const shuffled = [...availableNests].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
    }

    // ネスト建設
    async buildNest(userId, userName, birdName, selectedNestType, serverId, client) {
        try {
            console.log(`🏗️ ネスト建設開始: ${userName} -> ${birdName} (${selectedNestType})`);

            // 建設可能チェック
            const buildCheck = await this.canBuildNest(userId, birdName, serverId);
            if (!buildCheck.canBuild) {
                throw new Error(buildCheck.message);
            }

            // 所持ネストリストを更新
            const userNests = await sheets.getUserNests(userId, serverId);
            const currentNestTypes = userNests.map(nest => nest.ネストタイプ);
            const updatedNests = [...currentNestTypes, selectedNestType];

            // Discord専用チャンネルを作成
            const channelId = await this.createNestChannel(userId, userName, birdName, serverId, client);

            // データベースに記録
            console.log(`📝 データベース記録開始: serverId=${serverId}`);
            await sheets.logNestCreation(
                userId,
                userName,
                birdName,
                '', // カスタム名は後で命名機能で設定
                selectedNestType,
                updatedNests,
                channelId,
                serverId
            );
            console.log(`📝 データベース記録完了`);

            console.log(`✅ ネスト建設完了: ${birdName} -> ${selectedNestType}`);

            return {
                success: true,
                nestType: selectedNestType,
                channelId: channelId,
                message: `${birdName}の${selectedNestType}が完成しました！`
            };

        } catch (error) {
            console.error('ネスト建設エラー:', error);
            throw error;
        }
    }

    // Discord専用チャンネル作成
    async createNestChannel(userId, userName, birdName, serverId, client) {
        try {
            const guild = client.guilds.cache.get(serverId);
            if (!guild) {
                throw new Error('サーバーが見つかりません');
            }

            // カテゴリーを作成または取得
            let category = guild.channels.cache.find(
                channel => channel.name === '🏠 専用ネスト' && channel.type === ChannelType.GuildCategory
            );

            if (!category) {
                console.log('🏗️ 専用ネストカテゴリーを作成中...');
                category = await guild.channels.create({
                    name: '🏠 専用ネスト',
                    type: ChannelType.GuildCategory,
                    position: 1
                });
            }

            // チャンネル名を生成
            const channelName = `${userName}さんの巣`;

            // チャンネルを作成
            console.log(`🏗️ ネストチャンネル作成中: ${channelName}`);
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: client.user.id, // Bot
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });

            // ウェルカムメッセージを送信
            await this.sendWelcomeMessage(channel, userName, birdName);

            console.log(`✅ ネストチャンネル作成完了: ${channel.id}`);
            return channel.id;

        } catch (error) {
            console.error('ネストチャンネル作成エラー:', error);
            throw new Error('専用チャンネルの作成に失敗しました');
        }
    }

    // ウェルカムメッセージ送信
    async sendWelcomeMessage(channel, userName, birdName) {
        try {
            const welcomeMessage = `🏠 **${userName}さんと${birdName}の専用ネストへようこそ！**

このチャンネルでは以下のことができます：

🎁 **贈り物の展示**
- ${birdName}への贈り物が自動的に展示されます
- 贈り物の配置は${birdName}が決めてくれます

🎭 **ネスト固有イベント**
- このネストならではの特別なイベントが発生します
- ${birdName}の日常の様子を楽しめます

🔄 **ネスト変更**
- \`/nest change\` で別のネストタイプに変更できます
- 所持しているネストの中から選択可能です

📋 **ネスト管理**
- \`/nest view\` でネストの詳細情報を確認
- \`/nest visit\` で他のエリアのネストも確認

✨ **特別な時間をお過ごしください！**`;

            await channel.send(welcomeMessage);

        } catch (error) {
            console.error('ウェルカムメッセージ送信エラー:', error);
        }
    }

    // ネストタイプ変更
    async changeNestType(userId, birdName, newNestType, serverId) {
        try {
            console.log(`🔄 ネストタイプ変更: ${birdName} -> ${newNestType}`);

            // ネストの存在チェック
            const existingNest = await sheetsManager.getBirdNest(userId, birdName, serverId);
            if (!existingNest) {
                throw new Error('このネストは存在しません');
            }

            // 所持ネストチェック
            const ownedNests = existingNest.所持ネストリスト || [];
            if (!ownedNests.includes(newNestType)) {
                throw new Error('所持していないネストタイプです');
            }

            // データベース更新
            await sheets.updateNestType(userId, birdName, newNestType, serverId);

            console.log(`✅ ネストタイプ変更完了: ${birdName} -> ${newNestType}`);

            return {
                success: true,
                oldType: existingNest.ネストタイプ,
                newType: newNestType,
                message: `${birdName}のネストを${newNestType}に変更しました！`
            };

        } catch (error) {
            console.error('ネストタイプ変更エラー:', error);
            throw error;
        }
    }

    // ユーザーの全ネスト取得
    async getUserNests(userId, serverId) {
        try {
            return await sheets.getUserNests(userId, serverId);
        } catch (error) {
            console.error('ユーザーネスト取得エラー:', error);
            return [];
        }
    }

    // 鳥のエリアを取得
    getBirdArea(birdName, guildId) {
        try {
            // まずzooManagerから取得を試行
            try {
                const zooManager = require('../utils/zooManager');
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
            
            // zooManagerが使えない場合は鳥名から推定
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
}

module.exports = {
    handleNestChange,
    displayNestChangeOptions,
    changeNestType,
    getNestDescription,
    data,           // ← これが必要
    execute,        // ← これも必要
    NestSystem      // ← クラスもエクスポート
};
