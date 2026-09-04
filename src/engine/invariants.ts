import { NODE_IDS, RULES, TOKEN_TYPES, roleDeck } from './content';
import { isPanic } from './deck';
import { TOTAL_TOKENS, noiseFloor } from './state';
import type { GameState } from './types';

export class InvariantError extends Error {}

/** §7 rule 6. Cheap enough to run on every transition in dev and sim builds. */
export function assertInvariants(state: GameState): void {
  const startingDeckSize = roleDeck(state.role).length;
  const fail = (msg: string): never => {
    throw new InvariantError(`${msg} @turn ${state.turn}`);
  };

  const bag = TOKEN_TYPES.reduce((a, t) => a + (state.bag[t] ?? 0), 0);
  const reserve = TOKEN_TYPES.reduce((a, t) => a + (state.reserve[t] ?? 0), 0);
  const board = state.threats.length;
  if (bag + reserve + board !== TOTAL_TOKENS) {
    fail(`token conservation: ${bag}+${reserve}+${board} != ${TOTAL_TOKENS}`);
  }
  for (const t of TOKEN_TYPES) {
    if ((state.bag[t] ?? 0) < 0 || (state.reserve[t] ?? 0) < 0) fail(`negative token pool ${t}`);
  }

  const p = state.player;
  const cards = p.hand.length + p.deck.length + p.discard.length + p.burned.length;
  const acquired = [...p.hand, ...p.deck, ...p.discard, ...p.burned].filter((u) =>
    u.startsWith('salv_'),
  ).length;
  if (cards !== startingDeckSize + p.panicsGained + acquired) {
    fail(`card conservation: ${cards} != ${startingDeckSize}+${p.panicsGained}+${acquired}`);
  }

  if (state.ship.power < 0 || state.ship.power > RULES.powerCap) fail(`power ${state.ship.power}`);
  if (p.ap < 0 || p.ap > RULES.apPerTurn + 3) fail(`ap ${p.ap}`);
  if (state.ship.reactorOutput < 0 || state.ship.reactorOutput > RULES.reactorOutputMax) {
    fail(`reactor ${state.ship.reactorOutput}`);
  }
  if (state.ship.shuttleCharge < 0) fail('shuttle charge negative');
  for (const id of NODE_IDS) {
    const n = state.ship.noise[id] ?? 0;
    if (n < noiseFloor(state.depth, id) || n > RULES.noiseMax) fail(`noise ${id}=${n}`);
  }
  for (const t of state.threats) {
    if (t.node !== 'vents' && !NODE_IDS.includes(t.node)) fail(`threat off map: ${t.node}`);
  }
  if (p.hand.length > RULES.handSize + 4) fail(`hand size ${p.hand.length}`);
  if (state.status !== 'active' && state.result === undefined) fail('resolved run without a result');
  if (isPanic('panic_shaking@1') !== true) fail('panic detection broken');
}
