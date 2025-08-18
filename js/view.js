import { getCardImagePath } from './cards.js';

export class View {
    constructor(rootEl, playmatSlotsData) {
        this.rootEl = rootEl;
        this.cardClickHandler = null;
        this.playmatSlotsData = playmatSlotsData;

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

        // Clear all existing cards from the boardElement (playerBoard or opponentBoard)
        // This is a more general clear than clearing individual slots.
        // We will re-add all cards directly to boardElement.
        boardElement.innerHTML = '';

        // Get relevant slot data based on playerType
        const namedSlots = this.playmatSlotsData.slots_named;
        const findSlot = (name) => namedSlots.find(s => s.name === name);
        const rectFromSlot = (slot) => ({ x: slot.bbox.x_min, y: slot.bbox.y_min, width: slot.size.width, height: slot.size.height });

        // Active Pokemon
        if (safePlayer.active) {
            const activeSlotName = playerType === 'player' ? 'active_bottom' : 'active_top';
            const activeCoords = rectFromSlot(findSlot(activeSlotName));
            const activeCardEl = this._createCardElement(safePlayer.active, playerType, 'active', 0, activeCoords);
            boardElement.appendChild(activeCardEl);
        } else {
            // Render placeholder for active slot
            const activeSlotName = playerType === 'player' ? 'active_bottom' : 'active_top';
            const activeCoords = rectFromSlot(findSlot(activeSlotName));
            const activeCardEl = this._createCardElement(null, playerType, 'active', 0, activeCoords);
            boardElement.appendChild(activeCardEl);
        }

        // Bench Pokemon
        for (let i = 0; i < 5; i++) {
            const benchSlotName = playerType === 'player' ? `bottom_bench_${i + 1}` : `top_bench_${i + 1}`;
            const benchCoords = rectFromSlot(findSlot(benchSlotName));
            const card = bench[i];
            const benchCardEl = this._createCardElement(card, playerType, 'bench', i, benchCoords);
            boardElement.appendChild(benchCardEl);
        }

        // Discard Pile
        if (discard.length > 0) {
            const discardSlotName = playerType === 'player' ? 'bottom_right_trash' : 'top_left_trash';
            const discardCoords = rectFromSlot(findSlot(discardSlotName));
            const topCard = discard[discard.length - 1];
            const discardCardEl = this._createCardElement(topCard, playerType, 'discard', 0, discardCoords);
            boardElement.appendChild(discardCardEl);
        } else {
            // Render placeholder for discard slot
            const discardSlotName = playerType === 'player' ? 'bottom_right_trash' : 'top_left_trash';
            const discardCoords = rectFromSlot(findSlot(discardSlotName));
            const discardCardEl = this._createCardElement(null, playerType, 'discard', 0, discardCoords);
            boardElement.appendChild(discardCardEl);
        }

        // Prize Cards (simplified for direct positioning)
        const prizeSlotNames = playerType === 'player' ? ['side_left_1', 'side_left_2', 'side_left_3'] : ['side_right_1', 'side_right_2', 'side_right_3'];
        const six = [...prize, ...new Array(Math.max(0, 6 - prize.length)).fill(null)].slice(0, 6);

        for (let i = 0; i < 3; i++) { // Render first 3 prizes directly
            const prizeCoords = rectFromSlot(findSlot(prizeSlotNames[i]));
            const prizeCardEl = this._createCardElement(six[i], playerType, 'prize', i, prizeCoords, !!six[i]);
            boardElement.appendChild(prizeCardEl);
        }
        // For the remaining 3 prizes, we'll just render placeholders for now,
        // as their exact stacking position is complex and not critical for initial display.
        for (let i = 3; i < 6; i++) {
            const prizeCoords = rectFromSlot(findSlot(prizeSlotNames[i % 3])); // Use existing slot coords for placeholders
            const prizeCardEl = this._createCardElement(null, playerType, 'prize', i, prizeCoords);
            boardElement.appendChild(prizeCardEl);
        }


        // Deck
        const deckSlotName = playerType === 'player' ? 'bottom_right_deck' : 'top_left_deck';
        const deckCoords = rectFromSlot(findSlot(deckSlotName));
        const deckArr = Array.isArray(safePlayer.deck) ? safePlayer.deck : [];
        if (deckArr.length > 0) {
            const deckCardEl = this._createCardElement(deckArr[0], playerType, 'deck', 0, deckCoords, true);
            boardElement.appendChild(deckCardEl);
            const count = document.createElement('div');
            count.className = 'absolute bottom-1 right-1 bg-gray-800 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center';
            count.textContent = deckArr.length;
            deckCardEl.appendChild(count); // Append count to the card element itself
        } else {
            const deckCardEl = this._createCardElement(null, playerType, 'deck', 0, deckCoords);
            boardElement.appendChild(deckCardEl);
        }

        // Stadium (only render once in the center field, directly to rootEl)
        if (playerType === 'player') {
            const stadiumCoords = rectFromSlot(findSlot('stadium'));
            if (state && state.stadium) {
                const stadiumCardEl = this._createCardElement(state.stadium, 'global', 'stadium', 0, stadiumCoords);
                this.rootEl.appendChild(stadiumCardEl); // Append to rootEl (game-board)
            } else {
                const stadiumCardEl = this._createCardElement(null, 'global', 'stadium', 0, stadiumCoords);
                this.rootEl.appendChild(stadiumCardEl); // Append to rootEl (game-board)
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

    _createCardElement(card, playerType, zone, index, coords, isFaceDown = false) { // Added coords parameter
        const container = document.createElement('div');
        // Remove original className, apply positioning directly
        // container.className = 'relative w-full h-full'; // Removed

        // Apply coordinates if provided (for playmat cards)
        if (coords) {
            container.style.position = 'absolute';
            container.style.left = `${coords.x}px`;
            container.style.top = `${coords.y}px`;
            container.style.width = `${coords.width}px`;
            container.style.height = `${coords.height}px`;
        } else {
            // For hand cards, keep original styling
            container.className = 'relative w-full h-full';
        }

        if (!card) {
            container.classList.add('card-placeholder');
            return container;
        }

        const img = document.createElement('img');
        img.className = 'card-image';
        img.dataset.dynamic = true; // Mark as dynamically added
        img.src = isFaceDown ? 'assets/card_back.webp' : getCardImagePath(card.name_en);
        img.alt = isFaceDown ? 'Card Back' : card.name_ja;
        
        // Ensure image fills its container, regardless of container's positioning
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.width = '100%';
        img.style.height = '100%';

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
