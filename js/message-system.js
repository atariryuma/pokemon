/**
 * ポケモンカードバトル用メッセージシステム
 * メッセージのタイプ分類とスタイリングを管理
 */

// メッセージタイプの定義
export const MessageType = {
    // バトルアクション関連
    BATTLE_ACTION: 'battle-action',     // 攻撃、ダメージ、KO等
    EVOLUTION: 'evolution',             // 進化
    ENERGY_ATTACH: 'energy-attach',     // エネルギー付与
    RETREAT: 'retreat',                 // にげる
    
    // ゲーム進行関連
    GAME_PROGRESS: 'game-progress',     // ターン開始/終了、フェーズ変更
    SETUP: 'setup',                     // ゲーム開始時のセットアップ
    TURN_START: 'turn-start',           // ターン開始
    PHASE_CHANGE: 'phase-change',       // フェーズ変更
    
    // エラー/制約関連
    ERROR: 'error',                     // ルール違反
    WARNING: 'warning',                 // 注意事項
    CONSTRAINT: 'constraint',           // アクション制約（エネルギー不足等）
    
    // 勝敗/重要イベント関連
    VICTORY: 'victory',                 // 勝利
    DEFEAT: 'defeat',                   // 敗北
    PRIZE_TAKEN: 'prize-taken',         // サイド取得
    KNOCKOUT: 'knockout',               // ポケモンKO
    
    // 情報提供
    INFO: 'info',                       // 一般的な情報
    HINT: 'hint'                        // ヒント・提案
};

// メッセージタイプ別のスタイル設定
export const MessageStyles = {
    [MessageType.BATTLE_ACTION]: {
        bgColor: 'bg-red-600',
        borderColor: 'border-red-500',
        textColor: 'text-white',
        icon: '⚔️',
        animation: 'animate-pulse'
    },
    [MessageType.EVOLUTION]: {
        bgColor: 'bg-purple-600',
        borderColor: 'border-purple-500',
        textColor: 'text-white',
        icon: '🌟',
        animation: 'animate-bounce'
    },
    [MessageType.ENERGY_ATTACH]: {
        bgColor: 'bg-yellow-600',
        borderColor: 'border-yellow-500',
        textColor: 'text-black',
        icon: '⚡',
        animation: 'animate-pulse'
    },
    [MessageType.RETREAT]: {
        bgColor: 'bg-blue-600',
        borderColor: 'border-blue-500',
        textColor: 'text-white',
        icon: '🏃',
        animation: 'animate-slide-in-bottom'
    },
    [MessageType.GAME_PROGRESS]: {
        bgColor: 'bg-indigo-600',
        borderColor: 'border-indigo-500',
        textColor: 'text-white',
        icon: '📋',
        animation: 'animate-fade-in'
    },
    [MessageType.SETUP]: {
        bgColor: 'bg-green-600',
        borderColor: 'border-green-500',
        textColor: 'text-white',
        icon: '🎯',
        animation: 'animate-slide-in-bottom'
    },
    [MessageType.TURN_START]: {
        bgColor: 'bg-cyan-600',
        borderColor: 'border-cyan-500',
        textColor: 'text-white',
        icon: '▶️',
        animation: 'animate-fade-in'
    },
    [MessageType.PHASE_CHANGE]: {
        bgColor: 'bg-teal-600',
        borderColor: 'border-teal-500',
        textColor: 'text-white',
        icon: '🔄',
        animation: 'animate-fade-in'
    },
    [MessageType.ERROR]: {
        bgColor: 'bg-red-700',
        borderColor: 'border-red-600',
        textColor: 'text-white',
        icon: '❌',
        animation: 'animate-damage'
    },
    [MessageType.WARNING]: {
        bgColor: 'bg-orange-600',
        borderColor: 'border-orange-500',
        textColor: 'text-white',
        icon: '⚠️',
        animation: 'animate-pulse'
    },
    [MessageType.CONSTRAINT]: {
        bgColor: 'bg-amber-600',
        borderColor: 'border-amber-500',
        textColor: 'text-black',
        icon: '🚫',
        animation: 'animate-pulse'
    },
    [MessageType.VICTORY]: {
        bgColor: 'bg-emerald-600',
        borderColor: 'border-emerald-500',
        textColor: 'text-white',
        icon: '🏆',
        animation: 'animate-bounce'
    },
    [MessageType.DEFEAT]: {
        bgColor: 'bg-gray-700',
        borderColor: 'border-gray-600',
        textColor: 'text-white',
        icon: '💀',
        animation: 'animate-fade-in'
    },
    [MessageType.PRIZE_TAKEN]: {
        bgColor: 'bg-pink-600',
        borderColor: 'border-pink-500',
        textColor: 'text-white',
        icon: '🎁',
        animation: 'animate-bounce'
    },
    [MessageType.KNOCKOUT]: {
        bgColor: 'bg-rose-700',
        borderColor: 'border-rose-600',
        textColor: 'text-white',
        icon: '💥',
        animation: 'animate-damage'
    },
    [MessageType.INFO]: {
        bgColor: 'bg-slate-600',
        borderColor: 'border-slate-500',
        textColor: 'text-white',
        icon: 'ℹ️',
        animation: 'animate-fade-in'
    },
    [MessageType.HINT]: {
        bgColor: 'bg-violet-600',
        borderColor: 'border-violet-500',
        textColor: 'text-white',
        icon: '💡',
        animation: 'animate-fade-in'
    }
};

