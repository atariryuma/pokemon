import { createDeck, createInitialState } from './state.js';
import { cardMasterList } from './cards.js';

export const Logic = {
    /**
     * オブジェクトのディープクローンを作成する
     * @param {object} obj - クローンするオブジェクト
     * @returns {object} クローンされたオブジェクト
     */
    clone: (obj) => {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * ゲームの初期設定を行う
     * @param {GameState} initialState
     * @returns {GameState} 初期設定後のゲーム状態
     */
    setupGame: (initialState) => {
        const state = { ...initialState };

        // 1. デッキの作成とシャッフル
        state.players.player.deck = createDeck(cardMasterList);
        state.players.cpu.deck = createDeck(cardMasterList);
        console.log('Initial deck sizes - Player:', state.players.player.deck.length, 'CPU:', state.players.cpu.deck.length);

        // 2. 初期手札を引く (7枚) とマリガン処理
        const playersToSetup = ['player', 'cpu'];
        playersToSetup.forEach(playerId => {
            let player = state.players[playerId];
            let hasBasicPokemon = false;
            let attempts = 0;
            const MAX_MULLIGAN_ATTEMPTS = 5; // 無限ループ防止のための上限

            while (!hasBasicPokemon && attempts < MAX_MULLIGAN_ATTEMPTS) {
                // 手札をデッキに戻してシャッフル
                player.deck = player.deck.concat(player.hand);
                player.hand = [];
                // デッキをシャッフル
                for (let i = player.deck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
                }

                // 7枚引く
                for (let i = 0; i < 7; i++) {
                    if (player.deck.length > 0) {
                        player.hand.push(player.deck.pop());
                    }
                }
                console.log(`${playerId} hand size after draw/mulligan:`, player.hand.length, 'deck size:', player.deck.length);

                hasBasicPokemon = player.hand.some(card => card.card_type === 'Pokémon' && card.stage === 'BASIC');

                if (!hasBasicPokemon) {
                    player.mulliganCount++;
                    state.message = `${playerId === 'player' ? 'あなた' : 'CPU'}はたねポケモンがいなかったのでマリガンしました。`;
                    console.log(state.message);
                }
                attempts++;
            }
            if (!hasBasicPokemon) {
                // 極端なケース：マリガンを繰り返してもたねポケモンが出ない場合
                state.message = `${playerId === 'player' ? 'あなた' : 'CPU'}はたねポケモンを引けませんでした。ゲームを続行できません。`;
                state.gamePhase = 'gameOver';
                return state; // ゲーム終了
            }
        });

        // マリガンボーナスドロー
        if (state.players.player.mulliganCount > 0) {
            for (let i = 0; i < state.players.player.mulliganCount; i++) {
                Logic.drawCard(state, 'cpu');
                state.message += `CPUはあなたのマリガンによりカードを1枚引きました。`;
            }
        }
        if (state.players.cpu.mulliganCount > 0) {
            for (let i = 0; i < state.players.cpu.mulliganCount; i++) {
                Logic.drawCard(state, 'player');
                state.message += `あなたはCPUのマリガンによりカードを1枚引きました。`;
            }
        }

        // 初期ポケモン配置とサイドカード設定はgame.jsのhandleSetupConfirmで行うため、ここではフェーズを設定するのみ
        state.gamePhase = 'initialPokemonSelection';
        state.message = 'ゲーム開始！手札からバトルポケモンとベンチポケモンを選んでください。';
        return state;
    },

    /**
     * 初期セットアップを完了する
     * @param {GameState} state - 現在のゲーム状態
     * @param {object} setupSelection - セットアップ選択内容
     * @returns {GameState} セットアップ完了後のゲーム状態
     */
    completeInitialSetup: (state, setupSelection) => {
        const newState = Logic.clone(state);
        
        // プレイヤーの初期ポケモン配置
        if (setupSelection.active) {
            // アクティブポケモンを設定
            const activeIndex = newState.players.player.hand.findIndex(card => card.id === setupSelection.active.id);
            if (activeIndex !== -1) {
                const activePokemon = newState.players.player.hand.splice(activeIndex, 1)[0];
                newState.players.player.activePokemon = {
                    ...activePokemon,
                    currentHp: activePokemon.hp,
                    attachedEnergy: [],
                    specialConditions: []
                };
            }
        }
        
        // ベンチポケモンを設定
        setupSelection.bench.forEach(benchPokemon => {
            if (benchPokemon && newState.players.player.bench.length < 5) {
                const benchIndex = newState.players.player.hand.findIndex(card => card.id === benchPokemon.id);
                if (benchIndex !== -1) {
                    const pokemon = newState.players.player.hand.splice(benchIndex, 1)[0];
                    newState.players.player.bench.push({
                        ...pokemon,
                        currentHp: pokemon.hp,
                        attachedEnergy: [],
                        specialConditions: []
                    });
                }
            }
        });
        
        // CPUの初期ポケモン配置（自動）
        const cpuBasicPokemon = newState.players.cpu.hand.filter(card => 
            card.card_type === 'Pokémon' && card.stage === 'BASIC'
        );
        
        if (cpuBasicPokemon.length > 0) {
            // CPUのアクティブポケモンを設定（最も強いポケモンを選択）
            const strongestPokemon = cpuBasicPokemon.reduce((best, pokemon) => 
                (!best || pokemon.hp > best.hp) ? pokemon : best
            );
            
            const cpuActiveIndex = newState.players.cpu.hand.findIndex(card => card.id === strongestPokemon.id);
            if (cpuActiveIndex !== -1) {
                const activePokemon = newState.players.cpu.hand.splice(cpuActiveIndex, 1)[0];
                newState.players.cpu.activePokemon = {
                    ...activePokemon,
                    currentHp: activePokemon.hp,
                    attachedEnergy: [],
                    specialConditions: []
                };
            }
            
            // CPUのベンチポケモンを配置（残りの基本ポケモンから1-2体）
            const remainingBasic = newState.players.cpu.hand.filter(card => 
                card.card_type === 'Pokémon' && card.stage === 'BASIC'
            );
            
            const benchCount = Math.min(2, remainingBasic.length);
            for (let i = 0; i < benchCount; i++) {
                const benchIndex = newState.players.cpu.hand.findIndex(card => 
                    card.id === remainingBasic[i].id
                );
                if (benchIndex !== -1) {
                    const pokemon = newState.players.cpu.hand.splice(benchIndex, 1)[0];
                    newState.players.cpu.bench.push({
                        ...pokemon,
                        currentHp: pokemon.hp,
                        attachedEnergy: [],
                        specialConditions: []
                    });
                }
            }
        }
        
        // サイドカードの設定（各プレイヤー6枚）
        for (let i = 0; i < 6; i++) {
            if (newState.players.player.deck.length > 0) {
                newState.players.player.prizeCards.push(newState.players.player.deck.pop());
            }
            if (newState.players.cpu.deck.length > 0) {
                newState.players.cpu.prizeCards.push(newState.players.cpu.deck.pop());
            }
        }
        
        newState.gamePhase = 'playerTurn';
        newState.currentTurnPlayerId = 'player';
        newState.message = 'ゲーム開始！あなたのターンです。';
        
        return newState;
    },

    /**
     * カードを引く
     * @param {GameState} state
     * @param {string} playerId
     * @returns {GameState} 更新されたゲーム状態
     */
    drawCard: (state, playerId) => {
        const player = state.players[playerId];
        let drawnCard = null; // Initialize drawnCard
        if (player.deck.length > 0) {
            drawnCard = player.deck.pop(); // Assign drawn card
            player.hand.push(drawnCard);
            // state.message = `${playerId === 'player' ? 'あなた' : 'CPU'}はカードを1枚引きました。`; // メッセージは呼び出し元で制御
        } else {
            state.message = `${playerId === 'player' ? 'あなた' : 'CPU'}の山札がありません！`;
            // TODO: 山札切れの勝利条件
        }
        return { newState: { ...state }, drawnCard: drawnCard }; // Return both newState and drawnCard
    },

    /**
     * たねポケモンをベンチに出す
     * @param {GameState} state
     * @param {string} playerId
     * @param {string} cardId - 手札から出すカードのID
     * @returns {GameState} 更新されたゲーム状態
     */
    playBasicPokemon: (state, playerId, cardId) => {
        const player = state.players[playerId];
        const cardIndex = player.hand.findIndex(card => card.id === cardId);

        if (cardIndex === -1) {
            state.message = 'そのカードは手札にありません。';
            return { ...state };
        }

        const cardToPlay = player.hand[cardIndex];

        if (cardToPlay.card_type !== 'Pokémon' || cardToPlay.stage !== 'BASIC') {
            state.message = 'たねポケモンしかベンチに出せません。';
            return { ...state };
        }

        if (player.bench.length >= 5) {
            state.message = 'ベンチには5体までしかポケモンを出せません。';
            return { ...state };
        }

        player.hand.splice(cardIndex, 1);
        player.bench.push({ ...cardToPlay, currentHp: cardToPlay.hp, attachedEnergy: [], specialConditions: [] }); // Initialize currentHp, attachedEnergy, and specialConditions
        state.message = `${playerId === 'player' ? 'あなた' : 'CPU'}は${cardToPlay.name_ja}をベンチに出しました。`;
        return { ...state };
    },

    /**
     * エネルギーをポケモンにつける
     * @param {GameState} state
     * @param {string} playerId
     * @param {string} energyCardId - 手札からつけるエネルギーカードのID
     * @param {string} targetPokemonId - エネルギーをつけるポケモンのID (active or bench)
     * @returns {GameState} 更新されたゲーム状態
     */
    attachEnergy: (state, playerId, energyCardId, targetPokemonId) => {
        const player = state.players[playerId];

        // 1ターン1回の制限をチェック
        if (player.energyAttachedThisTurn) {
            state.message = 'このターンは既にエネルギーをつけています。';
            return { ...state };
        }

        const energyIndex = player.hand.findIndex(card => card.id === energyCardId);

        if (energyIndex === -1) {
            state.message = 'そのエネルギーカードは手札にありません。';
            return { ...state };
        }

        const energyCard = player.hand[energyIndex];
        if (energyCard.card_type !== 'Basic Energy') {
            state.message = 'エネルギーカードしかつけられません。';
            return { ...state };
        }

        let targetPokemon = null;
        if (player.activePokemon && player.activePokemon.id === targetPokemonId) {
            targetPokemon = player.activePokemon;
        } else {
            targetPokemon = player.bench.find(p => p.id === targetPokemonId);
        }

        if (!targetPokemon) {
            state.message = 'エネルギーをつけるポケモンが見つかりません。';
            return { ...state };
        }

        player.hand.splice(energyIndex, 1);
        targetPokemon.attachedEnergy.push(energyCard);
        player.energyAttachedThisTurn = true; // エネルギー付与フラグを設定
        state.message = `${playerId === 'player' ? 'あなた' : 'CPU'}は${targetPokemon.name_ja}に${energyCard.name_ja}をつけました。`;
        return { ...state };
    },

    /**
     * 技を使う
     * @param {GameState} state
     * @param {string} playerId
     * @param {number} attackIndex - 使う技のインデックス
     * @returns {GameState} 更新されたゲーム状態
     */
    useAttack: (state, playerId, attackIndex) => {
        const newState = Logic.clone(state);
        const attacker = newState.players[playerId].activePokemon;
        const defender = newState.players[playerId === 'player' ? 'cpu' : 'player'].activePokemon;

        if (!attacker || !defender) {
            newState.message = 'バトルポケモンがいません。';
            return newState;
        }

        const attack = attacker.attacks[attackIndex];
        if (!attack) {
            newState.message = 'その技は存在しません。';
            return newState;
        }

        // 詳細なエネルギーコストのチェック
        if (!Logic._canUseAttack(attacker, attack)) {
            newState.message = 'エネルギーが足りません。';
            return newState;
        }

        let damage = attack.damage;
        let messages = [`${attacker.name_ja}の${attack.name_ja}！`];

        // 特殊効果の処理（攻撃前）
        if (attack.effect_ja && attack.effect_ja.includes('回ふく')) {
            // 回復効果
            attacker.currentHp = attacker.hp;
            messages.push(`${attacker.name_ja}のHPが全回復した！`);
        }

        // ダメージ計算
        if (damage > 0) {
            // 弱点・抵抗力の計算
            let multiplier = 1;
            let resistanceReduction = 0;

            if (defender.weakness && defender.weakness.type === attacker.type) {
                multiplier = 2; // 弱点の場合ダメージ2倍
                messages.push('弱点！');
            }

            if (defender.resistance && defender.resistance.type === attacker.type) {
                resistanceReduction = 20; // 抵抗力の場合ダメージ-20
                messages.push('抵抗力！');
            }

            damage = Math.max(0, damage * multiplier - resistanceReduction);

            if (damage > 0) {
                defender.currentHp -= damage;
                messages.push(`${defender.name_ja}に${damage}ダメージ！`);
            } else {
                messages.push('ダメージを与えられなかった！');
            }
        }

        // 特殊効果の処理（攻撃後）
        if (attack.effect_ja && attack.effect_ja.includes('70ダメージ小さく')) {
            // 次の攻撃のダメージ軽減効果（簡略化のため状態として保存）
            defender.damageReduction = 70;
            messages.push(`${defender.name_ja}の次に受けるダメージが70軽減される！`);
        }

        // どく状態の付与（より広い条件でチェック）
        if (attack.effect_ja && (attack.effect_ja.includes('どく状態') || attack.effect_ja.includes('どく'))) {
            Logic._applySpecialCondition(defender, 'poisoned');
            messages.push(`${defender.name_ja}はどく状態になった！`);
        }

        newState.message = messages.join(' ');

        // きぜつチェック
        if (defender.currentHp <= 0) {
            newState.message += ` ${defender.name_ja}はきぜつした！`;
            Logic.handleKnockout(newState, playerId === 'player' ? 'cpu' : 'player');
        }

        return newState;
    },

    /**
     * 攻撃が使用可能かどうかをチェックする
     * @param {Card} pokemon - 攻撃するポケモン
     * @param {object} attack - 使用する技
     * @returns {boolean} 使用可能かどうか
     */
    _canUseAttack: (pokemon, attack) => {
        if (!attack.cost || !pokemon.attachedEnergy) return false;

        // エネルギーコストをカウント
        const costCount = {};
        attack.cost.forEach(type => {
            costCount[type] = (costCount[type] || 0) + 1;
        });

        // 付けられているエネルギーをカウント
        const attachedCount = {};
        pokemon.attachedEnergy.forEach(energy => {
            const type = energy.energy_type;
            attachedCount[type] = (attachedCount[type] || 0) + 1;
        });

        // コストを満たしているかチェック
        for (const [costType, needed] of Object.entries(costCount)) {
            if (costType === 'Colorless') {
                // 無色エネルギーは任意のエネルギーで代用可能
                const totalEnergy = Object.values(attachedCount).reduce((sum, count) => sum + count, 0);
                const usedSpecificEnergy = Object.entries(costCount)
                    .filter(([type]) => type !== 'Colorless')
                    .reduce((sum, [type, count]) => sum + Math.min(count, attachedCount[type] || 0), 0);
                const availableForColorless = totalEnergy - usedSpecificEnergy;
                if (availableForColorless < needed) return false;
            } else {
                // 特定タイプのエネルギーが必要
                if ((attachedCount[costType] || 0) < needed) return false;
            }
        }

        return true;
    },

    /**
     * ポケモンが使用可能な攻撃のリストを取得する
     * @param {Card} pokemon - 攻撃するポケモン
     * @returns {Array<{index: number, attack: object, canUse: boolean}>} 攻撃情報の配列
     */
    getAvailableAttacks: (pokemon) => {
        if (!pokemon || !pokemon.attacks) return [];

        return pokemon.attacks.map((attack, index) => ({
            index,
            attack,
            canUse: Logic._canUseAttack(pokemon, attack)
        }));
    },

    /**
     * きぜつ処理
     * @param {GameState} state
     * @param {string} knockedOutPlayerId - きぜつしたポケモンのプレイヤーID
     * @returns {GameState} 更新されたゲーム状態
     */
    handleKnockout: (state, knockedOutPlayerId) => {
        const knockedOutPlayer = state.players[knockedOutPlayerId];
        const attackingPlayer = state.players[knockedOutPlayerId === 'player' ? 'cpu' : 'player'];

        // きぜつしたポケモンとついているカードをトラッシュ
        knockedOutPlayer.discardPile.push(knockedOutPlayer.activePokemon);
        knockedOutPlayer.activePokemon.attachedEnergy.forEach(energy => knockedOutPlayer.discardPile.push(energy));
        knockedOutPlayer.activePokemon = null;

        // サイドカードを取る
        if (attackingPlayer.prizeCards.length > 0) {
            const prizeCard = attackingPlayer.prizeCards.pop();
            attackingPlayer.hand.push(prizeCard);
            state.message += `${attackingPlayer.id === 'player' ? 'あなた' : 'CPU'}はサイドカードを1枚取った！`;
        }

        // 新しいバトルポケモンを出す必要がある
        if (knockedOutPlayer.bench.length > 0) {
            if (knockedOutPlayer.id === 'cpu') {
                // CPUの場合は自動で選択
                Logic._selectCpuNewActive(state);
            } else {
                // プレイヤーの場合は選択フェーズに移行
                state.message += `新しいバトルポケモンを選んでください。`;
                state.gamePhase = 'selectNewActive';
            }
        } else {
            // ポケモンが出せない場合の勝利条件
            state.message += `${knockedOutPlayer.id === 'player' ? 'あなた' : 'CPU'}はバトルポケモンを出せません。`;
            state.gamePhase = 'gameOver';
            state.message += `${attackingPlayer.id === 'player' ? 'あなた' : 'CPU'}の勝利！`;
        }
        return { ...state };
    },

    /**
     * ポケモンをにがす
     * @param {GameState} state
     * @param {string} playerId
     * @param {string} newActivePokemonId - 新しいバトルポケモンのID
     * @returns {GameState} 更新されたゲーム状態
     */
    retreatPokemon: (state, playerId, newActivePokemonId) => {
        const newState = Logic.clone(state);
        const player = newState.players[playerId];
        const oldActive = player.activePokemon;
        const newActiveIndex = player.bench.findIndex(card => card.id === newActivePokemonId);

        if (!oldActive || newActiveIndex === -1) {
            newState.message = 'にがすポケモンまたは新しいバトルポケモンが見つかりません。';
            return newState;
        }

        const newActive = player.bench[newActiveIndex];

        // にげるコストのチェックとトラッシュ
        const retreatCost = oldActive.retreat_cost ? oldActive.retreat_cost.length : 0;
        if (retreatCost > 0) {
            if (!oldActive.attachedEnergy || oldActive.attachedEnergy.length < retreatCost) {
                newState.message = 'にげるためのエネルギーが足りません。';
                return newState;
            }

            // コスト分のエネルギーをトラッシュ
            const messages = [`${oldActive.name_ja}をにがします。`];
            for (let i = 0; i < retreatCost; i++) {
                const energyToDiscard = oldActive.attachedEnergy.pop();
                player.discardPile.push(energyToDiscard);
                messages.push(`${energyToDiscard.name_ja}をトラッシュしました。`);
            }
            newState.message = messages.join(' ');
        } else {
            newState.message = `${oldActive.name_ja}をにがします。`;
        }

        // 入れ替え
        player.bench.splice(newActiveIndex, 1);
        player.bench.push(oldActive);
        player.activePokemon = newActive;

        newState.message += ` ${newActive.name_ja}をバトル場に出しました。`;
        return newState;
    },

    /**
     * にげることが可能かどうかをチェックする
     * @param {Card} activePokemon - 現在のアクティブポケモン
     * @param {Array<Card>} benchPokemon - ベンチのポケモン
     * @returns {boolean} にげることが可能かどうか
     */
    canRetreat: (activePokemon, benchPokemon) => {
        if (!activePokemon || benchPokemon.length === 0) return false;
        
        const retreatCost = activePokemon.retreat_cost ? activePokemon.retreat_cost.length : 0;
        const attachedEnergy = activePokemon.attachedEnergy ? activePokemon.attachedEnergy.length : 0;
        
        return attachedEnergy >= retreatCost;
    },

    /**
     * ターンを終了する
     * @param {GameState} state
     * @returns {GameState} 更新されたゲーム状態
     */
    endTurn: (state) => {
        // 終了するプレイヤーのエネルギーフラグをリセット
        const currentPlayer = state.players[state.currentTurnPlayerId];
        currentPlayer.energyAttachedThisTurn = false;

        // ターン終了時の特殊状態処理
        const endMessages = [];
        if (currentPlayer.activePokemon) {
            endMessages.push(...Logic._processSpecialConditionsEnd(currentPlayer.activePokemon));
        }

        state.turnCount++;
        state.currentTurnPlayerId = state.currentTurnPlayerId === 'player' ? 'cpu' : 'player';
        state.gamePhase = state.currentTurnPlayerId === 'player' ? 'playerTurn' : 'cpuTurn';

        // ターン開始時のドロー
        const drawResult = Logic.drawCard(state, state.currentTurnPlayerId);
        state = drawResult.newState; // Update state with new state
        const drawnCard = drawResult.drawnCard; // Get the drawn card

        // ターン開始時の特殊状態処理
        const startMessages = Logic._processSpecialConditionsStart(state, state.currentTurnPlayerId);

        // メッセージの組み立て
        let message = `${state.currentTurnPlayerId === 'player' ? 'あなた' : 'CPU'}の番です。`;
        if (endMessages.length > 0) {
            message = endMessages.join(' ') + ' ' + message;
        }
        if (startMessages.length > 0) {
            message += ' ' + startMessages.join(' ');
        }
        state.message = message;

        return { newState: { ...state }, drawnCard: drawnCard }; // Return both newState and drawnCard
    },

    /**
     * 勝利条件をチェックする
     * @param {GameState} state
     * @returns {string | null} 勝利したプレイヤーのID ('player' or 'cpu') または null
     */
    checkWinCondition: (state) => {
        // セットアップフェーズ中は勝利条件をチェックしない
        if (state.gamePhase === 'initialPokemonSelection' || state.gamePhase === 'setup') {
            return null;
        }

        // サイドカードが0になったら勝利
        if (state.players.player.prizeCards.length === 0) {
            return 'player';
        }
        if (state.players.cpu.prizeCards.length === 0) {
            return 'cpu';
        }

        // バトルポケモンが出せなくなったら勝利
        if (!state.players.player.activePokemon && state.players.player.bench.length === 0) {
            return 'cpu';
        }
        if (!state.players.cpu.activePokemon && state.players.cpu.bench.length === 0) {
            return 'player';
        }

        // 山札切れの勝利条件 (ドロー時にチェックされるべきだが、念のため)
        if (state.players.player.deck.length === 0 && state.currentTurnPlayerId === 'player') {
            // プレイヤーがドローできずにターン開始した場合
            return 'cpu';
        }
        if (state.players.cpu.deck.length === 0 && state.currentTurnPlayerId === 'cpu') {
            // CPUがドローできずにターン開始した場合
            return 'player';
        }

        return null;
    },

    /**
     * CPUのターン処理（高度なAI戦略）
     * @param {GameState} state
     * @returns {GameState} 更新されたゲーム状態
     */
    cpuTurn: (state) => {
        let newState = Logic.clone(state);
        const cpuPlayer = newState.players.cpu;
        const playerPlayer = newState.players.player;

        newState.message = 'CPUの番です。';

        // 戦況分析
        const gameAnalysis = Logic._analyzeGameState(newState, 'cpu');
        
        // 1. ベンチポケモンの戦略的配置
        newState = Logic._cpuPlayBenchPokemon(newState, gameAnalysis);

        // 2. エネルギーの戦略的配分
        newState = Logic._cpuAttachEnergy(newState, gameAnalysis);

        // 3. にげる判断
        if (Logic._shouldCpuRetreat(newState, gameAnalysis)) {
            newState = Logic._cpuRetreat(newState, gameAnalysis);
        }

        // 4. 攻撃判断
        const attackDecision = Logic._cpuAttackDecision(newState, gameAnalysis);
        if (attackDecision.shouldAttack) {
            newState = Logic.useAttack(newState, 'cpu', attackDecision.attackIndex);
        }

        // 5. ターン終了
        newState = Logic.endTurn(newState);
        return newState;
    },

    /**
     * ゲーム状況を分析する
     * @param {GameState} state
     * @param {string} playerId
     * @returns {object} 分析結果
     */
    _analyzeGameState: (state, playerId) => {
        const player = state.players[playerId];
        const opponent = state.players[playerId === 'player' ? 'cpu' : 'player'];

        return {
            // 勝利に近い度合い
            prizeCardsRemaining: player.prizeCards.length,
            opponentPrizeCards: opponent.prizeCards.length,
            
            // 盤面状況
            activePokemon: player.activePokemon,
            benchStrength: Logic._evaluateBenchStrength(player.bench),
            handQuality: Logic._evaluateHandQuality(player.hand),
            
            // 相手の状況
            opponentActivePokemon: opponent.activePokemon,
            opponentBenchSize: opponent.bench.length,
            
            // 緊急度
            activeHpRatio: player.activePokemon ? player.activePokemon.currentHp / player.activePokemon.hp : 0,
            opponentActiveHpRatio: opponent.activePokemon ? opponent.activePokemon.currentHp / opponent.activePokemon.hp : 0,
            
            // リソース状況
            energyInHand: player.hand.filter(card => card.card_type === 'Basic Energy').length,
            pokemonInHand: player.hand.filter(card => card.card_type === 'Pokémon').length,
        };
    },

    /**
     * ベンチの強さを評価する
     * @param {Array<Card>} bench
     * @returns {number} ベンチの強さスコア
     */
    _evaluateBenchStrength: (bench) => {
        return bench.reduce((score, pokemon) => {
            const hpRatio = pokemon.currentHp / pokemon.hp;
            const energyCount = pokemon.attachedEnergy ? pokemon.attachedEnergy.length : 0;
            const attackPower = pokemon.attacks ? Math.max(...pokemon.attacks.map(a => a.damage || 0)) : 0;
            return score + (hpRatio * 0.4 + energyCount * 0.3 + attackPower * 0.003);
        }, 0);
    },

    /**
     * 手札の質を評価する
     * @param {Array<Card>} hand
     * @returns {number} 手札の質スコア
     */
    _evaluateHandQuality: (hand) => {
        const basicPokemon = hand.filter(card => card.card_type === 'Pokémon' && card.stage === 'BASIC').length;
        const energy = hand.filter(card => card.card_type === 'Basic Energy').length;
        return basicPokemon * 2 + energy;
    },

    /**
     * CPUのベンチポケモン配置戦略
     * @param {GameState} state
     * @param {object} analysis
     * @returns {GameState} 更新された状態
     */
    _cpuPlayBenchPokemon: (state, analysis) => {
        const cpuPlayer = state.players.cpu;
        const basicPokemonInHand = cpuPlayer.hand.filter(card => card.card_type === 'Pokémon' && card.stage === 'BASIC');
        
        // ベンチに余裕があり、基本ポケモンがあれば配置
        if (cpuPlayer.bench.length < 5 && basicPokemonInHand.length > 0) {
            // 最もHPが高いポケモンを優先
            const bestPokemon = basicPokemonInHand.reduce((best, pokemon) => 
                (!best || pokemon.hp > best.hp) ? pokemon : best
            );
            return Logic.playBasicPokemon(state, 'cpu', bestPokemon.id);
        }
        
        return state;
    },

    /**
     * CPUのエネルギー配分戦略
     * @param {GameState} state
     * @param {object} analysis
     * @returns {GameState} 更新された状態
     */
    _cpuAttachEnergy: (state, analysis) => {
        const cpuPlayer = state.players.cpu;
        
        // エネルギー付与制限チェック
        if (cpuPlayer.energyAttachedThisTurn) return state;
        
        const energyInHand = cpuPlayer.hand.filter(card => card.card_type === 'Basic Energy');
        
        if (energyInHand.length === 0) return state;

        const energyToAttach = energyInHand[0];
        
        // エネルギーをつける対象を戦略的に選択
        let targetPokemon = null;
        
        // 1. アクティブポケモンが攻撃できるようになる場合は最優先
        if (analysis.activePokemon) {
            const availableAttacks = Logic.getAvailableAttacks(analysis.activePokemon);
            const almostReadyAttacks = analysis.activePokemon.attacks.filter(attack => {
                const costCount = {};
                attack.cost.forEach(type => costCount[type] = (costCount[type] || 0) + 1);
                const energyCount = analysis.activePokemon.attachedEnergy ? analysis.activePokemon.attachedEnergy.length : 0;
                const totalCost = Object.values(costCount).reduce((sum, count) => sum + count, 0);
                return totalCost === energyCount + 1;
            });
            
            if (almostReadyAttacks.length > 0) {
                targetPokemon = analysis.activePokemon;
            }
        }
        
        // 2. ベンチの強いポケモンにエネルギーをつける
        if (!targetPokemon && cpuPlayer.bench.length > 0) {
            targetPokemon = cpuPlayer.bench.reduce((best, pokemon) => {
                const currentEnergy = pokemon.attachedEnergy ? pokemon.attachedEnergy.length : 0;
                const maxAttackCost = pokemon.attacks ? Math.max(...pokemon.attacks.map(a => a.cost.length)) : 0;
                const needsEnergy = currentEnergy < maxAttackCost;
                const hp = pokemon.hp;
                
                if (!needsEnergy) return best;
                if (!best) return pokemon;
                return hp > best.hp ? pokemon : best;
            }, null);
        }
        
        // 3. アクティブポケモンが最後の選択肢
        if (!targetPokemon && analysis.activePokemon) {
            targetPokemon = analysis.activePokemon;
        }
        
        if (targetPokemon) {
            return Logic.attachEnergy(state, 'cpu', energyToAttach.id, targetPokemon.id);
        }
        
        return state;
    },

    /**
     * CPUがにげるべきかどうかを判断する
     * @param {GameState} state
     * @param {object} analysis
     * @returns {boolean} にげるべきかどうか
     */
    _shouldCpuRetreat: (state, analysis) => {
        if (!analysis.activePokemon || state.players.cpu.bench.length === 0) return false;
        
        const activePokemon = analysis.activePokemon;
        const canRetreat = Logic.canRetreat(activePokemon, state.players.cpu.bench);
        
        if (!canRetreat) return false;
        
        // HPが25%以下で、ベンチにより良いポケモンがいる場合
        const hpRatio = activePokemon.currentHp / activePokemon.hp;
        if (hpRatio <= 0.25) {
            const betterBenchPokemon = state.players.cpu.bench.find(pokemon => {
                const benchHpRatio = pokemon.currentHp / pokemon.hp;
                return benchHpRatio > hpRatio + 0.3;
            });
            return !!betterBenchPokemon;
        }
        
        return false;
    },

    /**
     * CPUのにげる処理
     * @param {GameState} state
     * @param {object} analysis
     * @returns {GameState} 更新された状態
     */
    _cpuRetreat: (state, analysis) => {
        const cpuPlayer = state.players.cpu;
        
        // 最も健康で強いベンチポケモンを選択
        const bestBenchPokemon = cpuPlayer.bench.reduce((best, pokemon) => {
            const hpRatio = pokemon.currentHp / pokemon.hp;
            const maxAttackDamage = pokemon.attacks ? Math.max(...pokemon.attacks.map(a => a.damage || 0)) : 0;
            const score = hpRatio * 0.7 + maxAttackDamage * 0.003;
            
            if (!best || score > best.score) {
                return { pokemon, score };
            }
            return best;
        }, null);
        
        if (bestBenchPokemon) {
            return Logic.retreatPokemon(state, 'cpu', bestBenchPokemon.pokemon.id);
        }
        
        return state;
    },

    /**
     * CPUの攻撃判断
     * @param {GameState} state
     * @param {object} analysis
     * @returns {object} 攻撃判断結果
     */
    _cpuAttackDecision: (state, analysis) => {
        if (!analysis.activePokemon) {
            return { shouldAttack: false, attackIndex: -1 };
        }
        
        const availableAttacks = Logic.getAvailableAttacks(analysis.activePokemon);
        const usableAttacks = availableAttacks.filter(attackInfo => attackInfo.canUse);
        
        if (usableAttacks.length === 0) {
            return { shouldAttack: false, attackIndex: -1 };
        }
        
        // 最もダメージが高い攻撃を選択（戦略的改良の余地あり）
        const bestAttack = usableAttacks.reduce((best, attackInfo) => {
            const damage = attackInfo.attack.damage || 0;
            if (!best || damage > best.attack.damage) {
                return attackInfo;
            }
            return best;
        });
        
        return { shouldAttack: true, attackIndex: bestAttack.index };
    },

    /**
     * CPUの新しいアクティブポケモン選択
     * @param {GameState} state
     * @returns {void} stateを直接変更
     */
    _selectCpuNewActive: (state) => {
        const cpuPlayer = state.players.cpu;
        
        if (cpuPlayer.bench.length === 0) return;
        
        // 最も強いベンチポケモンを選択
        const bestPokemon = cpuPlayer.bench.reduce((best, pokemon, index) => {
            const hpRatio = pokemon.currentHp / pokemon.hp;
            const maxAttackDamage = pokemon.attacks ? Math.max(...pokemon.attacks.map(a => a.damage || 0)) : 0;
            const energyCount = pokemon.attachedEnergy ? pokemon.attachedEnergy.length : 0;
            const score = hpRatio * 0.4 + maxAttackDamage * 0.003 + energyCount * 0.2;
            
            if (!best || score > best.score) {
                return { pokemon, index, score };
            }
            return best;
        }, null);
        
        if (bestPokemon) {
            // ベンチからアクティブに移動
            cpuPlayer.activePokemon = cpuPlayer.bench.splice(bestPokemon.index, 1)[0];
            state.message += ` CPUは${cpuPlayer.activePokemon.name_ja}をバトル場に出しました。`;
        }
    },

    /**
     * 特殊状態を適用する
     * @param {Card} pokemon - 対象のポケモン
     * @param {string} condition - 特殊状態 ('poisoned', 'burned', 'asleep', 'paralyzed', 'confused')
     */
    _applySpecialCondition: (pokemon, condition) => {
        if (!pokemon.specialConditions) {
            pokemon.specialConditions = [];
        }
        if (!pokemon.specialConditions.includes(condition)) {
            pokemon.specialConditions.push(condition);
        }
    },

    /**
     * 特殊状態を解除する
     * @param {Card} pokemon - 対象のポケモン
     * @param {string} condition - 解除する特殊状態
     */
    _removeSpecialCondition: (pokemon, condition) => {
        if (pokemon.specialConditions) {
            pokemon.specialConditions = pokemon.specialConditions.filter(c => c !== condition);
        }
    },

    /**
     * ターン開始時の特殊状態処理
     * @param {GameState} state
     * @param {string} playerId
     * @returns {Array<string>} 処理メッセージ
     */
    _processSpecialConditionsStart: (state, playerId) => {
        const player = state.players[playerId];
        const pokemon = player.activePokemon;
        const messages = [];

        if (!pokemon || !pokemon.specialConditions) return messages;

        // どく状態の処理
        if (pokemon.specialConditions.includes('poisoned')) {
            pokemon.currentHp = Math.max(0, pokemon.currentHp - 10);
            messages.push(`${pokemon.name_ja}はどくで10ダメージを受けた！`);
            
            if (pokemon.currentHp <= 0) {
                messages.push(`${pokemon.name_ja}はどくできぜつした！`);
                Logic.handleKnockout(state, playerId);
            }
        }

        // やけど状態の処理
        if (pokemon.specialConditions.includes('burned')) {
            pokemon.currentHp = Math.max(0, pokemon.currentHp - 20);
            messages.push(`${pokemon.name_ja}はやけどで20ダメージを受けた！`);
            
            if (pokemon.currentHp <= 0) {
                messages.push(`${pokemon.name_ja}はやけどできぜつした！`);
                Logic.handleKnockout(state, playerId);
            }
        }

        return messages;
    },

    /**
     * ターン終了時の特殊状態処理
     * @param {Card} pokemon - 対象のポケモン
     * @returns {Array<string>} 処理メッセージ
     */
    _processSpecialConditionsEnd: (pokemon) => {
        const messages = [];

        if (!pokemon || !pokemon.specialConditions) return messages;

        // ねむり状態の回復判定（コイン投げ）
        if (pokemon.specialConditions.includes('asleep')) {
            const isAwake = Math.random() < 0.5; // 50%の確率で回復
            if (isAwake) {
                Logic._removeSpecialCondition(pokemon, 'asleep');
                messages.push(`${pokemon.name_ja}はめざめた！`);
            }
        }

        return messages;
    },
};