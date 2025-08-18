/**
 * ANIMATIONS.JS - アニメーションシステム
 * 
 * CSSアニメーションの管理とゲームイベントとの統合
 */

/**
 * アニメーション管理クラス
 */
export class AnimationManager {
  constructor() {
    // アクティブなアニメーション追跡
    this.activeAnimations = new Map();
    
    // アニメーション設定
    this.config = {
      durations: {
        fast: 150,
        normal: 300,
        slow: 500,
        dealCard: 600,
        drawCard: 400,
        playCard: 500,
        attack: 800,
        damage: 600,
        knockout: 1200,
        energyAttach: 700
      }
    };
    
    console.log('🎬 Animation Manager initialized');
  }
  
  /**
   * カードディール アニメーション
   * @param {Array<Element>} cardElements - カード要素の配列
   * @param {number} staggerDelay - 遅延時間（ミリ秒）
   */
  async animateDealCards(cardElements, staggerDelay = 100) {
    const promises = cardElements.map((element, index) => {
      return new Promise(resolve => {
        setTimeout(() => {
          this.addAnimationClass(element, 'animate-deal-card');
          this.waitForAnimation(element, 'dealCard', resolve);
        }, index * staggerDelay);
      });
    });
    
    return Promise.all(promises);
  }
  
  /**
   * カードドロー アニメーション
   * @param {Element} cardElement - カード要素
   */
  async animateDrawCard(cardElement) {
    return new Promise(resolve => {
      this.addAnimationClass(cardElement, 'animate-draw-card');
      this.waitForAnimation(cardElement, 'drawCard', resolve);
    });
  }
  
  /**
   * カードプレイ アニメーション
   * @param {Element} cardElement - カード要素
   * @param {Object} fromPosition - 開始位置 {x, y}
   * @param {Object} toPosition - 終了位置 {x, y}
   */
  async animatePlayCard(cardElement, fromPosition, toPosition) {
    return new Promise(resolve => {
      // 一時的に絶対位置に設定
      const originalStyle = {
        position: cardElement.style.position,
        left: cardElement.style.left,
        top: cardElement.style.top,
        zIndex: cardElement.style.zIndex
      };
      
      cardElement.style.position = 'fixed';
      cardElement.style.left = `${fromPosition.x}px`;
      cardElement.style.top = `${fromPosition.y}px`;
      cardElement.style.zIndex = '1000';
      
      // アニメーション実行
      cardElement.style.transition = `all ${this.config.durations.playCard}ms ease-out`;
      cardElement.style.left = `${toPosition.x}px`;
      cardElement.style.top = `${toPosition.y}px`;
      
      setTimeout(() => {
        // スタイルを復元
        Object.assign(cardElement.style, originalStyle);
        this.addAnimationClass(cardElement, 'animate-play-card');
        this.waitForAnimation(cardElement, 'playCard', resolve);
      }, this.config.durations.playCard);
    });
  }
  
  /**
   * 攻撃アニメーション
   * @param {Element} attackerElement - 攻撃側要素
   * @param {Element} defenderElement - 防御側要素
   */
  async animateAttack(attackerElement, defenderElement) {
    const attackerPromise = new Promise(resolve => {
      this.addAnimationClass(attackerElement, 'animate-attack');
      this.waitForAnimation(attackerElement, 'attackForward', resolve);
    });
    
    // 少し遅れてダメージアニメーション
    const defenderPromise = new Promise(resolve => {
      setTimeout(() => {
        this.addAnimationClass(defenderElement, 'animate-damage');
        this.waitForAnimation(defenderElement, 'damageShake', resolve);
      }, 300);
    });
    
    return Promise.all([attackerPromise, defenderPromise]);
  }
  
  /**
   * HPダメージアニメーション
   * @param {Element} hpElement - HP表示要素
   */
  async animateHPDamage(hpElement) {
    return new Promise(resolve => {
      this.addAnimationClass(hpElement, 'animate-hp-damage');
      this.waitForAnimation(hpElement, 'hpFlash', resolve);
    });
  }
  
  /**
   * ポケモンきぜつアニメーション
   * @param {Element} pokemonElement - ポケモン要素
   */
  async animateKnockout(pokemonElement) {
    return new Promise(resolve => {
      this.addAnimationClass(pokemonElement, 'animate-knockout');
      this.waitForAnimation(pokemonElement, 'knockout', resolve);
    });
  }
  
  /**
   * エネルギー付与アニメーション
   * @param {Element} energyElement - エネルギー要素
   * @param {Element} targetElement - 対象ポケモン要素
   */
  async animateEnergyAttach(energyElement, targetElement) {
    return new Promise(resolve => {
      // エネルギーカードを対象に移動
      const energyRect = energyElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      
      energyElement.style.position = 'fixed';
      energyElement.style.left = `${energyRect.left}px`;
      energyElement.style.top = `${energyRect.top}px`;
      energyElement.style.zIndex = '1000';
      
      energyElement.style.transition = `all ${this.config.durations.energyAttach}ms ease-out`;
      energyElement.style.left = `${targetRect.left + targetRect.width - 20}px`;
      energyElement.style.top = `${targetRect.top + targetRect.height - 20}px`;
      energyElement.style.transform = 'scale(0.6)';
      
      setTimeout(() => {
        this.addAnimationClass(energyElement, 'animate-energy-attach');
        this.waitForAnimation(energyElement, 'energyAttach', resolve);
      }, this.config.durations.energyAttach);
    });
  }
  
  /**
   * カード選択ハイライト
   * @param {Element} cardElement - カード要素
   */
  highlightCard(cardElement) {
    this.addAnimationClass(cardElement, 'card-selected');
  }
  
