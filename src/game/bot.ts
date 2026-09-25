// A competent-player stand-in. It plays through getActions() and the card
// choices exactly as the interface does, so anything it can reach, a player
// can reach. Used by the tests to prove every seed finishes and to hold the
// win rate in a band.

import { unusedDice } from './actions';
import { EXITS } from './content/exits';
import { begin, getActions, newGame, reduce } from './engine';
import { distances } from './map';
import { Rng } from './rng';
import { creaturesIn, hasItem, statParts } from './rules';
import type { Action, ActionOption, Difficulty, ExitId, GameState, RoleId } from './types';

const BAND_SCORE = { clean: 2, cost: 1, fail: -1 } as const;

function nextGoalRoom(s: GameState): { room: string | null; exit: ExitId } {
  let best: { room: string | null; exit: ExitId; cost: number } | null = null;
  const dist = distances(s, s.player.room);
  for (const exit of s.scenario.exits) {
    const steps = s.progress.steps[exit];
    const def = EXITS[exit];
    let idx = steps.findIndex((d, i) => !d && i < def.steps.length - 1);
    if (exit === 'beacon' && idx === -1 && s.progress.rescueIn && s.progress.rescueIn > 0) idx = 2;
    if (idx === -1) idx = def.steps.length - 1;
    if (exit === 'shuttle' && idx === 0 && hasItem(s, 'fuelcell')) idx = 1;
    const type = def.steps[idx]!.room;
    const rooms = Object.values(s.rooms).filter((r) => r.type === type && r.known);
    const remaining = steps.filter((x) => !x).length;
    const room = rooms.length ? rooms.sort((a, b) => (dist[a.id] ?? 99) - (dist[b.id] ?? 99))[0]!.id : null;
    const cost = remaining * 3 + (room ? (dist[room] ?? 9) : 6);
    if (!best || cost < best.cost) best = { room, exit, cost };
  }
  return { room: best!.room, exit: best!.exit };
}

function nearestUnexplored(s: GameState): string | null {
  const dist = distances(s, s.player.room);
  const cands = Object.values(s.rooms).filter((r) => !r.explored);
  if (!cands.length) return null;
  return cands.sort((a, b) => (dist[a.id] ?? 99) - (dist[b.id] ?? 99))[0]!.id;
}

function firstStep(s: GameState, to: string): string | null {
  const back = distances(s, to);
  let best: string | null = null;
  let bestD = back[s.player.room] ?? 99;
  for (const o of getActions(s)) {
    if ((o.id !== 'move' && o.id !== 'force') || !o.target) continue;
    const d = back[o.target] ?? 99;
    if (d < bestD) {
      bestD = d;
      best = o.target;
    }
  }
  return best;
}

/** The die that gives the best band for this option, spending as low a die as possible. */
function bestDie(s: GameState, o: ActionOption): { die: number; score: number } | null {
  let best: { die: number; score: number; value: number } | null = null;
  for (const d of unusedDice(s)) {
    const out = o.outcomes[d.id];
    if (!out) continue;
    const sc = BAND_SCORE[out.band];
    if (!best || sc > best.score || (sc === best.score && d.value < best.value)) best = { die: d.id, score: sc, value: d.value };
  }
  return best ? { die: best.die, score: best.score } : null;
}

