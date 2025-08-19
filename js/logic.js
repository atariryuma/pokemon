import { GAME_PHASES } from './phase-manager.js';

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

/**
 * Draws a card from the deck to the hand.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @returns {object} The new game state.
 */
export function drawCard(state, player) {
    const playerState = state.players[player];
    if (playerState.deck.length === 0) {
        return {
            ...state,
            phase: 'game-over',
            winner: player === 'player' ? 'cpu' : 'player',
            gameEndReason: 'deck_out',
        };
    }

    const newDeck = [...playerState.deck];
    const drawnCard = newDeck.shift(); // Take the top card
    const newHand = [...playerState.hand, drawnCard];

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                deck: newDeck,
                hand: newHand,
            },
        },
    };
}

/**
 * Finds a pokemon on a player's board (active or bench).
 * @param {object} playerState - The state of the player.
 * @param {string} pokemonId - The ID of the pokemon to find.
 * @returns {{pokemon: object, zone: string, index: number} | null}
 */
function findPokemonById(playerState, pokemonId) {
    if (playerState.active && playerState.active.id === pokemonId) {
        return { pokemon: playerState.active, zone: 'active', index: 0 };
    }
    const benchIndex = playerState.bench.findIndex(p => p && p.id === pokemonId);
    if (benchIndex !== -1) {
        return { pokemon: playerState.bench[benchIndex], zone: 'bench', index: benchIndex };
    }
    return null;
}

/**
 * Attaches an energy card from hand to a pokemon.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} energyId - The ID of the energy card in hand.
 * @param {string} pokemonId - The ID of the target pokemon on the board.
 * @returns {object} The new game state.
 */
export function attachEnergy(state, player, energyId, pokemonId) {
    const playerState = state.players[player];

    // Check if energy can be attached
    if (state.hasAttachedEnergyThisTurn) {
        console.error('Already attached energy this turn.');
        return state;
    }

    const energyInfo = findCardInHand(playerState, energyId);
    if (!energyInfo) {
        console.error('Energy card not found in hand.');
        return state;
    }

    const targetInfo = findPokemonById(playerState, pokemonId);
    if (!targetInfo) {
        console.error('Target pokemon not found on board.');
        return state;
    }

    // Remove energy from hand
    const newHand = [...playerState.hand];
    newHand.splice(energyInfo.index, 1);

    // Add energy to pokemon
    const updatedPokemon = {
        ...targetInfo.pokemon,
        attached_energy: [...(targetInfo.pokemon.attached_energy || []), energyInfo.card],
    };

    let newActive = playerState.active;
    let newBench = [...playerState.bench];

    if (targetInfo.zone === 'active') {
        newActive = updatedPokemon;
    } else {
        newBench[targetInfo.index] = updatedPokemon;
    }

    return {
        ...state,
        hasAttachedEnergyThisTurn: true,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                hand: newHand,
                active: newActive,
                bench: newBench,
            },
        },
    };
}

/**
 * Swaps the active pokemon with a bench pokemon after paying retreat cost.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {string} fromActiveId - ID of the current active pokemon.
 * @param {number} toBenchIndex - Bench index to promote to active.
 * @returns {object} Updated game state after retreat.
 */
export function retreat(state, player, fromActiveId, toBenchIndex) {
    const playerState = state.players[player];
    const active = playerState.active;
    const benchPokemon = playerState.bench[toBenchIndex];

    if (!active || active.id !== fromActiveId || !benchPokemon) {
        return state;
    }

    const retreatCost = active.retreat_cost || 0;
    const attached = [...(active.attached_energy || [])];
    if (attached.length < retreatCost) {
        return state;
    }

    const energyToDiscard = attached.slice(0, retreatCost);
    const remainingEnergy = attached.slice(retreatCost);

    const newBench = [...playerState.bench];
    newBench[toBenchIndex] = { ...active, attached_energy: remainingEnergy };

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                active: benchPokemon,
                bench: newBench,
                discard: [...playerState.discard, ...energyToDiscard]
            }
        }
    };
}

/**
 * Checks if a pokemon has enough energy for a given attack.
 * @param {object} pokemon - The pokemon object.
 * @param {object} attack - The attack object.
 * @returns {boolean}
 */
