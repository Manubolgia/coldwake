import { MAP, RULES, THREAT_TYPES, forecast, perceivedIds, threatDef } from '../../engine';
import type { ForecastEntry, GameState, Location, NodeId } from '../../engine/types';

const COLS = 5;
const ROWS = 3;
const W = 100;
const H = 62;
const CELL_W = W / COLS;
const CELL_H = H / ROWS;

function centre(x: number, y: number): [number, number] {
  return [x * CELL_W + CELL_W / 2, y * CELL_H + CELL_H / 2 - 2];
}

const BOX_W = 16;
const BOX_H = 10;

type Mark = { mark: string; live: boolean; stale: number };

export function ShipGraph({
  state,
  selected,
  onSelect,
}: {
  state: GameState;
  selected: NodeId | null;
  onSelect: (id: NodeId) => void;
}): React.ReactElement {
  const sealed = new Set(
    state.ship.sealedEdges
      .filter((e) => e.expiresTurn > state.turn)
      .map((e) => [e.edge[0], e.edge[1]].sort().join('|')),
  );

  // What the player can make out right now, and what they merely remember.
  // The old schematic printed every threat's true position every hour, which
  // is why nothing about the ship was ever frightening — §3.5.
  const seen = perceivedIds(state);
  const marksBy = new Map<string, Mark[]>();
  let ventCount = 0;
  for (const t of state.threats) {
    const def = threatDef(t.type);
    const live = seen.has(t.id);
    const at: Location | null = live ? t.node : t.seenNode;
    if (at === null) continue;
    if (at === 'vents') {
      if (live) ventCount += 1;
      continue;
    }
    const list = marksBy.get(at) ?? [];
    list.push({ mark: def.mark, live, stale: live ? 0 : state.turn - t.seenTurn });
    marksBy.set(at, list);
  }

  // What those contacts will do if the hour ends now. Only what can be seen:
  // a forecast for something the player cannot perceive would be hindsight.
  const fc = forecast(state);
  const moves = new Map<string, ForecastEntry>();
  for (const m of fc.moves) {
    if (!m.perceived || m.from === m.to) continue;
    moves.set(m.id, m);
  }
  const arrows: { from: NodeId; to: NodeId; hits: boolean }[] = [];
  for (const m of moves.values()) {
    if (m.from === 'vents' || m.to === 'vents') continue;
    arrows.push({ from: m.from, to: m.to, hits: m.reaches });
  }

  return (
    <div className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ship schematic">
        {MAP.edges.map(([a, b]) => {
          const na = MAP.nodes.find((n) => n.id === a);
          const nb = MAP.nodes.find((n) => n.id === b);
          if (!na || !nb) return null;
          const [x1, y1] = centre(na.x, na.y);
          const [x2, y2] = centre(nb.x, nb.y);
          const isSealed = sealed.has([a, b].sort().join('|'));
          return (
            <line
              key={`${a}-${b}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={`edge${isSealed ? ' sealed' : ''}`}
            />
          );
        })}

        {/* Where each visible contact goes if you end the hour as it stands. */}
        {arrows.map((a, i) => {
          const na = MAP.nodes.find((n) => n.id === a.from);
          const nb = MAP.nodes.find((n) => n.id === a.to);
          if (!na || !nb) return null;
          const [x1, y1] = centre(na.x, na.y);
          const [x2, y2] = centre(nb.x, nb.y);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          return (
            <g key={`fc-${i}`} className={a.hits ? 'forecast hits' : 'forecast'}>
              <line x1={x1 + ux * 6} y1={y1 + uy * 4} x2={x2 - ux * 7} y2={y2 - uy * 5} />
              <polygon
                points={`${x2 - ux * 7},${y2 - uy * 5} ${x2 - ux * 9 - uy * 1.4},${y2 - uy * 7 + ux * 1.4} ${x2 - ux * 9 + uy * 1.4},${y2 - uy * 7 - ux * 1.4}`}
              />
            </g>
          );
        })}

        {MAP.nodes.map((n) => {
          const [cx, cy] = centre(n.x, n.y);
          const here = state.player.node === n.id;
          const noise = state.ship.noise[n.id] ?? 0;
          const marks = marksBy.get(n.id) ?? [];
          const live = marks.filter((m) => m.live).length;
          const incoming = [...moves.values()].some((m) => m.to === n.id);
          return (
            <g
              key={n.id}
              onClick={() => onSelect(n.id)}
              role="button"
              tabIndex={0}
              aria-label={
                `${n.name}, noise ${noise} of ${RULES.noiseMax}` +
                (live > 0 ? `, ${live} in sight` : '') +
                (marks.length > live ? `, ${marks.length - live} last seen here` : '') +
                (incoming ? ', something moving in' : '')
              }
              data-node={n.id}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={cx - BOX_W / 2}
                y={cy - BOX_H / 2}
                width={BOX_W}
                height={BOX_H}
                className={`node-box${here ? ' here' : ''}${selected === n.id ? ' selected' : ''}`}
              />
              <text x={cx} y={cy - 1.2} textAnchor="middle" className={`node-label${here ? ' here' : ''}`}>
                {n.short}
              </text>
              <rect
                x={cx - BOX_W / 2 + 1.2}
                y={cy + BOX_H / 2 - 2.6}
                width={(BOX_W - 6) * Math.min(noise / RULES.noiseMax, 1)}
                height={1.4}
                className={noise >= RULES.noiseThreshold ? 'threat-block hunting' : 'threat-block'}
              />
              <text
                x={cx + BOX_W / 2 - 1.2}
                y={cy + BOX_H / 2 - 1.4}
                textAnchor="end"
                className={`node-noise${noise >= RULES.noiseThreshold ? ' hot' : ''}`}
              >
                {noise}
              </text>
              {/* A solid mark is something you can make out. A hollow one is
                  where you last saw it, with how many hours ago that was. */}
              {marks.slice(0, 3).map((m, i) => (
                <g key={i} className={m.live ? '' : 'stale'}>
                  <rect
                    x={cx + BOX_W / 2 - 3.6 - i * 3.4}
                    y={cy + 1}
                    width={3}
                    height={3}
                    className={`threat-block${m.live && here ? ' hunting' : ''}${m.live ? '' : ' ghost'}`}
                  />
                  <text x={cx + BOX_W / 2 - 3.2 - i * 3.4} y={cy + 3.4} className="node-threat">
                    {m.live ? m.mark : m.mark.toLowerCase()}
                  </text>
                </g>
              ))}
              {here ? (
                <rect
                  x={cx - BOX_W / 2 - 1.4}
                  y={cy - BOX_H / 2 - 1.4}
                  width={BOX_W + 2.8}
                  height={BOX_H + 2.8}
                  className="player-ring"
                />
              ) : null}
              {n.vent ? (
                <rect
                  x={cx + BOX_W / 2 - 3}
                  y={cy - BOX_H / 2 + 1}
                  width={2}
                  height={2}
                  className="node-box here"
                />
              ) : null}
            </g>
          );
        })}

        {state.player.node === 'vents' ? (
          <text x={W / 2} y={H - 2} textAnchor="middle" className="node-label here">
            IN THE CRAWLSPACE {ventCount > 0 ? `— ${ventCount} WITH YOU` : ''}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

/**
 * The line under the schematic: what the visible contacts are about to do, in
 * words, before the hour is committed. This is the single change that turns a
 * wound from an event into a mistake.
 */
export function Forecast({ state }: { state: GameState }): React.ReactElement | null {
  const fc = forecast(state);
  const shown = fc.moves.filter((m) => m.perceived);
  if (shown.length === 0 && !fc.danger) return null;
  const reaching = shown.filter((m) => m.reaches);
  return (
    <div className={`forecast-line${fc.danger ? ' alarm' : ''}`} data-testid="forecast">
      <span className="dim">IF THE HOUR ENDS NOW · </span>
      {reaching.length > 0 ? (
        <b>
          {reaching.map((m) => threatDef(m.type).name).join(' AND ')} REACHES YOU
          {' — '}
          {reaching.reduce((n, m) => n + threatDef(m.type).damage, 0)} WOUND
          {reaching.reduce((n, m) => n + threatDef(m.type).damage, 0) === 1 ? '' : 'S'}
        </b>
      ) : (
        <span>
          {shown
            .map((m) =>
              m.from === m.to
                ? `${threatDef(m.type).name} STAYS PUT`
                : `${threatDef(m.type).name} → ${m.to === 'vents' ? 'THE DUCTS' : MAP.nodes.find((n) => n.id === m.to)?.short}`,
            )
            .join(' · ')}
        </span>
      )}
    </div>
  );
}

export function threatLegend(): string {
  return THREAT_TYPES.map((t) => `${threatDef(t).mark}=${threatDef(t).name}`).join(' ');
}
