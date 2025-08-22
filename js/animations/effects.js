/**
 * EFFECTS.JS - 特殊エフェクトアニメーション
 * 
 * エネルギー付与・進化・特殊状態の演出
 */

import { AnimationCore, ANIMATION_TIMING } from './core.js';

export class EffectAnimations extends AnimationCore {
    constructor() {
        super();
    }

    /**
     * エネルギー付与アニメーション
     * @param {string} energyType - エネルギータイプ ('fire', 'water', etc.)
     * @param {string} pokemonId - 対象ポケモンID
     * @param {Object} options - オプション
     */
    async energy(energyType, pokemonId, options = {}) {
        const pokemonElement = this.findPokemonElement(pokemonId);
        const energyElement = this.findEnergyCard(options.energyCardId);
        
        if (!pokemonElement) return;

        // エネルギータイプに応じた色とエフェクト
        const energyColors = {
            fire: '#ff6b35',
            water: '#4fc3f7',
            grass: '#66bb6a',
            lightning: '#ffeb3b',
            psychic: '#ab47bc',
            fighting: '#f57c00',
            darkness: '#424242',
            metal: '#90a4ae',
            colorless: '#bdbdbd'
        };
        
        const color = energyColors[energyType.toLowerCase()] || energyColors.colorless;

        // 1. エネルギーカードのスライドアニメーション（手札から）
        if (energyElement) {
            await this.createEnergySlideEffect(energyElement, pokemonElement, energyType, color);
        }

        // 2. ポケモンへのエネルギーグロー
        const glowClass = `anim-energy-glow-${energyType.toLowerCase()}`;
        pokemonElement.style.boxShadow = `0 0 20px ${color}`;
        await this.animate(pokemonElement, glowClass, ANIMATION_TIMING.normal);

        // 3. エネルギー統合エフェクト
        pokemonElement.classList.add('energy-effect', `energy-effect-${energyType}`);
        await this.animate(pokemonElement, 'anim-energy-integrate', ANIMATION_TIMING.normal);
        
        // クリーンアップ
        this.scheduleCleanup(() => {
            pokemonElement.style.boxShadow = '';
            pokemonElement.classList.remove('energy-effect', `energy-effect-${energyType}`);
        }, 400);
    }

    /**
     * 進化アニメーション
     * @param {string} fromPokemonId - 進化前ポケモンID
     * @param {string} toPokemonId - 進化後ポケモンID
     * @param {Object} options - オプション
     */
    async evolution(fromPokemonId, toPokemonId, options = {}) {
        const fromElement = this.findPokemonElement(fromPokemonId);
        const toElement = this.findPokemonElement(toPokemonId);
        
        if (!fromElement || !toElement) return;

        // 1. 進化前ポケモンの光る演出
        await this.animate(fromElement, 'anim-evolution-glow', ANIMATION_TIMING.slow);

        // 2. フラッシュ効果
        await this.screenFlash();

        // 3. 進化後ポケモンの登場
        toElement.style.opacity = '0';
        await this.animate(toElement, 'anim-evolution-emerge', ANIMATION_TIMING.slow);
    }

    /**
     * 特殊状態アニメーション
     * @param {string} condition - 特殊状態 ('poisoned', 'burned', etc.)
     * @param {string} pokemonId - 対象ポケモンID
     */
    async condition(condition, pokemonId) {
        const pokemonElement = this.findPokemonElement(pokemonId);
        
        if (!pokemonElement) return;

        const conditionEffects = {
            poisoned: { color: '#9c27b0', intensity: 'medium', duration: 2000 },
            burned: { color: '#ff5722', intensity: 'high', duration: 1500 },
            asleep: { color: '#3f51b5', intensity: 'low', duration: 3000 },
            paralyzed: { color: '#ffeb3b', intensity: 'medium', duration: 1000 },
            confused: { color: '#e91e63', intensity: 'high', duration: 2500 }
        };
        
        const effect = conditionEffects[condition.toLowerCase()];
        if (!effect) return;
        
        // 特殊状態の視覚効果
        pokemonElement.style.boxShadow = `0 0 15px ${effect.color}`;
        pokemonElement.classList.add('special-condition', `condition-${condition}`);
        
        const conditionClass = `anim-condition-${condition}`;
        await this.animate(pokemonElement, conditionClass, ANIMATION_TIMING.normal);
        
        // 持続的エフェクトのスケジュール
        this.scheduleCleanup(() => {
            pokemonElement.style.boxShadow = '';
            pokemonElement.classList.remove('special-condition', `condition-${condition}`);
        }, effect.duration);
    }

