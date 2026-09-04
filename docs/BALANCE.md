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
| Shuttle requirement | 12 | 34 (D1–D2), 32 (D3), 31 (D4), 30 (D5) | At 12 the run resolved on turn 8–10 with nothing spent on defence: the clock never bit and the median resolution turn sat five below its band. 30 puts the median at 13–16 and makes power spent on survival cost turns you can feel. |
| Pilot's discount | needs 9 | needs 2 less than the depth's requirement, and its two shuttle cards bank less | Same shape, rescaled: a flat delta so the role stays distinct at every depth. |
| Reactor output at depth 2+ | starts at 1 | starts at 2 (1 at depth 5 was tried and cut) | Starting degraded is a cliff, not a slope: the reactor sits next to the nest, so the repair the player needs is exactly where the threats congregate. Depth 2 fell from ~60% to 17% on this modifier alone. Depth now escalates through the bag, the clock, the CARRY deck and the ore-hold floor instead. |
| CARRY deck | 8 clean / 4 infested at every depth | 10/2 (D1–D2), 9/3 (D3), 8/4 (D4), 7/5 (D5) | At 8/4 the Carrier ending took 36–52% of runs at every depth and was 80% of all losses — one system dominating the loss table. The ladder now makes infection a depth pressure rather than a constant. |
| Scuttle cost | 5 power | 10 power, on a 3-turn fuse | At 5 it was a free consolation prize taken on the turn the shuttle became unreachable. At 8 it is a real fork: the power you arm with is power you cannot bank. |
| CARRY scan | 2 AP, 2 power | 1 AP, 1 power | At the original cost no bot ever scanned, at any depth — pillar 3 failing in the measurement. At 1/1 the scan rate is 32–44%, inside the 20–80% band the playtest protocol asks for. |
| Purge blood | wound draws a replacement CARRY card | wound draws no card | As written, purging swapped one unknown card for another and was strictly a trap. It is now a genuine, expensive cure: one fewer sample at the price of a burn and a panic. |
| Beacon | 4 power | 3 power | So that broadcasting stays reachable in the runs where arming the reactor is not. |
| Scuttle timing | arm it any time | a 3-turn fuse | Arming was a free consolation taken on the exact turn the shuttle became unreachable, which put a hard floor under the win rate at every depth. A fuse makes it a commitment: arm it before you know you have failed, or the orbit closes first. Depth 3 moved from 49.6% into band at 43.8% on this change alone. |

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

**SHAKING costs a swing** (`rules.json › shakingPenalty: -1`). Not a tuning
change but a repair: the card's text promised unsteady hands and the reducer
never read it, so one panic in four was a blank slot with flavour on it and
discarding it for 1 AP was strictly wasted time.

Its balance cost is nil, and the way that was established is worth recording,
because "the win rate did not move" is exactly what a change the harness cannot
see also looks like. HeuristicBot swings 168 times across 1,500 runs at depths
1/3/5 and holds SHAKING for 41 of them, so the harness does exercise it. Setting
the penalty to −6 — every one of those 41 swings a guaranteed miss — moves depth
3 by 0.4 points and depths 1 and 5 not at all. At the shipped −1 nothing moves.

The finding underneath that is larger than the card: **combat barely touches the
outcome**. A competent player fights 0.1 times a run and the ending is decided
by arithmetic and routing. Worth knowing before anyone spends a tuning pass on
weapon numbers.

## Current measurements

HeuristicBot, 1,200–1,500 runs per depth, engineer, seed prefix `kell`:

| Depth | Win rate (clean + scuttle) | Clean break | Carrier | Scuttle | Lost | Median turn | Wounds | Scan rate |
|---|---|---|---|---|---|---|---|---|
| 1 | 58.9% | 58% | 35% | 1% | 6% | 15 | 6.4 | 38% |
| 2 | 56.7% | 55% | 37% | 2% | 6% | 15 | 7.0 | 40% |
| 3 | 43.8% | 34% | 29% | 10% | 27% | 16 | 7.6 | 35% |
| 4 | 37.5% | 23% | 39% | 15% | 23% | 15 | 8.8 | 41% |
| 5 | 33.3% | 15% | 34% | 19% | 32% | 15 | 9.1 | 30% |

