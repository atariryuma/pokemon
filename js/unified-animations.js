/**
 * UNIFIED-ANIMATIONS.JS - 統一アニメーションシステム
 * 
 * プレイヤー・CPU共通のアニメーション処理を統一管理
 * 位置判定の統一、カード移動の最適化、重複コード削除
 */

import { CardOrientationManager } from './card-orientation.js';

/**
 * アニメーション統一設定
 */
export const ANIMATION_CONFIG = {
  durations: {
    fast: 200,
    normal: 400,
    slow: 600,
    gameOver: 1500,
    phaseTransition: 300,
    cardMove: 500,
    dealCard: 600,
    attack: 800,
    damage: 600
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  }
};

/**
 * 統一アニメーションマネージャー
 */
export class UnifiedAnimationManager {
  constructor() {
    console.log('🎬 Unified Animation Manager initialized');
    this.activeAnimations = new Set();
    this.phaseTransitionQueue = [];
    
    // animations.jsの機能統合
    this.animationMap = new Map();
  }

  /**
   * アニメーションクラスを追加
   * @param {Element} element - 対象要素
   * @param {string} animationClass - アニメーションクラス名
   */
  addAnimationClass(element, animationClass) {
    if (element) {
      element.classList.add(animationClass);
    }
  }

  /**
   * アニメーションクラスを削除
   * @param {Element} element - 対象要素
   * @param {string} animationClass - アニメーションクラス名
   */
  removeAnimationClass(element, animationClass) {
    if (element) {
      element.classList.remove(animationClass);
    }
  }

  /**
   * アニメーション完了を待機
   * @param {Element} element - 対象要素
   * @param {string} animationName - アニメーション名
   * @param {Function} callback - コールバック関数
   */
  waitForAnimation(element, animationName, callback) {
    if (!element) return callback();

    const duration = ANIMATION_CONFIG.durations[animationName] || ANIMATION_CONFIG.durations.normal;
    
    setTimeout(() => {
      callback();
    }, duration);
  }

  /**
   * カードディール アニメーション（animations.jsより統合）
   * @param {Array<Element>} cardElements - カード要素の配列
   * @param {number} staggerDelay - 遅延時間（ミリ秒）
   */
  async animateDealCards(cardElements, staggerDelay = 100) {
    const promises = cardElements.map((element, index) => {
      return new Promise(resolve => {
        setTimeout(() => {
          if (element) {
            const target = element.querySelector('img') || element;
            
            // JSで表示状態にしてからアニメーション開始
            element.style.opacity = '1';

            this.addAnimationClass(target, 'animate-deal-card');

            this.waitForAnimation(target, 'dealCard', () => {
              resolve();
            });
          } else {
            resolve();
          }
        }, index * staggerDelay);
      });
    });
    
    return Promise.all(promises);
  }

  /**
   * カードドロー アニメーション（animations.jsより統合）
   * @param {Element} cardElement - カード要素
   */
  async animateDrawCard(cardElement) {
    return new Promise(resolve => {
      const target = cardElement?.querySelector('img') || cardElement;
      if (!target) return resolve();
      if (target.tagName && target.tagName.toLowerCase() === 'img') {
        target.classList.add('is-animating', 'is-hidden');
      }
      this.addAnimationClass(target, 'animate-draw-card');
      this.waitForAnimation(target, 'drawCard', () => {
        if (target.tagName && target.tagName.toLowerCase() === 'img') {
          target.classList.remove('is-animating', 'is-hidden');
        }
        resolve();
      });
    });
  }

  /**
   * メッセージアニメーション（animations.jsより統合）
   * @param {Element} messageElement - メッセージ要素
   */
  async animateMessage(messageElement) {
    if (!messageElement) return;
    
    messageElement.style.opacity = '0';
    messageElement.style.transform = 'translateY(-10px)';
    
    // フェードイン
    await new Promise(resolve => {
      setTimeout(() => {
        messageElement.style.transition = 'opacity 300ms ease, transform 300ms ease';
        messageElement.style.opacity = '1';
        messageElement.style.transform = 'translateY(0)';
        resolve();
      }, 50);
    });
  }

  /**
   * エラーメッセージアニメーション（animations.jsより統合）
   * @param {Element} messageElement - メッセージ要素
   */
  async animateError(messageElement) {
    if (!messageElement) return;
    
    // 振動エフェクト
    messageElement.style.animation = 'shake 0.5s ease-in-out';
    
    setTimeout(() => {
      messageElement.style.animation = '';
    }, 500);
  }

