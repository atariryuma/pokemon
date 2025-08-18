import { getCardImagePath } from './cards.js';

export class View {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.cardClickHandler = null;

        // Player elements
        this.playerHand = rootEl.querySelector('#player-hand');
        this.playerActive = rootEl.querySelector('#player-active');
        this.playerBench = rootEl.querySelector('#player-bench');
        this.playerDeck = rootEl.querySelector('#player-deck');
        this.playerDiscard = rootEl.querySelector('#player-discard');
        this.playerPrizes = rootEl.querySelector('#player-prizes');

        // CPU elements
        this.cpuHand = rootEl.querySelector('#cpu-hand');
        this.cpuActive = rootEl.querySelector('#cpu-active');
        this.cpuBench = rootEl.querySelector('#cpu-bench');
        this.cpuDeck = rootEl.querySelector('#cpu-deck');
        this.cpuDiscard = rootEl.querySelector('#cpu-discard');
        this.cpuPrizes = rootEl.querySelector('#cpu-prizes');

        // Modal elements
        this.modal = document.getElementById('action-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');
        this.modalActions = document.getElementById('modal-actions');
    }

    bindCardClick(handler) {
        this.cardClickHandler = handler;
    }

    render(state) {
        this._renderPlayerArea('player', state.players.player);
        this._renderPlayerArea('cpu', state.players.cpu);
        // Render prompt/message
        if (state.prompt && state.prompt.message) {
            // For now, let's use the modal title to display prompts
            this.modalTitle.textContent = state.prompt.message;
        }
    }

    _renderPlayerArea(playerType, playerState) {
        const handEl = playerType === 'player' ? this.playerHand : this.cpuHand;
        const activeEl = playerType === 'player' ? this.playerActive : this.cpuActive;
        const benchEl = playerType === 'player' ? this.playerBench : this.cpuBench;
        const deckEl = playerType === 'player' ? this.playerDeck : this.cpuDeck;
        const discardEl = playerType === 'player' ? this.playerDiscard : this.playerDiscard;
        const prizeEl = playerType === 'player' ? this.playerPrizes : this.cpuPrizes;

        this._renderHand(handEl, playerState.hand, playerType, 'hand');
        this._renderActive(activeEl, playerState.active, playerType, 'active');
        this._renderBench(benchEl, playerState.bench, playerType, 'bench');
        this._renderDeck(deckEl, playerState.deck, playerType, 'deck');
        this._renderDiscard(discardEl, playerState.discard, playerType, 'discard');
        this._renderPrizes(prizeEl, playerState.prize, playerType, 'prize');
    }

    _renderZone(element, cards, playerType, zone, options = {}) {
        element.innerHTML = '';
        const cardArray = Array.isArray(cards) ? cards : [cards];
        
        cardArray.forEach((card, index) => {
            const cardEl = this._createCardElement(card, playerType, zone, index, options.isFaceDown);
            element.appendChild(cardEl);
        });

        // For empty fixed-size zones like bench
        if (options.size && cardArray.length < options.size) {
            for (let i = cardArray.length; i < options.size; i++) {
                element.appendChild(this._createCardElement(null, playerType, zone, i));
            }
        }
    }

    _renderHand(element, hand, playerType, zone) {
        this._renderZone(element, hand, playerType, zone, { isFaceDown: playerType === 'cpu' });
    }

    _renderActive(element, activePokemon, playerType, zone) {
        this._renderZone(element, activePokemon, playerType, zone, { size: 1 });
    }

    _renderBench(element, bench, playerType, zone) {
        this._renderZone(element, bench, playerType, zone, { size: 5 });
    }

    _renderDeck(element, deck, playerType, zone) {
        element.innerHTML = ''; // Clear previous
        if (deck.length > 0) {
            const cardEl = this._createCardElement(deck[0], playerType, zone, 0, true);
            element.appendChild(cardEl);
            const count = document.createElement('div');
            count.className = 'deck-count';
            count.textContent = deck.length;
            element.appendChild(count);
        } else {
            element.appendChild(this._createCardElement(null, playerType, zone, 0));
        }
    }

    _renderDiscard(element, discard, playerType, zone) {
        element.innerHTML = ''; // Clear previous
        if (discard.length > 0) {
            const topCard = discard[discard.length - 1];
            element.appendChild(this._createCardElement(topCard, playerType, zone, discard.length - 1));
        } else {
             element.appendChild(this._createCardElement(null, playerType, zone, 0));
        }
    }

    _renderPrizes(element, prizes, playerType, zone) {
        this._renderZone(element, prizes, playerType, zone, { isFaceDown: true });
    }

    _createCardElement(card, playerType, zone, index, isFaceDown = false) {
        if (card) {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.dataset.cardId = card.id;
            cardEl.dataset.owner = playerType;
            cardEl.dataset.zone = zone;
            cardEl.dataset.index = index;

            const img = document.createElement('img');
            img.src = isFaceDown ? 'assets/card_back.webp' : getCardImagePath(card.name_en);
            img.alt = isFaceDown ? 'Card Back' : card.name_ja;
            cardEl.appendChild(img);

            if (this.cardClickHandler) {
                cardEl.addEventListener('click', (e) => {
                    this.cardClickHandler(e.currentTarget.dataset);
                });
            }
            return cardEl;
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'card-placeholder';
            return placeholder;
        }
    }

    showModal({ title, body, actions }) {
        this.modalTitle.textContent = title;
        this.modalBody.innerHTML = '';
        if (body) {
            this.modalBody.appendChild(body);
        }
        this.modalActions.innerHTML = '';
        actions.forEach(action => {
            const button = document.createElement('button');
            button.textContent = action.text;
            button.addEventListener('click', () => {
                action.callback();
                this.hideModal();
            });
            this.modalActions.appendChild(button);
        });
        this.modal.style.display = 'flex';
    }

    hideModal() {
        this.modal.style.display = 'none';
    }
}