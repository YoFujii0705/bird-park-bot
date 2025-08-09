require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// コマンドファイルの読み込み
console.log('📂 コマンドファイルを読み込み中...');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ コマンド登録準備: ${command.data.name} (${file})`);
        } else {
            console.log(`⚠️  スキップ: ${file} (data または execute が見つかりません)`);
        }
    } catch (error) {
        console.error(`❌ エラー: ${file} の読み込みに失敗しました`, error.message);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`\n🔄 ${commands.length}個のスラッシュコマンドを登録中...`);
        
        // 環境変数の確認
        if (!process.env.CLIENT_ID) {
            throw new Error('CLIENT_ID が環境変数に設定されていません');
        }
        
        // グローバル登録（全サーバーで利用可能、反映に最大1時間）
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        
        console.log(`✅ ${data.length}個のスラッシュコマンドを正常に登録しました！`);
        
        // 登録されたコマンド一覧を表示
        console.log('\n📋 登録されたコマンド一覧:');
        data.forEach(cmd => {
            console.log(`   • /${cmd.name} - ${cmd.description}`);
        });
        
        console.log('\n⏰ グローバルコマンドの反映まで最大1時間かかる場合があります');
        console.log('💡 テスト用に特定のサーバーのみに登録したい場合は、');
        console.log('   Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) を使用してください');
        
    } catch (error) {
        console.error('❌ コマンド登録エラー:', error);
        
        // エラーの詳細情報
        if (error.code === 50001) {
            console.error('💡 Bot に application.commands スコープが必要です');
        } else if (error.code === 'ENOTFOUND') {
            console.error('💡 インターネット接続を確認してください');
        } else if (error.rawError?.code === 50035) {
            console.error('💡 コマンドの定義に問題があります。各コマンドファイルを確認してください');
        }
        
        process.exit(1);
    }
})();
