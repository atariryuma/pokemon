/**
 * TURN-MANAGER.JS - ターンシーケンス管理
 * 
 * プレイヤーとCPUのターン進行、制約管理、自動処理を統括
 */

import { animate, animationManager, unifiedAnimationManager } from './animation-manager.js';
import { CardOrientationManager } from './card-orientation.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';
import * as Logic from './logic.js';

const noop = () => {};

/**
 * ターン管理クラス
 */
export class TurnManager {
  constructor() {
    this.turnActions = []; // ターン内でのアクション履歴
    this.cpuThinkingTime = {
      min: 500,
      max: 1500
    };
    
    // 非同期処理管理
    this.pendingOperations = new Set();
    this.phaseTransitions = [];
  }
  
  /**
   * 非同期処理の同期化
   */
  async _waitForPendingOperations() {
    if (this.pendingOperations.size > 0) {
      await Promise.all(Array.from(this.pendingOperations));
      this.pendingOperations.clear();
    }
  }
  
  async _trackAsyncOperation(operation) {
    const promise = Promise.resolve(operation);
    this.pendingOperations.add(promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingOperations.delete(promise);
    }
  }

  /**
   * プレイヤーターン開始
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async startPlayerTurn(state) {
    noop('🎯 Starting player turn...');
    
    // 保留中の操作が完了するまで待機
    await this._waitForPendingOperations();
    
    let newState = cloneGameState(state);

    // ターン数増加（最初のターンは既に1なので、2ターン目から増加）
    if (newState.turnPlayer === 'player' && newState.turn > 1) {
      newState.turn++;
    }

    // ターン制約リセット
    newState.hasDrawnThisTurn = false;
    newState.hasAttachedEnergyThisTurn = false;
    newState.canRetreat = true;
    newState.canPlaySupporter = true;
    newState.turnPlayer = 'player';

    // 特殊状態処理（毒、火傷など）
    newState = await this._trackAsyncOperation(
      this.processSpecialConditions(newState, 'player')
    );

    // ドローフェーズに移行
    newState.phase = GAME_PHASES.PLAYER_DRAW;
    newState.prompt.message = '山札をクリックしてカードを引いてください。';

    this.turnActions = [];

    newState = addLogEntry(newState, {
      type: 'turn_start',
      player: 'player',
      message: `プレイヤーのターン ${newState.turn} 開始`
    });

    return newState;
  }

  /**
   * プレイヤードローフェーズ処理
   */
  async handlePlayerDraw(state) {
    noop('🎴 Player draw phase...');
    let newState = cloneGameState(state);

    // 自動ドロー（最初のターンのみ選択制、以降は強制）
    if (!newState.hasDrawnThisTurn) {
      newState = Logic.drawCard(newState, 'player');
      newState.hasDrawnThisTurn = true;

      // ドローアニメーション
      await this.animateCardDraw('player');

      // メインフェーズに自動移行
      

      newState = addLogEntry(newState, {
        type: 'card_draw',
        player: 'player',
        message: 'カードを1枚引きました'
      });
    }

    return newState;
  }

  /**
   * プレイヤーメインフェーズ処理
   */
  handlePlayerMainPhase(state, action, actionData = {}) {
    noop(`🎮 Player main phase action: ${action}`, actionData);
    let newState = cloneGameState(state);

    this.turnActions.push({ action, data: actionData, timestamp: Date.now() });

    switch (action) {
      case 'play_basic_pokemon':
        newState = this.handlePlayBasicPokemon(newState, actionData);
        break;
      
      case 'attach_energy':
        newState = this.handleAttachEnergy(newState, actionData);
        break;
      
      case 'use_trainer':
        newState = this.handleUseTrainer(newState, actionData);
        break;
      
      case 'retreat_pokemon':
        newState = this.handleRetreat(newState, actionData);
        break;
      
      case 'declare_attack':
        newState = this.handleAttackDeclaration(newState, actionData);
        break;
      
      case 'end_turn':
        newState = this.endPlayerTurn(newState);
        break;
      
      default:
        console.warn(`Unknown player action: ${action}`);
    }

    return newState;
  }

