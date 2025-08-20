/**
 * UNIFIED-ANIMATIONS.JS - 統一アニメーションシステム
 * 
 * プレイヤー・CPU共通のアニメーション処理を統一管理
 * 位置判定の統一、カード移動の最適化、重複コード削除
 */

import { animationManager } from './animations.js';

/**
 * 統一アニメーションマネージャー
 */
export class UnifiedAnimationManager {
  constructor() {
    console.log('🎬 Unified Animation Manager initialized');
  }

  /**
   * プレイヤー判定とセレクタ生成の統一
   */
  getPlayerSelector(playerId) {
    return playerId === 'player' ? '.player-self' : '.opponent-board';
  }

  getActiveSelector(playerId) {
    return playerId === 'player' ? '.active-bottom' : '.active-top';
  }

  getBenchSelector(playerId, index) {
    const prefix = playerId === 'player' ? 'bottom' : 'top';
    return `.${prefix}-bench-${index + 1}`;
  }

  getHandSelector(playerId) {
    return `#${playerId}-hand`;
  }

  /**
   * 要素の位置とサイズを取得
   */
  getElementRect(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    };
  }

  /**
   * カードの正確な画像情報を取得
   */
  getCardImageInfo(cardElement, card, isSetupPhase = false) {
    if (!cardElement || !card) return null;

    const imgElement = cardElement.querySelector('img');
    if (!imgElement) return null;

    // セットアップ中は裏向き、ゲーム中は表向き
    const shouldShowBack = isSetupPhase && card.setupFaceDown;
    
    return {
      element: imgElement,
      src: shouldShowBack ? 'assets/ui/card_back.webp' : imgElement.src,
      alt: shouldShowBack ? 'Card Back' : imgElement.alt || card.name_ja,
      shouldShowBack
    };
  }

  /**
   * 統一カードアニメーション（手札からフィールドへ）
   */
  async createUnifiedCardAnimation(playerId, cardId, sourceZone, targetZone, targetIndex, options = {}) {
    console.log(`🎬 Starting unified animation: ${playerId} ${cardId} ${sourceZone} -> ${targetZone}[${targetIndex}]`);
    
    try {
      const {
        isSetupPhase = false,
        duration = 600,
                    card = null,
            initialSourceRect = null // ★ 追加: 新しいオプションを受け取る
      } = options;

      // 移動元要素の取得
      const sourceElement = this.getSourceElement(playerId, sourceZone, cardId);
      if (!sourceElement) {
        console.warn(`⚠️ Source element not found: ${playerId} ${sourceZone} ${cardId}`);
        return;
      }

      // 移動先要素の取得
      const targetElement = this.getTargetElement(playerId, targetZone, targetIndex);
      if (!targetElement) {
        console.warn(`⚠️ Target element not found: ${playerId} ${targetZone}[${targetIndex}]`);
        return;
      }

      // 移動先に配置されたカード要素を取得
      const placedCardElement = targetElement.children[0];
      if (!placedCardElement) {
        console.warn(`⚠️ No card found in target: ${playerId} ${targetZone}[${targetIndex}]`);
        return;
      }

      // アニメーション実行
      await this.executeCardMoveAnimation(
        sourceElement, 
        targetElement, 
        placedCardElement, 
        card, 
        { playerId, isSetupPhase, duration, initialSourceRect } // ★ 追加: initialSourceRect を渡す
      );

      console.log(`✅ Unified animation completed: ${playerId} ${cardId} -> ${targetZone}[${targetIndex}]`);

    } catch (error) {
      console.error('❌ Error in unified card animation:', error);
    }
  }

  /**
   * 移動元要素の取得
   */
  getSourceElement(playerId, sourceZone, cardId) {
    switch (sourceZone) {
      case 'hand':
        return document.querySelector(this.getHandSelector(playerId));
      case 'deck':
        return document.querySelector(`${this.getPlayerSelector(playerId)} .deck-container`);
      default:
        console.warn(`Unknown source zone: ${sourceZone}`);
        return null;
    }
  }

  /**
   * 移動先要素の取得
   */
  getTargetElement(playerId, targetZone, targetIndex) {
    const playerSelector = this.getPlayerSelector(playerId);
    
    switch (targetZone) {
      case 'active':
        return document.querySelector(`${playerSelector} ${this.getActiveSelector(playerId)}`);
      case 'bench':
        return document.querySelector(`${playerSelector} ${this.getBenchSelector(playerId, targetIndex)}`);
      case 'hand':
        return document.querySelector(this.getHandSelector(playerId));
      case 'discard':
        return document.querySelector(`${playerSelector} .discard-container`);
      default:
        console.warn(`Unknown target zone: ${targetZone}`);
        return null;
    }
  }

  /**
   * カード移動アニメーションの実行
   */
  async executeCardMoveAnimation(sourceElement, targetElement, placedCardElement, card, options) {
    const { playerId, isSetupPhase, duration, initialSourceRect } = options; // ★ 変更: initialSourceRect を受け取る

    // 位置情報取得
    // ★ 変更: initialSourceRect があればそれを使用、なければ手札コンテナの位置を使用
    const sourceRect = initialSourceRect || this.getElementRect(sourceElement);
    const targetRect = this.getElementRect(targetElement);
    
    if (!sourceRect || !targetRect) {
      console.warn('⚠️ Could not get element positions for animation');
      return;
    }

    // カード画像情報取得
    const imageInfo = this.getCardImageInfo(placedCardElement, card, isSetupPhase);
    if (!imageInfo) {
      console.warn('⚠️ Could not get card image info');
      return;
    }

    // アニメーション用のクローン要素を作成
    const animCard = this.createAnimationCard(placedCardElement, imageInfo, sourceRect, playerId, options);
    
    // 元のカードを一時的に隠す
    placedCardElement.style.opacity = '0';
    
    // DOM に追加
    document.body.appendChild(animCard);
    
    // 強制リフロー
    animCard.offsetHeight;
    
    // アニメーション実行
    await this.performCardTransition(animCard, targetRect, duration);
    
    // 後処理
    this.cleanupAnimation(animCard, placedCardElement);
  }

  /**
   * アニメーション用カード要素の作成
   */
  createAnimationCard(originalCard, imageInfo, sourceRect, playerId, options) {
    const animCard = originalCard.cloneNode(true);
    
    // 画像の正確な設定
    const animImg = animCard.querySelector('img');
    if (animImg && imageInfo) {
      animImg.src = imageInfo.src;
      animImg.alt = imageInfo.alt;
      animImg.style.width = '100%';
      animImg.style.height = '100%';
      animImg.style.objectFit = 'cover';
    }

    // アニメーション用スタイル設定
    const handOffset = playerId === 'cpu' ? 20 : 50;
    
    // アニメーション用スタイル設定
    // ★ 変更: handOffset の適用方法を調整 (initialSourceRect があれば不要な場合も)
    // sourceRect がすでにカードの正確な位置であれば、handOffset は不要か、
    // 微調整用として小さくする
    const finalSourceLeft = sourceRect.left + (options.initialSourceRect ? 0 : (playerId === 'cpu' ? 20 : 50));
    const finalSourceTop = sourceRect.top + (options.initialSourceRect ? 0 : 20);
    
    animCard.style.cssText = `
      position: fixed;
      left: ${finalSourceLeft}px;
      top: ${finalSourceTop}px;
      width: ${originalCard.offsetWidth}px;
      height: ${originalCard.offsetHeight}px;
      z-index: 9999;
      transform: scale(0.8) rotate(-3deg);
      opacity: 0.9;
      pointer-events: none;
      border-radius: 8px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
      transition: none;
    `;

    return animCard;
  }

  /**
   * カード遷移アニメーション実行
   */
  async performCardTransition(animCard, targetRect, duration) {
    return new Promise(resolve => {
      // トランジション設定
      animCard.style.transition = `all ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      
      // 目標位置へ移動
      animCard.style.left = `${targetRect.left}px`;
      animCard.style.top = `${targetRect.top}px`;
      animCard.style.transform = 'scale(1) rotate(0deg)';
      animCard.style.opacity = '1';

      // アニメーション完了待機
      const handleTransitionEnd = () => {
        animCard.removeEventListener('transitionend', handleTransitionEnd);
        resolve();
      };

      animCard.addEventListener('transitionend', handleTransitionEnd, { once: true });

      // フォールバック
      setTimeout(handleTransitionEnd, duration + 100);
    });
  }

  /**
   * アニメーション後処理
   */
  cleanupAnimation(animCard, originalCard) {
    // アニメーション用カードを削除
    if (animCard.parentNode) {
      animCard.parentNode.removeChild(animCard);
    }

    // 元のカードを表示
    originalCard.style.opacity = '1';

    // 配置完了効果
    originalCard.style.transform = 'scale(1.1)';
    setTimeout(() => {
      originalCard.style.transition = 'transform 200ms ease';
      originalCard.style.transform = '';
      setTimeout(() => {
        originalCard.style.transition = '';
      }, 200);
    }, 150);
  }

  /**
   * エネルギー付与の統一アニメーション
   */
  async createUnifiedEnergyAnimation(playerId, energyCardId, targetPokemonId) {
    console.log(`🔋 Starting unified energy animation: ${playerId} ${energyCardId} -> ${targetPokemonId}`);
    
    try {
      // 手札のエネルギーカード要素を取得
      const handElement = document.querySelector(this.getHandSelector(playerId));
      if (!handElement) {
        console.warn(`⚠️ Hand element not found for ${playerId}`);
        return;
      }

      // 対象ポケモン要素を取得（アクティブまたはベンチ）
      const pokemonElement = this.findPokemonElement(playerId, targetPokemonId);
      if (!pokemonElement) {
        console.warn(`⚠️ Pokemon element not found: ${targetPokemonId}`);
        return;
      }

      // 手札の最後のカード（エネルギー想定）を取得
      const handCards = handElement.querySelectorAll('.relative');
      const energyCard = handCards.length > 0 ? handCards[handCards.length - 1] : null;
      
      if (!energyCard) {
        console.warn(`⚠️ Energy card not found in ${playerId} hand`);
        return;
      }

      // アニメーション実行
      await animationManager.animateEnergyAttach(energyCard, pokemonElement);
      
      console.log(`✅ Unified energy animation completed: ${playerId}`);

    } catch (error) {
      console.error('❌ Error in unified energy animation:', error);
    }
  }

  /**
   * ポケモン要素を検索（アクティブ・ベンチ両方）
   */
  findPokemonElement(playerId, pokemonId) {
    const playerSelector = this.getPlayerSelector(playerId);
    
    // アクティブポケモンをチェック
    const activeElement = document.querySelector(`${playerSelector} ${this.getActiveSelector(playerId)}`);
    if (activeElement && this.isPokemonInElement(activeElement, pokemonId)) {
      return activeElement;
    }

    // ベンチポケモンをチェック
    for (let i = 0; i < 5; i++) {
      const benchElement = document.querySelector(`${playerSelector} ${this.getBenchSelector(playerId, i)}`);
      if (benchElement && this.isPokemonInElement(benchElement, pokemonId)) {
        return benchElement;
      }
    }

    return null;
  }

  /**
   * 要素内に指定ポケモンがいるかチェック
   */
  isPokemonInElement(element, pokemonId) {
    const cardElement = element.querySelector('[data-card-id]');
    return cardElement && cardElement.getAttribute('data-card-id') === pokemonId;
  }

  /**
   * 攻撃アニメーションの統一処理
   */
  async createUnifiedAttackAnimation(attackerPlayerId, defenderPlayerId, attackType = 'normal') {
    console.log(`⚔️ Starting unified attack animation: ${attackerPlayerId} -> ${defenderPlayerId}`);
    
    try {
      const attackerElement = document.querySelector(
        `${this.getPlayerSelector(attackerPlayerId)} ${this.getActiveSelector(attackerPlayerId)}`
      );
      const defenderElement = document.querySelector(
        `${this.getPlayerSelector(defenderPlayerId)} ${this.getActiveSelector(defenderPlayerId)}`
      );

      if (!attackerElement || !defenderElement) {
        console.warn('⚠️ Attack animation: Missing attacker or defender element');
        return;
      }

      // 統一攻撃アニメーション実行
      await animationManager.animateAttack(attackerElement, defenderElement);
      
      console.log(`✅ Unified attack animation completed`);

    } catch (error) {
      console.error('❌ Error in unified attack animation:', error);
    }
  }

  /**
   * ノックアウトアニメーションの統一処理
   */
  async createUnifiedKnockoutAnimation(playerId, pokemonId) {
    console.log(`💀 Starting unified knockout animation: ${playerId} ${pokemonId}`);
    
    try {
      const pokemonElement = this.findPokemonElement(playerId, pokemonId);
      if (!pokemonElement) {
        console.warn(`⚠️ Pokemon element not found for knockout: ${pokemonId}`);
        return;
      }

      await animationManager.animateKnockout(pokemonElement);
      
      console.log(`✅ Unified knockout animation completed: ${pokemonId}`);

    } catch (error) {
      console.error('❌ Error in unified knockout animation:', error);
    }
  }

  /**
   * システムリセット
   */
  reset() {
    console.log('🔄 Unified Animation Manager reset');
  }
}

// デフォルトの統一アニメーションマネージャーインスタンス
export const unifiedAnimationManager = new UnifiedAnimationManager();