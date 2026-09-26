import { useState } from 'react';

const TIPS: { title: string; text: string }[] = [
  {
    title: 'The narrator',
    text: 'Everything that happens is told in the middle of the screen, a line at a time. Tap it to hear the rest at once. When it stops talking, it is your move.',
  },
  {
    title: 'Your dice',
    text: 'At the bottom are this round’s dice, already rolled. Tap one to pick it. Every action uses one die, and higher is better.',
  },
  {
    title: 'Pick, then act',
    text: 'The buttons above your dice — Here, Kit, Move and the rest — open what you can do. Each action shows what your die will do: green is clean, amber works at a cost, red fails.',
  },
  {
    title: 'Noise and the map',
    text: 'Most actions make noise. Tap the map in the corner to see the whole ship: rooms that can hear you glow red, and anything in them comes for you when the round ends.',
  },
  {
    title: 'The round ends',
    text: 'When your dice are spent, tap End round. Anything in your room attacks, everything else moves, and the ship does something. Unused dice lower your stress.',
  },
  {
    title: 'Getting out',
    text: 'Goals, at the top, shows your two ways off the ship, step by step, and your secret objective. Diamonds on the map mark rooms you need. Good luck.',
  },
];

export function Coach({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const tip = TIPS[i]!;
  return (
    <div className="coach" role="status">
      <span className="eyebrow" style={{ color: 'var(--cyan)' }}>
        {tip.title} · {i + 1} of {TIPS.length}
      </span>
      <p>{tip.text}</p>
      <div className="row">
        <button className="skip" onClick={onDone}>
          Skip tips
        </button>
        <button className="next" onClick={() => (i + 1 < TIPS.length ? setI(i + 1) : onDone())}>
          {i + 1 < TIPS.length ? 'Next' : 'Got it'}
        </button>
      </div>
    </div>
  );
}