/**
 * メッセージの重要度レベル
 * 複数のメッセージが同時に表示される場合の優先度決定に使用
 */
export const MessagePriority = {
    CRITICAL: 1,  // 勝利/敗北、重要なエラー
    HIGH: 2,      // バトルアクション、KO、サイド取得
    MEDIUM: 3,    // 進化、エネルギー付与、制約
    LOW: 4        // 一般情報、ヒント
};

// メッセージタイプ別の優先度マッピング
export const MessageTypePriority = {
    [MessageType.VICTORY]: MessagePriority.CRITICAL,
    [MessageType.DEFEAT]: MessagePriority.CRITICAL,
    [MessageType.ERROR]: MessagePriority.CRITICAL,
    
    [MessageType.BATTLE_ACTION]: MessagePriority.HIGH,
    [MessageType.KNOCKOUT]: MessagePriority.HIGH,
    [MessageType.PRIZE_TAKEN]: MessagePriority.HIGH,
    
    [MessageType.EVOLUTION]: MessagePriority.MEDIUM,
    [MessageType.ENERGY_ATTACH]: MessagePriority.MEDIUM,
    [MessageType.RETREAT]: MessagePriority.MEDIUM,
    [MessageType.WARNING]: MessagePriority.MEDIUM,
    [MessageType.CONSTRAINT]: MessagePriority.MEDIUM,
    
    [MessageType.GAME_PROGRESS]: MessagePriority.LOW,
    [MessageType.SETUP]: MessagePriority.LOW,
    [MessageType.TURN_START]: MessagePriority.LOW,
    [MessageType.PHASE_CHANGE]: MessagePriority.LOW,
    [MessageType.INFO]: MessagePriority.LOW,
    [MessageType.HINT]: MessagePriority.LOW
};

/**
 * メッセージオブジェクトを作成
 * @param {string} type - MessageType の値
 * @param {string} message - メッセージテキスト
 * @param {Object} options - 追加オプション
 * @returns {Object} メッセージオブジェクト
 */
export function createMessage(type, message, options = {}) {
    const style = MessageStyles[type] || MessageStyles[MessageType.INFO];
    const priority = MessageTypePriority[type] || MessagePriority.LOW;
    
    return {
        type,
        message,
        style,
        priority,
        timestamp: Date.now(),
        duration: options.duration || 3000, // デフォルト3秒表示
        actions: options.actions || null,    // インタラクティブボタン
        ...options
    };
}

/**
 * エラーメッセージに代替アクション提案を追加
 * @param {string} message - エラーメッセージ
 * @param {Array} suggestions - 代替アクション配列
 * @returns {Object} エラーメッセージオブジェクト
 */
export function createErrorWithSuggestions(message, suggestions = []) {
    const actions = suggestions.map(suggestion => ({
        text: suggestion.text,
        className: 'px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded',
        callback: suggestion.callback
    }));
    
    return createMessage(MessageType.ERROR, message, {
        actions: actions.length > 0 ? actions : null,
        duration: 5000 // エラーは少し長めに表示
    });
}

/**
 * ルール説明付きエラーメッセージを作成
 * @param {string} errorMsg - エラーメッセージ
 * @param {string} ruleExplanation - ルール説明
 * @returns {Object} エラーメッセージオブジェクト
 */
export function createErrorWithRule(errorMsg, ruleExplanation) {
    const fullMessage = `${errorMsg}\n\n💡 ルール: ${ruleExplanation}`;
    return createMessage(MessageType.ERROR, fullMessage, { duration: 6000 });
}