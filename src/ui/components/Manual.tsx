import { useState } from 'react';
import { DEPTHS, MAP, ROLES, RULES, depthDef, endingHow, threatDef } from '../../engine';
import type { Ending } from '../../engine/types';
import { THREATS } from '../../engine/content';

/**
 * Everything a player needs, in the ship's voice and in the order it comes up.
 * Nothing here says card, deck, token or bag: the fiction does not know it is
 * a board game and neither does the reader.
 *
 * It is paged rather than scrolled. The whole of it is roughly four screens on
 * a phone, and a wall of four screens is a thing people close rather than read.
 */

const PAGES = [
  'THE RUN',
  'THE SCREEN',
  'AN HOUR',
  'ABOARD',
  'HURT',
  'BLOOD',
  'ENDINGS',
  'THE SHIP',
  'ADVICE',
  'DEEPER',
] as const;
type Page = (typeof PAGES)[number];

/** A stat row whose right-hand side is prose rather than a value. */
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

/**
 * A swatch of a map symbol, drawn with the same class names the schematic uses
 * so the legend cannot drift out of step with the thing it explains: change the
 * colour of a threat block once and both move.
 */
function Swatch({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <svg viewBox="0 0 22 13" className="swatch" aria-hidden="true">
      {children}
    </svg>
  );
}

const BOX = { x: 3, y: 1.5, width: 16, height: 10 };

function Box({ cls = '', label }: { cls?: string; label: string }): React.ReactElement {
  return (
    <>
      <rect {...BOX} className={`node-box${cls}`} />
      <text x={11} y={5.6} textAnchor="middle" className={`node-label${cls}`}>
        {label}
      </text>
    </>
  );
}

/** What a system action costs, in the one format every page prints it in. */
function cost(key: string): string {
  const d = RULES.systemActions[key];
  if (!d) return '';
  return `${d.ap} time${d.power > 0 ? ` · ${d.power} power` : ''} · +${d.noise} noise`;
}

function Legend({ term, children }: { term: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="legend">
      <span className="legend-mark">{term}</span>
      <span className="legend-text">{children}</span>
    </div>
  );
}

function TheRun(): React.ReactElement {
  const d = depthDef(1);
  return (
    <>
      <h2>What you are doing</h2>
      <p>
        You woke because your pod failed. The orbit closes in {d.turnLimit} hours and the shuttle
        will not lift on less than {d.shuttleRequired} power. Get to the shuttle bay with the power
        banked and clean blood, and you live.
      </p>

      <h2>The arithmetic, once</h2>
      <p>
        The reactor makes {RULES.reactorOutputStart} power an hour into a pool that holds only{' '}
        {RULES.powerCap}. So the pool fills in five hours whether you are there or not, and
        anything above {RULES.powerCap} is thrown away. Banking is a single hour at the shuttle bay
        and moves the whole pool at once.
      </p>
      <p>
        That is the whole shape of a run: fill, walk to the bay, empty, walk away — three or four
        times. Everything else you do is bought out of the hours between.
      </p>

      <h2>The first hour</h2>
      <p>
        Leave the cryobay and start crossing toward the shuttle bay. Search compartments you pass
        through while it is quiet. Do not fight anything you can walk away from. When the pool is
        full, go and bank it.
      </p>

      <h2>Ways it ends</h2>
      <p>
        Five, and you are always playing for one of them. Two need you off the ship, two need
        something to leave in your place, and the fifth is what is left. ENDINGS has each one, what
        it means, and exactly what you have to do to get it.
      </p>
      {(Object.keys(RULES.endings) as Ending[]).map((e) => (
        <Row key={e} term={RULES.endings[e].name}>
          {RULES.endings[e].verdict}
        </Row>
      ))}
    </>
  );
}

