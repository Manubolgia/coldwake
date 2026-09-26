# COLDWAKE — design

A solo, story-first survival RPG on a dying spaceship. You against the board.
Every run is a different ship, a different disaster, a different thing in the
dark, and a different way out.

This document is the plan the game was built from. It starts from what went
wrong with the previous version, takes what works from the games that do this
well, and ends with the rules as implemented.

---

## 1. Why the old game failed

The previous COLDWAKE had a solid deterministic engine and almost no game on
top of it. Played for ten minutes, the problems were obvious:

| Problem | What the player saw |
|---|---|
| **Packed screen** | Map, two status strips, a meter row, a terminal log, a four-card hand and an action list, all at once, in abbreviations (`SPA`, `RCT`, `CMS`). |
| **Counter-intuitive** | "Noise as distance", a spawn bag, "bank power", "set aside", a free play plus four time units. Five abstract systems before the first interesting choice. |
| **Boring** | The best line was *bank power, hide, end the hour* thirteen times. Most rooms never mattered. |
| **Frustrating** | Monsters piled up with nothing that removed them, and moved after you committed, with no warning. |
| **No story** | Same ship, same map, same four objectives. The prose was a flavour layer on a spreadsheet. Nothing you did changed what the run was *about*. |
| **Visuals** | One amber colour, monospaced text, boxes. No sense of place. |

The rebuild throws away the rules, the content and the interface. Only the
stack (Vite, React, TypeScript, a PWA on GitHub Pages) survives.

## 2. What we took from other games

| Game | What it does well | What COLDWAKE takes |
|---|---|---|
| **Nemesis** (Awaken Realms) | You wake from hypersleep; rooms are face-down tiles flipped as you explore; noise draws intruders; every player has a secret objective; the ship itself breaks down. The solo mode deals you two objectives and makes you commit at the first encounter. | Face-down rooms revealed on entry. Noise summons. Secret personal objective. Two ways off the ship. Ship hazards (fire, breaches, dark). Infection you don't know you carry. |
| **Citizen Sleeper** | Dice are rolled *at the start of the cycle* and then assigned to actions. You know your resources before you choose, so the question becomes "what do I need to succeed at, and what can I afford to fail?" Dice lost to your condition. | The whole action economy. Three pre-rolled dice a round; you choose which die goes to which action, and see the exact outcome before you commit. Fewer dice when badly hurt. |
| **Ironsworn: Starforged** | Every roll lands on *strong hit / weak hit / miss*. The weak hit — success with a cost — is where story comes from. Oracle tables generate the world so no two sessions repeat. | Every check has the same three bands: **Clean**, **Cost**, **Fail**. Scenarios, survivors, events and discoveries are drawn from tables. |
| **Slay the Spire** | Enemies show their intent before you act. You lose because you chose badly, not because you were surprised. | Visible creatures show what they will do when the round ends, and the forecast updates live as you make noise. |
| **Left 4 Dead's AI Director** | Pacing is managed: intensity builds, peaks, then the game backs off so the next peak lands. | An event director that reads your tension (wounds, stress, creatures nearby, rounds since the last scare) and picks a breather or an escalation. |
| **Mothership / Darkest Dungeon** | Stress as a second health bar, and breaking under it changes who you are. | Stress fills from horror. At the top you panic: you scream, freeze, drop something, bolt, or come out of it with a lasting trauma. |
| **FTL** | Short runs, text events with choices tied to your crew and kit, emergent stories told by what went wrong. | Story cards with choices; options that only appear because of your role, a companion, or an item you carry. |
| **Alien: Isolation** | One unkillable hunter you manage, not beat. Fire drives it off. | The Stalker: very hard to kill, but damage or fire makes it retreat. |

## 3. Pillars

1. **Read it in one glance.** One room at a time. Three dice. A short list of
   things you can do here, each saying in plain words what happens with the die
   you're holding. No abbreviations, no hidden rules.
2. **Every choice is a trade.** High dice are scarce. Spending a six on a quiet
   walk means the terminal gets a two.
3. **Fair fear.** You can always see what's coming if you look: noise rings on
   the map, creature intents, a clock that counts down. Surprises come from
   story cards, never from hidden rules.
4. **A new story every run.** Ship, incident, creature, layout, survivors,
   exits, secret objective, events, and the ending you get are all generated.
   The ending writes up *your* run.
5. **Short.** 20–30 minutes. Save on every action. Phone first, one thumb.

