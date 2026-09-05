import { describe, initialState, legalActions, reduce } from '../src/engine';
import { seedFrom } from '../src/engine/rng';
import { HeuristicBot } from '../src/sim/bots';
import { currentRoute, objectiveNode } from '../src/sim/eval';
import type { Depth, RoleId } from '../src/engine/types';

const role = (process.argv[2] ?? 'engineer') as RoleId;
const depth = Number(process.argv[3] ?? 3) as Depth;
let s = initialState(process.argv[4] ?? 'p1', role, depth);
let rng = seedFrom('b1');
let turn = 0;
while (s.status === 'active') {
  if (s.turn !== turn) {
    turn = s.turn;
    console.log(
      `-- T${turn} @${s.player.node} pwr ${s.ship.power} out ${s.ship.reactorOutput} shuttle ${s.ship.shuttleCharge} ` +
        `route ${currentRoute(s)} -> ${objectiveNode(s)} hive ${s.ship.hive} ` +
        `threats ${s.threats.map((t) => `${t.type[0]}:${t.node}/${t.stance}`).join(',')}`,
    );
  }
  const [a, r] = HeuristicBot.choose(s, legalActions(s), rng);
  rng = r;
  console.log(`   ${describe(a)}`);
  s = reduce(s, a);
}
console.log(s.result);
