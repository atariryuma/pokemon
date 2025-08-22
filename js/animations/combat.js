/**
 * COMBAT.JS - 戦闘アニメーション
 * 
 * 攻撃・ダメージ・気絶の戦闘演出を統一管理
 */

import { AnimationCore, ANIMATION_TIMING } from './core.js';

export class CombatAnimations extends AnimationCore {
    constructor() {
        super();
    }

    /**
     * 攻撃アニメーション
     * @param {string} attackerType - ポケモンタイプ ('fire', 'water', etc.)
     * @param {number} damage - ダメージ量
     * @param {string} targetId - 対象ポケモンID
     * @param {Object} options - オプション
     */
    async attack(attackerType, damage, targetId, options = {}) {
        const attackerElement = this.findPokemonElement(options.attackerId);
        const targetElement = this.findPokemonElement(targetId);
        
        if (!attackerElement || !targetElement) return;

        // 1. 攻撃者の前進動作
        await this.animate(attackerElement, 'anim-attack-forward', ANIMATION_TIMING.combat);
        
        // 2. タイプ別攻撃エフェクト
        await this.typeEffect(attackerType, targetElement);
        
        // 3. ダメージ処理
        await this.damage(damage, targetId);
    }

    /**
     * ダメージアニメーション
     * @param {number} damage - ダメージ量
     * @param {string} targetId - 対象ポケモンID
     */
    async damage(damage, targetId) {
        const targetElement = this.findPokemonElement(targetId);
        
        if (!targetElement) return;

        // ダメージ強度に応じてアニメーション調整
        const intensity = Math.min(Math.max(damage / 50, 0.5), 3.0);
        
        // 1. ポケモンシェイク
        await this.animate(targetElement, 'anim-damage-shake', ANIMATION_TIMING.combat);
        
        // 2. 画面シェイク（ダメージに応じて）
        if (damage >= 30) {
            await this.screenShake(intensity);
        }
        
        // 3. HPフラッシュ
        const hpElement = this.findHPElement(targetId);
        if (hpElement) {
            await this.animate(hpElement, 'anim-hp-flash', ANIMATION_TIMING.fast);
        }
    }

    /**
     * 気絶アニメーション
     * @param {string} pokemonId - 気絶ポケモンID
     * @param {Object} options - オプション
     */
    async knockout(pokemonId, options = {}) {
        const pokemonElement = this.findPokemonElement(pokemonId);
        
        if (!pokemonElement) return;

        // 気絶演出：回転しながらフェードアウト
        await this.animate(pokemonElement, 'anim-knockout', ANIMATION_TIMING.slow);
        
        // 劇的な画面効果
        await this.screenFlash();
    }

    /**
     * タイプ別攻撃エフェクト
     * @param {string} type - ポケモンタイプ
     * @param {Element} targetElement - 対象要素
     */
    async typeEffect(type, targetElement) {
        if (!targetElement) return;

        const effectClass = `anim-type-${type.toLowerCase()}`;
        await this.animate(targetElement, effectClass, ANIMATION_TIMING.combat);
    }

    /**
     * 画面シェイクエフェクト
     * @param {number} intensity - 強度 (0.5-3.0)
     */
    async screenShake(intensity = 1.0) {
        const gameBoard = document.getElementById('game-board') || document.body;
        
        if (!gameBoard) return;

        // 強度に応じてCSS変数を設定
        gameBoard.style.setProperty('--shake-intensity', intensity);
        
        await this.animate(gameBoard, 'anim-screen-shake', ANIMATION_TIMING.combat);
        
        // クリーンアップ
        gameBoard.style.removeProperty('--shake-intensity');
    }

    /**
     * 画面フラッシュ（気絶時）
     */
    async screenFlash() {
        const gameBoard = document.getElementById('game-board') || document.body;
        
        if (!gameBoard) return;

        await this.animate(gameBoard, 'anim-screen-flash', ANIMATION_TIMING.fast);
    }

    /**
     * 連続攻撃（コンボ）
     * @param {Array} attacks - 攻撃配列
     */
    async combo(attacks) {
        for (const attack of attacks) {
            await this.attack(attack.type, attack.damage, attack.targetId, attack.options);
            await this.delay(200); // コンボ間隔
        }
    }

    // ヘルパー関数
    findPokemonElement(pokemonId) {
        return document.querySelector(`[data-card-id="${pokemonId}"]`);
    }

    findHPElement(pokemonId) {
        const pokemon = this.findPokemonElement(pokemonId);
        return pokemon?.querySelector('.hp-display, .damage-counter');
    }
}