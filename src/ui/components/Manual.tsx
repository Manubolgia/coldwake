import { useState } from 'react';
import { DEPTHS, MAP, ROLES, RULES, depthDef, threatDef } from '../../engine';
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
      <Row term="CLEAN BREAK">Lift with the power banked and clean blood. The best of it.</Row>
      <Row term="CARRIER">Lift infected. You reach the relay and so does it.</Row>
      <Row term="SCUTTLE">Arm the reactor in time and stay aboard. Nothing leaves.</Row>
      <Row term="BEACON">Broadcast, and die anyway. Somebody else opens the hold.</Row>
      <Row term="LOST">Everything else. The orbit closes, or you run out of things you can do.</Row>
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
        Power made each hour. A burrower in the reactor chews this down; the repair puts it back.
      </Legend>
      <Legend term={<b>STILL OUT THERE ▓▓▓▓▓ 5</b>}>
        How much is aboard that has not shown itself yet — <em>including the returns that turn out
        to be nothing</em>. The blocks are the count, not five monsters. Listening replaces it with
        the breakdown for that hour: how many are nothing, moving, heavy, in the ducts, singing.
      </Legend>
      <Legend term={<b>BLOOD ? ▒ █</b>}>
        One mark per sample you are carrying. <b>?</b> unread, <b>▒</b> read and clean, <b>█</b>{' '}
        read and infected. CARRIER appears when you are holding enough infected ones to matter.
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
              D
            </text>
          </Swatch>
        }
      >
        Something is standing there.{' '}
        {THREATS.types.map((t) => `${t.mark} ${t.name.toLowerCase()}`).join(', ')}. Up to three are
        shown. The block fills when it is in the compartment with you.
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
        anything you try. Burrowers live in there.
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
        takes it <em>for the rest of the run</em> — you choose which — and puts panic in the space
        it left. When nothing you can still do is left, neither are you.
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

      <h2>Your blood</h2>
      <p>
        You woke with one sample already in the rack and every wound adds another, all of them
        unread. The medbay reads one at a time, cheaply. Leave with {RULES.carry.carrierThreshold}{' '}
        infected samples aboard and you carry it to the relay — the run looks won and is not.
      </p>
      <p>
        Reading is how you find out which ending you are playing for, and the earlier you find out
        the more you can do about it. Flushing throws a sample away unread at the price of a wound:
        a real cure, expensively. If you learn you are carrying and cannot flush it, the bridge is
        the honest answer.
      </p>
    </>
  );
}

function TheShip(): React.ReactElement {
  const sys = RULES.systemActions;
  const cost = (key: string): string => {
    const d = sys[key];
    if (!d) return '';
    return `${d.ap} time${d.power > 0 ? ` · ${d.power} power` : ''} · +${d.noise} noise`;
  };
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
          cannot cross it either, and burrowers do not care.
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
        Finding out at hour sixteen that you are carrying is finding out too late to do anything.
      </Row>
      <Row wide term="7 · THE VENTS ARE A SHORTCUT, NOT A HIDING PLACE">
        Silent and fast, but you come out blind and you cannot fight in there.
      </Row>
      <Row wide term="8 · SEARCH ON THE WAY, NOT AS AN ERRAND">
        A compartment you were crossing anyway is nearly free. One you doubled back for cost two
        hours and made noise twice.
      </Row>
      <Row wide term="9 · WOUNDS COMPOUND">
        The first costs you a capability. The second costs you a capability and deals you a worse
        hand for the rest of the run.
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
