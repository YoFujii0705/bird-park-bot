const { Events } = require('discord.js');
const sheets = require('../../config/sheets');
const { NestSystem } = require('../commands/nest');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // スラッシュコマンドの処理
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`コマンドが見つかりません: ${interaction.commandName}`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('コマンド実行エラー:', error);
                const errorMessage = { 
                    content: 'コマンド実行中にエラーが発生しました。', 
                    ephemeral: true 
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }
        
        // ボタンインタラクションの処理
        else if (interaction.isButton()) {
            const customId = interaction.customId;
            
            try {
                if (customId.startsWith('nest_select_')) {
                    await handleNestSelection(interaction);
                }
                else if (customId.startsWith('nest_gacha_')) {
                    await handleNestGachaSelection(interaction);
                }
                else if (customId.startsWith('nest_change_')) {
                    await handleNestChangeSelection(interaction);
                }
                else {
                    console.log(`未処理のボタンインタラクション: ${customId}`);
                }
            } catch (error) {
                console.error('ボタンインタラクションエラー:', error);
                const errorMessage = { 
                    content: 'ボタン処理中にエラーが発生しました。', 
                    ephemeral: true 
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }
    },
};

// ネスト建設選択処理
async function handleNestSelection(interaction) {
    try {
        const customId = interaction.customId;
        // custom_id: nest_select_{index}_{birdName}_{nestType}
        const parts = customId.split('_');
        const selectedIndex = parseInt(parts[2]);
        const birdName = parts[3];
        const selectedNestType = parts[4];

        const userId = interaction.user.id;
        const userName = interaction.user.displayName || interaction.user.username;
        const serverId = interaction.guild.id;

        await interaction.deferReply();

        console.log(`🏗️ ネスト建設選択: ${userName} -> ${birdName} (${selectedNestType})`);

        // NestSystemインスタンスを作成
        const nestSystem = new NestSystem();
        
        // ネストを建設
        const result = await nestSystem.buildNest(
            userId, 
            userName, 
            birdName, 
            selectedNestType, 
            serverId, 
            interaction.client
        );

        if (result.success) {
            const successEmbed = {
                title: `🎉 ネスト建設完了！`,
                description: `**${birdName}**の**${selectedNestType}**が完成しました！`,
                color: 0x00FF00,
                fields: [
                    {
                        name: '🏠 建設したネスト',
                        value: selectedNestType,
                        inline: true
                    },
                    {
                        name: '🐦 対象の鳥',
                        value: birdName,
                        inline: true
                    },
                    {
                        name: '🔗 専用チャンネル',
                        value: result.channelId ? `<#${result.channelId}>` : '作成中...',
                        inline: true
                    },
                    {
                        name: '💡 次のステップ',
                        value: '`/nest visit` でネストの様子を確認\n`/nest change` でネストタイプを変更',
                        inline: false
                    }
                ],
                footer: {
                    text: `建設者: ${userName} | ${new Date().toLocaleString('ja-JP')}`
                },
                timestamp: new Date().toISOString()
            };

            await interaction.editReply({
                embeds: [successEmbed]
            });

            // 元の選択メッセージを更新（ボタンを無効化）
            if (interaction.message) {
                const disabledEmbed = {
                    ...interaction.message.embeds[0].data,
                    title: `✅ ${interaction.message.embeds[0].title} - 建設完了`,
                    color: 0x808080
                };

                await interaction.message.edit({
                    embeds: [disabledEmbed],
                    components: [] // ボタンを削除
                });
            }
        } else {
            await interaction.editReply({
                content: `❌ ネスト建設に失敗しました: ${result.message}`
            });
        }

    } catch (error) {
        console.error('ネスト建設選択エラー:', error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ ネスト建設中にエラーが発生しました。時間をおいて再度お試しください。'
            });
        } else {
            await interaction.reply({
                content: '❌ ネスト建設中にエラーが発生しました。時間をおいて再度お試しください。',
                ephemeral: true
            });
        }
    }
}

