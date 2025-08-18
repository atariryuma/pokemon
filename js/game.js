/**
 * ポケモンカードバトルゲーム - ゲームコントローラークラス
 * 学習用ゲームとして設計されており、SLV（State-Logic-View）アーキテクチャの中核
 */

import { createInitialState } from './state.js';
import { Logic } from './logic.js';
import { View } from './view.js';
import { animationManager } from './animations.js';
import { feedbackSystem } from './feedback.js';

/**
 * メインゲームコントローラークラス
 * State（状態）、Logic（ロジック）、View（ビュー）を統合し、ゲーム進行を管理
 */
export class Game {
    constructor() {
        // 現在のゲーム状態
        this.state = null;
        
        // ビューレイヤー（DOM操作担当）
        this.view = null;
        
        // セットアップフェーズの選択状態
        this.setupSelection = {
            active: null,      // 選択されたアクティブポケモン
            bench: [],         // 選択されたベンチポケモン（最大5体）
            currentCard: null  // 現在選択中のカード
        };
        
        // ゲームイベントハンドラー
        this.eventHandlers = {};
        
        // デバッグモード
        this.debug = true;
        
        this.log('🎮 Gameクラスが初期化されました');
    }
    
    /**
     * ゲームの初期化
     * ビューの作成、状態の初期化、イベントハンドラーの設定を行う
     */
    async init() {
        try {
            this.log('🔄 ゲームを初期化中...');
            
            // 初期状態を作成
            this.state = createInitialState();
            this.log('✅ 初期状態を作成しました');
            
            // ビューを初期化
            this.view = new View(animationManager);
            this.log('✅ ビューを初期化しました');
            
            // イベントハンドラーを設定
            this._setupEventHandlers();
            this.log('✅ イベントハンドラーを設定しました');
            
            // ゲームをセットアップ
            await this._setupGame();
            this.log('✅ ゲームセットアップが完了しました');
            
        } catch (error) {
            this.error('ゲーム初期化エラー:', error);
            feedbackSystem.error('ゲームの初期化に失敗しました', { critical: true });
            throw error;
        }
    }
    
    /**
     * ゲームのセットアップ
     * デッキ作成、初期手札配布、初期ポケモン選択フェーズへ移行
     */
    async _setupGame() {
        try {
            // Logic.setupGameを使用してゲームを初期化
            this.state = Logic.setupGame(this.state);
            this.log('🎲 デッキ作成と初期手札配布が完了しました');
            
            // 初期ポケモン選択フェーズに移行
            this.state.gamePhase = 'initialPokemonSelection';
            this.state.message = '手札からバトルポケモンを選んでください';
            
            // 画面を更新
            this._updateView();
            
        } catch (error) {
            this.error('ゲームセットアップエラー:', error);
            feedbackSystem.error('ゲームのセットアップに失敗しました', { critical: true });
            throw error;
        }
    }
    
    /**
     * イベントハンドラーの設定
     * ユーザーのクリックやボタン操作に対応するハンドラーを設定
     */
    _setupEventHandlers() {
        const handlers = {
            // ターン終了ボタン
            onEndTurnClick: () => this._handleEndTurn(),
            
            // カードクリック
            onCardClick: (cardId, owner, zone) => this._handleCardClick(cardId, owner, zone),
            
            // セットアップフェーズ関連
            onSetupConfirm: () => this._handleSetupConfirm(),
            onSetupHandClick: (cardId) => this._handleSetupHandClick(cardId),
            onSetupSlotClick: (slotType, slotIndex) => this._handleSetupSlotClick(slotType, slotIndex),
            
            // 攻撃・にげる
            onAttackClick: () => this._handleAttackClick(),
            onRetreatClick: () => this._handleRetreatClick(),
            
            // エネルギー対象選択
            onTargetPokemonClick: (cardId, owner, zone) => this._handleTargetPokemonClick(cardId, owner, zone)
        };
        
        this.view.bindEvents(handlers);
        this.log('🔗 イベントハンドラーを設定しました');
    }
    
