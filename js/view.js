import { getCardImagePath } from './cards.js';

export class View {
    constructor() {
        this.cardClickHandler = null;

        // Board containers
        this.playerBoard = document.querySelector('.player-board:not(.opponent-board)');
        this.opponentBoard = document.querySelector('.opponent-board');

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
        this._renderBoard(this.playerBoard, state.players.player, 'player');
        this._renderBoard(this.opponentBoard, state.players.cpu, 'cpu');

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
            const img = slot.querySelector('img');
            if (img && img.dataset.dynamic) {
                img.remove();
            }
        });
        this.playerHand.innerHTML = '';
        this.cpuHand.innerHTML = '';
    }

    _renderBoard(boardElement, playerState, playerType) {
        // Active Pokemon
        const activeSlot = boardElement.querySelector('.active-pokemon');
        if (playerState.active) {
            activeSlot.appendChild(this._createCardElement(playerState.active, playerType, 'active', 0));
        }

        // Bench Pokemon
        playerState.bench.forEach((card, index) => {
            if (card) {
                const benchSlot = boardElement.querySelector(`.bench-${index + 1}`);
                if (benchSlot) {
                    benchSlot.appendChild(this._createCardElement(card, playerType, 'bench', index));
                }
            }
        });

        // Discard Pile
        const discardSlot = boardElement.querySelector('.discard');
        if (playerState.discard.length > 0) {
            const topCard = playerState.discard[playerState.discard.length - 1];
            discardSlot.appendChild(this._createCardElement(topCard, playerType, 'discard', 0));
        }
    }

    _renderHand(handElement, hand, playerType) {
        hand.forEach((card, index) => {
            const isFaceDown = playerType === 'cpu';
            const cardEl = this._createCardElement(card, playerType, 'hand', index, isFaceDown);
            cardEl.classList.add('w-24', 'h-32', 'flex-shrink-0'); // Tailwind classes for hand cards
            handElement.appendChild(cardEl);
        });
    }

    _createCardElement(card, playerType, zone, index, isFaceDown = false) {
        const img = document.createElement('img');
        img.className = 'card-image';
        img.dataset.dynamic = true; // Mark as dynamically added
        img.src = isFaceDown ? 'assets/card_back.webp' : getCardImagePath(card.name_en);
        img.alt = isFaceDown ? 'Card Back' : card.name_ja;
        
        img.dataset.cardId = card.id;
        img.dataset.owner = playerType;
        img.dataset.zone = zone;
        img.dataset.index = index;

        if (this.cardClickHandler && !isFaceDown) {
            img.classList.add('cursor-pointer');
            img.addEventListener('click', (e) => {
                this.cardClickHandler(e.currentTarget.dataset);
            });
        }
        return img;
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
