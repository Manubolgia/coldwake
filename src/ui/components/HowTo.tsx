import { Icon } from '../art/Icon';
import { DieFace } from './Die';
import type { RunRecord } from '../persistence';
import { ROLES } from '../../game/content/roles';
import { INCIDENTS } from '../../game/content/incidents';
import type { IncidentId } from '../../game/types';

export function HowTo({ onBack }: { onBack: () => void }) {
  return (
    <main className="page">
      <div className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <div>
          <span className="eyebrow">Field manual</span>
          <h1>How to play</h1>
        </div>
      </div>
      <div className="howto">
        <div className="card">
          <h3>
            <Icon name="launch" /> The goal
          </h3>
          <p>
            You wake from cryosleep on a dying ship. Something is aboard with you. Every ship, disaster, creature and layout is different. You have two ways off — finish either one before the clock at the top runs out. Or die trying.
          </p>
        </div>
        <div className="card">
          <h3>
            <Icon name="journal" /> The narrator
          </h3>
          <p>
            Like a game master at the table, the narrator tells you what happens in the middle of the screen, a line at a time, then waits for your move. Story cards are told the same way, and a check rolls its die in front of you. Tap the narrator to hear the rest at once; the whole story so far is in the Log. You can change how fast it speaks in the Menu.
          </p>
        </div>
        <div className="card">
          <h3>
            <Icon name="dice" /> Dice
          </h3>
          <div className="demo">
            <DieFace value={6} />
            <DieFace value={3} />
            <DieFace value={1} />
          </div>
          <p>
            Each round you get three dice, already rolled. Tap one, then open what you want to do — Here, Kit, Move, Goal, or Danger when something is in the room — and tap an action. Every action shows exactly what that die will do before you commit — so the question is never “will this work?” but “which die do I spend where?”
          </p>
          <p>Badly hurt (2 health or less), you roll one fewer. A companion adds a die of their own.</p>
        </div>
        <div className="card">
          <h3>
            <Icon name="check" /> Clean, cost, fail
          </h3>
          <div className="demo">
            <span className="outcome">
              <span className="band clean">Clean</span>
            </span>
            <span className="outcome">
              <span className="band cost">Cost</span>
            </span>
            <span className="outcome">
              <span className="band fail">Fail</span>
            </span>
          </div>
          <p>
            Your die plus your stat (plus any tools): <b>6 or more</b> is clean — it just works. <b>4–5</b> works, but something goes wrong: noise, stress, a wound. <b>3 or less</b> fails, and something goes wrong anyway. Fights compare against the creature’s guard instead of 6.
          </p>
        </div>
        <div className="card">
          <h3>
            <Icon name="noise" /> Noise
          </h3>
          <p>
            Most actions make noise. Your noise this round sets how far away you can be heard: rooms in range glow red on the map. When the round ends, anything in those rooms comes toward you. Moving on a high die is silent; on a low one, it’s loud.
          </p>
          <p>Every creature you can see shows an arrow for where it will go. Nothing moves without warning.</p>
        </div>
        <div className="card">
          <h3>
            <Icon name="skull" /> When something finds you
          </h3>
          <p>
            A creature that reaches your room won’t strike until the end of the <i>next</i> round. You get a turn: <b>fight</b> it with a high die, <b>hide</b> if the room has cover, or <b>run</b>. A flare throws everything off your scent. The airlock can blow anything in it into space.
          </p>
        </div>
        <div className="card">
          <h3>
            <Icon name="stress" /> Health, stress and infection
          </h3>
          <p>
            Wounds cost health; the medbay and medkits heal it. Horror costs stress; at the top of the bar you panic, and panic can scar you for the rest of the run. Unused dice at the end of a round steady your nerves. Some wounds infect you, and you won’t know until symptoms show or a scan finds it.
          </p>
        </div>
        <div className="card">
          <h3>
            <Icon name="door" /> Rooms and stories
          </h3>
          <p>
            Rooms are anonymous until you’ve stood next to them. The first time you enter one, you find something: a body, a stash, a survivor, a log, a fire, an ambush. Every room offers its own action. Logs piece together what happened — find enough and you learn the creature’s weakness.
          </p>
        </div>
        <div className="card">
          <h3>
            <Icon name="goals" /> Your secret
          </h3>
          <p>Everyone who wakes up has a reason of their own. Yours is in Goals. You can escape without it — but the ending remembers.</p>
        </div>
      </div>
    </main>
  );
}

export function Memorial({ history, onBack }: { history: RunRecord[]; onBack: () => void }) {
  return (
    <main className="page">
      <div className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <div>
          <span className="eyebrow">Every crew member who woke</span>
          <h1>The memorial</h1>
        </div>
      </div>
      <div className="memorial">
        {!history.length && <p className="empty">No names here yet.</p>}
        {history.map((r, i) => (
          <div className="run" key={i}>
            <b>{r.name}</b>
            <b className={r.won ? 'won' : 'lost'}>{r.title}</b>
            <small>
              {ROLES[r.role]?.name ?? r.role} · the {r.ship} · {INCIDENTS[r.incident as IncidentId]?.name ?? r.incident} · {r.difficulty} · round {r.rounds} · score {r.score} ·{' '}
              {new Date(r.date).toLocaleDateString()}
            </small>
          </div>
        ))}
      </div>
    </main>
  );
}
