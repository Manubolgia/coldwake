export const SHIP_PREFIX = ['MSV', 'ISV', 'CSV', 'RV', 'UCS', 'TSV'];

export const SHIP_NAMES = [
  'Bellwether',
  'Caldera',
  'Hesper',
  'Anselm',
  'Morrow',
  'Thessaly',
  'Kestrel Deep',
  'Lantern',
  'Ninefold',
  'Sorrow’s Reach',
  'Halcyon',
  'Tamsin Grey',
  'Obelisk',
  'Candlewick',
  'Perihelion',
  'Low Mercy',
  'Wakeful',
  'Saint Ondine',
  'Coriolis',
  'Mare Nubium',
  'Gallowglass',
  'Heron',
  'Vesper Tide',
  'Long Patience',
];

export const SHIP_CLASSES = [
  { name: 'ore hauler', crew: [9, 14] },
  { name: 'research vessel', crew: [12, 20] },
  { name: 'colony tender', crew: [16, 28] },
  { name: 'survey cutter', crew: [6, 10] },
  { name: 'salvage tug', crew: [7, 11] },
] as const;

export const CLOCK_KINDS = [
  'Orbit decays in',
  'Reactor fails in',
  'Air runs out in',
  'Hull gives in',
];

export const FIRST_NAMES = [
  'Ada', 'Bram', 'Cass', 'Dev', 'Eli', 'Fen', 'Greer', 'Hollis', 'Ines', 'Jun', 'Kit', 'Lior',
  'Mara', 'Nico', 'Oona', 'Pax', 'Quinn', 'Rhee', 'Sol', 'Tavi', 'Uma', 'Vale', 'Wren', 'Yusuf',
  'Zola', 'Arlo', 'Bex', 'Cato', 'Dara', 'Emeka', 'Farah', 'Idris', 'Juno', 'Kasimir', 'Lena',
  'Mirela', 'Noor', 'Osei', 'Priya', 'Rafe', 'Saoirse', 'Tomas', 'Yara', 'Ziggy',
];

export const LAST_NAMES = [
  'Okafor', 'Varga', 'Lindqvist', 'Tanaka', 'Moreau', 'Achterberg', 'Rahman', 'Castellanos',
  'Kowalczyk', 'Mbeki', 'Halloran', 'Petrov', 'Ishikawa', 'Adeyemi', 'Brandt', 'Quill', 'Sato',
  'Falk', 'Okonkwo', 'Reyes', 'Novak', 'Ferreira', 'Ashby', 'Kaur', 'Duval', 'Harlan', 'Mercer',
  'Obi', 'Vance', 'Soto',
];

export const SURVIVOR_JOBS = [
  { job: 'cook', helps: 'nerve' },
  { job: 'rigger', helps: 'might' },
  { job: 'navigator', helps: 'wits' },
  { job: 'mechanic', helps: 'tech' },
  { job: 'security officer', helps: 'might' },
  { job: 'botanist', helps: 'wits' },
  { job: 'comms officer', helps: 'tech' },
  { job: 'chaplain', helps: 'nerve' },
  { job: 'cargo loader', helps: 'might' },
  { job: 'data analyst', helps: 'tech' },
] as const;
