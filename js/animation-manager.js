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
     * 攻撃アニメーション（統一API）
     */
    async animateAttack(attackerElement, defenderElement) {
        return new Promise(resolve => {
            if (!attackerElement || !defenderElement) return resolve();
            
            const atk = attackerElement.querySelector('.relative') || attackerElement;
            const def = defenderElement.querySelector('.relative') || defenderElement;
            
            atk.classList.add('animate-attack');
            setTimeout(() => {
                def.classList.add('animate-damage');
                setTimeout(() => {
                    atk.classList.remove('animate-attack');
                    def.classList.remove('animate-damage');
                    resolve();
                }, 600);
            }, 400);
        });
    }

    /**
     * スクリーンシェイクアニメーション
     */
    async animateScreenShake(damage = 0) {
        const intensity = Math.min(Math.max(damage / 40, 0.5), 4);
        const duration = Math.min(200 + damage * 1.5, 600);
        
        const gameBoard = document.getElementById('game-board') || document.body;
        const originalTransform = gameBoard.style.transform || '';
        
        return new Promise(resolve => {
            let shakeCount = 0;
            const maxShakes = Math.floor(duration / 50);
            
            const shakeInterval = setInterval(() => {
                if (shakeCount >= maxShakes) {
                    gameBoard.style.transform = originalTransform;
                    clearInterval(shakeInterval);
                    resolve();
                    return;
                }
                
                const offsetY = (Math.random() - 0.5) * Math.min(intensity * 0.5, 2);
                gameBoard.style.transform = `${originalTransform} translateY(${offsetY}px)`;
                
                shakeCount++;
            }, 50);
        });
    }

    /**
     * タイプ別攻撃エフェクト
     */
    async animateTypeBasedAttack(attackerElement, defenderElement, energyType = 'Colorless') {
        const effects = {
            Fire: { color: '#ff4444', effect: 'flame' },
            Water: { color: '#4488ff', effect: 'water' },
            Lightning: { color: '#ffff44', effect: 'electric' },
            Grass: { color: '#44ff44', effect: 'leaf' },
            Psychic: { color: '#ff44ff', effect: 'psychic' },
            Fighting: { color: '#ff8844', effect: 'fighting' },
            Darkness: { color: '#444444', effect: 'dark' },
            Metal: { color: '#888888', effect: 'metal' },
            Fairy: { color: '#ffaaff', effect: 'fairy' },
            Dragon: { color: '#4444ff', effect: 'dragon' },
            Colorless: { color: '#ffffff', effect: 'normal' }
        };
        
        const effect = effects[energyType] || effects.Colorless;
        
        // 攻撃者にタイプカラーのグロー効果
        if (attackerElement) {
            attackerElement.style.boxShadow = `0 0 20px ${effect.color}`;
            attackerElement.style.transition = 'box-shadow 0.3s ease';
            
            setTimeout(() => {
                attackerElement.style.boxShadow = '';
            }, 600);
        }
        
        // 守備側にタイプエフェクト
        if (defenderElement) {
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 pointer-events-none';
            overlay.style.background = `radial-gradient(circle, ${effect.color}33 0%, transparent 70%)`;
            overlay.style.animation = 'pulse 0.5s ease-in-out';
            
            defenderElement.style.position = 'relative';
            defenderElement.appendChild(overlay);
            
            setTimeout(() => {
                overlay.remove();
            }, 500);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
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
     * カードドロー（山札から手札へ）
     */
    async cardDraw(playerId, cardElement, options = {}) {
        return this.execute(() => this.card.drawCardFromDeck(playerId, cardElement, options));
    }

    /**
     * 攻撃アニメーション（統一API）
     * 優先順位: combat.js → フォールバック
     */
    async attack(attackerType, damage, targetId, options = {}) {
        try {
            // まず combat.js の高度な攻撃アニメーションを試す
            return await this.execute(() => this.combat.attack(attackerType, damage, targetId, options));
        } catch (error) {
            console.warn('Combat animation failed, using fallback:', error);
            // フォールバック: 基本的な攻撃アニメーション
            const attackerElement = options.attackerElement || this.findPokemonElement(options.attackerId);
            const defenderElement = this.findPokemonElement(targetId);
            return this.execute(() => this.animateAttack(attackerElement, defenderElement));
        }
    }

    /**
     * ダメージアニメーション（統一API）
     * 優先順位: combat.js → フォールバック
     */
    async damage(damage, targetId, options = {}) {
        try {
            // まず combat.js の高度なダメージアニメーションを試す
            return await this.execute(() => this.combat.damage(damage, targetId));
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
     * ノックアウトアニメーション
     */
    async knockout(pokemonId, options = {}) {
        return this.execute(() => this.combat.knockout(pokemonId, options));
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
    
    // 戦闘系
    animateTypeBasedAttack: (attackerEl, defenderEl, type) => {
        const targetId = defenderEl?.dataset?.cardId;
        return animate.combat.typeEffect(type, document.querySelector(`[data-card-id="${targetId}"]`));
    },
    
    animateScreenShake: (damage) => animate.combat.screenShake(damage / 50),
    
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