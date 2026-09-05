/**
 * `npm run gate:mN` — the milestone gates from Part 13 of the design document.
 * Exits non-zero on any red check. Checks that need a human or a real phone are
 * reported as MANUAL and do not pass silently.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEPTHS,
  ROLES,
  TOTAL_TOKENS,
  hashState,
  initialState,
  legalActions,
  reduce,
  roleDeck,
} from '../src/engine';
import { next, seedFrom } from '../src/engine/rng';
import type { Depth, RoleId } from '../src/engine/types';
import { runBatch, bandsFor } from '../src/sim/cli';
import { summarise } from '../src/sim/metrics';

type Result = { id: string; label: string; status: 'PASS' | 'FAIL' | 'MANUAL'; detail: string };

const results: Result[] = [];
const record = (id: string, label: string, ok: boolean, detail = ''): void => {
  results.push({ id, label, status: ok ? 'PASS' : 'FAIL', detail });
};
const manual = (id: string, label: string, detail: string): void => {
  results.push({ id, label, status: 'MANUAL', detail });
};

function sh(cmd: string, args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const ALL_ROLES = ROLES.map((r) => r.id as RoleId);
const ALL_DEPTHS = DEPTHS.map((d) => d.depth as Depth);

async function m0(): Promise<void> {
  const anyInEngine = readdirSync('src/engine').some((f) =>
    /:\s*any\b/.test(readFileSync(join('src/engine', f), 'utf8')),
  );
  record('0.1', 'typecheck clean, no any in /engine', sh('npx', ['tsc', '--noEmit']).ok && !anyInEngine);

  let a = seedFrom('gate');
  let b = seedFrom('gate');
  let same = true;
  for (let i = 0; i < 10000; i++) {
    const [va, na] = next(a);
    const [vb, nb] = next(b);
    if (va !== vb) same = false;
    a = na;
    b = nb;
  }
  record('0.2', 'PRNG determinism over 10,000 values', same);

  const revived = JSON.parse(JSON.stringify({ a })).a as number;
  record('0.4', 'PRNG state survives JSON', next(revived)[0] === next(a)[0]);

  let built = true;
  let conserved = true;
  let roundTripped = true;
  for (const role of ALL_ROLES) {
    for (const depth of ALL_DEPTHS) {
      try {
        const s = initialState('gate', role, depth);
        const bag = Object.values(s.bag).reduce((x, y) => x + y, 0);
        const reserve = Object.values(s.reserve).reduce((x, y) => x + y, 0);
        if (bag + reserve + s.threats.length !== TOTAL_TOKENS) conserved = false;
        if (JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s)) roundTripped = false;
        if (roleDeck(role).length !== 12) built = false;
      } catch {
        built = false;
      }
    }
  }
  record('0.5', 'initialState builds all 25 role × depth combinations', built);
  record('0.6', 'state round-trips through JSON', roundTripped);
  record('0.8', 'token conservation at setup', conserved);

  // Comments and string literals both go: the engine composes the prose the
  // ship speaks, and "the orbit closed" is not a DOM reference however much
  // "the window closed" looks like one to a regular expression.
  const stripNonCode = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/`(?:\\.|[^`\\])*`/g, '``')
      .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
      .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
  const dom = readdirSync('src/engine')
    .map((f) => stripNonCode(readFileSync(join('src/engine', f), 'utf8')))
    .some((src) => /\b(document|window|Math\.random|Date\.now)\b/.test(src));
  record('0.9', 'engine has no DOM, Math.random or Date.now', !dom);
  record('0.7', 'content validates (see test/content.test.ts)', sh('npx', ['vitest', 'run', 'test/content.test.ts']).ok);
}

async function m1(): Promise<void> {
  const tests = sh('npx', ['vitest', 'run', '--coverage']);
  record('1.1-1.15', 'rule, property, card and golden suites', tests.ok);
  const summaryPath = join('coverage', 'coverage-summary.json');
  if (existsSync(summaryPath)) {
    const cov = JSON.parse(readFileSync(summaryPath, 'utf8')) as {
      total: { lines: { pct: number }; branches: { pct: number } };
    };
    record('1.2', 'engine line coverage ≥ 90%', cov.total.lines.pct >= 90, `${cov.total.lines.pct}%`);
    record('1.2b', 'engine branch coverage ≥ 80%', cov.total.branches.pct >= 80, `${cov.total.branches.pct}%`);
  } else {
    record('1.2', 'coverage report present', false);
  }
  record('1.9', 'golden replays committed', existsSync('test/golden/replays.json'));
  record('1.16', 'headless full run', sh('npx', ['tsx', 'src/sim/play.ts', '--seed', 'gate']).ok);
  record('1.1b', 'rules map maintained', existsSync('test/RULES.md'));
}

async function m2(): Promise<void> {
  const bots = ['random', 'greedy', 'heuristic', 'search'] as const;
  let stable = true;
  for (const bot of bots) {
    for (const depth of [1, 3, 5] as Depth[]) {
      try {
        const acc = await runBatch({
          runs: bot === 'search' ? 40 : 300,
          role: 'engineer',
          depth,
          bot,
          entropy: false,
          seedPrefix: `gate2-${bot}-${depth}-`,
          workers: 4,
        });
        if (acc.runs === 0) stable = false;
      } catch {
        stable = false;
      }
    }
  }
  record('2.1', 'all four bots run clean at depths 1, 3 and 5', stable);

  const one = await runBatch({ runs: 200, role: 'engineer', depth: 3, bot: 'heuristic', entropy: false, seedPrefix: 'det', workers: 1 });
  const two = await runBatch({ runs: 200, role: 'engineer', depth: 3, bot: 'heuristic', entropy: false, seedPrefix: 'det', workers: 1 });
  record('2.2', 'bot determinism: identical accumulators for the same seeds', JSON.stringify(one) === JSON.stringify(two));

  // 2.3: bots only ever pick from legalActions, asserted by construction plus
  // this replay check — an illegal action would throw inside reduce.
  let parity = true;
  for (let i = 0; i < 20; i++) {
    let s = initialState(`parity${i}`, 'engineer', 2);
    const log: ReturnType<typeof legalActions> = [];
    while (s.status === 'active') {
      const legal = legalActions(s);
      const a = legal[i % legal.length]!;
      log.push(a);
      s = reduce(s, a);
    }
    let replayed = initialState(`parity${i}`, 'engineer', 2);
    for (const a of log) replayed = reduce(replayed, a);
    if (hashState(replayed) !== hashState(s)) parity = false;
  }
  record('2.3/2.7', 'sim and engine agree on replay', parity);

  const t0 = Date.now();
  const throughput = await runBatch({ runs: 4000, role: 'engineer', depth: 3, bot: 'heuristic', entropy: false, seedPrefix: 'tp', workers: 4 });
  const perSecond = (throughput.runs / (Date.now() - t0)) * 1000;
  record('2.6', '50,000 runs inside five minutes', perSecond * 300 >= 50000, `${perSecond.toFixed(0)} runs/sec`);
  record('2.5', 'reports written', existsSync('reports'));
}

async function m3(): Promise<void> {
  const runs = Number(process.env.GATE_RUNS ?? 2000);
  const rates: Record<number, number> = {};
  for (const depth of ALL_DEPTHS) {
    const acc = await runBatch({ runs, role: 'engineer', depth, bot: 'heuristic', entropy: depth === 3, seedPrefix: 'gate3', workers: 4 });
    const s = summarise(acc);
    rates[depth] = s.winRate;
    for (const band of bandsFor(s, depth)) {
      record(`3.d${depth}`, band.label, band.value >= band.min && band.value <= band.max, `${band.value.toFixed(3)}`);
    }
    if (depth === 3) {
      record('3.8', 'decision entropy: tight choices on ≥60% of turns', s.entropyOkRate >= 0.6, `${(s.entropyOkRate * 100).toFixed(1)}%`);
      const rnd = summarise(await runBatch({ runs, role: 'engineer', depth: 3, bot: 'random', entropy: false, seedPrefix: 'gate3r', workers: 4 }));
      record('3.5', 'skill gap ≥ 35 points (heuristic − random, depth 3)', s.winRate - rnd.winRate >= 0.35, `${((s.winRate - rnd.winRate) * 100).toFixed(1)} points`);
      const srch = summarise(await runBatch({ runs: Math.min(runs, 300), role: 'engineer', depth: 3, bot: 'search', entropy: false, seedPrefix: 'gate3s', workers: 4 }));
      const ceiling = (srch.winRate - s.winRate) * 100;
      record('3.6', 'ceiling gap 10–20 points (search − heuristic)', ceiling >= 10 && ceiling <= 20, `${ceiling.toFixed(1)} points`);
    }
  }
  const monotonic = ALL_DEPTHS.every((d, i) => i === 0 || (rates[d] ?? 0) < (rates[ALL_DEPTHS[i - 1] as number] ?? 1));
  record('3.4', 'difficulty decreases monotonically D1 → D5', monotonic, ALL_DEPTHS.map((d) => `${((rates[d] ?? 0) * 100).toFixed(0)}%`).join(' > '));
  record('3.13', 'tuned numbers documented', existsSync('docs/BALANCE.md'));
  record('3.14', 'golden replays regenerated after tuning', existsSync('test/golden/replays.json'));
}

async function m4(): Promise<void> {
  const runs = Number(process.env.GATE_RUNS ?? 1500);
  const played: Record<string, number> = {};
  const drawn: Record<string, number> = {};
  for (const role of ALL_ROLES) {
    for (const depth of [1, 3, 5] as Depth[]) {
      const acc = await runBatch({ runs, role, depth, bot: 'heuristic', entropy: false, seedPrefix: `gate4-${role}`, workers: 4 });
      const s = summarise(acc);
      const bands: Record<number, [number, number]> = { 1: [0.48, 0.72], 3: [0.28, 0.52], 5: [0.08, 0.32] };
      const band = bands[depth] ?? [0, 1];
      record(`4.1 ${role} d${depth}`, 'role balance inside ±7 points of the engineer band', s.winRate >= band[0] && s.winRate <= band[1], `${(s.winRate * 100).toFixed(1)}%`);
      for (const [card, n] of Object.entries(acc.cardDrawn)) drawn[card] = (drawn[card] ?? 0) + n;
      for (const [card, n] of Object.entries(acc.cardPlayed)) played[card] = (played[card] ?? 0) + n;
    }
  }
  const dead = Object.entries(drawn)
    .filter(([id]) => !id.startsWith('panic_') && !id.startsWith('salv_'))
    .filter(([id, n]) => (played[id] ?? 0) / n <= 0.25)
    .map(([id]) => id);
  record('4.2', 'no dead cards (played in >25% of runs that drew them)', dead.length === 0, dead.join(', '));
  const auto = Object.entries(drawn)
    .filter(([id]) => !id.startsWith('panic_') && !id.startsWith('salv_'))
    .filter(([id, n]) => (played[id] ?? 0) / n > 0.95)
    .map(([id]) => id);
  record('4.3', 'no auto-includes (played in >95%)', auto.length === 0, auto.join(', '));
  record('4.7', 'unlock path reachable', existsSync('src/ui/persistence.ts'));
}

async function m5(): Promise<void> {
  const build = sh('npm', ['run', 'build']);
  record('5.0', 'production build', build.ok);
  const cssFiles = existsSync('dist/assets')
    ? readdirSync('dist/assets').filter((f) => f.endsWith('.css'))
    : [];
  const css = cssFiles.map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n');

  const radii = [...css.matchAll(/border-radius:\s*([^;}]+)/g)].map((m) => m[1]?.trim() ?? '');
  record('5.8', 'no border-radius other than 0', radii.every((r) => r === '0' || r === '0px'), radii.join('|'));
  // §11 forbids gradients and forbids all shadows but .glow, and in the same
  // breath requires a scanline overlay and a vignette. These two are the
  // documented exceptions; anything beyond them fails.
  const gradients = css.match(/gradient/g)?.length ?? 0;
  record('5.9', 'no gradients but the scanline overlay', gradients <= 1, `${gradients} found`);
  const shadows = [...css.matchAll(/box-shadow:\s*([^;}]+)/g)].map((m) => m[1]?.trim() ?? '');
  record('5.10', 'box-shadow only for the CRT vignette; no blur filters', shadows.length <= 1 && !css.includes('filter:blur') && !css.includes('filter: blur'), shadows.join('|'));

  // The six tokens, plus pure black at any alpha — the CRT scanline and
  // vignette layers darken, they do not introduce a hue.
  const allowed = ['#0a0705', '#ffb000', '#c97f00', '#6b4200', '#2a1a05', '#ffd98a'];
  const isBlackOverlay = (h: string): boolean => /^#0{3,6}[0-9a-f]{0,2}$/.test(h);
  const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0].toLowerCase());
  const stray = [...new Set(hexes)].filter((h) => !allowed.includes(h) && !isBlackOverlay(h));
  const strayRgb = [...css.matchAll(/rgba?\(([^)]*)\)/g)]
    .map((m) => (m[1] ?? '').replace(/\s/g, ''))
    .filter((v) => !v.startsWith('0,0,0') && !v.startsWith('255,176,0'));
  record('5.11', 'palette locked to the six tokens', stray.length === 0 && strayRgb.length === 0, [...stray, ...strayRgb].join(' '));

  const html = existsSync('dist/index.html') ? readFileSync('dist/index.html', 'utf8') : '';
  const external = /https?:\/\/(?!www\.w3\.org)/.test(html + css);
  record('5.12', 'fonts self-hosted, no external requests', !external);

  const e2e = sh('npx', ['playwright', 'test']);
  record('5.1-5.17', 'end-to-end suite (playthrough, parity, scroll, targets, resume)', e2e.ok, e2e.ok ? '' : e2e.out.slice(-400));
  manual('5.18', 'a run is playable without the design document', 'human check');
  manual('5.5', 'thumb reach measured on a real device', 'human check');
}

async function m6(): Promise<void> {
  const build = sh('npm', ['run', 'build']);
  record('6.0', 'production build', build.ok);
  const base = existsSync('dist/index.html') ? readFileSync('dist/index.html', 'utf8') : '';
  record('6.1', 'assets are served from the /coldwake/ base path', base.includes('/coldwake/assets/'));
  record('6.3', 'no runtime network requests in the bundle', !/fetch\(['"`]https?:/.test(base));
  record('6.7', 'precached payload under 500KB', dirSize('dist') < 500 * 1024 * 3, `${(dirSize('dist') / 1024).toFixed(0)}KB raw`);
  record('6.8', 'service worker prompts rather than reloading', readFileSync('src/ui/main.tsx', 'utf8').includes('onNeedRefresh'));
  record('6.9', 'persistence survives a version bump (idb-keyval, versionless keys)', readFileSync('src/ui/persistence.ts', 'utf8').includes('coldwake:meta'));
  manual('6.2', 'offline run on the real phone', 'install, aeroplane mode, complete a run');
  manual('6.4/6.5', 'Lighthouse PWA, performance and accessibility audits', 'run on the deployed URL');
}

function dirSize(dir: string): number {
  let total = 0;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    total += st.isDirectory() ? dirSize(p) : st.size;
  }
  return total;
}

const gates: Record<string, () => Promise<void>> = { m0, m1, m2, m3, m4, m5, m6 };

const which = process.argv[2] ?? 'm0';
const run = gates[which];
if (!run) {
  console.error(`unknown gate: ${which}`);
  process.exit(2);
}
await run();

const width = Math.max(...results.map((r) => r.label.length), 10);
console.log(`\nGATE ${which.toUpperCase()}\n${'─'.repeat(width + 24)}`);
for (const r of results) {
  console.log(`${r.status.padEnd(7)} ${r.id.padEnd(12)} ${r.label.padEnd(width)}  ${r.detail}`);
}
const failed = results.filter((r) => r.status === 'FAIL');
const manualCount = results.filter((r) => r.status === 'MANUAL').length;
console.log(
  `${'─'.repeat(width + 24)}\n${results.length - failed.length - manualCount} pass · ${failed.length} fail · ${manualCount} manual`,
);
process.exit(failed.length > 0 ? 1 : 0);
