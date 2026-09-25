import { EXITS, PERSONALS } from './content/exits';
import { INCIDENTS } from './content/incidents';
import { ctxOf, hasItem } from './rules';
import type { Ending, ExitId, GameState } from './types';

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

const EXIT_LINES: Record<ExitId, (burn: boolean) => string> = {
  pods: (burn) =>
    burn
      ? 'The pod kicks you clear with a bang that rattles your teeth. Behind you the reactor lets go, and for a moment the ship is a second sun.'
      : 'The pod kicks you clear with a bang that rattles your teeth. Through the tiny window the ship tumbles away, dark and silent, until it is just another star.',
  shuttle: (burn) =>
    burn
      ? 'You punch the shuttle through the bay doors and keep the throttle open. The flash, when it comes, lights up the whole cockpit from behind.'
      : 'You punch the shuttle through the bay doors and keep the throttle open until the ship is a speck in the rear camera, and then until it isn’t even that.',
  beacon: (burn) =>
    burn
      ? 'The tug’s crew hauls you aboard and you tell them to go, now, go. They go. The ship burns behind you and nobody on the tug says a word.'
      : 'The tug’s crew hauls you aboard, wraps you in a foil blanket and asks what happened. You open your mouth to tell them, and find you are crying.',
  jump: (burn) =>
    burn
      ? 'The lid closes. The drive fires. The last thing you feel before the cold is the reactor starting to go — and the ship leaving it behind.'
      : 'The lid closes. The drive fires. The cold comes in like a tide, and you let it take you, and you do not dream.',
};

export function computeEnding(s: GameState, reason: 'win' | 'killed' | 'turned' | 'adrift' | 'burned', exit: ExitId | null = null): Ending {
  const inc = INCIDENTS[s.scenario.incident];
  const c = ctxOf(s);
  const ship = s.scenario.shipName;
  const lines: string[] = [];
  let title = '';
  let id: string = reason;
  let score = 0;

  if (reason === 'win' && exit) {
    const burn = s.progress.selfDestruct;
    lines.push(EXIT_LINES[exit](burn));
    score += 100 + s.clock * 5;

    // Who came with you.
    if (s.companion) {
      const m = s.companion;
      if (m.mimic) {
        lines.push(`${m.name} sits beside you the whole way, very still, humming something. You don’t remember teaching ${m.pronoun === 'they' ? 'them' : m.pronoun === 'she' ? 'her' : 'him'} that song.`);
        score -= 40;
      } else if (m.infected) {
        lines.push(`${m.name} made it too. ${m.pronoun === 'they' ? 'They don’t' : m.pronoun === 'she' ? 'She doesn’t' : 'He doesn’t'} talk much on the way home, and sometimes ${m.pronoun} scratches at ${m.pronoun === 'they' ? 'their' : m.pronoun === 'she' ? 'her' : 'his'} arm until it bleeds.`);
        score += 10;
      } else if (m.sibling) {
        lines.push(`${m.name} falls asleep on your shoulder before you are clear. You don’t move for hours.`);
        score += 60;
      } else {
        lines.push(`${m.name} made it out with you. You don’t say much. You don’t need to.`);
        score += 40;
      }
    } else if (s.progress.companionsLost.length) {
      lines.push(`You made it out alone. You think about ${s.progress.companionsLost.join(' and ')} more than you’d like.`);
    } else {
      lines.push('You made it out alone, which is how you woke up.');
    }

    // The thing.
    if (burn) {
      lines.push(`Nothing aboard the ${ship} survived the fire. Nothing will ever follow you home from it.`);
      score += 50;
    } else if (s.progress.primaryKilled) {
      lines.push(`${cap(inc.creature)} is dead. You killed it yourself. You keep checking your hands for blood.`);
      score += 50;
    } else if (exit === 'jump') {
      lines.push(`The ${ship} jumps with you in it — and with ${inc.creature} in it, too. Forty days asleep. Forty days of something walking the corridors past your pod.`);
      score -= 20;
    } else {
      lines.push(inc.survives(c));
    }
    if (s.progress.nestDestroyed && !burn) {
      lines.push(`At least the ${inc.nestName.toLowerCase()} is ash. Whatever it was growing will not grow.`);
      score += 20;
    }

    // Knowledge.
    if (s.progress.truth) {
      lines.push(`You know what happened on the ${ship}. So does the inquiry, by the time you are finished with them.`);
      score += 40;
    } else {
      lines.push(`You never did find out exactly what happened on the ${ship}. The company’s report calls it “an incident”.`);
    }

    // The secret.
    const p = PERSONALS[s.scenario.personal];
    if (personalMet(s, exit)) {
      lines.push(`And you did what you came to do — ${p.name.toLowerCase()}.`);
      score += 60;
    } else {
      lines.push(`You didn’t do the thing you swore you would — ${p.name.toLowerCase()}. It stays with you.`);
    }

    if (s.player.infected) {
      lines.push(inc.carrier);
      title = 'CARRIER';
      id = 'carrier';
      score -= 60;
    } else if (burn) {
      title = 'SCORCHED EARTH';
      id = 'burned-out';
    } else if (s.progress.truth && personalMet(s, exit) && s.companion && !s.companion.mimic) {
      title = 'THE WHOLE STORY';
      id = 'whole';
      score += 30;
    } else {
      title = { pods: 'CAST ADRIFT', shuttle: 'CLEAR SKIES', beacon: 'ANSWERED', jump: 'THE LONG SLEEP' }[exit];
      id = exit;
    }
  } else if (reason === 'killed') {
    const killer = s.progress.flags.find((f) => f.startsWith('killed-by:'))?.split(':')[1] ?? 'wounds';
    title = 'LOST WITH THE SHIP';
    const how =
      killer === 'fire'
        ? 'The fire took you in the end, not the thing. You are not sure that is better.'
        : killer === 'vacuum'
          ? 'The air went, and you went with it, quietly, looking at the stars.'
          : `${cap(killer)} found you in the ${c.room}. It was quick, at the end, which is more than most of the crew got.`;
    lines.push(how);
    lines.push(`The ${ship} drifts on without you, one more name crossed off the cryo roster.`);
    if (s.progress.truth) lines.push('You learned the truth. It died with you.');
    score += s.round * 3 + s.progress.clues.length * 10 + s.progress.kills * 10;
  } else if (reason === 'turned') {
    title = 'ONE OF THEM';
    lines.push(`It happens slowly and then all at once. The fear goes first. Then the questions. Then your name. Then you are walking back to the ${inc.nestName.toLowerCase()}, with all the others, and it feels like going home.`);
    lines.push(`If another crew ever boards the ${ship}, you will be there to greet them.`);
    score += s.round * 3;
  } else if (reason === 'burned') {
    title = 'SECOND SUN';
    lines.push('You armed the overload, and you didn’t get off in time. For one instant the ship is brighter than anything for a light-year around.');
    lines.push(`Nothing aboard survives. That was the point. You just hoped you’d be watching from further away.`);
    score += 40 + s.round * 3;
  } else {
    title = 'DOWN WITH THE SHIP';
    lines.push(`The countdown reaches zero with you still aboard. ${s.scenario.clockKind.replace(/ in$/, '')}. The ${ship} shudders, and the lights go out for the last time.`);
    score += s.round * 3;
  }

  return { id, won: reason === 'win', title, epilogue: lines, score: Math.max(0, Math.round(score)), exit };
}

function cap(t: string): string {
  return t[0]!.toUpperCase() + t.slice(1);
}

export function exitName(e: ExitId): string {
  return EXITS[e].name;
}