  /**
   * たねポケモンをベンチに出す処理
   */
  handlePlayBasicPokemon(state, { cardId, benchIndex }) {
    let newState = Logic.placeCardOnBench(state, 'player', cardId, benchIndex);
    
    if (newState !== state) {
      newState = addLogEntry(newState, {
        type: 'pokemon_played',
        player: 'player',
        message: 'たねポケモンをベンチに出しました'
      });
    }

    return newState;
  }

  /**
   * エネルギー付与処理
   */
  handleAttachEnergy(state, { energyId, pokemonId }) {
    if (state.hasAttachedEnergyThisTurn) {
      console.warn('Already attached energy this turn');
      return state;
    }

    let newState = Logic.attachEnergy(state, 'player', energyId, pokemonId);
    
    if (newState !== state) {
      newState = addLogEntry(newState, {
        type: 'energy_attached',
        player: 'player',
        message: 'エネルギーをポケモンに付けました'
      });
    }

    return newState;
  }

  /**
   * トレーナーズ使用処理
   */
  handleUseTrainer(state, { cardId, trainerType }) {
    // トレーナーズ処理は今回は簡略化
    let newState = cloneGameState(state);
    
    newState = addLogEntry(newState, {
      type: 'trainer_used',
      player: 'player',
      message: 'トレーナーズを使用しました'
    });

    return newState;
  }

  /**
   * にげる処理
   */
  handleRetreat(state, { fromActiveId, toBenchIndex }) {
    if (!state.canRetreat) {
      console.warn('Cannot retreat this turn');
      return state;
    }

    let newState = Logic.retreat(state, 'player', fromActiveId, toBenchIndex);
    
    if (newState !== state) {
      newState.canRetreat = false;
      newState = addLogEntry(newState, {
        type: 'pokemon_retreated',
        player: 'player',
        message: 'ポケモンがにげました'
      });
    }

    return newState;
  }

  /**
   * 攻撃宣言処理
   */
  handleAttackDeclaration(state, { attackIndex }) {
    let newState = cloneGameState(state);
    
    // 攻撃フェーズに移行
    newState.phase = GAME_PHASES.PLAYER_ATTACK;
    newState.pendingAction = {
      type: 'attack',
      attackIndex,
      attacker: 'player'
    };
    newState.prompt.message = '攻撃を実行中...';

    return newState;
  }

