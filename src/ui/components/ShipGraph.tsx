import { MAP, RULES, THREAT_TYPES, threatDef } from '../../engine';
import type { GameState, NodeId } from '../../engine/types';

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
  const threatsBy = new Map<string, string[]>();
  for (const t of state.threats) {
    const key = t.node;
    threatsBy.set(key, [...(threatsBy.get(key) ?? []), threatDef(t.type).name[0] ?? '?']);
  }
  const ventCount = state.threats.filter((t) => t.node === 'vents').length;

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

        {MAP.nodes.map((n) => {
          const [cx, cy] = centre(n.x, n.y);
          const here = state.player.node === n.id;
          const noise = state.ship.noise[n.id] ?? 0;
          const marks = threatsBy.get(n.id) ?? [];
          return (
            <g
              key={n.id}
              onClick={() => onSelect(n.id)}
              role="button"
              tabIndex={0}
              aria-label={`${n.name}, noise ${noise}${marks.length > 0 ? `, ${marks.length} contacts` : ''}`}
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
              {/* Noise as a filled bar plus the number: the fonts have no
                  block-drawing glyphs at this size, so it is drawn. */}
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
              {marks.slice(0, 3).map((m, i) => (
                <g key={i}>
                  <rect
                    x={cx + BOX_W / 2 - 3.6 - i * 3.4}
                    y={cy + 1}
                    width={3}
                    height={3}
                    className={`threat-block${here ? ' hunting' : ''}`}
                  />
                  <text x={cx + BOX_W / 2 - 3.2 - i * 3.4} y={cy + 3.4} className="node-threat">
                    {m}
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
              {/* Vent access. */}
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

export function threatLegend(): string {
  return THREAT_TYPES.map((t) => `${threatDef(t).name[0]}=${threatDef(t).name}`).join(' ');
}
