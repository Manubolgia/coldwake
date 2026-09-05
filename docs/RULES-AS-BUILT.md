# The rules as built

Everything here is generated from `src/content/`. If this file and the JSON
disagree, the JSON is right and this file is stale. The design behind these
numbers is `docs/REDESIGN.md`; the measurements that set them are
`docs/BALANCE.md`.

## The ship

```
   CRYOBAY ── SPINE-A ── SPINE-B ── SPINE-C ── SHUTTLE BAY
                 │          │          │
              MEDBAY     REACTOR    BRIDGE
                 │          │          │
              ARMORY ─── ORE HOLD ─── COMMS
```

Vent access: medbay, ore hold, bridge, shuttle bay. Start: cryobay.
Nest: ore hold, which never falls below its floor and gains noise every
second hour — the ship gets worse whether or not you do anything.

## The four routes

One is declared at wake and scores ×1.25. All four are live for the whole run,
all four are tracked on screen, and finishing any of them ends the run as a
win. Nothing is computed from the state of the corpse.

| Route | Where | What it takes |
|---|---|---|
| **RUN** | SHUTTLE BAY | Bank the shuttle's charge and fly it out. |
| **BURN** | BRIDGE | Arm the reactor overload and live through the countdown. |
| **CALL** | COMMS | Broadcast what happened here and stay at the set until it lands. |
| **KNOW** | ORE HOLD | Cut a specimen out of the nest and send the readings up. |

| Ending | From | × | What it is |
|---|---|---|---|
| CLEAN BREAK | run | 1.0 | You are off the ship and nothing came with you. |
| CARRIER | run | 0.85 | You are off the ship. So is it. |
| OVERLOAD | burn | 1.0 | The ship is a light, and nothing aboard it outlived you by long. |
| RELAY | call | 1.0 | Somebody a long way from here knows exactly what is on this ship, and will not come looking. |
| SPECIMEN | know | 1.0 | You know what it is. So does everyone who will ever have to fight one. |
| KILLED | — | 0.8 | It took the last thing you could still do, and then it took the rest. |
| ADRIFT | — | 0.8 | The window closed with you aboard and nothing finished. |

The band is 0.8× to 1.25× including the declared bonus. In the game this
replaces it ran 0.3× to 1.5×, so the last flag set outweighed every decision
taken before it.

## The hour

4 time, plus one free play-or-set-aside out of a hand of 5.
**The hand persists between hours.** Draw back up to the hand size at the
start of each one.

| Action | Time | Power | Heard |
|---|---|---|---|
| move | 1 | — | 3 |
| creep | 1 | — | 1 |
| listen | 1 | — | silent |
| search | 1 | — | 2 |
| brace | 1 | — | silent |
| discard | 1 | — | silent |
| ventEnter | 1 | — | silent |
| ventExit | 1 | — | silent |
| repair | 2 | — | 3 |
| seal | 1 | 1 | 1 |
| purgeVents | 2 | 2 | 4 |
| cure | 2 | 2 | 1 |
| recharge | 1 | 1 | 2 |
| chargeShuttle | 1 | — | 1 |
| beacon | 2 | 2 | 5 |
| takeSpecimen | 2 | — | 4 |
| upload | 2 | 8 | 3 |
| armScuttle | 3 | 12 | 3 |
| launch | 1 | — | silent |

Order of an hour: spend your time · any compartment at 4 noise draws ·
everything aboard moves · the reactor pays out · noise fades by 1 · the hold wakes a little.

## Noise

A noise value is two things at once: how much noise lands in the compartment,
and **how many compartments away it is heard**. Anything that hears it
believes you are *there* — not where you are, where the sound was.

| Creature | Mark | HP | Wounds | Speed | Hears | Behaviour |
|---|---|---|---|---|---|---|
| STRAY | `S` | 2 | 1 | 1 | 2 | noise |
| HUNTER | `H` | 3 | 2 | 1 | 4 | hunter |
| CRAWLER | `C` | 2 | 1 | 2 | 3 | burrow |
| MOTHER | `M` | — | 2 | 1 | everything | mother |

A threat that reaches its target and finds nothing searches for
1 hour and then gives up on you entirely.
That is the whole of hiding, and it is what `threatsShaken` scores.

**The board is capped.** When the bag would spawn past the cap it escalates
instead: a STRAY grows into a HUNTER, or, when there is nothing left to grow,
the hold wakes further. Pressure keeps climbing; the count does not.

**The MOTHER cannot be killed by anything aboard.** She wakes when the hold
fills. A bulkhead holds her 1 hour, flooding the vents holds her
2, and anything loud elsewhere turns her around.

## Perception

You perceive your own compartment and everything 1 away. A listen
reaches 3 and names each contact: what it is, where, how far, and
whether it is coming. Everything else on the schematic is a hollow mark
showing where you last saw something.

`forecast()` runs the real threat phase against a copy and reports where every
**perceived** contact will be if you end the hour now, and whether it reaches
you. The noise phase is deliberately not simulated: what comes out of the bag
is not something the player is entitled to know in advance.

## Infection

A wound takes a capability you choose — gone for the rest of the run — and
puts an infection card in your kit. There is nothing face down about it: the
count is on the status strip from the first one.

| Card | While it is in your hand |
|---|---|
| FEVER | While it is in your hand your grip is wrong. Everything you swing is one harder to land. |
| TUNNEL VISION | While it is in your hand you cannot filter what you hear. Listening takes twice as long. |
| COLD SWEAT | While it is in your hand you are clumsy. Everything you do that makes a sound makes one more. |
| TREMOR | While it is in your hand you cannot hold still. Creeping is as loud as walking. |
| BLACKOUT | The moment it comes to hand your vision goes and you put a hand through something. |

Infection cannot be given up to a wound. The MEDBAY takes one out of the kit
for good for 2 time and 2 power — no wound, no roll.

## The ladder

| Depth | Hours | Shuttle | Aboard | Hold wakes | Relay | Fuse | Carrier at | Bag |
|---|---|---|---|---|---|---|---|---|
| 1 SHALLOW | 18 | 28 | 3 | 14 | 3h | 5h | 7 | base |
| 2 STANDARD | 17 | 30 | 3 | 12 | 4h | 5h | 6 | +1 drifter |
| 3 DEEP | 16 | 32 | 4 | 10 | 4h | 6h | 6 | +1 drifter, +1 burrower |
| 4 BLACK | 15 | 34 | 4 | 8 | 5h | 6h | 5 | +2 drifter, +1 burrower, -1 blank |
| 5 KELL | 14 | 36 | 5 | 6 | 5h | 7h | 5 | +2 drifter, +1 burrower, -2 blank |

The pilot lifts on 4 less at every depth.

## Score

| | Each |
|---|---|
| powerBanked | 2 |
| nodesSearched | 3 |
| threatsKilled | 4 |
| threatsShaken | 2 |
| turnsSurvived | 1 |
| survivingCards | 2 |
| cures | 3 |

Multiplied by the ending, and again by 1.25 if it is the route you declared.