## 4. The run

### 4.1 Setup — the story generator

Each run draws:

- **A ship** — name, class (ore hauler, research vessel, colony ark, survey
  cutter, military tender) and crew complement.
- **An incident** — what happened while you slept. It decides the creature,
  where its nest is, four log fragments hidden around the ship, the truth they
  add up to, and the creature's weakness.
  - *The Specimen* — a research sample woke up. **Stalker** + crawlers.
  - *The Signal* — a transmission from nowhere rewrote the crew. **The Changed**.
  - *MOTHER* — the ship's mind decided the crew were the danger. **Drones**.
  - *The Guest* — something came aboard from a derelict, and it wears faces.
    **Mimic**; any survivor might be it.
  - *The Bloom* — spores from the hydroponics bay. **The Changed** + crawlers,
    infection everywhere.
- **A layout** — 14 compartments grown on a grid, with loops, so there is
  always more than one way round. Your cryo bay is at one edge; the nest is as
  far away as the ship allows.
- **Two ways off**, from: escape pods, the shuttle, a distress beacon (then
  survive until rescue docks), or plotting a jump and going back under.
- **You** — role, name, and a secret objective from your background.
- **Survivors** — up to two, placed in unexplored rooms, each with a name, a
  job and a temperament.

### 4.2 The round

1. **Roll.** You get three dice (two if badly hurt, +1 from a companion or a
   stim).
2. **Act.** Tap a die, tap an action. The result is fixed by the die plus your
   stat, and every action shows what that die will do before you tap it.
   Each action makes some noise.
3. **End the round.** Unused dice steady your nerves (−1 stress each). Then
   the ship moves:
   1. creatures in your room attack, unless you are hidden;
   2. creatures that heard you move toward you;
   3. hazards burn;
   4. the clock ticks; the nest may breed;
   5. the director draws an event.

### 4.3 The three bands

Die + stat (+ item) − difficulty:

| Total | Band | Meaning |
|---|---|---|
| 6+ | **Clean** | It works. |
| 4–5 | **Cost** | It works, and something goes wrong: noise, stress, a scratch. |
| 3 or less | **Fail** | It doesn't, and something goes wrong. |

Movement uses the same bands for stealth: clean is silent, cost makes a
little noise, fail is loud. Fighting compares to the creature's guard instead
of 6.

### 4.4 Noise and hunting

Noise made this round sets how far you are heard: a total of 2 carries two
compartments. Every creature inside that range fixes on the room you are in and
comes one step (two for fast ones). Outside it, creatures go to where they last
heard you, search, then drift. The Stalker hunts even without noise every few
rounds. On the map, rooms inside your noise range glow red, and every visible
creature carries an arrow to where it will be next.

A creature arriving in your room does not attack that round. You get your turn
to fight, run or hide first.

### 4.5 You

| Stat | Used for |
|---|---|
| **Might** | fighting, forcing things, holding on |
| **Tech** | repairs, terminals, machines |
| **Wits** | searching, sneaking, noticing |
| **Nerve** | fear, talking people down |

5 health. 6 stress; at 6 you panic and drop back to 2. Five items.
Infection is invisible until a scan or symptoms reveal it, and it turns you if
left long enough.

Roles: **Engineer** (Tech never fails outright), **Marine** (extra damage),
**Medic** (heals more, sees infection), **Scientist** (fewer clues needed for
the truth), **Pilot** (higher panic threshold, launches never fail). Unlocked by
playing: **Stowaway** (silent on lower dice) and **Android** (no stress from
horror, can't be infected, can't use medical supplies).

### 4.6 Rooms

Rooms are anonymous until you have stood next to them. Entering one for the
first time turns its tile: a discovery card (a body, a cache, a log, a
survivor, a fire, an ambush, or just silence). Each room type offers its own
action — the medbay heals, the galley calms you, the security room shows every
creature, the airlock can blow a creature into space with you holding on.

### 4.7 Story cards

Discoveries, encounters, events, clues, panic and companion moments appear as
cards with an illustration and choices. A choice that needs a check rolls a
fresh die. Role, companion and item-specific options appear only when they
apply.

### 4.8 The clock

A countdown in rounds — the reactor, the orbit, the air, depending on the
ship. It splits the run into three acts; each act the director is less kind and
the nest breeds faster. Creatures are capped (three, then four, then five) so
the ship never fills up.

### 4.9 Endings