Depth 1 (55–65%) and depth 3 (35–45%) are inside their bands, difficulty falls
monotonically, the median resolution turn sits at 15–16 against a 12–17 target,
and under 1% of runs resolve before turn 8.

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
| 3.3 depth 5 win rate | 15–25% | 33.3% | High. Clean Break alone is 15%, exactly on band; the gap is the scuttle. |
| 3.6 ceiling gap | 10–20 points | 7.7 points | SearchBot is close to HeuristicBot. Widening the search shortlist is the lever. |
| 3.9 loss cause spread | none over 40% | Carrier is roughly half of all losses at depth 3+ | The CARRY ladder pulled this down from 80%; it wants one more pass. |
| 3.11 ending spread | each ≥5% somewhere | Beacon stays under 1% | Broadcasting is dominated by arming the reactor whenever the bridge is reachable, and the bridge nearly always is. |

**The structural finding, and what was done about it.** The design document
counts Clean Break *and* Scuttle as wins. Arming the reactor was available to
any run that reached the bridge with power, which put a hard floor under the win
rate at every depth: the deep bands were unreachable while the scuttle stayed a
free late fallback. The fix was a design one — the 3-turn fuse above — and it
brought depth 3 into band. Depth 5 is still 8 points high because a 19% scuttle
rate sits under a 15% clean break. Measured on Clean Break alone the ladder is
58% / 34% / 15% against targets of 55–65 / 35–45 / 15–25: three for three. The
remaining question is whether Scuttle should count as a win at all, or whether
the fuse should lengthen with depth. That is a call for the designer, not the
harness, so it is written up rather than decided here.

## Roles

Every role, 800 runs per depth, HeuristicBot. The band is the engineer's rate
±7 points, per gate 4.1.

| Role | Depth 1 | Depth 3 | Depth 5 |
|---|---|---|---|
| Engineer | 60.9% | 40.9% | 32.6% |
| Security | 66.9% | 40.8% | 26.8% |
| Medic | 69.7% | 36.4% | 29.8% |
| Surveyor | 64.9% | 39.8% | 24.3% |
| Pilot | 66.9% | 42.6% | 30.7% |

Security, surveyor and engineer sit on top of one another at depth 3, which is
the shape gate 4.1 is asking for. Two roles are outside it at depth 1:

**The medic**, at 72.9%, is strong for a reason worth stating plainly: at depth
1 the Carrier ending accounts for roughly 85% of all losses, and the medic is
the role that reads and discards its own blood. Its edge is a symptom of the
CARRY imbalance below, not of its cards, and shrinking that imbalance is the fix
— which is why the medic's deck has not been nerfed to hide it.

**The pilot** was 74.5% before this pass and is 66.9% after it — inside the
band. The discount is down from five power to two, its two shuttle cards bank
three less between them, and its filler is genuinely weaker: Course Correct
banks one power rather than two and Nerve draws one card rather than two. The
design document calls the pilot "weakest deck otherwise", and it now is.

## Cards

Twenty-three of the forty-five role cards are played in under 25% of the runs
that draw them (gate 4.2), and six are played in over 95% (gate 4.3: bypass,
reroute, careful step, course correct, checklist, hand off — the free power and
free movement cards, which are the engine of every deck and have no decision
attached to them).

The first pass at this was an evaluator problem, not a content problem: a ward,
a spent weapon and a read bag had no value in the bot's evaluator at all, so it
never braced, never recharged and never listened. Pricing those three moved five
cards above the floor. What is left is genuinely under-used by a one-ply bot:
the burn-tier panic buttons (override, load-shed, last stand, door charge,
rappel), which pay off across several turns, and the weapons, because running is
usually correct and a one-ply bot can always see the cheaper escape. A human
under real pressure is not the same reader, so these are candidates for the
SearchBot to arbitrate before anything is cut.

## The loop, for the next pass

1. `npm run sim -- --runs 20000 --depth 3 --bot heuristic --entropy`
2. Read `reports/heuristic-d3-engineer.md`; find the metric furthest outside band.
3. Change **one** number in `src/content/`.
4. Re-run. Confirm the target moved and nothing else broke.
5. `npm run golden:regen`, review the diff, commit it with the report.
