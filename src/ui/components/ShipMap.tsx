import { useMemo } from 'react';
import { hearingRadius, planCreature, visibleCreatures } from '../../game/actions';
import { EXITS, PERSONALS } from '../../game/content/exits';
import { ROOMS } from '../../game/content/rooms';
import { distances, neighbours } from '../../game/map';
import { roomShort } from '../../game/rules';
import type { GameState } from '../../game/types';
import { GRID_H, GRID_W } from '../../game/generate';

const CW = 84;
const CH = 58;
const RW = 70;
const RH = 42;

function labelSize(label: string): number {
  return Math.min(12.5, (RW - 8) / (label.length * 0.56));
}

function centre(x: number, y: number): [number, number] {
  return [x * CW + CW / 2, y * CH + CH / 2];
}

/** Rooms that matter for what you're trying to do next. */
export function goalRooms(s: GameState): { goals: Set<string>; secret: Set<string> } {
  const goals = new Set<string>();
  const secret = new Set<string>();
  for (const exit of s.scenario.exits) {
    const steps = s.progress.steps[exit];
    EXITS[exit].steps.forEach((st, i) => {
      if (steps[i]) return;
      for (const r of Object.values(s.rooms)) if (r.type === st.room && r.known) goals.add(r.id);
    });
  }
  const p = PERSONALS[s.scenario.personal];
  if (p.room && !s.progress.personalDone) {
    for (const r of Object.values(s.rooms)) if (r.type === p.room && r.known) secret.add(r.id);
  }
  return { goals, secret };
}

export function ShipMap({ s, onRoom, highlight, mini = false }: { s: GameState; onRoom?: (id: string) => void; highlight?: string | null; mini?: boolean }) {
  const me = s.player.room;
  const adj = useMemo(() => new Set(neighbours(s, me)), [s, me]);
  const dist = useMemo(() => distances(s, me), [s, me]);
  const radius = hearingRadius(s);
  const visible = visibleCreatures(s);
  const { goals, secret } = goalRooms(s);
  const byRoom: Record<string, typeof visible> = {};
  for (const c of visible) (byRoom[c.room] ??= []).push(c);

  return (
    <svg className={`shipmap ${mini ? 'mini' : ''}`} viewBox={`0 0 ${GRID_W * CW} ${GRID_H * CH}`} role="img" aria-label="Ship map">
      <defs>
        <marker id={mini ? 'arrow-mini' : 'arrow'} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--red)" />
        </marker>
        <filter id={mini ? 'mapglow-mini' : 'mapglow'} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* corridors */}
      <g className="corridors">
        {s.edges.map(([a, b]) => {
          const ra = s.rooms[a]!;
          const rb = s.rooms[b]!;
          const [x1, y1] = centre(ra.x, ra.y);
          const [x2, y2] = centre(rb.x, rb.y);
          const lit = a === me || b === me;
          return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} className={lit ? 'lit' : ''} />;
        })}
      </g>

      {/* rooms */}
      {Object.values(s.rooms).map((r) => {
        const [cx, cy] = centre(r.x, r.y);
        const x = cx - RW / 2;
        const y = cy - RH / 2;
        const isMe = r.id === me;
        const heard = !isMe && radius > 0 && (dist[r.id] ?? 99) <= radius;
        const cls = ['room', r.explored ? 'explored' : r.known ? 'known' : 'unknown', isMe ? 'me' : '', adj.has(r.id) ? 'adj' : '', heard ? 'heard' : '', highlight === r.id ? 'hl' : '']
          .filter(Boolean)
          .join(' ');
        const accent = r.known ? ROOMS[r.type].accent : 'var(--line2)';
        return (
          <g
            key={r.id}
            className={cls}
            onClick={onRoom ? () => onRoom(r.id) : undefined}
            style={{ ['--accent' as string]: accent }}
            role={onRoom && adj.has(r.id) ? 'button' : undefined}
            aria-label={r.known ? roomShort(s, r.id) : 'Unexplored room'}
          >
            {isMe && <rect x={x - 3} y={y - 3} width={RW + 6} height={RH + 6} rx={9} className="me-glow" filter={`url(#${mini ? 'mapglow-mini' : 'mapglow'})`} />}
            <rect x={x} y={y} width={RW} height={RH} rx={7} className="room-box" />
            {heard && <rect x={x} y={y} width={RW} height={RH} rx={7} className="heard-box" />}
            <text
              x={cx}
              y={cy + (r.known ? 1 : 4)}
              className="room-label"
              textAnchor="middle"
              dominantBaseline="middle"
              style={r.known ? { fontSize: labelSize(roomShort(s, r.id)) } : undefined}
            >
              {r.known ? roomShort(s, r.id) : '?'}
            </text>
            {r.hazards.length > 0 && (
              <g className="hazards">
                {r.hazards.map((h, i) => (
                  <circle key={h} cx={x + RW - 7 - i * 9} cy={y + 7} r={3.4} className={`hz hz-${h}`} />
                ))}
              </g>
            )}
            {goals.has(r.id) && <path d={`M${x + 7} ${y + 3} l4 4 -4 4 -4 -4 z`} className="goal-mark" />}
            {secret.has(r.id) && <path d={`M${x + (goals.has(r.id) ? 17 : 7)} ${y + 3} l4 4 -4 4 -4 -4 z`} className="secret-mark" />}
            {r.floor.length > 0 && <circle cx={x + 7} cy={y + RH - 7} r={2.6} className="floor-mark" />}
            {isMe && (
              <g className="player">
                <circle cx={cx} cy={cy + 13} r={4.2} className="player-dot" />
                <circle cx={cx} cy={cy + 13} r={4.2} className="player-ping" />
              </g>
            )}
          </g>
        );
      })}

      {/* creatures and where they're going */}
      {visible.map((c) => {
        const r = s.rooms[c.room]!;
        const list = byRoom[c.room]!;
        const i = list.indexOf(c);
        const [cx, cy] = centre(r.x, r.y);
        const px = cx + (i - (list.length - 1) / 2) * 12 + (c.room === me ? 18 : 0);
        const py = cy - 12;
        const plan = planCreature(s, c);
        let arrow = null;
        if (plan.to && plan.to !== c.room) {
          const t = s.rooms[plan.to]!;
          const [tx, ty] = centre(t.x, t.y);
          const dx = tx - px;
          const dy = ty - py;
          const len = Math.hypot(dx, dy) || 1;
          arrow = <line x1={px + (dx / len) * 7} y1={py + (dy / len) * 7} x2={tx - (dx / len) * 18} y2={ty - (dy / len) * 14} className="intent" markerEnd={`url(#${mini ? 'arrow-mini' : 'arrow'})`} />;
        }
        return (
          <g key={c.id} className={`creature ${plan.kind}`}>
            {arrow}
            <circle cx={px} cy={py} r={9} className="creature-halo" />
            <circle cx={px} cy={py} r={5.2} className="creature-dot" />
          </g>
        );
      })}
    </svg>
  );
}
