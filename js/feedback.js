/**
 * FEEDBACK.JS - フィードバックシステム
 * 
 * エラーメッセージ、通知、ユーザーフィードバックを統合管理
 */

export class FeedbackSystem {
    constructor() {
        this.messageQueue = [];
        this.isDisplaying = false;
        this.currentToast = null;
        
        // フィードバック設定
        this.config = {
            durations: {
                success: 3000,
                info: 4000,
                warning: 5000,
                error: 6000
            },
            sounds: {
                enabled: false, // デフォルトでは無効
                success: 'assets/sounds/success.wav',
                error: 'assets/sounds/error.wav'
            }
        };
        
        this.init();
    }
    
    /**
     * フィードバックシステムの初期化
     */
    init() {
        this.createToastContainer();
        this.createNotificationContainer();
        this.bindKeyboardListeners();
        
        console.log('📢 Feedback System initialized');
    }
    
    /**
     * トーストコンテナの作成
     */
    createToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.id = 'toast-container';
        this.toastContainer.className = 'toast-container';
        this.toastContainer.setAttribute('role', 'region');
        this.toastContainer.setAttribute('aria-label', '通知メッセージ');
        this.toastContainer.setAttribute('aria-live', 'polite');
        
        // スタイル設定
        this.toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
            max-width: 350px;
        `;
        
        document.body.appendChild(this.toastContainer);
    }
    
    /**
     * 通知コンテナの作成
     */
    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'notification-banner';
        this.notificationContainer.className = 'notification-banner hidden';
        this.notificationContainer.setAttribute('role', 'alert');
        this.notificationContainer.setAttribute('aria-live', 'assertive');
        
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: var(--danger);
            color: white;
            padding: 12px 20px;
            text-align: center;
            font-weight: 600;
            transform: translateY(-100%);
            transition: transform 300ms ease;
            z-index: 10002;
        `;
        
