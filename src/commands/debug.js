// commands/debug.js または適切なコマンドファイルに追加

const { SlashCommandBuilder } = require('discord.js');
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