function TheScreen(): React.ReactElement {
  return (
    <>
      <h2>The top line</h2>
      <p>Four numbers, always there, in that order.</p>
      <Legend term={<b>HOUR 7/20</b>}>
        The hour you are in and the hour the orbit closes. It only goes up.
      </Legend>
      <Legend term={<b>POWER 6</b>}>
        What is in the pool right now. It stops at {RULES.powerCap} — power made above that is
        gone.
      </Legend>
      <Legend term={<b>SHUTTLE 12/34</b>}>
        What you have banked, and what the shuttle needs. It lights up the moment it is enough.
      </Legend>
      <Legend term={<b className="glow">●●○</b>}>
        The three things you can still do this hour. Filled is left, hollow is spent.
      </Legend>

      <h2>The second line</h2>
      <Legend term={<b>REACTOR 2/HR</b>}>
        Power made each hour. A CRAWLER in the reactor chews this down; the repair puts it back.
      </Legend>
      <Legend term={<b>ABOARD 2</b>}>
        How many are on the schematic right now, standing in a compartment you could walk into.
        This is the number that can hurt you this hour.
      </Legend>
      <Legend term={<b>STILL OUT THERE ▓▓▓▓▓ 5 MOSTLY NOTHING</b>}>
        A different number: how much has not shown itself yet, <em>counting everything that turns
        out to be nothing at all</em>. Five blocks is not five of them — at the start of a run most
        of it is the hull. Listening for an hour replaces the blocks with the real breakdown, in the
        same four names the schematic uses.
      </Legend>
      <Legend term={<b>BLOOD ? ▒ █ 1/{RULES.carry.carrierThreshold} INFECTED · 2 UNREAD</b>}>
        One mark per sample of your blood in the rack. <b>?</b> unread, <b>▒</b> read and clean,{' '}
        <b>█</b> read and infected. The fraction is how many infected ones you have confirmed
        against the {RULES.carry.carrierThreshold} that would make lifting off a CARRIER ending. Every
        wound adds a mark. See BLOOD.
      </Legend>
      <Legend term={<b>KIT 9 · LOST 3</b>}>
        Things you can still do, and things a wound has taken from you for good.
      </Legend>

      <h2>The schematic</h2>
      <Legend
        term={
          <Swatch>
            <rect x={1.6} y={0.1} width={18.8} height={12.8} className="player-ring" />
            <Box cls=" here" label="SPB" />
          </Swatch>
        }
      >
        You are here. The bright box with the ring around it.
      </Legend>
      <Legend
        term={
          <Swatch>
            <Box label="MED" />
            <rect x={16} y={3} width={2} height={2} className="node-box here" />
          </Swatch>
        }
      >
        A compartment. The small bright square in the top corner means it opens into the ducts —
        you can get into the vents here, and things can get out here.
      </Legend>
      <Legend
        term={
          <Swatch>
            <Box label="ORE" />
            <rect x={4.2} y={8.4} width={6} height={1.4} className="threat-block hunting" />
            <text x={17.8} y={9.6} textAnchor="end" className="node-noise hot">
              5
            </text>
          </Swatch>
        }
      >
        Noise, as a bar and a number, 0 to {RULES.noiseMax}. It brightens at{' '}
        {RULES.noiseThreshold}, which is where something comes to look — and once something has
        come, that compartment falls quiet again. Otherwise it fades by {RULES.noiseDecay} an hour
        on its own.
      </Legend>
      <Legend
        term={
          <Swatch>
            <Box label="ARM" />
            <rect x={12.4} y={6.5} width={3} height={3} className="threat-block" />
            <text x={12.8} y={8.9} className="node-threat">
              H
            </text>
          </Swatch>
        }
      >
        Something is standing there, and the letter is which of the four:{' '}
        {THREATS.types.map((t) => `${t.mark} for ${t.name}`).join(', ')}. There are only those four
        kinds, however many are aboard. Up to three are shown. The block fills when it is in the
        compartment with you.
      </Legend>
      <Legend
        term={
          <Swatch>
            <line x1={2} y1={6.5} x2={20} y2={6.5} className="edge sealed" />
          </Swatch>
        }
      >
        A dropped bulkhead. Nothing crosses it for three hours — and neither do you. Burrowers
        ignore it.
      </Legend>
      <Legend term={<b>IN THE CRAWLSPACE</b>}>
        Printed under the schematic when you are in the vents. If anything is in there with you, it
        says so.
      </Legend>
      <p>
        Touching a compartment filters the commands down to what leads there. Touch it again, or
        touch the one you are standing in, to see everything.
      </p>

      <h2>At hand</h2>
      <p>
        Each thing you can do shows what it costs before you commit: <b>TIME</b> out of your three,{' '}
        <b>PWR</b> out of the pool, and <b>NOISE</b> it will add to this compartment. Weapons read{' '}
        <b>EMPTY</b> once they have missed. <b>ONE USE</b> means it is gone after you use it.
        Anything the ship will not let you do is not shown at all.
      </p>
    </>
  );
}