  /**
   * カードハイライト表示（統合時に漏れた機能を追加）
   * @param {Element} cardElement - ハイライトするカード要素
   */
  highlightCard(cardElement) {
    if (!cardElement) return;
    
    // ハイライトクラスを追加
    cardElement.classList.add('card-highlighted');
    
    // 視覚効果を適用
    cardElement.style.transform = 'scale(1.05)';
    cardElement.style.transition = 'transform 200ms ease, box-shadow 200ms ease';
    cardElement.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
    cardElement.style.zIndex = '100';
  }

  /**
   * カードハイライト解除（統合時に漏れた機能を追加）
   * @param {Element} cardElement - ハイライト解除するカード要素
   */
  unhighlightCard(cardElement) {
    if (!cardElement) return;
    
    // ハイライトクラスを削除
    cardElement.classList.remove('card-highlighted');
    
    // スタイルをリセット
    cardElement.style.transform = '';
    cardElement.style.boxShadow = '';
    cardElement.style.zIndex = '';
  }

  /**
   * カードフリップアニメーション（統合時に漏れた機能を追加）
   * @param {Element} cardElement - フリップするカード要素
   * @param {string} frontImageSrc - 表面の画像パス
   */
  async flipCardFaceUp(cardElement, frontImageSrc) {
    console.log(`🔥 ANIMATION CALLED: flipCardFaceUp for element:`, cardElement?.dataset?.cardId || 'unknown', 'image:', frontImageSrc);
    
    return new Promise((resolve) => {
      if (!cardElement) return resolve();
      
      const imgElement = cardElement.querySelector('img');
      if (!imgElement) return resolve();
      
      // フリップアニメーション開始
      cardElement.style.transition = 'transform 300ms ease-in-out';
      cardElement.style.transform = 'rotateY(90deg)';
      
      // 90度回転後に画像を切り替え
      setTimeout(() => {
        imgElement.src = frontImageSrc;
        imgElement.alt = 'Card Face';
        
        // 画像読み込み完了後に反転完了
        imgElement.onload = () => {
          cardElement.style.transform = 'rotateY(0deg)';
          setTimeout(resolve, 300);
        };
        
        // 画像読み込み失敗時のフォールバック
        imgElement.onerror = () => {
          cardElement.style.transform = 'rotateY(0deg)';
          setTimeout(resolve, 300);
        };
      }, 150);
    });
  }

  /**
   * フェーズ間遷移アニメーション
   */
  async animatePhaseTransition(fromPhase, toPhase) {
    console.log(`🎭 Animating phase transition: ${fromPhase} → ${toPhase}`);
    
    // 既存のアニメーションをクリーンアップ
    await this.cleanupActiveAnimations();
    
    // フェーズ特有のアニメーション実行
    switch (`${fromPhase}->${toPhase}`) {
      case 'setup->initialPokemonSelection':
        await this.animateSetupToSelection();
        break;
      case 'initialPokemonSelection->gameStartReady':
        await this.animateSelectionToGameStart();
        break;
      case 'gameStartReady->playerMain':
        await this.animateGameStart();
        break;
      case 'playerMain->playerAttack':
        await this.animateAttackPhase();
        break;
      case 'playerAttack->cpuTurn':
        await this.animateTurnTransition('player', 'cpu');
        break;
      case 'cpuTurn->playerTurn':
        await this.animateTurnTransition('cpu', 'player');
        break;
      default:
        await this.animateGenericTransition();
    }
  }

  /**
   * アクティブなアニメーションのクリーンアップ
   */
  async cleanupActiveAnimations() {
    const promises = Array.from(this.activeAnimations);
    this.activeAnimations.clear();
    await Promise.all(promises);
  }

  /**
   * セットアップからポケモン選択への遷移
   */
  async animateSetupToSelection() {
    // 手札カードをハイライト
    const handCards = document.querySelectorAll('[data-owner="player"] .hand .card');
    const promises = [];
    
    handCards.forEach((card, index) => {
      const promise = new Promise(resolve => {
        setTimeout(() => {
          card.classList.add('highlight-available');
          resolve();
        }, index * 100);
      });
      promises.push(promise);
    });
    
    await Promise.all(promises);
  }

