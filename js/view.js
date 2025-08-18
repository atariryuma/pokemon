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

        // Game Message Display
        this.gameMessageDisplay = document.getElementById('game-message-display');

        // Action Buttons
        this.retreatButton = document.getElementById('retreat-button');
        this.attackButton = document.getElementById('attack-button');
        this.endTurnButton = document.getElementById('end-turn-button');

        // Setup Overlay
        this.setupOverlay = document.getElementById('setup-overlay');
        this.confirmSetupButton = document.getElementById('confirm-setup-button');
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
        const activeSlot = boardElement.querySelector('.active-pokemon');
        if (activeSlot) {
            activeSlot.innerHTML = '';
            activeSlot.appendChild(this._createCardElement(safePlayer.active || null, playerType, 'active', 0));
        }

        // Bench
        for (let i = 0; i < 5; i++) {
            const benchSlot = boardElement.querySelector(`.bench-${i + 1}`);
            if (!benchSlot) continue;
            benchSlot.innerHTML = '';
            benchSlot.appendChild(this._createCardElement(bench[i] || null, playerType, 'bench', i));
        }

        // Discard
        const discardSlot = boardElement.querySelector('.discard');
        if (discardSlot) {
            discardSlot.innerHTML = '';
            const topCard = discard.length ? discard[discard.length - 1] : null;
            discardSlot.appendChild(this._createCardElement(topCard, playerType, 'discard', 0));
        }

        // Prizes
        this._renderPrizeArea(boardElement, prize, playerType);

        

        // Deck
        const deckSlot = boardElement.querySelector('.deck');
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
        const prizeContainer = boardElement.querySelector('.prizes');
        if (!prizeContainer) return;
        prizeContainer.innerHTML = '';
        prizeContainer.style.position = 'relative';
        const six = Array.isArray(prize) ? prize.slice(0, 6) : new Array(6).fill(null);
        const rowTopPct = [0, 34, 68];
        const backOffset = { x: -5, y: 6 };
        for (let row = 0; row < 3; row++) {
            const frontIdx = row;
            const frontEl = this._createCardElement(six[frontIdx], playerType, 'prize', frontIdx, true);
            frontEl.style.position = 'absolute';
            frontEl.style.left = '0%';
            frontEl.style.top = `${rowTopPct[row]}%`;
            frontEl.style.width = '100%';
            frontEl.style.height = 'auto';
            frontEl.style.aspectRatio = '120 / 168';
            frontEl.style.zIndex = '10';
            prizeContainer.appendChild(frontEl);

            const backIdx = row + 3;
            const backEl = this._createCardElement(six[backIdx], playerType, 'prize', backIdx, true);
            backEl.style.position = 'absolute';
            backEl.style.left = '0%';
            backEl.style.top = `${rowTopPct[row]}%`;
            backEl.style.width = '100%';
            backEl.style.height = 'auto';
            backEl.style.aspectRatio = '120 / 168';
            backEl.style.zIndex = '5';
            backEl.style.transform = `translate(${backOffset.x}%, ${backOffset.y}%)`;
            prizeContainer.appendChild(backEl);
        }
    }

    _renderStadium(state) {
        const stadiumEl = document.querySelector('.stadium-slot');
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

    // Game Message Display
    showGameMessage(message) {
        if (this.gameMessageDisplay) {
            this.gameMessageDisplay.textContent = message;
            this.gameMessageDisplay.classList.remove('hidden');
        }
    }

    hideGameMessage() {
        if (this.gameMessageDisplay) {
            this.gameMessageDisplay.classList.add('hidden');
        }
    }

    // Action Buttons
    showActionButtons(buttonsToShow = []) {
        const allButtons = [
            this.retreatButton,
            this.attackButton,
            this.endTurnButton,
            this.confirmSetupButton
        ];
        allButtons.forEach(button => {
            if (button) {
                button.classList.add('hidden'); // Hide all first
            }
        });

        buttonsToShow.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.classList.remove('hidden');
            }
        });
    }

    hideActionButtons() {
        const allButtons = [
            this.retreatButton,
            this.attackButton,
            this.endTurnButton,
            this.confirmSetupButton
        ];
        allButtons.forEach(button => {
            if (button) {
                button.classList.add('hidden');
            }
        });
    }

    // Setup Overlay
    showSetupOverlay() {
        if (this.setupOverlay) {
            this.setupOverlay.classList.remove('hidden');
        }
    }

    hideSetupOverlay() {
        if (this.setupOverlay) {
            this.setupOverlay.classList.add('hidden');
        }
    }

    setConfirmSetupButtonHandler(handler) {
        if (this.confirmSetupButton) {
            this.confirmSetupButton.onclick = handler;
        }
    }
}
