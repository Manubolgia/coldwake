import { useState } from 'react';
import {
  DEPTHS,
  RULES,
  THREAT_TYPES,
  depthDef,
  endingHow,
  fuseTurns,
  infectionThreshold,
  relayHold,
  threatDef,
} from '../../engine';
import { CARDS } from '../../engine/content';
import type { Ending, Objective } from '../../engine/types';

/**
 * A reference, not a tutorial. Everything that decides a run is on the screen
 * while the run is happening — the four trackers, the infection count, the
 * forecast under the schematic, the consequence under every button. This is
 * where the numbers behind those live, for the reader who wants them.
 *
 * Every figure here is read out of src/content, so the manual cannot drift out
 * of step with the rules the way it did when it was prose.
 */

const PAGES = ['THE FOUR', 'AN HOUR', 'NOISE', 'ABOARD', 'HURT', 'THE SHIP', 'DEEPER'] as const;
type Page = (typeof PAGES)[number];

function Row({
  term,
  wide,
  children,
}: {
  term: string;
  wide?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={`stat note-row${wide === true ? ' wide' : ''}`}>
      <span>{term}</span>
      <b className="note">{children}</b>
    </div>
  );
}

/** What a system action costs, in the one format every page prints it in. */
function cost(key: string): string {
  const d = RULES.systemActions[key];
  if (!d) return '';
  return `${d.ap} time${d.power > 0 ? ` · ${d.power} power` : ''} · heard ${d.noise} away`;
}

const OBJECTIVE_ORDER: Objective[] = ['run', 'burn', 'call', 'know'];

function TheFour(): React.ReactElement {
  const d = depthDef(1);
  return (
    <>
      <h2>Four ways off this ship</h2>
      <p>
        You woke because your pod failed, and the orbit closes in {d.turnLimit} hours. There are
        four things worth doing before it does. You name one of them when you wake — that one is
        worth ×{RULES.declaredBonus} — but all four are live for the whole run, all four are
        tracked on the second strip at the top of the screen, and finishing any of them ends the
        run as a win.
      </p>
      <p className="dim">
        Nothing is decided for you at the end. If a route closes, the trackers tell you where the
        other three stand and you go and do one of those instead.
      </p>
      {OBJECTIVE_ORDER.map((o) => {
        const def = RULES.objectives[o];
        return (
          <Row key={o} term={`${def.name} — ${def.node}`} wide>
            {def.line} {endingHow(def.ending)}
          </Row>
        );
      })}
      <h2>The two ways it goes wrong</h2>
      <Row term="KILLED" wide>
        {RULES.endings.killed.how} Nothing about this is sudden: what is about to reach you is
        printed under the schematic before you commit the hour.
      </Row>
      <Row term="ADRIFT" wide>
        {RULES.endings.adrift.how}
      </Row>
      <h2>Weighting</h2>
      <p>
        Every finished route is worth ×1 and the CARRIER is worth ×
        {RULES.endings.carrier.multiplier}; the two losses are ×{RULES.endings.killed.multiplier}.
        The route you declared multiplies by a further ×{RULES.declaredBonus}. The spread is
        deliberately narrow: the run scores the run, and the ending scores the ending.
      </p>
    </>
  );
}

function AnHour(): React.ReactElement {
  return (
    <>
      <h2>What an hour is</h2>
      <p>
        {RULES.apPerTurn} time, and one free thing out of your hand. Spend the time on anything
        below; play or set aside one thing from your hand for nothing, and pay the printed time for
        anything after it.
      </p>
      <p>
        Your hand stays with you between hours — nothing is discarded at the end of the hour. That
        is why setting something aside is free once an hour and draws you a replacement: it is how
        a hand you cannot use becomes one you can.
      </p>
      <h2>Time</h2>
      {(
        [
          ['WALK', 'move'],
          ['CREEP', 'creep'],
          ['LISTEN', 'listen'],
          ['SEARCH', 'search'],
          ['BRACE', 'brace'],
          ['INTO / OUT OF THE VENTS', 'ventEnter'],
        ] as const
      ).map(([label, key]) => {
        const d = RULES.basicActions[key];
        return (
          <Row key={key} term={label}>
            {d?.ap} time · {(d?.noise ?? 0) === 0 ? 'silent' : `heard ${d?.noise} away`}
          </Row>
        );
      })}
      <Row term="LISTEN REACHES" wide>
        {RULES.listenRange} compartments, and it names every contact inside that: what it is, where
        it is, how far off, and whether it is coming here. Without it you see only this compartment
        and the ones next door.
      </Row>
      <Row term="BRACE" wide>
        Once an hour. The next thing that reaches you does not land. It is the cheapest answer to a
        forecast that says something is about to.
      </Row>
      <h2>The order of an hour</h2>
      <p>
        You spend your time. Then any compartment at {RULES.noiseThreshold} noise or more draws
        something out of the dark. Then everything aboard moves. Then the reactor pays out, the
        noise fades by {RULES.noiseDecay}, and the hold gets a little more awake.
      </p>
    </>
  );
}