export function botChoose(s: GameState, rng: Rng): Action {
  const card = s.cards[0];
  if (card) {
    if (!card.choices.length) return { type: 'continue' };
    // Recruit, or the choice with our best stat, or the first.
    let bestI = 0;
    let bestScore = -99;
    card.choices.forEach((ch, i) => {
      let sc = 0;
      if (/come with me|hold on|get them|talk them out/i.test(ch.label)) sc += 3;
      if (ch.stat) sc += statParts(s, ch.stat).total + (ch.mod ?? 0);
      else sc += 1;
      if (/leave|back away|let it go|let it come/i.test(ch.label)) sc -= 2;
      sc += rng.next() * 0.5;
      if (sc > bestScore) {
        bestScore = sc;
        bestI = i;
      }
    });
    return { type: 'choose', index: bestI };
  }

  const opts = getActions(s).filter((o) => !o.disabled);
  const take = opts.find((o) => o.id === 'take');
  if (take) return { type: 'act', id: take.id, target: take.target!, die: -1 };
  if (!unusedDice(s).length) return { type: 'endRound' };

  const act = (o: ActionOption, die: number): Action =>
    o.target !== undefined ? { type: 'act', id: o.id, target: o.target, die } : { type: 'act', id: o.id, die };
  const find = (pred: (o: ActionOption) => boolean) => opts.filter(pred);

  // Win if we can.
  for (const o of find((o) => o.group === 'goal')) {
    const bd = bestDie(s, o);
    if (bd && (o.label.startsWith('Launch') || o.label.startsWith('Fly') || o.label.startsWith('Board') || o.label.startsWith('Go back'))) {
      if (bd.score >= 1) return act(o, bd.die);
    }
  }

  const threats = creaturesIn(s, s.player.room).filter((c) => c.stunned === 0);
  if (threats.length) {
    const blow = opts.find((o) => o.id === 'blow');
    if (blow) {
      const bd = bestDie(s, blow);
      if (bd && bd.score >= 1 && s.player.hp > 2) return act(blow, bd.die);
    }
    const fights = find((o) => o.id === 'fight').map((o) => ({ o, bd: bestDie(s, o) }));
    const cleanFight = fights.find((f) => f.bd && f.bd.score === 2 && /Kill|flees/.test(f.o.outcomes[f.bd.die]!.summary));
    if (cleanFight) return act(cleanFight.o, cleanFight.bd!.die);
    const flare = opts.find((o) => o.id === 'use' && o.label.startsWith('Throw a flare'));
    if (flare) return act(flare, unusedDice(s)[0]!.id);
    const hide = opts.find((o) => o.id === 'hide');
    if (hide) {
      const bd = bestDie(s, hide);
      if (bd && bd.score === 2) return act(hide, bd.die);
    }
    const anyClean = fights.find((f) => f.bd && f.bd.score === 2);
    if (anyClean) return act(anyClean.o, anyClean.bd!.die);
    // Run toward the goal.
    const goal = nextGoalRoom(s).room ?? nearestUnexplored(s);
    const step = goal ? firstStep(s, goal) : null;
    const moves = find((o) => o.id === 'move');
    const mv = moves.find((o) => o.target === step) ?? moves[0];
    if (mv) {
      const bd = bestDie(s, mv)!;
      return act(mv, bd.die);
    }
    const f = fights[0];
    if (f?.bd) return act(f.o, f.bd.die);
  }

  // Patch up.
  if (s.player.hp <= 2) {
    const med = opts.find((o) => o.id === 'use' && o.label.includes('medkit'));
    if (med) return act(med, unusedDice(s)[0]!.id);
    const treat = opts.find((o) => o.id === 'treat');
    if (treat) return act(treat, bestDie(s, treat)!.die);
  }
  if (s.player.stress >= s.player.maxStress - 2) {
    const calm = opts.find((o) => o.id === 'use' && o.label.includes('sedatives'));
    if (calm) return act(calm, unusedDice(s)[0]!.id);
  }
  const purge = opts.find((o) => o.id === 'purge');
  if (purge) return act(purge, bestDie(s, purge)!.die);
  const scan = opts.find((o) => o.id === 'scan');
  if (scan && s.companion && !s.progress.flags.includes('bot-scanned')) {
    s.progress.flags.push('bot-scanned');
    return act(scan, unusedDice(s)[0]!.id);
  }

  // Objective steps, codes, personal.
  for (const o of find((o) => o.group === 'goal' || o.id === 'bridge-codes' || o.id === 'safe' || o.id === 'stabilise' || o.id === 'plans')) {
    const bd = bestDie(s, o);
    if (bd && bd.score >= 1) return act(o, bd.die);
  }

  // Go where the plan says.
  const goal = nextGoalRoom(s);
  const dest = goal.room && goal.room !== s.player.room ? goal.room : nearestUnexplored(s);
  const searchOpt = opts.find((o) => o.id === 'search');
  if (searchOpt && (s.rooms[s.player.room]!.type === 'cargo' || rng.chance(0.35))) {
    const bd = bestDie(s, searchOpt);
    if (bd && bd.score >= 1) return act(searchOpt, bd.die);
  }
  if (dest) {
    const step = firstStep(s, dest);
    const o = opts.find((x) => (x.id === 'move' || x.id === 'force') && x.target === step);
    if (o) {
      const bd = bestDie(s, o)!;
      return act(o, bd.die);
    }
  }
  const other = opts.find((o) => o.group === 'room' && o.id !== 'hide' && o.id !== 'search' && (bestDie(s, o)?.score ?? -1) >= 1);
  if (other) return act(other, bestDie(s, other)!.die);
  if (searchOpt) return act(searchOpt, bestDie(s, searchOpt)!.die);
  return { type: 'endRound' };
}

export interface SimResult {
  seed: string;
  status: GameState['status'];
  ending: string;
  rounds: number;
  steps: number;
  truth: boolean;
  kills: number;
  companion: boolean;
}

export function playOut(seed: string, role: RoleId, difficulty: Difficulty, maxSteps = 3000): { state: GameState; result: SimResult } {
  let s = begin(newGame({ seed, role, difficulty }));
  const rng = new Rng(12345);
  let steps = 0;
  while (s.status === 'playing' && steps < maxSteps) {
    const a = botChoose(s, rng);
    const next = reduce(s, a);
    if (next === s) {
      // Illegal or no-op: end the round to guarantee progress.
      const forced = reduce(s, s.cards.length ? (s.cards[0]!.choices.length ? { type: 'choose', index: 0 } : { type: 'continue' }) : { type: 'endRound' });
      if (forced === s) throw new Error(`stuck at seed ${seed} step ${steps}: ${JSON.stringify(a)}`);
      s = forced;
    } else {
      s = next;
    }
    steps++;
  }
  return {
    state: s,
    result: {
      seed,
      status: s.status,
      ending: s.ending?.title ?? 'unfinished',
      rounds: s.round,
      steps,
      truth: s.progress.truth,
      kills: s.progress.kills,
      companion: s.companion !== null,
    },
  };
}
