import { Game } from './game.js';

/**
 * ページ読み込み完了時にアプリケーションを初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  /**
   * アプリケーションのエントリーポイント
   */
  function initializeApp() {
    const root = document.getElementById('game-board');
    if (!root) {
      console.error('ゲームボードのルート要素が見つかりません。');
      return;
    }

    const game = new Game(root);
    game.init();
  }

  initializeApp();
});