  /**
   * 攻撃実行処理
   */
  async executeAttack(state) {
    noop('⚔️ Executing attack...');
    let newState = cloneGameState(state);
    
    // 変数をtryブロックの外で定義
    let attacker, attackIndex;

    try {
      if (!newState.pendingAction || newState.pendingAction.type !== 'attack') {
        return newState;
      }

      ({ attackIndex, attacker } = newState.pendingAction);
      const defender = attacker === 'player' ? 'cpu' : 'player';
      
      // DOM要素の安全な取得
      let defenderElement;
      try {
        if (CardOrientationManager && CardOrientationManager.getCardOrientation) {
          const defenderOrientation = CardOrientationManager.getCardOrientation(defender, 'active');
          defenderElement = document.querySelector(`${defenderOrientation.playerSelector} ${defender === 'player' ? '.active-bottom' : '.active-top'}`);
        } else {
          // フォールバック: 直接セレクタで取得
          const playerSelector = defender === 'player' ? '.player-self' : '.opponent-board';
          const slotSelector = defender === 'player' ? '.active-bottom' : '.active-top';
          defenderElement = document.querySelector(`${playerSelector} ${slotSelector}`);
        }
      } catch (orientationError) {
        console.warn('カード向き取得エラー:', orientationError);
        // フォールバック処理
        const playerSelector = defender === 'player' ? '.player-self' : '.opponent-board';
        const slotSelector = defender === 'player' ? '.active-bottom' : '.active-top';
        defenderElement = document.querySelector(`${playerSelector} ${slotSelector}`);
      }
      
      if (!defenderElement) {
        console.warn('防御側の要素が見つかりません。アニメーションなしで攻撃を実行します。');
      }

      noop(`🗡️ ${attacker} attacks ${defender} with attack index ${attackIndex}`);
    
    // 攻撃前の状態ログ
    const attackerPokemon = newState.players[attacker].active;
    const defenderPokemon = newState.players[defender].active;
    noop(`👊 Attacker: ${attackerPokemon?.name_ja} (HP: ${attackerPokemon?.hp - (attackerPokemon?.damage || 0)}/${attackerPokemon?.hp})`);
    noop(`🛡️ Defender: ${defenderPokemon?.name_ja} (HP: ${defenderPokemon?.hp - (defenderPokemon?.damage || 0)}/${defenderPokemon?.hp})`);

    // 攻撃実行
    newState = Logic.performAttack(newState, attacker, attackIndex);
    
    // 攻撃後の状態ログ
    const defenderAfter = newState.players[defender].active;
    if (defenderAfter) {
      noop(`💥 After attack - Defender: ${defenderAfter.name_ja} (HP: ${defenderAfter.hp - (defenderAfter.damage || 0)}/${defenderAfter.hp}, Damage: ${defenderAfter.damage || 0})`);
    }

    // 攻撃アニメーション（タイプ別エフェクト付き）
    const attackerElement = document.querySelector(`${this.getPlayerSelector(attacker)} ${this.getActiveSelector(attacker)}`);
    const attackerAfter = newState.players[attacker].active;
    const attack = attackerAfter.attacks[attackIndex];
    const primaryType = attackerAfter.types && attackerAfter.types[0] ? attackerAfter.types[0] : 'Colorless';
    
    // 戦闘アニメーションシーケンス（新API使用）
    const finalDamage = defenderAfter ? (defenderAfter.damage - (defenderPokemon?.damage || 0)) : 0;
    const targetId = defenderAfter ? defenderAfter.id : null;
    
    if (targetId) {
      await animate.attackSequence(primaryType.toLowerCase(), finalDamage, targetId, {
        attackerId: attacker.id,
        attackIndex
      });
    }

    // きぜつチェックとアニメーション
    const defenderStateBeforeKO = newState.players[defender];
    const isKnockout = defenderStateBeforeKO.active && defenderStateBeforeKO.active.damage >= defenderStateBeforeKO.active.hp;
    
    if (isKnockout) {
      // Play knockout animation with new API
      await animate.combat.knockout(defenderStateBeforeKO.active.id, {
        playerId: defender
      });
      
      // Process knockout logic (sets up prize selection phase)
      newState = Logic.checkForKnockout(newState, defender);
      
      // Clear pending action and return - prize selection phase will handle next steps
      newState.pendingAction = null;
      return newState;
    }

    // ペンディングアクションクリア
    newState.pendingAction = null;

    // 勝敗判定（新アクティブ選択が不要な場合のみ）
    newState = Logic.checkForWinner(newState);
    if (newState.phase === GAME_PHASES.GAME_OVER) {
      noop('🏆 Game ended after attack:', newState.winner, newState.gameEndReason);
      return newState;
    }

    // 攻撃後はターン終了（自動）
    if (attacker === 'player') {
      newState = this.endPlayerTurn(newState);
    } else {
      newState = await this.endCpuTurn(newState);
    }

      newState = addLogEntry(newState, {
        type: 'attack_executed',
        player: attacker,
        message: `攻撃を実行しました`
      });

      return newState;
    } catch (error) {
      console.error('攻撃実行中にエラーが発生しました:', error);
      
      // attacker変数が定義されている場合のみ処理実行
      if (attacker && attackIndex !== undefined) {
        // エラー時も基本的な攻撃処理は実行
        newState = Logic.performAttack(newState, attacker, attackIndex);
        newState.pendingAction = null;
        
        // 攻撃後のターン終了処理
        if (attacker === 'player') {
          newState = this.endPlayerTurn(newState);
        } else {
          newState = await this.endCpuTurn(newState);
        }
      } else {
        console.warn('攻撃者情報が不完全なため、エラー時の攻撃処理をスキップします');
        newState.pendingAction = null;
      }
      
      return newState;
    }
  }

