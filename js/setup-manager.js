/**
 * SETUP-MANAGER.JS - セットアップフェーズ専用処理
 * 
 * 初期ポケモン選択、マリガン、サイドカード配置などを管理
 */

import { animate, animationManager, unifiedAnimationManager } from './animation-manager.js';
import { CardOrientationManager } from './card-orientation.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';
import * as Logic from './logic.js';

const noop = () => {};

/**
 * セットアップ管理クラス
 */
export class SetupManager {
  constructor() {
    this.mulliganCount = 0;
    this.maxMulligans = 3; // 最大マリガン回数
    
    // セットアップ段階の統一管理
    this.setupPhases = ['shuffle', 'initial-deal', 'prize-deal', 'mulligan', 'initial-selection'];
    this.currentSetupPhase = null;
  }
  
  /**
   * 統一セットアップフロー
   */
  async _executeSetupPhase(phaseType, state, options = {}) {
    this.currentSetupPhase = phaseType;
    
    const phaseHandlers = {
      'shuffle': this._handleShufflePhase.bind(this),
      'initial-deal': this._handleInitialDealPhase.bind(this),
      'prize-deal': this._handlePrizeDealPhase.bind(this),
      'mulligan': this._handleMulliganPhase.bind(this),
      'initial-selection': this._handleInitialSelectionPhase.bind(this)
    };
    
    const handler = phaseHandlers[phaseType];
    if (!handler) {
      console.warn(`Unknown setup phase: ${phaseType}`);
      return state;
    }
    
    try {
      const result = await handler(state, options);
      return result;
    } catch (error) {
      console.error(`Setup phase ${phaseType} error:`, error);
      return state;
    } finally {
      this.currentSetupPhase = null;
    }
  }
  
  async _handleShufflePhase(state, options) {
    await this.animateDeckShuffle();
    return state;
  }
  
  async _handleInitialDealPhase(state, options) {
    return await this.drawInitialHands(state);
  }
  
  async _handlePrizeDealPhase(state, options) {
    return await this.dealPrizeCards(state);
  }
  
  async _handleMulliganPhase(state, options) {
    return await this.handleMulligans(state);
  }
  
  async _handleInitialSelectionPhase(state, options) {
    let newState = cloneGameState(state);
    newState.phase = GAME_PHASES.INITIAL_POKEMON_SELECTION;
    newState.prompt.message = 'まず手札のたねポケモンをクリックして選択し、次にバトル場またはベンチをクリックして配置してください。';
    
    newState = addLogEntry(newState, {
      type: 'setup_complete', 
      message: 'ゲームセットアップが完了しました'
    });
    
    return newState;
  }

