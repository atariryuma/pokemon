import { Game } from './game.js';
import { errorHandler } from './error-handler.js';
import { animate } from './animation-manager.js';
import { enableAutoRefresh } from './data-manager.js';

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
    console.log('🚀 main.js: Starting game initialization...');
    
    try {
        // DOM要素の存在確認
        const root = document.getElementById('game-board');
        if (!root) {
            throw new Error('ゲームボードのルート要素が見つかりません。');
        }
        console.log('✅ Game board element found:', root);

        // プレイマットデータの確認
        if (!window.playmatSlotsData) {
            console.warn('⚠️ Playmat slots data not available, using fallback');
        }
        console.log('📍 Playmat slots data:', window.playmatSlotsData ? 'Available' : 'Not available');

        // ゲームインスタンスの作成
        console.log('🎮 Creating Game instance...');
        const game = new Game(root, window.playmatSlotsData);
        
        // グローバルアクセスを確保
        window.game = game;
        console.log('🌍 Game instance set to window.game');
        
        // アニメーション設定
        animate.setQuality(window.matchMedia('(max-width: 768px)').matches ? 'medium' : 'high');
        window.animate = animate;
        console.log('🎬 Animation manager configured');
        
        // カードデータ自動更新機能を有効化
        enableAutoRefresh();
        console.log('🔄 Auto-refresh for card data enabled');
        
        // ゲーム初期化を実行
        console.log('⚡ Calling game.init()...');
        await game.init();
        console.log('✅ Game initialization completed successfully!');
        
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
    console.log('🔧 Setting up fallback button handlers...');
    
    const startButton = document.getElementById('start-game-button-float');
    if (startButton) {
        startButton.addEventListener('click', () => {
            console.log('🔘 Start button clicked (fallback mode)');
            alert('ゲームの初期化に失敗しました。ページを再読み込みしてください。');
        });
        console.log('⚠️ Fallback handler attached to start button');
    }
    
    const editorButton = document.getElementById('card-editor-button-float');
    if (editorButton) {
        editorButton.addEventListener('click', () => {
            console.log('🔘 Editor button clicked (fallback mode)');
            window.open('card_viewer.html', '_blank');
        });
        console.log('⚠️ Fallback handler attached to editor button');
    }
}

// 確実なDOMContentLoaded処理
function ensureDOMReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
        console.log('📅 Waiting for DOMContentLoaded...');
    } else {
        console.log('📅 DOM already ready, executing immediately');
        callback();
    }
}

// メイン初期化処理
console.log('📦 main.js module loaded');
ensureDOMReady(async () => {
    console.log('🏁 DOM ready, starting initialization...');
    await initializeApp();
    console.log('🎉 Main initialization process completed');
});

// デバッグ情報をグローバルに提供
window.gameDebug = {
    initializationState,
    reinitialize: initializeApp,
    setupFallback: setupFallbackButtonHandlers
};