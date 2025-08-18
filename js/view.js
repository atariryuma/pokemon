import { getCardImagePath, nameTranslations } from './cards.js';
import { Logic } from './logic.js';
import { animationManager } from './animations.js';

export class View {
    constructor(animationManager) {
        this.animationManager = animationManager;
        this.isSelectingEnergyTarget = false; // Initialize the flag
        this.elements = {
            gameContainer: document.getElementById('game-root'),
            // Game Header
            turnPlayer: document.getElementById('turn-player'),
            turnIndicator: document.getElementById('turn-indicator'),
            endTurnButton: document.getElementById('end-turn-button'),
            // Game Status
            infoText: document.getElementById('info-text'),
            logScroll: document.getElementById('log-scroll'),
            stadiumCard: document.getElementById('stadium-card'),
            // Action Modal
            actionModal: document.getElementById('action-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalActions: document.getElementById('modal-actions'),
            modalCancelButton: document.getElementById('modal-cancel-button'),

            // CPU elements
            cpuPrizeCount: document.getElementById('cpu-prize'),
            cpuPrizeArea: document.getElementById('cpu-prize-area'),
            cpuDiscard: document.getElementById('cpu-discard'),
            cpuDeck: document.getElementById('cpu-deck'),
            cpuDeckCount: document.getElementById('cpu-deck-count'),
            cpuHand: document.getElementById('cpu-hand'),
            cpuHandCount: document.getElementById('cpu-hand-count'),
            cpuActive: document.getElementById('cpu-active'),
            cpuBench: document.getElementById('cpu-bench'),

            // Player elements
            youPrizeCount: document.getElementById('you-prize'),
            youPrizeArea: document.getElementById('you-prize-area'),
            youDiscard: document.getElementById('you-discard'),
            youDeck: document.getElementById('you-deck'),
            youDeckCount: document.getElementById('you-deck-count'),
            youHand: document.getElementById('you-hand'),
            youHandCount: document.getElementById('you-hand-count'),
            youActive: document.getElementById('you-active'),
            youBench: document.getElementById('you-bench'),
        };

        // セットアップオーバーレイ要素を一度だけ作成し、非表示にしておく
        this.setupOverlay = document.createElement('div');
        this.setupOverlay.id = 'setup-overlay';
        this.setupOverlay.className = 'setup-overlay';
        this.setupOverlay.innerHTML = `
            <div id="setup-modal" class="setup-modal">
                <h2>初期ポケモン選択</h2>
                <p>手札からバトルポケモンとベンチポケモンを選んでください。</p>
                <div id="setup-hand-display" class="hand-display"></div>
                <div class="setup-slots">
                    <div id="setup-active-slot" class="card-slot setup-slot" data-slot-type="active">バトルポケモン</div>
                    <div id="setup-bench-slots" class="bench-slots"></div>
                </div>
                <button id="setup-confirm-button" class="btn btn-primary">確定</button>
            </div>
        `;
        this.elements.gameContainer.appendChild(this.setupOverlay);
        this.setupOverlay.style.display = 'none'; // 最初は非表示

        // ベンチスロットの作成
        const benchSlotsContainer = this.setupOverlay.querySelector('#setup-bench-slots');
        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('div');
            slot.className = 'card-slot setup-slot';
            slot.textContent = `ベンチ ${i + 1}`;
            slot.dataset.slotType = 'bench';
            slot.dataset.slotIndex = i;
            benchSlotsContainer.appendChild(slot);
        }

        // 攻撃選択モーダルを作成
        this.attackModal = document.createElement('div');
        this.attackModal.id = 'attack-modal';
        this.attackModal.className = 'modal-overlay';
        this.attackModal.innerHTML = `
            <div class="modal-content">
                <h3 id="attack-modal-title">攻撃を選択</h3>
                <div id="attack-pokemon-info" class="pokemon-info"></div>
                <div id="attack-list" class="attack-list"></div>
                <div class="modal-buttons">
                    <button id="attack-cancel-button" class="btn btn-ghost">キャンセル</button>
                </div>
            </div>
        `;
        this.elements.gameContainer.appendChild(this.attackModal);
        this.attackModal.style.display = 'none';

        // にげる選択モーダルを作成
        this.retreatModal = document.createElement('div');
        this.retreatModal.id = 'retreat-modal';
        this.retreatModal.className = 'modal-overlay';
        this.retreatModal.innerHTML = `
            <div class="modal-content">
                <h3 id="retreat-modal-title">入れ替えるポケモンを選択</h3>
                <div id="retreat-pokemon-info" class="pokemon-info"></div>
                <div id="bench-selection" class="bench-selection"></div>
                <div class="modal-buttons">
                    <button id="retreat-cancel-button" class="btn btn-ghost">キャンセル</button>
                </div>
            </div>
        `;
        this.elements.gameContainer.appendChild(this.retreatModal);
        this.retreatModal.style.display = 'none';

        // カード詳細モーダルを作成
        this.cardDetailModal = document.createElement('div');
        this.cardDetailModal.className = 'card-detail-modal';
        this.cardDetailModal.setAttribute('role', 'dialog');
        this.cardDetailModal.setAttribute('aria-modal', 'true');
        this.cardDetailModal.setAttribute('aria-hidden', 'true');
        this.cardDetailModal.setAttribute('aria-labelledby', 'card-detail-title');
        this.cardDetailModal.innerHTML = `
            <div class="card-detail-content">
                <button class="card-detail-close" aria-label="閉じる">×</button>
                <div class="card-preview">
                    <img class="full-card-image" alt="カード画像" />
                </div>
                <div class="card-stats">
                    <div class="detail-section basic-info-section">
                        <h3 id="card-detail-title">基本情報</h3>
                        <div class="basic-info"></div>
                    </div>
                    <div class="detail-section attacks-section">
                        <h3>攻撃技</h3>
                        <div class="attacks-list"></div>
                    </div>
                    <div class="detail-section abilities-section">
                        <h3>特性</h3>
                        <div class="abilities-list"></div>
                    </div>
                    <div class="detail-section weakness-resistance-section">
                        <h3>弱点・抵抗力</h3>
                        <div class="weakness-resistance-info"></div>
                    </div>
                </div>
            </div>
        `;
        this.elements.gameContainer.appendChild(this.cardDetailModal);

        // モーダル閉じるイベント
        this.cardDetailModal.querySelector('.card-detail-close').addEventListener('click', () => {
            this.hideCardDetailModal();
        });
        this.cardDetailModal.addEventListener('click', (e) => {
            if (e.target === this.cardDetailModal) {
                this.hideCardDetailModal();
            }
        });
    }

