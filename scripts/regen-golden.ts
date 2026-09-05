/** Regenerate the golden replays. Review the diff; never accept it blindly. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashState, initialState, legalActions, reduce } from '../src/engine';
import { nextInt, seedFrom } from '../src/engine/rng';
import { BOTS, type BotName } from '../src/sim/bots';
import type { Action, Depth, GameState, Objective, RoleId } from '../src/engine/types';

const ROLES: RoleId[] = ['engineer', 'security', 'medic', 'surveyor', 'pilot'];
const DEPTHS: Depth[] = [1, 2, 3, 4, 5];
const BOT_NAMES: BotName[] = ['random', 'greedy', 'heuristic'];
// Every objective gets fixtures, so a change to one route cannot slip through.
const OBJECTIVES: Objective[] = ['run', 'burn', 'call', 'know'];

const fixtures: unknown[] = [];
for (let i = 0; i < 30; i++) {
  const role = ROLES[i % ROLES.length] as RoleId;
  const depth = DEPTHS[i % DEPTHS.length] as Depth;
  const botName = BOT_NAMES[i % BOT_NAMES.length] as BotName;
  const objective = OBJECTIVES[i % OBJECTIVES.length] as Objective;
  const seed = `golden-${i}`;
  const bot = BOTS[botName];
  let state: GameState = initialState(seed, role, depth, objective);
  let rng = seedFrom(`golden-bot-${i}`);
  const actions: Action[] = [];
  while (state.status === 'active') {
    const legal = legalActions(state);
    const [action, next] =
      botName === 'random'
        ? (() => {
            const [k, r] = nextInt(rng, legal.length);
            return [legal[k] as Action, r] as const;
          })()
        : bot.choose(state, legal, rng);
    rng = next;
    actions.push(action);
    state = reduce(state, action);
  }
  fixtures.push({
    seed,
    role,
    depth,
    objective,
    bot: botName,
    actions,
    ending: state.status,
    score: state.result?.score,
    hash: hashState(state),
  });
}

mkdirSync(join('test', 'golden'), { recursive: true });
writeFileSync(join('test', 'golden', 'replays.json'), `${JSON.stringify(fixtures, null, 1)}\n`);
console.log(`wrote ${fixtures.length} golden replays`);
