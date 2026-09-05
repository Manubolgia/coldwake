import { initialState, legalActions, reduce } from '../src/engine';
import { seedFrom } from '../src/engine/rng';
import { HeuristicBot } from '../src/sim/bots';
import type { Depth, RoleId } from '../src/engine/types';

const role = (process.argv[2] ?? 'engineer') as RoleId;
const depth = Number(process.argv[3] ?? 1) as Depth;
let draws = 0, spawns = 0, wounds = 0, killed = 0, endTurnPct = 0, acts = 0, n = 200, carry = 0, repairs = 0, charges = 0, banked = 0, creeps = 0;
for (let i = 0; i < n; i++) {
  let s = initialState(`p${i}`, role, depth);
  let rng = seedFrom(`b${i}`);
  while (s.status === 'active') {
    const legal = legalActions(s);
    const [a, r] = HeuristicBot.choose(s, legal, rng);
    rng = r;
    acts++;
    if (a.t === 'endTurn') endTurnPct++;
    if (a.t === 'repair') repairs++;
    if (a.t === 'chargeShuttle') charges++;
    if (a.t === 'creep') creeps++;
    s = reduce(s, a);
  }
  draws += s.stats.bagDraws;
  spawns += s.nextThreatId - 1;
  wounds += s.stats.wounds;
  killed += s.stats.threatsKilled;
  carry += s.stats.cures;
  banked += s.ship.shuttleCharge;
}
console.log(`${role} d${depth}: draws ${(draws/n).toFixed(1)} spawns ${(spawns/n).toFixed(1)} wounds ${(wounds/n).toFixed(2)} kills ${(killed/n).toFixed(2)} carry ${(carry/n).toFixed(2)} banked ${(banked/n).toFixed(1)} repairs ${(repairs/n).toFixed(2)} charges ${(charges/n).toFixed(2)} creeps ${(creeps/n).toFixed(1)} endTurn ${(endTurnPct/acts*100).toFixed(1)}%`);
