import { getCardImagePath } from './data-manager.js';
import { CardOrientationManager } from './card-orientation.js';
import { animationManager } from './animation-manager.js';
import { GAME_PHASES } from './phase-manager.js';
import { BUTTON_IDS, CONTAINER_IDS, CSS_CLASSES } from './ui-constants.js';
import { errorHandler } from './error-handler.js';
import { modalManager } from './modal-manager.js';

// Z-index定数 (CSS変数と連携) - 最小限に削減
import { LEGACY_Z_INDEX as Z_INDEX, ZIndexManager } from './z-index-constants.js';

const noop = () => {};

export class View {
    constructor(rootEl) {
        this.rootEl = rootEl;
        this.cardClickHandler = null;

        // Board containers
        this.playerBoard = rootEl.querySelector('.player-board:not(.opponent-board)');
        this.opponentBoard = rootEl.querySelector('.opponent-board');
        
        // 差分レンダリング用キャッシュ
        this.lastRenderedState = null;
        this.domCache = new Map();
        this.renderRegions = {
            playerHand: { dirty: true },
            cpuHand: { dirty: true },
            playerActive: { dirty: true },
            cpuActive: { dirty: true },
            playerBench: { dirty: true },
            cpuBench: { dirty: true },
            stadium: { dirty: true },
            ui: { dirty: true }
        };
        
        

        // Hand containers
        this.playerHand = document.getElementById('player-hand');
        this.cpuHand = document.getElementById('cpu-hand');
        
        // 手札エリア全体のクリック保護
        if (this.playerHand) {
            this.playerHand.addEventListener('click', this._handleHandClickDelegation.bind(this));
        }
        // CPU手札はクリック無効（プレイヤー操作対象外）

        // Modal elements
        // Modal elements removed - showInteractiveMessageシステムに統一済み

        // Static Action Buttons container
        this.staticActionButtonsContainer = document.getElementById(CONTAINER_IDS.STATIC_ACTION_BUTTONS);

        // Dynamic Interactive Buttons container (for dynamically generated buttons)
        this.dynamicInteractiveButtonsContainer = document.getElementById(CONTAINER_IDS.DYNAMIC_INTERACTIVE_BUTTONS);

        // Game Message Display
        this.gameMessageDisplay = document.getElementById(CONTAINER_IDS.GAME_MESSAGE_DISPLAY);

        // Action Buttons - 遅延取得（DOM準備完了後に取得）
        this._actionButtons = null; // キャッシュ用

        // Game Status Panel
        this.statusPanel = document.getElementById('game-status-panel');
        this.statusTitle = document.getElementById('status-title');
        this.statusMessage = document.getElementById('status-message');
        this.phaseIndicator = document.getElementById('phase-indicator');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.currentPlayer = document.getElementById('current-player');
        // confirmSetupButton は getter で管理されているため、ここでは設定しない
        this.initialPokemonSelectionUI = document.getElementById('initial-pokemon-selection');
        
        // Setup Progress Elements
        this.activeStatus = document.getElementById('active-status');
        this.benchStatus = document.getElementById('bench-status');
        this.benchCount = document.getElementById('bench-count');
        this.setupProgress = document.getElementById('setup-progress');
        
        // Message system

        // Initialize Mac Dock–style magnification for player's hand (delayed)
        // HoverManagerと統合してz-index管理を最適化
        setTimeout(() => {
            this._initHandDock();
        }, 1000);
    }

    /**
     * DOM要素遅延取得システム
     * 必要時にDOM要素を取得してキャッシュする
     */
    getActionButtons() {
        if (!this._actionButtons) {
            this._actionButtons = {
                retreat: document.getElementById(BUTTON_IDS.RETREAT),
                attack: document.getElementById(BUTTON_IDS.ATTACK),
                endTurn: document.getElementById(BUTTON_IDS.END_TURN),
                confirmSetup: document.getElementById(BUTTON_IDS.CONFIRM_SETUP),
                confirmInitialPokemon: document.getElementById(BUTTON_IDS.CONFIRM_INITIAL_POKEMON)
            };
            noop('🔍 Action buttons retrieved:', this._actionButtons);
        }
        return this._actionButtons;
    }

