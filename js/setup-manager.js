/**
 * SETUP-MANAGER.JS - セットアップフェーズ専用処理
 * 
 * 初期ポケモン選択、マリガン、サイドカード配置などを管理
 */

import { animationManager } from './animations.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';

/**
 * セットアップ管理クラス
 */
export class SetupManager {
  constructor() {
    this.mulliganCount = 0;
    this.maxMulligans = 3; // 最大マリガン回数
  }

  /**
   * ゲーム初期化とセットアップ開始
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async initializeGame(state) {
    console.log('🎮 Starting game initialization...');
    let newState = cloneGameState(state);

    // 1. デッキシャッフルアニメーション
    await this.animateDeckShuffle();

    // 2. 初期手札をドロー（7枚）
    newState = await this.drawInitialHands(newState);

    // 3. マリガンチェックと処理
    newState = await this.handleMulligans(newState);

    // 4. 初期ポケモン選択フェーズに移行（サイドカードは後で配布）
    newState.phase = GAME_PHASES.INITIAL_POKEMON_SELECTION;
    newState.prompt.message = 'まず手札のたねポケモンをクリックして選択し、次にバトル場またはベンチをクリックして配置してください。';

    newState = addLogEntry(newState, {
      type: 'setup_complete',
      message: 'ゲームセットアップが完了しました'
    });

    console.log('✅ Game initialization completed');
    return newState;
  }

  /**
   * デッキシャッフルアニメーション
   */
  async animateDeckShuffle() {
    console.log('🔀 Animating deck shuffle...');
    
    const playerDeck = document.querySelector('.player-self .deck-container');
    const cpuDeck = document.querySelector('.opponent-board .deck-container');
    
    if (playerDeck && cpuDeck) {
      // シャッフルアニメーションを同時実行
      await Promise.all([
        this.shuffleDeckAnimation(playerDeck),
        this.shuffleDeckAnimation(cpuDeck)
      ]);
    }
  }

  /**
   * 単一デッキのシャッフルアニメーション
   */
  async shuffleDeckAnimation(deckElement) {
    return new Promise(resolve => {
      // シャッフルエフェクト（3回震わせる）
      let shakeCount = 0;
      const shakeInterval = setInterval(() => {
        deckElement.style.transform = `translateX(${Math.random() * 6 - 3}px) translateY(${Math.random() * 6 - 3}px)`;
        shakeCount++;

        if (shakeCount >= 6) {
          clearInterval(shakeInterval);
          deckElement.style.transform = '';
          resolve();
        }
      }, 100);
    });
  }

  /**
   * 初期手札ドロー（7枚ずつ）
   */
  async drawInitialHands(state) {
    console.log('🎴 Drawing initial hands...');
    let newState = cloneGameState(state);

    // プレイヤーとCPUの初期手札をドロー
    for (let i = 0; i < 7; i++) {
      // プレイヤーのドロー
      if (newState.players.player.deck.length > 0) {
        const playerCard = newState.players.player.deck.shift();
        newState.players.player.hand.push(playerCard);
      }

      // CPUのドロー
      if (newState.players.cpu.deck.length > 0) {
        const cpuCard = newState.players.cpu.deck.shift();
        newState.players.cpu.hand.push(cpuCard);
      }
    }

    console.log('🎴 Hand draw completed. Player:', newState.players.player.hand.length, 'CPU:', newState.players.cpu.hand.length);
    
    // 手札の内容をデバッグ出力
    console.log('👤 Player hand contents:');
    newState.players.player.hand.forEach((card, index) => {
      console.log(`  ${index + 1}. ${card.name_ja} (${card.card_type}, stage: ${card.stage})`);
    });
    
    const playerBasicPokemon = newState.players.player.hand.filter(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );
    console.log(`🔍 Player Basic Pokemon found: ${playerBasicPokemon.length}`);
    playerBasicPokemon.forEach(pokemon => {
      console.log(`  - ${pokemon.name_ja}`);
    });
    
    // Note: アニメーションはGame.jsでview.render()の後に呼ばれる
    // ここでは状態の更新のみを行い、アニメーションは別途実行する

    return newState;
  }

  /**
   * 初期ドローアニメーション
   */
  async animateInitialDraw() {
    const playerHand = document.getElementById('player-hand');
    const cpuHand = document.getElementById('cpu-hand');

    if (playerHand) {
      const playerCards = Array.from(playerHand.querySelectorAll('.relative'));
      if (playerCards.length > 0) {
        await animationManager.animateInitialPlayerHandDeal(playerCards, 200);
      }
    }

    if (cpuHand) {
      const cpuCards = Array.from(cpuHand.querySelectorAll('.relative'));
      if (cpuCards.length > 0) {
        await animationManager.animateInitialHandDeal(cpuCards, 200);
      }
    }
  }

