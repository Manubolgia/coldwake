import { DEPTHS, MAP, RULES, THREATS, depthDef, threatDef } from '../../engine';

/** The whole ruleset, in the ship's voice. Enough to play without the document. */
export function Manual({ onClose }: { onClose: () => void }): React.ReactElement {
  const d = depthDef(1);
  return (
    <div className="modal" data-testid="manual">
      <div className="title glow" style={{ fontSize: '20px' }}>
        OPERATIONS
      </div>
      <div className="rule">{'─'.repeat(40)}</div>

      <h2>The run</h2>
      <p>
        {d.turnLimit} turns before the orbit closes. The shuttle launches at{' '}
        {d.shuttleRequired} power banked. Every turn: draw to {RULES.handSize}, spend{' '}
        {RULES.apPerTurn} AP, then noise resolves, then everything aboard moves, then the reactor
        pays out.
      </p>

      <h2>Noise</h2>
      <p>
        Every action you take is loud somewhere. A node at {RULES.noiseThreshold} noise or more
        draws a token from the bag and whatever comes out arrives there. Noise falls by 1 a turn.
        The ore hold never falls below {d.oreHoldFloor}, and every second turn it gets worse on its
        own.
      </p>

      <h2>The bag</h2>
      <p>
        {THREATS.bag.blank} blanks and {THREATS.bag.contact + THREATS.bag.drifter + THREATS.bag.burrower}{' '}
        threats to start. A blank means nothing appears — and pulls another contact into the bag.
        Quiet is not free. LISTEN reads the bag for a turn.
      </p>

      <h2>What is aboard</h2>
      {THREATS.types.map((t) => (
        <div className="stat" key={t.id}>
          <span>
            {t.name} · {t.hp} HP · {t.damage} DMG
          </span>
          <b style={{ maxWidth: '58%', textAlign: 'right', fontSize: '11px' }}>{threatDef(t.id).text}</b>
        </div>
      ))}

      <h2>Damage</h2>
      <p>
        There is no health bar. Every wound burns a card out of your deck for good and shuffles a
        panic card in. You die when nothing but panic remains. Your deck is your health, and it only
        gets worse.
      </p>

      <h2>CARRY</h2>
      <p>
        You are holding face-down blood samples: one to start, one more per wound. Scan them in the
        medbay to read one. Purge one, at the cost of a wound, to be rid of it unread. Launch
        holding {RULES.carry.carrierThreshold} or more infested and you are the Carrier.
      </p>

      <h2>The vents</h2>
      <p>
        {MAP.nodes.filter((n) => n.vent).map((n) => n.name).join(', ')} have vent access. Silent, and
        it connects any two of them — but coming out draws from the bag, and whatever you meet in
        the dark hits you at {RULES.ventAmbushPenalty} to your rolls.
      </p>

      <h2>Ways off</h2>
      <p>
        CLEAN BREAK — launch clean. CARRIER — launch infected. SCUTTLE — arm the reactor at the
        bridge, {RULES.systemActions.armScuttle?.fuseTurns ?? 0} turns before the end, and stay.
        BEACON — broadcast from comms and die anyway. LOST — everything else.
      </p>

      <h2>Depths</h2>
      {DEPTHS.map((x) => (
        <div className="stat" key={x.depth}>
          <span>
            {x.depth} · {x.label}
          </span>
          <b>
            {x.turnLimit} turns · {x.shuttleRequired} power · {x.carry.infested}/12 infested
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
