// events/interactionCreate.js に追加するネストガチャ選択処理

async function handleNestGachaSelection(interaction) {
    try {
        const customId = interaction.customId;
        
        // custom_id: nest_gacha_{index}_{userId}_{birdName}_{nestType}_{bondLevel}
        const parts = customId.split('_');
        const selectedIndex = parseInt(parts[2]);
        const targetUserId = parts[3];
        const birdName = parts[4];
        const selectedNestType = parts[5];
        const bondLevel = parseInt(parts[6]);

        // 権限チェック
        if (interaction.user.id !== targetUserId) {
            await interaction.reply({
                content: '❌ このガチャはあなた専用ではありません。',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply();

        // ネストを所持リストに追加
        const result = await addNestToUserCollection(
            targetUserId, 
            interaction.user.displayName || interaction.user.username,
            birdName, 
            selectedNestType, 
            bondLevel,
            interaction.guild.id
        );

        if (result.success) {
            // 成功メッセージ
            const successEmbed = {
                title: `🎉 ネスト取得成功！`,
                description: `**${selectedNestType}**を取得しました！\n\n${birdName}との絆の証として、この特別な場所があなたのものになりました。`,
                color: 0x00FF00,
                fields: [
                    {
                        name: '🏠 取得したネスト',
                        value: selectedNestType,
                        inline: true
                    },
                    {
                        name: '🐦 対象の鳥',
                        value: birdName,
                        inline: true
                    },
                    {
                        name: '🌟 絆レベル',
                        value: `レベル ${bondLevel}`,
                        inline: true
                    },
                    {
                        name: '💡 使い方',
                        value: '`/nest change` でいつでもネストタイプを変更できます！',
                        inline: false
                    }
                ],
                footer: {
                    text: `取得日時: ${new Date().toLocaleString('ja-JP')}`
                },
                timestamp: new Date().toISOString()
            };

            await interaction.editReply({
                embeds: [successEmbed]
            });

            // 元のガチャメッセージを更新（ボタンを無効化）
            if (interaction.message) {
                const disabledEmbed = {
                    ...interaction.message.embeds[0].data,
                    title: `✅ ${interaction.message.embeds[0].title} - 選択完了`,
                    color: 0x808080
                };

                await interaction.message.edit({
                    embeds: [disabledEmbed],
                    components: [] // ボタンを削除
                });
            }

        } else {
            await interaction.editReply({
                content: `❌ ネスト取得に失敗しました: ${result.message}`,
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('ネストガチャ選択エラー:', error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ エラーが発生しました。時間をおいて再度お試しください。'
            });
        } else {
            await interaction.reply({
                content: '❌ エラーが発生しました。時間をおいて再度お試しください。',
                ephemeral: true
            });
        }
    }
}

// ユーザーのネストコレクションに追加
async function addNestToUserCollection(userId, userName, birdName, nestType, bondLevel, serverId) {
    try {
        // 現在の所持ネストを取得
        const userNests = await sheets.getUserNests(userId, serverId);
        const currentNestTypes = userNests.map(nest => nest.ネストタイプ);

        // 重複チェック
        if (currentNestTypes.includes(nestType)) {
            return {
                success: false,
                message: '既に所持しているネストタイプです'
            };
        }

        // 所持ネストリストを更新
        const updatedNests = [...currentNestTypes, nestType];

        // データベースに記録
        await sheets.logNestAcquisition(
            userId,
            userName,
            birdName,
            nestType,
            bondLevel,
            'bond_level_gacha', // 取得方法
            updatedNests,
            serverId
        );

        console.log(`🏠 ネスト取得記録: ${userName} -> ${nestType} (絆レベル${bondLevel}報酬)`);

        return {
            success: true,
            nestType: nestType,
            message: `${nestType}を取得しました！`
        };

    } catch (error) {
        console.error('ネストコレクション追加エラー:', error);
        return {
            success: false,
            message: 'データベースエラーが発生しました'
        };
    }
}

// メインのインタラクション処理に追加
async function handleInteraction(interaction) {
    if (interaction.isButton()) {
        const customId = interaction.customId;
        
        if (customId.startsWith('nest_gacha_')) {
            await handleNestGachaSelection(interaction);
        }
        // 既存のネスト建設ボタン処理
        else if (customId.startsWith('nest_select_')) {
            await handleNestSelection(interaction);
        }
        // その他のボタン処理...
    }
    // その他のインタラクション処理...
}

module.exports = {
    handleInteraction,
    handleNestGachaSelection,
    addNestToUserCollection
};
