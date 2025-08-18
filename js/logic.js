/**
 * Finds a card in a player's hand.
 * @param {object} playerState - The state of the player.
 * @param {string} cardId - The ID of the card to find.
 * @returns {{card: object, index: number} | null}
 */
function findCardInHand(playerState, cardId) {
    const index = playerState.hand.findIndex(c => c.id === cardId);
    if (index === -1) {
        return null;
    }
    return { card: playerState.hand[index], index };
}

/**
 * Moves a card from hand to the active position.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} cardId - The ID of the card to move.
 * @returns {object} The new game state.
 */
export function placeCardInActive(state, player, cardId) {
    const playerState = state.players[player];
    const cardInfo = findCardInHand(playerState, cardId);

    if (!cardInfo || playerState.active) {
        return state; // Card not in hand or active spot already filled
    }

    const { card, index } = cardInfo;
    const newHand = [...playerState.hand];
    newHand.splice(index, 1);

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                hand: newHand,
                active: card,
            },
        },
    };
}

/**
 * Moves a card from hand to a bench position.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} cardId - The ID of the card to move.
 * @param {number} benchIndex - The index of the bench slot.
 * @returns {object} The new game state.
 */
export function placeCardOnBench(state, player, cardId, benchIndex) {
    const playerState = state.players[player];
    const cardInfo = findCardInHand(playerState, cardId);

    if (!cardInfo || benchIndex < 0 || benchIndex >= 5 || playerState.bench[benchIndex]) {
        return state; // Invalid move
    }

    const { card, index } = cardInfo;
    const newHand = [...playerState.hand];
    newHand.splice(index, 1);

    const newBench = [...playerState.bench];
    newBench[benchIndex] = card;

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                hand: newHand,
                bench: newBench,
            },
        },
    };
}