  /**
   * プレイヤーターン終了
   */
  endPlayerTurn(state) {
    noop('🔄 Ending player turn...');
    let newState = cloneGameState(state);

    newState.phase = GAME_PHASES.CPU_TURN;
    newState.turnPlayer = 'cpu';
    newState.prompt.message = '相手のターンです...';

    newState = addLogEntry(newState, {
      type: 'turn_end',
      player: 'player',
      message: 'プレイヤーのターン終了'
    });

    return newState;
  }

  /**
   * CPUターン開始
   */
  async startCpuTurn(state) {
    noop('🤖 Starting CPU turn...');
    let newState = cloneGameState(state);

    // ターン数増加
    newState.turn++;

    // ターン制約リセット
    newState.hasDrawnThisTurn = false;
    newState.hasAttachedEnergyThisTurn = false;
    newState.canRetreat = true;
    newState.canPlaySupporter = true;
    newState.turnPlayer = 'cpu';

    // 特殊状態処理
    newState = this.processSpecialConditions(newState, 'cpu');

    // CPUの思考時間
    await this.simulateCpuThinking();

    newState = addLogEntry(newState, {
      type: 'turn_start',
      player: 'cpu',
      message: `CPUのターン ${newState.turn} 開始`
    });

    return newState;
  }

  /**
   * CPU自動ターン実行
   */
  async executeCpuTurn(state) {
    noop('🎯 Executing CPU turn...');
    let newState = cloneGameState(state);

    // 1. バトルポケモンがいない場合はベンチから昇格
    if (!newState.players.cpu.active) {
      newState = await this.cpuPromoteToActive(newState);
      if (!newState.players.cpu.active) {
        // 昇格できない場合はゲーム終了
        return Logic.checkForWinner(newState);
      }
    }

    // 2. ドロー
    newState = Logic.drawCard(newState, 'cpu');
    newState.hasDrawnThisTurn = true;
    await this.animateCardDraw('cpu');
    await this.simulateCpuThinking(300);

    // 3. たねポケモンをベンチに出す（可能なら）
    newState = await this.cpuPlayBasicPokemon(newState);
    await this.simulateCpuThinking(500);

    // 4. エネルギーを付ける（可能なら）
    newState = await this.cpuAttachEnergy(newState);
    await this.simulateCpuThinking(400);

    // 5. 攻撃（可能なら）
    const canAttack = this.cpuCanAttack(newState);
    if (canAttack) {
      newState = await this.cpuPerformAttack(newState);
    } else {
      // 攻撃できない場合はターン終了
      newState = await this.endCpuTurn(newState);
    }

    return newState;
  }

  /**
   * CPU: ベンチからバトル場に昇格
   */
  async cpuPromoteToActive(state) {
    let newState = cloneGameState(state);
    const benchPokemon = newState.players.cpu.bench.filter(p => p !== null);
    
    if (benchPokemon.length > 0) {
      const selectedIndex = newState.players.cpu.bench.findIndex(p => p && p.id === benchPokemon[0].id);
      newState = Logic.promoteToActive(newState, 'cpu', selectedIndex);
      
      await this.simulateCpuThinking();
      
      // CPU新アクティブ選択完了後の勝敗判定
      newState = Logic.checkForWinner(newState);
      if (newState.phase === GAME_PHASES.GAME_OVER) {
        noop('🏆 Game ended after CPU new active selection:', newState.winner, newState.gameEndReason);
        return newState;
      }
      
      // 新しいポケモンがバトル場に出たので、フェーズをCPUのメインフェーズに戻す
      newState.phase = GAME_PHASES.CPU_MAIN;
      newState.prompt.message = '相手のターンです...';
      newState.playerToAct = null; // 行動待ちプレイヤーをリセット

      newState = addLogEntry(newState, {
        type: 'pokemon_promoted',
        player: 'cpu',
        message: 'CPUがベンチポケモンをバトル場に出しました'
      });
    } else {
      // ベンチにポケモンがいない場合、CPUはポケモンを出せないためゲーム終了
      newState = Logic.checkForWinner(newState); // 相手の場にポケモンがいない勝利条件をチェック
      if (newState.phase !== GAME_PHASES.GAME_OVER) {
          // もし勝敗が決まらないなら、CPUは行動できないのでターン終了
          newState = await this.endCpuTurn(newState); // CPUターンを終了させる
      }
    }

    return newState;
  }