  /**
   * マリガンチェックと処理
   */
  async handleMulligans(state) {
    console.log('🔄 Checking for mulligans...');
    let newState = cloneGameState(state);

    const playerNeedsMultigan = !this.hasBasicPokemon(newState.players.player);
    const cpuNeedsMultigan = !this.hasBasicPokemon(newState.players.cpu);

    console.log('🔍 Mulligan check results:');
    console.log(`  Player needs mulligan: ${playerNeedsMultigan}`);
    console.log(`  CPU needs mulligan: ${cpuNeedsMultigan}`);

    if (playerNeedsMultigan || cpuNeedsMultigan) {
      this.mulliganCount++;
      
      if (this.mulliganCount <= this.maxMulligans) {
        console.log(`🔄 Mulligan #${this.mulliganCount} required`);
        
        let mulliganMessage = '';
        if (playerNeedsMultigan && cpuNeedsMultigan) {
          mulliganMessage = `双方ともたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
        } else if (playerNeedsMultigan) {
          mulliganMessage = `あなたの手札にたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
        } else {
          mulliganMessage = `相手の手札にたねポケモンがありません。マリガンします (${this.mulliganCount}回目)`;
        }
        
        newState = addLogEntry(newState, {
          type: 'mulligan',
          message: mulliganMessage
        });

        // UI に一時的にマリガンメッセージを表示
        newState.prompt.message = mulliganMessage + ' 新しい手札を配り直しています...';

        // マリガン処理
        if (playerNeedsMultigan) {
          console.log('🔄 Performing player mulligan...');
          newState = await this.performMulligan(newState, 'player');
        }
        if (cpuNeedsMultigan) {
          console.log('🔄 Performing CPU mulligan...');
          newState = await this.performMulligan(newState, 'cpu');
        }

        // 再帰的にマリガンチェック
        return await this.handleMulligans(newState);
      } else {
        console.warn('⚠️ Maximum mulligans exceeded, proceeding with current hands');
        newState = addLogEntry(newState, {
          type: 'mulligan_limit',
          message: `マリガン上限に達しました。現在の手札でゲームを開始します。`
        });
      }
    } else {
      console.log('✅ No mulligan needed, both players have Basic Pokemon');
    }

    return newState;
  }

  /**
   * たねポケモンを持っているかチェック
   */
  hasBasicPokemon(playerState) {
    return playerState.hand.some(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );
  }

  /**
   * マリガン処理
   */
  async performMulligan(state, playerId) {
    console.log(`🔄 Performing mulligan for ${playerId}`);
    let newState = cloneGameState(state);
    const playerState = newState.players[playerId];

    // 手札をデッキに戻してシャッフル
    playerState.deck.push(...playerState.hand);
    playerState.hand = [];
    
    // デッキをシャッフル
    this.shuffleArray(playerState.deck);

    // 新しい7枚をドロー
    for (let i = 0; i < 7; i++) {
      if (playerState.deck.length > 0) {
        const card = playerState.deck.shift();
        playerState.hand.push(card);
      }
    }

    // マリガンアニメーション
    await this.animateMulligan(playerId);

    return newState;
  }

  /**
   * マリガンアニメーション
   */
  async animateMulligan(playerId) {
    const handElement = playerId === 'player' 
      ? document.getElementById('player-hand')
      : document.getElementById('cpu-hand');

    if (handElement) {
      // コンテナの不透明度は触らない（バグ原因のため）
      // 新しい手札の入場のみをアニメーション
      const cards = Array.from(handElement.querySelectorAll('.relative'));
      if (cards.length > 0) {
        await animationManager.animateHandEntry(cards);
      }
    }
  }

  /**
   * サイドカード配置
   */
  async setupPrizeCards(state) {
    console.log('🏆 Setting up prize cards...');
    let newState = cloneGameState(state);

    // プレイヤーのサイドカード
    for (let i = 0; i < 6; i++) {
      if (newState.players.player.deck.length > 0) {
        const prizeCard = newState.players.player.deck.shift();
        newState.players.player.prize.push(prizeCard);
      }
    }

    // CPUのサイドカード
    for (let i = 0; i < 6; i++) {
      if (newState.players.cpu.deck.length > 0) {
        const prizeCard = newState.players.cpu.deck.shift();
        newState.players.cpu.prize.push(prizeCard);
      }
    }

    // Note: アニメーションはGame.jsでview.render()の後に呼ばれる
    // ここでは状態の更新のみを行う

    return newState;
  }

