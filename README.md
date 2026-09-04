# COLDWAKE

A single-player, offline-first space horror board game, as an installable PWA.

You wake because your cryopod failed. Eight other pods are open, none of them on
a scheduled cycle. The *Bellwether*'s orbit is decaying and the shuttle needs
power you have not banked yet. Most runs end badly; the interesting part is
which bad.

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
    threats.ts   the threat phase, wounds, CARRY draws
    noise.ts     the noise phase and the bag
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
| `heuristic` | One-ply with phase awareness: bank power, read CARRY when blind, commit to an ending when the shuttle stops being reachable. The competent-human proxy. |
| `search` | Two-ply expectimax over the top five candidates, sampling only the dice and the bag. The ceiling. |

Bots never read a face-down CARRY card. They carry their own PRNG, separate
from the game's, so `(gameSeed, botSeed)` reproduces a run exactly.

## Balance

`docs/BALANCE.md` carries the tuned numbers, the measurements behind them, and
every place the shipped values differ from the v0 numbers in the design
document — with the reason. `docs/RULES-AS-BUILT.md` is the ruleset as shipped.
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

- **The deep end is not in band.** Depth 1 and depth 3 win rates are; depth 5 is
  eight points high because the scuttle is a reliable consolation. The two ways
  out — a fuse that lengthens with depth, or counting only a Clean Break as a
  win — are set out in `docs/BALANCE.md`. The choice is the designer's.
- **The card play-rate gates.** Twenty-three cards sit under the floor and six
  over the ceiling; the analysis of which of those are content problems and
  which are limits of a one-ply bot is in the same document.
- **Milestone 7.** Twenty runs on the real phone, the protocol in Part 10 of the
  design document. The end-of-run survey and the telemetry export exist for
  exactly this; export the JSON from the menu and read it against the bot's
  numbers.
- **The device checks.** Install on the phone, aeroplane mode, a complete run
  offline; the Lighthouse audit; thumb reach measured rather than eyeballed.

MIT licensed. Fonts (Michroma, Share Tech Mono) are SIL OFL and self-hosted, so
the game renders correctly offline on first launch.