export function hasEnoughEnergy(pokemon, attack) {
    const attached = (pokemon.attached_energy || []).map(e => e.energy_type);
    const cost = [...attack.cost];

    for (let i = attached.length - 1; i >= 0; i--) {
        const energyType = attached[i];
        const costIndex = cost.findIndex(c => c === energyType || c === 'Colorless');
        if (costIndex !== -1) {
            cost.splice(costIndex, 1);
            attached.splice(i, 1); // Each energy can only be used once
        }
    }
    // Check remaining cost against remaining colorless energy
    const colorlessEnergyCount = attached.filter(e => e === 'Colorless').length;
    const colorlessCostCount = cost.filter(c => c === 'Colorless').length;

    return cost.length === 0 || (cost.every(c => c === 'Colorless') && attached.length >= cost.length);
}

/**
 * Performs an attack, calculates damage, and applies it.
 * @param {object} state - The current game state.
 * @param {string} attackingPlayerId - 'player' or 'cpu'.
 * @param {number} attackIndex - The index of the attack to use.
 * @returns {object} The new game state.
 */
export function performAttack(state, attackingPlayerId, attackIndex) {
    const defendingPlayerId = attackingPlayerId === 'player' ? 'cpu' : 'player';
    const attackerState = state.players[attackingPlayerId];
    const defenderState = state.players[defendingPlayerId];

    const attacker = attackerState.active;
    const defender = defenderState.active;

    if (!attacker || !defender) {
        console.error('Active pokemon missing for attack.');
        return state;
    }

    const attack = attacker.attacks[attackIndex];
    if (!attack) {
        console.error('Invalid attack index.');
        return state;
    }

    if (!hasEnoughEnergy(attacker, attack)) {
        console.error('Not enough energy for this attack.');
        // In a real game, show this to the user, don't just log.
        return state;
    }

    // --- Damage Calculation ---
    // For now, just base damage.
    // TODO: Implement weakness and resistance.
    const damage = attack.damage || 0;
    const previousDamage = defender.damage || 0;
    const newDamage = previousDamage + damage;

    console.log(`⚔️ DAMAGE CALCULATION: ${attacker.name_ja} attacks ${defender.name_ja}`);
    console.log(`  💥 Attack damage: ${damage}`);
    console.log(`  🩸 Previous damage: ${previousDamage}`);
    console.log(`  🔴 New total damage: ${newDamage}`);

    const updatedDefender = {
        ...defender,
        damage: newDamage,
    };

    console.log(`✅ Defender updated:`, {
        name: updatedDefender.name_ja,
        hp: updatedDefender.hp,
        damage: updatedDefender.damage,
        damageType: typeof updatedDefender.damage
    });

    return {
        ...state,
        players: {
            ...state.players,
            [defendingPlayerId]: {
                ...defenderState,
                active: updatedDefender,
            },
        },
    };
}

/**
 * Moves a pokemon from the bench to the active spot.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {number} benchIndex - The index of the pokemon on the bench.
 * @returns {object} The new game state.
 */
export function promoteToActive(state, player, benchIndex) {
    const playerState = state.players[player];
    const newActive = playerState.bench[benchIndex];

    if (!newActive || playerState.active) {
        return state; // Can't promote if there's already an active or the source is empty
    }

    const newBench = [...playerState.bench];
    newBench[benchIndex] = null; // Empty the bench slot

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                active: newActive,
                bench: newBench,
            },
        },
    };
}

/**
 * Checks for a knockout on a player's active pokemon.
 * @param {object} state - The current game state.
 * @param {string} defendingPlayerId - The player to check for a KO.
 * @returns {object} The new state, potentially with the KO processed.
 */
