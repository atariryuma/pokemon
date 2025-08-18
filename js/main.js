/**
 * ポケモンカードバトルゲーム - メインエントリーポイント
 * 学習用ゲームとして設計されており、SLV（State-Logic-View）アーキテクチャを採用
 */

import { Game } from './game.js';
import { cardMasterList } from './cards.js';

/**
 * DOM要素への参照を管理するオブジェクト
 * 新しいHTML構造に対応した要素IDを使用
 */
const elements = {
  // ゲームヘッダー要素
  turnPlayer: document.getElementById('turn-player'),
  turnIndicator: document.getElementById('turn-indicator'),
  endTurnButton: document.getElementById('end-turn-button'),
  
  // ゲーム状況パネル要素
  infoText: document.getElementById('info-text'),
  logScroll: document.getElementById('log-scroll'),
  stadiumZone: document.getElementById('stadium-zone'),
  
  // CPU側のゲームゾーン要素
  cpuPrize: document.getElementById('cpu-prize'),
  cpuPrizeArea: document.getElementById('cpu-prize-area'),
  cpuDiscard: document.getElementById('cpu-discard'),
  cpuDeck: document.getElementById('cpu-deck'),
  cpuDeckCount: document.getElementById('cpu-deck-count'),
  cpuHand: document.getElementById('cpu-hand'),
  cpuActive: document.getElementById('cpu-active'),
  cpuBench: document.getElementById('cpu-bench'),
  
  // プレイヤー側のゲームゾーン要素
  youPrize: document.getElementById('you-prize'),
  youPrizeArea: document.getElementById('you-prize-area'),
  youDiscard: document.getElementById('you-discard'),
  youDeck: document.getElementById('you-deck'),
  youDeckCount: document.getElementById('you-deck-count'),
  youHand: document.getElementById('you-hand'),
  youActive: document.getElementById('you-active'),
  youBench: document.getElementById('you-bench'),
  
  // アクションモーダル要素
  actionModal: document.getElementById('action-modal'),
  modalTitle: document.getElementById('modal-title'),
  modalActions: document.getElementById('modal-actions'),
  modalCancelButton: document.getElementById('modal-cancel-button'),
};

// グローバル変数
let currentGame = null;

/**
 * ゲームログに新しいメッセージを追加する関数
 * 子供にも理解しやすいように時刻と一緒にメッセージを表示
 * @param {string} message - 表示するメッセージ
 */
function addGameLog(message) {
  if (!elements.logScroll) return;
  
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  // 時刻を分かりやすい形式で表示
  const now = new Date();
  const timeString = now.toLocaleTimeString('ja-JP', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  
  logEntry.innerHTML = `<span class="log-time">[${timeString}]</span> ${message}`;
  elements.logScroll.appendChild(logEntry);
  
  // 自動スクロールでログの最新部分を表示
  elements.logScroll.scrollTop = elements.logScroll.scrollHeight;
  
  // ログが多くなりすぎた場合は古いものを削除（最大100エントリ）
  const entries = elements.logScroll.children;
  if (entries.length > 100) {
    elements.logScroll.removeChild(entries[0]);
  }
}

/**
 * エラーメッセージを表示する関数
 * @param {string} message - エラーメッセージ
 * @param {Error} error - エラーオブジェクト（オプション）
 */
function displayError(message, error = null) {
  console.error('ゲームエラー:', message, error);
  
  addGameLog(`❌ エラー: ${message}`);
  
  if (elements.infoText) {
    elements.infoText.textContent = `エラー: ${message}`;
    elements.infoText.style.color = 'var(--danger)';
  }
}

/**
 * 成功メッセージを表示する関数
 * @param {string} message - 成功メッセージ
 */
function displaySuccess(message) {
  addGameLog(`✅ ${message}`);
  
  if (elements.infoText) {
    elements.infoText.textContent = message;
    elements.infoText.style.color = 'var(--success)';
  }
}

/**
 * 新しいゲームを開始する関数
 * ゲームの初期化と必要なイベントハンドラの設定を行う
 */
async function startNewGame() {
  try {
    addGameLog('🎮 新しいゲームを開始します...');
    
    // 現在のゲームをクリーンアップ
    if (currentGame) {
      currentGame.cleanup();
      currentGame = null;
    }
    
    // ゲームインスタンスを作成
    currentGame = new Game();
    
    // ゲームを初期化
    await currentGame.init();
    
    displaySuccess('ゲームが正常に開始されました！');
    
  } catch (error) {
    displayError('ゲームの開始に失敗しました', error);
  }
}

/**
 * ゲームを再開始する関数
 * 現在のゲームをリセットして新しいゲームを開始
 */
function restartGame() {
  addGameLog('🔄 ゲームを再開始します...');
  
  // ログをクリア（最初のメッセージ以外）
  if (elements.logScroll) {
    elements.logScroll.innerHTML = '';
  }
  
  // 新しいゲームを開始
  startNewGame();
}

/**
 * DOM要素の存在確認を行う関数
 * @returns {boolean} 必要な要素がすべて存在するかどうか
 */
function validateDOMElements() {
  const missingElements = [];
  const criticalElements = [
    'turnPlayer', 'turnIndicator', 'endTurnButton',
    'infoText', 'logScroll',
    'youHand', 'youActive', 'youBench', 'youDeck',
    'cpuHand', 'cpuActive', 'cpuBench', 'cpuDeck'
  ];
  
  criticalElements.forEach(key => {
    if (!elements[key]) {
      missingElements.push(key);
    }
  });
  
  if (missingElements.length > 0) {
    console.warn('以下の重要なDOM要素が見つかりません:', missingElements);
    displayError(`HTML要素が不足しています: ${missingElements.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * アプリケーションのメイン初期化関数
 * ページ読み込み完了時に実行される
 */
function initializeApplication() {
  console.log('🚀 ポケモンカードバトルゲームを初期化中...');
  
  // DOM要素の存在確認
  if (!validateDOMElements()) {
    return;
  }
  
  // 初期メッセージを表示
  if (elements.infoText) {
    elements.infoText.textContent = 'ゲームを初期化しています...';
    elements.infoText.style.color = 'var(--info)';
  }
  
  addGameLog('🎯 アプリケーションを初期化しています...');
  
  // カードマスターリストの確認
  try {
    // cards.js からカードデータが正常に読み込まれているか確認
    if (!cardMasterList || cardMasterList.length === 0) {
      throw new Error('カードマスターリストが空です');
    }
    addGameLog(`📚 ${cardMasterList.length}枚のカードデータを読み込みました`);
  } catch (error) {
    displayError('カードデータの読み込みに失敗しました', error);
    return;
  }
  
  // ゲームを自動開始
  setTimeout(() => {
    startNewGame();
  }, 500); // 少し遅延させてUIの更新を確実にする
}

/**
 * エラーハンドリング
 * 予期しないエラーをキャッチして適切に表示
 */
window.addEventListener('error', (event) => {
  displayError('予期しないエラーが発生しました', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  displayError('処理中にエラーが発生しました', event.reason);
  event.preventDefault(); // ブラウザのデフォルトエラー表示を抑制
});

// デバッグ用: ゲームオブジェクトをグローバルに公開（開発時のみ）
if (typeof window !== 'undefined') {
  window.getCurrentGame = () => currentGame;
  window.restartGame = restartGame;
  window.addGameLog = addGameLog;
}

// ページ読み込み完了時にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', initializeApplication);