function AnHour(): React.ReactElement {
  return (
    <>
      <h2>What an hour buys</h2>
      <p>
        Three actions. Anything you do not use is gone at the end of the hour, and anything still in
        your hands is set aside — your hands are filled again at the top of the next one.
      </p>
      <Row term="WALK TO THE NEXT COMPARTMENT">1 · +2 noise</Row>
      <Row term="CREEP THERE INSTEAD">2 · silent</Row>
      <Row term="LISTEN AT THE BULKHEAD">1 · silent</Row>
      <Row term="SEARCH THIS COMPARTMENT">1 · +2 noise</Row>
      <Row term="SET SOMETHING ASIDE">1 · silent</Row>

      <h2>Noise, and what it brings</h2>
      <p>
        Noise stays in the compartment you made it in and fades by {RULES.noiseDecay} an hour. At{' '}
        {RULES.noiseThreshold} something comes to look — and it arrives <em>in that compartment</em>
        , not in yours, unless you are standing in it. A loud room three compartments behind you is
        a decoy; a loud room you are standing in is a summons.
      </p>
      <p>
        Once something has come, the compartment goes quiet again and has to be made loud a second
        time. So a room you keep working in will call something out roughly every other hour, and
        the count of what is left out there is what tells you how long that can go on.
      </p>
      <p>
        The ore hold is never quiet and gets worse on its own every second hour. It is where they
        come from and where they go back to.
      </p>

      <h2>Listening</h2>
      <p>
        Listening tells you what is still unaccounted for aboard, broken down: how many returns are
        nothing, how many are moving, how many are heavy, how many are inside the walls. It costs an
        hour of your three and makes no sound. It is the only way to know whether the quiet is real.
      </p>
      <p>
        Silence is not safety. Nothing to hear means they are hunting rather than settled, and the
        hold breathes them out whether you are listening or not.
      </p>

      <h2>Searching</h2>
      <p>
        Every compartment holds two things and is empty after that. Searching is loud.
        Cells and stimulants pay for the noise; some of what you turn up does not, and one or two
        things you find are worse than not looking.
      </p>
    </>
  );
}

function Aboard(): React.ReactElement {
  const vents = MAP.nodes.filter((n) => n.vent).map((n) => n.name);
  return (
    <>
      <h2>What is aboard</h2>
      <p>
        Four kinds, and only four, at every depth. A run puts more of them aboard as it goes on,
        never a new kind. These are the names the schematic prints, the names a listen reports and
        the names the ship says out loud — the same word every time.
      </p>
      {THREATS.types.map((t) => (
        <div className="stat note-row" key={t.id}>
          <span>
            {t.name} · {t.hp} TO KILL · {t.damage} TO YOU
          </span>
          <b className="note">{threatDef(t.id).text}</b>
        </div>
      ))}
      <p>
        They move once an hour. You move three times. Running is almost always right, and a dead end
        is not a place to be caught.
      </p>

      <h2>Fighting</h2>
      <p>
        You need a weapon in hand; there is nothing to swing otherwise. A swing rolls a die and adds
        the weapon&rsquo;s reach. Match what it takes to kill, or better, and it dies. Fall short
        and the weapon is empty until the armory refills it — one swing, one chance, and then you
        are holding a bar of metal. Anything working against you is named above the commands before
        you swing, never after.
      </p>

      <h2>The vents</h2>
      <p>
        {vents.join(', ')} open into the ducts. Silent, and they cross the whole ship in two hours,
        which is faster than walking it. Coming out is a gamble: whatever is loose gets a chance to
        be waiting for you, and you cannot swing properly in a duct — {RULES.ventAmbushPenalty} on
        anything you try. CRAWLERS live in there.
      </p>
            <p>
        The bridge can flood the ducts and kill everything in them, which some hours is nothing at
        all. Check what you heard before you spend the power.
      </p>
    </>
  );
}

