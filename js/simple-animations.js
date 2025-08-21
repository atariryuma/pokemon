/**
 * SIMPLE-ANIMATIONS.JS - シンプルなアニメーションシステム
 * 
 * ポケモンカードゲームに必要な基本アニメーション機能のみ提供
 */

import { getCardImagePath } from './state.js';

/**
 * シンプルなアニメーション管理クラス
 */
export class SimpleAnimationManager {
  constructor() {
    this.activeAnimations = new Map();
  }

  /**
   * カード移動アニメーション（基本）
   */
  async animateCardMove(fromElement, toElement, duration = 500) {
    return new Promise(resolve => {
      if (!fromElement || !toElement) {
        resolve();
        return;
      }

      const fromRect = fromElement.getBoundingClientRect();
      const toRect = toElement.getBoundingClientRect();

      // アニメーション要素を作成
      const animEl = fromElement.cloneNode(true);
      animEl.style.position = 'fixed';
      animEl.style.left = `${fromRect.left}px`;
      animEl.style.top = `${fromRect.top}px`;
      animEl.style.zIndex = '1000';
      animEl.style.transition = `all ${duration}ms ease-out`;
      
      document.body.appendChild(animEl);

      setTimeout(() => {
        animEl.style.left = `${toRect.left}px`;
        animEl.style.top = `${toRect.top}px`;
        
        setTimeout(() => {
          if (document.body.contains(animEl)) {
            document.body.removeChild(animEl);
          }
          resolve();
        }, duration);
      }, 50);
    });
  }

