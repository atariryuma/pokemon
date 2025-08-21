import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';
import { animationManager, unifiedAnimationManager } from './unified-animations.js';
import { CardOrientationManager } from './card-orientation.js';
import { phaseManager, GAME_PHASES } from './phase-manager.js';
import { BUTTON_IDS, ACTION_BUTTON_GROUPS } from './ui-constants.js';
import { errorHandler, ERROR_TYPES } from './error-handler.js';
import { setupManager } from './setup-manager.js';
import { turnManager } from './turn-manager.js';
import { getCardImagePath, loadCardsFromJSON } from './data-manager.js';
import { addLogEntry } from './state.js';

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
        this.setupAnimationsExecuted = false;
        this.prizeCardAnimationExecuted = false;
        this.cardRevealAnimationExecuted = false;
    } // End of constructor

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    } // End of _delay

    resetAnimationFlags() {
        this.setupAnimationsExecuted = false;
        this.prizeCardAnimationExecuted = false;
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

    async _updateState(newState) {
        const previousPhase = this.state?.phase;
        this.state = newState;
        
        // Update phase manager
        const oldPhase = this.phaseManager.currentPhase;
        this.phaseManager.currentPhase = newState.phase;
        
        // フェーズ遷移アニメーションを実行
        if (oldPhase !== newState.phase) {
            await this.unifiedAnimationManager.animatePhaseTransition(oldPhase, newState.phase);
        }
        
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
     * ターン終了ボタン処理
     */
    async _handleEndTurn() {
        let newState = this.turnManager.endPlayerTurn(this.state);
        this._updateState(newState);
        
        // ターン終了通知
        this.view.showInfoMessage('ターンが終了しました');
        
        // CPUターン開始
        setTimeout(async () => {
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
     * 確定HUDの表示判定と表示
     */
    _showConfirmHUDIfReady() {
        if (this.state.phase !== GAME_PHASES.INITIAL_POKEMON_SELECTION) return;
        
        const playerActive = this.state.players.player.active;
        const hasBasicPokemonInActive = playerActive && playerActive.card_type === 'Pokémon' && playerActive.stage === 'BASIC';
        
        if (hasBasicPokemonInActive) {
            this.view.showActionHUD({
                actions: [
                    {
                        text: '✅ ポケモン配置を確定',
                        callback: () => this._handleConfirmSetup(),
                        className: 'px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg'
                    }
                ]
            });
        }
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
        // 強制的にボタンの無効化状態をチェック
        const confirmButton = document.getElementById('confirm-initial-pokemon-button');
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
        
        // 状態を更新して、サイドカード配布を含む完全なセットアップを実行
        let newState = await this.setupManager.confirmSetup(this.state);
        this._updateState(newState);
        
        // サイドカード配布が完了した後でアニメーションとUI更新を順次実行
        if (newState.phase === GAME_PHASES.GAME_START_READY) {
            noop('🎯 Prize cards setup completed, showing animation and start button');
            
            // 1. DOM更新を少し待つ
            await this._delay(300);
            
            // 2. サイドカードアニメーション実行
            noop('🔥 About to call _animatePrizeCardSetup');
            await this._animatePrizeCardSetup();
            noop('✅ Prize card animation completed');
            
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

        // 4. プレイヤーの初手ドローを自動で実行しメインフェーズへ
        newState = await this.turnManager.handlePlayerDraw(newState);
        newState.phase = GAME_PHASES.PLAYER_MAIN;
        newState.prompt.message = 'あなたのターンです。アクションを選択してください。';

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
            noop(`🔥 Flipping card: ${card.name_ja} (${card.name_en})`);
            await animationManager.flipCardFaceUp(element, getCardImagePath(card.name_en));
        }
        noop(`🔥 All ${allPokemonElements.length} pokemon cards flipped`);
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
            
            // Note: CPUの初期ポケモン配置はプレイヤーの操作後に実行
            // サイドカードアニメーションは配布後に実行（重複防止）
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
                promises.push(unifiedAnimationManager.animateHandDeal(playerCards, 'player'));
            }
        }

        if (cpuHand) {
            const cpuCards = Array.from(cpuHand.querySelectorAll('.relative'));
            
            // 各カード要素の詳細を確認
            
            if (cpuCards.length > 0) {
                promises.push(unifiedAnimationManager.animateHandDeal(cpuCards, 'cpu'));
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
            allPrizePromises.push(unifiedAnimationManager.animatePrizeDeal(playerPrizeElements, 'player'));
        } else {
            console.warn('⚠️ No player prize elements found for animation');
        }

        if (cpuPrizeElements.length > 0) {
            allPrizePromises.push(unifiedAnimationManager.animatePrizeDeal(cpuPrizeElements, 'cpu'));
        } else {
            console.warn('⚠️ No CPU prize elements found for animation');
        }

        // Run prize animations in parallel
        if (allPrizePromises.length > 0) {
            await Promise.all(allPrizePromises);
        }
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
     * エネルギー付与アニメーション
     */
    async _animateEnergyAttachment(energyId, pokemonId) {
        // 統一システムを使用
        await animationManager.createUnifiedEnergyAnimation(
            'player', 
            energyId, 
            pokemonId
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
