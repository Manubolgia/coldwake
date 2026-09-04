/**
 * The CI balance smoke test (gate 6.10): 500 runs a depth, wide bands. It is
 * not the tuning gate — it exists to stop a rules change that quietly makes the
 * game trivial or impossible from reaching the deploy.
 */
import { runBatch } from '../src/sim/cli';
import { summarise } from '../src/sim/metrics';
import type { Depth } from '../src/engine/types';

const BANDS: Record<number, [number, number]> = {
  1: [0.45, 0.75],
  3: [0.3, 0.6],
  5: [0.15, 0.5],
};

let failed = false;
for (const depth of [1, 3, 5] as Depth[]) {
  const acc = await runBatch({
    runs: 500,
    role: 'engineer',
    depth,
    bot: 'heuristic',
    entropy: false,
    seedPrefix: 'smoke',
    workers: 4,
  });
  const s = summarise(acc);
  const [min, max] = BANDS[depth] ?? [0, 1];
  const ok = s.winRate >= min && s.winRate <= max;
  if (!ok) failed = true;
  console.log(
    `depth ${depth}: ${(s.winRate * 100).toFixed(1)}% ` +
      `(band ${(min * 100).toFixed(0)}–${(max * 100).toFixed(0)}%) ${ok ? 'OK' : 'OUT OF BAND'}`,
  );
}
if (failed) {
  console.error('\nBalance regression: a rules or content change moved the win rate out of band.');
  process.exit(1);
}
