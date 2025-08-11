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

            // 🔍 厳格な鳥名検索（鳥類園 + ネスト）
            const birdInfo = await this.findBirdEverywhere(birdName, guildId);
            
            if (!birdInfo) {
                await interaction.editReply({
                    content: `❌ "${birdName}" が見つかりません。\n\n**検索場所:**\n• 鳥類園（現在滞在中の鳥）\n• ネスト（建設済みのネスト）\n\n**利用可能な検索方法:**\n• 完全な鳥名で検索\n• 鳥名の一部で検索\n\n\`/zoo view\` や \`/nest view\` で確認できます。`
                });
                return;
            }

            console.log(`🎯 鳥発見: ${birdInfo.bird.name} (${birdInfo.location}: ${birdInfo.area || birdInfo.owner})`);

            // 好感度チェック
            const affinities = await sheetsManager.getUserAffinity(userId, guildId);
            const birdAffinity = affinities[birdInfo.bird.name];
            
            if (!birdAffinity || birdAffinity.level < 5) {
                const currentLevel = birdAffinity ? birdAffinity.level : 0;
                const currentHearts = '💖'.repeat(currentLevel) + '🤍'.repeat(10 - currentLevel);
                
                await interaction.editReply({
                    content: `💔 ${birdInfo.bird.name}とはまだ贈り物ができるほど仲良くありません。\n\n**現在の好感度:** ${currentHearts} (Lv.${currentLevel})\n\n餌やりを続けて**好感度レベル5**にしましょう！`
                });
                return;
            }

            // ユーザーの贈り物インベントリを取得
            const gifts = await sheetsManager.getUserGifts(userId, guildId);
            const availableGifts = Object.entries(gifts).filter(([name, count]) => count > 0);
            
            if (availableGifts.length === 0) {
                await interaction.editReply({
                    content: '🎁 贈り物がありません。\n\n**贈り物の入手方法:**\n• 好感度レベル5に到達した鳥がいると、その鳥への贈り物を思いつくことができます\n• まずは他の鳥との絆を深めてみましょう！'
                });
                return;
            }

            // 鳥が既に持っている贈り物をチェック
            const birdCurrentGifts = await sheetsManager.getBirdGifts(birdInfo.bird.name, guildId);
            const userGiftsToThisBird = birdCurrentGifts.filter(gift => gift.giverId === userId);
            
            if (userGiftsToThisBird.length >= 10) {
                await interaction.editReply({
                    content: `💝 ${birdInfo.bird.name}にはすでに10個の贈り物をしています。\n\n**制限:** 一羽の鳥には最大10個まで贈り物ができます。`
                });
                return;
            }

            // 贈り物選択メニューを作成
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_gift')
                .setPlaceholder('贈り物を選んでください...')
                .addOptions(
                    availableGifts.slice(0, 25).map(([name, count]) => ({
                        label: `${name} (${count}個)`,
                        value: name,
                        emoji: this.getGiftEmoji(name)
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

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

            // 選択の待機
            try {
                const confirmation = await response.awaitMessageComponent({
                    filter: i => i.user.id === interaction.user.id,
                    time: 60000
                });

                await this.processGiftGiving(confirmation, birdInfo, guildId);

            } catch (error) {
                await interaction.editReply({
                    content: '🕐 時間切れです。もう一度お試しください。',
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

    // 🔍 鳥類園とネストの両方を検索する関数（新機能）
    async findBirdEverywhere(birdName, guildId) {
        // 1. まず鳥類園から検索
        const zooResult = this.findBirdInZoo(birdName, guildId);
        if (zooResult) {
            return {
                bird: zooResult.bird,
                area: zooResult.area,
                location: 'zoo'
            };
        }

        // 2. ネストから検索
        const nestResult = await this.findBirdInNests(birdName, guildId);
        if (nestResult) {
            return {
                bird: { name: nestResult.鳥名 },
                owner: nestResult.ユーザー名,
                location: 'nest',
                nestData: nestResult
            };
        }

        return null;
    },

    // 🏠 ネストから鳥を検索（新機能）
    async findBirdInNests(birdName, guildId) {
        try {
            await sheetsManager.ensureInitialized();
            
            const sheet = sheetsManager.sheets.userNests;
            if (!sheet) return null;

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

            // 検索パターンを優先順位順に実行
            
            // 1. 完全一致（最優先）
            let foundNest = nests.find(nest => nest.鳥名 === birdName);
            if (foundNest) {
                console.log(`🎯 ネストで完全一致: ${foundNest.鳥名}`);
                return foundNest;
            }

            // 2. 前方一致
            foundNest = nests.find(nest => 
                nest.鳥名.startsWith(birdName) || birdName.startsWith(nest.鳥名)
            );
            if (foundNest) {
                console.log(`🎯 ネストで前方一致: ${foundNest.鳥名}`);
                return foundNest;
            }

            // 3. 部分一致（長い名前優先）
            const sortedNests = nests.sort((a, b) => b.鳥名.length - a.鳥名.length);
            foundNest = sortedNests.find(nest => 
                nest.鳥名.includes(birdName) || birdName.includes(nest.鳥名)
            );
            if (foundNest) {
                console.log(`🎯 ネストで部分一致: ${foundNest.鳥名}`);
                return foundNest;
            }

            return null;

        } catch (error) {
            console.error('ネスト検索エラー:', error);
            return null;
        }
    },

    // 🔍 改良版鳥検索メソッド（優先順位付き）- 元のコードを改良
    findBirdInZoo(birdName, guildId) {
        try {
            const zooState = zooManager.getZooState(guildId);
            
            // すべてのエリアの鳥を収集
            const allBirds = [];
            for (const area of ['森林', '草原', '水辺']) {
                zooState[area].forEach(bird => {
                    allBirds.push({ bird, area });
                });
            }
            
            // 検索パターンを優先順位順に実行
            
            // 1. 完全一致（最優先）
            let foundBird = allBirds.find(({ bird }) => bird.name === birdName);
            if (foundBird) {
                console.log(`🎯 鳥類園で完全一致: ${foundBird.bird.name}`);
                return foundBird;
            }
            
            // 2. 前方一致
            foundBird = allBirds.find(({ bird }) => 
                bird.name.startsWith(birdName) || birdName.startsWith(bird.name)
            );
            if (foundBird) {
                console.log(`🎯 鳥類園で前方一致: ${foundBird.bird.name}`);
                return foundBird;
            }
            
            // 3. 部分一致（長い名前優先）
            const sortedBirds = allBirds.sort((a, b) => b.bird.name.length - a.bird.name.length);
            foundBird = sortedBirds.find(({ bird }) => 
                bird.name.includes(birdName) || birdName.includes(bird.name)
            );
            if (foundBird) {
                console.log(`🎯 鳥類園で部分一致: ${foundBird.bird.name}`);
                return foundBird;
            }
            
            return null;

        } catch (error) {
            console.error('鳥類園検索エラー:', error);
            return null;
        }
    },

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

    // 元の関数を保持（互換性のため）
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
            // 🌲 森林エリアの贈り物
            '綺麗なビー玉': `透明で美しいビー玉。${birdName}は${userName}さんからもらったビー玉を通して森の景色を眺めるのがお気に入りです。光の屈折で見える美しい世界に魅了されているようです。`,
            
            '小さな鈴': `優しい音色の小さな鈴。${birdName}が動くたびに美しいメロディーが森に響きます。${userName}さんからの贈り物を身につけて、まるで音楽家のように誇らしげです。`,
            
            '色とりどりのリボン': `カラフルで美しいリボン。${birdName}は${userName}さんからのリボンを巣に編み込んで、森で一番おしゃれな住まいを作りました。他の鳥たちも羨ましそうです。`,
            
            '手作りの巣箱': `愛情込めて作られた巣箱。${birdName}は${userName}さんが作ってくれた特別な住まいを大切にしています。雨の日も風の日も、安心して過ごせる温かな家です。`,
            
            '特別な枝': `手作業で磨かれた特別な枝。${birdName}は${userName}さんからの止まり木をお気に入りの場所に設置しました。毎日のお気に入りの休憩スポットになっています。`,
            
            '小さな鏡': `きらめく小さな鏡。${birdName}は${userName}さんからもらった鏡で自分の美しい姿を確認しています。身だしなみを整えるのが楽しくなったようです。`,
            
            '美しい羽根飾り': `芸術的な羽根飾り。${birdName}は${userName}さんが作ってくれた羽根飾りを身につけて、まるで貴族のように優雅に過ごしています。`,
            
            '手編みの小さな巣材': `温かい手編みの巣材。${birdName}は${userName}さんが編んでくれた巣材で、ふかふかで暖かい巣を作りました。愛情の温もりを感じているようです。`,

            // 🌾 草原エリアの贈り物
            '花で編んだ花冠': `美しい花冠。${birdName}は${userName}さんが編んでくれた花冠を誇らしげに身につけています。草原で一番美しい鳥として、堂々と歩き回っています。`,
            
            'カラフルなビーズ': `色とりどりのビーズ。${birdName}は${userName}さんからもらったビーズを巣の周りに飾って、虹色に輝く素敵な住まいを作りました。`,
            
            '小さな風車': `可愛らしい風車。${birdName}は${userName}さんからの風車が風で回る様子を見つめて、毎日新しい発見を楽しんでいます。科学者のような表情です。`,
            
            '手作りの草笛': `美しい音色の草笛。${birdName}は${userName}さんからもらった草笛で音楽を奏でています。草原に美しいメロディーが響き、まるでコンサートのようです。`,
            
            '色鮮やかな紐': `鮮やかな色の紐。${birdName}は${userName}さんからもらった紐を巣に編み込んで、アーティスティックな住まいを作りました。芸術家の才能があるようです。`,
            
            '羽根でできたお守り': `愛情のこもったお守り。${birdName}は${userName}さんが作ってくれたお守りを胸に抱いて、いつも幸せを感じているようです。守られている安心感があります。`,
            
            '花の種のネックレス': `可愛い種のネックレス。${birdName}は${userName}さんからもらったネックレスを身につけて、まるでファッションモデルのように美しく歩いています。`,

            // 🌊 水辺エリアの贈り物
            '磨いた貝殻': `丁寧に磨かれた美しい貝殻。${birdName}は${userName}さんからもらった貝殻を水面に映して、その美しさを何度も確認しています。宝物のように大切にしています。`,
            
            '美しいガラス玉': `透明で美しいガラス玉。${birdName}は${userName}さんからのガラス玉を通して水面を見つめ、光の屈折で生まれる幻想的な世界に魅了されています。`,
            
            '小さな流木アート': `芸術的な流木作品。${birdName}は${userName}さんが作ってくれた流木アートを止まり木として使用し、まるで美術館にいるような気分を味わっています。`,
            
            '手作りの水草飾り': `美しい水草飾り。${birdName}は${userName}さんが作ってくれた水草飾りを巣に飾って、水辺らしい涼しげで美しい住まいを作りました。`,
            
            '綺麗に磨いた石': `丁寧に磨かれた美しい石。${birdName}は${userName}さんからもらった石を水で洗いながら、その滑らかな手触りを楽しんでいます。瞑想のお供になっています。`,
            
            '貝殻の風鈴': `美しい音色の貝殻風鈴。${birdName}は${userName}さんからもらった風鈴の音色に癒されています。水辺に響く優雅なメロディーが心を落ち着かせているようです。`,
            
            '水晶のペンダント': `神秘的な水晶ペンダント。${birdName}は${userName}さんからもらった水晶を身につけて、まるで水の精霊のように美しく輝いています。`,
            
            '真珠のような玉': `真珠のように美しい玉。${birdName}は${userName}さんからの宝石を大切に抱いて、月夜に美しく輝く様子を楽しんでいます。夜が楽しみになりました。`,

            // ✨ 共通の特別な贈り物
            '虹色のリボン': `虹色に輝く特別なリボン。${birdName}は${userName}さんからもらった魔法のようなリボンを身につけて、太陽の光を浴びるたびに美しく輝いています。`,
            
            'ハート型の小石': `愛らしいハート型の石。${birdName}は${userName}さんの愛情を形にしたような石を胸に抱いて、いつも温かい気持ちでいます。愛を感じているようです。`,
            
            '特別な羽根': `神秘的で美しい羽根。${birdName}は${userName}さんからもらった特別な羽根を自分の羽と合わせて、より美しい姿になりました。自信に満ち溢れています。`,
            
            '手作りのお守り': `愛情込めて作られたお守り。${birdName}は${userName}さんが作ってくれたお守りをいつも身につけて、どんな困難も乗り越えられると感じているようです。`,
            
            '光る小さな宝石': `夜に光る神秘的な宝石。${birdName}は${userName}さんからもらった宝石の光に導かれて、暗い夜道も安心して歩けるようになりました。希望の光です。`,
            
            '音の鳴る玩具': `楽しい音が鳴る玩具。${birdName}は${userName}さんからもらった玩具で遊ぶのが大好きです。毎日新しい音を発見して、音楽家のように楽しんでいます。`,
            
            '温かい毛糸': `ふわふわで温かい毛糸。${birdName}は${userName}さんからもらった毛糸を巣に編み込んで、どんなに寒い夜でも暖かく過ごせる住まいを作りました。`,
            
            '小さな楽器': `美しい音色の小さな楽器。${birdName}は${userName}さんからもらった楽器で音楽を奏でています。まるで天使のように、美しいメロディーを響かせています。`
        };

        // デフォルトキャプション（元のコード + ネスト対応）
        const locationText = area === 'ネスト' ? 'ネストで' : area === 'unknown' ? '' : `${area}で`;
        return captions[giftName] || `素敵な${giftName}。${birdName}は${userName}さんからの心のこもった贈り物を${locationText}とても大切にしています。二人の絆がより深まり、${birdName}はいつもこの贈り物を身につけて${userName}さんのことを思い出しているようです。`;
    }
};
