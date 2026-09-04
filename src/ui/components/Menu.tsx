import { useState } from 'react';
import { DEPTHS, ROLES, depthDef, roleDef } from '../../engine';
import type { Depth, RoleId } from '../../engine/types';
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
}: {
  meta: Meta;
  hasSavedRun: boolean;
  onStart: (seed: string, role: RoleId, depth: Depth) => void;
  onResume: () => void;
  onExport: () => void;
  onToggleCrt: () => void;
  onManual: () => void;
}): React.ReactElement {
  const [role, setRole] = useState<RoleId>(meta.roles[0] ?? 'engineer');
  const [depth, setDepth] = useState<Depth>(meta.depths[meta.depths.length - 1] ?? 1);
  const [seed, setSeed] = useState('');
  const today = dailySeed();
  const dailyDone = meta.daily[today] !== undefined;

  return (
    <div className="screen" data-testid="menu">
      <div className="title glow">COLDWAKE</div>
      <div className="rule">{'─'.repeat(40)}</div>
      <p>
        You wake because your pod failed. Eight others are open. The orbit is decaying and the
        shuttle needs power you have not got.
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

      <h2>Crew</h2>
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

      <h2>Depth</h2>
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
        {depthDef(depth).label} — {depthDef(depth).turnLimit} turns, shuttle needs{' '}
        {depthDef(depth).shuttleRequired} power
        {roleDef(role).shuttleRequired !== undefined ? ' (less for the pilot)' : ''}.
      </p>

      <h2>Seed</h2>
      <input
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        placeholder="BLANK FOR RANDOM"
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
          onClick={() => onStart(seed.trim() || `run-${Date.now().toString(36)}`, role, depth)}
        >
          <span className="glow">WAKE</span>
        </button>
      </div>
      <button
        className="cmd"
        data-testid="daily"
        disabled={dailyDone || !meta.depths.includes(3)}
        onClick={() => onStart(today, role, 3)}
      >
        <span>DAILY RUN — DEPTH 3</span>
        <span className="cost">
          {!meta.depths.includes(3)
            ? 'LOCKED'
            : dailyDone
              ? `DONE · ${meta.daily[today]?.score ?? 0}`
              : 'ONE ATTEMPT'}
        </span>
      </button>

      <h2>Records</h2>
      <div className="stat">
        <span>RUNS</span>
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
