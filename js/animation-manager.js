/**
 * ANIMATION-MANAGER.JS - 統合アニメーションマネージャー
 * 
 * すべてのアニメーションを統一管理
 * シンプルなAPIで各種アニメーションにアクセス
 */

import { CardMoveAnimations } from './animations/card-moves.js';
import { CombatAnimations } from './animations/combat.js';
import { EffectAnimations } from './animations/effects.js';
import { UIAnimations } from './animations/ui.js';

/**
 * 統合アニメーションマネージャー
 */
class AnimationManager {
    constructor() {
        // 各アニメーションクラスのインスタンス
        this.card = new CardMoveAnimations();
        this.combat = new CombatAnimations();
        this.effect = new EffectAnimations();
        this.ui = new UIAnimations();
        
        // パフォーマンス設定
        this.settings = {
            enabled: true,
            quality: 'high', // 'low', 'medium', 'high'
            reduceMotion: this.detectReduceMotion()
        };
    }

    /**
     * アニメーション有効/無効切り替え
     * @param {boolean} enabled - 有効フラグ
     */
    setEnabled(enabled) {
        this.settings.enabled = enabled;
    }

    /**
     * アニメーション品質設定
     * @param {string} quality - 品質レベル ('low', 'medium', 'high')
     */
    setQuality(quality) {
        this.settings.quality = quality;
        this.updateQualitySettings();
    }

    /**
     * 品質設定の適用
     */
    updateQualitySettings() {
        const root = document.documentElement;
        
        switch (this.settings.quality) {
            case 'low':
                root.style.setProperty('--anim-enabled', '0');
                break;
            case 'medium':
                root.style.setProperty('--anim-enabled', '1');
                root.style.setProperty('--anim-particles', '0');
                break;
            case 'high':
                root.style.setProperty('--anim-enabled', '1');
                root.style.setProperty('--anim-particles', '1');
                break;
        }
    }

