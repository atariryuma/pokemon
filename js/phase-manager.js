/**
 * PHASE-MANAGER.JS - ゲームフェーズ管理システム
 * 
 * game_sequence.mdで定義されたフェーズシーケンスを管理
 */

/**
 * ゲームフェーズの定義
 */
export const GAME_PHASES = {
  // セットアップフェーズ
  SETUP: 'setup',
  INITIAL_POKEMON_SELECTION: 'initialPokemonSelection',
  
  // プレイヤーターンフェーズ
  PLAYER_TURN: 'playerTurn',
  PLAYER_DRAW: 'playerDraw',
  PLAYER_MAIN: 'playerMain',
  PLAYER_ATTACK: 'playerAttack',
  
  // CPUターンフェーズ
  CPU_TURN: 'cpuTurn',
  CPU_DRAW: 'cpuDraw',
  CPU_MAIN: 'cpuMain',
  CPU_ATTACK: 'cpuAttack',
  
  // 特殊フェーズ
  AWAITING_NEW_ACTIVE: 'awaitingNewActive',
  PRIZE_SELECTION: 'prizeSelection',
  GAME_OVER: 'gameOver'
};

/**
 * フェーズ遷移管理クラス
 */
export class PhaseManager {
  constructor() {
    this.currentPhase = GAME_PHASES.SETUP;
    this.previousPhase = null;
    this.phaseData = {}; // フェーズ固有のデータ保存
  }

  /**
   * フェーズ遷移
   * @param {string} newPhase - 新しいフェーズ
   * @param {object} data - フェーズデータ
   */
  transitionTo(newPhase, data = {}) {
    console.log(`🎭 Phase transition: ${this.currentPhase} → ${newPhase}`);
    
    this.previousPhase = this.currentPhase;
    this.currentPhase = newPhase;
    this.phaseData = { ...this.phaseData, ...data };
    
    return {
      phase: newPhase,
      previousPhase: this.previousPhase,
      phaseData: this.phaseData
    };
  }

  /**
   * セットアップフェーズ関連の遷移チェック
   */
  canAdvanceFromSetup(state) {
    if (this.currentPhase !== GAME_PHASES.SETUP) return false;
    
    // 基本的なセットアップが完了しているかチェック
    const player = state.players.player;
    const cpu = state.players.cpu;
    
    return (
      player.hand.length === 7 &&
      cpu.hand.length === 7 &&
      player.prize.length === 6 &&
      cpu.prize.length === 6
    );
  }

  /**
   * 初期ポケモン選択の完了チェック
   */
  canAdvanceFromPokemonSelection(state) {
    if (this.currentPhase !== GAME_PHASES.INITIAL_POKEMON_SELECTION) return false;
    
    const player = state.players.player;
    const cpu = state.players.cpu;
    
    return player.active !== null && cpu.active !== null;
  }

  /**
   * プレイヤーターンの開始可能チェック
   */
  canStartPlayerTurn(state) {
    return (
      this.currentPhase === GAME_PHASES.INITIAL_POKEMON_SELECTION &&
      this.canAdvanceFromPokemonSelection(state)
    ) || (
      this.currentPhase === GAME_PHASES.CPU_TURN
    );
  }

  /**
   * プレイヤーがメインフェーズに進めるかチェック
   */
  canEnterPlayerMainPhase(state) {
    return (
      this.currentPhase === GAME_PHASES.PLAYER_DRAW &&
      state.hasDrawnThisTurn === true
    );
  }

  /**
   * 攻撃フェーズに進めるかチェック
   */
  canEnterAttackPhase(state, player) {
    const playerState = state.players[player];
    const activePokemon = playerState.active;
    
    if (!activePokemon || !activePokemon.attacks) return false;
    
    // 使用可能な攻撃があるかチェック（ここではLogic.hasEnoughEnergyを使用する想定）
    return activePokemon.attacks.some(attack => 
      this.hasEnoughEnergyForAttack(activePokemon, attack)
    );
  }

  /**
   * エネルギーチェックのヘルパー（Logic.jsから移植）
   * TODO: Logic.jsのhasEnoughEnergyを使用するように修正
   */
  hasEnoughEnergyForAttack(pokemon, attack) {
    const attached = (pokemon.attached_energy || []).map(e => e.energy_type);
    const cost = [...attack.cost];

    for (let i = attached.length - 1; i >= 0; i--) {
      const energyType = attached[i];
      const costIndex = cost.findIndex(c => c === energyType || c === 'Colorless');
      if (costIndex !== -1) {
        cost.splice(costIndex, 1);
        attached.splice(i, 1);
      }
    }
    
    return cost.length === 0 || (cost.every(c => c === 'Colorless') && attached.length >= cost.length);
  }

  /**
   * ターン終了可能チェック
   */
  canEndTurn(state, player) {
    // 攻撃後は強制的にターン終了
    if (this.currentPhase === GAME_PHASES.PLAYER_ATTACK || this.currentPhase === GAME_PHASES.CPU_ATTACK) {
      return true;
    }
    
    // メインフェーズからは任意でターン終了可能
    return (
      this.currentPhase === GAME_PHASES.PLAYER_MAIN ||
      this.currentPhase === GAME_PHASES.CPU_MAIN
    );
  }

