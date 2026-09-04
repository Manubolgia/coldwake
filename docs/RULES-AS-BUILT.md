# The rules as built

The design document's Part 4 numbers are v0. These are the numbers the game
actually ships with, after the tuning pass in `docs/BALANCE.md`. Everything here
is generated from `src/content/` — if the two disagree, the JSON is right and
this file is stale.

## The ship

```
   CRYOBAY ── SPINE-A ── SPINE-B ── SPINE-C ── SHUTTLE BAY
                 │          │          │
              MEDBAY     REACTOR    BRIDGE
                 │          │          │
              ARMORY ─── ORE HOLD ─── COMMS
```

Vent access: medbay, ore hold, bridge, shuttle bay. Start: cryobay (safe).
Nest: ore hold, which never falls below its noise floor and gains 2 noise every
second turn — the ship gets worse whether or not you do anything.

## The turn

Draw to 5 · spend 3 AP · noise resolves · threats act · the reactor pays out.

| Action | AP | Power | Noise |
|---|---|---|---|
| Move | 1 | — | 2 |
| Creep | 2 | — | 0 |
| Listen | 1 | — | 0 |
| Search | 1 | — | 2 |
| Discard | 1 | — | 0 |
| Enter / leave the vents | 1 each | — | 0 |
| Repair reactor (reactor) | 2 | 0 | 3 |
| Seal bulkhead (any spine) | 1 | 2 | 1 |
| Purge vents (bridge) | 2 | 3 | 4 |
| CARRY scan (medbay) | 1 | 1 | 1 |
| Purge blood (medbay) | 2 | 2 | 1 |
| Recharge weapon (armory) | 1 | 1 | 2 |
| Charge shuttle (shuttle bay) | 1 | any | 1 |
| Beacon (comms) | 2 | 3 | 5 |
| Arm scuttle (bridge) | 3 | 10 | 3 |
| Launch (shuttle bay) | 1 | — | 0 |

Reactor output 0–2, banked into a pool capped at 10 each turn.
Noise 0–6; a node at 4 or more draws from the bag and resets to its floor.

Purge blood does **not** draw a replacement sample — it is a real cure, paid for
with a wound.

Arming the overload starts a **3-turn fuse**. Arm it later than that and the
orbit closes first: the run is Lost. Committing to the scuttle is a decision
made before you know you have failed, not after.

## The bag

Start: 5 blank, 3 contact, 2 drifter, 1 burrower.
Reserve: 4 contact, 2 drifter, 1 chorus.
A blank goes back in and drags a contact out of the reserve with it.

| | HP | Damage | Speed | Behaviour |
|---|---|---|---|---|
| Contact | 2 | 1 | 1 | Moves to the loudest node. Standing on it already, it hunts you instead. |
| Drifter | 3 | 2 | 1 | Hunts within 2 nodes, else the loudest node. |
| Burrower | 2 | 1 | 2 | Uses the vents, ignores seals. In the reactor it degrades output instead of attacking. |
| Chorus | 5 | 2 | 1 | Noise +1 everywhere, every turn. Reaching the ore hold, it feeds 2 contacts into the bag. |

Order: burrowers, drifters, contacts, chorus.

## Depths

| Depth | Turns | Shuttle | Bag | CARRY | Ore floor | On the board at wake |
|---|---|---|---|---|---|---|
| 1 SHALLOW | 20 | 34 | base | 10/2, 1 card | 2 | 1 |
| 2 STANDARD | 20 | 34 | +1 drifter | 10/2, 1 card | 2 | 1 |
| 3 DEEP | 18 | 32 | +1 drifter, +1 chorus | 9/3, 1 card | 2 | 2 |
| 4 BLACK | 17 | 31 | +1 drifter, +1 chorus, −1 blank | 8/4, 2 cards | 3 | 3 |
| 5 KELL | 15 | 30 | +2 drifter, +1 chorus, −2 blanks | 7/5, 2 cards | 3 | 4 |

Reactor output starts at 2 at every depth; only a burrower in the reactor takes
it down.

The pilot launches on 5 less than the depth's requirement.

## Endings

Checked in order at the moment the run resolves.

1. **Clean Break** — launched holding fewer than 2 infested. ×1.5
2. **Carrier** — launched holding 2 or more. ×0.8
3. **Scuttle** — the overload reached critical and you did not leave. ×1.2
4. **Beacon** — broadcast, then died. ×0.6
5. **Lost** — nothing armed, nothing broadcast. ×0.3

Score = banked power ×2 + nodes searched ×3 + threats killed ×4 + turns survived
+ surviving non-panic cards ×2 + salvaged logs, all multiplied by the ending.
