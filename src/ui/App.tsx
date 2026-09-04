import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initialState,
  legalActions,
  reduce,
  setInvariantChecking,
  actionKey,
} from '../engine';
import type { Action, Depth, GameState, NodeId, RoleId, Uid } from '../engine/types';
import { Boot } from './components/Boot';
import { Commands } from './components/Commands';
import { EndingScreen } from './components/Ending';
import { Hand } from './components/Hand';
import { Manual } from './components/Manual';
import { Menu } from './components/Menu';
import { ShipGraph } from './components/ShipGraph';
import { Readout, StatusStrip } from './components/Status';
import { Terminal } from './components/Terminal';
import { useReducedMotion } from './hooks';
import {
  DEFAULT_META,
  applyUnlocks,
  dailySeed,
  loadMeta,
  loadRun,
  loadTelemetry,
  pushTelemetry,
  saveMeta,
  saveRun,
  updateLastTelemetry,
  type Meta,
  type RunTelemetry,
} from './persistence';

// The production bundle trusts the engine; the sim and the test suite are where
// the invariants are enforced.
setInvariantChecking(import.meta.env.DEV);

type Screen = 'boot' | 'menu' | 'run' | 'ending';

export function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('boot');
  const [meta, setMeta] = useState<Meta>(DEFAULT_META);
  const [state, setState] = useState<GameState | null>(null);
  const [savedRun, setSavedRun] = useState<GameState | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [selectedCard, setSelectedCard] = useState<Uid | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  // The terminal is mid-sentence: the commands stand down until it finishes.
  const [resolving, setResolving] = useState(false);
  const [pendingEnding, setPendingEnding] = useState<GameState | null>(null);
  // What the panels show while the terminal is still talking: the ship the
  // player last saw, so the readout catches up to the text and not before it.
  const heldState = useRef<GameState | null>(null);
  const reducedMotion = useReducedMotion();
  const turnStarted = useRef<number>(Date.now());
  const telemetry = useRef<RunTelemetry | null>(null);

  useEffect(() => {
    void (async () => {
      const m = await loadMeta();
      setMeta(m);
      setSavedRun(await loadRun());
    })();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.crt = meta.crt ? 'on' : 'off';
  }, [meta.crt]);

  const actions = useMemo(() => (state ? legalActions(state) : []), [state]);

  // The whole state, exposed for the end-to-end parity gate (§13, 5.3) and for
  // bug reports: a seed plus a log is a complete description of a run.
  useEffect(() => {
    (window as unknown as { __coldwake?: unknown }).__coldwake = { state, actions };
  }, [state, actions]);

  const finish = useCallback(
    async (finished: GameState) => {
      const r = finished.result;
      if (!r) return;
      const next = applyUnlocks(meta, r.ending, finished.depth, r.score, finished.role);
      if (finished.seed === dailySeed()) {
        next.daily = { ...next.daily, [finished.seed]: { score: r.score, ending: r.ending } };
      }
      setMeta(next);
      await saveMeta(next);
      await saveRun(null);
      setSavedRun(null);
      await updateLastTelemetry({
        finished: Date.now(),
        ending: r.ending,
        score: r.score,
        turnMs: telemetry.current?.turnMs ?? [],
        actions: telemetry.current?.actions ?? {},
      });
      // The ship says what happened before the epilogue does.
      setPendingEnding(finished);
    },
    [meta],
  );

  const act = useCallback(
    (action: Action) => {
      if (!state) return;
      let next: GameState;
      try {
        next = reduce(state, action);
      } catch {
        return;
      }
      if (telemetry.current) {
        const key = actionKey(action);
        telemetry.current.actions[key] = (telemetry.current.actions[key] ?? 0) + 1;
      }
      // Anything the ship raises its voice about gets the terminal to itself.
      // A quiet turn is one line and does not interrupt anybody.
      const fresh = next.feed.slice(state.feed.length);
      const loud = fresh.some((l) => l.kind === 'alarm' || l.kind === 'threat');
      if (!reducedMotion && (loud || fresh.length >= 3)) {
        heldState.current = state;
        setResolving(true);
      }
      if (action.t === 'endTurn') {
        if (telemetry.current) telemetry.current.turnMs.push(Date.now() - turnStarted.current);
        void saveRun(next.status === 'active' ? next : null);
      }
      setSelectedCard(null);
      setSelectedNode(null);
      setState(next);
      if (next.status !== 'active') void finish(next);
    },
    [state, finish, reducedMotion],
  );

  /** The terminal has caught up: hand the ship back to the player. */
  const onTerminalComplete = useCallback(() => {
    setResolving(false);
    heldState.current = null;
    turnStarted.current = Date.now();
    if (pendingEnding !== null) {
      setScreen('ending');
      setPendingEnding(null);
    }
  }, [pendingEnding]);

  const start = useCallback((seed: string, role: RoleId, depth: Depth) => {
    const fresh = initialState(seed, role, depth);
    telemetry.current = {
      seed,
      role,
      depth,
      started: Date.now(),
      turnMs: [],
      actions: {},
    };
    void pushTelemetry(telemetry.current);
    turnStarted.current = Date.now();
    setState(fresh);
    setScreen('run');
    void saveRun(fresh);
  }, []);

  const exportTelemetry = useCallback(() => {
    void (async () => {
      const all = await loadTelemetry();
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'coldwake-telemetry.json';
      a.click();
      URL.revokeObjectURL(url);
    })();
  }, []);

  // Record where a run was abandoned rather than finished (§10).
  useEffect(() => {
    const onHide = (): void => {
      if (screen === 'run' && state?.status === 'active') {
        void updateLastTelemetry({ abandonedAtTurn: state.turn });
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [screen, state]);

  if (screen === 'boot') {
    return (
      <>
        <Boot
          instant={meta.bootSeen || reducedMotion}
          onDone={() => {
            if (!meta.bootSeen) {
              const next = { ...meta, bootSeen: true };
              setMeta(next);
              void saveMeta(next);
            }
            setScreen('menu');
          }}
        />
        <div className="crt-overlay" />
      </>
    );
  }

  if (screen === 'menu' || !state) {
    return (
      <>
        <Menu
          meta={meta}
          hasSavedRun={savedRun !== null}
          onStart={start}
          onResume={() => {
            if (!savedRun) return;
            telemetry.current = {
              seed: savedRun.seed,
              role: savedRun.role,
              depth: savedRun.depth,
              started: Date.now(),
              turnMs: [],
              actions: {},
            };
            void pushTelemetry(telemetry.current);
            setState(savedRun);
            setScreen('run');
          }}
          onExport={exportTelemetry}
          onManual={() => setManualOpen(true)}
          onToggleCrt={() => {
            const next = { ...meta, crt: !meta.crt };
            setMeta(next);
            void saveMeta(next);
          }}
        />
        {manualOpen ? <Manual onClose={() => setManualOpen(false)} /> : null}
        <div className="crt-overlay" />
      </>
    );
  }

  if (screen === 'ending') {
    return (
      <>
        <EndingScreen
          state={state}
          onSurvey={(survey) => void updateLastTelemetry({ survey })}
          onDone={() => {
            setState(null);
            setScreen('menu');
          }}
        />
        <div className="crt-overlay" />
      </>
    );
  }

  const shown = resolving && heldState.current !== null ? heldState.current : state;

  return (
    <>
      <StatusStrip
        state={shown}
        instant={reducedMotion}
        onMenu={() => {
          void saveRun(state);
          setSavedRun(state);
          setScreen('menu');
        }}
      />
      <ShipGraph
        state={shown}
        selected={selectedNode}
        onSelect={(id) => {
          setSelectedCard(null);
          setSelectedNode(selectedNode === id ? null : id);
        }}
      />
      <Readout state={shown} />
      {resolving ? null : (
        <Commands
          state={state}
          actions={actions}
          selectedNode={selectedNode}
          selectedCard={selectedCard}
          onAct={act}
        />
      )}
      <Terminal
        lines={state.feed}
        resolving={resolving}
        instant={reducedMotion}
        onComplete={onTerminalComplete}
      />
      {resolving ? null : (
        <Hand
          state={state}
          selected={selectedCard}
          onSelect={(uid) => {
            setSelectedNode(null);
            setSelectedCard(uid);
          }}
        />
      )}
      <div className="crt-overlay" />
    </>
  );
}
