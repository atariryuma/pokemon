import { Game } from './game.js';
import { errorHandler } from './error-handler.js';
import { animate } from './animation-manager.js';
import { enableAutoRefresh } from './data-manager.js';
import { debugSystem } from './debug-system.js';

const noop = () => {};

// 初期化状態の追跡
let initializationState = {
    started: false,
    completed: false,
    error: null
};

// 初期化プロセスの確実な実行
async function initializeApp() {
    if (initializationState.started) {
        console.warn('⚠️ Initialization already in progress or completed');
        return;
    }
    
    initializationState.started = true;
    
    try {
        // DOM要素の存在確認
        const root = document.getElementById('game-board');
        if (!root) {
            throw new Error('ゲームボードのルート要素が見つかりません。');
        }

        // ゲームインスタンスの作成
        const game = new Game(root, window.playmatSlotsData);
        
        // グローバルアクセスを確保
        window.game = game;
        
        // アニメーション設定
        animate.setQuality(window.matchMedia('(max-width: 768px)').matches ? 'medium' : 'high');
        window.animate = animate;
        
        // カードデータ自動更新機能を有効化
        enableAutoRefresh();
        
        // ゲーム初期化を実行
        await game.init();
        
        // デバッグシステム起動
        window.debugSystem = debugSystem;
        debugSystem.enable('DEBUG');
        // 初回測定は定期測定開始時に実行されるため削除
        
        initializationState.completed = true;
        
        // 初期化完了をグローバルイベントで通知
        window.dispatchEvent(new CustomEvent('gameInitialized', { 
            detail: { game, success: true } 
        }));
        
    } catch (error) {
        initializationState.error = error;
        console.error('❌ Game initialization failed:', error);
        
        // エラーハンドラーで処理
        errorHandler.handleError(error, 'game_initialization_failed');
        
        // エラー通知イベント
        window.dispatchEvent(new CustomEvent('gameInitialized', { 
            detail: { game: null, success: false, error } 
        }));
        
        // フォールバック: 基本的なボタン機能のみ有効化
        setupFallbackButtonHandlers();
    }
}

// フォールバック: 基本的なボタン機能
function setupFallbackButtonHandlers() {
    const startButton = document.getElementById('start-game-button-float');
    if (startButton) {
        startButton.addEventListener('click', () => {
            alert('ゲームの初期化に失敗しました。ページを再読み込みしてください。');
        });
    }
    
    const editorButton = document.getElementById('card-editor-button-float');
    if (editorButton) {
        editorButton.addEventListener('click', () => {
            window.open('card_viewer.html', '_blank');
        });
    }
}

// 確実なDOMContentLoaded処理
function ensureDOMReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// メイン初期化処理
ensureDOMReady(async () => {
    await initializeApp();
});

// デバッグ情報をグローバルに提供
window.gameDebug = {
    initializationState,
    reinitialize: initializeApp,
    setupFallback: setupFallbackButtonHandlers
};