    /**
     * 特定のボタンを遅延取得（null安全）
     */
    getButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button) {
            // 動的に作成されるボタンは警告を出さない
            const dynamicButtons = [BUTTON_IDS.CONFIRM_SETUP, BUTTON_IDS.CONFIRM_INITIAL_POKEMON];
            if (!dynamicButtons.includes(buttonId)) {
                console.warn(`⚠️ Button not found: ${buttonId}`);
            }
        }
        return button;
    }

    /**
     * レガシーサポート：既存のプロパティアクセスをサポート
     */
    get retreatButton() {
        return this.getButton(BUTTON_IDS.RETREAT);
    }

    get attackButton() {
        return this.getButton(BUTTON_IDS.ATTACK);
    }

    get endTurnButton() {
        return this.getButton(BUTTON_IDS.END_TURN);
    }

    get confirmSetupButton() {
        return this.getButton(BUTTON_IDS.CONFIRM_INITIAL_POKEMON);
    }


    /**
     * 汎用モーダルを表示し、内容を設定します。
     * @param {Object} options - モーダルの設定オプション
     * @param {string} options.title - モーダルのタイトル
     * @param {string} options.message - モーダルの本文メッセージ
     * @param {Array<Object>} options.actions - { text: string, callback: Function, className?: string } の配列
     * @param {Object} [options.cardSelectionOptions] - カード選択オプション { cards: Array<Object>, onCardSelect: Function }
     */
    async displayModal({ title, message, actions = [], cardSelectionOptions = null }) {
        // 新統一モーダルシステムを使用
        const modalOptions = {
            title,
            message,
            actions,
            closable: true
        };

        // カード選択がある場合は中央モーダルにグリッドを追加
        if (cardSelectionOptions && cardSelectionOptions.cards && cardSelectionOptions.cards.length > 0) {
            modalOptions.cardData = {
                cards: cardSelectionOptions.cards,
                onCardSelect: cardSelectionOptions.onCardSelect
            };
        }

        await modalManager.showCentralModal(modalOptions);
    }

    /**
     * 汎用モーダルを非表示にします。
     */
    hideModal() {
        // 新統一モーダルシステムでモーダルを閉じる
        modalManager.closeCentralModal();
        // 従来システムも併用（互換性のため）
        this.clearInteractiveButtons();
        this.hideGameMessage();
    }

    /**
     * モーダル内にカード選択グリッドをレンダリングします。
     * @param {Array<Object>} cards - 表示するカードオブジェクトの配列
     * @param {Function} onCardSelect - カードが選択されたときに呼び出されるコールバック (cardIdを引数にとる)
     */
    _renderCardSelectionGrid(cards, onCardSelect) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid grid-cols-3 gap-4 p-4 bg-gray-700 rounded-lg max-h-80 overflow-y-auto'; // Tailwind classes for grid

        cards.forEach(card => {
            const cardElement = this._createModalCardElement(card);
            cardElement.classList.add('cursor-pointer', 'hover:scale-105', 'transition-transform');
            cardElement.addEventListener('click', () => {
                onCardSelect(card.id);
                this.hideModal(); // カード選択後にモーダルを非表示
            });
            gridContainer.appendChild(cardElement);
        });

        // Modal grid system removed - showInteractiveMessageに統一済み
    }

    /**
     * モーダル表示用の簡易カード要素を作成します。
     * @param {Object} card - カードデータ
     * @returns {HTMLElement} 簡易カード要素
     */
    _createModalCardElement(card) {
        const container = document.createElement('div');
        container.className = 'relative w-24 h-32 rounded-lg overflow-hidden shadow-md';

        if (!card) {
            container.classList.add('card-placeholder');
            return container;
        }

        const img = document.createElement('img');
        img.className = 'w-full h-full object-contain';
        img.src = getCardImagePath(card.name_en, card);
        img.alt = card.name_ja;

        container.appendChild(img);

        // カード名を表示
        const nameOverlay = document.createElement('div');
        nameOverlay.className = 'absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs text-center py-1';
        nameOverlay.textContent = card.name_ja;
        container.appendChild(nameOverlay);

        return container;
    }

    bindCardClick(handler) {
        this.cardClickHandler = handler;
    }

    /**
     * ドラッグ&ドロップハンドラーをバインド
     */
    bindDragAndDrop(handler) {
        this.dragDropHandler = handler;
    }

    // All messages will now go through showGameMessage or showErrorMessage

    _handleHandClickDelegation(e) {
        const cardElement = e.target.closest('[data-card-id]');
        if (cardElement && this.cardClickHandler) {
            this.cardClickHandler(cardElement.dataset);
        }
    }

    render(state) {
        // 差分レンダリング：変更があった領域のみを更新
        this._detectChanges(state);
        
        // 変更のあった領域のみクリア・レンダリング
        if (this.renderRegions.playerHand.dirty || this.renderRegions.cpuHand.dirty || 
            this.renderRegions.playerActive.dirty || this.renderRegions.cpuActive.dirty ||
            this.renderRegions.playerBench.dirty || this.renderRegions.cpuBench.dirty) {
            
            this._performRegionalRender(state);
        }
        
        if (this.renderRegions.stadium.dirty) {
            this._renderStadium(state);
            this.renderRegions.stadium.dirty = false;
        }
        
        if (this.renderRegions.ui.dirty) {
            this._updatePrizeStatus(state);
            this._updateUIElements();
            this.renderRegions.ui.dirty = false;
        }

        this.lastRenderedState = this._cloneStateForCache(state);
    }
    
    _detectChanges(state) {
        if (!this.lastRenderedState) {
            this._markAllRegionsDirty();
            return;
        }
        
        const prev = this.lastRenderedState;
        
        // 手札の変更チェック
        this.renderRegions.playerHand.dirty = this._hasHandChanged(prev.players.player.hand, state.players.player.hand);
        this.renderRegions.cpuHand.dirty = this._hasHandChanged(prev.players.cpu.hand, state.players.cpu.hand);
        
        // アクティブポケモンの変更チェック
        this.renderRegions.playerActive.dirty = this._hasActiveChanged(prev.players.player.active, state.players.player.active);
        this.renderRegions.cpuActive.dirty = this._hasActiveChanged(prev.players.cpu.active, state.players.cpu.active);
        
        // ベンチの変更チェック
        this.renderRegions.playerBench.dirty = this._hasBenchChanged(prev.players.player.bench, state.players.player.bench);
        this.renderRegions.cpuBench.dirty = this._hasBenchChanged(prev.players.cpu.bench, state.players.cpu.bench);
        
        // スタジアムの変更チェック
        this.renderRegions.stadium.dirty = this._hasStadiumChanged(prev.stadium, state.stadium);
        
        // UIの変更チェック
        this.renderRegions.ui.dirty = (prev.phase !== state.phase || prev.turn !== state.turn || prev.turnPlayer !== state.turnPlayer);
    }
    
    _hasHandChanged(prevHand, newHand) {
        if (!prevHand && !newHand) return false;
        if (!prevHand || !newHand) return true;
        if (prevHand.length !== newHand.length) return true;
        
        return prevHand.some((card, i) => card?.id !== newHand[i]?.id);
    }
    
    _hasActiveChanged(prevActive, newActive) {
        if (!prevActive && !newActive) return false;
        if (!prevActive || !newActive) return true;
        return prevActive.id !== newActive.id || 
               prevActive.damage !== newActive.damage ||
               JSON.stringify(prevActive.special_conditions) !== JSON.stringify(newActive.special_conditions);
    }
    
    _hasBenchChanged(prevBench, newBench) {
        if (!prevBench && !newBench) return false;
        if (!prevBench || !newBench) return true;
        if (prevBench.length !== newBench.length) return true;
        
        return prevBench.some((pokemon, i) => {
            const prev = pokemon;
            const curr = newBench[i];
            if (!prev && !curr) return false;
            if (!prev || !curr) return true;
            return prev.id !== curr.id || prev.damage !== curr.damage;
        });
    }
    
    _hasStadiumChanged(prevStadium, newStadium) {
        if (!prevStadium && !newStadium) return false;
        if (!prevStadium || !newStadium) return true;
        return prevStadium.id !== newStadium.id;
    }
    
    _markAllRegionsDirty() {
        Object.keys(this.renderRegions).forEach(region => {
            this.renderRegions[region].dirty = true;
        });
    }
    
    _performRegionalRender(state) {
        // 部分的なクリアとレンダリング
        if (this.renderRegions.playerHand.dirty) {
            this._clearHandArea(this.playerHand);
            this._renderHand(this.playerHand, state.players.player.hand, 'player');
            this.renderRegions.playerHand.dirty = false;
        }
        
        if (this.renderRegions.cpuHand.dirty) {
            this._clearHandArea(this.cpuHand);
            this._renderHand(this.cpuHand, state.players.cpu.hand, 'cpu');
            this.renderRegions.cpuHand.dirty = false;
        }
        
        if (this.renderRegions.playerActive.dirty || this.renderRegions.playerBench.dirty) {
            this._clearBoardArea(this.playerBoard);
            this._renderBoard(this.playerBoard, state.players.player, 'player');
            this.renderRegions.playerActive.dirty = false;
            this.renderRegions.playerBench.dirty = false;
        }
        
        if (this.renderRegions.cpuActive.dirty || this.renderRegions.cpuBench.dirty) {
            this._clearBoardArea(this.opponentBoard);
            this._renderBoard(this.opponentBoard, state.players.cpu, 'cpu');
            this.renderRegions.cpuActive.dirty = false;
            this.renderRegions.cpuBench.dirty = false;
        }
        
        // 手札位置調整（プレイヤーのみ）
        this._updateHandPosition();
    }
    
    _clearHandArea(handElement) {
        if (handElement) handElement.innerHTML = '';
    }
    
    _clearBoardArea(boardElement) {
        if (!boardElement) return;
        const slots = boardElement.querySelectorAll('.card-slot');
        slots.forEach(slot => slot.innerHTML = '');
    }
    
    _updateHandPosition() {
        if (this.playerHand) {
            this.playerHand.style.bottom = '10px';
            const hand = document.getElementById('player-hand');
            if (hand) hand.style.height = '';
            this._positionHandAgainstBoard(this._getDesiredHandGap());
        }
    }
    
    _updateUIElements() {
        this._debugZOrder();
    }
    
    _cloneStateForCache(state) {
        return {
            phase: state.phase,
            turn: state.turn,
            turnPlayer: state.turnPlayer,
            stadium: state.stadium ? { id: state.stadium.id } : null,
            players: {
                player: {
                    hand: (state.players.player.hand || []).map(c => c ? { id: c.id } : null),
                    active: state.players.player.active ? { 
                        id: state.players.player.active.id, 
                        damage: state.players.player.active.damage || 0,
                        special_conditions: [...(state.players.player.active.special_conditions || [])]
                    } : null,
                    bench: (state.players.player.bench || []).map(p => p ? { 
                        id: p.id, 
                        damage: p.damage || 0 
                    } : null)
                },
                cpu: {
                    hand: (state.players.cpu.hand || []).map(c => c ? { id: c.id } : null),
                    active: state.players.cpu.active ? { 
                        id: state.players.cpu.active.id, 
                        damage: state.players.cpu.active.damage || 0,
                        special_conditions: [...(state.players.cpu.active.special_conditions || [])]
                    } : null,
                    bench: (state.players.cpu.bench || []).map(p => p ? { 
                        id: p.id, 
                        damage: p.damage || 0 
                    } : null)
                }
            }
        };
    }

    _clearBoard() {
        const allSlots = document.querySelectorAll('.card-slot');
        allSlots.forEach(slot => {
            slot.innerHTML = '';
        });
        
        // Clear hand areas
        if (this.playerHand) this.playerHand.innerHTML = '';
        if (this.cpuHand) this.cpuHand.innerHTML = '';
    }
    
    _renderBoard(boardElement, playerState, playerType) {
        if (!boardElement) return;

        const safePlayer = playerState || {};
        const bench = Array.isArray(safePlayer.bench) ? safePlayer.bench : new Array(5).fill(null);
        const discard = Array.isArray(safePlayer.discard) ? safePlayer.discard : [];
        const prize = Array.isArray(safePlayer.prize) ? safePlayer.prize.slice(0, 6) : new Array(6).fill(null);

        // Active
        const activeSelector = playerType === 'player' ? '.active-bottom' : '.active-top';
        const activeSlot = boardElement.querySelector(activeSelector);
        if (activeSlot) {
            const activePokemon = safePlayer.active;
            const isFaceDown = activePokemon && activePokemon.setupFaceDown;
            const cardEl = this._createCardElement(activePokemon, playerType, 'active', 0, isFaceDown);
            activeSlot.appendChild(cardEl);
            // プレイヤー側とCPU側の空スロット両方にクリック機能を追加
            this._makeSlotClickable(activeSlot, playerType, 'active', 0);
        }

        // Bench
        for (let i = 0; i < 5; i++) {
            const benchPrefix = playerType === 'player' ? 'bottom-bench' : 'top-bench';
            const benchSlot = boardElement.querySelector(`.${benchPrefix}-${i + 1}`);
            if (!benchSlot) continue;
            benchSlot.innerHTML = '';
            const benchPokemon = bench[i];
            const isFaceDown = benchPokemon && benchPokemon.setupFaceDown;
            const cardEl = this._createCardElement(benchPokemon, playerType, 'bench', i, isFaceDown);
            benchSlot.appendChild(cardEl);
            // プレイヤー側とCPU側の空スロット両方にクリック機能を追加
            this._makeSlotClickable(benchSlot, playerType, 'bench', i);
        }

        // Discard - HTMLのクラス名に合わせて修正
        const discardSelector = playerType === 'player' ? '.bottom-right-trash' : '.top-left-trash';
        const discardSlot = boardElement.querySelector(discardSelector);
        if (discardSlot) {
            discardSlot.innerHTML = '';
            const topCard = discard.length ? discard[discard.length - 1] : null;
            discardSlot.appendChild(this._createCardElement(topCard, playerType, 'discard', 0));
        }

        // Prizes - サイド配布アニメーション完了後のみ表示
        if (this._shouldRenderPrizes()) {
            this._renderPrizeArea(boardElement, prize, playerType);
        }

        // Deck - HTMLのクラス名に合わせて修正
        const deckSelector = playerType === 'player' ? '.bottom-right-deck' : '.top-left-deck';
        const deckSlot = boardElement.querySelector(deckSelector);
        noop(`🃏 Rendering deck for ${playerType}: selector=${deckSelector}, slot found=${!!deckSlot}`);
        if (deckSlot) {
            deckSlot.innerHTML = '';
            const deckArr = Array.isArray(safePlayer.deck) ? safePlayer.deck : [];
            noop(`  📚 Deck has ${deckArr.length} cards`);
            const deckCardEl = this._createCardElement(deckArr[0] || null, playerType, 'deck', 0, true);
            deckSlot.appendChild(deckCardEl);
            if (deckArr.length > 0) {
                const count = document.createElement('div');
                count.className = 'absolute bottom-1 right-1 bg-gray-800 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center';
                ZIndexManager.apply(count, 'CARD_EFFECTS'); // カード付与効果レイヤー
                count.textContent = deckArr.length;
                deckSlot.appendChild(count);
                noop(`  🏷️ Added deck count badge: ${deckArr.length} cards`);
            }
            
            // Make the deck clickable for drawing
            if (playerType === 'player' && this.cardClickHandler) {
                deckSlot.classList.add('cursor-pointer');
                deckSlot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.cardClickHandler({
                        owner: 'player',
                        zone: 'deck',
                        index: '0',
                        cardId: null
                    });
                });
            }
        } else {
            console.warn(`⚠️ Deck slot not found for ${playerType}: ${deckSelector}`);
        }
    }

    _renderHand(handElement, hand, playerType) {
        if (!handElement) return;
        const arr = Array.isArray(hand) ? hand : [];
        
        // 既存のアクティブ状態をクリア
        this._clearHandActiveStates();
        
        arr.forEach((card, index) => {
            const isFaceDown = playerType === 'cpu';
            
            // プレースホルダーベースの手札スロットを作成
            const handSlot = document.createElement('div');
            handSlot.className = 'hand-slot relative';
            handSlot.dataset.handIndex = index;
            handSlot.dataset.owner = playerType;
            handSlot.dataset.zone = 'hand';
            handSlot.dataset.cardId = card.id;
            
            // カード要素を作成
            const cardEl = this._createCardElement(card, playerType, 'hand', index, isFaceDown);
            
            // プレイヤーとCPUで異なるカードサイズを設定
            if (playerType === 'player') {
                handSlot.classList.add('w-24', 'h-32', 'flex-shrink-0'); // プレイヤーは大きめ
                cardEl.classList.add('w-full', 'h-full');
            } else {
                handSlot.classList.add('w-20', 'h-28', 'flex-shrink-0'); // CPUは元のサイズ
                cardEl.classList.add('w-full', 'h-full');
            }
            
            // 基本的な表示設定のみ（Mac Dock効果は後で追加）
            handSlot.style.visibility = 'visible';
            handSlot.style.display = 'flex';
            ZIndexManager.setHandNormal(handSlot);
            handSlot.style.position = 'relative';
            handSlot.style.opacity = '1'; // Always visible by default
            
            handSlot.appendChild(cardEl);
            handElement.appendChild(handSlot);
        });
        
        // DOM挿入後の強制再描画
        if (handElement.children.length > 0) {
            handElement.offsetHeight; // Force reflow
            
            if (playerType === 'player') {
                this._applyHandDockEffect(handElement);
                this._adjustHandHeight(handElement);
            }
        }
    }


    
    /**
     * 手札のアクティブ状態をクリア
     */
    _clearHandActiveStates() {
        // 手札スロットのアクティブ状態と選択状態をクリア
        const activeCards = document.querySelectorAll('.hand-slot.active');
        activeCards.forEach(slot => {
            slot.classList.remove('active');
            const cardElement = slot.querySelector('.relative');
            if (cardElement) {
                cardElement.classList.remove('card-selected');
            }
        });
    }


    /**
     * プレイヤー手札にMac Dock効果を適用
     */
    _applyHandDockEffect(handElement) {
        if (!handElement) return;
        
        // 手札スロットにhand-cardクラスを追加
        const handSlots = handElement.querySelectorAll('.hand-slot');
        handSlots.forEach(slot => {
            slot.classList.add('hand-card');
        });
        
        // 手札コンテナにhand-dockクラスを追加
        handElement.classList.add('hand-dock');
    }

    /**
     * 手札コンテナの高さを動的に調整
     */
    _adjustHandHeight(handElement) {
        if (!handElement) return;
        
        // 基本カードサイズ (w-24 h-32 = 96px x 128px)
        const baseCardHeight = 128;
        // Mac Dock効果の最大スケール（拡大率を上げる）
        const maxScale = 1.5;
        // 最大リフト量
        const maxLift = 40;
        
        // 拡大時の最大必要高さを計算
        const maxCardHeight = baseCardHeight * maxScale;
        const requiredHeight = Math.ceil(maxCardHeight + maxLift + 30); // 余白30px
        
        // コンテナの高さを動的に設定（制限なし）
        handElement.style.height = `${requiredHeight}px`;
        handElement.style.minHeight = `${requiredHeight}px`;
        handElement.style.maxHeight = 'none'; // 高さ制限を解除
    }

    /**
     * Initialize Mac Dock–style proximity magnification for the player's hand.
     */
    _initHandDock() {
        const container = document.getElementById('player-hand');
        if (!container) return;

        // 画面サイズに応じて動的に調整
        const screenWidth = window.innerWidth || 800;
        const RADIUS = Math.min(180, screenWidth * 0.2);        // 画面幅の20%、最大180px
        const BASE_SCALE = 1.0;    // baseline equals CPU hand size
        const MAX_SCALE = screenWidth < 768 ? 1.15 : 1.3;      // 小画面では控えめに
        const MAX_LIFT = Math.min(34, screenWidth * 0.04);     // 画面幅の4%、最大34px
        const BASE_GAP = 2;        // px default spacing per side
        const MAX_GAP = Math.min(6, screenWidth * 0.008);      // 画面幅の0.8%、最大6px

        let rafId = null;
        let pendingX = null;

        const resetAll = () => {
            const cards = container.querySelectorAll('.hand-slot.hand-card:not(.active)');
            cards.forEach(el => {
                el.style.transform = `translateY(0) scale(${BASE_SCALE})`;
                el.style.marginLeft = `${BASE_GAP}px`;
                el.style.marginRight = `${BASE_GAP}px`;
                ZIndexManager.setHandNormal(el);
            });
            
            // アニメーションフラグをクリア（必要に応じて）
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };

        const applyAt = (x) => {
            const cards = container.querySelectorAll('.hand-slot.hand-card:not(.active)');
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
            cards.forEach(el => ZIndexManager.setHandNormal(el));
            if (maxEl) ZIndexManager.setHandHover(maxEl);
        };

        const onMove = (e) => {
            pendingX = e.clientX;
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                applyAt(pendingX);
                rafId = null;
            });
        };

        // マウス検出を手札カード要素のみに厳密に制限
        container.addEventListener('mousemove', (e) => {
            // カード要素またはその子要素の上にいる場合のみ Mac Dock 効果を適用
            const cardElement = e.target.closest('.hand-slot.hand-card');
            const isOnCard = cardElement && container.contains(e.target);
            if (isOnCard) {
                onMove(e);
            } else {
                resetAll();
            }
        }, { passive: true });
        container.addEventListener('mouseleave', resetAll, { passive: true });
        
        // Touch support: tap to center magnify under finger, then reset on end
        container.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            applyAt(e.touches[0].clientX);
        }, { passive: true });
        container.addEventListener('touchend', resetAll);

        // ドキュメント全体でのマウス監視（手札エリア外でリセット）
        let isMouseOverHand = false;
        
        container.addEventListener('mouseenter', () => {
            isMouseOverHand = true;
        });
        
        container.addEventListener('mouseleave', () => {
            isMouseOverHand = false;
            resetAll();
        });
        
        // グローバルマウス移動でも確認
        document.addEventListener('mousemove', () => {
            if (!isMouseOverHand) {
                // 手札エリア外では必ずリセット状態を保持
                const cards = container.querySelectorAll('.hand-slot.hand-card:not(.active)');
                if (cards.length > 0) {
                    const firstCard = cards[0];
                    if (firstCard.style.transform && !firstCard.style.transform.includes('scale(1)')) {
                        resetAll();
                    }
                }
            }
        });

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
            const handInner = document.getElementById('player-hand-inner');
            if (!board || !handInner) return;

            // Find a representative card to measure
            const sampleCard = handInner.querySelector('.hand-slot.hand-card');
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
            const handInner = document.getElementById('player-hand-inner');
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

            noop('Z-ORDER DEBUG');
            noop([
                info(board, '#game-board'),
                info(hand, '#player-hand'),
                info(handInner, '#player-hand-inner'),
                info(sampleHandCard, '.hand-card(sample)'),
                info(modal, '#action-modal')
            ]);
            noop();
        } catch (e) {
            console.warn('Z-ORDER DEBUG failed:', e);
        }
    }

    /**
     * サイドカードをレンダリングすべきかどうかを判定
     */
    _shouldRenderPrizes() {
        // ゲームインスタンスからアニメーション状態を取得
        if (window.game && window.game.prizeAnimationCompleted === false) {
            return false; // アニメーション中は表示しない
        }
        return true; // それ以外は表示
    }

    _renderPrizeArea(boardElement, prize, playerType) {
        // HTMLの実際の構造に合わせて修正
        const prizeContainerSelector = playerType === 'player' ? '.side-left' : '.side-right';
        const prizeContainer = boardElement.querySelector(prizeContainerSelector);
        
        if (!prizeContainer) {
            console.warn(`Prize container not found: ${prizeContainerSelector}`);
            return;
        }
        
        noop(`🏆 Rendering ${prize.length} prize cards for ${playerType} in ${prizeContainerSelector}`);
        
        // 各カードスロットにカードを配置
        const prizeSlots = prizeContainer.querySelectorAll('.card-slot');
        const six = Array.isArray(prize) ? prize.slice(0, 6) : new Array(6).fill(null);
        
        prizeSlots.forEach((slot, index) => {
            slot.innerHTML = ''; // 既存内容をクリア
            
            if (index < six.length && six[index] !== null) {
                const card = six[index];
                const cardEl = this._createCardElement(card, playerType, 'prize', index, true); // 裏向き
                
                // カード要素のサイズを調整
                cardEl.style.width = '100%';
                cardEl.style.height = '100%';
                
                slot.appendChild(cardEl);
                noop(`  🃏 Prize card ${index + 1} added to slot`);

                // プレイヤーのサイドカードのみクリック可能にする
                if (playerType === 'player') {
                    this._makeSlotClickable(slot, playerType, 'prize', index);
                }
            }
            // nullの場合は空のスロットのまま（何も表示しない）
        });

        // Badge system removed - prize info now shown in right panel
    }

    /**
     * サイド情報を右パネルに更新
     */
    _updatePrizeStatus(state) {
        const playerPrizeElement = document.getElementById('player-prize-count');
        const cpuPrizeElement = document.getElementById('cpu-prize-count');
        
        if (playerPrizeElement && cpuPrizeElement) {
            // プレイヤーのサイド残り枚数（prizeRemainingが正しいカウンター）
            const playerPrizeRemaining = state.players.player.prizeRemaining || 0;
            const playerPrizeTotal = 6; // 固定値
            
            // CPUのサイド残り枚数
            const cpuPrizeRemaining = state.players.cpu.prizeRemaining || 0;
            const cpuPrizeTotal = 6; // 固定値
            
            playerPrizeElement.textContent = `${playerPrizeRemaining}/${playerPrizeTotal}`;
            cpuPrizeElement.textContent = `${cpuPrizeRemaining}/${cpuPrizeTotal}`;
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
            // Stadiumプレースホルダーも向き制御を適用
            CardOrientationManager.applyCardOrientation(placeholder, 'global', 'stadium');
            stadiumEl.appendChild(placeholder);
        }
    }

        _createCardElement(card, playerType, zone, index, isFaceDown = false) {
        const container = document.createElement('div');
        container.className = 'relative w-full h-full';
        container.style.transformStyle = 'preserve-3d';

        if (!card) {
            container.classList.add('card-placeholder');
            // プレースホルダーも向き制御を適用
            CardOrientationManager.applyCardOrientation(container, playerType, zone);
            return container;
        }

        // --- 向き・所有者は data-* で管理 ---
        if (zone === 'deck') {
            // デッキカードは通常のカードレイヤーに配置
            ZIndexManager.ensureAbovePlaymat(container); // --z-card 相当
        }

        container.dataset.cardId = card.id;
        container.dataset.owner = playerType;
        container.dataset.zone = zone;
        container.dataset.index = index;

        const img = document.createElement('img');
        img.className = 'card-image w-full h-full object-contain rounded-lg';
        // CSSで .card-image { transform: translateZ(0); } を適用
        const shouldShowBack = isFaceDown || card.isPrizeCard;
        if (!shouldShowBack && !card.name_en) {
            console.warn('⚠️ Card missing name_en:', card);
        }
        img.src = shouldShowBack ? 'assets/ui/card_back.webp' : getCardImagePath(card.name_en || 'Unknown', card);
        img.alt = shouldShowBack ? 'Card Back' : card.name_ja;
        container.appendChild(img);

        // 向きを最終確定（data-orientation を付与）
        CardOrientationManager.applyCardOrientation(container, playerType, zone);


        // --- イベントリスナー ---
        // 手札カードのクリック処理は親のhandSlotで処理するため、ここでは削除
        
        // 表向きのカードなら誰のでも詳細表示リスナーを追加
        if (!isFaceDown) {
            container.classList.add('cursor-pointer');
            
            // 右クリックで詳細表示
            container.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showCardInfo(card);
            });
            
            // 左クリック詳細表示を無効化（右クリックのみ）
        }

        if (card.damage > 0) {
            const damageCounter = document.createElement('div');
            damageCounter.className = 'absolute top-1 right-1 bg-red-600 text-white text-lg font-bold rounded-full w-8 h-8 flex items-center justify-center';
            damageCounter.textContent = card.damage;
            damageCounter.style.pointerEvents = 'none';
            // Z-indexに頼らず、3D空間で手前に配置
            damageCounter.style.transform = 'translateZ(1px)';
            container.appendChild(damageCounter);
        }

        return container;
    }

    /**
     * Show detailed card information in a side panel next to the card.
     * @param {Object} card - カードデータ
     */
    showCardInfo(card) {
        if (!card) return;

        // 新モーダルシステムで中央に表示（左画像 / 右情報）
        const imageHtml = `
          <div class="flex-shrink-0 w-48 max-w-[40%]">
            <img src="${getCardImagePath(card.name_en, card)}" 
                 alt="${card.name_ja}" 
                 class="w-full h-auto max-h-64 object-contain rounded-md border border-gray-700"
                 onerror="this.src='assets/ui/card_back.webp'; this.onerror=null;" />
          </div>
        `;
        const detailsHtml = `
          <div class="flex-grow text-left text-[13px] leading-snug space-y-3 min-w-0 overflow-hidden">${this._generateCardInfoHtml(card)}</div>
        `;
        const contentHtml = `
          <div class="flex flex-col md:flex-row gap-4 items-start max-w-full overflow-hidden">
            ${imageHtml}
            ${detailsHtml}
          </div>
        `;

        modalManager.showCentralModal({
            title: null,
            message: contentHtml,
            allowHtml: true,
            actions: [
              { text: '閉じる', callback: () => {}, className: 'px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg' }
            ]
        });
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
        // 正規化
        const typeRaw = (card.card_type || '').toString();
        const typeNorm = typeRaw
            .toLowerCase()
            .replace('é', 'e')      // Pokémon → Pokemon
            .replace('ポケモン', 'pokemon');
        const isPokemon = typeNorm.includes('pokemon');
        const isEnergy = typeNorm.includes('energy');
        const isTrainer = typeNorm.includes('trainer');

        // 見出し
        const nameLine = `
          <div class="flex items-baseline gap-2">
            <h3 class="text-xl font-bold text-white">${card.name_ja || '-'}</h3>
            ${card.name_en ? `<span class="text-gray-400 text-xs">(${card.name_en})</span>` : ''}
          </div>
        `;

        // ルールボックス
        const rule = card.rule_box ? `<span class="ml-2 inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white font-bold align-middle">${card.rule_box}</span>` : '';

        // HPなど（ダメージ未設定なら0）
        const damage = Number(card.damage || 0);
        const hp = Number(card.hp || 0);
        const hpRemain = Math.max(0, hp - damage);
        const hpPct = hp > 0 ? Math.max(0, Math.min(100, Math.round((hpRemain / hp) * 100))) : 0;
        const hpBar = isPokemon ? `
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-red-300 font-semibold">HP ${hpRemain}/${hp}</span>
              <span class="text-gray-400 text-xs">${hpPct}%</span>
            </div>
            <div class="w-full h-2 bg-gray-700 rounded">
              <div class="h-2 rounded" style="width:${hpPct}%; background: linear-gradient(90deg,#22c55e,#ef4444);"></div>
            </div>
          </div>
        ` : '';

        // 属性・進化・にげる
        const typeBadges = (card.types || []).map(t => this._energyBadge(t)).join('');
        const stageLabel = (card.stage || '-')
          .toString()
          .replace(/^basic$/i, 'Basic')
          .replace(/^stage\s*1$/i, 'Stage 1')
          .replace(/^stage\s*2$/i, 'Stage 2')
          .replace(/^stage1$/i, 'Stage 1')
          .replace(/^stage2$/i, 'Stage 2')
          .replace(/^ＢＡＳＩＣ$/i, 'Basic')
          .replace(/^ＢＡＳＩＣ$/i, 'Basic');
        const stageLine = isPokemon ? `
          <div class="flex flex-wrap items-center gap-2 text-gray-300">
            <span><span class="text-purple-300 font-semibold">進化:</span> ${stageLabel}</span>
            ${card.evolves_from ? `<span><span class="text-purple-300 font-semibold">進化元:</span> ${card.evolves_from}</span>` : ''}
            <span class="flex items-center gap-1"><span class="text-green-300 font-semibold">タイプ:</span> ${typeBadges || '-'}</span>
            ${card.retreat_cost !== undefined ? `<span><span class="text-yellow-300 font-semibold">にげる:</span> ${this._colorlessCost(card.retreat_cost)}</span>` : ''}
            ${rule}
          </div>
        ` : '';

        // 付いているエネルギー
        const attachedList = Array.isArray(card.attached_energy) ? card.attached_energy
                            : Array.isArray(card.attachedEnergy) ? card.attachedEnergy
                            : [];
        const energyCounts = this._groupEnergy(attachedList);
        const attachedEnergyHtml = isPokemon ? `
          <div class="bg-gray-800/60 border border-gray-700 rounded-md p-2">
            <div class="text-yellow-200 font-semibold mb-1">付いているエネルギー</div>
            ${energyCounts.length === 0 ? '<div class="text-gray-400 text-xs">なし</div>' : `
              <div class="flex flex-wrap gap-2">
                ${energyCounts.map(({type, count}) => `
                  <div class="flex items-center gap-1 bg-gray-700 rounded px-2 py-1">
                    ${this._energyBadge(type)}
                    <span class="text-white text-sm font-semibold">×${count}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        ` : '';

        // 特性
        const abilityHtml = isPokemon && card.ability ? `
          <div class="bg-gray-800/60 border border-gray-700 rounded-md p-3">
            <div class="text-yellow-300 font-bold mb-1">特性：${card.ability.name_ja || ''}</div>
            <div class="text-gray-300 whitespace-pre-wrap text-[13px]">${card.ability.text_ja || ''}</div>
          </div>
        ` : '';

        // ワザ
        const attacksHtml = isPokemon && Array.isArray(card.attacks) && card.attacks.length > 0 ? `
          <div class="bg-gray-800/60 border border-gray-700 rounded-md p-3">
            <div class="text-red-300 font-bold mb-2">ワザ</div>
            <div class="space-y-2">
              ${card.attacks.map(atk => `
                <div class="pb-2 border-b border-gray-700 last:border-b-0">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-1">${(atk.cost||[]).map(c => this._energyBadge(c)).join('')}</div>
                      <div class="text-white font-semibold">${atk.name_ja || ''}</div>
                    </div>
                    <div class="text-orange-300 font-bold">${atk.damage ?? ''}</div>
                  </div>
                  ${atk.text_ja ? `<div class="text-gray-400 text-[12px] mt-1 whitespace-pre-wrap">${atk.text_ja}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : '';

        // 弱点・抵抗
        // Handle weakness as object or array
        let weakHtml = '';
        if (isPokemon && card.weakness) {
          if (typeof card.weakness === 'object' && card.weakness.type) {
            weakHtml = `<div class="text-gray-300"><span class="text-purple-300 font-semibold">弱点:</span> ${card.weakness.type} ${card.weakness.value}</div>`;
          } else if (Array.isArray(card.weakness) && card.weakness.length > 0) {
            weakHtml = `<div class="text-gray-300"><span class="text-purple-300 font-semibold">弱点:</span> ${card.weakness.map(w => `${w.type} ${w.value}`).join(', ')}</div>`;
          }
        }
        
        // Handle resistance as object or array  
        let resistHtml = '';
        if (isPokemon && card.resistance) {
          if (typeof card.resistance === 'object' && card.resistance.type) {
            resistHtml = `<div class="text-gray-300"><span class="text-cyan-300 font-semibold">抵抗力:</span> ${card.resistance.type} ${card.resistance.value}</div>`;
          } else if (Array.isArray(card.resistance) && card.resistance.length > 0) {
            resistHtml = `<div class="text-gray-300"><span class="text-cyan-300 font-semibold">抵抗力:</span> ${card.resistance.map(r => `${r.type} ${r.value}`).join(', ')}</div>`;
          }
        }

        // 特殊状態
        const condHtml = isPokemon && Array.isArray(card.special_conditions) && card.special_conditions.length > 0 ? `
          <div class="text-gray-300"><span class="text-pink-300 font-semibold">特殊状態:</span> ${card.special_conditions.join(' / ')}</div>
        ` : '';

        // エネルギー / トレーナー
        const nonPokemonHtml = isEnergy
          ? `
              <div class="flex items-center gap-2">
                <span class="text-yellow-300 font-semibold">エネルギー:</span>
                ${this._energyBadge(card.energy_type || 'Colorless')}
                <span class="text-gray-300 text-xs">${card.is_basic ? '基本' : '特殊'}</span>
              </div>
              ${card.text_ja ? `<div class="text-gray-300 whitespace-pre-wrap">${card.text_ja}</div>` : ''}
            `
          : isTrainer
          ? `
              <div class="flex items-center gap-2">
                <span class="text-orange-300 font-semibold">トレーナー:</span>
                <span class="text-gray-200">${card.trainer_type || '-'}</span>
              </div>
              ${card.text_ja ? `<div class="text-gray-300 whitespace-pre-wrap">${card.text_ja}</div>` : ''}
            `
          : '';

        // 組み立て
        let html = nameLine;
        html += isPokemon
          ? `<div class="space-y-3">${hpBar}${stageLine}${abilityHtml}${attacksHtml}${weakHtml}${resistHtml}${condHtml}${attachedEnergyHtml}</div>`
          : `<div class="space-y-3">${nonPokemonHtml}</div>`;

        return html;
    }

    // エネルギーバッジ（小さい丸 + 文字）
    _energyBadge(type) {
        const t = (type || 'Colorless');
        const colors = {
            Grass: '#22c55e', Fire: '#ef4444', Water: '#3b82f6', Lightning: '#f59e0b',
            Psychic: '#a855f7', Fighting: '#ea580c', Darkness: '#374151', Metal: '#9ca3af',
            Fairy: '#ec4899', Dragon: '#22d3ee', Colorless: '#e5e7eb'
        };
        const label = ('' + t).charAt(0);
        const bg = colors[t] || '#9ca3af';
        const fg = t === 'Darkness' ? '#e5e7eb' : '#111827';
        return `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold" style="background:${bg};color:${fg}">${label}</span>`;
    }

    // にげるコスト（無色シンボル）
    _colorlessCost(n = 0) {
        const k = Math.max(0, Number(n) || 0);
        return new Array(k).fill(0).map(() => this._energyBadge('Colorless')).join('');
    }

    // 付いているエネルギーを種類ごとに集計
    _groupEnergy(list) {
        const map = new Map();
        list.forEach(e => {
            const t = typeof e === 'string' ? e : (e?.energy_type || e?.type || 'Colorless');
            map.set(t, (map.get(t) || 0) + 1);
        });
        return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
    }


    /**
     * インタラクティブなメッセージとボタンを表示
     * @param {string} message - 表示するメッセージ
     * @param {Array<Object>} actions - { text: string, callback: Function } の配列
     * @param {string} [type='central'] - 表示タイプ: 'central'(中央モーダル), 'panel'(右パネル), 'toast'(通知)
     */
    showInteractiveMessage(message, actions, type = 'central') {
        // 重要な意思決定は中央モーダルで表示
        if (type === 'central' && actions.length > 0) {
            modalManager.showCentralModal({
                title: null,
                message,
                actions,
                closable: actions.length === 0 // アクションがない場合のみクローズ可能
            });
            return;
        }

        // 通知タイプの場合はトーストで表示
        if (type === 'toast') {
            modalManager.showToast({
                message,
                type: 'info',
                duration: 3000
            });
            return;
        }

        // パネル表示（進行状況・情報表示のみ、ボタンなし）
        if (!this.gameMessageDisplay) {
            errorHandler.handleError(new Error('Game message display not found.'), 'game_state', false);
            return;
        }

        // メッセージを表示（ボタンは表示しない）
        this.gameMessageDisplay.textContent = message;
        this.gameMessageDisplay.classList.remove('hidden');
        animationManager.animateMessage(this.gameMessageDisplay);

        // ボタンがある場合は警告を出す（開発者向け）
        if (actions.length > 0) {
            console.warn('⚠️ Panel type should not have actions. Use central modal or action HUD instead.');
            console.warn('Actions provided:', actions.map(a => a.text));
        }
        
        // ボタンは表示しない（右側パネルはボタンなしポリシー）
        this.clearInteractiveButtons();
    }

    /**
     * 動的に追加されたインタラクティブボタンをクリア（静的ボタンは保護）
     */
    clearInteractiveButtons() {
        if (this.dynamicInteractiveButtonsContainer) {
            this.dynamicInteractiveButtonsContainer.innerHTML = '';
            this.dynamicInteractiveButtonsContainer.classList.add(CSS_CLASSES.HIDDEN); // ボタンがなくなったらコンテナも非表示
            noop('🗑️ Dynamic interactive buttons cleared');
        }
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
     * @param {string} message - エラーメッセージ
     * @param {string} [severity='warning'] - エラーの深刻度: 'info', 'warning', 'error'
     */
    showErrorMessage(message, severity = 'warning') {
        // 深刻度に応じて表示方法を決定
        if (severity === 'error') {
            // 致命的エラーは中央モーダルで表示
            modalManager.showCentralModal({
                title: 'エラー',
                message,
                actions: [{ text: 'OK', callback: () => {} }],
                closable: true
            });
        } else {
            // 軽微なエラーはトーストで表示
            modalManager.showToast({
                message,
                type: severity,
                duration: 4000
            });
        }

        // 従来システムも併用（互換性のため）
        if (this.gameMessageDisplay) {
            this.gameMessageDisplay.textContent = message;
            this.gameMessageDisplay.classList.remove('hidden');
            animationManager.animateError(this.gameMessageDisplay);
        }
    }

    /**
     * 成功メッセージ表示（トースト）
     */
    showSuccessMessage(message, duration = 3000) {
        modalManager.showToast({
            message,
            type: 'success',
            duration
        });
    }

    /**
     * 情報メッセージ表示（トースト）
     */
    showInfoMessage(message, duration = 3000) {
        modalManager.showToast({
            message,
            type: 'info',
            duration
        });
    }

    /**
     * アクションHUDを表示（フローティングHUDにリダイレクト）
     * 右パネルではなく左下のフローティングHUDを使用
     */
    showActionHUD() {
        // フローティングHUDを使用するため、game.jsの _showPlayerMainActions で処理
        noop('🎯 showActionHUD called - handled by floating HUD system');
    }

    /**
     * アクションHUDを非表示
     */
    hideActionHUD() {
        modalManager.hideActionHUD();
    }

    // Generic visibility helpers
    showElement(el) {
        if (el) el.classList.remove('is-hidden');
    }

    hideElement(el) {
        if (el) el.classList.add('is-hidden');
    }

    showHand(owner) {
        const hand = owner === 'player' ? this.playerHand : this.cpuHand;
        this.showElement(hand);
    }

    hideHand(owner) {
        const hand = owner === 'player' ? this.playerHand : this.cpuHand;
        this.hideElement(hand);
    }

    // Action Buttons (Floating HUD System - Direct Management)
    showActionButtons() {
        noop('📋 showActionButtons called - managed directly by game.js floating HUD system');
        // フローティングボタンは game.js の _showFloatingActionButton で直接管理
    }

    hideActionButtons() {
        // modal-managerを使ってすべてのフローティングボタンを非表示にする
        modalManager.hideAllFloatingActionButtons();
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
        }
    }

    setConfirmSetupButtonHandler(handler) {
        if (this.confirmSetupButton) {
            this.confirmSetupButton.onclick = handler;
        }
    }

    _makeSlotClickable(slotElement, owner, zone, index) {
        if (!slotElement || !this.cardClickHandler) {
            return;
        }

        // 重複ハンドラー防止
        if (slotElement.dataset.clickableSet === 'true') {
            return;
        }
        slotElement.dataset.clickableSet = 'true';

        slotElement.style.cursor = 'pointer';

        // CPU側は基本的に操作不可だが、表向きカードは情報表示のためにクリック可能
        if (owner === 'cpu') {
            // 表向きカード（配置済み）のみクリック可能
            const cardInSlot = slotElement.querySelector('[data-card-id]');
            const hasCard = cardInSlot && cardInSlot.dataset.cardId;
            
            if (!hasCard) {
                // カードがないスロットは操作不可
                slotElement.style.pointerEvents = 'none';
                slotElement.style.cursor = 'default';
                return;
            }
            
            // 表向きカードの場合は情報表示用クリックを許可
            slotElement.style.cursor = 'help';
        }

        // シンプルなクリック処理（プレイヤー側の操作 + CPU側の情報表示）
        slotElement.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const cardInSlot = slotElement.querySelector('[data-card-id]');
            const cardId = cardInSlot ? cardInSlot.dataset.cardId : null;

            const dataset = {
                owner: owner,
                zone: zone,
                index: index.toString(),
                cardId: cardId
            };
            
            this.cardClickHandler(dataset);
        });

        // ドロップ処理（プレイヤー側のスロットのみ）
        if (owner === 'player' && this.dragDropHandler) {
            slotElement.addEventListener('dragover', (e) => {
                e.preventDefault();
                slotElement.classList.add('drag-over');
            });

            slotElement.addEventListener('dragleave', (e) => {
                if (!slotElement.contains(e.relatedTarget)) {
                    slotElement.classList.remove('drag-over');
                }
            });

            slotElement.addEventListener('drop', (e) => {
                e.preventDefault();
                slotElement.classList.remove('drag-over');
                
                try {
                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                    this.dragDropHandler({
                        dragData,
                        dropTarget: {
                            owner,
                            zone,
                            index: index.toString()
                        }
                    });
                } catch (error) {
                    console.error('Drop data parsing error:', error);
                }
            });
        }
    }

    _clearBoard() {
        noop('🧹 Clearing board');
        
        // HTMLを空にするだけ - DOMノード自体は保持してイベント重複を防止
        const allSlots = document.querySelectorAll('.card-slot');
        allSlots.forEach(slot => {
            slot.innerHTML = '';
        });
        
        // Clear hand areas
        if (this.playerHand) this.playerHand.innerHTML = '';
        if (this.cpuHand) this.cpuHand.innerHTML = '';
        
        noop('✅ Board cleared');
    }
    
}
