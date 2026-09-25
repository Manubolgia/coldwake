import { useState } from 'react';

const TIPS: { title: string; text: string }[] = [
  {
    title: 'Your dice',
    text: 'At the bottom are this round’s dice, already rolled. Tap one to pick it. Every action uses one die, and higher is better.',
  },
  {
    title: 'Pick, then act',
    text: 'Each action shows what your picked die will do. Green is clean. Amber works, with a cost. Red fails. Try picking a different die and watch them change.',
  },
  {
    title: 'Noise',
    text: 'Most actions make noise. Rooms that can hear you glow red on the map, and anything in them comes toward you when the round ends. Moving on a high die is silent.',
  },
  {
    title: 'The round ends',
    text: 'When your dice are spent, tap End round. Anything in your room attacks, everything else moves, and the ship does something. Unused dice lower your stress.',
  },
  {
    title: 'Getting out',
    text: 'Goals shows your two ways off the ship, step by step, and your secret objective. Diamonds on the map mark rooms you need. Good luck.',
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
