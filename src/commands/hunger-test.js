// hunger-test.js の修正版

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hunger-test')
        .setDescription('🧪 空腹システムのテスト用コマンド（管理者限定）')
        .addSubcommand(subcommand =>
            subcommand
                .setName('force')
                .setDescription('鳥を強制的に空腹にする（クールダウン無視）')
                .addStringOption(option =>
                    option.setName('bird')
                        .setDescription('空腹にする鳥の名前（指定しない場合は全ての鳥）')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset_cooldown')
                .setDescription('指定した鳥の餌やりクールダウンをリセット')
                .addStringOption(option =>
                    option.setName('bird')
                        .setDescription('クールダウンをリセットする鳥の名前')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('手動で空腹チェックを実行'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('全鳥の空腹状態を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('全鳥の空腹状態をリセット'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // 管理者チェック
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: '❌ このコマンドは管理者のみ使用できます。',
                ephemeral: true
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const birdName = interaction.options.getString('bird');
        const guildId = interaction.guild.id;

        try {
            switch (subcommand) {
                case 'force':
                    await this.forceHungry(interaction, birdName, guildId);
                    break;
                case 'reset_cooldown':
                    await this.resetCooldown(interaction, birdName, guildId);
                    break;
                case 'reset':
                    await this.resetHunger(interaction, birdName, guildId);
                    break;
                case 'check':
                    await this.checkHungerStatus(interaction, guildId);
                    break;
                case 'status':
                    await this.showAllBirdStatus(interaction, guildId);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ 不明なサブコマンドです。',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('テストコマンドエラー:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: `❌ テストの実行中にエラーが発生しました: ${error.message}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `❌ テストの実行中にエラーが発生しました: ${error.message}`,
                    ephemeral: true
                });
            }
        }
    },

    // 🆕 餌やりクールダウンをリセット
    async resetCooldown(interaction, birdName, guildId) {
        const zooManager = require('../utils/zooManager');
        
        // サーバー初期化
        await zooManager.initializeServer(guildId);
        
        const zooState = zooManager.getZooState(guildId);
        let birdFound = false;
        
        // 指定された鳥を検索してクールダウンをリセット
        for (const area of ['森林', '草原', '水辺']) {
            const bird = zooState[area].find(b => 
                b.name.includes(birdName) || birdName.includes(b.name)
            );
            
            if (bird) {
                // 🔧 修正: lastFedとlastFedByを完全にクリア
                bird.lastFed = null;
                bird.lastFedBy = null;
                
                console.log(`🧪 ${birdName}のクールダウンリセット:`, {
                    lastFed: bird.lastFed,
                    lastFedBy: bird.lastFedBy,
                    currentTime: new Date()
                });
                
                birdFound = true;
                break;
            }
        }
        
        if (!birdFound) {
            await interaction.reply({
                content: `❌ "${birdName}" はこの鳥類園にいません。`,
                ephemeral: true
            });
            return;
        }
        
        // データ保存
        await zooManager.saveServerZoo(guildId);
        
        await interaction.reply({
            content: `🧪 **${birdName}** の餌やりクールダウンをリセットしました。\n💡 すぐに餌やりができるようになりました！\n🔍 lastFed: ${bird.lastFed || 'null'}, lastFedBy: ${bird.lastFedBy || 'null'}`,
            ephemeral: true
        });
    },

    // 強制的に空腹にする（修正版）
    async forceHungry(interaction, birdName, guildId) {
        const zooManager = require('../utils/zooManager');
        
        // サーバー初期化
        await zooManager.initializeServer(guildId);
        
        const zooState = zooManager.getZooState(guildId);
        let count = 0;
        
        // 鳥を空腹状態にする
        for (const area of ['森林', '草原', '水辺']) {
            for (const bird of zooState[area]) {
                if (!birdName || bird.name.includes(birdName) || birdName.includes(bird.name)) {
                    // 空腹状態に設定
                    bird.isHungry = true;
                    bird.hungerNotified = false;
                    
                    // 🔧 修正: lastFedとlastFedByを完全にクリア（クールダウンを無効化）
                    bird.lastFed = null;
                    bird.lastFedBy = null;
                    
                    // 活動を空腹状態に変更
                    bird.activity = this.generateHungryActivity();
                    
                    count++;
                    
                    console.log(`🧪 ${bird.name}を強制空腹に設定:`, {
                        isHungry: bird.isHungry,
                        lastFed: bird.lastFed,
                        lastFedBy: bird.lastFedBy
                    });
                    
                    if (birdName) break; // 特定の鳥の場合は1羽だけ
                }
            }
            if (birdName && count > 0) break;
        }
        
        if (count === 0) {
            await interaction.reply({
                content: birdName ? 
                    `❌ "${birdName}" はこの鳥類園にいません。` : 
                    '❌ この鳥類園に鳥がいません。',
                ephemeral: true
            });
            return;
        }

        // データ保存
        await zooManager.saveServerZoo(guildId);

        await interaction.reply({
            content: birdName ? 
                `🧪 **${birdName}** を強制的に空腹状態にしました。\n💡 クールダウンもリセットされ、すぐに餌やりができます！` :
                `🧪 この鳥類園の全ての鳥（${count}羽）を強制的に空腹状態にしました。\n💡 全ての鳥のクールダウンもリセットされました！`,
            ephemeral: true
        });
    },

    // 手動空腹チェック
    async checkHungerStatus(interaction, guildId) {
        const zooManager = require('../utils/zooManager');
        
        await interaction.deferReply({ ephemeral: true });
        
        // サーバー初期化
        await zooManager.initializeServer(guildId);
        
        const zooState = zooManager.getZooState(guildId);
        let totalBirds = 0;
        let hungryBirds = 0;
        
        // 手動で空腹チェック
        for (const area of ['森林', '草原', '水辺']) {
            for (const bird of zooState[area]) {
                totalBirds++;
                
                // 空腹チェック（12時間以上餌やりされていない場合）
                if (bird.lastFed) {
                    const hoursSinceLastFeed = (Date.now() - bird.lastFed.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceLastFeed >= 12 && !bird.isHungry) {
                        bird.isHungry = true;
                        bird.activity = this.generateHungryActivity();
                    }
                }
                
                if (bird.isHungry) {
                    hungryBirds++;
                }
            }
        }
        
        // データ保存
        await zooManager.saveServerZoo(guildId);
        
        const embed = new EmbedBuilder()
            .setTitle('🧪 手動空腹チェック実行結果')
            .setDescription('この鳥類園の空腹チェックを手動実行しました')
            .addFields(
                { name: '🐦 総鳥数', value: totalBirds.toString(), inline: true },
                { name: '🍽️ 空腹の鳥', value: hungryBirds.toString(), inline: true },
                { name: '😊 満足の鳥', value: (totalBirds - hungryBirds).toString(), inline: true }
            )
            .setColor(hungryBirds > 0 ? 0xFFA500 : 0x00FF00)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    // 全鳥の状態表示（修正版）
    async showAllBirdStatus(interaction, guildId) {
        const zooManager = require('../utils/zooManager');
        
        // サーバー初期化
        await zooManager.initializeServer(guildId);
        
        const zooState = zooManager.getZooState(guildId);
        const stats = this.calculateStats(zooState);

        const embed = new EmbedBuilder()
            .setTitle('🧪 この鳥類園の全鳥状態')
            .setDescription(`現在の状況（${stats.totalBirds}羽中${stats.hungryBirds}羽が空腹）`)
            .setColor(stats.hungryBirds > 0 ? 0xFFA500 : 0x00FF00)
            .setTimestamp();

        // エリア別に表示
        for (const area of ['森林', '草原', '水辺']) {
            const areaBirds = zooState[area];
            
            if (areaBirds.length === 0) {
                embed.addFields({
                    name: `${this.getAreaEmoji(area)} ${area}エリア`,
                    value: '(鳥がいません)',
                    inline: false
                });
                continue;
            }

            const birdList = areaBirds.map(bird => {
                const hungryIcon = bird.isHungry ? '🍽️' : '😊';
                const hoursSinceLastFeed = bird.lastFed ? 
                    Math.floor((Date.now() - bird.lastFed.getTime()) / (1000 * 60 * 60)) : '不明';
                const cooldownStatus = this.getCooldownStatus(bird);
                
                return `${hungryIcon} **${bird.name}**\n└ 最後の餌: ${hoursSinceLastFeed}時間前\n└ 状態: ${bird.isHungry ? '空腹' : '満足'}\n└ クールダウン: ${cooldownStatus}\n└ 様子: ${bird.activity || '普通に過ごしています'}`;
            }).join('\n\n');

            embed.addFields({
                name: `${this.getAreaEmoji(area)} ${area}エリア (${areaBirds.length}羽)`,
                value: birdList,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    // 空腹状態リセット（修正版）
    async resetHunger(interaction, birdName, guildId) {
        const zooManager = require('../utils/zooManager');
        
        // サーバー初期化
        await zooManager.initializeServer(guildId);
        
        const zooState = zooManager.getZooState(guildId);
        const now = new Date();
        let count = 0;
        
        for (const area of ['森林', '草原', '水辺']) {
            for (const bird of zooState[area]) {
                if (!birdName || bird.name.includes(birdName) || birdName.includes(bird.name)) {
                    if (bird.isHungry) {
                        bird.isHungry = false;
                        bird.hungerNotified = false;
                        bird.lastFed = now;
                        bird.activity = this.generateSatisfiedActivity();
                        count++;
                    }
                    
                    if (birdName) break;
                }
            }
            if (birdName && count > 0) break;
        }

        // データ保存
        await zooManager.saveServerZoo(guildId);

        await interaction.reply({
            content: birdName ? 
                `🧪 **${birdName}** の空腹状態をリセットしました。` :
                `🧪 この鳥類園の${count}羽の鳥の空腹状態をリセットしました。`,
            ephemeral: true
        });
    },

    // ヘルパー関数
    calculateStats(zooState) {
        let totalBirds = 0;
        let hungryBirds = 0;
        
        for (const area of ['森林', '草原', '水辺']) {
            for (const bird of zooState[area]) {
                totalBirds++;
                if (bird.isHungry) {
                    hungryBirds++;
                }
            }
        }
        
        return { totalBirds, hungryBirds };
    },

    getCooldownStatus(bird) {
        // 🔧 修正: lastFedがnullの場合はクールダウンなし
        if (!bird.lastFed || !bird.lastFedBy) {
            return '✅ なし';
        }
        
        const timeDiff = Date.now() - bird.lastFed.getTime();
        const minutesPassed = Math.floor(timeDiff / (1000 * 60));
        
        if (minutesPassed < 10) {
            return `⏰ ${10 - minutesPassed}分残り`;
        } else {
            return '✅ なし';
        }
    },

    generateHungryActivity() {
        const activities = [
            'お腹を空かせています',
            'キョロキョロと餌を探しています',
            '空腹でじっとしています',
            '餌を求めて鳴いています',
            'お腹がグーグー鳴っています'
        ];
        return activities[Math.floor(Math.random() * activities.length)];
    },

    generateSatisfiedActivity() {
        const activities = [
            '満足そうに過ごしています',
            'おなかいっぱいで休んでいます',
            '幸せそうに羽繕いしています',
            '穏やかに過ごしています',
            'ご機嫌でさえずっています'
        ];
        return activities[Math.floor(Math.random() * activities.length)];
    },

    getAreaEmoji(area) {
        const emojis = {
            '森林': '🌲',
            '草原': '🌾',
            '水辺': '🌊'
        };
        return emojis[area] || '📍';
    }
};