Reach a way off and finish it, and the game writes the epilogue from the run:
how you left, who came with you, whether you carried something out, whether you
learned the truth, whether your secret objective was done, whether the thing is
still alive, and a last line about afterwards. Die, and it writes that instead.
Every one of those lines, and the ending's title, is drawn at random from a
pool of variants, seeded by the run, so the same run always ends the same way
and the next one almost never does. Every run is kept on the memorial.

## 5. Interface

One screen, no scrolling. The story happens in the middle of it.

- **HUD** (top): health, stress, the clock, and buttons for the Goals, You,
  Log and Menu sheets.
- **Stage** (the rest of the screen): the room you are in, full-bleed. It
  shows the room as it is now — burning, dark, open to space, with whatever
  is in there with you. Its name and status chips sit top left; a minimap
  sits top right and opens the full map, where tapping a neighbouring room
  shows what going there costs. Visible threats run along the bottom.
- **The narrator** sits over the lower middle of the stage, like a game
  master at the table. Everything the engine logs is told there a line at a
  time, at reading pace (slow, normal, fast or instant, in the Menu), with
  pauses on punctuation and between lines. Tapping it says the rest at once.
  Each round opens with a line of table talk: the round, the clock, what the
  things you can see are about to do, and what the dice came up. Story cards
  are told in the same panel after the narrator has finished speaking, and
  the scene behind switches to the card's picture; a check rolls its die in
  the panel before the result is read. Nothing can be done while the
  narrator is speaking or a card is waiting.
- **Deck** (bottom): the dice, noise, End round, and a row of tabs — Danger,
  Goal, Here, Kit, Move — each opening its actions in a drawer above the
  dice, so a long list never pushes the story off screen. Danger opens by
  itself when something comes into the room.
- Wide screens put the map and the action list in a column on the right and
  keep the list open.

**Art.** Every picture is rendered in code, offline. Rooms are small 3D
scenes built from boxes, prisms and lathed shapes, lit by coloured point
lights with falloff, fogged with depth, with contact shadows under furniture,
light shafts under lamps, bloom on anything that glows, and film grain. Walls
and floors are split into panels so the light falls off across the plating.
Creatures are painted silhouettes built from tapered limbs, backlit with a
rim of light, wet highlights and glowing eyes, and placed into the 3D scene at
a depth. Events, finds, hazards and endings reuse the same pieces; the ship
itself is a 3D model lit by a distant sun. Procedural ambient audio (hull
drone, heartbeat when something is close, stingers). Reduced motion and
larger text settings.

## 6. Engine

- `src/game/` is pure TypeScript with no DOM: seeded RNG kept in state,
  `reduce(state, action)` as the only mutation, `getActions(state)` as the only
  source of legal moves with their previews.
- Content lives in `src/game/content/` as typed data.
- A heuristic bot plays thousands of seeds in tests to hold the win rate in a
  band and to prove no seed crashes or soft-locks.

## 7. Balance as built

Numbers live in `src/game/content/` and `src/game/generate.ts`.

| | Story | Standard | Nightmare |
|---|---|---|---|
| Clock (rounds) | 22 | 17 | 14 |
| Health | 6 | 5 | 4 |
| Survivors aboard | 2 | 2 | 1 |
| Creatures at start | primary + incident extras | +1 | +2 |
| Creature cap by act | 2 / 3 / 3 | 3 / 4 / 5 | 3 / 5 / 6 |
| Nest breeds every (by act) | 8 / 6 / 5 | 7 / 5 / 4 | 5 / 4 / 3 |
| Everything hunts without noise | — | — | every 3 rounds |

Most exit steps need **2 progress**: a clean result does 2, a cost does 1, so
a high die finishes a step in one action and a middling one takes two.
A failed search doesn't use up the room, so a fuel cell can never become
unreachable.

The heuristic bot in `src/game/bot.ts` reads every preview perfectly, so it
plays better than a new player. Measured with `npm run sim` over 200–300 runs
per role:

| | Win rate | Typical length |
|---|---|---|
| Story | ~88% | 7 rounds |
| Standard | ~70–90% by role (the Marine is the easiest) | 8–10 rounds |
| Nightmare | ~50–68% | 7–9 rounds |

A person reading every card and exploring runs longer, 10–14 rounds, which
is where the 15–30 minute target comes from. `test/sim.test.ts` holds the
standard rate between 55% and 92% and checks that every seed of every role
and difficulty finishes.