function Noise(): React.ReactElement {
  return (
    <>
      <h2>Noise is a place, not an alarm</h2>
      <p>
        Every noisy thing you do has a number, and that number is two things at once: how much
        noise lands in the compartment, and how many compartments away it is heard.
      </p>
      <p>
        Anything that hears it now believes you are <em>there</em>. Not where you actually are —
        where the sound was. It walks to that compartment, finds nothing, spends an hour searching,
        and then gives up on you entirely.
      </p>
      <p>
        That is the whole stealth game. Creeping is heard {RULES.basicActions.creep?.noise} away and
        walking is heard {RULES.basicActions.move?.noise} away, so the question is never whether you
        can afford to move, it is how loudly.
      </p>
      <h2>Hearing</h2>
      <p>
        Each creature has a ceiling on what it can pick out at all, so a loud action does not reach
        everything. A STRAY hears {threatDef('contact').hearing} compartments at most; a HUNTER
        hears {threatDef('drifter').hearing}. The MOTHER hears the whole ship.
      </p>
      <h2>Drawing</h2>
      <p>
        A compartment at {RULES.noiseThreshold} or more draws when the hour ends, and then resets.
        The ore hold never falls below its floor and gets louder on its own every other hour, so
        silence buys you time rather than safety.
      </p>
      <h2>Turning it around</h2>
      <p>
        Noise works for you as well. Anything that makes a compartment loud from a distance — a
        scrap charge, a flare, a flashbang — pulls everything that can hear it to somewhere you are
        not. It is the cheapest tool in the game and it is the only one that works on the MOTHER.
      </p>
    </>
  );
}

function Aboard(): React.ReactElement {
  const cap = depthDef(1).boardCap;
  return (
    <>
      <h2>What is aboard</h2>
      <p>
        At most {cap} of them at depth 1, rising to {depthDef(5).boardCap} at depth 5. That is a
        hard cap. When the ship would put another one out and cannot, it makes what is already
        aboard worse instead — a STRAY grows into a HUNTER — or it wakes the hold a little further.
      </p>
      {THREAT_TYPES.map((t) => {
        const d = threatDef(t);
        return (
          <Row key={t} term={`${d.mark}  ${d.name}`} wide>
            {d.unkillable === true ? '' : `${d.hp} to put down · `}
            {d.damage} wound{d.damage === 1 ? '' : 's'} · moves {d.speed} · hears {d.hearing}
            {d.hearing > 90 ? ' (everything)' : ''}. {d.text}
          </Row>
        );
      })}
      <h2>The hold</h2>
      <p>
        The bar on the second readout is how close the MOTHER is to standing up. Every hour fills
        it; noise in the ore hold fills it faster, and so does every time the ship runs out of room
        for another body. When it fills she comes, and nothing you carry can kill her.
      </p>
      <h2>What you can still do about her</h2>
      <p>
        A dropped bulkhead holds her {RULES.motherSealStall} hour while she takes it apart. Flooding
        the vents from the bridge holds her {RULES.motherPurgeStall}. Anything loud in another
        compartment turns her around. None of that is a solution; all of it is hours, and hours are
        what every one of the four routes is short of.
      </p>
      <h2>Seeing and being seen</h2>
      <p>
        You see this compartment and the ones next door. A lower-case, hollow mark on the schematic
        is where you last saw something, not where it is. LISTEN is how you find out.
      </p>
      <p>
        What you <em>can</em> see, you can predict: the line under the schematic says where each of
        them will be if you end the hour now, and whether it reaches you. A wound in this game is
        always a decision you made.
      </p>
    </>
  );
}

function Hurt(): React.ReactElement {
  const t = infectionThreshold(1);
  const inf = CARDS.filter((c) => c.role === 'infection');
  return (
    <>
      <h2>A wound</h2>
      <p>
        Every wound costs two things at once. It takes a capability out of your kit — you choose
        which, and it is gone for the rest of the run — and it puts one more infection into your
        own kit.
      </p>
      <p>
        Infection cannot pay for a wound. It is what the wound leaves behind, not something a wound
        can take away. When there is nothing left you can do, the run ends there.
      </p>
      <h2>Infection</h2>
      <p>
        There is nothing face down about it. The count is on the top strip from the first one. Each
        one costs you something while it is in your hand, none of them can be played, and they come
        back round every time your kit reshuffles.
      </p>
      {inf.map((c) => (
        <Row key={c.id} term={c.name} wide>
          {c.text}
        </Row>
      ))}
      <Row term={`CARRIER AT ${t}`} wide>
        Launch holding {t} or more and you are what gets off the ship. It is the only route the
        count decides, and you can see it coming the whole way.
      </Row>
      <h2>Cutting it out</h2>
      <p>
        The MEDBAY takes one infection out of your kit for good, for {cost('cure')}. No wound, no
        roll, no catch. Some of what you carry does it too — TRIAGE, ANTISEPTIC, a stimulant
        ampoule, a found field kit.
      </p>
      <p className="dim">
        Setting an infection aside costs nothing once an hour and buys the rest of the hour without
        its penalty. It does not remove it. Only the medbay does that.
      </p>
    </>
  );
}

