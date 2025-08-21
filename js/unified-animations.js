/**
 * UNIFIED-ANIMATIONS.JS - 次世代アニメーション統合オーケストレーター v3.0
 * 
 * 高度な物理演算、人間らしいタイミング、ゲーム的な演出を統合
 * 複数のアニメーションシステムを協調させる指揮者クラス
 */

// Simplified animation system - removed animationManager dependency
import { CardOrientationManager } from './card-orientation.js';
import { getCardImagePath } from './data-manager.js';
import { visualEffectsManager } from './visual-effects.js';
import { soundManager } from './sound-manager.js';
import { physicsEngine, humanTiming, EasingLibrary, motionInterpolator } from './animation-physics.js';

const noop = () => {};

/**
 * 高度アニメーション統一設定 - パーソナリティ・物理・エフェクト統合
 */
export const ANIMATION_CONFIG = {
  durations: {
    instant: 150,
    fast: 250,
    normal: 400,
    slow: 600,
    dramatic: 1200,
    gameOver: 2000,
    phaseTransition: 500,
    cardMove: 450,
    dealCard: 320,
    attack: 800,
    damage: 400,
    
    // 人間らしいタイミング（ベース値、実際はランダム変動あり）
    playerAction: 400,
    cpuAction: 280,
    thinking: 800,
    reaction: 150
  },
  easing: {
    // 基本カーブ
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    
    // 人間らしいカーブ
    natural: 'cubic-bezier(0.33, 0.1, 0.67, 0.9)',
    hesitant: 'cubic-bezier(0.2, 0.8, 0.4, 1)',
    confident: 'cubic-bezier(0.6, 0, 0.8, 0.2)',
    
    // ゲーム的な演出
    dramatic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    impact: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)',
    elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  },
  
  // 効果の強度設定
  effects: {
    particles: true,
    trails: true,
    lighting: true,
    physics: true,
    breathing: true,
    anticipation: true
  },
  
  // パフォーマンス設定
  performance: {
    maxConcurrentAnimations: 8,
    qualityLevel: 'auto', // 'low' | 'medium' | 'high' | 'auto'
    adaptiveFrameRate: true
  }
};

/**
 * 次世代統一アニメーション オーケストレーター
 * 複数のアニメーションシステムを協調して管理する指揮者クラス
 */
export class UnifiedAnimationManager {
  constructor() {
    console.log('🎬 Next-Gen Unified Animation Orchestrator v3.0 initialized');
    
    // アニメーション キューシステム
    this.animationQueue = {
      immediate: [], // 即座に実行
      sequential: [], // 順次実行
      parallel: [], // 並列実行
      background: [] // 背景で実行
    };
    
    // アクティブなシーケンス管理
    this.activeSequences = new Map();
    this.sequenceCounter = 0;
    
    // パフォーマンス監視
    this.performanceMetrics = {
      frameRate: 60,
      animationsPerSecond: 0,
      memoryUsage: 0,
      qualityLevel: this.detectOptimalQuality()
    };
    
    // 自動品質調整
    this.enableAdaptiveQuality();
    
    // エフェクト管理
    this.effectsManager = {
      particles: new Map(),
      trails: new Map(),
      lighting: new Map()
    };
  }

  /**
   * 最適品質レベル自動検出
   */
  detectOptimalQuality() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const deviceMemory = navigator.deviceMemory || 4;
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    
    if (gl && deviceMemory >= 8 && hardwareConcurrency >= 8) {
      return 'high';
    } else if (gl && deviceMemory >= 4 && hardwareConcurrency >= 4) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * 自動品質調整システム
   */
  enableAdaptiveQuality() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const checkPerformance = () => {
      frameCount++;
      const now = performance.now();
      
      if (now - lastTime >= 1000) {
        const fps = frameCount;
        frameCount = 0;
        lastTime = now;
        
        // フレームレートに応じて品質調整
        if (fps < 30 && this.performanceMetrics.qualityLevel !== 'low') {
          this.performanceMetrics.qualityLevel = 'low';
          this.adjustAnimationQuality('low');
          console.log('🔧 Animation quality reduced to maintain performance');
        } else if (fps > 55 && this.performanceMetrics.qualityLevel === 'low') {
          this.performanceMetrics.qualityLevel = 'medium';
          this.adjustAnimationQuality('medium');
          console.log('🚀 Animation quality increased due to good performance');
        }
        
        this.performanceMetrics.frameRate = fps;
      }
      
      if (ANIMATION_CONFIG.performance.adaptiveFrameRate) {
        requestAnimationFrame(checkPerformance);
      }
    };
    
