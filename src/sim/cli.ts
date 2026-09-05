/**
 * `npm run sim -- --runs 50000 --depth 3 --role engineer --bot heuristic`
 * Shards across processes, merges, writes /reports/*.json and a readable .md.
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { accumulate, emptyAccumulator, merge, summarise, type Accumulator, type Summary } from './metrics';
import { objectiveFor, runOne } from './runner';
import { markdownReport, type Band } from './report';
import type { BotName } from './bots';
import type { Depth, RoleId } from '../engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

export function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}
export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export type BatchSpec = {
  runs: number;
  role: RoleId;
  depth: Depth;
  bot: BotName;
  entropy: boolean;
  seedPrefix: string;
  workers: number;
};

function runInProcess(spec: BatchSpec): Accumulator {
  const acc = emptyAccumulator();
  for (let i = 0; i < spec.runs; i++) {
    accumulate(
      acc,
      runOne({
        seed: `${spec.seedPrefix}${i}`,
        role: spec.role,
        depth: spec.depth,
        bot: spec.bot,
        botSeed: `bot${i}`,
        objective: objectiveFor(i),
        entropy: spec.entropy,
      }),
    );
  }
  return acc;
}

function shard(spec: BatchSpec, from: number, to: number): Promise<Accumulator> {
  const payload = JSON.stringify({
    role: spec.role,
    depth: spec.depth,
    bot: spec.bot,
    entropy: spec.entropy,
    seedPrefix: spec.seedPrefix,
    from,
    to,
  });
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(here, 'shard.ts'), payload],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`shard exited ${code}`));
      try {
        resolve(JSON.parse(out) as Accumulator);
      } catch (e) {
        reject(e as Error);
      }
    });
  });
}

export async function runBatch(spec: BatchSpec): Promise<Accumulator> {
  if (spec.workers <= 1 || spec.runs < 200) return runInProcess(spec);
  const size = Math.ceil(spec.runs / spec.workers);
  const jobs: Promise<Accumulator>[] = [];
  for (let i = 0; i < spec.runs; i += size) {
    jobs.push(shard(spec, i, Math.min(i + size, spec.runs)));
  }
  const parts = await Promise.all(jobs);
  return parts.reduce((a, b) => merge(a, b), emptyAccumulator());
}

export function bandsFor(summary: Summary, depth: Depth): Band[] {
  const winBands: Record<number, [number, number]> = {
    1: [0.55, 0.65],
    2: [0.45, 0.6],
    3: [0.35, 0.45],
    4: [0.25, 0.38],
    5: [0.15, 0.25],
  };
  const [min, max] = winBands[depth] ?? [0, 1];
  const routes = ['run', 'burn', 'call', 'know'];
  const weakestRoute = Math.min(...routes.map((o) => summary.winSplit[o] ?? 0));
  return [
    { label: `depth ${depth} win rate`, value: summary.winRate, min, max, unit: 'pct' },
    // The six complaints, as bands. Every one of these was measured on the old
    // game and every one of them is in docs/REDESIGN.md Part 5.
    {
      label: 'weakest route share of wins',
      value: weakestRoute,
      min: 0.1,
      max: 1,
      unit: 'pct',
    },
    { label: 'cards played of cards drawn', value: summary.cardPlayRate, min: 0.35, max: 1, unit: 'pct' },
    { label: 'compartments entered per run', value: summary.movesPerRun, min: 4, max: 40 },
    { label: 'median resolution turn', value: summary.medianTurn, min: 12, max: 17 },
    { label: 'early deaths (<turn 8)', value: summary.earlyDeathRate, min: 0, max: 0.05, unit: 'pct' },
    { label: 'top action share', value: summary.topActionShare, min: 0, max: 0.25, unit: 'pct' },
    { label: 'dominant route share', value: summary.dominantRouteShare, min: 0, max: 0.15, unit: 'pct' },
    {
      label: 'largest loss cause',
      value: Math.max(0, ...Object.values(summary.causes)),
      min: 0,
      max: 0.55,
      unit: 'pct',
    },
  ];
}

async function main(): Promise<void> {
  const runs = Number(arg('runs', '2000'));
  const role = arg('role', 'engineer') as RoleId;
  const depth = Number(arg('depth', '3')) as Depth;
  const bot = arg('bot', 'heuristic') as BotName;
  const workers = Number(arg('workers', String(Math.max(1, cpus().length))));
  const entropy = flag('entropy');
  const spec: BatchSpec = { runs, role, depth, bot, entropy, seedPrefix: arg('seed', 'kell'), workers };

  const t0 = Date.now();
  const acc = await runBatch(spec);
  const ms = Date.now() - t0;
  const summary = summarise(acc);

  mkdirSync(join(root, 'reports'), { recursive: true });
  const stem = `${bot}-d${depth}-${role}`;
  writeFileSync(
    join(root, 'reports', `${stem}.json`),
    JSON.stringify({ spec, ms, summary, accumulator: acc }, null, 2),
  );
  const md = markdownReport(
    `COLDWAKE balance — ${bot} · depth ${depth} · ${role}`,
    [{ label: `${bot} d${depth} ${role}`, summary }],
    bandsFor(summary, depth),
    { runs, workers, 'elapsed ms': ms, 'runs/sec': Math.round((runs / ms) * 1000) },
  );
  writeFileSync(join(root, 'reports', `${stem}.md`), md);
  if (!flag('quiet')) console.log(md);
  console.log(`\n${runs} runs in ${(ms / 1000).toFixed(1)}s -> reports/${stem}.md`);
}

if (process.argv[1]?.endsWith('cli.ts')) {
  await main();
}
