import { createInitialState } from './state.js';
import { View } from './view.js';
import * as Logic from './logic.js';

export class Game {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.state = null;
        this.view = null;
    }

    init() {
        this.state = createInitialState();
        this.view = new View(this.rootEl);
        this.view.bindCardClick(this._handleCardClick.bind(this));
        this._updateView();
    }

    _updateState(newState) {
        this.state = newState;
        this._updateView();
    }

    _updateView() {
        this.view.render(this.state);
    }

    _handleCardClick(dataset) {
        const { cardId, owner, zone } = dataset;

        if (this.state.phase === 'setup') {
            this._handleSetupCardClick(cardId, owner, zone);
        }
        // Other phases can be handled here later
    }

    _handleSetupCardClick(cardId, owner, zone) {
        if (owner !== 'player' || zone !== 'hand') return;

        const playerState = this.state.players.player;
        const card = playerState.hand.find(c => c.id === cardId);

        if (!card || card.card_type !== 'Pokémon' || card.stage !== 'BASIC') {
            console.log('Invalid card for setup');
            return;
        }

        // If no active pokemon, the first one must go there.
        if (!playerState.active) {
            const newState = Logic.placeCardInActive(this.state, 'player', cardId);
            this._updateState(newState);
            // TODO: Add logic for CPU setup
        } else {
            // If active is filled, show modal to choose bench
            this.view.showModal({
                title: `「${card.name_ja}」をベンチに出しますか？`,
                actions: [
                    {
                        text: 'はい',
                        callback: () => this._placeOnBench(cardId),
                    },
                    {
                        text: 'いいえ',
                        callback: () => {},
                    },
                ],
            });
        }
    }

    _placeOnBench(cardId) {
        const playerState = this.state.players.player;
        const emptyIndex = playerState.bench.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
            const newState = Logic.placeCardOnBench(this.state, 'player', cardId, emptyIndex);
            this._updateState(newState);
        } else {
            // You could show a message that the bench is full
            console.log('Bench is full');
        }
    }
}