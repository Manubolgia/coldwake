import type { GameState, RoleId } from '../game/types';
import { VERSION } from '../game/generate';

const SAVE_KEY = 'coldwake.save.v3';
const PROFILE_KEY = 'coldwake.profile.v3';

export interface RunRecord {
  date: string;
  name: string;
  role: RoleId;
  ship: string;
  incident: string;
  title: string;
  won: boolean;
  score: number;
  rounds: number;
  difficulty: string;
}

export interface Settings {
  sound: boolean;
  volume: number;
  textSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  /** How fast the narrator writes. */
  textSpeed: TextSpeed;
}

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export interface Profile {
  unlocks: string[];
  history: RunRecord[];
  tipsDone: boolean;
  settings: Settings;
  lastRole: RoleId;
  lastDifficulty: 'story' | 'standard' | 'nightmare';
}

const DEFAULT_PROFILE: Profile = {
  unlocks: [],
  history: [],
  tipsDone: false,
  settings: { sound: true, volume: 0.7, textSize: 'medium', reducedMotion: false, textSpeed: 'normal' },
  lastRole: 'engineer',
  lastDifficulty: 'standard',
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the game still runs, it just won't remember */
  }
}

export function loadGame(): GameState | null {
  const s = read<GameState>(SAVE_KEY);
  if (!s || s.version !== VERSION || s.status !== 'playing') return null;
  return s;
}

export function saveGame(s: GameState | null): void {
  if (!s || s.status !== 'playing') {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  write(SAVE_KEY, s);
}

export function loadProfile(): Profile {
  const p = read<Partial<Profile>>(PROFILE_KEY);
  return {
    ...DEFAULT_PROFILE,
    ...p,
    settings: { ...DEFAULT_PROFILE.settings, ...(p?.settings ?? {}) },
  };
}

export function saveProfile(p: Profile): void {
  write(PROFILE_KEY, p);
}

/** Record a finished run and work out what it unlocked. */
export function recordRun(p: Profile, s: GameState): { profile: Profile; newUnlocks: string[] } {
  const e = s.ending;
  if (!e) return { profile: p, newUnlocks: [] };
  const rec: RunRecord = {
    date: new Date().toISOString(),
    name: s.player.name,
    role: s.player.role,
    ship: s.scenario.shipName,
    incident: s.scenario.incident,
    title: e.title,
    won: e.won,
    score: e.score,
    rounds: s.round,
    difficulty: s.difficulty,
  };
  const unlocks = new Set(p.unlocks);
  const before = new Set(p.unlocks);
  if (e.won) unlocks.add('escaped');
  if (s.progress.truth) unlocks.add('truth');
  const newUnlocks = [...unlocks].filter((u) => !before.has(u));
  return {
    profile: { ...p, unlocks: [...unlocks], history: [rec, ...p.history].slice(0, 60) },
    newUnlocks,
  };
}
