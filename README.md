# COLDWAKE

A solo, story-driven sci-fi survival RPG. You against the board.

You wake from cryosleep on a dying ship. Something else is awake too. Every run
generates a different ship, disaster, creature, deck layout, set of survivors,
pair of escape routes and secret objective, and ends with an epilogue written
from what you actually did.

Inspired by *Nemesis* (rooms flipped as you explore, noise that draws things
to you, a secret objective), *Citizen Sleeper* (dice rolled first, then
assigned), *Ironsworn: Starforged* (every roll lands clean, with a cost, or a
fail), and *Slay the Spire* (enemies show their intent before you act). The
full design, including what went wrong with the previous version, is in
[`docs/DESIGN.md`](docs/DESIGN.md).

One run is 15–30 minutes. Phone first, works on desktop, installs as an
offline PWA. No accounts, no server, nothing leaves the device.

## How it plays

1. **Roll.** Three dice each round, already rolled.
2. **Act.** Pick a die, then an action. Every action shows exactly what that
   die will do before you commit: **clean**, **cost** or **fail**.
3. **End the round.** Anything in your room strikes. Anything that heard you
   comes closer. The ship does something. The clock ticks.

Finish either of your two ways off the ship before the clock runs out.

- **Noise** sets how far away you're heard. Rooms that can hear you glow red
  on the map; visible creatures show an arrow for where they will move next.
- **Rooms** stay anonymous until you've stood next to them. Walking into one
  for the first time draws a discovery: a body, a stash, a survivor, a log,
  a fire, an ambush.
- **Story cards** are events with choices. Choices that need a check roll a
  fresh die against your stat, and the card shows your odds first.
- **Logs** hidden around the ship add up to the truth of what happened. Learn
  it and you fight back harder.
- **Stress** fills from horror. At the top you panic, and some panics leave
  a lasting trait.

Five incidents (*The Specimen*, *The Signal*, *MOTHER*, *The Guest*, *The
Bloom*), five creature types, four ways off, eight secret objectives, seven
roles (two unlocked by playing), three difficulties, 20 room types.

## Running it

```bash
npm install
npm run dev          # play locally
npm test             # engine, content and whole-run simulation tests
npm run typecheck
npm run build        # production PWA into dist/
npm run e2e          # Playwright: plays a whole run through the real UI
npm run sim -- 500 standard        # bot win rates per role
npm run icons        # re-render the PWA icons
```

## What is where

```
src/
  game/          pure, deterministic engine; no DOM
    generate.ts    ship, incident, layout, survivors, creatures from a seed
    engine.ts      reduce(state, action): the only way state changes
    actions.ts     getActions(): every legal action, with its outcome per die
    effects.ts     wounds, stress and panic, spawning, clues, companions
    director.ts    paces events by reading the player's tension
    endings.ts     writes the epilogue
    bot.ts         a competent-player bot used by the tests
    content/       every room, creature, event, discovery, item and line of prose
  ui/            React and hand-written CSS
    art/           every illustration, drawn as SVG in code
    audio.ts       every sound, synthesised with WebAudio
    components/    title, setup, game, story cards, sheets, ending
test/            engine, content and simulation tests
e2e/             Playwright
docs/DESIGN.md   research, pillars and rules
```

The engine is seeded and deterministic: a seed plus the actions taken is a
complete, replayable run. The same seed builds the same ship; you can set one
on the setup screen and share it.
