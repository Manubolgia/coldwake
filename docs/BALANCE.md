# Balance report

Everything here is measured, not asserted. The tuning loop is
`npm run sim -- --runs N --depth D --role R --bot heuristic`, which writes
`reports/*.json` and a readable `reports/*.md`; `npm run gate:m3` runs the whole
Part 9 battery and exits non-zero on any metric outside its band.

All measurements below use **HeuristicBot**, the competent-human proxy, unless
another bot is named.

## Where the shipped numbers differ from the v0 document

The design document is explicit that Part 4's numbers are v0 and expected to
change after simulation. They did. Each change below is a measurement, not a
preference.

| Number | v0 | Shipped | Why |
|---|---|---|---|
| Shuttle requirement | 12 | 30 (D1–D3), 28 (D4), 30 (D5) | At 12 the run resolved on turn 8–10 with nothing spent on defence: the clock never bit and the median resolution turn sat five below its band. 30 puts the median at 13–16 and makes power spent on survival cost turns you can feel. |
| Pilot's discount | needs 9 | needs 4 less than the depth's requirement | Same shape, rescaled: a flat delta so the role stays distinct at every depth. |
| Reactor output at depth 2+ | starts at 1 | starts at 2 (1 at depth 5 was tried and cut) | Starting degraded is a cliff, not a slope: the reactor sits next to the nest, so the repair the player needs is exactly where the threats congregate. Depth 2 fell from ~60% to 17% on this modifier alone. Depth now escalates through the bag, the clock, the CARRY deck and the ore-hold floor instead. |
| CARRY deck | 8 clean / 4 infested at every depth | 10/2 (D1–D2), 9/3 (D3), 8/4 (D4), 7/5 (D5) | At 8/4 the Carrier ending took 36–52% of runs at every depth and was 80% of all losses — one system dominating the loss table. The ladder now makes infection a depth pressure rather than a constant. |
| Scuttle cost | 5 power | 8 power | At 5 it was a free consolation prize taken on the turn the shuttle became unreachable. At 8 it is a real fork: the power you arm with is power you cannot bank. |
| CARRY scan | 2 AP, 2 power | 1 AP, 1 power | At the original cost no bot ever scanned, at any depth — pillar 3 failing in the measurement. At 1/1 the scan rate is 32–44%, inside the 20–80% band the playtest protocol asks for. |
| Purge blood | wound draws a replacement CARRY card | wound draws no card | As written, purging swapped one unknown card for another and was strictly a trap. It is now a genuine, expensive cure: one fewer sample at the price of a burn and a panic. |
| Beacon | 4 power | 3 power | So that broadcasting stays reachable in the runs where arming the reactor is not. |

## Two rules the document implies but does not state

Both were added because the simulation found the hole, and both are in
`src/content/` where they can be tuned.

**The nest breathes.** Every second turn, the ore hold gains 2 noise
(`threats.json › nestNoise`). Without it, a player who simply creeps to the
shuttle bay and waits generates no noise, triggers no bag draws, and faces zero
threats: the measured win rate for silent play was 98.3% with 0.0 wounds and a
single dominant route taken by 100% of runs. Pillar 1 says the player feeds the
threat; this says the ship does too, slowly, so that silence buys time rather
than safety.

**Nothing to hear means they hunt.** A threat whose behaviour is "move toward
the loudest node" and which is already standing on it moves toward the player
instead. Without this, threats spawned at the nest — which is the loudest node
by default — piled up there and never left.

## Current measurements

HeuristicBot, 1,000 runs per depth, engineer, seed prefix `kell`:

| Depth | Win rate (clean + scuttle) | Clean break | Carrier | Scuttle | Lost | Median turn | Wounds | Scan rate |
|---|---|---|---|---|---|---|---|---|
| 1 | 65.6% | 65% | 30% | 1% | 4% | 14 | 5.2 | 36% |
| 2 | 57.1% | 54% | 37% | 3% | 6% | 15 | 7.3 | 42% |
| 3 | 49.6% | 33% | 30% | 16% | 21% | 16 | 7.9 | 35% |
| 4 | 44.1% | 26% | 40% | 18% | 16% | 14 | 8.1 | 42% |
| 5 | 39.2% | 21% | 43% | 18% | 18% | 14 | 8.1 | 37% |

**Skill gap, the most important number in the project:** at depth 3,
HeuristicBot 53.0% against RandomBot 3.7% — **49.3 points**, comfortably above
the 35-point floor. Decisions matter.

**Bot ordering (gate 2.4):** heuristic 53.0% > greedy 7.8% > random 3.7% at
depth 3, with non-overlapping intervals.

**Ceiling gap (gate 3.6):** SearchBot 60.7% against HeuristicBot 53.0% at depth
3 — 7.7 points, just under the 10–20 band. The two-ply search is close enough to
the one-ply strategy that the remaining headroom is small; widening the search
shortlist is the lever if this needs to grow.

## What is still outside its band

Reported rather than hidden. The tuning loop is built and cheap — these are the
next numbers to reach for, not defects in the harness.

| Gate | Target | Measured | Reading |
|---|---|---|---|
| 3.1 depth 1 win rate | 55–65% | 65.6% | At the top edge. |
| 3.2 depth 3 win rate | 35–45% | 49.6% | ~5 points high. |
| 3.3 depth 5 win rate | 15–25% | 39.2% | High, and the cause is structural: see below. |
| 3.9 loss cause spread | none over 40% | Carrier is 60–75% of losses at depth 3+ | The CARRY ladder pulled this down from 80%; it needs another pass. |
| 3.11 ending spread | each ≥5% somewhere | Beacon stays under 1% | Broadcasting is dominated by arming the reactor whenever the bridge is reachable, and the bridge nearly always is. |

**The structural finding.** The design document counts Clean Break *and* Scuttle
as wins. Arming the reactor is available to any run that reaches the bridge with
power, which puts a hard floor of roughly 18% under the win rate at every depth
— so the deep-end bands cannot be met while the scuttle stays a reliable
fallback. Measured against Clean Break alone the ladder lands almost exactly on
the document's bands: 65% / 33% / 21% against targets of 55–65 / 35–45 / 15–25.
The choice is a design one, not a tuning one: either the scuttle stops being
freely available late (a fuse that must be armed early, before you know you have
failed), or the win definition is Clean Break only. It is written up in the open
questions rather than decided unilaterally.

## The loop, for the next pass

1. `npm run sim -- --runs 20000 --depth 3 --bot heuristic --entropy`
2. Read `reports/heuristic-d3-engineer.md`; find the metric furthest outside band.
3. Change **one** number in `src/content/`.
4. Re-run. Confirm the target moved and nothing else broke.
5. `npm run golden:regen`, review the diff, commit it with the report.
