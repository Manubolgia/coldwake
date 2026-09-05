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
| What a wound may burn | any card in hand | any **non-panic** card in hand | The wound had just shuffled a panic in, so the wound could be paid with the panic it caused. Measured: 65% of all burns were panic, and **1,200 bot runs across every depth produced zero attrition deaths**. A playtester wrote "I discard all I have and I keep going infinitely", which was the rules working as written. See below. |
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

3,000 runs per depth.

| Depth | Win rate (clean + scuttle) | Clean break | Carrier | Scuttle | Lost + beacon | Median turn | Wounds | Scan rate |
|---|---|---|---|---|---|---|---|---|
| 1 | 58.7% | 58% | 20% | 1% | 22% | 14 | 5.5 | 38% |
| 2 | 55.4% | 54% | 21% | 1% | 24% | 14 | 5.9 | 41% |
| 3 | 38.6% | 35% | 20% | 4% | 41% | 14 | 6.1 | 33% |
| 4 | 30.5% | 22% | 28% | 8% | 41% | 14 | 6.8 | 39% |
| 5 | 24.3% | 15% | 27% | 9% | 49% | 12 | 7.5 | 26% |

**All five depths are inside their bands for the first time**, difficulty falls
monotonically, the median resolution turn sits at 12–14 against a 12–17 target,
and 0.2% of runs or fewer resolve before turn 8. The depth 5 overshoot that this
document has carried since the fuse pass is gone; see the section below for why,
because the cause is not a number anyone tuned.

**Skill gap, the most important number in the project:** at depth 3,
HeuristicBot 38.6% against RandomBot 0.2% — **38.4 points**, above the 35-point
floor. Decisions matter, and they now matter more sharply: random play used to
survive to a timeout, and now it runs out of things it can do.

**Bot ordering (gate 2.4):** heuristic 38.6% > greedy 5.9% > random 0.2% at
depth 3, with non-overlapping intervals.

**Ceiling gap (gate 3.6):** SearchBot 59.8% against HeuristicBot 38.6% at depth
3 — **21.2 points**, just over the 10–20 band, having been 7.7 points under it
before the wound change. Wounds now compound, and looking two ply ahead to avoid
one is worth much more than it was. Narrowing the search shortlist is the lever
if this needs to come back down.

## What is still outside its band

Reported rather than hidden. The tuning loop is built and cheap — these are the
next numbers to reach for, not defects in the harness.

`npm run gate:m3` goes from 13 red checks to 12, and the composition is what
matters more than the count:

| Gate | Target | Before | After | Reading |
|---|---|---|---|---|
| 3.3 depth 5 win rate | 15–25% | 33.1% ✗ | 23.2% ✓ | Fixed, without a tuning knob. See below. |
| 3.9 largest loss cause, depth 3 | ≤40% | 53.9% ✗ | 39.9% ✓ | Fixed. Losses now split three ways rather than being one system. |
| 3.9 largest loss cause, depths 1/2/4/5 | ≤40% | 86% / 84% / 51% / 61% | 47% / 51% / 43% / 45% | Still red, roughly half as red. Depth 1 is now carrier-led at 47%; the rest are led by running out of things to do. |
| 3.6 ceiling gap | 10–20 points | inside | 22.2 points ✗ | Newly red, and by two points. Wounds compound now, so looking two ply ahead to dodge one is worth much more than it was. Narrowing the search shortlist is the lever. |
| 3.7 top action share | ≤25% | 27–30% | 28–31% | Unchanged, and unrelated: it is the free-movement cards, covered under Cards below. |
| 3.11 ending spread | each ≥5% somewhere | Beacon under 1% | Beacon under 1% | Unchanged. Broadcasting is dominated by arming the reactor whenever the bridge is reachable, and the bridge nearly always is. |

**The structural finding, and what was done about it.** The design document
counts Clean Break *and* Scuttle as wins. Arming the reactor was available to
any run that reached the bridge with power, which put a hard floor under the win
rate at every depth: the deep bands were unreachable while the scuttle stayed a
free late fallback. The first fix was a design one — the 3-turn fuse above — and
it brought depth 3 into band while leaving depth 5 eight points high.

**What closed the deep end was not a number.** Depth 5 sat at 34.8% against a
15–25% band, and the previous entry in this table proposed lengthening the fuse
with depth or dropping Scuttle from the win definition. Neither was needed. The
real cause was that a wound could be paid with the panic card the wound itself
had just handed over, so the attrition rule — the one the manual calls "how you
die here" — had never once fired:

| | Before | After |
|---|---|---|
| Burns paid with panic | 65% | 0% |
| Runs ending in death by attrition (d1 / d3 / d5) | 0% / 0% / 0% | 18% / 27% / 40% |
| Depth 5 win rate | 34.8% (band 15–25) | 24.3% |
| Depths inside their win band | 4 of 5 | 5 of 5 |

(3,000 runs a depth, seed prefix `band`. `gate:m3` on its own seeds and run
count reads the same move as 33.1% → 23.2%.)

Deep runs took the most wounds and were therefore the runs the missing rule was
subsidising most, which is why the fix lands hardest exactly where the ladder
was flattest. Wound counts fell slightly (6.4 → 5.5 at depth 1) because a run
that is genuinely being worn down ends sooner. Nothing was retuned to compensate
and nothing needed to be: every band above is the shipped content unchanged.

## Roles

Every role, 1,500 runs per depth, HeuristicBot. The band is the engineer's rate
±7 points, per gate 4.1. Re-measured after the wound change, which moved every
role: attrition falls hardest on the decks that spend cards to survive.

| Role | Depth 1 | Depth 3 | Depth 5 |
|---|---|---|---|
| Engineer | 56.9% | 37.5% | 24.1% |
| Security | 63.8% | 31.9% | 19.0% |
| Medic | 60.3% | 31.3% | 19.9% |
| Surveyor | 63.2% | 33.5% | 18.2% |
| Pilot | 63.9% | 42.5% | 25.1% |

**All fifteen role checks pass for the first time** (`npm run gate:m4`, 4.1).
Nothing in any deck was touched to achieve it; the roles converged because the
loss they were being measured against changed.

**The medic** has come back to the pack — 69.7% to 60.3% at depth 1 — for the
reason the previous pass predicted rather than for a nerf. Its edge was never
its cards; it was that the Carrier ending was ~85% of all losses at depth 1 and
the medic is the role that reads and discards its own blood. With running out of
things to do now a real way to lose, Carrier is 47% of depth-1 losses and the
medic's speciality covers less of the loss table.

**Security and the surveyor** sit at the top of the depth-1 band (+6.9 and +6.3
against the engineer, inside ±7 but on the edge) and the bottom of the depth-3
one (−5.6 and −4.0). Worth watching rather than acting on.

**The pilot** was 74.5% two passes ago and is 63.9% now. Its discount is two
power rather than five, its two shuttle cards bank three less between them, and
its filler is genuinely weaker: Course Correct banks one power rather than two
and Nerve draws one card rather than two. It is nonetheless the strongest role
at every depth, because banking early is what survives a run that gets shorter.

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
