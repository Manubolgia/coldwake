// npm run sim -- [runs] [difficulty] [role]
import { playOut } from '../src/game/bot';
import type { Difficulty, RoleId } from '../src/game/types';

const runs = Number(process.argv[2] ?? 500);
const difficulty = (process.argv[3] ?? 'standard') as Difficulty;
const roleArg = process.argv[4];
const roles: RoleId[] = roleArg ? [roleArg as RoleId] : ['engineer', 'marine', 'medic', 'scientist', 'pilot'];

for (const role of roles) {
  const endings: Record<string, number> = {};
  let won = 0;
  let rounds = 0;
  let truth = 0;
  let kills = 0;
  for (let i = 0; i < runs; i++) {
    const { result } = playOut(`sim-${role}-${i}`, role, difficulty);
    endings[result.ending] = (endings[result.ending] ?? 0) + 1;
    if (result.status === 'won') won++;
    rounds += result.rounds;
    if (result.truth) truth++;
    kills += result.kills;
  }
  const pct = (n: number) => `${((100 * n) / runs).toFixed(0)}%`;
  console.log(
    `${role.padEnd(10)} win ${pct(won).padStart(4)}  rounds ${(rounds / runs).toFixed(1)}  truth ${pct(truth)}  kills ${(kills / runs).toFixed(2)}`,
  );
  console.log('   ', Object.entries(endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join(' · '));
}
