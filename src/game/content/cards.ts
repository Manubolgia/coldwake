import type { Effect, GameState, IncidentId, ItemId, RoomType, Stat } from '../types';
import type { Text } from './ctx';

export type Tone = 'calm' | 'tense' | 'danger' | 'good' | 'strange';

export interface Res {
  text: Text;
  effect?: Effect;
}

export interface ChoiceDef {
  label: Text;
  hint?: string;
  when?: (s: GameState) => boolean;
  stat?: Stat;
  mod?: number;
  clean?: Res;
  cost?: Res;
  fail?: Res;
  result?: Res;
}

export interface CardDef {
  id: string;
  title: Text;
  art: string;
  tone: Tone;
  text: Text;
  effect?: Effect;
  choices?: ChoiceDef[];
  when?: (s: GameState) => boolean;
  weight?: number;
}

export type EventCategory = 'calm' | 'threat' | 'hazard' | 'story' | 'mind';

export interface EventDef extends CardDef {
  category: EventCategory;
  /** Earliest act, 1–3. */
  act?: number;
  repeatable?: boolean;
  incidents?: IncidentId[];
}

export interface DiscoveryDef extends CardDef {
  rooms?: RoomType[];
  act?: number;
}

// Small predicates for `when`.
export const has = (id: ItemId) => (s: GameState) => s.player.items.some((i) => i.id === id);
export const withMate = (s: GameState) => s.companion !== null;
export const noMate = (s: GameState) => s.companion === null;