    /**
     * ゲームの状態をDOMにレンダリングする
     * @param {GameState} state - 現在のゲーム状態
     * @param {object} setupSelection - セットアップフェーズの選択状態 (Gameクラスから渡される)
     */
    render(state, setupSelection = null) {
        // 状態の明示的な参照を確保し、すべてのヘルパー関数に渡す
        this._renderPlayerZone(state.players.cpu, 'cpu', state);
        this._renderPlayerZone(state.players.player, 'you', state);
        this._renderGlobalInfo(state);

        // Handle draw animation
        if (this.drawnCardToAnimate) {
            const drawnCardElement = this.elements.youHand.querySelector(`[data-card-id="${this.drawnCardToAnimate.id}"]`);
            if (drawnCardElement) {
                const deckElement = this.elements.youDeck; // Assuming player's deck
                const fromPosition = deckElement.getBoundingClientRect();
                const toPosition = drawnCardElement.getBoundingClientRect();

                // Temporarily position the card element for animation
                drawnCardElement.style.position = 'fixed';
                drawnCardElement.style.left = `${fromPosition.left}px`;
                drawnCardElement.style.top = `${fromPosition.top}px`;
                drawnCardElement.style.zIndex = '9999';

                this.animationManager.animateDrawCard(drawnCardElement);
            }
            this.drawnCardToAnimate = null; // Clear the flag
        }

        // Apply/remove selectable-target class based on game state
        const playerActiveCard = this.elements.youActive.querySelector('.card');
        if (playerActiveCard) {
            if (this.isSelectingEnergyTarget) {
                playerActiveCard.classList.add('selectable-target');
            } else {
                playerActiveCard.classList.remove('selectable-target');
            }
        }

        this.elements.youBench.querySelectorAll('.card').forEach(benchCard => {
            if (this.isSelectingEnergyTarget) {
                benchCard.classList.add('selectable-target');
            } else {
                benchCard.classList.remove('selectable-target');
            }
        });

        // セットアップフェーズのUI表示/非表示
        if (state.gamePhase === 'initialPokemonSelection') {
            this._hideActionModal(); // 既存のアクションモーダルを非表示
            this._showSetupOverlay(state, setupSelection);
        } else {
            this._hideSetupOverlay();
        }

        // 新アクティブ選択フェーズの処理
        if (state.gamePhase === 'selectNewActive') {
            this._highlightSelectableActivePokemon(state);
        }
        else {
            this._clearSelectableHighlights();
        }
    }

