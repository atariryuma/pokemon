import { getCardImagePath } from './cards.js';
import { animationManager } from './animations.js';

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

        // Game Status Panel
        this.statusPanel = document.getElementById('game-status-panel');
        this.statusTitle = document.getElementById('status-title');
        this.statusMessage = document.getElementById('status-message');
        this.phaseIndicator = document.getElementById('phase-indicator');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.currentPlayer = document.getElementById('current-player');
        this.confirmSetupButton = document.getElementById('confirm-initial-pokemon-button');
        this.initialPokemonSelectionUI = document.getElementById('initial-pokemon-selection');
        
        // Setup Progress Elements
        this.activeStatus = document.getElementById('active-status');
        this.benchStatus = document.getElementById('bench-status');
        this.benchCount = document.getElementById('bench-count');
        this.setupProgress = document.getElementById('setup-progress');
    }

    bindCardClick(handler) {
        this.cardClickHandler = handler;
    }

    render(state) {
        console.log('🎨 View.render() started');
        console.log('📊 Player hand:', state.players.player.hand.length, 'cards');
        console.log('📊 Player active:', state.players.player.active?.name_ja || 'None');
        console.log('📊 CPU hand:', state.players.cpu.hand.length, 'cards');
        console.log('📊 CPU active:', state.players.cpu.active?.name_ja || 'None');
        
        this._clearBoard();
        this._renderBoard(this.playerBoard, state.players.player, 'player', state);
        this._renderBoard(this.opponentBoard, state.players.cpu, 'cpu', state);
        this._renderHand(this.playerHand, state.players.player.hand, 'player');
        this._renderHand(this.cpuHand, state.players.cpu.hand, 'cpu');
        this._renderStadium(state);
        
        console.log('✅ View.render() completed');
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

        // Active - HTMLのクラス名に合わせて修正
        const activeSelector = playerType === 'player' ? '.active-bottom' : '.active-top';
        const activeSlot = boardElement.querySelector(activeSelector);
        if (activeSlot) {
            activeSlot.innerHTML = '';
            const cardEl = this._createCardElement(safePlayer.active || null, playerType, 'active', 0);
            activeSlot.appendChild(cardEl);
            
            // セットアップ中はアクティブスロットをクリック可能にする
            if (playerType === 'player') {
                activeSlot.style.zIndex = '10'; // Above base layer
                activeSlot.classList.add('setup-interactive');
                this._makeSlotClickable(activeSlot, 'active', 0);
            }
        }

        // Bench - HTMLのクラス名に合わせて修正
        for (let i = 0; i < 5; i++) {
            const benchPrefix = playerType === 'player' ? 'bottom-bench' : 'top-bench';
            const benchSlot = boardElement.querySelector(`.${benchPrefix}-${i + 1}`);
            if (!benchSlot) continue;
            benchSlot.innerHTML = '';
            const cardEl = this._createCardElement(bench[i] || null, playerType, 'bench', i);
            benchSlot.appendChild(cardEl);
            
            // セットアップ中はベンチスロットをクリック可能にする
            if (playerType === 'player') {
                benchSlot.style.zIndex = '10'; // Above base layer
                benchSlot.classList.add('setup-interactive');
                this._makeSlotClickable(benchSlot, 'bench', i);
            }
        }

        // Discard - HTMLのクラス名に合わせて修正
        const discardSelector = playerType === 'player' ? '.bottom-right-trash' : '.top-left-trash';
        const discardSlot = boardElement.querySelector(discardSelector);
        if (discardSlot) {
            discardSlot.innerHTML = '';
            const topCard = discard.length ? discard[discard.length - 1] : null;
            discardSlot.appendChild(this._createCardElement(topCard, playerType, 'discard', 0));
        }

        // Prizes
        this._renderPrizeArea(boardElement, prize, playerType);

        // Deck - HTMLのクラス名に合わせて修正
        const deckSelector = playerType === 'player' ? '.bottom-right-deck' : '.top-left-deck';
        const deckSlot = boardElement.querySelector(deckSelector);
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
        
        console.log(`🃏 Rendering ${arr.length} cards for ${playerType} hand`);
        
        arr.forEach((card, index) => {
            const isFaceDown = playerType === 'cpu';
            const cardEl = this._createCardElement(card, playerType, 'hand', index, isFaceDown);
            cardEl.classList.add('w-24', 'h-32', 'flex-shrink-0');
            
            // 確実にカード要素が表示されるよう設定
            cardEl.style.opacity = '1';
            cardEl.style.visibility = 'visible';
            cardEl.style.display = 'flex';
            cardEl.style.zIndex = '101'; // Make sure hand cards are above the overlay
            cardEl.style.position = 'relative';
            
            handElement.appendChild(cardEl);
            
            console.log(`  📋 Added card ${index + 1}/${arr.length} to ${playerType} hand`);
        });
        
        // DOM挿入後の強制再描画
        if (handElement.children.length > 0) {
            // Force reflow
            handElement.offsetHeight;
            console.log(`✅ ${playerType} hand rendering completed: ${handElement.children.length} elements`);
        }
    }

    _renderPrizeArea(boardElement, prize, playerType) {
        // HTMLの実際の構造に合わせて修正
        const prizeContainerSelector = playerType === 'player' ? '.side-left' : '.side-right';
        const prizeContainer = boardElement.querySelector(prizeContainerSelector);
        
        if (!prizeContainer) {
            console.warn(`Prize container not found: ${prizeContainerSelector}`);
            return;
        }
        
        console.log(`🏆 Rendering ${prize.length} prize cards for ${playerType} in ${prizeContainerSelector}`);
        
        // 各カードスロットにカードを配置
        const prizeSlots = prizeContainer.querySelectorAll('.card-slot');
        const six = Array.isArray(prize) ? prize.slice(0, 6) : new Array(6).fill(null);
        
        prizeSlots.forEach((slot, index) => {
            slot.innerHTML = ''; // 既存内容をクリア
            
            if (index < six.length) {
                const card = six[index];
                const cardEl = this._createCardElement(card, playerType, 'prize', index, true); // 裏向き
                
                // カード要素のサイズを調整
                cardEl.style.width = '100%';
                cardEl.style.height = '100%';
                
                slot.appendChild(cardEl);
                console.log(`  🃏 Prize card ${index + 1} added to slot`);
            }
        });
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
        container.style.transformStyle = 'preserve-3d'; // Add this for 3D transforms

        if (!card) {
            container.classList.add('card-placeholder');
            return container;
        }

        // Debug logging for card creation
        console.log(`🎨 Creating card element: ${card.name_ja} (${card.name_en}) for ${playerType} ${zone}${index !== undefined ? `[${index}]` : ''}`);
        console.log(`🖼️ Image path: ${isFaceDown ? 'assets/card_back.webp' : getCardImagePath(card.name_en)}`);

        const img = document.createElement('img');
        // Ensure proper CSS classes for visibility and sizing
        img.className = 'card-image w-full h-full object-contain rounded-lg'; // Change object-cover to object-contain
        img.style.aspectRatio = '74 / 103'; // Enforce aspect ratio
        img.dataset.dynamic = true;
        img.src = isFaceDown ? 'assets/card_back.webp' : getCardImagePath(card.name_en);
        img.alt = isFaceDown ? 'Card Back' : card.name_ja;
        
        // CPUカードの向きを反転（手札とモーダル表示時以外）
        if (playerType === 'cpu' && zone !== 'hand' && zone !== 'modal') {
            img.style.transform = 'rotateX(180deg)';
            img.style.pointerEvents = 'auto'; // Explicitly ensure pointer events are enabled
        }
        
        // Add error handling for image loading failures
        img.onerror = function() {
            console.error(`❌ Failed to load image: ${this.src}`);
            // Fallback to card back if image fails to load
            this.src = 'assets/card_back.webp';
        };
        
        // 確実にカードが表示されるよう初期状態を設定
        img.style.opacity = '1';
        img.style.visibility = 'visible';
        img.style.display = 'block';
        
        // 画像読み込み完了の確認
        img.onload = function() {
            console.log(`✅ Card image loaded: ${this.src}`);
            // 強制的に表示状態を保証
            this.style.opacity = '1';
            this.style.visibility = 'visible';
            this.style.display = 'block';
        };

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

        // Show card details on right-click for face-up cards
        if (!isFaceDown) {
            img.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showCardInfo(card, e.currentTarget);
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

    /**
     * Show detailed card information in a side panel next to the card.
     * @param {Object} card - カードデータ
     * @param {HTMLElement} targetElement - 参照するカード要素
     */
    showCardInfo(card, targetElement) {
        if (!card) return;

        const panel = document.getElementById('card-info-panel');
        if (!panel) return;

        // Clear previous content and add base classes
        panel.innerHTML = '';
        panel.className = 'fixed z-50 p-4 rounded-lg shadow-xl transition-all duration-300 ease-out transform scale-95 opacity-0'; // Base classes for animation and styling

        // Create the close button
        const closeButton = document.createElement('button');
        closeButton.className = 'absolute top-2 right-2 text-gray-400 hover:text-white text-2xl font-bold leading-none focus:outline-none';
        closeButton.innerHTML = '&times;'; // '×' character
        closeButton.onclick = () => this.hideCardInfo();
        panel.appendChild(closeButton);

        // Create the main content container with two columns
        const contentContainer = document.createElement('div');
        contentContainer.className = 'flex flex-row gap-4 items-start'; // Use flexbox for two columns

        // Left column: Card Image (increased width)
        const imageColumn = document.createElement('div');
        imageColumn.className = 'flex-shrink-0 w-64 h-auto'; // Increased width for image
        const cardImage = document.createElement('img');
        cardImage.src = getCardImagePath(card.name_en);
        cardImage.alt = card.name_ja;
        cardImage.className = 'w-full h-auto rounded-md border border-gray-700';
        imageColumn.appendChild(cardImage);
        contentContainer.appendChild(imageColumn);

        // Right column: Card Details
        const detailsColumn = document.createElement('div');
        detailsColumn.className = 'flex-grow text-left text-sm space-y-2';
        detailsColumn.innerHTML = this._generateCardInfoHtml(card);
        contentContainer.appendChild(detailsColumn);

        panel.appendChild(contentContainer);

        // Always center the panel
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.width = '600px'; // Set a fixed width for the modal

        // Apply "e-sports" styling
        panel.style.background = 'linear-gradient(135deg, rgba(20, 20, 40, 0.98), rgba(10, 10, 20, 0.98))';
        panel.style.borderColor = '#4dd0fd'; // Accent color
        panel.style.boxShadow = '0 0 30px rgba(77, 208, 253, 0.6)'; // Glow effect
        panel.style.color = '#e0e0e0'; // Light gray text
        panel.style.fontFamily = '"Inter", sans-serif'; // Modern font

        // Show with animation
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }

    hideCardInfo() {
        const panel = document.getElementById('card-info-panel');
        if (panel) {
            // Animate out
            panel.classList.remove('opacity-100', 'scale-100');
            panel.classList.add('opacity-0', 'scale-95');
            // Hide after animation
            setTimeout(() => {
                panel.classList.add('hidden');
            }, 300); // Match transition duration
        }
    }

    _generateCardInfoHtml(card) {
        let html = `<h3 class="text-xl font-bold text-white mb-2">${card.name_ja} <span class="text-gray-400 text-sm">(${card.name_en})</span></h3>`;
        html += `<p class="text-gray-300 mb-3">カードタイプ: <span class="font-semibold text-blue-300">${card.card_type}</span></p>`;

        if (card.card_type === 'Pokemon') {
            html += `<div class="grid grid-cols-2 gap-2 mb-3">`;
            if (card.hp !== undefined) html += `<p><span class="font-bold text-red-400">HP:</span> ${card.hp}</p>`;
            if (card.types) html += `<p><span class="font-bold text-green-400">属性:</span> ${card.types.join(', ')}</p>`;
            if (card.stage) html += `<p><span class="font-bold text-purple-400">進化:</span> ${card.stage}</p>`;
            if (card.evolves_from) html += `<p><span class="font-bold text-purple-400">進化元:</span> ${card.evolves_from}</p>`;
            if (card.retreat_cost !== undefined) html += `<p><span class="font-bold text-yellow-400">にげる:</span> ${'⚪'.repeat(card.retreat_cost)}</p>`;
            html += `</div>`;

            if (card.ability) {
                html += `<div class="bg-gray-800 p-3 rounded-md mb-3 border border-gray-700">`;
                html += `<h4 class="font-bold text-lg text-yellow-300 mb-1">特性: ${card.ability.name_ja}</h4>`;
                html += `<p class="text-gray-300 whitespace-pre-wrap text-sm">${card.ability.text_ja}</p>`;
                html += `</div>`;
            }
            if (card.attacks && card.attacks.length > 0) {
                html += `<div class="bg-gray-800 p-3 rounded-md border border-gray-700">`;
                html += `<h4 class="font-bold text-lg text-red-300 mb-2">ワザ:</h4>`;
                card.attacks.forEach(atk => {
                    const cost = atk.cost ? atk.cost.map(c => `<span class="inline-block w-4 h-4 rounded-full bg-gray-600 text-xs text-center leading-4 mr-1">${c.charAt(0)}</span>`).join('') : ''; // Simple icon placeholder
                    const damage = atk.damage !== undefined ? `<span class="font-bold text-orange-300">${atk.damage}</span>` : '';
                    html += `<div class="mb-2 pb-2 border-b border-gray-700 last:border-b-0">`;
                    html += `<p class="font-bold text-white">${atk.name_ja} <span class="text-gray-400 text-xs">(${atk.name_en})</span></p>`;
                    html += `<p class="text-gray-300 text-xs mb-1">コスト: ${cost} ${damage}</p>`;
                    if (atk.text_ja) html += `<p class="text-gray-400 whitespace-pre-wrap text-sm">${atk.text_ja}</p>`;
                    html += `</div>`;
                });
                html += `</div>`;
            }
            if (card.weakness && card.weakness.length > 0) {
                html += `<p class="mt-3"><span class="font-bold text-purple-300">弱点:</span> ${card.weakness.map(w => `${w.type} ${w.value}`).join(', ')}</p>`;
            }
            if (card.resistance && card.resistance.length > 0) {
                html += `<p><span class="font-bold text-cyan-300">抵抗力:</span> ${card.resistance.map(r => `${r.type} ${r.value}`).join(', ')}</p>`;
            }

        } else if (card.card_type === 'Energy') {
            if (card.energy_type) html += `<p><span class="font-bold text-yellow-300">エネルギータイプ:</span> ${card.energy_type}</p>`;
            if (card.is_basic !== undefined) html += `<p><span class="font-bold text-gray-300">基本エネルギー:</span> ${card.is_basic ? 'はい' : 'いいえ'}</p>`;
            if (card.text_ja) html += `<div class="bg-gray-800 p-3 rounded-md mt-3 border border-gray-700"><p class="text-gray-300 whitespace-pre-wrap text-sm">${card.text_ja}</p></div>`;
        } else if (card.card_type === 'Trainer') {
            if (card.trainer_type) html += `<p><span class="font-bold text-orange-300">トレーナータイプ:</span> ${card.trainer_type}</p>`;
            if (card.text_ja) html += `<div class="bg-gray-800 p-3 rounded-md mt-3 border border-gray-700"><p class="text-gray-300 whitespace-pre-wrap text-sm">${card.text_ja}</p></div>`;
        }

        return html;
    }

    async showModal({ title, body, actions }) {
        this.modalTitle.textContent = title;
        this.modalBody.innerHTML = body || '';
        this.modalActions.innerHTML = '';
        actions.forEach(action => {
            const button = document.createElement('button');
            button.textContent = action.text;
            button.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors';
            button.addEventListener('click', () => {
                action.callback();
                this.hideModal();
            });
            this.modalActions.appendChild(button);
        });
        
        // アニメーション付きでモーダルを表示
        await animationManager.animateModalShow(this.modal);
    }

    async hideModal() {
        // アニメーション付きでモーダルを非表示
        await animationManager.animateModalHide(this.modal);
    }

    // Game Message Display
    showGameMessage(message) {
        if (this.gameMessageDisplay && message) {
            // 重複チェック - 同じメッセージは再表示しない
            if (this.gameMessageDisplay.textContent === message) {
                return;
            }
            
            this.gameMessageDisplay.textContent = message;
            this.gameMessageDisplay.classList.remove('hidden');
            
            // メッセージアニメーション
            animationManager.animateMessage(this.gameMessageDisplay);
        }
    }

    hideGameMessage() {
        if (this.gameMessageDisplay) {
            this.gameMessageDisplay.classList.add('hidden');
        }
    }
    
    /**
     * エラーメッセージ表示
     */
    showErrorMessage(message) {
        if (this.gameMessageDisplay) {
            this.gameMessageDisplay.textContent = message;
            this.gameMessageDisplay.classList.remove('hidden');
            
            // エラーメッセージアニメーション
            animationManager.animateError(this.gameMessageDisplay);
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
        this.hideInitialPokemonSelectionUI();
    }

    showInitialPokemonSelectionUI() {
        if (this.initialPokemonSelectionUI) {
            this.initialPokemonSelectionUI.classList.remove('hidden');
        }
    }

    hideInitialPokemonSelectionUI() {
        if (this.initialPokemonSelectionUI) {
            this.initialPokemonSelectionUI.classList.add('hidden');
        }
    }

    // Game Status Panel
    updateGameStatus(state) {
        // フェーズ表示を更新
        if (this.phaseIndicator) {
            const phaseNames = {
                'setup': 'セットアップ',
                'initialPokemonSelection': 'ポケモン選択',
                'playerTurn': 'プレイヤーターン',
                'playerDraw': 'ドロー',
                'playerMain': 'メインフェーズ',
                'cpuTurn': 'CPUターン',
                'gameOver': 'ゲーム終了'
            };
            this.phaseIndicator.textContent = phaseNames[state.phase] || state.phase;
        }

        // ターン数表示
        if (this.turnIndicator) {
            this.turnIndicator.textContent = `ターン ${state.turn || 1}`;
        }

        // 現在のプレイヤー表示
        if (this.currentPlayer) {
            const playerNames = {
                'player': 'プレイヤー',
                'cpu': 'CPU'
            };
            this.currentPlayer.textContent = playerNames[state.turnPlayer] || 'プレイヤー';
        }

        // メッセージ更新 - showGameMessage() に統合して重複を回避
        if (state.prompt?.message) {
            this.showGameMessage(state.prompt.message);
        }
    }

    updateSetupProgress(state) {
        if (!this.setupProgress) return;

        // セットアップフェーズでのみ進捗を表示
        const isSetupPhase = state.phase === 'setup' || state.phase === 'initialPokemonSelection';
        this.setupProgress.style.display = isSetupPhase ? 'block' : 'none';

        if (!isSetupPhase) return;

        // アクティブポケモンの状態
        if (this.activeStatus) {
            const hasActive = state.players.player.active !== null;
            this.activeStatus.className = hasActive 
                ? 'w-3 h-3 rounded-full bg-green-500 mr-2' 
                : 'w-3 h-3 rounded-full bg-red-500 mr-2';
        }

        // ベンチポケモンの数
        if (this.benchCount) {
            const benchCount = state.players.player.bench.filter(slot => slot !== null).length;
            this.benchCount.textContent = benchCount;
        }

        // ベンチの状態
        if (this.benchStatus) {
            const benchCount = state.players.player.bench.filter(slot => slot !== null).length;
            this.benchStatus.className = benchCount > 0 
                ? 'w-3 h-3 rounded-full bg-green-500 mr-2' 
                : 'w-3 h-3 rounded-full bg-gray-500 mr-2';
        }
    }

    updateStatusTitle(title) {
        if (this.statusTitle) {
            this.statusTitle.textContent = title;
        }
    }

    updateStatusMessage(message) {
        if (this.statusMessage) {
            this.statusMessage.textContent = message;
            console.log('📋 Status message updated:', message);
        }
    }

    setConfirmSetupButtonHandler(handler) {
        if (this.confirmSetupButton) {
            this.confirmSetupButton.onclick = handler;
        }
    }

    /**
     * スロットをクリック可能にする
     */
    _makeSlotClickable(slotElement, zone, index) {
        if (!slotElement || !this.cardClickHandler) return;
        
        // スロット自体にクリックイベントを追加
        slotElement.style.cursor = 'pointer';
        slotElement.style.zIndex = '10';
        slotElement.style.pointerEvents = 'auto';
        
        slotElement.addEventListener('click', (e) => {
            // 子要素がクリックされた場合も含めて処理
            e.stopPropagation();
            e.preventDefault();
            
            const dataset = {
                owner: 'player',
                zone: zone,
                index: index.toString(),
                cardId: null // スロットクリックの場合は空
            };
            
            console.log(`🎯 Slot clicked: ${zone}[${index}]`);
            this.cardClickHandler(dataset);
        });
        
        // スロットが空の場合の視覚的フィードバック
        if (!slotElement.querySelector('.relative')) {
            slotElement.classList.add('border-2', 'border-dashed', 'border-blue-400', 'bg-blue-50');
        }
    }
}
