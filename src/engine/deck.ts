import { card, INFECTION_CARDS } from './content';
import { nextInt, shuffle } from './rng';
import type { CardId, GameState, Uid } from './types';

export function cardIdOf(uid: Uid): CardId {
  const at = uid.lastIndexOf('@');
  return at === -1 ? uid : uid.slice(0, at);
}

export function cardOf(uid: Uid) {
  return card(cardIdOf(uid));
}

/**
 * Infection is the one attrition track. It is a card in your own deck, it is
 * counted on the status strip from the moment you take the first one, and the
 * medbay cuts it out. Nothing about it is face down — §3.2 of the redesign.
 */
export function isInfection(uid: Uid): boolean {
  return cardOf(uid).role === 'infection';
}

export function makeUid(cardId: CardId, n: number): Uid {
  return `${cardId}@${n}`;
}

/** Every non-burned copy the player still owns. */
export function ownedCards(state: GameState): Uid[] {
  return [...state.player.hand, ...state.player.deck, ...state.player.discard];
}

/** The number on the status strip. Never hidden, never estimated. */
export function infectionCount(state: GameState): number {
  return ownedCards(state).filter(isInfection).length;
}

export function capabilityCount(state: GameState): number {
  return ownedCards(state).filter((u) => !isInfection(u)).length;
}

/** Draw one card. Reshuffles the discard when the deck runs out. */
export function drawOne(state: GameState): { uid: Uid | undefined } {
  if (state.player.deck.length === 0) {
    if (state.player.discard.length === 0) return { uid: undefined };
    const [reshuffled, rng] = shuffle(state.player.discard, state.rng);
    state.player.deck = reshuffled;
    state.player.discard = [];
    state.rng = rng;
  }
  const uid = state.player.deck.shift();
  if (uid === undefined) return { uid: undefined };
  state.player.hand.push(uid);
  return { uid };
}

/** Shuffle a fresh infection card into the deck. */
export function addInfection(state: GameState): Uid {
  const [idx, rng] = nextInt(state.rng, INFECTION_CARDS.length);
  state.rng = rng;
  const cardId = INFECTION_CARDS[idx] as CardId;
  state.player.infectionsGained += 1;
  const uid = makeUid(cardId, 1000 + state.player.infectionsGained);
  state.player.deck.push(uid);
  const [deck, rng2] = shuffle(state.player.deck, state.rng);
  state.player.deck = deck;
  state.rng = rng2;
  return uid;
}

/**
 * Cut one infection out for good. Hand first, because that is the one the
 * player can feel; then the deck, then the discard.
 */
export function removeInfection(state: GameState): Uid | undefined {
  for (const pile of [state.player.hand, state.player.deck, state.player.discard]) {
    const i = pile.findIndex((u) => isInfection(u));
    if (i >= 0) {
      const [uid] = pile.splice(i, 1);
      state.player.burned.push(uid as Uid);
      return uid;
    }
  }
  return undefined;
}

export function removeFromHand(state: GameState, uid: Uid): boolean {
  const i = state.player.hand.indexOf(uid);
  if (i < 0) return false;
  state.player.hand.splice(i, 1);
  return true;
}

export function isSpent(state: GameState, uid: Uid): boolean {
  return state.player.spent.includes(uid);
}

/** Does the player hold this infection right now, and is it therefore biting? */
export function holding(state: GameState, cardId: CardId): boolean {
  return state.player.hand.some((u) => cardIdOf(u) === cardId);
}
