import { getCardMasterList } from './data-manager.js';
import { GAME_PHASES } from './phase-manager.js';

// Fisher-Yates shuffle algorithm
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function createDeck() {
    const deck = [];
    let cardId = 0;
    
    const cardMasterList = getCardMasterList();

    // Add Pokémon
    const pokemon = cardMasterList.filter(c => c.card_type === 'Pokémon');
    for (let i = 0; i < 20; i++) {
        const randomPokemon = pokemon[Math.floor(Math.random() * pokemon.length)];
        deck.push({ ...randomPokemon, id: `card-${cardId++}` });
    }

    // Add Energy
    const energy = cardMasterList.filter(c => c.card_type === 'Basic Energy');
    for (let i = 0; i < 40; i++) {
        const randomEnergy = energy[Math.floor(Math.random() * energy.length)];
        deck.push({ ...randomEnergy, id: `card-${cardId++}` });
    }

    return shuffle(deck);
}

function createPlayerState() {
    const deck = createDeck(); // Deck is already shuffled by createDeck
    // Hand and prize will be populated by Logic.setupGame
    return {
        deck,
        hand: [], // Start with empty hand
        active: null,
        bench: Array(5).fill(null),
        discard: [],
        prize: [], // Start with empty prize
        prizeRemaining: 6, // Still track remaining prizes
        prizesToTake: 0, // Number of prizes pending to take
    };
}

export function createInitialState() {
    return {
        // Core game state
        rngSeed: Math.floor(Math.random() * 1000000),
        turn: 1,
        phase: GAME_PHASES.SETUP,
        turnPlayer: 'player',
        
        // Turn constraints
        hasDrawnThisTurn: false,
        hasAttachedEnergyThisTurn: false,
        canRetreat: true,
        canPlaySupporter: true,
        
        // Special states
        pendingAction: null,
        awaitingInput: false,
        
        // Stadium and shared areas
        stadium: null,
        
        // Game log
        log: [],
        
        // UI state
        prompt: {
            message: '手札からたねポケモンを1匹選び、バトル場に出してください。',
            actions: [],
        },
        
        // Setup specific state
        setupSelection: {
            active: null,
            bench: [],
            confirmed: false
        },
        
        // Players
        players: {
            player: createPlayerState(),
            cpu: createPlayerState(),
        },
        
        // Win conditions
        winner: null,
        gameEndReason: null,
    };
}

/**
 * ゲーム状態のディープクローン
 */
export function cloneGameState(state) {
    // JSON.parse(JSON.stringify(...)) では手札配列が意図せず消失するケースがあったため
    // structuredClone を使用し、フォールバックとして JSON ベースのクローンも用意する
    let cloned;
    try {
        cloned = structuredClone(state || {});
    } catch (e) {
        cloned = JSON.parse(JSON.stringify(state || {}));
    }

    if (!Array.isArray(cloned.log)) {
        cloned.log = [];
    }

    // players 構造の補完と手札配列の保護
    if (!cloned.players) {
        cloned.players = {
            player: createPlayerState(),
            cpu: createPlayerState(),
        };
    }

    if (!Array.isArray(cloned.players.player.hand)) {
        cloned.players.player.hand = [];
    }
    if (!Array.isArray(cloned.players.cpu.hand)) {
        cloned.players.cpu.hand = [];
    }

    return cloned;
}

/**
 * プレイヤー状態の安全な取得
 */
export function getPlayerState(state, playerId) {
    const player = state.players[playerId];
    if (!player) {
        console.warn(`Player ${playerId} not found in state`);
        return createPlayerState();
    }
    return player;
}

/**
 * ログエントリの追加
 */
export function addLogEntry(state, entry) {
    const newState = cloneGameState(state);
    // cloneGameState で補完しているが念のため防御的にチェック
    if (!Array.isArray(newState.log)) {
        newState.log = [];
    }
    newState.log.push({
        turn: state?.turn ?? 0,
        timestamp: Date.now(),
        ...entry
    });
    return newState;
}