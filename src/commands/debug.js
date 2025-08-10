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
};
