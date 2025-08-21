import { Game } from './game.js';
import { errorHandler } from './error-handler.js';

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
        noop('Game instance created.');
        game.init();
        noop('game.init() called.');
    }

    noop('Calling initializeApp()...');
    initializeApp();
    noop('initializeApp() finished.');
});