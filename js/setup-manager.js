/**
 * SETUP-MANAGER.JS - セットアップフェーズ専用処理
 * 
 * 初期ポケモン選択、マリガン、サイドカード配置などを管理
 */

import { animationManager } from './animations.js';
import { unifiedAnimationManager } from './unified-animations.js';
import { CardOrientationManager } from './card-orientation.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';
import * as Logic from './logic.js';
import { soundManager } from './sound-manager.js';
import { visualEffectsManager } from './visual-effects.js';

const noop = () => {};

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
   * デッキシャッフルアニメーション - 統一システム使用
   */
  async animateDeckShuffle() {
    // 新しい統一アニメーションシステムを使用
    await unifiedAnimationManager.animateDeckShuffle(['player', 'cpu']);
  }

  /**
   * 単一デッキのシャッフルアニメーション - 統一システムへ移譲（非推奨）
   */
  async shuffleDeckAnimation(deckElement) {
    // 統一アニメーションシステムを使用
    const playerId = deckElement.closest('.player-self') ? 'player' : 'cpu';
    await unifiedAnimationManager.animateDeckShuffle([playerId]);
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

    // 初期手札配布アニメーション実行
    await this.animateInitialHandDeal();

    newState = addLogEntry(newState, {
      type: 'initial_draw',
      message: '両プレイヤーが初期手札を引きました。'
    });

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
   * 初期手札配布アニメーション - 新統一システム使用
   */
  async animateInitialHandDeal() {
    // 新しい統一アニメーションシステムを使用
    await Promise.all([
      unifiedAnimationManager.animateHandDealCards('player', 7),
      unifiedAnimationManager.animateHandDealCards('cpu', 7)
    ]);
  }

  /**
   * 手札配布アニメーション（プレイヤー別） - 統一システム使用
   */
  async animateHandDeal(playerId) {
    // 新しい統一アニメーションシステムを使用
    await unifiedAnimationManager.animateHandEntry(playerId);
  }

  /**
   * マリガンアニメーション - 統一システム使用
   */
  async animateMulligan(playerId) {
    // 統一システムでマリガンアニメーション実行
    await unifiedAnimationManager.animateMulliganRedeal(playerId);
  }

  /**
   * プレイヤーのサイドカード配置（状態更新のみ）
   */
  async setupPlayerPrizeCards(state) {
    let newState = cloneGameState(state);

    // プレイヤーのサイドカード（裏面フラグ付き）
    for (let i = 0; i < 6; i++) {
      if (newState.players.player.deck.length > 0) {
        const prizeCard = newState.players.player.deck.shift();
        newState.players.player.prize.push({ ...prizeCard, isPrizeCard: true });
      }
    }

    return newState;
  }

  /**
   * CPUのサイドカード配置（状態更新のみ）
   */
  async setupCpuPrizeCards(state) {
    let newState = cloneGameState(state);

    // CPUのサイドカード（裏面フラグ付き）
    for (let i = 0; i < 6; i++) {
      if (newState.players.cpu.deck.length > 0) {
        const prizeCard = newState.players.cpu.deck.shift();
        newState.players.cpu.prize.push({ ...prizeCard, isPrizeCard: true });
      }
    }

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
          
          // 新しい統一アニメーション実行（人間らしいタイミング）
          await unifiedAnimationManager.animatePokemonPlacement(
            'cpu', activeCandidate, 'active', 0, 
            { personality: 'thoughtful', setupPhase: true }
          );
          await new Promise(resolve => setTimeout(resolve, 600));
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
            
            // 新しい統一アニメーション実行（ベンチ配置）
            await unifiedAnimationManager.animatePokemonPlacement(
              'cpu', pokemon, 'bench', benchCount, 
              { personality: 'eager', setupPhase: true, spectacle: 'subtle' }
            );
            benchCount++;
            
            if (benchCount < remainingBasic.length && benchCount < 5) {
              await new Promise(resolve => setTimeout(resolve, 400));
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
          
          // 新しい統一アニメーション実行（ゲーム中ベンチ配置）
          await unifiedAnimationManager.animatePokemonPlacement(
            'cpu', selectedPokemon, 'bench', emptyBenchIndex, 
            { personality: 'strategic', setupPhase: false, spectacle: 'normal' }
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
    noop('🔥 SETUP-MANAGER: confirmSetup called');
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

    // サイドカード配布フェーズに移行（手動操作待ち）
    newState.phase = GAME_PHASES.PRIZE_CARD_SETUP;
    newState.prompt.message = 'サイドカードを配布してください。';
    newState.setupSelection.confirmed = true;

    newState = addLogEntry(newState, {
      type: 'setup_complete',
      message: 'ポケモンの配置が完了しました。サイドカードを配布してください。'
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
    newState.prompt.message = 'サイドドローボタンを押してサイドカードを配布してください。';
    
    // サイドカード配布は_distributePrizes()で個別実行される
    
    newState = addLogEntry(newState, {
      type: 'prize_setup_complete',
      message: 'サイドカードが配布されました。ゲーム開始の準備が整いました！'
    });
    
    return newState;
  }

  /**
   * プレイヤー用サイド配布処理
   */

  /**
   * プレイヤーのサイド配布アニメーション - 統一システム使用
   */
  async animatePlayerPrizeDistribution() {
    noop('🔥 SETUP-MANAGER: animatePlayerPrizeDistribution called');
    
    // 新しい統一アニメーションシステムでサイドカード配布
    await unifiedAnimationManager.animatePrizeDistribution('player', 6);
  }

  /**
   * CPUのサイド配布アニメーション - 統一システム使用
   */
  async animateCpuPrizeDistribution() {
    noop('🔥 SETUP-MANAGER: animateCpuPrizeDistribution called');
    
    // 新しい統一アニメーションシステムでサイドカード配布（CPU用）
    await unifiedAnimationManager.animatePrizeDistribution('cpu', 6);
  }

  /**
   * 1枚のサイドカードアニメーション - 統一システムへ移譲（非推奨）
   */
  async animateSinglePrizeCard(deckElement, prizeContainer, prizeIndex, playerType) {
    // 新しい統一アニメーションシステムを使用
    await unifiedAnimationManager.animateSinglePrizeCard(playerType, prizeIndex);
  }

  /**
   * ゲーム開始時の表向き公開処理
   */
  async startGameRevealCards(state) {
    noop('🔥 SETUP-MANAGER: startGameRevealCards called');
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
      'ポケモンカードゲーム',
      [
        {
          text: '🚀 ゲームスタート',
          callback: () => {
            this.handleStartDealCards();
          },
          className: 'w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg'
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
    noop('🔀 Animating deck shuffle...');
    
    const playerDeck = document.querySelector('.player-self .deck-container');
    const cpuDeck = document.querySelector('.opponent-board .deck-container');
    
    // 新しい統一アニメーションシステムを使用
    await unifiedAnimationManager.animateDeckShuffle(['player', 'cpu']);
  }

  /**
   * 単一デッキのシャッフルアニメーション - 統一システムへ移譲（非推奨）
   */
  async shuffleDeckAnimation(deckElement) {
    // 統一アニメーションシステムを使用
    const playerId = deckElement.closest('.player-self') ? 'player' : 'cpu';
    await unifiedAnimationManager.animateDeckShuffle([playerId]);
  }

  /**
   * 並列ノンブロッキングセットアップ開始（5b35c87フロー復元）
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async startParallelGameFlow(state) {
    noop('🚀 Starting parallel non-blocking setup flow (5b35c87)');
    let newState = cloneGameState(state);

    // 並列実行: プレイヤー・CPU完全独立
    const [playerResult, cpuResult] = await Promise.all([
      this.executePlayerSetupFlow(newState),    // プレイヤー: 手札 → 選択UI
      this.executeCpuAutoSetupFlow(newState)    // CPU: 手札 → 自動配置完了
    ]);

    // 結果統合 → 即座にゲーム開始フロー
    newState = this.mergeParallelResults(newState, playerResult, cpuResult);
    newState.phase = GAME_PHASES.GAME_READY || GAME_PHASES.PLAYER_MAIN;
    newState.prompt.message = 'セットアップ完了！ゲーム開始準備が整いました。';

    newState = addLogEntry(newState, {
      type: 'parallel_setup_complete',
      message: 'プレイヤーとCPUの並列セットアップが完了しました'
    });

    return newState;
  }

  /**
   * プレイヤーセットアップフロー（選択的・ノンブロッキング）
   */
  async executePlayerSetupFlow(state) {
    noop('👤 Executing player setup flow...');
    const animations = [];

    // 1. 手札配布アニメーション (ノンブロッキング)
    animations.push(
      unifiedAnimationManager.animateHandDealCards('player', 7, {
        personality: 'eager', 
        spectacle: 'smooth'
      })
    );

    // 2. UIセットアップ (並行)
    animations.push(this.setupPlayerInterface());

    await Promise.all(animations);
    
    return { 
      phase: 'awaiting_player_choice', 
      ready: false,
      player: 'setup_with_choice'
    };
  }

  /**
   * CPUセットアップフロー（完全自動・ノンブロッキング）
   */
  async executeCpuAutoSetupFlow(state) {
    noop('🤖 Executing CPU auto setup flow...');
    
    // 1. 手札配布 + 自動ポケモン配置 (全自動・ノンブロッキング)
    await Promise.all([
      unifiedAnimationManager.animateHandDealCards('cpu', 7, {
        personality: 'systematic', 
        spectacle: 'efficient'
      }),
      this.executeCpuPokemonPlacement(state)
    ]);

    return { 
      phase: 'setup_complete', 
      ready: true,
      cpu: 'auto_complete'
    };
  }

  /**
   * 並列結果統合
   */
  mergeParallelResults(baseState, playerResult, cpuResult) {
    let newState = cloneGameState(baseState);
    
    // 並列処理結果を統合
    newState.setupProgress = {
      playerReady: playerResult.ready,
      cpuReady: cpuResult.ready,
      parallelComplete: playerResult.ready && cpuResult.ready,
      playerPhase: playerResult.phase,
      cpuPhase: cpuResult.phase
    };

    return newState;
  }

  /**
   * プレイヤーインターフェース準備
   */
  async setupPlayerInterface() {
    // プレイヤー選択UIの準備（ノンブロッキング）
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        noop('🎯 Player interface ready');
        resolve();
      });
    });
  }

  /**
   * CPU自動ポケモン配置実行
   */
  async executeCpuPokemonPlacement(state) {
    // CPU自動配置（既存のunifiedCpuPokemonSetupを活用）
    return this.unifiedCpuPokemonSetup(state, true);
  }

  /**
   * 並列セットアップ処理 - プレイヤーとCPUを同時に初期化（旧フロー・後方互換）
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async startParallelSetup(state) {
    noop('🔄 Starting parallel setup for player and CPU');
    let newState = cloneGameState(state);

    // 並列処理でプレイヤーとCPUの初期化を実行
    const [playerResult, cpuResult] = await Promise.all([
      this.setupPlayerInitial(newState),
      this.setupCpuComplete(newState)
    ]);

    // 結果を統合
    newState = this.mergeParallelStates(newState, playerResult, cpuResult);
    
    // プレイヤー選択フェーズに移行
    newState.phase = GAME_PHASES.PLAYER_SETUP_CHOICE;
    newState.prompt.message = 'バトル場にポケモンを配置し、サイドドローボタンを押してください。';
    
    // セットアップ進行状況を初期化
    newState.setupProgress = {
      playerHandDealt: true,
      playerSideDrawn: false,
      playerPokemonPlaced: false,
      cpuSetupComplete: true
    };

    newState = addLogEntry(newState, {
      type: 'parallel_setup_complete',
      message: 'プレイヤーとCPUの手札配布が完了しました'
    });

    return newState;
  }

  /**
   * プレイヤー初期セットアップ（手札のみ）
   */
  async setupPlayerInitial(state) {
    let newState = cloneGameState(state);
    
    // 1. デッキシャッフルアニメーション（プレイヤー側のみ） - 統一システム使用
    await unifiedAnimationManager.animateDeckShuffle(['player']);

    // 2. 初期手札をドロー（7枚）
    for (let i = 0; i < 7; i++) {
      if (newState.players.player.deck.length > 0) {
        const playerCard = newState.players.player.deck.shift();
        newState.players.player.hand.push(playerCard);
        
        // 手札配布アニメーション
        await this.animateHandDeal('player', i);
        await new Promise(resolve => setTimeout(resolve, 150)); // 150ms間隔
      }
    }

    // 3. マリガンチェック（簡略化）
    const needsMulligan = !this.hasBasicPokemon(newState.players.player);
    if (needsMulligan && this.mulliganCount < this.maxMulligans) {
      newState = await this.performMulligan(newState, 'player');
    }

    return { players: { player: newState.players.player } };
  }

  /**
   * CPU完全自動セットアップ
   */
  async setupCpuComplete(state) {
    let newState = cloneGameState(state);
    
    // 1. CPUデッキシャッフル - 統一システム使用
    await unifiedAnimationManager.animateDeckShuffle(['cpu']);

    // 2. CPU手札配布（7枚）
    for (let i = 0; i < 7; i++) {
      if (newState.players.cpu.deck.length > 0) {
        const cpuCard = newState.players.cpu.deck.shift();
        newState.players.cpu.hand.push(cpuCard);
        
        // CPU手札配布アニメーション
        await this.animateHandDeal('cpu', i);
        await new Promise(resolve => setTimeout(resolve, 120)); // 120ms間隔（CPU高速）
      }
    }

    // 3. CPUマリガンチェック
    const needsMulligan = !this.hasBasicPokemon(newState.players.cpu);
    if (needsMulligan && this.mulliganCount < this.maxMulligans) {
      newState = await this.performMulligan(newState, 'cpu');
    }

    // 4. CPU自動ポケモン配置
    newState = await this.cpuAutoPlacePokemon(newState);

    // 5. CPUサイドカード配置
    newState = await this.setupCpuPrizeCards(newState);

    return { players: { cpu: newState.players.cpu } };
  }

  /**
   * CPU自動ポケモン配置（統合版）
   */
  async cpuAutoPlacePokemon(state) {
    let newState = cloneGameState(state);
    const basicPokemon = newState.players.cpu.hand.filter(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );

    if (basicPokemon.length === 0) {
      console.warn('⚠️ CPU has no Basic Pokemon');
      return newState;
    }

    // 1. アクティブポケモン配置
    const activeCandidate = basicPokemon[0];
    newState = Logic.placeCardInActive(newState, 'cpu', activeCandidate.id);
    if (newState.players.cpu.active) {
      newState.players.cpu.active.setupFaceDown = true;
      
      // 新しい統一アニメーションでアクティブ配置
      await unifiedAnimationManager.animatePokemonPlacement(
        'cpu', activeCandidate, 'active', 0, 
        { personality: 'confident', setupPhase: true, spectacle: 'dramatic' }
      );
      await new Promise(resolve => setTimeout(resolve, 350));
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
        
        // 新しい統一アニメーションでベンチ配置
        await unifiedAnimationManager.animatePokemonPlacement(
          'cpu', pokemon, 'bench', benchCount, 
          { personality: 'casual', setupPhase: true, spectacle: 'gentle' }
        );
        await new Promise(resolve => setTimeout(resolve, 280));
        
        benchCount++;
      }
    }

    newState = addLogEntry(newState, {
      type: 'cpu_auto_setup',
      message: `CPUが自動でポケモンを配置しました（バトル場1体、ベンチ${benchCount}体）`
    });

    return newState;
  }

  /**
   * 並列処理結果の統合
   */
  mergeParallelStates(baseState, playerResult, cpuResult) {
    let newState = cloneGameState(baseState);
    
    // プレイヤー結果をマージ
    if (playerResult.players.player) {
      newState.players.player = {
        ...newState.players.player,
        ...playerResult.players.player
      };
    }

    // CPU結果をマージ
    if (cpuResult.players.cpu) {
      newState.players.cpu = {
        ...newState.players.cpu,
        ...cpuResult.players.cpu
      };
    }

    return newState;
  }

  /**
   * プレイヤーサイドドロー処理（単独実行版）
   */
  async handlePlayerSideDraw(state) {
    noop('🃏 Player side draw initiated');
    let newState = cloneGameState(state);
    
    // プレイヤーのサイドカード配布
    newState = await this.setupPlayerPrizeCards(newState);
    
    // セットアップ進行状況を更新
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.playerSideDrawn = true;

    newState = addLogEntry(newState, {
      type: 'player_side_draw',
      message: 'プレイヤーのサイドカードが配布されました'
    });

    return newState;
  }

  /**
   * セットアップ完了判定（新しいフロー用）
   */
  isPlayerSetupComplete(state) {
    const progress = state.setupProgress || {};
    return (
      progress.playerHandDealt &&
      progress.playerSideDrawn &&
      state.players.player.active !== null
    );
  }

  // ==================== 段階的セットアップメソッド群 ====================

  /**
   * じゃんけん処理
   * @param {object} state - ゲーム状態
   * @param {string} playerChoice - プレイヤーの選択 ('rock', 'paper', 'scissors')
   * @returns {object} 更新されたゲーム状態
   */
  async handleRockPaperScissors(state, playerChoice) {
    noop(`✊ Rock Paper Scissors: Player chose ${playerChoice}`);
    let newState = cloneGameState(state);

    // 選択サウンド再生
    soundManager.playRockPaperScissorsChoice();

    const choices = ['rock', 'paper', 'scissors'];
    const cpuChoice = choices[Math.floor(Math.random() * 3)];
    
    // 勝敗判定
    let winner = null;
    if (playerChoice === cpuChoice) {
      // あいこの場合は再度じゃんけん
      newState = addLogEntry(newState, {
        type: 'rps_draw',
        message: `あいこ！ プレイヤー: ${this.getRpsEmoji(playerChoice)}, CPU: ${this.getRpsEmoji(cpuChoice)}`
      });
      
      // あいこの視覚エフェクト
      visualEffectsManager.createFloatingText('あいこ！もう一度！', {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        fontSize: '32px',
        color: '#FFA500',
        duration: 2500
      });
      
      // じゃんけんフェーズを維持してHUD再表示要求
      newState.phase = GAME_PHASES.ROCK_PAPER_SCISSORS;
      newState.prompt.message = 'あいこでした！もう一度じゃんけんしましょう！';
      newState.needsRpsRetry = true;
      
      return newState;
    } else if (
      (playerChoice === 'rock' && cpuChoice === 'scissors') ||
      (playerChoice === 'paper' && cpuChoice === 'rock') ||
      (playerChoice === 'scissors' && cpuChoice === 'paper')
    ) {
      winner = 'player';
    } else {
      winner = 'cpu';
    }

    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.rpsWinner = winner;
    
    // 勝敗結果のサウンドと視覚エフェクト
    soundManager.playRockPaperScissorsResult(winner === 'player');
    visualEffectsManager.playRockPaperScissorsEffect(playerChoice, winner === 'player');
    
    newState = addLogEntry(newState, {
      type: 'rps_result',
      message: `じゃんけん結果: プレイヤー ${this.getRpsEmoji(playerChoice)} vs CPU ${this.getRpsEmoji(cpuChoice)} - ${winner === 'player' ? 'プレイヤー' : 'CPU'}の勝ち！`
    });

    // 勝敗結果を表示する時間
    await new Promise(resolve => setTimeout(resolve, 2500));

    if (winner === 'player') {
      // プレイヤーが勝った場合、先攻後攻選択
      newState.phase = GAME_PHASES.FIRST_PLAYER_CHOICE;
      newState.prompt.message = 'じゃんけんに勝ちました！先攻か後攻を選んでください。';
      
      // フェーズ遷移エフェクト
      soundManager.playPhaseTransition();
      visualEffectsManager.playPhaseTransitionEffect('先攻後攻選択');
    } else {
      // CPUが勝った場合、CPU自動選択（思考時間含む）
      await this.simulateHumanCpuBehavior('choosing', 2000);
      
      // setupProgressの初期化確認
      if (!newState.setupProgress) {
        newState.setupProgress = {};
      }
      newState.setupProgress.firstPlayer = Math.random() < 0.7 ? 'cpu' : 'player'; // CPUは70%で先攻選択
      newState = addLogEntry(newState, {
        type: 'cpu_choice',
        message: `CPUが${newState.setupProgress.firstPlayer === 'cpu' ? '先攻' : '後攻'}を選択しました`
      });
      
      // 選択結果の視覚エフェクト
      visualEffectsManager.createFloatingText(
        `CPUが${newState.setupProgress.firstPlayer === 'cpu' ? '先攻' : '後攻'}を選択！`, {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        fontSize: '28px',
        color: '#87CEEB',
        duration: 2000
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      newState = await this.proceedToDeckPlacement(newState);
    }

    return newState;
  }

  /**
   * 先攻後攻選択処理
   * @param {object} state - ゲーム状態
   * @param {string} choice - 'first' or 'second'
   * @returns {object} 更新されたゲーム状態
   */
  async handleFirstPlayerChoice(state, choice) {
    noop(`⚡ First player choice: ${choice}`);
    let newState = cloneGameState(state);

    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.firstPlayer = choice === 'first' ? 'player' : 'cpu';
    
    // 選択確定のサウンドとエフェクト
    soundManager.playConfirm();
    visualEffectsManager.createFloatingText(
      choice === 'first' ? '先攻選択！' : '後攻選択！',
      {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        fontSize: '28px',
        color: choice === 'first' ? '#FFD700' : '#87CEEB',
        duration: 2000
      }
    );
    
    newState = addLogEntry(newState, {
      type: 'first_player_choice',
      message: `${newState.setupProgress.firstPlayer === 'player' ? 'プレイヤー' : 'CPU'}が先攻です`
    });

    // デッキ配置フェーズに進む
    return await this.proceedToDeckPlacement(newState);
  }

  /**
   * デッキ配置フェーズ（③山札を置く）
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async proceedToDeckPlacement(state) {
    let newState = cloneGameState(state);
    
    newState.phase = GAME_PHASES.DECK_PLACEMENT;
    newState.prompt.message = 'デッキをシャッフルして山札の場所に置いています...';
    
    // フェーズ遷移エフェクト
    soundManager.playPhaseTransition();
    visualEffectsManager.playPhaseTransitionEffect('③ 山札配置');
    
    // デッキシャッフルアニメーション実行
    await this.animateDeckShuffle();
    
    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.deckPlaced = true;
    
    newState = addLogEntry(newState, {
      type: 'deck_placement',
      message: 'デッキがシャッフルされ、山札が配置されました'
    });

    // フェーズ間の自然な待機時間
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 手札配布フェーズに進む
    return await this.proceedToHandDeal(newState);
  }

  /**
   * 手札配布フェーズ（④手札を7枚引く）
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async proceedToHandDeal(state) {
    let newState = cloneGameState(state);
    
    newState.phase = GAME_PHASES.HAND_DEAL;
    newState.prompt.message = '山札から手札を7枚引いています...';
    
    // フェーズ遷移エフェクト
    soundManager.playPhaseTransition();
    visualEffectsManager.playPhaseTransitionEffect('④ 手札配布');
    
    // プレイヤーとCPUの手札を配布（アニメーション付き）
    newState = await this.dealHandsWithAnimation(newState);
    
    // 手札配布完了音
    soundManager.playHandDeal();
    
    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.handDealt = true;
    
    newState = addLogEntry(newState, {
      type: 'hand_deal',
      message: '両プレイヤーが手札を7枚引きました'
    });

    // フェーズ間の待機時間
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 手札配布完了後、CPU自動処理を実行
    newState = await this.executeCpuAutoSetup(newState);

    // プレイヤーのアクティブ配置フェーズに移行
    newState.phase = GAME_PHASES.ACTIVE_PLACEMENT;
    newState.prompt.message = '手札からたねポケモンを1枚選んでバトル場に配置してください。';
    
    // フェーズ遷移エフェクト
    soundManager.playPhaseTransition();
    visualEffectsManager.playPhaseTransitionEffect('⑤ プレイヤーのポケモン配置');
    
    return newState;
  }

  /**
   * アニメーション付き手札配布（オリジナルアニメーション復元版）
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async dealHandsWithAnimation(state) {
    let newState = cloneGameState(state);
    
    noop('📤 Starting original hand deal animation for both players');
    
    // オリジナルのanimateInitialHandDealを使用
    await this.animateInitialHandDeal(newState);
    
    noop('✅ Hand deal completed with original animations');
    return newState;
  }

  /**
   * 初期手札配布アニメーション（オリジナル復元版）
   * @param {object} state - ゲーム状態
   */
  async animateInitialHandDeal(state) {
    noop('🃏 Starting original initial hand deal animation');
    
    // プレイヤーの手札配布（7枚を順番に）
    for (let i = 0; i < 7; i++) {
      if (state.players.player.deck.length > 0) {
        const playerCard = state.players.player.deck.shift();
        state.players.player.hand.push(playerCard);
        
        // カード移動アニメーション
        await this.animateHandDeal('player', i);
        soundManager.playCardDeal(); // カード配布音
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms間隔
      }
    }
    
    // CPU手札配布（7枚を順番に）  
    for (let i = 0; i < 7; i++) {
      if (state.players.cpu.deck.length > 0) {
        const cpuCard = state.players.cpu.deck.shift();
        state.players.cpu.hand.push(cpuCard);
        
        // カード移動アニメーション
        await this.animateHandDeal('cpu', i);
        soundManager.playCardDeal(); // カード配布音
        await new Promise(resolve => setTimeout(resolve, 150)); // 150ms間隔（CPUは少し速く）
      }
    }
    
    // 手札配布完了後、DOM更新のための少しの遅延
    await new Promise(resolve => setTimeout(resolve, 500));
    
    noop('✅ Original initial hand deal animation completed');
  }
  

  /**
   * CPU完全自動化フロー（手札配布後）- オリジナル復元版
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async executeCpuAutoSetup(state) {
    let newState = cloneGameState(state);
    noop('🤖 Starting original CPU auto setup...');
    
    // オリジナルのstartNonBlockingCpuSetup()を使用
    await this.startNonBlockingCpuSetup(newState);
    
    noop('✅ Original CPU auto setup completed');
    return newState;
  }

  /**
   * オリジナルのノンブロッキングCPUセットアップ（setInterval-based）
   * @param {object} state - ゲーム状態
   */
  async startNonBlockingCpuSetup(state) {
    noop('🤖 Starting non-blocking CPU setup with setInterval');
    
    // CPU思考時間
    await this.simulateHumanCpuBehavior('analyzing_hand', 1000);
    
    return new Promise((resolve) => {
      const basicPokemon = state.players.cpu.hand.filter(card => 
        card.card_type === 'Pokémon' && card.stage === 'BASIC'
      );
      
      if (basicPokemon.length === 0) {
        noop('⚠️ CPU has no Basic Pokemon for setup');
        resolve();
        return;
      }
      
      let currentIndex = 0;
      let placedActive = false;
      let benchCount = 0;
      
      // setInterval-based sequential placement
      const placementInterval = setInterval(async () => {
        if (currentIndex >= basicPokemon.length) {
          clearInterval(placementInterval);
          
          // サイドカード配布を最後に実行
          await this.placePrizeCardsWithAnimation(state, 'cpu');
          
          noop('✅ Non-blocking CPU setup completed');
          resolve();
          return;
        }
        
        const pokemon = basicPokemon[currentIndex];
        
        // アクティブポケモン配置（最初の1匹）
        if (!placedActive) {
          noop(`🤖 CPU placing active Pokemon: ${pokemon.name_ja}`);
          
          // CPUがカードを手札からプレイマットに配置するアニメーション
          await this.animateCpuHandToPlaymat(pokemon, 'active', 0);
          
          // Logic処理
          state = Logic.placeCardInActive(state, 'cpu', pokemon.id);
          if (state.players.cpu.active) {
            state.players.cpu.active.setupFaceDown = true;
          }
          
          placedActive = true;
        } 
        // ベンチポケモン配置（残り、最大3体）
        else if (benchCount < 3) {
          noop(`🤖 CPU placing bench Pokemon ${benchCount + 1}: ${pokemon.name_ja}`);
          
          // CPUがカードを手札からプレイマットに配置するアニメーション
          await this.animateCpuHandToPlaymat(pokemon, 'bench', benchCount);
          
          // Logic処理
          state = Logic.placeCardOnBench(state, 'cpu', pokemon.id, benchCount);
          if (state.players.cpu.bench[benchCount]) {
            state.players.cpu.bench[benchCount].setupFaceDown = true;
          }
          
          benchCount++;
        }
        
        currentIndex++;
        
      }, 1200); // 1.2秒間隔でカードを1枚ずつ配置
    });
  }

  /**
   * CPUがカードを手札からプレイマットに配置するアニメーション（オリジナル復元）
   * @param {object} pokemon - ポケモンカード
   * @param {string} targetZone - 'active' | 'bench'
   * @param {number} targetIndex - ベンチの場合のインデックス
   */
  async animateCpuHandToPlaymat(pokemon, targetZone, targetIndex) {
    noop(`🎬 Animating CPU hand-to-playmat: ${pokemon.name_ja} to ${targetZone}`);
    
    // CPUの手札エリアを取得
    const cpuHandSelector = '#cpu-hand';
    const handElement = document.querySelector(cpuHandSelector);
    
    if (!handElement) {
      console.warn('CPU hand element not found for animation');
      return;
    }
    
    // ターゲットエリアを取得
    let targetSelector;
    if (targetZone === 'active') {
      targetSelector = '.opponent-board .active-container';
    } else if (targetZone === 'bench') {
      targetSelector = `.opponent-board .bench-container .bench-slot:nth-child(${targetIndex + 1})`;
    }
    
    const targetElement = document.querySelector(targetSelector);
    
    if (!targetElement) {
      console.warn(`Target element not found: ${targetSelector}`);
      return;
    }
    
    // アニメーション用のカード要素を作成
    const cardElement = document.createElement('div');
    cardElement.className = 'absolute w-16 h-22 rounded-lg border border-gray-600 transition-all duration-800';
    cardElement.style.zIndex = '200';
    
    // 裏面画像（setupFaceDown = true）
    const img = document.createElement('img');
    img.src = 'assets/ui/card_back.webp';
    img.className = 'w-full h-full object-cover rounded-lg';
    cardElement.appendChild(img);
    
    // 開始位置（CPU手札）
    const handRect = handElement.getBoundingClientRect();
    cardElement.style.left = `${handRect.left}px`;
    cardElement.style.top = `${handRect.top}px`;
    cardElement.style.opacity = '1';
    
    document.body.appendChild(cardElement);
    
    // 終了位置（プレイマット）
    const targetRect = targetElement.getBoundingClientRect();
    
    // アニメーション実行
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        cardElement.style.left = `${targetRect.left}px`;
        cardElement.style.top = `${targetRect.top}px`;
        cardElement.style.transform = 'scale(1.05)';
        
        setTimeout(() => {
          cardElement.style.transform = 'scale(1)';
          soundManager.playCardDeal(); // カード配置音
          
          setTimeout(() => {
            if (document.body.contains(cardElement)) {
              document.body.removeChild(cardElement);
            }
            resolve();
          }, 200);
        }, 600);
      });
    });
  }

  /**
   * バトルポケモン配置完了時の処理
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async handleActivePlacementComplete(state) {
    let newState = cloneGameState(state);
    
    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.activePlaced = true;
    
    // CPUは既に自動処理済みなので、プレイヤーのベンチ配置へ進む
    newState.phase = GAME_PHASES.BENCH_PLACEMENT;
    newState.prompt.message = 'ベンチにたねポケモンを配置してください。（最大5枚、スキップ可能）';
    
    // フェーズ遷移エフェクト
    soundManager.playPhaseTransition();
    visualEffectsManager.playPhaseTransitionEffect('⑥ プレイヤーのベンチ配置');
    
    return newState;
  }

  /**
   * ベンチ配置完了時の処理
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async handleBenchPlacementComplete(state) {
    let newState = cloneGameState(state);
    
    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.benchPlaced = true;
    
    // CPUは既に処理済み、プレイヤーのサイドカード配布フェーズに進む
    newState.phase = GAME_PHASES.PRIZE_PLACEMENT;
    newState.prompt.message = 'プレイヤーのサイドカードを配置しています...';
    
    // フェーズ遷移エフェクト
    soundManager.playPhaseTransition();
    visualEffectsManager.playPhaseTransitionEffect('⑦ プレイヤーのサイド配置');
    
    // プレイヤーのみサイドカード配置
    await this.placePrizeCardsWithAnimation(newState, 'player');
    
    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.prizePlaced = true;
    
    newState = addLogEntry(newState, {
      type: 'player_prize_placement',
      message: 'プレイヤーのサイドカードが配置されました'
    });

    // フェーズ間の待機時間
    await new Promise(resolve => setTimeout(resolve, 1000));

    // カード公開フェーズに進む
    newState.phase = GAME_PHASES.CARD_REVEAL;
    newState.prompt.message = 'ポケモンを表向きにして、バトル開始！';
    
    // カード公開フェーズ遷移エフェクト
    soundManager.playPhaseTransition();
    visualEffectsManager.playPhaseTransitionEffect('⑧ カード公開・バトル開始');
    
    return newState;
  }

  /**
   * サイド配置フェーズ（⑦サイドを置く）
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async proceedToPrizePlacement(state) {
    let newState = cloneGameState(state);
    
    newState.phase = GAME_PHASES.PRIZE_PLACEMENT;
    newState.prompt.message = '山札からサイドカードを6枚配置しています...';
    
    // フェーズ遷移エフェクト
    soundManager.playPhaseTransition();
    visualEffectsManager.playPhaseTransitionEffect('⑦ サイド配置');
    
    // 順次実行でサイドカード配置（プレイヤー→CPU）
    noop('🎁 Starting prize placement - Player first');
    await this.placePrizeCardsWithAnimation(newState, 'player');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    noop('🎁 Starting prize placement - CPU second');
    await this.placePrizeCardsWithAnimation(newState, 'cpu');
    
    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.prizePlaced = true;
    
    newState = addLogEntry(newState, {
      type: 'prize_placement',
      message: '両プレイヤーのサイドカードが配置されました'
    });

    // フェーズ間の待機時間
    await new Promise(resolve => setTimeout(resolve, 1200));

    // カード公開フェーズに進む
    newState.phase = GAME_PHASES.CARD_REVEAL;
    newState.prompt.message = 'ポケモンを表向きにして、バトル開始！';
    
    // カード公開フェーズ遷移エフェクト
    soundManager.playPhaseTransition();
    visualEffectsManager.playPhaseTransitionEffect('⑧ カード公開・バトル開始');
    
    return newState;
  }

  /**
   * カード公開フェーズ（⑧ポケモンをオモテにして対戦スタート）
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async handleCardReveal(state) {
    let newState = cloneGameState(state);
    
    // カード公開エフェクト
    soundManager.playCardReveal();
    visualEffectsManager.playCardRevealEffect();
    
    // 全ポケモンカードを表向きに（アニメーション付き）
    await this.revealAllPokemonWithAnimation(newState);
    
    // setupProgressの初期化確認
    if (!newState.setupProgress) {
      newState.setupProgress = {};
    }
    newState.setupProgress.cardsRevealed = true;
    
    // ゲーム開始 - 先攻プレイヤーに応じてフェーズ設定
    newState.turn = 1;
    newState.turnPlayer = newState.setupProgress.firstPlayer || 'player';
    
    if ((newState.setupProgress.firstPlayer || 'player') === 'cpu') {
      // CPUが先攻の場合はCPUドローフェーズから開始
      newState.phase = GAME_PHASES.CPU_DRAW;
      noop('🎮 Game starting with CPU first turn');
    } else {
      // プレイヤーが先攻の場合はプレイヤードローフェーズから開始  
      newState.phase = GAME_PHASES.PLAYER_DRAW;
      noop('🎮 Game starting with Player first turn');
    }
    
    newState = addLogEntry(newState, {
      type: 'game_start',
      message: `ポケモンカードバトル開始！${newState.turnPlayer === 'player' ? 'プレイヤー' : 'CPU'}の先攻です！`
    });
    
    return newState;
  }

  // ==================== ヘルパーメソッド ====================

  getRpsEmoji(choice) {
    const emojis = { rock: '✊', paper: '✋', scissors: '✌️' };
    return emojis[choice] || choice;
  }



  /**
   * サイドカード配置（アニメーション付き）
   */
  async placePrizeCardsWithAnimation(state, playerId) {
    for (let i = 0; i < 6; i++) {
      if (state.players[playerId].deck.length > 0) {
        const card = state.players[playerId].deck.shift();
        state.players[playerId].prize[i] = card;
        
        // アニメーション実行
        const deckSelector = playerId === 'player' ? '.bottom-right-deck' : '.top-left-deck';
        const prizeSelector = playerId === 'player' ? '.side-left' : '.side-right';
        
        // 新しい統一アニメーションでサイドカード配置
        await unifiedAnimationManager.animateSinglePrizeCard(playerId, i);
        
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }

  /**
   * 全ポケモン公開アニメーション
   */
  async revealAllPokemonWithAnimation(state) {
    // プレイヤー側公開
    if (state.players.player.active) {
      await this.revealSinglePokemon('player', state.players.player.active, 'active');
    }
    
    for (let i = 0; i < 5; i++) {
      if (state.players.player.bench[i]) {
        await this.revealSinglePokemon('player', state.players.player.bench[i], 'bench', i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // CPU側公開
    if (state.players.cpu.active) {
      await this.revealSinglePokemon('cpu', state.players.cpu.active, 'active');
    }
    
    for (let i = 0; i < 5; i++) {
      if (state.players.cpu.bench[i]) {
        await this.revealSinglePokemon('cpu', state.players.cpu.bench[i], 'bench', i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  /**
   * 単一ポケモン公開アニメーション
   */
  async revealSinglePokemon(playerId, pokemon, zone, index = 0) {
    if (pokemon.setupFaceDown) {
      delete pokemon.setupFaceDown;
    }
    
    // カード反転アニメーション
    const selector = playerId === 'player' ? '.player-self' : '.opponent-board';
    let cardSelector;
    
    if (zone === 'active') {
      cardSelector = playerId === 'player' ? '.active-bottom .relative' : '.active-top .relative';
    } else {
      cardSelector = `.bottom-bench-${index + 1} .relative`;
    }
    
    const cardElement = document.querySelector(`${selector} ${cardSelector}`);
    if (cardElement) {
      cardElement.style.transform = 'rotateY(180deg)';
      await new Promise(resolve => setTimeout(resolve, 300));
      cardElement.style.transform = 'rotateY(0deg)';
    }
  }

  /**
   * 人間らしいCPU行動シミュレーション
   */
  async simulateHumanCpuBehavior(action, baseDelay = 1000) {
    const randomDelay = baseDelay + (Math.random() * 800 - 400); // ±400ms のランダム性（より人間らしく）
    noop(`🤖 CPU ${action}: waiting ${Math.round(randomDelay)}ms`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));
  }

  /**
   * 手札配布アニメーション
   * @param {string} playerId - 'player' or 'cpu'
   * @param {number} cardIndex - 配布するカードのインデックス
   */
  async animateHandDeal(playerId, cardIndex) {
    const isPlayer = playerId === 'player';
    const deckSelector = isPlayer ? '.player-self .deck-container' : '.opponent-board .deck-container';
    const handSelector = isPlayer ? '#player-hand' : '#cpu-hand';
    
    const deckElement = document.querySelector(deckSelector);
    const handContainer = document.querySelector(handSelector);
    
    if (!deckElement || !handContainer) {
      console.warn(`Hand deal animation elements not found for ${playerId}`);
      return;
    }

    // アニメーション用のカード要素を作成
    const cardElement = document.createElement('div');
    cardElement.className = 'absolute w-16 h-22 rounded-lg border border-gray-600 transition-all duration-600';
    cardElement.style.zIndex = '100';
    
    // カード画像（裏面）
    const img = document.createElement('img');
    img.src = 'assets/ui/card_back.webp';
    img.className = 'w-full h-full object-cover rounded-lg';
    cardElement.appendChild(img);
    
    // 開始位置（デッキ）
    const deckRect = deckElement.getBoundingClientRect();
    cardElement.style.left = `${deckRect.left}px`;
    cardElement.style.top = `${deckRect.top}px`;
    cardElement.style.opacity = '0';
    
    document.body.appendChild(cardElement);
    
    // 終了位置（手札エリア）
    const handRect = handContainer.getBoundingClientRect();
    const targetX = handRect.left + (cardIndex * 20); // カード間隔
    const targetY = handRect.top;
    
    // アニメーション実行
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        cardElement.style.opacity = '1';
        cardElement.style.left = `${targetX}px`;
        cardElement.style.top = `${targetY}px`;
        cardElement.style.transform = 'scale(1.1) rotate(5deg)';
        
        setTimeout(() => {
          cardElement.style.transform = 'scale(1) rotate(0deg)';
          
          setTimeout(() => {
            if (document.body.contains(cardElement)) {
              document.body.removeChild(cardElement);
            }
            resolve();
          }, 200);
        }, 400);
      });
    });
  }
}

// デフォルトのセットアップマネージャーインスタンス
export const setupManager = new SetupManager();
