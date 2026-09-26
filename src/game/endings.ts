import { EXITS, PERSONALS } from './content/exits';
import { INCIDENTS } from './content/incidents';
import { Rng, hashSeed } from './rng';
import { ctxOf, hasItem } from './rules';
import type { Companion, Ending, ExitId, GameState } from './types';

// The epilogue is assembled from pools of lines, and every pool is drawn from
// at random, so two runs that end the same way still read differently. The
// draw is seeded from the run itself: the same run always gets the same
// ending, and the next one almost never does.

function personalMet(s: GameState, exit: ExitId | null): boolean {
  if (!exit) return false;
  switch (s.scenario.personal) {
    case 'blackbox':
      return hasItem(s, 'blackbox');
    case 'sample':
      return hasItem(s, 'sample');
    case 'together':
      return s.companion !== null;
    case 'sibling':
      return s.companion?.sibling === true;
    case 'burn':
      return s.progress.selfDestruct;
    case 'kill':
    case 'truth':
    case 'wipe':
      return s.progress.personalDone;
  }
}

interface Pn {
  they: string;
  them: string;
  their: string;
  /** "They don’t" / "She doesn’t". */
  doesnt: string;
}

function pn(m: Companion): Pn {
  if (m.pronoun === 'she') return { they: 'she', them: 'her', their: 'her', doesnt: 'She doesn’t' };
  if (m.pronoun === 'he') return { they: 'he', them: 'him', their: 'his', doesnt: 'He doesn’t' };
  return { they: 'they', them: 'them', their: 'their', doesnt: 'They don’t' };
}

// ── how you left ───────────────────────────────────────────────────────

const EXIT_LINES: Record<ExitId, { calm: ((ship: string) => string)[]; burn: ((ship: string) => string)[] }> = {
  pods: {
    calm: [
      () => 'The pod kicks you clear with a bang that rattles your teeth. Through the tiny window the ship tumbles away, dark and silent, until it is just another star.',
      (ship) => `The clamps let go and the pod drops out of the ${ship} like a stone down a well. You watch the hull slide past, porthole after dark porthole, and then there is only the black.`,
      () => 'The launch rail screams, the pod spins, and for a long minute you cannot tell which way is up. When the tumbling stops, the ship is behind you. You laugh until it turns into something else.',
      (ship) => `You pull the handle and the world goes white with acceleration. When your sight comes back, the ${ship} is a grey smudge against the stars, getting smaller, and it cannot follow you.`,
      () => 'The pod’s beacon starts its slow, patient chirp. Somebody, somewhere, will hear it. For now there is just the hum of the scrubbers and your own breathing, and both of them are fine.',
    ],
    burn: [
      () => 'The pod kicks you clear with a bang that rattles your teeth. Behind you the reactor lets go, and for a moment the ship is a second sun.',
      (ship) => `You are four hundred metres out when the ${ship} comes apart. There is no sound. There is just light, pouring through the porthole, and then the pod’s shields darkening against it.`,
      () => 'The shockwave catches the pod and flicks it end over end like a coin. When the spinning stops, there is a cloud of glowing dust where the ship used to be.',
    ],
  },
  shuttle: {
    calm: [
      () => 'You punch the shuttle through the bay doors and keep the throttle open until the ship is a speck in the rear camera, and then until it isn’t even that.',
      (ship) => `The bay doors grind apart with the shuttle’s nose already between them. Paint scrapes. Alarms complain. Then there is nothing around you but stars, and the ${ship} is somebody else’s problem.`,
      () => 'The engines catch on the second try. You don’t remember deciding to hold your breath, but you let it out when the hangar lights slide off the canopy and the dark takes their place.',
      () => 'You fly it badly and it doesn’t matter. The shuttle clears the doors with a metre to spare and swings wide into open space, and the autopilot takes a heading for home without being asked.',
    ],
    burn: [
      () => 'You punch the shuttle through the bay doors and keep the throttle open. The flash, when it comes, lights up the whole cockpit from behind.',
      (ship) => `The countdown hits zero while you are still clearing the hull. The ${ship} blooms white behind you and the shuttle rides the wave of it, rattling, screaming, holding together.`,
      () => 'You don’t look back. The rear camera does it for you: a flower of fire opening in the black, and nothing inside it moving.',
    ],
  },
  beacon: {
    calm: [
      () => 'The tug’s crew hauls you aboard, wraps you in a foil blanket and asks what happened. You open your mouth to tell them, and find you are crying.',
      () => 'The airlock opens on light and warm air and a woman in a salvage suit saying “Easy, easy, we’ve got you.” You don’t let go of her arm for an hour.',
      (ship) => `The tug’s captain takes one look at you and seals the airlock behind you without asking. “Whatever it is,” she says, “it stays on the ${ship}.” She doesn’t ask what it is. You love her for that.`,
      () => 'Somebody on the tug puts a hot drink in your hands. It is the worst coffee you have ever tasted. You drink all of it and ask for another.',
    ],
    burn: [
      () => 'The tug’s crew hauls you aboard and you tell them to go, now, go. They go. The ship burns behind you and nobody on the tug says a word.',
      (ship) => `The tug is barely clear when the ${ship} goes up. Its crew watch the glow through the viewport in silence. One of them looks at you, then away, and never asks.`,
      () => 'You make the tug pull back to a safe distance before you let yourself sit down. Then you watch the reactor go, and the captain says, quietly, “Well. That’s one way to file a claim.”',
    ],
  },
  jump: {
    calm: [
      () => 'The lid closes. The drive fires. The cold comes in like a tide, and you let it take you, and you do not dream.',
      () => 'You climb back into the pod you woke up in. It is still warm. The lid hisses shut, the frost creeps up the glass, and the last thing you see is your own breath, slowing.',
      (ship) => `The ${ship} folds itself around the jump and space goes thin and strange. You are already asleep by then, counting backwards from ten, and you never reach one.`,
    ],
    burn: [
      () => 'The lid closes. The drive fires. The last thing you feel before the cold is the reactor starting to go — and the ship leaving it behind.',
      () => 'You jettison the reactor as the drive spins up. Somewhere behind the jump there is a small, brief sun. You are asleep before it fades.',
    ],
  },
};

