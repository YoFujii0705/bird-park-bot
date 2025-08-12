require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ユーティリティとマネージャーのインポート
const sheetsManager = require('../config/sheets');
const birdData = require('./utils/birdData');
const logger = require('./utils/logger');
const zooManager = require('./utils/zooManager');
const scheduler = require('./utils/scheduler');

// Botクライアント作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// コマンドコレクション
client.commands = new Collection();

// 初期化状態の管理
let isInitialized = false;

// コマンドファイル読み込み
async function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
        console.log('⚠️ commandsディレクトリが見つかりません');
        return;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`✅ コマンド読み込み: ${command.data.name}`);
            } else {
                console.log(`⚠️ ${filePath} にdataまたはexecuteプロパティがありません`);
            }
        } catch (error) {
            console.error(`❌ コマンド読み込みエラー (${file}):`, error);
        }
    }
}

// システム初期化
async function initializeSystem() {
    if (isInitialized) return;
    
    console.log('🔄 システムを初期化中...');
    
    try {
        // 1. Google Sheets接続
        console.log('📊 Google Sheetsに接続中...');
        await sheetsManager.initialize();
        
        // 2. 鳥データ読み込み
        console.log('🐦 鳥データを読み込み中...');
        await birdData.initialize();
        
        // 3. 鳥類園管理システム初期化
        console.log('🏞️ 鳥類園管理システムを初期化中...');
        await zooManager.initialize();
        
        // 4. スケジューラー初期化
        console.log('⏰ スケジューラーを初期化中...');
        scheduler.initialize(client);
        
        isInitialized = true;
        console.log('✅ システム初期化完了！');
        
        // 初期化完了ログ
        await logger.logEvent('システム', 'Discord Botが正常に起動しました', '');
        
    } catch (error) {
        console.error('❌ システム初期化エラー:', error);
        await logger.logError('システム初期化', error);
        
        // 初期化に失敗してもBotは起動させる
        console.log('⚠️ 一部機能で問題がありますが、Botを起動します');
    }
}

