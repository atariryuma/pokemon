import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';
import { animationManager } from './animations.js';
import { unifiedAnimationManager } from './unified-animations.js';
import { phaseManager, GAME_PHASES } from './phase-manager.js';
import { setupManager } from './setup-manager.js';
import { turnManager } from './turn-manager.js';
import { getCardImagePath, loadCardsFromJSON } from './data-manager.js';

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
        
        // Selected card for setup
        this.selectedCardForSetup = null;
        
        // Animation control flags
        this.setupAnimationsExecuted = false;
    } // End of constructor

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    } // End of _delay

    async init() {
        console.log('Game.init() started.');
        
        // 📦 Load card data first
        try {
            await loadCardsFromJSON();
            console.log('✅ Card data loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load card data:', error);
        }
        
        this.state = createInitialState();
        
        // Initialize view
        this.view = new View(this.rootEl);
        this.view.bindCardClick(this._handleCardClick.bind(this));
        this.view.setConfirmSetupButtonHandler(this._handleConfirmSetup.bind(this)); // Bind confirm button

        // Bind action buttons
        this.view.retreatButton.onclick = this._handleRetreat.bind(this);
        this.view.attackButton.onclick = this._handleAttack.bind(this);
        this.view.endTurnButton.onclick = this._handleEndTurn.bind(this); // Bind end turn button

        // Show game start modal instead of auto-starting
        this.setupManager.showGameStartModal();
        
        // Make game instance globally accessible for modal callbacks
        window.gameInstance = this;
        
        console.log('Game.init() finished.');
    } // End of init

    /**
     * モーダルからトリガーされるセットアップ開始
     */
    async triggerInitialSetup() {
        console.log('🎮 Triggering initial setup from modal...');
        
        // モーダルを隠す
        setTimeout(async () => {
            const modal = document.getElementById('action-modal');
            modal?.classList.add('hidden');
            
            // 実際のセットアップ開始
            await this._startGameSetup();
        }, 500);
    }

    _updateState(newState) {
        console.log('_updateState() started. newState.phase:', newState.phase);
        
        // デバッグ情報を詳細に出力
        console.log('🎮 Game State Update:');
        console.log('  Phase:', newState.phase);
        console.log('  Turn Player:', newState.turnPlayer);
        console.log('  Player Hand:', newState.players.player.hand.length, 'cards');
        console.log('  Player Active:', newState.players.player.active?.name_ja || 'None');
        console.log('  CPU Hand:', newState.players.cpu.hand.length, 'cards');
        console.log('  CPU Active:', newState.players.cpu.active?.name_ja || 'None');
        
        this.state = newState;
        
        // Update phase manager
        this.phaseManager.currentPhase = newState.phase;
        
        // Always render the board first
        this.view.render(this.state);

        // Then control UI elements based on phase
        this._updateUI();
    } // End of _updateState

    async _handleCardClick(dataset) {
        console.log('_handleCardClick() started. dataset:', dataset);
        const { owner, zone, cardId, index } = dataset;
        if (owner !== 'player') return;

        // 処理中の場合はクリックを無視
        if (this.state.isProcessing) {
            console.log('🚫 Game is processing, ignoring click.');
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
        console.log('🎮 Starting game setup...');

        // アニメーション準備クラスを追加
        document.getElementById('player-hand')?.classList.add('is-preparing-animation');
        document.getElementById('cpu-hand')?.classList.add('is-preparing-animation');

        this.state = await this.setupManager.initializeGame(this.state);
        
        // 単一のレンダリングサイクルで処理（二重レンダリング防止）
        console.log('🔄 Updating game state and rendering...');
        this._updateState(this.state);
        
        // DOM要素の完全な準備を確実に待つ
        this._scheduleSetupAnimations();
        
        // デバッグ: 手札の内容を確認（state.players存在チェック付き）
        if (this.state && this.state.players) {
            console.log('👤 Player hand after setup:', this.state.players.player?.hand?.length || 0, 'cards');
            if (this.state.players.player?.hand) {
                this.state.players.player.hand.forEach((card, i) => {
                    console.log(`  ${i + 1}. ${card.name_ja} (${card.id})`);
                });
            }
            console.log('🤖 CPU hand after setup:', this.state.players.cpu?.hand?.length || 0, 'cards');
            console.log('🏆 Player prizes after setup:', this.state.players.player?.prize?.length || 0, 'cards');
            console.log('🏆 CPU prizes after setup:', this.state.players.cpu?.prize?.length || 0, 'cards');
        } else {
            console.warn('⚠️ State.players not initialized for debug logging');
        }
        
        // 初期状態のレンダリング完了後の手札確認
        setTimeout(() => {
            console.log('🗺️ Post-render hand verification:');
            const handElements = document.querySelectorAll('#player-hand .hand-card, #player-hand-inner .hand-card');
            console.log('  Player hand elements:', handElements.length);
            const playerHandLength = this.state?.players?.player?.hand?.length || 0;
            console.log('  Player hand data:', playerHandLength);
            
            if (handElements.length !== playerHandLength) {
                console.warn('⚠️ Hand element count mismatch detected!');
                console.log('  Expected:', playerHandLength);
                console.log('  Found:', handElements.length);
                console.log('  Re-rendering hand...');
                const playerHandElement = this.view.playerHandInner || this.view.playerHand;
                if (playerHandElement && this.state?.players?.player?.hand) {
                    this.view._renderHand(playerHandElement, this.state.players.player.hand, 'player');
                }
            }
        }, 500); // アニメーション完了を待つ
    }

    /**
     * セットアップ時のカードクリック処理
     */
    async _handleSetupCardClick(dataset) {
        const { zone, cardId, index } = dataset;
        
        console.log('🎯 Setup card click:', { zone, cardId, index });
        
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
                    console.log(`✅ Selected Pokemon for setup: ${card.name_ja}`);
                } else {
                    this.view.showMessage('たねポケモンのみ選択できます。', 'warning');
                    console.log('❌ Invalid card selection:', card?.name_ja || 'Unknown card');
                }
            } else if ((zone === 'active' || zone === 'bench') && this.selectedCardForSetup) {
                console.log(`🃏 Attempting to place card: ${this.selectedCardForSetup.name_ja}`);
                
                // 配置先を選択
                const targetIndex = zone === 'bench' ? parseInt(index, 10) : 0;
                console.log(`🎯 Placing ${this.selectedCardForSetup.name_ja} in ${zone}${zone === 'bench' ? `[${targetIndex}]` : ''}`);

                // DOM上のカード要素を取得（手札のカード）
                const cardElement = document.querySelector(`[data-card-id="${this.selectedCardForSetup.id}"]`);
                if (!cardElement) {
                    console.warn(`⚠️ Card element not found for ${this.selectedCardForSetup.id}`);
                }

                // アニメーションに必要な情報を事前に取得
                const cardToAnimate = this.selectedCardForSetup; // アニメーション用にカード情報を保持

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
                if (this.state && this.state.players && this.state.players.player) {
                    console.log('📋 State updated - new hand size:', this.state.players.player.hand.length);
                } else {
                    console.warn('⚠️ State or players not properly initialized');
                    return;
                }

                // selectedCardForSetup のリセットとハイライト解除を、
                // State更新直後、Viewレンダリングの前に移動
                this.selectedCardForSetup = null;
                this._clearCardHighlights();
                this.state.prompt.message = '次のたねポケモンを選択するか、確定してください。';
                this.view.updateStatusMessage(this.state.prompt.message);

                // 一度だけレンダリングし、重複を防止
                console.log('📋 Final state update after card placement');
                this._updateState(this.state); // まずViewを更新

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
                        { isSetupPhase: true, card: cardToAnimate } // 事前に取得したカード情報を使用
                    );
                }

            } else if ((zone === 'active' || zone === 'bench') && !this.selectedCardForSetup) {
                // カードが選択されていない状態でスロットをクリックした場合
                this.view.showMessage('先に手札からたねポケモンを選択してください。', 'warning');
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
            this.view.showMessage('このターンはすでにカードを引いています。', 'warning');
            this.view.showErrorMessage('このターンはすでにカードを引いています。');
            return;
        }
        
        this.view.showMessage('カードを引きました', 'info');
        this.state = await this.turnManager.handlePlayerDraw(this.state);
        
        // ドロー後にメインフェーズに移行
        this.state.phase = GAME_PHASES.PLAYER_MAIN;
        this.state.prompt.message = 'あなたのターンです。アクションを選択してください。';

        this._updateState(this.state);
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
            console.log('🏆 Game ended after new active selection:', newState.winner, newState.gameEndReason);
            this._updateState(newState);
            return;
        }
        
        // 次のフェーズに移行
        if (this.state.turnPlayer === 'player') {
            newState.phase = GAME_PHASES.PLAYER_MAIN;
            newState.prompt.message = 'あなたのターンです。アクションを選択してください。';
        } else {
            newState.phase = GAME_PHASES.CPU_TURN;
            newState.prompt.message = '相手のターンです...';
        }
        
        this._updateState(newState);
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
            this.view.showModal({ title: 'ベンチが満員です。', actions: [{ text: 'OK', callback: () => {} }] });
        }
    } // End of _placeOnBench

    /**
     * UI更新処理
     */
    _updateUI() {
        // 基本的なUI要素の初期状態
        this.view.hideGameMessage();
        this.view.hideActionButtons();

        // ゲームステータスパネルを常時更新
        this.view.updateGameStatus(this.state);
        this.view.updateSetupProgress(this.state);

        // フェーズに応じたUI表示
        switch (this.state.phase) {
            case GAME_PHASES.SETUP:
            case GAME_PHASES.INITIAL_POKEMON_SELECTION:
                this.view.showGameMessage(this.state.prompt.message);
                this.view.showActionButtons(['confirm-initial-pokemon-button']);
                this.view.showInitialPokemonSelectionUI();
                // バトルポケモンが選択されていない場合はボタンを無効化
                const confirmButton = document.getElementById('confirm-initial-pokemon-button');
                if (confirmButton) {
                    const playerActive = this.state.players.player.active;
                    const hasBasicPokemonInActive = playerActive && playerActive.card_type === 'Pokémon' && playerActive.stage === 'BASIC';

                    if (hasBasicPokemonInActive) {
                        confirmButton.disabled = false;
                        confirmButton.textContent = '確定';
                        confirmButton.classList.remove('opacity-50', 'cursor-not-allowed');
                    } else {
                        confirmButton.disabled = true;
                        confirmButton.textContent = 'たねポケモンをバトル場へ配置';
                        confirmButton.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                }
                break;

            case GAME_PHASES.PRIZE_CARD_SETUP:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                this.view.hideActionButtons();
                break;

            case GAME_PHASES.GAME_START_READY:
                this.view.hideInitialPokemonSelectionUI();
                this.view.showGameMessage(this.state.prompt.message);
                this.view.showActionButtons(['confirm-initial-pokemon-button']);
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
                this.view.showActionButtons(['retreat-button', 'attack-button', 'end-turn-button']);
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
                this.view.showGameMessage('新しいバトルポケモンをベンチから選んでください。');
                break;

            case GAME_PHASES.PRIZE_SELECTION:
                this.view.showGameMessage('サイドカードを選んで取ってください。');
                break;

            case GAME_PHASES.GAME_OVER:
                this.view.showGameMessage(this.state.prompt.message);
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
            // たねポケモンをベンチに出す
            await this.view.showModal({
                title: `「${card.name_ja}」をベンチに出しますか？`,
                actions: [
                    { text: 'はい', callback: () => this._placeOnBench(cardId) },
                    { text: 'いいえ', callback: () => {} }
                ]
            });
        } else if (card.card_type === 'Basic Energy') {
            // エネルギーを付ける
            if (this.state.hasAttachedEnergyThisTurn) {
                this.view.showModal({
                    title: 'このターンはすでにエネルギーをつけました。',
                    actions: [{ text: 'OK', callback: () => {} }]
                });
                return;
            }
            
            // エネルギー付与のペンディングアクション設定
            this.state.pendingAction = {
                type: 'attach-energy',
                sourceCardId: cardId
            };
            this.state.prompt.message = 'エネルギーをつけるポケモンを選んでください。';
            this._updateState(this.state);
            
            // ターゲット可能なポケモンをハイライト
            this._highlightEnergyTargets();
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
            
            this.view.showMessage('エネルギーを付けました', 'success');
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

        let newState = this.turnManager.handlePlayerMainPhase(this.state, 'retreat_pokemon', {
            fromActiveId: active.id,
            toBenchIndex: benchIndex
        });

        if (newState !== this.state) {
            this.view.showMessage('にげました', 'success');
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
            this.view.showModal({
                title: '使えるワザがありません。',
                actions: [{ text: 'OK', callback: () => {} }]
            });
            return;
        }
        
        this.view.showModal({
            title: 'どのワザを使いますか？',
            actions: [
                ...usableAttacks.map(attack => ({
                    text: `${attack.name_ja} (${attack.damage || 0})`,
                    callback: () => this._executeAttack(attack.index)
                })),
                { text: 'キャンセル', callback: () => {} }
            ]
        });
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
        
        // CPUターン開始
        setTimeout(async () => {
            await this._executeCpuTurn();
        }, 1000);
    }

    /**
     * CPUターン実行
     */
    async _executeCpuTurn() {
        console.log('🤖 Starting CPU turn execution...');
        
        // CPUターン開始
        let newState = await this.turnManager.startCpuTurn(this.state);
        this._updateState(newState);
        
        // CPUの自動ターン実行
        newState = await this.turnManager.executeCpuTurn(newState);
        this._updateState(newState);
        
        console.log('🤖 CPU turn execution completed');
    }

    /**
     * ゲーム終了処理
     */
    _handleGameOver(winner, reason = '') {
        const winnerText = winner === 'player' ? 'あなたの勝ち！' : '相手の勝ち！';
        const reasonText = reason ? ` (${reason})` : '';
        
        this.view.showModal({
            title: 'ゲーム終了！',
            body: `<p class="text-xl">${winnerText}${reasonText}</p>`,
            actions: [
                { text: 'もう一度プレイ', callback: () => this.init() },
            ],
        });
    }

    /**
     * にげる処理
     */
    _handleRetreat() {
        if (this.state.turnPlayer !== 'player') return;

        const activePokemon = this.state.players.player.active;
        if (!activePokemon) {
            this.view.showMessage('バトル場にポケモンがいません。', 'warning');
            this.view.showErrorMessage('バトル場にポケモンがいません。');
            return;
        }

        if (!this.state.canRetreat) {
            this.view.showMessage('このターンはすでににげました。', 'warning');
            this.view.showErrorMessage('このターンはすでににげました。');
            return;
        }

        const retreatCost = activePokemon.retreat_cost || 0;
        const attachedEnergyCount = activePokemon.attached_energy ? activePokemon.attached_energy.length : 0;

        if (attachedEnergyCount < retreatCost) {
            this.view.showMessage('にげるためのエネルギーが足りません。', 'warning');
            this.view.showErrorMessage('にげるためのエネルギーが足りません。');
            return;
        }

        this.view.showModal({
            title: 'にげますか？',
            body: `<p>バトル場の「${activePokemon.name_ja}」をにがします。ベンチポケモンを選択してください。</p>`,
            actions: [
                { text: 'はい', callback: () => this._initiateRetreat() },
                { text: 'いいえ', callback: () => {} }
            ]
        });
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
     * セットアップ確定処理
     */
    async _handleConfirmSetup() {
        console.log('✅ Confirming setup...');
        
        // フェーズに応じて処理を分岐
        if (this.state.phase === GAME_PHASES.GAME_START_READY) {
            // ゲームスタートボタンが押された場合
            console.log('🎮 Starting game...');
            await this._startActualGame();
            return;
        }

        // 初期ポケモン配置確定の場合
        // 強制的にボタンの無効化状態をチェック
        const confirmButton = document.getElementById('confirm-setup-button');
        if (confirmButton && confirmButton.disabled) {
            this.view.showMessage('バトル場にたねポケモンを配置してください。', 'warning');
            this.view.showErrorMessage('バトル場にたねポケモンを配置してください。');
            return;
        }
        
        const active = this.state?.players?.player?.active;
        if (!active || active.card_type !== 'Pokémon' || active.stage !== 'BASIC') {
            this.view.showMessage('バトル場にたねポケモンを配置してください。', 'warning');
            this.view.showErrorMessage('バトル場にたねポケモンを配置してください。');
            return;
        }

        this.view.showMessage('ポケモン配置完了！サイドカードを配布します...', 'success');
        
        // 状態を更新して、サイドカード配布を含む完全なセットアップを実行
        let newState = await this.setupManager.confirmSetup(this.state);
        this._updateState(newState);
        
        // サイドカードが配布された後でアニメーション実行
        if (newState.phase === GAME_PHASES.GAME_START_READY) {
            console.log('🎬 Starting prize card animation after distribution...');
            // DOM更新を待ってからアニメーション実行
            setTimeout(async () => {
                await this._animatePrizeCardSetup();
            }, 200); // DOM更新を待つ
        }
        
        console.log('✅ Setup confirmed, waiting for game start button.');
    }

    /**
     * 実際のゲーム開始処理
     */
    async _startActualGame() {
        console.log('🎮 Starting actual game...');

        // 1. カードをめくるアニメーションを実行
        await this._animateCardReveal();

        // 2. カードを表向きにする (State更新)
        let newState = await this.setupManager.startGameRevealCards(this.state);
        
        // 3. 先攻プレイヤーが1枚ドローする
        console.log('✍️ First player draws a card...');
        newState = await this.turnManager.handlePlayerDraw(newState);

        // 4. ターン制約をリセット (ドロー以外のもの)
        newState.hasAttachedEnergyThisTurn = false;
        newState.canRetreat = true;
        newState.canPlaySupporter = true;

        // 5. メインフェーズに移行
        newState.phase = GAME_PHASES.PLAYER_MAIN;
        newState.prompt.message = 'あなたのターンです。アクションを選択してください。';

        this._updateState(newState);

        this.view.showMessage('バトル開始！', 'success');
    }

    /**
     * カード公開アニメーション
     */
    async _animateCardReveal() {
        console.log('🎬 Starting card reveal animation...');
        
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
        for (const { element, card } of allPokemonElements) {
            await animationManager.flipCardFaceUp(element, getCardImagePath(card.name_en));
        }
    }

    /**
     * セットアップアニメーション スケジューリング
     */
    _scheduleSetupAnimations() {
        // 重複実行防止
        if (this.setupAnimationsExecuted) {
            console.log('⏭️ Setup animations already executed, skipping');
            return;
        }
        
        console.log('🎬 Scheduling setup animations...');
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
        console.log('🎬 Executing setup animations...');
        
        try {
            // DOM要素の存在確認を強化
            await this._verifyDOMElements();
            
            // 手札のアニメーション
            await this._animateInitialHandDraw();
            
            // Note: CPUの初期ポケモン配置はプレイヤーの操作後に実行
            console.log('ℹ️ Hand animations completed. CPU setup will be triggered by player action.');
            
            // サイドカードアニメーションは配布後に実行（重複防止）
            console.log('ℹ️ Skipping prize card animation - will execute after distribution');
            
            console.log('✅ Setup animations completed');
        } catch (error) {
            console.error('❌ Setup animation error:', error);
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
        
        console.log('🔍 DOM verification:');
        console.log(`  Player hand children: ${playerHand.children.length}`);
        console.log(`  CPU hand children: ${cpuHand.children.length}`);
        
        // 要素が空の場合は少し待ってから再確認
        if (playerHand.children.length === 0 || cpuHand.children.length === 0) {
            console.log('⏳ Waiting for DOM elements to populate...');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log('🔍 DOM re-verification:');
            console.log(`  Player hand children: ${playerHand.children.length}`);
            console.log(`  CPU hand children: ${cpuHand.children.length}`);
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

        // DOMにクラスの削除が反映されるのを待つ
        await this._delay(20); // 非常に短い遅延

        const promises = [];

        if (playerHand) {
            // Select actual card elements inside the hand (skip inner wrapper)
            const playerCards = Array.from(playerHand.querySelectorAll('.relative'));
            console.log(`🎴 Player hand has ${playerCards.length} card elements`);
            
            // 各カード要素の詳細を確認
            playerCards.forEach((card, index) => {
                const img = card.querySelector('img');
                console.log(`  Player card ${index + 1}: img src = ${img ? img.src : 'no img'}, opacity = ${card.style.opacity}`);
            });
            
            if (playerCards.length > 0) {
                promises.push(animationManager.animateInitialPlayerHandDeal(playerCards, 200));
            }
        }

        if (cpuHand) {
            const cpuCards = Array.from(cpuHand.querySelectorAll('.relative'));
            console.log(`🎴 CPU hand has ${cpuCards.length} card elements`);
            
            // 各カード要素の詳細を確認
            cpuCards.forEach((card, index) => {
                const img = card.querySelector('img');
                console.log(`  CPU card ${index + 1}: img src = ${img ? img.src : 'no img'}, opacity = ${card.style.opacity}`);
            });
            
            if (cpuCards.length > 0) {
                promises.push(animationManager.animateInitialHandDeal(cpuCards, 200));
            }
        }

        await Promise.all(promises);
    }

    /**
     * サイドカード配置アニメーション
     */
    async _animatePrizeCardSetup() {
        console.log('🏆 Starting prize card setup animation...');
        
        // 実際にカード要素が入っているスロットの子要素を取得
        const playerPrizeSlots = document.querySelectorAll('.player-self .side-left .card-slot');
        const cpuPrizeSlots = document.querySelectorAll('.opponent-board .side-right .card-slot');

        console.log(`📋 Found ${playerPrizeSlots.length} player prize slots`);
        console.log(`📋 Found ${cpuPrizeSlots.length} CPU prize slots`);

        if (playerPrizeSlots.length === 0 || cpuPrizeSlots.length === 0) {
            console.warn('⚠️ Prize slots not found, skipping animation');
            return;
        }

        const prizeCards = [];
        
        // プレイヤーのサイドカード要素を収集
        playerPrizeSlots.forEach((slot, index) => {
            // カード要素が描画されているかチェック
            const cardElement = slot.querySelector('.relative, .card'); // より広範囲にチェック
            if (cardElement) {
                prizeCards.push(cardElement);
                console.log(`📋 Found player prize card ${index + 1}`);
            } else {
                // カードが未描画の場合、スロット自体をアニメーション対象にする
                console.log(`📋 Using player prize slot ${index + 1} (no card element)`);
                prizeCards.push(slot);
            }
        });
        
        // CPUのサイドカード要素を収集
        cpuPrizeSlots.forEach((slot, index) => {
            const cardElement = slot.querySelector('.relative, .card');
            if (cardElement) {
                prizeCards.push(cardElement);
                console.log(`📋 Found CPU prize card ${index + 1}`);
            } else {
                console.log(`📋 Using CPU prize slot ${index + 1} (no card element)`);
                prizeCards.push(slot);
            }
        });

        console.log(`🏆 Animating ${prizeCards.length} prize elements`);
        
        if (prizeCards.length > 0) {
            await animationManager.animatePrizeDeal(prizeCards, 150);
        } else {
            console.warn('⚠️ No prize elements found for animation');
        }
    }

    // ==================== アニメーション関連メソッド ====================

    /**
     * カード配置アニメーション
     */
    async _animateCardPlacement(cardElement, zone, index) {
        if (!cardElement) return;

        console.log(`🎬 Starting player card placement animation: ${zone}[${index}]`);

        const targetSelector = zone === 'active'
            ? '.player-self .active-bottom'
            : `.player-self .bottom-bench-${index + 1}`;
        const targetElement = document.querySelector(targetSelector);

        if (targetElement) {
            // カードを一時的にハイライト
            cardElement.style.transition = 'all 0.3s ease';
            cardElement.style.transform = 'scale(1.1) rotate(2deg)';
            cardElement.style.zIndex = '100';
            cardElement.style.boxShadow = '0 8px 25px rgba(77, 208, 253, 0.6)';

            // 少し待ってから移動アニメーション
            await new Promise(resolve => setTimeout(resolve, 200));

            const fromRect = cardElement.getBoundingClientRect();
            const toRect = targetElement.getBoundingClientRect();

            const fromPos = { x: fromRect.left, y: fromRect.top };
            const toPos = { x: toRect.left, y: toRect.top };

            // 移動アニメーション実行
            await animationManager.animatePlayCard(cardElement, fromPos, toPos);

            // 配置完了後の効果
            if (targetElement.children.length > 0) {
                const placedCard = targetElement.children[0];
                placedCard.style.transform = 'scale(1.2)';
                placedCard.style.transition = 'transform 0.4s ease';
                
                setTimeout(() => {
                    placedCard.style.transform = 'scale(1)';
                }, 400);
            }

            console.log(`✅ Player card placement animation completed`);
        }
    }

    /**
     * ポケモン昇格アニメーション
     */
    async _animatePokemonPromotion(playerId, benchIndex) {
        // 統一システムを使用（既存のアニメーションマネージャーのsmoothCardMoveを活用）
        const playerClass = playerId === 'player' ? '.player-self' : '.opponent-board';
        const benchSelector = playerId === 'player' ? `.bottom-bench-${benchIndex + 1}` : `.top-bench-${benchIndex + 1}`;
        const activeSelector = playerId === 'player' ? '.active-bottom' : '.active-top';
        
        const benchElement = document.querySelector(`${playerClass} ${benchSelector}`);
        const activeElement = document.querySelector(`${playerClass} ${activeSelector}`);
        
        if (benchElement && activeElement) {
            await animationManager.animateSmoothCardMove(benchElement, benchElement, activeElement, 'normal');
        }
    }

    /**
     * エネルギー付与アニメーション
     */
    async _animateEnergyAttachment(energyId, pokemonId) {
        // 統一システムを使用（既存のアニメーションマネージャーのenergyAttachを活用）
        const energyElement = document.querySelector(`[data-card-id="${energyId}"]`);
        const pokemonElement = document.querySelector(`[data-card-id="${pokemonId}"]`);
        
        if (energyElement && pokemonElement) {
            await animationManager.animateEnergyAttach(energyElement, pokemonElement);
        }
    }

    /**
     * サイドカード取得アニメーション
     */
    async _animatePrizeTake(playerId, prizeIndex) {
        const playerClass = playerId === 'player' ? '.player-self' : '.opponent-board';
        const sideClass = playerId === 'player' ? '.side-left' : '.side-right';
        const prizeElement = document.querySelector(`${playerClass} ${sideClass} .card-slot:nth-child(${prizeIndex + 1})`);
        const handElement = document.getElementById(`${playerId}-hand`);
        
        if (prizeElement && handElement) {
            await animationManager.animateSmoothCardMove(prizeElement, prizeElement, handElement, 'normal');
        }
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
    _highlightEnergyTargets() {
        const playerActive = document.querySelector('.player-self .active-bottom');
        const playerBench = document.querySelectorAll('.player-self [class*="bottom-bench-"]');
        
        if (playerActive) {
            animationManager.highlightSlot(playerActive, 'energy');
        }
        
        playerBench.forEach(slot => {
            if (slot.children.length > 0) {
                animationManager.highlightSlot(slot, 'energy');
            }
        });
    }

    /**
     * ベンチスロットハイライト
     */
    _highlightBenchSlots() {
        const benchSlots = document.querySelectorAll('.player-self [class*="bottom-bench-"]');
        benchSlots.forEach(slot => {
            if (slot.children.length > 0) {
                animationManager.highlightSlot(slot, 'slot');
            }
        });
    }

    /**
     * 全ハイライト解除
     */
    _clearAllHighlights() {
        animationManager.clearAllHighlights();
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

    // ==================== ユーティリティメソッド ====================

    /**
     * 遅延処理
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} // End of Game class