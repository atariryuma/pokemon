import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';

export class Game {
    constructor(rootEl, playmatSlotsData) {
        this.rootEl = rootEl;
        this.state = null;
        this.view = null;
        this.playmatSlotsData = playmatSlotsData;
    } // End of constructor

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    } // End of _delay

    init() {
        this.state = createInitialState();
        // Perform initial game setup (shuffle, draw 7, place prizes)
        this.state = Logic.setupGame(this.state); // Call setupGame here to populate hand and prizes

        this.view = new View(this.rootEl);
        this.view.bindCardClick(this._handleCardClick.bind(this));
        this.view.setConfirmSetupButtonHandler(this._handleConfirmSetup.bind(this)); // Bind confirm button

        // Bind action buttons
        this.view.retreatButton.onclick = this._handleRetreat.bind(this);
        this.view.attackButton.onclick = this._handleAttack.bind(this);
        this.view.endTurnButton.onclick = this._endTurn.bind(this); // Bind end turn button

        // Initial game state is 'setup'
        this.state.phase = 'setup';
        this.state.prompt = { message: '手札からたねポケモンをバトル場とベンチに配置してください。' }; // Updated message
        this._updateState(this.state); // Render initial setup state
    } // End of init

    _updateState(newState) {
        this.state = newState;
        this.view.render(this.state); // Always render the board

        // Control UI elements based on phase
        this.view.hideGameMessage(); // Hide message by default
        this.view.hideActionButtons(); // Hide action buttons by default
        this.view.hideSetupOverlay(); // Hide setup overlay by default

        if (newState.phase === 'setup') {
            this.view.showSetupOverlay();
            this.view.showGameMessage(newState.prompt.message);
            // In setup, confirm button should be shown if active is selected
            if (newState.players.player.active) {
                this.view.showActionButtons(['confirm-setup-button']); // Assuming confirm-setup-button is an action button
            }
        } else if (newState.phase === 'player-turn') {
            this.view.showGameMessage(newState.prompt.message);
            this.view.showActionButtons(['retreat-button', 'attack-button', 'end-turn-button']);
        } else if (newState.phase === 'cpu-turn') {
            this.view.showGameMessage(newState.prompt.message);
        } else if (newState.phase === 'game-over') {
            this._handleGameOver(newState.winner);
            this.view.showGameMessage(newState.prompt.message); // Display game over message
        } else if (newState.phase === 'awaiting-new-active') {
            this.view.showGameMessage('新しいバトルポケモンを選んでください。');
        } else if (newState.pendingAction && newState.pendingAction.type === 'attach-energy') {
            this.view.showGameMessage(newState.prompt.message);
        }
    } // End of _updateState

    _handleCardClick(dataset) {
        const { owner, zone, cardId, index } = dataset; // Added cardId and index
        if (owner !== 'player') return;

        if (this.state.phase === 'setup') {
            if (zone === 'hand') {
                // Player clicks a card in hand during setup
                const card = this.state.players.player.hand.find(c => c.id === cardId);
                if (card && card.card_type === 'Pokémon' && card.stage === 'BASIC') {
                    // Highlight the selected card (visual feedback)
                    // For now, just store the card.
                    this.selectedCardForSetup = card;
                    this.view.showGameMessage(`「${card.name_ja}」をバトル場かベンチに配置してください。`);
                } else {
                    this.view.showGameMessage('たねポケモンのみ選択できます。');
                }
            } else if (zone === 'active' || zone === 'bench') {
                // Player clicks an active or bench slot during setup
                if (this.selectedCardForSetup) {
                    const targetIndex = zone === 'bench' ? parseInt(index, 10) : 0; // 0 for active
                    let newState;
                    if (zone === 'active') {
                        newState = Logic.placeCardInActive(this.state, 'player', this.selectedCardForSetup.id);
                    } else { // bench
                        newState = Logic.placeCardOnBench(this.state, 'player', this.selectedCardForSetup.id, targetIndex);
                    }
                    this.selectedCardForSetup = null; // Clear selected card
                    this._updateState(newState);
                    this.view.showGameMessage('次のたねポケモンを選択するか、確定してください。');
                } else {
                    this.view.showGameMessage('手札からたねポケモンを選択してください。');
                }
            }
        } else if (this.state.phase === 'player-turn') {
            this._handlePlayerTurnCardClick(dataset);
        } else if (this.state.phase === 'awaiting-new-active' && zone === 'bench') {
            const newIndex = parseInt(index, 10);
            let newState = Logic.promoteToActive(this.state, 'player', newIndex);
            newState.phase = 'player-turn'; // Return to player's turn
            newState.prompt.message = 'あなたのターンです。';
            this._updateState(newState);
        } else if (this.state.players.player.prizesToTake > 0 && zone === 'prize') {
            const prizeIndex = parseInt(index, 10);
            let newState = Logic.takePrizeCard(this.state, 'player', prizeIndex);
            this._updateState(newState);
            // After taking a prize, if the opponent has no active pokemon, end the turn.
            if (newState.players.cpu.active === null) {
                setTimeout(() => this._endTurn(), 1000);
            }
        }
    } // End of _handleCardClick

    

    _placeOnBench(cardId) {
        const emptyIndex = this.state.players.player.bench.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
            const newState = Logic.placeCardOnBench(this.state, 'player', cardId, emptyIndex);
            this._updateState(newState);
        } else {
            this.view.showModal({ title: 'ベンチが満員です。', actions: [{ text: 'OK', callback: () => {} }] });
        }
    } // End of _placeOnBench

    _setupCpu(currentState) { // Accept currentState as argument
        let newState = { ...currentState }; // Use currentState
        const activeCandidate = newState.players.cpu.hand.find(c => c.card_type === 'Pokémon' && c.stage === 'BASIC');
        if (activeCandidate) {
            newState = Logic.placeCardInActive(newState, 'cpu', activeCandidate.id);
        }
        // Place up to 5 basic Pokemon on bench
        let benchCount = 0;
        for (const card of newState.players.cpu.hand) {
            if (card.card_type === 'Pokémon' && card.stage === 'BASIC' && benchCount < 5) {
                const emptyIndex = newState.players.cpu.bench.findIndex(slot => slot === null);
                if (emptyIndex !== -1) {
                    newState = Logic.placeCardOnBench(newState, 'cpu', card.id, emptyIndex);
                    benchCount++;
                }
            }
        }
        // Do NOT set phase or prompt here, and do NOT call _updateState
        return newState; // Return the modified state
    } // End of _setupCpu

    _handlePlayerTurnCardClick(dataset) {
        const { cardId, zone } = dataset;
        if (this.state.pendingAction) {
            if (this.state.pendingAction.type === 'attach-energy' && (zone === 'active' || zone === 'bench')) {
                this._attachEnergy(this.state.pendingAction.sourceCardId, cardId);
            }
            return;
        }
        if (zone === 'deck') this._playerDrawTurnStartCard();
        else if (zone === 'hand') this._handleHandCardClick(cardId);
        else if (zone === 'active') this._handleActivePokemonClick();
    } // End of _handlePlayerTurnCardClick

    _playerDrawTurnStartCard() {
        if (this.state.hasDrawnThisTurn) {
            this.view.showModal({ title: 'このターンはすでにカードを引いています。', actions: [{ text: 'OK', callback: () => {} }] });
            return;
        }
        let newState = Logic.drawCard(this.state, 'player');
        newState.hasDrawnThisTurn = true;
        newState.prompt.message = 'あなたのターンです。';
        this._updateState(newState);
    } // End of _playerDrawTurnStartCard

    _handleHandCardClick(cardId) {
        const card = this.state.players.player.hand.find(c => c.id === cardId);
        if (!card) return;
        if (card.card_type === 'Pokémon' && card.stage === 'BASIC') {
            this.view.showModal({ title: `「${card.name_ja}」をベンチに出しますか？`, actions: [{ text: 'はい', callback: () => this._placeOnBench(cardId) }, { text: 'いいえ', callback: () => {} }] });
        } else if (card.card_type === 'Basic Energy') {
            if (this.state.hasAttachedEnergyThisTurn) {
                this.view.showModal({ title: 'このターンはすでにエネルギーをつけました。', actions: [{ text: 'OK', callback: () => {} }] });
                return;
            }
            const newState = { ...this.state, pendingAction: { type: 'attach-energy', sourceCardId: cardId }, prompt: { message: 'エネルギーをつけるポケモンを選んでください。' } };
            this._updateState(newState);
        }
    } // End of _handleHandCardClick

    _attachEnergy(energyId, pokemonId) {
        let newState = Logic.attachEnergy(this.state, 'player', energyId, pokemonId);
        newState.pendingAction = null;
        newState.prompt.message = 'あなたのターンです。';
        this._updateState(newState);
    } // End of _attachEnergy

    _handleAttack() {
        const attacker = this.state.players.player.active;
        if (!attacker || !attacker.attacks) return;
        const usableAttacks = attacker.attacks.map((attack, index) => ({ ...attack, index })).filter(attack => Logic.hasEnoughEnergy(attacker, attack));
        if (usableAttacks.length === 0) {
            this.view.showModal({ title: '使えるワザがありません。', actions: [{ text: 'OK', callback: () => {} }] });
            return;
        }
        this.view.showModal({ title: 'どのワザを使いますか？', actions: usableAttacks.map(attack => ({ text: `${attack.name_ja} (${attack.damage || 0})`, callback: () => this._executeAttack(attack.index) })).concat({ text: 'キャンセル', callback: () => {} }) });
    } // End of _handleActivePokemonClick

    _executeAttack(attackIndex) {
        let newState = Logic.performAttack(this.state, 'player', attackIndex);
        newState = Logic.checkForKnockout(newState, 'cpu');
        this._updateState(newState);
        if (newState.phase !== 'awaiting-new-active' && newState.phase !== 'game-over') {
            setTimeout(() => this._endTurn(), 1000);
        }
    } // End of _executeAttack

    _endTurn() {
        let newState = { ...this.state, turnPlayer: 'cpu', phase: 'cpu-turn', hasDrawnThisTurn: false, hasAttachedEnergyThisTurn: false, prompt: { message: '相手のターンです。' } };
        this._updateState(newState);
        setTimeout(() => this._executeCpuTurn(), 1000);
    } // End of _endTurn

    async _executeCpuTurn() {
        console.log('CPU turn starts...');
        let newState = { ...this.state };

        // 1. Promote if active is null
        if (!newState.players.cpu.active) {
            const bench = newState.players.cpu.bench.filter(p => p !== null);
            if (bench.length > 0) {
                const newActiveIndex = newState.players.cpu.bench.findIndex(p => p && p.id === bench[0].id);
                newState = Logic.promoteToActive(newState, 'cpu', newActiveIndex);
                this._updateState(newState);
                await this._delay(1000);
            } else {
                console.log('CPU has no pokemon to promote. Player wins!'); // Win condition
                newState = Logic.checkForWinner(newState); // Check for win condition
                this._updateState(newState);
                return;
            }
        }

        // 2. Draw a card
        newState = Logic.drawCard(newState, 'cpu');
        this._updateState(newState);
        await this._delay(1000);

        // 3. Attach energy if possible
        const cpuState = newState.players.cpu;
        const energyCard = cpuState.hand.find(c => c.card_type === 'Basic Energy');
        const targetPokemon = cpuState.active;
        if (energyCard && targetPokemon && !newState.hasAttachedEnergyThisTurn) {
            newState = Logic.attachEnergy(newState, 'cpu', energyCard.id, targetPokemon.id);
            this._updateState(newState);
            await this._delay(1000);
        }

        // 4. Attack if possible
        const attacker = newState.players.cpu.active;
        if (attacker && attacker.attacks) {
            const usableAttacks = attacker.attacks
                .map((attack, index) => ({ ...attack, index }))
                .filter(attack => Logic.hasEnoughEnergy(attacker, attack));
            
            if (usableAttacks.length > 0) {
                const attackIndex = usableAttacks[0].index; // Simple AI: use the first available attack
                newState = Logic.performAttack(newState, 'cpu', attackIndex);
                newState = Logic.checkForKnockout(newState, 'player');
                this._updateState(newState);
                await this._delay(1000);
            }
        }

        // 5. End CPU turn
        if (newState.phase !== 'awaiting-new-active' && newState.phase !== 'game-over') {
            newState.turnPlayer = 'player';
            newState.phase = 'player-turn';
            newState.prompt.message = 'あなたの番です。山札をクリックしてカードを引いてください。';
            this._updateState(newState);
        }
        console.log('CPU turn ends.');
    } // End of _executeCpuTurn

    _handleGameOver(winner) {
        const winnerText = winner === 'player' ? 'あなたの勝ち！' : '相手の勝ち！';
        this.view.showModal({
            title: 'ゲーム終了！',
            body: `<p class="text-xl">${winnerText}</p>`,
            actions: [
                { text: 'もう一度プレイ', callback: () => this.init() },
            ],
        });
    } // End of _handleGameOver

    _handleRetreat() {
        if (this.state.turnPlayer !== 'player') return; // Only player can retreat

        const activePokemon = this.state.players.player.active;
        if (!activePokemon) {
            this.view.showGameMessage('バトル場にポケモンがいません。');
            return;
        }

        // Check if retreat is allowed (e.g., once per turn)
        // Assuming state.canRetreat is managed by Logic
        if (!this.state.canRetreat) {
            this.view.showGameMessage('このターンはすでににげました。');
            return;
        }

        // Check retreat cost
        // Assuming activePokemon.retreat_cost is available
        if (activePokemon.retreat_cost === 0) {
            // Free retreat, just prompt to choose bench
            this.view.showGameMessage('にげるポケモンを選択してください。');
            // Set a pending action to promote a bench Pokemon
            let newState = { ...this.state, pendingAction: { type: 'retreat-promote' } };
            this._updateState(newState);
            return;
        }

        // For now, a simplified retreat: just check if enough energy is attached
        // A proper implementation would require selecting energy to discard
        const attachedEnergyCount = activePokemon.attached_energy ? activePokemon.attached_energy.length : 0;
        if (attachedEnergyCount < activePokemon.retreat_cost) {
            this.view.showGameMessage('にげるためのエネルギーが足りません。');
            return;
        }

        this.view.showModal({
            title: 'にげますか？',
            body: `<p>バトル場の「${activePokemon.name_ja}」をにがします。ベンチポケモンを選択してください。</p>`,
            actions: [
                { text: 'はい', callback: () => {
                    // Set a pending action to promote a bench Pokemon
                    let newState = { ...this.state, pendingAction: { type: 'retreat-promote' } };
                    this._updateState(newState);
                    this.view.showGameMessage('にげるポケモンを選択してください。');
                }},
                { text: 'いいえ', callback: () => {} }
            ]
        });
    }

    _handleConfirmSetup() {
        // Check if active Pokemon is selected
        if (!this.state.players.player.active) {
            this.view.showGameMessage('バトル場にたねポケモンを配置してください。');
            return;
        }

        this.view.hideSetupOverlay(); // Hide the setup overlay

        // Set up CPU's initial Pokemon
        let newState = this._setupCpu(this.state); // Pass the current state to _setupCpu

        // Transition to player turn
        newState.phase = 'player-turn';
        newState.prompt = { message: 'あなたの番です。山札をクリックしてカードを引いてください。' };
        this._updateState(newState);
    }
} // End of Game class