// Bot起動時
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} がオンラインになりました！`);
    console.log(`🌐 ${client.guilds.cache.size}個のサーバーに接続中`);
    
    // ステータス設定
    client.user.setActivity('鳥たちを観察中 🐦', { type: 'WATCHING' });
    
    // コマンド読み込み
    await loadCommands();
    console.log(`📝 ${client.commands.size}個のコマンドを読み込みました`);
    
    // システム初期化（非同期）
    initializeSystem().catch(error => {
        console.error('システム初期化で予期しないエラー:', error);
    });
});

// スラッシュコマンド処理
client.on('interactionCreate', async interaction => {
    // スラッシュコマンドでない場合は無視
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) return;

    try {
        // セレクトメニューやボタンの処理
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            await handleComponentInteraction(interaction);
            return;
        }

        // スラッシュコマンドの処理
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`❌ コマンド "${interaction.commandName}" が見つかりません`);
            await interaction.reply({ 
                content: '❌ このコマンドは現在利用できません。', 
                ephemeral: true 
            });
            return;
        }

        // システムが初期化されていない場合の警告
        if (!isInitialized && ['gacha', 'search', 'zoo', 'feed', 'theme', 'today'].includes(interaction.commandName)) {
            await interaction.reply({
                content: '⚠️ システムの初期化中です。しばらく待ってから再度お試しください。',
                ephemeral: true
            });
            return;
        }

        await command.execute(interaction);

    } catch (error) {
        console.error('❌ インタラクション処理エラー:', error);
        await logger.logError('インタラクション処理', error, {
            userId: interaction.user?.id,
            commandName: interaction.commandName,
            guildId: interaction.guild?.id
        });

        const errorMessage = 'コマンドの実行中にエラーが発生しました。しばらく待ってから再度お試しください。';
        
        try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    } catch (replyError) {
        // インタラクションが既にタイムアウトしている場合はログのみ
        console.log('インタラクションタイムアウト（正常）:', replyError.code);
    }
}
});

// コンポーネント（ボタン・セレクトメニュー）インタラクション処理
async function handleComponentInteraction(interaction) {
    const { customId } = interaction;
    
    console.log(`🔧 インタラクション受信:`, {
        customId: customId,
        type: interaction.type,
        isStringSelectMenu: interaction.isStringSelectMenu(),
        isButton: interaction.isButton(),
        values: interaction.values || 'なし'
    });
    
    try {
        // 鳥類園関連のボタン
        if (customId.startsWith('zoo_')) {
            console.log(`🔧 zoo_ボタン処理`);
            await handleZooButtons(interaction);
        }
        // 🏠 ネスト関連のボタン
        else if (customId.startsWith('nest_select_')) {
            console.log(`🔧 nest_select_ボタン処理`);
            await handleNestSelection(interaction);
        }
        // 🆕 ネストガチャボタン処理
        else if (customId.startsWith('nest_gacha_')) {
            console.log(`🔧 nest_gacha_ボタン処理`);
            await handleNestGachaSelection(interaction);
        }
        // 🔧 修正：完全一致を先にチェック
        else if (customId === 'nest_change_select') {
            console.log(`🔧 nest_change_select セレクトメニュー処理開始`);
            await handleNestChangeSelectMenu(interaction);
        }
        // 🆕 ネスト変更ボタン（startsWith は後に）
        else if (customId.startsWith('nest_change_')) {
            console.log(`🔧 nest_change_ボタン処理（旧形式）`);
            await handleNestChangeSelection(interaction);
        }
        // 🆕 餌やり鳥選択セレクトメニュー
        else if (customId === 'bird_feed_select') {
            console.log(`🔧 bird_feed_select処理`);
            await handleBirdFeedSelection(interaction);
        }
        // 🎁 贈り物関連のセレクトメニュー
        else if (customId === 'gift_bird_select') {
            console.log('🔧 gift_bird_select処理（既に処理済み）');
        }
        else if (customId === 'gift_item_select') {
            console.log('🔧 gift_item_select処理（既に処理済み）');
        }
        // 見学招待関連
        else if (customId.startsWith('visit_') || customId === 'select_visitor_bird') {
            console.log(`🔧 見学関連処理: ${customId}`);
        }
        // 贈り物関連（既存）
        else if (customId === 'select_gift') {
            console.log('🔧 select_gift処理（既に処理済み）');
        }
        // 鳥詳細選択メニュー
        else if (customId === 'bird_detail_select') {
            console.log(`🔧 bird_detail_select処理`);
            await handleBirdDetailSelect(interaction);
        }
        // 🆕 餌選択セレクトメニュー  
        else if (customId === 'food_select') {
            console.log(`🔧 food_select処理`);
            await handleFoodSelection(interaction);
        }
        // その他
        else {
            console.log(`🔧 未処理のコンポーネント: ${customId}`);
        }
    } catch (error) {
        console.error('❌ インタラクション処理エラー:', error);
        
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ 
                    content: '操作の処理中にエラーが発生しました。', 
                    ephemeral: true 
                });
            } catch (replyError) {
                console.error('エラー応答に失敗:', replyError);
            }
        }
    }
}

// 🆕 餌やり鳥選択処理関数（修正版）
async function handleBirdFeedSelection(interaction) {
    try {
        if (!interaction.values || interaction.values.length === 0) {
            await interaction.update({
                content: '❌ 鳥が選択されていません。',
                components: []
            });
            return;
        }

        const selectedValue = interaction.values[0]; // 例: "bird_feed_0"
        const birdIndex = parseInt(selectedValue.split('_')[2]);
        
        // セッションキャッシュから候補を取得
        const sessionKey = `${interaction.user.id}_${interaction.guild.id}`;
        const session = global.birdSelectionCache?.get(sessionKey);
        
        if (!session || !session.candidates || birdIndex >= session.candidates.length) {
            await interaction.update({
                content: '❌ 選択セッションが期限切れです。再度コマンドを実行してください。',
                components: []
            });
            return;
        }

        // 選択された鳥の情報を取得
        const selectedBird = session.candidates[birdIndex];
        
        // セッションをクリア
        global.birdSelectionCache.delete(sessionKey);
        
        // 餌やりダイアログを表示
        await showFeedingDialog(interaction, selectedBird);
        
    } catch (error) {
        console.error('餌やり鳥選択エラー:', error);
        await interaction.update({
            content: '鳥の選択処理中にエラーが発生しました。',
            components: []
        });
    }
}

// 🆕 餌やりダイアログ表示関数（全体公開版）
async function showFeedingDialog(interaction, birdInfo) {
    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
    
    const foodOptions = [
        { name: '🌾 麦', value: '麦' },
        { name: '🐛 虫', value: '虫' },
        { name: '🐟 魚', value: '魚' },
        { name: '🍯 花蜜', value: '花蜜' },
        { name: '🥜 木の実', value: '木の実' },
        { name: '🌿 青菜', value: '青菜' },
        { name: '🐁 ねずみ', value: 'ねずみ' }
    ];

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('food_select')
        .setPlaceholder('餌の種類を選択してください...')
        .addOptions(
            foodOptions.map(food => ({
                label: food.name,
                value: food.value
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // 餌やりセッションを保存
    const sessionKey = `${interaction.user.id}_${interaction.guild.id}`;
    if (!global.feedingSessionCache) global.feedingSessionCache = new Map();
    global.feedingSessionCache.set(sessionKey, {
        birdInfo: birdInfo,
        timestamp: Date.now()
    });

    const locationText = birdInfo.isFromNest ? 
        `${birdInfo.area} (${interaction.user.username}さんのネスト)` : 
        `${birdInfo.area}エリア`;

    // 🔧 修正: 全体公開で餌選択ダイアログを表示
    await interaction.update({
        content: `🍽️ **${birdInfo.bird.name}** に餌をあげます\n📍 場所: ${locationText}\n\n${interaction.user.username}さん、餌の種類を選択してください：`,
        components: [row]
    });
}

// 🆕 餌選択処理関数（修正版）
async function handleFoodSelection(interaction) {
    try {
        if (!interaction.values || interaction.values.length === 0) {
            await interaction.update({
                content: '❌ 餌が選択されていません。',
                components: []
            });
            return;
        }

        const selectedFood = interaction.values[0];
        
        // セッションキャッシュから鳥情報を取得
        const sessionKey = `${interaction.user.id}_${interaction.guild.id}`;
        const session = global.feedingSessionCache?.get(sessionKey);
        
        if (!session || !session.birdInfo) {
            await interaction.update({
                content: '❌ 餌やりセッションが期限切れです。再度コマンドを実行してください。',
                components: []
            });
            return;
        }

        // セッションをクリア
        global.feedingSessionCache.delete(sessionKey);
        
        // 餌やりコマンドを実行
        await executeFeedingCommand(interaction, session.birdInfo, selectedFood);
        
    } catch (error) {
        console.error('餌選択処理エラー:', error);
        await interaction.update({
            content: '餌の選択処理中にエラーが発生しました。',
            components: []
        });
    }
}

// 🆕 餌やりコマンド実行関数
async function executeFeedingCommand(interaction, birdInfo, food) {
    try {
        // feedコマンドを取得して実行
        const feedCommand = client.commands.get('feed');
        if (!feedCommand) {
            await interaction.update({
                content: '❌ 餌やりコマンドが利用できません。',
                components: []
            });
            return;
        }

        // 🌙 睡眠時間チェック
        const sleepCheck = feedCommand.checkBirdSleepTime();
        if (sleepCheck.isSleeping) {
            await interaction.update({
                content: sleepCheck.message,
                components: []
            });
            return;
        }

        // ⏰ クールダウンチェック（ネスト対応）
        const cooldownResult = feedCommand.checkFeedingCooldown(
            birdInfo.bird, 
            interaction.user.id, 
            birdInfo.isFromNest
        );
        if (!cooldownResult.canFeed) {
            await interaction.update({
                content: `⏰ ${birdInfo.bird.name}にはまだ餌をあげられません。\n次回餌やり可能時刻: ${cooldownResult.nextFeedTime}`,
                components: []
            });
            return;
        }

        const guildId = interaction.guild.id;
        
        // 🔄 鳥データ初期化チェック
        const birdData = require('./utils/birdData');
        if (!birdData.initialized) {
            await interaction.update({
                content: '🔄 鳥データを読み込み中です...少々お待ちください',
                components: []
            });
            await birdData.initialize();
        }

        // 🏗️ 動物園初期化
        const zooManager = require('./utils/zooManager');
        await zooManager.initializeServer(guildId);

        // 🍽️ 餌やり処理
        const preference = birdData.getFoodPreference(
            birdInfo.bird.originalName || birdInfo.bird.name, 
            food
        );
        const feedResult = feedCommand.processFeedingResult(birdInfo, food, preference, interaction.user);
        feedCommand.updateBirdAfterFeeding(birdInfo.bird, food, preference, interaction.user.id);

        // 💖 好感度処理
        const affinityResult = await feedCommand.processAffinity(
            interaction.user.id, 
            interaction.user.username, 
            birdInfo.bird.originalName || birdInfo.bird.name, 
            preference, 
            guildId
        );

        // 📊 結果表示
        const embed = feedCommand.createFeedingResultEmbed(birdInfo, food, feedResult, affinityResult);
        await interaction.update({ 
            embeds: [embed], 
            components: [] 
        });

        // 📋 ログ記録
        const logger = require('./utils/logger');
        await logger.logFeedWithServer(
            interaction.user.id,
            interaction.user.username,
            birdInfo.bird.originalName || birdInfo.bird.name,
            food,
            feedResult.effect,
            guildId
        );

        // 🎯 非同期処理を開始
        feedCommand.startAsyncProcesses(interaction, birdInfo, feedResult, affinityResult, guildId);

        // ✨ 特別イベントチェック
        feedCommand.checkForSpecialEvents(birdInfo, food, preference, interaction, guildId);

        // 💾 動物園状態保存
        await zooManager.saveServerZoo(guildId);

    } catch (error) {
        console.error('餌やりコマンド実行エラー:', error);
        await interaction.update({
            content: '餌やりの実行中にエラーが発生しました。',
            components: []
        });
    }
}
    
// 鳥詳細選択メニュー処理
async function handleBirdDetailSelect(interaction) {
    try {
        const selectedValue = interaction.values[0]; // 例: "bird_0"
        const birdIndex = parseInt(selectedValue.split('_')[1]);
        
        // 元のメッセージから検索結果を取得する必要があります
        // セレクトメニューには元の検索結果を保持する仕組みが必要ですが、
        // 一時的な解決策として、選択された鳥の名前から詳細を取得します
        
        // セレクトメニューのオプションから鳥の名前を取得
        const selectMenu = interaction.message.components[0].components[0];
        const selectedOption = selectMenu.options[birdIndex];
        const birdName = selectedOption.label;
        
        // 鳥データから該当する鳥を検索
        if (!birdData.initialized) {
            await interaction.reply({
                content: '🔄 鳥データを読み込み中です...少々お待ちください',
            });
            return;
        }
        
        const bird = birdData.getAllBirds().find(b => b.名前 === birdName);
        
        if (!bird) {
            await interaction.reply({
                content: '❌ 選択された鳥の詳細情報が見つかりませんでした。',
                ephemeral: true
            });
            return;
        }
        
        // search.jsの createSingleResultEmbed メソッドを使用して詳細Embedを作成
        const searchCommand = client.commands.get('search');
        if (!searchCommand) {
            await interaction.reply({
                content: '❌ 検索コマンドが利用できません。',
                ephemeral: true
            });
            return;
        }
        
        // 検索条件は空で渡す（詳細表示なので条件表示は不要）
        const detailEmbed = searchCommand.createSingleResultEmbed(bird, {});
        
        // タイトルを詳細表示用に変更
        detailEmbed.setTitle(`🔍 詳細情報: ${bird.名前}`);
        
        await interaction.reply({
            embeds: [detailEmbed],
        });
        
    } catch (error) {
        console.error('鳥詳細選択エラー:', error);
        await interaction.reply({
            content: '詳細情報の取得中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

// 🆕 ネスト変更セレクトメニュー処理関数
async function handleNestChangeSelectMenu(interaction) {
    try {
        console.log(`🔧 ネスト変更セレクトメニュー開始`);
        console.log(`🔧 interaction.values:`, interaction.values);
        
        if (!interaction.values || interaction.values.length === 0) {
            await interaction.update({
                content: '❌ ネストが選択されていません。',
                components: []
            });
            return;
        }

        const selectedValue = interaction.values[0];
        console.log(`🔧 選択された値: "${selectedValue}"`);
        
        // 🔧 修正：パイプ区切りで解析
        const parts = selectedValue.split('|');
        console.log(`🔧 分割結果:`, parts);
        
        if (parts.length < 3) {
            console.error(`❌ 値の形式が正しくありません: ${selectedValue}`);
            await interaction.update({
                content: '❌ 選択値の形式エラーです。再度お試しください。',
                components: []
            });
            return;
        }
        
        const userId = parts[0];
        const birdName = parts[1];
        const newNestType = parts.slice(2).join('|'); // ネスト名にパイプが含まれる場合に対応
        
        console.log(`🔄 ネスト変更セレクト:`, { 
            userId, 
            birdName, 
            newNestType,
            interactionUserId: interaction.user.id,
            userIdMatch: userId === interaction.user.id
        });
        
        // 権限チェック
        if (userId !== interaction.user.id) {
            console.error(`❌ 権限チェック失敗: selectedUserId="${userId}" !== interactionUserId="${interaction.user.id}"`);
            await interaction.update({
                content: `❌ この操作はあなた専用ではありません。`,
                components: []
            });
            return;
        }
        
        console.log(`✅ 権限チェック通過: ${interaction.user.username} (${interaction.user.id})`);
        
        // 現在のネスト情報を取得
        const sheetsManager = require('../config/sheets');
        const existingNest = await sheetsManager.getBirdNest(userId, birdName, interaction.guild.id);
        
        if (!existingNest) {
            await interaction.update({
                content: `❌ ${birdName}のネストが見つかりません。`,
                components: []
            });
            return;
        }
        
        console.log(`🔍 現在のネスト情報:`, existingNest);
        
        // ネスト変更処理
        const result = await processNestChange(
            userId, 
            interaction.user.username, 
            birdName, 
            existingNest.ネストタイプ,
            newNestType, 
            interaction.guild.id
        );
        
        if (result.success) {
            const embed = {
                title: '🔄 ネスト変更完了！',
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
                    text: `変更者: ${interaction.user.username} | ${new Date().toLocaleString('ja-JP')}`
                }
            };
            
            await interaction.update({
                embeds: [embed],
                components: []
            });
            
        } else {
            await interaction.update({
                content: `❌ ネスト変更に失敗しました: ${result.message}`,
                components: []
            });
        }
        
    } catch (error) {
        console.error('ネスト変更セレクトメニューエラー:', error);
        console.error('エラースタック:', error.stack);
        
        try {
            await interaction.update({
                content: '❌ ネスト変更中にエラーが発生しました。',
                components: []
            });
        } catch (updateError) {
            console.error('ネスト変更エラー応答失敗:', updateError);
        }
    }
}
// 🆕 ネスト変更処理関数
async function processNestChange(userId, userName, birdName, oldNestType, newNestType, serverId) {
    try {
        console.log(`🔄 ネスト変更処理: ${birdName} (${oldNestType} → ${newNestType})`);

        const sheetsManager = require('../config/sheets');
        
        // データベース更新
        await sheetsManager.updateNestType(userId, birdName, newNestType, serverId);
        
        // 変更ログを記録
        await sheetsManager.logNestChange(userId, userName, birdName, oldNestType, newNestType, serverId);

        console.log(`✅ ネスト変更完了: ${birdName} -> ${newNestType}`);

        return {
            success: true,
            oldType: oldNestType,
            newType: newNestType,
            message: `${birdName}のネストを${newNestType}に変更しました！`
        };

    } catch (error) {
        console.error('ネスト変更処理エラー:', error);
        return {
            success: false,
            message: 'データベースの更新に失敗しました'
        };
    }
}

// 🏠 ネスト選択処理関数（bot.jsに追加）
async function handleNestSelection(interaction) {
    // カスタムIDを解析: nest_select_0_アホウドリ_樹海の宮殿
    const parts = interaction.customId.split('_');
    const index = parts[2];
    const birdName = parts[3];
    const nestType = parts.slice(4).join('_'); // ネスト名に_が含まれる場合に対応
    
    const userId = interaction.user.id;
    const userName = interaction.user.displayName || interaction.user.username;
    const serverId = interaction.guild.id;
    
    console.log(`🏗️ ネスト選択: ${userName} -> ${birdName} (${nestType})`);
    
    try {
        // ネストシステムクラスをインスタンス化
        const { NestSystem } = require('./commands/nest');
        const nestSystem = new NestSystem();
        
        // ネスト建設を実行
        const result = await nestSystem.buildNest(
            userId, 
            userName, 
            birdName, 
            nestType, 
            serverId, 
            interaction.client
        );
        
        if (result.success) {
            const embed = {
                title: '🏗️ ネスト建設完了！',
                description: `**${birdName}**の**${nestType}**が完成しました！`,
                color: 0x4CAF50,
                fields: [
                    {
                        name: '📍 専用チャンネル',
                        value: result.channelId ? `<#${result.channelId}>` : '専用チャンネルの作成に失敗しました',
                        inline: false
                    },
                    {
                        name: '🎉 おめでとうございます！',
                        value: `${birdName}との絆がさらに深まりました。専用チャンネルで特別な時間をお過ごしください。`,
                        inline: false
                    },
                    {
                        name: '🔧 次にできること',
                        value: '• `/nest view` - 所有ネスト一覧\n• `/nest change` - ネストタイプ変更\n• `/nest visit` - ネスト詳細表示',
                        inline: false
                    }
                ],
                footer: {
                    text: '専用ネストでは特別なイベントが発生します'
                }
            };
            
            await interaction.update({
                embeds: [embed],
                components: [] // ボタンを削除
            });
            
            console.log(`✅ ネスト建設成功: ${birdName} -> ${nestType}`);
            
            // ログ記録
            await logger.logEvent('ネスト建設', `${userName}が${birdName}の${nestType}を建設しました`, serverId);
            
        } else {
            await interaction.update({
                content: `❌ ネスト建設に失敗しました: ${result.message}`,
                embeds: [],
                components: []
            });
            
            console.log(`❌ ネスト建設失敗: ${result.message}`);
        }
        
    } catch (error) {
        console.error('ネスト建設実行エラー:', error);
        
        const errorMessage = error.message || 'ネスト建設中に予期しないエラーが発生しました';
        
        try {
            await interaction.update({
                content: `❌ ネスト建設中にエラーが発生しました: ${errorMessage}`,
                embeds: [],
                components: []
            });
        } catch (updateError) {
            console.error('ネスト建設エラー応答失敗:', updateError);
        }
        
        // エラーログ記録
        await logger.logError('ネスト建設', error, {
            userId,
            userName,
            birdName,
            nestType,
            serverId
        });
    }
}

