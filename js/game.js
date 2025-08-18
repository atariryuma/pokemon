import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';

export class Game {
    constructor() {
        this.state = null;
        this.view = null;
    }

    init() {
        this.state = createInitialState();
        this.view = new View();
        this.view.bindCardClick(this._handleCardClick.bind(this));
        this._updateState(this.state); // Initial render
    }

    _updateState(newState) {
        this.state = newState;
        this.view.render(this.state);
    }

    _handleCardClick(dataset) {
        const { cardId, owner, zone } = dataset;

        if (this.state.phase === 'setup') {
            this._handleSetupCardClick(cardId, owner, zone);
        }
    }

    _handleSetupCardClick(cardId, owner, zone) {
        if (owner !== 'player' || zone !== 'hand') return;

        const card = this.state.players.player.hand.find(c => c.id === cardId);
        if (!card || card.card_type !== 'Pokémon' || card.stage !== 'BASIC') {
            return; // Not a basic pokemon from hand
        }

        // First pokemon must be placed as active
        if (!this.state.players.player.active) {
            let newState = Logic.placeCardInActive(this.state, 'player', cardId);
            this._updateState(newState);
            // Automatically run CPU setup after player places their active pokemon
            setTimeout(() => this._setupCpu(), 500);
        } else {
            // Subsequent pokemon can be placed on the bench
            this.view.showModal({
                title: `「${card.name_ja}」をベンチに出しますか？`,
                actions: [
                    { text: 'はい', callback: () => this._placeOnBench(cardId) },
                    { text: 'いいえ', callback: () => {} },
                ],
            });
        }
    }

    _placeOnBench(cardId) {
        const emptyIndex = this.state.players.player.bench.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
            const newState = Logic.placeCardOnBench(this.state, 'player', cardId, emptyIndex);
            this._updateState(newState);
        } else {
            this.view.showModal({ title: 'ベンチが満員です。', actions: [{ text: 'OK', callback: () => {} }] });
        }
    }

    _setupCpu() {
        let cpuState = this.state.players.cpu;
        let newState = this.state;

        // 1. Find a basic pokemon for the active spot
        const activeCandidate = cpuState.hand.find(c => c.card_type === 'Pokémon' && c.stage === 'BASIC');
        if (activeCandidate) {
            newState = Logic.placeCardInActive(newState, 'cpu', activeCandidate.id);
            cpuState = newState.players.cpu; // Refresh state after update
        }

        // 2. Place other basic pokemon on the bench
        const benchCandidates = cpuState.hand.filter(c => c.card_type === 'Pokémon' && c.stage === 'BASIC');
        benchCandidates.forEach(card => {
            const emptyIndex = cpuState.bench.findIndex(slot => slot === null);
            if (emptyIndex !== -1) {
                newState = Logic.placeCardOnBench(newState, 'cpu', card.id, emptyIndex);
                cpuState = newState.players.cpu; // Refresh state for next iteration
            }
        });

        // 3. Finalize setup and move to player's turn
        newState.phase = 'player-turn';
        newState.prompt.message = 'あなたの番です。カードを引いてください。';
        this._updateState(newState);
    }
}
