import type { ExitId, PersonalId, RoomType } from '../types';

export interface ExitStep {
  room: RoomType;
  label: string;
  desc: string;
}

export interface ExitDef {
  id: ExitId;
  name: string;
  blurb: string;
  steps: ExitStep[];
}

export const EXITS: Record<ExitId, ExitDef> = {
  pods: {
    id: 'pods',
    name: 'Escape pod',
    blurb: 'Two pods left in the bay. They need power, and somebody with the authority to let them go.',
    steps: [
      { room: 'engineering', label: 'Restore power to the pod bay', desc: 'Reroute the bus in Engineering.' },
      { room: 'bridge', label: 'Authorise the launch', desc: 'From the Bridge. Command codes make it certain.' },
      { room: 'podbay', label: 'Launch', desc: 'Climb in, seal the hatch, pull the handle.' },
    ],
  },
  shuttle: {
    id: 'shuttle',
    name: 'Shuttle',
    blurb: 'The hangar shuttle is intact and empty. It needs a fuel cell, and a pilot.',
    steps: [
      { room: 'cargo', label: 'Find a fuel cell', desc: 'Search the Cargo Hold, Engineering, Maintenance or the Hangar.' },
      { room: 'hangar', label: 'Fuel and prep the shuttle', desc: 'Seat the cell and run the pre-flight in the Hangar.' },
      { room: 'hangar', label: 'Fly it out', desc: 'Open the bay doors and go.' },
    ],
  },
  beacon: {
    id: 'beacon',
    name: 'Distress call',
    blurb: 'A salvage tug is in range, if someone calls. Then you have to stay alive until it docks.',
    steps: [
      { room: 'comms', label: 'Realign the array', desc: 'Fix the dish from Comms.' },
      { room: 'comms', label: 'Broadcast', desc: 'Send the call. Help is 6 rounds out, and the ship will hear it too.' },
      { room: 'airlock', label: 'Board the tug', desc: 'Be at the Airlock when it docks.' },
    ],
  },
  jump: {
    id: 'jump',
    name: 'Jump home',
    blurb: 'Plot a course, light the drive, and go back to sleep. Whatever is aboard comes with you.',
    steps: [
      { room: 'bridge', label: 'Plot the jump', desc: 'Set a course on the Bridge.' },
      { room: 'engineering', label: 'Light the drive', desc: 'Bring the jump drive up in Engineering.' },
      { room: 'cryo', label: 'Go back under', desc: 'Return to your pod before the jump.' },
    ],
  },
};

export const RESCUE_ROUNDS = 6;

export interface PersonalDef {
  id: PersonalId;
  name: string;
  /** What the secret says, second person. */
  text: string;
  room?: RoomType;
}

export const PERSONALS: Record<PersonalId, PersonalDef> = {
  blackbox: {
    id: 'blackbox',
    name: 'The record',
    text: 'The insurers will pay anything for the flight recorder. Pull it from the Bridge and take it with you.',
    room: 'bridge',
  },
  sample: {
    id: 'sample',
    name: 'The bonus clause',
    text: 'Your contract has a clause nobody else read. Cut a tissue sample from the nest and carry it out.',
    room: 'nest',
  },
  together: {
    id: 'together',
    name: 'Not alone',
    text: 'You left someone behind once. Not again. Escape with a survivor at your side.',
  },
  kill: {
    id: 'kill',
    name: 'Payback',
    text: 'Those were your people. Kill the thing responsible — or, if there is no one thing, kill three of them.',
  },
  truth: {
    id: 'truth',
    name: 'Somebody has to know',
    text: 'Find out what really happened here before you go.',
  },
  wipe: {
    id: 'wipe',
    name: 'Your name is in it',
    text: 'You signed off on the research that caused this. Wipe the records in the Laboratory.',
    room: 'lab',
  },
  sibling: {
    id: 'sibling',
    name: 'Family',
    text: 'Your sibling signed on to this crew. Find them. Get them out.',
  },
  burn: {
    id: 'burn',
    name: 'Scorched earth',
    text: 'Nothing on this ship can be allowed to reach anyone else. Arm the reactor overload, then get off.',
    room: 'reactor',
  },
};