  /**
   * フェードイン
   */
  async fadeIn(element, duration = 300) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }
      
      element.style.opacity = '0';
      element.style.transition = `opacity ${duration}ms ease`;
      
      setTimeout(() => {
        element.style.opacity = '1';
        setTimeout(resolve, duration);
      }, 50);
    });
  }

  /**
   * フェードアウト
   */
  async fadeOut(element, duration = 300) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }
      
      element.style.transition = `opacity ${duration}ms ease`;
      element.style.opacity = '0';
      setTimeout(resolve, duration);
    });
  }

  /**
   * スケールアニメーション
   */
  async scale(element, fromScale = 0.8, toScale = 1, duration = 400) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }
      
      element.style.transform = `scale(${fromScale})`;
      element.style.transition = `transform ${duration}ms ease`;
      
      setTimeout(() => {
        element.style.transform = `scale(${toScale})`;
        setTimeout(resolve, duration);
      }, 50);
    });
  }

  /**
   * シェイクアニメーション
   */
  async shake(element, intensity = 5, duration = 500) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }
      
      let iterations = 0;
      const maxIterations = duration / 50;
      
      const shakeInterval = setInterval(() => {
        const x = (Math.random() - 0.5) * intensity * 2;
        const y = (Math.random() - 0.5) * intensity * 2;
        element.style.transform = `translate(${x}px, ${y}px)`;
        
        iterations++;
        if (iterations >= maxIterations) {
          clearInterval(shakeInterval);
          element.style.transform = '';
          resolve();
        }
      }, 50);
    });
  }

  // ===== 指定フローに必要な機能 =====

  /**
   * 手札配布アニメーション（一括出現）
   */
  async animateHandDealCards(playerId, count = 7) {
    const handSelector = playerId === 'player' ? '#player-hand' : '#cpu-hand';
    const handElement = document.querySelector(handSelector);
    
    if (handElement) {
      return await this.scale(handElement, 0.8, 1, 500);
    }
  }

  /**
   * ポケモン配置アニメーション
   */
  async animatePokemonPlacement(cardElement, targetZone, duration = 400) {
    if (cardElement) {
      return await this.scale(cardElement, 0.8, 1, duration);
    }
  }

  /**
   * エネルギー付与アニメーション
   */
  async animateEnergyAttachment(energyElement, pokemonElement) {
    if (energyElement && pokemonElement) {
      return await this.animateCardMove(energyElement, pokemonElement, 400);
    }
  }

  /**
   * 攻撃アニメーション
   */
  async animateAttack(attackerElement, defenderElement) {
    if (attackerElement) {
      await this.scale(attackerElement, 1, 1.1, 200);
      await this.scale(attackerElement, 1.1, 1, 200);
    }
    
    if (defenderElement) {
      await this.shake(defenderElement, 8, 400);
    }
  }

  /**
   * ノックアウトアニメーション
   */
  async animateKnockout(pokemonElement) {
    if (pokemonElement) {
      await this.fadeOut(pokemonElement, 800);
    }
  }

  /**
   * カードドローアニメーション
   */
  async animateCardDraw(playerId, cardElement) {
    if (cardElement) {
      return await this.fadeIn(cardElement, 300);
    }
  }

  /**
   * サイドカード配置アニメーション
   */
  async animatePrizeDistribution(playerId, count = 6) {
    const prizeSelector = playerId === 'player' ? '#player-prize-area' : '#cpu-prize-area';
    const prizeElement = document.querySelector(prizeSelector);
    
    if (prizeElement) {
      return await this.fadeIn(prizeElement, 600);
    }
  }

  /**
   * 個別サイドカードアニメーション
   */
  async animateSinglePrizeCard(playerId, index) {
    const prizeSelector = `[data-owner="${playerId}"][data-zone="prize"][data-index="${index}"]`;
    const prizeElement = document.querySelector(prizeSelector);
    
    if (prizeElement) {
      return await this.scale(prizeElement, 0.8, 1, 300);
    }
  }

  /**
   * メッセージアニメーション
   */
  async animateMessage(messageElement) {
    if (messageElement) {
      return await this.fadeIn(messageElement, 300);
    }
  }

  /**
   * エラーアニメーション
   */
  async animateError(errorElement) {
    if (errorElement) {
      await this.shake(errorElement, 5, 500);
    }
  }

  /**
   * カードハイライト
   */
  highlightCard(cardElement, type = 'default') {
    if (cardElement) {
      cardElement.classList.add('highlight-available');
      if (type === 'glow') {
        cardElement.style.boxShadow = '0 0 20px rgba(100, 200, 255, 0.8)';
      }
    }
  }

  /**
   * ハイライト解除
   */
  unhighlightCard(cardElement) {
    if (cardElement) {
      cardElement.classList.remove('highlight-available');
      cardElement.style.boxShadow = '';
    }
  }

  /**
   * プライズ取得アニメーション
   */
  async animatePrizeTake(playerId, prizeIndex) {
    const prizeSelector = `[data-owner="${playerId}"][data-zone="prize"][data-index="${prizeIndex}"]`;
    const prizeElement = document.querySelector(prizeSelector);
    
    if (prizeElement) {
      return await this.animateCardMove(prizeElement, document.querySelector(`#${playerId}-hand`), 500);
    }
  }

  /**
   * 画面シェイク効果
   */
  createScreenShakeEffect(intensity = 'normal') {
    const shakeIntensity = intensity === 'light' ? 3 : intensity === 'heavy' ? 10 : 6;
    return this.shake(document.body, shakeIntensity, 300);
  }

  // ===== 後方互換性のための関数エイリアス =====

  async createUnifiedCardAnimation(playerId, cardId, sourceZone, targetZone, targetIndex, options = {}) {
    // 簡素化版：基本的な移動アニメーションのみ
    const sourceElement = document.querySelector(`[data-card-id="${cardId}"]`);
    const targetElement = document.querySelector(`[data-zone="${targetZone}"]`);
    
    if (sourceElement && targetElement) {
      return await this.animateCardMove(sourceElement, targetElement, 400);
    }
  }

  async createUnifiedAttackAnimation(attackerId, defenderId) {
    const attackerElement = document.querySelector(`[data-owner="${attackerId}"][data-zone="active"]`);
    const defenderElement = document.querySelector(`[data-owner="${defenderId}"][data-zone="active"]`);
    
    return await this.animateAttack(attackerElement, defenderElement);
  }

  async createUnifiedEnergyAnimation(playerId, energyId, pokemonId) {
    // エネルギー付与のシンプル版
    const pokemonElement = document.querySelector(`[data-card-id="${pokemonId}"]`);
    if (pokemonElement) {
      return await this.scale(pokemonElement, 1, 1.05, 300);
    }
  }

  // デッキシャッフルなどの複合アニメーション
  async animateDeckShuffle(playerIds) {
    const promises = playerIds.map(playerId => {
      const deckElement = document.querySelector(`#${playerId}-deck`);
      if (deckElement) {
        return this.shake(deckElement, 3, 800);
      }
    });
    
    return Promise.all(promises);
  }
}

// デフォルトインスタンス
export const unifiedAnimationManager = new SimpleAnimationManager();