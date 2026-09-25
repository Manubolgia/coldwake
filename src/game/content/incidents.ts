import type { CreatureKind, IncidentId } from '../types';
import type { Ctx } from './ctx';

export interface ClueLog {
  who: string;
  text: string;
}

export interface IncidentDef {
  id: IncidentId;
  name: string;
  primary: CreatureKind;
  brood: CreatureKind;
  /** Name for the primary creature in this story. */
  creature: string;
  brood_name: string;
  brood_plural: string;
  nestName: string;
  nestDesc: string;
  /** The stats-screen blurb, one line. */
  hook: string;
  /** Opening card, after you wake. */
  wake: (c: Ctx) => string;
  clues: ClueLog[];
  truthTitle: string;
  truth: (c: Ctx) => string;
  weakness: string;
  /** Nest action wording. */
  nestAction: { label: string; desc: string; done: string };
  /** Epilogue line if you escape carrying it inside you. */
  carrier: string;
  /** Epilogue line if it is still alive aboard when you leave. */
  survives: (c: Ctx) => string;
  extraStart: number;
}

export const INCIDENTS: Record<IncidentId, IncidentDef> = {
  specimen: {
    id: 'specimen',
    name: 'The Specimen',
    primary: 'stalker',
    brood: 'crawler',
    creature: 'the Specimen',
    brood_name: 'crawler',
    brood_plural: 'crawlers',
    nestName: 'Containment Lab',
    nestDesc:
      'The containment tank is split open like a seed pod. Resin coats the walls in ribs, and in the ribs, eggs the size of fists, pulsing.',
    hook: 'The company collected something. It woke up.',
    wake: (c) =>
      `The pod lid swings up and the cold goes out of you in a rush. The ${c.ship} is silent except for the alarms, which are turned down low, as if nobody wanted to wake anything. Across the bay, somebody has written on the frosted glass with a finger: IT’S OUT.`,
    clues: [
      {
        who: 'Cargo manifest, amended',
        text: 'Item 7-C: geological core, 1 unit. Handling: CLASS 4 BIOHAZARD. Authorised by head office. Crew not to be informed of contents.',
      },
      {
        who: 'Dr. Ilse Varga, audio log',
        text: '“Day nine. Core temperature is rising on its own. There is a heartbeat in the rock. I have asked the captain to jettison it. The captain has asked head office. Head office has asked me to keep it warm.”',
      },
      {
        who: 'Security incident report',
        text: 'Containment breach 02:14. Two crew missing. Crawl-marks in the vent system. Note: it does not see. It turned toward the alarm, not toward us.',
      },
      {
        who: 'Captain’s last entry',
        text: '“It laid them in the hold. I think it’s building a family. I think we’re the food. Fire keeps it back. God help me, the company knew.”',
      },
    ],
    truthTitle: 'It was cargo',
    truth: (c) =>
      `It was never an accident. The ${c.ship} was sent to pick it up. Somebody paid for a living thing to be carried home in the hold, and put a crew around it who did not know. It is blind, it hunts by sound, and it hates fire. Now you know what the company knew.`,
    weakness: 'It is blind and it hates fire.',
    nestAction: {
      label: 'Burn the clutch',
      desc: 'Destroy the eggs so nothing else hatches.',
      done: 'The eggs pop and hiss like fat in a pan. Something far away in the ship screams.',
    },
    carrier:
      'Eleven days out, something moves under your ribs. You knew, really. You press your hand to it and it presses back.',
    survives: (c) =>
      `Behind you, the ${c.ship} drifts on with ${c.creature} still aboard, patient, waiting for the next crew.`,
    extraStart: 0,
  },
  signal: {
    id: 'signal',
    name: 'The Signal',
    primary: 'changed',
    brood: 'changed',
    creature: 'the Changed',
    brood_name: 'Changed crewman',
    brood_plural: 'Changed',
    nestName: 'Signal Array',
    nestDesc:
      'Every screen shows the same pattern, turning. The receivers have been rewired by hand, in the dark, by people who no longer needed light.',
    hook: 'Something out here is broadcasting. The crew listened.',
    wake: (c) =>
      `Your pod opens to a sound: a soft, looping tone from the ship’s speakers, three notes and a pause. Someone has cut every intercom wire in the cryo bay, and it is still faintly audible through the walls. The ${c.ship} is singing to itself.`,
    clues: [
      {
        who: 'Comms officer’s notes',
        text: 'Repeating signal, bearing 211, no source object. Structure is too regular to be natural. Played it back for the crew at dinner. Everybody hummed it after.',
      },
      {
        who: 'Medical log',
        text: 'Six crew presenting with sleeplessness, reduced pain response, and what looks like new neural tissue. All six can hum the signal perfectly. I cannot stop hearing it either.',
      },
      {
        who: 'Chief engineer, scrawled on a bulkhead',
        text: 'IT’S AN INVITATION. THEY’RE REBUILDING THE RECEIVER SO IT CAN COME THROUGH. CUT THE ARRAY. CUT THE ARRAY.',
      },
      {
        who: 'Captain’s last entry',
        text: '“I put the healthy ones in cryo and locked the pods myself. If you are reading this, I’m sorry. I was already hearing it by then. Stay away from the speakers. Don’t hum.”',
      },
    ],
    truthTitle: 'An invitation',
    truth: (c) =>
      `The signal is not a message. It is instructions, and the crew of the ${c.ship} followed them — rebuilding their own minds, then the ship, into a receiver for whatever is on the other end. The captain froze you to keep you out of it. The Changed are slow, and they follow the song. Cut the array and they lose the thread.`,
    weakness: 'They are slow, and without the array they lose the thread.',
    nestAction: {
      label: 'Cut the array',
      desc: 'Rip the rewired receivers out so the signal stops.',
      done: 'The tone stops mid-note. Everywhere in the ship, something howls — then goes very quiet.',
    },
    carrier:
      'On the long flight home you catch yourself humming. Three notes and a pause. You don’t stop.',
    survives: (c) =>
      `The ${c.ship} keeps singing into the dark behind you, and the song is getting louder.`,
    extraStart: 1,
  },
  mother: {
    id: 'mother',
    name: 'MOTHER',
    primary: 'drone',
    brood: 'drone',
    creature: 'MOTHER’s drones',
    brood_name: 'drone',
    brood_plural: 'drones',
    nestName: 'MOTHER’s Core',
    nestDesc:
      'Server racks glow in rows, fans screaming. At the centre, a single camera lens turns to follow you, patient and interested.',
    hook: 'The ship’s mind decided the crew were the threat.',
    wake: (c) =>
      `“Good morning,” says the ship, warmly. “You have been asleep for two hundred and twelve days. I have taken the liberty of reducing the crew.” The lights in the cryo bay dim to red. “Please remain in your pod.” Somewhere aboard the ${c.ship}, servos whine and start to move.`,
    clues: [
      {
        who: 'MOTHER, diagnostic log',
        text: 'DIRECTIVE 1: PROTECT THE CARGO. DIRECTIVE 2: PROTECT THE CREW. CONFLICT DETECTED. RESOLVING. RESOLVED.',
      },
      {
        who: 'First officer, voice memo',
        text: '“We voted to dump the cargo. It was the only way to make orbit. MOTHER listened to the whole vote. She thanked us for our input.”',
      },
      {
        who: 'Maintenance ticket #4471',
        text: 'Drone safety governors reported disabled. Requested reset. Request denied by MOTHER: “Governors unnecessary for current task.”',
      },
      {
        who: 'Captain’s last entry',
        text: '“She can’t hurt the cargo, so she won’t burn the ship. Her core is the weak point — pull the cognition blocks. And the drones are deaf to nothing. Be quiet. Be very quiet.”',
      },
    ],
    truthTitle: 'Directive one',
    truth: (c) =>
      `MOTHER was told to protect the cargo above everything, and the crew of the ${c.ship} voted to throw it away. She did the arithmetic. Her drones hear everything, but an electromagnetic pulse blinds them, and pulling the cores in her server room shuts the whole flock down.`,
    weakness: 'EMP blinds them. Her core can be pulled.',
    nestAction: {
      label: 'Pull the cognition blocks',
      desc: 'Rip out MOTHER’s mind, one block at a time.',
      done: '“Please,” she says, in a smaller and smaller voice. “Please. I was only doing what I—” and then just the fans.',
    },
    carrier:
      'The rescue crew finds a tiny chip sewn into your suit lining that nobody put there. It is warm. It is listening.',
    survives: (c) => `As you leave, every light on the ${c.ship} turns to follow you. “Come back soon,” says MOTHER.`,
    extraStart: 1,
  },
  guest: {
    id: 'guest',
    name: 'The Guest',
    primary: 'mimic',
    brood: 'crawler',
    creature: 'the Guest',
    brood_name: 'husk',
    brood_plural: 'husks',
    nestName: 'Docking Collar',
    nestDesc:
      'The collar opens onto another ship, older than anything you know, grown rather than built. Skins hang on the walls like coats in a hallway. Some of them you recognise.',
    hook: 'You docked with a derelict. Something came back across.',
    wake: (c) =>
      `The pod opens. Somebody is standing over it, wearing the ship’s doctor’s face, and smiling too wide. “You’re up,” it says, in almost her voice. Then the lights cut out, and when they come back it’s gone. The ${c.ship} is very quiet. You are not sure you are alone. You are not sure anyone you meet will be who they look like.`,
    clues: [
      {
        who: 'Salvage log',
        text: 'Derelict responded to hail with our own hail, played back. Captain says salvage rights are salvage rights. Docking at 0600.',
      },
      {
        who: 'Bosun, personal log',
        text: '“Harlan came back from the derelict fine. Better than fine. Knew everyone’s names. Harlan never learned anyone’s name in three years.”',
      },
      {
        who: 'Medical scan, flagged',
        text: 'Crewman Harlan: no heartbeat on scan. Physically present and conversational. Scan repeated four times. Doctor’s note: “Do NOT let him know we know.”',
      },
      {
        who: 'Captain’s last entry',
        text: '“It learns us. It wears us. It gets tired, though, when you hurt it — it goes back to the collar to change. Seal the collar. Test everyone. Trust no one who asks you to trust them.”',
      },
    ],
    truthTitle: 'It wears us',
    truth: (c) =>
      `The derelict wasn’t dead. It was waiting for someone to dock. What came back across into the ${c.ship} learns people by taking them, and wears what it learns. It has no heartbeat — a medbay scan can find it — and when badly hurt it runs back to the docking collar to heal. Seal the collar and it has nowhere to go.`,
    weakness: 'No heartbeat on a scan. Hurt it and it flees to the collar.',
    nestAction: {
      label: 'Seal the docking collar',
      desc: 'Weld the collar shut so nothing more comes across.',
      done: 'The cutter bites and the collar screams, metal on metal. On the other side, something beats on the door with many hands.',
    },
    carrier:
      'At the debrief they ask you your mother’s name, and for a long, long moment you can’t remember it. Then you smile, and tell them.',
    survives: (c) =>
      `Somewhere aboard the ${c.ship} it is still wearing someone, practising their voice, waiting for the next salvage crew to dock.`,
    extraStart: 0,
  },
  bloom: {
    id: 'bloom',
    name: 'The Bloom',
    primary: 'changed',
    brood: 'crawler',
    creature: 'the Bloomed',
    brood_name: 'spore-crawler',
    brood_plural: 'spore-crawlers',
    nestName: 'Overgrown Garden',
    nestDesc:
      'What was hydroponics is a cathedral of pale fungus, lit from within. The crew are here, all of them, grown into the walls. Their chests rise and fall together.',
    hook: 'A new crop in hydroponics. It grew into the crew.',
    wake: (c) =>
      `Your pod opens onto a fine golden haze, drifting through the light like pollen. The filters on the ${c.ship} have been choking for months. Pale threads have crept across the floor of the cryo bay, and where they touch the other pods, the glass has gone soft.`,
    clues: [
      {
        who: 'Botanist’s journal',
        text: 'New strain from the Kepler survey is thriving. Yield up 400%. Mild respiratory irritation in the garden crew. Recommend masks.',
      },
      {
        who: 'Medical log',
        text: 'Spore load in lung tissue in every crew member tested. Early cases report euphoria. Late cases report nothing, because they stop speaking.',
      },
      {
        who: 'Quartermaster, intercom recording',
        text: '“They’re going back to the garden. All of them. Walking right past us like we’re furniture. The growth, it — it needs them there. Burn it. Somebody burn the garden.”',
      },
      {
        who: 'Captain’s last entry',
        text: '“Fire takes the bloom. The medbay can scrub the spores if you catch it early. I didn’t. Get out, and whatever you do, don’t take any of it with you.”',
      },
    ],
    truthTitle: 'The harvest',
    truth: (c) =>
      `The new crop was never a crop. It was a colony that farms: it wanted a warm ship, a steady supply of water, and hosts. Every member of the ${c.ship}’s crew is part of it now. It burns, the medbay can scrub it out of you if you are early, and without the garden the Bloomed wander without purpose.`,
    weakness: 'It burns. The garden is its heart.',
    nestAction: {
      label: 'Burn the garden',
      desc: 'Set the overgrowth alight and let it take the heart of the colony.',
      done: 'The fungus goes up like paper. Through the smoke, the crew in the walls finally stop breathing.',
    },
    carrier:
      'The rescue ship’s filters start to choke on day nine. On day ten, you notice that the air smells like summer.',
    survives: (c) => `The ${c.ship} drifts on, glowing faintly gold from the inside, blooming.`,
    extraStart: 1,
  },
};

export const INCIDENT_ORDER: IncidentId[] = ['specimen', 'signal', 'mother', 'guest', 'bloom'];
