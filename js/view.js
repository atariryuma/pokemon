import { getCardImagePath } from './cards.js';

export class View {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.cardClickHandler = null;

        // Board containers
        this.playerBoard = rootEl.querySelector('.player-board:not(.opponent-board)');
        this.opponentBoard = rootEl.querySelector('.opponent-board');

        console.log('View constructor - rootEl:', rootEl);
        console.log('View constructor - playerBoard:', this.playerBoard);
        console.log('View constructor - opponentBoard:', this.opponentBoard);

        // Hand containers
        this.playerHand = document.getElementById('player-hand');
        this.cpuHand = document.getElementById('cpu-hand');

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
        // Clear everything first
        this._clearBoard();

        // Render boards
        this._renderBoard(this.playerBoard, state.players.player, 'player', state);
        this._renderBoard(this.opponentBoard, state.players.cpu, 'cpu', state);

        // Render hands
        this._renderHand(this.playerHand, state.players.player.hand, 'player');
        this._renderHand(this.cpuHand, state.players.cpu.hand, 'cpu');

        // Render prompt
        if (state.prompt && state.prompt.message) {
            // For now, just log it. Modal will be used for actions.
            console.log('Prompt:', state.prompt.message);
        }
    }

    _clearBoard() {
        const allSlots = document.querySelectorAll('.card-slot');
        allSlots.forEach(slot => {
            // Remove dynamically added card containers
            const container = slot.querySelector('.relative');
            if (container) {
                container.remove();
            }
        });
        this.playerHand.innerHTML = '';
        this.cpuHand.innerHTML = '';
    }

    _renderBoard(boardElement, playerState, playerType, state) {
        if (!boardElement) return;

        const safePlayer = playerState || {};
        const bench = Array.isArray(safePlayer.bench) ? safePlayer.bench : new Array(5).fill(null);
        const discard = Array.isArray(safePlayer.discard) ? safePlayer.discard : [];
        const prize = Array.isArray(safePlayer.prize) ? safePlayer.prize.slice(0, 6) : new Array(6).fill(null);

        // Active Pokemon
        const activeSlot = boardElement.querySelector('.active-pokemon');
        if (activeSlot) {
            activeSlot.innerHTML = '';
            if (safePlayer.active) {
                activeSlot.appendChild(this._createCardElement(safePlayer.active, playerType, 'active', 0));
            } else {
                activeSlot.appendChild(this._createCardElement(null, playerType, 'active', 0));
            }
        }

        // Bench Pokemon (guard missing slots)
        for (let i = 0; i < 5; i++) {
            const benchSlot = boardElement.querySelector(`.bench-${i + 1}`);
            if (!benchSlot) continue;
            benchSlot.innerHTML = '';
            const card = bench[i];
            benchSlot.appendChild(this._createCardElement(card, playerType, 'bench', i));
        }

        // Discard Pile
        const discardSlot = boardElement.querySelector('.discard');
        if (discardSlot) {
            discardSlot.innerHTML = '';
            if (discard.length > 0) {
                const topCard = discard[discard.length - 1];
                discardSlot.appendChild(this._createCardElement(topCard, playerType, 'discard', 0));
            } else {
                discardSlot.appendChild(this._createCardElement(null, playerType, 'discard', 0));
            }
        }

        // Prize Cards
        const prizeContainer = boardElement.querySelector('.prizes');
        if (prizeContainer) {
            prizeContainer.innerHTML = '';
            const six = [...prize, ...new Array(Math.max(0, 6 - prize.length)).fill(null)].slice(0, 6);
            six.forEach((card, index) => {
                const isFaceDown = !!card; // keep facedown visual for existing prizes
                const el = this._createCardElement(card, playerType, 'prize', index, isFaceDown);
                el.style.position = 'absolute';
                el.style.top = `${index * 10}px`;
                el.style.left = `${index * 5}px`;
                prizeContainer.appendChild(el);
            });
        }

        // Deck
        const deckSlot = boardElement.querySelector('.deck');
        if (deckSlot) {
            deckSlot.innerHTML = '';
            const deckArr = Array.isArray(safePlayer.deck) ? safePlayer.deck : [];
            if (deckArr.length > 0) {
                const deckCardEl = this._createCardElement(deckArr[0], playerType, 'deck', 0, true);
                deckSlot.appendChild(deckCardEl);
                const count = document.createElement('div');
                count.className = 'absolute bottom-1 right-1 bg-gray-800 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center';
                count.textContent = deckArr.length;
                deckSlot.appendChild(count);
            } else {
                deckSlot.appendChild(this._createCardElement(null, playerType, 'deck', 0));
            }
        }

        // Stadium (only render once in the center field)
        if (playerType === 'player') {
            const stadiumSlot = document.querySelector('.stadium-slot');
            if (stadiumSlot) {
                stadiumSlot.innerHTML = '';
                if (state && state.stadium) {
                    stadiumSlot.appendChild(this._createCardElement(state.stadium, 'global', 'stadium', 0));
                } else {
                    stadiumSlot.appendChild(this._createCardElement(null, 'global', 'stadium', 0));
                }
            }
        }
    } // End of _renderBoard

    _renderHand(handElement, hand, playerType) {
        if (!handElement) return;
        const arr = Array.isArray(hand) ? hand : [];
        arr.forEach((card, index) => {
            const isFaceDown = playerType === 'cpu';
            const cardEl = this._createCardElement(card, playerType, 'hand', index, isFaceDown);
            cardEl.classList.add('w-24', 'h-32', 'flex-shrink-0'); // Tailwind classes for hand cards
            handElement.appendChild(cardEl);
        });
    }

    _createCardElement(card, playerType, zone, index, isFaceDown = false) {
        const container = document.createElement('div');
        container.className = 'relative w-full h-full'; // Positioning context

        if (!card) {
            container.classList.add('card-placeholder');
            return container;
        }

        const img = document.createElement('img');
        img.className = 'card-image';
        img.dataset.dynamic = true; // Mark as dynamically added
        img.src = isFaceDown ? 'assets/card_back.webp' : getCardImagePath(card.name_en);
        img.alt = isFaceDown ? 'Card Back' : card.name_ja;
        
        img.dataset.cardId = card.id;
        img.dataset.owner = playerType;
        img.dataset.zone = zone;
        img.dataset.index = index;

        if (this.cardClickHandler && (!isFaceDown || (zone === 'prize' && playerType === 'player'))) {
            img.classList.add('cursor-pointer');
            img.addEventListener('click', (e) => {
                this.cardClickHandler(e.currentTarget.dataset);
            });
        }
        container.appendChild(img);

        // Add damage counter if needed
        if (card.damage > 0) {
            const damageCounter = document.createElement('div');
            damageCounter.className = 'absolute top-1 right-1 bg-red-600 text-white text-lg font-bold rounded-full w-8 h-8 flex items-center justify-center';
            damageCounter.textContent = card.damage;
            container.appendChild(damageCounter);
        }

        return container;
    }

    showModal({ title, body, actions }) {
        this.modalTitle.textContent = title;
        this.modalBody.innerHTML = body || '';
        this.modalActions.innerHTML = '';
        actions.forEach(action => {
            const button = document.createElement('button');
            button.textContent = action.text;
            button.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
            button.addEventListener('click', () => {
                action.callback();
                this.hideModal();
            });
            this.modalActions.appendChild(button);
        });
        this.modal.classList.remove('hidden');
    }

    hideModal() {
        this.modal.classList.add('hidden');
    }
}
