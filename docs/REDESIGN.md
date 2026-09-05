# COLDWAKE: what is wrong and how it gets fixed

The engine is good. The game is not. This document separates those two claims,
measures the second one, and proposes a rework that keeps the first.

Everything in Part 1 is measured against the shipped content at
`3042022`, using HeuristicBot — the same competent-human proxy
`docs/BALANCE.md` tunes against. Numbers are from 300–400 runs per depth,
engineer, seed prefix `probe`/`ak`/`sp`.

---

## Part 0 — What must not be touched

The rework below is large, and it is only affordable because of what already
exists:

- **One reducer, one legal-action surface.** `reduce()` is the only mutation
  path and `legalActions()` is the only thing the UI or a bot may read. Every
  change proposed here is a change to *content and rules*, not to plumbing.
- **Content in JSON.** Threat behaviour, costs, depth ladders and endings live
  in `src/content/`, not in code. Most of Part 3 is JSON edits.
- **A simulation harness that answers questions in seconds.** Every claim in
  Part 1 took one file and one minute. A design change that cannot be measured
  is a guess; here, none of them have to be.
- **Deterministic RNG and golden replays.** A rules change that breaks a run
  fails a test rather than a player.
- **The vocabulary pass.** STRAY / HUNTER / CRAWLER / MOTHER, one name per
  creature across the map, the manual and the narration, is correct and is kept.

The problem is not the machine. It is what the machine has been asked to
simulate.

---

## Part 1 — The measurements

### 1.1 The player is not playing a game, they are watching a ticker

Action share at depth 2, HeuristicBot, 300 runs, 13,939 decisions:

| Action | Share | Per run |
|---|---|---|
| End the hour | 29.0% | 13.5 |
| Bank power into the shuttle | 13.0% | 6.0 |
| Play BYPASS (free power) | 11.2% | 5.2 |
| Listen | 6.9% | 3.2 |
| Enter / leave the vents | 11.4% | 5.3 |
| Play REROUTE (free move) | 4.7% | 2.2 |
| Search | 2.9% | 1.4 |
| **Walk or creep** | **4.3%** | **2.0** |
| Give something up to a wound | 11.8% | 5.5 |
| Everything else combined | 4.8% | — |

Read the bottom of that table. **A whole run contains two acts of walking.**
`seal` fires 0.01 times per run. `repair`, `purgeVents`, `beacon`, `recharge`
and `purgeBlood` fire **zero** times per run. `armScuttle` fires 0.03 times.
Combat happens 0.09 times.

Of the eleven system actions the manual explains and the rules doc tabulates,
**a competent player touches three**: bank, scan, launch. The ship has eleven
compartments and the optimal line visits about four of them. The armory, comms,
the bridge and the ore hold are set dressing.

The loop the game actually ships is: *draw BYPASS, bank power, hide in the
vents, end the hour, repeat thirteen times.*

### 1.2 The hand is a slot machine, and 88% of it goes in the bin

| | Per run |
|---|---|
| Cards drawn | ~70 |
| Cards played | 8.3 |
| Cards discarded unplayed at the end of the hour | **60.3** |
| Cards deliberately discarded for tempo | 0.0 |

You draw to five every hour and you have three AP. Most cards cost 1–2 AP, and
the AP is already committed to banking power. So four of every five cards you
are shown are shown to you and then taken away.

The role deck is twelve cards. Over fourteen hours with reshuffles you see the
same nine cards six times each. This is the mechanical source of "I'm super
limited in the moves I can make": the game presents a hand of five options
per hour and can only ever accept one of them.

### 1.3 Threats are a one-way ratchet

Average threats on the board, by hour, HeuristicBot:

| Hour | D1 | D2 | D3 | D5 |
|---|---|---|---|---|
| 1 | 0.6 | 0.6 | 1.3 | 3.0 |
| 5 | 1.3 | 1.4 | 2.2 | 4.0 |
| 10 | 3.7 | 3.8 | 4.8 | 7.1 |
| 15 | 5.3 | 5.4 | 6.1 | 8.4 |
| 18–20 | 6.3 | 7.3 | 7.3 | — |
| Worst observed | 10 | 10 | 11 | 12 |

Against that: **5.2 threats spawn per run and 0.11 die.** The rate of removal is
two percent of the rate of arrival. There is no mechanism in the game — combat,
purge, seal, or time — that meaningfully takes a threat off an eleven-node
board. The line goes up until the run ends.

