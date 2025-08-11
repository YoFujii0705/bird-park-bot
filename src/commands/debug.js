// commands/debug.js - Phase 1テストコマンド追加版

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const zooManager = require('../utils/zooManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('鳥類園デバッグコマンド（管理者専用）')
        .addSubcommand(subcommand =>
            subcommand
                .setName('visitor_status')
                .setDescription('見学鳥の状態を確認')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('visitor_check')
                .setDescription('見学鳥の手動チェックを実行')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('force_remove_visitors')
                .setDescription('全見学鳥を強制退園')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('extend_visitor')
                .setDescription('見学鳥の時間延長')
                .addStringOption(option =>
                    option.setName('bird_name')
                        .setDescription('延長する鳥の名前')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('hours')
                        .setDescription('延長時間（時間）')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
    subcommand
        .setName('test_flyover')
        .setDescription('通過イベント（渡り鳥・群れ）をテスト')
)
.addSubcommand(subcommand =>
    subcommand
        .setName('generate_flyover')
        .setDescription('通過イベントを強制生成（テスト用）')
)
        .addSubcommand(subcommand =>
    subcommand
        .setName('test_weather')
        .setDescription('WeatherManager機能をテスト')
)
.addSubcommand(subcommand =>
    subcommand
        .setName('weather_info')
        .setDescription('現在の詳細天気情報を表示')
)
        .addSubcommand(subcommand =>
    subcommand
        .setName('test_all_phases')
        .setDescription('全Phase（1-4）の統合テスト')
)
.addSubcommand(subcommand =>
    subcommand
        .setName('event_stats')
        .setDescription('詳細なイベント統計を表示')
)
        .addSubcommand(subcommand =>
    subcommand
        .setName('test_phase3')
        .setDescription('Phase 3機能（詳細イベント）をテスト')
)
        // 🆕 Phase 1テストコマンドを追加
        .addSubcommand(subcommand =>
            subcommand
                .setName('test_phase1')
                .setDescription('Phase 1機能（時間帯・月齢・夜行性など）をテスト')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('system_status')
                .setDescription('システムの現在状態を表示')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('zoo_detailed_status')
                .setDescription('鳥類園の詳細状態を表示')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('nocturnal_check')
                .setDescription('園内の夜行性の鳥をチェック')
        )
        // debug.js に追加するPhase 2テストコマンド

// 既存のサブコマンドに以下を追加
.addSubcommand(subcommand =>
    subcommand
        .setName('test_phase2')
        .setDescription('Phase 2機能（新しいイベント）をテスト')
)
       // debug.js のサブコマンド定義を以下に修正

.addSubcommand(subcommand =>
    subcommand
        .setName('set_affinity')
        .setDescription('👹 悪魔のコマンド：好感度を強制設定')
        .addStringOption(option =>
            option.setName('bird_name')
                .setDescription('対象の鳥の名前')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('設定する好感度レベル（0-10）')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(10)
        )
        .addNumberOption(option =>
            option.setName('feed_count')
                .setDescription('餌やり回数（省略時は自動計算）')
                .setRequired(false)
                .setMinValue(0)
        )
        .addUserOption(option =>
            option.setName('target_user')
                .setDescription('対象ユーザー（省略時は実行者）')
                .setRequired(false)
        )
)
.addSubcommand(subcommand =>
    subcommand
        .setName('set_bond_level')
        .setDescription('👹 超悪魔のコマンド：絆レベルを強制設定')
        .addStringOption(option =>
            option.setName('bird_name')
                .setDescription('対象の鳥の名前')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('bond_level')
                .setDescription('設定する絆レベル（1以上）')
                .setRequired(true)
                .setMinValue(1)
        )
        .addNumberOption(option =>
            option.setName('bond_feed_count')
                .setDescription('絆餌やり回数（省略時は自動計算）')
                .setRequired(false)
                .setMinValue(0)
        )
        .addUserOption(option =>
            option.setName('target_user')
                .setDescription('対象ユーザー（省略時は実行者）')
                .setRequired(false)
        )
)
.addSubcommand(subcommand =>
    subcommand
        .setName('max_all_affinity')
        .setDescription('👹 破滅のコマンド：全ての鳥との好感度をMAXに')
        .addUserOption(option =>
            option.setName('target_user')
                .setDescription('対象ユーザー（省略時は実行者）')
                .setRequired(false)
        )
)
.addSubcommand(subcommand =>
    subcommand
        .setName('reset_affinity')
        .setDescription('🔄 好感度リセット：指定鳥との好感度を0に')
        .addStringOption(option =>
            option.setName('bird_name')
                .setDescription('対象の鳥の名前')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('target_user')
                .setDescription('対象ユーザー（省略時は実行者）')
                .setRequired(false)
        )
)
.addSubcommand(subcommand =>
    subcommand
        .setName('affinity_status')
        .setDescription('📊 好感度・絆レベル状況確認')
        .addUserOption(option =>
            option.setName('target_user')
                .setDescription('対象ユーザー（省略時は実行者）')
                .setRequired(false)
        )
)
.addSubcommand(subcommand =>
    subcommand
        .setName('generate_event')
        .setDescription('指定したタイプのイベントを手動生成')
        .addStringOption(option =>
            option.setName('event_type')
                .setDescription('生成するイベントのタイプ')
                .setRequired(true)
                .addChoices(
                    { name: '時間帯イベント', value: 'time_based' },
                    { name: '夜行性イベント', value: 'nocturnal' },
                    { name: '天気イベント', value: 'weather' },
                    { name: '季節イベント', value: 'seasonal' },
                    { name: '記念日イベント', value: 'special_day' },
                    { name: '月齢イベント', value: 'moon_phase' }
                )
        )
)
        .addSubcommand(subcommand =>
    subcommand
        .setName('simple_test')
        .setDescription('最小限の動作テスト')
　　　　　)
        .addSubcommand(subcommand =>
            subcommand
                .setName('long_stay_check')
                .setDescription('長期滞在鳥をチェック')
        ),

    async execute(interaction) {
        // 管理者権限チェック
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ このコマンドは管理者専用です。', 
                ephemeral: true 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            switch (subcommand) {
                case 'visitor_status':
                    const status = zooManager.getVisitorStatus(guildId);
                    
                    let statusText = `**見学鳥の状況**\n総数: ${status.totalVisitors}羽\n\n`;
                    
                    if (status.visitors.length === 0) {
                        statusText += '現在見学中の鳥はいません。';
                    } else {
                        status.visitors.forEach(visitor => {
                            const remainingHours = Math.floor(visitor.remainingTime / 60);
                            const remainingMinutes = visitor.remainingTime % 60;
                            statusText += `**${visitor.name}**\n`;
                            statusText += `- 招待者: ${visitor.inviterName}\n`;
                            statusText += `- 残り時間: ${remainingHours}時間${remainingMinutes}分\n`;
                            statusText += `- 活動: ${visitor.activity}\n\n`;
                        });
                    }
                    
                    await interaction.reply({ content: statusText, ephemeral: true });
                    break;

                    case 'test_phase2':
    await interaction.deferReply({ ephemeral: true });
    
    console.log('🧪 Phase 2テスト実行開始...');
    const phase2Results = await zooManager.testPhase2Functions(guildId);
    
    const phase2Embed = new EmbedBuilder()
        .setTitle('🧪 Phase 2 イベント機能テスト結果')
        .setColor(phase2Results.overall.success ? 0x00ff00 : 0xff0000)
        .setDescription(phase2Results.overall.message)
        .addFields(
            { 
                name: '⏰ 時間帯イベント', 
                value: `${phase2Results.tests.timeBasedEvent.success ? '✅' : '❌'} ${phase2Results.tests.timeBasedEvent.message}`, 
                inline: false 
            },
            { 
                name: '🦉 夜行性イベント', 
                value: `${phase2Results.tests.nocturnalEvent.success ? '✅' : '❌'} ${phase2Results.tests.nocturnalEvent.message}`, 
                inline: false 
            },
            { 
                name: '🌤️ 天気イベント', 
                value: `${phase2Results.tests.weatherEvent.success ? '✅' : '❌'} ${phase2Results.tests.weatherEvent.message}`, 
                inline: false 
            },
            { 
                name: '🍂 季節イベント', 
                value: `${phase2Results.tests.seasonEvent.success ? '✅' : '❌'} ${phase2Results.tests.seasonEvent.message}`, 
                inline: false 
            },
            { 
                name: '🎉 記念日イベント', 
                value: `${phase2Results.tests.specialDayEvent.success ? '✅' : '❌'} ${phase2Results.tests.specialDayEvent.message}`, 
                inline: false 
            },
            { 
                name: '🌙 月齢イベント', 
                value: `${phase2Results.tests.moonPhaseEvent.success ? '✅' : '❌'} ${phase2Results.tests.moonPhaseEvent.message}`, 
                inline: false 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Phase 2テスト完了' });
    
    await interaction.editReply({ embeds: [phase2Embed] });
    break;

                    case 'test_phase3':
    await interaction.deferReply({ ephemeral: true });
    
    console.log('🧪 Phase 3テスト実行開始...');
    const phase3Results = await zooManager.testPhase3Functions(guildId);
    
    const phase3Embed = new EmbedBuilder()
        .setTitle('🧪 Phase 3 詳細イベント機能テスト結果')
        .setColor(phase3Results.overall.success ? 0x00ff00 : 0xff0000)
        .setDescription(phase3Results.overall.message)
        .addFields(
            { name: '🌡️ 気温イベント', value: `${phase3Results.tests.temperatureEvent.success ? '✅' : '❌'} ${phase3Results.tests.temperatureEvent.message}`, inline: false },
            { name: '🏡 長期滞在イベント', value: `${phase3Results.tests.longStayEvent.success ? '✅' : '❌'} ${phase3Results.tests.longStayEvent.message}`, inline: false },
            { name: '💨 風速イベント', value: `${phase3Results.tests.windEvent.success ? '✅' : '❌'} ${phase3Results.tests.windEvent.message}`, inline: false },
            { name: '💧 湿度イベント', value: `${phase3Results.tests.humidityEvent.success ? '✅' : '❌'} ${phase3Results.tests.humidityEvent.message}`, inline: false },
            { name: '🐦‍⬛ 群れイベント', value: `${phase3Results.tests.flockEvent.success ? '✅' : '❌'} ${phase3Results.tests.flockEvent.message}`, inline: false },
            { name: '🚶 移動イベント', value: `${phase3Results.tests.movementEvent.success ? '✅' : '❌'} ${phase3Results.tests.movementEvent.message}`, inline: false }
        )
        .setTimestamp();
    
    await interaction.editReply({ embeds: [phase3Embed] });
    break;
                    // debug.js の execute関数のswitch文に以下のケースを追加

case 'set_affinity':
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const birdName = interaction.options.getString('bird_name');
        const targetUser = interaction.options.getUser('target_user') || interaction.user;
        const level = interaction.options.getInteger('level') || 10; // デフォルトはMAX
        let feedCount = interaction.options.getNumber('feed_count');
        
        // 餌やり回数が指定されていない場合は自動計算
        if (feedCount === null) {
            feedCount = this.calculateRequiredFeedsForLevel(level);
        }
        
        // sheetsManagerに直接記録
        const sheetsManager = require('../../config/sheets');
        await sheetsManager.logAffinity(
            targetUser.id, 
            targetUser.username, 
            birdName, 
            level, 
            feedCount, 
            guildId
        );
        
        const embed = new EmbedBuilder()
            .setTitle('👹 悪魔のコマンド実行完了')
            .setColor(0xff0000)
            .addFields(
                { name: '🐦 対象の鳥', value: birdName, inline: true },
                { name: '👤 対象ユーザー', value: targetUser.username, inline: true },
                { name: '💖 設定レベル', value: `${level}/10`, inline: true },
                { name: '🍽️ 餌やり回数', value: `${feedCount}回`, inline: true },
                { name: '⚠️ 注意', value: '不正な方法で好感度を設定しました', inline: false }
            )
            .setFooter({ text: '管理者専用デバッグコマンド' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('好感度設定エラー:', error);
        await interaction.editReply({ 
            content: `❌ 好感度設定に失敗しました: ${error.message}` 
        });
    }
    break;

case 'set_bond_level':
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const birdName = interaction.options.getString('bird_name');
        const targetUser = interaction.options.getUser('target_user') || interaction.user;
        const bondLevel = interaction.options.getInteger('bond_level');
        let bondFeedCount = interaction.options.getNumber('bond_feed_count');
        
        // まず好感度を10に設定（絆レベルの前提条件）
        const sheetsManager = require('../../config/sheets');
        await sheetsManager.logAffinity(
            targetUser.id, 
            targetUser.username, 
            birdName, 
            10, 
            56, // レベル10に必要な回数
            guildId
        );
        
        // 絆餌やり回数が指定されていない場合は自動計算
        if (bondFeedCount === null) {
            bondFeedCount = this.calculateRequiredFeedsForBondLevel(bondLevel);
        }
        
        // 絆レベルを設定
        await sheetsManager.logBondLevel(
            targetUser.id,
            targetUser.username,
            birdName,
            bondLevel,
            bondFeedCount,
            guildId
        );
        
        // 絆レベル特典も付与
        await this.grantBondLevelRewards(targetUser.id, targetUser.username, birdName, bondLevel, guildId);
        
        const embed = new EmbedBuilder()
            .setTitle('👹 超悪魔のコマンド実行完了')
            .setColor(0x8b0000)
            .addFields(
                { name: '🐦 対象の鳥', value: birdName, inline: true },
                { name: '👤 対象ユーザー', value: targetUser.username, inline: true },
                { name: '🔗 設定絆レベル', value: `${bondLevel}`, inline: true },
                { name: '🍽️ 絆餌やり回数', value: `${bondFeedCount}回`, inline: true },
                { name: '💖 好感度', value: '10/10 (自動設定)', inline: true },
                { name: '🎁 特典', value: '絆レベル特典も自動付与', inline: true },
                { name: '⚠️ 警告', value: '極めて不正な方法で絆レベルを設定しました', inline: false }
            )
            .setFooter({ text: '管理者専用超危険デバッグコマンド' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('絆レベル設定エラー:', error);
        await interaction.editReply({ 
            content: `❌ 絆レベル設定に失敗しました: ${error.message}` 
        });
    }
    break;

case 'max_all_affinity':
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const targetUser = interaction.options.getUser('target_user') || interaction.user;
        
        // 現在園内にいる全ての鳥を取得
        const allBirds = zooManager.getAllBirds(guildId);
        
        if (allBirds.length === 0) {
            await interaction.editReply({ content: '❌ 園内に鳥がいないため実行できません。' });
            break;
        }
        
        const sheetsManager = require('../../config/sheets');
        const results = [];
        
        // 全ての鳥に対して好感度MAXを設定
        for (const bird of allBirds) {
            try {
                await sheetsManager.logAffinity(
                    targetUser.id,
                    targetUser.username,
                    bird.name,
                    10,
                    56, // レベル10に必要な回数
                    guildId
                );
                results.push(`✅ ${bird.name} (${bird.area})`);
            } catch (error) {
                results.push(`❌ ${bird.name} (エラー)`);
                console.error(`${bird.name}の好感度設定エラー:`, error);
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('👹 破滅のコマンド実行完了')
            .setColor(0x000000)
            .setDescription(`**${targetUser.username}** と園内全ての鳥の好感度をMAXに設定しました`)
            .addFields(
                { name: '📊 処理結果', value: results.join('\n'), inline: false },
                { name: '⚠️ 大警告', value: '全ての鳥との絆を不正に最大化しました\nこれは現実では不可能です', inline: false }
            )
            .setFooter({ text: '破滅級デバッグコマンド - 管理者のみ使用可能' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('全好感度MAX設定エラー:', error);
        await interaction.editReply({ 
            content: `❌ 全好感度MAX設定に失敗しました: ${error.message}` 
        });
    }
    break;

case 'reset_affinity':
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const birdName = interaction.options.getString('bird_name');
        const targetUser = interaction.options.getUser('target_user') || interaction.user;
        
        const sheetsManager = require('../../config/sheets');
        
        // 好感度を0にリセット
        await sheetsManager.logAffinity(
            targetUser.id,
            targetUser.username,
            birdName,
            0,
            0,
            guildId
        );
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 好感度リセット完了')
            .setColor(0x808080)
            .addFields(
                { name: '🐦 対象の鳥', value: birdName, inline: true },
                { name: '👤 対象ユーザー', value: targetUser.username, inline: true },
                { name: '💔 新しい好感度', value: '0/10', inline: true },
                { name: '📝 説明', value: '好感度と餌やり回数を0にリセットしました', inline: false }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('好感度リセットエラー:', error);
        await interaction.editReply({ 
            content: `❌ 好感度リセットに失敗しました: ${error.message}` 
        });
    }
    break;

case 'affinity_status':
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const targetUser = interaction.options.getUser('target_user') || interaction.user;
        
        const sheetsManager = require('../../config/sheets');
        
        // 好感度情報を取得
        const affinities = await sheetsManager.getUserAffinity(targetUser.id, guildId);
        
        // 絆レベル情報を取得
        const bondLevels = await sheetsManager.getUserBondLevels(targetUser.id, guildId);
        
        if (Object.keys(affinities).length === 0) {
            await interaction.editReply({ 
                content: `📊 **${targetUser.username}の好感度状況**\n\nまだ鳥との好感度記録がありません。` 
            });
            break;
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${targetUser.username}の好感度・絆レベル状況`)
            .setColor(0x3498db)
            .setTimestamp();
        
        let statusText = '';
        let maxAffinityCount = 0;
        let bondLevelCount = 0;
        
        for (const [birdName, affinity] of Object.entries(affinities)) {
            const hearts = '💖'.repeat(affinity.level) + '🤍'.repeat(10 - affinity.level);
            statusText += `**${birdName}**\n`;
            statusText += `${hearts} Lv.${affinity.level} (${affinity.feedCount}回)\n`;
            
            if (affinity.level >= 10) {
                maxAffinityCount++;
                
                // 絆レベル情報があれば表示
                if (bondLevels[birdName]) {
                    const bond = bondLevels[birdName];
                    statusText += `🔗 絆レベル: ${bond.bondLevel} (${bond.bondFeedCount}回)\n`;
                    bondLevelCount++;
                }
            }
            
            statusText += '\n';
        }
        
        embed.setDescription(statusText);
        embed.addFields(
            { name: '📈 統計', value: `好感度MAX: ${maxAffinityCount}羽\n絆レベル保持: ${bondLevelCount}羽`, inline: false }
        );
        
        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error('好感度状況確認エラー:', error);
        await interaction.editReply({ 
            content: `❌ 好感度状況確認に失敗しました: ${error.message}` 
        });
    }
    break;
case 'test_all_phases':
    await interaction.deferReply({ ephemeral: true });
    
    console.log('🧪 全Phase統合テスト実行開始...');
    const allPhasesResults = await zooManager.testAllPhases(guildId);
    
    const summaryEmbed = new EmbedBuilder()
        .setTitle('🧪 全Phase統合テスト結果')
        .setColor(allPhasesResults.overall.success ? 0x00ff00 : 0xff0000)
        .setDescription(allPhasesResults.overall.message)
        .addFields(
            { name: '📋 Phase 1', value: allPhasesResults.overall.summary.phase1Success ? '✅ 成功' : '❌ 失敗', inline: true },
            { name: '🎪 Phase 2', value: allPhasesResults.overall.summary.phase2Success ? '✅ 成功' : '❌ 失敗', inline: true },
            { name: '🔧 Phase 3', value: allPhasesResults.overall.summary.phase3Success ? '✅ 成功' : '❌ 失敗', inline: true },
            { name: '🚀 システム統合', value: allPhasesResults.overall.summary.systemIntegrationSuccess ? '✅ 成功' : '❌ 失敗', inline: true },
            { name: '🎲 ランダムイベント', value: allPhasesResults.overall.summary.randomEventSuccess ? '✅ 成功' : '❌ 失敗', inline: true }
        )
        .setTimestamp();
    
    await interaction.editReply({ embeds: [summaryEmbed] });
    break;
                    case 'test_flyover':
    await interaction.deferReply({ ephemeral: true });
    
    const allBirdsForTest = zooManager.getAllBirds(guildId);
    if (allBirdsForTest.length === 0) {
        await interaction.editReply({ content: '❌ 鳥がいないためテストできません。' });
        break;
    }
    
    // 通過イベントを強制的に生成（確率無視）
    let flyoverEvent = await zooManager.createFlyoverEvent(allBirdsForTest);
    
    // 通常の通過イベントが生成されない場合、特別イベントを試行
    if (!flyoverEvent) {
        flyoverEvent = await zooManager.createSpecialFlyoverEvent(allBirdsForTest);
    }
    
    if (flyoverEvent) {
        await zooManager.addEvent(guildId, flyoverEvent.type, flyoverEvent.content, flyoverEvent.relatedBird);
        
        const flyoverEmbed = new EmbedBuilder()
            .setTitle('🌟 通過イベントテスト結果')
            .setColor(0xffd700)
            .addFields(
                { name: 'イベントタイプ', value: flyoverEvent.type, inline: false },
                { name: '見送り鳥', value: flyoverEvent.relatedBird, inline: true },
                { name: '通過鳥', value: flyoverEvent.passingBird || '特別イベント', inline: true },
                { name: '群れサイズ', value: flyoverEvent.flockSize ? `${flyoverEvent.flockSize}羽` : '1羽', inline: true },
                { name: '内容', value: flyoverEvent.content, inline: false }
            )
            .setTimestamp();
        
        if (flyoverEvent.season) {
            flyoverEmbed.addFields({ name: '季節', value: flyoverEvent.season, inline: true });
        }
        
        await interaction.editReply({ embeds: [flyoverEmbed] });
    } else {
        await interaction.editReply({ content: '⚠️ 通過イベントを生成できませんでした（条件が満たされていない可能性があります）' });
    }
    break;

case 'generate_flyover':
    // 確率を無視して必ず通過イベントを生成
    await interaction.deferReply({ ephemeral: true });
    
    const testBirds = zooManager.getAllBirds(guildId);
    if (testBirds.length === 0) {
        await interaction.editReply({ content: '❌ 鳥がいないためテストできません。' });
        break;
    }
    
    // 元の確率制限を一時的に無効化して生成
    const originalRandom = Math.random;
    Math.random = () => 0.1; // 15%以下になるよう固定
    
    const forcedFlyover = await zooManager.createFlyoverEvent(testBirds);
    
    Math.random = originalRandom; // 元に戻す
    
    if (forcedFlyover) {
        await zooManager.addEvent(guildId, forcedFlyover.type, forcedFlyover.content, forcedFlyover.relatedBird);
        await interaction.editReply({ content: `✨ **レア通過イベント発生！**\n\n${forcedFlyover.content}` });
    } else {
        await interaction.editReply({ content: '❌ 通過イベントの生成に失敗しました' });
    }
    break;
                    case 'test_weather':
    await interaction.deferReply({ ephemeral: true });
    
    const weatherResults = await zooManager.weatherManager.testWeatherManager();
    
    const weatherEmbed = new EmbedBuilder()
        .setTitle('🌤️ WeatherManager テスト結果')
        .setColor(weatherResults.overall.success ? 0x00ff00 : 0xff0000)
        .setDescription(weatherResults.overall.message)
        .addFields(
            { name: '⚙️ 設定確認', value: `${weatherResults.tests.configuration.success ? '✅' : '❌'} ${weatherResults.tests.configuration.message}`, inline: false },
            { name: '🌤️ 天気取得', value: `${weatherResults.tests.weatherFetch.success ? '✅' : '❌'} ${weatherResults.tests.weatherFetch.message}`, inline: false },
            { name: '📊 詳細情報', value: `${weatherResults.tests.detailedWeather.success ? '✅' : '❌'} ${weatherResults.tests.detailedWeather.message}`, inline: false },
            { name: '🏷️ 分類機能', value: `${weatherResults.tests.categorization.success ? '✅' : '❌'} ${weatherResults.tests.categorization.message}`, inline: false }
        )
        .setTimestamp();
    
    await interaction.editReply({ embeds: [weatherEmbed] });
    break;

case 'weather_info':
    await interaction.deferReply({ ephemeral: true });
    
    const detailedWeather = await zooManager.weatherManager.getDetailedWeather();
    
    const infoEmbed = new EmbedBuilder()
        .setTitle('🌤️ 現在の詳細天気情報')
        .setColor(0x87ceeb)
        .addFields(
            { name: '🌡️ 気温', value: `${detailedWeather.temperature}°C (${detailedWeather.temperatureInfo.category})`, inline: true },
            { name: '☁️ 天気', value: `${detailedWeather.emoji} ${detailedWeather.description}`, inline: true },
            { name: '💧 湿度', value: `${detailedWeather.humidity}% (${detailedWeather.humidityInfo.category})`, inline: true },
            { name: '💨 風速', value: `${detailedWeather.windSpeed}m/s (${detailedWeather.windInfo.category})`, inline: true },
            { name: '📍 場所', value: `${detailedWeather.cityName}, ${detailedWeather.country}`, inline: true },
            { name: '📊 データソース', value: detailedWeather.source === 'api' ? 'OpenWeatherMap API' : 'フォールバック', inline: true },
            { name: '🐦 鳥への影響', value: `気分: ${detailedWeather.birdBehavior.mood}\n${detailedWeather.birdBehavior.selectedDescription}`, inline: false }
        )
        .setTimestamp(detailedWeather.timestamp);
    
    await interaction.editReply({ embeds: [infoEmbed] });
    break;

case 'event_stats':
    const eventStats = zooManager.getEventStatistics(guildId);
    
    const statsEmbed = new EmbedBuilder()
        .setTitle('📊 詳細イベント統計')
        .setColor(0x3498db)
        .addFields(
            { name: '📈 総イベント数', value: `${eventStats.total}件`, inline: true },
            { name: '⏰ 過去24時間', value: `${eventStats.recent24h}件`, inline: true },
            { name: '📅 過去7日間', value: `${eventStats.recent7days}件`, inline: true },
            { name: '🐦 鳥の総数', value: `${eventStats.birdStatus.total}羽`, inline: true },
            { name: '🏡 長期滞在鳥', value: `${eventStats.birdStatus.longStay}羽`, inline: true },
            { name: '👥 見学鳥', value: `${eventStats.birdStatus.visitors}羽`, inline: true },
            { name: '⏰ 現在の時間帯', value: `${eventStats.systemStatus.timeSlot.emoji} ${eventStats.systemStatus.timeSlot.name}`, inline: true },
            { name: '🌙 月齢', value: `${eventStats.systemStatus.moonPhase.emoji} ${eventStats.systemStatus.moonPhase.name}`, inline: true },
            { name: '🍂 季節', value: `${eventStats.systemStatus.season.emoji} ${eventStats.systemStatus.season.detail}`, inline: true }
        )
        .setTimestamp();
    
    // よく発生するイベントタイプTop 5を表示
    const topEventTypes = Object.entries(eventStats.byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => `${type}: ${count}件`)
        .join('\n');
    
    if (topEventTypes) {
        statsEmbed.addFields({ name: '🏆 よく発生するイベント Top5', value: topEventTypes, inline: false });
    }
    
    await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
    break;
case 'generate_event':
    await interaction.deferReply({ ephemeral: true });
    
    const eventType = interaction.options.getString('event_type');
    const birdsForEvent = zooManager.getAllBirds(guildId);
    
    if (birdsForEvent.length === 0) {
        await interaction.editReply({ content: '❌ 鳥がいないためイベントを生成できません。' });
        break;
    }
    
    try {
        let event = null;
        
        switch (eventType) {
            case 'time_based':
                event = await zooManager.createTimeBasedEvent(birdsForEvent);
                break;
            case 'nocturnal':
                event = await zooManager.createNocturnalSpecificEvent(birdsForEvent);
                break;
            case 'weather':
                event = await zooManager.createWeatherBasedEvent(birdsForEvent);
                break;
            case 'seasonal':
                event = await zooManager.createSeasonalEvent(birdsForEvent);
                break;
            case 'special_day':
                event = await zooManager.createSpecialDayEvent(birdsForEvent);
                break;
            case 'moon_phase':
                event = await zooManager.createMoonPhaseEvent(birdsForEvent);
                break;
        }
        
        if (event) {
            // 実際にイベントを追加
            await zooManager.addEvent(guildId, event.type, event.content, event.relatedBird);
            
            const eventEmbed = new EmbedBuilder()
                .setTitle('🎪 イベント生成成功')
                .setColor(0x00ff00)
                .addFields(
                    { name: 'イベントタイプ', value: event.type, inline: false },
                    { name: '関連する鳥', value: event.relatedBird, inline: true },
                    { name: '内容', value: event.content, inline: false }
                )
                .setTimestamp();
            
            // 追加情報があれば表示
            if (event.timeSlot) {
                eventEmbed.addFields({ name: '時間帯', value: `${event.timeSlot.emoji} ${event.timeSlot.name}`, inline: true });
            }
            if (event.moonPhase) {
                eventEmbed.addFields({ name: '月齢', value: `${event.moonPhase.emoji} ${event.moonPhase.name}`, inline: true });
            }
            if (event.season) {
                eventEmbed.addFields({ name: '季節', value: `${event.season.emoji} ${event.season.detail}`, inline: true });
            }
            if (event.weather) {
                eventEmbed.addFields({ name: '天気', value: `${event.weather.description} (${event.weather.temperature}°C)`, inline: true });
            }
            
            await interaction.editReply({ embeds: [eventEmbed] });
        } else {
            await interaction.editReply({ 
                content: `⚠️ ${eventType}イベントを生成できませんでした。\n（条件が満たされていない可能性があります）` 
            });
        }
        
    } catch (error) {
        console.error('イベント生成エラー:', error);
        await interaction.editReply({ 
            content: `❌ イベント生成中にエラーが発生しました: ${error.message}` 
        });
    }
    break;

                case 'visitor_check':
                    await interaction.deferReply({ ephemeral: true });
                    
                    const result = await zooManager.manualVisitorCheck(guildId);
                    
                    let resultText = `**手動見学鳥チェック結果**\n`;
                    resultText += `変更あり: ${result.checkResult ? 'はい' : 'いいえ'}\n\n`;
                    resultText += `現在の見学鳥: ${result.currentStatus.totalVisitors}羽\n`;
                    
                    if (result.currentStatus.visitors.length > 0) {
                        resultText += '\n**残っている見学鳥:**\n';
                        result.currentStatus.visitors.forEach(visitor => {
                            const remainingHours = Math.floor(visitor.remainingTime / 60);
                            const remainingMinutes = visitor.remainingTime % 60;
                            resultText += `- ${visitor.name} (残り${remainingHours}h${remainingMinutes}m)\n`;
                        });
                    }
                    
                    await interaction.editReply({ content: resultText });
                    break;

                case 'force_remove_visitors':
                    await interaction.deferReply({ ephemeral: true });
                    
                    const removedCount = await zooManager.forceRemoveAllVisitors(guildId);
                    
                    await interaction.editReply({ 
                        content: `🧪 **強制退園実行**\n${removedCount}羽の見学鳥を退園させました。` 
                    });
                    break;

                case 'extend_visitor':
                    const birdName = interaction.options.getString('bird_name');
                    const hours = interaction.options.getInteger('hours') || 1;
                    
                    const success = zooManager.extendVisitorTime(guildId, birdName, hours);
                    
                    if (success) {
                        await interaction.reply({ 
                            content: `✅ ${birdName}の見学時間を${hours}時間延長しました。`,
                            ephemeral: true 
                        });
                    } else {
                        await interaction.reply({ 
                            content: `❌ ${birdName}という名前の見学鳥が見つかりません。`,
                            ephemeral: true 
                        });
                    }
                    break;

                // 🆕 Phase 1テストコマンド
                case 'test_phase1':
                    await interaction.deferReply({ ephemeral: true });
                    
                    console.log('🧪 Phase 1テスト実行開始...');
                    const testResults = await zooManager.testPhase1Functions(guildId);
                    
                    const testEmbed = new EmbedBuilder()
                        .setTitle('🧪 Phase 1 機能テスト結果')
                        .setColor(testResults.overall.success ? 0x00ff00 : 0xff0000)
                        .setDescription(testResults.overall.message)
                        .addFields(
                            { 
                                name: '⏰ 時間帯テスト', 
                                value: `${testResults.tests.timeSlot.success ? '✅' : '❌'} ${testResults.tests.timeSlot.message}`, 
                                inline: false 
                            },
                            { 
                                name: '🌙 月齢テスト', 
                                value: `${testResults.tests.moonPhase.success ? '✅' : '❌'} ${testResults.tests.moonPhase.message}`, 
                                inline: false 
                            },
                            { 
                                name: '🍂 季節テスト', 
                                value: `${testResults.tests.season.success ? '✅' : '❌'} ${testResults.tests.season.message}`, 
                                inline: false 
                            },
                            { 
                                name: '🎉 記念日テスト', 
                                value: `${testResults.tests.specialDay.success ? '✅' : '❌'} ${testResults.tests.specialDay.message}`, 
                                inline: false 
                            },
                            { 
                                name: '🦉 夜行性チェックテスト', 
                                value: `${testResults.tests.nocturnalCheck.success ? '✅' : '❌'} ${testResults.tests.nocturnalCheck.message}`, 
                                inline: false 
                            },
                            { 
                                name: '🏡 長期滞在テスト', 
                                value: `${testResults.tests.longStayCheck.success ? '✅' : '❌'} ${testResults.tests.longStayCheck.message}`, 
                                inline: false 
                            }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Phase 1テスト完了' });
                    
                    await interaction.editReply({ embeds: [testEmbed] });
                    break;
                    case 'simple_test':
    try {
        console.log('🧪 簡単テスト開始...');
        
        // 1. 基本的な時間取得テスト
        const now = new Date();
        const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        
        let testResult = `**🧪 簡単テスト結果**\n\n`;
        testResult += `✅ 現在時刻: ${jstTime.toLocaleString('ja-JP')}\n`;
        testResult += `✅ サーバーID: ${guildId}\n`;
        
        // 2. zooManagerの基本動作テスト
        const allBirds = zooManager.getAllBirds(guildId);
        testResult += `✅ 鳥の数: ${allBirds.length}羽\n`;
        
        // 3. timeSlots定義の確認
        if (zooManager.timeSlots) {
            testResult += `✅ 時間帯定義: 利用可能\n`;
            testResult += `✅ 定義済み時間帯数: ${Object.keys(zooManager.timeSlots).length}\n`;
        } else {
            testResult += `❌ 時間帯定義: 利用不可\n`;
        }
        // 4. getCurrentTimeSlotメソッドの確認
        if (typeof zooManager.getCurrentTimeSlot === 'function') {
            testResult += `✅ getCurrentTimeSlot: メソッド利用可能\n`;
            
            try {
                const timeSlot = zooManager.getCurrentTimeSlot();
                testResult += `✅ 時間帯取得成功: ${timeSlot.name}\n`;
            } catch (error) {
                testResult += `❌ 時間帯取得エラー: ${error.message}\n`;
            }
        } else {
            testResult += `❌ getCurrentTimeSlot: メソッド利用不可\n`;
        }
        
        await interaction.reply({ content: testResult, ephemeral: true });
        
    } catch (error) {
        console.error('簡単テストエラー:', error);
        await interaction.reply({ 
            content: `❌ 簡単テストでエラーが発生しました: ${error.message}\n\nスタック:\n\`\`\`${error.stack}\`\`\``, 
            ephemeral: true 
        });
    }
    break;

                case 'system_status':
                    const systemStatus = zooManager.getSystemStatus();
                    
                    const systemEmbed = new EmbedBuilder()
                        .setTitle('🔧 システム現在状態')
                        .setColor(0x3498db)
                        .addFields(
                            { name: '🕐 現在時刻 (JST)', value: systemStatus.timestamp, inline: false },
                            { name: '⏰ 時間帯', value: `${systemStatus.timeSlot.emoji} ${systemStatus.timeSlot.name}`, inline: true },
                            { name: '🌙 月齢', value: `${systemStatus.moonPhase.emoji} ${systemStatus.moonPhase.name}`, inline: true },
                            { name: '🍂 季節', value: `${systemStatus.season.emoji} ${systemStatus.season.detail}`, inline: true },
                            { name: '🌃 夜間モード', value: systemStatus.isNightTime ? 'はい' : 'いいえ', inline: true }
                        )
                        .setTimestamp();
                    
                    if (systemStatus.specialDay) {
                        systemEmbed.addFields({
                            name: '🎉 今日は特別な日',
                            value: `${systemStatus.specialDay.emoji} ${systemStatus.specialDay.name}`,
                            inline: false
                        });
                    }
                    
                    await interaction.reply({ embeds: [systemEmbed], ephemeral: true });
                    break;

                case 'zoo_detailed_status':
                    const detailedStatus = zooManager.getZooDetailedStatus(guildId);
                    
                    const zooEmbed = new EmbedBuilder()
                        .setTitle('🏞️ 鳥類園詳細状態')
                        .setColor(0x2ecc71)
                        .addFields(
                            { name: '🐦 総鳥数', value: `${detailedStatus.totalBirds}羽`, inline: true },
                            { name: '🏡 長期滞在鳥', value: `${detailedStatus.longStayBirds}羽`, inline: true },
                            { name: '👥 見学鳥', value: `${detailedStatus.visitors}羽`, inline: true },
                            { name: '🌲 森林エリア', value: `${detailedStatus.birdDistribution.森林}羽`, inline: true },
                            { name: '🌾 草原エリア', value: `${detailedStatus.birdDistribution.草原}羽`, inline: true },
                            { name: '🌊 水辺エリア', value: `${detailedStatus.birdDistribution.水辺}羽`, inline: true },
                            { name: '⏰ 時間帯', value: `${detailedStatus.timeSlot.emoji} ${detailedStatus.timeSlot.name}`, inline: true },
                            { name: '🌙 月齢', value: `${detailedStatus.moonPhase.emoji} ${detailedStatus.moonPhase.name}`, inline: true },
                            { name: '🍂 季節', value: `${detailedStatus.season.emoji} ${detailedStatus.season.detail}`, inline: true }
                        )
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [zooEmbed], ephemeral: true });
                    break;

                case 'nocturnal_check':
                    await interaction.deferReply({ ephemeral: true });
                    
                    const allBirds = zooManager.getAllBirds(guildId);
                    
                    if (allBirds.length === 0) {
                        await interaction.editReply({ content: '❌ 鳥がいないため夜行性チェックできません。' });
                        break;
                    }
                    
                    const nocturnalResults = [];
                    for (const bird of allBirds) {
                        const isNocturnal = await zooManager.isNocturnalBird(bird.name);
                        nocturnalResults.push({
                            name: bird.name,
                            area: bird.area,
                            isNocturnal: isNocturnal
                        });
                    }
                    
                    const nocturnalBirds = nocturnalResults.filter(b => b.isNocturnal);
                    const diurnalBirds = nocturnalResults.filter(b => !b.isNocturnal);
                    
                    let nocturnalText = `**🦉 夜行性チェック結果**\n\n`;
                    nocturnalText += `**夜行性の鳥: ${nocturnalBirds.length}羽**\n`;
                    nocturnalBirds.forEach(bird => {
                        nocturnalText += `🦉 ${bird.name} (${bird.area})\n`;
                    });
                    
                    nocturnalText += `\n**昼行性の鳥: ${diurnalBirds.length}羽**\n`;
                    diurnalBirds.forEach(bird => {
                        nocturnalText += `🌅 ${bird.name} (${bird.area})\n`;
                    });
                    
                    await interaction.editReply({ content: nocturnalText });
                    break;

                case 'long_stay_check':
                    const longStayBirds = zooManager.getLongStayBirds(guildId);
                    
                    if (longStayBirds.length === 0) {
                        await interaction.reply({ 
                            content: '🏡 **長期滞在鳥チェック結果**\n\n現在、7日以上滞在している鳥はいません。', 
                            ephemeral: true 
                        });
                        break;
                    }
                    
                    let longStayText = `🏡 **長期滞在鳥チェック結果**\n\n`;
                    longStayText += `**長期滞在鳥: ${longStayBirds.length}羽**\n\n`;
                    
                    longStayBirds.forEach(bird => {
                        const stayDays = zooManager.getBirdStayDays(bird);
                        longStayText += `📍 **${bird.name}** (${bird.area}エリア)\n`;
                        longStayText += `   滞在日数: ${stayDays}日\n`;
                        longStayText += `   入園日時: ${bird.entryTime.toLocaleString('ja-JP')}\n\n`;
                    });
                    
                    await interaction.reply({ content: longStayText, ephemeral: true });
                    break;

                default:
                    await interaction.reply({ 
                        content: '❌ 不明なサブコマンドです。', 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error('デバッグコマンドエラー:', error);
            const errorMessage = `❌ エラーが発生しました: ${error.message}`;
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // debug.js の module.exports の最後（execute関数の後）に以下のヘルパー関数を追加

    // 🧮 好感度レベルに必要な餌やり回数を計算
    calculateRequiredFeedsForLevel(targetLevel) {
        const levelRequirements = {
            0: 0,
            1: 2,      // レベル0→1: 2回
            2: 4,      // レベル1→2: 2回追加 (累計4回)
            3: 7,      // レベル2→3: 3回追加 (累計7回)
            4: 11,     // レベル3→4: 4回追加 (累計11回)
            5: 16,     // レベル4→5: 5回追加 (累計16回)
            6: 22,     // レベル5→6: 6回追加 (累計22回)
            7: 29,     // レベル6→7: 7回追加 (累計29回)
            8: 37,     // レベル7→8: 8回追加 (累計37回)
            9: 46,     // レベル8→9: 9回追加 (累計46回)
            10: 56     // レベル9→10: 10回追加 (累計56回)
        };
        
        return levelRequirements[targetLevel] || 0;
    },

    // 🔗 絆レベルに必要な餌やり回数を計算
    calculateRequiredFeedsForBondLevel(targetBondLevel) {
        if (targetBondLevel <= 0) return 0;
        
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

    // 🎁 絆レベル特典を付与
    async grantBondLevelRewards(userId, userName, birdName, bondLevel, guildId) {
        try {
            const sheetsManager = require('../../config/sheets');
            
            // きりのいいレベルで「写真」確定入手
            const rewardLevels = [5, 10, 15, 20, 25, 30];
            
            for (const rewardLevel of rewardLevels) {
                if (bondLevel >= rewardLevel) {
                    const photoName = this.getBondLevelPhotoName(rewardLevel);
                    
                    // gifts_inventoryに写真を追加
                    await sheetsManager.logGiftInventory(
                        userId, userName, photoName, 1,
                        `${birdName}との絆レベル${rewardLevel}達成特典（デバッグ付与）`,
                        guildId
                    );
                }
            }
            
            console.log(`🎁 ${userName}に絆レベル${bondLevel}までの特典を付与しました`);
            
        } catch (error) {
            console.error('絆レベル特典付与エラー:', error);
        }
    },

    // 📸 絆レベル別写真名取得
    getBondLevelPhotoName(bondLevel) {
        const photoNames = {
            5: '深い絆の写真',
            10: '魂の繋がりの写真',
            15: '永遠の瞬間の写真',
            20: '奇跡の写真',
            25: '運命の写真',
            30: '無限の絆の写真'
        };
        
        return photoNames[bondLevel] || `絆レベル${bondLevel}の記念写真`;
    }
};