// 🆕 ネストガチャ選択処理関数
async function handleNestGachaSelection(interaction) {
    try {
        // カスタムIDを解析: nest_gacha_1_406748284942548992_アホウドリ_真珠の洞窟_3
        const parts = interaction.customId.split('_');
        const index = parseInt(parts[2]);
        const userId = parts[3];
        const birdName = parts[4];
        const nestType = parts.slice(5, -1).join('_'); // 最後の数字(絆レベル)を除く
        const bondLevel = parseInt(parts[parts.length - 1]);
        
        console.log(`🎰 ネストガチャ選択:`, { index, userId, birdName, nestType, bondLevel });
        
        // 権限チェック
        if (interaction.user.id !== userId) {
            await interaction.reply({
                content: '❌ このガチャはあなた専用ではありません。',
                ephemeral: true
            });
            return;
        }
        
        // ネスト取得処理
        const result = await processNestGachaSelection(userId, interaction.user.username, birdName, nestType, bondLevel, interaction.guild.id);
        
        if (result.success) {
            const embed = {
                title: '🎉 ネスト取得完了！',
                description: `**${nestType}**を取得しました！`,
                color: 0x00FF00,
                fields: [
                    {
                        name: '🐦 対象の鳥',
                        value: birdName,
                        inline: true
                    },
                    {
                        name: '🏠 取得したネスト',
                        value: nestType,
                        inline: true
                    },
                    {
                        name: '🌟 絆レベル',
                        value: `レベル${bondLevel}`,
                        inline: true
                    },
                    {
                        name: '🔧 次にできること',
                        value: `• \`/nest create bird:${birdName}\` - ネスト建設\n• \`/nest view\` - 所有ネスト一覧\n• \`/nest gacha bird:${birdName}\` - 他の絆レベル報酬`,
                        inline: false
                    }
                ],
                footer: {
                    text: `絆レベル${bondLevel}達成報酬`
                }
            };
            
            await interaction.update({
                embeds: [embed],
                components: [] // ボタンを削除
            });
            
        } else {
            await interaction.update({
                content: `❌ ネスト取得に失敗しました: ${result.message}`,
                embeds: [],
                components: []
            });
        }
        
    } catch (error) {
        console.error('ネストガチャ選択エラー:', error);
        
        try {
            await interaction.update({
                content: '❌ ネスト取得中にエラーが発生しました。',
                embeds: [],
                components: []
            });
        } catch (updateError) {
            console.error('ネストガチャエラー応答失敗:', updateError);
        }
    }
}