`docs/BALANCE.md` already found half of this and recorded it honestly: *"combat
barely touches the outcome. A competent player fights 0.1 times a run."* The
conclusion drawn there was that weapon numbers are not worth a tuning pass. The
correct conclusion is larger: **a survival horror game in which the threats
cannot be removed, evaded, lost, or outsmarted is not a survival horror game, it
is weather.**

### 1.4 The player has perfect vision and zero foresight — exactly backwards

`ShipGraph.tsx` draws every threat's mark in its true compartment, every hour,
unconditionally. The player is omniscient about *where things are*.

The player has no information whatsoever about *what things will do*. Threat
movement resolves inside `endTurn`, after commitment, with no preview.

So the experience is: look at a map with eight monsters on it, take an action,
press end turn, and get hit by something you were staring at and could not
predict, could not fight, and could not have run from because you have three AP
and the ship is four moves wide.

That is the entire content of "there's thousands of enemies, you can't do
anything, they destroy you so fast." It is not a difficulty problem. It is an
information problem, and the information is backwards.

### 1.5 LISTEN reports the wrong object

`sweepReport()` prints the contents of the spawn bag. The first listen of every
run reads:

> You put your ear to the bulkhead. Of what is still unaccounted for aboard,
> 5 are nothing at all, 3 sound like STRAYS, 2 sound like HUNTERS, and 1 is
> moving inside the walls.

The player's complaint — *"wtf is unaccounted for, you listen to 5 things that
are nothing, then why do you listen to them"* — is not a complaint about prose.
It is a correct reading of a broken mechanic. Three faults, stacked:

1. **It answers a question nobody asked.** A person putting their ear to a
   bulkhead wants to know *what is near me and is it coming*. The map already
   shows them that. So LISTEN, the classic horror verb, is the one action in the
   game that tells you nothing about your surroundings.
2. **It leaks the implementation.** "Blank" is an urn token — a probability
   weight — and the fiction has been asked to carry it. There is no way to
   describe five blanks in-world that is not absurd, because five blanks are not
   a thing in the world.
3. **"Unaccounted for" is doing load-bearing work it cannot do.** It is trying
   to mean "the composition of the pool of things that may yet be spawned by a
   noise trigger." No player reconstructs that from two words.

### 1.6 The endings are residue, not choices

Depth 2, 400 runs:

| Ending | Share |
|---|---|
| Clean Break | 56% |
| Carrier | 22% |
| Lost | 21% |
| Scuttle | 1% |
| Beacon | 0.3% |

`endingFor()` computes the ending *after* the run is over, from whichever flags
happen to be set. The player does not choose an ending; the game reads their
corpse and assigns one. Two of the five occur in roughly one run in a hundred,
and one of those two — Beacon, at 0.6× — is strictly worse than the thing you
were doing anyway.

So there is one win (escape), one disguised loss (escape while infected), and
three ways of losing that differ mainly in multiplier. The complaint —
*"there should be more ways to win, better than escape but infected"* — is a
precise description of a game with one route.

Worse: the multipliers span 0.3× to 1.5×, a factor of five. The ending
contributes more to the score than every decision in the run combined.

### 1.7 The blood mechanic is a hidden tax on the win

- 28% of successful escapes are converted into a CARRIER after the fact.
- `carryScan` costs 1 AP + 1 power to turn *unknown* into *known* — and knowing
  changes nothing about the card.
- `purgeBlood` — the only cure — costs 2 AP, 2 power **and a wound**: a
  permanent, irreversible capability, spent to remove a sample that had a good
  chance of being clean anyway. Measured usage: **0.00 per run.** The bot never
  does it because it is never correct.
- Between the draw and the launch, a blood sample has zero effect on any turn.
  It is not a mechanic. It is a die roll held in escrow until the moment it can
  do maximum emotional damage.

The player says the blood mechanic is shit. The measurement agrees: it is a
system with no decisions in it, one uncastable cure, and a retroactive veto over
the only win the game has.

---

## Part 2 — Diagnosis

The six findings above collapse into four root causes.

**R1. One currency for two different games.** AP pays for movement, systems
*and* cards. Cards therefore always lose to systems, because systems are the
win condition. The deck is decoration.