    /**
     * 回復アニメーション
     * @param {number} healAmount - 回復量
     * @param {string} pokemonId - 対象ポケモンID
     */
    async heal(healAmount, pokemonId) {
        const pokemonElement = this.findPokemonElement(pokemonId);
        
        if (!pokemonElement) return;

        // 緑色の回復グロー
        await this.animate(pokemonElement, 'anim-heal-glow', ANIMATION_TIMING.normal);

        // HP数値の更新エフェクト
        const hpElement = this.findHPElement(pokemonId);
        if (hpElement) {
            await this.animate(hpElement, 'anim-hp-recover', ANIMATION_TIMING.normal);
        }
    }

    /**
     * カードドロー演出
     * @param {string} playerId - プレイヤーID
     * @param {number} cardCount - ドロー枚数
     */
    async draw(playerId, cardCount = 1) {
        const deckElement = this.findZoneElement(playerId, 'deck');
        const handElement = this.findZoneElement(playerId, 'hand');
        
        if (!deckElement || !handElement) return;

        for (let i = 0; i < cardCount; i++) {
            // デッキからカードが浮上
            await this.animate(deckElement, 'anim-deck-lift', ANIMATION_TIMING.fast);
            await this.delay(100);
            
            // 手札への移動
            await this.animate(handElement, 'anim-card-draw', ANIMATION_TIMING.normal);
            
            if (i < cardCount - 1) {
                await this.delay(150); // カード間の間隔
            }
        }
    }

    /**
     * サイドカード取得演出
     * @param {string} playerId - プレイヤーID
     * @param {number} prizeIndex - サイドカードインデックス
     */
    async prize(playerId, prizeIndex) {
        const prizeElement = this.findPrizeCard(playerId, prizeIndex);
        
        if (!prizeElement) return;

        // 1. サイドカードの光る演出
        await this.animate(prizeElement, 'anim-prize-glow', ANIMATION_TIMING.normal);

        // 2. 手札への移動
        await this.animate(prizeElement, 'anim-prize-take', ANIMATION_TIMING.normal);

        // 3. 勝利に近づく演出（残りサイド数に応じて）
        const remainingPrizes = this.getRemainingPrizes(playerId);
        if (remainingPrizes <= 2) {
            await this.victoryApproach();
        }
    }

    /**
     * 勝利接近演出
     */
    async victoryApproach() {
        const gameBoard = document.getElementById('game-board') || document.body;
        
        if (!gameBoard) return;

        await this.animate(gameBoard, 'anim-victory-approach', ANIMATION_TIMING.normal);
    }

    /**
     * フラッシュ効果（進化時など）
     */
    async screenFlash() {
        const gameBoard = document.getElementById('game-board') || document.body;
        
        if (!gameBoard) return;

        await this.animate(gameBoard, 'anim-screen-flash', ANIMATION_TIMING.fast);
    }

