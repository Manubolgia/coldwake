import { describe, expect, it } from 'vitest';
import { ROOM_ACTIONS } from '../src/game/content/actions';
import { DISCOVERIES } from '../src/game/content/discoveries';
import { EVENTS } from '../src/game/content/events';
import { INCIDENTS } from '../src/game/content/incidents';
import { ITEMS } from '../src/game/content/items';
import { ROLES } from '../src/game/content/roles';
import { ROOMS } from '../src/game/content/rooms';
import { survivorCard } from '../src/game/content/survivors';
import type { ChoiceDef } from '../src/game/content/cards';
import { newGame } from '../src/game/generate';
import type { IncidentId } from '../src/game/types';

function choiceOk(c: ChoiceDef) {
  if (c.stat) return !!c.clean && !!(c.cost ?? c.clean) && !!(c.fail ?? c.cost);
  return !!c.result;
}

describe('content', () => {
  it('every event and discovery choice resolves', () => {
    for (const d of [...EVENTS, ...DISCOVERIES]) {
      expect(new Set([...EVENTS, ...DISCOVERIES].filter((x) => x.id === d.id)).size, `duplicate ${d.id}`).toBe(1);
      for (const c of d.choices ?? []) expect(choiceOk(c), `${d.id}: ${String(c.label)}`).toBe(true);
    }
  });

  it('every incident has four logs and a creature', () => {
    for (const inc of Object.values(INCIDENTS)) {
      expect(inc.clues).toHaveLength(4);
      expect(inc.nestAction.label).toBeTruthy();
    }
  });

  it('room actions only name real rooms, and roles start with real items', () => {
    for (const a of ROOM_ACTIONS) for (const r of a.rooms) expect(ROOMS[r]).toBeDefined();
    for (const r of Object.values(ROLES)) for (const i of r.items) expect(ITEMS[i]).toBeDefined();
    for (const r of Object.values(ROOMS)) for (const i of r.loot) expect(ITEMS[i]).toBeDefined();
  });

  it('survivor cards build for every temperament and incident', () => {
    for (const incident of Object.keys(INCIDENTS) as IncidentId[]) {
      for (let i = 0; i < 20; i++) {
        const s = newGame({ seed: `sv-${incident}-${i}`, role: 'medic', difficulty: 'standard', incident });
        s.survivors.forEach((_, idx) => {
          const card = survivorCard(s, idx);
          expect(card.choices!.length).toBeGreaterThan(0);
          for (const c of card.choices!) expect(choiceOk(c)).toBe(true);
        });
      }
    }
  });
});