    /**
     * プレイヤー（またはCPU）のゾーンをレンダリングする
     * @param {Player} player - プレイヤーオブジェクト
     * @param {string} ownerType - 'you' または 'cpu'
     * @param {GameState} state - 現在のゲーム状態
     */
    _renderPlayerZone(player, ownerType, state) {
        const prefix = ownerType;

        // サイドカード
        const prizeCountElement = this.elements[`${prefix}PrizeCount`];
        if (prizeCountElement) prizeCountElement.textContent = player.prizeCards.length;

        const prizeAreaElement = this.elements[`${prefix}PrizeArea`];
        if (prizeAreaElement) {
            prizeAreaElement.innerHTML = '';
            // サイドカードを2x3グリッドで表示
            for (let i = 0; i < 6; i++) {
                const prizeCardSlot = document.createElement('div');
                prizeCardSlot.className = 'card prize-card-slot';
                if (i < player.prizeCards.length) {
                    prizeCardSlot.dataset.face = 'down';
                    
                    // 裏面画像を追加
                    const cardBackImage = document.createElement('img');
                    cardBackImage.className = 'card-back-image';
                    cardBackImage.src = 'assets/card_back.webp';
                    cardBackImage.alt = 'サイドカード';
                    prizeCardSlot.appendChild(cardBackImage);
                } else {
                    prizeCardSlot.style.opacity = '0.3';
                    prizeCardSlot.style.border = '2px dashed var(--neutral-400)';
                    prizeCardSlot.style.background = 'transparent';
                }
                prizeAreaElement.appendChild(prizeCardSlot);
            }
        }

        // トラッシュ
        const discardElement = this.elements[`${prefix}Discard`];
        if (discardElement) {
            discardElement.innerHTML = '';
            if (player.discardPile.length > 0) {
                const topCard = player.discardPile[player.discardPile.length - 1];
                const cardElement = this._createCardElement(topCard, ownerType, 'up', 'discard');
                discardElement.appendChild(cardElement);
            }
        }

        // デッキ
        const deckElement = this.elements[`${prefix}Deck`];
        if (deckElement) {
            deckElement.innerHTML = '';
            if (player.deck.length > 0) {
                const deckCard = document.createElement('div');
                deckCard.className = 'card';
                deckCard.dataset.face = 'down';
                
                // 裏面画像を追加
                const cardBackImage = document.createElement('img');
                cardBackImage.className = 'card-back-image';
                cardBackImage.src = 'assets/card_back.webp';
                cardBackImage.alt = 'カード裏面';
                deckCard.appendChild(cardBackImage);
                
                deckElement.appendChild(deckCard);
            }
        }
        const deckCountElement = this.elements[`${prefix}DeckCount`];
        if (deckCountElement) deckCountElement.textContent = player.deck.length;

        // 手札
        const handElement = this.elements[`${prefix}Hand`];
        if (handElement) {
            handElement.innerHTML = '';
            const handCardElements = []; // Correctly declare the array here
            player.hand.forEach(card => {
                const face = (ownerType === 'cpu') ? 'down' : 'up'; // CPUの手札は裏向き
                const cardElement = this._createCardElement(card, ownerType, face, 'hand');
                handElement.appendChild(cardElement);
                if (ownerType === 'you' && face === 'up') { // Only animate player's face-up hand
                    handCardElements.push(cardElement);
                }
            });
            // Trigger hand entry animation for player's hand
            if (handCardElements.length > 0) {
                this.animationManager.animateHandEntry(handCardElements);
            }
        }
        
        // 手札カウント
        const handCountElement = this.elements[`${prefix}HandCount`];
        if (handCountElement) handCountElement.textContent = player.hand.length;

        // バトルポケモン
        const activeElement = this.elements[`${prefix}Active`];
        if (activeElement) {
            activeElement.innerHTML = '';
            if (player.activePokemon) {
                const activeCard = this._createCardElement(player.activePokemon, ownerType, 'up', 'active');
                
                activeElement.appendChild(activeCard);

                // プレイヤーのアクティブポケモンにアクションボタンを追加
                if (ownerType === 'you' && state.currentTurnPlayerId === 'player' && state.gamePhase === 'playerTurn') {
                    const actionButtons = document.createElement('div');
                    actionButtons.className = 'pokemon-actions';
                    
                    const attackButton = document.createElement('button');
                    attackButton.className = 'btn btn-primary btn-small';
                    attackButton.textContent = '攻撃';
                    attackButton.dataset.action = 'attack';
                    attackButton.dataset.pokemonId = player.activePokemon.id;
                    
                    const retreatButton = document.createElement('button');
                    retreatButton.className = 'btn btn-secondary btn-small';
                    retreatButton.textContent = 'にげる';
                    retreatButton.dataset.action = 'retreat';
                    retreatButton.dataset.pokemonId = player.activePokemon.id;

                    // にげるボタンは、にげることができない場合は無効化
                    const canRetreat = Logic.canRetreat(player.activePokemon, player.bench);
                    retreatButton.disabled = !canRetreat;

                    actionButtons.appendChild(attackButton);
                    actionButtons.appendChild(retreatButton);
                    activeElement.appendChild(actionButtons);
                }
            }
        }

        // ベンチポケモン
        const benchElement = this.elements[`${prefix}Bench`];
        if (benchElement) {
            benchElement.innerHTML = '';
            // ベンチスロットを常に5つ表示
            for (let i = 0; i < 5; i++) {
                const benchSlot = document.createElement('div');
                benchSlot.className = 'bench-slot';
                if (player.bench[i]) {
                    const benchCard = this._createCardElement(player.bench[i], ownerType, 'up', 'bench');
                    benchSlot.appendChild(benchCard);
                } else {
                    benchSlot.classList.add('placeholder');
                    benchSlot.style.border = '2px dashed var(--text-muted)';
                    benchSlot.style.background = 'rgba(255, 255, 255, 0.1)';
                    benchSlot.style.borderRadius = 'var(--radius-md)';
                    benchSlot.style.minHeight = 'var(--card-height)';
                }
                benchElement.appendChild(benchSlot);
            }
        }
    }

    /**
     * グローバルな情報（ターン、メッセージなど）をレンダリングする
     * @param {GameState} state - 現在のゲーム状態
     */
    _renderGlobalInfo(state) {
        this.elements.turnPlayer.textContent = state.currentTurnPlayerId === 'player' ? 'あなた' : 'CPU';
        this.elements.turnIndicator.textContent = `Turn ${state.turnCount}`;
        this.elements.infoText.textContent = state.message;

        // ボタンの有効/無効化
        const isPlayerTurn = state.currentTurnPlayerId === 'player' && state.gamePhase === 'playerTurn';
        this.elements.endTurnButton.disabled = !isPlayerTurn;

        // セットアップフェーズ中はコントロールボタンを無効化
        if (state.gamePhase === 'initialPokemonSelection') {
            this.elements.endTurnButton.disabled = true;
        }

        // ターン切り替え時の表示調整
        const battleField = document.getElementById('battle-field');
        if (battleField) {
            battleField.className = 'main-battlefield';
            if (state.currentTurnPlayerId === 'player') {
                battleField.classList.add('current-turn-player');
            } else {
                battleField.classList.add('current-turn-cpu');
            }
        }
    }

    /**
     * カードのDOM要素を作成する
     * @param {Card} card - カードオブジェクト
     * @param {string} ownerType - 'you' または 'cpu'
     * @param {string} face - 'up' または 'down'
     * @param {string} zone - 'deck', 'hand', 'active', 'bench', 'prize', 'discard', 'stadium'
     * @returns {HTMLElement} カードのDOM要素
     */
    _createCardElement(card, ownerType, face, zone) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.dataset.cardId = card.id;
        cardDiv.dataset.owner = ownerType;
        cardDiv.dataset.zone = zone;
        cardDiv.dataset.face = face;
        
