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
                content: `❌ ネスト建設不可: ${buildCheck.message}`,
                ephemeral: true
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
            }],
            ephemeral: true
        });
        
    } catch (error) {
        console.error('ネスト建設エラー:', error);
        await interaction.reply({
            content: 'ネスト建設中にエラーが発生しました。',
            ephemeral: true
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
                content: '🏠 まだネストを建設していません。\n`/nest create` でネストを建設してみましょう！',
                ephemeral: true
            });
            return;
        }
        
        const embed = {
            title: '🏠 あなたのネスト一覧',
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
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        
    } catch (error) {
        console.error('ネスト表示エラー:', error);
        await interaction.reply({
            content: 'ネスト情報の取得中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

async function handleNestVisit(interaction) {
    try {
        const birdName = interaction.options.getString('bird');
        const userId = interaction.user.id;
        const serverId = interaction.guild.id;
        
        const nestData = await sheets.getBirdNest(userId, birdName, serverId);
        
        if (!nestData) {
            await interaction.reply({
                content: `❌ ${birdName}のネストが見つかりません。`,
                ephemeral: true
            });
            return;
        }
        
        const embed = {
            title: `🏠 ${birdName}のネスト`,
            description: `**ネストタイプ**: ${nestData.ネストタイプ}\n**カスタム名**: ${nestData.カスタム名 || '未設定'}`,
            color: 0x2196F3,
            fields: [
                {
                    name: '📊 ネスト情報',
                    value: `建設日: ${nestData.日時 ? new Date(nestData.日時).toLocaleDateString('ja-JP') : '不明'}`,
                    inline: false
                }
            ]
        };
        
        if (nestData.チャンネルID) {
            embed.fields.push({
                name: '🔗 専用チャンネル',
                value: `<#${nestData.チャンネルID}>`,
                inline: false
            });
        }
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        
    } catch (error) {
        console.error('ネスト詳細エラー:', error);
        await interaction.reply({
            content: 'ネスト詳細の取得中にエラーが発生しました。',
            ephemeral: true
        });
    }
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
                content: `✅ ${result.message}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `❌ ${result.message}`,
                ephemeral: true
            });
        }
        
    } catch (error) {
        console.error('ネスト変更エラー:', error);
        await interaction.reply({
            content: `❌ エラー: ${error.message}`,
            ephemeral: true
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
                        id: guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId, // ネスト所有者
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
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
