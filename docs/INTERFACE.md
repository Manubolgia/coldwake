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
