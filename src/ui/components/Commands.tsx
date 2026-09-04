import { actionCost, cardIdOf, cardOf, describe, node } from '../../engine';
import type { Action, GameState, NodeId, Uid } from '../../engine/types';

type Group = 'MOVEMENT' | 'THIS NODE' | 'SYSTEMS' | 'CARDS' | 'TURN' | 'WOUND';

function groupOf(a: Action): Group {
  switch (a.t) {
    case 'move':
    case 'creep':
    case 'ventEnter':
    case 'ventExit':
      return 'MOVEMENT';
    case 'listen':
    case 'search':
      return 'THIS NODE';
    case 'play':
    case 'discard':
      return 'CARDS';
    case 'burn':
      return 'WOUND';
    case 'endTurn':
      return 'TURN';
    default:
      return 'SYSTEMS';
  }
}

const ORDER: Group[] = ['WOUND', 'THIS NODE', 'SYSTEMS', 'MOVEMENT', 'CARDS', 'TURN'];

function targetNode(a: Action): NodeId | undefined {
  if ('to' in a && typeof a.to === 'string') return a.to;
  if (a.t === 'seal') return a.edge[1];
  if (a.t === 'play' && a.edge) return a.edge[1];
  return undefined;
}

function uidOf(a: Action): Uid | undefined {
  return 'uid' in a ? a.uid : undefined;
}

export function costLabel(state: GameState, a: Action): string {
  const c = actionCost(state, a);
  const parts: string[] = [];
  if (c.ap > 0) parts.push(`AP ${c.ap}`);
  if (c.power > 0) parts.push(`PWR ${c.power}`);
  parts.push(`NOISE +${c.noise}`);
  return parts.join('  ');
}

export function Commands({
  state,
  actions,
  selectedNode,
  selectedCard,
  onAct,
}: {
  state: GameState;
  actions: Action[];
  selectedNode: NodeId | null;
  selectedCard: Uid | null;
  onAct: (a: Action) => void;
}): React.ReactElement {
  let visible = actions;
  if (selectedCard !== null) {
    visible = actions.filter((a) => uidOf(a) === selectedCard || a.t === 'endTurn');
  } else if (selectedNode !== null && selectedNode !== state.player.node) {
    visible = actions.filter((a) => targetNode(a) === selectedNode);
  }

  const groups = ORDER.map((g) => ({
    g,
    // Plays before discards: shedding a card is the fallback, not the offer.
    items: visible
      .filter((a) => groupOf(a) === g)
      .sort((a, b) => (a.t === 'play' ? 0 : 1) - (b.t === 'play' ? 0 : 1)),
  })).filter((x) => x.items.length > 0);

  return (
    <div className="commands" data-testid="commands">
      {state.phase === 'wound' ? (
        <div className="group-label alarm">
          WOUND — BURN A CARD ({state.player.pendingWounds} OUTSTANDING)
        </div>
      ) : null}
      {selectedNode !== null && selectedNode !== state.player.node ? (
        <div className="group-label">TARGET: {node(selectedNode).name}</div>
      ) : null}
      {selectedCard !== null ? (
        <div className="group-label">CARD: {cardOf(selectedCard).name}</div>
      ) : null}

      {groups.map(({ g, items }) => (
        <div key={g}>
          <div className="group-label">{g}</div>
          {items.map((a, i) => (
            <button
              key={`${g}-${i}-${JSON.stringify(a)}`}
              className={`cmd${a.t === 'launch' || a.t === 'endTurn' ? ' primary' : ''}`}
              data-action={a.t}
              data-card={uidOf(a) ? cardIdOf(uidOf(a) as Uid) : undefined}
              onClick={() => onAct(a)}
            >
              <span className="glow">{describe(a)}</span>
              <span className="cost">{costLabel(state, a)}</span>
            </button>
          ))}
        </div>
      ))}
      {visible.length === 0 ? <div className="group-label">NO ACTIONS FOR THAT TARGET</div> : null}
    </div>
  );
}
