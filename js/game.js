import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';
import { animate, animationManager, unifiedAnimationManager } from './animation-manager.js';
import { CardOrientationManager } from './card-orientation.js';
import { phaseManager, GAME_PHASES } from './phase-manager.js';
import { BUTTON_IDS, ACTION_BUTTON_GROUPS } from './ui-constants.js';
import { errorHandler, ERROR_TYPES } from './error-handler.js';
import { setupManager } from './setup-manager.js';
import { turnManager } from './turn-manager.js';
import { getCardImagePath, loadCardsFromJSON, getCardMasterList } from './data-manager.js';
import { addLogEntry } from './state.js';
import { modalManager } from './modal-manager.js';
import { memoryManager } from './memory-manager.js';

const noop = () => {};

export class Game {
    constructor(rootEl, playmatSlotsData) {
        this.rootEl = rootEl;
        this.state = null;
        this.view = null;
        this.playmatSlotsData = playmatSlotsData;
        
        // Game managers
        this.phaseManager = phaseManager;
        this.setupManager = setupManager;
        this.turnManager = turnManager;
        this.unifiedAnimationManager = unifiedAnimationManager;
        this.animate = animate;
        
        // Selected card for setup
        this.selectedCardForSetup = null;
        
        // Animation control flags
        this.setupAnimationsExecuted = false;
        this.prizeCardAnimationExecuted = false;
        this.prizeAnimationCompleted = false; // サイドアニメーション完了フラグ
        this.cardRevealAnimationExecuted = false;
        
        // レンダリング最適化用
        this.renderQueue = [];
        this.isRenderScheduled = false;
        this.lastRenderState = null;
        
        // アニメーション同期システム
        this.animationQueue = [];
        this.isAnimating = false;
        this.animationPromises = new Set();
    } // End of constructor

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    } // End of _delay

    resetAnimationFlags() {
        this.setupAnimationsExecuted = false;
        this.prizeCardAnimationExecuted = false;
        this.prizeAnimationCompleted = false;
        this.cardRevealAnimationExecuted = false;
        noop('🔄 Animation flags reset');
    }

    async init() {
        // 📦 Load card data first
        try {
            await loadCardsFromJSON();
        } catch (error) {
            await errorHandler.handleError(error, ERROR_TYPES.NETWORK);
            return; 
        }
        
        try {
            // アニメーションフラグをリセット
            this.resetAnimationFlags();
            
            this.state = createInitialState();
            
            // Initialize view
            this.view = new View(this.rootEl);
            this.view.bindCardClick(this._handleCardClick.bind(this));
            this.view.bindDragAndDrop(this._handleDragDrop.bind(this));
            this.view.setConfirmSetupButtonHandler(this._handleConfirmSetup.bind(this)); // Bind confirm button

            // Setup action button event handlers
            this._setupActionButtonHandlers();

            // Render the initial board state immediately after state creation
            noop('🎨 Rendering initial game state with deck...');
            this.view.render(this.state);

            // Show game start message instead of auto-starting
            this.setupManager.showGameStartModal(this.view);
            
            // Make game instance globally accessible for modal callbacks
            window.gameInstance = this;
            
            // システムメンテナンス開始
            this._scheduleSystemMaintenance();
        } catch (error) {
            await errorHandler.handleError(error, ERROR_TYPES.SETUP_FAILED);
        }
    } // End of init

    /**
     * モーダルからトリガーされるセットアップ開始
     */
    async triggerInitialSetup() {
        // No longer hiding a modal, as messages are now in game-message-display
        // setTimeout(async () => {
        //     const modal = document.getElementById('action-modal');
        //     modal?.classList.add('hidden');
            
            // 実際のセットアップ開始
            await this._startGameSetup();
        // }, 500);
    }

    
    /**
     * バッチレンダリングシステム - 複数の状態更新を1回のレンダリングにまとめる
     */
    _scheduleRender() {
        if (this.isRenderScheduled) return;
        
        this.isRenderScheduled = true;
        requestAnimationFrame(() => {
            this._performBatchRender();
            this.isRenderScheduled = false;
        });
    }
    
    _performBatchRender() {
        if (!this.state) return;
        
        // 差分チェック：前回のレンダリング状態と比較
        if (this._hasStateChanged(this.lastRenderState, this.state)) {
            this.view.render(this.state);
            this._updateUI();
            this.lastRenderState = this._cloneStateForComparison(this.state);
        }
    }
    
    _hasStateChanged(oldState, newState) {
        if (!oldState || !newState) return true;
        
        // 主要な描画に影響する状態のみをチェック
        const checkFields = [
            'phase', 'turn', 'turnPlayer', 'players.player.hand.length',
            'players.player.active?.id', 'players.player.bench.length',
            'players.cpu.hand.length', 'players.cpu.active?.id', 'players.cpu.bench.length'
        ];
        
        return checkFields.some(field => {
            const oldValue = this._getNestedProperty(oldState, field);
            const newValue = this._getNestedProperty(newState, field);
            return oldValue !== newValue;
        });
    }
    
    _getNestedProperty(obj, path) {
        return path.split('.').reduce((current, prop) => {
            if (prop.includes('?')) {
                const [key] = prop.split('?');
                return current?.[key];
            }
            return current?.[prop];
        }, obj);
    }
    
    _cloneStateForComparison(state) {
        // 軽量な状態複製（描画比較用）
        return {
            phase: state.phase,
            turn: state.turn,
            turnPlayer: state.turnPlayer,
            players: {
                player: {
                    hand: { length: state.players.player.hand.length },
                    active: state.players.player.active ? { id: state.players.player.active.id } : null,
                    bench: { length: state.players.player.bench.length }
                },
                cpu: {
                    hand: { length: state.players.cpu.hand.length },
                    active: state.players.cpu.active ? { id: state.players.cpu.active.id } : null,
                    bench: { length: state.players.cpu.bench.length }
                }
            }
        };
    }

    async _updateState(newState) {
        const previousPhase = this.state?.phase;
        this.state = newState;
        
        // Update phase manager
        const oldPhase = this.phaseManager.currentPhase;
        this.phaseManager.currentPhase = newState.phase;
        
        // フェーズ遷移アニメーション（必要な場合のみ）
        if (oldPhase !== newState.phase) {
            await this.animate.changePhase(oldPhase, newState.phase);
        }
        
        // Handle CPU prize selection
        if (this.state.phase === GAME_PHASES.PRIZE_SELECTION && this.state.playerToAct === 'cpu') {
            this.state = await this._handleCpuPrizeSelection();
        }
        
        // Handle CPU auto-selection after knockout
        if (this.state.needsCpuAutoSelect) {
            this.state = await this.turnManager.handleCpuAutoNewActive(this.state);
        }
        
        // バッチレンダリングをスケジュール（即座に実行せず、まとめて処理）
        this._scheduleRender();
    } // End of _updateState
    
    /**
     * 統一されたアニメーション実行システム
     * 状態更新→アニメーション→最終レンダリングの順序を保証
     */
    async _executeAnimationSequence(sequence) {
        if (this.isAnimating) {
            // 既存のアニメーションが完了するまで待機
            await Promise.all(Array.from(this.animationPromises));
        }
        
        this.isAnimating = true;
        
        try {
            for (const step of sequence) {
                switch (step.type) {
                    case 'pre-render':
                        // 状態更新（アニメーション前）
                        if (step.stateUpdate) {
                            this.state = step.stateUpdate(this.state);
                        }
                        break;
                        
                    case 'animation':
                        // アニメーション実行
                        if (step.animation) {
                            const animPromise = step.animation();
                            this.animationPromises.add(animPromise);
                            try {
                                await animPromise;
                            } catch (error) {
                                console.warn('Animation promise rejected:', error);
                            } finally {
                                this.animationPromises.delete(animPromise);
                            }
                        }
                        break;
                        
                    case 'post-render':
                        // 最終レンダリング
                        this._scheduleRender();
                        if (step.callback) {
                            step.callback();
                        }
                        break;
                        
                    case 'delay':
                        // 必要に応じた待機
                        if (step.duration) {
                            await this._delay(step.duration);
                        }
                        break;
                }
            }
        } catch (error) {
            console.error('Animation sequence error:', error);
            this._handleAnimationError(error);
        } finally {
            this.isAnimating = false;
        }
    }
    
    /**
     * 便利メソッド：状態更新とアニメーションを統合
     */
    async _updateStateWithAnimation(newState, animationFn, options = {}) {
        const sequence = [
            { 
                type: 'pre-render', 
                stateUpdate: () => newState 
            },
            { 
                type: 'animation', 
                animation: animationFn 
            },
            { 
                type: 'post-render',
                callback: options.onComplete 
            }
        ];
        
        await this._executeAnimationSequence(sequence);
    }
    
    /**
     * バトルステップ統一処理
     */
    async _processBattleStep(stepType, data) {
        const stepHandlers = {
            'damage': this._handleDamageStep.bind(this),
            'knockout': this._handleKnockoutStep.bind(this),
            'energy-attach': this._handleEnergyAttachStep.bind(this),
            'retreat': this._handleRetreatStep.bind(this),
            'card-play': this._handleCardPlayStep.bind(this)
        };
        
        const handler = stepHandlers[stepType];
        if (!handler) {
            console.warn(`Unknown battle step type: ${stepType}`);
            return this.state;
        }
        
        return await handler(data);
    }
    
    async _handleDamageStep(data) {
        const { damage, targetId, attackerType } = data;
        const sequence = [
            {
                type: 'pre-render',
                stateUpdate: (state) => Logic.applyDamage(state, targetId, damage)
            },
            {
                type: 'animation',
                animation: () => this.animate.attackSequence(attackerType, damage, targetId)
            },
            {
                type: 'post-render'
            }
        ];
        
        await this._executeAnimationSequence(sequence);
        return this.state;
    }
    
    async _handleKnockoutStep(data) {
        const { pokemonId } = data;
        const sequence = [
            {
                type: 'animation',
                animation: () => this.animate.knockout(pokemonId)
            },
            {
                type: 'pre-render',
                stateUpdate: (state) => Logic.handleKnockout(state, pokemonId)
            },
            {
                type: 'post-render'
            }
        ];
        
        await this._executeAnimationSequence(sequence);
        return this.state;
    }
    
    async _handleEnergyAttachStep(data) {
        const { energyId, pokemonId } = data;
        const sequence = [
            {
                type: 'pre-render',
                stateUpdate: (state) => Logic.attachEnergy(state, 'player', energyId, pokemonId)
            },
            {
                type: 'animation',
                animation: () => this.animate.energyAttach(energyId, pokemonId, this.state)
            },
            {
                type: 'post-render'
            }
        ];
        
        await this._executeAnimationSequence(sequence);
        return this.state;
    }
    
    async _handleRetreatStep(data) {
        const { fromActiveId, toBenchIndex } = data;
        const sequence = [
            {
                type: 'animation', 
                animation: () => animationManager.createUnifiedCardAnimation('player', fromActiveId, 'active', 'bench', toBenchIndex)
            },
            {
                type: 'pre-render',
                stateUpdate: (state) => Logic.retreat(state, 'player', fromActiveId, toBenchIndex)
            },
            {
                type: 'post-render'
            }
        ];
        
        await this._executeAnimationSequence(sequence);
        return this.state;
    }
    
    async _handleCardPlayStep(data) {
        const { cardId, zone, targetIndex } = data;
        const sequence = [
            {
                type: 'pre-render',
                stateUpdate: (state) => this._updateCardPlayState(state, cardId, zone, targetIndex)
            },
            {
                type: 'animation',
                animation: () => animationManager.createUnifiedCardAnimation('player', cardId, 'hand', zone, targetIndex)
            },
            {
                type: 'post-render'
            }
        ];
        
        await this._executeAnimationSequence(sequence);
        return this.state;
    }
    
    _handleAnimationError(error) {
        console.error('Animation error:', error);
        // エラー時のロールバック機能
        if (this.lastRenderState) {
            this.state = { ...this.lastRenderState };
            this._scheduleRender();
        }
        
        // エラー通知
        this.view?.showErrorMessage?.('アニメーションエラーが発生しました', 'error');
    }
    
    /**
     * 未使用変数とメモリクリーンアップ
     */
    _performMemoryCleanup() {
        // DOM キャッシュのクリーンアップ
        if (this.view?.domCache) {
            const cacheSize = this.view.domCache.size;
            if (cacheSize > 100) { // 上限を設定
                const entries = Array.from(this.view.domCache.entries());
                // 古いエントリーを削除（LRU方式）
                const toDelete = entries.slice(0, cacheSize - 50);
                toDelete.forEach(([key]) => this.view.domCache.delete(key));
            }
        }
        
        // レンダリングキューのクリーンアップ
        if (this.renderQueue.length > 20) {
            this.renderQueue = this.renderQueue.slice(-10); // 最新10件のみ保持
        }
        
        // アニメーションプロミスの確認
        if (this.animationPromises.size > 0) {
            console.warn(`${this.animationPromises.size} animation promises still pending`);
        }
    }
    
    /**
     * パフォーマンス監視
     */
    _monitorPerformance() {
        if (performance.memory) {
            const memory = performance.memory;
            const memoryUsage = {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
            };
            
            if (memoryUsage.used > memoryUsage.limit * 0.8) {
                console.warn('High memory usage detected:', memoryUsage);
                this._performMemoryCleanup();
            }
        }
    }
    
    /**
     * 定期的なシステムメンテナンス
     */
    _scheduleSystemMaintenance() {
        if (this._maintenanceInterval) {
            clearInterval(this._maintenanceInterval);
        }
        
        this._maintenanceInterval = setInterval(() => {
            this._performMemoryCleanup();
            this._monitorPerformance();
        }, 30000); // 30秒ごと
    }

    /**
     * フローティングアクションボタンのイベントハンドラーを設定
     * DOM準備完了を確認してからバインドする
     */
    _setupActionButtonHandlers() {
        noop('🔧 Setting up floating action button handlers');
        
        // DOMContentLoadedまたはDOM準備完了まで待機
        const setupHandlers = () => {
            const retreatButton = document.getElementById(BUTTON_IDS.RETREAT);
            const attackButton = document.getElementById(BUTTON_IDS.ATTACK);
            const endTurnButton = document.getElementById(BUTTON_IDS.END_TURN);

            if (retreatButton) {
                retreatButton.onclick = this._handleRetreat.bind(this);
                noop('✅ Floating retreat button handler bound');
            } else {
                noop('⚠️ Floating retreat button not found');
            }

            if (attackButton) {
                attackButton.onclick = this._handleAttack.bind(this);
                noop('✅ Floating attack button handler bound');
            } else {
                noop('⚠️ Floating attack button not found');
            }

            if (endTurnButton) {
                endTurnButton.onclick = this._handleEndTurn.bind(this);
                noop('✅ Floating end turn button handler bound');
            } else {
                noop('⚠️ Floating end turn button not found');
            }
        };

        // DOM準備が完了している場合は即実行、そうでなければ待機
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupHandlers);
        } else {
            setupHandlers();
        }
    }

    async _handleCardClick(dataset) {
        const { owner, zone, cardId, index } = dataset;
        if (owner !== 'player') return;

        // 処理中の場合はクリックを無視
        if (this.state.isProcessing) {
            return;
        }

        // Handle different phases
        switch (this.state.phase) {
            case GAME_PHASES.SETUP:
            case GAME_PHASES.INITIAL_POKEMON_SELECTION:
                await this._handleSetupCardClick(dataset);
                break;
                
            case GAME_PHASES.PLAYER_DRAW:
                if (zone === 'deck') {
                    await this._handlePlayerDraw();
                }
                break;
                
            case GAME_PHASES.PLAYER_MAIN:
                await this._handlePlayerMainClick(dataset);
                break;
                
            case GAME_PHASES.AWAITING_NEW_ACTIVE:
                if (zone === 'bench') {
                    await this._handleNewActiveSelection(parseInt(index, 10));
                }
                break;
                
            case GAME_PHASES.PRIZE_SELECTION:
                if (zone === 'prize' && this.state.players.player.prizesToTake > 0) {
                    await this._handlePrizeSelection(parseInt(index, 10));
                }
                break;
        }
    } // End of _handleCardClick

    /**
     * ドラッグ&ドロップ処理
     */
    async _handleDragDrop({ dragData, dropTarget }) {
        if (this.state.phase !== GAME_PHASES.PLAYER_MAIN) return;
        if (this.state.isProcessing) return;

        const { cardId, cardType } = dragData;
        const { zone: targetZone, index: targetIndex } = dropTarget;

        try {
            this.state.isProcessing = true;

            // カードタイプに応じた処理
            switch (cardType) {
                case 'Pokémon':
                    await this._handlePokemonDrop(cardId, targetZone, targetIndex);
                    break;
                case 'Energy':
                    await this._handleEnergyDrop(cardId, targetZone, targetIndex);
                    break;
                case 'Trainer':
                    this.view.showInfoMessage('トレーナーカードはクリックで使用してください');
                    break;
            }
        } catch (error) {
            console.error('Drag drop error:', error);
            this.view.showErrorMessage('カードの配置に失敗しました');
        } finally {
            this.state.isProcessing = false;
        }
    }

    /**
     * ポケモンカードのドロップ処理
     */
    async _handlePokemonDrop(cardId, targetZone, targetIndex) {
        const card = this.state.players.player.hand.find(c => c.id === cardId);
        if (!card) return;

        if (targetZone === 'bench' && card.stage === 'BASIC') {
            const newState = this.turnManager.handlePlayerMainPhase(this.state, 'place_basic', {
                cardId,
                benchIndex: parseInt(targetIndex, 10)
            });
            this._updateState(newState);
            this.view.showSuccessMessage(`${card.name_ja}をベンチに配置しました`);
        } else if (targetZone === 'active' && card.stage === 'BASIC' && !this.state.players.player.active) {
            const newState = this.turnManager.handlePlayerMainPhase(this.state, 'place_active', {
                cardId
            });
            this._updateState(newState);
            this.view.showSuccessMessage(`${card.name_ja}をバトル場に配置しました`);
        } else {
            this.view.showErrorMessage('そこには配置できません');
        }
    }

    /**
     * エネルギーカードのドロップ処理
     */
    async _handleEnergyDrop(cardId, targetZone, targetIndex) {
        if (this.state.hasAttachedEnergyThisTurn) {
            this.view.showErrorMessage('このターンはすでにエネルギーを付けています', 'warning');
            return;
        }

        let targetPokemonId = null;
        if (targetZone === 'active' && this.state.players.player.active) {
            targetPokemonId = this.state.players.player.active.id;
        } else if (targetZone === 'bench') {
            const benchPokemon = this.state.players.player.bench[parseInt(targetIndex, 10)];
            if (benchPokemon) {
                targetPokemonId = benchPokemon.id;
            }
        }

        if (targetPokemonId) {
            const newState = this.turnManager.handlePlayerMainPhase(this.state, 'attach_energy', {
                energyId: cardId,
                pokemonId: targetPokemonId
            });
            this._updateState(newState);
            
            const energyCard = this.state.players.player.hand.find(c => c.id === cardId);
            this.view.showSuccessMessage(`エネルギーを付けました`);
        } else {
            this.view.showErrorMessage('エネルギーはポケモンにのみ付けられます');
        }
    }

    /**
     * ゲームセットアップ開始
     */
    async _startGameSetup() {
        // アニメーション準備クラスを追加
        document.getElementById('player-hand')?.classList.add('is-preparing-animation');
        document.getElementById('cpu-hand')?.classList.add('is-preparing-animation');

        this.state = await this.setupManager.initializeGame(this.state);
        
        // 単一のレンダリングサイクルで処理（二重レンダリング防止）
        this._updateState(this.state);
        
        // 初期セットアップ後に確定HUD表示判定
        this._showConfirmHUDIfReady();
        
        // DOM要素の完全な準備を確実に待つ
        this._scheduleSetupAnimations();
        
        // デバッグ: 手札の内容を確認（state.players存在チェック付き）
        if (!this.state || !this.state.players) {
            console.warn('⚠️ State.players not initialized for debug logging');
        }
        
        // 手札レンダリングはview.render()で既に処理済み
    }

    /**
     * セットアップ時のカードクリック処理
     */
    async _handleSetupCardClick(dataset) {
        const { zone, cardId, index } = dataset;
        
        // 処理中はStateのisProcessingフラグをtrueに設定
        this.state.isProcessing = true;

        try {
            if (zone === 'hand' && cardId) {
                // 手札のカードを選択（state.players存在チェック付き）
                if (!this.state?.players?.player?.hand) {
                    console.warn('⚠️ Player hand not initialized');
                    return;
                }
                
                const card = this.state.players.player.hand.find(c => c.id === cardId);
                if (card && card.card_type === 'Pokémon' && card.stage === 'BASIC') {
                    this.selectedCardForSetup = card;
                    this._highlightCard(cardId, true);
                    this.state.prompt.message = `「${card.name_ja}」をバトル場かベンチに配置してください。`;
                    this.view.updateStatusMessage(this.state.prompt.message);
                } else if (card && card.card_type === 'Pokémon') {
                    // Only show warning for Pokemon cards that aren't BASIC
                    this.view.showGameMessage(`${card.name_ja}は${card.stage}ポケモンです。たねポケモンのみ選択できます。`, 'warning');
                    // Don't log as warning since this is expected behavior
                }
                // Silently ignore Energy and Trainer cards during setup
            } else if ((zone === 'active' || zone === 'bench') && this.selectedCardForSetup) {
                // 配置先を選択
                const targetIndex = zone === 'bench' ? parseInt(index, 10) : 0;

                // DOM上のカード要素を取得（手札のカード）
                const cardElement = document.querySelector(`[data-card-id="${this.selectedCardForSetup.id}"]`);
                if (!cardElement) {
                    console.warn(`⚠️ Card element not found for ${this.selectedCardForSetup.id}`);
                }

                // アニメーションに必要な情報を事前に取得
                const cardToAnimate = this.selectedCardForSetup; // アニメーション用にカード情報を保持
                // ★ 追加: アニメーション開始時のカードの正確な位置を取得
                const initialCardRect = cardElement ? cardElement.getBoundingClientRect() : null;

                // 状態更新実行（手札から除外し、配置）
                const previousState = this.state;
                this.state = await this.setupManager.handlePokemonSelection(
                    this.state,
                    'player',
                    cardToAnimate.id, // 事前に取得したIDを使用
                    zone,
                    targetIndex
                );
                
                // 状態変更が成功したか確認
                if (this.state === previousState) {
                    console.warn('⚠️ Pokemon placement failed, state unchanged');
                    return;
                }
                
                // state.playersの存在確認
                if (!this.state || !this.state.players || !this.state.players.player) {
                    console.warn('⚠️ State or players not properly initialized');
                    return;
                }

                // selectedCardForSetup のリセットとハイライト解除を、
                // State更新直後、Viewレンダリングの前に移動
                this.selectedCardForSetup = null;
                this._clearCardHighlights();
                this.state.prompt.message = '次のたねポケモンを選択するか、確定してください。';

                // 一度だけレンダリングし、重複を防止
                this._updateState(this.state); // まずViewを更新
                
                // バトルポケモンが配置されている場合は確定HUDを表示
                this._showConfirmHUDIfReady();

                // DOM更新を待つ
                await new Promise(resolve => requestAnimationFrame(resolve));

                // カード移動アニメーションを実行（CPU側と同じ統一アニメーション）
                console.log('🎬 Starting setup animation for:', cardToAnimate.name_ja, `hand->${zone}`);
                if (cardElement) {
                    try {
                        await animationManager.createUnifiedCardAnimation(
                            'player',
                            cardToAnimate.id,
                            'hand',
                            zone,
                            targetIndex,
                            {
                                isSetupPhase: true,
                                card: cardToAnimate,
                                initialSourceRect: initialCardRect
                            }
                        );
                        console.log('✅ Setup animation completed');
                    } catch (error) {
                        console.error('❌ Setup animation failed:', error);
                    }
                } else {
                    console.warn('⚠️ Card element not found for animation');
                }
                
                // アニメーション完了後に確定HUDを再表示（確実に表示されるように）
                noop('🔍 Animation completed, showing confirm HUD again');
                this._showConfirmHUDIfReady();

            } else if ((zone === 'active' || zone === 'bench') && !this.selectedCardForSetup) {
                // カードが選択されていない状態でスロットをクリックした場合
                this.state = addLogEntry(this.state, { message: '先に手札からたねポケモンを選択してください。' });
            }
        } finally {
            // 処理終了後にStateのisProcessingフラグをfalseに設定
            this.state.isProcessing = false;
        }
    }

    /**
     * プレイヤードロー処理
     */
    async _handlePlayerDraw() {
        if (this.state.hasDrawnThisTurn) {
            this.state = addLogEntry(this.state, { message: 'このターンはすでにカードを引いています。' });
            this.view.showErrorMessage('このターンはすでにカードを引いています。', 'warning');
            return;
        }
        
        // Get the player's deck element for animation
        const playerDeckElement = document.querySelector('.player-self .deck-card-element');
        if (playerDeckElement) {
            playerDeckElement.classList.add('is-drawing');
            // Add a small delay to make the lift visible before the card moves
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        
        this.state = await this.turnManager.handlePlayerDraw(this.state);
        
        // ドロー後にメインフェーズに移行
        this.state.phase = GAME_PHASES.PLAYER_MAIN;
        this.state.prompt.message = 'あなたのターンです。アクションを選択してください。';

        this._updateState(this.state);

        // After state update and re-render, remove the drawing class
        if (playerDeckElement) {
            playerDeckElement.classList.remove('is-drawing');
        }
    }

    /**
     * プレイヤーメインフェーズのクリック処理
     */
    async _handlePlayerMainClick(dataset) {
        const { zone, cardId, index } = dataset;
        
        if (this.state.pendingAction) {
            await this._handlePendingAction(dataset);
            return;
        }
        
        if (zone === 'hand') {
            await this._handleHandCardClick(cardId);
        } else if (zone === 'active' || zone === 'bench') {
            await this._handleBoardPokemonClick(cardId, zone, parseInt(index, 10));
        }
    }

    /**
     * 新しいアクティブポケモン選択
     */
    async _handleNewActiveSelection(benchIndex) {
        // Use the new unified turnManager method
        let newState = await this.turnManager.handleNewActiveSelection(this.state, benchIndex);
        
        this._updateState(newState);
    }

    /**
     * CPU自動サイド選択処理
     */
    async _handleCpuPrizeSelection() {
        const cpuState = this.state.players.cpu;
        const availablePrizes = cpuState.prize
            .map((prize, index) => ({ prize, index }))
            .filter(({ prize }) => prize !== null);
            
        if (availablePrizes.length === 0 || cpuState.prizesToTake === 0) {
            return this.state;
        }
        
        // CPU思考時間をシミュレート
        await this.turnManager.simulateCpuThinking(600);
        
        let newState = this.state;
        let prizesToTake = cpuState.prizesToTake;
        
        // 必要な枚数分ランダムに選択
        for (let i = 0; i < prizesToTake && availablePrizes.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePrizes.length);
            const selectedPrize = availablePrizes.splice(randomIndex, 1)[0];
            
            newState = Logic.takePrizeCard(newState, 'cpu', selectedPrize.index);
            await this._animatePrizeTake('cpu', selectedPrize.index);
        }
        
        // Prize selection completed, check if new active selection is needed
        if (newState.players.cpu.prizesToTake === 0) {
            if (newState.knockoutContext) {
                newState = Logic.processNewActiveAfterKnockout(newState);
                
                // If CPU needs to auto-select, handle it immediately  
                if (newState.needsCpuAutoSelect) {
                    newState = await this.turnManager.handleCpuAutoNewActive(newState);
                    
                    // Set appropriate phase after CPU auto-selection
                    if (newState.phase !== GAME_PHASES.GAME_OVER) {
                        if (newState.turnPlayer === 'cpu') {
                            newState.phase = GAME_PHASES.CPU_MAIN;
                        } else {
                            newState.phase = GAME_PHASES.PLAYER_MAIN;
                        }
                    }
                }
            } else {
                // No knockout context, return to normal turn flow
                if (newState.turnPlayer === 'cpu') {
                    newState.phase = GAME_PHASES.CPU_MAIN;
                } else {
                    newState.phase = GAME_PHASES.PLAYER_MAIN;
                }
            }
        }
        
        return newState;
    }

    /**
     * サイドカード選択処理
     */
    async _handlePrizeSelection(prizeIndex) {
        console.log(`🎯 Prize selection attempt: index ${prizeIndex}, prizesToTake: ${this.state.players[this.state.playerToAct].prizesToTake}`);
        
        const playerId = this.state.playerToAct;
        
        // Validate the selection
        if (this.state.players[playerId].prizesToTake === 0) {
            console.warn('⚠️ No prizes available to take');
            return;
        }
        
        if (!this.state.players[playerId].prize[prizeIndex]) {
            console.warn('⚠️ No prize card at index:', prizeIndex);
            return;
        }
        
        let newState = Logic.takePrizeCard(this.state, playerId, prizeIndex);
        
        // Check if state actually changed
        if (newState === this.state) {
            console.warn('⚠️ Prize card selection failed - state unchanged');
            return;
        }
        
        // アニメーション
        await this._animatePrizeTake(playerId, prizeIndex);
        
        // サイド取得後の処理
        if (newState.players[playerId].prizesToTake === 0) {
            // Prize selection completed, check if new active selection is needed
            if (newState.knockoutContext) {
                newState = Logic.processNewActiveAfterKnockout(newState);
                
                // If CPU needs to auto-select, handle it immediately
                if (newState.needsCpuAutoSelect) {
                    newState = await this.turnManager.handleCpuAutoNewActive(newState);
                    
                    // Set appropriate phase after CPU auto-selection
                    if (newState.phase !== GAME_PHASES.GAME_OVER) {
                        if (newState.turnPlayer === 'cpu') {
                            newState.phase = GAME_PHASES.CPU_MAIN;
                        } else {
                            newState.phase = GAME_PHASES.PLAYER_MAIN;
                        }
                    }
                }
            } else {
                // No knockout context, return to normal turn flow
                if (newState.turnPlayer === 'player') {
                    newState.phase = GAME_PHASES.PLAYER_MAIN;
                } else {
                    newState.phase = GAME_PHASES.CPU_TURN;
                }
            }
        }
        
        console.log('✅ Prize card taken successfully, remaining:', newState.players[playerId].prizesToTake);
        this._updateState(newState);
    }

    /**
     * 複数サイド選択UI表示
     */
    _showMultiplePrizeSelection(prizesToTake) {
        const availablePrizes = this.state.players.player.prize
            .map((prize, index) => ({ prize, index }))
            .filter(({ prize }) => prize !== null);
        
        this.view.displayModal({
            title: `サイドカード選択 (${prizesToTake}枚)`,
            message: `
                <div class="text-center p-4">
                    <p class="text-lg mb-4">取得するサイドカードを${prizesToTake}枚選んでください</p>
                    <div class="grid grid-cols-3 gap-4">
                        ${availablePrizes.map(({ prize, index }) => `
                            <div class="prize-card cursor-pointer hover:ring-2 hover:ring-blue-400 rounded-lg p-2" 
                                 data-prize-index="${index}">
                                <img src="assets/ui/card_back.webp" alt="サイドカード" 
                                     class="w-full h-auto rounded">
                                <p class="text-xs mt-1">サイド ${index + 1}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `,
            actions: []
        });

        // サイドカードクリックイベントを追加
        setTimeout(() => {
            const prizeCards = document.querySelectorAll('.prize-card');
            let selectedPrizes = [];

            prizeCards.forEach(card => {
                card.addEventListener('click', async () => {
                    const prizeIndex = parseInt(card.dataset.prizeIndex);
                    
                    if (selectedPrizes.includes(prizeIndex)) {
                        // 選択解除
                        selectedPrizes = selectedPrizes.filter(p => p !== prizeIndex);
                        card.classList.remove('ring-2', 'ring-green-400');
                    } else if (selectedPrizes.length < prizesToTake) {
                        // 選択追加
                        selectedPrizes.push(prizeIndex);
                        card.classList.add('ring-2', 'ring-green-400');
                    }

                    // 必要な枚数選択したら自動実行
                    if (selectedPrizes.length === prizesToTake) {
                        this.view.hideModal();
                        
                        // 選択したサイドを順次取得
                        for (const index of selectedPrizes) {
                            await this._handlePrizeSelection(index);
                        }
                    }
                });
            });
        }, 100);
    }

    _placeOnBench(cardId) {
        const emptyIndex = this.state.players.player.bench.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
            const newState = Logic.placeCardOnBench(this.state, 'player', cardId, emptyIndex);
            this._updateState(newState);
        } else {
            this.view.showGameMessage('ベンチが満員です。');
        }
    } // End of _placeOnBench

    /**
     * UI更新処理
     */
    _updateUI() {
        // 基本的なUI要素の初期状態（メッセージは次のメッセージまで保持）
        this.view.hideActionButtons();

        // ゲームステータスパネルを常時更新
        this.view.updateGameStatus(this.state);
        this.view.updateSetupProgress(this.state);

        // フェーズに応じたUI表示
        switch (this.state.phase) {
            case GAME_PHASES.SETUP:
            case GAME_PHASES.INITIAL_POKEMON_SELECTION:
                this.view.showGameMessage(this.state.prompt.message);
                // 静的な確定ボタンは非表示（アクションHUDを使用）
                this.view.hideInitialPokemonSelectionUI();
                // 確定HUDの表示判定
                this._showConfirmHUDIfReady();
                break;

            case GAME_PHASES.PRIZE_CARD_SETUP:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                this.view.hideActionButtons();
                break;

            case GAME_PHASES.GAME_START_READY:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                this.view.showActionButtons(ACTION_BUTTON_GROUPS.INITIAL_POKEMON);
                // ボタンテキストを変更 (フローティング版を使用)
                const gameStartButton = document.getElementById('confirm-setup-button-float');
                if (gameStartButton) {
                    const textElement = gameStartButton.querySelector('.pokemon-btn-text');
                    if (textElement) {
                        textElement.textContent = 'ゲームスタート';
                    }
                    gameStartButton.disabled = false;
                    gameStartButton.classList.remove('opacity-50', 'cursor-not-allowed', 'hidden');
                }
                break;

            case GAME_PHASES.PLAYER_DRAW:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                break;

            case GAME_PHASES.PLAYER_MAIN:
                this.view.showGameMessage(this.state.prompt.message);
                // プレイヤーメインフェーズでのアクションHUD表示
                this._showPlayerMainActionsHUD();
                break;

            case GAME_PHASES.PLAYER_ATTACK:
                this.view.showGameMessage('攻撃中...');
                break;

            case GAME_PHASES.CPU_TURN:
            case GAME_PHASES.CPU_DRAW:
            case GAME_PHASES.CPU_MAIN:
            case GAME_PHASES.CPU_ATTACK:
                this.view.showGameMessage(this.state.prompt.message);
                break;

            case GAME_PHASES.AWAITING_NEW_ACTIVE:
                if (this.state.playerToAct === 'player') {
                    this.view.showGameMessage('新しいバトルポケモンをベンチから選んでください。');
                } else {
                    this.view.showGameMessage('相手が新しいバトルポケモンを選んでいます...');
                }
                break;

            case GAME_PHASES.PRIZE_SELECTION:
                const prizesToTake = this.state.players.player.prizesToTake || 0;
                const prizeMessage = prizesToTake > 1 
                    ? `サイドカードを${prizesToTake}枚選んで取ってください。`
                    : 'サイドカードを選んで取ってください。';
                this.view.showGameMessage(prizeMessage);
                
                // 複数枚選択の場合は選択画面を表示
                if (prizesToTake > 1) {
                    this._showMultiplePrizeSelection(prizesToTake);
                }
                break;

            case GAME_PHASES.GAME_OVER:
                this.view.showGameMessage(this.state.prompt.message);
                // ゲーム終了処理を実行
                this._handleGameOver(this.state.winner, this.state.gameEndReason);
                break;
        }

        // ペンディングアクション表示
        if (this.state.pendingAction && this.state.pendingAction.type === 'attach-energy') {
            this.view.showGameMessage('エネルギーをつけるポケモンを選んでください。');
        }
    }

    /**
     * 手札のカードクリック処理
     */
    async _handleHandCardClick(cardId) {
        const card = this.state.players.player.hand.find(c => c.id === cardId);
        if (!card) return;

        if (card.card_type === 'Pokémon' && card.stage === 'BASIC') {
            // たねポケモンをベンチに出す - 重要な意思決定なので中央モーダル
            await this.view.showInteractiveMessage(
                `「${card.name_ja}」をベンチに出しますか？`,
                [
                    { text: 'はい', callback: () => this._placeOnBench(cardId) },
                    { text: 'いいえ', callback: () => {} }
                ],
                'central'
            );
        } else if (card.card_type === 'Basic Energy' || card.card_type === 'Energy') {
            // エネルギーを付ける
            if (this.state.hasAttachedEnergyThisTurn) {
                this.state = addLogEntry(this.state, { message: 'このターンはすでにエネルギーをつけました。' });
                this.view.showErrorMessage('このターンはすでにエネルギーをつけました。', 'warning');
                return;
            }

            const energyType = card.energy_type;
            const sourceCardId = card.id;

            // 既に同じエネルギー付与アクションがペンディング中の場合、キャンセルする
            if (this.state.pendingAction &&
                this.state.pendingAction.type === 'attach-energy' &&
                this.state.pendingAction.sourceCardId === sourceCardId) {

                this.state.pendingAction = null;
                this.state.prompt.message = 'あなたのターンです。アクションを選択してください。';
                this._clearAllHighlights(); // すべてのハイライトをクリア
                this._updateState(this.state);
                return;
            }

            // 他のペンディングアクションがあればクリアし、ハイライトも一旦すべて消す
            this._clearAllHighlights();

            // エネルギー付与の新しいペンディングアクション設定
            this.state.pendingAction = {
                type: 'attach-energy',
                sourceCardId: sourceCardId,
                energyType: energyType
            };
            this.state.prompt.message = 'エネルギーをつけるポケモンを選んでください。';
            this._updateState(this.state); // ここで一度UIを更新

            // ターゲット可能なポケモンをハイライト
            this._highlightEnergyTargets(energyType);
        }
    }

    /**
     * ボード上のポケモンクリック処理
     */
    async _handleBoardPokemonClick(pokemonId, zone, index) {
        if (this.state.pendingAction && this.state.pendingAction.type === 'attach-energy') {
            // エネルギー付与実行
            await this._attachEnergy(this.state.pendingAction.sourceCardId, pokemonId);
        }
        // その他のインタラクションは今後実装
    }

    /**
     * ペンディングアクション処理
     */
    async _handlePendingAction(dataset) {
        const { cardId, zone, index } = dataset;

        if (this.state.pendingAction.type === 'attach-energy' && (zone === 'active' || zone === 'bench')) {
            if (cardId) {
                await this._attachEnergy(this.state.pendingAction.sourceCardId, cardId);
            }
        } else if (this.state.pendingAction.type === 'retreat-promote' && zone === 'bench') {
            await this._performRetreat(parseInt(index, 10));
        }
    }

    /**
     * エネルギー付与処理（新統合システム使用）
     */
    async _attachEnergy(energyId, pokemonId) {
        const initialState = this.state;
        
        // 統合バトルステップで処理
        this.state = await this._processBattleStep('energy-attach', {
            energyId,
            pokemonId
        });
        
        // 状態が変更された場合の後処理
        if (this.state !== initialState) {
            this.state.pendingAction = null;
            this.state.prompt.message = 'あなたのターンです。アクションを選択してください。';
        }
        
        this._clearAllHighlights();
    }

    /**
     * にげる実行
     */
    async _performRetreat(benchIndex) {
        const active = this.state.players.player.active;
        if (!active) return;

        // Get the active Pokémon's DOM element before the state update
        const activePokemonElement = document.querySelector(`.player-self .active-bottom .relative[data-card-id="${active.id}"]`);
        // Get the discard pile's DOM element
        const discardPileElement = document.querySelector(`.player-self .discard-container`);

        const { newState, discardedEnergy } = this.turnManager.handlePlayerMainPhase(this.state, 'retreat_pokemon', {
            fromActiveId: active.id,
            toBenchIndex: benchIndex
        });

        if (newState !== this.state) {
            // Animate discarded energy cards
            if (discardedEnergy && discardedEnergy.length > 0 && activePokemonElement && discardPileElement) {
                await animate.energyDiscard(discardedEnergy, activePokemonElement, discardPileElement);
            }
            
            newState.pendingAction = null;
            newState.prompt.message = 'あなたのターンです。アクションを選択してください。';
        }

        this._clearAllHighlights();
        this._updateState(newState);
    }

    /**
     * 攻撃ボタンクリック処理
     */
    _handleAttack() {
        const attacker = this.state.players.player.active;
        if (!attacker || !attacker.attacks) return;
        
        const usableAttacks = attacker.attacks
            .map((attack, index) => ({ ...attack, index }))
            .filter(attack => Logic.hasEnoughEnergy(attacker, attack));
            
        if (usableAttacks.length === 0) {
            this.view.showGameMessage('使えるワザがありません。');
            return;
        }
        
        this._showBattleAttackModal(usableAttacks);
    }

    /**
     * バトル攻撃選択モーダル表示
     */
    _showBattleAttackModal(usableAttacks) {
        const attacker = this.state.players.player.active;
        const defender = this.state.players.cpu.active;
        
        if (!attacker || !defender) {
            this.view.showGameMessage('バトルできるポケモンがいません。');
            return;
        }

        // 相手ポケモンの画像パスを確実に取得
        const defenderImagePath = this._getReliableCardImagePath(defender);
        noop('🖼️ Battle modal defender image path:', defenderImagePath, 'for card:', defender.name_ja);
        
        // バトル画面のHTMLを構築（右側に相手のポケモン画像を追加）
        const battleHtml = `
            <div class="battle-modal-container-enhanced">
                <!-- Left: Battle Info & Attack Selection -->
                <div class="battle-left-panel">
                    <div class="battle-modal-container">
                        <!-- Attacker (Left) -->
                        <div class="battle-pokemon attacker">
                            <h4 class="pokemon-name">${attacker.name_ja}</h4>
                            <div class="pokemon-stats">
                                <div class="hp-bar">HP: ${Math.max(0, attacker.hp - (attacker.damage || 0))}/${attacker.hp}</div>
                                <div class="pokemon-type">${attacker.types?.join('・') || 'ノーマル'}</div>
                            </div>
                        </div>
                        
                        <!-- VS -->
                        <div class="vs-indicator">
                            <span class="vs-text">VS</span>
                        </div>
                        
                        <!-- Defender (Right) -->
                        <div class="battle-pokemon defender">
                            <h4 class="pokemon-name">${defender.name_ja}</h4>
                            <div class="pokemon-stats">
                                <div class="hp-bar">HP: ${Math.max(0, defender.hp - (defender.damage || 0))}/${defender.hp}</div>
                                <div class="pokemon-type">${defender.types?.join('・') || 'ノーマル'}</div>
                                ${defender.weakness ? `<div class="weakness">弱点: ${defender.weakness.type}</div>` : ''}
                                ${defender.resistance ? `<div class="resistance">抵抗: ${defender.resistance.type}</div>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="attack-selection">
                        <h3>ワザを選択してください</h3>
                        ${usableAttacks.map(attack => `
                            <div class="attack-option" onclick="window.gameInstance._executeAttackAndCloseModal(${attack.index})">
                                <div class="attack-name">${attack.name_ja}</div>
                                <div class="attack-details">
                                    <span class="damage">ダメージ: ${attack.damage || 0}</span>
                                    <span class="energy-cost">エネルギー: ${attack.cost?.join('・') || 'なし'}</span>
                                </div>
                                ${attack.text_ja ? `<div class="attack-effect">${attack.text_ja}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Right: Opponent Pokemon Card Image -->
                <div class="battle-right-panel">
                    <div class="opponent-card-display">
                        <img src="${defenderImagePath}" 
                             alt="${defender.name_ja}" 
                             class="opponent-card-image" 
                             onerror="this.src='assets/ui/card_back.webp'; this.onerror=null;" />
                        <div class="card-overlay">
                            <h4>${defender.name_ja}</h4>
                            <div class="card-hp">HP: ${Math.max(0, defender.hp - (defender.damage || 0))}/${defender.hp}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalManager.showCentralModal({
            title: 'バトル - ワザ選択',
            message: battleHtml,
            allowHtml: true,
            actions: [
                { text: 'キャンセル', callback: () => {}, className: 'px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg' }
            ]
        });
    }

    /**
     * 攻撃実行処理（モーダルを即座に閉じて、プレイマット上でアニメーション表示）
     */
    async _executeAttackAndCloseModal(attackIndex) {
        // モーダルを即座に閉じる
        modalManager.closeCentralModal();
        
        // 攻撃開始メッセージを表示
        this.view.showInfoMessage('攻撃を実行しています...');
        
        // 少し待ってからアニメーション開始
        memoryManager.setTimeout(async () => {
            await this._executeAttack(attackIndex);
        }, 300);
    }

    /**
     * 攻撃実行処理
     */
    async _executeAttack(attackIndex) {
        try {
            // 攻撃宣言
            let newState = this.turnManager.handlePlayerMainPhase(this.state, 'declare_attack', {
                attackIndex
            });
            
            this._updateState(newState);
            
            // 攻撃実行
            newState = await this.turnManager.executeAttack(newState);
            this._updateState(newState); // state更新を復旧

            if (newState.turnPlayer === 'cpu') {
                memoryManager.setTimeout(async () => {
                    await this._executeCpuTurn();
                }, 1000);
            }
        } catch (error) {
            console.error('攻撃実行中にエラーが発生しました:', error);
            this.view.showGameMessage('攻撃実行中にエラーが発生しました。ゲームを続行します。');
            // エラー時はターンを終了して回復を試みる
            let newState = this.turnManager.endPlayerTurn(this.state);
            this._updateState(newState);
        }
    }

    /**
     * ターン終了ボタン処理
     */
    async _handleEndTurn() {
        // すべてのフローティングアクションボタンを非表示
        this._hideFloatingActionButton(BUTTON_IDS.RETREAT);
        this._hideFloatingActionButton(BUTTON_IDS.ATTACK);
        this._hideFloatingActionButton(BUTTON_IDS.END_TURN);
        
        let newState = this.turnManager.endPlayerTurn(this.state);
        this._updateState(newState);
        
        // ターン終了通知
        this.view.showInfoMessage('ターンが終了しました');
        
        // CPUターン開始
        memoryManager.setTimeout(async () => {
            this.view.showInfoMessage('相手のターンが開始されました');
            await this._executeCpuTurn();
        }, 1000);
    }

    /**
     * CPUターン実行
     */
    async _executeCpuTurn() {
        // CPUターン開始
        let newState = await this.turnManager.startCpuTurn(this.state);
        this._updateState(newState);
        
        // CPUの自動ターン実行
        newState = await this.turnManager.executeCpuTurn(newState);
        this._updateState(newState); // CPUターン最後に一度だけ呼ぶ
    }

    /**
     * ゲーム終了処理
     */
    async _handleGameOver(winner, reason = '') {
        noop('🏆 Game Over:', winner, reason);
        
        // ゲーム終了アニメーション実行
        await this._playGameOverAnimation(winner);
        
        // 勝敗理由の詳細メッセージ
        const reasonMessages = {
            'prizes': 'すべてのサイドカードを獲得しました！',
            'no_pokemon': '相手のポケモンがいなくなりました！',
            'deck_out': '相手の山札がなくなりました！'
        };
        
        const reasonText = reasonMessages[reason] || reason || '不明な理由';
        
        // ゲーム統計情報を取得
        const gameStats = this._getGameStats();
        
        // 特別な勝敗リザルトモーダル表示
        await this._showGameResultModal(winner, reasonText, gameStats);
    }

    /**
     * 特別な勝敗リザルトモーダル表示
     */
    async _showGameResultModal(winner, reasonText, gameStats) {
        const isVictory = winner === 'player';
        
        // プレイマットエフェクトを維持するため背景ボケを軽減
        const resultModal = document.createElement('div');
        resultModal.id = 'game-result-modal';
        resultModal.className = 'fixed inset-0 flex items-center justify-center game-result-overlay';
        resultModal.style.zIndex = 'var(--z-modals)';
        
        const modalContent = `
            <div class="game-result-container ${isVictory ? 'victory-result' : 'defeat-result'}">
                <!-- 背景デコレーション -->
                <div class="result-background-decoration"></div>
                
                <!-- メインコンテンツ -->
                <div class="result-content">
                    <!-- 勝敗バナー -->
                    <div class="result-banner">
                        <div class="result-icon-container">
                            ${isVictory ? 
                                '<div class="victory-crown">👑</div><div class="victory-sparkles">✨🎊✨</div>' : 
                                '<div class="defeat-cloud">☁️</div><div class="defeat-rain">💧💧💧</div>'
                            }
                        </div>
                        <h1 class="result-title">
                            ${isVictory ? 'VICTORY!' : 'DEFEAT'}
                        </h1>
                        <h2 class="result-subtitle">
                            ${isVictory ? 'ポケモンマスターへの道' : '次回頑張ろう'}
                        </h2>
                    </div>
                    
                    <!-- 詳細情報 -->
                    <div class="result-details">
                        <div class="result-reason">
                            <div class="reason-label">勝因</div>
                            <div class="reason-text">${reasonText}</div>
                        </div>
                        
                        <div class="result-stats">
                            <div class="stat-item">
                                <div class="stat-label">ターン数</div>
                                <div class="stat-value">${gameStats.totalTurns}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">使用カード</div>
                                <div class="stat-value">${gameStats.cardsPlayed}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">与ダメージ</div>
                                <div class="stat-value">${gameStats.damageDealt}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- アクションボタン -->
                    <div class="result-actions">
                        <button class="result-btn primary-btn" onclick="window.game._startNewGame(); document.getElementById('game-result-modal').remove();">
                            <span class="btn-icon">🚀</span>
                            <span class="btn-text">新しいバトル</span>
                        </button>
                        <button class="result-btn secondary-btn" onclick="window.game._showDetailedStats(); document.getElementById('game-result-modal').remove();">
                            <span class="btn-icon">📊</span>
                            <span class="btn-text">詳細統計</span>
                        </button>
                    </div>
                </div>
                
                <!-- アニメーション要素 -->
                <div class="result-particles">
                    ${isVictory ? this._generateVictoryParticles() : this._generateDefeatParticles()}
                </div>
            </div>
        `;
        
        resultModal.innerHTML = modalContent;
        document.body.appendChild(resultModal);
        
        // アニメーション開始
        requestAnimationFrame(() => {
            resultModal.classList.add('result-modal-enter');
        });
        
        // 自動削除タイマー（30秒後）
        setTimeout(() => {
            if (resultModal.parentNode) {
                resultModal.classList.add('result-modal-exit');
                setTimeout(() => resultModal.remove(), 500);
            }
        }, 30000);
    }

    /**
     * 勝利時のパーティクル生成
     */
    _generateVictoryParticles() {
        const particles = [];
        for (let i = 0; i < 15; i++) {
            const delay = Math.random() * 2;
            const duration = 2 + Math.random() * 3;
            const size = 0.5 + Math.random() * 1;
            particles.push(`
                <div class="victory-particle" style="
                    animation-delay: ${delay}s;
                    animation-duration: ${duration}s;
                    transform: scale(${size});
                    left: ${Math.random() * 100}%;
                    --particle-emoji: '${['⭐', '✨', '🎊', '🎉', '💫', '🌟'][Math.floor(Math.random() * 6)]}';
                "></div>
            `);
        }
        return particles.join('');
    }

    /**
     * 敗北時のパーティクル生成
     */
    _generateDefeatParticles() {
        const particles = [];
        for (let i = 0; i < 8; i++) {
            const delay = Math.random() * 1.5;
            const duration = 3 + Math.random() * 2;
            particles.push(`
                <div class="defeat-particle" style="
                    animation-delay: ${delay}s;
                    animation-duration: ${duration}s;
                    left: ${Math.random() * 100}%;
                "></div>
            `);
        }
        return particles.join('');
    }

    /**
     * ゲーム終了アニメーション
     */
    async _playGameOverAnimation(winner) {
        if (winner === 'player') {
            // プレイヤー勝利時の演出
            await this._playVictoryAnimation();
        } else {
            // プレイヤー敗北時の演出
            await this._playDefeatAnimation();
        }
    }

    /**
     * 勝利アニメーション
     */
    async _playVictoryAnimation() {
        // プレイマット全体に勝利エフェクト
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.style.filter = 'brightness(1.2) saturate(1.3)';
            gameBoard.style.transition = 'filter 1s ease';
        }

        // プレイヤーのカードを光らせる
        const playerCards = document.querySelectorAll('[data-owner="player"]');
        
        // 段階的にカードを光らせる勝利演出
        playerCards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('victory-celebration');
                card.style.boxShadow = '0 0 30px rgba(252, 211, 77, 0.8), 0 0 60px rgba(252, 211, 77, 0.4)';
                card.style.transform = 'scale(1.1)';
                card.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
                card.style.zIndex = 'var(--z-animations)';
            }, index * 150);
        });

        // 勝利パーティクルをプレイマットに追加
        this._createVictoryParticlesOnBoard();
        
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // エフェクトクリーンアップ
        playerCards.forEach(card => {
            card.classList.remove('victory-celebration');
            card.style.transform = '';
            card.style.boxShadow = '';
            card.style.zIndex = '';
        });
        
        if (gameBoard) {
            gameBoard.style.filter = '';
        }
    }

    /**
     * 敗北アニメーション
     */
    async _playDefeatAnimation() {
        // プレイマット全体に敗北エフェクト
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.style.filter = 'grayscale(30%) brightness(0.8) contrast(0.9)';
            gameBoard.style.transition = 'filter 1.5s ease';
        }

        // プレイヤーのカードを沈ませる
        const playerCards = document.querySelectorAll('[data-owner="player"]');
        playerCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.filter = 'grayscale(60%) brightness(0.6) blur(0.5px)';
                card.style.transform = 'scale(0.95) translateY(5px)';
                card.style.opacity = '0.7';
                card.style.transition = 'all 1.2s ease-out';
                card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
            }, index * 100);
        });
        
        // CPUカードを勝利演出
        const cpuCards = document.querySelectorAll('[data-owner="cpu"]');
        cpuCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.boxShadow = '0 0 25px rgba(239, 68, 68, 0.6), 0 0 50px rgba(239, 68, 68, 0.3)';
                card.style.transform = 'scale(1.08)';
                card.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
                card.style.zIndex = 'var(--z-animations)';
            }, index * 120);
        });

        // 敗北パーティクルをプレイマットに追加
        this._createDefeatParticlesOnBoard();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // エフェクトクリーンアップ（敗北時は少し暗いまま残す）
        cpuCards.forEach(card => {
            card.style.transform = '';
            card.style.boxShadow = '';
            card.style.zIndex = '';
        });
    }

    /**
     * プレイマット上に勝利パーティクルを生成
     */
    _createVictoryParticlesOnBoard() {
        const gameBoard = document.getElementById('game-board');
        if (!gameBoard) return;

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'board-victory-particle';
            particle.style.position = 'absolute';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.fontSize = (0.8 + Math.random() * 1.2) + 'rem';
            particle.style.zIndex = 'var(--z-animations)';
            particle.style.pointerEvents = 'none';
            particle.innerHTML = ['⭐', '✨', '🎊', '🎉', '💫', '🌟'][Math.floor(Math.random() * 6)];
            particle.style.animation = `boardVictoryFloat ${2 + Math.random() * 3}s ease-out ${Math.random() * 1}s forwards`;

            gameBoard.appendChild(particle);
            
            // 自動削除
            setTimeout(() => {
                if (particle.parentNode) particle.remove();
            }, 5000);
        }
    }

    /**
     * プレイマット上に敗北パーティクルを生成
     */
    _createDefeatParticlesOnBoard() {
        const gameBoard = document.getElementById('game-board');
        if (!gameBoard) return;

        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.className = 'board-defeat-particle';
            particle.style.position = 'absolute';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = '0%';
            particle.style.width = '3px';
            particle.style.height = '15px';
            particle.style.background = 'rgba(156, 163, 175, 0.6)';
            particle.style.borderRadius = '2px';
            particle.style.zIndex = 'var(--z-animations)';
            particle.style.pointerEvents = 'none';
            particle.style.animation = `boardDefeatFall ${3 + Math.random() * 2}s linear ${Math.random() * 0.5}s forwards`;

            gameBoard.appendChild(particle);
            
            // 自動削除
            setTimeout(() => {
                if (particle.parentNode) particle.remove();
            }, 6000);
        }
    }

    /**
     * ゲーム統計情報取得
     */
    _getGameStats() {
        const state = this.state || {};
        const players = state.players || {};
        const playerState = players.player || {};
        const cpuState = players.cpu || {};
        
        return {
            totalTurns: state.turn || 0,
            playerPrizes: playerState.prizeRemaining || 0,
            cpuPrizes: cpuState.prizeRemaining || 0,
            cardsPlayed: (playerState.discard?.length || 0),
            damageDealt: this._calculateTotalDamage(),
            winner: state.winner || 'unknown',
            reason: state.gameEndReason || 'unknown'
        };
    }

    /**
     * 総ダメージ量計算（概算）
     */
    _calculateTotalDamage() {
        // ログから攻撃ダメージを推定（簡易版）
        const logs = this.state?.log || [];
        let totalDamage = 0;
        
        logs.forEach(entry => {
            if (entry.message && entry.message.includes('ダメージ')) {
                const damageMatch = entry.message.match(/(\d+)ダメージ/);
                if (damageMatch) {
                    totalDamage += parseInt(damageMatch[1], 10);
                }
            }
        });
        
        return totalDamage;
    }

    /**
     * 詳細統計表示
     */
    _showDetailedStats() {
        const stats = this._getGameStats();
        const logs = this.state?.log || [];
        
        modalManager.showCentralModal({
            title: '📊 バトル統計',
            content: `
                <div class="detailed-stats-container">
                    <div class="stats-section">
                        <h3 class="stats-section-title">基本情報</h3>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-label">総ターン数</div>
                                <div class="stat-value">${stats.totalTurns}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">勝者</div>
                                <div class="stat-value">${stats.winner === 'player' ? 'プレイヤー' : 'CPU'}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">残りサイド</div>
                                <div class="stat-value">あなた: ${stats.playerPrizes} / CPU: ${stats.cpuPrizes}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-section">
                        <h3 class="stats-section-title">プレイ情報</h3>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-label">使用カード数</div>
                                <div class="stat-value">${stats.cardsPlayed}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">与えた総ダメージ</div>
                                <div class="stat-value">${stats.damageDealt}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">ログ記録</div>
                                <div class="stat-value">${logs.length} 件</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-section">
                        <h3 class="stats-section-title">最近の行動</h3>
                        <div class="recent-logs">
                            ${logs.slice(-5).reverse().map(entry => 
                                `<div class="log-entry">${entry.message || 'アクション記録なし'}</div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: '閉じる',
                    callback: () => modalManager.closeCentralModal()
                }
            ]
        });
    }

    /**
     * カード画像パスを確実に取得
     */
    _getReliableCardImagePath(card) {
        if (!card) return 'assets/ui/card_back.webp'; // デフォルト画像
        
        // 複数のパスを試行する配列を作成
        const possiblePaths = [];
        
        // 1. 既にimagePath があれば最優先
        if (card.imagePath) {
            possiblePaths.push(card.imagePath);
        }
        
        // 2. カードタイプに基づいてサブディレクトリを決定
        const getCardSubdir = (card) => {
            if (card.card_type === 'Pokemon') return 'pokemon';
            if (card.card_type === 'Energy') return 'energy';
            return 'trainer'; // Trainer cards
        };
        
        const subdir = getCardSubdir(card);
        
        // 3. name_en から複数パターン生成
        if (card.name_en) {
            const cleanName = card.name_en.replace(/\s+/g, '_');
            possiblePaths.push(`assets/cards/${subdir}/${cleanName}.webp`);
            possiblePaths.push(`assets/cards/${subdir}/${cleanName}.png`);
            possiblePaths.push(`assets/cards/${subdir}/${cleanName}.jpg`);
        }
        
        // 4. name_ja から生成
        if (card.name_ja) {
            const cleanName = card.name_ja.replace(/\s+/g, '_');
            possiblePaths.push(`assets/cards/${subdir}/${cleanName}.webp`);
        }
        
        // 5. ID から生成
        if (card.id) {
            possiblePaths.push(`assets/cards/${subdir}/${card.id}.webp`);
            possiblePaths.push(`assets/cards/${subdir}/${card.id}.png`);
            possiblePaths.push(`assets/cards/${subdir}/${card.id}.jpg`);
        }
        
        // 最初のパスを返す（onerrorで他のパスも試行される）
        return possiblePaths[0] || 'assets/ui/card_back.webp';
    }

    /**
     * 新しいゲーム開始
     */
    async _startNewGame() {
        noop('🎮 Starting new game...');
        
        // モーダルを閉じる
        this.view.hideModal();
        
        // 画面をクリア（メッセージは新しいゲーム開始時のみクリア）
        this.view.hideGameMessage();
        this.view.hideActionButtons();
        
        // 新しいゲーム初期化
        await this.init();
    }

    /**
     * 詳細統計表示
     */
    _showDetailedStats(stats) {
        this.view.displayModal({
            title: 'ゲーム詳細統計',
            message: `
                <div class="detailed-stats">
                    <h3 class="font-bold text-lg mb-4">バトル結果</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="player-stats">
                            <h4 class="font-semibold">プレイヤー</h4>
                            <p>残りサイド: ${stats.playerPrizes}</p>
                        </div>
                        <div class="cpu-stats">
                            <h4 class="font-semibold">CPU</h4>
                            <p>残りサイド: ${stats.cpuPrizes}</p>
                        </div>
                    </div>
                    <div class="mt-4">
                        <p><strong>総ターン数:</strong> ${stats.turns}</p>
                        <p><strong>勝者:</strong> ${stats.winner === 'player' ? 'プレイヤー' : 'CPU'}</p>
                        <p><strong>勝因:</strong> ${stats.reason}</p>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: '新しいゲーム',
                    callback: () => this._startNewGame(),
                    className: 'px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg'
                },
                {
                    text: '閉じる',
                    callback: () => this.view.hideModal(),
                    className: 'px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg'
                }
            ]
        });
    }

    /**
     * にげる処理
     */
    _handleRetreat() {
        if (this.state.turnPlayer !== 'player') return;

        const activePokemon = this.state.players.player.active;
        if (!activePokemon) {
            this.state = addLogEntry(this.state, { message: 'バトル場にポケモンがいません。' });
            this.view.showErrorMessage('バトル場にポケモンがいません。', 'warning');
            return;
        }

        if (!this.state.canRetreat) {
            this.state = addLogEntry(this.state, { message: 'このターンはすでににげました。' });
            this.view.showErrorMessage('このターンはすでににげました。', 'warning');
            return;
        }

        const retreatCost = activePokemon.retreat_cost || 0;
        const attachedEnergyCount = activePokemon.attached_energy ? activePokemon.attached_energy.length : 0;

        if (attachedEnergyCount < retreatCost) {
            this.state = addLogEntry(this.state, { message: 'にげるためのエネルギーが足りません。' });
            this.view.showErrorMessage('にげるためのエネルギーが足りません。', 'warning');
            return;
        }

        this.view.displayModal(
            {
                title: 'にげる確認',
                message: `にげますか？ バトル場の「${activePokemon.name_ja}」をにがします。ベンチポケモンを選択してください。`,
                actions: [
                    { text: 'はい', callback: () => this._initiateRetreat() },
                    { text: 'いいえ', callback: () => {} }
                ]
            }
        );
    }

    /**
     * にげる処理の開始
     */
    _initiateRetreat() {
        this.state.pendingAction = { type: 'retreat-promote' };
        this.state.prompt.message = 'にげるポケモンをベンチから選択してください。';
        this._updateState(this.state);
        this._highlightBenchSlots();
    }

    /**
     * エネルギーが足りるかチェック（フォールバック用）
     */
    _hasEnoughEnergy(pokemon, attack) {
        if (!pokemon.attached_energy || !attack.cost) return false;
        
        const attached = pokemon.attached_energy.map(e => e.energy_type || e.type);
        const cost = [...attack.cost];
        
        // 簡単なエネルギーマッチング
        for (let i = attached.length - 1; i >= 0; i--) {
            const energyType = attached[i];
            const costIndex = cost.findIndex(c => c === energyType || c === 'Colorless');
            if (costIndex !== -1) {
                cost.splice(costIndex, 1);
                attached.splice(i, 1);
            }
        }
        
        return cost.length === 0 || (cost.every(c => c === 'Colorless') && attached.length >= cost.length);
    }

    /**
     * プレイヤーメインフェーズのアクションHUD表示
     */
    _showPlayerMainActionsHUD() {
        if (this.state.phase !== GAME_PHASES.PLAYER_MAIN) return;
        
        const actions = [];
        
        // にげるアクション
        const activePokemon = this.state.players.player.active;
        if (activePokemon && this.state.canRetreat) {
            const retreatCost = activePokemon.retreat_cost || 0;
            const attachedEnergyCount = activePokemon.attached_energy ? activePokemon.attached_energy.length : 0;
            
            if (attachedEnergyCount >= retreatCost) {
                actions.push({
                    text: `🏃 にげる (${retreatCost})`,
                    callback: () => this._handleRetreat(),
                    className: 'px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded text-sm'
                });
            }
        }
        
        // 攻撃アクション
        if (activePokemon && activePokemon.attacks) {
            const hasEnoughEnergyFn = Logic.hasEnoughEnergy || this._hasEnoughEnergy;
            const usableAttacks = activePokemon.attacks.filter(attack => 
                hasEnoughEnergyFn.call(this, activePokemon, attack)
            );
            
            if (usableAttacks.length > 0) {
                actions.push({
                    text: `⚔️ 攻撃`,
                    callback: () => this._handleAttack(),
                    className: 'px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-sm'
                });
            }
        }
        
        // ターン終了
        actions.push({
            text: `✅ ターン終了`,
            callback: () => this._handleEndTurn(),
            className: 'px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-sm'
        });
        
        // 左下フローティングHUDでアクションボタンを表示
        if (actions.length > 0) {
            // にげるボタン
            const canRetreat = actions.some(action => action.text.includes('にげる'));
            if (canRetreat) {
                this._showFloatingActionButton(BUTTON_IDS.RETREAT, () => this._handleRetreat());
            }
            
            // 攻撃ボタン
            const canAttack = actions.some(action => action.text.includes('攻撃'));
            if (canAttack) {
                this._showFloatingActionButton(BUTTON_IDS.ATTACK, () => this._handleAttack());
            }
            
            // ターン終了ボタン（常に表示）
            this._showFloatingActionButton(BUTTON_IDS.END_TURN, () => this._handleEndTurn());
            
            noop('🎯 Player main actions displayed in floating HUD');
        }
    }

    /**
     * 確定HUDの表示判定と表示
     */
    _showConfirmHUDIfReady() {
        if (this.state.phase !== GAME_PHASES.INITIAL_POKEMON_SELECTION) return;
        
        const playerActive = this.state.players.player.active;
        const hasBasicPokemonInActive = playerActive && playerActive.card_type === 'Pokémon' && playerActive.stage === 'BASIC';
        
        if (hasBasicPokemonInActive) {
            this._showFloatingActionButton('confirm-setup-button-float', () => this._handleConfirmSetup());
        }
    }

    /**
     * フローティングアクションボタン表示（modal-manager統合）
     */
    _showFloatingActionButton(buttonId, callback) {
        modalManager.showFloatingActionButton(buttonId, callback);
    }

    /**
     * フローティングアクションボタン非表示（modal-manager統合）
     */
    _hideFloatingActionButton(buttonId) {
        modalManager.hideFloatingActionButton(buttonId);
    }

    /**
     * セットアップ確定処理
     */
    async _handleConfirmSetup() {
        
        // フェーズに応じて処理を分岐
        if (this.state.phase === GAME_PHASES.GAME_START_READY) {
            // ゲームスタートボタンが押された場合
            await this._startActualGame();
            return;
        }

        // 初期ポケモン配置確定の場合
        // 強制的にボタンの無効化状態をチェック (フローティング版を使用)
        const confirmButton = document.getElementById('confirm-setup-button-float');
        if (confirmButton && confirmButton.disabled) {
            this.state = addLogEntry(this.state, { message: 'バトル場にたねポケモンを配置してください。' });
            return;
        }
        
        const active = this.state?.players?.player?.active;
        if (!active || active.card_type !== 'Pokémon' || active.stage !== 'BASIC') {
            this.state = addLogEntry(this.state, { message: 'バトル場にたねポケモンを配置してください。' });
            return;
        }

        noop('🔥 CONFIRM BUTTON PRESSED - Starting setup confirmation flow');
        noop('🔥 Animation flags at confirm button press:', {
            setupAnimationsExecuted: this.setupAnimationsExecuted,
            prizeCardAnimationExecuted: this.prizeCardAnimationExecuted,
            cardRevealAnimationExecuted: this.cardRevealAnimationExecuted
        });
        
        // 確定ボタン押下時にUIを非表示
        this.view.hideActionHUD(); // 確定HUDを非表示
        this.view.clearInteractiveButtons();
        this.view.hideInitialPokemonSelectionUI();
        // メッセージは次のメッセージが表示されるまで保持
        
        // 「サイドカード配布中...」メッセージを表示 - 進行状況なので右パネル
        this.view.showInteractiveMessage('ポケモン配置完了！サイドカードを配布しています...', [], 'panel');
        this.state = addLogEntry(this.state, { message: 'サイドカード配布開始' });
        
        noop('🔥 About to call setupManager.confirmSetup');
        
        // 確定ボタンを隠す
        this._hideFloatingActionButton('confirm-setup-button-float');
        
        // サイドカード配布の状態更新（レンダリングはアニメーション後）
        let newState = await this.setupManager.confirmSetup(this.state);
        this.state = newState; // 状態のみ更新、レンダリングはまだしない
        
        // サイドカード配布が完了した後でアニメーション実行
        if (newState.phase === GAME_PHASES.GAME_START_READY) {
            noop('🎯 Prize cards setup completed, starting animation');
            
            // 1. サイドカードアニメーション実行
            noop('🔥 About to call _animatePrizeCardSetup');
            await this._animatePrizeCardSetup();
            noop('✅ Prize card animation completed');
            
            // 2. アニメーション完了後にレンダリング
            this._updateState(this.state);
            
            // 3. アニメーション完了後に準備完了メッセージとスタートボタンを表示
            await this._delay(500); // アニメーション完了を待つ
            
            try {
                this.view.showInteractiveMessage(
                    '準備完了！「ゲームスタート」を押してバトルを開始してください。',
                    [
                        {
                            text: 'ゲームスタート',
                            callback: () => {
                                noop('🔥 GAME START BUTTON CLICKED - Starting actual game');
                                this._startActualGame();
                            }
                        }
                    ],
                    'central' // ゲームスタートは重要な意思決定なので中央モーダル
                );
            } catch (e) {
                console.warn('Failed to show game start modal, fallback to side button.', e);
            }
        }
    }

    /**
     * 実際のゲーム開始処理
     */
    async _startActualGame() {
        noop('🔥 _startActualGame() CALLED - Current phase:', this.state.phase);
        noop('🔥 _startActualGame() - Animation flags:', {
            setupAnimationsExecuted: this.setupAnimationsExecuted,
            prizeCardAnimationExecuted: this.prizeCardAnimationExecuted,
            cardRevealAnimationExecuted: this.cardRevealAnimationExecuted
        });
        
        // 重複実行を防ぐため、既にゲーム開始済みなら早期return
        if (this.state.phase === GAME_PHASES.PLAYER_MAIN || this.state.phase === GAME_PHASES.PLAYER_TURN) {
            noop('🔄 Game already started, skipping _startActualGame');
            return;
        }
        
        noop('🎮 Starting actual game with card reveal animation');
        
        // 1. カードをめくるアニメーションを実行
        noop('🔥 About to call _animateCardReveal');
        await this._animateCardReveal();
        noop('🔥 _animateCardReveal completed');

        // 2. カードを表向きにする (State更新)
        let newState = await this.setupManager.startGameRevealCards(this.state);
        
        // 3. ターン制約をリセット (ドロー以外のもの)
        newState.hasAttachedEnergyThisTurn = false;
        newState.canRetreat = true;
        newState.canPlaySupporter = true;

        // 4. プレイヤーのドローフェーズに移行（手動ドロー）
        newState.phase = GAME_PHASES.PLAYER_DRAW;
        newState.prompt.message = '山札をクリックしてカードを1枚ドローしてください。';

        this._updateState(newState);

        this.state = addLogEntry(this.state, { message: 'バトル開始！' });
    }

    /**
     * カード公開アニメーション
     */
    async _animateCardReveal() {
        // 重複実行防止
        if (this.cardRevealAnimationExecuted) {
            noop('🔄 Card reveal animation already executed, skipping');
            return;
        }
        
        this.cardRevealAnimationExecuted = true;
        noop('🃏 Starting card reveal animation');
        
        const allPokemonElements = [];

        // プレイヤーのバトル場とベンチ
        if (this.state.players.player.active) {
            const activeEl = document.querySelector('.player-self .active-bottom .relative');
            if (activeEl) allPokemonElements.push({ element: activeEl, card: this.state.players.player.active });
        }
        this.state.players.player.bench.forEach((pokemon, index) => {
            if (pokemon) {
                const benchEl = document.querySelector(`.player-self .bottom-bench-${index + 1} .relative`);
                if (benchEl) allPokemonElements.push({ element: benchEl, card: pokemon });
            }
        });

        // CPUのバトル場とベンチ
        if (this.state.players.cpu.active) {
            const activeEl = document.querySelector('.opponent-board .active-top .relative');
            if (activeEl) allPokemonElements.push({ element: activeEl, card: this.state.players.cpu.active });
        }
        this.state.players.cpu.bench.forEach((pokemon, index) => {
            if (pokemon) {
                const benchEl = document.querySelector(`.opponent-board .top-bench-${index + 1} .relative`);
                if (benchEl) allPokemonElements.push({ element: benchEl, card: pokemon });
            }
        });

        // 各ポケモンをフリップ
        noop(`🔥 About to flip ${allPokemonElements.length} pokemon cards`);
        for (const { element, card } of allPokemonElements) {
            await animationManager.flipCardFaceUp(element, getCardImagePath(card.name_en, card));
        }
    }

    /**
     * セットアップアニメーション スケジューリング
     */
    _scheduleSetupAnimations() {
        // 重複実行防止
        if (this.setupAnimationsExecuted) {
            return;
        }
        
        this.setupAnimationsExecuted = true;
        
        // requestAnimationFrame を使って確実にDOM準備完了を待つ
        requestAnimationFrame(() => {
            requestAnimationFrame(async () => {
                // さらに少し待ってから実行
                setTimeout(async () => {
                    await this._executeSetupAnimations();
                }, 100);
            });
        });
    }

    /**
     * セットアップアニメーション実行
     */
    async _executeSetupAnimations() {
        try {
            // DOM要素の存在確認を強化
            await this._verifyDOMElements();
            
            // 手札のアニメーション
            await this._animateInitialHandDraw();
            
            // サイドカードアニメーション
            await this._animatePrizeCardSetup();
            
            // Note: CPUの初期ポケモン配置はプレイヤーの操作後に実行
        } catch (error) {
            errorHandler.handleError(error, ERROR_TYPES.ANIMATION_FAILED, false);
        }
    }

    /**
     * DOM要素存在確認
     */
    async _verifyDOMElements() {
        const playerHand = document.getElementById('player-hand');
        const cpuHand = document.getElementById('cpu-hand');
        
        if (!playerHand || !cpuHand) {
            throw new Error('Hand elements not found');
        }
        
        // 要素が空の場合は少し待ってから再確認
        if (playerHand.children.length === 0 || cpuHand.children.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * 初期手札ドローアニメーション
     */
    async _animateInitialHandDraw() {
        const playerHand = document.getElementById('player-hand');
        const cpuHand = document.getElementById('cpu-hand');

        // アニメーション開始直前に準備クラスを削除
        playerHand?.classList.remove('is-preparing-animation');
        cpuHand?.classList.remove('is-preparing-animation');

        // 準備クラス削除後に各カードの表示状態を復元
        if (playerHand) {
            const playerCards = playerHand.querySelectorAll('.relative');
            playerCards.forEach(card => {
                card.style.opacity = '1';
                card.style.visibility = 'visible';
            });
        }
        if (cpuHand) {
            const cpuCards = cpuHand.querySelectorAll('.relative');
            cpuCards.forEach(card => {
                card.style.opacity = '1';
                card.style.visibility = 'visible';
            });
        }

        // DOMにクラスの削除が反映されるのを待つ
        await this._delay(20); // 非常に短い遅延

        const promises = [];

        if (playerHand) {
            // Select actual card elements inside the hand (skip inner wrapper)
            const playerCards = Array.from(playerHand.querySelectorAll('.relative'));
            
            // 各カード要素の詳細を確認
            
            if (playerCards.length > 0) {
                promises.push(animate.handDeal(playerCards, 'player'));
            }
        }

        if (cpuHand) {
            const cpuCards = Array.from(cpuHand.querySelectorAll('.relative'));
            
            // 各カード要素の詳細を確認
            
            if (cpuCards.length > 0) {
                promises.push(animate.handDeal(cpuCards, 'cpu'));
            }
        }

        await Promise.all(promises);
    }

    /**
     * サイドカード配置アニメーション
     */
    async _animatePrizeCardSetup() {
        // 重複実行防止
        if (this.prizeCardAnimationExecuted) {
            noop('🔄 Prize card animation already executed, skipping');
            return;
        }
        
        this.prizeCardAnimationExecuted = true;
        noop('🎯 Starting prize card animation');
        
        // アニメーション用に裏面カードを事前作成
        await this._createPrizeBackCardsForAnimation();
        
        // 実際にカード要素が入っているスロットの子要素を取得
        const playerPrizeSlots = document.querySelectorAll('.player-self .side-left .card-slot');
        const cpuPrizeSlots = document.querySelectorAll('.opponent-board .side-right .card-slot');

        if (playerPrizeSlots.length === 0 || cpuPrizeSlots.length === 0) {
            console.warn('⚠️ Prize slots not found, skipping animation');
            return;
        }

        const playerPrizeElements = [];
        playerPrizeSlots.forEach((slot) => {
            const cardElement = slot.querySelector('.relative, .card'); // Use the same selector as original
            if (cardElement) {
                playerPrizeElements.push(cardElement);
            } else {
                playerPrizeElements.push(slot); // Fallback to slot if card element not found
            }
        });

        const cpuPrizeElements = [];
        cpuPrizeSlots.forEach((slot) => {
            const cardElement = slot.querySelector('.relative, .card'); // Use the same selector as original
            if (cardElement) {
                cpuPrizeElements.push(cardElement);
            } else {
                cpuPrizeElements.push(slot); // Fallback to slot if card element not found
            }
        });

        // Animate prize cards using unified system
        const allPrizePromises = [];
        
        if (playerPrizeElements.length > 0) {
            allPrizePromises.push(animate.prizeDeal(playerPrizeElements, 'player'));
        } else {
            console.warn('⚠️ No player prize elements found for animation');
        }

        if (cpuPrizeElements.length > 0) {
            allPrizePromises.push(animate.prizeDeal(cpuPrizeElements, 'cpu'));
        } else {
            console.warn('⚠️ No CPU prize elements found for animation');
        }

        // Run prize animations in parallel
        if (allPrizePromises.length > 0) {
            await Promise.all(allPrizePromises);
        }

        // サイドアニメーション完了を記録し、再レンダリングして表示
        this.prizeAnimationCompleted = true;
        noop('🎯 Prize card animation completed, re-rendering to show cards');
        this._updateState(this.state); // 再レンダリングしてサイドカードを表示
    }

    /**
     * アニメーション用に裏面サイドカードを事前作成
     */
    async _createPrizeBackCardsForAnimation() {
        noop('🎯 Creating back cards for prize animation');
        
        const playerPrizeSlots = document.querySelectorAll('.player-self .side-left .card-slot');
        const cpuPrizeSlots = document.querySelectorAll('.opponent-board .side-right .card-slot');
        
        // プレイヤー用裏面カード作成
        playerPrizeSlots.forEach((slot, index) => {
            if (index < 6) {
                slot.innerHTML = ''; // 既存内容をクリア
                const backCard = this._createPrizeBackCard('player', index);
                slot.appendChild(backCard);
            }
        });
        
        // CPU用裏面カード作成
        cpuPrizeSlots.forEach((slot, index) => {
            if (index < 6) {
                slot.innerHTML = ''; // 既存内容をクリア
                const backCard = this._createPrizeBackCard('cpu', index);
                slot.appendChild(backCard);
            }
        });
        
        // DOM更新を待つ
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    /**
     * サイド用裏面カード要素を作成
     */
    _createPrizeBackCard(playerType, index) {
        const cardElement = document.createElement('div');
        cardElement.className = 'relative w-full h-full card-back-element';
        cardElement.dataset.zone = 'prize';
        cardElement.dataset.owner = playerType;
        cardElement.dataset.prizeIndex = index.toString();
        
        // 裏面画像を作成
        const cardBack = document.createElement('div');
        cardBack.className = `w-full h-full card-back ${playerType === 'cpu' ? 'cpu-card' : 'player-card'}`;
        cardBack.style.backgroundImage = 'url("assets/ui/card_back.webp")';
        cardBack.style.backgroundSize = 'cover';
        cardBack.style.backgroundPosition = 'center';
        cardBack.style.borderRadius = '8px';
        cardBack.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        
        cardElement.appendChild(cardBack);
        return cardElement;
    }

    // ==================== アニメーション関連メソッド ====================

    /**
     * カード配置アニメーション
     */
    async _animateCardPlacement(cardElement, zone, index) {
        if (!cardElement) return;

        const cardId = cardElement.dataset.cardId;
        const card = this.state.players.player.hand.find(c => c.id === cardId);

        await animationManager.createUnifiedCardAnimation(
            'player',
            cardId,
            'hand', // sourceZone is assumed to be hand for this legacy function
            zone,   // targetZone
            index,  // targetIndex
            { card }
        );
    }

    /**
     * ポケモン昇格アニメーション
     */
    async _animatePokemonPromotion(playerId, benchIndex) {
        const playerState = this.state.players[playerId];
        const card = playerState.bench[benchIndex];
        if (!card) return;

        await animationManager.createUnifiedCardAnimation(
            playerId,
            card.id,
            'bench',
            'active',
            0, // active zone index is always 0
            { card }
        );
    }


    /**
     * ポケモン要素を検索（アクティブ・ベンチ両方）
     */
    _findPokemonElement(pokemonId) {
        // プレイヤーのアクティブポケモンをチェック
        const playerActiveSlot = document.querySelector('.player-self .active-bottom');
        if (playerActiveSlot) {
            const card = playerActiveSlot.querySelector('[data-card-id]');
            if (card && card.dataset.cardId === pokemonId) {
                return playerActiveSlot;
            }
        }

        // プレイヤーのベンチポケモンをチェック
        for (let i = 1; i <= 5; i++) {
            const benchSlot = document.querySelector(`.player-self .bottom-bench-${i}`);
            if (benchSlot) {
                const card = benchSlot.querySelector('[data-card-id]');
                if (card && card.dataset.cardId === pokemonId) {
                    return benchSlot;
                }
            }
        }

        // CPUのアクティブポケモンをチェック
        const cpuActiveSlot = document.querySelector('.opponent-board .active-top');
        if (cpuActiveSlot) {
            const card = cpuActiveSlot.querySelector('[data-card-id]');
            if (card && card.dataset.cardId === pokemonId) {
                return cpuActiveSlot;
            }
        }

        // CPUのベンチポケモンをチェック
        for (let i = 1; i <= 5; i++) {
            const benchSlot = document.querySelector(`.opponent-board .top-bench-${i}`);
            if (benchSlot) {
                const card = benchSlot.querySelector('[data-card-id]');
                if (card && card.dataset.cardId === pokemonId) {
                    return benchSlot;
                }
            }
        }

        return null;
    }

    /**
     * バトル中のポケモン配置アニメーション（準備フェーズ流用）
     */
    async _animateBattlePokemonPlacement(cardId, targetZone, targetIndex) {
        try {
            // 準備フェーズのアニメーションシステムを流用
            const sourceElement = document.querySelector(`[data-card-id="${cardId}"]`);
            if (!sourceElement) return;

            // アニメーション実行（表面で配置）
            const animationOptions = {
                isSetupPhase: false,  // バトル中なので false
                isFaceUp: true,      // 表面で配置
                duration: 600
            };

            // 統一アニメーションシステムを使用（準備フェーズと同じ）
            await animationManager.createUnifiedCardAnimation(
                'player',
                cardId,
                'hand',
                targetZone,
                targetIndex,
                animationOptions
            );

        } catch (error) {
            noop(`⚠️ Battle Pokemon placement animation failed: ${error.message}`);
            // アニメーション失敗時も処理を続行
        }
    }

    /**
     * サイドカード取得アニメーション
     */
    async _animatePrizeTake(playerId, prizeIndex) {
        const playerState = this.state.players[playerId];
        const card = playerState.prize[prizeIndex]; // This might be null if prize is face down
        // We need a card object for the animation. If it's not available, we might need to skip.
        // For now, let's assume we can get the card info.
        // In a real scenario, the logic would reveal the card before moving it to hand.
        const placeholderCard = { id: `prize-${prizeIndex}`, name_ja: 'サイドカード', name_en: 'Prize Card' };

        await animationManager.createUnifiedCardAnimation(
            playerId,
            card ? card.id : placeholderCard.id,
            'prize',
            'hand',
            playerState.hand.length, // Approximate index in hand
            { card: card || placeholderCard }
        );
    }

    // ==================== ハイライト関連メソッド ====================

    /**
     * カードハイライト
     */
    _highlightCard(cardId, highlight = true) {
        const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
        if (cardElement) {
            if (highlight) {
                animationManager.highlightCard(cardElement);
            } else {
                animationManager.unhighlightCard(cardElement);
            }
        }
    }

    /**
     * エネルギー対象ハイライト
     */
    _highlightEnergyTargets(energyType) {
        const player = this.state.players.player;

        // アクティブポケモンをチェック
        if (player.active && Logic.canUseEnergy(player.active, energyType)) {
            const activeCardElement = document.querySelector('.player-self .active-bottom .relative');
            if (activeCardElement) {
                animationManager.highlightCard(activeCardElement);
            }
        }

        // ベンチポケモンをチェック
        player.bench.forEach((pokemon, index) => {
            if (pokemon && Logic.canUseEnergy(pokemon, energyType)) {
                const benchCardElement = document.querySelector(`.player-self .bottom-bench-${index + 1} .relative`);
                if (benchCardElement) {
                    animationManager.highlightCard(benchCardElement);
                }
            }
        });
    }

    /**
     * ベンチスロットハイライト
     */
    _highlightBenchSlots() {
        const benchCards = document.querySelectorAll('.player-self [class*="bottom-bench-"] .relative');
        benchCards.forEach(card => {
            animationManager.highlightCard(card);
        });
    }

    /**
     * 全ハイライト解除
     */
    _clearAllHighlights() {
        const highlightedCards = document.querySelectorAll('.card-highlighted');
        highlightedCards.forEach(card => {
            animationManager.unhighlightCard(card);
        });
    }

    /**
     * カードハイライト解除
     */
    _clearCardHighlights() {
        const selectedCards = document.querySelectorAll('.card-selected');
        selectedCards.forEach(card => {
            animationManager.unhighlightCard(card);
        });
    }
} // End of Game class
