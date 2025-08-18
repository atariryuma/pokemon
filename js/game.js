import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';

export class Game {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.state = null;
        this.view = null;
    } // End of constructor

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    } // End of _delay

    init() {
        this.state = createInitialState();
        this.view = new View(this.rootEl);
        this.view.bindCardClick(this._handleCardClick.bind(this));
        this._updateState(this.state);
    } // End of init

    _updateState(newState) {
        this.state = newState;
        this.view.render(this.state);
        if (newState.phase === 'game-over') {
            this._handleGameOver(newState.winner);
        }
    } // End of _updateState

    _handleCardClick(dataset) {
        const { owner, zone, index } = dataset;
        if (owner !== 'player') return;

        if (this.state.phase === 'setup') {
            this._handleSetupCardClick(dataset);
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

    _handleSetupCardClick(dataset) {
        const { cardId, zone } = dataset;
        if (zone !== 'hand') return;
        const card = this.state.players.player.hand.find(c => c.id === cardId);
        if (!card || card.card_type !== 'Pokémon' || card.stage !== 'BASIC') return;

        if (!this.state.players.player.active) {
            let newState = Logic.placeCardInActive(this.state, 'player', cardId);
            this._updateState(newState);
            setTimeout(() => this._setupCpu(), 500);
        } else {
            this.view.showModal({
                title: `「${card.name_ja}」をベンチに出しますか？`,
                actions: [{ text: 'はい', callback: () => this._placeOnBench(cardId) }, { text: 'いいえ', callback: () => {} }],
            });
        }
    } // End of _handleSetupCardClick

    _placeOnBench(cardId) {
        const emptyIndex = this.state.players.player.bench.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
            const newState = Logic.placeCardOnBench(this.state, 'player', cardId, emptyIndex);
            this._updateState(newState);
        } else {
            this.view.showModal({ title: 'ベンチが満員です。', actions: [{ text: 'OK', callback: () => {} }] });
        }
    } // End of _placeOnBench

    _setupCpu() {
        let newState = { ...this.state };
        const activeCandidate = newState.players.cpu.hand.find(c => c.card_type === 'Pokémon' && c.stage === 'BASIC');
        if (activeCandidate) {
            newState = Logic.placeCardInActive(newState, 'cpu', activeCandidate.id);
        }
        for (const card of newState.players.cpu.hand) {
            if (card.card_type === 'Pokémon' && card.stage === 'BASIC') {
                const emptyIndex = newState.players.cpu.bench.findIndex(slot => slot === null);
                if (emptyIndex !== -1) {
                    newState = Logic.placeCardOnBench(newState, 'cpu', card.id, emptyIndex);
                }
            }
        }
        newState.phase = 'player-turn';
        newState.prompt.message = 'あなたの番です。山札をクリックしてカードを引いてください。';
        this._updateState(newState);
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

    _handleActivePokemonClick() {
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
} // End of Game class
