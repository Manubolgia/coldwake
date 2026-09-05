import { useState } from 'react';
import { RULES, endingReport, isPanic } from '../../engine';
import type { GameState } from '../../engine/types';
import { useReducedMotion, useTypedText } from '../hooks';

const EPILOGUE: Record<string, string> = {
  clean_break:
    'The Bellwether goes on burning without you. Assay wants the ore manifest and not much else. You are asked twice whether anyone else got out, and both times the honest answer is no. You sleep with the lights on for a year and then you stop.',
  carrier:
    'The shuttle makes the relay on schedule. You pass the medical, because the medical is looking for injuries. Nine days later the station hold is nine degrees above ambient. Nobody ever connects it to you.',
  scuttle:
    'The reactor lets go at 04:12 ship time. Whatever came up out of 2481-Kell is a light, and then it is nothing. Assay files a total loss and pays out the crew at standard rates. It stays down there.',
  beacon:
    'The broadcast reaches the relay thirty-one hours after you stop. It carries your name, the ship position, and four minutes of the sound the vents make. Assay dispatches a recovery contractor, because the ore is worth the trip. Somebody else opens the hold.',
  lost: 'The orbit closes and the Bellwether goes into the Kell primary at seven kilometres a second. It is quick, which is not the same as merciful. No signal leaves the ship. For thirty-one hours nobody notices.',
};

/**
 * Running out of things you can do is a real way to lose now, and it does not
 * read like running out of hours. The orbit closing is cold comfort written
 * for somebody who was still alive when it happened.
 */
const DIED_ABOARD: Record<string, string> = {
  lost: 'You stop somewhere between two compartments, out of everything, and the ship goes on without you. Nine hours later the orbit closes and takes the Bellwether into the Kell primary. Nothing leaves. Nobody is told.',
  beacon:
    'You stop before the orbit does. The broadcast you sent goes out anyway, thirty-one hours to the relay, carrying your name and the ship position. Assay dispatches a recovery contractor, because the ore is worth the trip. Somebody else opens the hold.',
  scuttle:
    'You do not live to hear it, but the reactor lets go on schedule. Whatever came up out of 2481-Kell is a light, and then it is nothing. Assay files a total loss and pays out the crew at standard rates. It stays down there.',
};

export function EndingScreen({
  state,
  onSurvey,
  onDone,
}: {
  state: GameState;
  onSurvey: (s: { tension: number; pointlessTurn: boolean; understoodLoss: boolean; note: string }) => void;
  onDone: () => void;
}): React.ReactElement {
  const [tension, setTension] = useState(0);
  const [pointless, setPointless] = useState<boolean | null>(null);
  const [understood, setUnderstood] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const r = state.result;
  const ending = r?.ending ?? 'lost';
  const reduced = useReducedMotion();
  const name = RULES.endings[ending].name;
  const report = endingReport(state);
  const epilogue =
    (r?.cause === 'deck' ? DIED_ABOARD[ending] : undefined) ?? EPILOGUE[ending] ?? '';
  const typedName = useTypedText(name, reduced, 90);
  const named = typedName.length >= name.length;
  const surviving = [...state.player.hand, ...state.player.deck, ...state.player.discard].filter(
    (u) => !isPanic(u),
  ).length;

  return (
    <div className="screen" data-testid="ending" data-ending={ending}>
      <div className="rule">{'─'.repeat(40)}</div>
      <div className="title glow" data-testid="ending-name">
        {typedName}
        {named ? null : <span className="caret" />}
      </div>
      <div className="rule">{'─'.repeat(40)}</div>
      {named ? <p className="verdict">{report.verdict}</p> : null}
      {named ? <p className="epilogue">{epilogue}</p> : null}

      {/* The playtest kept answering "no" to whether the loss was understood.
          An ending is a rule firing, so the screen says which one fired on
          this run's numbers, and what the nearest other answer would have
          been. */}
      {named ? (
        <>
          <h2>Why this one</h2>
          <p className="epilogue" data-testid="ending-why">
            {report.why}
          </p>
          <p className="epilogue dim" data-testid="ending-instead">
            {report.instead}
          </p>
        </>
      ) : null}

      <h2>Assay report</h2>
      <div className="stat">
        <span>SCORE</span>
        <b data-testid="score">{r?.score ?? 0}</b>
      </div>
      <div className="stat">
        <span>ASSAY WEIGHTING</span>
        <b>×{RULES.endings[ending].multiplier}</b>
      </div>
      <div className="stat">
        <span>POWER INTO THE SHUTTLE</span>
        <b>{state.ship.shuttleCharge}</b>
      </div>
      <div className="stat">
        <span>COMPARTMENTS SEARCHED</span>
        <b>{state.ship.searched.length}</b>
      </div>
      <div className="stat">
        <span>PUT DOWN</span>
        <b>{state.stats.threatsKilled}</b>
      </div>
      <div className="stat">
        <span>HOURS SURVIVED</span>
        <b>{r?.turn ?? state.turn}</b>
      </div>
      <div className="stat">
        <span>STILL YOURSELF</span>
        <b>{surviving}</b>
      </div>
      <div className="stat">
        <span>BLOOD</span>
        <b>
          {state.player.carry.map((c) => (c.id === 'infested' ? '█' : '▒')).join('')} ·{' '}
          {r?.infested ?? 0} OF {state.player.carry.length} INFECTED
        </b>
      </div>
      <div className="stat note-row wide">
        <span>CARRIER AT {RULES.carry.carrierThreshold}</span>
        <b className="note">
          Every wound put one of these in the rack. Launching with{' '}
          {RULES.carry.carrierThreshold} or more infested is the CARRIER ending, whatever else the
          run did.
        </b>
      </div>
      <div className="stat">
        <span>SEED</span>
        <b>{state.seed}</b>
      </div>

      <h2>Debrief</h2>
      <p>Tension</p>
      <div className="row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={tension === n ? 'inverse' : ''} onClick={() => setTension(n)}>
            {n}
          </button>
        ))}
      </div>
      <p>Was there an hour that felt pointless?</p>
      <div className="row">
        <button className={pointless === true ? 'inverse' : ''} onClick={() => setPointless(true)}>
          yes
        </button>
        <button className={pointless === false ? 'inverse' : ''} onClick={() => setPointless(false)}>
          no
        </button>
      </div>
      <p>Did you understand what killed you?</p>
      <div className="row">
        <button className={understood === true ? 'inverse' : ''} onClick={() => setUnderstood(true)}>
          yes
        </button>
        <button className={understood === false ? 'inverse' : ''} onClick={() => setUnderstood(false)}>
          no
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ONE LINE, OPTIONAL"
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
          data-testid="ending-continue"
          onClick={() => {
            if (tension > 0 || pointless !== null || understood !== null || note !== '') {
              onSurvey({
                tension,
                pointlessTurn: pointless === true,
                understoodLoss: understood !== false,
                note,
              });
            }
            onDone();
          }}
        >
          RETURN TO BAY
        </button>
      </div>
    </div>
  );
}
