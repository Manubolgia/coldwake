import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ADJACENCY,
  CARDS,
  DEPTHS,
  MAP,
  NODE_IDS,
  ROLES,
  RULES,
  SALVAGE,
  THREATS,
  roleDeck,
} from '../src/engine/content';
import type { RoleId } from '../src/engine/types';

const effectSchema: z.ZodType = z.lazy(() =>
  z.object({ op: z.string() }).catchall(z.unknown()).refine((e) => {
    if (e.op !== 'sequence') return true;
    return Array.isArray((e as { steps?: unknown[] }).steps);
  }, 'sequence needs steps'),
);

const cardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['engineer', 'security', 'medic', 'surveyor', 'pilot', 'universal', 'panic', 'salvage']),
  copies: z.number().int().min(0).max(4),
  ap: z.number().int().min(0).max(3),
  noise: z.number().int().min(0).max(4),
  burn: z.boolean(),
  weapon: z.boolean().optional(),
  bonus: z.number().int().min(0).max(4).optional(),
  text: z.string().min(1),
  requires: z.record(z.string(), z.unknown()).optional(),
  effect: effectSchema,
});

describe('content (gate 0.7)', () => {
  it('validates every card against the schema', () => {
    for (const c of CARDS) expect(() => cardSchema.parse(c)).not.toThrow();
  });

  it('gives every playable role a twelve-card deck', () => {
    for (const role of ROLES) {
      expect(roleDeck(role.id as RoleId)).toHaveLength(12);
    }
  });

  it('has a symmetric, fully connected adjacency list', () => {
    for (const id of NODE_IDS) {
      for (const other of ADJACENCY[id] ?? []) {
        expect(ADJACENCY[other]).toContain(id);
      }
    }
    const seen = new Set<string>([NODE_IDS[0] as string]);
    const queue = [NODE_IDS[0] as string];
    while (queue.length > 0) {
      const cur = queue.shift() as string;
      for (const n of ADJACENCY[cur] ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(NODE_IDS.length);
  });

  it('deals exactly two salvage cards to every node', () => {
    expect(SALVAGE.deck.length).toBe(NODE_IDS.length * SALVAGE.perNode);
    for (const s of SALVAGE.deck) {
      expect(CARDS.some((c) => c.id === s.card)).toBe(true);
    }
  });

  it('keeps every depth inside sane bounds', () => {
    expect(DEPTHS).toHaveLength(5);
    for (const d of DEPTHS) {
      expect(d.turnLimit).toBeGreaterThan(10);
      expect(d.shuttleRequired).toBeGreaterThan(0);
      expect(d.carry.clean + d.carry.infested).toBe(12);
      expect(d.reactorOutputStart).toBeLessThanOrEqual(RULES.reactorOutputMax);
    }
  });

  it('names four threats and starts the bag with eleven tokens', () => {
    expect(THREATS.types).toHaveLength(4);
    const bag = Object.values(THREATS.bag).reduce((a, b) => a + b, 0);
    expect(bag).toBe(11);
    expect(MAP.nodes).toHaveLength(11);
  });

  it('gives every threat a distinct single-letter mark', () => {
    // The schematic has room for one character. CONTACT and CHORUS both began
    // with C for four releases and the map could not tell them apart.
    const marks = THREATS.types.map((t) => t.mark);
    for (const m of marks) expect(m).toMatch(/^[A-Z]$/);
    expect(new Set(marks).size).toBe(marks.length);
  });

  it('gives every compartment a distinct three-letter short name', () => {
    const shorts = MAP.nodes.map((n) => n.short);
    for (const s of shorts) expect(s).toMatch(/^[A-Z]{3}$/);
    expect(new Set(shorts).size).toBe(shorts.length);
  });
});