    /**
     * ビューを更新する
     * 現在の状態に基づいてUIを再描画
     */
    _updateView() {
        if (!this.view || !this.state) {
            this.warn('ビューまたは状態が初期化されていません');
            feedbackSystem.error('ビューまたは状態が初期化されていません');
            return;
        }
        
        try {
            this.view.render(this.state, this.setupSelection);
        } catch (error) {
            this.error('ビュー更新エラー:', error);
            feedbackSystem.error('画面の更新に失敗しました', { critical: true });
        }
    }
    
    /**
     * ターン終了ボタンのクリックハンドラー
     */
    _handleEndTurn() {
        this.log('⏭️ ターン終了が要求されました');
        
        if (this.state.currentTurnPlayerId !== 'player') {
            this.log('❌ プレイヤーのターンではありません');
            feedbackSystem.warning('プレイヤーのターンではありません');
            return;
        }
        
        if (this.state.gamePhase !== 'playerTurn') {
            this.log('❌ ターン終了できない状態です');
            feedbackSystem.warning('ターン終了できない状態です');
            return;
        }
        
        // ターンを終了
        this._endPlayerTurn();
    }
    
    /**
     * カードクリックのハンドラー
     * @param {string} cardId - クリックされたカードのID
     * @param {string} owner - カードの所有者（'you' or 'cpu'）
     * @param {string} zone - カードの場所（'hand', 'active', 'bench', etc.）
     */
    _handleCardClick(cardId, owner, zone) {
        this.log(`🎯 カードクリック: ${cardId} (${owner}, ${zone})`);
        
        // ゲームフェーズに応じた処理
        if (this.state.gamePhase === 'initialPokemonSelection') {
            // セットアップフェーズでは手札のカードのみ処理
            if (owner === 'you' && zone === 'hand') {
                this._handleSetupHandClick(cardId);
            }
        } else if (this.state.gamePhase === 'playerTurn') {
            // プレイヤーターンでの処理
            this._handlePlayerTurnCardClick(cardId, owner, zone);
        }
    }
    
    /**
     * プレイヤーターン中のカードクリック処理
     * @param {string} cardId - カードID
     * @param {string} owner - 所有者
     * @param {string} zone - ゾーン
     */
    _handlePlayerTurnCardClick(cardId, owner, zone) {
        if (owner !== 'you') {
            this.log('❌ 相手のカードはクリックできません');
            return;
        }
        
        const card = this._findCardById(cardId);
        if (!card) {
            this.log(`❌ カードが見つかりません: ${cardId}`);
            return;
        }
        
        // 手札からのカードプレイ
        if (zone === 'hand') {
            this._handleHandCardPlay(card);
        }
    }
    
    /**
     * 手札からのカードプレイ処理
     * @param {Object} card - プレイするカード
     */
    _handleHandCardPlay(card) {
        if (card.card_type === 'Pokémon') {
            this._handlePokemonPlay(card);
        } else if (card.card_type === 'Basic Energy') {
            this._handleEnergyPlay(card);
        } else if (card.card_type === 'Trainer') {
            this._handleTrainerPlay(card);
        }
    }
    
    /**
     * ポケモンカードのプレイ処理
     * @param {Object} card - ポケモンカード
     */
    _handlePokemonPlay(card) {
        if (card.stage === 'BASIC') {
            // たねポケモンをベンチに出す
            if (this.state.players.player.bench.length >= 5) {
                this.state.message = 'ベンチが満杯です';
                feedbackSystem.warning('ベンチが満杯です');
                this._updateView();
                return;
            }
            
            this.state = Logic.playBasicPokemon(this.state, 'player', card.id);
            this.state.message = `${card.name_ja}をベンチに出しました`;
            feedbackSystem.success(`${card.name_ja}をベンチに出しました`);
            this._updateView();
            this.log(`🎭 ${card.name_ja}をベンチに出しました`);
        }
        // TODO: 進化ポケモンの処理
    }
    