  /**
   * CPU: たねポケモンをベンチに出す
   */
  async cpuPlayBasicPokemon(state) {
    let newState = cloneGameState(state);
    const cpuState = newState.players.cpu;
    
    const basicPokemon = cpuState.hand.filter(card => 
      card.card_type === 'Pokémon' && card.stage === 'BASIC'
    );

    if (basicPokemon.length > 0) {
      const emptyBenchIndex = cpuState.bench.findIndex(slot => slot === null);
      if (emptyBenchIndex !== -1) {
        const selectedPokemon = basicPokemon[0];
        
        // キャプチャソース位置（状態更新前）
        const sourceElement = document.querySelector(`[data-card-id="${selectedPokemon.id}"]`);
        const initialSourceRect = sourceElement ? sourceElement.getBoundingClientRect() : null;
        
        newState = Logic.placeCardOnBench(newState, 'cpu', selectedPokemon.id, emptyBenchIndex);
        
        // 統一アニメーション実行
        const animationManager = (await import('./animation-manager.js')).default;
        await animationManager.createUnifiedCardAnimation(
          'cpu',
          selectedPokemon.id,
          'hand',
          'bench',
          emptyBenchIndex,
          {
            isSetupPhase: false,
            card: selectedPokemon,
            initialSourceRect
          }
        );
        
        newState = addLogEntry(newState, {
          type: 'pokemon_played',
          player: 'cpu',
          message: 'CPUがたねポケモンをベンチに出しました'
        });
      }
    }

    return newState;
  }

  /**
   * CPU: エネルギー付与
   */
  async cpuAttachEnergy(state) {
    let newState = cloneGameState(state);
    
    if (newState.hasAttachedEnergyThisTurn) {
      return newState;
    }

    const cpuState = newState.players.cpu;
    const energyCards = cpuState.hand.filter(card => card.card_type === 'Basic Energy');
    
    if (energyCards.length > 0 && cpuState.active) {
      const selectedEnergy = energyCards[0];
      
      newState = Logic.attachEnergy(newState, 'cpu', selectedEnergy.id, cpuState.active.id);
      
      if (newState !== state) {
        // Use new unified energy animation for CPU
        const energyType = this.extractEnergyType(selectedEnergy.energy_type || selectedEnergy.id);
        await animate.attachEnergy(energyType, cpuState.active.id, { 
          energyCardId: selectedEnergy.id,
          playerId: 'cpu' 
        });
      }
    }

    return newState;
  }

  /**
   * CPU攻撃可能チェック
   */
  cpuCanAttack(state) {
    const activePokemon = state.players.cpu.active;
    if (!activePokemon || !activePokemon.attacks) return false;

    return activePokemon.attacks.some(attack => 
      Logic.hasEnoughEnergy(activePokemon, attack)
    );
  }

  /**
   * CPU攻撃実行
   */
  async cpuPerformAttack(state) {
    let newState = cloneGameState(state);
    const activePokemon = newState.players.cpu.active;
    
    const usableAttacks = activePokemon.attacks
      .map((attack, index) => ({ ...attack, index }))
      .filter(attack => Logic.hasEnoughEnergy(activePokemon, attack));

    if (usableAttacks.length > 0) {
      // 戦略的AI: 相手を倒せる攻撃を優先、次に高ダメージ攻撃を選択
      const bestAttack = this._selectBestAttack(newState, usableAttacks, activePokemon);

      newState.phase = GAME_PHASES.CPU_ATTACK;
      newState.pendingAction = {
        type: 'attack',
        attackIndex: bestAttack.index,
        attacker: 'cpu'
      };

      // 攻撃実行
      newState = await this.executeAttack(newState);
      
    }

    return newState;
  }

