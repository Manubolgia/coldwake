# COLDWAKE

A single-player, offline-first space horror board game, as an installable PWA.

You wake because your cryopod failed. Eight other pods are open, none of them on
a scheduled cycle. The *Bellwether*'s orbit is decaying, and there are four
things worth doing before it closes:

| | | |
|---|---|---|
| **RUN** | shuttle bay | Bank the charge and fly it out. |
| **BURN** | bridge | Arm the reactor overload and live through the countdown. |
| **CALL** | comms | Broadcast what happened here and stay at the set until it lands. |
| **KNOW** | ore hold | Cut a specimen out of the nest and send the readings up. |

You name one of them when you wake. All four stay live, all four are tracked on
screen, and finishing any of them ends the run as a win. Nothing is decided for
you at the end.

Nothing aboard knows where you are — it knows where the last noise was. Move
loudly and it comes to the place you were loud. Move quietly, and it arrives,
finds nothing, searches for an hour and gives up on you. What you can see, you
can predict: the line under the schematic says what every visible contact will
do if you end the hour now. A wound is a decision, not an event.

One run is fifteen to thirty minutes. Phone-first, portrait, one thumb. No
accounts, no server, no network at runtime, nothing leaves the device.

---

## Running it

```bash
npm install
npm run dev          # play it locally
npm test             # unit, property and golden-replay suites
npm run typecheck
npm run build        # production PWA into dist/
npm run e2e          # Playwright, drives a whole run through the interface
```

Headless play and balance work:

```bash
npm run play:random -- --seed abc --role engineer --depth 3 --verbose
npm run sim -- --runs 50000 --depth 3 --role engineer --bot heuristic
npm run gate:m1      # any milestone gate: m0 … m6
```

## What is where

```
src/
  engine/      pure, deterministic, no DOM, no dependencies
    rng.ts       seeded PRNG; its state lives inside GameState
    state.ts     types and initial state construction
    reduce.ts    (state, action) => state — the only way anything changes
    actions.ts   legalActions(): the canonical, exhaustive action list
    threats.ts   threat memory, the threat phase, wounds, perception, forecast
    noise.ts     noise as distance, the bag, the board cap, the hive clock
    scoring.ts   ending detection and score
    graph.ts     the ship as a graph: distances, seals, routing
    invariants.ts asserted on every transition in dev and sim builds
  content/     every game number, as JSON. No numbers in code.
  sim/         bots, harness, metrics, reports
  ui/          React, hand-written CSS, amber phosphor terminal
    components/Terminal.tsx  the ship writes its output rather than printing it
test/          unit, property (fast-check) and 30 golden replays
e2e/           Playwright, the real interface only
scripts/       gates, golden regeneration, icons, probes
docs/          balance report and the record of tuning decisions
```

Three rules hold the whole thing together:

1. **The engine is pure and deterministic.** A seed plus an action log is a
   complete, replayable description of a run — which is the bug report format,
   the replay feature and the golden test fixture, for free.
2. **`legalActions(state)` is the only source of legal moves.** The interface
   and all four bots consume it. If the interface could construct an action the
   bots cannot see, every balance number would be a lie; an end-to-end test
   asserts the two agree.
3. **All content is data.** Adding a card is adding a JSON object. Adding a
   *kind* of effect is adding one case to the reducer.

## The bots

| Bot | What it is |
|---|---|
| `random` | Uniform over legal actions. The floor. |
| `greedy` | One-ply, immediate value only, with a weak pull toward the exit. |
| `heuristic` | One-ply with a plan: it picks a route out of the four, prices its feasibility every hour, and switches when one closes. The competent-human proxy. |
| `search` | Two-ply expectimax over the top five candidates, sampling only the dice and the bag. The ceiling. |

Bots see exactly what the interface shows: `legalActions` and the same
perception rules. They carry their own PRNG, separate from the game's, so
`(gameSeed, botSeed)` reproduces a run exactly. Every batch rotates through all
four objectives, because a harness that only ever declares RUN measures a
quarter of the game and reports it as the whole.

Two evaluator bugs found while building this are worth knowing about, because
both made the harness measure a game nobody was playing: pricing unspent time
made the bot hoard it and end the hour with 2.4 of 4 unspent, and scoring the
count of listens rather than what a listen reveals turned LISTEN into a free
point — the bot stood in one compartment listening four times an hour for seven
hours. Neither showed up as a crash or a failing test. Both showed up in a
trace.

## Balance

`docs/REDESIGN.md` is the analysis that produced the current game: what was
measurably wrong with the previous one, and what each system was replaced with.
`docs/BALANCE.md` carries the tuned numbers and the measurements behind them.
`docs/RULES-AS-BUILT.md` is the ruleset as shipped, generated from
`src/content/`.
`docs/INTERFACE.md` records how the interface moves, how the ship talks, and the
advisory voice that teaches the game while you play it. `docs/VISUALS.md` is a
study, not a plan: whether the terminal can carry ASCII plates, icons or
animation without stopping being a terminal, and what each would cost. Nothing
in it is implemented.

## Deploying

GitHub Actions builds and publishes `dist/` to Pages on every push to `main`.
`vite.config.ts` sets `base: '/coldwake/'`; if you fork this under a different
repository name, change it there first — that is the single most common Pages
failure.

Pages has to be switched on once, in the repository's Settings → Pages, with
the source set to GitHub Actions. Until then the deploy job will fail on an
otherwise green pipeline.

## What is left

The gates that can be automated are automated, and `npm run gate:mN` reports
honestly rather than passing quietly. What remains needs a person and a phone:

- **Route parity.** KNOW and CALL finish less often than RUN and BURN at every
  depth; `docs/BALANCE.md` has the spread and the levers. All four clear the
  band that matters (a tenth of all wins), but they are not level yet.
- **The card play-rate gates.** Cards below the floor and above the ceiling are
  listed in the balance report, with the analysis of which are content problems
  and which are limits of a one-ply bot.
- **Twenty runs on a real phone.** The end-of-run survey and the telemetry
  export exist for exactly this; export the JSON from the menu and read it
  against the bot's numbers. Every serious design bug in this project's history
  was found by a person playing it and not by the harness.
- **The device checks.** Install on the phone, aeroplane mode, a complete run
  offline; the Lighthouse audit; thumb reach measured rather than eyeballed.

MIT licensed. Fonts (Michroma, Share Tech Mono) are SIL OFL and self-hosted, so
the game renders correctly offline on first launch.
