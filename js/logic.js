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

        // 特殊状態で攻撃がブロックされるかチェック
        const attackBlockCheck = Logic._checkAttackBlocking(attacker);
        if (!attackBlockCheck.canAttack) {
            newState.message = attackBlockCheck.messages.join(' ');
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
            const damageCalculation = Logic._calculateDamage(damage, attacker, defender);
            damage = damageCalculation.finalDamage;
            messages.push(...damageCalculation.messages);

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
     * ポケモンの進化処理
     * @param {GameState} state
     * @param {string} playerId - プレイヤーID
     * @param {string} baseCardId - 進化元ポケモンのID
     * @param {string} evolutionCardId - 進化先カードのID（手札内）
     * @returns {GameState} 更新されたゲーム状態
     */
    evolvePokemon: (state, playerId, baseCardId, evolutionCardId) => {
        const newState = Logic.clone(state);
        const player = newState.players[playerId];
        
        // 手札から進化カードを見つける
        const evolutionCardIndex = player.hand.findIndex(card => card.id === evolutionCardId);
        if (evolutionCardIndex === -1) {
            newState.message = 'そのカードは手札にありません。';
            return newState;
        }
        
        const evolutionCard = player.hand[evolutionCardIndex];
        
        // 進化カードの検証
        if (evolutionCard.card_type !== 'Pokémon') {
            newState.message = 'ポケモンカードでないものは進化に使用できません。';
            return newState;
        }
        
        if (evolutionCard.stage === 'BASIC') {
            newState.message = 'たねポケモンは進化に使用できません。';
            return newState;
        }
        
        // 進化元ポケモンを探す
        let basePokemon = null;
        let location = null;
        let locationIndex = -1;
        
        // アクティブポケモンをチェック
        if (player.activePokemon && player.activePokemon.id === baseCardId) {
            basePokemon = player.activePokemon;
            location = 'active';
        }
        
        // ベンチポケモンをチェック
        if (!basePokemon) {
            const benchIndex = player.bench.findIndex(pokemon => pokemon && pokemon.id === baseCardId);
            if (benchIndex !== -1) {
                basePokemon = player.bench[benchIndex];
                location = 'bench';
                locationIndex = benchIndex;
            }
        }
        
        if (!basePokemon) {
            newState.message = '進化元のポケモンが見つかりません。';
            return newState;
        }
        
        // 進化チェーン検証
        const canEvolve = Logic._canEvolve(basePokemon, evolutionCard);
        if (!canEvolve.valid) {
            newState.message = canEvolve.reason;
            return newState;
        }
        
        // 「場に出たターン」チェック（簡略化：新しく出したターンでは進化不可）
        if (basePokemon.turnPlayed === newState.turnCount) {
            newState.message = '場に出たばかりのポケモンは進化できません。';
            return newState;
        }
        
        // 進化実行
        const evolvedPokemon = {
            ...evolutionCard,
            id: basePokemon.id, // IDを保持
            currentHp: evolutionCard.hp, // HPは新しいポケモンの最大HPに回復
            attachedEnergy: basePokemon.attachedEnergy || [], // エネルギーを引き継ぐ
            specialConditions: [], // 特殊状態は回復
            evolutionHistory: [...(basePokemon.evolutionHistory || []), basePokemon.name_ja], // 進化履歴
            turnPlayed: newState.turnCount // 進化ターンを記録
        };
        
        // 場のポケモンを更新
        if (location === 'active') {
            player.activePokemon = evolvedPokemon;
        } else if (location === 'bench') {
            player.bench[locationIndex] = evolvedPokemon;
        }
        
        // 手札から進化カードを削除
        player.hand.splice(evolutionCardIndex, 1);
        
        // 進化元のカードをトラッシュに（進化の証拠として）
        const baseCardForTrash = {
            ...basePokemon,
            currentHp: basePokemon.currentHp,
            attachedEnergy: [] // エネルギーは新しいポケモンに移動済み
        };
        player.discardPile.push(baseCardForTrash);
        
        newState.message = `${basePokemon.name_ja}が${evolutionCard.name_ja}に進化しました！`;
        
        return newState;
    },

    /**
     * 進化可能かどうかをチェックする
     * @param {Card} basePokemon - 進化元ポケモン
     * @param {Card} evolutionCard - 進化先ポケモン
     * @returns {Object} {valid: boolean, reason: string}
     */
    _canEvolve: (basePokemon, evolutionCard) => {
        // 基本的な進化チェーン検証
        
        // BASIC → STAGE1
        if (basePokemon.stage === 'BASIC' && evolutionCard.stage === 'STAGE1') {
            // 名前ベースの進化チェック（簡略化）
            if (evolutionCard.name_en.includes(basePokemon.name_en) || 
                basePokemon.name_en.includes(evolutionCard.name_en.split(' ')[0])) {
                return {valid: true, reason: ''};
            }
            // より柔軟な進化チェック（カード固有）
            if (Logic._checkSpecificEvolution(basePokemon.name_en, evolutionCard.name_en)) {
                return {valid: true, reason: ''};
            }
        }
        
        // STAGE1 → STAGE2
        if (basePokemon.stage === 'STAGE1' && evolutionCard.stage === 'STAGE2') {
            if (evolutionCard.name_en.includes(basePokemon.name_en.split(' ')[0]) ||
                Logic._checkSpecificEvolution(basePokemon.name_en, evolutionCard.name_en)) {
                return {valid: true, reason: ''};
            }
        }
        
        return {
            valid: false,
            reason: `${basePokemon.name_ja}は${evolutionCard.name_ja}に進化できません。`
        };
    },

    /**
     * 特定の進化関係をチェック（カードデータベース固有）
     * @param {string} baseNameEn - 進化元の英語名
     * @param {string} evolutionNameEn - 進化先の英語名
     * @returns {boolean}
     */
    _checkSpecificEvolution: (baseNameEn, evolutionNameEn) => {
        const evolutionPairs = {
            'Glasswing Butterfly Larva': ['Glasswing Butterfly'],
            'Grey Dagger Moth Larva': ['Haiirohitori'],
            // 追加の進化ペアをここに記載
        };
        
        const validEvolutions = evolutionPairs[baseNameEn] || [];
        return validEvolutions.includes(evolutionNameEn);
    },

    /**
     * ダメージ計算処理（弱点・抵抗力・特殊効果含む）
     * @param {number} baseDamage - 基本ダメージ
     * @param {Card} attacker - 攻撃側ポケモン
     * @param {Card} defender - 防御側ポケモン
     * @returns {Object} {finalDamage: number, messages: Array<string>}
     */
    _calculateDamage: (baseDamage, attacker, defender) => {
        let damage = baseDamage;
        const messages = [];
        let multiplier = 1;
        let reduction = 0;

        // ダメージ軽減効果をチェック（前回の攻撃等で付与された効果）
        if (defender.damageReduction) {
            reduction += defender.damageReduction;
            messages.push(`ダメージ軽減効果で${defender.damageReduction}ダメージ軽減！`);
            delete defender.damageReduction; // 一度使用したら削除
        }

        // 弱点計算
        if (defender.weakness && defender.weakness.type !== 'None') {
            if (Logic._checkTypeMatch(attacker.type, defender.weakness.type)) {
                if (defender.weakness.value === '×2') {
                    multiplier = 2;
                    messages.push('弱点！ ダメージ2倍！');
                } else if (defender.weakness.value.startsWith('+')) {
                    const additionalDamage = parseInt(defender.weakness.value.substring(1)) || 20;
                    damage += additionalDamage;
                    messages.push(`弱点！ +${additionalDamage}ダメージ！`);
                }
            }
        }

        // 抵抗力計算
        if (defender.resistance && defender.resistance.type !== 'None') {
            if (Logic._checkTypeMatch(attacker.type, defender.resistance.type)) {
                const resistanceValue = parseInt(defender.resistance.value.substring(1)) || 20;
                reduction += resistanceValue;
                messages.push(`抵抗力！ -${resistanceValue}ダメージ！`);
            }
        }

        // 最終ダメージ計算
        const finalDamage = Math.max(0, Math.floor(damage * multiplier) - reduction);
        
        if (finalDamage <= 0 && baseDamage > 0) {
            messages.push('ダメージを与えられなかった！');
        } else if (finalDamage > 0) {
            messages.push(`${finalDamage}ダメージ！`);
        }

        return { finalDamage, messages };
    },

    /**
     * タイプマッチングチェック
     * @param {string} attackerType - 攻撃側タイプ
     * @param {string} targetType - 対象タイプ
     * @returns {boolean}
     */
    _checkTypeMatch: (attackerType, targetType) => {
        // 直接マッチ
        if (attackerType === targetType) return true;
        
        // タイプエイリアス処理
        const typeAliases = {
            'Electric': 'Lightning',
            'Lightning': 'Electric'
        };
        
        const aliasType = typeAliases[attackerType];
        return aliasType === targetType;
    },

    /**
     * プレイヤーの進化可能なカードを取得
     * @param {GameState} state
     * @param {string} playerId
     * @returns {Array} 進化可能な組み合わせの配列
     */
    getEvolutionOptions: (state, playerId) => {
        const player = state.players[playerId];
        const options = [];
        
        // 手札の進化カードを取得
        const evolutionCards = player.hand.filter(card => 
            card.card_type === 'Pokémon' && card.stage !== 'BASIC'
        );
        
        // 場のポケモンをチェック
        const fieldPokemon = [];
        if (player.activePokemon) {
            fieldPokemon.push({pokemon: player.activePokemon, location: 'active'});
        }
        player.bench.forEach((pokemon, index) => {
            if (pokemon) {
                fieldPokemon.push({pokemon, location: 'bench', index});
            }
        });
        
        // 進化可能な組み合わせを検索
        evolutionCards.forEach(evolutionCard => {
            fieldPokemon.forEach(({pokemon, location, index}) => {
                if (Logic._canEvolve(pokemon, evolutionCard).valid &&
                    pokemon.turnPlayed !== state.turnCount) {
                    options.push({
                        basePokemon: pokemon,
                        evolutionCard: evolutionCard,
                        location: location,
                        benchIndex: index
                    });
                }
            });
        });
        
        return options;
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
            } else {
                messages.push(`${pokemon.name_ja}はまだねむっている...`);
            }
        }

        // やけど状態のコイン投げ判定
        if (pokemon.specialConditions.includes('burned')) {
            const recoversFromBurn = Math.random() < 0.5; // 50%の確率で回復
            if (recoversFromBurn) {
                Logic._removeSpecialCondition(pokemon, 'burned');
                messages.push(`${pokemon.name_ja}のやけどが治った！`);
            }
        }

        // こんらん状態の処理
        if (pokemon.specialConditions.includes('confused')) {
            messages.push(`${pokemon.name_ja}はこんらんしている...`);
        }

        return messages;
    },

    /**
     * 攻撃時の特殊状態チェック
     * @param {Card} pokemon - 攻撃しようとするポケモン
     * @returns {Object} {canAttack: boolean, messages: Array<string>}
     */
    _checkAttackBlocking: (pokemon) => {
        const messages = [];
        let canAttack = true;

        if (!pokemon.specialConditions) {
            return {canAttack: true, messages: []};
        }

        // ねむり状態の場合攻撃不可
        if (pokemon.specialConditions.includes('asleep')) {
            canAttack = false;
            messages.push(`${pokemon.name_ja}はねむっていて攻撃できない！`);
        }

        // まひ状態の場合攻撃不可
        if (pokemon.specialConditions.includes('paralyzed')) {
            canAttack = false;
            messages.push(`${pokemon.name_ja}はまひしていて攻撃できない！`);
        }

        // こんらん状態の場合コイン投げ
        if (pokemon.specialConditions.includes('confused') && canAttack) {
            const confusionCheck = Math.random() < 0.5; // 50%の確率で自分にダメージ
            if (!confusionCheck) {
                // 自分に30ダメージ
                pokemon.currentHp = Math.max(0, pokemon.currentHp - 30);
                canAttack = false;
                messages.push(`${pokemon.name_ja}はこんらんして自分を攻撃した！ 30ダメージ！`);
            } else {
                messages.push(`${pokemon.name_ja}はこんらんを振り切って攻撃した！`);
            }
        }

        return {canAttack, messages};
    },

    /**
     * トレーナーズカードの使用
     * @param {GameState} state
     * @param {string} playerId - プレイヤーID
     * @param {string} cardId - トレーナーズカードID
     * @returns {GameState} 更新されたゲーム状態
     */
    playTrainer: (state, playerId, cardId) => {
        const newState = Logic.clone(state);
        const player = newState.players[playerId];
        
        // 手札からトレーナーズカードを見つける
        const cardIndex = player.hand.findIndex(card => card.id === cardId);
        if (cardIndex === -1) {
            newState.message = 'そのカードは手札にありません。';
            return newState;
        }
        
        const trainerCard = player.hand[cardIndex];
        
        if (trainerCard.card_type !== 'Trainer') {
            newState.message = 'トレーナーズカードではありません。';
            return newState;
        }
        
        // トレーナーズカードの効果を実行
        const effectResult = Logic._executeTrainerEffect(newState, playerId, trainerCard);
        
        if (effectResult.success) {
            // 手札からカードを削除
            player.hand.splice(cardIndex, 1);
            // トラッシュに置く
            player.discardPile.push(trainerCard);
            
            newState.message = effectResult.message || `${trainerCard.name_ja}を使用しました。`;
        } else {
            newState.message = effectResult.message || 'トレーナーズカードを使用できません。';
        }
        
        return newState;
    },

    /**
     * トレーナーズカードの効果を実行
     * @param {GameState} state
     * @param {string} playerId
     * @param {Object} trainerCard
     * @returns {Object} {success: boolean, message: string}
     */
    _executeTrainerEffect: (state, playerId, trainerCard) => {
        const player = state.players[playerId];
        const opponent = state.players[playerId === 'player' ? 'cpu' : 'player'];
        
        // シンプルなトレーナーズカードの効果実装例
        // 実際のゲームではカードごとに異なる効果を実装
        
        switch(trainerCard.name_en) {
            case 'Potion':
                // ポーション: ポケモンを選んで20HP回復
                if (player.activePokemon && player.activePokemon.currentHp < player.activePokemon.hp) {
                    const healAmount = Math.min(20, player.activePokemon.hp - player.activePokemon.currentHp);
                    player.activePokemon.currentHp += healAmount;
                    return {
                        success: true,
                        message: `${player.activePokemon.name_ja}のHPを${healAmount}回復しました！`
                    };
                }
                return {
                    success: false,
                    message: '回復するポケモンがいません。'
                };
                
            case 'Professor Oak':
                // オーキド博士: 手札をすべて捨てて7枚ドロー
                player.discardPile.push(...player.hand.filter(card => card.id !== trainerCard.id));
                player.hand = player.hand.filter(card => card.id === trainerCard.id); // トレーナーズカード以外を削除
                
                // 7枚ドロー
                for (let i = 0; i < 7 && player.deck.length > 0; i++) {
                    const drawnCard = player.deck.shift();
                    if (drawnCard) {
                        drawnCard.id = drawnCard.id || `${drawnCard.name_en}_${Math.random().toString(36).substring(7)}`;
                        player.hand.push(drawnCard);
                    }
                }
                
                return {
                    success: true,
                    message: '手札をすべて捨てて7枚ドローしました！'
                };
                
            case 'Bill':
                // ビル: 2枚ドロー
                for (let i = 0; i < 2 && player.deck.length > 0; i++) {
                    const drawnCard = player.deck.shift();
                    if (drawnCard) {
                        drawnCard.id = drawnCard.id || `${drawnCard.name_en}_${Math.random().toString(36).substring(7)}`;
                        player.hand.push(drawnCard);
                    }
                }
                
                return {
                    success: true,
                    message: '2枚ドローしました！'
                };
                
            default:
                // デフォルトのトレーナーズカード効果（簡略化）
                return {
                    success: true,
                    message: `${trainerCard.name_ja}の効果を実行しました。`
                };
        }
    },

    /**
     * ポケモンの特性を使用する
     * @param {GameState} state
     * @param {string} playerId
     * @param {string} pokemonId
     * @param {number} abilityIndex
     * @returns {GameState} 更新されたゲーム状態
     */
    useAbility: (state, playerId, pokemonId, abilityIndex = 0) => {
        const newState = Logic.clone(state);
        const player = newState.players[playerId];
        
        // ポケモンを見つける
        let pokemon = null;
        if (player.activePokemon && player.activePokemon.id === pokemonId) {
            pokemon = player.activePokemon;
        } else {
            pokemon = player.bench.find(p => p && p.id === pokemonId);
        }
        
        if (!pokemon) {
            newState.message = 'そのポケモンが見つかりません。';
            return newState;
        }
        
        // 特性があるかチェック
        if (!pokemon.ability) {
            newState.message = `${pokemon.name_ja}には特性がありません。`;
            return newState;
        }
        
        // 特殊状態で特性が使えないかチェック
        if (pokemon.specialConditions && 
            (pokemon.specialConditions.includes('asleep') || 
             pokemon.specialConditions.includes('paralyzed'))) {
            newState.message = `${pokemon.name_ja}は特殊状態のため特性を使えません。`;
            return newState;
        }
        
        // 特性の使用制限チェック（1ターンに1回の特性など）
        if (pokemon.abilityUsedThisTurn) {
            newState.message = `${pokemon.ability.name_ja}はすでに使用済みです。`;
            return newState;
        }
        
        // 特性の効果を実行
        const abilityResult = Logic._executeAbility(newState, playerId, pokemon, pokemon.ability);
        
        if (abilityResult.success) {
            // 特性使用フラグを設定（種類によっては不要）
            if (abilityResult.markAsUsed) {
                pokemon.abilityUsedThisTurn = true;
            }
            
            newState.message = abilityResult.message || `${pokemon.ability.name_ja}を使用しました！`;
        } else {
            newState.message = abilityResult.message || `${pokemon.ability.name_ja}を使用できませんでした。`;
        }
        
        return newState;
    },

    /**
     * 特性の効果を実行する
     * @param {GameState} state
     * @param {string} playerId
     * @param {Object} pokemon
     * @param {Object} ability
     * @returns {Object} {success: boolean, message: string, markAsUsed: boolean}
     */
    _executeAbility: (state, playerId, pokemon, ability) => {
        const player = state.players[playerId];
        const opponent = state.players[playerId === 'player' ? 'cpu' : 'player'];
        
        // カード名をベースとした特性効果の実装
        switch(pokemon.name_en) {
            case 'Kobane Inago': // 「隠れる」特性
                // 相手の次の5回の攻撃を無効化する
                pokemon.attackNegationCount = 5;
                return {
                    success: true,
                    message: `${pokemon.name_ja}の「${ability.name_ja}」！ 相手の次の5回の攻撃を無効化！`,
                    markAsUsed: true
                };
                
            case 'Orange Spider': // 「糸をはる」特性
                // 相手の次の攻撃を無効化
                pokemon.attackNegationCount = 1;
                return {
                    success: true,
                    message: `${pokemon.name_ja}の「${ability.name_ja}」！ 相手の次の攻撃を無効化！`,
                    markAsUsed: true
                };
                
            case 'Tsumamurasaki Madara': // 「チート」特性
                // サイドカードを1枚取る
                if (player.prizeCards.length > 0) {
                    const prizeCard = player.prizeCards.pop();
                    if (prizeCard) {
                        prizeCard.id = prizeCard.id || `${prizeCard.name_en}_${Math.random().toString(36).substring(7)}`;
                        player.hand.push(prizeCard);
                    }
                    return {
                        success: true,
                        message: `${pokemon.name_ja}の「${ability.name_ja}」！ サイドカードを1枚取った！`,
                        markAsUsed: true
                    };
                } else {
                    return {
                        success: false,
                        message: 'サイドカードがありません。'
                    };
                }
                
            default:
                // デフォルトの特性効果（テキストベース）
                return {
                    success: true,
                    message: `${pokemon.name_ja}の特性「${ability.name_ja}」を発動！`,
                    markAsUsed: true
                };
        }
    },

    /**
     * 特殊状態を一度に複数適用する
     * @param {Card} pokemon - 対象ポケモン
     * @param {Array<string>} conditions - 適用する特殊状態の配列
     */
    _applyMultipleConditions: (pokemon, conditions) => {
        if (!pokemon.specialConditions) {
            pokemon.specialConditions = [];
        }
        
        conditions.forEach(condition => {
            if (!pokemon.specialConditions.includes(condition)) {
                pokemon.specialConditions.push(condition);
            }
        });
    },

    /**
     * すべての特殊状態をクリア（進化時など）
     * @param {Card} pokemon - 対象ポケモン
     */
    _clearAllSpecialConditions: (pokemon) => {
        if (pokemon.specialConditions) {
            pokemon.specialConditions = [];
        }
    },
};