// ── who came with you ──────────────────────────────────────────────────

const MIMIC_LINES: ((m: Companion, p: Pn) => string)[] = [
  (m, p) => `${m.name} sits beside you the whole way, very still, humming something. You don’t remember teaching ${p.them} that song.`,
  (m, p) => `${m.name} sleeps with ${p.their} eyes open. You tell yourself that is just shock.`,
  (m, p) => `Once, when ${p.they} thinks you are asleep, you see ${m.name.split(' ')[0]} stand at the window for an hour without blinking. In the morning ${p.they} asks you how you slept, and smiles with too many teeth.`,
];

const INFECTED_LINES: ((m: Companion, p: Pn) => string)[] = [
  (m, p) => `${m.name} made it too. ${p.doesnt} talk much on the way home, and sometimes ${p.they} scratches at ${p.their} arm until it bleeds.`,
  (m, p) => `${m.name} runs a fever the whole way home. ${p.doesnt} let you see ${p.their} wrists.`,
  (m) => `${m.name} keeps asking what day it is. The answer never seems to stick.`,
];

const SIBLING_LINES: ((m: Companion, p: Pn) => string)[] = [
  (m) => `${m.name} falls asleep on your shoulder before you are clear. You don’t move for hours.`,
  (m) => `${m.name} tells you a story about when you were both kids, and gets it wrong on purpose so you’ll correct it. You do. You both laugh until it hurts.`,
  (m, p) => `You don’t let go of ${m.name.split(' ')[0]}’s hand. ${p.doesnt} ask you to.`,
];

