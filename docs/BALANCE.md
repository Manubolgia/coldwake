# Balance report

Everything here is measured, not asserted. The loop is
`npm run sim -- --runs N --depth D --role R --bot heuristic`, which writes
`reports/*.json` and a readable `reports/*.md`; `npm run gate:m3` runs the whole
battery and exits non-zero on any metric outside its band.

All measurements use **HeuristicBot**, the competent-human proxy, unless another
bot is named. Every batch rotates through all four objectives — a harness that
only ever declares RUN measures a quarter of the game and reports it as the
whole.

The design this implements is `docs/REDESIGN.md`. The shipped numbers are
`docs/RULES-AS-BUILT.md`, generated from `src/content/`.

---

## The headline: what the rework moved

Depth 2, HeuristicBot, engineer, against the same measurement on the game this
replaced.

| | Before | After |
|---|---|---|
| Cards played of cards drawn | **12%** | **53%** |
| Threat removals per run (killed or shaken off) | **0.11** | **4.97** |
| Threats on the board at hour 15 | 5.4, still climbing | 4.0, capped |
| Compartments entered per run | 2.0 | 4.7 |
| End-the-hour share of all decisions | 29% | 22% |
| Win split across the routes | 97 / 2 / 0.5 / — | 34 / 34 / 19 / 13 |
| Ending multiplier spread | 0.3× – 1.5× | 0.8× – 1.25× |
| Distinct system actions with **zero** uses | 5 of 11 | 2 of 11 |

The first two lines are the two complaints the rework existed to answer. The old
game drew roughly seventy cards a run and played eight of them; it spawned 5.2
threats a run and removed 0.11.

## The ladder

150 runs per objective per depth, seed prefix `bal`, engineer.

| Depth | Win | RUN | BURN | CALL | KNOW | Wounds | Median hour |
|---|---|---|---|---|---|---|---|
| 1 SHALLOW | 72.8% | 77% | 73% | 46% | 42% | 3.0 | 11.9 |
| 2 STANDARD | 63.0% | 66% | 75% | 46% | 41% | 3.6 | 12.4 |
| 3 DEEP | 51.7% | 56% | 65% | 40% | 19% | 5.1 | 12.5 |
| 4 BLACK | 42.3% | 44% | 72% | 21% | 13% | 5.1 | 12.0 |
| 5 KELL | 34.5% | 35% | 41% | 16% | 11% | 6.1 | 12.3 |

The per-route columns are *declared-route completion*: how often a run that said
it came up here to do a thing actually did that thing. The win column counts
every finished route, declared or not.

Difficulty falls monotonically across 38 points. The median hour sits at 12–13
against a 12–17 target, and early resolutions (before hour 8) are 0.8–3.3% at
depths 3–5.

## Every gate at depth 3

1,200 runs, seed prefix `kell`.

| Check | Value | Band | |
|---|---|---|---|
| depth 3 win rate | 49.6% | 42–60% | PASS |
| weakest route share of wins | 12.8% | ≥10% | PASS |
| cards played of cards drawn | 53.2% | ≥35% | PASS |
| compartments entered per run | 4.70 | ≥4 | PASS |
| median resolution turn | 14 | 12–17 | PASS |
| early resolutions (before hour 8) | 2.8% | ≤5% | PASS |
| top action share | 22.3% | ≤25% | PASS |
| dominant route share | 8.9% | ≤15% | PASS |
| largest loss cause | 48.0% | ≤55% | PASS |
| threats removed per run | 4.97 | ≥1.5 | PASS |

Endings at depth 3: escaped 13.0%, carrier 3.8%, overload 17.0%, relay 9.5%,
specimen 6.3%, killed 2.4%, adrift 48.0%.

---

## Where the numbers came from

Each of these is a measurement that changed a rule, in the order they were
found.

**Power stopped being a timer.** The first tuning pass left the reactor paying
2 an hour into a pool, and a trace showed the bot standing in one compartment
for five consecutive hours waiting for the bar to fill. That is the same defect
as the old game with four bars instead of one. The reactor now starts at 1 an
hour and repairs to 3; most of the power in a run is cells and suits in
compartments you have not searched. If you are not searching, you are not
funding anything — and searching is movement, noise and risk.

**The relay stopped resetting.** Holding the transmitter used to break whenever
anything walked into comms. That reads as a rule until you notice comms shares a
bulkhead with the nest: **797 blocked hours to intruders against 26 to an empty
pool**, and CALL finished 32% of the time. The watch now runs only while you are
at the set and the pool can pay, and nothing resets it. Something walking in on
you already costs a capability; it does not also need to cost the watch. Runs
that broadcast now finish the watch almost every time.

**Escalation stopped making three HUNTERS.** With the board capped, every draw
at the cap promoted a STRAY, and by hour eight the ship held three HUNTERS and
nothing else — the crowd this rework exists to delete, in miniature. Promotion
now happens only while STRAYS outnumber HUNTERS; the rest of the pressure goes
into the hold.