// 絆レベルアップ時のネストガチャ選択処理
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

        console.log(`🎰 ネストガチャ選択: ${interaction.user.username} -> ${selectedNestType} (絆レベル${bondLevel})`);

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

// ネスト変更選択処理
async function handleNestChangeSelection(interaction) {
    try {
        const customId = interaction.customId;
        
        // custom_id: nest_change_{userId}_{birdName}_{newNestType}
        const parts = customId.split('_');
        const targetUserId = parts[2];
        const birdName = parts[3];
        const newNestType = parts.slice(4).join('_'); // ネスト名に_が含まれる場合対応

        // 権限チェック
        if (interaction.user.id !== targetUserId) {
            await interaction.reply({
                content: '❌ このネスト変更はあなた専用ではありません。',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply();

        const userName = interaction.user.displayName || interaction.user.username;
        const serverId = interaction.guild.id;

        console.log(`🔄 ネスト変更選択: ${userName} -> ${birdName} (${newNestType})`);

        // 現在のネスト情報を取得
        const existingNest = await sheets.getBirdNest(targetUserId, birdName, serverId);
        if (!existingNest) {
            await interaction.editReply({
                content: `❌ ${birdName}のネストが見つかりません。`
            });
            return;
        }

        // 所持ネストチェック
        const ownedNestTypes = await sheets.getUserOwnedNestTypes(targetUserId, serverId);
        if (!ownedNestTypes.includes(newNestType)) {
            await interaction.editReply({
                content: `❌ 「${newNestType}」は所持していません。`
            });
            return;
        }

        // ネストタイプを変更
        const result = await changeNestType(
            targetUserId, 
            userName, 
            birdName, 
            existingNest.ネストタイプ, 
            newNestType, 
            serverId
        );
        
        if (result.success) {
            // 成功メッセージ
            const successEmbed = {
                title: `🔄 ネスト変更完了！`,
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
                    },
                    {
                        name: '💡 ヒント',
                        value: `\`/nest visit bird:${birdName}\` で新しいネストの様子を確認してみましょう！`,
                        inline: false
                    }
                ],
                footer: {
                    text: `変更者: ${userName} | ${new Date().toLocaleString('ja-JP')}`
                },
                timestamp: new Date().toISOString()
            };

            await interaction.editReply({
                embeds: [successEmbed]
            });

            // 元の選択メッセージを更新（ボタンを無効化）
            if (interaction.message) {
                const disabledEmbed = {
                    ...interaction.message.embeds[0].data,
                    title: `✅ ${interaction.message.embeds[0].title} - 変更完了`,
                    color: 0x808080
                };

                await interaction.message.edit({
                    embeds: [disabledEmbed],
                    components: [] // ボタンを削除
                });
            }

        } else {
            await interaction.editReply({
                content: `❌ ネスト変更に失敗しました: ${result.message}`
            });
        }

    } catch (error) {
        console.error('ネスト変更選択エラー:', error);
        
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
        const ownedNests = await sheets.getUserOwnedNestTypes(userId, serverId);

        // 重複チェック
        if (ownedNests.includes(nestType)) {
            return {
                success: false,
                message: '既に所持しているネストタイプです'
            };
        }

        // 所持ネストリストを更新
        const updatedNests = [...ownedNests, nestType];

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

// ネストタイプを変更
async function changeNestType(userId, userName, birdName, oldNestType, newNestType, serverId) {
    try {
        console.log(`🔄 ネストタイプ変更: ${birdName} (${oldNestType} → ${newNestType})`);

        // データベース更新
        await sheets.updateNestType(userId, birdName, newNestType, serverId);
        
        // 変更ログを記録
        await sheets.logNestChange(userId, userName, birdName, oldNestType, newNestType, serverId);

        console.log(`✅ ネストタイプ変更完了: ${birdName} -> ${newNestType}`);

        return {
            success: true,
            oldType: oldNestType,
            newType: newNestType,
            message: `${birdName}のネストを${newNestType}に変更しました！`
        };

    } catch (error) {
        console.error('ネストタイプ変更エラー:', error);
        return {
            success: false,
            message: 'データベースの更新に失敗しました'
        };
    }
}
