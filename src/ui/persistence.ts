import { del, get, set } from 'idb-keyval';
import type { Depth, Ending, GameState, RoleId } from '../engine/types';

const RUN_KEY = 'coldwake:run';
const META_KEY = 'coldwake:meta';
const TELEMETRY_KEY = 'coldwake:telemetry';

export type Meta = {
  runs: number;
  roles: RoleId[];
  depths: Depth[];
  endings: Record<string, number>;
  best: Record<string, number>;
  daily: Record<string, { score: number; ending: Ending }>;
  crt: boolean;
  guidance: boolean;
  reducedMotion: boolean;
  bootSeen: boolean;
};

export type RunTelemetry = {
  seed: string;
  role: RoleId;
  depth: Depth;
  started: number;
  finished?: number;
  turnMs: number[];
  actions: Record<string, number>;
  ending?: Ending;
  score?: number;
  abandonedAtTurn?: number;
  survey?: { tension: number; pointlessTurn: boolean; understoodLoss: boolean; note: string };
};

export const DEFAULT_META: Meta = {
  runs: 0,
  roles: ['engineer', 'security'],
  depths: [1],
  endings: {},
  best: {},
  daily: {},
  crt: true,
  guidance: true,
  reducedMotion: false,
  bootSeen: false,
};

export async function loadMeta(): Promise<Meta> {
  const stored = (await get<Meta>(META_KEY)) ?? null;
  return stored ? { ...DEFAULT_META, ...stored } : DEFAULT_META;
}

export async function saveMeta(meta: Meta): Promise<void> {
  await set(META_KEY, meta);
}

export async function loadRun(): Promise<GameState | null> {
  return (await get<GameState>(RUN_KEY)) ?? null;
}

export async function saveRun(state: GameState | null): Promise<void> {
  if (state === null) await del(RUN_KEY);
  else await set(RUN_KEY, state);
}

export async function loadTelemetry(): Promise<RunTelemetry[]> {
  return (await get<RunTelemetry[]>(TELEMETRY_KEY)) ?? [];
}

export async function pushTelemetry(run: RunTelemetry): Promise<void> {
  const all = await loadTelemetry();
  all.push(run);
  // Keep the file small enough to paste back into a conversation.
  await set(TELEMETRY_KEY, all.slice(-200));
}

export async function updateLastTelemetry(patch: Partial<RunTelemetry>): Promise<void> {
  const all = await loadTelemetry();
  const last = all[all.length - 1];
  if (!last) return;
  all[all.length - 1] = { ...last, ...patch };
  await set(TELEMETRY_KEY, all);
}

/** §4.14 unlocks: access to new problems, never power creep. */
export function applyUnlocks(meta: Meta, ending: Ending, depth: Depth, score: number, role: RoleId): Meta {
  const next: Meta = {
    ...meta,
    runs: meta.runs + 1,
    endings: { ...meta.endings, [ending]: (meta.endings[ending] ?? 0) + 1 },
    best: { ...meta.best },
    roles: [...meta.roles],
    depths: [...meta.depths],
  };
  const key = `${role}:${depth}`;
  next.best[key] = Math.max(next.best[key] ?? 0, score);
  const won = (['escaped', 'overload', 'relay', 'specimen', 'carrier'] as Ending[]).includes(ending);
  if (won && !next.roles.includes('medic')) next.roles.push('medic');
  if (ending === 'escaped' && !next.roles.includes('pilot')) next.roles.push('pilot');
  if (won) {
    const nextDepth = (depth + 1) as Depth;
    if (nextDepth <= 5 && !next.depths.includes(nextDepth)) next.depths.push(nextDepth);
  }
  if (next.depths.includes(3) && !next.roles.includes('surveyor')) next.roles.push('surveyor');
  next.depths.sort((a, b) => a - b);
  return next;
}

export function dailySeed(date = new Date()): string {
  return `daily-${date.toISOString().slice(0, 10)}`;
}
