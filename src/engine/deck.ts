import { card, PANIC_CARDS } from './content';
import { nextInt, shuffle } from './rng';
import type { CardId, GameState, Uid } from './types';

export function cardIdOf(uid: Uid): CardId {
  const at = uid.lastIndexOf('@');
  return at === -1 ? uid : uid.slice(0, at);
}

export function cardOf(uid: Uid) {
  return card(cardIdOf(uid));
}

export function isPanic(uid: Uid): boolean {
  return cardOf(uid).role === 'panic';
}

export function makeUid(cardId: CardId, n: number): Uid {
  return `${cardId}@${n}`;
}

/** Every non-burned copy the player still owns. */
export function ownedCards(state: GameState): Uid[] {
  return [...state.player.hand, ...state.player.deck, ...state.player.discard];
}

export function nonPanicCount(state: GameState): number {
  return ownedCards(state).filter((u) => !isPanic(u)).length;
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

/** Shuffle a fresh panic card into the deck. §4.3. */
export function addPanic(state: GameState): Uid {
  const [idx, rng] = nextInt(state.rng, PANIC_CARDS.length);
  state.rng = rng;
  const cardId = PANIC_CARDS[idx] as CardId;
  state.player.panicsGained += 1;
  const uid = makeUid(cardId, 1000 + state.player.panicsGained);
  state.player.deck.push(uid);
  const [deck, rng2] = shuffle(state.player.deck, state.rng);
  state.player.deck = deck;
  state.rng = rng2;
  return uid;
}

/** Remove one panic card from hand, then deck, then discard. */
export function removePanic(state: GameState): Uid | undefined {
  for (const pile of [state.player.hand, state.player.deck, state.player.discard]) {
    const i = pile.findIndex((u) => isPanic(u));
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