        document.body.appendChild(this.notificationContainer);
    }
    
    /**
     * 成功メッセージを表示
     * @param {string} message - メッセージ内容
     * @param {Object} options - オプション設定
     */
    success(message, options = {}) {
        this.showToast(message, 'success', options);
        this.playSound('success');
    }
    
    /**
     * 情報メッセージを表示
     * @param {string} message - メッセージ内容
     * @param {Object} options - オプション設定
     */
    info(message, options = {}) {
        this.showToast(message, 'info', options);
    }
    
    /**
     * 警告メッセージを表示
     * @param {string} message - メッセージ内容
     * @param {Object} options - オプション設定
     */
    warning(message, options = {}) {
        this.showToast(message, 'warning', options);
    }
    
    /**
     * エラーメッセージを表示
     * @param {string} message - メッセージ内容
     * @param {Object} options - オプション設定
     */
    error(message, options = {}) {
        this.showToast(message, 'error', options);
        this.playSound('error');
        
        // 重要なエラーはバナー通知も表示
        if (options.critical) {
            this.showNotificationBanner(message, 'error');
        }
    }
    
    /**
     * トーストメッセージを表示
     * @param {string} message - メッセージ内容
     * @param {string} type - メッセージタイプ
     * @param {Object} options - オプション設定
     */
    showToast(message, type, options = {}) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        
        // アイコンを追加
        const icon = this.getTypeIcon(type);
        
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${message}</span>
                ${options.actionButton ? `<button class="toast-action">${options.actionButton.text}</button>` : ''}
            </div>
            <button class="toast-close" aria-label="閉じる">×</button>
        `;
        
        // スタイル設定
        toast.style.cssText = `
            background: var(--panel);
            border: 1px solid ${this.getTypeColor(type)};
            border-left: 4px solid ${this.getTypeColor(type)};
            border-radius: var(--radius);
            padding: 12px 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            color: var(--text);
            font-size: 14px;
            line-height: 1.4;
            opacity: 0;
            transform: translateX(100%);
            transition: all 300ms ease;
            pointer-events: all;
            max-width: 100%;
            word-wrap: break-word;
        `;
        
        // コンテンツスタイル
        const content = toast.querySelector('.toast-content');
        content.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 8px;
        `;
        
        const iconEl = toast.querySelector('.toast-icon');
        iconEl.style.cssText = `
            flex-shrink: 0;
            font-size: 16px;
            margin-top: 1px;
        `;
        
        const messageEl = toast.querySelector('.toast-message');
        messageEl.style.cssText = `
            flex: 1;
            margin-right: 8px;
        `;
        
        const closeButton = toast.querySelector('.toast-close');
        closeButton.style.cssText = `
            background: none;
            border: none;
            color: var(--muted);
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            padding: 0;
            margin-left: 8px;
        `;
        
        // イベントリスナー
        closeButton.addEventListener('click', () => {
            this.removeToast(toast);
        });
        
        if (options.actionButton) {
            const actionBtn = toast.querySelector('.toast-action');
            actionBtn.style.cssText = `
                background: ${this.getTypeColor(type)};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
                margin-left: 8px;
            `;
            actionBtn.addEventListener('click', options.actionButton.callback);
        }
        
        // コンテナに追加
        this.toastContainer.appendChild(toast);
        
        // アニメーション開始
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });
        
        // 自動削除タイマー
        const duration = options.duration || this.config.durations[type];
        setTimeout(() => {
            if (toast.parentNode) {
                this.removeToast(toast);
            }
        }, duration);
        
        return toast;
    }
    
    /**
     * トーストを削除
     * @param {Element} toast - トースト要素
     */
    removeToast(toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
    
    /**
     * 通知バナーを表示
     * @param {string} message - メッセージ
     * @param {string} type - タイプ
     */
    showNotificationBanner(message, type = 'error') {
        this.notificationContainer.textContent = message;
        this.notificationContainer.style.background = this.getTypeColor(type);
        this.notificationContainer.classList.remove('hidden');
        this.notificationContainer.style.transform = 'translateY(0)';
        
        // 5秒後に自動で隠す
        setTimeout(() => {
            this.hideNotificationBanner();
        }, 5000);
    }
    
    /**
     * 通知バナーを隠す
     */
    hideNotificationBanner() {
        this.notificationContainer.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            this.notificationContainer.classList.add('hidden');
        }, 300);
    }
    
    /**
     * タイプに応じたアイコンを取得
     * @param {string} type - メッセージタイプ
     * @returns {string} アイコン
     */
    getTypeIcon(type) {
        const icons = {
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || 'ℹ️';
    }
    
    /**
     * タイプに応じた色を取得
     * @param {string} type - メッセージタイプ
     * @returns {string} 色コード
     */
    getTypeColor(type) {
        const colors = {
            success: '#22c55e',
            info: '#3b82f6',
            warning: '#f59e0b',
            error: '#ef4444'
        };
        return colors[type] || '#6b7280';
    }
    
    /**
     * 音声を再生
     * @param {string} soundType - 音声タイプ
     */
    playSound(soundType) {
        if (!this.config.sounds.enabled) return;
        
        try {
            const audio = new Audio(this.config.sounds[soundType]);
            audio.volume = 0.3;
            audio.play().catch(err => {
                // 音声再生エラーは無視（ユーザー操作が必要な場合など）
                console.warn('Sound playback failed:', err.message);
            });
        } catch (error) {
            console.warn('Sound not available:', error.message);
        }
    }
    
    /**
     * キーボードリスナーをバインド
     */
    bindKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            // Escキーで全てのトーストを閉じる
            if (e.key === 'Escape') {
                this.clearAllToasts();
                this.hideNotificationBanner();
            }
        });
    }
    
    /**
     * 全てのトーストをクリア
     */
    clearAllToasts() {
        const toasts = this.toastContainer.querySelectorAll('.toast');
        toasts.forEach(toast => this.removeToast(toast));
    }
    
    /**
     * プログレス通知（長時間操作用）
     * @param {string} message - メッセージ
     * @param {Object} options - オプション
     */
    showProgress(message, options = {}) {
        const progressToast = document.createElement('div');
        progressToast.className = 'toast toast-progress';
        progressToast.id = 'progress-toast';
        
        progressToast.innerHTML = `
            <div class="toast-content">
                <div class="progress-spinner"></div>
                <span class="toast-message">${message}</span>
            </div>
        `;
        
        // スタイル設定
        progressToast.style.cssText = `
            background: var(--panel);
            border: 1px solid var(--accent);
            border-radius: var(--radius);
            padding: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            color: var(--text);
            font-size: 14px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 300ms ease;
            pointer-events: none;
        `;
        
        const spinner = progressToast.querySelector('.progress-spinner');
        spinner.style.cssText = `
            width: 16px;
            height: 16px;
            border: 2px solid var(--muted);
            border-top: 2px solid var(--accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        `;
        
        this.toastContainer.appendChild(progressToast);
        
        requestAnimationFrame(() => {
            progressToast.style.opacity = '1';
            progressToast.style.transform = 'translateX(0)';
        });
        
        return progressToast;
    }
    
    /**
     * プログレス通知を隠す
     */
    hideProgress() {
        const progressToast = document.getElementById('progress-toast');
        if (progressToast) {
            this.removeToast(progressToast);
        }
    }
    
    /**
     * 音声設定を切り替え
     */
    toggleSounds() {
        this.config.sounds.enabled = !this.config.sounds.enabled;
        this.info(`音声効果を${this.config.sounds.enabled ? '有効' : '無効'}にしました`);
        return this.config.sounds.enabled;
    }
    
    /**
     * フィードバックシステムを破棄
     */
    destroy() {
        this.clearAllToasts();
        if (this.toastContainer.parentNode) {
            this.toastContainer.parentNode.removeChild(this.toastContainer);
        }
        if (this.notificationContainer.parentNode) {
            this.notificationContainer.parentNode.removeChild(this.notificationContainer);
        }
        console.log('📢 Feedback System destroyed');
    }
}

// スピナーアニメーション用CSS
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(spinnerStyle);

// デフォルトのフィードバックシステムインスタンス
export const feedbackSystem = new FeedbackSystem();