const COMPANION_LINES: ((m: Companion, p: Pn) => string)[] = [
  (m) => `${m.name} made it out with you. You don’t say much. You don’t need to.`,
  (m) => `${m.name} shares the last ration bar with you, exactly half, and makes a big show of measuring it.`,
  (m, p) => `${m.name} sleeps for eleven hours straight. When ${p.they} wakes, the first thing ${p.they} asks is whether you are all right. Nobody has asked you that in a long time.`,
  (m) => `${m.name} writes down the names of everyone who didn’t make it, so they won’t be forgotten. It takes three pages.`,
];

const LOST_LINES: ((names: string) => string)[] = [
  (n) => `You made it out alone. You think about ${n} more than you’d like.`,
  (n) => `There is an empty seat beside you. It was meant for ${n}.`,
  (n) => `You say ${n}’s name out loud once, to the empty cabin, just to hear somebody say it.`,
];

const ALONE_LINES: string[] = [
  'You made it out alone, which is how you woke up.',
  'Nobody else came with you. You don’t know yet whether that is a mercy.',
  'It is very quiet with just you. You find yourself talking to the dark, and the dark, for once, doesn’t answer.',
];

// ── the thing ──────────────────────────────────────────────────────────

const BURNED_THING: ((ship: string) => string)[] = [
  (ship) => `Nothing aboard the ${ship} survived the fire. Nothing will ever follow you home from it.`,
  () => 'Whatever was breeding in the dark is vapour now, spreading thinner every second between the stars.',
  (ship) => `The ${ship} is a cloud of hot metal. You made sure. You made very sure.`,
];

const KILLED_THING: ((creature: string) => string)[] = [
  (c) => `${cap(c)} is dead. You killed it yourself. You keep checking your hands for blood.`,
  (c) => `You saw ${c} die. You still flinch at every shadow, but you saw it die.`,
  (c) => `${cap(c)} will not be walking anybody’s corridors ever again. You made sure of that, up close.`,
];

const JUMPED_WITH_IT: ((ship: string, creature: string) => string)[] = [
  (ship, c) => `The ${ship} jumps with you in it — and with ${c} in it, too. Forty days asleep. Forty days of something walking the corridors past your pod.`,
  (_ship, c) => `Somewhere in the ship, ${c} is awake for the whole journey. When you wake, there are scratches on the outside of your pod’s glass.`,
  (ship) => `The ${ship} will arrive at a busy port in forty days, carrying you, and carrying something else. You have forty days to decide what to tell them.`,
];

const NEST_LINES: ((nest: string) => string)[] = [
  (n) => `At least the ${n.toLowerCase()} is ash. Whatever it was growing will not grow.`,
  (n) => `You left the ${n.toLowerCase()} burning. Whatever it was making, it will have to start again from nothing.`,
];

// ── what you learned ───────────────────────────────────────────────────

const TRUTH_LINES: ((ship: string) => string)[] = [
  (ship) => `You know what happened on the ${ship}. So does the inquiry, by the time you are finished with them.`,
  () => 'You tell the inquiry everything. Some of the people who signed the orders stop answering their calls. Good.',
  (ship) => `The story of the ${ship} makes the news for a week, and you make sure every word of it is true.`,
];

const NO_TRUTH_LINES: ((ship: string) => string)[] = [
  (ship) => `You never did find out exactly what happened on the ${ship}. The company’s report calls it “an incident”.`,
  () => 'You have pieces of it — a name, a sound, a smell. The rest you fill in at three in the morning, and never the same way twice.',
  (ship) => `The official story of the ${ship} runs to two paragraphs. You know it’s a lie. You just can’t prove it.`,
];

// ── the secret ─────────────────────────────────────────────────────────

const PERSONAL_DONE: ((name: string) => string)[] = [
  (n) => `And you did what you came to do — ${n}.`,
  (n) => `You kept the promise you made yourself — ${n} — even when it would have been easier not to.`,
  (n) => `${cap(n)}: done. Nobody else will ever know what it cost.`,
];

const PERSONAL_MISSED: ((name: string) => string)[] = [
  (n) => `You didn’t do the thing you swore you would — ${n}. It stays with you.`,
  (n) => `${cap(n)}. You had the chance, and you let it go to live. Most days you think that was right.`,
  (n) => `There was one thing you meant to do aboard — ${n} — and you left it behind with everything else.`,
];

