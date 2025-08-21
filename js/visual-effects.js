/**
 * VISUAL-EFFECTS.JS - 視覚演出エフェクト管理システム
 * 
 * ゲーム内の視覚エフェクトとアニメーションを管理
 */

/**
 * 視覚エフェクトマネージャークラス
 */
export class VisualEffectsManager {
  constructor() {
    this.isEnabled = true;
    this.effectsContainer = null;
    this.setupEffectsContainer();
  }

  /**
   * エフェクト用のコンテナを設定
   */
  setupEffectsContainer() {
    // 既存のコンテナをチェック
    this.effectsContainer = document.getElementById('visual-effects-container');
    
    if (!this.effectsContainer) {
      this.effectsContainer = document.createElement('div');
      this.effectsContainer.id = 'visual-effects-container';
      this.effectsContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 999;
        overflow: hidden;
      `;
      document.body.appendChild(this.effectsContainer);
    }
  }

  /**
   * エフェクトを有効/無効切り替え
   * @param {boolean} enabled - 有効フラグ
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * 基本的なパーティクルエフェクトを作成
   * @param {object} options - エフェクトオプション
   */
  createParticleEffect(options = {}) {
    if (!this.isEnabled) return;

    const {
      x = window.innerWidth / 2,
      y = window.innerHeight / 2,
      count = 20,
      color = '#FFD700',
      size = 4,
      duration = 2000,
      spread = 100,
      type = 'sparkle'
    } = options;

    for (let i = 0; i < count; i++) {
      this.createParticle({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        color,
        size: size + Math.random() * size,
        duration,
        type
      });
    }
  }

  /**
   * 個別パーティクルを作成
   * @param {object} options - パーティクルオプション
   */
  createParticle(options = {}) {
    const {
      x = 0,
      y = 0,
      color = '#FFD700',
      size = 4,
      duration = 2000,
      type = 'sparkle'
    } = options;

    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      pointer-events: none;
      animation: particleFloat ${duration}ms ease-out forwards;
      z-index: 1000;
    `;

    // パーティクルタイプ別のスタイル
    switch (type) {
      case 'sparkle':
        particle.style.boxShadow = `0 0 ${size * 2}px ${color}`;
        break;
      case 'star':
        particle.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
        break;
      case 'circle':
        // デフォルトの円形
        break;
    }

    this.effectsContainer.appendChild(particle);

    // パーティクルを自動削除
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, duration);
  }

