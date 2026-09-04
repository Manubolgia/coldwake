# Rule coverage map

Gate 1.1: every rule in Part 4 of the design document maps to a named test.
If a rule moves, this table moves with it, or the gate is lying.

| Rule | What it says | Test |
|---|---|---|
| 4.1 map | Eleven nodes, fixed topology, cryobay is safe | `content.test.ts › has a symmetric, fully connected adjacency list`, `rules.test.ts › §4.1 › starts in the cryobay` |
| 4.1 adjacency | Only adjacent moves are legal | `rules.test.ts › §4.1 › offers only adjacent moves` |
| 4.1 vents | Four vent nodes; 2 AP a transit; 0 noise | `rules.test.ts › §4.1 › gives four nodes vent access`, `costs 2 AP to transit the vents` |
| 4.1 vents | No room actions from inside the vents | `rules.test.ts › §4.1 › cannot act on rooms from inside the vents` |
| 4.1 vents | A transit draws a token; a threat ambushes at −2 | `rules.test.ts › §4.1 › ambushes on a vent exit` |
| 4.2 turn | Draw to five, three AP | `rules.test.ts › §4.2 › draws to hand size and grants 3 AP` |
| 4.2 turn | Unplayed cards are discarded | `rules.test.ts › §4.2 › discards unplayed cards` |
| 4.2 turn | The orbit closes at the turn limit | `rules.test.ts › §4.2 › ends the run at the turn limit` |
| 4.3 deck | Twelve cards per role | `rules.test.ts › §4.3 › gives every role twelve cards` |
| 4.3 burn | A wound burns a card and shuffles in a panic | `rules.test.ts › §4.3 › burns a card and gains a panic` |
| 4.3 deck | The discard reshuffles when the deck runs out | `rules.test.ts › §4.3 › reshuffles the discard` |
| 4.3 burn | Burned cards never come back | `rules.test.ts › §4.3 › never returns a burned card` |
| 4.4 move | 1 AP, 2 noise | `rules.test.ts › §4.4 › charges the printed AP and noise` |
| 4.4 creep | 2 AP, silent | `rules.test.ts › §4.4 › creeps for 2 AP and no noise` |
| 4.4 listen | Reveals the bag | `rules.test.ts › §4.4 › reveals the bag on a listen` |
| 4.4 search | Two salvage cards per node, once each | `rules.test.ts › §4.4 › searches a node twice and no more` |
| 4.4 discard | 1 AP sheds a panic | `rules.test.ts › §4.4 › sheds a panic card` |
| 4.4 systems | Every system action: success, wrong node, no power | `rules.test.ts › §4.4 › allows … refuses it elsewhere and without power` (one case per row) |
| 4.4 recharge | Armory only | `rules.test.ts › §4.4 › recharges a spent weapon in the armory only` |
| 4.4 seal | Blocks one edge from this node for three turns | `rules.test.ts › §4.4 › blocks an edge for three turns` |
| 4.5 power | Output banks each decay phase, capped | `rules.test.ts › §4.5 › adds reactor output to the pool` |
| 4.5 power | Burrowers degrade output in the reactor | `rules.test.ts › §4.5 › lets a burrower in the reactor degrade output` |
| 4.5 power | Repair restores one, to a maximum of two | `rules.test.ts › §4.5 › repairs output by one` |
| 4.6 noise | The threshold draws, then the node resets | `rules.test.ts › §4.6 › draws from the bag at the threshold` |
| 4.6 noise | Decay of one, never below the ore hold floor | `rules.test.ts › §4.6 › decays one per turn` |
| 4.6 noise | The ceiling holds | `rules.test.ts › §4.6 › never exceeds the noise ceiling` |
| 4.7 bag | Conservation at setup, all 25 combinations | `rules.test.ts › §4.7 › conserves tokens at setup` |
| 4.7 bag | Blanks return and feed a contact in | `rules.test.ts › §4.7 › returns a blank to the bag` |
| 4.7 bag | Threats leave the bag and return on death | `rules.test.ts › §4.7 › places a threat out of the bag` |
| 4.7 bag | An empty bag drafts from the reserve, then reactivates | `interface-contract.test.ts › the bag under pressure` |
| 4.8 contact | Moves toward the loudest node | `rules.test.ts › §4.8 › moves a contact toward the loudest node` |
| 4.8 drifter | Hunts within two nodes | `rules.test.ts › §4.8 › makes a drifter hunt the player` |
| 4.8 burrower | Ignores sealed bulkheads | `rules.test.ts › §4.8 › lets a burrower cross a sealed bulkhead` |
| 4.8 chorus | Noise everywhere; feeds the bag at the hold | `rules.test.ts › §4.8 › has the chorus raise noise everywhere` |
| 4.8 order | Burrowers, drifters, contacts, chorus | `rules.test.ts › §4.8 › activates burrowers before drifters` |
| 4.9 combat | d6 + bonus, meet or beat; a miss spends the weapon | `rules.test.ts › §4.9 › kills on meet-or-beat`, `can miss with a weak weapon` |
| 4.10 CARRY | Face down at setup, one more per wound | `rules.test.ts › §4.10 › starts face down` |
| 4.10 CARRY | A scan reveals one | `rules.test.ts › §4.10 › reveals one card per scan` |
| 4.10 CARRY | A purge costs a wound | `rules.test.ts › §4.10 › purges an unrevealed sample` |
| 4.10 CARRY | The odds match the hypergeometric value (gate 1.15) | `rules.test.ts › §4.10 › matches the hypergeometric odds` |
| 4.11 endings | All five, with their multipliers | `rules.test.ts › §4.11` (one test per ending) |
| 4.11 score | The documented formula | `rules.test.ts › §4.11 › scores the documented formula` |
| 4.11 death | Death exactly when no non-panic card remains (gate 1.14) | `rules.test.ts › §4.11 › kills the player only when no non-panic card remains` |
| 4.12 roles | Five decks, twelve cards, all playable (gate 1.11) | `cards.test.ts › every card is playable and does something` |
| 4.12 pilot | Launches on less power | `rules.test.ts › §4.12-4.13 › lets the pilot launch on less power` |
| 4.13 depths | Every modifier applied | `rules.test.ts › §4.12-4.13 › applies each depth modifier` |
| 5.3 panic | Cannot be played; taxes AP; TUNNEL VISION and COLD SWEAT | `cards.test.ts › panic cards` |
| 7.1 determinism | A seed plus a log reproduces the state hash | `properties.test.ts › replays a log to an identical state hash` |
| 7.3 purity | `reduce` never mutates its input | `rules.test.ts › §7 › never mutates the state passed to reduce` |
| 7.4 log | Every action is logged | `rules.test.ts › §7 › logs every action for replay` |
| 7.5 legality | No zombie states (gate 1.7) | `properties.test.ts › has no zombie states` |
| 7.6 invariants | Conservation, bounds, termination | `properties.test.ts`, `interface-contract.test.ts › invariants catch tampering` |