    /**
     * エネルギーカードのプレイ処理
     * @param {Object} card - エネルギーカード
     */
    _handleEnergyPlay(card) {
        // エネルギー付与対象選択モードに入る
        this.view.enterTargetSelectionMode(
            this.state.players.player.activePokemon,
            this.state.players.player.bench
        );
        
        this.state.selectedEnergyCard = card;
        this.state.message = 'エネルギーを付けるポケモンを選んでください';
        this._updateView();
    }
    
    /**
     * セットアップ確定ボタンのハンドラー
     */
    _handleSetupConfirm() {
        this.log('✅ セットアップ確定が要求されました');
        
        if (!this.setupSelection.active) {
            this.state.message = 'バトルポケモンを選んでください';
            feedbackSystem.warning('バトルポケモンを選んでください');
            this._updateView();
            return;
        }
        
        // セットアップを完了
        this._completeSetup();
    }
    
    /**
     * セットアップフェーズでの手札クリック
     * @param {string} cardId - クリックされたカードのID
     */
    _handleSetupHandClick(cardId) {
        const card = this._findCardById(cardId);
        if (!card || card.card_type !== 'Pokémon' || card.stage !== 'BASIC') {
            this.log('❌ たねポケモンのみ選択できます');
            return;
        }
        
        this.setupSelection.currentCard = card;
        this.view.highlightSetupCard(cardId);
        this.log(`📝 セットアップでカードを選択: ${card.name_ja}`);
    }
    
    /**
     * セットアップフェーズでのスロットクリック
     * @param {string} slotType - スロットタイプ（'active' or 'bench'）
     * @param {number|null} slotIndex - ベンチスロットのインデックス
     */
    _handleSetupSlotClick(slotType, slotIndex) {
        if (!this.setupSelection.currentCard) {
            this.state.message = '最初にポケモンカードを選んでください';
            this._updateView();
            return;
        }
        
        if (slotType === 'active') {
            this.setupSelection.active = this.setupSelection.currentCard;
            this.log(`🎯 アクティブポケモンを設定: ${this.setupSelection.active.name_ja}`);
        } else if (slotType === 'bench' && slotIndex !== null) {
            this.setupSelection.bench[slotIndex] = this.setupSelection.currentCard;
            this.log(`🪑 ベンチ${slotIndex + 1}にポケモンを配置: ${this.setupSelection.currentCard.name_ja}`);
        }
        
        this.setupSelection.currentCard = null;
        this.view.clearSetupHighlights();
        this._updateView();
    }
    
    /**
     * セットアップを完了
     */
    _completeSetup() {
        try {
            // セットアップ選択をゲーム状態に反映
            this.state = Logic.completeInitialSetup(this.state, this.setupSelection);
            
            // プレイヤーターンに移行
            this.state.gamePhase = 'playerTurn';
            this.state.currentTurnPlayerId = 'player';
            this.state.message = 'あなたのターンです';
            
            feedbackSystem.success('セットアップが完了しました！ゲーム開始です');
            this._updateView();
            this.log('🎉 セットアップが完了しました。ゲーム開始！');
            
        } catch (error) {
            this.error('セットアップ完了エラー:', error);
            this.state.message = 'セットアップに失敗しました';
            feedbackSystem.error('セットアップに失敗しました');
            this._updateView();
        }
    }
    
    /**
     * 攻撃ボタンのハンドラー
     */
    _handleAttackClick() {
        this.log('⚔️ 攻撃が要求されました');
        
        const playerPokemon = this.state.players.player.activePokemon;
        if (!playerPokemon) {
            this.state.message = 'アクティブポケモンがいません';
            this._updateView();
            return;
        }
        
        // 攻撃選択モーダルを表示
        this.view.showAttackModal(
            playerPokemon,
            (attackIndex) => this._executeAttack(attackIndex),
            () => this.log('🚫 攻撃がキャンセルされました')
        );
    }
    
    /**
     * 攻撃を実行
     * @param {number} attackIndex - 使用する攻撃のインデックス
     */
    _executeAttack(attackIndex) {
        try {
            this.state = Logic.performAttack(this.state, 'player', attackIndex);
            this._updateView();
            
            // プレイヤーターン終了
            this._endPlayerTurn();
            
        } catch (error) {
            this.error('攻撃実行エラー:', error);
            this.state.message = '攻撃に失敗しました';
            feedbackSystem.error('攻撃に失敗しました');
            this._updateView();
        }
    }
    
