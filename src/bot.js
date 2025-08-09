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
        // 鳥詳細選択メニュー
        else if (customId === 'bird_detail_select') {
            await handleBirdDetailSelect(interaction);
        }
        // その他のコンポーネント
        else {
            console.log(`未処理のコンポーネント: ${customId}`);
        }
    } catch (error) {
        console.error('コンポーネント処理エラー:', error);
        await interaction.reply({ 
            content: '操作の処理中にエラーが発生しました。', 
            ephemeral: true 
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

// 鳥類園ボタン処理
// ボタン処理部分を修正
async function handleZooButtons(interaction) {
    const { customId } = interaction;
    const guildId = interaction.guild.id; // サーバーID取得

    try {
        if (interaction.customId === 'zoo_refresh') {
            // 🆕 async対応
            const embed = await zooCommand.createZooOverviewEmbed(guildId);
            const buttons = zooCommand.createZooButtons();
            
            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
        } else if (interaction.customId.startsWith('zoo_')) {
            const areaMap = {
                'zoo_forest': '森林',
                'zoo_grassland': '草原', 
                'zoo_waterside': '水辺'
            };
            
            const area = areaMap[interaction.customId];
            if (area) {
                // 🆕 async対応
                const embed = await zooCommand.createAreaDetailEmbed(area, guildId);
                
                await interaction.update({
                    embeds: [embed],
                    components: []
                });
            }
        }
    } catch (error) {
        console.error('Zoo button handling error:', error);
        // エラー時は安全な応答
        try {
            await interaction.update({
                content: 'エラーが発生しました。もう一度お試しください。',
                embeds: [],
                components: []
            });
        } catch (updateError) {
            console.error('Update error:', updateError);
        }
    }

    try {
        // 鳥類園関連のボタン
        if (customId.startsWith('zoo_')) {
            const zooCommand = client.commands.get('zoo');
            
            if (!zooCommand) return;

            switch (customId) {
                case 'zoo_refresh':
                    // 全体表示を更新（サーバー別）
                    await interaction.deferUpdate();
                    const embed = zooCommand.createZooOverviewEmbed(guildId);
                    const buttons = zooCommand.createZooButtons();
                    await interaction.editReply({ embeds: [embed], components: [buttons] });
                    break;
                    
                case 'zoo_forest':
                    try {
                        const forestEmbed = await zooCommand.createAreaDetailEmbed('森林', guildId);
                        await interaction.reply({ 
                            embeds: [forestEmbed]
                        });
                    } catch (error) {
                        console.error('森林エリア表示エラー:', error);
                        await interaction.reply({ 
                            content: '森林エリアの情報取得中にエラーが発生しました。', 
                            flags: 64 
                        });
                    }
                    break;
                
                case 'zoo_grassland':
                    try {
                        const grasslandEmbed = await zooCommand.createAreaDetailEmbed('草原', guildId);
                        await interaction.reply({ 
                            embeds: [grasslandEmbed]
                        });
                    } catch (error) {
                        console.error('草原エリア表示エラー:', error);
                        await interaction.reply({ 
                            content: '草原エリアの情報取得中にエラーが発生しました。', 
                            flags: 64 
                        });
                    }
                    break;
                
                case 'zoo_waterside':
                    try {
                        const watersideEmbed = await zooCommand.createAreaDetailEmbed('水辺', guildId);
                        await interaction.reply({ 
                            embeds: [watersideEmbed]
                        });
                    } catch (error) {
                        console.error('水辺エリア表示エラー:', error);
                        await interaction.reply({ 
                            content: '水辺エリアの情報取得中にエラーが発生しました。', 
                            flags: 64 
                        });
                    }
                    break;
            }
        }
        // 鳥詳細選択メニュー
        else if (customId === 'bird_detail_select') {
            await handleBirdDetailSelect(interaction);
        }
        // その他のコンポーネント
        else {
            console.log(`未処理のコンポーネント: ${customId}`);
        }
    } catch (error) {
        console.error('コンポーネント処理エラー:', error);
        await interaction.reply({ 
            content: '操作の処理中にエラーが発生しました。', 
            ephemeral: true 
        });
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
