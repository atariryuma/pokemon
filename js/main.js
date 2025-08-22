import { Game } from './game.js';
import { errorHandler } from './error-handler.js';
import { animate } from './animation-manager.js';
import { enableAutoRefresh } from './data-manager.js';

const noop = () => {};

document.addEventListener('DOMContentLoaded', () => {
    noop('main.js loaded and DOMContentLoaded fired!');

    function initializeApp() {
        noop('initializeApp() called.');
        const root = document.getElementById('game-board');
        if (!root) {
            errorHandler.handleError(new Error('ゲームボードのルート要素が見つかりません。'), 'setup_failed');
            return;
        }

        const game = new Game(root, window.playmatSlotsData);
        // Make game instance globally accessible for energy animations
        window.game = game;
        
        // Configure animation settings for performance
        animate.setQuality(window.matchMedia('(max-width: 768px)').matches ? 'medium' : 'high');
        
        // Make animation manager globally accessible for debugging
        window.animate = animate;
        noop('Game instance created.');
        
        // Enable auto-refresh for card data when returning from editor
        enableAutoRefresh();
        noop('Auto-refresh enabled for card data.');
        
        game.init();
        noop('game.init() called.');
    }

    noop('Calling initializeApp()...');
    initializeApp();
    noop('initializeApp() finished.');
});