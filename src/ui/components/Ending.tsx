import { useState } from 'react';
import { RULES, allProgress, endingReport, infectionThreshold, isInfection } from '../../engine';
import type { GameState } from '../../engine/types';
import { useReducedMotion, useTypedText } from '../hooks';

const EPILOGUE: Record<string, string> = {
  escaped:
    'The Bellwether goes on burning without you. Assay wants the ore manifest and not much else. You are asked twice whether anyone else got out, and both times the honest answer is no. You sleep with the lights on for a year and then you stop.',
  carrier:
    'The shuttle makes the relay on schedule. You pass the medical, because the medical is looking for injuries. Nine days later the station hold is nine degrees above ambient. Nobody ever connects it to you.',
  overload:
    'The reactor lets go at 04:12 ship time, and you are awake for all of it. Whatever came up out of 2481-Kell is a light, and then it is nothing. Assay files a total loss and pays the crew at standard rates. It stays down there.',
  relay:
    'The recording runs the whole length of the watch: the hull note, the thing in the hold answering it, and your voice reading the ore assay numbers out loud so that nobody can pretend they did not know. Assay does not send a recovery contractor. Nobody opens that hold again.',
  specimen:
    'It goes up the wire in four minutes and it is on six stations inside a day. Somebody with a laboratory and no imagination names it after the ship. Every crew that meets one after you meets it already knowing what it does, and that is the whole of what you got out of the Bellwether.',
  killed:
    'You stop somewhere between two compartments, out of everything, and the ship goes on without you. The orbit closes on schedule and takes the Bellwether into the Kell primary. Nothing leaves. Nobody is told.',
  adrift:
    'The orbit closes and the Bellwether goes into the Kell primary at seven kilometres a second. It is quick, which is not the same as merciful. No signal leaves the ship. For thirty-one hours nobody notices.',
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
  const ending = r?.ending ?? 'adrift';
  const reduced = useReducedMotion();
  const name = RULES.endings[ending].name ?? (ending === 'killed' ? 'KILLED' : 'ADRIFT');
  const report = endingReport(state);
  const epilogue = EPILOGUE[ending] ?? '';
  const typedName = useTypedText(name, reduced, 90);
  const named = typedName.length >= name.length;
  const owned = [...state.player.hand, ...state.player.deck, ...state.player.discard];
  const surviving = owned.filter((u) => !isInfection(u)).length;
  const declared = RULES.objectives[state.objective];

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
        <b>
          ×{RULES.endings[ending].multiplier}
          {r?.declared === true ? ` × ${RULES.declaredBonus} DECLARED` : ''}
        </b>
      </div>
      <div className="stat note-row wide">
        <span>YOU CAME UP HERE TO {declared.name}</span>
        <b className="note">
          {r?.declared === true
            ? `And you did. That is what the ×${RULES.declaredBonus} is for.`
            : `You finished something else. Every route counts; only the one you named carries the ×${RULES.declaredBonus}.`}
        </b>
      </div>
      <div className="stat note-row wide">
        <span>WHERE THE FOUR STOOD</span>
        <b className="note">{allProgress(state).map((p) => p.label).join(' · ')}</b>
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
        <span>SHAKEN OFF</span>
        <b>{state.stats.threatsShaken}</b>
      </div>
      <div className="stat">
        <span>CUT OUT OF YOU</span>
        <b>{state.stats.cures}</b>
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
        <span>INFECTION IN THE DECK</span>
        <b>
          {'█'.repeat(Math.min(r?.infection ?? 0, 12))} · {r?.infection ?? 0} of{' '}
          {infectionThreshold(state.depth)}
        </b>
      </div>
      <div className="stat note-row wide">
        <span>CARRIER AT {infectionThreshold(state.depth)}</span>
        <b className="note">
          Every wound puts a named card in your own deck, and the count is on the strip from the
          first one. Launching at {infectionThreshold(state.depth)} or more is the CARRIER; the
          medbay cuts one out for {RULES.systemActions.cure?.ap ?? 2} time and{' '}
          {RULES.systemActions.cure?.power ?? 2} power, with no wound attached.
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