    checkPerformance();
  }
  
  /**
   * アニメーション品質調整
   */
  adjustAnimationQuality(level) {
    switch (level) {
      case 'low':
        ANIMATION_CONFIG.effects.particles = false;
        ANIMATION_CONFIG.effects.trails = false;
        ANIMATION_CONFIG.effects.physics = false;
        break;
      case 'medium':
        ANIMATION_CONFIG.effects.particles = true;
        ANIMATION_CONFIG.effects.trails = false;
        ANIMATION_CONFIG.effects.physics = true;
        break;
      case 'high':
        Object.keys(ANIMATION_CONFIG.effects).forEach(key => {
          ANIMATION_CONFIG.effects[key] = true;
        });
        break;
    }
    
    // Simplified quality adjustment - removed animationManager dependency
  }
  
  /**
   * アニメーション シーケンス作成
   * @param {string} name - シーケンス名
   * @param {Array} animations - アニメーション配列
   * @param {Object} options - オプション
   */
  createAnimationSequence(name, animations, options = {}) {
    const sequenceId = `${name}_${++this.sequenceCounter}`;
    const {
      mode = 'sequential', // 'sequential' | 'parallel' | 'mixed'
      personality = 'player',
      priority = 'normal', // 'low' | 'normal' | 'high'
      usePhysics = ANIMATION_CONFIG.effects.physics,
      addEffects = true
    } = options;
    
    const sequence = {
      id: sequenceId,
      name,
      animations,
      options,
      status: 'pending',
      startTime: null,
      progress: 0
    };
    
    this.activeSequences.set(sequenceId, sequence);
    
    // 実行モードに応じてキューに追加
    switch (mode) {
      case 'sequential':
        this.animationQueue.sequential.push(sequence);
        break;
      case 'parallel':
        this.animationQueue.parallel.push(sequence);
        break;
      case 'immediate':
        this.animationQueue.immediate.push(sequence);
        break;
      default:
        this.animationQueue.sequential.push(sequence);
    }
    
    // 高優先度なら即座に実行
    if (priority === 'high') {
      this.executeSequence(sequenceId);
    } else {
      this.processAnimationQueue();
    }
    
    return sequenceId;
  }
  
  /**
   * アニメーションキュー処理
   */
  async processAnimationQueue() {
    // 即座実行
    while (this.animationQueue.immediate.length > 0) {
      const sequence = this.animationQueue.immediate.shift();
      await this.executeSequence(sequence.id);
    }
    
    // 並列実行（最大同時実行数制限）
    const concurrentLimit = ANIMATION_CONFIG.performance.maxConcurrentAnimations;
    const parallelPromises = [];
    
    while (this.animationQueue.parallel.length > 0 && parallelPromises.length < concurrentLimit) {
      const sequence = this.animationQueue.parallel.shift();
      parallelPromises.push(this.executeSequence(sequence.id));
    }
    
    if (parallelPromises.length > 0) {
      await Promise.all(parallelPromises);
    }
    
    // 順次実行
    while (this.animationQueue.sequential.length > 0) {
      const sequence = this.animationQueue.sequential.shift();
      await this.executeSequence(sequence.id);
    }
  }
  
  /**
   * シーケンス実行
   */
  async executeSequence(sequenceId) {
    const sequence = this.activeSequences.get(sequenceId);
    if (!sequence || sequence.status !== 'pending') return;
    
    sequence.status = 'running';
    sequence.startTime = performance.now();
    
    try {
      const { animations, options } = sequence;
      const results = [];
      
      if (options.mode === 'parallel') {
        // 並列実行
        const promises = animations.map(animation => this.executeAnimation(animation, options));
        await Promise.all(promises);
      } else {
        // 順次実行
        for (const animation of animations) {
          const result = await this.executeAnimation(animation, options);
          results.push(result);
          
          // 人間らしい間隔
          if (animation !== animations[animations.length - 1]) {
            const delay = humanTiming.getHumanDelay('reaction', options.personality);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      sequence.status = 'completed';
      sequence.progress = 1;
      
    } catch (error) {
      console.error(`❌ Animation sequence failed: ${sequenceId}`, error);
      sequence.status = 'failed';
    } finally {
      // クリーンアップ
      setTimeout(() => {
        this.activeSequences.delete(sequenceId);
      }, 1000);
    }
  }
  
  /**
   * 個別アニメーション実行
   */
  async executeAnimation(animation, globalOptions) {
    const { type, target, params = {}, options = {} } = animation;
    const mergedOptions = { ...globalOptions, ...options };
    
    switch (type) {
      case 'cardDeal':
        return await this.animateHandDeal(target, params.personality, mergedOptions);
      case 'cardMove':
        return await this.createUnifiedCardAnimation(
          params.playerId, 
          params.cardId, 
          params.sourceZone, 
          params.targetZone, 
          params.targetIndex, 
          mergedOptions
        );
      case 'cardFlip':
        // Simplified card flip - direct CSS transition
        return new Promise(resolve => {
          if (target) {
            target.style.transition = 'transform 0.3s ease-in-out';
            target.style.transform = 'rotateY(180deg)';
            setTimeout(() => {
              if (params.newImageSrc) {
                const img = target.querySelector('img');
                if (img) img.src = params.newImageSrc;
              }
              target.style.transform = 'rotateY(0deg)';
              setTimeout(resolve, 300);
            }, 150);
          } else {
            resolve();
          }
        });
      case 'attack':
        return await this.createUnifiedAttackAnimation(params.attackerId, params.defenderId);
      case 'effect':
        return await this.createSpecialEffect(params.effectType, target, params.intensity);
      default:
        console.warn(`Unknown animation type: ${type}`);
        return null;
    }
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
   * 次世代統一カードアニメーション（物理・エフェクト・パーソナリティ統合）
   */
  async createUnifiedCardAnimation(playerId, cardId, sourceZone, targetZone, targetIndex, options = {}) {
    console.log(`🎬 Starting next-gen unified animation: ${playerId} ${cardId} ${sourceZone} -> ${targetZone}[${targetIndex}]`);
    
    try {
      const {
        isSetupPhase = false,
        duration = null, // null なら自動計算
        card = null,
        initialSourceRect = null,
        usePhysics = ANIMATION_CONFIG.effects.physics,
        addTrails = ANIMATION_CONFIG.effects.trails,
        addAnticipation = ANIMATION_CONFIG.effects.anticipation,
        personality = playerId,
        priority = 'normal'
      } = options;

      // 人間らしい遅延を計算
      const anticipationTime = addAnticipation 
        ? humanTiming.getHumanDelay('thinking', personality, { isImportant: targetZone === 'active' })
        : 0;
      
      // 予備動作
      if (anticipationTime > 0) {
        await this.addCardAnticipation(playerId, sourceZone, cardId, anticipationTime);
      }

      // 移動元・移動先要素の取得
      const sourceElement = this.getSourceElement(playerId, sourceZone, cardId);
      const targetElement = this.getTargetElement(playerId, targetZone, targetIndex);
      const placedCardElement = targetElement?.children[0];

      if (!sourceElement || !targetElement || !placedCardElement) {
        console.warn(`⚠️ Missing elements for animation: ${playerId} ${sourceZone} -> ${targetZone}`);
        return;
      }

      // 高品質物理ベースアニメーション
      if (usePhysics && this.performanceMetrics.qualityLevel !== 'low') {
        await this.executePhysicsCardAnimation(
          sourceElement, 
          targetElement, 
          placedCardElement, 
          card, 
          { playerId, isSetupPhase, targetZone, personality, addTrails }
        );
      } else {
        // 標準アニメーション（人間らしいタイミング付き）
        await this.executeCardMoveAnimation(
          sourceElement, 
          targetElement, 
          placedCardElement, 
          card, 
          { playerId, isSetupPhase, duration, initialSourceRect, targetZone, personality }
        );
      }
      
      // 着地後エフェクト
      if (ANIMATION_CONFIG.effects.lighting) {
        await this.addLandingEffect(placedCardElement, targetZone, personality);
      }

      console.log(`✅ Next-gen unified animation completed: ${playerId} ${cardId} -> ${targetZone}[${targetIndex}]`);

    } catch (error) {
      console.error('❌ Error in next-gen unified card animation:', error);
    }
  }
  
  /**
   * カード予備動作（Anticipation）
   */
  async addCardAnticipation(playerId, sourceZone, cardId, duration) {
    const sourceElement = this.getSourceElement(playerId, sourceZone, cardId);
    if (!sourceElement) return;
    
    return new Promise(resolve => {
      // わずかに持ち上がる動作
      sourceElement.style.transform = 'translateY(-3px) scale(1.02) rotate(1deg)';
      sourceElement.style.transition = 'transform 200ms ease-out';
      
      setTimeout(() => {
        sourceElement.style.transform = '';
        setTimeout(resolve, duration * 0.3); // 予備動作の後に少し待機
      }, 200);
    });
  }
  
  /**
   * 物理ベースカードアニメーション
   */
  async executePhysicsCardAnimation(sourceElement, targetElement, placedCardElement, card, options) {
    const { playerId, targetZone, personality, addTrails } = options;
    
    // 物理パラメータをパーソナリティに応じて調整
    const personalityConfig = {
      player: { bounce: 0.3, friction: 0.94, gravity: 800 },
      cpu: { bounce: 0.15, friction: 0.97, gravity: 900 }
    };
    
    const physicsParams = personalityConfig[personality] || personalityConfig.player;
    
    return new Promise(resolve => {
      const sourceRect = this.getElementRect(sourceElement);
      const targetRect = this.getElementRect(targetElement);
      
      // 軌跡エフェクトを追加
      if (addTrails) {
        this.createCardTrail(sourceRect, targetRect, personality);
      }
      
      // 一時的に隠す
      placedCardElement.style.opacity = '0';
      
      // 物理オブジェクト作成
      const physicsId = `card_move_${Date.now()}`;
      const physicsObj = physicsEngine.createObject(physicsId, {
        x: sourceRect.centerX,
        y: sourceRect.centerY,
        vx: (targetRect.centerX - sourceRect.centerX) * 0.8,
        vy: (targetRect.centerY - sourceRect.centerY) * 0.8,
        bounce: physicsParams.bounce,
        friction: physicsParams.friction,
        gravity: physicsParams.gravity,
        constraints: {
          target: { 
            x: targetRect.centerX, 
            y: targetRect.centerY, 
            strength: 0.6 
          },
          bounds: {
            left: Math.min(sourceRect.centerX, targetRect.centerX) - 50,
            right: Math.max(sourceRect.centerX, targetRect.centerX) + 50,
            top: Math.min(sourceRect.centerY, targetRect.centerY) - 30,
            bottom: Math.max(sourceRect.centerY, targetRect.centerY) + 30
          }
        },
        callbacks: {
          onRest: () => {
            placedCardElement.style.opacity = '1';
            this.addCardSettleEffect(placedCardElement, personality);
            resolve();
          },
          onBounce: (side) => {
            // バウンス時の軽い衝撃エフェクト
            if (ANIMATION_CONFIG.effects.particles) {
              this.createBounceParticles(targetRect.centerX, targetRect.centerY);
            }
          }
        }
      });
      
      physicsEngine.start();
    });
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
    const { playerId, isSetupPhase, duration, initialSourceRect, targetZone, personality } = options;

    // 位置情報取得
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
    await this.performCardTransition(animCard, targetRect, duration || 600);
    
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
   * 次世代手札配布アニメーション（人間らしいタイミング・物理・エフェクト統合）
   * @param {Array<Element>} cardElements - カード要素配列
   * @param {string} playerId - プレイヤーID
   * @param {Object} options - オプション
   */
  async animateHandDeal(cardElements, playerId, options = {}) {
    if (!cardElements || cardElements.length === 0) return;
    
    const {
      usePhysics = ANIMATION_CONFIG.effects.physics && this.performanceMetrics.qualityLevel !== 'low',
      addEffects = ANIMATION_CONFIG.effects.particles,
      personality = playerId,
      dealingSpeed = 'natural' // 'slow' | 'natural' | 'fast'
    } = options;
    
    console.log(`🎴 Starting next-gen hand deal: ${playerId}, ${cardElements.length} cards, physics: ${usePhysics}`);
    
    // ディーラー（CPUまたはプレイヤー）の思考時間
    const dealerThinkTime = humanTiming.getHumanDelay('thinking', personality, {
      isImportant: true,
      isFirst: true
    });
    
    // 短い思考時間
    await new Promise(resolve => setTimeout(resolve, dealerThinkTime * 0.3));
    
    // カード配布シーケンス作成
    const dealAnimations = cardElements.map((element, index) => ({
      type: 'cardDeal',
      target: element,
      params: { 
        personality,
        index,
        totalCards: cardElements.length,
        usePhysics,
        addEffects: addEffects && index % 2 === 0 // パフォーマンスのため間引き
      }
    }));
    
    // アニメーションシーケンス実行
    const sequenceId = this.createAnimationSequence(
      `handDeal_${playerId}`,
      dealAnimations,
      {
        mode: 'sequential',
        personality,
        priority: 'high',
        usePhysics,
        addEffects
      }
    );
    
    // シーケンス完了を待機
    return new Promise(resolve => {
      const checkCompletion = () => {
        const sequence = this.activeSequences.get(sequenceId);
        if (!sequence || sequence.status === 'completed' || sequence.status === 'failed') {
          // 配布完了後のエフェクト
          if (addEffects && this.performanceMetrics.qualityLevel === 'high') {
            this.addHandCompletionEffect(cardElements, personality);
          }
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }
  
  /**
   * 手札配布完了時のエフェクト
   */
  addHandCompletionEffect(cardElements, personality) {
    // 全カードに軽い光る効果
    cardElements.forEach((element, index) => {
      if (!element) return;
      
      setTimeout(() => {
        const glowEffect = document.createElement('div');
        const intensity = personality === 'player' ? 0.8 : 0.4;
        const color = personality === 'player' ? '100, 150, 255' : '255, 150, 100';
        
        glowEffect.style.cssText = `
          position: absolute;
          inset: -5px;
          background: radial-gradient(circle, rgba(${color}, ${intensity * 0.3}) 0%, transparent 70%);
          border-radius: 8px;
          pointer-events: none;
          z-index: 5;
          animation: handGlow 800ms ease-out forwards;
        `;
        
        element.style.position = 'relative';
        element.appendChild(glowEffect);
        
        setTimeout(() => {
          if (glowEffect.parentNode) {
            glowEffect.parentNode.removeChild(glowEffect);
          }
        }, 850);
      }, index * 50); // わずかな時差で実行
    });
  }

  /**
   * カード軌跡エフェクト
   */
  createCardTrail(sourceRect, targetRect, personality) {
    const trailCount = personality === 'player' ? 5 : 3;
    const trailColor = personality === 'player' ? 'rgba(100, 150, 255, 0.6)' : 'rgba(255, 100, 100, 0.4)';
    
    for (let i = 0; i < trailCount; i++) {
      setTimeout(() => {
        const trail = document.createElement('div');
        trail.style.cssText = `
          position: fixed;
          left: ${sourceRect.centerX}px;
          top: ${sourceRect.centerY}px;
          width: 4px;
          height: 4px;
          background: ${trailColor};
          border-radius: 50%;
          pointer-events: none;
          z-index: 1000;
          transition: all 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
        `;
        
        document.body.appendChild(trail);
        
        requestAnimationFrame(() => {
          trail.style.left = `${targetRect.centerX}px`;
          trail.style.top = `${targetRect.centerY}px`;
          trail.style.opacity = '0';
        });
        
        setTimeout(() => {
          if (trail.parentNode) {
            trail.parentNode.removeChild(trail);
          }
        }, 850);
      }, i * 100);
    }
  }
  
  /**
   * バウンス パーティクル エフェクト
   */
  createBounceParticles(x, y) {
    const particleCount = 6;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 20 + Math.random() * 15;
      
      particle.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 3px;
        height: 3px;
        background: rgba(255, 215, 0, 0.8);
        border-radius: 50%;
        pointer-events: none;
        z-index: 1001;
        transition: all 400ms ease-out;
      `;
      
      document.body.appendChild(particle);
      
      requestAnimationFrame(() => {
        particle.style.left = `${x + Math.cos(angle) * distance}px`;
        particle.style.top = `${y + Math.sin(angle) * distance}px`;
        particle.style.opacity = '0';
      });
      
      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, 450);
    }
  }
  
  /**
   * カード着地エフェクト
   */
  addCardSettleEffect(element, personality) {
    const intensity = personality === 'player' ? 1.0 : 0.6;
    const settleSequence = [
      { scale: 1.05 * intensity, rotate: 2 * intensity, duration: 150 },
      { scale: 0.98, rotate: -1 * intensity, duration: 100 },
      { scale: 1, rotate: 0, duration: 150 }
    ];
    
    let step = 0;
    const executeStep = () => {
      if (step >= settleSequence.length) {
        element.style.transform = '';
        element.style.transition = '';
        return;
      }
      
      const { scale, rotate, duration } = settleSequence[step];
      element.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
      element.style.transition = `transform ${duration}ms ease-out`;
      
      step++;
      setTimeout(executeStep, duration);
    };
    
    executeStep();
  }
  
  /**
   * 着地時光エフェクト
   */
  async addLandingEffect(element, targetZone, personality) {
    if (targetZone === 'active' || targetZone === 'bench') {
      // 重要な配置（バトル場・ベンチ）には光エフェクト
      const intensity = targetZone === 'active' ? 1.0 : 0.7;
      const color = personality === 'player' ? 'rgba(100, 150, 255, 0.6)' : 'rgba(255, 100, 100, 0.4)';
      
      const lightEffect = document.createElement('div');
      lightEffect.style.cssText = `
        position: absolute;
        inset: -${15 * intensity}px;
        background: radial-gradient(circle, ${color} 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 10;
        opacity: 0;
        animation: landingGlow 600ms ease-out;
      `;
      
      element.style.position = 'relative';
      element.appendChild(lightEffect);
      
      setTimeout(() => {
        if (lightEffect.parentNode) {
          lightEffect.parentNode.removeChild(lightEffect);
        }
      }, 650);
    }
  }
  
  /**
   * 統一攻撃アニメーション - ドラマティック改良版
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

      // 攻撃の予備動作
      const anticipationTime = humanTiming.getHumanDelay('thinking', attackerPlayerId, {
        isImportant: true,
        isThinking: true
      });
      
      // ドラマティック予備動作
      attackerElement.style.transform = 'scale(1.02) rotate(-2deg)';
      attackerElement.style.transition = 'transform 300ms ease-in-out';
      
      await new Promise(resolve => setTimeout(resolve, anticipationTime * 0.5));
      
      // 高品質エフェクト（品質レベルに応じて）
      if (ANIMATION_CONFIG.effects.particles && this.performanceMetrics.qualityLevel !== 'low') {
        visualEffectsManager.createAttackEffect(attackerElement, defenderElement, attackType);
      }
      
      // メイン攻撃アニメーション
      // Simplified attack animation
      const attackPromise = this.createBasicAttackAnimation(attackerElement, defenderElement, attackType);
      
      // 衝撃エフェクト（少し遅れて）
      setTimeout(() => {
        if (ANIMATION_CONFIG.effects.lighting) {
          this.createImpactEffect(defenderElement, attackType);
        }
      }, 400);
      
      await attackPromise;
      
      console.log(`✅ Unified attack animation completed`);

    } catch (error) {
      console.error('❌ Error in unified attack animation:', error);
    }
  }
  
  /**
   * 衝撃エフェクト
   */
  createImpactEffect(defenderElement, attackType) {
    const rect = defenderElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // 衝撃波
    const shockwave = document.createElement('div');
    shockwave.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: 10px;
      height: 10px;
      border: 2px solid rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 1500;
      animation: shockwaveExpand 500ms ease-out forwards;
    `;
    
    document.body.appendChild(shockwave);
    
    setTimeout(() => {
      if (shockwave.parentNode) {
        shockwave.parentNode.removeChild(shockwave);
      }
    }, 550);
    
    // 画面震動効果（軽い）
    if (this.performanceMetrics.qualityLevel === 'high') {
      this.addScreenShake(attackType === 'critical' ? 8 : 4, 200);
    }
  }
  
  /**
   * 画面震動エフェクト
   */
  addScreenShake(intensity, duration) {
    const gameBoard = document.getElementById('game-board');
    if (!gameBoard) return;
    
    const originalTransform = gameBoard.style.transform;
    let shakeCount = 0;
    const maxShakes = Math.floor(duration / 50);
    
    const shake = () => {
      if (shakeCount >= maxShakes) {
        gameBoard.style.transform = originalTransform;
        return;
      }
      
      const x = (Math.random() - 0.5) * intensity;
      const y = (Math.random() - 0.5) * intensity;
      gameBoard.style.transform = `${originalTransform} translate(${x}px, ${y}px)`;
      
      shakeCount++;
      setTimeout(shake, 50);
    };
    
    shake();
  }
  
  /**
   * サイドカード配布の統一アニメーション（改良版）
   */
  async animatePrizeDeal(cardElements, playerId, options = {}) {
    console.log(`🏆 Starting next-gen prize deal: ${playerId}, elements:`, cardElements.length);
    
    if (!cardElements || cardElements.length === 0) return;
    
    const {
      staggerDelay = null, // null で人間らしいタイミング
      addEffects = ANIMATION_CONFIG.effects.particles,
      intensity = 1.0
    } = options;
    
    // 人間らしいタイミング生成
    const timings = staggerDelay 
      ? cardElements.map((_, i) => i * staggerDelay)
      : humanTiming.generateSequenceTimings('cardDeal', cardElements.length, playerId);
    
    const promises = cardElements.map((element, index) => {
      return new Promise(resolve => {
        setTimeout(async () => {
          if (!element) return resolve();
          
          // 基本アニメーション
          const direction = playerId === 'player' ? 'left' : 'right';
          const animationClass = `animate-prize-deal-${direction}`;
          
          element.style.opacity = '1';
          // Direct CSS class application
          if (element) element.classList.add(animationClass);
          
          // 高品質：光の軌跡エフェクト
          if (addEffects && this.performanceMetrics.qualityLevel !== 'low') {
            setTimeout(() => {
              this.addPrizeGlowEffect(element, playerId, intensity);
            }, 200);
          }
          
          // Simple animation wait
          setTimeout(() => {
            resolve();
          });
        }, timings[index]);
      });
    });
    
    return Promise.all(promises);
  }
  
  /**
   * サイドカード光効果
   */
  addPrizeGlowEffect(element, playerId, intensity) {
    const color = playerId === 'player' ? 'rgba(255, 215, 0, 0.6)' : 'rgba(255, 100, 100, 0.4)';
    
    const glowEffect = document.createElement('div');
    glowEffect.style.cssText = `
      position: absolute;
      inset: -${8 * intensity}px;
      background: radial-gradient(circle, ${color} 0%, transparent 80%);
      border-radius: 6px;
      pointer-events: none;
      z-index: 5;
      opacity: 0;
      animation: prizeGlow ${800 / intensity}ms ease-out forwards;
    `;
    
    element.style.position = 'relative';
    element.appendChild(glowEffect);
    
    setTimeout(() => {
      if (glowEffect.parentNode) {
        glowEffect.parentNode.removeChild(glowEffect);
      }
    }, 900 / intensity);
  }
  
  /**
   * 特殊エフェクト作成
   */
  async createSpecialEffect(effectType, target, intensity = 1.0) {
    switch (effectType) {
      case 'explosion':
        return this.createExplosionEffect(target, intensity);
      case 'healing':
        return this.createHealingEffect(target, intensity);
      case 'energy':
        return this.createEnergyEffect(target, intensity);
      case 'critical':
        return this.createCriticalEffect(target, intensity);
      case 'evolution':
        return this.createEvolutionEffect(target, intensity);
      default:
        console.warn(`Unknown effect type: ${effectType}`);
    }
  }
  
  /**
   * 進化エフェクト
   */
  async createEvolutionEffect(target, intensity) {
    if (!target) return;
    
    // 視覚エフェクトマネージャーを使用（高品質）
    if (ANIMATION_CONFIG.effects.particles && this.performanceMetrics.qualityLevel !== 'low') {
      visualEffectsManager.createEvolutionEffect(target);
    }
    
    // 基本光エフェクト（全品質レベル対応）
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const evolutionLight = document.createElement('div');
    evolutionLight.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: ${100 * intensity}px;
      height: ${100 * intensity}px;
      background: radial-gradient(circle, 
        rgba(255, 215, 0, ${0.8 * intensity}) 0%, 
        rgba(255, 255, 255, ${0.4 * intensity}) 40%, 
        transparent 70%);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 2000;
      animation: evolutionPulse ${2000 / intensity}ms ease-in-out;
    `;
    
    document.body.appendChild(evolutionLight);
    
    setTimeout(() => {
      if (evolutionLight.parentNode) {
        evolutionLight.parentNode.removeChild(evolutionLight);
      }
    }, 2100 / intensity);
  }
  
  /**
   * パフォーマンス統計取得
   */
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      activeSequences: this.activeSequences.size,
      queuedAnimations: Object.values(this.animationQueue).reduce((sum, queue) => sum + queue.length, 0)
    };
  }
  
  /**
   * システムリセット
   */
  reset() {
    console.log('🔄 Next-Gen Unified Animation Orchestrator reset');
    
    // 全アニメーションシーケンス停止
    this.activeSequences.clear();
    
    // キュークリア
    Object.keys(this.animationQueue).forEach(key => {
      this.animationQueue[key] = [];
    });
    
    // エフェクトクリア
    Object.values(this.effectsManager).forEach(effectMap => effectMap.clear());
    
    // 物理エンジンリセット
    physicsEngine.clear();
    
    // アニメーションマネージャーリセット
    // Clear active animations
    document.querySelectorAll('.animate-*').forEach(el => {
      el.className = el.className.replace(/animate-\w+/g, '');
    });
    
    // 視覚エフェクトマネージャーリセット
    if (typeof visualEffectsManager !== 'undefined') {
      visualEffectsManager.clear();
    }
  }
  
  /**
   * デバッグ情報出力
   */
  debugInfo() {
    console.group('🎬 Next-Gen Animation System Debug Info');
    console.log('Performance:', this.getPerformanceStats());
    console.log('Active Sequences:', Array.from(this.activeSequences.keys()));
    console.log('Animation Queue:', this.animationQueue);
    console.log('Quality Level:', this.performanceMetrics.qualityLevel);
    console.groupEnd();
  }

  // ===================== 不足していたメソッドを追加 =====================

  /**
   * メッセージアニメーション
   */
  async animateMessage(messageElement, options = {}) {
    const { personality = 'informative', spectacle = 'subtle' } = options;
    
    // Simplified message animation
    if (messageElement) {
      messageElement.style.animation = 'fadeIn 0.3s ease-out';
      return new Promise(resolve => setTimeout(resolve, 300));
    }
    return 
           this.createGenericFadeIn(messageElement, { duration: 300 });
  }

  /**
   * エラーアニメーション
   */
  async animateError(errorElement, options = {}) {
    const { personality = 'urgent', spectacle = 'attention' } = options;
    
    // Simplified error animation  
    if (errorElement) {
      errorElement.style.animation = 'error-shake 0.5s ease-in-out';
      return new Promise(resolve => setTimeout(resolve, 500));
    }
    return 
           this.createGenericShake(errorElement, { duration: 500 });
  }

  /**
   * カードハイライト
   */
  highlightCard(cardElement, type = 'glow') {
    // Direct highlight
    if (cardElement) {
      cardElement.classList.add('highlight-available');
    }
    
    // フォールバック実装
    cardElement.style.boxShadow = type === 'energy-compatible' 
      ? '0 0 20px #4CAF50' 
      : '0 0 15px #FFD700';
    cardElement.style.transform = 'scale(1.02)';
    cardElement.style.transition = 'all 0.3s ease';
  }

  /**
   * カードアンハイライト
   */
  unhighlightCard(cardElement) {
    // Direct unhighlight
    if (cardElement) {
      cardElement.classList.remove('highlight-available');
    }
    
    // フォールバック実装
    cardElement.style.boxShadow = '';
    cardElement.style.transform = '';
  }

  /**
   * カードドローアニメーション
   */
  async animateCardDraw(playerId, cardElement, options = {}) {
    const { personality = 'focused', spectacle = 'gentle' } = options;
    
    // Simplified draw animation
    if (cardElement) {
      cardElement.classList.add('animate-draw-card');
      setTimeout(() => cardElement.classList.remove('animate-draw-card'), 400);
    }
    
    // フォールバック実装
    return this.createGenericSlideIn(cardElement, { duration: 400 });
  }

  /**
   * ノックアウトアニメーション
   */
  async animateKnockout(playerId, pokemon, options = {}) {
    const { personality = 'dramatic', spectacle = 'intense' } = options;
    
    // Simplified knockout animation
    return this.createBasicKnockoutAnimation(playerId, pokemon);
    
    // フォールバック実装
    const selector = playerId === 'player' ? '.player-self .active-bottom' : '.opponent-board .active-top';
    const element = document.querySelector(selector);
    if (element) {
      return this.createGenericFadeOut(element, { duration: 800 });
    }
  }

  /**
   * 攻撃アニメーション
   */
  async animateAttack(attackerId, defenderId, options = {}) {
    const { personality = 'fierce', spectacle = 'spectacular' } = options;
    
    // Simplified attack animation
    return this.createBasicAttackAnimation(attackerId, defenderId, 'normal');
    
    // フォールバック実装
    const attackerElement = document.querySelector(attackerId === 'player' ? '.player-self .active-bottom' : '.opponent-board .active-top');
    if (attackerElement) {
      return this.createGenericPulse(attackerElement, { duration: 600 });
    }
  }

  // ===================== フォールバック用基本アニメーション =====================

  async createGenericFadeIn(element, { duration = 300 } = {}) {
    return new Promise(resolve => {
      element.style.opacity = '0';
      element.style.transition = `opacity ${duration}ms ease`;
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        setTimeout(resolve, duration);
      });
    });
  }

  async createGenericFadeOut(element, { duration = 300 } = {}) {
    return new Promise(resolve => {
      element.style.transition = `opacity ${duration}ms ease`;
      element.style.opacity = '0';
      setTimeout(resolve, duration);
    });
  }

  async createGenericShake(element, { duration = 500 } = {}) {
    return new Promise(resolve => {
      let count = 0;
      const interval = setInterval(() => {
        element.style.transform = `translateX(${Math.sin(count * 0.5) * 5}px)`;
        count++;
        if (count > duration / 50) {
          clearInterval(interval);
          element.style.transform = '';
          resolve();
        }
      }, 50);
    });
  }

  async createGenericSlideIn(element, { duration = 400 } = {}) {
    return new Promise(resolve => {
      element.style.transform = 'translateX(-100px)';
      element.style.opacity = '0';
      element.style.transition = `all ${duration}ms ease`;
      requestAnimationFrame(() => {
        element.style.transform = 'translateX(0)';
        element.style.opacity = '1';
        setTimeout(resolve, duration);
      });
    });
  }

  async createGenericPulse(element, { duration = 600 } = {}) {
    return new Promise(resolve => {
      element.style.transition = `transform ${duration}ms ease`;
      element.style.transform = 'scale(1.1)';
      setTimeout(() => {
        element.style.transform = 'scale(1)';
        setTimeout(resolve, 200);
      }, duration / 2);
    });
  }

  // ===================== Setup-Manager 用の不足メソッド追加 =====================

  /**
   * 手札配布アニメーション
   */
  async animateHandDealCards(playerId, cardCount = 7, options = {}) {
    try {
      const { personality = 'focused', spectacle = 'gentle' } = options;
      
      // Simplified deal animation
      return await this.createBasicDealAnimation(playerId, cardCount, options);
      
      // フォールバック実装
      const handSelector = playerId === 'player' ? '#player-hand' : '#cpu-hand';
      const handElement = document.querySelector(handSelector);
      if (handElement) {
        return await this.createGenericFadeIn(handElement, { duration: 500 });
      }
    } catch (error) {
      console.error('🚨 Error in animateHandDealCards:', error);
      return Promise.resolve();
    }
  }

  /**
   * 手札入場アニメーション
   */
  async animateHandEntry(playerId, options = {}) {
    const { personality = 'eager', spectacle = 'subtle' } = options;
    
    const handSelector = playerId === 'player' ? '#player-hand' : '#cpu-hand';
    const handElement = document.querySelector(handSelector);
    if (handElement) {
      const cards = handElement.querySelectorAll('.relative');
      for (let i = 0; i < cards.length; i++) {
        await this.createGenericSlideIn(cards[i], { duration: 300 });
        if (i < cards.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }

  /**
   * マリガン再配布アニメーション
   */
  async animateMulliganRedeal(playerId, options = {}) {
    const { personality = 'thoughtful', spectacle = 'swirling' } = options;
    
    // 手札を一度フェードアウトしてからフェードイン
    const handSelector = playerId === 'player' ? '#player-hand' : '#cpu-hand';
    const handElement = document.querySelector(handSelector);
    if (handElement) {
      await this.createGenericFadeOut(handElement, { duration: 300 });
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.createGenericFadeIn(handElement, { duration: 400 });
    }
  }

  /**
   * デッキシャッフルアニメーション
   */
  async animateDeckShuffle(playerIds, options = {}) {
    const { personality = 'excited', spectacle = 'energetic' } = options;
    
    const promises = playerIds.map(playerId => {
      const deckSelector = playerId === 'player' 
        ? '.player-self .deck-container' 
        : '.opponent-board .deck-container';
      const deckElement = document.querySelector(deckSelector);
      
      if (deckElement) {
        return this.createShuffleEffect(deckElement);
      }
    });
    
    await Promise.all(promises.filter(Boolean));
  }

  /**
   * サイドカード配布アニメーション
   */
  async animatePrizeDistribution(playerId, cardCount = 6, options = {}) {
    const { personality = 'systematic', spectacle = 'golden' } = options;
    
    for (let i = 0; i < cardCount; i++) {
      await this.animateSinglePrizeCard(playerId, i);
      if (soundManager?.playCardDeal) {
        soundManager.playCardDeal();
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  /**
   * 単一サイドカード配布アニメーション
   */
  async animateSinglePrizeCard(playerId, prizeIndex, options = {}) {
    const { personality = 'careful', spectacle = 'glowing' } = options;
    
    const deckSelector = playerId === 'player' 
      ? '.bottom-right-deck' 
      : '.top-left-deck';
    const prizeSelector = playerId === 'player' 
      ? '.side-left' 
      : '.side-right';
      
    const deckElement = document.querySelector(deckSelector);
    const prizeContainer = document.querySelector(prizeSelector);
    
    if (deckElement && prizeContainer) {
      return this.createCardMoveAnimation(deckElement, prizeContainer, prizeIndex);
    }
  }

  /**
   * ポケモン配置アニメーション
   */
  async animatePokemonPlacement(playerId, pokemon, zone, index = 0, options = {}) {
    const { personality = 'confident', spectacle = 'normal', setupPhase = false } = options;
    
    // 人間らしいタイミングでディレイ
    const delay = humanTiming.getHumanDelay('personality', personality);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // エフェクト追加
    if (spectacle === 'dramatic') {
      const targetElement = this.getZoneElement(playerId, zone, index);
      if (targetElement && visualEffectsManager?.createPlacementEffect) {
        visualEffectsManager.createPlacementEffect(targetElement);
      }
    }
    
    // カード移動アニメーション
    return this.createCardPlacementAnimation(playerId, pokemon, zone, index);
  }

  /**
   * エネルギー付与アニメーション
   */
  async animateEnergyAttachment(playerId, energyId, pokemonId, options = {}) {
    const { personality = 'careful', spectacle = 'gentle' } = options;
    
    return this.createCardPlacementAnimation(playerId, { id: energyId }, 'energy', 0);
  }

  /**
   * サイドカード取得アニメーション
   */
  async animatePrizeTake(playerId, prizeIndex, card, options = {}) {
    const { personality = 'excited', spectacle = 'glowing' } = options;
    
    const prizeSelector = playerId === 'player' 
      ? `.side-left .card-slot:nth-child(${prizeIndex + 1})` 
      : `.side-right .card-slot:nth-child(${prizeIndex + 1})`;
    const handSelector = playerId === 'player' ? '#player-hand' : '#cpu-hand';
    
    const prizeElement = document.querySelector(prizeSelector);
    const handElement = document.querySelector(handSelector);
    
    if (prizeElement && handElement) {
      return this.createCardMoveAnimation(prizeElement, handElement, 0);
    }
  }

  // ===================== ヘルパーメソッド =====================

  async createShuffleEffect(element) {
    return new Promise(resolve => {
      let shakeCount = 0;
      const interval = setInterval(() => {
        const x = Math.random() * 6 - 3;
        const y = Math.random() * 6 - 3;
        element.style.transform = `translate(${x}px, ${y}px)`;
        shakeCount++;
        
        if (shakeCount >= 6) {
          clearInterval(interval);
          element.style.transform = '';
          resolve();
        }
      }, 100);
    });
  }

  async createCardMoveAnimation(fromElement, toElement, targetIndex = 0) {
    return new Promise(resolve => {
      const cardElement = document.createElement('div');
      cardElement.className = 'absolute w-16 h-22 rounded-lg border border-gray-600 transition-all duration-600';
      cardElement.style.zIndex = '100';
      cardElement.innerHTML = '<img src="assets/ui/card_back.webp" class="w-full h-full object-cover rounded-lg">';
      
      const fromRect = fromElement.getBoundingClientRect();
      cardElement.style.left = `${fromRect.left}px`;
      cardElement.style.top = `${fromRect.top}px`;
      
      document.body.appendChild(cardElement);
      
      const toRect = toElement.getBoundingClientRect();
      
      requestAnimationFrame(() => {
        cardElement.style.left = `${toRect.left}px`;
        cardElement.style.top = `${toRect.top}px`;
        
        setTimeout(() => {
          if (document.body.contains(cardElement)) {
            document.body.removeChild(cardElement);
          }
          resolve();
        }, 600);
      });
    });
  }

  async createCardPlacementAnimation(playerId, card, zone, index) {
    // 基本的なフェードイン効果
    const targetElement = this.getZoneElement(playerId, zone, index);
    if (targetElement) {
      return this.createGenericFadeIn(targetElement, { duration: 400 });
    }
  }

  getZoneElement(playerId, zone, index) {
    const baseSelector = playerId === 'player' ? '.player-self' : '.opponent-board';
    
    switch (zone) {
      case 'active':
        return document.querySelector(`${baseSelector} .active-container`);
      case 'bench':
        return document.querySelector(`${baseSelector} .bench-slot:nth-child(${index + 1})`);
      case 'hand':
        return document.querySelector(playerId === 'player' ? '#player-hand' : '#cpu-hand');
      default:
        return null;
    }
  }
}

// デフォルトの次世代統一アニメーション オーケストレーター インスタンス
export const unifiedAnimationManager = new UnifiedAnimationManager();

// animationManager は animations.js から直接インポートしてください

// CSS アニメーション定義を動的に追加
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes explosionExpand {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(2); opacity: 0.8; }
      100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
    }
    
    @keyframes handGlow {
      0% { opacity: 0; }
      50% { opacity: 1; }
      100% { opacity: 0; }
    }
    
    @keyframes landingGlow {
      0% { opacity: 0; transform: scale(0.5); }
      50% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.2); }
    }
    
    @keyframes rippleExpand {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(20); opacity: 0; }
    }
  `;
  document.head.appendChild(styleSheet);
  
  // 追加のアニメーション定義
  const additionalStyles = document.createElement('style');
  additionalStyles.textContent = `
    @keyframes shockwaveExpand {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(10); opacity: 0; }
    }
    
    @keyframes evolutionPulse {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
      25% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
      50% { opacity: 0.8; transform: translate(-50%, -50%) scale(0.9); }
      75% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
    }
    
    @keyframes prizeGlow {
      0% { opacity: 0; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.1); }
      100% { opacity: 0; transform: scale(1); }
    }
  `;
  document.head.appendChild(additionalStyles);
}