function Hurt(): React.ReactElement {
  return (
    <>
      <h2>Being hurt</h2>
      <p>
        There is no health here and nothing heals. Every wound takes one thing you could do and
        takes it <em>for the rest of the run</em> — you choose which — puts panic in the space it
        left, and draws a sample of your blood into the rack. When nothing you can still do is
        left, neither are you.
      </p>
      <p>
        <b>Panic can never be the thing you give up.</b> The ship only offers you things you could
        still have used, so the list at a wound is shorter than what is in your hands, and every
        wound genuinely costs you. Hold nothing but panic when one lands and it takes something out
        of your kit at random instead.
      </p>
      <p>
        So wounds compound in three directions at once: the kit gets smaller, the panic in it gets
        thicker, and the rack fills up. Count what you have left. Twelve things is a run; four is an
        ending you had better choose soon.
      </p>

      <h2>Panic</h2>
      <p>
        Panic is not damage, it is weight. It joins your kit permanently and comes back around, so
        every hour after a wound is likelier to deal you a hand with dead space in it. There are
        four kinds and they are not the same.
      </p>
      <Row term="SHAKING">
        &minus;1 on anything you swing, while it is in your hands.
      </Row>
      <Row term="TUNNEL VISION">Listening costs two hours instead of one, while it is in hand.</Row>
      <Row term="COLD SWEAT">Everything noisy you do is one louder, while it is in hand.</Row>
      <Row term="BLACKOUT">Makes its noise the moment it comes to hand, then just sits there.</Row>

      <h2>Setting panic aside</h2>
      <p>
        <b>Setting it aside does not get rid of it.</b> It costs an hour of your three, it does not
        deal you a replacement, and the thing comes back later — all it buys is the rest of{' '}
        <em>this</em> hour without it.
      </p>
      <p>
        So it is worth an hour only when the penalty would cost you more than an hour: shed COLD
        SWEAT before a search or a walk you cannot afford to be heard on, shed TUNNEL VISION when
        you need to listen, shed SHAKING when you are about to swing at something. BLACKOUT has
        already done its damage by the time you can see it — leave it. And at the end of the hour
        everything in your hands is set aside for free anyway, so never spend an hour on panic you
        were about to put down regardless.
      </p>
      <p>
        The only thing that removes panic for good is medicine: TRIAGE, FIELD DRESSING, a stimulant
        found aboard. Those burn it out of your kit permanently.
      </p>
    </>
  );
}

function Blood(): React.ReactElement {
  const t = RULES.carry.carrierThreshold;
  return (
    <>
      <h2>What the rack is</h2>
      <p>
        You woke with one sample of your own blood already in the rack. Every wound after that
        draws another, and they all go in unread — the <b>?</b> marks after BLOOD on the second
        line. Nothing about them touches your body, your kit or your hours. They do exactly one
        thing, and only at the very end.
      </p>

      <h2>The one rule</h2>
      <p>
        When the shuttle lifts, every sample is read. <b>{t} or more infested and you are the
        CARRIER</b> instead of a CLEAN BREAK: you got off, and so did it. Fewer than {t} and you got
        off clean. That is the whole mechanism. It is not damage, it is not a timer, and it cannot
        kill you aboard.
      </p>
      <p>
        Which means the rack is really a question about the <em>ending</em> you are working toward,
        being decided quietly by the hits you take on the way. Take no wounds and it never comes up.
        Take six and it is most of the run.
      </p>

      <h2>Reading, in the medbay</h2>
      <Row wide term="READ ONE">
        {cost('carryScan')}. Turns one <b>?</b> into <b>▒</b> clean or <b>█</b> infected, for good.
        It changes nothing about your blood — it tells you which ending you are already playing for,
        while there are still hours left to do something about it.
      </Row>
      <Row wide term="FLUSH ONE">
        {cost('purgeBlood')}, <em>and a wound</em>. Throws one unread sample away and does not
        replace it. The only cure there is, and it costs you a capability to take it — so it is
        worth it when you already know the rest of the rack is bad, and a waste when you do not.
      </Row>
      <p>
        You can only read or flush a sample you have not read yet. A confirmed infected one is
        yours to keep.
      </p>

      <h2>What to actually do</h2>
      <Row wide term="READ EARLY">
        The medbay is cheap and the news is only useful while you can act on it. Finding out at hour
        sixteen that you are carrying is finding out too late.
      </Row>
      <Row wide term="ONE INFECTED IS A WARNING">
        At {t - 1} confirmed you are one bad hour from the CARRIER ending. Stop taking hits, or flush
        an unread one before the count gets there.
      </Row>
      <Row wide term={`AT ${t} CONFIRMED, CHANGE THE ENDING`}>
        Lifting off now is a delivery. The bridge is the honest answer: arm the overload, stay, and
        let nothing leave. SCUTTLE scores better than CARRIER and is the truthful version of the
        same hour.
      </Row>
    </>
  );
}

