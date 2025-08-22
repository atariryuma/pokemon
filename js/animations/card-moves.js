/**
 * CARD-MOVES.JS - カード移動アニメーション
 * 
 * すべてのカード移動を統一管理
 * 手札 ↔ フィールド ↔ トラッシュ
 */

import { AnimationCore, ANIMATION_TIMING } from './core.js';

export class CardMoveAnimations extends AnimationCore {
    constructor() {
        super();
    }

    /**
     * カード移動メイン関数
     * @param {string} playerId - プレイヤーID
     * @param {string} cardId - カードID
     * @param {string} transition - 遷移タイプ ('hand->active', 'active->discard', etc.)
     * @param {Object} options - オプション
     */
    async move(playerId, cardId, transition, options = {}) {
        const [from, to] = transition.split('->');
        
        switch (transition) {
            case 'hand->active':
                return this.handToActive(playerId, cardId, options);
            case 'hand->bench':
                return this.handToBench(playerId, cardId, options);
            case 'active->discard':
                return this.activeToDiscard(playerId, cardId, options);
            case 'bench->active':
                return this.benchToActive(playerId, cardId, options);
            case 'deck->hand':
                return this.deckToHand(playerId, cardId, options);
            default:
                return this.genericMove(playerId, cardId, from, to, options);
        }
    }

    /**
     * 手札からアクティブへの移動
     */
    async handToActive(playerId, cardId, options = {}) {
        const sourceElement = this.findCardElement(playerId, cardId, 'hand');
        const targetElement = this.findZoneElement(playerId, 'active');
        
        if (!sourceElement || !targetElement) return;

        // アニメーション実行
        await this.animate(sourceElement, 'anim-card-to-active', ANIMATION_TIMING.normal);
    }

    /**
     * 手札からベンチへの移動
     */
    async handToBench(playerId, cardId, options = {}) {
        const sourceElement = this.findCardElement(playerId, cardId, 'hand');
        const { benchIndex = 0 } = options;
        const targetElement = this.findBenchSlot(playerId, benchIndex);
        
        if (!sourceElement || !targetElement) return;

        await this.animate(sourceElement, 'anim-card-to-bench', ANIMATION_TIMING.normal);
    }

    /**
     * アクティブからトラッシュへ（気絶時）
     */
    async activeToDiscard(playerId, cardId, options = {}) {
        const sourceElement = this.findCardElement(playerId, cardId, 'active');
        
        if (!sourceElement) return;

        // 気絶アニメーション
        await this.animate(sourceElement, 'anim-card-knockout', ANIMATION_TIMING.slow);
    }

    /**
     * ベンチからアクティブへの昇格
     */
    async benchToActive(playerId, cardId, options = {}) {
        const { benchIndex = 0 } = options;
        const sourceElement = this.findBenchSlot(playerId, benchIndex);
        const targetElement = this.findZoneElement(playerId, 'active');
        
        if (!sourceElement || !targetElement) return;

        await this.animate(sourceElement, 'anim-card-promote', ANIMATION_TIMING.normal);
    }

    /**
     * デッキから手札へ（ドロー）
     */
    async deckToHand(playerId, cardId, options = {}) {
        const deckElement = this.findZoneElement(playerId, 'deck');
        const handElement = this.findZoneElement(playerId, 'hand');
        
        if (!deckElement || !handElement) return;

        // デッキリフト → 手札スライド
        await this.animate(deckElement, 'anim-deck-lift', ANIMATION_TIMING.fast);
        await this.delay(100);
        await this.animate(handElement, 'anim-card-draw', ANIMATION_TIMING.normal);
    }

    /**
     * 汎用移動（フォールバック）
     */
    async genericMove(playerId, cardId, from, to, options = {}) {
        const sourceElement = this.findCardElement(playerId, cardId, from);
        
        if (!sourceElement) return;

        await this.animate(sourceElement, 'anim-card-move', ANIMATION_TIMING.normal);
    }

    /**
     * 複数カード同時配布（セットアップ時）
     */
    async dealMultiple(cards, options = {}) {
        const { staggerDelay = 100 } = options;
        const promises = cards.map((card, index) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    this.move(card.playerId, card.cardId, card.transition).then(resolve);
                }, index * staggerDelay);
            });
        });
        
        await Promise.all(promises);
    }

    // ヘルパー関数
    findCardElement(playerId, cardId, zone) {
        return document.querySelector(`[data-owner="${playerId}"][data-zone="${zone}"] [data-card-id="${cardId}"]`);
    }

    findZoneElement(playerId, zone) {
        return document.querySelector(`[data-owner="${playerId}"][data-zone="${zone}"]`);
    }

    findBenchSlot(playerId, index) {
        return document.querySelector(`[data-owner="${playerId}"][data-zone="bench"][data-index="${index}"]`);
    }
}