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
import { getCardImagePath } from './data-manager.js';
// 統合アニメーション設定を内部定義
const ANIMATION_CONFIG = {
  durations: {
    fast: 200,
    normal: 400,
    slow: 600,
    gameOver: 1500,
    phaseTransition: 300,
    cardMove: 500,
    dealCard: 600,
    attack: 800,
    damage: 600
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  }
};

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
     * 攻撃アニメーション（統一API）- 1b0780359780acc1cb2bb14510fdef0f3ca1c6a7から復元
     */
    async animateAttack(attackerElement, defenderElement) {
        return this.execute(() => this.combat.animateAttack(attackerElement, defenderElement));
    }

    /**
     * スクリーンシェイクアニメーション - 1b0780359780acc1cb2bb14510fdef0f3ca1c6a7から復元
     */
    async animateScreenShake(damage = 0) {
        return this.execute(() => this.combat.animateScreenShake(damage));
    }

    /**
     * タイプ別攻撃エフェクト - 1b0780359780acc1cb2bb14510fdef0f3ca1c6a7から復元
     */
    async animateTypeBasedAttack(attackerElement, defenderElement, energyType = 'Colorless') {
        return this.execute(() => this.combat.animateTypeBasedAttack(attackerElement, defenderElement, energyType));
    }

    /**
     * カードハイライト表示
     */
    highlightCard(cardElement) {
        if (!cardElement) return;
        
        cardElement.classList.add('card-highlighted');
        cardElement.style.transform = 'scale(1.05)';
        cardElement.style.transition = 'transform 200ms ease, box-shadow 200ms ease';
        cardElement.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
    }

    /**
     * カードハイライト解除
     */
    unhighlightCard(cardElement) {
        if (!cardElement) return;
        
        cardElement.classList.remove('card-highlighted');
        cardElement.style.transform = '';
        cardElement.style.boxShadow = '';
    }

    /**
     * ポケモン要素の検索
     */
    findPokemonElement(pokemonId) {
        return document.querySelector(`[data-card-id="${pokemonId}"]`) || 
               document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
    }

    /**
     * プレイヤーのアクティブポケモン要素を検索
     */
    findPlayerActiveElement(playerId) {
        const playerSelector = playerId === 'player' ? '.player-self' : '.opponent-board';
        const activeSelector = playerId === 'player' ? '.active-bottom' : '.active-top';
        return document.querySelector(`${playerSelector} ${activeSelector}`);
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

    // ==========================================================
    // 統合アニメーション機能（1b0780359780acc1cb2bb14510fdef0f3ca1c6a7から復元）
    // ==========================================================

    /**
     * 統合カードディールアニメーション
     */
    async animateDealCards(cardElements, staggerDelay = 100) {
        return this.execute(() => this._animateDealCards(cardElements, staggerDelay));
    }
    
    // 内部実装
    async _animateDealCards(cardElements, staggerDelay = 100) {
        const promises = cardElements.map((element, index) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    if (element) {
                        const target = element.querySelector('img') || element;
                        element.style.opacity = '1';
                        target.classList.add('animate-deal-card');
                        setTimeout(() => {
                            element.style.opacity = '1';
                            element.style.visibility = 'visible';
                            resolve();
                        }, ANIMATION_CONFIG.durations.dealCard);
                    } else {
                        resolve();
                    }
                }, index * staggerDelay);
            });
        });
        return Promise.all(promises);
    }

    /**
     * 手札入場アニメーション
     */
    async animateHandEntry(cardElements = []) {
        return this.execute(() => this._animateHandEntry(cardElements));
    }
    
    async _animateHandEntry(cardElements = []) {
        if (!Array.isArray(cardElements) || cardElements.length === 0) return;
        const delay = 60;
        return Promise.all(cardElements.map((el, i) => new Promise(resolve => {
            setTimeout(() => {
                if (!el) return resolve();
                const target = el.querySelector('img') || el;
                target.classList.add('animate-deal-player-hand-card');
                setTimeout(() => {
                    if (el) {
                        el.style.opacity = '1';
                        el.style.visibility = 'visible';
                    }
                    resolve();
                }, ANIMATION_CONFIG.durations.dealCard);
            }, i * delay);
        })));
    }

    /**
     * フェーズ間遷移アニメーション
     */
    async animatePhaseTransition(fromPhase, toPhase) {
        return this.execute(() => this._animatePhaseTransition(fromPhase, toPhase));
    }
    
    async _animatePhaseTransition(fromPhase, toPhase) {
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.classList.add('phase-transition');
            await new Promise(resolve => {
                setTimeout(() => {
                    gameBoard.classList.remove('phase-transition');
                    resolve();
                }, ANIMATION_CONFIG.durations.phaseTransition);
            });
        }
    }

    /**
     * カードフリップアニメーション（表向きに）
     */
    async flipCardFaceUp(cardElement, frontImageSrc) {
        return this.execute(() => this._flipCardFaceUp(cardElement, frontImageSrc));
    }
    
    async _flipCardFaceUp(cardElement, frontImageSrc) {
        return new Promise((resolve) => {
            if (!cardElement) return resolve();
            
            const imgElement = cardElement.querySelector('img');
            if (!imgElement) return resolve();
            
            cardElement.style.transition = 'transform 300ms ease-in-out';
            cardElement.style.transform = 'rotateY(90deg)';
            
            setTimeout(() => {
                imgElement.src = frontImageSrc;
                imgElement.alt = 'Card Face';
                
                imgElement.onload = () => {
                    cardElement.style.transform = 'rotateY(0deg)';
                    setTimeout(resolve, 300);
                };
                
                imgElement.onerror = () => {
                    cardElement.style.transform = 'rotateY(0deg)';
                    setTimeout(resolve, 300);
                };
            }, 150);
        });
    }

    /**
     * サイドカード配布アニメーション
     */
    async animatePrizeDeal(cardElement, isPlayerSide = true) {
        return this.execute(() => this._animatePrizeDeal(cardElement, isPlayerSide));
    }
    
    async _animatePrizeDeal(cardElement, isPlayerSide = true) {
        if (!cardElement) return;
        
        const animationClass = isPlayerSide ? 'animate-prize-deal-left' : 'animate-prize-deal-right';
        
        return new Promise(resolve => {
            cardElement.style.opacity = '0';
            cardElement.classList.add(animationClass);
            
            setTimeout(() => {
                cardElement.style.opacity = '1';
                cardElement.classList.remove(animationClass);
                resolve();
            }, 500);
        });
    }

    /**
     * カード移動アニメーション（統一システム）
     */
    async animateCardMove(sourceElement, targetElement, options = {}) {
        return this.execute(() => this._animateCardMove(sourceElement, targetElement, options));
    }
    
    async _animateCardMove(sourceElement, targetElement, options = {}) {
        const {
            duration = 600,
            curve = ANIMATION_CONFIG.easing.smooth,
            onComplete = () => {}
        } = options;

        if (!sourceElement || !targetElement) return;

        const sourceRect = sourceElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();

        const animCard = sourceElement.cloneNode(true);
        animCard.style.cssText = `
            position: fixed;
            left: ${sourceRect.left}px;
            top: ${sourceRect.top}px;
            width: ${sourceRect.width}px;
            height: ${sourceRect.height}px;
            z-index: var(--z-critical);
            transition: all ${duration}ms ${curve};
            pointer-events: none;
        `;

        document.body.appendChild(animCard);
        sourceElement.style.opacity = '0';
        animCard.offsetHeight;

        animCard.style.left = `${targetRect.left}px`;
        animCard.style.top = `${targetRect.top}px`;
        animCard.style.width = `${targetRect.width}px`;
        animCard.style.height = `${targetRect.height}px`;

        return new Promise(resolve => {
            setTimeout(() => {
                document.body.removeChild(animCard);
                sourceElement.style.opacity = '1';
                onComplete();
                resolve();
            }, duration);
        });
    }

    /**
     * 状態異常アニメーション
     */
    async applyStatusCondition(pokemonElement, condition, apply = true) {
        return this.execute(() => this._applyStatusCondition(pokemonElement, condition, apply));
    }
    
    _applyStatusCondition(pokemonElement, condition, apply = true) {
        if (!pokemonElement) return;
        const conditionClass = `status-${condition}`;
        if (apply) {
            pokemonElement.classList.add(conditionClass);
        } else {
            pokemonElement.classList.remove(conditionClass);
        }
    }

    /**
     * エネルギー効果アニメーション
     */
    async applyEnergyEffect(pokemonElement, energyType, apply = true) {
        return this.execute(() => this._applyEnergyEffect(pokemonElement, energyType, apply));
    }
    
    _applyEnergyEffect(pokemonElement, energyType, apply = true) {
        if (!pokemonElement) return;
        const effectClass = `energy-effect-${energyType.toLowerCase()}`;
        if (apply) {
            pokemonElement.classList.add(effectClass);
            setTimeout(() => {
                pokemonElement.classList.remove(effectClass);
            }, 2000);
        } else {
            pokemonElement.classList.remove(effectClass);
        }
    }

    /**
     * 複数状態異常の管理
     */
    async updateStatusConditions(pokemonElement, conditions = []) {
        return this.execute(() => this._updateStatusConditions(pokemonElement, conditions));
    }
    
    _updateStatusConditions(pokemonElement, conditions = []) {
        if (!pokemonElement) return;
        const allConditions = ['poisoned', 'burned', 'paralyzed', 'asleep', 'confused'];
        allConditions.forEach(condition => {
            pokemonElement.classList.remove(`status-${condition}`);
        });
        conditions.forEach(condition => {
            if (allConditions.includes(condition)) {
                pokemonElement.classList.add(`status-${condition}`);
            }
        });
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
     * カードドロー（山札から手札へ）
     */
    async cardDraw(playerId, cardElement, options = {}) {
        return this.execute(() => this.card.drawCardFromDeck(playerId, cardElement, options));
    }

    /**
     * 攻撃アニメーション（統一API）- 1b0780359780acc1cb2bb14510fdef0f3ca1c6a7から復元
     */
    async attack(attackerPlayerId, defenderPlayerId, options = {}) {
        try {
            return await this.execute(() => this.combat.createUnifiedAttackAnimation(attackerPlayerId, defenderPlayerId));
        } catch (error) {
            console.warn('Combat attack animation failed, using fallback:', error);
            // フォールバック: 基本的な攻撃アニメーション
            const attackerElement = this.findPlayerActiveElement(attackerPlayerId);
            const defenderElement = this.findPlayerActiveElement(defenderPlayerId);
            return this.execute(() => this.combat.animateAttack(attackerElement, defenderElement));
        }
    }

    /**
     * ダメージアニメーション（統一API）- 1b0780359780acc1cb2bb14510fdef0f3ca1c6a7から復元
     */
    async damage(targetElement, damage = 0) {
        try {
            return await this.execute(() => this.combat.animateDamage(targetElement));
        } catch (error) {
            console.warn('Combat damage animation failed, using fallback:', error);
            // フォールバック: 基本的なスクリーンシェイク
            return this.execute(() => this.animateScreenShake(damage));
        }
    }

    /**
     * スクリーンシェイク（統一API）
     */
    async screenShake(damage = 0) {
        return this.execute(() => this.animateScreenShake(damage));
    }

    /**
     * タイプ別攻撃エフェクト（統一API）
     */
    async typeAttack(attackerElement, defenderElement, energyType = 'Colorless') {
        return this.execute(() => this.animateTypeBasedAttack(attackerElement, defenderElement, energyType));
    }

    /**
     * カードハイライト（統一API）
     */
    async highlight(cardElement) {
        return this.execute(() => this.highlightCard(cardElement));
    }

    /**
     * カードハイライト解除（統一API）
     */
    async unhighlight(cardElement) {
        return this.execute(() => this.unhighlightCard(cardElement));
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
     * ノックアウトアニメーション - 1b0780359780acc1cb2bb14510fdef0f3ca1c6a7から復元
     */
    async knockout(playerId, pokemonId, options = {}) {
        return this.execute(() => this.combat.createUnifiedKnockoutAnimation(playerId, pokemonId));
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
    animateDamage: (element) => animate.combat.animateDamage(element),
    createUnifiedKnockoutAnimation: (playerId, pokemonId) => animate.combat.createUnifiedKnockoutAnimation(playerId, pokemonId),
    animateScreenShake: (damage) => animate.combat.animateScreenShake(damage),
    
    // 手札エントリー
    animateHandEntry: (cards) => animate.handDeal(cards, 'player'),
    
    // 手札配布
    animateHandDeal: (cards, playerId) => animate.handDeal(cards, playerId),
    
    // カードドロー
    animateDrawCard: (element) => {
        if (element) {
            return animate.cardDraw('player', element);
        }
        return animate.card.deckToHand('player', null, { element });
    },
    
    // メッセージアニメーション
    animateMessage: (element) => animate.ui.notification(element?.textContent || 'メッセージ', 'info'),
    
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
    // 高度なカード移動アニメーション（手札からプレイマットへの移動など）
    async createUnifiedCardAnimation(playerId, cardId, sourceZone, targetZone, targetIndex, options = {}) {
        const {
            isSetupPhase = false,
            duration = 600,
            card = null,
            initialSourceRect = null
        } = options;

        try {
            // 移動元要素の取得
            const sourceElement = this.getSourceElement(playerId, sourceZone, cardId);
            if (!sourceElement) {
                console.warn(`⚠️ Source element not found: ${playerId} ${sourceZone} ${cardId}`);
                return;
            }

            // 移動先要素の取得
            const targetElement = this.getTargetElement(playerId, targetZone, targetIndex);
            if (!targetElement) {
                console.warn(`⚠️ Target element not found: ${playerId} ${targetZone}[${targetIndex}]`);
                return Promise.resolve();
            }

            // 移動先に配置されたカード要素を取得
            const placedCardElement = targetElement.children[0];
            if (!placedCardElement) {
                console.warn(`⚠️ No card found in target: ${playerId} ${targetZone}[${targetIndex}]`);
                return;
            }

            // アニメーション実行
            await this.executeCardMoveAnimation(
                sourceElement, 
                targetElement, 
                placedCardElement, 
                card, 
                { playerId, isSetupPhase, duration, initialSourceRect, targetZone }
            );

        } catch (error) {
            console.error('❌ Error in unified card animation:', error);
        }
    },

    // セレクタヘルパー
    getPlayerSelector(playerId) {
        return playerId === 'player' ? '.player-self' : '.opponent-board';
    },

    getActiveSelector(playerId) {
        return playerId === 'player' ? '.active-bottom' : '.active-top';
    },

    getBenchSelector(playerId, index) {
        const prefix = playerId === 'player' ? 'bottom' : 'top';
        return `.${prefix}-bench-${index + 1}`;
    },

    getHandSelector(playerId) {
        return playerId === 'player' ? '#player-hand' : '#cpu-hand';
    },

    // 移動元要素の取得
    getSourceElement(playerId, sourceZone) {
        switch (sourceZone) {
            case 'hand':
                return document.querySelector(this.getHandSelector(playerId));
            case 'deck':
                return document.querySelector(`${this.getPlayerSelector(playerId)} .deck-container`);
            default:
                console.warn(`Unknown source zone: ${sourceZone}`);
                return null;
        }
    },

    // 移動先要素の取得
    getTargetElement(playerId, targetZone, targetIndex) {
        const playerSelector = this.getPlayerSelector(playerId);
        
        switch (targetZone) {
            case 'active':
            case 'Active':
                return document.querySelector(`${playerSelector} ${this.getActiveSelector(playerId)}`);
            case 'bench':
            case 'Bench':
                return document.querySelector(`${playerSelector} ${this.getBenchSelector(playerId, targetIndex)}`);
            case 'hand':
            case 'Hand':
                return document.querySelector(this.getHandSelector(playerId));
            case 'discard':
            case 'Discard':
                return document.querySelector(`${playerSelector} .discard-container`);
            default:
                console.warn(`Unknown target zone: ${targetZone}`);
                return null;
        }
    },

    // 要素の位置とサイズを取得
    getElementRect(element) {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2
        };
    },

    // カード移動アニメーションの実行
    async executeCardMoveAnimation(sourceElement, targetElement, placedCardElement, card, options) {
        const { playerId, isSetupPhase, duration, initialSourceRect, targetZone } = options;

        // 位置情報取得
        const sourceRect = initialSourceRect || this.getElementRect(sourceElement);
        const targetRect = this.getElementRect(targetElement);
        
        if (!sourceRect || !targetRect) {
            console.warn('⚠️ Could not get element positions for animation');
            return;
        }

        // アニメーション用のクローン要素を作成
        const animCard = this.createAnimationCard(placedCardElement, sourceRect, playerId, targetZone, options);
        
        // 元のカードを一時的に隠す
        placedCardElement.style.opacity = '0';
        
        // DOM に追加
        document.body.appendChild(animCard);
        
        // 強制リフロー
        animCard.offsetHeight;
        
        // アニメーション実行
        await this.performCardTransition(animCard, targetRect, duration);
        
        // 後処理
        this.cleanupAnimation(animCard, placedCardElement);
    },

    // アニメーション用カード要素の作成
    createAnimationCard(originalCard, sourceRect, playerId, targetZone, options) {
        const animCard = originalCard.cloneNode(true);
        
        // アニメーション用スタイル設定
        const finalSourceLeft = sourceRect.left + (options.initialSourceRect ? 0 : (playerId === 'cpu' ? 20 : 50));
        const finalSourceTop = sourceRect.top + (options.initialSourceRect ? 0 : 20);
        
        animCard.style.cssText = `
            position: fixed;
            left: ${finalSourceLeft}px;
            top: ${finalSourceTop}px;
            width: ${originalCard.offsetWidth}px;
            height: ${originalCard.offsetHeight}px;
            z-index: var(--z-critical);
            transform: scale(0.8) rotate(-3deg);
            opacity: 0.9;
            pointer-events: none;
            border-radius: 8px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
            transition: none;
        `;

        return animCard;
    },

    // カード遷移アニメーション実行
    async performCardTransition(animCard, targetRect, duration) {
        return new Promise(resolve => {
            // トランジション設定
            animCard.style.transition = `all ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
            
            // 目標位置へ移動
            animCard.style.left = `${targetRect.left}px`;
            animCard.style.top = `${targetRect.top}px`;
            animCard.style.transform = 'scale(1) rotate(0deg)';
            animCard.style.opacity = '1';

            // アニメーション完了待機
            const handleTransitionEnd = () => {
                animCard.removeEventListener('transitionend', handleTransitionEnd);
                resolve();
            };

            animCard.addEventListener('transitionend', handleTransitionEnd, { once: true });

            // フォールバック
            setTimeout(handleTransitionEnd, duration + 100);
        });
    },

    // アニメーション後処理
    cleanupAnimation(animCard, originalCard) {
        // アニメーション用カードを削除
        if (animCard.parentNode) {
            animCard.parentNode.removeChild(animCard);
        }

        // 元のカードを表示
        originalCard.style.opacity = '1';

        // 配置完了効果
        originalCard.style.transform = 'scale(1.1)';
        setTimeout(() => {
            originalCard.style.transition = 'transform 200ms ease';
            originalCard.style.transform = '';
            setTimeout(() => {
                originalCard.style.transition = '';
            }, 200);
        }, 150);
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
    
    // 戦闘系 - 1b0780359780acc1cb2bb14510fdef0f3ca1c6a7から復元
    animateTypeBasedAttack: (attackerEl, defenderEl, type) => {
        return animate.combat.animateTypeBasedAttack(attackerEl, defenderEl, type);
    },
    
    animateScreenShake: (damage) => animate.combat.animateScreenShake(damage),
    
    // UI系
    animatePhaseTransition: (from, to) => animate.ui.phase(from, to),
    
    // エネルギー配布
    animateEnergyAttach: (energyCardElement, pokemonElement) => {
        if (!energyCardElement || !pokemonElement) return Promise.resolve();
        
        return new Promise(resolve => {
            const img = energyCardElement.querySelector('img') || energyCardElement;
            img.classList.add('animate-energy-attach');
            pokemonElement.classList.add('slot-highlight');
            
            setTimeout(() => {
                img.classList.remove('animate-energy-attach');
                pokemonElement.classList.remove('slot-highlight');
                resolve();
            }, 700);
        });
    },

    // スロット・カードハイライト
    highlightSlot: (element, type = 'bench') => {
        if (element) {
            element.classList.add('slot-highlight');
            element.dataset.highlightType = type;
        }
    },

    unhighlightSlot: (element) => {
        if (element) {
            element.classList.remove('slot-highlight');
            delete element.dataset.highlightType;
        }
    },
    
    // 内部ヘルパー
    extractEnergyType(energyId, gameState) {
        // エネルギータイプをIDから抽出するロジック
        const energyTypes = ['fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'colorless'];
        const lowerEnergyId = energyId.toLowerCase();
        
        return energyTypes.find(type => lowerEnergyId.includes(type)) || 'colorless';
    }
};