function Endings(): React.ReactElement {
  return (
    <>
      <h2>Five endings</h2>
      <p>
        Every run reaches exactly one. Which one is decided by three things only: whether you got
        off the ship, what was in your blood if you did, and what you left running if you did not.
      </p>
      {(Object.keys(RULES.endings) as Ending[]).map((e) => (
        <div className="stat note-row wide" key={e}>
          <span>
            {RULES.endings[e].name} · ×{RULES.endings[e].multiplier}
          </span>
          <b className="note">
            {RULES.endings[e].verdict} <em>{endingHow(e)}</em>
          </b>
        </div>
      ))}

      <h2>The order they are checked in</h2>
      <p>
        This is what decides a run that does not end at the shuttle, and it is worth knowing before
        the last hour rather than after it.
      </p>
      <Row wide term="1 · DID YOU LAUNCH?">
        Then it is CLEAN BREAK or CARRIER, and your blood picks which. Nothing else is considered.
      </Row>
      <Row wide term="2 · IS THE OVERLOAD RUNNING?">
        Armed, and enough hours have passed for it to reach critical: SCUTTLE, whether the window
        closed on you or something finished you. Armed too late to go off counts for nothing.
      </Row>
      <Row wide term="3 · DID YOU BROADCAST?">BEACON. The record gets out; you do not.</Row>
      <Row wide term="4 · OTHERWISE">LOST.</Row>
      <p>
        So SCUTTLE and BEACON are things you set up <em>hours earlier</em> and then die into. Neither
        can be chosen in the hour it is needed — the overload takes{' '}
        {RULES.systemActions.armScuttle?.fuseTurns ?? 3} hours to build and the whole pool, and the
        broadcast is the loudest thing on the ship. Decide which one you are holding in reserve at
        about the halfway mark.
      </p>

      <h2>The score</h2>
      <p>
        Everything you did is added up — power banked, compartments searched, things put down, hours
        survived, what you still had at the end — and then multiplied by the ending. That multiplier
        is the whole reason the endings are ranked: a huge run that ends CARRIER (×
        {RULES.endings.carrier.multiplier}) scores under a modest one that ends CLEAN BREAK (×
        {RULES.endings.clean_break.multiplier}).
      </p>
    </>
  );
}

function TheShip(): React.ReactElement {
  const sys = RULES.systemActions;
  return (
    <>
      <h2>What each compartment is for</h2>
      <p>
        Every compartment can be searched. These are the things only one place can do, and what they
        cost.
      </p>
      <div className="stat note-row wide">
        <span>SHUTTLE BAY · bank power</span>
        <b className="note">
          {cost('chargeShuttle')}. One hour however much you move, so never bank a half-full pool
          when a full one is two hours away.
        </b>
      </div>
      <div className="stat note-row wide">
        <span>REACTOR · repair</span>
        <b className="note">
          {cost('repair')}. Only worth it when the output is down, and it is next door to the hold.
        </b>
      </div>
      <div className="stat note-row wide">
        <span>ANY SPINE · drop a bulkhead</span>
        <b className="note">
          {cost('seal')}, holds {sys.seal?.turns ?? 3} hours. A wall between you and something. You
          cannot cross it either, and CRAWLERS do not care.
        </b>
      </div>
      <div className="stat note-row wide">
        <span>MEDBAY · read your blood</span>
        <b className="note">{cost('carryScan')}. Cheap. Tells you which ending you are playing for.</b>
      </div>
      <div className="stat note-row wide">
        <span>MEDBAY · flush your blood</span>
        <b className="note">
          {cost('purgeBlood')}, and a wound. Throws away one sample unread. The only cure.
        </b>
      </div>
      <div className="stat note-row wide">
        <span>ARMORY · refill a weapon</span>
        <b className="note">{cost('recharge')}. Only if you intend to fight again.</b>
      </div>
      <div className="stat note-row wide">
        <span>BRIDGE · flood the vents</span>
        <b className="note">
          {cost('purgeVents')}. Kills whatever is in the ducts. Expensive; worth it when the walls
          are busy.
        </b>
      </div>
      <div className="stat note-row wide">
        <span>COMMS · broadcast</span>
        <b className="note">
          {cost('beacon')}. Cheap insurance and extremely loud. Somebody else comes and opens the
          hold.
        </b>
      </div>
      <div className="stat note-row wide">
        <span>BRIDGE · arm the reactor</span>
        <b className="note">
          {cost('armScuttle')} — the whole pool — and {sys.armScuttle?.fuseTurns ?? 3} hours to
          build. Decide before you have failed, not after.
        </b>
      </div>
    </>
  );
}