  /**
   * CPU戦略的攻撃選択
   */
  _selectBestAttack(state, usableAttacks, attacker) {
    const defender = state.players.player.active;
    if (!defender) return usableAttacks[0];

    const attackScores = usableAttacks.map(attack => {
      let score = attack.damage || 0;
      const remainingHP = defender.hp - (defender.damage || 0);
      
      // 相手を倒せる攻撃に高い優先度
      if (score >= remainingHP) {
        score += 100; // KOボーナス
      }
      
      // 弱点を突ける場合の追加スコア
      if (defender.weakness && attacker.types) {
        // weakness is an object with {type: string, value: string}
        if (typeof defender.weakness === 'object' && defender.weakness.type) {
          if (attacker.types.includes(defender.weakness.type)) {
            score += 50; // 弱点ボーナス
          }
        }
        // fallback for array format
        else if (Array.isArray(defender.weakness)) {
          if (defender.weakness.some(w => attacker.types.includes(w.type))) {
            score += 50; // 弱点ボーナス
          }
        }
      }
      
      return { ...attack, score };
    });

    // スコア順にソート
    attackScores.sort((a, b) => b.score - a.score);
    
    // 上位攻撃からランダム選択（完全に予測可能にしない）
    const topAttacks = attackScores.filter(attack => 
      attack.score >= attackScores[0].score - 10
    );
    
    return topAttacks[Math.floor(Math.random() * topAttacks.length)];
  }

  /**
   * CPUターン終了
   */
  async endCpuTurn(state) {
    noop('🔄 Ending CPU turn...');
    let newState = cloneGameState(state);

    newState = addLogEntry(newState, {
      type: 'turn_end',
      player: 'cpu',
      message: 'CPUのターン終了'
    });

    // プレイヤーターンに戻る
    return await this.startPlayerTurn(newState);
  }

  /**
   * 特殊状態処理（毒、火傷など）
   */
  processSpecialConditions(state, playerId) {
    let newState = cloneGameState(state);
    const playerState = newState.players[playerId];

    if (playerState.active && playerState.active.special_conditions) {
      const conditions = playerState.active.special_conditions;

      // 毒ダメージ
      if (conditions.includes('Poisoned')) {
        playerState.active.damage = (playerState.active.damage || 0) + 10;
        newState = addLogEntry(newState, {
          type: 'poison_damage',
          player: playerId,
          message: `${playerState.active.name_ja}が毒ダメージを受けました`
        });
        
        // 毒アニメーションを実行
        animate.effect.condition('poisoned', playerState.active.id).catch(console.warn);
      }

      // 火傷判定
      if (conditions.includes('Burned')) {
        // 火傷アニメーションを実行
        animate.effect.condition('burned', playerState.active.id).catch(console.warn);
        
        // コイントス（簡略化）
        if (Math.random() < 0.5) {
          playerState.active.damage = (playerState.active.damage || 0) + 20;
          newState = addLogEntry(newState, {
            type: 'burn_damage',
            player: playerId,
            message: `${playerState.active.name_ja}が火傷ダメージを受けました`
          });
        } else {
          // 火傷回復
          conditions.splice(conditions.indexOf('Burned'), 1);
        }
      }
    }

    return newState;
  }

  /**
   * カードドローアニメーション
   */
  async animateCardDraw(playerId) {
    const handElement = playerId === 'player' 
      ? document.getElementById('player-hand')
      : document.getElementById('cpu-hand');

    if (handElement) {
      const cards = handElement.querySelectorAll('.relative');
      const lastCard = cards.length ? cards[cards.length - 1] : null;
      if (lastCard) {
        await animationManager.animateDrawCard(lastCard);
      }
    }
  }

  /**
   * 攻撃アニメーション
   */
  async animateAttack(attackerId, state) {
    const defenderId = attackerId === 'player' ? 'cpu' : 'player';
    await animationManager.createUnifiedAttackAnimation(attackerId, defenderId);
  }


  /**
   * CPU思考時間シミュレーション
   */
  async simulateCpuThinking(baseTime = null) {
    const thinkTime = baseTime || (
      Math.random() * (this.cpuThinkingTime.max - this.cpuThinkingTime.min) + this.cpuThinkingTime.min
    );
    
    await new Promise(resolve => setTimeout(resolve, thinkTime));
  }

