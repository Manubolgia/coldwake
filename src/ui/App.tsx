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
import { Menu } from './components/Menu';
import { ShipGraph } from './components/ShipGraph';
import { Feed, Readout, StatusStrip } from './components/Status';
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

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('boot');
  const [meta, setMeta] = useState<Meta>(DEFAULT_META);
  const [state, setState] = useState<GameState | null>(null);
  const [savedRun, setSavedRun] = useState<GameState | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [selectedCard, setSelectedCard] = useState<Uid | null>(null);
  const [drawBanner, setDrawBanner] = useState<string | null>(null);
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
      setScreen('ending');
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
      if (action.t === 'endTurn') {
        const drew = next.stats.bagDraws - state.stats.bagDraws;
        if (drew > 0) {
          const line = next.feed
            .slice(state.feed.length)
            .find((l) => l.text.startsWith('>> ') && (l.kind === 'threat' || l.text.includes('NO CONTACT')));
          if (line) {
            setDrawBanner(line.text.replace('>> ', ''));
            window.setTimeout(() => setDrawBanner(null), prefersReducedMotion() ? 1 : 900);
          }
        }
        if (telemetry.current) telemetry.current.turnMs.push(Date.now() - turnStarted.current);
        turnStarted.current = Date.now();
        void saveRun(next.status === 'active' ? next : null);
      }
      setSelectedCard(null);
      setSelectedNode(null);
      setState(next);
      if (next.status !== 'active') void finish(next);
    },
    [state, finish],
  );

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
          instant={meta.bootSeen || prefersReducedMotion()}
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
          onToggleCrt={() => {
            const next = { ...meta, crt: !meta.crt };
            setMeta(next);
            void saveMeta(next);
          }}
        />
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

  return (
    <>
      <StatusStrip
        state={state}
        onMenu={() => {
          void saveRun(state);
          setSavedRun(state);
          setScreen('menu');
        }}
      />
      <ShipGraph
        state={state}
        selected={selectedNode}
        onSelect={(id) => {
          setSelectedCard(null);
          setSelectedNode(selectedNode === id ? null : id);
        }}
      />
      <Readout state={state} />
      <Commands
        state={state}
        actions={actions}
        selectedNode={selectedNode}
        selectedCard={selectedCard}
        onAct={act}
      />
      <Feed state={state} />
      <Hand
        state={state}
        selected={selectedCard}
        onSelect={(uid) => {
          setSelectedNode(null);
          setSelectedCard(uid);
        }}
      />
      {drawBanner !== null ? (
        <div className="modal" data-testid="draw-banner" onClick={() => setDrawBanner(null)}>
          <div className="rule">{'─'.repeat(40)}</div>
          <div className="draw-result glow alarm">{drawBanner}</div>
          <div className="rule">{'─'.repeat(40)}</div>
        </div>
      ) : null}
      <div className="crt-overlay" />
    </>
  );
}
