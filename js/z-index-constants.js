/**
 * Z-INDEX-CONSTANTS.JS - Z-Index統一管理システム
 * 
 * 全ての要素のz-indexを一元管理し、レイヤリング問題を防ぐ
 */

/**
 * CSS変数に対応したZ-Indexマッピング
 * CSS変数の値をJavaScriptから参照可能にする
 */
export const Z_INDEX = {
    // === レイヤー1: 2Dプレイマット系 (0-95) ===
    BOARD_BG: 0,           // --z-board-bg (背景画像)
    BOARD: 10,             // --z-board (ゲームボード基底)
    PLACEHOLDER: 20,       // --z-placeholder (空スロット)
    PLACEHOLDER_HOVER: 30, // --z-placeholder-hover
    SLOTS: 40,             // --z-slots (スロット枠線)
    HAND_AREA: 50,         // --z-hand-area (手札エリア)

    // === サイドカードスタック (60-80) ===
    SIDE_STACK_1: 60,      // --z-side-stack-1
    SIDE_STACK_2: 70,      // --z-side-stack-2
    SIDE_STACK_3: 80,      // --z-side-stack-3

    // === レイヤー2: 3Dカード系 (90-140) ===
    DECK_EFFECTS: 90,      // --z-deck-effects (山札・サイド影)
    DECK_HOVER: 95,        // --z-deck-hover
    CARD: 100,             // --z-card (1枚カード通常)
    HIGHLIGHT: 110,        // --z-highlight (ハイライト効果)
    CARD_HOVER: 120,       // --z-card-hover
    CARD_EFFECTS: 130,     // --z-card-effects (ダメージ等)

    // === レイヤー3: 手札特別系 (200-210) ===
    HAND: 200,             // --z-hand (プレイヤー手札通常)
    HAND_HOVER: 210,       // --z-hand-hover

    // === レイヤー4: アニメーション系 (300-310) ===
    ANIMATIONS: 300,       // --z-animations (移動アニメーション)
    SELECTED: 310,         // --z-selected (選択状態)

    // === レイヤー5: UI・HUD系 (400-600) ===
    HUD_BASE: 400,         // --z-hud-base
    PANELS: 410,           // --z-panels
    FLOATING_HUD: 420,     // --z-floating-hud
    TOAST: 430,            // --z-toast
    MODALS: 500,           // --z-modals
    CRITICAL: 600          // --z-critical (致命的エラー・アニメーション)
};

/**
 * CSS変数名のマッピング
 */
export const Z_CSS_VARS = {
    BOARD_BG: 'var(--z-board-bg)',
    BOARD: 'var(--z-board)',
    PLACEHOLDER: 'var(--z-placeholder)',
    PLACEHOLDER_HOVER: 'var(--z-placeholder-hover)',
    SLOTS: 'var(--z-slots)',
    HAND_AREA: 'var(--z-hand-area)',
    SIDE_STACK_1: 'var(--z-side-stack-1)',
    SIDE_STACK_2: 'var(--z-side-stack-2)',
    SIDE_STACK_3: 'var(--z-side-stack-3)',
    DECK_EFFECTS: 'var(--z-deck-effects)',
    DECK_HOVER: 'var(--z-deck-hover)',
    CARD: 'var(--z-card)',
    HIGHLIGHT: 'var(--z-highlight)',
    CARD_HOVER: 'var(--z-card-hover)',
    CARD_EFFECTS: 'var(--z-card-effects)',
    HAND: 'var(--z-hand)',
    HAND_HOVER: 'var(--z-hand-hover)',
    ANIMATIONS: 'var(--z-animations)',
    SELECTED: 'var(--z-selected)',
    HUD_BASE: 'var(--z-hud-base)',
    PANELS: 'var(--z-panels)',
    FLOATING_HUD: 'var(--z-floating-hud)',
    TOAST: 'var(--z-toast)',
    MODALS: 'var(--z-modals)',
    CRITICAL: 'var(--z-critical)'
};

/**
 * Z-Index適用ヘルパー関数
 */
export class ZIndexManager {
    /**
     * 要素にz-indexを適用（CSS変数使用）
     * @param {Element} element - 対象要素
     * @param {string} level - Z_CSS_VARSのキー
     */
    static apply(element, level) {
        if (!element || !Z_CSS_VARS[level]) {
            console.warn(`Invalid element or z-index level: ${level}`);
            return;
        }
        element.style.zIndex = Z_CSS_VARS[level];
    }

    /**
     * 複数要素に一括適用
     * @param {Element[]} elements - 要素配列
     * @param {string} level - Z_CSS_VARSのキー
     */
    static applyToAll(elements, level) {
        elements.forEach(el => this.apply(el, level));
    }

    /**
     * アニメーション中の要素を最前面に
     * @param {Element} element - アニメーション要素
     */
    static setAnimating(element) {
        this.apply(element, 'CRITICAL');
    }

    /**
     * 選択状態の要素
     * @param {Element} element - 選択された要素
     */
    static setSelected(element) {
        this.apply(element, 'SELECTED');
    }

    /**
     * ホバー状態の手札カード
     * @param {Element} element - 手札カード要素
     */
    static setHandHover(element) {
        this.apply(element, 'HAND_HOVER');
    }

    /**
     * 通常の手札カード
     * @param {Element} element - 手札カード要素
     */
    static setHandNormal(element) {
        this.apply(element, 'HAND');
    }

    /**
     * z-indexをリセット（初期値に戻す）
     * @param {Element} element - 対象要素
     */
    static reset(element) {
        if (element) {
            element.style.zIndex = '';
        }
    }

    /**
     * デバッグ用：全Z-Index値を出力
     */
    static debug() {
        console.table(Z_INDEX);
    }

    /**
     * プレイマットより上に確実に表示する
     * @param {Element} element - 対象要素
     */
    static ensureAbovePlaymat(element) {
        this.apply(element, 'CARD');
    }

    /**
     * プレイマットより下に隠す
     * @param {Element} element - 対象要素
     */
    static sendBelowPlaymat(element) {
        this.apply(element, 'BOARD_BG');
    }
}

/**
 * レガシーサポート（既存コードとの互換性）
 */
export const LEGACY_Z_INDEX = {
    CARD: Z_INDEX.CARD.toString(),
    HAND: Z_INDEX.HAND.toString(),
    HAND_HOVER: Z_INDEX.HAND_HOVER.toString(),
    CARD_EFFECTS: Z_INDEX.CARD_EFFECTS.toString(),
    MODAL_TEMP: Z_INDEX.MODALS.toString()
};