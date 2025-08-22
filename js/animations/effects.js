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

        // 1. エネルギーカード縮小（手札から）
        if (energyElement) {
            await this.animate(energyElement, 'anim-energy-shrink', ANIMATION_TIMING.fast);
        }

        // 2. ポケモンへのエネルギーグロー
        const glowClass = `anim-energy-glow-${energyType.toLowerCase()}`;
        await this.animate(pokemonElement, glowClass, ANIMATION_TIMING.normal);

        // 3. エネルギー統合エフェクト
        await this.animate(pokemonElement, 'anim-energy-integrate', ANIMATION_TIMING.normal);
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

        const conditionClass = `anim-condition-${condition}`;
        await this.animate(pokemonElement, conditionClass, ANIMATION_TIMING.normal);
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

    // ヘルパー関数
    findPokemonElement(pokemonId) {
        return document.querySelector(`[data-card-id="${pokemonId}"]`);
    }

    findEnergyCard(cardId) {
        return document.querySelector(`[data-card-id="${cardId}"]`);
    }

    findZoneElement(playerId, zone) {
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