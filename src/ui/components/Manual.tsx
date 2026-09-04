import { DEPTHS, MAP, RULES, depthDef, threatDef } from '../../engine';
import { THREATS } from '../../engine/content';

/**
 * Everything a player needs, in the ship's voice and in the order it comes up.
 * Nothing here says card, deck, token or bag: the fiction does not know it is
 * a board game and neither does the reader.
 */
export function Manual({ onClose }: { onClose: () => void }): React.ReactElement {
  const d = depthDef(1);
  const vents = MAP.nodes.filter((n) => n.vent).map((n) => n.name);
  return (
    <div className="modal" data-testid="manual">
      <div className="title glow" style={{ fontSize: '20px' }}>
        OPERATIONS
      </div>
      <div className="rule">{'─'.repeat(40)}</div>

      <h2>What you are doing</h2>
      <p>
        The orbit closes in {d.turnLimit} hours. The shuttle will not lift on less than{' '}
        {d.shuttleRequired} power. The reactor makes 2 an hour into a pool that holds only 10, so
        you walk to the shuttle bay, bank the pool, and walk away — three or four times, over the
        whole run. Everything else you do is bought out of that arithmetic.
      </p>

      <h2>The first hour</h2>
      <p>
        Head out of the cryobay and start crossing toward the shuttle bay. Search compartments you
        pass through if the noise is low. Do not fight anything you can walk away from. When the
        pool is full, bank it.
      </p>

      <h2>What an hour buys</h2>
      <p>
        Three actions. Anything you do not use is gone at the end of the hour, and anything still
        in your hands is set aside.
      </p>
      <div className="stat">
        <span>WALK TO THE NEXT COMPARTMENT</span>
        <b>1 · loud</b>
      </div>
      <div className="stat">
        <span>CREEP THERE INSTEAD</span>
        <b>2 · silent</b>
      </div>
      <div className="stat">
        <span>LISTEN</span>
        <b>1 · silent</b>
      </div>
      <div className="stat">
        <span>SEARCH THIS COMPARTMENT</span>
        <b>1 · loud</b>
      </div>
      <div className="stat">
        <span>SET SOMETHING ASIDE</span>
        <b>1 · silent</b>
      </div>

      <h2>Noise, and what it brings</h2>
      <p>
        Noise stays in the compartment you made it in and fades by one an hour. At{' '}
        {RULES.noiseThreshold} something comes to look — and it arrives in that compartment, not
        yours, unless you are standing in it. Every command shows what it will cost you in noise
        before you commit to it. The ore hold is never quiet and gets worse on its own every second
        hour.
      </p>
      <p>
        Listening tells you what is still unaccounted for aboard: how many returns are nothing, how
        many are moving, how many are heavy, how many are inside the walls.
      </p>

      <h2>What is aboard</h2>
      {THREATS.types.map((t) => (
        <div className="stat" key={t.id}>
          <span>
            {t.name} · {t.hp} TO KILL · {t.damage} TO YOU
          </span>
          <b style={{ maxWidth: '56%', textAlign: 'right', fontSize: '11px' }}>
            {threatDef(t.id).text}
          </b>
        </div>
      ))}
      <p>
        They move once an hour. You move three times. Running is usually right; a dead end is not a
        place to be caught.
      </p>

      <h2>Being hurt</h2>
      <p>
        There is no health here. Every wound takes something you could do and takes it for the rest
        of the run, and puts panic in the space it left. Panic occupies your hands and does nothing
        — setting it aside costs an hour. When nothing you can do is left, neither are you.
      </p>

      <h2>What you carry</h2>
      <div className="stat">
        <span>WEAPONS</span>
        <b style={{ maxWidth: '60%', textAlign: 'right', fontSize: '11px' }}>
          Roll against what you are hitting. A miss empties it until the armory refills it.
        </b>
      </div>
      <div className="stat">
        <span>ONE USE</span>
        <b style={{ maxWidth: '60%', textAlign: 'right', fontSize: '11px' }}>
          Gone after you use it. These are the ones that get you out of something.
        </b>
      </div>
      <div className="stat">
        <span>FOUND ABOARD</span>
        <b style={{ maxWidth: '60%', textAlign: 'right', fontSize: '11px' }}>
          Cells and stimulants are worth the noise of searching. Some of it is not.
        </b>
      </div>

      <h2>The ship, and when it is worth it</h2>
      <div className="stat">
        <span>REACTOR · repair</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          Only when output is down. Loud, and next door to the hold.
        </b>
      </div>
      <div className="stat">
        <span>ANY SPINE · drop a bulkhead</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          Three hours of wall between you and something. You cannot cross it either.
        </b>
      </div>
      <div className="stat">
        <span>BRIDGE · flood the vents</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          Kills whatever is in the ducts. Expensive; worth it if the walls are busy.
        </b>
      </div>
      <div className="stat">
        <span>MEDBAY · read your blood</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          Cheap. Tells you which ending you are playing for.
        </b>
      </div>
      <div className="stat">
        <span>MEDBAY · flush your blood</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          Throws away a sample unread, at the price of a wound. A real cure, expensively.
        </b>
      </div>
      <div className="stat">
        <span>ARMORY · refill a weapon</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          Only if you intend to fight again.
        </b>
      </div>
      <div className="stat">
        <span>SHUTTLE BAY · bank power</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          One hour however much you move, so always move all of it.
        </b>
      </div>
      <div className="stat">
        <span>COMMS · broadcast</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          Cheap insurance, extremely loud. Somebody else opens the hold.
        </b>
      </div>
      <div className="stat">
        <span>BRIDGE · arm the reactor</span>
        <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>
          Costs the whole pool and needs {RULES.systemActions.armScuttle?.fuseTurns ?? 3} hours to
          build. Decide before you have failed, not after.
        </b>
      </div>

      <h2>Your blood</h2>
      <p>
        You woke with a sample already in the rack and every wound adds another, all of them
        unread. The medbay reads one at a time. Leave with {RULES.carry.carrierThreshold} infected
        samples aboard and you carry it to the relay — the run looks won and is not. If you learn
        that early enough, the bridge is the honest answer.
      </p>

      <h2>The vents</h2>
      <p>
        {vents.join(', ')} open into the ducts. Silent, and they cross the whole ship in two hours.
        Coming out is a gamble: whatever is loose gets a chance to be waiting, and you cannot swing
        properly in a duct.
      </p>

      <h2>Ways off</h2>
      <p>
        <b>CLEAN BREAK</b> — lift with the power banked and clean blood. <b>CARRIER</b> — lift
        infected. <b>SCUTTLE</b> — arm the reactor in time and stay aboard; nothing leaves.{' '}
        <b>BEACON</b> — broadcast and die anyway. <b>LOST</b> — everything else.
      </p>

      <h2>Deeper runs</h2>
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

      <div className="row" style={{ marginTop: '8px' }}>
        <button className="cmd primary" onClick={onClose} data-testid="manual-close">
          <span className="glow">CLOSE</span>
        </button>
      </div>
    </div>
  );
}
