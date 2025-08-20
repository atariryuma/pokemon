/**
 * SETUP-MANAGER.JS - セットアップフェーズ専用処理
 * 
 * 初期ポケモン選択、マリガン、サイドカード配置などを管理
 */

import { animationManager, unifiedAnimationManager } from './unified-animations.js';
import { CardOrientationManager } from './card-orientation.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';
import * as Logic from './logic.js';

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
    return newState;
  }

  /**
   * デッキシャッフルアニメーション
   */
  async animateDeckShuffle() {
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

    newState = addLogEntry(newState, {
      type: 'initial_draw',
      message: '両プレイヤーが初期手札を引きました。'
    });
    
    // 手札配布完了後、1.5秒待機してCPUの初期ポケモン配置を自動実行（非ブロッキング）
    setTimeout(() => {
      if (window.gameInstance) {
        // プレイヤー操作をブロックしない非同期実行
        this.startNonBlockingCpuSetup();
      }
    }, 1500);
    
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
        await unifiedAnimationManager.animateHandDeal(playerCards, 'player');
      }
    }

    if (cpuHand) {
      const cpuCards = Array.from(cpuHand.querySelectorAll('.relative'));
      if (cpuCards.length > 0) {
        await unifiedAnimationManager.animateHandDeal(cpuCards, 'cpu');
      }
    }
  }

  /**
   * マリガンチェックと処理
   */
  async handleMulligans(state) {
    let newState = cloneGameState(state);

    const playerNeedsMultigan = !this.hasBasicPokemon(newState.players.player);
    const cpuNeedsMultigan = !this.hasBasicPokemon(newState.players.cpu);

    if (playerNeedsMultigan || cpuNeedsMultigan) {
      this.mulliganCount++;
      
      if (this.mulliganCount <= this.maxMulligans) {
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
          newState = await this.performMulligan(newState, 'player');
        }
        if (cpuNeedsMultigan) {
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
    let newState = cloneGameState(state);

    // プレイヤーのサイドカード（裏面フラグ付き）
    for (let i = 0; i < 6; i++) {
      if (newState.players.player.deck.length > 0) {
        const prizeCard = newState.players.player.deck.shift();
        newState.players.player.prize.push({ ...prizeCard, isPrizeCard: true });
      }
    }

    // CPUのサイドカード（裏面フラグ付き）
    for (let i = 0; i < 6; i++) {
      if (newState.players.cpu.deck.length > 0) {
        const prizeCard = newState.players.cpu.deck.shift();
        newState.players.cpu.prize.push({ ...prizeCard, isPrizeCard: true });
      }
    }

    // Note: アニメーションはGame.jsでview.render()の後に呼ばれる
    // ここでは状態の更新のみを行う

    return newState;
  }


  /**
   * 初期ポケモン選択の処理
   */
  async handlePokemonSelection(state, playerId, cardId, targetZone, targetIndex = 0) {
    
    // 状態の有効性チェック
    if (!state.players || !state.players[playerId]) {
      console.error(`❌ Invalid state: player ${playerId} not found`);
      return state;
    }
    
    let newState = cloneGameState(state);
    const playerState = newState.players[playerId];
    
    // 手札が空でないことを確認
    if (!playerState.hand || playerState.hand.length === 0) {
      console.warn(`⚠️ Player ${playerId} has no cards in hand`);
      return state;
    }
    
    // 安全な手札コピーを作成
    const handCopy = [...playerState.hand];

    // 手札からカードを見つける
    const cardIndex = handCopy.findIndex(card => card.id === cardId);
    if (cardIndex === -1) {
      console.warn(`⚠️ Card ${cardId} not found in ${playerId} hand`);
      return state;
    }

    const card = handCopy[cardIndex];

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
      } else {
        console.warn(`⚠️ Active slot already occupied by ${playerState.active.name_ja}`);
      }
    } else if (targetZone === 'bench') {
      if (targetIndex >= 0 && targetIndex < 5 && playerState.bench[targetIndex] === null) {
        canPlace = true;
      } else {
        const occupiedBy = playerState.bench[targetIndex]?.name_ja || 'Invalid index';
        console.warn(`⚠️ Bench slot ${targetIndex} is occupied by ${occupiedBy} or invalid`);
      }
    }

    if (!canPlace) {
      return state; // 状態を変更せずに戻す
    }

    // ここで初めて手札からカードを削除
    playerState.hand = handCopy.filter(c => c.id !== cardId);

    // 配置処理（セットアップ中は裏向き）
    const cardWithSetupFlag = { ...card, setupFaceDown: true };
    
    if (targetZone === 'active') {
      playerState.active = cardWithSetupFlag;
      newState = addLogEntry(newState, {
        type: 'pokemon_placement',
        message: `${card.name_ja}をバトル場に配置しました（裏向き）`
      });
    } else if (targetZone === 'bench') {
      playerState.bench[targetIndex] = cardWithSetupFlag;
      newState = addLogEntry(newState, {
        type: 'pokemon_placement',
        message: `${card.name_ja}をベンチに配置しました（裏向き）`
      });
    }
    
    // Note: CPU初期配置は手札配布後に自動実行されるため、ここでのトリガーは不要
    
    return newState;
  }

  /**
   * 統一CPU ポケモン配置関数（初期・ゲーム中両対応）
   */
  async unifiedCpuPokemonSetup(state, isInitialSetup = false) {
    try {
      let newState = cloneGameState(state);
      const cpuState = newState.players.cpu;
      
      // 基本ポケモンをフィルタリング
      const basicPokemon = cpuState.hand.filter(card => 
        card.card_type === 'Pokémon' && card.stage === 'BASIC'
      );
      
      if (basicPokemon.length === 0) {
        console.warn('⚠️ CPU has no Basic Pokemon for setup');
        return newState;
      }
      
      // 初期セットアップの場合: アクティブ + ベンチ
      if (isInitialSetup) {
        // CPUがすでにアクティブポケモンを持っている場合はスキップ
        if (newState.players.cpu.active) {
          return newState;
        }
        
        // 1. アクティブポケモン配置
        const activeCandidate = basicPokemon[0];
        
        newState = Logic.placeCardInActive(newState, 'cpu', activeCandidate.id);
        
        if (newState.players.cpu.active) {
          newState.players.cpu.active.setupFaceDown = true;
          
          // 統一アニメーション実行
          await unifiedAnimationManager.createUnifiedCardAnimation(
            'cpu', activeCandidate.id, 'hand', 'active', 0, 
            { isSetupPhase: true, card: activeCandidate }
          );
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        // 2. ベンチポケモン配置（残りの基本ポケモン、最大5体）
        const remainingBasic = newState.players.cpu.hand.filter(card => 
          card.card_type === 'Pokémon' && card.stage === 'BASIC'
        );
        
        let benchCount = 0;
        for (const pokemon of remainingBasic) {
          if (benchCount >= 5) break;
          
          newState = Logic.placeCardOnBench(newState, 'cpu', pokemon.id, benchCount);
          
          if (newState.players.cpu.bench[benchCount]) {
            newState.players.cpu.bench[benchCount].setupFaceDown = true;
            
            // 統一アニメーション実行
            await unifiedAnimationManager.createUnifiedCardAnimation(
              'cpu', pokemon.id, 'hand', 'bench', benchCount, 
              { isSetupPhase: true, card: pokemon }
            );
            benchCount++;
            
            if (benchCount < remainingBasic.length && benchCount < 5) {
              await new Promise(resolve => setTimeout(resolve, 600));
            }
          }
        }
        
        newState = addLogEntry(newState, {
          type: 'cpu_setup',
          message: `CPUが初期ポケモンを配置しました（バトル場: ${newState.players.cpu.active.name_ja}, ベンチ: ${benchCount}体）`
        });
        
      } else {
        // ゲーム中: ベンチのみ（1体ずつ）
        const emptyBenchIndex = cpuState.bench.findIndex(slot => slot === null);
        if (emptyBenchIndex !== -1) {
          const selectedPokemon = basicPokemon[0];
          
          newState = Logic.placeCardOnBench(newState, 'cpu', selectedPokemon.id, emptyBenchIndex);
          
          // 統一アニメーション実行
          await unifiedAnimationManager.createUnifiedCardAnimation(
            'cpu', selectedPokemon.id, 'hand', 'bench', emptyBenchIndex, 
            { isSetupPhase: false, card: selectedPokemon }
          );
          
          newState = addLogEntry(newState, {
            type: 'pokemon_played',
            player: 'cpu',
            message: 'CPUがたねポケモンをベンチに出しました'
          });
        }
      }
      return newState;
      
    } catch (error) {
      console.error('❌ Error in unified CPU setup:', error);
      return state;
    }
  }






  /**
   * 非ブロッキングCPUセットアップ（1枚ずつ順次実行）
   */
  async startNonBlockingCpuSetup() {
    
    if (!window.gameInstance || !window.gameInstance.state) {
      console.warn('⚠️ Game instance not available');
      return;
    }

    // 現在の状態を取得
    let currentState = window.gameInstance.state;
    
    // CPUがすでにアクティブポケモンを持っている場合はスキップ
    if (currentState.players.cpu.active) {
      return;
    }

    const cpuState = currentState.players.cpu;
    const basicPokemon = cpuState.hand.filter(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );

    if (basicPokemon.length === 0) {
      console.warn('⚠️ CPU has no Basic Pokemon for setup');
      return;
    }

    // 1枚ずつ順次配置
    let placementIndex = 0;
    const placementInterval = setInterval(async () => {
      // 最新の状態を取得
      currentState = window.gameInstance.state;
      
      if (placementIndex >= basicPokemon.length) {
        clearInterval(placementInterval);
        return;
      }

      const pokemon = basicPokemon[placementIndex];

      try {
        let newState;
        let animationDetails = null; // アニメーション情報を保持する変数
        
        if (placementIndex === 0) {
          // 最初のポケモンはアクティブに配置
          newState = Logic.placeCardInActive(currentState, 'cpu', pokemon.id);
          if (newState.players.cpu.active) {
            newState.players.cpu.active.setupFaceDown = true;
            // アニメーション情報を保存
            animationDetails = {
              playerId: 'cpu',
              cardId: pokemon.id,
              sourceZone: 'hand',
              targetZone: 'active',
              targetIndex: 0,
              options: { isSetupPhase: true, card: pokemon }
            };
          }
        } else {
          // 2番目以降はベンチに配置
          const benchIndex = placementIndex - 1;
          if (benchIndex < 5) {
            newState = Logic.placeCardOnBench(currentState, 'cpu', pokemon.id, benchIndex);
            if (newState.players.cpu.bench[benchIndex]) {
              newState.players.cpu.bench[benchIndex].setupFaceDown = true;
              // アニメーション情報を保存
              animationDetails = {
                playerId: 'cpu',
                cardId: pokemon.id,
                sourceZone: 'hand',
                targetZone: 'bench',
                targetIndex: benchIndex,
                options: { isSetupPhase: true, card: pokemon }
              };
            }
          }
        }

        // 状態を更新
        if (newState && newState !== currentState) {
          window.gameInstance._updateState(newState);
          // DOM更新を待つ
          await new Promise(resolve => requestAnimationFrame(resolve));
        }

        // アニメーションを実行
        if (animationDetails) {
          await unifiedAnimationManager.createUnifiedCardAnimation(
            animationDetails.playerId,
            animationDetails.cardId,
            animationDetails.sourceZone,
            animationDetails.targetZone,
            animationDetails.targetIndex,
            animationDetails.options
          );
        }

      } catch (error) {
        console.error(`❌ Error placing CPU card ${placementIndex + 1}:`, error);
      }

      placementIndex++;
    }, 1200); // 1.2秒間隔で1枚ずつ配置
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
    console.log('🔥 SETUP-MANAGER: confirmSetup called');
    let newState = cloneGameState(state);

    // プレイヤーのセットアップ完了チェック
    const playerHasActiveBasic = newState.players.player.active && 
                                 newState.players.player.active.card_type === 'Pokémon' && 
                                 newState.players.player.active.stage === 'BASIC';
    
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

    // サイドカード配布フェーズに移行
    newState.phase = GAME_PHASES.PRIZE_CARD_SETUP;
    newState.prompt.message = 'サイドカードを配布しています...';
    newState.setupSelection.confirmed = true;

    // サイドカード配布
    console.log('🔥 SETUP-MANAGER: About to call setupPrizeCards');
    newState = await this.setupPrizeCards(newState);
    console.log('🔥 SETUP-MANAGER: setupPrizeCards completed');

    // ゲーム開始準備完了フェーズに移行
    newState.phase = GAME_PHASES.GAME_START_READY;
    newState.prompt.message = '準備完了！「ゲームスタート」を押してバトルを開始してください。';

    newState = addLogEntry(newState, {
      type: 'prize_setup_complete',
      message: 'サイドカードが配布されました。ゲーム開始の準備が整いました！'
    });
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
    console.log('🔥 SETUP-MANAGER: startGameRevealCards called');
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
  showGameStartModal(view) {
    // ゲーム開始は重要な意思決定なので中央モーダル
    view.showInteractiveMessage(
      '🎮 ポケモンカードゲームへようこそ！\n\nゲームを始める準備をしましょう：\n1. 山札をシャッフル\n2. 手札を7枚配布\n3. サイドカードを6枚設置\n4. バトル場とベンチにポケモン配置',
      [
        {
          text: '🎯 ゲームを始める',
          callback: () => {
            this.handleStartDealCards();
          }
        }
      ],
      'central' // 重要な意思決定なので中央モーダル
    );
  }

  /**
   * 手札配布開始の処理
   */
  async handleStartDealCards() {
    // No need to update modal content here, as it's handled by the new message system
    // Just trigger the initial setup
    window.gameInstance?.triggerInitialSetup();
  }

  /**
   * セットアップ状態リセット
   */
  reset() {
    this.mulliganCount = 0;
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
}

// デフォルトのセットアップマネージャーインスタンス
export const setupManager = new SetupManager();