**R2. Escalation with no relief valve.** Noise adds threats. Nothing subtracts
them. Every system that could subtract them (combat, purge, seal) is priced
above the thing you must do to win, so nobody buys it. Difficulty is a ramp with
no player input on its slope.

**R3. Information inverted.** Perfect positional knowledge, zero predictive
knowledge, and the one investigative verb reports engine internals. The player
cannot form a plan, only a hope.

**R4. One route, several epilogues.** Every system that is not "bank power"
is a dead end, so the ship is a corridor with an eleven-room diagram drawn over
it, and the ending screen is a lottery result.

---

## Part 3 — The rework

Reference points, and what each one is being borrowed *for*:

| Game | What it solves here |
|---|---|
| **Alien Isolation** | One unkillable antagonist beats a crowd. The motion tracker gives a bearing, not a map. Tools buy time, never kills. The alien *loses* you, which is what makes hiding a skill. |
| **Nemesis** | Objectives declared up front, visible to the player and different per run. Contamination that lives in your own deck where you can see it and act on it. A small number of intruders on a large board. |
| **Into the Breach** | Enemy intent is shown before you commit. Difficulty becomes a puzzle instead of an ambush. |
| **Slay the Spire** | Exploration that *builds the deck*. Hand persistence and card economy as the thing the player is actually good at. |
| **Darkest Dungeon** | Attrition as accumulating, visible affliction rather than a hidden counter. |
| **Escape from the Aliens in Outer Space** | Noise as directional, partial, deniable information. |

### 3.1 Endings become objectives — four routes, all live, all visible

Delete `endingFor()`'s post-mortem logic. Replace it with **four win conditions,
each attached to a different part of the ship, each with a tracker on the status
strip from hour one.**

| Objective | Where | What it asks | Fails because |
|---|---|---|---|
| **RUN** | Shuttle bay + power | Bank the requirement, launch. The current escape. | Power is hours; the bay is the far end of the ship. |
| **BURN** | Bridge | Arm the overload, then **survive the fuse.** | The ship is at its worst for those hours and you must be alive at the end of them. |
| **CALL** | Comms + reactor | Broadcast, then **hold the transmitter powered for N hours.** | A siege: you must defend a fixed position, which is the only thing seals, purges and the armory are for. |
| **KNOW** | Ore hold | Take the specimen from the nest and get it off the ship. | It is in the worst compartment on the ship, and carrying it makes noise follow you. |

Three rules make this a design rather than a list:

1. **You declare one at wake.** Completing your declared objective scores full;
   completing a different one still ends the run as a win at a reduced rate. You
   always know what you are playing for, and you may change your mind under
   pressure — which is the Nemesis moment worth stealing.
2. **Every objective has a live tracker.** `SHUTTLE 18/34` already exists and is
   the best thing on the status strip. The other three get the same treatment:
   `FUSE 2/3`, `RELAY 4/6 HOURS HELD`, `SPECIMEN — ORE HOLD`.
3. **The routes do not overlap.** RUN pulls you aft, BURN and CALL pull you
   forward and down, KNOW pulls you into the nest. This is what makes the map a
   map. Right now every route is the same route.

**Losing stops being a default.** `lost` currently means "none of the above."
Replace it with two named, explicable losses: *killed* (attrition took the last
thing you could do) and *adrift* (the window closed with nothing achieved). And
narrow the multiplier band from 0.3×–1.5× to roughly **0.8×–1.25×**, so the run
scores the run and the ending scores the ending.

### 3.2 Blood dies; infection moves into the deck

Delete the entire CARRY system: `carryDeck`, `player.carry`, `carryScan`,
`purgeBlood`, `drawCarry`, `infestedCount`, the `revealCarry` / `discardCarry` /
`drawCarry` effect ops, and the depth ladder's `carry` block.

Replace it by folding infection into the panic deck, which is already the right
shape and half the work:

- A wound shuffles an **INFECTION** card into your deck. There is no hidden
  state and no scan: the status strip reads `INFECTION 3` from the moment you
  take the first one.
- Infection cards behave like panic while held — the four existing panic effects
  are good and stay — and they additionally **count**. Cross the depth's
  threshold and launching makes you the CARRIER.
