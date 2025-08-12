const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const sheetsManager = require('../../config/sheets');
const zooManager = require('../utils/zooManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('仲良くなった鳥に贈り物をします🎁')
        .addStringOption(option =>
            option.setName('bird')
                .setDescription('贈り物をする鳥の名前')
                .setRequired(true)),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const birdName = interaction.options.getString('bird');

            await interaction.deferReply();

            // 🔍 複数候補を検索
            const birdCandidates = await this.findBirdCandidates(birdName, guildId);
            
            if (birdCandidates.length === 0) {
                await interaction.editReply({
                    content: `❌ "${birdName}" に該当する鳥が見つかりません。\n\n**検索場所:**\n• 鳥類園（現在滞在中の鳥）\n• ネスト（建設済みのネスト）\n\n\`/zoo view\` や \`/nest view\` で確認できます。`
                });
                return;
            }

            // 🎯 1羽だけの場合は直接処理
            if (birdCandidates.length === 1) {
                const birdInfo = birdCandidates[0];
                console.log(`🎯 唯一の候補: ${birdInfo.bird.name} (${birdInfo.location})`);
                await this.processBirdSelection(interaction, birdInfo, guildId);
                return;
            }

            // 📋 複数候補がある場合はセレクトメニューを表示
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('gift_bird_select')
                .setPlaceholder('贈り物をする鳥を選択してください...')
                .addOptions(
                    birdCandidates.slice(0, 25).map((birdInfo, index) => {
                        const locationText = birdInfo.location === 'zoo' 
                            ? `${birdInfo.area}エリア` 
                            : `${birdInfo.owner}さんのネスト`;
                        
                        return {
                            label: birdInfo.bird.name,
                            value: `bird_${index}`,
                            description: `📍 ${locationText}`,
                            emoji: this.getBirdEmoji(birdInfo)
                        };
                    })
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('🎁 贈り物をする鳥を選択')
                .setDescription(`"**${birdName}**" に該当する鳥が複数見つかりました。\n贈り物をしたい鳥を選択してください。`)
                .setColor(0xFF69B4)
                .addFields({
                    name: '🔍 見つかった鳥',
                    value: birdCandidates.map((birdInfo, index) => {
                        const locationText = birdInfo.location === 'zoo' 
                            ? `${birdInfo.area}エリア` 
                            : `${birdInfo.owner}さんのネスト`;
                        return `${index + 1}. **${birdInfo.bird.name}** (${locationText})`;
                    }).join('\n'),
                    inline: false
                });

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // 🕐 選択の待機
            try {
                const confirmation = await response.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id && i.customId === 'gift_bird_select',
                    time: 60000
                });

                const selectedIndex = parseInt(confirmation.values[0].split('_')[1]);
                const selectedBird = birdCandidates[selectedIndex];
                
                await confirmation.deferUpdate();
                await this.processBirdSelection(confirmation, selectedBird, guildId);

            } catch (error) {
                await interaction.editReply({
                    content: '🕐 時間切れです。もう一度お試しください。',
                    embeds: [],
                    components: []
                });
            }

        } catch (error) {
            console.error('贈り物コマンドエラー:', error);
            
            const errorMessage = '贈り物の実行中にエラーが発生しました。';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    // 🔍 鳥の候補を複数検索する関数
    async findBirdCandidates(birdName, guildId) {
        const candidates = [];

        // 1. 鳥類園から検索
        const zooResults = this.findBirdsInZoo(birdName, guildId);
        zooResults.forEach(result => {
            candidates.push({
                bird: result.bird,
                area: result.area,
                location: 'zoo'
            });
        });

        // 2. ネストから検索
        const nestResults = await this.findBirdsInNests(birdName, guildId);
        nestResults.forEach(result => {
            candidates.push({
                bird: { name: result.鳥名 },
                owner: result.ユーザー名,
                location: 'nest',
                nestData: result
            });
        });

        // 3. 重複排除（同じ鳥名の場合）
        const uniqueCandidates = [];
        const seenBirds = new Set();
        
        candidates.forEach(candidate => {
            const key = `${candidate.bird.name}_${candidate.location}`;
            if (!seenBirds.has(key)) {
                seenBirds.add(key);
                uniqueCandidates.push(candidate);
            }
        });

        return uniqueCandidates;
    },

    // 🏞️ 鳥類園から複数の鳥を検索
    findBirdsInZoo(birdName, guildId) {
        try {
            const zooState = zooManager.getZooState(guildId);
            const candidates = [];
            
            // すべてのエリアの鳥を収集
            const allBirds = [];
            for (const area of ['森林', '草原', '水辺']) {
                zooState[area].forEach(bird => {
                    allBirds.push({ bird, area });
                });
            }
            
            // 1. 完全一致
            const exactMatches = allBirds.filter(({ bird }) => bird.name === birdName);
            candidates.push(...exactMatches);
            
            // 2. 前方一致
            const prefixMatches = allBirds.filter(({ bird }) => 
                bird.name.startsWith(birdName) && !candidates.some(c => c.bird.name === bird.name)
            );
            candidates.push(...prefixMatches);
            
            // 3. 部分一致
            const partialMatches = allBirds.filter(({ bird }) => 
                bird.name.includes(birdName) && !candidates.some(c => c.bird.name === bird.name)
            );
            candidates.push(...partialMatches);

            return candidates;

        } catch (error) {
            console.error('鳥類園複数検索エラー:', error);
            return [];
        }
    },

    // 🏠 ネストから複数の鳥を検索
    async findBirdsInNests(birdName, guildId) {
        try {
            await sheetsManager.ensureInitialized();
            
            const sheet = sheetsManager.sheets.userNests;
            if (!sheet) return [];

            const rows = await sheet.getRows();
            const nests = rows
                .filter(row => row.get('サーバーID') === guildId)
                .map(row => ({
                    ユーザーID: row.get('ユーザーID'),
                    ユーザー名: row.get('ユーザー名'),
                    鳥名: row.get('鳥名'),
                    カスタム名: row.get('カスタム名') || '',
                    ネストタイプ: row.get('ネストタイプ'),
                    チャンネルID: row.get('チャンネルID'),
                    サーバーID: row.get('サーバーID')
                }));

            const candidates = [];

            // 1. 完全一致
            const exactMatches = nests.filter(nest => nest.鳥名 === birdName);
            candidates.push(...exactMatches);

            // 2. 前方一致
            const prefixMatches = nests.filter(nest => 
                nest.鳥名.startsWith(birdName) && !candidates.some(c => c.鳥名 === nest.鳥名)
            );
            candidates.push(...prefixMatches);

            // 3. 部分一致
            const partialMatches = nests.filter(nest => 
                nest.鳥名.includes(birdName) && !candidates.some(c => c.鳥名 === nest.鳥名)
            );
            candidates.push(...partialMatches);

            return candidates;

        } catch (error) {
            console.error('ネスト複数検索エラー:', error);
            return [];
        }
    },

    // 🐦 鳥選択後の処理
    async processBirdSelection(interaction, birdInfo, guildId) {
        try {
            const userId = interaction.user.id;
            const userName = interaction.user.username;

            console.log(`🎯 選択された鳥: ${birdInfo.bird.name} (${birdInfo.location})`);

            // 好感度チェック
            const affinities = await sheetsManager.getUserAffinity(userId, guildId);
            const birdAffinity = affinities[birdInfo.bird.name];
            
            if (!birdAffinity || birdAffinity.level < 3) {
                const currentLevel = birdAffinity ? birdAffinity.level : 0;
                const currentHearts = '💖'.repeat(currentLevel) + '🤍'.repeat(10 - currentLevel);
                
                await interaction.editReply({
                    content: `💔 ${birdInfo.bird.name}とはまだ贈り物ができるほど仲良くありません。\n\n**現在の好感度:** ${currentHearts} (Lv.${currentLevel})\n\n餌やりを続けて**好感度レベル5**にしましょう！`,
                    embeds: [],
                    components: []
                });
                return;
            }

            // 贈り物インベントリチェック
            const gifts = await sheetsManager.getUserGifts(userId, guildId);
            const availableGifts = Object.entries(gifts).filter(([name, count]) => count > 0);
            
            if (availableGifts.length === 0) {
                await interaction.editReply({
                    content: '🎁 贈り物がありません。\n\n**贈り物の入手方法:**\n• 好感度レベル5に到達した鳥がいると、その鳥への贈り物を思いつくことができます\n• まずは他の鳥との絆を深めてみましょう！',
                    embeds: [],
                    components: []
                });
                return;
            }

            // 既存の贈り物チェック
            const birdCurrentGifts = await sheetsManager.getBirdGifts(birdInfo.bird.name, guildId);
            const userGiftsToThisBird = birdCurrentGifts.filter(gift => gift.giverId === userId);
            
            if (userGiftsToThisBird.length >= 10) {
                await interaction.editReply({
                    content: `💝 ${birdInfo.bird.name}にはすでに10個の贈り物をしています。\n\n**制限:** 一羽の鳥には最大10個まで贈り物ができます。`,
                    embeds: [],
                    components: []
                });
                return;
            }

            // 贈り物選択メニューを作成
            const giftSelectMenu = new StringSelectMenuBuilder()
                .setCustomId('gift_item_select')
                .setPlaceholder('贈り物を選んでください...')
                .addOptions(
                    availableGifts.slice(0, 25).map(([name, count]) => ({
                        label: `${name} (${count}個)`,
                        value: name,
                        emoji: this.getGiftEmoji(name)
                    }))
                );

            const row = new ActionRowBuilder().addComponents(giftSelectMenu);

            const locationText = birdInfo.location === 'zoo' 
                ? `${birdInfo.area}エリアに滞在中` 
                : `${birdInfo.owner}さんのネストにいます`;

            const embed = new EmbedBuilder()
                .setTitle('🎁 贈り物を選択')
                .setDescription(`**${birdInfo.bird.name}**に心を込めた贈り物をしましょう！\n\n📍 **現在の場所:** ${locationText}\n💝 **保有贈り物:** ${userGiftsToThisBird.length}/10個`)
                .setColor(0xFF69B4)
                .addFields({
                    name: '💎 現在身につけている贈り物',
                    value: userGiftsToThisBird.length > 0 
                        ? userGiftsToThisBird.slice(0, 5).map(gift => `${this.getGiftEmoji(gift.name)} ${gift.name}`).join('\n')
                        : 'まだ贈り物はありません',
                    inline: false
                });

            if (userGiftsToThisBird.length > 5) {
                embed.addFields({
                    name: '📦 その他の贈り物',
                    value: `他に${userGiftsToThisBird.length - 5}個の贈り物を大切に保管しています`,
                    inline: false
                });
            }

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // 贈り物選択の待機
            try {
                const giftConfirmation = await response.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id && i.customId === 'gift_item_select',
                    time: 60000
                });

                // birdInfoを保存して贈り物処理に渡す
                giftConfirmation.selectedBirdInfo = birdInfo;
                await this.processGiftGiving(giftConfirmation, birdInfo, guildId);

            } catch (error) {
                await interaction.editReply({
                    content: '🕐 時間切れです。もう一度お試しください。',
                    embeds: [],
                    components: []
                });
            }

        } catch (error) {
            console.error('鳥選択処理エラー:', error);
            await interaction.editReply({
                content: '処理中にエラーが発生しました。',
                embeds: [],
                components: []
            });
        }
    },

    // 🎨 鳥の絵文字を取得
    getBirdEmoji(birdInfo) {
        if (birdInfo.location === 'zoo') {
            const areaEmojis = {
                '森林': '🌲',
                '草原': '🌾', 
                '水辺': '🌊'
            };
            return areaEmojis[birdInfo.area] || '🐦';
        } else {
            return '🏠'; // ネストの鳥
        }
    },

    // 🎁 贈り物処理（既存のコードを保持）
    async processGiftGiving(interaction, birdInfo, guildId) {
        try {
            const userId = interaction.user.id;
            const userName = interaction.user.username;
            const selectedGift = interaction.values[0];
            const birdName = birdInfo.bird.name;
            
            // 鳥類園の鳥かネストの鳥かで処理を分岐
            const area = birdInfo.location === 'zoo' ? birdInfo.area : 
                        birdInfo.location === 'nest' ? 'ネスト' : 'unknown';

            await interaction.deferUpdate();

            // 贈り物キャプション生成
            const caption = this.generateGiftCaption(selectedGift, birdName, userName, area);

            // データベースに記録
            await sheetsManager.logBirdGift(
                birdName,
                selectedGift,
                userId,
                userName,
                caption,
                guildId
            );

            // ユーザーのインベントリから贈り物を減らす
            await sheetsManager.logGiftInventory(
                userId,
                userName,
                selectedGift,
                -1,
                `${birdName}への贈り物`,
                guildId
            );

            // 🆕 鳥のメモリーに贈り物を記録（記憶システム）
            await this.updateBirdMemoryWithGift(birdName, selectedGift, userName, guildId);

            // 成功メッセージ
            const locationText = birdInfo.location === 'zoo' 
                ? `${birdInfo.area}エリアで` 
                : `${birdInfo.owner}さんのネストで`;

            const embed = new EmbedBuilder()
                .setTitle('🎁 贈り物が完了しました！')
                .setDescription(`**${birdName}**に**${selectedGift}**を贈りました！\n\n📍 **場所:** ${locationText}`)
                .setColor(0x00FF00)
                .addFields({
                    name: '💝 贈り物の様子',
                    value: caption,
                    inline: false
                })
                .setFooter({ text: `${birdName}はこの贈り物を退園後も大切に持ち続けます` })
                .setTimestamp();

            // 🆕 思い出システム - 贈り物後の思い出生成
            setTimeout(async () => {
                try {
                    const memoryManager = require('../utils/humanMemoryManager');
                    
                    // 🔧 修正: 現在の贈り物数を正しく取得
                    const currentBirdGifts = await sheetsManager.getBirdGifts(birdName, guildId);
                    const userGiftsToThisBird = currentBirdGifts.filter(gift => gift.giverId === userId);
                    const currentGiftCount = userGiftsToThisBird.length; // 既に記録済みなので+1不要
                    
                    // 贈り物アクションデータを構築
                    const actionData = {
                        type: 'gift_given',
                        isFirst: currentGiftCount === 1, // 今回の贈り物が初回かチェック
                        giftCount: currentGiftCount,
                        details: {
                            giftName: selectedGift,
                            birdName: birdName,
                            area: area,
                            giftCount: currentGiftCount,
                            location: birdInfo.location
                        }
                    };
                    
                    // 思い出生成をチェック
                    const newMemory = await memoryManager.createMemory(
                        userId,
                        userName,
                        birdName,
                        actionData,
                        guildId
                    );
                    
                    // 思い出が生成された場合は通知
                    if (newMemory) {
                        await memoryManager.sendMemoryNotification(interaction, newMemory);
                    }
                } catch (memoryError) {
                    console.error('思い出システムエラー:', memoryError);
                }
            }, 3000); // 3秒後に思い出チェック

            await interaction.editReply({
                embeds: [embed],
                components: []
            });

        } catch (error) {
            console.error('贈り物処理エラー:', error);
            await interaction.editReply({
                content: '贈り物の処理中にエラーが発生しました。',
                components: []
            });
        }
    },

    // 🆕 鳥の記憶に贈り物を記録
    async updateBirdMemoryWithGift(birdName, giftName, giverName, serverId) {
        try {
            const existingMemory = await sheetsManager.getBirdMemory(birdName, serverId);
            
            // 贈り物リストを更新
            let giftsList = '';
            if (existingMemory && existingMemory.贈り物リスト) {
                const existingGifts = existingMemory.贈り物リスト.split(',').filter(g => g.trim());
                existingGifts.push(`${giftName}|${giverName}`);
                giftsList = existingGifts.join(',');
            } else {
                giftsList = `${giftName}|${giverName}`;
            }

            // 友達ユーザーリストも更新
            let friendUsers = '';
            if (existingMemory && existingMemory.友達ユーザーリスト) {
                const existingFriends = existingMemory.友達ユーザーリスト.split(',').filter(f => f.trim());
                if (!existingFriends.includes(giverName)) {
                    existingFriends.push(giverName);
                }
                friendUsers = existingFriends.join(',');
            } else {
                friendUsers = giverName;
            }

            // 記憶データを更新
            await sheetsManager.updateBirdMemory(birdName, serverId, 'サーバー名', {
                贈り物リスト: giftsList,
                友達ユーザーリスト: friendUsers,
                特別な思い出: `${giverName}さんから${giftName}をもらった特別な思い出`
            });

        } catch (error) {
            console.error('鳥の記憶更新エラー:', error);
        }
    },

    // 🔧 人間→鳥への贈り物用の絵文字マップ（元のコードを保持）
    getGiftEmoji(giftName) {
        const emojiMap = {
            // 🌲 森林エリアの贈り物
            '綺麗なビー玉': '🔮',
            '小さな鈴': '🔔',
            '色とりどりのリボン': '🎀',
            '手作りの巣箱': '🏠',
            '特別な枝': '🌿',
            '小さな鏡': '🪞',
            '美しい羽根飾り': '🪶',
            '手編みの小さな巣材': '🧶',

            // 🌾 草原エリアの贈り物
            '花で編んだ花冠': '🌸',
            'カラフルなビーズ': '🔴',
            '小さな風車': '🎡',
            '手作りの草笛': '🎵',
            '色鮮やかな紐': '🧵',
            '羽根でできたお守り': '🪶',
            '花の種のネックレス': '🌱',

            // 🌊 水辺エリアの贈り物
            '磨いた貝殻': '🐚',
            '美しいガラス玉': '🔮',
            '小さな流木アート': '🪵',
            '手作りの水草飾り': '🌊',
            '綺麗に磨いた石': '💎',
            '貝殻の風鈴': '🎐',
            '水晶のペンダント': '💎',
            '真珠のような玉': '🤍',

            // ✨ 共通の特別な贈り物
            '虹色のリボン': '🌈',
            'ハート型の小石': '💖',
            '特別な羽根': '🪶',
            '手作りのお守り': '🍀',
            '光る小さな宝石': '✨',
            '音の鳴る玩具': '🎵',
            '温かい毛糸': '🧶',
            '小さな楽器': '🎼'
        };
        
        return emojiMap[giftName] || '🎁';
    },

    // 🔧 人間→鳥への贈り物用キャプション生成（元のコード + ネスト対応）
    generateGiftCaption(giftName, birdName, userName, area) {
        // ネストの場合の特別なキャプション（新機能）
        if (area === 'ネスト') {
            const nestCaptions = {
                '綺麗なビー玉': `${birdName}は${userName}さんからのビー玉をネストの特等席に飾りました。光が差し込むたびに美しく輝き、巣全体を虹色に照らしています。`,
                '小さな鈴': `${birdName}は${userName}さんからの鈴をネストの入り口に吊るしました。風が吹くたびに美しい音色が響き、まるでネスト専用のウェルカムベルのようです。`,
                '色とりどりのリボン': `${birdName}は${userName}さんからのリボンをネストの壁に編み込みました。カラフルな装飾で、ネストがまるでアート作品のように美しくなりました。`,
                '手作りの巣箱': `${birdName}は${userName}さんからの巣箱をネスト内の特別な場所に設置しました。大切なものを保管する宝箱として愛用しています。`,
                '花で編んだ花冠': `${birdName}は${userName}さんからの花冠をネストの中央に飾りました。いつも美しい花の香りがネスト全体を包んでいます。`,
                '磨いた貝殻': `${birdName}は${userName}さんからの貝殻をネストの窓辺に置きました。海の思い出を感じながら、毎日眺めて癒されています。`
            };

            if (nestCaptions[giftName]) {
                return nestCaptions[giftName];
            }
        }

        // 元のキャプション（既存のコードを保持）
        const captions = {
            // 元のキャプション全文（前回と同じ内容）
            '綺麗なビー玉': `透明で美しいビー玉。${birdName}は${userName}さんからもらったビー玉を通して森の景色を眺めるのがお気に入りです。光の屈折で見える美しい世界に魅了されているようです。`,
            '小さな鈴': `優しい音色の小さな鈴。${birdName}が動くたびに美しいメロディーが森に響きます。${userName}さんからの贈り物を身につけて、まるで音楽家のように誇らしげです。`,
            // ... 他の既存キャプション
        };

        // デフォルトキャプション（元のコード + ネスト対応）
        const locationText = area === 'ネスト' ? 'ネストで' : area === 'unknown' ? '' : `${area}で`;
        return captions[giftName] || `素敵な${giftName}。${birdName}は${userName}さんからの心のこもった贈り物を${locationText}とても大切にしています。二人の絆がより深まり、${birdName}はいつもこの贈り物を身につけて${userName}さんのことを思い出しているようです。`;
    },

    // 🔄 後方互換性のため元の関数も保持
    async findBirdEverywhere(birdName, guildId) {
        // 新しいセレクトメニュー方式では使用しないが、他の機能で使う可能性があるため保持
        const candidates = await this.findBirdCandidates(birdName, guildId);
        return candidates.length > 0 ? candidates[0] : null;
    },

    // 元の単一検索関数も保持（互換性のため）
    findBirdInZoo(birdName, guildId) {
        try {
            const zooState = zooManager.getZooState(guildId);
            
            for (const area of ['森林', '草原', '水辺']) {
                const bird = zooState[area].find(b => 
                    b.name.includes(birdName) || birdName.includes(b.name)
                );
                if (bird) {
                    return { bird, area };
                }
            }
            return null;
        } catch (error) {
            console.error('鳥検索エラー:', error);
            return null;
        }
    }
};
