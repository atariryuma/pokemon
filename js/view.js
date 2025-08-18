import { getCardImagePath } from './cards.js';

export class View {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.cardClickHandler = null;

        // Board containers
        this.playerBoard = rootEl.querySelector('.player-board:not(.opponent-board)');
        this.opponentBoard = rootEl.querySelector('.opponent-board');

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
        this._clearBoard();
        this._renderBoard(this.playerBoard, state.players.player, 'player', state);
        this._renderBoard(this.opponentBoard, state.players.cpu, 'cpu', state);
        this._renderHand(this.playerHand, state.players.player.hand, 'player');
        this._renderHand(this.cpuHand, state.players.cpu.hand, 'cpu');
        this._renderStadium(state);
    }

    _clearBoard() {
        const allSlots = document.querySelectorAll('.card-slot');
        allSlots.forEach(slot => {
            slot.innerHTML = '';
        });
        if (this.playerHand) this.playerHand.innerHTML = '';
        if (this.cpuHand) this.cpuHand.innerHTML = '';
    }

    _renderBoard(boardElement, playerState, playerType, state) {
        if (!boardElement) return;

        const safePlayer = playerState || {};
        const bench = Array.isArray(safePlayer.bench) ? safePlayer.bench : new Array(5).fill(null);
        const discard = Array.isArray(safePlayer.discard) ? safePlayer.discard : [];
        const prize = Array.isArray(safePlayer.prize) ? safePlayer.prize.slice(0, 6) : new Array(6).fill(null);

        // Active
        const activeSlotSelector = playerType === 'player' ? '.active-bottom' : '.active-top';
        const activeSlot = boardElement.querySelector(activeSlotSelector);
        if (activeSlot) {
            activeSlot.innerHTML = '';
            activeSlot.appendChild(this._createCardElement(safePlayer.active || null, playerType, 'active', 0));
        }

        // Bench
        for (let i = 0; i < 5; i++) {
            const benchSlotSelector = playerType === 'player' ? `.bottom-bench-${i + 1}` : `.top-bench-${i + 1}`;
            const benchSlot = boardElement.querySelector(benchSlotSelector);
            if (!benchSlot) continue;
            benchSlot.innerHTML = '';
            benchSlot.appendChild(this._createCardElement(bench[i] || null, playerType, 'bench', i));
        }

        // Discard
        const discardSlotSelector = playerType === 'player' ? '.bottom-right-trash' : '.top-left-trash';
        const discardSlot = boardElement.querySelector(discardSlotSelector);
        if (discardSlot) {
            discardSlot.innerHTML = '';
            const topCard = discard.length ? discard[discard.length - 1] : null;
            discardSlot.appendChild(this._createCardElement(topCard, playerType, 'discard', 0));
        }

        // Prizes
        this._renderPrizeArea(boardElement, prize, playerType);

        

        // Deck
        const deckSlotSelector = playerType === 'player' ? '.bottom-right-deck' : '.top-left-deck';
        const deckSlot = boardElement.querySelector(deckSlotSelector);
        if (deckSlot) {
            deckSlot.innerHTML = '';
            const deckArr = Array.isArray(safePlayer.deck) ? safePlayer.deck : [];
            const deckCardEl = this._createCardElement(deckArr[0] || null, playerType, 'deck', 0, true);
            deckSlot.appendChild(deckCardEl);
            if (deckArr.length > 0) {
                const count = document.createElement('div');
                count.className = 'absolute bottom-1 right-1 bg-gray-800 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center';
                count.textContent = deckArr.length;
                deckSlot.appendChild(count);
            }
        }

        
    }

    _renderHand(handElement, hand, playerType) {
        if (!handElement) return;
        const arr = Array.isArray(hand) ? hand : [];
        arr.forEach((card, index) => {
            const isFaceDown = playerType === 'cpu';
            const cardEl = this._createCardElement(card, playerType, 'hand', index, isFaceDown);
            cardEl.classList.add('w-24', 'h-32', 'flex-shrink-0');
            handElement.appendChild(cardEl);
        });
    }

    _renderPrizeArea(boardElement, prize, playerType) {
        const prizeSlotSelectors = [];
        if (playerType === 'player') {
            prizeSlotSelectors.push('.side-left-1', '.side-left-2', '.side-left-3');
        } else {
            prizeSlotSelectors.push('.side-right-1', '.side-right-2', '.side-right-3');
        }

        prizeSlotSelectors.forEach((selector, index) => {
            const prizeEl = boardElement.querySelector(selector);
            if (!prizeEl) return;

            prizeEl.innerHTML = ''; // Clear previous card
            if (index < prize.length && prize[index] !== null) { // Only render if there's a card in the state slot
                const cardEl = this._createCardElement(prize[index], playerType, 'prize', index, true); // true for isFaceDown
                prizeEl.appendChild(cardEl);
            } else {
                // Render a placeholder for empty prize slots
                const placeholder = document.createElement('div');
                placeholder.className = 'card-placeholder w-full h-full flex items-center justify-center text-xs text-gray-500';
                placeholder.textContent = `Prize ${index + 1}`;
                prizeEl.appendChild(placeholder);
            }
        });
    }

    _renderStadium(state) {
        const stadiumEl = document.querySelector('.stadium-zone');
        if (!stadiumEl) return;

        stadiumEl.innerHTML = ''; // Clear previous card
        if (state.stadium) {
            const cardEl = this._createCardElement(state.stadium, 'global', 'stadium', 0);
            stadiumEl.appendChild(cardEl);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'card-placeholder w-full h-full flex items-center justify-center text-xs text-gray-500';
            placeholder.textContent = 'Stadium Zone';
            stadiumEl.appendChild(placeholder);
        }
    }

    _createCardElement(card, playerType, zone, index, isFaceDown = false) {
        const container = document.createElement('div');
        container.className = 'relative w-full h-full';

        if (!card) {
            container.classList.add('card-placeholder');
            return container;
        }

        const img = document.createElement('img');
        img.className = 'card-image';
        img.dataset.dynamic = true;
        img.src = isFaceDown ? 'assets/card_back.webp' : getCardImagePath(card.name_en);
        img.alt = isFaceDown ? 'Card Back' : card.name_ja;

        img.dataset.cardId = card.id;
        img.dataset.owner = playerType;
        img.dataset.zone = zone;
        img.dataset.index = index;

        const clickable = (
            // Face-up cards
            !isFaceDown
            // Player can click own deck to draw
            || (zone === 'deck' && playerType === 'player')
            // Player can click prizes to take
            || (zone === 'prize' && playerType === 'player')
        );
        if (this.cardClickHandler && clickable) {
            img.classList.add('cursor-pointer');
            img.addEventListener('click', (e) => {
                this.cardClickHandler(e.currentTarget.dataset);
            });
        }
        container.appendChild(img);

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
