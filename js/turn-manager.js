/**
 * TURN-MANAGER.JS - ターンシーケンス管理
 * 
 * プレイヤーとCPUのターン進行、制約管理、自動処理を統括
 */

// animationManagerを削除 - animations.jsは存在せず
import { unifiedAnimationManager } from './simple-animations.js';
// CardOrientationManagerを削除 - シンプル化
import { GAME_PHASES } from './phase-manager.js';
import { cloneGameState, addLogEntry } from './state.js';
import * as Logic from './logic.js';
import { modalManager } from './modal-manager.js';

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
  }

  /**
   * プレイヤーターン開始
   * @param {object} state - ゲーム状態
   * @returns {object} 更新されたゲーム状態
   */
  async startPlayerTurn(state) {
    noop('🎯 Starting player turn...');
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
    noop('🎴 Player draw phase...');
    let newState = cloneGameState(state);

    // 手動ドロー待機状態に設定
    if (!newState.hasDrawnThisTurn) {
      newState.awaitingInput = true;
      newState.prompt.message = 'カードを引いてください。山札をクリックしてドローしてください。';
      newState.prompt.actions = [{
        type: 'draw_card',
        label: 'カードを引く'
      }];
    }

    return newState;
  }

  /**
   * 手動ドロー実行処理
   */
  async executePlayerDraw(state) {
    noop('🃏 Executing player draw...');
    let newState = cloneGameState(state);

    if (!newState.hasDrawnThisTurn) {
      newState = Logic.drawCard(newState, 'player');
      newState.hasDrawnThisTurn = true;
      newState.awaitingInput = false;

      // ドローアニメーション
      await this.animateCardDraw('player');

      // メインフェーズに移行
      newState.phase = GAME_PHASES.PLAYER_MAIN;
      newState.prompt.message = 'あなたのターンです。アクションを選択してください。';
      newState.prompt.actions = [];

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

    if (!newState.pendingAction || newState.pendingAction.type !== 'attack') {
      return newState;
    }

    const { attackIndex, attacker } = newState.pendingAction;
    const defender = attacker === 'player' ? 'cpu' : 'player';
    // CardOrientationManagerを削除 - シンプル化
    const defenderElement = document.querySelector(`${defenderOrientation.playerSelector} ${defender === 'player' ? '.active-bottom' : '.active-top'}`);

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

    // ダメージ結果を中央モーダルで表示
    if (defenderAfter && attackerPokemon) {
      const attack = attackerPokemon.attacks[attackIndex];
      const damageDealt = (defenderAfter.damage || 0) - (defenderPokemon.damage || 0);
      
      if (damageDealt > 0) {
        const isKO = defenderAfter.damage >= defenderAfter.hp;
        const attackerName = attacker === 'player' ? 'あなた' : 'CPU';
        const defenderName = defender === 'player' ? 'あなた' : 'CPU';
        
        await modalManager.showCentralModal({
          title: `⚔️ ${attack.name_ja}！`,
          message: `
            <div class="text-center">
              <div class="text-4xl mb-4">💥</div>
              <h3 class="text-xl font-bold mb-2">${attackerName}の攻撃！</h3>
              <p class="text-2xl font-bold text-red-400 mb-2">${damageDealt}ダメージ！</p>
              <p class="text-gray-300 mb-2">${defenderName}の${defenderAfter.name_ja}に攻撃！</p>
              <p class="text-sm text-gray-400">
                ${defenderAfter.name_ja}: ${defenderAfter.hp - defenderAfter.damage}/${defenderAfter.hp} HP
              </p>
              ${isKO ? '<p class="text-red-500 font-bold mt-2">きぜつ！</p>' : ''}
            </div>
          `,
          actions: [
            {
              text: '続行',
              callback: () => modalManager.closeCentralModal(),
              className: 'px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-lg'
            }
          ],
          allowHtml: true
        });
      }
    }

    // 統合バトルアニメーション実行
    await this._executeUnifiedBattleSequence(newState, attacker, defender, attackIndex);

    // きぜつチェックとアニメーション
    const defenderStateBeforeKO = newState.players[defender];
    if (defenderElement && defenderStateBeforeKO.active && defenderStateBeforeKO.active.damage >= defenderStateBeforeKO.active.hp) {
      await unifiedAnimationManager.animateKnockout(defender, defenderStateBeforeKO.active, 
        { personality: 'dramatic', spectacle: 'intense' });
    }
    newState = Logic.checkForKnockout(newState, defender);

    // Check for prize cards after KO (if any)
    const attackingPlayerState = newState.players[attacker];
    if (attackingPlayerState.prizesToTake > 0) {
        newState.phase = GAME_PHASES.PRIZE_SELECTION;
        newState.playerToAct = attacker; // The player who needs to take prizes
        newState.prompt.message = `${attacker === 'player' ? 'あなた' : '相手'}はサイドカードを選んで取ってください。`;
        newState.pendingAction = null; // Clear any pending actions
        return newState; // Stop further processing in this function, wait for prize selection
    }

    // きぜつによる新アクティブ選択が必要な場合
    if (newState.phase === GAME_PHASES.AWAITING_NEW_ACTIVE) {
      noop('🔄 Knockout occurred, waiting for new active pokemon selection');
      newState.pendingAction = null;

      // CPUが選ぶ番なら、ここでCPUの選択ロジックを呼び出す
      if (newState.playerToAct === 'cpu') {
        noop('🤖 CPU is selecting a new active pokemon...');
        newState = await this.cpuPromoteToActive(newState);
      }
      
      // プレイヤーが選ぶ番なら、そのままstateを返してUIの更新を待つ
      // CPUが選んだ場合も、ここでnewStateが更新されているので、そのまま次の処理へ進む
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
        await unifiedAnimationManager.createUnifiedEnergyAnimation('cpu', energyCards[0].id, cpuState.active.id);
        
        
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
   * CPU攻撃実行（戦略的AIアルゴリズム搭載）
   */
  async cpuPerformAttack(state) {
    let newState = cloneGameState(state);
    const activePokemon = newState.players.cpu.active;
    
    const usableAttacks = activePokemon.attacks
      .map((attack, index) => ({ ...attack, index }))
      .filter(attack => Logic.hasEnoughEnergy(activePokemon, attack));

    if (usableAttacks.length > 0) {
      // 戦略的AI: 最適な攻撃を選択
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
   * 戦略的攻撃選択アルゴリズム
   */
  _selectBestAttack(state, usableAttacks, attacker) {
    const defender = state.players.player.active;
    let bestAttack = usableAttacks[0];
    let bestScore = -1;
    
    for (const attack of usableAttacks) {
      let score = this._calculateAttackScore(state, attack, attacker, defender);
      
      if (score > bestScore) {
        bestScore = score;
        bestAttack = attack;
      }
    }
    
    return bestAttack;
  }

  /**
   * 攻撃の戦略的スコア計算
   */
  _calculateAttackScore(state, attack, attacker, defender) {
    if (!defender) return 0;
    
    let score = 0;
    const baseDamage = attack.damage || 0;
    
    // 1. 基本ダメージスコア
    score += baseDamage * 10;
    
    // 2. 弱点ボーナス（大幅加点）
    if (defender.weakness && Array.isArray(defender.weakness)) {
      const attackerType = attacker.types?.[0];
      const hasWeakness = defender.weakness.some(w => w.type === attackerType);
      if (hasWeakness) {
        score += 300; // 弱点攻撃は高優先度
      }
    }
    
    // 3. 抵抗力ペナルティ
    if (defender.resistance && Array.isArray(defender.resistance)) {
      const attackerType = attacker.types?.[0];
      const hasResistance = defender.resistance.some(r => r.type === attackerType);
      if (hasResistance) {
        score -= 100;
      }
    }
    
    // 4. きぜつ判定（最高優先度）
    const currentDamage = defender.damage || 0;
    const potentialDamage = baseDamage; // 簡易計算
    if (currentDamage + potentialDamage >= defender.hp) {
      score += 1000; // きぜつできる攻撃は最優先
    }
    
    // 5. 特殊効果による追加スコア
    if (attack.text_ja) {
      // 特殊状態を与える攻撃の価値
      if (attack.text_ja.includes('毒')) score += 50;
      if (attack.text_ja.includes('火傷')) score += 60;
      if (attack.text_ja.includes('まひ')) score += 80;
      if (attack.text_ja.includes('眠り')) score += 70;
      if (attack.text_ja.includes('混乱')) score += 75;
      
      // エネルギー除去系の価値
      if (attack.text_ja.includes('エネルギー')) score += 40;
      
      // ドロー妨害系の価値
      if (attack.text_ja.includes('手札') || attack.text_ja.includes('山札')) score += 30;
    }
    
    // 6. コスト効率計算
    const energyCost = (attack.cost || []).length;
    if (energyCost > 0) {
      const efficiency = baseDamage / energyCost;
      score += efficiency * 5;
    }
    
    // 7. 状況判断
    // 相手のHP残量による戦略
    const defenderHpRatio = (defender.hp - (defender.damage || 0)) / defender.hp;
    if (defenderHpRatio < 0.3) {
      // 相手が瀕死の場合はとどめを優先
      score += baseDamage * 20;
    } else if (defenderHpRatio > 0.8) {
      // 相手が元気な場合は特殊効果重視
      if (attack.text_ja) score += 100;
    }
    
    // 8. サイド状況による判断
    const playerPrizesRemaining = state.players.player.prizeRemaining || 6;
    const cpuPrizesRemaining = state.players.cpu.prizeRemaining || 6;
    
    if (playerPrizesRemaining <= 2) {
      // プレイヤーが勝利寸前なら積極的に攻撃
      score += 200;
    }
    if (cpuPrizesRemaining <= 2) {
      // 自分が勝利寸前ならきぜつ狙いを重視
      if (currentDamage + potentialDamage >= defender.hp) {
        score += 500;
      }
    }
    
    return score;
  }

  /**
   * 統合バトルシーケンスの実行
   */
  async _executeUnifiedBattleSequence(state, attackingPlayerId, defendingPlayerId, attackIndex) {
    const attacker = state.players[attackingPlayerId].active;
    const defender = state.players[defendingPlayerId].active;
    const attack = attacker.attacks[attackIndex];
    
    if (!attacker || !defender || !attack) return;
    
    // ダメージ計算（表示用）
    const baseDamage = attack.damage || 0;
    const { damage: finalDamage, modifiers } = Logic.calculateDamageModifiers(baseDamage, attacker, defender);
    
    // アニメーションデータ準備
    const attackData = {
      attacker,
      defender,
      attack,
      damage: finalDamage,
      modifiers
    };
    
    try {
      // 新しい統合アニメーションシステムを使用
      await unifiedAnimationManager.createUnifiedAttackAnimation(
        attackingPlayerId, 
        defendingPlayerId, 
        attackData
      );
      
      // 画面シェイクエフェクト
      let shakeIntensity = 'normal';
      if (modifiers.some(m => m.type === 'weakness')) {
        shakeIntensity = 'super';
      } else if (finalDamage >= 80) {
        shakeIntensity = 'heavy';
      } else if (finalDamage >= 50) {
        shakeIntensity = 'normal';
      } else {
        shakeIntensity = 'light';
      }
      
      unifiedAnimationManager.createScreenShakeEffect(shakeIntensity);
      
    } catch (error) {
      console.error('❌ Error in unified battle sequence:', error);
      // フォールバック: 基本アニメーション
      await this.animateAttack(attackingPlayerId, state);
    }
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

    if (handElement) {
      const cards = handElement.querySelectorAll('.relative');
      const lastCard = cards.length ? cards[cards.length - 1] : null;
      if (lastCard) {
        await unifiedAnimationManager.animateCardDraw(playerId, lastCard, 
          { personality: 'focused', spectacle: 'gentle' });
      }
    }
  }

  /**
   * 攻撃アニメーション
   */
  async animateAttack(attackerId, state) {
    const defenderId = attackerId === 'player' ? 'cpu' : 'player';
    await unifiedAnimationManager.animateAttack(attackerId, defenderId, 
      { personality: 'fierce', spectacle: 'spectacular' });
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
    noop('🔄 Turn manager reset');
  }
}

// デフォルトのターンマネージャーインスタンス
export const turnManager = new TurnManager();
