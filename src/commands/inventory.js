const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sheetsManager = require('../../config/sheets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('所持している贈り物を確認します🎁'),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;
            const userName = interaction.user.username;

            await interaction.deferReply();

            // ユーザーの贈り物インベントリを取得
            const gifts = await sheetsManager.getUserGifts(userId, guildId);
            
            // ユーザーの好感度情報を取得
            const affinities = await sheetsManager.getUserAffinity(userId, guildId);

            // インベントリが空の場合
            if (Object.keys(gifts).length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🎁 贈り物インベントリ')
                    .setDescription('まだ贈り物を持っていません。\n\n鳥たちと仲良くなって贈り物をもらいましょう！\n餌やりを3回すると特別な絆が生まれ、贈り物がもらえます。')
                    .setColor(0x87CEEB)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // 贈り物リストを整理
            const giftsList = Object.entries(gifts)
                .filter(([name, count]) => count > 0)
                .map(([name, count]) => `🎁 **${name}** × ${count}個`)
                .join('\n');

            // 好感度情報を整理
            const affinityList = Object.entries(affinities)
                .filter(([bird, data]) => data.level >= 3) // レベル3以上（贈り物可能）
                .map(([bird, data]) => {
                    const hearts = '💖'.repeat(data.level);
                    return `${hearts} **${bird}** (Lv.${data.level}) - 贈り物可能！`;
                })
                .join('\n');

            // 統計情報
            const totalGifts = Object.values(gifts).reduce((sum, count) => sum + count, 0);
            const giftTypes = Object.keys(gifts).length;
            const maxAffinityBirds = Object.values(affinities).filter(data => data.level >= 3).length;

            const embed = new EmbedBuilder()
                .setTitle('🎁 贈り物インベントリ')
                .setDescription(`${userName}さんの贈り物コレクション`)
                .setColor(0xFF69B4)
                .addFields(
                    {
                        name: '📦 所持している贈り物',
                        value: giftsList || 'なし',
                        inline: false
                    },
                    {
                        name: '💝 贈り物可能な鳥たち',
                        value: affinityList || '贈り物できる鳥はまだいません\n（好感度レベル3で贈り物可能）',
                        inline: false
                    },
                    {
                        name: '📊 統計',
                        value: `🎁 総贈り物数: ${totalGifts}個\n📦 贈り物の種類: ${giftTypes}種類\n💖 親密な鳥: ${maxAffinityBirds}羽`,
                        inline: false
                    }
                )
                .setFooter({
                    text: '贈り物をするには /gift コマンドを使用してください'
                })
                .setTimestamp();

            // 贈り物可能な鳥がいる場合は特別な装飾
            if (maxAffinityBirds > 0) {
                embed.setDescription(`${userName}さんの贈り物コレクション\n\n✨ **${maxAffinityBirds}羽の鳥**に贈り物ができます！`);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('インベントリコマンドエラー:', error);
            
            const errorMessage = 'インベントリの確認中にエラーが発生しました。';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }
};
