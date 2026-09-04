import { runBatch } from '../src/sim/cli';
import { summarise } from '../src/sim/metrics';
import type { BotName } from '../src/sim/bots';
import type { Depth, RoleId } from '../src/engine/types';

const runs = Number(process.env.RUNS ?? 600);
const bots = (process.env.BOTS ?? 'heuristic').split(',') as BotName[];
const roles = (process.env.ROLES ?? 'engineer').split(',') as RoleId[];
const depths = (process.env.DEPTHS ?? '1,2,3,4,5').split(',').map(Number) as Depth[];
for (const bot of bots) {
  for (const role of roles) {
    for (const depth of depths) {
      const acc = await runBatch({ runs, role, depth, bot, entropy: false, seedPrefix: 'kell', workers: 4 });
      const s = summarise(acc);
      const e = s.endings;
      console.log(
        `${bot.padEnd(9)} ${role.padEnd(9)} d${depth}  win ${(s.winRate * 100).toFixed(1).padStart(5)}%  ` +
          `clean ${((e.clean_break ?? 0) * 100).toFixed(0).padStart(3)}  carr ${((e.carrier ?? 0) * 100).toFixed(0).padStart(3)}  ` +
          `scut ${((e.scuttle ?? 0) * 100).toFixed(0).padStart(3)}  beac ${((e.beacon ?? 0) * 100).toFixed(0).padStart(3)}  ` +
          `lost ${((e.lost ?? 0) * 100).toFixed(0).padStart(3)}  medTurn ${String(s.medianTurn).padStart(2)}  ` +
          `wound ${s.means.wounds.toFixed(1)}  scan ${(s.scanRate * 100).toFixed(0)}%`,
      );
    }
  }
}
