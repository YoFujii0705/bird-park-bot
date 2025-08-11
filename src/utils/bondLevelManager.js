const sheetsManager = require('../../config/sheets');

class BondLevelManager {
    constructor() {
        // 企画書通りの段階的増加（15→20→25→30→35...）
        this.bondLevelRequirements = {};
        this.calculateBondLevelRequirements();
    }

    // 絆レベル必要回数を計算
    calculateBondLevelRequirements() {
        let totalRequired = 0;
        
        for (let level = 1; level <= 50; level++) { // 十分な上限を設定
            let requiredForThisLevel;
            
            if (level === 1) {
                requiredForThisLevel = 15;
            } else if (level === 2) {
                requiredForThisLevel = 20;
            } else if (level === 3) {
                requiredForThisLevel = 25;
            } else if (level === 4) {
                requiredForThisLevel = 30;
            } else {
                // レベル5以降は5回ずつ増加
                requiredForThisLevel = 30 + (level - 4) * 5;
            }
            
            totalRequired += requiredForThisLevel;
            this.bondLevelRequirements[level] = totalRequired;
        }
        
        console.log('🔗 絆レベル必要回数テーブル作成完了');
    }

    // 現在の絆レベルを取得
    async getCurrentBondLevel(userId, birdName, serverId) {
        try {
            const bondData = await sheetsManager.getUserBondLevel(userId, birdName, serverId);
            return bondData || { bondLevel: 0, bondFeedCount: 0 };
        } catch (error) {
            console.error('絆レベル取得エラー:', error);
            return { bondLevel: 0, bondFeedCount: 0 };
        }
    }

    // 🔧 feed.jsとの競合を避けるため、このメソッドは削除
    // processBondLevel は feed.js で直接実装されているため、
    // ここでは計算ロジックとユーティリティ機能のみ提供

    // 絆レベル特典をチェック
    async checkBondLevelRewards(userId, userName, birdName, bondLevel, serverId) {
        try {
            console.log(`🎁 絆レベル${bondLevel}特典チェック - ${birdName}`);
            
            // きりのいいレベルで「写真」確定入手
            if (bondLevel % 5 === 0 || bondLevel === 1 || bondLevel === 3 || bondLevel === 10) {
                const photoName = this.getBondLevelPhotoName(bondLevel);
                
                // gifts_inventoryに写真を追加
                await sheetsManager.logGiftInventory(
                    userId, userName, photoName, 1,
                    `${birdName}との絆レベル${bondLevel}達成特典`,
                    serverId
                );
                
                console.log(`📸 ${userName}が${photoName}を獲得しました`);
            }
            
        } catch (error) {
            console.error('絆レベル特典チェックエラー:', error);
        }
    }

    // 絆レベル別写真名を取得
    getBondLevelPhotoName(bondLevel) {
        const photoNames = {
            1: '初めての絆の写真',
            3: '信頼の写真',
            5: '深い絆の写真',
            10: '魂の繋がりの写真',
            15: '永遠の瞬間の写真',
            20: '奇跡の写真',
            25: '運命の写真',
            30: '無限の愛の写真'
        };
        
        return photoNames[bondLevel] || `絆レベル${bondLevel}の記念写真`;
    }

    // 解放された機能を取得
    getUnlockedFeatures(bondLevel) {
        const features = [];
        
        if (bondLevel >= 1) {
            features.push('🏠 ネスト建設');
        }
        if (bondLevel >= 3) {
            features.push('🚶 レア散歩ルート');
        }
        if (bondLevel >= 5) {
            features.push('🌟 特別散歩ルート');
        }
        if (bondLevel >= 10) {
            features.push('👑 最高級散歩ルート');
        }
        
        return features;
    }

    // ネスト建設可能かチェック
    async canBuildNest(userId, birdName, serverId) {
        try {
            const currentBond = await this.getCurrentBondLevel(userId, birdName, serverId);
            return currentBond.bondLevel >= 1;
        } catch (error) {
            console.error('ネスト建設可能チェックエラー:', error);
            return false;
        }
    }

    // 好感度レベル10達成済みかチェック
    async hasMaxAffinity(userId, birdName, serverId) {
        try {
            const affinities = await sheetsManager.getUserAffinity(userId, serverId);
            const birdAffinity = affinities[birdName];
            return birdAffinity && birdAffinity.level >= 10;
        } catch (error) {
            console.error('好感度チェックエラー:', error);
            return false;
        }
    }

    // 絆レベル要件を取得
    getRequiredFeedsForBondLevel(targetBondLevel) {
        return this.bondLevelRequirements[targetBondLevel] || 999999;
    }
}

// シングルトンインスタンス
const bondLevelManager = new BondLevelManager();

module.exports = bondLevelManager;