    /**
     * にげるボタンのハンドラー
     */
    _handleRetreatClick() {
        this.log('🏃 にげるが要求されました');
        
        const activePokemon = this.state.players.player.activePokemon;
        const benchPokemon = this.state.players.player.bench;
        
        if (!activePokemon) {
            this.state.message = 'アクティブポケモンがいません';
            this._updateView();
            return;
        }
        
        if (benchPokemon.length === 0) {
            this.state.message = 'ベンチにポケモンがいません';
            this._updateView();
            return;
        }
        
        // にげる選択モーダルを表示
        this.view.showRetreatModal(
            activePokemon,
            benchPokemon,
            (pokemonId) => this._executeRetreat(pokemonId),
            () => this.log('🚫 にげるがキャンセルされました')
        );
    }
    
    /**
     * にげるを実行
     * @param {string} pokemonId - 入れ替えるポケモンのID
     */
    _executeRetreat(pokemonId) {
        try {
            this.state = Logic.retreatPokemon(this.state, 'player', pokemonId);
            feedbackSystem.success('ポケモンを入れ替えました');
            this._updateView();
            this.log('🔄 ポケモンを入れ替えました');
            
        } catch (error) {
            this.error('にげる実行エラー:', error);
            this.state.message = 'にげることに失敗しました';
            feedbackSystem.error('にげることに失敗しました');
            this._updateView();
        }
    }
    
    /**
     * エネルギー対象ポケモンクリックのハンドラー
     * @param {string} cardId - 対象ポケモンのID
     * @param {string} owner - 所有者
     * @param {string} zone - ゾーン
     */
    _handleTargetPokemonClick(cardId, owner, zone) {
        if (!this.state.selectedEnergyCard) {
            this.log('❌ エネルギーカードが選択されていません');
            return;
        }
        
        if (owner !== 'you') {
            this.log('❌ 相手のポケモンにはエネルギーを付けられません');
            return;
        }
        
        try {
            // エネルギーを付与
            this.state = Logic.attachEnergy(this.state, 'player', this.state.selectedEnergyCard.id, cardId);
            
            // 選択状態をクリア
            this.state.selectedEnergyCard = null;
            this.view.exitTargetSelectionMode();
            
            this.state.message = 'エネルギーを付けました';
            feedbackSystem.success('エネルギーを付けました');
            this._updateView();
            this.log('⚡ エネルギーを付与しました');
            
        } catch (error) {
            this.error('エネルギー付与エラー:', error);
            this.state.message = 'エネルギーの付与に失敗しました';
            feedbackSystem.error('エネルギーの付与に失敗しました');
            this._updateView();
        }
    }
    
    /**
     * プレイヤーターンを終了
     */
    _endPlayerTurn() {
        this.log('📝 プレイヤーターンを終了します');
        
        // CPUターンに移行
        this.state.currentTurnPlayerId = 'cpu';
        this.state.gamePhase = 'cpuTurn';
        this.state.message = 'CPUのターンです';
        
        feedbackSystem.info('CPUのターンです');
        this._updateView();
        
        // CPUターンを実行
        setTimeout(() => this._executeCpuTurn(), 1000);
    }
    
    /**
     * CPUターンを実行
     */
    async _executeCpuTurn() {
        this.log('🤖 CPUターンを実行中...');
        
        try {
            // シンプルなCPU行動
            this.state = Logic.executeCpuTurn(this.state);
            
            // プレイヤーターンに戻る
            this.state.currentTurnPlayerId = 'player';
            this.state.gamePhase = 'playerTurn';
            this.state.turnCount++;
            this.state.message = 'あなたのターンです';
            
            feedbackSystem.info('あなたのターンです');
            this._updateView();
            this.log('✅ CPUターンが完了しました');
            
        } catch (error) {
            this.error('CPUターン実行エラー:', error);
            feedbackSystem.error('CPUターンの実行でエラーが発生しました');
        }
    }
    