    /**
     * Reduce Motionの検出
     */
    detectReduceMotion() {
        return window.matchMedia && 
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * 全アニメーションの停止・クリーンアップ
     */
    async stopAll() {
        await Promise.all([
            this.card.cleanup(),
            this.combat.cleanup(),
            this.effect.cleanup(),
            this.ui.cleanup()
        ]);
    }

    /**
     * アニメーション実行のラッパー（設定チェック付き）
     * @param {Function} animationFunction - アニメーション関数
     * @param {...any} args - 引数
     */
    async execute(animationFunction, ...args) {
        // アニメーション無効時はスキップ
        if (!this.settings.enabled || this.settings.reduceMotion) {
            return;
        }

        try {
            return await animationFunction.apply(this, args);
        } catch (error) {
            console.warn('Animation execution error:', error);
        }
    }

    // 便利メソッド（よく使われるアニメーションのショートカット）
    
    /**
     * カード移動（統一API）
     */
    async cardMove(playerId, cardId, transition, options = {}) {
        return this.execute(() => this.card.move(playerId, cardId, transition, options));
    }
    
    /**
     * エネルギー付与
     */
    async energyAttach(energyId, pokemonId, gameState) {
        const energyType = this.extractEnergyType(energyId, gameState);
        return this.execute(() => this.effect.energy(energyType, pokemonId, { energyCardId: energyId }));
    }
    
    /**
     * エネルギー廃棄
     */
    async energyDiscard(discardedEnergy, sourceEl, targetEl) {
        return this.execute(() => this.effect.energyDiscard(discardedEnergy, sourceEl, targetEl));
    }
    
    /**
     * 手札配布
     */
    async handDeal(cards, playerId) {
        return this.execute(() => this.card.dealHand(cards, playerId));
    }
    
    /**
     * サイド配布
     */
    async prizeDeal(elements, playerId) {
        return this.execute(() => this.card.dealPrize(elements, playerId));
    }
    
    /**
     * エネルギータイプ抽出ヘルパー
     */
    extractEnergyType(energyId, gameState) {
        const energyTypes = ['fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'colorless'];
        const lowerEnergyId = energyId.toLowerCase();
        
        return energyTypes.find(type => lowerEnergyId.includes(type)) || 'colorless';
    }

    /**
     * カードを手札からフィールドに移動
     */
    async playCard(playerId, cardId, targetZone, options = {}) {
        const transition = `hand->${targetZone}`;
        return this.execute(() => this.card.move(playerId, cardId, transition, options));
    }

    /**
     * 攻撃の完全なシーケンス
     */
    async attackSequence(attackerType, damage, targetId, options = {}) {
        return this.execute(() => this.combat.attack(attackerType, damage, targetId, options));
    }

    /**
     * エネルギー付与の完全なシーケンス
     */
    async attachEnergy(energyType, pokemonId, options = {}) {
        return this.execute(() => this.effect.energy(energyType, pokemonId, options));
    }

    /**
     * フェーズ遷移
     */
    async changePhase(fromPhase, toPhase, options = {}) {
        return this.execute(() => this.ui.phase(fromPhase, toPhase, options));
    }

    /**
     * 成功/エラー通知
     */
    async notify(message, type = 'info') {
        return this.execute(() => this.ui.notification(message, type));
    }

    /**
     * 複数カードの同時配布（セットアップ用）
     */
    async dealCards(cards, options = {}) {
        return this.execute(() => this.card.dealMultiple(cards, options));
    }

    /**
     * 戦闘の完全なシーケンス（攻撃→ダメージ→気絶判定）
     */
    async battleSequence(attackData) {
        if (!this.settings.enabled) return;

        const { attackerType, damage, targetId, isKnockout, options = {} } = attackData;

        // 攻撃アニメーション
        await this.attackSequence(attackerType, damage, targetId, options);

        // 気絶処理
        if (isKnockout) {
            await this.execute(() => this.combat.knockout(targetId, options));
        }
    }

    /**
     * デバッグ用：アニメーション状態表示
     */
    getStatus() {
        return {
            enabled: this.settings.enabled,
            quality: this.settings.quality,
            reduceMotion: this.settings.reduceMotion,
            activeAnimations: {
                card: this.card.activeAnimations.size,
                combat: this.combat.activeAnimations.size,
                effect: this.effect.activeAnimations.size,
                ui: this.ui.activeAnimations.size
            }
        };
    }
}

// シングルトンインスタンス
export const animate = new AnimationManager();

// 後方互換性のための旧API
export const animationManager = {
    // 旧メソッドを新APIにリダイレクト
    animateDrawCard: (element) => animate.card.deckToHand('player', null, { element }),
    animateDamage: (element) => animate.combat.damage(50, null, { element }),
    createUnifiedKnockoutAnimation: (playerId, pokemonId) => animate.combat.knockout(pokemonId),
    animateScreenShake: (intensity) => animate.combat.screenShake(intensity),
    
    // 手札エントリー
    animateHandEntry: (cards) => animate.handDeal(cards, 'player'),
    
    // 統一カードアニメーション
    createUnifiedCardAnimation: (playerId, cardId, from, to, index, options) => {
        const transition = `${from}->${to}`;
        return animate.cardMove(playerId, cardId, transition, { ...options, index });
    },
    
    // 統一攻撃アニメーション
    createUnifiedAttackAnimation: (attackerId, defenderId) => 
        animate.attackSequence('normal', 50, defenderId, { attackerId }),
    
    // カード表示切り替え
    flipCardFaceUp: (element, imageUrl) => animate.card.flip(element, { imageUrl }),
    
    // カードハイライト
    highlightCard: (element) => animate.ui.highlight(element, true),
    unhighlightCard: (element) => animate.ui.highlight(element, false)
};

// 新しい統一マネージャー（旧unified-animations.jsの置き換え）
export const unifiedAnimationManager = {
    // カード移動系
    createUnifiedCardAnimation: (playerId, cardId, from, to, index, options) => {
        const transition = `${from}->${to}`;
        return animate.card.move(playerId, cardId, transition, { ...options, index });
    },
    
    // エネルギー系
    createLightweightEnergyEffect: (energyId, pokemonId, gameState) => {
        const energyType = unifiedAnimationManager.extractEnergyType(energyId, gameState);
        return animate.effect.energy(energyType, pokemonId, { energyCardId: energyId });
    },
    
    // 廃棄エネルギー
    animateDiscardedEnergy: (playerId, discardedEnergy, sourceEl, targetEl) => {
        return animate.energyDiscard(discardedEnergy, sourceEl, targetEl);
    },
    
    // 手札配布
    animateHandDeal: (cards, playerId) => animate.handDeal(cards, playerId),
    
    // サイド配布  
    animatePrizeDeal: (elements, playerId) => animate.prizeDeal(elements, playerId),
    
    // 戦闘系
    animateTypeBasedAttack: (attackerEl, defenderEl, type) => {
        const targetId = defenderEl?.dataset?.cardId;
        return animate.combat.typeEffect(type, document.querySelector(`[data-card-id="${targetId}"]`));
    },
    
    animateScreenShake: (damage) => animate.combat.screenShake(damage / 50),
    
    // UI系
    animatePhaseTransition: (from, to) => animate.ui.phase(from, to),
    
    // 内部ヘルパー
    extractEnergyType(energyId, gameState) {
        // エネルギータイプをIDから抽出するロジック
        const energyTypes = ['fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'colorless'];
        const lowerEnergyId = energyId.toLowerCase();
        
        return energyTypes.find(type => lowerEnergyId.includes(type)) || 'colorless';
    }
};