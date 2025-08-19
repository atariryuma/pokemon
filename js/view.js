import { getCardImagePath } from './data-manager.js';
import { animationManager } from './animations.js';
import { GAME_PHASES } from './phase-manager.js';

export class View {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.cardClickHandler = null;

        // Board containers
        this.playerBoard = rootEl.querySelector('.player-board:not(.opponent-board)');
        this.opponentBoard = rootEl.querySelector('.opponent-board');

        // Hand containers
        this.playerHand = document.getElementById('player-hand');
        this.playerHandInner = document.getElementById('player-hand-inner');
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
        
        // Message system
        this.createMessageContainer();

        // Initialize Mac Dock–style magnification for player's hand (delayed)
        setTimeout(() => {
            this._initHandDock();
        }, 1000);
    }

    bindCardClick(handler) {
        this.cardClickHandler = handler;
    }

    createMessageContainer() {
        // Create a simple message container if it doesn't exist
        if (!document.getElementById('message-container')) {
            const container = document.createElement('div');
            container.id = 'message-container';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }
        this.messageContainer = document.getElementById('message-container');
    }

    showMessage(text, type = 'info') {
        const message = document.createElement('div');
        const colors = {
            success: 'bg-green-600',
            info: 'bg-blue-600',
            warning: 'bg-yellow-600',
            error: 'bg-red-600'
        };
        
        message.className = `${colors[type] || colors.info} text-white px-4 py-2 rounded shadow-lg transition-opacity duration-300`;
        message.textContent = text;
        
        this.messageContainer.appendChild(message);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 300);
        }, 3000);
    }

    render(state) {
        console.log('🎨 View.render() started');
        console.log('📊 Player hand:', state.players.player.hand.length, 'cards');
        console.log('📊 Player active:', state.players.player.active?.name_ja || 'None');
        console.log('📊 CPU hand:', state.players.cpu.hand.length, 'cards');
        console.log('📊 CPU active:', state.players.cpu.active?.name_ja || 'None');
        
        // Enhanced damage state debugging
        if (state.players.player.active?.damage > 0) {
            console.log(`💥 RENDER: Player active ${state.players.player.active.name_ja} has ${state.players.player.active.damage} damage`);
        }
        if (state.players.cpu.active?.damage > 0) {
            console.log(`💥 RENDER: CPU active ${state.players.cpu.active.name_ja} has ${state.players.cpu.active.damage} damage`);
        }
        
        // Check bench pokemon for damage
        state.players.player.bench.forEach((pokemon, index) => {
            if (pokemon?.damage > 0) {
                console.log(`💥 RENDER: Player bench[${index}] ${pokemon.name_ja} has ${pokemon.damage} damage`);
            }
        });
        state.players.cpu.bench.forEach((pokemon, index) => {
            if (pokemon?.damage > 0) {
                console.log(`💥 RENDER: CPU bench[${index}] ${pokemon.name_ja} has ${pokemon.damage} damage`);
            }
        });
        
        this._clearBoard();
        this._renderBoard(this.playerBoard, state.players.player, 'player', state);
        this._renderBoard(this.opponentBoard, state.players.cpu, 'cpu', state);
        // Player hand rendering with improved element selection
        const playerHandElement = this.playerHandInner || this.playerHand;
        if (playerHandElement) {
            console.log(`🎯 Using hand element: ${playerHandElement.id || 'unnamed'} for player hand rendering`);
            this._renderHand(playerHandElement, state.players.player.hand, 'player');
        } else {
            console.error('🚨 CRITICAL: No valid player hand element found!');
        }
        this._renderHand(this.cpuHand, state.players.cpu.hand, 'cpu');
        this._renderStadium(state);

        this.playerHand.style.bottom = '10px';

        console.log('✅ View.render() completed');

        // Ensure previous dynamic height (if any) is cleared, rely on fixed CSS height
        const hand = document.getElementById('player-hand');
        if (hand) hand.style.height = '';
        // Then adjust vertical position: default TCG style = slight gap below board
        this._positionHandAgainstBoard(this._getDesiredHandGap());

        // Debug Z-order once per render (sample)
        this._debugZOrder();
    }

    _clearBoard() {
        console.log('🧹 Clearing board');
        
        const allSlots = document.querySelectorAll('.card-slot');
        allSlots.forEach(slot => {
            slot.innerHTML = '';
        });
        
        // Clear hand areas with improved safety
        console.log('🧹 Clearing hand areas...');
        
        // Player hand clearing with better fallback
        const playerHandElement = this.playerHandInner || this.playerHand;
        if (playerHandElement) {
            const playerCardCount = playerHandElement.children.length;
            console.log(`🧹 About to clear ${playerCardCount} cards from player hand (${playerHandElement.id})`);
            
            // Clear children one by one to avoid issues
            while (playerHandElement.firstChild) {
                playerHandElement.removeChild(playerHandElement.firstChild);
            }
            
            // Double-check clearing worked
            const remainingChildren = playerHandElement.children.length;
            console.log(`  🧹 Cleared player hand: ${playerCardCount} -> ${remainingChildren} cards`);
            
            if (remainingChildren > 0) {
                console.warn('⚠️ Some player hand children could not be removed, using innerHTML fallback');
                playerHandElement.innerHTML = '';
            }
        } else {
            console.warn('⚠️ No player hand element found to clear!');
        }
        
        // CPU hand clearing
        if (this.cpuHand) {
            const cpuCardCount = this.cpuHand.children.length;
            while (this.cpuHand.firstChild) {
                this.cpuHand.removeChild(this.cpuHand.firstChild);
            }
            console.log(`  🧹 Cleared ${cpuCardCount} cards from CPU hand`);
        } else {
            console.warn('⚠️ No CPU hand element found to clear!');
        }
        
        console.log('✅ Board cleared');
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
            console.log(`🎯 Rendering active slot for ${playerType}: ${activeSelector}`);
            if (safePlayer.active) {
                console.log(`🃏 Active pokemon: ${safePlayer.active.name_ja} (damage: ${safePlayer.active.damage || 0})`);
            }
            
            activeSlot.innerHTML = '';
            const cardEl = this._createCardElement(safePlayer.active || null, playerType, 'active', 0);
            activeSlot.appendChild(cardEl);
            
            // Verify the card element was added correctly
            console.log(`✅ Active card element added for ${playerType}. Slot children: ${activeSlot.children.length}`);
            
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
        console.log(`🎨 _renderHand called: ${playerType}, handElement exists: ${!!handElement}, hand length: ${Array.isArray(hand) ? hand.length : 'not array'}`);
        
        // Improved safety checks
        if (!handElement) {
            console.warn(`❌ Hand element not found for ${playerType}`);
            return;
        }
        
        // Safe array conversion with detailed logging
        const arr = Array.isArray(hand) ? hand : [];
        if (!Array.isArray(hand)) {
            console.warn(`⚠️ Hand is not an array for ${playerType}:`, typeof hand, hand);
        }
        
        console.log(`🃏 Rendering ${arr.length} cards for ${playerType} hand`);
        console.log(`🔍 Hand element info:`, {
            id: handElement.id,
            className: handElement.className,
            currentChildren: handElement.children.length,
            parentElement: handElement.parentElement?.tagName
        });
        
        // Store current cards before clearing (for debugging)
        const previousCardCount = handElement.children.length;
        
        // Clear existing cards with safety check
        try {
            // Use the same clearing method as _clearBoard for consistency
            while (handElement.firstChild) {
                handElement.removeChild(handElement.firstChild);
            }
            
            const remainingAfterClear = handElement.children.length;
            console.log(`🧹 Cleared ${previousCardCount} -> ${remainingAfterClear} cards from ${playerType} hand`);
            
            if (remainingAfterClear > 0) {
                console.warn(`⚠️ ${remainingAfterClear} cards remained after clearing, using innerHTML`);
                handElement.innerHTML = '';
            }
        } catch (error) {
            console.error(`❌ Error clearing hand element for ${playerType}:`, error);
            return;
        }
        
        // Early return if no cards to render
        if (arr.length === 0) {
            console.log(`📭 No cards to render for ${playerType} hand`);
            return;
        }
        
        // Track successful card additions
        let successfulCards = 0;
        
        arr.forEach((card, index) => {
            try {
                const isFaceDown = playerType === 'cpu';
                console.log(`🃏 Creating card element ${index + 1}/${arr.length}: ${card?.name_ja || 'Unknown'} (${card?.id || 'No ID'})`);
                
                const cardEl = this._createCardElement(card, playerType, 'hand', index, isFaceDown);
                
                if (!cardEl) {
                    console.error(`❌ Failed to create card element for ${card?.name_ja || 'Unknown'}`);
                    return;
                }
                
                // Apply consistent sizing for both players
                cardEl.classList.add('w-20', 'h-28', 'flex-shrink-0');
                
                if (playerType === 'player') {
                    cardEl.classList.add('hand-card');
                    // Default scale matches CPU hand (no shrink)
                    cardEl.style.transform = 'translateY(0) scale(1)';
                    // Match CPU-like spacing (~4px gap between cards)
                    cardEl.style.marginLeft = '2px';
                    cardEl.style.marginRight = '2px';
                }
                
                // Ensure card visibility with explicit styles
                cardEl.style.opacity = '1';
                cardEl.style.visibility = 'visible';
                cardEl.style.display = 'flex';
                cardEl.style.zIndex = '61';
                cardEl.style.position = 'relative';
                cardEl.style.pointerEvents = 'auto';
                
                // Append to hand element
                handElement.appendChild(cardEl);
                successfulCards++;
                
                // 即座にDOM挿入を確認
                const wasActuallyAdded = handElement.contains(cardEl);
                console.log(`  ✅ Added card ${index + 1}/${arr.length} to ${playerType} hand: ${card?.name_ja || 'Unknown'}, DOM confirmed: ${wasActuallyAdded}`);
                
            } catch (error) {
                console.error(`❌ Error rendering card ${index + 1} for ${playerType}:`, error, card);
            }
        });
        
        // Reset hand element transform carefully
        if (handElement.style.transform && handElement.style.transform !== 'none') {
            console.log(`🔄 Resetting hand transform from: ${handElement.style.transform}`);
            handElement.style.transform = 'none';
        }
        
        // Force reflow and verify final state
        try {
            handElement.offsetHeight; // Force reflow
            const finalChildCount = handElement.children.length;
            
            console.log(`🎯 ${playerType} hand rendering summary:`);
            console.log(`  📊 Expected cards: ${arr.length}`);
            console.log(`  ✅ Successfully rendered: ${successfulCards}`);
            console.log(`  🔢 Final DOM children: ${finalChildCount}`);
            console.log(`  📋 Hand element visible: ${getComputedStyle(handElement).display !== 'none'}`);
            
            if (finalChildCount !== arr.length) {
                console.warn(`⚠️ Card count mismatch for ${playerType}: expected ${arr.length}, got ${finalChildCount}`);
            }
            
            if (finalChildCount === 0 && arr.length > 0) {
                console.error(`🚨 CRITICAL: ${playerType} hand is empty despite having ${arr.length} cards in data!`);
                console.error(`🔍 Hand element debug:`, {
                    id: handElement.id,
                    className: handElement.className,
                    parentElement: handElement.parentElement?.tagName,
                    computedDisplay: getComputedStyle(handElement).display,
                    computedVisibility: getComputedStyle(handElement).visibility,
                    computedOpacity: getComputedStyle(handElement).opacity
                });
                
                // Emergency fallback: try to re-render once
                setTimeout(() => {
                    console.log(`🔄 Attempting emergency re-render for ${playerType} hand...`);
                    this._renderHand(handElement, hand, playerType);
                }, 100);
            }
            
            // カード配置後の最終確認
            if (playerType === 'player') {
                setTimeout(() => {
                    const actualCards = document.querySelectorAll('#player-hand-inner .hand-card');
                    console.log(`🔍 Final verification: Found ${actualCards.length} .hand-card elements in DOM`);
                    actualCards.forEach((cardEl, i) => {
                        const rect = cardEl.getBoundingClientRect();
                        console.log(`  Card ${i + 1}: visible=${rect.width > 0 && rect.height > 0}, opacity=${getComputedStyle(cardEl).opacity}`);
                    });
                }, 50);
            }
            
        } catch (error) {
            console.error(`❌ Error in final verification for ${playerType} hand:`, error);
        }
    }


    
    /**
     * Initialize Mac Dock–style proximity magnification for the player's hand.
     */
    _initHandDock() {
        const container = document.getElementById('player-hand-inner') || document.getElementById('player-hand');
        if (!container) return;

        const RADIUS = 180;        // influence radius in px
        const BASE_SCALE = 1.0;    // baseline equals CPU hand size
        const MAX_SCALE = 1.3;     // expand larger than normal for clarity
        const MAX_LIFT = 34;       // px translateY upwards at center
        const BASE_GAP = 2;        // px default spacing per side (~CPU gap-x-1)
        const MAX_GAP = 6;         // px spacing per side near cursor

        let rafId = null;
        let pendingX = null;

        const resetAll = () => {
            const cards = container.querySelectorAll('.hand-card');
            console.log(`🔄 Mac Dock resetAll called for ${cards.length} cards`);
            cards.forEach(el => {
                el.style.transform = `translateY(0) scale(${BASE_SCALE})`;
                el.style.marginLeft = `${BASE_GAP}px`;
                el.style.marginRight = `${BASE_GAP}px`;
                el.style.zIndex = '61'; // 一貫した z-index 値を使用
            });
        };

        const applyAt = (x) => {
            const cards = container.querySelectorAll('.hand-card');
            let maxScale = 0;
            let maxEl = null;
            cards.forEach(el => {
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const d = Math.abs(centerX - x);
                const t = Math.max(0, 1 - d / RADIUS); // 0..1
                const scale = BASE_SCALE + (MAX_SCALE - BASE_SCALE) * (t * t);
                const lift = -MAX_LIFT * (t * t);
                const gap = BASE_GAP + (MAX_GAP - BASE_GAP) * (t * t);
                if (scale > 0) {
                    el.style.transform = `translateY(${lift}px) scale(${scale.toFixed(3)})`;
                }
                el.style.marginLeft = `${gap}px`;
                el.style.marginRight = `${gap}px`;
                if (scale > maxScale) {
                    maxScale = scale;
                    maxEl = el;
                }
            });
            // Raise stacking for the card closest to the cursor  
            cards.forEach(el => { el.style.zIndex = '61'; });
            if (maxEl) maxEl.style.zIndex = '62';
        };

        const onMove = (e) => {
            pendingX = e.clientX;
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                applyAt(pendingX);
                rafId = null;
            });
        };

        container.addEventListener('mousemove', onMove);
        container.addEventListener('mouseleave', resetAll);
        // Allow normal vertical page scroll while hovering hand (no interception)
        // Touch support: tap to center magnify under finger, then reset on end
        container.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            applyAt(e.touches[0].clientX);
        }, { passive: true });
        container.addEventListener('touchend', resetAll);

        // Reposition on load and resize
        window.addEventListener('load', () => this._positionHandAgainstBoard(this._getDesiredHandGap()));
        window.addEventListener('resize', () => { 
            this._positionHandAgainstBoard(this._getDesiredHandGap());
        });
    }

    /**
     * Adjust player's hand so that maximized cards graze the playmat bottom edge.
     * @param {number} desiredOverlapPx - target overlap amount in pixels
     */
    _positionHandAgainstBoard(desiredOverlapPx = 12) {
        try {
            const board = document.getElementById('game-board');
            const handInner = this.playerHandInner || document.getElementById('player-hand-inner');
            if (!board || !handInner) return;

            // Find a representative card to measure
            const sampleCard = handInner.querySelector('.hand-card');
            if (!sampleCard) return;

            const boardRect = board.getBoundingClientRect();

            // Reset to a known baseline before measurement to avoid cumulative drift
            handInner.style.marginTop = '0px';
            handInner.style.transform = 'translateY(0px)';
            // Force reflow, then measure at baseline
            // eslint-disable-next-line no-unused-expressions
            handInner.offsetHeight;
            const baseRect = sampleCard.getBoundingClientRect();

            // Predict the top position when a card is at maximum magnification.
            // Use the same constants as the dock behavior.
            const BASE_SCALE = 1.0;
            const MAX_SCALE = 1.3;
            const MAX_LIFT = 34; // px

            // current rect is for BASE_SCALE (collapsed). Extra height at max scale:
            const scaleRatio = (MAX_SCALE / BASE_SCALE);
            const extraHeight = baseRect.height * (scaleRatio - 1);
            const predictedMaxTop = baseRect.top - extraHeight - MAX_LIFT;

            // Target top position of the card at maximum scale.
            // If desiredOverlapPx < 0 => treat as GAP below board of |value| pixels.
            // If desiredOverlapPx > 0 => treat as OVERLAP into board of value pixels.
            const isGap = desiredOverlapPx < 0;
            const magnitude = Math.abs(desiredOverlapPx);
            const targetTopAtMax = isGap
                ? (boardRect.bottom + magnitude)   // gap below board
                : (boardRect.bottom - magnitude);  // overlap into board
            const delta = targetTopAtMax - predictedMaxTop; // positive -> push hand downward

            if (Math.abs(delta) > 0.5) {
                // Use translateY so we can move up (negative) or down (positive)
                const clamped = Math.max(-480, Math.min(480, delta));
                handInner.style.transform = `translateY(${clamped.toFixed(1)}px)`;
            } else {
                handInner.style.transform = 'translateY(0px)';
            }
        } catch (e) {
            console.warn('Failed to position hand against board:', e);
        }
    }

    /**
     * Decide a pleasant default gap between playmat bottom and hand (negative px means gap).
     * Adapts to viewport height: smaller screens use smaller gap.
     */
    _getDesiredHandGap() {
        const h = window.innerHeight || 800;
        if (h < 720) return -4;   // tighter on short viewports
        if (h < 900) return -6;   // medium
        return -8;                // roomy
    }

    /**
     * Dynamically set #player-hand height to fit the tallest card at max magnification.
     */
        _updateHandContainerHeight() {
        // This function is no longer needed as hand height is fixed in CSS.
        // Keeping it as a placeholder comment for now.
    }

    /**
     * Dump key Z-order related computed styles for troubleshooting.
     */
    _debugZOrder() {
        try {
            const board = document.getElementById('game-board');
            const hand = document.getElementById('player-hand');
            const handInner = this.playerHandInner || document.getElementById('player-hand-inner');
            const sampleHandCard = handInner?.querySelector('.hand-card');
            const modal = document.getElementById('action-modal');

            const info = (el, label) => el ? {
                label,
                z: getComputedStyle(el).zIndex,
                pos: getComputedStyle(el).position,
                transform: getComputedStyle(el).transform,
                pointer: getComputedStyle(el).pointerEvents,
                overflow: `${getComputedStyle(el).overflowX}/${getComputedStyle(el).overflowY}`
            } : { label, missing: true };

            console.group('Z-ORDER DEBUG');
            console.table([
                info(board, '#game-board'),
                info(hand, '#player-hand'),
                info(handInner, '#player-hand-inner'),
                info(sampleHandCard, '.hand-card(sample)'),
                info(modal, '#action-modal')
            ]);
            console.groupEnd();
        } catch (e) {
            console.warn('Z-ORDER DEBUG failed:', e);
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

        // Enhanced debug logging for card creation
        console.log(`🎨 Creating card element: ${card.name_ja} (${card.name_en}) for ${playerType} ${zone}${index !== undefined ? `[${index}]` : ''}`);
        console.log(`🖼️ Image path: ${isFaceDown ? 'assets/ui/card_back.webp' : getCardImagePath(card.name_en)}`);
        console.log(`🔍 Card damage state:`, {
            damage: card.damage,
            damageType: typeof card.damage,
            hasDamage: card.damage > 0,
            cardType: card.card_type,
            playerType,
            zone
        });

        const img = document.createElement('img');
        // Ensure proper CSS classes for visibility and sizing
        img.className = 'card-image w-full h-full object-contain rounded-lg'; // Change object-cover to object-contain
        // Remove any stale animation-hidden classes to avoid invisible cards
        img.classList.remove('is-animating', 'is-hidden');
        img.style.aspectRatio = '74 / 103'; // Enforce aspect ratio
        img.dataset.dynamic = true;
        img.src = isFaceDown ? 'assets/ui/card_back.webp' : getCardImagePath(card.name_en);
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
            this.src = 'assets/ui/card_back.webp';
        };
        
        // 確実にカードが表示されるよう初期状態を設定
        img.style.opacity = '1';
        img.style.visibility = 'visible';
        img.style.display = 'block';
        img.style.pointerEvents = 'auto';
        
        // アニメーション関連のクラスをクリア（表示を妨げる可能性）
        img.classList.remove('is-animating', 'is-hidden', 'opacity-0');
        
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

        // Simple damage badge creation
        if (card.damage > 0) {
            const damageCounter = document.createElement('div');
            damageCounter.className = 'absolute top-1 right-1 bg-red-600 text-white text-lg font-bold rounded-full w-8 h-8 flex items-center justify-center';
            damageCounter.textContent = card.damage;
            damageCounter.style.pointerEvents = 'none';
            damageCounter.style.zIndex = '30';
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

    // Generic visibility helpers
    showElement(el) {
        if (el) el.classList.remove('is-hidden');
    }

    hideElement(el) {
        if (el) el.classList.add('is-hidden');
    }

    showHand(owner) {
        const hand = owner === 'player' ? (this.playerHandInner || this.playerHand) : this.cpuHand;
        this.showElement(hand);
    }

    hideHand(owner) {
        const hand = owner === 'player' ? (this.playerHandInner || this.playerHand) : this.cpuHand;
        this.hideElement(hand);
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
        const isSetupPhase = state.phase === GAME_PHASES.SETUP || state.phase === GAME_PHASES.INITIAL_POKEMON_SELECTION;
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