  /**
   * ポケモン選択からゲーム開始準備への遷移
   */
  async animateSelectionToGameStart() {
    // カードを表向きにする演出
    const pokemonCards = document.querySelectorAll('[data-zone="active"], [data-zone="bench"]');
    
    for (const card of pokemonCards) {
      await this.animateCardFlip(card);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  /**
   * ゲーム開始アニメーション
   */
  async animateGameStart() {
    // ゲーム開始の派手な演出
    const gameBoard = document.getElementById('game-board');
    if (gameBoard) {
      gameBoard.classList.add('game-start-flash');
      
      await new Promise(resolve => {
        setTimeout(() => {
          gameBoard.classList.remove('game-start-flash');
          resolve();
        }, ANIMATION_CONFIG.durations.phaseTransition);
      });
    }
  }

  /**
   * 攻撃フェーズアニメーション
   */
  async animateAttackPhase() {
    const activeCard = document.querySelector('[data-owner="player"][data-zone="active"] .card');
    if (activeCard) {
      activeCard.classList.add('attacking');
      
      await new Promise(resolve => {
        setTimeout(() => {
          activeCard.classList.remove('attacking');
          resolve();
        }, ANIMATION_CONFIG.durations.attack);
      });
    }
  }

  /**
   * ターン遷移アニメーション
   */
  async animateTurnTransition(fromPlayer, toPlayer) {
    // ターン遷移の視覚的効果
    const fromBoard = document.querySelector(`[data-owner="${fromPlayer}"]`);
    const toBoard = document.querySelector(`[data-owner="${toPlayer}"]`);
    
    if (fromBoard) {
      fromBoard.classList.add('turn-ending');
    }
    
    await new Promise(resolve => setTimeout(resolve, ANIMATION_CONFIG.durations.phaseTransition));
    
    if (fromBoard) {
      fromBoard.classList.remove('turn-ending');
    }
    if (toBoard) {
      toBoard.classList.add('turn-starting');
      setTimeout(() => {
        toBoard.classList.remove('turn-starting');
      }, ANIMATION_CONFIG.durations.phaseTransition);
    }
  }

  /**
   * 汎用遷移アニメーション
   */
  async animateGenericTransition() {
    await new Promise(resolve => 
      setTimeout(resolve, ANIMATION_CONFIG.durations.fast)
    );
  }

  /**
   * カードフリップアニメーション
   */
  async animateCardFlip(cardElement) {
    if (!cardElement) return;
    
    return new Promise(resolve => {
      cardElement.style.transform = 'rotateY(180deg)';
      cardElement.style.transition = `transform ${ANIMATION_CONFIG.durations.normal}ms ${ANIMATION_CONFIG.easing.default}`;
      
      setTimeout(() => {
        cardElement.style.transform = 'rotateY(0deg)';
        setTimeout(resolve, ANIMATION_CONFIG.durations.normal);
      }, ANIMATION_CONFIG.durations.normal);
    });
  }

  /**
   * プレイヤー判定とセレクタ生成の統一
   */
  getPlayerSelector(playerId) {
    const orientation = CardOrientationManager.getCardOrientation(playerId, null);
    return orientation.playerSelector;
  }

  getActiveSelector(playerId) {
    return playerId === 'player' ? '.active-bottom' : '.active-top';
  }

  getBenchSelector(playerId, index) {
    const prefix = playerId === 'player' ? 'bottom' : 'top';
    return `.${prefix}-bench-${index + 1}`;
  }

  getHandSelector(playerId) {
    const orientation = CardOrientationManager.getCardOrientation(playerId, 'hand');
    return orientation.handSelector;
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
    // サイドカードは常に裏向き（プライズカードフラグをチェック）
    const shouldShowBack = (isSetupPhase && card.setupFaceDown) || card.isPrizeCard;
    
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
        { playerId, isSetupPhase, duration, initialSourceRect, targetZone } // ★ 追加: targetZone を渡す
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
    const { playerId, isSetupPhase, duration, initialSourceRect, targetZone } = options; // ★ 追加: targetZone を受け取る

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
    const animCard = this.createAnimationCard(placedCardElement, imageInfo, sourceRect, playerId, targetZone, options);
    
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
  createAnimationCard(originalCard, imageInfo, sourceRect, playerId, targetZone, options) {
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

    // 統一された向き制御を適用（アニメーション中は移動先ゾーンに応じて判定）
    CardOrientationManager.applyCardOrientation(animCard, playerId, targetZone);
    
    // アニメーション用スタイル設定
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
   * 統一カード配布アニメーション
   * @param {Array<Element>} cardElements - カード要素配列
   * @param {string} animationType - アニメーションタイプ ('hand'|'prize'|'deck'|'initial')
   * @param {string} playerId - プレイヤーID ('player'|'cpu')
   * @param {Object} options - オプション
   */
  async createUnifiedCardDeal(cardElements, animationType, playerId, options = {}) {
    const {
      staggerDelay = 150,
      direction = 'normal',
      applyOrientation = true
    } = options;

    console.log(`🎬 Starting unified card deal: ${animationType} for ${playerId}, ${cardElements.length} cards`);

    if (!cardElements || cardElements.length === 0) {
      console.warn('⚠️ No card elements provided for animation');
      return;
    }

    const promises = cardElements.map((element, index) => {
      return new Promise(resolve => {
        setTimeout(() => {
          if (element) {
            const target = element.querySelector('img') || element;
            
            // 統一された向き制御を適用
            if (applyOrientation) {
              // アニメーションタイプからゾーンを推定
              const zone = this._getZoneFromAnimationType(animationType);
              CardOrientationManager.applyCardOrientation(element, playerId, zone);
            }

            // 表示状態にしてからアニメーション開始
            element.style.opacity = '1';

            // 強制リフロー
            element.offsetHeight;

            // アニメーションタイプに応じてクラスを適用
            let animationClass = 'animate-deal-card';
            switch (animationType) {
              case 'initial':
                animationClass = 'animate-deal-card-nofade';
                break;
              case 'hand':
                animationClass = playerId === 'player' ? 'animate-deal-player-hand-card' : 'animate-deal-card-nofade';
                break;
              case 'prize':
                animationClass = `animate-prize-deal-${direction}`;
                break;
              case 'deck':
                animationClass = 'animate-draw-card';
                break;
            }

            this.addAnimationClass(target, animationClass);
            this.waitForAnimation(target, this._getAnimationName(animationType, direction), () => {
              // 最終的な向きを確定
              if (applyOrientation) {
                const zone = this._getZoneFromAnimationType(animationType);
                CardOrientationManager.finalizeCardOrientation(element, playerId, zone);
              }
              resolve();
            });
          } else {
            resolve();
          }
        }, index * staggerDelay);
      });
    });

    return Promise.all(promises);
  }

  /**
   * アニメーション名を取得
   * @private
   */
  _getAnimationName(animationType, direction) {
    switch (animationType) {
      case 'initial':
        return 'dealCardNoFade';
      case 'hand':
        return 'dealPlayerHandCard';
      case 'prize':
        return direction === 'left' ? 'prizeDealLeft' : 'prizeDealRight';
      case 'deck':
        return 'drawCard';
      default:
        return 'dealCard';
    }
  }

  /**
   * アニメーションタイプからゾーンを推定
   * @private
   */
  _getZoneFromAnimationType(animationType) {
    switch (animationType) {
      case 'hand':
        return 'hand';
      case 'prize':
        return 'prize';
      case 'deck':
        return 'deck';
      case 'initial':
        return 'deck'; // 初期配布は主にデッキから
      default:
        return null;
    }
  }

  /**
   * 手札配布の統一アニメーション
   * @param {Array<Element>} cardElements - カード要素配列
   * @param {string} playerId - プレイヤーID
   * @param {Object} options - オプション
   */
  async animateHandDeal(cardElements, playerId, options = {}) {
    const defaultOptions = {
      staggerDelay: playerId === 'player' ? 200 : 200,
      direction: 'normal',
      applyOrientation: false // 二重適用防止: view.js で既に適用済み
    };
    
    return this.createUnifiedCardDeal(
      cardElements, 
      playerId === 'player' ? 'hand' : 'initial', 
      playerId, 
      { ...defaultOptions, ...options }
    );
  }

  /**
   * サイドカード配布の統一アニメーション
   * @param {Array<Element>} cardElements - カード要素配列
   * @param {string} playerId - プレイヤーID
   * @param {Object} options - オプション
   */
  async animatePrizeDeal(cardElements, playerId, options = {}) {
    console.log(`🔥 ANIMATION CALLED: animatePrizeDeal for ${playerId}, elements:`, cardElements.length);
    
    const defaultOptions = {
      staggerDelay: 150,
      direction: playerId === 'player' ? 'right' : 'left',
      applyOrientation: false // 二重適用防止: view.js で既に適用済み
    };
    
    return this.createUnifiedCardDeal(
      cardElements, 
      'prize', 
      playerId, 
      { ...defaultOptions, ...options }
    );
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

// 後方互換性のため、animationManager もエクスポート
export const animationManager = unifiedAnimationManager;