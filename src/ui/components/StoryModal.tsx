import { useEffect, useRef } from 'react';
import { STAT_NAMES } from '../../game/content/roles';
import { sign, statParts } from '../../game/rules';
import type { GameState, StoryCard } from '../../game/types';
import { Art } from '../art/Art';
import { DieFace } from './Die';

const KIND_LABEL: Record<StoryCard['kind'], string> = {
  intro: 'You wake',
  discovery: 'New room',
  encounter: 'Encounter',
  event: 'The ship',
  clue: 'Log recovered',
  truth: 'The truth',
  panic: 'Panic',
  survivor: 'Survivor',
  result: 'What happens',
  companion: 'Companion',
  info: 'Notice',
};

const BAND = { clean: 'Clean', cost: 'Cost', fail: 'Fail' } as const;

function odds(bonus: number): string {
  const clean = 6 - bonus;
  const cost = 4 - bonus;
  if (clean <= 1) return 'always clean';
  if (clean > 6 && cost > 6) return 'will fail';
  if (clean > 6) return `can’t be clean · cost on ${Math.max(1, cost)}+`;
  return `clean on ${clean}+${cost > 1 ? ` · cost on ${cost}–${clean - 1}` : ` · otherwise cost`}`;
}

export function StoryModal({ s, card, onChoose, onContinue }: { s: GameState; card: StoryCard; onChoose: (i: number) => void; onContinue: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
  }, [card.uid]);

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-labelledby={`card-${card.uid}`}>
      <article className={`story t-${card.tone}`} key={card.uid}>
        <Art art={card.art} className="art" />
        <div className="content">
          <div className="kind">
            <span className="eyebrow">{KIND_LABEL[card.kind]}</span>
            <span className="eyebrow">Round {s.round}</span>
          </div>
          <h2 id={`card-${card.uid}`}>{card.title}</h2>
          {card.roll && (
            <div className="rollbox" aria-label={`Rolled ${card.roll.die}, total ${card.roll.total}, ${card.roll.band}`}>
              <DieFace value={card.roll.die} className="rolling" />
              <span className="eq">
                {card.roll.die} {sign(card.roll.bonus)} {STAT_NAMES[card.roll.stat]} = <b>{card.roll.total}</b>
              </span>
              <span className={`band ${card.roll.band}`}>{BAND[card.roll.band]}</span>
            </div>
          )}
          <p className="text">{card.text}</p>
          <div className="choices">
            {card.choices.length ? (
              card.choices.map((ch, i) => {
                const bonus = ch.stat ? statParts(s, ch.stat).total + (ch.mod ?? 0) : 0;
                return (
                  <button key={i} ref={i === 0 ? first : undefined} className="choice" onClick={() => onChoose(i)}>
                    <b>{ch.label}</b>
                    {ch.stat ? (
                      <small>
                        <em>
                          {STAT_NAMES[ch.stat]} {sign(bonus)}
                        </em>{' '}
                        · roll a die · {odds(bonus)}
                      </small>
                    ) : (
                      <small>{ch.hint ?? 'No roll'}</small>
                    )}
                  </button>
                );
              })
            ) : (
              <button ref={first} className="btn primary wide" onClick={onContinue}>
                Continue
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