// ── afterwards ─────────────────────────────────────────────────────────

const AFTER_WIN: string[] = [
  'Years later, you still sleep with the light on.',
  'The company offers you a new contract, with a bonus. You tear it in half in front of the lawyer.',
  'You never go into cold storage again. You take the long way everywhere, awake the whole time.',
  'Some nights you wake up counting rounds. You always reach zero, and you are always still here.',
  'You keep one thing from the ship: the wristband they put on you before you went under. You don’t know why.',
  'People ask what it was like out there. You tell them it was cold, and let them think you mean the temperature.',
  'On the first night home you stand under a hot shower until the water runs cold, and then a little longer.',
];

const AFTER_CARRIER: string[] = [
  'The quarantine medics are very kind. They are also very careful never to touch you.',
  'Nobody notices, for a while. Then the dreams start, and they are not your dreams.',
];

const AFTER_LOSS: string[] = [
  'Somewhere in the ship’s memory, your last log entry plays on a loop to an empty room.',
  'Your pod stays open in the cryo bay, frost slowly climbing back up the glass.',
  'When the salvage crews finally come, they find your name on the roster, and nothing else.',
  'The emergency lights keep blinking long after anyone is left to read them.',
  'The ship keeps your seat warm, in its way, for the next crew.',
];

// ── titles ─────────────────────────────────────────────────────────────

const TITLES = {
  pods: ['CAST ADRIFT', 'LIFEBOAT', 'A SMALL BRIGHT DOT', 'THROWN CLEAR'],
  shuttle: ['CLEAR SKIES', 'THROTTLE OPEN', 'RUNNING LIGHTS', 'FLIGHT PLAN'],
  beacon: ['ANSWERED', 'SOMEBODY CAME', 'THE LONG WAIT', 'FOIL BLANKET'],
  jump: ['THE LONG SLEEP', 'COLD RETURN', 'FORTY DAYS', 'DREAMLESS'],
  carrier: ['CARRIER', 'PASSENGER', 'PATIENT ZERO', 'SOMETHING INSIDE'],
  burned: ['SCORCHED EARTH', 'NOTHING FOLLOWS', 'SALT THE EARTH', 'CLEAN BURN'],
  whole: ['THE WHOLE STORY', 'NOTHING LEFT UNSAID', 'EVERY LAST PIECE', 'THE FULL ACCOUNT'],
  killed: ['LOST WITH THE SHIP', 'NAME ON THE ROSTER', 'THE LAST LOG', 'LIGHTS OUT'],
  turned: ['ONE OF THEM', 'HOMECOMING', 'THE WELCOMING PARTY', 'NO LONGER YOU'],
  burnedDead: ['SECOND SUN', 'TOO CLOSE TO THE FIRE', 'BRIGHTER THAN ANYTHING'],
  adrift: ['DOWN WITH THE SHIP', 'OUT OF TIME', 'ZERO', 'THE CLOCK WINS'],
};

// ── deaths ─────────────────────────────────────────────────────────────

const DEATH_BY_FIRE: string[] = [
  'The fire took you in the end, not the thing. You are not sure that is better.',
  'The smoke comes first, then the heat. You crawl as far as you can, and it is almost far enough.',
  'The last thing you see is orange, everywhere, and it is almost beautiful.',
];

const DEATH_BY_VACUUM: string[] = [
  'The air went, and you went with it, quietly, looking at the stars.',
  'The breach takes the air out of the room in one long breath. It takes yours with it.',
  'It is very quiet, at the end. The stars are so close you could touch them.',
];

const DEATH_BY_WOUNDS: string[] = [
  'You sit down against the wall to catch your breath, and you don’t get up again.',
  'You have lost too much blood to keep going, and you know it. You close your eyes for just a moment.',
];