// 🆕 ネスト変更選択処理関数
async function handleNestChangeSelection(interaction) {
    try {
        // カスタムIDを解析: nest_change_406748284942548992_アホウドリ_蓮池の巣
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const birdName = parts[3];
        const newNestType = parts.slice(4).join('_');
        
        console.log(`🔄 ネスト変更選択:`, { userId, birdName, newNestType });
        
        // 権限チェック
        if (interaction.user.id !== userId) {
            await interaction.reply({
                content: '❌ この操作はあなた専用ではありません。',
                ephemeral: true
            });
            return;
        }
        
        // ネスト変更処理
        const { changeNestType } = require('./commands/nest');
        const result = await changeNestType(
            userId, 
            interaction.user.username, 
            birdName, 
            '現在のネスト', // 旧ネスト名（実際には取得が必要）
            newNestType, 
            interaction.guild.id
        );
        
        if (result.success) {
            const embed = {
                title: '🔄 ネスト変更完了！',
                description: `${birdName}のネストを **${newNestType}** に変更しました！`,
                color: 0x00FF00,
                fields: [
                    {
                        name: '🐦 対象の鳥',
                        value: birdName,
                        inline: true
                    },
                    {
                        name: '🏠 新しいネスト',
                        value: newNestType,
                        inline: true
                    }
                ],
                footer: {
                    text: `変更者: ${interaction.user.username}`
                }
            };
            
            await interaction.update({
                embeds: [embed],
                components: []
            });
            
        } else {
            await interaction.update({
                content: `❌ ネスト変更に失敗しました: ${result.message}`,
                embeds: [],
                components: []
            });
        }
        
    } catch (error) {
        console.error('ネスト変更選択エラー:', error);
        
        try {
            await interaction.update({
                content: '❌ ネスト変更中にエラーが発生しました。',
                embeds: [],
                components: []
            });
        } catch (updateError) {
            console.error('ネスト変更エラー応答失敗:', updateError);
        }
    }
}

