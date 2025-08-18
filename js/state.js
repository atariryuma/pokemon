import { cardMasterList } from './cards.js';

/**
 * カードオブジェクトの型定義 (簡略版)
 * 実際のカードデータはcards.jsonからロードされる
 * @typedef {object} Card
 * @property {string} card_type
 * @property {string} name_en
 * @property {string} name_ja
 * @property {string} [stage]
 * @property {number} [hp]
 * @property {string} [type]
 * @property {Array<object>} [attacks]
 * @property {object} [ability]
 * @property {object} [weakness]
 * @property {object} [resistance]
 * @property {Array<string>} [retreat_cost]
 * @property {string} [energy_type]
 * @property {string} [effect_en]
 * @property {string} [effect_ja]
 * @property {string} [rules_en]
 * @property {string} [rules_ja]
 * @property {string} [image] // Path to the image asset
 * @property {string} id // Unique ID for this card instance
 * @property {number} [currentHp] // Current HP for Pokémon cards
 * @property {Array<Card>} [attachedEnergy] // Energy cards attached to this Pokémon
 * @property {Array<string>} [specialConditions] // Special conditions (poisoned, burned, etc.)
 */

/**
 * プレイヤーオブジェクトの型定義
 * @typedef {object} Player
 * @property {string} id
 * @property {Array<Card>} deck
 * @property {Array<Card>} hand
 * @property {Card | null} activePokemon
 * @property {Array<Card>} bench
 * @property {Array<Card>} discardPile
 * @property {Array<Card>} prizeCards
 * @property {number} mulliganCount // マリガン回数を追加
 * @property {boolean} energyAttachedThisTurn // このターンエネルギーを付けたかどうか
 */

/**
 * ゲーム状態の型定義
 * @typedef {object} GameState
 * @property {object.<string, Player>} players
 * @property {string} currentTurnPlayerId
 * @property {number} turnCount
 * @property {string} gamePhase
 * @property {string} message
 */

let cardIdCounter = 0; // グローバルなユニークIDカウンター

/**
 * 初期ゲーム状態を作成する
 * @returns {GameState}
 */
export function createInitialState() {
    return {
        players: {
            player: {
                id: 'player',
                deck: [],
                hand: [],
                activePokemon: null,
                bench: [],
                discardPile: [],
                prizeCards: [],
                mulliganCount: 0,
                energyAttachedThisTurn: false,
            },
            cpu: {
                id: 'cpu',
                deck: [],
                hand: [],
                activePokemon: null,
                bench: [],
                discardPile: [],
                prizeCards: [],
                mulliganCount: 0,
                energyAttachedThisTurn: false,
            },
        },
        currentTurnPlayerId: 'player', // 最初のターンはプレイヤーから
        turnCount: 0,
        gamePhase: 'setup', // ゲーム開始フェーズ
        message: 'ゲームを開始します。',
    };
}

/**
 * デッキを作成する関数
 * @param {Array<object>} masterList - cardMasterList
 * @returns {Array<Card>} シャッフルされたデッキ
 */
export function createDeck(masterList) {
    let deck = [];
    // Improved deck composition: より多くのたねポケモンを含む構成
    const pokemonCards = masterList.filter(card => card.card_type === 'Pokémon');
    const basicPokemonCards = pokemonCards.filter(card => card.stage === 'BASIC');
    const evolutionCards = pokemonCards.filter(card => card.stage !== 'BASIC');
    const energyCards = masterList.filter(card => card.card_type === 'Basic Energy');

    // Add たねポケモン (20枚) - マリガンを減らすため
    for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * basicPokemonCards.length);
        deck.push({ ...basicPokemonCards[randomIndex], id: `card-${cardIdCounter++}` });
    }

    // Add 進化ポケモン (5枚)
    for (let i = 0; i < 5; i++) {
        const randomIndex = Math.floor(Math.random() * evolutionCards.length);
        deck.push({ ...evolutionCards[randomIndex], id: `card-${cardIdCounter++}` });
    }

    // Add エネルギー (35枚)
    for (let i = 0; i < 35; i++) {
        const randomIndex = Math.floor(Math.random() * energyCards.length);
        deck.push({ ...energyCards[randomIndex], id: `card-${cardIdCounter++}` });
    }

    // Shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}
