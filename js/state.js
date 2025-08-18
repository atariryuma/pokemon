import { cardMasterList } from './cards.js';

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
    };
}

export function createInitialState() {
    return {
        turn: 1,
        phase: 'setup',
        turnPlayer: 'player',
        stadium: null,
        hasDrawnThisTurn: false,
        hasAttachedEnergyThisTurn: false,
        pendingAction: null,
        prompt: {
            message: '手札からたねポケモンを1匹選び、バトル場に出してください。',
            actions: [],
        },
        players: {
            player: createPlayerState(),
            cpu: createPlayerState(),
        },
    };
}