  /**
   * サイドカード配置アニメーション
   */
  async animatePrizeCardSetup() {
    const playerPrizes = document.querySelectorAll('.player-self .side-left .card-slot');
    const cpuPrizes = document.querySelectorAll('.opponent-board .side-right .card-slot');

    const allPrizes = [...Array.from(playerPrizes), ...Array.from(cpuPrizes)];
    
    if (allPrizes.length > 0) {
      await animationManager.animatePrizeDeal(allPrizes, 150);
    }
  }

  /**
   * 初期ポケモン選択の処理
   */
  async handlePokemonSelection(state, playerId, cardId, targetZone, targetIndex = 0) {
    console.log(`🎯 Pokemon selection: ${playerId} places ${cardId} in ${targetZone}`);
    console.log(`📋 Before selection - ${playerId} hand:`, state.players[playerId].hand.length, 'cards');
    
    let newState = cloneGameState(state);
    const playerState = newState.players[playerId];
    
    // 安全な手札コピーを作成
    const handCopy = [...playerState.hand];
    console.log(`📏 Hand copy created with ${handCopy.length} cards`);

    // 手札からカードを見つける
    const cardIndex = handCopy.findIndex(card => card.id === cardId);
    if (cardIndex === -1) {
      console.warn(`⚠️ Card ${cardId} not found in ${playerId} hand`);
      console.log('Available cards in hand:', handCopy.map(c => c.id));
      return state;
    }

    const card = handCopy[cardIndex];
    console.log(`🃏 Found card: ${card.name_ja} at index ${cardIndex}`);

    // たねポケモンかチェック
    if (card.card_type !== 'Pokémon' || card.stage !== 'BASIC') {
      console.warn(`⚠️ Invalid card type: ${card.card_type}, stage: ${card.stage}. Only Basic Pokemon allowed.`);
      return state; // 状態を変更せずに戻す
    }

    // 配置先の有効性をチェック
    let canPlace = false;
    
    if (targetZone === 'active') {
      if (playerState.active === null) {
        canPlace = true;
        console.log(`✅ Active slot is empty, can place ${card.name_ja}`);
      } else {
        console.warn(`⚠️ Active slot already occupied by ${playerState.active.name_ja}`);
      }
    } else if (targetZone === 'bench') {
      if (targetIndex >= 0 && targetIndex < 5 && playerState.bench[targetIndex] === null) {
        canPlace = true;
        console.log(`✅ Bench slot ${targetIndex} is empty, can place ${card.name_ja}`);
      } else {
        const occupiedBy = playerState.bench[targetIndex]?.name_ja || 'Invalid index';
        console.warn(`⚠️ Bench slot ${targetIndex} is occupied by ${occupiedBy} or invalid`);
      }
    }

    if (!canPlace) {
      console.log(`❌ Cannot place ${card.name_ja} in ${targetZone}${targetZone === 'bench' ? `[${targetIndex}]` : ''}`);
      return state; // 状態を変更せずに戻す
    }

    // ここで初めて手札からカードを削除
    playerState.hand = handCopy.filter(c => c.id !== cardId);
    console.log(`✂️ Removed card from hand. New hand size: ${playerState.hand.length}`);

    // 配置処理（セットアップ中は裏向き）
    const cardWithSetupFlag = { ...card, setupFaceDown: true };
    
    if (targetZone === 'active') {
      playerState.active = cardWithSetupFlag;
      newState = addLogEntry(newState, {
        type: 'pokemon_placement',
        message: `${card.name_ja}をバトル場に配置しました（裏向き）`
      });
      console.log(`✅ Placed ${card.name_ja} in active position (face down)`);
    } else if (targetZone === 'bench') {
      playerState.bench[targetIndex] = cardWithSetupFlag;
      newState = addLogEntry(newState, {
        type: 'pokemon_placement',
        message: `${card.name_ja}をベンチに配置しました（裏向き）`
      });
      console.log(`✅ Placed ${card.name_ja} in bench slot ${targetIndex} (face down)`);
    }

    console.log(`📋 After selection - ${playerId} hand:`, playerState.hand.length, 'cards');
    console.log(`🎯 Placement successful: ${card.name_ja} -> ${targetZone}${targetZone === 'bench' ? `[${targetIndex}]` : ''}`);
    
    // プレイヤーが最初のポケモンを配置した時、CPUも同期して配置
    if (playerId === 'player' && !newState.players.cpu.active) {
      console.log('🔄 Triggering CPU pokemon setup...');
      newState = await this.setupCpuInitialPokemon(newState);
    }
    
    return newState;
  }