    /**
     * カードIDからカードオブジェクトを検索
     * @param {string} cardId - 検索するカードのID
     * @returns {Object|null} 見つかったカードオブジェクト
     */
    _findCardById(cardId) {
        const allCards = [
            ...this.state.players.player.hand,
            ...this.state.players.player.bench,
            ...this.state.players.cpu.hand,
            ...this.state.players.cpu.bench
        ];
        
        if (this.state.players.player.activePokemon) {
            allCards.push(this.state.players.player.activePokemon);
        }
        
        if (this.state.players.cpu.activePokemon) {
            allCards.push(this.state.players.cpu.activePokemon);
        }
        
        return allCards.find(card => card && card.id === cardId) || null;
    }
    
    /**
     * ゲームのクリーンアップ
     */
    cleanup() {
        if (this.view) {
            this.view.clearAllHighlights();
        }
        
        if (animationManager) {
            animationManager.clearAllAnimations();
        }
        
        this.log('🧹 ゲームをクリーンアップしました');
    }
    
    /**
     * ログ出力（デバッグ用）
     * @param {string} message - ログメッセージ
     */
    log(message) {
        if (this.debug) {
            console.log(`[Game] ${message}`);
        }
    }
    
    /**
     * 警告ログ出力
     * @param {string} message - 警告メッセージ
     */
    warn(message) {
        console.warn(`[Game Warning] ${message}`);
    }
    
    /**
     * エラーログ出力
     * @param {string} message - エラーメッセージ
     * @param {Error} error - エラーオブジェクト（オプション）
     */
    error(message, error = null) {
        console.error(`[Game Error] ${message}`, error);
    }

    /**
     * 進化ポケモンの処理（既存のポケモンカード処理から分離）
     * @param {Object} evolutionCard - 進化カード
     */
    _handleEvolutionPlay(evolutionCard) {
        // 進化可能なポケモンを取得
        const evolutionOptions = Logic.getEvolutionOptions(this.state, 'player');
        const validOptions = evolutionOptions.filter(option => 
            option.evolutionCard.id === evolutionCard.id
        );

        if (validOptions.length === 0) {
            this.state.message = '進化できるポケモンがいません。';
            this._updateView();
            return;
        }

        if (validOptions.length === 1) {
            // 進化対象が1体だけなら自動進化
            const option = validOptions[0];
            this.state = Logic.evolvePokemon(this.state, 'player', option.basePokemon.id, evolutionCard.id);
            this._updateView();
            // 進化アニメーショントリガー
            this._triggerEvolutionAnimation(option.basePokemon, evolutionCard);
        } else {
            // 複数の進化対象がある場合は選択モード
            this.state.gamePhase = 'selectEvolutionTarget';
            this.state.pendingEvolution = {card: evolutionCard, options: validOptions};
            this.state.message = '進化させるポケモンを選んでください。';
            this._updateView();
        }
    }

    /**
     * トレーナーズカードの処理
     * @param {Object} trainerCard - トレーナーズカード
     */
    _handleTrainerPlay(trainerCard) {
        // サポーターは1ターンに1枚しか使用できない
        if (trainerCard.trainer_type === 'Supporter' && this.state.supporterUsedThisTurn) {
            this.state.message = 'サポーターは1ターンに1枚しか使用できません。';
            this._updateView();
            return;
        }

        this.state = Logic.playTrainer(this.state, 'player', trainerCard.id);
        
        if (trainerCard.trainer_type === 'Supporter') {
            this.state.supporterUsedThisTurn = true;
        }
        
        this._updateView();
    }

    /**
     * 進化アニメーションをトリガー
     * @param {Object} basePokemon - 進化元ポケモン
     * @param {Object} evolutionCard - 進化先ポケモン
     */
    _triggerEvolutionAnimation(basePokemon, evolutionCard) {
        // 進化アニメーションをアニメーションマネージャーに委託
        const pokemonElement = document.querySelector(`[data-card-id="${basePokemon.id}"]`);
        if (pokemonElement && this.animationManager) {
            this.animationManager.animateEvolution(pokemonElement, evolutionCard);
        }
    }
}