function Advice(): React.ReactElement {
  return (
    <>
      <h2>Ten things worth knowing</h2>
      <Row wide term="1 · COUNT BACKWARD FROM THE BAY">
        Work out the hour you must be walking to the shuttle bay by, and treat everything before it
        as spare. Most runs are lost two hours out, not in a fight.
      </Row>
      <Row wide term="2 · NOISE IS A TOOL">
        Something arrives where the noise is, not where you are. A loud room behind you buys the
        quiet in front of you.
      </Row>
      <Row wide term="3 · CREEPING IS OFTEN CHEAPER">
        Two hours and silence beats one hour and a contact walking into you next hour.
      </Row>
      <Row wide term="4 · NEVER OVERFILL THE POOL">
        Power made above {RULES.powerCap} is thrown away. If the pool is nearly full, be near the
        bay.
      </Row>
      <Row wide term="5 · ONE SWING, THEN NOTHING">
        A miss empties the weapon. Do not open a fight you cannot finish or walk away from.
      </Row>
      <Row wide term="6 · READ YOUR BLOOD EARLY">
        The rack decides which of the two launch endings you get, and nothing else. Finding out at
        hour sixteen that you are carrying is finding out too late to do anything.
      </Row>
      <Row wide term="7 · THE VENTS ARE A SHORTCUT, NOT A HIDING PLACE">
        Silent and fast, but you come out blind and you cannot fight in there.
      </Row>
      <Row wide term="8 · SEARCH ON THE WAY, NOT AS AN ERRAND">
        A compartment you were crossing anyway is nearly free. One you doubled back for cost two
        hours and made noise twice.
      </Row>
      <Row wide term="9 · WOUNDS COMPOUND">
        The first costs you a capability, thickens your kit with panic, and puts a sample in the
        rack. The second does all three again, out of a smaller kit. Panic cannot pay for either.
      </Row>
      <Row wide term="10 · DECIDE THE ENDING EARLY">
        The reactor takes three hours to arm and the whole pool. By the time scuttling is obviously
        right, it is usually no longer possible.
      </Row>
      <p>
        The narrator that explains things as they come up can be turned off from the bay. It says
        each thing once and never twice.
      </p>
    </>
  );
}

function Deeper(): React.ReactElement {
  return (
    <>
      <h2>Who you can be</h2>
      {ROLES.map((r) => (
        <div className="stat note-row" key={r.id}>
          <span>{r.name}</span>
          <b className="note">
            {r.strength} {r.weakness}
          </b>
        </div>
      ))}

      <h2>Deeper runs</h2>
      <p>
        Depth changes the window, the price of the shuttle, how much of what is aboard is infected,
        and how much of it is already awake when you open your eyes.
      </p>
      {DEPTHS.map((x) => (
        <div className="stat" key={x.depth}>
          <span>
            {x.depth} · {x.label}
          </span>
          <b>
            {x.turnLimit}h · {x.shuttleRequired} power · {x.carry.infested} in 12 infected
          </b>
        </div>
      ))}
      <p>
        Compartments never change and neither do the things aboard. What changes is how much time
        you have to be wrong in.
      </p>
    </>
  );
}

const RENDER: Record<Page, () => React.ReactElement> = {
  'THE RUN': TheRun,
  'THE SCREEN': TheScreen,
  'AN HOUR': AnHour,
  ABOARD: Aboard,
  HURT: Hurt,
  BLOOD: Blood,
  ENDINGS: Endings,
  'THE SHIP': TheShip,
  ADVICE: Advice,
  DEEPER: Deeper,
};

export function Manual({ onClose }: { onClose: () => void }): React.ReactElement {
  const [page, setPage] = useState<Page>('THE RUN');
  const Body = RENDER[page];
  return (
    <div className="modal" data-testid="manual">
      <div className="title glow" style={{ fontSize: '20px' }}>
        OPERATIONS
      </div>
      <div className="rule">{'─'.repeat(40)}</div>
      <div className="tabs" data-testid="manual-tabs">
        {PAGES.map((p) => (
          <button
            key={p}
            className={`tab${p === page ? ' on' : ''}`}
            data-page={p}
            aria-pressed={p === page}
            onClick={() => setPage(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div data-testid="manual-body" data-page={page}>
        <Body />
      </div>

      <div className="row" style={{ marginTop: '8px' }}>
        <button className="cmd primary" onClick={onClose} data-testid="manual-close">
          <span className="glow">CLOSE</span>
        </button>
      </div>
    </div>
  );
}