const DEATH_BY_CREATURE: ((killer: string, room: string) => string)[] = [
  (k, r) => `${cap(k)} found you in the ${r}. It was quick, at the end, which is more than most of the crew got.`,
  (k, r) => `You made your last stand in the ${r}. ${cap(k)} was faster. It usually is.`,
  (k) => `You hear ${k} before you see it, and by then there is nowhere left to run.`,
  (k, r) => `The ${r} is where they find you, much later. ${cap(k)} is long gone by then.`,
];

const DEATH_AFTER: ((ship: string) => string)[] = [
  (ship) => `The ${ship} drifts on without you, one more name crossed off the cryo roster.`,
  (ship) => `The ${ship} keeps drifting, and keeps its secrets, and now it keeps you too.`,
  () => 'The alarms keep sounding for a while. Then even they give up.',
];

const TURNED_LINES: ((nest: string, ship: string) => string)[] = [
  (nest) => `It happens slowly and then all at once. The fear goes first. Then the questions. Then your name. Then you are walking back to the ${nest.toLowerCase()}, with all the others, and it feels like going home.`,
  (nest) => `You stop being afraid somewhere around the ${nest.toLowerCase()}. It is such a relief. Everyone is here. Everyone is waiting for you.`,
  () => 'You remember being someone. The memory is pleasant, and far away, like a song from another room.',
];

const TURNED_AFTER: ((ship: string) => string)[] = [
  (ship) => `If another crew ever boards the ${ship}, you will be there to greet them.`,
  () => 'When the next crew wakes, you will be there with the others, smiling, holding out a hand.',
];

const BURNED_LINES: string[] = [
  'You armed the overload, and you didn’t get off in time. For one instant the ship is brighter than anything for a light-year around.',
  'The reactor lets go with you still inside. You never feel it. One moment there is the ship, and the next there is only light.',
  'The countdown reaches zero with you three rooms from safety. You stop running, and turn, and watch the light come.',
];

const BURNED_AFTER: string[] = [
  'Nothing aboard survives. That was the point. You just hoped you’d be watching from further away.',
  'Nothing will follow anyone home from here. You made sure of that, the hard way.',
];

const ADRIFT_LINES: ((clock: string, ship: string) => string)[] = [
  (clock, ship) => `The countdown reaches zero with you still aboard. ${clock}. The ${ship} shudders, and the lights go out for the last time.`,
  (clock) => `${clock}. You were close. You were so close. The last alarm goes on and on and then, very suddenly, it stops.`,
  (_clock, ship) => `You hear the ${ship} give up before you feel it: a long groan through every frame, like something very large lying down to sleep.`,
];

// ── assembly ───────────────────────────────────────────────────────────

