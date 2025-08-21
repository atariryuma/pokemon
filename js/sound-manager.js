/**
 * SOUND-MANAGER.JS - サウンドエフェクト管理システム
 * 
 * Web Audio APIを使用してゲーム内のサウンドエフェクトを管理
 */

/**
 * サウンドマネージャークラス
 * ゲーム内のサウンドエフェクトを統一管理
 */
export class SoundManager {
  constructor() {
    this.audioContext = null;
    this.masterVolume = 0.3; // デフォルト音量
    this.sounds = new Map(); // プリロードされたサウンド
    this.isEnabled = true;
    this.isInitialized = false;
  }

  /**
   * オーディオコンテキストを初期化
   * ユーザーインタラクション後に呼び出す必要がある
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.isInitialized = true;
      console.log('🔊 Sound Manager initialized');
    } catch (error) {
      console.warn('🔇 Sound Manager could not be initialized:', error);
      this.isEnabled = false;
    }
  }

  /**
   * 音量を設定
   * @param {number} volume - 0.0〜1.0の音量
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * サウンドエフェクトを有効/無効切り替え
   * @param {boolean} enabled - 有効フラグ
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * 周波数ベースのトーンを生成
   * @param {number} frequency - 周波数（Hz）
   * @param {number} duration - 再生時間（秒）
   * @param {string} type - 波形タイプ ('sine', 'square', 'triangle', 'sawtooth')
   * @param {number} volume - 音量（0.0〜1.0）
   */
  playTone(frequency, duration, type = 'sine', volume = 1.0) {
    if (!this.isEnabled || !this.isInitialized || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      const finalVolume = this.masterVolume * volume;
      gainNode.gain.value = finalVolume;

      // エンベロープ（音の立ち上がりと減衰）
      const currentTime = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(finalVolume, currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);
    } catch (error) {
      console.warn('🔇 Failed to play tone:', error);
    }
  }

  /**
   * ゲームイベント用のサウンドエフェクト
   */
  
  // じゃんけん関連
  playRockPaperScissorsStart() {
    // じゃんけん開始の効果音（上昇トーン）
    this.playTone(440, 0.1, 'triangle', 0.8);
    setTimeout(() => this.playTone(554, 0.1, 'triangle', 0.8), 100);
    setTimeout(() => this.playTone(659, 0.2, 'triangle', 0.8), 200);
  }

  playRockPaperScissorsChoice() {
    // 選択時の効果音（クリック音）
    this.playTone(800, 0.08, 'square', 0.6);
  }

  playRockPaperScissorsResult(isWinner) {
    if (isWinner) {
      // 勝利時（明るい和音）
      this.playTone(523, 0.3, 'sine', 0.7); // C
      setTimeout(() => this.playTone(659, 0.3, 'sine', 0.7), 50); // E
      setTimeout(() => this.playTone(784, 0.4, 'sine', 0.7), 100); // G
    } else {
      // 敗北時（下降トーン）
      this.playTone(440, 0.2, 'triangle', 0.6);
      setTimeout(() => this.playTone(370, 0.3, 'triangle', 0.6), 150);
    }
  }

  // フェーズ遷移
  playPhaseTransition() {
    // フェーズ遷移の効果音（スイープ）
    const oscillator = this.audioContext?.createOscillator();
    const gainNode = this.audioContext?.createGain();
    
    if (!oscillator || !gainNode) return;

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sine';
    
    const currentTime = this.audioContext.currentTime;
    const duration = 0.5;
    
    oscillator.frequency.setValueAtTime(200, currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, currentTime + duration);
    
    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.4, currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

    oscillator.start(currentTime);
    oscillator.stop(currentTime + duration);
  }

  // カード配布
  playCardDeal() {
    // カード配布の効果音（軽いタップ音）
    this.playTone(600, 0.05, 'triangle', 0.4);
    setTimeout(() => this.playTone(800, 0.03, 'triangle', 0.3), 30);
  }

  playHandDeal() {
    // 手札配布完了の効果音（上昇アルペジオ）
    const notes = [262, 330, 392, 523]; // C, E, G, C（高）
    notes.forEach((note, index) => {
      setTimeout(() => this.playTone(note, 0.15, 'sine', 0.5), index * 80);
    });
  }

  // ポケモン配置
  playPokemonPlace() {
    // ポケモン配置の効果音（確定音）
    this.playTone(523, 0.1, 'triangle', 0.7);
    setTimeout(() => this.playTone(659, 0.15, 'triangle', 0.7), 80);
  }

  playCardReveal() {
    // カード公開の効果音（キラキラ音）
    const frequencies = [1047, 1319, 1568, 2093]; // C6, E6, G6, C7
    frequencies.forEach((freq, index) => {
      setTimeout(() => this.playTone(freq, 0.1, 'sine', 0.3), index * 30);
    });
  }

  // UI操作
  playButtonClick() {
    // ボタンクリックの効果音
    this.playTone(1000, 0.05, 'square', 0.5);
  }

  playButtonHover() {
    // ボタンホバーの効果音
    this.playTone(800, 0.03, 'sine', 0.3);
  }

  playConfirm() {
    // 確定操作の効果音
    this.playTone(659, 0.1, 'triangle', 0.6);
    setTimeout(() => this.playTone(784, 0.15, 'triangle', 0.6), 70);
  }

  playError() {
    // エラーの効果音（不協和音）
    this.playTone(220, 0.3, 'sawtooth', 0.5);
    setTimeout(() => this.playTone(233, 0.3, 'sawtooth', 0.5), 50);
  }

  // バトルアクション
  playCardDraw() {
    // カードドローの効果音
    this.playTone(740, 0.1, 'triangle', 0.6);
    setTimeout(() => this.playTone(880, 0.08, 'triangle', 0.5), 60);
  }

  playAttack() {
    // 攻撃の効果音（パワフル）
    this.playTone(147, 0.2, 'sawtooth', 0.8); // 低音
    setTimeout(() => this.playTone(294, 0.15, 'square', 0.7), 50); // 倍音
    setTimeout(() => this.playTone(1100, 0.1, 'sine', 0.4), 100); // 高音のアクセント
  }

  playDamage() {
    // ダメージの効果音（衝撃音）
    this.playTone(100, 0.2, 'square', 0.9);
    setTimeout(() => this.playTone(80, 0.15, 'sawtooth', 0.7), 80);
  }

  playVictory() {
    // 勝利ファンファーレ
    const melody = [523, 659, 784, 1047]; // C, E, G, C（オクターブ）
    melody.forEach((note, index) => {
      setTimeout(() => this.playTone(note, 0.4, 'triangle', 0.8), index * 200);
    });
  }

  /**
   * 設定の保存/読み込み
   */
  saveSettings() {
    localStorage.setItem('pokemon-sound-settings', JSON.stringify({
      enabled: this.isEnabled,
      volume: this.masterVolume
    }));
  }

  loadSettings() {
    try {
      const settings = localStorage.getItem('pokemon-sound-settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this.isEnabled = parsed.enabled ?? true;
        this.masterVolume = parsed.volume ?? 0.3;
      }
    } catch (error) {
      console.warn('🔇 Failed to load sound settings:', error);
    }
  }
}

// デフォルトのサウンドマネージャーインスタンス
export const soundManager = new SoundManager();

// 初期設定の読み込み
soundManager.loadSettings();