// 🆕 ネストガチャ選択を処理する関数
async function processNestGachaSelection(userId, userName, birdName, nestType, bondLevel, serverId) {
    try {
        const sheetsManager = require('../config/sheets');
        
        // 🔧 修正：まず先にガチャチケットを使用済みにマーク
        console.log(`🎰 ガチャチケット使用済み処理開始: ${userId} -> ${birdName} (絆レベル${bondLevel})`);
        
        const ticketMarked = await sheetsManager.markNestGachaAsUsed(userId, birdName, bondLevel, serverId);
        
        if (!ticketMarked) {
            console.error(`❌ ガチャチケット使用済み処理失敗`);
            return {
                success: false,
                message: 'ガチャチケットの処理に失敗しました'
            };
        }
        
        console.log(`✅ ガチャチケット使用済み処理完了`);
        
        // 1. 現在の所持ネストリストを取得
        const currentNests = await sheetsManager.getUserOwnedNestTypes(userId, serverId);
        
        // 2. 新しいネストを追加
        const updatedNests = [...currentNests, nestType];
        
        // 3. ネスト取得を記録
        await sheetsManager.logNestAcquisition(
            userId,
            userName,
            birdName,
            nestType,
            bondLevel,
            'bond_level_gacha',
            updatedNests,
            serverId
        );
        
        console.log(`✅ ネスト取得記録完了: ${userName} -> ${nestType}`);
        
        return {
            success: true,
            nestType: nestType,
            message: `${nestType}を取得しました！`
        };
        
    } catch (error) {
        console.error('ネストガチャ選択処理エラー:', error);
        return {
            success: false,
            message: 'データベースの更新に失敗しました'
        };
    }
}
// 鳥類園ボタン処理
// ボタン処理部分を修正
async function handleZooButtons(interaction) {
    const { customId } = interaction;
    const guildId = interaction.guild.id;

    try {
        // zooCommandを取得
        const zooCommand = require('./commands/zoo');
        
        if (!zooCommand) {
            console.error('zooCommandが見つかりません');
            return;
        }

        await logger.logZoo('ボタン操作', customId, '', interaction.user.id, interaction.user.username, guildId);

        switch (customId) {
            case 'zoo_refresh':
                // 全体表示を更新
                await interaction.deferUpdate();
                const embed = await zooCommand.createZooOverviewEmbed(guildId);
                const buttons = zooCommand.createZooButtons();
                await interaction.editReply({ 
                    embeds: [embed], 
                    components: [buttons] 
                });
                break;
                
            case 'zoo_forest':
                await interaction.deferReply();
                const forestEmbed = await zooCommand.createAreaDetailEmbed('森林', guildId);
                await interaction.editReply({ 
                    embeds: [forestEmbed] 
                });
                break;
            
            case 'zoo_grassland':
                await interaction.deferReply();
                const grasslandEmbed = await zooCommand.createAreaDetailEmbed('草原', guildId);
                await interaction.editReply({ 
                    embeds: [grasslandEmbed] 
                });
                break;
            
            case 'zoo_waterside':
                await interaction.deferReply();
                const watersideEmbed = await zooCommand.createAreaDetailEmbed('水辺', guildId);
                await interaction.editReply({ 
                    embeds: [watersideEmbed] 
                });
                break;
                
            default:
                console.log(`未処理のzooボタン: ${customId}`);
                await interaction.reply({ 
                    content: '不明な操作です。', 
                    ephemeral: true 
                });
                break;
        }

    } catch (error) {
        console.error('Zoo button handling error:', error);
        
        // エラー時の安全な応答
        try {
            if (interaction.deferred) {
                await interaction.editReply({
                    content: 'エラーが発生しました。もう一度お試しください。',
                    embeds: [],
                    components: []
                });
            } else {
                await interaction.reply({
                    content: 'エラーが発生しました。もう一度お試しください。',
                    ephemeral: true
                });
            }
        } catch (updateError) {
            console.error('Error response failed:', updateError);
        }
    }
}