**Two per-hour noise sources were doing nothing at all.** The armed overload
added 1 noise to every compartment each hour and the hour's decay took 1 back
off, so an armed reactor made the ship exactly as loud as an unarmed one. The
specimen had the same bug. Both now apply after decay, and both were retuned
once they started to bite (fuse 2/hour, specimen 1/hour).

**Bracing was capped at one.** Two braces an hour for two time was a defensive
turtle with no decision in it. One set of the shoulders an hour; the cards that
ward stack on top of it.

## Two evaluator bugs, recorded because they are the interesting failures

Neither showed up as a crash or a failing test. Both made the harness measure a
game nobody was playing, and both were found by reading a trace rather than a
number.

**Pricing unspent time.** The evaluator scored `player.ap`, so spending time
always looked like a loss. The bot ended the hour with **2.4 of 4 time unspent**,
took 2.0 actions an hour, and played 2.5 cards a run — and every card and pacing
number measured off it was wrong. An hour's unspent time is gone when the hour
turns over; it is worth nothing and is now scored as nothing. Actions per hour
went 2.0 → 4.1 on that one line.

**Scoring the listen tally.** Information is worth an action, so the evaluator
was given `stats.listens`. That counter only goes up, so LISTEN became a free
point with no noise and no cost: the bot stood in one compartment listening four
times an hour for seven consecutive hours. It now scores *contacts currently in
view*, which is bounded by what is aboard and cannot be farmed.

A third, smaller version of the same mistake: valuing cards in hand made holding
a card strictly better than playing it, which is the old game's 88% waste with
extra steps. Playing is now worth more than holding.

---

## What is still outside its band

Reported rather than hidden.

**KNOW is the weakest route at depth**, at 19% / 13% / 11% for depths 3–5
against 65% / 72% / 41% for BURN. The ore hold is the nest — the loudest
compartment on the ship, the one every noise-follower converges on — so the
route asks you to walk into the worst room, make three noise cutting the
specimen free, and then carry something that keeps calling. That is the right
*shape*; the numbers are too steep. The levers, in order of how much they cost
elsewhere: the ore hold's noise floor, `takeSpecimen`'s noise, and the upload's
power.

**BURN is the strongest at four of five depths.** Arming costs 14 power and a
five-to-seven-hour fuse with the ship two louder everywhere per hour, and it is
still the route a competent player completes most often. Lengthening the fuse
is the obvious lever and it has not been tried.

**Depth 1 sits at 72.8%** against a 60–78% band it passes, but at the top of it,
and depth 5 at 34.5% is at the top of 22–42%. The ladder is correctly shaped
and slightly generous overall.

**Two system actions are still never used by the bot**, down from five.
`purgeVents` needs CRAWLERS in the ducts or the MOTHER in them at the moment you
are standing on the bridge with the power; `recharge` needs you to have fired a
weapon and missed, and a one-ply bot can always see the cheaper escape. Both are
plausibly limits of the bot rather than of the content — a human under pressure
is not the same reader — but neither is measured, so neither is claimed. Uses
per run at depth 3, for the record: seal 2.01, chargeShuttle 1.74, armScuttle
0.32, cure 0.28, launch 0.17, takeSpecimen 0.17, repair 0.14, beacon 0.08,
upload 0.08, purgeVents 0, recharge 0.

**Repair fires 0.14 times a run**, which undercuts the intent behind starting
the reactor at 1 an hour: the bot funds its runs almost entirely out of salvage
rather than out of the reactor. Searching is doing the work the design wanted it
to do, but the reactor is not yet the second half of that decision.

**Seven cards sit under the 25% play-rate floor**: `field_repair` and
`slag_door` at 0%, then the weapons and the one-use panic buttons.
`field_repair` reloads a weapon the bot never fires; `slag_door` pays off across
several hours, which a one-ply bot cannot see. **Six sit over the 95% ceiling** —
`bypass`, `brace`, `hardline`, `reroute`, `steady_hands`, `circuit_map` — the
free power, free movement and free information cards, which have no decision
attached to them. Both lists are candidates for the SearchBot to arbitrate
before anything is cut.

## The loop, for the next pass

1. `npm run sim -- --runs 20000 --depth 3 --bot heuristic --entropy`
2. Read `reports/heuristic-d3-engineer.md`; find the metric furthest outside band.
3. Change **one** number in `src/content/`.
4. Re-run. Confirm the target moved and nothing else broke.
5. `npm run golden:regen`, review the diff, commit it with the report.

And before trusting any of it: read a trace. `npx tsx scripts/trace.ts engineer 3`
prints an hour-by-hour account of what the bot believed and why. Both of the
worst bugs in this document were invisible in the summary and obvious in the
trace.