function TheShip(): React.ReactElement {
  return (
    <>
      <h2>What each compartment is for</h2>
      <Row term="REACTOR" wide>
        Repair for {cost('repair')}: one more power an hour, up to {RULES.reactorOutputMax}. It pays
        back every hour after, and the relay cannot be held without it. A CRAWLER standing in here
        chews the output instead of you.
      </Row>
      <Row term="MEDBAY" wide>
        {cost('cure')}. One infection out of your kit for good.
      </Row>
      <Row term="ARMORY" wide>
        {cost('recharge')}. Reloads a weapon you have emptied.
      </Row>
      <Row term="BRIDGE" wide>
        Flood the vents for {cost('purgeVents')} — kills every CRAWLER in the ducts at once and
        holds the MOTHER in there for {RULES.motherPurgeStall} hours. Arm the overload for{' '}
        {cost('armScuttle')}, then survive {fuseTurns(1)} hours with the ship one louder everywhere
        every one of them.
      </Row>
      <Row term="COMMS" wide>
        Broadcast for {cost('beacon')}, then sit at the set for {relayHold(1)} hours at{' '}
        {RULES.systemActions.beacon?.drain ?? 1} power an hour. The watch only runs while you are in
        the room and the pool can pay; an hour anywhere else is an hour it holds where it is rather
        than resetting. Upload the specimen for {cost('upload')}.
      </Row>
      <Row term="ORE HOLD" wide>
        The nest. Cut the specimen free for {cost('takeSpecimen')}. It gets louder here on its own
        every other hour and never falls below its floor.
      </Row>
      <Row term="SHUTTLE BAY" wide>
        Bank power for {cost('chargeShuttle')} — as much of the pool as you like, in one action.
        Launch for {cost('launch')}.
      </Row>
      <Row term="ANY COMPARTMENT" wide>
        Drop a bulkhead for {cost('seal')}, shut for {RULES.systemActions.seal?.turns} hours.
        Nothing walks through it, including you. A CRAWLER goes around it in the ducts.
      </Row>
      <h2>Power</h2>
      <p>
        The reactor is a trickle, not an income: it starts at {depthDef(1).reactorOutputStart} an
        hour and repairs take it to {RULES.reactorOutputMax}. Most of the power in a run is in the
        ship — cells and suits in the compartments you have not searched yet. If you are not
        searching, you are not funding anything.
      </p>
      <p className="dim">The pool holds {RULES.powerCap}. Anything over that is thrown away.</p>
    </>
  );
}

function Deeper(): React.ReactElement {
  return (
    <>
      <h2>The ladder</h2>
      <p>
        Finishing any route at a depth opens the next one. Nothing you unlock makes you stronger;
        it opens harder problems.
      </p>
      {DEPTHS.map((x) => (
        <Row key={x.depth} term={`${x.depth}  ${x.label}`} wide>
          {x.turnLimit} hours · {x.shuttleRequired} to lift · {x.boardCap} aboard at once · hold
          wakes at {x.hiveWake} · relay {x.relayHold}h · fuse {x.fuseTurns}h · carrier at{' '}
          {x.infectionThreshold}
        </Row>
      ))}
      <h2>Roles</h2>
      <p>Each carries different things and has a different answer to the same four routes.</p>
    </>
  );
}

const RENDER: Record<Page, () => React.ReactElement> = {
  'THE FOUR': TheFour,
  'AN HOUR': AnHour,
  NOISE: Noise,
  ABOARD: Aboard,
  HURT: Hurt,
  'THE SHIP': TheShip,
  DEEPER: Deeper,
};

export function Manual({ onClose }: { onClose: () => void }): React.ReactElement {
  const [page, setPage] = useState<Page>('THE FOUR');
  const Body = RENDER[page];
  const i = PAGES.indexOf(page);
  return (
    <div className="modal manual" data-testid="manual">
      <div className="tabs" data-testid="manual-tabs">
        {PAGES.map((p) => (
          <button
            key={p}
            className={`tab${p === page ? ' on' : ''}`}
            data-page={p}
            onClick={() => setPage(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div data-testid="manual-body" data-page={page}>
        <Body />
      </div>
      <div className="row">
        <button disabled={i === 0} onClick={() => setPage(PAGES[Math.max(0, i - 1)] as Page)}>
          ← BACK
        </button>
        <button
          disabled={i === PAGES.length - 1}
          onClick={() => setPage(PAGES[Math.min(PAGES.length - 1, i + 1)] as Page)}
        >
          NEXT →
        </button>
        <button className="primary" data-testid="manual-close" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}

export type { Ending };
