import { memo } from 'react';
import { ROOMS } from '../../game/content/rooms';
import type { CreatureKind, Hazard, RoomType } from '../../game/types';
import { roomArt, type RoomArt } from './rooms';
import { Frame } from './scene';
import { creatureScene, dressRoom, vignette } from './vignettes';

// Every illustration in the game, drawn in code: rooms are small lit 3D scenes,
// creatures are painted silhouettes placed into them, and the rest are
// vignettes built from the same pieces. Nothing is loaded from disk.

const CREATURE_KINDS: CreatureKind[] = ['stalker', 'crawler', 'changed', 'drone', 'mimic'];

function build(art: string, hazards: Hazard[], creatures: CreatureKind[]): { r: RoomArt; label: string } {
  if (art in ROOMS) {
    const t = art as RoomType;
    const r = roomArt(t, ROOMS[t].accent);
    return { r: hazards.length || creatures.length ? dressRoom(r, hazards, creatures) : r, label: ROOMS[t].name };
  }
  if ((CREATURE_KINDS as string[]).includes(art)) return { r: creatureScene(art as CreatureKind), label: art };
  const v = vignette(art) ?? vignette('room')!;
  return { r: v, label: art };
}

export const Art = memo(
  function Art({ art, className, hazards = [], creatures = [] }: { art: string; className?: string; hazards?: Hazard[]; creatures?: CreatureKind[] }) {
    const { r, label } = build(art, hazards, creatures);
    return <Frame className={className} label={label} look={r.look} built={r.built} under={r.under} over={r.over} />;
  },
  (a, b) => a.art === b.art && a.className === b.className && (a.hazards ?? []).join() === (b.hazards ?? []).join() && (a.creatures ?? []).join() === (b.creatures ?? []).join(),
);
