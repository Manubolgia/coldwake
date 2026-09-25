import { INCIDENTS } from '../../game/content/incidents';
import { ROLES } from '../../game/content/roles';
import type { GameState } from '../../game/types';

const UNLOCK_TEXT: Record<string, string> = {
  escaped: 'New role unlocked: the Stowaway.',
  truth: 'New role unlocked: the Android.',
};

export function Ending({ s, newUnlocks, onAgain, onTitle }: { s: GameState; newUnlocks: string[]; onAgain: () => void; onTitle: () => void }) {
  const e = s.ending!;
  const inc = INCIDENTS[s.scenario.incident];
  return (
    <main className={`ending ${e.won ? 'won' : 'lost'}`}>
      <div className="hero">
        <span className="eyebrow">
          {s.player.name} · {ROLES[s.player.role].name} · the {s.scenario.shipName}
        </span>
        <h1>{e.title}</h1>
        <span className="eyebrow">
          {inc.name} · {e.won ? 'escaped' : 'did not escape'} · round {s.round}
        </span>
      </div>

      <div className="epilogue">
        {e.epilogue.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {newUnlocks.map((u) => (
        <div className="unlock" key={u}>
          {UNLOCK_TEXT[u] ?? u}
        </div>
      ))}

      <div className="statgrid">
        <div className="stat">
          <span className="eyebrow">Score</span>
          <b>{e.score}</b>
        </div>
        <div className="stat">
          <span className="eyebrow">Rounds</span>
          <b>{s.round}</b>
        </div>
        <div className="stat">
          <span className="eyebrow">Logs</span>
          <b>{s.progress.clues.length}/4</b>
        </div>
        <div className="stat">
          <span className="eyebrow">Kills</span>
          <b>{s.progress.kills}</b>
        </div>
      </div>

      <div className="card">
        <span className="eyebrow">Your story</span>
        <ul className="beats">
          {s.beats.map((b, i) => (
            <li key={i}>
              <span>Round {b.round}</span>
              {b.text}
            </li>
          ))}
        </ul>
      </div>

      {!s.progress.truth && (
        <div className="card">
          <span className="eyebrow" style={{ color: 'var(--violet)' }}>
            What you never found out
          </span>
          <p className="blurb">
            {inc.name}: {inc.hook} {s.progress.clues.length > 0 ? 'You had pieces of it.' : ''} Next time, look harder.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        <button className="btn primary wide" onClick={onAgain} data-testid="again">
          Wake on another ship
        </button>
        <button className="btn wide ghost" onClick={onTitle}>
          Title screen
        </button>
      </div>
    </main>
  );
}
