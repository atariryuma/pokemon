/**
 * TURN-MANAGER.JS - ターンシーケンス管理
 * 
 * プレイヤーとCPUのターン進行、制約管理、自動処理を統括
 */

import { animationManager } from './animations.js';
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';
import * as Logic from './logic.js';

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
  }

  /**
   * プレイヤーターン開始
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async startPlayerTurn(state) {
    console.log('🎯 Starting player turn...');
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
    newState = this.processSpecialConditions(newState, 'player');

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
    console.log('🎴 Player draw phase...');
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
    console.log(`🎮 Player main phase action: ${action}`, actionData);
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
    console.log('⚔️ Executing attack...');
    let newState = cloneGameState(state);

    if (!newState.pendingAction || newState.pendingAction.type !== 'attack') {
      return newState;
    }

    const { attackIndex, attacker } = newState.pendingAction;
    const defender = attacker === 'player' ? 'cpu' : 'player';
    const defenderElement = attacker === 'player'
      ? document.querySelector('.opponent-board .active-top')
      : document.querySelector('.player-self .active-bottom');

    console.log(`🗡️ ${attacker} attacks ${defender} with attack index ${attackIndex}`);
    
    // 攻撃前の状態ログ
    const attackerPokemon = newState.players[attacker].active;
    const defenderPokemon = newState.players[defender].active;
    console.log(`👊 Attacker: ${attackerPokemon?.name_ja} (HP: ${attackerPokemon?.hp - (attackerPokemon?.damage || 0)}/${attackerPokemon?.hp})`);
    console.log(`🛡️ Defender: ${defenderPokemon?.name_ja} (HP: ${defenderPokemon?.hp - (defenderPokemon?.damage || 0)}/${defenderPokemon?.hp})`);

    // 攻撃実行
    newState = Logic.performAttack(newState, attacker, attackIndex);
    
    // 攻撃後の状態ログ
    const defenderAfter = newState.players[defender].active;
    if (defenderAfter) {
      console.log(`💥 After attack - Defender: ${defenderAfter.name_ja} (HP: ${defenderAfter.hp - (defenderAfter.damage || 0)}/${defenderAfter.hp}, Damage: ${defenderAfter.damage || 0})`);
    }

    // 攻撃アニメーション
    await this.animateAttack(attacker, newState);

    // HPダメージアニメーション
    if (defenderElement) {
      const hpTarget = defenderElement.querySelector('.hp') || defenderElement;
      await animationManager.animateHPDamage(hpTarget);
    }

    // きぜつチェックとアニメーション
    const defenderState = newState.players[defender];
    if (defenderElement && defenderState.active && defenderState.active.damage >= defenderState.active.hp) {
      await animationManager.animateKnockout(defenderElement);
    }
    newState = Logic.checkForKnockout(newState, defender);

    // きぜつによる新アクティブ選択が必要な場合は、ターン終了を延期
    if (newState.phase === GAME_PHASES.AWAITING_NEW_ACTIVE) {
      console.log('🔄 Knockout occurred, waiting for new active pokemon selection');
      // ペンディングアクションクリア
      newState.pendingAction = null;
      // ターン終了は新アクティブ選択完了後に実行
      return newState;
    }

    // ペンディングアクションクリア
    newState.pendingAction = null;

    // 勝敗判定（新アクティブ選択が不要な場合のみ）
    newState = Logic.checkForWinner(newState);
    if (newState.phase === GAME_PHASES.GAME_OVER) {
      console.log('🏆 Game ended after attack:', newState.winner, newState.gameEndReason);
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
  }

  /**
   * プレイヤーターン終了
   */
  endPlayerTurn(state) {
    console.log('🔄 Ending player turn...');
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
    console.log('🤖 Starting CPU turn...');
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
    console.log('🎯 Executing CPU turn...');
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
        console.log('🏆 Game ended after CPU new active selection:', newState.winner, newState.gameEndReason);
        return newState;
      }
      
      newState = addLogEntry(newState, {
        type: 'pokemon_promoted',
        player: 'cpu',
        message: 'CPUがベンチポケモンをバトル場に出しました'
      });
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
        newState = Logic.placeCardOnBench(newState, 'cpu', basicPokemon[0].id, emptyBenchIndex);
        
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
      newState = Logic.attachEnergy(newState, 'cpu', energyCards[0].id, cpuState.active.id);
      
      if (newState !== state) {
        await this.animateEnergyAttachment('cpu');
        
        newState = addLogEntry(newState, {
          type: 'energy_attached',
          player: 'cpu',
          message: 'CPUがエネルギーを付けました'
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
      // 簡単なAI: 最もダメージの高い攻撃を選択
      const bestAttack = usableAttacks.reduce((best, current) => 
        (current.damage || 0) > (best.damage || 0) ? current : best
      );

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
   * CPUターン終了
   */
  async endCpuTurn(state) {
    console.log('🔄 Ending CPU turn...');
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
      }

      // 火傷判定
      if (conditions.includes('Burned')) {
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

    if (handElement && handElement.lastElementChild) {
      await animationManager.animateDrawCard(handElement.lastElementChild);
    }
  }

  /**
   * 攻撃アニメーション
   */
  async animateAttack(attackerId, state) {
    const attackerElement = attackerId === 'player' 
      ? document.querySelector('.player-self .active-bottom')
      : document.querySelector('.opponent-board .active-top');

    const defenderElement = attackerId === 'player' 
      ? document.querySelector('.opponent-board .active-top')
      : document.querySelector('.player-self .active-bottom');

    if (attackerElement && defenderElement) {
      await animationManager.animateAttack(attackerElement, defenderElement);
    }
  }

  /**
   * エネルギー付与アニメーション
   */
  async animateEnergyAttachment(playerId) {
    // エネルギー付与のアニメーション実装
    console.log(`🔋 Animating energy attachment for ${playerId}`);
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
   * ターンアクション履歴取得
   */
  getTurnActions() {
    return [...this.turnActions];
  }


  /**
   * ターンマネージャーリセット
   */
  reset() {
    this.turnActions = [];
    console.log('🔄 Turn manager reset');
  }
}

// デフォルトのターンマネージャーインスタンス
export const turnManager = new TurnManager();