export function checkForKnockout(state, defendingPlayerId) {
    const defenderState = state.players[defendingPlayerId];
    const defender = defenderState.active;

    console.log(`🔍 Checking knockout for ${defendingPlayerId}:`, {
        pokemon: defender?.name_ja,
        damage: defender?.damage || 0,
        hp: defender?.hp,
        isKO: defender && defender.damage >= defender.hp
    });

    if (!defender || !defender.damage || defender.damage < defender.hp) {
        console.log('✅ No knockout occurred');
        return state; // No KO
    }

    // It's a KO!
    console.log(`💀 KNOCKOUT! ${defender.name_ja} is knocked out`);
    const attackingPlayerId = defendingPlayerId === 'player' ? 'cpu' : 'player';
    const attackerState = state.players[attackingPlayerId];

    // Move KO'd pokemon and its cards to discard
    const newDiscard = [...defenderState.discard, defender, ...(defender.attached_energy || [])];

    // ベンチにポケモンがいるかチェック
    const hasBenchPokemon = defenderState.bench.some(p => p !== null);
    console.log(`🔎 ${defendingPlayerId} has bench pokemon:`, hasBenchPokemon);
    console.log(`🎯 Prize update: ${attackingPlayerId} gains 1 prize (${attackerState.prizeRemaining} -> ${attackerState.prizeRemaining - 1})`);

    const newState = {
        ...state,
        phase: hasBenchPokemon ? GAME_PHASES.AWAITING_NEW_ACTIVE : state.phase, // Only change phase if bench has pokemon
        prompt: {
            message: hasBenchPokemon 
                ? `${defendingPlayerId === 'player' ? 'あなた' : '相手'}のバトルポケモンがきぜつした。ベンチから新しいポケモンを選んでください。`
                : state.prompt?.message,
        },
        players: {
            ...state.players,
            [defendingPlayerId]: {
                ...defenderState,
                active: null,
                discard: newDiscard,
            },
            [attackingPlayerId]: {
                ...attackerState,
                prizeRemaining: attackerState.prizeRemaining - 1,
                prizesToTake: (attackerState.prizesToTake || 0) + 1, // Add a prize to take
            },
        },
    };

    console.log(`🔄 Post-KO phase: ${newState.phase}`);
    return newState;
}

/**
 * Moves a prize card to the player's hand.
 * @param {object} state - The current game state.
 * @param {string} player - 'player' or 'cpu'.
 * @param {number} prizeIndex - The index of the prize card to take.
 * @returns {object} The new game state.
 */
export function takePrizeCard(state, player, prizeIndex) {
    const playerState = state.players[player];
    if (playerState.prizesToTake === 0 || !playerState.prize[prizeIndex]) {
        return state; // No prize to take or prize already taken
    }

    const newPrizeList = [...playerState.prize];
    const prizeCard = newPrizeList[prizeIndex];
    newPrizeList[prizeIndex] = null; // Remove prize from board

    const newHand = [...playerState.hand, prizeCard];

    return {
        ...state,
        players: {
            ...state.players,
            [player]: {
                ...playerState,
                hand: newHand,
                prize: newPrizeList,
                prizesToTake: playerState.prizesToTake - 1,
            },
        },
    };
}

/**
 * Checks for all win conditions.
 * @param {object} state - The current game state.
 * @returns {object} The new state, potentially with a winner.
 */
export function checkForWinner(state) {
    console.log('🏆 Checking win conditions...');
    
    // Check prize card condition
    console.log(`🎯 Prize remaining - Player: ${state.players.player.prizeRemaining}, CPU: ${state.players.cpu.prizeRemaining}`);
    if (state.players.player.prizeRemaining <= 0) {
        console.log('🏆 GAME OVER: Player wins by prizes!');
        return { ...state, phase: 'gameOver', winner: 'player', gameEndReason: 'prizes' };
    }
    if (state.players.cpu.prizeRemaining <= 0) {
        console.log('🏆 GAME OVER: CPU wins by prizes!');
        return { ...state, phase: 'gameOver', winner: 'cpu', gameEndReason: 'prizes' };
    }

    // Check if a player has no pokemon left in play (active or bench)
    const isPlayerOutOfPokemon = !state.players.player.active && state.players.player.bench.every(p => p === null);
    const isCpuOutOfPokemon = !state.players.cpu.active && state.players.cpu.bench.every(p => p === null);
    
    console.log(`🔍 Pokemon status - Player out: ${isPlayerOutOfPokemon}, CPU out: ${isCpuOutOfPokemon}`);
    console.log(`🔍 Player active: ${state.players.player.active?.name_ja || 'none'}, bench: ${state.players.player.bench.filter(p => p).length}/5`);
    console.log(`🔍 CPU active: ${state.players.cpu.active?.name_ja || 'none'}, bench: ${state.players.cpu.bench.filter(p => p).length}/5`);

    if (isPlayerOutOfPokemon) {
        console.log('🏆 GAME OVER: CPU wins - Player has no pokemon!');
        return { ...state, phase: GAME_PHASES.GAME_OVER, winner: 'cpu', gameEndReason: 'no_pokemon' };
    }
    if (isCpuOutOfPokemon) {
        console.log('🏆 GAME OVER: Player wins - CPU has no pokemon!');
        return { ...state, phase: GAME_PHASES.GAME_OVER, winner: 'player', gameEndReason: 'no_pokemon' };
    }

    console.log('✅ No winner yet, game continues');
    return state; // No winner yet
}

