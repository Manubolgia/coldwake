import type { EventCategory, EventDef } from './content/cards';
import { EVENTS } from './content/events';
import { distances } from './map';
import type { Rng } from './rng';
import { act } from './rules';
import type { GameState } from './types';

/**
 * Tension, 0–10: how hard the run is pressing on the player right now.
 * The director reads it to pick a breather or an escalation.
 */
export function tension(s: GameState): number {
  let t = 0;
  const recent = s.progress.hurtRecently.filter((r) => r >= s.round - 2).length;
  t += recent * 2;
  const dist = distances(s, s.player.room);
  for (const c of s.creatures) {
    const d = dist[c.room] ?? 99;
    if (d === 0) t += 3;
    else if (d === 1) t += 2;
    else if (d === 2) t += 1;
  }
  if (s.player.hp <= 2) t += 2;
  if (s.player.stress >= s.player.maxStress - 2) t += 1;
  return Math.min(10, t);
}

export function pickEvent(s: GameState, rng: Rng): EventDef | null {
  const a = act(s);
  const t = tension(s);
  const lull = s.progress.roundsSinceScare;
  // Opening rounds are for finding your feet.
  if (s.round < 2) return null;

  const weights: Record<EventCategory, number> = {
    calm: 1.5 + (t >= 5 ? 4 : t >= 3 ? 1.5 : 0),
    threat: t >= 6 ? 0 : 0.6 + lull * 0.5 + (a - 1) * 0.6,
    hazard: 0.7 + (a - 1) * 0.4,
    story: 1.6,
    mind: 0.6 + (s.player.stress >= 3 ? 0.8 : 0),
  };
  // A quiet round now and then, with nothing drawn at all.
  if (rng.chance(t >= 5 ? 0.35 : 0.2)) return null;

  const eligible = (cat: EventCategory) =>
    EVENTS.filter(
      (e) =>
        e.category === cat &&
        (e.act ?? 1) <= a &&
        (!e.incidents || e.incidents.includes(s.scenario.incident)) &&
        (e.repeatable || !s.usedEvents.includes(e.id)) &&
        (!e.when || e.when(s)) &&
        // Don't repeat the last few, even the repeatable ones.
        !s.usedEvents.slice(-4).includes(e.id),
    );

  const cats = (Object.keys(weights) as EventCategory[]).filter((c) => eligible(c).length > 0);
  if (!cats.length) return null;
  const cat = rng.weighted(cats.map((c) => ({ item: c, weight: weights[c] })));
  const pool = eligible(cat);
  // Incident-specific cards are rarer and more flavourful: favour them.
  const ev = rng.weighted(pool.map((e) => ({ item: e, weight: e.incidents ? 2.5 : e.repeatable ? 1 : 1.6 })));
  return ev;
}
