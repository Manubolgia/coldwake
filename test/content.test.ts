import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ADJACENCY,
  BAG_THREATS,
  CARDS,
  DEPTHS,
  INFECTION_CARDS,
  MAP,
  NODE_IDS,
  OBJECTIVES,
  ROLES,
  RULES,
  SALVAGE,
  THREATS,
  THREAT_TYPES,
  roleDeck,
  threatDef,
} from '../src/engine';

const effect: z.ZodType = z.lazy(() =>
  z.object({ op: z.string() }).catchall(z.union([z.number(), z.string(), z.boolean(), z.array(effect)])),
);

const cardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  copies: z.number().int().min(0),
  ap: z.number().int().min(0).max(3),
  noise: z.number().int().min(0).max(6),
  burn: z.boolean(),
  weapon: z.boolean().optional(),
  bonus: z.number().int().optional(),
  keep: z.boolean().optional(),
  text: z.string().min(10),
  requires: z.record(z.string(), z.unknown()).optional(),
  effect,
});

describe('content integrity', () => {
  it('validates every card against the schema', () => {
    for (const c of CARDS) expect(() => cardSchema.parse(c)).not.toThrow();
  });

  it('gives every playable role a sixteen-card deck', () => {
    for (const r of ROLES) expect(roleDeck(r.id).length).toBe(16);
  });

  it('gives every card a unique id', () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a symmetric, fully connected adjacency list', () => {
    for (const [a, list] of Object.entries(ADJACENCY)) {
      for (const b of list) expect(ADJACENCY[b]).toContain(a);
    }
    const seen = new Set<string>([MAP.start]);
    const queue = [MAP.start];
    while (queue.length > 0) {
      for (const n of ADJACENCY[queue.shift() as string] ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(NODE_IDS.length);
  });

  it('deals salvage to every compartment', () => {
    expect(SALVAGE.deck.length).toBeGreaterThanOrEqual(NODE_IDS.length * SALVAGE.perNode);
    for (const s of SALVAGE.deck) expect(CARDS.some((c) => c.id === s.card)).toBe(true);
  });

  it('keeps every depth inside sane bounds and monotonically harder', () => {
    let previous = DEPTHS[0]!;
    for (const d of DEPTHS) {
      expect(d.turnLimit).toBeGreaterThan(8);
      expect(d.boardCap).toBeGreaterThan(0);
      expect(d.hiveWake).toBeGreaterThan(0);
      expect(d.relayHold).toBeGreaterThan(0);
      expect(d.fuseTurns).toBeGreaterThan(0);
      expect(d.infectionThreshold).toBeGreaterThan(1);
      if (d.depth > 1) {
        expect(d.turnLimit).toBeLessThanOrEqual(previous.turnLimit);
        expect(d.hiveWake).toBeLessThanOrEqual(previous.hiveWake);
        expect(d.boardCap).toBeGreaterThanOrEqual(previous.boardCap);
        expect(d.infectionThreshold).toBeLessThanOrEqual(previous.infectionThreshold);
      }
      previous = d;
    }
  });

  it('names four creatures, and only three of them come out of the bag', () => {
    expect(THREAT_TYPES.length).toBe(4);
    expect(BAG_THREATS).not.toContain('mother');
    expect(threatDef('mother').unkillable).toBe(true);
    for (const t of BAG_THREATS) expect(threatDef(t).unkillable).toBeUndefined();
  });

  it('gives every creature a distinct single-letter mark that is its own initial', () => {
    const marks = THREAT_TYPES.map((t) => threatDef(t).mark);
    expect(new Set(marks).size).toBe(marks.length);
    for (const t of THREAT_TYPES) {
      const d = threatDef(t);
      expect(d.mark).toBe(d.name[0]);
      expect(d.mark.length).toBe(1);
    }
  });

  it('gives every creature a hearing ceiling and something to say about it', () => {
    for (const t of THREAT_TYPES) {
      const d = threatDef(t);
      expect(d.hearing).toBeGreaterThan(0);
      expect(d.text.length).toBeGreaterThan(40);
    }
  });

  it('names an objective, an ending and a tracker for all four routes', () => {
    for (const o of OBJECTIVES) {
      const def = RULES.objectives[o];
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.line.length).toBeGreaterThan(10);
      expect(def.how.length).toBeGreaterThan(20);
      expect(def.track.length).toBeGreaterThan(0);
      expect(RULES.endings[def.ending]).toBeDefined();
      expect(RULES.endings[def.ending]?.objective).toBe(o);
    }
  });

  it('says what every ending is and how it is reached', () => {
    for (const [id, e] of Object.entries(RULES.endings)) {
      expect(e.verdict.length, id).toBeGreaterThan(20);
      expect(e.how.length, id).toBeGreaterThan(20);
    }
  });

  it('gives every compartment a distinct three-letter short name', () => {
    const shorts = MAP.nodes.map((n) => n.short);
    expect(new Set(shorts).size).toBe(shorts.length);
    for (const s of shorts) expect(s.length).toBe(3);
  });

  it('ships every infection card with a cost you can feel while you hold it', () => {
    expect(INFECTION_CARDS.length).toBeGreaterThanOrEqual(4);
    for (const id of INFECTION_CARDS) {
      const c = CARDS.find((x) => x.id === id)!;
      expect(c.copies).toBe(0);
      expect(c.effect.op).toBe('none');
      expect(c.text.toLowerCase()).toMatch(/while it is in your hand|the moment it comes to hand/);
    }
  });

  it('keeps the bag and the reserve non-negative and worth drawing from', () => {
    for (const t of Object.values(THREATS.bag)) expect(t).toBeGreaterThanOrEqual(0);
    for (const t of Object.values(THREATS.reserve)) expect(t).toBeGreaterThanOrEqual(0);
    expect(THREATS.bag.blank).toBeGreaterThan(0);
  });
});
