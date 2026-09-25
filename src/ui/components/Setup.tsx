import { useState } from 'react';
import { ITEMS } from '../../game/content/items';
import { ROLE_ORDER, ROLES, STAT_NAMES } from '../../game/content/roles';
import { personName } from '../../game/generate';
import { Rng, randomSeed } from '../../game/rng';
import type { Difficulty, RoleId, Stat } from '../../game/types';
import { Icon } from '../art/Icon';

const DIFFS: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'story', name: 'Story', desc: 'More time, more health, fewer of them.' },
  { id: 'standard', name: 'Standard', desc: 'The way it’s meant to be played.' },
  { id: 'nightmare', name: 'Nightmare', desc: 'Less of everything. They all hunt.' },
];

export function Setup({
  unlocks,
  initialRole,
  initialDifficulty,
  onBack,
  onStart,
}: {
  unlocks: string[];
  initialRole: RoleId;
  initialDifficulty: Difficulty;
  onBack: () => void;
  onStart: (o: { role: RoleId; name: string; difficulty: Difficulty; seed: string }) => void;
}) {
  const [role, setRole] = useState<RoleId>(initialRole);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [name, setName] = useState(() => personName(new Rng(Math.floor(Math.random() * 1e9))));
  const [seed, setSeed] = useState('');

  const locked = (r: RoleId) => {
    const u = ROLES[r].unlock;
    return !!u && !unlocks.includes(u.key);
  };

  return (
    <main className="page">
      <div className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <div>
          <span className="eyebrow">New story</span>
          <h1>Who wakes up?</h1>
        </div>
      </div>

      <div className="roles" role="radiogroup" aria-label="Role">
        {ROLE_ORDER.map((r) => {
          const def = ROLES[r];
          const isLocked = locked(r);
          return (
            <button
              key={r}
              role="radio"
              aria-checked={role === r}
              className={`role-card ${role === r ? 'sel' : ''} ${isLocked ? 'locked' : ''}`}
              disabled={isLocked}
              onClick={() => setRole(r)}
            >
              <h3>
                {def.name}
                {isLocked && <Icon name="lock" size={16} />}
              </h3>
              <span className="tag">{isLocked ? `Locked. ${def.unlock!.hint}` : def.tagline}</span>
              <div className="statbars">
                {(['might', 'tech', 'wits', 'nerve'] as Stat[]).map((st) => (
                  <div className="statbar" key={st}>
                    <span>{STAT_NAMES[st]}</span>
                    <i>
                      {[0, 1].map((k) => (
                        <b key={k} className={def.stats[st] > k ? 'on' : ''} />
                      ))}
                    </i>
                  </div>
                ))}
              </div>
              <span className="perk">
                <b>{def.perkName}.</b> {def.perk}
              </span>
              <span className="kit">Starts with: {def.items.map((i) => ITEMS[i].name).join(', ')}</span>
            </button>
          );
        })}
      </div>

      <label className="field">
        <span className="eyebrow">Name</span>
        <span className="name-row">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={28} aria-label="Your name" />
          <button className="icon-btn" onClick={() => setName(personName(new Rng(Math.floor(Math.random() * 1e9))))} aria-label="Random name" type="button">
            <Icon name="dice" />
          </button>
        </span>
      </label>

      <div className="field">
        <span className="eyebrow">Difficulty</span>
        <div className="segmented" role="radiogroup" aria-label="Difficulty">
          {DIFFS.map((d) => (
            <button key={d.id} role="radio" aria-checked={difficulty === d.id} className={difficulty === d.id ? 'sel' : ''} onClick={() => setDifficulty(d.id)}>
              <b>{d.name}</b>
              <small>{d.desc}</small>
            </button>
          ))}
        </div>
      </div>

      <details className="field">
        <summary className="eyebrow" style={{ cursor: 'pointer' }}>
          Ship seed (optional)
        </summary>
        <span className="name-row" style={{ marginTop: 8 }}>
          <input value={seed} onChange={(e) => setSeed(e.target.value.toUpperCase())} placeholder="Random" maxLength={16} aria-label="Ship seed" />
        </span>
        <small style={{ color: 'var(--muted)' }}>The same seed builds the same ship, the same disaster and the same dice. Share one with a friend.</small>
      </details>

      <div className="setup-go">
        <button
          className="btn primary wide"
          onClick={() => onStart({ role, name: name.trim() || personName(new Rng(7)), difficulty, seed: seed.trim() || randomSeed() })}
          data-testid="wake"
        >
          Wake up
        </button>
      </div>
    </main>
  );
}
