# The interface as built

Part 11 of the design document is the specification. This file records the one
place the build deliberately goes further than it, and the rules that keep that
from turning into noise.

## Motion

The document asks for two moments of motion and stillness everywhere else:
"Everything else is instant. No fade-ins, no slide-ups, no hover transitions, no
ambient movement." Built that way, the result read as a static picture of a
terminal rather than a terminal. The brief was extended, on the designer's
instruction, to the thing the restraint was protecting: **the ship writes, it
does not print.**

Four moments now move. Nothing else does.

**1. Cold boot.** The self-test types itself out at three characters a tick,
then holds, then types the ship's name one letter at a time and lets it sit for
a beat. About 1.5 seconds of typing and 0.9 of hold, skippable by tapping,
instant on every launch after the first.

**2. The terminal.** Every line the ship has to say is written out. Ordinary
lines run out at three characters a tick; anything the ship is alarmed about —
a threat, a wound, a bag draw — waits a beat first and is then typed one
character at a time. Quiet turns take about a fifth of a second. A turn that
goes wrong takes over a second, and that difference is the point: you can feel
a bad turn before you can read it.

**3. The turn taking over the screen.** When the ship has something loud to say,
the commands and the hand stand down and the terminal takes their space until it
has finished. The map, the status strip and the bag readout hold the state the
player last saw, so the readout catches up to the text rather than spoiling it:
you read `CONTACT IN ORE-HOLD` and then watch it appear. Older output does not
scroll away, it burns in — the further back a line is, the dimmer it sits, until
it is part of the chrome.

**4. The ending.** The name of the ending is typed a letter at a time before the
epilogue arrives.

Plus the single blinking cursor the document permits: `_` when the ship is
waiting for you, a solid `█` while it is still writing.

Values in the status strip invert for a third of a second when they change.
That is not motion, it is inverse video — the same trick the document specifies
for threat information.

## The rules that keep it honest

- **Everything is skippable.** A tap anywhere on the terminal finishes the
  sentence. This is a game meant to be opened daily; nobody should ever wait on
  an animation twice.
- **Everything finishes on its own.** No animation blocks a player who has
  looked away.
- **`prefers-reduced-motion` prints instead of typing**, never takes the screen,
  never blinks the cursor, and renders the boot instantly. Asserted in
  Playwright, not assumed.
- **`data-crt="off"` still removes the glow, the scanlines and the vignette**,
  and the game remains fully playable.
- **No new colour, no new shadow, no gradient, no transition, no easing.** The
  motion is character reveal and inverse video only, which is exactly what the
  hardware in the brief could do.

## What did not change

No fades, no slides, no hover states, no ambient drift, no barrel distortion, no
flicker or roll. The map does not animate. Cards do not deal themselves in. The
palette is still six values and the corners are still square.


## Voice

The ship does not know it is a board game and never speaks like one. There is no
bag, no token, no card, no deck, no node, no turn and no AP anywhere the player
can read. The vocabulary maps like this, and the engine keeps its own names:

| in the code | on the screen |
|---|---|
| bag, tokens | what is unresolved aboard — returns that are nothing, moving, heavy, inside the walls, singing |
| a draw | something resolves out of the dark |
| deck, hand, cards | your kit, what is at hand, the things you can still do |
| burn | "you cannot do that any more" — a wound takes a capability, permanently |
| discard | set aside |
| AP | time |
| turn | an hour, counted down against the orbit |
| node | a compartment |

`src/engine/voice.ts` composes the lines that need composing; the rest sit next
to the rules that fire them. Two tests hold the line: one checks every written
string that ships (card text, salvage logs, advisories, role blurbs), the other
plays fifteen runs across every role and depth and checks every line the ship
says during them. A Playwright test does the same against the rendered screen.

## Feedback

Every action reports its result, not just its name. Listening says what was
heard rather than that you listened; walking says where you are and whether it
cost you; playing something names it first and then says what it did. A test
asserts that each action a player can take adds a legible line to the terminal,
because "I said LISTEN and nothing came back" is the bug that made all of this
necessary.

## The advisory voice

An optional narrator, on by default, off in one tap from the bay. Nineteen
advisories live in `src/content/guidance.json`; each fires at most once a run,
the first moment its condition is true — the arithmetic in the first hour, what
a wound really cost you the first time one lands, what an empty weapon means,
where the medbay comes in, and what is still worth doing once the shuttle is out
of reach. They are written in the same voice as everything else and marked with
`::` so they read as somebody explaining rather than the hull reporting.

The conditions are code (`src/ui/guidance.ts`), the words are content. The
evaluator is a pure function of the state and the set already said, so it is
tested directly and cannot affect the engine, the replays or the balance.