  /**
   * 画面フラッシュエフェクト
   * @param {string} color - フラッシュカラー
   * @param {number} duration - 持続時間（ミリ秒）
   * @param {number} opacity - 最大不透明度
   */
  createScreenFlash(color = '#FFFFFF', duration = 300, opacity = 0.5) {
    if (!this.isEnabled) return;

    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: ${color};
      opacity: 0;
      pointer-events: none;
      z-index: 998;
      animation: screenFlash ${duration}ms ease-out forwards;
    `;

    // CSS動的アニメーション
    const style = document.createElement('style');
    style.textContent = `
      @keyframes screenFlash {
        0% { opacity: 0; }
        50% { opacity: ${opacity}; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    this.effectsContainer.appendChild(flash);

    setTimeout(() => {
      if (flash.parentNode) {
        flash.parentNode.removeChild(flash);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, duration);
  }

  /**
   * テキスト浮上エフェクト
   * @param {string} text - 表示テキスト
   * @param {object} options - オプション
   */
  createFloatingText(text, options = {}) {
    if (!this.isEnabled) return;

    const {
      x = window.innerWidth / 2,
      y = window.innerHeight / 2,
      color = '#FFD700',
      fontSize = '24px',
      duration = 2000,
      direction = 'up'
    } = options;

    const textElement = document.createElement('div');
    textElement.textContent = text;
    textElement.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      transform: translateX(-50%);
      color: ${color};
      font-size: ${fontSize};
      font-weight: bold;
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 1001;
      animation: floatingText${direction.charAt(0).toUpperCase() + direction.slice(1)} ${duration}ms ease-out forwards;
    `;

    this.effectsContainer.appendChild(textElement);

    setTimeout(() => {
      if (textElement.parentNode) {
        textElement.parentNode.removeChild(textElement);
      }
    }, duration);
  }

  /**
   * 要素ハイライトエフェクト
   * @param {HTMLElement} element - ハイライト対象要素
   * @param {object} options - オプション
   */
  highlightElement(element, options = {}) {
    if (!this.isEnabled || !element) return;

    const {
      color = '#FFD700',
      duration = 1000,
      intensity = 0.8,
      pulse = true
    } = options;

    const originalBoxShadow = element.style.boxShadow;
    const glowEffect = `0 0 20px ${color}, 0 0 40px ${color}`;

    if (pulse) {
      element.style.animation = `highlightPulse ${duration}ms ease-in-out`;
      element.style.boxShadow = glowEffect;
    } else {
      element.style.boxShadow = glowEffect;
      element.style.transition = `box-shadow ${duration}ms ease-out`;
    }

    setTimeout(() => {
      element.style.boxShadow = originalBoxShadow;
      element.style.animation = '';
      element.style.transition = '';
    }, duration);
  }

  /**
   * カード配布エフェクト
   * @param {HTMLElement} fromElement - 配布元要素
   * @param {HTMLElement} toElement - 配布先要素
   * @param {object} options - オプション
   */
  createCardDealEffect(fromElement, toElement, options = {}) {
    if (!this.isEnabled || !fromElement || !toElement) return;

    const {
      duration = 600,
      trail = true,
      sparkles = true
    } = options;

    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    // トレイルエフェクト
    if (trail) {
      this.createTrailEffect(
        { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 },
        { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 },
        { duration, color: '#4FC3F7' }
      );
    }

    // 到着時のスパークルエフェクト
    if (sparkles) {
      setTimeout(() => {
        this.createParticleEffect({
          x: toRect.left + toRect.width / 2,
          y: toRect.top + toRect.height / 2,
          count: 8,
          color: '#FFD700',
          size: 3,
          duration: 800,
          spread: 30,
          type: 'sparkle'
        });
      }, duration - 100);
    }
  }

  /**
   * トレイルエフェクト（軌跡）
   * @param {object} from - 開始点 {x, y}
   * @param {object} to - 終了点 {x, y}
   * @param {object} options - オプション
   */
  createTrailEffect(from, to, options = {}) {
    const {
      duration = 600,
      color = '#4FC3F7',
      width = 2,
      segments = 20
    } = options;

    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    for (let i = 0; i < segments; i++) {
      setTimeout(() => {
        const progress = i / segments;
        const x = from.x + deltaX * progress;
        const y = from.y + deltaY * progress;

        this.createParticle({
          x,
          y,
          color,
          size: width,
          duration: 300,
          type: 'circle'
        });
      }, (duration / segments) * i);
    }
  }

  /**
   * じゃんけんエフェクト
   */
  playRockPaperScissorsEffect(choice, isWinner) {
    if (!this.isEnabled) return;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // 選択エフェクト
    const choiceEmojis = {
      rock: '✊',
      paper: '✋',
      scissors: '✌️'
    };

    this.createFloatingText(choiceEmojis[choice], {
      x: centerX,
      y: centerY,
      fontSize: '48px',
      duration: 1500,
      color: isWinner ? '#FFD700' : '#87CEEB'
    });

    // 結果エフェクト
    setTimeout(() => {
      if (isWinner) {
        this.createScreenFlash('#FFD700', 500, 0.3);
        this.createParticleEffect({
          x: centerX,
          y: centerY,
          count: 30,
          color: '#FFD700',
          size: 6,
          duration: 2000,
          spread: 200,
          type: 'star'
        });
        this.createFloatingText('勝利！', {
          x: centerX,
          y: centerY - 100,
          fontSize: '32px',
          color: '#FFD700',
          duration: 2000
        });
      } else {
        this.createScreenFlash('#87CEEB', 300, 0.2);
        this.createFloatingText('敗北...', {
          x: centerX,
          y: centerY - 100,
          fontSize: '24px',
          color: '#87CEEB',
          duration: 1500
        });
      }
    }, 1000);
  }

  /**
   * フェーズ遷移エフェクト
   * @param {string} phaseName - フェーズ名
   */
  playPhaseTransitionEffect(phaseName) {
    if (!this.isEnabled) return;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 3;

    // フェーズ名表示
    this.createFloatingText(phaseName, {
      x: centerX,
      y: centerY,
      fontSize: '28px',
      color: '#4FC3F7',
      duration: 2000,
      direction: 'up'
    });

    // 背景フラッシュ
    this.createScreenFlash('#4FC3F7', 400, 0.1);

    // パーティクルエフェクト
    this.createParticleEffect({
      x: centerX,
      y: centerY,
      count: 15,
      color: '#4FC3F7',
      size: 4,
      duration: 1500,
      spread: 150,
      type: 'circle'
    });
  }

  /**
   * ポケモン配置エフェクト
   * @param {HTMLElement} cardElement - カード要素
   */
  playPokemonPlaceEffect(cardElement) {
    if (!this.isEnabled || !cardElement) return;

    const rect = cardElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // ハイライトエフェクト
    this.highlightElement(cardElement, {
      color: '#32CD32',
      duration: 800,
      pulse: true
    });

    // 配置確定のスパークル
    this.createParticleEffect({
      x: centerX,
      y: centerY,
      count: 12,
      color: '#32CD32',
      size: 4,
      duration: 1000,
      spread: 60,
      type: 'sparkle'
    });
  }

  /**
   * カード公開エフェクト
   */
  playCardRevealEffect() {
    if (!this.isEnabled) return;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // 画面全体のキラキラエフェクト
    this.createScreenFlash('#FFD700', 600, 0.2);

    // 大量のスパークル
    this.createParticleEffect({
      x: centerX,
      y: centerY,
      count: 50,
      color: '#FFD700',
      size: 5,
      duration: 3000,
      spread: 300,
      type: 'star'
    });

    // 「バトル開始！」テキスト
    setTimeout(() => {
      this.createFloatingText('バトル開始！', {
        x: centerX,
        y: centerY,
        fontSize: '48px',
        color: '#FF6B35',
        duration: 3000
      });
    }, 500);
  }
}

// CSS アニメーションを動的に追加
const style = document.createElement('style');
style.textContent = `
  @keyframes particleFloat {
    0% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    100% {
      transform: translateY(-100px) scale(0);
      opacity: 0;
    }
  }

  @keyframes floatingTextUp {
    0% {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    100% {
      transform: translateX(-50%) translateY(-80px);
      opacity: 0;
    }
  }

  @keyframes floatingTextDown {
    0% {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    100% {
      transform: translateX(-50%) translateY(80px);
      opacity: 0;
    }
  }

  @keyframes highlightPulse {
    0%, 100% {
      transform: scale(1);
      filter: brightness(1);
    }
    50% {
      transform: scale(1.05);
      filter: brightness(1.2);
    }
  }
`;
document.head.appendChild(style);

// デフォルトのビジュアルエフェクトマネージャーインスタンス
export const visualEffectsManager = new VisualEffectsManager();