// Bot参加時
client.on('guildCreate', async guild => {
    console.log(`🆕 新しいサーバーに参加: ${guild.name} (${guild.memberCount}人)`);
    await logger.logEvent('Bot参加', `新しいサーバーに参加: ${guild.name}`, '');
});

// Bot退出時
client.on('guildDelete', async guild => {
    console.log(`👋 サーバーから退出: ${guild.name}`);
    await logger.logEvent('Bot退出', `サーバーから退出: ${guild.name}`, '');
});

// エラーハンドリング
client.on('error', error => {
    console.error('❌ Discord.js エラー:', error);
    logger.logError('Discord.js', error);
});

client.on('warn', warning => {
    console.warn('⚠️ Discord.js 警告:', warning);
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
    console.log('\n🔄 Bot終了処理を開始...');
    
    try {
        // スケジューラー停止
        scheduler.shutdown();
        
        // 鳥類園管理システム停止
        zooManager.shutdown();
        
        // 終了ログ
        await logger.logEvent('システム', 'Discord Botが正常に終了しました', '');
        
        console.log('✅ クリーンアップ完了');
        
        // Bot切断
        client.destroy();
        
        // プロセス終了
        process.exit(0);
    } catch (error) {
        console.error('❌ 終了処理エラー:', error);
        process.exit(1);
    }
});

// 未処理のPromise拒否
process.on('unhandledRejection', error => {
    console.error('❌ 未処理のPromise拒否:', error);
    logger.logError('UnhandledRejection', error);
});

// 未処理の例外
process.on('uncaughtException', error => {
    console.error('❌ 未処理の例外:', error);
    logger.logError('UncaughtException', error);
    
    // 重大なエラーなので終了
    process.exit(1);
});

// Bot起動
console.log('🚀 Discord Botを起動中...');
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Bot起動エラー:', error);
    process.exit(1);
});