  /**
   * カード選択解除
   * @param {Element} cardElement - カード要素
   */
  unhighlightCard(cardElement) {
    this.removeAnimationClass(cardElement, 'card-selected');
  }
  
  /**
   * スロットハイライト
   * @param {Element} slotElement - スロット要素
   * @param {string} type - ハイライトタイプ ('slot' | 'energy')
   */
  highlightSlot(slotElement, type = 'slot') {
    const className = type === 'energy' ? 'energy-target-highlight' : 'slot-highlight';
    this.addAnimationClass(slotElement, className);
  }
  
  /**
   * スロットハイライト解除
   * @param {Element} slotElement - スロット要素
   * @param {string} type - ハイライトタイプ ('slot' | 'energy')
   */
  unhighlightSlot(slotElement, type = 'slot') {
    const className = type === 'energy' ? 'energy-target-highlight' : 'slot-highlight';
    this.removeAnimationClass(slotElement, className);
  }
  
  /**
   * 全スロットハイライト解除
   */
  clearAllHighlights() {
    const highlights = document.querySelectorAll('.slot-highlight, .energy-target-highlight, .card-selected');
    highlights.forEach(element => {
      element.classList.remove('slot-highlight', 'energy-target-highlight', 'card-selected');
    });
  }
  
  /**
   * ゲームメッセージアニメーション
   * @param {Element} messageElement - メッセージ要素
   */
  animateMessage(messageElement) {
    this.addAnimationClass(messageElement, 'animate-fade-in');
  }
  
  /**
   * エラーメッセージアニメーション
   * @param {Element} messageElement - メッセージ要素
   */
  animateError(messageElement) {
    this.addAnimationClass(messageElement, 'error-message');
    
    setTimeout(() => {
      this.removeAnimationClass(messageElement, 'error-message');
    }, 1000);
  }
  
  /**
   * 手札カード入場アニメーション
   * @param {Array<Element>} cardElements - カード要素配列
   */
  async animateHandEntry(cardElements) {
    const promises = cardElements.map((element, index) => {
      return new Promise(resolve => {
        element.style.animationDelay = `${index * 50}ms`;
        this.addAnimationClass(element, 'animate-slide-in-bottom');
        this.waitForAnimation(element, 'slideInBottom', () => {
          element.style.animationDelay = '';
          resolve();
        });
      });
    });
    
    return Promise.all(promises);
  }
  
  /**
   * モーダル表示アニメーション
   * @param {Element} modalElement - モーダル要素
   */
  async animateModalShow(modalElement) {
    return new Promise(resolve => {
      modalElement.showModal();
      // CSSトランジションが自動的に適用される
      setTimeout(resolve, this.config.durations.normal);
    });
  }
  
  /**
   * モーダル非表示アニメーション
   * @param {Element} modalElement - モーダル要素
   */
  async animateModalHide(modalElement) {
    return new Promise(resolve => {
      modalElement.style.opacity = '0';
      modalElement.style.transform = 'scale(0.8)';
      
      setTimeout(() => {
        modalElement.close();
        modalElement.style.opacity = '';
        modalElement.style.transform = '';
        resolve();
      }, this.config.durations.normal);
    });
  }
  
  /**
   * アニメーションクラスを追加
   * @param {Element} element - 対象要素
   * @param {string} className - クラス名
   */
  addAnimationClass(element, className) {
    if (!element) return;
    
    element.classList.add(className);
    
    // アクティブアニメーション追跡
    if (!this.activeAnimations.has(element)) {
      this.activeAnimations.set(element, new Set());
    }
    this.activeAnimations.get(element).add(className);
  }
  
  /**
   * アニメーションクラスを削除
   * @param {Element} element - 対象要素
   * @param {string} className - クラス名
   */
  removeAnimationClass(element, className) {
    if (!element) return;
    
    element.classList.remove(className);
    
    // アクティブアニメーション追跡から削除
    if (this.activeAnimations.has(element)) {
      this.activeAnimations.get(element).delete(className);
      if (this.activeAnimations.get(element).size === 0) {
        this.activeAnimations.delete(element);
      }
    }
  }
  
  /**
   * アニメーション完了を待機
   * @param {Element} element - 対象要素
   * @param {string} animationName - アニメーション名
   * @param {Function} callback - コールバック関数
   */
  waitForAnimation(element, animationName, callback) {
    const duration = this.config.durations[animationName] || this.config.durations.normal;
    
    const cleanup = () => {
      element.classList.remove(`animate-${animationName.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
      if (callback) callback();
    };
    
    // animationendイベントとタイムアウトの両方で処理
    let completed = false;
    
    const handleAnimationEnd = (event) => {
      if (event.target === element && !completed) {
        completed = true;
        element.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    };
    
    element.addEventListener('animationend', handleAnimationEnd);
    
    // フォールバックタイマー
    setTimeout(() => {
      if (!completed) {
        completed = true;
        element.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    }, duration + 100);
  }
  
  /**
   * 全アニメーションをクリア
   */
  clearAllAnimations() {
    this.activeAnimations.forEach((classNames, element) => {
      classNames.forEach(className => {
        element.classList.remove(className);
      });
    });
    this.activeAnimations.clear();
  }
  
  /**
   * 要素の位置を取得
   * @param {Element} element - 要素
   * @returns {Object} 位置情報 {x, y, width, height}
   */
  getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    };
  }
  
  /**
   * 破棄処理
   */
  destroy() {
    this.clearAllAnimations();
    console.log('🎬 Animation Manager destroyed');
  }
}

// デフォルトのアニメーションマネージャーインスタンス
export const animationManager = new AnimationManager();