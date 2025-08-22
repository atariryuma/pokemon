/**
 * CORE.JS - アニメーションコアクラス
 * 
 * シンプルで軽量なアニメーション基盤
 * 最小限のコードで最大の効果を提供
 */

export const ANIMATION_TIMING = {
    fast: 200,
    normal: 400, 
    slow: 800,
    combat: 600
};

export const ANIMATION_EASING = {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
};

/**
 * アニメーション基底クラス
 */
export class AnimationCore {
    constructor() {
        this.activeAnimations = new Set();
    }

    /**
     * 基本アニメーション実行
     * @param {Element} element - 対象要素
     * @param {string} className - CSSクラス名
     * @param {number} duration - 継続時間
     * @returns {Promise} 完了Promise
     */
    async animate(element, className, duration = ANIMATION_TIMING.normal) {
        if (!element) return;
        
        return new Promise(resolve => {
            // アニメーション開始
            element.classList.add(className);
            
            // 完了後クリーンアップ
            const cleanup = () => {
                element.classList.remove(className);
                this.activeAnimations.delete(cleanup);
                resolve();
            };
            
            this.activeAnimations.add(cleanup);
            setTimeout(cleanup, duration);
        });
    }

    /**
     * 全アニメーションクリーンアップ
     */
    async cleanup() {
        const promises = Array.from(this.activeAnimations);
        this.activeAnimations.clear();
        await Promise.all(promises.map(fn => fn()));
    }

    /**
     * 要素の基本情報取得
     */
    getElementRect(element) {
        if (!element) return null;
        return element.getBoundingClientRect();
    }

    /**
     * 遅延処理
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}