  /**
   * プレイヤーセレクタを取得
   */
  getPlayerSelector(playerId) {
    return playerId === 'player' ? '.player-board:not(.opponent-board)' : '.opponent-board';
  }

  /**
   * アクティブエリアセレクタを取得
   */
  getActiveSelector(playerId) {
    return playerId === 'player' ? '.active-bottom' : '.active-top';
  }

  /**
   * ターンアクション履歴取得
   */
  getTurnActions() {
    return [...this.turnActions];
  }


  /**
   * Handle new active pokemon selection after knockout
   */
  async handleNewActiveSelection(state, benchIndex) {
    let newState = Logic.promoteToActive(state, state.playerToAct, benchIndex);
    
    if (newState !== state) {
      // Add promotion animation for both player and CPU
      const playerId = state.playerToAct;
      const promotedPokemon = newState.players[playerId].active;
      
      if (promotedPokemon) {
        // Create promotion animation with new API
        const animationManager = (await import('./animation-manager.js')).default;
        await animationManager.createUnifiedCardAnimation(
          playerId,
          promotedPokemon.id,
          'bench',
          'active',
          0,
          {
            isNewActiveSelection: true,
            sourceIndex: benchIndex,
            card: promotedPokemon
          }
        );
      }
      
      // Clear knockout context and reset phase
      newState.knockoutContext = null;
      newState.playerToAct = null;
      
      // Check for winner
      newState = Logic.checkForWinner(newState);
      
      if (newState.phase !== GAME_PHASES.GAME_OVER) {
        // Return to appropriate turn phase
        if (newState.turnPlayer === 'player') {
          newState.phase = GAME_PHASES.PLAYER_MAIN;
          newState.prompt.message = 'あなたのターンです。行動を選んでください。';
        } else {
          newState.phase = GAME_PHASES.CPU_MAIN;
          newState.prompt.message = '相手のターンです...';
        }
      }
      
      newState = addLogEntry(newState, {
        type: 'pokemon_promoted',
        player: playerId,
        message: `${playerId === 'player' ? 'あなた' : '相手'}は${promotedPokemon.name_ja}をバトル場に出しました。`
      });
    }
    
    return newState;
  }

  /**
   * Handle CPU auto-selection after knockout
   */
  async handleCpuAutoNewActive(state) {
    if (!state.needsCpuAutoSelect) {
      return state;
    }
    
    await this.simulateCpuThinking(800);
    
    let newState = Logic.cpuAutoSelectNewActive(state);
    
    // Add CPU selection animation with new API
    const cpuActive = newState.players.cpu.active;
    if (cpuActive) {
      const animationManager = (await import('./animation-manager.js')).default;
      await animationManager.createUnifiedCardAnimation(
        'cpu',
        cpuActive.id,
        'bench',
        'active',
        0,
        {
          isNewActiveSelection: true,
          isCpuAutoSelect: true,
          card: cpuActive
        }
      );
    }
    
    // Set appropriate phase after CPU selection
    if (newState.phase !== GAME_PHASES.GAME_OVER) {
      if (newState.turnPlayer === 'cpu') {
        newState.phase = GAME_PHASES.CPU_MAIN;
        newState.prompt.message = '相手のターンです...';
      } else {
        newState.phase = GAME_PHASES.PLAYER_MAIN;
        newState.prompt.message = 'あなたのターンです。行動を選んでください。';
      }
    }
    
    return newState;
  }

  /**
   * エネルギータイプを抽出
   */
  extractEnergyType(energyTypeOrId) {
    if (!energyTypeOrId) return 'colorless';
    
    const energyTypes = ['fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal'];
    const lowerInput = energyTypeOrId.toLowerCase();
    
    return energyTypes.find(type => lowerInput.includes(type)) || 'colorless';
  }

  /**
   * ターンマネージャーリセット
   */
  reset() {
    this.turnActions = [];
    noop('🔄 Turn manager reset');
  }
}

// デフォルトのターンマネージャーインスタンス
export const turnManager = new TurnManager();
