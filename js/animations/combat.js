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
     * @param {Element} attackerElement - 攻撃者要素（オプション）
     */
    async typeEffect(type, targetElement, attackerElement = null) {
        if (!targetElement) return;

        const effects = {
            fire: { color: '#ff4444', effect: 'flame' },
            water: { color: '#4488ff', effect: 'water' },
            lightning: { color: '#ffff44', effect: 'electric' },
            grass: { color: '#44ff44', effect: 'leaf' },
            psychic: { color: '#ff44ff', effect: 'psychic' },
            fighting: { color: '#ff8844', effect: 'fighting' },
            darkness: { color: '#444444', effect: 'dark' },
            metal: { color: '#888888', effect: 'metal' },
            fairy: { color: '#ffaaff', effect: 'fairy' },
            dragon: { color: '#4444ff', effect: 'dragon' },
            colorless: { color: '#ffffff', effect: 'normal' }
        };
        
        const effect = effects[type.toLowerCase()] || effects.colorless;
        
        // 攻撃者にタイプカラーのグロー効果
        if (attackerElement) {
            attackerElement.style.boxShadow = `0 0 20px ${effect.color}`;
            attackerElement.style.transition = 'box-shadow 0.3s ease';
            
            this.scheduleCleanup(() => {
                attackerElement.style.boxShadow = '';
            }, 600);
        }
        
        // 守備側にタイプエフェクト
        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 pointer-events-none';
        overlay.style.background = `radial-gradient(circle, ${effect.color}33 0%, transparent 70%)`;
        overlay.style.animation = 'pulse 0.5s ease-in-out';
        
        targetElement.style.position = 'relative';
        targetElement.appendChild(overlay);
        
        this.scheduleCleanup(() => {
            overlay.remove();
        }, 500);
        
        await this.delay(300);
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

    /**
     * 特殊状態エフェクト
     * @param {string} condition - 特殊状態名
     * @param {string} pokemonId - 対象ポケモンID
     */
    async specialCondition(condition, pokemonId) {
        const pokemonElement = this.findPokemonElement(pokemonId);
        if (!pokemonElement) return;

        const conditionEffects = {
            poisoned: { color: '#9c27b0', animation: 'anim-condition-poison' },
            burned: { color: '#ff5722', animation: 'anim-condition-burn' },
            asleep: { color: '#3f51b5', animation: 'anim-condition-sleep' },
            paralyzed: { color: '#ffeb3b', animation: 'anim-condition-paralyze' },
            confused: { color: '#e91e63', animation: 'anim-condition-confuse' }
        };
        
        const effect = conditionEffects[condition.toLowerCase()];
        if (!effect) return;
        
        // 特殊状態の視覚効果を適用
        pokemonElement.style.boxShadow = `0 0 15px ${effect.color}`;
        await this.animate(pokemonElement, effect.animation, ANIMATION_TIMING.normal);
        
        // エフェクトをクリーンアップ
        this.scheduleCleanup(() => {
            pokemonElement.style.boxShadow = '';
        }, 1000);
    }

    // ヘルパー関数
    findPokemonElement(pokemonId) {
        return document.querySelector(`[data-card-id="${pokemonId}"]`) ||
               document.querySelector(`[data-pokemon-id="${pokemonId}"]`);
    }

    findHPElement(pokemonId) {
        const pokemon = this.findPokemonElement(pokemonId);
        return pokemon?.querySelector('.hp-display, .damage-counter');
    }
}