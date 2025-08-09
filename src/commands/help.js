const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('鳥類園Botの使い方を表示します📖')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('知りたいトピック')
                .addChoices(
                    { name: '🏞️ 基本的な遊び方', value: 'basic' },
                    { name: '🍽️ 餌やりシステム', value: 'feeding' },
                    { name: '💖 好感度システム', value: 'affinity' },
                    { name: '🎁 贈り物システム', value: 'gifts' },
                    { name: '🎲 ガチャシステム', value: 'gacha' },
                    { name: '📚 コレクション機能', value: 'collection' },
                    { name: '📋 コマンド一覧', value: 'commands' }
                )
                .setRequired(false)),

    async execute(interaction) {
        try {
            const topic = interaction.options.getString('topic');

            if (!topic) {
                // メイン画面
                await this.showMainHelp(interaction);
            } else {
                // 個別トピック
                await this.showTopicHelp(interaction, topic);
            }

        } catch (error) {
            console.error('ヘルプコマンドエラー:', error);
            await interaction.reply({
                content: 'ヘルプの表示中にエラーが発生しました。',
                ephemeral: true
            });
        }
    },

    async showMainHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🐦 鳥類園Bot ヘルプ')
            .setDescription('**鳥類園へようこそ！**\n\n鳥たちとの絆を深め、特別な思い出を作りましょう。\n下記から知りたい情報を選択してください。')
            .setColor(0x228B22)
            .addFields(
                {
                    name: '🌟 クイックスタート',
                    value: '1. `/zoo view` - 鳥類園を見る\n2. `/feed bird:鳥名 food:麦` - 餌やり\n3. `/gacha count:3` - 新しい鳥を呼ぶ',
                    inline: false
                },
                {
                    name: '⏰ 重要なルール',
                    value: '• 餌やり可能時間: 7:00〜22:00\n• 同じ鳥へのクールダウン: 10分\n• 鳥の滞在期間: 2〜5日',
                    inline: false
                },
                {
                    name: '🎯 目標',
                    value: '• 好感度レベル5で贈り物解放\n• 様々な鳥とレベル10を目指す\n• 特別な贈り物や思い出を集める',
                    inline: false
                }
            )
            .setFooter({ text: '`/help topic:詳細トピック` で各システムの詳細情報を表示' })
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_topic_select')
            .setPlaceholder('詳細を知りたいトピックを選択...')
            .addOptions(
                { label: '🏞️ 基本的な遊び方', value: 'basic', emoji: '🏞️' },
                { label: '🍽️ 餌やりシステム', value: 'feeding', emoji: '🍽️' },
                { label: '💖 好感度システム', value: 'affinity', emoji: '💖' },
                { label: '🎁 贈り物システム', value: 'gifts', emoji: '🎁' },
                { label: '🎲 ガチャシステム', value: 'gacha', emoji: '🎲' },
                { label: '📚 コレクション機能', value: 'collection', emoji: '📚' },
                { label: '📋 コマンド一覧', value: 'commands', emoji: '📋' }
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const response = await interaction.reply({
            embeds: [embed],
            components: [row]
        });

        // 🔧 セレクトメニューのインタラクション処理を追加
        try {
            const confirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 60000
            });

            const selectedTopic = confirmation.values[0];
            await this.handleTopicSelection(confirmation, selectedTopic);

        } catch (error) {
            // タイムアウト時にセレクトメニューを無効化
            await interaction.editReply({
                embeds: [embed],
                components: []
            }).catch(() => {}); // エラーを無視
        }
    },

    // 🆕 セレクトメニューの選択処理
    async handleTopicSelection(interaction, topic) {
        try {
            await interaction.deferUpdate();
            
            const topicData = this.getTopicData(topic);
            if (!topicData) {
                await interaction.editReply({
                    content: '指定されたトピックが見つかりません。',
                    components: []
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(topicData.title)
                .setColor(topicData.color)
                .addFields(topicData.fields)
                .setFooter({ text: '他のトピックを見るには /help を実行してください' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: []
            });

        } catch (error) {
            console.error('トピック選択処理エラー:', error);
        }
    },

    async showTopicHelp(interaction, topic) {
        const topicData = this.getTopicData(topic);
        if (!topicData) {
            await interaction.reply({
                content: '指定されたトピックが見つかりません。',
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(topicData.title)
            .setColor(topicData.color)
            .addFields(topicData.fields)
            .setFooter({ text: '他のトピックを見るには /help を実行してください' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    // 🆕 トピックデータを取得するメソッド
    getTopicData(topic) {
        const helpTopics = {
            basic: {
                title: '🏞️ 基本的な遊び方',
                color: 0x228B22,
                fields: [
                    {
                        name: '1️⃣ 鳥類園を見る',
                        value: '`/zoo view` - 現在の鳥たちの様子\n`/zoo area area:森林` - エリア別詳細',
                        inline: false
                    },
                    {
                        name: '2️⃣ 餌やりの基本',
                        value: '`/feed bird:スズメ food:麦`\n• 好物をあげると鳥が喜びます\n• 同じ鳥への餌やりは前回から10分後に可能',
                        inline: false
                    },
                    {
                        name: '3️⃣ 新しい鳥を呼ぶ',
                        value: '`/gacha count:3` - ガチャで召喚\n`/search` - 条件指定で探す',
                        inline: false
                    }
                ]
            },
            feeding: {
                title: '🍽️ 餌やりシステム',
                color: 0xFF8C00,
                fields: [
                    {
                        name: '🍽️ 餌の種類',
                        value: '🌾麦 🐛虫 🐟魚 🍯花蜜\n🥜木の実 🌿青菜 🐁ねずみ',
                        inline: false
                    },
                    {
                        name: '🎯 効果の違い',
                        value: '**大好物**: 大喜び + 滞在延長(3-6h)\n**食べられる**: 満足 + 延長可能性(1h)\n**苦手**: 微妙な反応のみ',
                        inline: false
                    },
                    {
                        name: '⏰ 制限事項',
                        value: '• 餌やり時間: 7:00〜22:00\n• クールダウン: 10分\n• 好物なら鳥が喜びます！',
                        inline: false
                    }
                ]
            },
            affinity: {
                title: '💖 好感度システム',
                color: 0xFF69B4,
                fields: [
                    {
                        name: '📈 レベル1〜10',
                        value: '餌やり回数でレベルアップ\n好物なら1.5倍ボーナス！\n高レベルほど必要回数増加',
                        inline: false
                    },
                    {
                        name: '🎁 レベル5の特典',
                        value: '• 贈り物機能解放\n• 鳥からの贈り物がもらえるかも\n• あなたも贈り物を渡せるように',
                        inline: false
                    },
                    {
                        name: '🌟 高レベル特典',
                        value: 'Lv5: 30% → Lv10: 75%\n贈り物確率が段階的にアップ\nレベル8+で特別なレアアイテム',
                        inline: false
                    }
                ]
            },
            gifts: {
                title: '🎁 贈り物システム',
                color: 0x9370DB,
                fields: [
                    {
                        name: '👤 人間 → 鳥',
                        value: '• 好感度Lv5で解放\n• 鳥類園を散策していて思いついたとっておきの贈り物\n• 1羽につき最大5個まで渡せます\n• 鳥に渡すと様々な反応が',
                        inline: false
                    },
                    {
                        name: '🐦 鳥 → 人間',
                        value: '• Lv5+で確率的に発生\n• 鳥たちが鳥類園で見つけた宝物\n• レベルが高いほど高確率\n• Lv8+で特別な贈り物がもらえるかも',
                        inline: false
                    },
                    {
                        name: '🏆 アイテム例',
                        value: '**森林**: どんぐり、羽根、？？？\n**草原**: 花の種、？？？\n**水辺**: 貝殻、流木、？？？',
                        inline: false
                    }
                ]
            },
            gacha: {
                title: '🎲 ガチャシステム',
                color: 0x00CED1,
                fields: [
                    {
                        name: '🎯 基本仕様',
                        value: '• 1〜10羽まで一度に召喚\n• 回数制限なし\n• 完全ランダムで鳥さんたち登場\n• 滞在期間: 2〜5日',
                        inline: false
                    },
                    {
                        name: '🔄 召喚プロセス',
                        value: '1. `/gacha count:3` で候補3羽出現\n2. 候補から1羽を選択\n3. 選んだ鳥が見学開始',
                        inline: false
                    },
                    {
                        name: '💡 活用のコツ',
                        value: '• 多めに召喚して好みの鳥を選択\n• エリアバランスを考慮\n• 好物システムを活用',
                        inline: false
                    }
                ]
            },
            collection: {
                title: '📚 コレクション機能',
                color: 0x4169E1,
                fields: [
                    {
                        name: '📋 4つの要素',
                        value: '`/collection gifts` - 鳥からの贈り物\n`/collection given` - 鳥への贈り物\n`/collection memories` - 特別な思い出\n`/collection all` - 総合表示',
                        inline: false
                    },
                    {
                        name: '💭 思い出システム',
                        value: '• 天気や時間を考慮\n• 特別な瞬間を自動記録\n• 人間視点です（こだわりポイント）',
                        inline: false
                    },
                    {
                        name: '🏆 コレクションの楽しみ',
                        value: '• 贈り物の種類コンプリート\n• 全エリアの鳥との思い出\n• 特別な贈り物の収集',
                        inline: false
                    }
                ]
            },
            commands: {
                title: '📋 コマンド一覧',
                color: 0x2F4F4F,
                fields: [
                    {
                        name: '🏞️ 鳥類園管理',
                        value: '`/zoo view` - 全体表示\n`/zoo area` - エリア詳細\n`/gacha` - 鳥召喚',
                        inline: true
                    },
                    {
                        name: '🍽️ 鳥との交流',
                        value: '`/feed` - 餌やり\n`/gift` - 贈り物\n`/inventory` - 所持品確認',
                        inline: true
                    },
                    {
                        name: '📊 情報・統計',
                        value: '`/collection` - コレクション\n`/achievements` - 称号\n`/weather` - 天気',
                        inline: true
                    },
                    {
                        name: '🔍 検索・発見',
                        value: '`/search` - 鳥検索\n`/today` - 今日の鳥\n`/theme` - テーマ召喚',
                        inline: true
                    }
                ]
            }
        };

        return helpTopics[topic] || null;
    }
};