  /**
   * CPU用の自動初期ポケモン配置
   */
  async setupCpuInitialPokemon(state) {
    console.log('🤖 Setting up CPU initial Pokemon...');
    let newState = cloneGameState(state);
    const cpuState = newState.players.cpu;

    // バトル場用のたねポケモンを見つける
    const basicPokemon = cpuState.hand.filter(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );

    if (basicPokemon.length === 0) {
      console.warn('⚠️ CPU has no basic Pokemon for active position');
      return newState;
    }

    // 最初のたねポケモンをバトル場に配置（裏向き）
    const activeCandidate = basicPokemon[0];
    const activeIndex = cpuState.hand.findIndex(card => card.id === activeCandidate.id);
    const activePokemon = cpuState.hand.splice(activeIndex, 1)[0];
    cpuState.active = { ...activePokemon, setupFaceDown: true };

    // 残りのたねポケモンをベンチに配置（最大5体、裏向き）
    const remainingBasic = cpuState.hand.filter(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );

    let benchCount = 0;
    for (const pokemon of remainingBasic) {
      if (benchCount >= 5) break;
      
      const benchIndex = cpuState.hand.findIndex(card => card.id === pokemon.id);
      if (benchIndex !== -1) {
        const benchPokemon = cpuState.hand.splice(benchIndex, 1)[0];
        cpuState.bench[benchCount] = { ...benchPokemon, setupFaceDown: true };
        benchCount++;
      }
    }

    newState = addLogEntry(newState, {
      type: 'cpu_setup',
      message: `CPUが初期ポケモンを配置しました（バトル場: ${cpuState.active.name_ja}, ベンチ: ${benchCount}体）`
    });

    // CPU配置アニメーション
    await this.animateCpuPokemonPlacement();

    return newState;
  }

  /**
   * CPU配置アニメーション
   */
  async animateCpuPokemonPlacement() {
    const cpuActive = document.querySelector('.opponent-board .active-top');
    const cpuBench = document.querySelectorAll('.opponent-board .top-bench-1, .opponent-board .top-bench-2, .opponent-board .top-bench-3, .opponent-board .top-bench-4, .opponent-board .top-bench-5');

    const elements = [cpuActive, ...Array.from(cpuBench)];
    
    for (const element of elements) {
      if (element && element.children.length > 0) {
        await animationManager.animatePlayCard(
          element.children[0],
          { x: element.offsetLeft, y: element.offsetTop - 100 },
          { x: element.offsetLeft, y: element.offsetTop }
        );
      }
    }
  }

  /**
   * セットアップ完了チェック
   */
  isSetupComplete(state) {
    const playerReady = state.players.player.active !== null;
    const cpuReady = state.players.cpu.active !== null;
    
    return playerReady && cpuReady;
  }

  /**
   * セットアップ確定処理
   */
  async confirmSetup(state) {
    console.log('✅ Confirming setup...');
    let newState = cloneGameState(state);

    // プレイヤーのセットアップ完了チェック
    const playerHasActiveBasic = newState.players.player.active && 
                                 newState.players.player.active.card_type === 'Pokémon' && 
                                 newState.players.player.active.stage === 'BASIC';
    
    console.log('🔍 Setup validation:');
    console.log(`  Player active Pokemon: ${newState.players.player.active?.name_ja || 'None'}`);
    console.log(`  Is Basic Pokemon: ${playerHasActiveBasic}`);

    if (!playerHasActiveBasic) {
      console.warn('⚠️ Player setup not complete - no Basic Pokemon in active position');
      newState = addLogEntry(newState, {
        type: 'setup_error',
        message: 'バトル場にたねポケモンを配置してください。'
      });
      return newState;
    }

    // CPUの初期ポケモンが未配置の場合は自動配置
    if (!newState.players.cpu.active) {
      console.log('🤖 Setting up CPU Pokemon automatically...');
      newState = await this.setupCpuInitialPokemon(newState);
    }

    // 両プレイヤーがたねポケモンを持っているか最終確認
    if (!newState.players.cpu.active) {
      console.error('❌ CPU could not set up active Pokemon');
      newState = addLogEntry(newState, {
        type: 'setup_error',
        message: '相手がたねポケモンを配置できません。ゲームを再開始してください。'
      });
      return newState;
    }

    // プレイヤーターンに移行
    newState.phase = GAME_PHASES.PLAYER_DRAW;
    newState.prompt.message = '山札をクリックしてカードを引いてください。';
    newState.setupSelection.confirmed = true;

    // ターン制約をリセット
    newState.hasDrawnThisTurn = false;
    newState.hasAttachedEnergyThisTurn = false;
    newState.canRetreat = true;
    newState.canPlaySupporter = true;

    newState = addLogEntry(newState, {
      type: 'setup_confirmed',
      message: `セットアップが完了しました。ゲーム開始！ あなた: ${newState.players.player.active.name_ja}, 相手: ${newState.players.cpu.active.name_ja}`
    });

    console.log('✅ Setup confirmed successfully');
    return newState;
  }

