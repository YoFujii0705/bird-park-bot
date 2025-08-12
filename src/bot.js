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
    try {
        // 鳥類園関連のボタン
        if (customId.startsWith('zoo_')) {
            await handleZooButtons(interaction);
        }
        // 🏠 ネスト関連のボタン
        else if (customId.startsWith('nest_select_')) {
            await handleNestSelection(interaction);
        }
        // 🆕 餌やり鳥選択セレクトメニュー
        else if (customId === 'bird_feed_select') {
            await handleBirdFeedSelection(interaction);
        }
        // 🎁 贈り物関連のセレクトメニュー（新規追加）
        else if (customId === 'gift_bird_select') {
            // gift.jsで処理済みなので何もしない
            console.log('贈り物鳥選択は既に処理済み');
        }
        else if (customId === 'gift_item_select') {
            // gift.jsで処理済みなので何もしない
            console.log('贈り物アイテム選択は既に処理済み');
        }
        // 見学招待関連はガチャコマンド内で処理されるので何もしない
        else if (customId.startsWith('visit_') || customId === 'select_visitor_bird') {
            console.log(`見学関連の操作: ${customId} - ガチャコマンド内で処理済み`);
            // ガチャコマンドで既に処理されているため、ここでは何もしない
        }
        // 贈り物関連（既存）
        else if (customId === 'select_gift') {
            console.log('贈り物選択は既に処理済み');
            // gift.jsで処理済みなので何もしない
        }
        // 鳥詳細選択メニュー
        else if (customId === 'bird_detail_select') {
            await handleBirdDetailSelect(interaction);
        }
            // 🆕 餌選択セレクトメニュー  
        else if (customId === 'food_select') {
            await handleFoodSelection(interaction);
        }
        // その他
        else {
            console.log(`未処理のコンポーネント: ${customId}`);
        }
    } catch (error) {
        console.error('❌ インタラクション処理エラー:', error);
        
        // インタラクションがまだ応答していない場合のみ応答
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

// 🆕 餌やり鳥選択処理関数
async function handleBirdFeedSelection(interaction) {
    try {
        if (!interaction.values || interaction.values.length === 0) {
            await interaction.reply({
                content: '鳥が選択されていません。',
                ephemeral: true
            });
            return;
        }

        const selectedValue = interaction.values[0]; // 例: "bird_feed_0"
        const birdIndex = parseInt(selectedValue.split('_')[2]);
        
        // セッションキャッシュから候補を取得
        const sessionKey = `${interaction.user.id}_${interaction.guild.id}`;
        const session = global.birdSelectionCache?.get(sessionKey);
        
        if (!session || !session.candidates || birdIndex >= session.candidates.length) {
            await interaction.reply({
                content: '❌ 選択セッションが期限切れです。再度コマンドを実行してください。',
                ephemeral: true
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
        await interaction.reply({
            content: '鳥の選択処理中にエラーが発生しました。',
            ephemeral: true
        });
    }
}

// 🆕 餌やりダイアログ表示関数
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
        `${birdInfo.area} (あなたのネスト)` : 
        `${birdInfo.area}エリア`;

    await interaction.update({
        content: `🍽️ **${birdInfo.bird.name}** に餌をあげます\n📍 場所: ${locationText}\n\n餌の種類を選択してください：`,
        components: [row]
    });
}

// 🆕 餌選択処理関数
async function handleFoodSelection(interaction) {
    try {
        if (!interaction.values || interaction.values.length === 0) {
            await interaction.reply({
                content: '餌が選択されていません。',
                ephemeral: true
            });
            return;
        }

        const selectedFood = interaction.values[0];
        
        // セッションキャッシュから鳥情報を取得
        const sessionKey = `${interaction.user.id}_${interaction.guild.id}`;
        const session = global.feedingSessionCache?.get(sessionKey);
        
        if (!session || !session.birdInfo) {
            await interaction.reply({
                content: '❌ 餌やりセッションが期限切れです。再度コマンドを実行してください。',
                ephemeral: true
            });
            return;
        }

        // セッションをクリア
        global.feedingSessionCache.delete(sessionKey);
        
        // 餌やりコマンドを実行
        await executeFeedingCommand(interaction, session.birdInfo, selectedFood);
        
    } catch (error) {
        console.error('餌選択処理エラー:', error);
        await interaction.reply({
            content: '餌の選択処理中にエラーが発生しました。',
            ephemeral: true
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