export function computeEnding(s: GameState, reason: 'win' | 'killed' | 'turned' | 'adrift' | 'burned', exit: ExitId | null = null): Ending {
  const inc = INCIDENTS[s.scenario.incident];
  const c = ctxOf(s);
  const ship = s.scenario.shipName;
  const rng = new Rng(hashSeed(`${s.seed}:${s.round}:${s.rng}:${reason}:${exit ?? ''}`));
  const pick = <T,>(xs: readonly T[]): T => rng.pick(xs);
  const lines: string[] = [];
  let title = '';
  let id: string = reason;
  let art = 'end-lost';
  let score = 0;

  if (reason === 'win' && exit) {
    const burn = s.progress.selfDestruct;
    lines.push(pick(EXIT_LINES[exit][burn ? 'burn' : 'calm'])(ship));
    score += 100 + s.clock * 5;
    art = burn ? 'end-burn' : `end-${exit}`;

    // Who came with you.
    if (s.companion) {
      const m = s.companion;
      const p = pn(m);
      if (m.mimic) {
        lines.push(pick(MIMIC_LINES)(m, p));
        score -= 40;
      } else if (m.infected) {
        lines.push(pick(INFECTED_LINES)(m, p));
        score += 10;
      } else if (m.sibling) {
        lines.push(pick(SIBLING_LINES)(m, p));
        score += 60;
      } else {
        lines.push(pick(COMPANION_LINES)(m, p));
        score += 40;
      }
    } else if (s.progress.companionsLost.length) {
      lines.push(pick(LOST_LINES)(s.progress.companionsLost.join(' and ')));
    } else {
      lines.push(pick(ALONE_LINES));
    }

    // The thing.
    if (burn) {
      lines.push(pick(BURNED_THING)(ship));
      score += 50;
    } else if (s.progress.primaryKilled) {
      lines.push(pick(KILLED_THING)(inc.creature));
      score += 50;
    } else if (exit === 'jump') {
      lines.push(pick(JUMPED_WITH_IT)(ship, inc.creature));
      score -= 20;
    } else {
      lines.push(inc.survives(c));
    }
    if (s.progress.nestDestroyed && !burn) {
      lines.push(pick(NEST_LINES)(inc.nestName));
      score += 20;
    }

    // Knowledge.
    if (s.progress.truth) {
      lines.push(pick(TRUTH_LINES)(ship));
      score += 40;
    } else {
      lines.push(pick(NO_TRUTH_LINES)(ship));
    }

    // The secret.
    const p = PERSONALS[s.scenario.personal];
    if (personalMet(s, exit)) {
      lines.push(pick(PERSONAL_DONE)(p.name.toLowerCase()));
      score += 60;
    } else {
      lines.push(pick(PERSONAL_MISSED)(p.name.toLowerCase()));
    }

    if (s.player.infected) {
      lines.push(inc.carrier);
      lines.push(pick(AFTER_CARRIER));
      title = pick(TITLES.carrier);
      id = 'carrier';
      art = 'infection';
      score -= 60;
    } else {
      lines.push(pick(AFTER_WIN));
      if (burn) {
        title = pick(TITLES.burned);
        id = 'burned-out';
      } else if (s.progress.truth && personalMet(s, exit) && s.companion && !s.companion.mimic) {
        title = pick(TITLES.whole);
        id = 'whole';
        score += 30;
      } else {
        title = pick(TITLES[exit]);
        id = exit;
      }
    }
  } else if (reason === 'killed') {
    const killer = s.progress.flags.find((f) => f.startsWith('killed-by:'))?.split(':')[1] ?? 'wounds';
    title = pick(TITLES.killed);
    const how =
      killer === 'fire'
        ? pick(DEATH_BY_FIRE)
        : killer === 'vacuum'
          ? pick(DEATH_BY_VACUUM)
          : killer === 'wounds'
            ? pick(DEATH_BY_WOUNDS)
            : pick(DEATH_BY_CREATURE)(killer, c.room);
    art = killer === 'fire' ? 'fire' : killer === 'vacuum' ? 'breach' : 'end-lost';
    lines.push(how);
    lines.push(pick(DEATH_AFTER)(ship));
    if (s.progress.truth) lines.push('You learned the truth. It died with you.');
    lines.push(pick(AFTER_LOSS));
    score += s.round * 3 + s.progress.clues.length * 10 + s.progress.kills * 10;
  } else if (reason === 'turned') {
    title = pick(TITLES.turned);
    art = 'infection';
    lines.push(pick(TURNED_LINES)(inc.nestName, ship));
    lines.push(pick(TURNED_AFTER)(ship));
    score += s.round * 3;
  } else if (reason === 'burned') {
    title = pick(TITLES.burnedDead);
    art = 'end-burn';
    lines.push(pick(BURNED_LINES));
    lines.push(pick(BURNED_AFTER));
    score += 40 + s.round * 3;
  } else {
    title = pick(TITLES.adrift);
    lines.push(pick(ADRIFT_LINES)(s.scenario.clockKind.replace(/ in$/, ''), ship));
    lines.push(pick(AFTER_LOSS));
    score += s.round * 3;
  }

  return { id, won: reason === 'win', title, epilogue: lines, score: Math.max(0, Math.round(score)), exit, art };
}

function cap(t: string): string {
  return t[0]!.toUpperCase() + t.slice(1);
}

export function exitName(e: ExitId): string {
  return EXITS[e].name;
}