        // アクセシビリティ属性
        cardDiv.tabIndex = 0;
        cardDiv.setAttribute('role', 'button');
        cardDiv.setAttribute('aria-label', `${card.name_ja}カード。右クリックで詳細表示`);
        if (card.card_type === 'Pokémon') {
            cardDiv.setAttribute('aria-describedby', `card-${card.id}-description`);
        }

        if (face === 'down') {
            // 裏面表示：card_back.webpを使用
            const cardBackImage = document.createElement('img');
            cardBackImage.className = 'card-back-image';
            cardBackImage.src = 'assets/card_back.webp';
            cardBackImage.alt = 'カード裏面';
            cardDiv.appendChild(cardBackImage);
            return cardDiv;
        }

        // カードフレーム
        const cardFrame = document.createElement('div');
        cardFrame.className = 'card-frame';
        cardDiv.appendChild(cardFrame);

        // カード画像（適切なエラーハンドリング付き）
        const cardImage = document.createElement('img');
        cardImage.className = 'card-image';
        cardImage.alt = card.name_ja;
        
        // 画像のロード処理
        this._loadCardImage(cardImage, card);
        cardFrame.appendChild(cardImage);

        // HP (ポケモンカードのみ) - ダメージを受けている場合のみ表示
        if (card.card_type === 'Pokémon' && card.hp) {
            const currentHp = card.currentHp !== undefined ? card.currentHp : card.hp;
            if (currentHp < card.hp) {
                const cardHp = document.createElement('div');
                cardHp.className = 'card-hp';
                cardHp.textContent = `${currentHp}/${card.hp}`;
                
                // ダメージ状態に応じて色を変更
                const hpRatio = currentHp / card.hp;
                if (hpRatio <= 0.25) {
                    cardHp.style.background = 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)';
                } else if (hpRatio <= 0.5) {
                    cardHp.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                }
                
                cardFrame.appendChild(cardHp);
            }
        }

        // 特殊状態の表示
        if (card.specialConditions && card.specialConditions.length > 0) {
            const statusContainer = document.createElement('div');
            statusContainer.className = 'special-status';
            card.specialConditions.forEach(condition => {
                const statusIcon = document.createElement('span');
                statusIcon.className = `status-icon status-${condition}`;
                statusIcon.textContent = this._getStatusIcon(condition);
                statusContainer.appendChild(statusIcon);
            });
            cardFrame.appendChild(statusContainer);
        }

        // 右クリックイベントで詳細モーダルを表示（セットアップフェーズ中は無効）
        cardDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // セットアップオーバーレイが表示されている場合は詳細モーダルを表示しない
            if (this.setupOverlay.style.display !== 'none') {
                return;
            }
            this.showCardDetailModal(card);
        });

        // キーボードナビゲーション対応
        cardDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.showCardDetailModal(card);
            }
        });

        return cardDiv;
    }

    /**
     * カード画像を安全にロードする
     * @param {HTMLImageElement} imageElement - 画像要素
     * @param {Card} card - カードデータ
     */
    _loadCardImage(imageElement, card) {
        let imagePath;
        
        if (card.card_type === 'Basic Energy' && card.energy_type) {
            // 利用可能なエネルギータイプのマッピング
            const availableEnergyTypes = [
                'Colorless', 'Grass', 'Fire', 'Water', 'Lightning', 
                'Psychic', 'Fighting', 'Darkness'
            ];
            
            if (availableEnergyTypes.includes(card.energy_type)) {
                imagePath = `assets/Energy_${card.energy_type}.webp`;
            } else {
                // 利用可能でないエネルギータイプの場合、無色エネルギーを使用
                console.warn(`Energy type ${card.energy_type} not available, using Colorless as fallback`);
                imagePath = 'assets/Energy_Colorless.webp';
            }
        } else if (card.name_en) {
            imagePath = getCardImagePath(card.name_en);
        } else {
            // フォールバック: カード裏面画像を使用
            imagePath = 'assets/card_back.webp';
        }
        
        imageElement.src = imagePath;
        
        // 画像ロードエラー時のフォールバック
        imageElement.addEventListener('error', () => {
            console.warn(`Failed to load image: ${imagePath}`);
            if (card.card_type === 'Basic Energy') {
                // エネルギーカードの場合は無色エネルギーにフォールバック
                imageElement.src = 'assets/Energy_Colorless.webp';
                imageElement.alt = `${card.name_ja} (代替エネルギー画像)`;
            } else {
                // その他の場合はカード裏面画像にフォールバック
                imageElement.src = 'assets/card_back.webp';
                imageElement.alt = `${card.name_ja} (画像なし)`;
            }
        });
        
        // 画像の読み込み完了時にフェードイン効果
        imageElement.addEventListener('load', () => {
            imageElement.style.opacity = '0';
            imageElement.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                imageElement.style.opacity = '1';
            }, 50);
        });
    }

    /**
     * タイプアイコンを取得
     * @param {string} type - ポケモンタイプ
     * @returns {string} タイプアイコン
     */
    _getTypeIcon(type) {
        const typeIcons = {
            'Fire': '🔥',
            'Water': '💧',
            'Grass': '🌿',
            'Electric': '⚡',
            'Psychic': '🔮',
            'Fighting': '👊',
            'Darkness': '🌙',
            'Metal': '⚙️',
            'Fairy': '✨',
            'Dragon': '🐉',
            'Colorless': '⭐'
        };
        return typeIcons[type] || '❓';
    }

    /**
     * エネルギーアイコンを取得
     * @param {string} energyType - エネルギータイプ
     * @returns {string} エネルギーアイコン
     */
    _getEnergyIcon(energyType) {
        const energyIcons = {
            'Fire': '🔥',
            'Water': '💧',
            'Grass': '🌿',
            'Electric': '⚡',
            'Psychic': '🔮',
            'Fighting': '👊',
            'Darkness': '🌙',
            'Metal': '⚙️',
            'Fairy': '✨',
            'Dragon': '🐉',
            'Colorless': '○'
        };
        return energyIcons[energyType] || '●';
    }

    /**
     * イベントリスナーを設定する
     * @param {object} handlers - イベントハンドラのオブジェクト
     * @param {function} handlers.onEndTurnClick - ターン終了ボタンクリック時のハンドラ
     * @param {function} handlers.onCardClick - カードクリック時のハンドラ
     * @param {function} handlers.onSetupConfirm - セットアップ確定ボタンクリック時のハンドラ
     * @param {function} handlers.onSetupHandClick - セットアップ手札クリック時のハンドラ
     * @param {function} handlers.onSetupSlotClick - セットアップスロットクリック時のハンドラ
     * @param {function} handlers.onAttackClick - 攻撃ボタンクリック時のハンドラ
     * @param {function} handlers.onRetreatClick - にげるボタンクリック時のハンドラ
     */
    bindEvents(handlers) {
        this.elements.endTurnButton.addEventListener('click', handlers.onEndTurnClick);

        // カードクリックイベント (動的に追加される要素なので親要素に委譲)
        // main-battlefield全体でイベントを拾う（新レイアウト対応）
        const battlefieldElement = document.getElementById('battle-field') || document.querySelector('.main-battlefield');
        if (battlefieldElement) {
            battlefieldElement.addEventListener('click', (event) => {
                const cardElement = event.target.closest('.card');
                if (cardElement) {
                    const cardId = cardElement.dataset.cardId;
                    const owner = cardElement.dataset.owner;
                    const zone = cardElement.dataset.zone;
                    handlers.onCardClick(cardId, owner, zone);
                }

                // アクションボタンのクリックイベント
                const actionButton = event.target.closest('[data-action]');
                if (actionButton) {
                    const action = actionButton.dataset.action;
                    if (action === 'attack') {
                        handlers.onAttackClick();
                    } else if (action === 'retreat') {
                        handlers.onRetreatClick();
                    }
                }
            });
        }

        // Add event listener for target selection mode
        const playerZones = document.getElementById('you-side'); // Assuming player's side
        if (playerZones) {
            playerZones.addEventListener('click', (event) => {
                console.log("Click event in playerZones.", event.target);
                let targetElement = event.target;
                // Traverse up the DOM tree until a .card element is found or null
                while (targetElement && !targetElement.classList.contains('card')) {
                    targetElement = targetElement.parentElement;
                }

                if (targetElement && targetElement.classList.contains('selectable-target')) {
                    console.log("Selectable target card clicked (direct check):", targetElement);
                    const cardId = targetElement.dataset.cardId;
                    const owner = targetElement.dataset.owner;
                    const zone = targetElement.dataset.zone;
                    handlers.onTargetPokemonClick(cardId, owner, zone);
                } else {
                    console.log("Click on playerZones, but not on a selectable-target card or its descendant (direct check).");
                }
            });
        }

        // セットアップオーバーレイのイベントハンドラをここでバインド
        this.setupOverlay.querySelector('#setup-confirm-button').addEventListener('click', handlers.onSetupConfirm);
        this.setupOverlay.querySelector('#setup-hand-display').addEventListener('click', (event) => {
            const cardElement = event.target.closest('.card');
            if (cardElement) {
                handlers.onSetupHandClick(cardElement.dataset.cardId);
            }
        });
        this.setupOverlay.querySelector('#setup-active-slot').addEventListener('click', (event) => {
            handlers.onSetupSlotClick('active', null);
        });
        this.setupOverlay.querySelector('#setup-bench-slots').addEventListener('click', (event) => {
            const slotElement = event.target.closest('.setup-slot');
            if (slotElement) {
                handlers.onSetupSlotClick(slotElement.dataset.slotType, parseInt(slotElement.dataset.slotIndex));
            }
        });

        // セットアップフェーズ用のイベントハンドラ (Gameクラスからバインドされる)
        this.setupConfirmHandler = handlers.onSetupConfirm;
        this.setupHandClickHandler = handlers.onSetupHandClick;
        this.setupSlotClickHandler = handlers.onSetupSlotClickHandler;
    }

    /**
     * セットアップオーバーレイを表示する
     * @param {GameState} state
     * @param {object} setupSelection - セットアップフェーズの選択状態 (Gameクラスから渡される)
     */
    _showSetupOverlay(state, setupSelection) {
        console.log('Showing setup overlay', state.gamePhase);
        
        // すべてのモーダルを非表示にしてから表示
        this._hideActionModal();
        this.hideAttackModal();
        this.hideRetreatModal();
        
        // セットアップオーバーレイを強制的に表示
        this.setupOverlay.style.display = 'flex';
        this.setupOverlay.style.position = 'fixed';
        this.setupOverlay.style.top = '0';
        this.setupOverlay.style.left = '0';
        this.setupOverlay.style.width = '100%';
        this.setupOverlay.style.height = '100%';
        this.setupOverlay.style.zIndex = '10000'; // 他のモーダルより高い値
        this.setupOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.setupOverlay.style.alignItems = 'center';
        this.setupOverlay.style.justifyContent = 'center';
        this.setupOverlay.hidden = false;

        // 手札の表示を更新
        this._renderSetupOverlayContent(state, setupSelection);

        // 確定ボタンの有効/無効化
        // this._updateSetupConfirmButtonState(); // Gameクラスで呼び出す
    }

    /**
     * セットアップオーバーレイを非表示にする
     */
    _hideSetupOverlay() {
        this.setupOverlay.style.display = 'none';
    }

    /**
     * 既存のアクションモーダルを非表示にする
     */
    _hideActionModal() {
        const actionModal = document.getElementById('action-modal');
        if (actionModal) {
            actionModal.style.display = 'none';
            actionModal.hidden = true;
        }
    }

    _renderSetupOverlayContent(state, setupSelection) {
        console.log('Rendering setup overlay content');
        console.log('Player hand:', state.players.player.hand);
        console.log('Basic Pokemon in hand:', state.players.player.hand.filter(card => card.card_type === 'Pokémon' && card.stage === 'BASIC'));
        
        const setupHandDisplay = document.getElementById('setup-hand-display');
        if (!setupHandDisplay) {
            console.error('setup-hand-display element not found!');
            return;
        }
        
        // setupSelectionがundefinedの場合のデフォルト値を設定
        const selection = setupSelection || {
            active: null,
            bench: [],
            currentCard: null
        };
        
        setupHandDisplay.innerHTML = '';
        const basicPokemon = state.players.player.hand.filter(card => card.card_type === 'Pokémon' && card.stage === 'BASIC');
        
        if (basicPokemon.length === 0) {
            setupHandDisplay.innerHTML = '<p class="no-pokemon">手札にたねポケモンがありません。</p>';
            console.warn('No basic Pokemon found in hand!');
        } else {
            basicPokemon.forEach(card => {
                const cardElement = this._createCardElement(card, 'you', 'up', 'hand');
                cardElement.classList.add('selectable');
                if (selection.currentCard && selection.currentCard.id === card.id) {
                    cardElement.classList.add('selected');
                }
                setupHandDisplay.appendChild(cardElement);
            });
            console.log(`Added ${basicPokemon.length} basic Pokemon to setup display`);
        }

        const activeSlot = document.getElementById('setup-active-slot');
        activeSlot.innerHTML = '';
        if (selection.active) {
            activeSlot.appendChild(this._createCardElement(selection.active, 'you', 'up', 'active'));
            activeSlot.dataset.cardId = selection.active.id;
        } else {
            activeSlot.textContent = 'バトルポケモン';
            activeSlot.dataset.cardId = '';
        }

        const benchSlotsContainer = document.getElementById('setup-bench-slots');
        benchSlotsContainer.innerHTML = ''; // Clear existing bench slots
        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('div');
            slot.className = 'card-slot setup-slot';
            slot.dataset.slotType = 'bench';
            slot.dataset.slotIndex = i;

            if (selection.bench[i]) {
                slot.appendChild(this._createCardElement(selection.bench[i], 'you', 'up', 'bench'));
                slot.dataset.cardId = selection.bench[i].id;
            } else {
                slot.textContent = `ベンチ ${i + 1}`;
                slot.dataset.cardId = '';
            }
            benchSlotsContainer.appendChild(slot);
        }
    }

    // セットアップフェーズ用のイベントハンドラ (Gameクラスからバインドされる)
    setupConfirmHandler = () => {};
    setupHandClickHandler = () => {};
    setupSlotClickHandler = () => {};

    // ハイライト関連のメソッド
    highlightSetupCard(cardId) {
        document.querySelectorAll('#setup-hand-display .card').forEach(el => this.animationManager.unhighlightCard(el)); // Use animationManager
        const cardElement = document.querySelector(`#setup-hand-display [data-card-id="${cardId}"]`);
        if (cardElement) {
            this.animationManager.highlightCard(cardElement); // Use animationManager
        }
    }

    clearSetupHighlights() {
        document.querySelectorAll('#setup-hand-display .card').forEach(el => this.animationManager.unhighlightCard(el)); // Use animationManager
    }

    prepareDrawAnimation(drawnCard) {
        this.drawnCardToAnimate = drawnCard;
    }

    /**
     * 攻撃選択モーダルを表示する
     * @param {Card} pokemon - 攻撃するポケモン
     * @param {function} onAttackSelect - 攻撃選択時のコールバック
     * @param {function} onCancel - キャンセル時のコールバック
     */
    showAttackModal(pokemon, onAttackSelect, onCancel) {
        this.attackModal.style.display = 'flex';

        // ポケモン情報を表示
        const pokemonInfo = document.getElementById('attack-pokemon-info');
        pokemonInfo.innerHTML = `
            <div class="pokemon-card-info">
                <img src="${getCardImagePath(pokemon.name_en)}" alt="${pokemon.name_ja}" class="pokemon-image">
                <div class="pokemon-details">
                    <h4>${pokemon.name_ja}</h4>
                    <p>HP: ${pokemon.currentHp}/${pokemon.hp}</p>
                    <p>エネルギー: ${pokemon.attachedEnergy ? pokemon.attachedEnergy.length : 0}個</p>
                </div>
            </div>
        `;

        // 攻撃リストを表示
        const attackList = document.getElementById('attack-list');
        attackList.innerHTML = '';

        const availableAttacks = Logic.getAvailableAttacks(pokemon);
        availableAttacks.forEach(({ index, attack, canUse }) => {
            const attackButton = document.createElement('button');
            attackButton.className = `attack-option ${canUse ? 'btn btn-primary' : 'btn btn-disabled'}`;
            attackButton.disabled = !canUse;
            
            attackButton.innerHTML = `
                <div class="attack-info">
                    <div class="attack-name">${attack.name_ja}</div>
                    <div class="attack-damage">ダメージ: ${attack.damage}</div>
                    <div class="attack-cost">コスト: ${attack.cost.join(', ')}</div>
                    <div class="attack-effect">${attack.effect_ja || ''}</div>
                </div>
            `;

            if (canUse) {
                attackButton.addEventListener('click', () => {
                    this.hideAttackModal();
                    onAttackSelect(index);
                });
            }

            attackList.appendChild(attackButton);
        });

        // キャンセルボタンのイベントリスナー
        const cancelButton = document.getElementById('attack-cancel-button');
        cancelButton.onclick = () => {
            this.hideAttackModal();
            onCancel();
        };
    }

    /**
     * 攻撃選択モーダルを非表示にする
     */
    hideAttackModal() {
        this.attackModal.style.display = 'none';
    }

    /**
     * にげる選択モーダルを表示する
     * @param {Card} activePokemon - 現在のアクティブポケモン
     * @param {Array<Card>} benchPokemon - ベンチのポケモン
     * @param {function} onPokemonSelect - ポケモン選択時のコールバック
     * @param {function} onCancel - キャンセル時のコールバック
     */
    showRetreatModal(activePokemon, benchPokemon, onPokemonSelect, onCancel) {
        this.retreatModal.style.display = 'flex';

        // 現在のアクティブポケモン情報を表示
        const pokemonInfo = document.getElementById('retreat-pokemon-info');
        pokemonInfo.innerHTML = `
            <div class="pokemon-card-info">
                <img src="${getCardImagePath(activePokemon.name_en)}" alt="${activePokemon.name_ja}" class="pokemon-image">
                <div class="pokemon-details">
                    <h4>${activePokemon.name_ja}</h4>
                    <p>HP: ${activePokemon.currentHp}/${activePokemon.hp}</p>
                    <p>にげるコスト: ${activePokemon.retreat_cost ? activePokemon.retreat_cost.length : 0}</p>
                    <p>エネルギー: ${activePokemon.attachedEnergy ? activePokemon.attachedEnergy.length : 0}個</p>
                </div>
            </div>
        `;

        // ベンチポケモン選択肢を表示
        const benchSelection = document.getElementById('bench-selection');
        benchSelection.innerHTML = '';

        if (benchPokemon.length === 0) {
            benchSelection.innerHTML = '<p class="no-pokemon">ベンチにポケモンがいません。</p>';
        } else {
            benchPokemon.forEach((pokemon, index) => {
                const pokemonButton = document.createElement('button');
                pokemonButton.className = 'bench-option btn btn-primary';
                
                pokemonButton.innerHTML = `
                    <div class="bench-pokemon-info">
                        <img src="${getCardImagePath(pokemon.name_en)}" alt="${pokemon.name_ja}" class="pokemon-image-small">
                        <div class="pokemon-details-small">
                            <div class="pokemon-name">${pokemon.name_ja}</div>
                            <div class="pokemon-hp">HP: ${pokemon.currentHp}/${pokemon.hp}</div>
                        </div>
                    </div>
                `;

                pokemonButton.addEventListener('click', () => {
                    this.hideRetreatModal();
                    onPokemonSelect(pokemon.id);
                });

                benchSelection.appendChild(pokemonButton);
            });
        }

        // キャンセルボタンのイベントリスナー
        const cancelButton = document.getElementById('retreat-cancel-button');
        cancelButton.onclick = () => {
            this.hideRetreatModal();
            onCancel();
        };
    }

    /**
     * にげる選択モーダルを非表示にする
     */
    hideRetreatModal() {
        this.retreatModal.style.display = 'none';
    }

    enterTargetSelectionMode(activePokemon, benchPokemon) {
        console.log("Entering target selection mode.");
        this.isSelectingEnergyTarget = true; // Set flag
    }

    exitTargetSelectionMode() {
        this.isSelectingEnergyTarget = false; // Clear flag
    }

    /**
     * 新アクティブ選択可能なポケモンをハイライト
     * @param {GameState} state
     */
    _highlightSelectableActivePokemon(state) {
        // プレイヤーのベンチポケモンをハイライト
        const benchElement = this.elements.youBench;
        if (benchElement) {
            const benchCards = benchElement.querySelectorAll('.card[data-owner="you"][data-zone="bench"]');
            benchCards.forEach(card => {
                card.classList.add('selectable');
            });
        }
    }

    /**
     * 選択可能ハイライトをクリア
     */
    _clearSelectableHighlights() {
        const selectableCards = document.querySelectorAll('.card.selectable');
        selectableCards.forEach(card => {
            card.classList.remove('selectable');
        });
    }

    async animateCardPlacement(cardElement, targetSlotElement) {
        const fromRect = cardElement.getBoundingClientRect();
        const toRect = targetSlotElement.getBoundingClientRect();

        const fromPosition = { x: fromRect.left, y: fromRect.top };
        const toPosition = { x: toRect.left, y: toRect.top };

        await this.animationManager.animatePlayCard(cardElement, fromPosition, toPosition);
    }

    /**
     * 特殊状態のアイコンを取得
     * @param {string} condition - 特殊状態
     * @returns {string} アイコン文字
     */
    _getStatusIcon(condition) {
        const icons = {
            poisoned: '☠️',
            burned: '🔥',
            asleep: '💤',
            paralyzed: '⚡',
            confused: '💫'
        };
        return icons[condition] || '❓';
    }

    /**
     * カード詳細モーダルを表示する
     * @param {Card} card - 表示するカード
     */
    showCardDetailModal(card) {
        // 画像を設定
        const cardImage = this.cardDetailModal.querySelector('.full-card-image');
        if (card.card_type === 'Basic Energy' && card.energy_type) {
            const availableEnergyTypes = [
                'Colorless', 'Grass', 'Fire', 'Water', 'Lightning', 
                'Psychic', 'Fighting', 'Darkness'
            ];
            
            if (availableEnergyTypes.includes(card.energy_type)) {
                cardImage.src = `assets/Energy_${card.energy_type}.webp`;
            } else {
                console.warn(`Energy type ${card.energy_type} not available in modal, using Colorless as fallback`);
                cardImage.src = 'assets/Energy_Colorless.webp';
            }
        } else if (card.name_en) {
            cardImage.src = getCardImagePath(card.name_en);
        } else {
            cardImage.src = 'assets/card_back.webp';
        }
        cardImage.alt = card.name_ja;

        // 基本情報を設定
        this._renderBasicInfo(card);
        
        // 攻撃技を設定（ポケモンの場合）
        this._renderAttacks(card);
        
        // 特性を設定（ポケモンの場合）
        this._renderAbilities(card);
        
        // 弱点・抵抗力を設定（ポケモンの場合）
        this._renderWeaknessResistance(card);

        // モーダルを表示
        this.cardDetailModal.classList.add('show');
        this.cardDetailModal.removeAttribute('aria-hidden'); // Remove aria-hidden when shown
        document.body.style.overflow = 'hidden';
        
        // フォーカス管理
        const closeButton = this.cardDetailModal.querySelector('.card-detail-close');
        closeButton.focus();
    }

    /**
     * カード詳細モーダルを非表示にする
     */
    hideCardDetailModal() {
        this.cardDetailModal.classList.remove('show');
        this.cardDetailModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        // Remove focus from the close button to prevent aria-hidden warning
        const closeButton = this.cardDetailModal.querySelector('.card-detail-close');
        if (closeButton) {
            closeButton.blur();
        }
    }

    /**
     * 基本情報をレンダリング
     * @param {Card} card 
     */
    _renderBasicInfo(card) {
        const basicInfoDiv = this.cardDetailModal.querySelector('.basic-info');
        basicInfoDiv.innerHTML = '';

        const info = [
            { label: '名前', value: card.name_ja },
            { label: '英名', value: card.name_en },
            { label: 'カードタイプ', value: card.card_type },
        ];

        if (card.card_type === 'Pokémon') {
            info.push(
                { label: 'HP', value: card.hp },
                { label: 'タイプ', value: card.type },
                { label: '進化段階', value: card.stage },
                { label: 'にげるコスト', value: card.retreat_cost ? card.retreat_cost.length : 0 }
            );
        } else if (card.card_type === 'Basic Energy') {
            info.push({ label: 'エネルギータイプ', value: card.energy_type });
        }

        info.forEach(item => {
            const infoItem = document.createElement('div');
            infoItem.className = 'info-item';
            infoItem.innerHTML = `
                <span class="info-label">${item.label}</span>
                <span class="info-value">${item.value}</span>
            `;
            basicInfoDiv.appendChild(infoItem);
        });
    }

    /**
     * 攻撃技をレンダリング
     * @param {Card} card 
     */
    _renderAttacks(card) {
        const attacksDiv = this.cardDetailModal.querySelector('.attacks-list');
        attacksDiv.innerHTML = '';

        if (card.card_type !== 'Pokémon' || !card.attacks || card.attacks.length === 0) {
            attacksDiv.innerHTML = '<p style="color: #cbd5e1; font-style: italic;">攻撃技なし</p>';
            return;
        }

        card.attacks.forEach(attack => {
            const attackItem = document.createElement('div');
            attackItem.className = 'attack-item';
            
            const costIcons = attack.cost.map(energyType => {
                return `<span class="energy-icon energy-${energyType.toLowerCase()}">${energyType.charAt(0)}</span>`;
            }).join('');

            attackItem.innerHTML = `
                <div class="attack-header">
                    <span class="attack-name">${attack.name_ja}</span>
                    <span class="attack-damage">${attack.damage || 0}</span>
                </div>
                <div class="attack-cost">${costIcons}</div>
                ${attack.effect_ja ? `<div class="attack-effect">${attack.effect_ja}</div>` : ''}
            `;
            attacksDiv.appendChild(attackItem);
        });
    }

    /**
     * 特性をレンダリング
     * @param {Card} card 
     */
    _renderAbilities(card) {
        const abilitiesDiv = this.cardDetailModal.querySelector('.abilities-list');
        abilitiesDiv.innerHTML = '';

        if (card.card_type !== 'Pokémon' || !card.ability) {
            abilitiesDiv.innerHTML = '<p style="color: #cbd5e1; font-style: italic;">特性なし</p>';
            return;
        }

        const abilityItem = document.createElement('div');
        abilityItem.className = 'attack-item'; // 同じスタイルを使用
        abilityItem.innerHTML = `
            <div class="attack-header">
                <span class="attack-name">${card.ability.name_ja}</span>
            </div>
            <div class="attack-effect">${card.ability.effect_ja}</div>
        `;
        abilitiesDiv.appendChild(abilityItem);
    }

    /**
     * 弱点・抵抗力をレンダリング
     * @param {Card} card 
     */
    _renderWeaknessResistance(card) {
        const wrDiv = this.cardDetailModal.querySelector('.weakness-resistance-info');
        wrDiv.innerHTML = '';

        if (card.card_type !== 'Pokémon') {
            wrDiv.innerHTML = '<p style="color: #cbd5e1; font-style: italic;">該当なし</p>';
            return;
        }

        const info = [];
        
        if (card.weakness && card.weakness.type !== 'None') {
            info.push({ label: '弱点', value: `${card.weakness.type} ${card.weakness.value}` });
        }
        
        if (card.resistance && card.resistance.type !== 'None') {
            info.push({ label: '抵抗力', value: `${card.resistance.type} ${card.resistance.value}` });
        }

        if (info.length === 0) {
            wrDiv.innerHTML = '<p style="color: #cbd5e1; font-style: italic;">弱点・抵抗力なし</p>';
            return;
        }

        info.forEach(item => {
            const infoItem = document.createElement('div');
            infoItem.className = 'info-item';
            infoItem.innerHTML = `
                <span class="info-label">${item.label}</span>
                <span class="info-value">${item.value}</span>
            `;
            wrDiv.appendChild(infoItem);
        });
    }
}