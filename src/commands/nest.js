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
        const errorMessage = 'ネスト詳細の取得中にエラーが発生しました。';
        
        if (!interaction.replied) {
            await interaction.reply({ content: errorMessage });
        } else {
            await interaction.editReply({ content: errorMessage });
        }
    }
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

// 🦅 強化された鳥の活動生成
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
            ]
        },
        morning: {
            '蓮池の巣': [
                `${birdName}が蓮の葉の上で朝の日光浴を楽しんでいます`,
                `${birdName}が池の小魚と遊んでいるようです`,
                `${birdName}が蓮池の美しさに見とれています`
            ],
            '苔むした庭': [
                `${birdName}が苔の感触を足で確かめながら歩き回っています`,
                `${birdName}が庭園の小さな生き物たちと交流しています`,
                `${birdName}が苔むした庭で朝の体操をしています`
            ],
            '花畑の巣': [
                `${birdName}が色とりどりの花の中を楽しそうに飛び回っています`,
                `${birdName}が花の蜜を味わって満足そうです`,
                `${birdName}が蝶々と一緒に花畑で遊んでいます`
            ]
        },
        sleep: {
            '蓮池の巣': [
                `${birdName}が月光に照らされた蓮池で、静かに眠っています`,
                `${birdName}が蓮の花の香りに包まれて、安らかに休んでいます`,
                `${birdName}が夜の池の音を子守歌に、深い眠りについています`
            ],
            '苔むした庭': [
                `${birdName}が柔らかい苔のクッションで、心地よく眠っています`,
                `${birdName}が庭園の夜の静寂に包まれて、安らかに休んでいます`,
                `${birdName}が苔むした石の隙間で、暖かく眠っています`
            ],
            '花畑の巣': [
                `${birdName}が花々に囲まれて、甘い香りの中で眠っています`,
                `${birdName}が花びらのベッドで、夢の中で花畑を飛んでいるようです`,
                `${birdName}が夜風に揺れる花々の音を聞きながら、静かに眠っています`
            ]
        }
    };
    
    // デフォルト活動
    const defaultActivities = {
        '蓮池の巣': `${birdName}が蓮池の美しさを堪能しています`,
        '苔むした庭': `${birdName}が苔むした庭で穏やかに過ごしています`,
        '古木の大穴': `${birdName}が古木の歴史を感じながら休んでいます`,
        '花畑の巣': `${birdName}が花畑の中で幸せそうにしています`,
        '樹海の宮殿': `${birdName}が宮殿の神秘的な雰囲気を楽しんでいます`,
        '真珠の洞窟': `${birdName}が真珠の輝きに見とれています`
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

// 🏠 強化されたネストの雰囲気生成
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
        const serverId = interaction.guild.id;
        
        const nestSystem = new NestSystem();
        const result = await nestSystem.changeNestType(userId, birdName, newNestType, serverId);
        
        if (result.success) {
            await interaction.reply({
                content: `✅ ${result.message}`
            });
        } else {
            await interaction.reply({
                content: `❌ ${result.message}`
            });
        }
        
    } catch (error) {
        console.error('ネスト変更エラー:', error);
        await interaction.reply({
            content: `❌ エラー: ${error.message}`
        });
    }
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
    data,           // ← これが必要
    execute,        // ← これも必要
    NestSystem      // ← クラスもエクスポート
};