  /**
   * ゲーム終了条件チェック
   */
  shouldEndGame(state) {
    // セットアップフェーズ中は勝敗判定を行わない
    if (state.phase === GAME_PHASES.SETUP || state.phase === GAME_PHASES.INITIAL_POKEMON_SELECTION) {
      return null;
    }
    
    const playerPrizes = state.players.player.prizeRemaining;
    const cpuPrizes = state.players.cpu.prizeRemaining;
    
    // サイドカード条件
    if (playerPrizes <= 0 || cpuPrizes <= 0) {
      return {
        winner: playerPrizes <= 0 ? 'player' : 'cpu',
        reason: 'prizes'
      };
    }
    
    // ポケモン不在条件（セットアップ完了後のみチェック）
    const playerHasPokemon = state.players.player.active || 
      state.players.player.bench.some(p => p !== null);
    const cpuHasPokemon = state.players.cpu.active || 
      state.players.cpu.bench.some(p => p !== null);
    
    if (!playerHasPokemon || !cpuHasPokemon) {
      return {
        winner: !playerHasPokemon ? 'cpu' : 'player',
        reason: 'no_pokemon'
      };
    }
    
    // 山札切れ条件
    if (state.players.player.deck.length === 0 || state.players.cpu.deck.length === 0) {
      return {
        winner: state.players.player.deck.length === 0 ? 'cpu' : 'player',
        reason: 'deck_out'
      };
    }
    
    return null;
  }

  /**
   * フェーズに応じたプロンプトメッセージを取得
   */
  getPhasePrompt(state) {
    switch (this.currentPhase) {
      case GAME_PHASES.SETUP:
        return '手札からたねポケモンをバトル場とベンチに配置してください。';
      
      case GAME_PHASES.INITIAL_POKEMON_SELECTION:
        return '初期ポケモンの配置を確認して「確定」を押してください。';
      
      case GAME_PHASES.PLAYER_DRAW:
        return '山札をクリックしてカードを引いてください。';
      
      case GAME_PHASES.PLAYER_MAIN:
        return 'あなたのターンです。アクションを選択してください。';
      
      case GAME_PHASES.PLAYER_ATTACK:
        return '攻撃を選択してください。';
      
      case GAME_PHASES.CPU_TURN:
      case GAME_PHASES.CPU_DRAW:
      case GAME_PHASES.CPU_MAIN:
      case GAME_PHASES.CPU_ATTACK:
        return '相手のターンです。';
      
      case GAME_PHASES.AWAITING_NEW_ACTIVE:
        return '新しいバトルポケモンをベンチから選んでください。';
      
      case GAME_PHASES.PRIZE_SELECTION:
        return 'サイドカードを選んで取ってください。';
      
      case GAME_PHASES.GAME_OVER:
        return 'ゲーム終了！';
      
      default:
        return '';
    }
  }

  /**
   * フェーズに応じた使用可能なアクションを取得
   */
  getAvailableActions(state) {
    const actions = [];
    
    switch (this.currentPhase) {
      case GAME_PHASES.SETUP:
      case GAME_PHASES.INITIAL_POKEMON_SELECTION:
        if (state.players.player.active) {
          actions.push('confirm-setup');
        }
        break;
      
      case GAME_PHASES.PLAYER_DRAW:
        if (!state.hasDrawnThisTurn) {
          actions.push('draw-card');
        } else {
          // ドロー完了後は自動的にメインフェーズに移行
          return this.getAvailableActions({
            ...state,
            phase: GAME_PHASES.PLAYER_MAIN
          });
        }
        break;
      
      case GAME_PHASES.PLAYER_MAIN:
        actions.push('play-pokemon', 'attach-energy', 'use-trainer', 'retreat');
        if (this.canEnterAttackPhase(state, 'player')) {
          actions.push('attack');
        }
        actions.push('end-turn');
        break;
      
      case GAME_PHASES.AWAITING_NEW_ACTIVE:
        actions.push('select-new-active');
        break;
      
      case GAME_PHASES.PRIZE_SELECTION:
        actions.push('take-prize');
        break;
    }
    
    return actions;
  }

  /**
   * 現在のフェーズ情報を取得
   */
  getCurrentPhaseInfo(state) {
    return {
      phase: this.currentPhase,
      previousPhase: this.previousPhase,
      prompt: this.getPhasePrompt(state),
      availableActions: this.getAvailableActions(state),
      phaseData: this.phaseData
    };
  }

  /**
   * デバッグ用：フェーズ履歴を出力
   */
  logPhaseTransition() {
    console.log(`🎭 Current Phase: ${this.currentPhase}`);
    console.log(`🎭 Previous Phase: ${this.previousPhase}`);
    console.log(`🎭 Phase Data:`, this.phaseData);
  }
}

// デフォルトのフェーズマネージャーインスタンス
export const phaseManager = new PhaseManager();