  /**
   * ゲーム初期化とセットアップ開始
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async initializeGame(state) {
    let newState = cloneGameState(state);

    // 統一セットアップフローで順次実行
    for (const phase of this.setupPhases) {
      newState = await this._executeSetupPhase(phase, newState);
    }

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
    
    // 手札配布完了後、Promise-based非同期実行でCPUの初期ポケモン配置
    noop('🤖 handleStartDealCards: Starting CPU initial setup scheduling...');
    this._scheduleCPUInitialSetup().catch(error => {
      console.error('❌ Error in CPU initial setup:', error);
    });
    
    // Note: アニメーションはGame.jsでview.render()の後に呼ばれる
    // ここでは状態の更新のみを行い、アニメーションは別途実行する

    return newState;
  }

  /**
   * サイドカード配布
   * 各プレイヤーのデッキから6枚をサイドカードとして配布
   */
  async dealPrizeCards(state) {
    let newState = cloneGameState(state);

    // プレイヤーのサイドカード配布
    const playerPrizeCards = [];
    for (let i = 0; i < 6; i++) {
      if (newState.players.player.deck.length > 0) {
        const card = newState.players.player.deck.shift();
        playerPrizeCards.push(card);
      }
    }
    newState.players.player.prize = playerPrizeCards;
    newState.players.player.prizeRemaining = playerPrizeCards.length;

    // CPUのサイドカード配布
    const cpuPrizeCards = [];
    for (let i = 0; i < 6; i++) {
      if (newState.players.cpu.deck.length > 0) {
        const card = newState.players.cpu.deck.shift();
        cpuPrizeCards.push(card);
      }
    }
    newState.players.cpu.prize = cpuPrizeCards;
    newState.players.cpu.prizeRemaining = cpuPrizeCards.length;

    newState = addLogEntry(newState, {
      type: 'prize_cards_dealt',
      message: '両プレイヤーがサイドカード6枚を受け取りました。'
    });

    // アニメーションはGame.jsで実行される
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
        await animate.handDeal(playerCards, 'player');
      }
    }

    if (cpuHand) {
      const cpuCards = Array.from(cpuHand.querySelectorAll('.relative'));
      if (cpuCards.length > 0) {
        await animate.handDeal(cpuCards, 'cpu');
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
    noop(`🤖 unifiedCpuPokemonSetup: Starting (isInitialSetup: ${isInitialSetup})`);
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
          await animate.cardMove('cpu', activeCandidate.id, 'hand->active', 
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
            await animate.cardMove('cpu', pokemon.id, 'hand->bench', 
              { isSetupPhase: true, benchIndex: benchCount, card: pokemon }
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
          await animate.cardMove('cpu', selectedPokemon.id, 'hand->bench', 
            { isSetupPhase: false, benchIndex: emptyBenchIndex, card: selectedPokemon }
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
    noop('🤖 startNonBlockingCpuSetup: Method called');
    
    if (!window.gameInstance || !window.gameInstance.state) {
      console.warn('⚠️ startNonBlockingCpuSetup: Game instance not available');
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
      noop('🤖 Setting up CPU initial Pokemon...');
      newState = await this.unifiedCpuPokemonSetup(newState, true);
      
      // CPU側のポケモン配置完了後、CPU側サイドアニメーションをトリガー
      if (window.gameInstance && newState.players.cpu.active) {
        noop('🤖 CPU Pokemon setup completed, triggering CPU prize animation');
        // Promise-based非同期処理で確実な完了を保証
        this._scheduleCPUPrizeAnimation().catch(error => {
          console.error('❌ Error in CPU prize animation:', error);
        });
      } else {
        console.warn('⚠️ CPU setup failed or gameInstance not available');
        if (!window.gameInstance) console.warn('⚠️ window.gameInstance is null');
        if (!newState.players.cpu.active) console.warn('⚠️ CPU active Pokemon not set');
      }
    } else {
      noop('🤖 CPU already has active Pokemon, skipping setup');
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
    // initializeGame() の 'prize-deal' フェーズで既に配布済みのはずなので二重配布を避ける
    const playerPrizeCount = Array.isArray(newState.players?.player?.prize) ? newState.players.player.prize.length : 0;
    const cpuPrizeCount = Array.isArray(newState.players?.cpu?.prize) ? newState.players.cpu.prize.length : 0;

    if (playerPrizeCount === 6 && cpuPrizeCount === 6) {
      noop('🎯 Prizes already dealt during setup phase, skipping re-deal');
    } else {
      // 未配布または不正な場合は安全に配布し直す（dealPrizeCards は 6枚に設定する実装）
      noop('🎯 Prizes not properly dealt, calling dealPrizeCards');
      newState = await this.dealPrizeCards(newState);
      noop('✅ Prize cards dealt');
    }

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
   * 手札配布開始の処理
   */
  async handleStartDealCards() {
    console.log('🃏 handleStartDealCards called');
    // No need to update modal content here, as it's handled by the new message system
    // Just trigger the initial setup
    if (window.gameInstance) {
      console.log('✅ Calling triggerInitialSetup on gameInstance');
      await window.gameInstance.triggerInitialSetup();
    } else {
      console.error('❌ window.gameInstance not found');
    }
  }

  /**
   * セットアップ状態リセット
   */
  reset() {
    this.mulliganCount = 0;
    this.currentSetupPhase = null;
  }

  /**
   * CPU初期セットアップのPromise-based スケジューリング
   * @returns {Promise} セットアップ完了Promise
   */
  async _scheduleCPUInitialSetup() {
    noop('🤖 _scheduleCPUInitialSetup: Starting CPU initial setup scheduling');
    // 1.5秒待機してからCPU設定実行（UX改善のため）
    noop('🤖 _scheduleCPUInitialSetup: Waiting 1.5 seconds before CPU setup...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (window.gameInstance) {
      noop('🤖 _scheduleCPUInitialSetup: Executing CPU initial setup via Promise chain');
      await this.startNonBlockingCpuSetup();
      noop('✅ _scheduleCPUInitialSetup: CPU initial setup completed successfully');
      
      // CPU セットアップ完了後、自動でフルセットアップを実行
      noop('🤖 _scheduleCPUInitialSetup: Starting CPU full auto setup...');
      await this._scheduleCPUFullAutoSetup();
    } else {
      console.error('❌ _scheduleCPUInitialSetup: gameInstance not available for CPU initial setup');
      throw new Error('gameInstance not available for CPU initial setup');
    }
  }

  /**
   * CPU完全自動セットアップ（ポケモン配置からサイド配布まで）
   * @returns {Promise} 完全セットアップ完了Promise
   */
  async _scheduleCPUFullAutoSetup() {
    try {
      noop('🤖 _scheduleCPUFullAutoSetup: Starting CPU full auto setup');
      
      // 少し間を空けてから実行（UX改善）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!window.gameInstance) {
        throw new Error('gameInstance not available for CPU full auto setup');
      }

      // CPU の状態を確認してポケモンが配置されていない場合は配置
      let currentState = window.gameInstance.state;
      if (!currentState.players.cpu.active) {
        noop('🤖 _scheduleCPUFullAutoSetup: CPU needs Pokemon setup');
        currentState = await this.unifiedCpuPokemonSetup(currentState, true);
        window.gameInstance.state = currentState;
      }

      // CPUのサイドカード配布を実行
      noop('🤖 _scheduleCPUFullAutoSetup: Starting CPU prize card setup');
      await this._scheduleCPUPrizeAnimation();
      
      // CPU準備完了状態に設定
      noop('🤖 _scheduleCPUFullAutoSetup: Setting CPU ready status');
      currentState = window.gameInstance.state;
      currentState.cpuSetupReady = true;
      currentState = addLogEntry(currentState, {
        type: 'setup_complete',
        message: 'CPUの準備が完了しました。'
      });
      window.gameInstance.state = currentState;
      window.gameInstance._updateState(currentState);
      
      noop('✅ _scheduleCPUFullAutoSetup: CPU full auto setup completed');
      
      // 両者準備完了かチェック
      this._checkBothPlayersReady();
      
    } catch (error) {
      console.error('❌ Error in CPU full auto setup:', error);
    }
  }

  /**
   * 両者準備完了チェック（ゲーム側UI連携）
   * - CPU/プレイヤー双方の準備が揃ったらゲームスタートUIを出す
   * - ゲーム側のアニメーション完了チェックに委譲
   */
  _checkBothPlayersReady() {
    try {
      if (!window.gameInstance) return;

      // ゲーム側に用意された「サイド配布アニメーション完了」チェック機能を利用
      if (typeof window.gameInstance._checkBothPrizeAnimationsComplete === 'function') {
        window.gameInstance._checkBothPrizeAnimationsComplete();
        return;
      }

      // フォールバック: 状態から両者の準備完了を推定し、ゲーム開始ボタン表示
      const s = window.gameInstance.state;
      const bothHaveActive = !!(s?.players?.player?.active && s?.players?.cpu?.active);
      const playerReadyPhase = s?.phase === GAME_PHASES.GAME_START_READY;

      if (bothHaveActive && playerReadyPhase) {
        // メッセージ表示とゲームスタートボタンの提示
        window.gameInstance.view?.showGameMessage('準備完了！「ゲームスタート」を押してバトルを開始してください。');
        window.gameInstance.actionHUDManager?.showPhaseButtons('gameStart', {
          startActualGame: () => window.gameInstance._startActualGame()
        });
      }
    } catch (e) {
      console.error('⚠️ _checkBothPlayersReady failed:', e);
    }
  }

  /**
   * CPU側サイドアニメーションのPromise-based スケジューリング
   * @returns {Promise} アニメーション完了Promise
   */
  async _scheduleCPUPrizeAnimation() {
    noop('🤖 _scheduleCPUPrizeAnimation: Starting CPU prize animation scheduling');
    
    // 1秒待機してからアニメーション実行（UX改善のため）
    noop('🤖 _scheduleCPUPrizeAnimation: Waiting 1 second before animation...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (window.gameInstance) {
      noop('🤖 _scheduleCPUPrizeAnimation: Executing CPU prize animation via Promise chain');
      await window.gameInstance._animateCPUPrizeCardSetup();
      noop('✅ _scheduleCPUPrizeAnimation: CPU prize animation completed successfully');
    } else {
      console.error('❌ _scheduleCPUPrizeAnimation: gameInstance not available for CPU prize animation');
      throw new Error('gameInstance not available for CPU prize animation');
    }
  }

  /**
   * デッキシャッフルアニメーション
   */
  async animateDeckShuffle() {
    noop('🔀 Animating deck shuffle...');
    
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
