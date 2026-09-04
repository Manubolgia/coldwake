import { initialState, legalActions, reduce, setInvariantChecking } from '../src/engine';
import { seedFrom } from '../src/engine/rng';
import { HeuristicBot } from '../src/sim/bots';

function bench(label: string, runs: number, invariants: boolean): void {
  setInvariantChecking(invariants);
  const t0 = Date.now();
  for (let i = 0; i < runs; i++) {
    let s = initialState(`b${i}`, 'engineer', 3);
    let rng = seedFrom(`r${i}`);
    while (s.status === 'active') {
      const [a, r] = HeuristicBot.choose(s, legalActions(s), rng);
      rng = r;
      s = reduce(s, a);
    }
  }
  const ms = Date.now() - t0;
  console.log(`${label}: ${(runs / (ms / 1000)).toFixed(0)} runs/sec (${ms}ms for ${runs})`);
}
bench('invariants on ', 60, true);
bench('invariants off', 60, false);
