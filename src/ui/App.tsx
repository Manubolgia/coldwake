import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initialState,
  legalActions,
  reduce,
  setInvariantChecking,
  actionKey,
} from '../engine';
import type { Action, Depth, GameState, NodeId, Objective, RoleId, Uid } from '../engine/types';
import { Boot } from './components/Boot';
import { Commands } from './components/Commands';
import { EndingScreen } from './components/Ending';
import { Hand } from './components/Hand';
import { Manual } from './components/Manual';
import { Menu } from './components/Menu';
import { Forecast, ShipGraph } from './components/ShipGraph';
import { Objectives, Readout, StatusStrip } from './components/Status';
import { Terminal } from './components/Terminal';
import { newAdvisories, type DisplayLine } from './guidance';
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
  // Everything the terminal has said this run: the ship's own output, plus the
  // advisories, which are the interface talking rather than the ship.
  const [lines, setLines] = useState<DisplayLine[]>([]);
  const advised = useRef<Set<string>>(new Set());
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
      const fresh: DisplayLine[] = next.feed.slice(state.feed.length);
      const advice = meta.guidance ? newAdvisories(next, advised.current) : [];
      setLines((l) => [...l, ...fresh, ...advice]);
      // Anything the ship raises its voice about gets the terminal to itself.
      // A quiet turn is one line and does not interrupt anybody.
      const loud = fresh.some((l) => l.kind === 'alarm' || l.kind === 'threat');
      if (!reducedMotion && (loud || advice.length > 0 || fresh.length >= 3)) {
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
    [state, finish, reducedMotion, meta.guidance],
  );

  /** The terminal has caught up: hand the ship back to the player. */
  const onTerminalComplete = useCallback(() => {
    setResolving(false);
    heldState.current = null;
    turnStarted.current = Date.now();
  }, []);

  /**
   * The ending screen goes up once the ship has finished saying what happened.
   *
   * This used to hang off the terminal's completion callback, which only fires
   * when the writing finishes — and under `prefers-reduced-motion` the terminal
   * prints instantly and never signals a completion at all. A run that resolved
   * on a reduced-motion device therefore sat on a dead board for ever: no
   * ending, no score, no way out. Waiting on `resolving` instead covers both
   * paths, and keeps one owner for the transition.
   */
  useEffect(() => {
    if (pendingEnding === null || resolving) return;
    setScreen('ending');
    setPendingEnding(null);
  }, [pendingEnding, resolving]);

  const start = useCallback(
    (seed: string, role: RoleId, depth: Depth, objective: Objective) => {
      const fresh = initialState(seed, role, depth, objective);
      advised.current = new Set();
      setLines([
        ...fresh.feed,
        ...(meta.guidance ? newAdvisories(fresh, advised.current) : []),
      ]);
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
    },
    [meta.guidance],
  );

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
            // Advisories already true on a resumed run are treated as said, so
            // picking a run back up does not bury the player in a backlog.
            advised.current = new Set();
            // Retire everything already true, so a resumed run does not open
            // with a backlog of lessons.
            while (newAdvisories(savedRun, advised.current).length > 0);
            setLines([...savedRun.feed]);
            setState(savedRun);
            setScreen('run');
          }}
          onExport={exportTelemetry}
          onManual={() => setManualOpen(true)}
          onToggleGuidance={() => {
            const next = { ...meta, guidance: !meta.guidance };
            setMeta(next);
            void saveMeta(next);
          }}
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
      <Objectives state={shown} />
      <ShipGraph
        state={shown}
        selected={selectedNode}
        onSelect={(id) => {
          setSelectedCard(null);
          setSelectedNode(selectedNode === id ? null : id);
        }}
      />
      {/* What the contacts you can see will do if you commit the hour. The
          single change that makes a wound a mistake rather than an event. */}
      <Forecast state={shown} />
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
        lines={lines}
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
