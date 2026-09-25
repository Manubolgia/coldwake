import { useCallback, useEffect, useRef, useState } from 'react';
import { visibleCreatures } from '../game/actions';
import { begin, dropItem, newGame, reduce } from '../game/engine';
import { distances } from '../game/map';
import type { Action, GameState } from '../game/types';
import { audio } from './audio';
import { Ending } from './components/Ending';
import { Game } from './components/Game';
import { HowTo, Memorial } from './components/HowTo';
import { Setup } from './components/Setup';
import { Title } from './components/Title';
import { loadGame, loadProfile, recordRun, saveGame, saveProfile, type Profile, type Settings } from './persistence';

type Screen = 'title' | 'setup' | 'game' | 'ending' | 'howto' | 'memorial';

function tensionOf(s: GameState): number {
  if (s.status !== 'playing') return 0;
  const dist = distances(s, s.player.room);
  let t = 0;
  for (const c of visibleCreatures(s)) {
    const d = dist[c.room] ?? 99;
    t = Math.max(t, d === 0 ? 3 : d === 1 ? 2 : d === 2 ? 1 : 0);
  }
  return t;
}

/** Sounds and shakes that follow from what just changed. */
function react(prev: GameState, next: GameState): { hurt: boolean } {
  const hurt = next.player.hp < prev.player.hp;
  if (next.status === 'won' && prev.status === 'playing') {
    audio.play('win');
    return { hurt: false };
  }
  if (next.status === 'dead' && prev.status === 'playing') {
    audio.play('death');
    audio.vibrate([80, 60, 200]);
    return { hurt: true };
  }
  if (hurt) {
    audio.play('hurt');
    audio.vibrate(120);
  }
  const newCards = next.cards.filter((c) => !prev.cards.some((p) => p.uid === c.uid));
  if (newCards.some((c) => c.kind === 'encounter')) audio.play('stinger');
  else if (newCards.some((c) => c.kind === 'panic')) audio.play('panic');
  else if (newCards.some((c) => c.title.startsWith('Act '))) audio.play('alarm');
  else if (newCards.length) audio.play('card');
  if (next.round !== prev.round) audio.play('roll');
  else if (next.player.room !== prev.player.room) audio.play('move');
  else if (!hurt && next.log.length > prev.log.length) {
    const tones = next.log.slice(prev.log.length).map((l) => l.tone);
    if (next.player.items.length > prev.player.items.length) audio.play('item');
    else if (tones.includes('danger')) audio.play('fail');
    else if (tones.includes('tense')) audio.play('cost');
    else if (tones.includes('good')) audio.play('clean');
  }
  return { hurt: hurt && next.status === 'playing' };
}

export function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [game, setGame] = useState<GameState | null>(() => loadGame());
  const [screen, setScreen] = useState<Screen>('title');
  const [returnTo, setReturnTo] = useState<Screen>('title');
  const [hurt, setHurt] = useState(0);
  const [newUnlocks, setNewUnlocks] = useState<string[]>([]);
  const gameRef = useRef(game);
  gameRef.current = game;

  const settings = profile.settings;

  useEffect(() => {
    document.documentElement.dataset.text = settings.textSize;
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    audio.setEnabled(settings.sound, settings.volume);
  }, [settings]);

  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    audio.setTension(game && screen === 'game' ? tensionOf(game) : 0);
  }, [game, screen]);

  const updateProfile = useCallback((p: Profile) => {
    setProfile(p);
    saveProfile(p);
  }, []);

  const finish = useCallback(
    (s: GameState) => {
      const { profile: p, newUnlocks: u } = recordRun(profile, s);
      updateProfile(p);
      setNewUnlocks(u);
      saveGame(null);
      window.setTimeout(() => setScreen('ending'), 900);
    },
    [profile, updateProfile],
  );

  const dispatch = useCallback(
    (a: Action) => {
      const prev = gameRef.current;
      if (!prev) return;
      const next = reduce(prev, a);
      if (next === prev) return;
      const r = react(prev, next);
      if (r.hurt) setHurt((h) => h + 1);
      setGame(next);
      saveGame(next);
      if (next.status !== 'playing') finish(next);
    },
    [finish],
  );

  const start = (o: { role: GameState['player']['role']; name: string; difficulty: GameState['difficulty']; seed: string }) => {
    const s = begin(newGame(o));
    setGame(s);
    saveGame(s);
    updateProfile({ ...profile, lastRole: o.role, lastDifficulty: o.difficulty });
    setScreen('game');
    audio.play('roll');
  };

  const setSettings = (st: Settings) => updateProfile({ ...profile, settings: st });

  if (screen === 'setup') {
    return <Setup unlocks={profile.unlocks} initialRole={profile.lastRole} initialDifficulty={profile.lastDifficulty} onBack={() => setScreen('title')} onStart={start} />;
  }
  if (screen === 'howto') return <HowTo onBack={() => setScreen(returnTo)} />;
  if (screen === 'memorial') return <Memorial history={profile.history} onBack={() => setScreen('title')} />;
  if (screen === 'ending' && game?.ending) {
    return <Ending s={game} newUnlocks={newUnlocks} onAgain={() => setScreen('setup')} onTitle={() => setScreen('title')} />;
  }
  if (screen === 'game' && game) {
    return (
      <Game
        s={game}
        dispatch={dispatch}
        onDrop={(i) => {
          const next = dropItem(game, i);
          setGame(next);
          saveGame(next);
        }}
        settings={settings}
        onSettings={setSettings}
        onHowTo={() => {
          setReturnTo('game');
          setScreen('howto');
        }}
        onQuit={() => setScreen('title')}
        onAbandon={() => {
          if (window.confirm('Abandon this run? It will be gone for good.')) {
            saveGame(null);
            setGame(null);
            setScreen('title');
          }
        }}
        showTips={!profile.tipsDone}
        onTipsDone={() => updateProfile({ ...profile, tipsDone: true })}
        hurt={hurt}
      />
    );
  }
  return (
    <Title
      hasSave={!!game && game.status === 'playing'}
      onContinue={() => setScreen('game')}
      onNew={() => setScreen('setup')}
      onHowTo={() => {
        setReturnTo('title');
        setScreen('howto');
      }}
      onMemorial={() => setScreen('memorial')}
      sound={settings.sound}
      onSound={() => setSettings({ ...settings, sound: !settings.sound })}
      reduced={settings.reducedMotion}
    />
  );
}
