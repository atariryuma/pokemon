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
        hpDamage: 600,
        knockout: 1200,
        energyAttach: 700,
        slideInBottom: 500,
        fadeIn: 300
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
    console.log(`🎬 Starting deal animation for ${cardElements.length} cards`);
    
    const promises = cardElements.map((element, index) => {
      return new Promise(resolve => {
        setTimeout(() => {
          // カード要素が確実に見えるようにする
          if (element) {
            // アニメーション前に要素を完全に表示状態にする
            element.style.opacity = '1';
            element.style.visibility = 'visible';
            element.style.display = 'flex';
            element.style.transform = 'none'; // 初期transformをリセット
            
            // 子要素のimg要素も確実に見えるようにする
            const img = element.querySelector('img');
            if (img) {
              img.style.opacity = '1';
              img.style.visibility = 'visible';
              img.style.display = 'block';
            }
            
            // 強制的に再描画をトリガー
            element.offsetHeight;
            
            console.log(`🎴 Starting animation for card ${index + 1}/${cardElements.length}`);
            console.log(`  Before animation - opacity: ${element.style.opacity}, visibility: ${element.style.visibility}`);
            
            // CSSアニメーションを開始（opacity: 0 → 1 のアニメーションを実行）
            this.addAnimationClass(element, 'animate-deal-card');
            this.waitForAnimation(element, 'dealCard', () => {
              // アニメーション完了後に確実に表示状態を保証
              element.style.opacity = '1';
              element.style.visibility = 'visible';
              element.style.transform = 'none';
              console.log(`✅ Animation completed for card ${index + 1}, final opacity: ${element.style.opacity}`);
              resolve();
            });
          } else {
            console.warn(`⚠️ Card element ${index} is null`);
            resolve();
          }
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
      // Set initial position without transition
      cardElement.style.position = 'fixed';
      cardElement.style.left = `${fromPosition.x}px`;
      cardElement.style.top = `${fromPosition.y}px`;
      cardElement.style.zIndex = '9999';
      cardElement.style.transform = 'rotate(5deg)'; // Initial "lifted" state
      cardElement.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';

      // Force reflow to ensure initial styles are applied before transition starts
      cardElement.offsetHeight;

      // Apply transition and target position
      cardElement.style.transition = `all ${this.config.durations.playCard}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      cardElement.style.left = `${toPosition.x}px`;
      cardElement.style.top = `${toPosition.y}px`;
      cardElement.style.transform = 'scale(1) rotate(0deg)'; // Final state

      // Wait for the transition to complete
      cardElement.addEventListener('transitionend', function handler() {
        cardElement.removeEventListener('transitionend', handler);
        // Reset styles after animation
        cardElement.style.position = '';
        cardElement.style.left = '';
        cardElement.style.top = '';
        cardElement.style.zIndex = '';
        cardElement.style.transform = '';
        cardElement.style.boxShadow = '';
        cardElement.style.transition = '';
        resolve();
      }, { once: true });

      // Fallback for transitionend not firing (e.g., element removed)
      setTimeout(() => {
        resolve();
      }, this.config.durations.playCard + 50);
    });
  }
  
  /**
   * スムーズカード移動アニメーション
   * @param {Element} cardElement - カード要素
   * @param {Element} fromContainer - 移動元コンテナ
   * @param {Element} toContainer - 移動先コンテナ
   * @param {string} animationType - アニメーションタイプ
   */
  async animateSmoothCardMove(cardElement, fromContainer, toContainer, animationType = 'normal') {
    return new Promise(async resolve => {
      const fromRect = fromContainer.getBoundingClientRect();
      const toRect = toContainer.getBoundingClientRect();

      // Calculate center points
      const fromPos = {
        x: fromRect.left + fromRect.width / 2 - cardElement.offsetWidth / 2, // Adjust for card element's own width
        y: fromRect.top + fromRect.height / 2 - cardElement.offsetHeight / 2
      };

      const toPos = {
        x: toRect.left + toRect.width / 2 - cardElement.offsetWidth / 2, // Adjust for card element's own width
        y: toRect.top + toRect.height / 2 - cardElement.offsetHeight / 2
      };

      // Perform the animation
      await this.animatePlayCard(cardElement, fromPos, toPos);

      // Additional effects based on animationType (if any)
      if (animationType === 'evolution') {
        this.addAnimationClass(cardElement, 'animate-evolution-placement');
      }
      resolve();
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
      this.waitForAnimation(attackerElement, 'attack', resolve);
    });
    
    // 少し遅れてダメージアニメーション
    const defenderPromise = new Promise(resolve => {
      setTimeout(() => {
        this.addAnimationClass(defenderElement, 'animate-damage');
        this.waitForAnimation(defenderElement, 'damage', resolve);
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
      this.waitForAnimation(hpElement, 'hpDamage', resolve);
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
      const energyRect = energyElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      
      // Set initial position
      energyElement.style.position = 'fixed';
      energyElement.style.left = `${energyRect.left}px`;
      energyElement.style.top = `${energyRect.top}px`;
      energyElement.style.zIndex = '1000';
      
      // Force reflow
      energyElement.offsetHeight;

      // Apply transition and target styles
      energyElement.style.transition = `all ${this.config.durations.energyAttach}ms ease-out`;
      energyElement.style.left = `${targetRect.left + targetRect.width - 20}px`;
      energyElement.style.top = `${targetRect.top + targetRect.height - 20}px`;
      energyElement.style.transform = 'scale(0.6)';
      energyElement.style.opacity = '0'; // Fade out as it attaches

      // Wait for transition to complete
      energyElement.addEventListener('transitionend', function handler() {
        energyElement.removeEventListener('transitionend', handler);
        // Reset styles after animation
        energyElement.style.position = '';
        energyElement.style.left = '';
        energyElement.style.top = '';
        energyElement.style.zIndex = '';
        energyElement.style.transform = '';
        energyElement.style.opacity = '';
        energyElement.style.transition = '';
        resolve();
      }, { once: true });

      // Fallback for transitionend not firing
      setTimeout(() => {
        resolve();
      }, this.config.durations.energyAttach + 50);
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
  async animateMessage(messageElement) {
    return new Promise(resolve => {
      this.addAnimationClass(messageElement, 'animate-fade-in');
      this.waitForAnimation(messageElement, 'fadeIn', resolve);
    });
  }
  
  /**
   * エラーメッセージアニメーション
   * @param {Element} messageElement - メッセージ要素
   */
  async animateError(messageElement) {
    return new Promise(resolve => {
      this.addAnimationClass(messageElement, 'error-message');
      this.waitForAnimation(messageElement, 'damage', () => {
        this.removeAnimationClass(messageElement, 'error-message');
        resolve();
      });
    });
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
      // div要素の場合はhiddenクラスを削除
      if (modalElement.tagName.toLowerCase() === 'div') {
        modalElement.classList.remove('hidden');
        modalElement.style.opacity = '0';
        modalElement.style.transform = 'scale(0.8)';
        
        // フェードイン・スケールアップアニメーション
        requestAnimationFrame(() => {
          modalElement.style.transition = `opacity ${this.config.durations.normal}ms ease, transform ${this.config.durations.normal}ms ease`;
          modalElement.style.opacity = '1';
          modalElement.style.transform = 'scale(1)';
        });
        
        setTimeout(() => {
          modalElement.style.transition = '';
          resolve();
        }, this.config.durations.normal);
      } else {
        // dialog要素の場合は従来の方法
        modalElement.showModal();
        setTimeout(resolve, this.config.durations.normal);
      }
    });
  }
  
  /**
   * モーダル非表示アニメーション
   * @param {Element} modalElement - モーダル要素
   */
  async animateModalHide(modalElement) {
    return new Promise(resolve => {
      if (modalElement.tagName.toLowerCase() === 'div') {
        // div要素の場合はフェードアウト・スケールダウン
        modalElement.style.transition = `opacity ${this.config.durations.normal}ms ease, transform ${this.config.durations.normal}ms ease`;
        modalElement.style.opacity = '0';
        modalElement.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
          modalElement.classList.add('hidden');
          modalElement.style.transition = '';
          modalElement.style.opacity = '';
          modalElement.style.transform = '';
          resolve();
        }, this.config.durations.normal);
      } else {
        // dialog要素の場合は従来の方法
        modalElement.style.opacity = '0';
        modalElement.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
          modalElement.close();
          modalElement.style.opacity = '';
          modalElement.style.transform = '';
          resolve();
        }, this.config.durations.normal);
      }
    });
  }
  
  /**
   * 進化アニメーション
   * @param {Element} pokemonElement - 進化するポケモン要素
   * @param {Object} evolutionCard - 進化先カード
   */
  async animateEvolution(pokemonElement, evolutionCard) {
    return new Promise(resolve => {
      // 進化エフェクト
      this.addAnimationClass(pokemonElement, 'animate-evolution');
      
      // 光のエフェクトを追加
      const lightEffect = document.createElement('div');
      lightEffect.className = 'evolution-light';
      lightEffect.style.cssText = `
        position: absolute;
        inset: -20px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 70%);
        animation: evolutionGlow ${this.config.durations.knockout}ms ease-in-out;
        pointer-events: none;
        z-index: 10;
      `;
      
      pokemonElement.style.position = 'relative';
      pokemonElement.appendChild(lightEffect);
      
      // アニメーション終了後のクリーンアップ
      setTimeout(() => {
        this.removeAnimationClass(pokemonElement, 'animate-evolution');
        lightEffect.remove();
        
        // カード画像を更新（簡略化）
        const cardImage = pokemonElement.querySelector('.card-image');
        if (cardImage && evolutionCard.name_en) {
          import('./data-manager.js').then(({getCardImagePath}) => {
            cardImage.src = getCardImagePath(evolutionCard.name_en);
          });
        }
        
        resolve();
      }, this.config.durations.knockout);
    });
  }
  
  /**
   * 特殊状態アニメーション
   * @param {Element} pokemonElement - ポケモン要素
   * @param {string} condition - 特殊状態名
   */
  async animateSpecialCondition(pokemonElement, condition) {
    const effectClass = `animate-${condition}`;
    const duration = this.config.durations.normal;
    
    return new Promise(resolve => {
      this.addAnimationClass(pokemonElement, effectClass);
      
      // 状態アイコンを追加
      const statusIcon = document.createElement('div');
      statusIcon.className = `status-effect status-${condition}`;
      statusIcon.innerHTML = this._getConditionIcon(condition);
      statusIcon.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        z-index: 5;
      `;
      
      pokemonElement.style.position = 'relative';
      pokemonElement.appendChild(statusIcon);
      
      this.waitForAnimation(pokemonElement, effectClass.replace('animate-', ''), () => {
        this.removeAnimationClass(pokemonElement, effectClass);
        resolve();
      });
    });
  }
  
  /**
   * カードを裏面から表面にフリップするアニメーション
   * @param {Element} cardElement - カード要素
   * @param {string} newImageSrc - 表面の画像パス
   */
  async flipCardFaceUp(cardElement, newImageSrc) {
    return new Promise(resolve => {
      if (!cardElement || !newImageSrc) {
        console.warn('flipCardFaceUp: Missing cardElement or newImageSrc');
        return resolve();
      }

      const imgElement = cardElement.querySelector('img');
      if (!imgElement) {
        console.warn('flipCardFaceUp: img element not found in cardElement');
        return resolve();
      }

      // 最初の半分のアニメーション（裏面が見えなくなるまで）
      imgElement.style.transition = 'transform 0.3s ease-in';
      imgElement.style.transform = 'rotateY(90deg)';

      setTimeout(() => {
        // 画像を切り替える
        imgElement.src = newImageSrc;
        imgElement.alt = 'Card Front';

        // 後半のアニメーション（表面が見えるように）
        imgElement.style.transition = 'transform 0.3s ease-out';
        imgElement.style.transform = 'rotateY(180deg)'; // 最終的に0degに戻るように

        // アニメーション完了後にスタイルをリセット
        imgElement.addEventListener('transitionend', function handler() {
          imgElement.removeEventListener('transitionend', handler);
          imgElement.style.transition = '';
          imgElement.style.transform = ''; // 最終状態をリセット
          resolve();
        }, { once: true });
      }, 300); // 0.3s後に画像を切り替え
    });
  }
  
  /**
   * 状態アイコンを取得
   * @param {string} condition - 状態名
   * @returns {string} アイコン文字
   */
  _getConditionIcon(condition) {
    const icons = {
      poisoned: '☣️',
      burned: '🔥',
      asleep: '💤',
      paralyzed: '⚡',
      confused: '💫'
    };
    return icons[condition] || '❓';
  }
  
  /**
   * 高度な攻撃エフェクトアニメーション
   * @param {Element} attackerElement - 攻撃側要素
   * @param {Element} defenderElement - 防御側要素
   * @param {string} attackType - 攻撃タイプ
   */
  async animateAdvancedAttack(attackerElement, defenderElement, attackType = 'normal') {
    const attackerRect = attackerElement.getBoundingClientRect();
    const defenderRect = defenderElement.getBoundingClientRect();
    
    // エフェクトコンテナを作成
    const effectContainer = document.createElement('div');
    effectContainer.className = 'attack-effect-container';
    effectContainer.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 10000;
    `;
    
    document.body.appendChild(effectContainer);
    
    try {
      switch (attackType) {
        case 'lightning':
          await this._createLightningEffect(effectContainer, attackerRect, defenderRect);
          break;
        case 'fire':
          await this._createFireEffect(effectContainer, attackerRect, defenderRect);
          break;
        case 'water':
          await this._createWaterEffect(effectContainer, attackerRect, defenderRect);
          break;
        case 'grass':
          await this._createGrassEffect(effectContainer, attackerRect, defenderRect);
          break;
        default:
          await this._createDefaultAttackEffect(effectContainer, attackerRect, defenderRect);
      }
      
      // 防御側のダメージアニメーション
      await this._animateDamageImpact(defenderElement);
      
    } finally {
      // エフェクトコンテナを削除
      setTimeout(() => {
        if (effectContainer.parentNode) {
          effectContainer.parentNode.removeChild(effectContainer);
        }
      }, 100);
    }
  }
  
  /**
   * デフォルト攻撃エフェクト
   */
  async _createDefaultAttackEffect(container, attackerRect, defenderRect) {
    return new Promise(resolve => {
      const blast = document.createElement('div');
      blast.className = 'default-attack-blast';
      
      blast.style.cssText = `
        position: absolute;
        left: ${defenderRect.left + defenderRect.width / 2}px;
        top: ${defenderRect.top + defenderRect.height / 2}px;
        width: 40px;
        height: 40px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(96, 165, 250, 0.6) 50%, transparent 100%);
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0);
        animation: attackBlast 300ms ease-out;
      `;
      
      container.appendChild(blast);
      
      setTimeout(() => {
        blast.remove();
        resolve();
      }, 300);
    });
  }
  
  /**
   * ダメージインパクトアニメーション
   */
  async _animateDamageImpact(defenderElement) {
    return new Promise(resolve => {
      defenderElement.style.filter = 'brightness(1.5) contrast(1.2)';
      defenderElement.style.transform = 'scale(1.02)';
      
      setTimeout(() => {
        defenderElement.style.filter = 'brightness(0.8)';
        defenderElement.style.transform = 'scale(0.98)';
      }, 100);
      
      setTimeout(() => {
        defenderElement.style.filter = '';
        defenderElement.style.transform = '';
        defenderElement.style.transition = 'all 200ms ease';
        resolve();
      }, 300);
    });
  }
  
  /**
   * アニメーションクラスを追加
   * @param {Element} element - 対象要素
   * @param {string} className - クラス名
   */
  addAnimationClass(element, className) {
    if (!element) return;
    
    // Debug: Check if this element has damage badges before animation
    const existingDamageBadges = element.querySelectorAll('[id^="damage-badge-"]');
    if (existingDamageBadges.length > 0) {
      console.log(`🎬 ⚠️ Animation starting on element with ${existingDamageBadges.length} damage badges. Animation: ${className}`);
      existingDamageBadges.forEach((badge, index) => {
        console.log(`  🏷️ Badge ${index + 1}: ${badge.id}, visibility: ${badge.style.visibility}, display: ${badge.style.display}`);
      });
    }
    
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
      // Debug: Check damage badges after animation cleanup
      const damagebadges = element.querySelectorAll('[id^="damage-badge-"]');
      if (damagebadges.length > 0) {
        console.log(`🎬 ✅ Animation cleanup for ${animationName}. ${damagebadges.length} damage badges still present`);
        damagebadges.forEach((badge, index) => {
          console.log(`  🏷️ Badge ${index + 1} after cleanup: ${badge.id}, visible: ${badge.style.visibility !== 'hidden' && badge.style.display !== 'none'}`);
        });
      }
      
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