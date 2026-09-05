import { useState } from 'react';
import { DEPTHS, OBJECTIVES, ROLES, RULES, depthDef, endingHow, roleDef } from '../../engine';
import type { Depth, Objective, RoleId } from '../../engine/types';
import type { Meta } from '../persistence';
import { dailySeed } from '../persistence';

export function Menu({
  meta,
  hasSavedRun,
  onStart,
  onResume,
  onExport,
  onToggleCrt,
  onManual,
  onToggleGuidance,
}: {
  meta: Meta;
  hasSavedRun: boolean;
  onStart: (seed: string, role: RoleId, depth: Depth, objective: Objective) => void;
  onResume: () => void;
  onExport: () => void;
  onToggleCrt: () => void;
  onManual: () => void;
  onToggleGuidance: () => void;
}): React.ReactElement {
  const [role, setRole] = useState<RoleId>(meta.roles[0] ?? 'engineer');
  const [depth, setDepth] = useState<Depth>(meta.depths[meta.depths.length - 1] ?? 1);
  const [seed, setSeed] = useState('');
  const [objective, setObjective] = useState<Objective>('run');
  const today = dailySeed();
  const dailyDone = meta.daily[today] !== undefined;

  return (
    <div className="screen" data-testid="menu">
      <div className="title glow">COLDWAKE</div>
      <div className="rule">{'─'.repeat(40)}</div>
      <p>
        You wake because your pod failed, not because the run ended. Eight others are open. The
        orbit is decaying, and there are four things worth doing before it closes.
      </p>

      {hasSavedRun ? (
        <button className="cmd primary" data-testid="resume" onClick={onResume}>
          <span className="glow">RESUME RUN</span>
        </button>
      ) : null}

      <button className="cmd" data-testid="manual-open" onClick={onManual}>
        <span>OPERATIONS MANUAL</span>
        <span className="cost">HOW THE SHIP WORKS</span>
      </button>

      <h2>Who you were</h2>
      {ROLES.map((r) => {
        const unlocked = meta.roles.includes(r.id);
        return (
          <button
            key={r.id}
            className={`cmd${role === r.id ? ' primary' : ''}`}
            disabled={!unlocked}
            data-role={r.id}
            onClick={() => setRole(r.id)}
          >
            <span className={role === r.id ? 'glow' : ''}>{r.name}</span>
            <span className="cost">{unlocked ? r.strength : `LOCKED — ${r.unlock.label ?? ''}`}</span>
          </button>
        );
      })}

      {/* Declaring the objective is the whole of the fix for endings that were
          assigned to the player after they died. You say what you came for, the
          run tracks all four anyway, and the one you named is worth more. */}
      <h2>What you came up here to do</h2>
      {OBJECTIVES.map((o) => {
        const def = RULES.objectives[o];
        return (
          <button
            key={o}
            className={`cmd${objective === o ? ' primary' : ''}`}
            data-objective={o}
            onClick={() => setObjective(o)}
          >
            <span className={objective === o ? 'glow' : ''}>
              {def.name} — {def.node}
            </span>
            <span className="cost">{def.line}</span>
            <span className="why">{endingHow(def.ending)}</span>
          </button>
        );
      })}
      <p className="dim">
        All four stay open the whole run and all four are tracked on screen. Finishing a different
        one is still a win — the one you name here is the one worth ×{RULES.declaredBonus}.
      </p>

      <h2>How far down</h2>
      <div className="row">
        {DEPTHS.map((d) => {
          const unlocked = meta.depths.includes(d.depth);
          return (
            <button
              key={d.depth}
              className={depth === d.depth ? 'inverse' : ''}
              disabled={!unlocked}
              data-depth={d.depth}
              onClick={() => setDepth(d.depth)}
              style={{ flex: '0 0 auto', minWidth: '44px', textAlign: 'center' }}
            >
              {d.depth}
            </button>
          );
        })}
      </div>
      <p>
        {depthDef(depth).label} — {depthDef(depth).turnLimit} hours, and the shuttle wants{' '}
        {depthDef(depth).shuttleRequired} power
        {roleDef(role).shuttleRequired !== undefined ? ', less in your hands' : ''}.
      </p>

      <h2>Which Bellwether</h2>
      <input
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        placeholder="LEAVE BLANK AND IT PICKS ONE"
        data-testid="seed-input"
        style={{
          background: 'transparent',
          border: '1px solid var(--phos-dim)',
          color: 'var(--phosphor)',
          font: 'inherit',
          padding: '8px',
          minHeight: '44px',
        }}
      />

      <div className="row">
        <button
          className="cmd primary"
          data-testid="start"
          onClick={() => onStart(seed.trim() || `run-${Date.now().toString(36)}`, role, depth, objective)}
        >
          <span className="glow">WAKE</span>
        </button>
      </div>
      <button
        className="cmd"
        data-testid="daily"
        disabled={dailyDone || !meta.depths.includes(3)}
        onClick={() => onStart(today, role, 3, objective)}
      >
        <span>TODAY'S BELLWETHER</span>
        <span className="cost">
          {!meta.depths.includes(3)
            ? 'LOCKED'
            : dailyDone
              ? `LOGGED · ${meta.daily[today]?.score ?? 0}`
              : 'ONE ATTEMPT, EVERYBODY THE SAME SHIP'}
        </span>
      </button>

      <h2>What is on file</h2>
      <div className="stat">
        <span>WAKINGS</span>
        <b>{meta.runs}</b>
      </div>
      {Object.entries(meta.endings).map(([k, v]) => (
        <div className="stat" key={k}>
          <span>{k.replace('_', ' ').toUpperCase()}</span>
          <b>{v}</b>
        </div>
      ))}
      {Object.entries(meta.best).map(([k, v]) => (
        <div className="stat" key={k}>
          <span>BEST {k.toUpperCase()}</span>
          <b>{v}</b>
        </div>
      ))}

      <h2>Settings</h2>
      <button className="cmd" data-testid="guidance-toggle" onClick={onToggleGuidance}>
        <span>ADVISORY VOICE</span>
        <span className="cost">
          {meta.guidance ? 'ON — IT TALKS YOU THROUGH IT' : 'OFF — YOU ARE ON YOUR OWN'}
        </span>
      </button>
      <button className="cmd" data-testid="crt-toggle" onClick={onToggleCrt}>
        <span>CRT TREATMENT</span>
        <span className="cost">{meta.crt ? 'ON' : 'OFF'}</span>
      </button>
      <button className="cmd" onClick={onExport}>
        <span>EXPORT TELEMETRY</span>
        <span className="cost">JSON</span>
      </button>
      <div className="rule">{'─'.repeat(40)}</div>
      <p className="ghost">
        NOTHING LEAVES THIS DEVICE. NO ACCOUNTS, NO NETWORK, NO ANALYTICS.
      </p>
    </div>
  );
}