    /**
     * エネルギーカードスライドエフェクト
     * @private
     */
    async createEnergySlideEffect(energyElement, pokemonElement, energyType, color) {
        // エネルギーカード画像マップ
        const energyImageMap = {
            fire: 'assets/cards/energy/Energy_Fire.webp',
            water: 'assets/cards/energy/Energy_Water.webp',
            grass: 'assets/cards/energy/Energy_Grass.webp',
            lightning: 'assets/cards/energy/Energy_Lightning.webp',
            psychic: 'assets/cards/energy/Energy_Psychic.webp',
            fighting: 'assets/cards/energy/Energy_Fighting.webp',
            darkness: 'assets/cards/energy/Energy_Darkness.webp',
            metal: 'assets/cards/energy/Energy_Metal.webp',
            colorless: 'assets/cards/energy/Energy_Colorless.webp'
        };
        
        const cardImageSrc = energyImageMap[energyType.toLowerCase()] || energyImageMap.colorless;
        
        // エネルギーカードのスライドアニメーション要素を作成
        const slideCard = document.createElement('div');
        slideCard.className = 'energy-slide-card absolute';
        slideCard.style.cssText = `
            bottom: -35px;
            right: -25px;
            width: 73px;
            height: 104px;
            z-index: var(--z-animations);
            opacity: 0;
            background-image: url('${cardImageSrc}');
            background-size: cover;
            background-position: center;
            border-radius: 6px;
            border: 1px solid ${color};
            box-shadow: 0 0 8px ${color};
            animation: slideToTarget 700ms ease-out forwards;
        `;
        
        // 相対位置を確保
        const originalPosition = pokemonElement.style.position;
        if (getComputedStyle(pokemonElement).position === 'static') {
            pokemonElement.style.position = 'relative';
        }
        
        pokemonElement.appendChild(slideCard);
        
        // 追従するパルスリングを付与（短時間）
        const pulse = document.createElement('div');
        pulse.style.cssText = `
            position: absolute;
            left: 50%; top: 50%;
            width: 10px; height: 10px;
            transform: translate(-50%, -50%) scale(0.2);
            border: 2px solid ${color};
            border-radius: 50%;
            opacity: 0.8;
            box-shadow: 0 0 10px ${color};
            transition: transform 500ms ease, opacity 500ms ease;
            pointer-events: none;
        `;
        pokemonElement.appendChild(pulse);

        // 700ms後にスライドカードを削除し、パルスを拡散→消去
        return new Promise(resolve => {
            this.scheduleCleanup(() => {
                slideCard.remove();
                // パルス拡散
                requestAnimationFrame(() => {
                    pulse.style.transform = 'translate(-50%, -50%) scale(2.0)';
                    pulse.style.opacity = '0';
                    setTimeout(() => {
                        pulse.remove();
                        if (originalPosition) {
                            pokemonElement.style.position = originalPosition;
                        } else {
                            pokemonElement.style.position = '';
                        }
                        resolve();
                    }, 520);
                });
            }, 700);
        });
    }

    // ヘルパー関数
    findPokemonElement(pokemonId) {
        return document.querySelector(`[data-card-id="${pokemonId}"]`) ||
               document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
    }

    findEnergyCard(cardId) {
        return document.querySelector(`[data-card-id="${cardId}"]`);
    }

    findZoneElement(playerId, zone) {
        // CPUの場合、実際のDOM構造に合わせてセレクタを調整
        if (playerId === 'cpu') {
            switch (zone) {
                case 'deck':
                    return document.querySelector('.opponent-board .deck-container');
                case 'hand':
                    return document.querySelector('#cpu-hand');
                case 'discard':
                    return document.querySelector('.opponent-board .discard-container');
                case 'active':
                    return document.querySelector('.opponent-board .active-top');
                case 'prize':
                    return document.querySelector('.opponent-board .side-right');
                default:
                    return document.querySelector(`[data-owner="${playerId}"][data-zone="${zone}"]`);
            }
        } else if (playerId === 'player') {
            switch (zone) {
                case 'deck':
                    return document.querySelector('.player-self .deck-container');
                case 'hand':
                    return document.querySelector('#player-hand');
                case 'discard':
                    return document.querySelector('.player-self .discard-container');
                case 'active':
                    return document.querySelector('.player-self .active-bottom');
                case 'prize':
                    return document.querySelector('.player-self .side-left');
                default:
                    return document.querySelector(`[data-owner="${playerId}"][data-zone="${zone}"]`);
            }
        }
        
        return document.querySelector(`[data-owner="${playerId}"][data-zone="${zone}"]`);
    }

    findHPElement(pokemonId) {
        const pokemon = this.findPokemonElement(pokemonId);
        return pokemon?.querySelector('.hp-display, .damage-counter');
    }

    findPrizeCard(playerId, index) {
        return document.querySelector(`[data-owner="${playerId}"][data-zone="prize"][data-index="${index}"]`);
    }

    getRemainingPrizes(playerId) {
        const prizeCards = document.querySelectorAll(`[data-owner="${playerId}"][data-zone="prize"] .card`);
        return prizeCards.length;
    }
}
