/** `npm run play:random -- --seed abc` — one complete headless run. */
import { initialState, legalActions, reduce } from '../engine';
import { nextInt, seedFrom } from '../engine/rng';
import type { Depth, GameState, RoleId } from '../engine/types';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const seed = arg('seed', 'bellwether');
const role = arg('role', 'engineer') as RoleId;
const depth = Number(arg('depth', '1')) as Depth;
const verbose = process.argv.includes('--verbose');

let state: GameState = initialState(seed, role, depth);
let botRng = seedFrom(`bot|${seed}`);
let guard = 0;

while (state.status === 'active' && guard++ < 5000) {
  const actions = legalActions(state);
  if (actions.length === 0) throw new Error('no legal actions while active');
  const [i, r] = nextInt(botRng, actions.length);
  botRng = r;
  state = reduce(state, actions[i]!);
}

if (verbose) for (const line of state.feed) console.log(`[${line.turn}] ${line.text}`);
console.log(
  `SEED ${seed} ROLE ${role} DEPTH ${depth} -> ${state.result?.ending ?? 'unresolved'} ` +
    `score ${state.result?.score ?? 0} turn ${state.result?.turn ?? state.turn} actions ${state.log.length}`,
);
