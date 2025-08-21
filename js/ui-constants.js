/**
 * UI要素のID定数管理
 * 全システムで統一的に使用される
 */

// ボタンID定数
export const BUTTON_IDS = {
    // 静的アクションボタン（HTML固定）
    RETREAT: 'retreat-button',
    ATTACK: 'attack-button',
    END_TURN: 'end-turn-button',
    
    // セットアップフェーズボタン
    CONFIRM_SETUP: 'confirm-setup-button',
    CONFIRM_INITIAL_POKEMON: 'confirm-initial-pokemon-button',
    
    // その他のUI要素
    ACTION_MODAL_OK: 'action-modal-ok',
    ACTION_MODAL_CANCEL: 'action-modal-cancel'
};

// コンテナID定数
export const CONTAINER_IDS = {
    // 静的ボタンコンテナ
    STATIC_ACTION_BUTTONS: 'static-action-buttons',
    
    // 動的ボタンコンテナ
    PLAYER_ACTION_BUTTONS: 'player-action-buttons',
    DYNAMIC_INTERACTIVE_BUTTONS: 'dynamic-interactive-buttons',
    
    // その他のコンテナ
    ACTION_MODAL: 'action-modal',
    GAME_MESSAGE_DISPLAY: 'game-message-display',
    
    // プレイヤーエリア
    PLAYER_HAND: 'player-hand',
    CPU_HAND: 'cpu-hand',
    PLAYER_BOARD: 'player-board',
    CPU_BOARD: 'cpu-board',
    
    // ゲームステータス
    GAME_STATUS_PANEL: 'game-status-panel',
    PHASE_INDICATOR: 'phase-indicator',
    TURN_INDICATOR: 'turn-indicator',
    CURRENT_PLAYER: 'current-player'
};

// ボタン表示用の配列定数
export const ACTION_BUTTON_GROUPS = {
    // プレイヤーメインフェーズで表示するボタン
    PLAYER_MAIN: [
        BUTTON_IDS.RETREAT,
        BUTTON_IDS.ATTACK,
        BUTTON_IDS.END_TURN
    ],
    
    // セットアップフェーズで表示するボタン
    SETUP: [
        BUTTON_IDS.CONFIRM_SETUP
    ],
    
    // 初期ポケモン選択で表示するボタン
    INITIAL_POKEMON: [
        BUTTON_IDS.CONFIRM_INITIAL_POKEMON
    ]
};

// CSS クラス名定数
export const CSS_CLASSES = {
    HIDDEN: 'hidden',
    VISIBLE: 'visible',
    DISABLED: 'disabled',
    ACTIVE: 'active',
    
    // ボタンスタイル
    BUTTON_PRIMARY: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg text-sm',
    BUTTON_SECONDARY: 'px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-lg text-sm',
    BUTTON_SUCCESS: 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg text-sm',
    BUTTON_WARNING: 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg shadow-lg text-sm',
    BUTTON_DANGER: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg text-sm'
};