- **The medbay cures them, and the cure does not cost a wound.** 2 AP + power
  removes one from the deck permanently. Now the medbay is a destination with a
  known price and a known payoff, and the decision "I am at four, do I spend two
  hours in the medbay or run for the bay" is a real one made with real numbers.

This collapses two attrition systems into one, deletes roughly 120 lines of
engine, removes the only hidden information the player cannot act on, and turns
the game's least-liked mechanic into its clearest one. The theme survives intact:
it is in you, it is spreading, and it will follow you off the ship.

### 3.3 Threats: fewer, smarter, telegraphed, and losable

**Cap the board.** Three threats at depth 1 rising to five at depth 5. When the
bag would spawn past the cap, it escalates instead: a STRAY becomes a HUNTER, or
the ship's noise floor rises, or a hive track advances. Pressure keeps climbing;
the count does not. Eight identical monsters are less frightening than three,
because three can be tracked and eight can only be endured.

**Add THE ONE.** A single persistent antagonist — the MOTHER, reworked. It
arrives at a known moment, it always has a rough fix on you, and **it cannot be
killed by any means in the game.** Every tool you own buys one to three hours
from it: a seal, a purge, a flare, the vents. This is the Alien. Everything else
on the board is a working joe. The run's memory is the thing you never killed.

**Telegraph intent.** Before `endTurn` commits, show where each threat you can
perceive will move and whether it reaches you. Implementation is cheap: run the
existing `threatPhase` over a clone and render the deltas. This is the single
highest-value change in this document, because it converts *"they destroy you so
fast"* into *"I chose wrong"*, which is the difference between a frustrating
game and a hard one.

**Threats must lose you.** Nothing in the current model ever gives up: a HUNTER
inside two nodes hunts forever, and a STRAY standing on the loudest node hunts
forever. Give threats a *last known position* and a *search state*: one that
arrives and finds nothing reverts to wandering. This is the Alien Isolation loop
in one rule, and it is what makes creeping, sealing and hiding into skills rather
than into stalling.

**Give removal a price the player will actually pay.** Not by buffing weapons —
`docs/BALANCE.md` is right that combat should not decide runs. Positional
removal instead: make sealing affordable in the currency the player has spare,
make the vent purge worth its cost, and add a **lure** — spend a card to make a
loud node somewhere else, and everything with `loudest` behaviour walks to it.
That turns the noise system from a punishment into a weapon, which is the
cleanest way to make an eleven-node ship worth having.

### 3.4 Agency: split the economies and let the hand persist

The 88% waste figure is a design bug, not a tuning one, and it has four fixes
that compound:

1. **Separate the currencies.** TIME (AP) pays for the ship: moving, searching,
   systems. The hand gets its own allowance — **one card free each hour**, more
   only by spending time. The deck stops competing with the win condition.
2. **The hand persists.** Draw *up to* the hand size at the start of the hour;
   do not dump what is unplayed. The deck becomes a plan you assemble across
   hours rather than five things flashed at you and withdrawn.
3. **Shrink the hand, grow the deck.** Hand 5 → 4, sticky. Role decks 12 → 16–18
   with more distinct effects. And **searching should add cards to the deck**:
   1.4 searches a run is a ship nobody explores, because exploring pays in
   score rather than in capability.
4. **Give the hour's end a decision.** 29% of all decisions are `endTurn`,
   which is the game asking the player to press a button rather than make a
   choice. Leftover time should buy something — brace, watch, or steady
   yourself — so that ending the hour is a play.

Raising AP from 3 to 4 is the obvious lever and should be tried, but it is the
weakest of the five: it buys more of a loop that is not yet worth repeating.
Do 1–4 first, then measure whether 4 AP is still needed.

### 3.5 Information: take away the map, give back the tracker

Flip 1.4 in both directions at once.

**Remove omniscience.** The schematic shows threats you can currently perceive:
in your compartment, adjacent to it, or revealed by a listen within the last
hour. Everything else is a stale mark with an hour-stamp, or nothing.

**Make LISTEN the motion tracker.** It is the horror verb and it should be the
best action in the game. A listen answers *where and coming or going*:

> You put your ear to the bulkhead. Something heavy, two compartments aft,
> coming this way. Something else in the walls, close, direction unclear.

**Blanks never reach the player.** A blank is a probability weight in a spawn
urn. It has no in-world referent and must not be given one. If the pool's
pressure needs surfacing — and it does — surface it as a threat level on the
status strip (`HIVE: AWAKE — 4 OF 7 LOOSE`), never as a sentence containing the
clause "5 are nothing at all."