  /**
   * 配列シャッフルユーティリティ
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * ポケモン配置確定後のサイドカード配布処理
   */
  async confirmPokemonSetupAndProceedToPrizes(state) {
    console.log('✅ Pokemon setup confirmed, proceeding to prize cards...');
    let newState = cloneGameState(state);
    
    // フェーズをサイドカード配布に変更
    newState.phase = GAME_PHASES.PRIZE_CARD_SETUP;
    
    // サイドカード配布
    newState = await this.setupPrizeCards(newState);
    
    // ゲーム開始準備完了フェーズに移行
    newState.phase = GAME_PHASES.GAME_START_READY;
    
    newState = addLogEntry(newState, {
      type: 'prize_setup_complete',
      message: 'サイドカードが配布されました。ゲーム開始の準備が整いました！'
    });
    
    return newState;
  }

  /**
   * ゲーム開始時の表向き公開処理
   */
  async startGameRevealCards(state) {
    console.log('🎬 Starting game with card reveal...');
    let newState = cloneGameState(state);
    
    // 全てのセットアップ用裏向きフラグを削除
    if (newState.players.player.active) {
      delete newState.players.player.active.setupFaceDown;
    }
    if (newState.players.cpu.active) {
      delete newState.players.cpu.active.setupFaceDown;
    }
    
    // ベンチのフラグも削除
    for (let i = 0; i < 5; i++) {
      if (newState.players.player.bench[i]) {
        delete newState.players.player.bench[i].setupFaceDown;
      }
      if (newState.players.cpu.bench[i]) {
        delete newState.players.cpu.bench[i].setupFaceDown;
      }
    }
    
    // フェーズをプレイヤーターンに移行
    newState.phase = GAME_PHASES.PLAYER_TURN;
    newState.turn = 1;
    newState.turnPlayer = 'player';
    
    newState = addLogEntry(newState, {
      type: 'game_start',
      message: 'バトル開始！全てのポケモンが公開されました！'
    });
    
    return newState;
  }

  /**
   * ゲーム開始モーダルを表示
   */
  showGameStartModal() {
    console.log('🎮 Showing game start modal...');
    const modal = document.getElementById('action-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const actions = document.getElementById('modal-actions');

    if (!modal || !title || !body || !actions) {
      console.error('❌ Modal elements not found');
      return;
    }

    title.textContent = 'ポケモンカードゲーム';
    body.innerHTML = `
      <div class="text-center">
        <p class="text-lg mb-4">バトルの準備をしましょう！</p>
        <p class="text-sm text-gray-300">山札をシャッフルして手札を配ります</p>
      </div>
    `;

    actions.innerHTML = `
      <button id="start-deal-cards" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg">
        手札を配る
      </button>
    `;

    // ボタンイベント
    document.getElementById('start-deal-cards').addEventListener('click', () => {
      this.handleStartDealCards();
    });

    // モーダル表示
    modal.classList.remove('hidden');
  }

  /**
   * 手札配布開始の処理
   */
  async handleStartDealCards() {
    console.log('🎴 Starting card deal...');
    const modal = document.getElementById('action-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const actions = document.getElementById('modal-actions');

    // モーダル内容を更新
    title.textContent = '手札配布中...';
    body.innerHTML = `
      <div class="text-center">
        <p class="text-lg mb-4">山札から7枚ずつ配布しています</p>
        <div class="animate-pulse text-blue-400">●●●</div>
      </div>
    `;
    actions.innerHTML = '';

    // 実際の手札配布処理をトリガー
    window.gameInstance?.triggerInitialSetup();
  }

  /**
   * セットアップ状態リセット
   */
  reset() {
    this.mulliganCount = 0;
    console.log('🔄 Setup manager reset');
  }
}

// デフォルトのセットアップマネージャーインスタンス
export const setupManager = new SetupManager();
