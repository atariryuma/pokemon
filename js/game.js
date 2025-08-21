import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';
// animationManagerを削除 - シンプル化
import { unifiedAnimationManager } from './simple-animations.js';
// CardOrientationManagerを削除 - シンプル化
import { phaseManager, GAME_PHASES } from './phase-manager.js';
import { BUTTON_IDS, ACTION_BUTTON_GROUPS } from './ui-constants.js';
import { errorHandler, ERROR_TYPES } from './error-handler.js';
import { setupManager } from './setup-manager.js';
import { turnManager } from './turn-manager.js';
import { getCardImagePath, loadCardsFromJSON } from './state.js';
import { addLogEntry } from './state.js';
// soundManagerを削除 - シンプル化
// visualEffectsManagerを削除 - シンプル化

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
        
        // Selected card for setup
        this.selectedCardForSetup = null;
        
        // Animation control flags
    } // End of constructor

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    } // End of _delay

    resetAnimationFlags() {
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
            
            // サウンドマネージャー初期化
            // サウンド初期化を削除 - シンプル化
            
            this.state = createInitialState();
            
            // Initialize view
            this.view = new View(this.rootEl);
            this.view.bindCardClick(this._handleCardClick.bind(this));

            // Setup action button event handlers
            this._setupActionButtonHandlers();

            // Render the initial board state immediately after state creation
            noop('🎨 Rendering initial game state with deck...');
            this.view.render(this.state);

            // Show game start message instead of auto-starting
            this.setupManager.showGameStartModal(this.view);
            
            // Make game instance globally accessible for modal callbacks
            window.gameInstance = this;
        } catch (error) {
            await errorHandler.handleError(error, ERROR_TYPES.SETUP_FAILED);
        }
    } // End of init

    /**
     * モーダルからトリガーされるセットアップ開始（じゃんけんから開始）
     */
    async triggerInitialSetup() {
        noop('🎮 Starting game flow with rock-paper-scissors...');
        
        // じゃんけんフェーズから開始
        this.phaseManager.transitionTo(GAME_PHASES.ROCK_PAPER_SCISSORS);
        this.state.phase = GAME_PHASES.ROCK_PAPER_SCISSORS;
        this.state.prompt.message = 'じゃんけんで先攻・後攻を決めましょう！';
        
        await this._updateState(this.state);
    }

    async _updateState(newState) {
        const previousPhase = this.state?.phase;
        this.state = newState;
        
        // Update phase manager
        const oldPhase = this.phaseManager.currentPhase;
        this.phaseManager.currentPhase = newState.phase;
        
        // フェーズ遷移アニメーション削除（カード反転等の不要なアニメーションを防止）
        // if (oldPhase !== newState.phase) {
        //     await this.unifiedAnimationManager.animatePhaseTransition(oldPhase, newState.phase);
        // }
        
        // Always render the board first
        this.view.render(this.state);

        // Then control UI elements based on phase
        this._updateUI();
    } // End of _updateState

    /**
     * アクションボタンのイベントハンドラーを設定
     * DOM準備完了を確認してからバインドする
     */
    _setupActionButtonHandlers() {
        noop('🔧 Setting up action button handlers');
        
        // DOMContentLoadedまたはDOM準備完了まで待機
        const setupHandlers = () => {
            const retreatButton = this.view.getButton(BUTTON_IDS.RETREAT);
            const attackButton = this.view.getButton(BUTTON_IDS.ATTACK);
            const endTurnButton = this.view.getButton(BUTTON_IDS.END_TURN);
            const drawCardButton = this.view.getButton(BUTTON_IDS.DRAW_CARD);

            if (retreatButton) {
                retreatButton.onclick = this._handleRetreat.bind(this);
                noop('✅ Retreat button handler bound');
            }

            if (attackButton) {
                attackButton.onclick = this._handleAttack.bind(this);
                noop('✅ Attack button handler bound');
            }

            if (endTurnButton) {
                endTurnButton.onclick = this._handleEndTurn.bind(this);
                noop('✅ End turn button handler bound');
            }

            if (drawCardButton) {
                drawCardButton.onclick = this._handleDrawCard.bind(this);
                noop('✅ Draw card button handler bound');
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
                
            case GAME_PHASES.PLAYER_SETUP_CHOICE:
                await this._handlePlayerChoiceClick(dataset);
                break;
                
            // 削除済みフェーズ（並列セットアップに統合済み）
            // ACTIVE_PLACEMENT, BENCH_PLACEMENT
                
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
     * 段階的セットアップ開始（ポケモンカード公式ルール準拠）
     */
    /**
     * 並列ノンブロッキングセットアップ開始（5b35c87フロー）
     */
    async _startParallelGameFlow() {
        noop('🚀 Starting parallel non-blocking game flow (5b35c87)...');
        
        // 並列セットアップ実行
        this.state = await this.setupManager.startParallelGameFlow(this.state);
        
        // セットアップ完了後、即座に自動ドロー → メインフェーズ
        await this.startGameWithAutoFlow();
        
        noop('✅ Parallel setup completed, game ready');
    }

    /**
     * ゲーム開始（自動ドロー→メインフェーズ直行）
     */
    async startGameWithAutoFlow() {
        noop('⚡ Starting game with auto-draw flow...');
        let newState = this.state;
        
        // ターン初期化
        newState.turn = 1;
        newState.turnPlayer = 'player'; // 簡素化: プレイヤー先攻固定
        newState.hasDrawnThisTurn = false;
        newState.hasAttackedThisTurn = false;
        newState.hasAttachedEnergyThisTurn = false;
        newState.canRetreat = true;
        newState.canPlaySupporter = true;

        // 🎯 核心: 自動初回ドロー
        newState = await this.turnManager.handlePlayerDraw(newState);
        newState.phase = GAME_PHASES.PLAYER_MAIN;
        newState.prompt.message = 'あなたのターンです。アクションを選択してください。';

        this._updateState(newState);

        // アクションボタン即座表示
        this.view.showActionButtons(['retreat-button', 'attack-button', 'end-turn-button']);
        
        noop('🎮 Auto-flow complete - ready for player actions');
    }

    /**
     * 並列セットアップ開始（旧フロー・後方互換）
     */
    async _startParallelSetup() {
        noop('🔄 Starting parallel setup for player and CPU...');
        
        // アニメーション準備クラスを追加
        document.getElementById('player-hand')?.classList.add('is-preparing-animation');
        document.getElementById('cpu-hand')?.classList.add('is-preparing-animation');

        // 並列セットアップ実行
        this.state = await this.setupManager.startParallelSetup(this.state);
        
        // 状態を更新してレンダリング
        this._updateState(this.state);
        
        // アニメーション準備クラスを削除して手札を表示
        document.getElementById('player-hand')?.classList.remove('is-preparing-animation');
        document.getElementById('cpu-hand')?.classList.remove('is-preparing-animation');
        
        // プレイヤー選択フェーズのUI表示
        this._updatePlayerChoicePhaseUI();
        
        noop('✅ Parallel setup completed, entering player choice phase');
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
                } else {
                    this.view.showGameMessage('たねポケモンのみ選択できます。', 'warning');
                    console.warn('⚠️ Invalid card selection:', card?.name_ja || 'Unknown card');
                }
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

                // カード移動アニメーションを実行
                if (cardElement) {
                    await unifiedAnimationManager.createUnifiedCardAnimation(
                        'player', // プレイヤー側
                        cardToAnimate.id, // 事前に取得したIDを使用
                        'hand', // 移動元は手札
                        zone, // 移動先は 'active' または 'bench'
                        targetIndex, // ベンチの場合のインデックス
                        {
                            isSetupPhase: true,
                            card: cardToAnimate,
                            initialSourceRect: initialCardRect // ★ 追加: 初期位置を渡す
                        }
                    );
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
        let newState = Logic.promoteToActive(this.state, 'player', benchIndex);
        
        // アニメーション
        await this._animatePokemonPromotion('player', benchIndex);
        
        // 新アクティブ選択完了後の勝敗判定
        newState = Logic.checkForWinner(newState);
        if (newState.phase === GAME_PHASES.GAME_OVER) {
            this._updateState(newState);
            return;
        }
        
        // 次のフェーズに移行
        if (this.state.turnPlayer === 'player') {
            newState.phase = GAME_PHASES.PLAYER_MAIN;
            newState.prompt.message = 'あなたのターンです。アクションを選択してください。';
        } else if (newState.playerToAct === 'cpu') { // CPUが新しいポケモンを選ぶ番の場合
            newState.phase = GAME_PHASES.CPU_TURN;
            newState.prompt.message = '相手が新しいバトルポケモンを選んでいます...';
            await this._updateState(newState);
            await this._executeCpuTurn(); // CPUのターンを再開
            return; // ここで処理を終了
        } else {
            // それ以外のケース（例：CPUがKOされ、プレイヤーが新しいポケモンを選んだ後）
            newState.phase = GAME_PHASES.CPU_TURN; // CPUのターンに戻す
            newState.prompt.message = '相手のターンです...';
        }
        
        await this._updateState(newState);
    }

    /**
     * サイドカード選択処理
     */
    async _handlePrizeSelection(prizeIndex) {
        let newState = Logic.takePrizeCard(this.state, 'player', prizeIndex);
        
        // アニメーション
        await this._animatePrizeTake('player', prizeIndex);
        
        // サイド取得後の処理
        if (newState.players.player.prizesToTake === 0) {
            if (newState.turnPlayer === 'player') {
                newState.phase = GAME_PHASES.PLAYER_MAIN;
            } else {
                newState.phase = GAME_PHASES.CPU_TURN;
            }
        }
        
        this._updateState(newState);
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
                break;

            // じゃんけんフェーズ - アクションHUD表示
            case GAME_PHASES.ROCK_PAPER_SCISSORS:
                this.view.showGameMessage(this.state.prompt.message);
                this._showRockPaperScissorsHUD();
                break;

            case GAME_PHASES.FIRST_PLAYER_CHOICE:
                this.view.showGameMessage(this.state.prompt.message);
                this._showFirstPlayerChoiceHUD();
                break;

            // 削除済みフェーズ（並列セットアップに統合済み）
            // DECK_PLACEMENT, HAND_DEAL, PRIZE_PLACEMENT, ACTIVE_PLACEMENT, BENCH_PLACEMENT, CARD_REVEAL

            // 旧フロー（後方互換）
            case GAME_PHASES.PARALLEL_SETUP:
                this.view.showGameMessage(this.state.prompt.message);
                this.view.hideActionButtons();
                break;

            case GAME_PHASES.PLAYER_SETUP_CHOICE:
                this.view.showGameMessage(this.state.prompt.message);
                // UI制御は_updatePlayerChoicePhaseUI()で処理
                break;

            // 削除済みフェーズ
            // CARD_REVEAL_ANIMATION

            case GAME_PHASES.PRIZE_CARD_SETUP:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                this.view.hideActionButtons();
                break;

            case GAME_PHASES.GAME_START_READY:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                this.view.showActionButtons(ACTION_BUTTON_GROUPS.INITIAL_POKEMON);
                // ボタンテキストを変更
                const gameStartButton = document.getElementById('confirm-initial-pokemon-button');
                if (gameStartButton) {
                    gameStartButton.textContent = 'ゲームスタート';
                    gameStartButton.disabled = false;
                    gameStartButton.classList.remove('opacity-50', 'cursor-not-allowed');
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
                this.view.showGameMessage('サイドカードを選んで取ってください。');
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
     * エネルギー付与処理
     */
    async _attachEnergy(energyId, pokemonId) {
        let newState = this.turnManager.handlePlayerMainPhase(this.state, 'attach_energy', {
            energyId,
            pokemonId
        });
        
        if (newState !== this.state) {
            // エネルギー付与成功をトースト通知
            this.view.showToast('エネルギーを付けました', 'success', 2000);
            
            // エネルギー付与アニメーション
            await this._animateEnergyAttachment(energyId, pokemonId);
            
            newState.pendingAction = null;
            newState.prompt.message = 'あなたのターンです。アクションを選択してください。';
        }
        
        this._clearAllHighlights();
        this._updateState(newState);
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
            // 退却成功をトースト通知
            this.view.showToast('ポケモンが退却しました', 'success', 2000);
            
            // Animate discarded energy cards
            if (discardedEnergy && discardedEnergy.length > 0 && activePokemonElement && discardPileElement) {
                await unifiedAnimationManager.animateDiscardedEnergy(
                    'player',
                    discardedEnergy,
                    activePokemonElement,
                    discardPileElement
                );
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
        // ボタンクリック音を削除
        const attacker = this.state.players.player.active;
        if (!attacker || !attacker.attacks) return;
        
        const usableAttacks = attacker.attacks
            .map((attack, index) => ({ ...attack, index }))
            .filter(attack => Logic.hasEnoughEnergy(attacker, attack));
            
        if (usableAttacks.length === 0) {
            this.view.showGameMessage('使えるワザがありません。');
            return;
        }
        
        this.view.showInteractiveMessage(
            'どのワザを使いますか？',
            [
                ...usableAttacks.map(attack => ({
                    text: `${attack.name_ja} (${attack.damage || 0})`,
                    callback: () => this._executeAttack(attack.index)
                })),
                { text: 'キャンセル', callback: () => {} }
            ],
            'central' // 攻撃選択は重要な意思決定なので中央モーダル
        );
    }

    /**
     * 攻撃実行処理
     */
    async _executeAttack(attackIndex) {
        // 攻撃宣言
        let newState = this.turnManager.handlePlayerMainPhase(this.state, 'declare_attack', {
            attackIndex
        });
        
        this._updateState(newState);
        
        // 攻撃実行
        newState = await this.turnManager.executeAttack(newState);
        this._updateState(newState);

        if (newState.turnPlayer === 'cpu') {
            setTimeout(async () => {
                await this._executeCpuTurn();
            }, 1000);
        }
    }

    /**
     * ドローボタン処理
     */
    async _handleDrawCard() {
        if (this.state.phase === GAME_PHASES.PLAYER_DRAW && this.state.awaitingInput) {
            const newState = await this.turnManager.executePlayerDraw(this.state);
            await this._updateState(newState);
        }
    }

    /**
     * ターン終了ボタン処理
     */
    async _handleEndTurn() {
        // ボタンクリック音を削除
        let newState = this.turnManager.endPlayerTurn(this.state);
        this._updateState(newState);
        
        // ターン終了をトースト通知
        this.view.showToast('あなたのターンが終了しました', 'info', 2500);
        
        // CPUターン開始
        setTimeout(async () => {
            this.view.showToast('相手のターンが開始されました', 'warning', 2500);
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
        this._updateState(newState);
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
            'prizes': 'サイドカードを全て取得',
            'no_pokemon': '場のポケモンが全滅',
            'deck_out': '山札が尽きた'
        };
        
        const winnerText = winner === 'player' ? '🎉 あなたの勝利！' : '😢 相手の勝利！';
        const reasonText = reasonMessages[reason] || reason || '不明な理由';
        
        // ゲーム統計情報を取得
        const gameStats = this._getGameStats();
        
        // ゲーム終了モーダル表示
        this.view.displayModal({
            title: 'ゲーム終了',
            message: `
                <div class="text-center p-4">
                    <div class="text-6xl mb-4">${winner === 'player' ? '🎉' : '😢'}</div>
                    <h2 class="text-3xl font-bold mb-2">${winnerText}</h2>
                    <p class="text-lg text-gray-400 mb-6">勝因: ${reasonText}</p>
                </div>
            `,
            actions: [
                { 
                    text: '🚀 新しいゲームを始める', 
                    callback: () => this._startNewGame(),
                    className: 'w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg'
                }
            ]
        });
    }

    /**
     * ゲーム終了アニメーション
     */
    async _playGameOverAnimation(winner) {
        // 勝者側のカードを光らせる
        const winnerSide = winner === 'player' ? 'player' : 'cpu';
        const cards = document.querySelectorAll(`[data-owner="${winnerSide}"] .card`);
        
        // カード光らせアニメーション
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('animate-pulse', 'ring-4', 'ring-yellow-400');
            }, index * 100);
        });
        
        // 勝利演出の遅延
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    /**
     * ゲーム統計情報取得
     */
    _getGameStats() {
        return {
            turns: this.state.turn || 0,
            playerPrizes: this.state.players?.player?.prizeRemaining || 0,
            cpuPrizes: this.state.players?.cpu?.prizeRemaining || 0,
            winner: this.state.winner || 'unknown',
            reason: this.state.gameEndReason || 'unknown'
        };
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
        
        // 手札エリアの上にアクションHUDを表示
        if (actions.length > 0) {
            this.view.showActionHUD({ actions });
            noop('🎯 Player main actions HUD displayed');
        }
    }



    /**
     * 実際のゲーム開始処理
     */
    async _startActualGame() {
        noop('🔥 _startActualGame() CALLED - Current phase:', this.state.phase);
        
        // アクションHUDを非表示
        this.view.hideActionHUD();
        
        noop('🔥 _startActualGame() - Animation flags: none');
        
        // 重複実行を防ぐため、既にゲーム開始済みなら早期return
        if (this.state.phase === GAME_PHASES.PLAYER_MAIN || this.state.phase === GAME_PHASES.PLAYER_TURN) {
            noop('🔄 Game already started, skipping _startActualGame');
            return;
        }
        
        noop('🎮 Starting actual game without card reveal animation');
        
        // カード反転アニメーションをスキップして直接ゲーム開始処理へ
        noop('🔥 Skipping card reveal animation as requested');

        // 1. カードを表向きにする (State更新)
        let newState = await this.setupManager.startGameRevealCards(this.state);
        
        // 2. ターン制約をリセット (ドロー以外のもの)
        newState.hasAttachedEnergyThisTurn = false;
        newState.canRetreat = true;
        newState.canPlaySupporter = true;

        // 3. プレイヤーターンを開始（手動ドローフェーズから開始）
        newState = await this.turnManager.startPlayerTurn(newState);
        newState.prompt.message = '山札をクリックしてカードを引いてください。';

        this._updateState(newState);

        this.state = addLogEntry(this.state, { message: 'バトル開始！' });
    }





    // ==================== アニメーション関連メソッド ====================

    /**
     * カード配置アニメーション
     */
    async _animateCardPlacement(cardElement, zone, index) {
        if (!cardElement) return;

        const cardId = cardElement.dataset.cardId;
        const card = this.state.players.player.hand.find(c => c.id === cardId);

        await unifiedAnimationManager.animatePokemonPlacement(
            'player',
            card,
            zone,
            index,
            { personality: 'focused', spectacle: 'normal' }
        );
    }

    /**
     * ポケモン昇格アニメーション
     */
    async _animatePokemonPromotion(playerId, benchIndex) {
        const playerState = this.state.players[playerId];
        const card = playerState.bench[benchIndex];
        if (!card) return;

        await unifiedAnimationManager.animatePokemonPlacement(
            playerId,
            card,
            'active',
            0,
            { personality: 'confident', spectacle: 'dramatic' }
        );
    }

    /**
     * エネルギー付与アニメーション
     */
    async _animateEnergyAttachment(energyId, pokemonId) {
        // 新しい統一システムを使用
        await unifiedAnimationManager.animateEnergyAttachment(
            'player', 
            energyId, 
            pokemonId,
            { personality: 'careful', spectacle: 'gentle' }
        );
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

        await unifiedAnimationManager.animatePrizeTake(
            playerId,
            prizeIndex,
            card || placeholderCard,
            { personality: 'excited', spectacle: 'glowing' }
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
                unifiedAnimationManager.highlightCard(cardElement, 'glow');
            } else {
                unifiedAnimationManager.unhighlightCard(cardElement);
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
                unifiedAnimationManager.highlightCard(activeCardElement, 'energy-compatible');
            }
        }

        // ベンチポケモンをチェック
        player.bench.forEach((pokemon, index) => {
            if (pokemon && Logic.canUseEnergy(pokemon, energyType)) {
                const benchCardElement = document.querySelector(`.player-self .bottom-bench-${index + 1} .relative`);
                if (benchCardElement) {
                    unifiedAnimationManager.highlightCard(benchCardElement, 'energy-compatible');
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
            unifiedAnimationManager.highlightCard(card, 'playable');
        });
    }

    /**
     * 全ハイライト解除
     */
    _clearAllHighlights() {
        const highlightedCards = document.querySelectorAll('.card-highlighted');
        highlightedCards.forEach(card => {
            unifiedAnimationManager.unhighlightCard(card);
        });
    }

    /**
     * カードハイライト解除
     */
    _clearCardHighlights() {
        const selectedCards = document.querySelectorAll('.card-selected');
        selectedCards.forEach(card => {
            unifiedAnimationManager.unhighlightCard(card);
        });
    }

    // ==================== 段階的セットアップUI制御メソッド ====================

    /**
     * じゃんけんHUD表示
     */
    _showRockPaperScissorsHUD() {
        const actions = [
            {
                text: '✊ グー',
                callback: () => this._handleRockPaperScissors('rock'),
                className: 'px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-lg'
            },
            {
                text: '✋ パー', 
                callback: () => this._handleRockPaperScissors('paper'),
                className: 'px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-lg'
            },
            {
                text: '✌️ チョキ',
                callback: () => this._handleRockPaperScissors('scissors'),
                className: 'px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-lg'
            }
        ];
        
        this.view.showActionHUD({ 
            actions, 
            title: '🎯 じゃんけんで勝負',
            description: 'CPUとじゃんけんをして先攻・後攻を決めます',
            context: '本物のポケモンカードバトルのように、まずはじゃんけんで先攻を決めましょう！',
            phase: 'setup'
        });
    }

    /**
     * 先攻後攻選択HUD表示
     */
    _showFirstPlayerChoiceHUD() {
        const actions = [
            {
                text: '⚡ 先攻を選ぶ',
                callback: () => this._handleFirstPlayerChoice('first'),
                className: 'px-8 py-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg text-lg'
            },
            {
                text: '🛡️ 後攻を選ぶ',
                callback: () => this._handleFirstPlayerChoice('second'),
                className: 'px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-lg'
            }
        ];
        
        this.view.showActionHUD({ 
            actions, 
            title: '🏆 先攻・後攻選択',
            description: 'じゃんけんに勝ちました！先攻か後攻を選んでください',
            context: '先攻は最初にターンを開始できますが、最初のターンは攻撃できません',
            phase: 'setup'
        });
    }

    /**
     * バトルポケモン配置HUD表示
     */
    _showActivePlacementHUD() {
        if (this.state.players.player.active) {
            const actions = [
                {
                    text: '➡️ ベンチ配置へ進む',
                    callback: () => this._proceedToBenchPlacement(),
                    className: 'px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg'
                }
            ];
            
            this.view.showActionHUD({ 
                actions, 
                title: 'バトルポケモン配置完了',
                description: 'バトルポケモンが配置されました'
            });
        }
    }

    /**
     * ベンチ配置HUD表示
     */
    _showBenchPlacementHUD() {
        const basicPokemon = this.state.players.player.hand.filter(card => 
            card.card_type === 'Pokémon' && card.stage === 'BASIC'
        );
        
        const actions = [
            {
                text: '⏭️ ベンチ配置をスキップ',
                callback: () => this._proceedToPrizePlacement(),
                className: 'px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg'
            }
        ];

        if (basicPokemon.length > 0) {
            actions.unshift({
                text: '🎯 ベンチにポケモンを配置',
                callback: () => this._enableBenchPlacement(),
                className: 'px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg'
            });
        }
        
        this.view.showActionHUD({ 
            actions, 
            title: 'ベンチポケモン配置',
            description: 'ベンチにたねポケモンを配置してください（最大5枚）'
        });
    }

    /**
     * カード公開HUD表示
     */
    _showCardRevealHUD() {
        const actions = [
            {
                text: '🎴 ポケモンを公開してゲーム開始！',
                callback: () => this._handleCardReveal(),
                className: 'px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xl'
            }
        ];
        
        this.view.showActionHUD({ 
            actions, 
            title: 'バトル開始準備完了',
            description: 'すべての準備が整いました！ポケモンを公開してバトルを開始しましょう！'
        });
    }

    // ==================== 段階的セットアップアクションハンドラー ====================

    /**
     * じゃんけん処理
     */
    async _handleRockPaperScissors(choice) {
        noop(`🎮 Player chose: ${choice}`);
        // ボタンクリック音を削除
        this.view.hideActionHUD();
        
        // 選択をトースト通知で確認
        const choiceMap = { 'rock': 'グー', 'paper': 'パー', 'scissors': 'チョキ' };
        this.view.showToast(`${choiceMap[choice]}を選択しました！`, 'info', 2000);
        
        this.state = await this.setupManager.handleRockPaperScissors(this.state, choice);
        this._updateState(this.state);
        
        // あいこの場合HUD再表示
        if (this.state.needsRpsRetry) {
            this.state.needsRpsRetry = false;
            setTimeout(() => {
                this._showRockPaperScissorsHUD();
            }, 3000); // 3秒後に再表示
        }
    }

    /**
     * 先攻後攻選択処理
     */
    async _handleFirstPlayerChoice(choice) {
        noop(`⚡ Player chose: ${choice}`);
        // ボタンクリック音を削除
        this.view.hideActionHUD();
        
        // 選択をトースト通知で確認
        const choiceText = choice === 'first' ? '先攻' : '後攻';
        this.view.showToast(`${choiceText}を選択しました！`, 'success', 2500);
        
        this.state = await this.setupManager.handleFirstPlayerChoice(this.state, choice);
        this._updateState(this.state);
    }

    /**
     * バトルポケモン配置クリック処理
     */
    async _handleActivePlacementClick(dataset) {
        const { owner, zone, cardId, index } = dataset;
        if (owner !== 'player') return;

        // ポケモン配置処理（既存ロジック活用）
        if (zone === 'hand' && cardId) {
            const card = this.state.players.player.hand.find(c => c.id === cardId);
            if (card && card.card_type === 'Pokémon' && card.stage === 'BASIC') {
                this.selectedCardForSetup = card;
                this._highlightCard(cardId, true);
                this.state.prompt.message = `「${card.name_ja}」をバトル場に配置してください。`;
                this.view.updateStatusMessage(this.state.prompt.message);
            }
        } else if (zone === 'active' && this.selectedCardForSetup) {
            // バトルポケモン配置実行
            // ポケモン配置音を削除
            this.state = await this.setupManager.handlePokemonSelection(
                this.state, 'player', this.selectedCardForSetup.id, 'active', 0
            );
            
            this.selectedCardForSetup = null;
            this._clearCardHighlights();
            
            // CPUのバトルポケモン配置も実行
            this.state = await this.setupManager.handleActivePlacementComplete(this.state);
            
            this._updateState(this.state);
        }
    }

    /**
     * ベンチ配置クリック処理
     */
    async _handleBenchPlacementClick(dataset) {
        const { owner, zone, cardId, index } = dataset;
        if (owner !== 'player') return;

        if (zone === 'hand' && cardId) {
            const card = this.state.players.player.hand.find(c => c.id === cardId);
            if (card && card.card_type === 'Pokémon' && card.stage === 'BASIC') {
                this.selectedCardForSetup = card;
                this._highlightCard(cardId, true);
                this.state.prompt.message = `「${card.name_ja}」をベンチに配置してください。`;
                this.view.updateStatusMessage(this.state.prompt.message);
            }
        } else if (zone === 'bench' && this.selectedCardForSetup) {
            const benchIndex = parseInt(index, 10);
            
            // ベンチ配置実行
            this.state = await this.setupManager.handlePokemonSelection(
                this.state, 'player', this.selectedCardForSetup.id, 'bench', benchIndex
            );
            
            this.selectedCardForSetup = null;
            this._clearCardHighlights();
            
            this._updateState(this.state);
            this._showBenchPlacementHUD(); // HUDを再表示
        }
    }

    /**
     * ベンチ配置完了処理
     */
    async _proceedToPrizePlacement() {
        noop('🎯 Proceeding to prize placement...');
        this.view.hideActionHUD();
        
        this.state = await this.setupManager.handleBenchPlacementComplete(this.state);
        this._updateState(this.state);
    }

    /**
     * ベンチ配置モード有効化
     */
    _enableBenchPlacement() {
        this.view.hideActionHUD();
        this.state.prompt.message = 'ベンチに配置するたねポケモンをクリックしてください。';
        this.view.updateStatusMessage(this.state.prompt.message);
    }

    /**
     * カード公開処理
     */
    async _handleCardReveal() {
        noop('🎴 Revealing all Pokemon cards...');
        this.view.hideActionHUD();
        
        this.state = await this.setupManager.handleCardReveal(this.state);
        this._updateState(this.state);
        
        // ゲーム開始後、先攻プレイヤーのターンに移行
        if (this.state.turnPlayer === 'player') {
            this.state = await this.turnManager.startPlayerTurn(this.state);
            this._updateState(this.state);
        }
    }

    // ==================== 旧フロー用メソッド（後方互換） ====================

    /**
     * プレイヤー選択フェーズのUI制御
     */
    _updatePlayerChoicePhaseUI() {
        const actions = [];
        
        // サイドドローボタン（未完了の場合のみ表示）
        if (!this.state.setupProgress?.playerSideDrawn) {
            actions.push({
                text: '🃏 サイドドロー (6枚)',
                callback: () => this._handlePlayerSideDraw(),
                className: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-sm'
            });
        }
        
        // ゲームスタートボタン（バトル場配置完了時のみ表示）
        if (this.state.players.player.active && this.state.setupProgress?.playerSideDrawn) {
            actions.push({
                text: '🚀 ゲームスタート',
                callback: () => this._startCardRevealPhase(),
                className: 'px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg'
            });
        }
        
        if (actions.length > 0) {
            this.view.showActionHUD({ actions, title: 'セットアップ' });
        }
    }

    /**
     * プレイヤー選択フェーズのクリック処理
     */
    async _handlePlayerChoiceClick(dataset) {
        const { owner, zone, cardId, index } = dataset;
        if (owner !== 'player') return;

        // ポケモン配置処理（既存のセットアップロジックを再利用）
        if (zone === 'hand' && cardId) {
            const card = this.state.players.player.hand.find(c => c.id === cardId);
            if (card && card.card_type === 'Pokémon' && card.stage === 'BASIC') {
                this.selectedCardForSetup = card;
                this._highlightCard(cardId, true);
                this.state.prompt.message = `「${card.name_ja}」をバトル場かベンチに配置してください。`;
                this.view.updateStatusMessage(this.state.prompt.message);
            }
        } else if ((zone === 'active' || zone === 'bench') && this.selectedCardForSetup) {
            const targetIndex = zone === 'bench' ? parseInt(index, 10) : 0;
            
            // ポケモン配置実行
            // ポケモン配置音を削除
            this.state = await this.setupManager.handlePokemonSelection(
                this.state,
                'player',
                this.selectedCardForSetup.id,
                zone,
                targetIndex
            );
            
            this.selectedCardForSetup = null;
            this._clearCardHighlights();
            
            // セットアップ進行状況を更新
            if (this.state.players.player.active) {
                this.state.setupProgress.playerPokemonPlaced = true;
            }
            
            this._updateState(this.state);
            this._updatePlayerChoicePhaseUI();
        }
    }

    /**
     * プレイヤーサイドドロー処理
     */
    async _handlePlayerSideDraw() {
        noop('🃏 Handling player side draw...');
        
        // サイドドローアニメーション実行
        await this.setupManager.animatePlayerPrizeDistribution();
        
        // 状態更新
        this.state = await this.setupManager.handlePlayerSideDraw(this.state);
        
        this._updateState(this.state);
        this._updatePlayerChoicePhaseUI();
        
        noop('✅ Player side draw completed');
    }

    /**
     * カード公開フェーズ開始
     */
    async _startCardRevealPhase() {
        noop('🎴 Starting card reveal phase...');
        
        // 直接ゲーム開始フェーズに移行（アニメーションは並列処理）
        this.state.phase = GAME_PHASES.GAME_START_READY;
        this.state.prompt.message = 'ポケモンを公開中...';
        this._updateState(this.state);
        
        // アクションHUDを非表示
        this.view.hideActionHUD();
        
        // カード公開アニメーション実行
        await this._revealPokemonCards();
        
        // ゲーム開始処理
        await this._finalizeGameStart();
    }

    /**
     * ポケモン公開アニメーション（1枚ずつめくり）
     */
    async _revealPokemonCards() {
        noop('🎴 Revealing pokemon cards one by one...');
        
        // プレイヤー側の公開
        if (this.state.players.player.active) {
            await this._flipSingleCard('player', this.state.players.player.active, 'active');
            await this._delay(800);
        }
        
        for (let i = 0; i < 5; i++) {
            if (this.state.players.player.bench[i]) {
                await this._flipSingleCard('player', this.state.players.player.bench[i], 'bench', i);
                await this._delay(600);
            }
        }
        
        // CPU側の公開
        if (this.state.players.cpu.active) {
            await this._flipSingleCard('cpu', this.state.players.cpu.active, 'active');
            await this._delay(800);
        }
        
        for (let i = 0; i < 5; i++) {
            if (this.state.players.cpu.bench[i]) {
                await this._flipSingleCard('cpu', this.state.players.cpu.bench[i], 'bench', i);
                await this._delay(600);
            }
        }
    }

    /**
     * 単一カードの反転アニメーション
     */
    async _flipSingleCard(owner, card, zone, index = 0) {
        const selector = owner === 'player' ? '.player-self' : '.opponent-board';
        let cardSelector;
        
        if (zone === 'active') {
            cardSelector = owner === 'player' ? '.active-bottom .relative' : '.active-top .relative';
        } else {
            cardSelector = `.bottom-bench-${index + 1} .relative`;
        }
        
        const cardElement = document.querySelector(`${selector} ${cardSelector}`);
        if (cardElement) {
            // 簡単な反転アニメーション
            cardElement.style.transform = 'rotateY(180deg)';
            await this._delay(300);
            cardElement.style.transform = 'rotateY(0deg)';
            
            // setupFaceDownフラグを削除
            if (card.setupFaceDown) {
                delete card.setupFaceDown;
            }
        }
    }

    /**
     * ゲーム開始完了処理
     */
    async _finalizeGameStart() {
        noop('🎮 Finalizing game start...');
        
        // カード公開完了、すべてのsetupFaceDownフラグを削除
        this.state = await this.setupManager.startGameRevealCards(this.state);
        
        // ターン制約をリセット
        this.state.hasAttachedEnergyThisTurn = false;
        this.state.canRetreat = true;
        this.state.canPlaySupporter = true;

        // プレイヤーターンを開始
        this.state = await this.turnManager.startPlayerTurn(this.state);
        this.state.prompt.message = '山札をクリックしてカードを引いてください。';

        this._updateState(this.state);

        this.state = addLogEntry(this.state, { message: 'バトル開始！' });
        
        noop('🎯 Game successfully started, player turn begins');
    }
} // End of Game class
