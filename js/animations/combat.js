/**
 * COMBAT.JS - 戦闘アニメーション (1b0780359780acc1cb2bb14510fdef0f3ca1c6a7より復元)
 * 
 * 攻撃・ダメージ・気絶の戦闘演出を統一管理
 */

import { AnimationCore, ANIMATION_TIMING } from './core.js';

const noop = () => {};

/**
 * アニメーション統一設定
 */
export const ANIMATION_CONFIG = {
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

export class CombatAnimations extends AnimationCore {
    constructor() {
        super();
    }

    /**
     * 攻撃演出（後方互換）
     * @param {Element} attackerElement
     * @param {Element} defenderElement
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
     * 攻撃アニメーションの統一処理
     */
    async createUnifiedAttackAnimation(attackerPlayerId, defenderPlayerId) {
        noop(`⚔️ Starting unified attack animation: ${attackerPlayerId} -> ${defenderPlayerId}`);
        
        try {
            const attackerElement = document.querySelector(
                `${this.getPlayerSelector(attackerPlayerId)} ${this.getActiveSelector(attackerPlayerId)} .relative`
            );

            if (!attackerElement) {
                console.warn('⚠️ Attack animation: Missing attacker element');
                return;
            }

            // 'animate-attack' クラスは index.html で @keyframes attackForward に紐付けられている
            return new Promise(resolve => {
                attackerElement.classList.add('animate-attack');
                const animationDuration = 800; // 0.8s
                setTimeout(() => {
                    attackerElement.classList.remove('animate-attack');
                    resolve();
                }, animationDuration);
            });

        } catch (error) {
            console.error('❌ Error in unified attack animation:', error);
            throw error;
        }
    }

    /**
     * ダメージアニメーション
     */
    async animateDamage(targetElement) {
        if (!targetElement) return;

        return new Promise(resolve => {
            // 'animate-damage' クラスは index.html で @keyframes damageShake に紐付けられている
            targetElement.classList.add('animate-damage');

            // アニメーションの持続時間（CSSで定義されたものと合わせる）
            const animationDuration = 600; // 0.6s

            setTimeout(() => {
                targetElement.classList.remove('animate-damage');
                resolve();
            }, animationDuration);
        });
    }

    /**
     * ノックアウトアニメーションの統一処理
     */
    async createUnifiedKnockoutAnimation(playerId, pokemonId) {
        noop(`💀 Starting unified knockout animation: ${playerId} ${pokemonId}`);
        
        try {
            const pokemonElement = this.findPokemonElement(playerId, pokemonId);
            if (!pokemonElement) {
                console.warn(`⚠️ Pokemon element not found for knockout: ${pokemonId}`);
                return;
            }
            const cardInSlot = pokemonElement.querySelector('.relative');
            if (!cardInSlot) {
                console.warn(`⚠️ Card element inside slot not found for knockout: ${pokemonId}`);
                return;
            }

            // 'animate-knockout' クラスは index.html で @keyframes knockout に紐付けられている
            return new Promise(resolve => {
                cardInSlot.classList.add('animate-knockout');
                const animationDuration = 1200; // 1.2s
                setTimeout(() => {
                    // アニメーションで非表示になるので、クラス削除は必ずしも必要ない
                    // cardInSlot.classList.remove('animate-knockout');
                    resolve();
                }, animationDuration);
            });

        } catch (error) {
            console.error('❌ Error in unified knockout animation:', error);
            throw error;
        }
    }

    /**
     * 画面シェイクエフェクト（ダメージ量に応じて強度可変）
     */
    async animateScreenShake(damage = 0) {
        // ダメージ量に応じてシェイク強度を計算（小刻み調整）
        const intensity = Math.min(Math.max(damage / 40, 0.5), 4); // 0.5-4の範囲（半減）
        const duration = Math.min(200 + damage * 1.5, 600); // 200-600msの範囲（短縮）
        
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
                
                // 上下小刻み地震風エフェクト（X軸移動なし、Y軸のみ）
                const offsetX = 0; // X軸移動を無効化
                const offsetY = (Math.random() - 0.5) * Math.min(intensity * 0.5, 2); // Y軸のみ、最大±2px
                gameBoard.style.transform = `${originalTransform} translate(${offsetX}px, ${offsetY}px)`;
                
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
     * 攻撃フェーズアニメーション
     */
    async animateAttackPhase() {
        const activeCard = document.querySelector('[data-owner="player"][data-zone="active"] .card');
        if (activeCard) {
            activeCard.classList.add('attacking');
            
            await new Promise(resolve => {
                setTimeout(() => {
                    activeCard.classList.remove('attacking');
                    resolve();
                }, ANIMATION_CONFIG.durations.attack);
            });
        }
    }

    // ヘルパー関数
    getPlayerSelector(playerId) {
        return playerId === 'player' ? '.player-self' : '.opponent-board';
    }

    getActiveSelector(playerId) {
        return playerId === 'player' ? '.active-bottom' : '.active-top';
    }

    findPokemonElement(playerId, pokemonId) {
        const playerSelector = this.getPlayerSelector(playerId);
        
        try {
            // アクティブポケモンをチェック
            const activeElement = document.querySelector(`${playerSelector} ${this.getActiveSelector(playerId)}`);
            if (activeElement && this.isPokemonInElement(activeElement, pokemonId)) {
                return activeElement;
            }
            
            // ベンチポケモンをチェック
            for (let i = 0; i < 5; i++) {
                const benchElement = document.querySelector(`${playerSelector} ${this.getBenchSelector(playerId, i)}`);
                if (benchElement && this.isPokemonInElement(benchElement, pokemonId)) {
                    return benchElement;
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Error finding pokemon element:', error);
            return null;
        }
    }

    getBenchSelector(playerId, index) {
        const prefix = playerId === 'player' ? 'bottom' : 'top';
        return `.${prefix}-bench-${index + 1}`;
    }

    isPokemonInElement(element, pokemonId) {
        const cardElement = element.querySelector('[data-card-id]');
        return cardElement && cardElement.dataset.cardId === pokemonId;
    }
}