**Retire "unaccounted for."** Every rule the player must reason about needs a
noun, a number and a unit *on screen*, not in prose. The narration is genuinely
good and should stay — but any prose line carrying a rule needs a number beside
it. Specifically: noise threshold and decay, the infection threshold, the fuse
length, and what makes a compartment draw from the bag. The manual is 729 lines
of TSX; a game that needs one has already failed to explain itself, and every
line moved out of it into an inline consequence preview (`+2 NOISE HERE → 4 OF
4 — SOMETHING WILL COME`) is a line the player never has to go looking for.

---

## Part 4 — Order of work

Sequenced by value per unit of risk. Each step is independently shippable and
independently measurable.

| # | Change | Touches | Why here |
|---|---|---|---|
| 1 | Telegraph threat intent | `actions.ts`, UI | Largest felt improvement, no rules change, cannot break balance |
| 2 | LISTEN as tracker; blanks never surfaced; hive readout | `voice.ts`, `Status.tsx` | Fixes the wording complaint at its mechanical root |
| 3 | Split card economy; persist the hand | `state.ts`, `reduce.ts`, `rules.json` | Unlocks 60 wasted cards a run |
| 4 | Threat cap + escalation-instead-of-spawn | `noise.ts`, `depths.json` | Stops the ratchet before adding new systems on top of it |
| 5 | Search-state / losing the player | `threats.ts`, `threats.json` | Makes hiding and creeping into skills |
| 6 | Infection replaces blood | `state.ts`, `deck.ts`, `reduce.ts`, `scoring.ts` | Deletes a system; do it before objectives, since CARRIER is an objective outcome |
| 7 | Four objectives with trackers | `scoring.ts`, `rules.json`, UI | The largest design change; rests on all of the above |
| 8 | THE ONE | `threats.ts`, `threats.json` | The set piece; needs 4 and 5 in place to be legible |
| 9 | Lure, affordable seals, deck-building search | content | Fill out the verbs once the frame holds |
| 10 | Retune the depth ladder end to end | `depths.json` | Every band in `BALANCE.md` is void after 1–9; re-derive, do not patch |

Steps 1–2 could ship this week and would answer two of the six complaints on
their own.

---

## Part 5 — How we will know it worked

Bands to add to `scripts/gate.ts`. These are the numbers that would have caught
every problem in Part 1 before a player did.

| Metric | Now | Target |
|---|---|---|
| Cards played ÷ cards drawn | 12% | **≥ 45%** |
| Walk/creep actions per run | 2.0 | **≥ 8** |
| Distinct system actions used per run (of 11) | 3 | **≥ 6** |
| `endTurn` share of decisions | 29% | **≤ 18%** |
| Threats on board, hour 15 | 5.4 | **≤ 4, and non-monotonic** |
| Threat removals per run (any means) | 0.11 | **≥ 1.5** |
| Compartments visited per run (of 11) | ~4 | **≥ 7** |
| Each win condition's share of wins | 97 / 2 / 0.5 / — | **≥ 15% each** |
| Ending multiplier spread | 0.3×–1.5× | **0.8×–1.25×** |
| Deaths the player could not have foreseen | unmeasured | **≈ 0** (telegraph invariant) |

The last one is the one that matters most and is the easiest to assert: after
step 1, no wound may be dealt by a threat whose approach was not shown to the
player on the turn before it landed. That is a property test, not a band, and it
is the difference between this game and the one that exists today.

---

## Part 6 — The one-paragraph version

COLDWAKE is currently a spreadsheet with a monster generator attached. You bank
power, you hide in a vent, you press end turn thirteen times, and a growing
crowd of unkillable identical creatures wanders into you while a map shows you
exactly where they are and nothing tells you where they are going. Four fifths
of the cards you draw you never play. Ten of the eleven compartments have no
reason to exist. The ending is assigned to you after you die. The fix is not
tuning: it is to give the player four different things worth doing and let them
pick one out loud, to show them what the monsters are about to do so that dying
is a mistake instead of an event, to make the monsters losable so that hiding is
a skill, to let the hand actually be played, and to take the infection out of a
sealed envelope and put it in the deck where it can be seen, counted, and cured.
