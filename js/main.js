import { Game } from './game.js';
import { errorHandler } from './error-handler.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('main.js loaded and DOMContentLoaded fired!');

    function initializeApp() {
        console.log('initializeApp() called.');
        const root = document.getElementById('game-board');
        if (!root) {
            errorHandler.handleError(new Error('ゲームボードのルート要素が見つかりません。'), 'setup_failed');
            return;
        }

        const game = new Game(root, window.playmatSlotsData);
        console.log('Game instance created.');
        game.init();
        console.log('game.init() called.');
    }

    console.log('Calling initializeApp()...');
    initializeApp();
    console.log('initializeApp() finished.');
});