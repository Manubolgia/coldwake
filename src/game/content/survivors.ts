import type { GameState, Survivor } from '../types';
import type { CardDef, ChoiceDef } from './cards';
import { has } from './cards';

const WEAPONS = ['a bolt driver', 'a kitchen knife', 'a flare gun', 'a length of pipe', 'a fire extinguisher'];

function they(sv: Survivor): string {
  return sv.pronoun;
}

function cap(s: string): string {
  return s[0]!.toUpperCase() + s.slice(1);
}

/**
 * The card for meeting a survivor. Built from state so it can be rebuilt
 * identically when the player chooses.
 */
export function survivorCard(s: GameState, index: number): CardDef {
  const sv = s.survivors[index]!;
  const full = s.companion !== null;
  const weapon = WEAPONS[(sv.name.length + index) % WEAPONS.length]!;
  const t = they(sv);
  const recruit = full
    ? { text: `You already have someone watching your back. You tell ${sv.name} where to hide and what to listen for. ${cap(t)} presses something into your hand before you go.`, effect: { item: 'medkit' as const, flag: `pointed:${index}` } }
    : { text: `${sv.name} falls in behind you. It is good not to be alone.`, effect: { recruit: true } };
  const recruitLabel = full ? 'Tell them where to hide' : 'Come with me';

  const choices: ChoiceDef[] = [];
  let text: string;
  let title = sv.name;

  if (sv.sibling) {
    title = `${sv.name}`;
    text = `A shape uncurls from behind a stack of crates, pipe raised — and stops. It’s ${sv.name}. Your sibling. Thinner, filthy, alive. “I knew you were in cryo,” ${t} says. “I kept telling myself you were still in cryo.”`;
    choices.push({ label: 'Hold on to them', result: { text: `You hold on to each other for a long time. Then ${sv.name} wipes ${t === 'they' ? 'their' : t === 'she' ? 'her' : 'his'} face and says, “Right. How do we get off this thing?”`, effect: { recruit: true, stress: -2 } } });
    return { id: `survivor-${index}`, title, art: 'survivor', tone: 'good', text, choices };
  }

  switch (sv.temperament) {
    case 'steady':
      text = `A ${sv.job} named ${sv.name} is crouched in the corner with ${weapon}, perfectly still, watching the door. ${cap(t)} doesn’t lower it when ${t} sees you — but ${t} doesn’t swing it either. “You’re not one of them,” ${t} says. “Good. I was running out of people to talk to.”`;
      choices.push({ label: recruitLabel, result: recruit });
      choices.push({
        label: 'Split up — cover more ground',
        result: { text: `${sv.name} nods. “Makes sense.” ${cap(t)} hands you a flare and slips away down the corridor.`, effect: { item: 'flare' } },
      });
      break;
    case 'frightened':
      text = `Someone is wedged into a supply locker, knees to chest, shaking so hard the door rattles. ${sv.name}, the ${sv.job}. “Is it gone?” ${t} whispers. “Please tell me it’s gone.”`;
      choices.push({
        label: full ? 'Calm them, then tell them where to hide' : 'Talk them out',
        stat: 'nerve',
        clean: recruit,
        cost: full ? recruit : { text: `It takes a long time and all your patience. ${sv.name} comes, jumping at every sound.`, effect: { recruit: true, stress: 1 } },
        fail: { text: `${sv.name} bolts past you, screaming, and is gone into the dark. The screaming goes on for a while.`, effect: { noise: 3, stress: 1 } },
      });
      choices.push({ label: 'Leave them hidden', result: { text: `You close the locker door gently. ${cap(t)} doesn’t make a sound.`, effect: { stress: 1 } } });
      break;
    case 'hostile':
      text = `“Stop. Right there.” ${sv.name}, a ${sv.job}, has ${weapon} levelled at your chest, hands white on it. “How do I know you’re still you? How do I know?”`;
      choices.push({
        label: 'Talk them down',
        stat: 'nerve',
        mod: -1,
        clean: recruit,
        cost: { text: `${cap(t)} lowers it, just. “Stay away from me.” ${cap(t)} backs off, and leaves you a medkit on the floor as a kind of apology.`, effect: { item: 'medkit' } },
        fail: { text: `${cap(t)} panics. The blow catches you across the face and ${t} is gone before you can get up.`, effect: { hp: -1, noise: 2 } },
      });
      choices.push({
        label: 'Take it off them',
        stat: 'might',
        clean: full ? { text: `You twist it out of ${sv.name}’s hands. ${cap(t)} stares, then runs. You keep the weapon.`, effect: { item: 'axe' } } : { text: `You twist it out of ${sv.name}’s hands. ${cap(t)} stares at you, then laughs, shakily. “Okay. Okay. You’re you. I’m coming with you.”`, effect: { recruit: true } },
        cost: { text: `You get it off ${t === 'they' ? 'them' : t === 'she' ? 'her' : 'him'}, and ${t} runs.`, effect: { item: 'axe' } },
        fail: { text: `${cap(t)} is stronger than ${t} looks. You take a hit and ${t} is gone.`, effect: { hp: -1, noise: 2 } },
      });
      choices.push({ label: 'Back away', result: { text: `You back out slowly, hands up. ${cap(t)} doesn’t follow.` } });
      break;
    case 'broken':
    default:
      text = `${sv.name}, the ${sv.job}, is sitting against the wall with ${t === 'they' ? 'their' : t === 'she' ? 'her' : 'his'} back to the door, rocking slightly, staring at nothing. There is blood on ${t === 'they' ? 'their' : t === 'she' ? 'her' : 'his'} hands that isn’t ${t === 'they' ? 'theirs' : t === 'she' ? 'hers' : 'his'}.`;
      choices.push({
        label: 'Get them on their feet',
        stat: 'nerve',
        clean: recruit,
        cost: full ? recruit : { text: `${cap(t)} comes, slowly. You have to keep saying ${t === 'they' ? 'their' : t === 'she' ? 'her' : 'his'} name.`, effect: { recruit: true, stress: 1 } },
        fail: { text: `${cap(t)} doesn’t hear you. ${cap(t)} doesn’t hear anything any more.`, effect: { stress: 1 } },
      });
      choices.push({
        label: 'Give them a sedative',
        when: has('sedative'),
        result: full ? { ...recruit, effect: { ...recruit.effect, loseItem: 'sedative' as const } } : { text: `The shaking stops. ${sv.name} looks at you properly for the first time. “Thank you,” ${t} says. “I’m coming.”`, effect: { recruit: true, loseItem: 'sedative' } },
      });
      choices.push({ label: 'Leave them', result: { text: 'You leave them to it. You will think about that later.', effect: { stress: 1 } } });
      break;
  }

  if (s.scenario.incident === 'guest') {
    choices.splice(1, 0, {
      label: 'Ask something only the crew would know',
      hint: 'Test them',
      stat: 'wits',
      clean: sv.mimic
        ? { text: `“What was the captain’s dog called?” ${sv.name} smiles. And keeps smiling. And the smile keeps going, past where a mouth should stop.`, effect: { flag: `mimic-revealed:${index}` } }
        : { text: `${cap(t)} answers instantly, and adds a detail you had forgotten. It’s really ${sv.name}.`, effect: full ? recruit.effect : { recruit: true } },
      cost: sv.mimic
        ? { text: `The answer is right. The pause before it isn’t. You back away, and ${sv.name} watches you go, head tilted, and then isn’t there any more.`, effect: { flag: `mimic-fled:${index}` } }
        : { text: `${cap(t)} gets it right, after a moment. You think. You decide to trust ${t === 'they' ? 'them' : t === 'she' ? 'her' : 'him'}.`, effect: full ? recruit.effect : { recruit: true } },
      fail: sv.mimic
        ? { text: `“Biscuit,” ${sv.name} says, instantly, and laughs. Of course. You relax. ${cap(t)} falls in beside you, close. Very close.`, effect: full ? { flag: `pointed:${index}` } : { recruit: true } }
        : { text: `${cap(t)} stares at you. “You think I’m one of them?” ${cap(t)} leaves, and doesn’t look back.`, effect: { stress: 1 } },
    });
  }

  return { id: `survivor-${index}`, title, art: 'survivor', tone: sv.temperament === 'hostile' ? 'tense' : 'calm', text, choices };
}
