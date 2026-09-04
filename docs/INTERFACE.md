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

**2. The terminal.** Rhythm, not speed. A line is typed quickly; what makes it
land is where it stops. Every kind of line has a beat — how long the cursor
waits before it starts, how long it holds at a comma, how long at a full stop,
and how long it sits when the line is done — and anything grave waits a visible
`. . .` first, three slow dots while the ship decides how to tell you. Follow-up
lines of the same kind skip the dots and shorten the pauses: the first blow
lands slowly, the ones behind it tumble out. Three lines into an hour the drama
is spent and the rest is read out like the list it is.

In practice a quiet hour passes in about a second; an hour with something
arriving in it takes five or six, and that difference is the whole point — you
feel a bad hour before you can read it. When the writing stops the last of it
holds on screen before control comes back.

The reveal runs off a clock, not a chain of timers: each line gets a schedule of
the millisecond at which every character appears, and a frame loop reads the
clock against it. Typing therefore takes exactly as long as it is written to
take, whatever the device costs to paint — the first version scrolled the log on
every character, which forced a layout each time and made every measured beat a
lie.

**Tapping finishes the sentence; a second tap dismisses what is left. Holding
the screen runs the whole thing at six times the speed and skips the hold.**
Nobody is ever made to wait for text they have already read, and nobody is ever
outrun by it. A new player reads; a veteran holds their thumb down.

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

## The narrator

The ship does not repeat itself. Seventy phrasings across eighteen pools live in
`src/content/narration.json`, and every event — an hour beginning, something
resolving out of the dark, a wound, a kill, a miss, arriving somewhere — picks
one. The hour opener reads the room first: whether something is next door, how
loud this compartment is, and how much of the window is left, and draws from a
different pool for each. `HOUR 7, 13 hours left. You hear it stop when you
stop.`

The variant is chosen from a hash of the state — the hour, and how much has been
said — rather than from the game's own generator. That keeps a replay reading
identically to the run it records without disturbing the random stream the rules
depend on, which is what lets the golden replays stay valid.

Narration is prose and sits in sentence case. Names and labels — compartments,
equipment, commands — stay in capitals, so the reader can tell the difference
between the ship talking and the ship labelling something.

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

## The manual

`OPERATIONS` is paged, not scrolled: eight pages behind a chooser that scrolls
sideways — the run, the screen, an hour, what is aboard, being hurt, the ship,
advice, deeper. It was one column before, and four screens of continuous text is
a thing people close rather than read.

One page is a legend of every symbol on the screen, and it draws them with the
same class names the schematic uses — `node-box`, `player-ring`, `threat-block`,
`edge sealed`, `node-noise hot` — so the explanation cannot drift out of step
with the thing it explains. Change the colour of a threat block once and both
move. The threat marks in it are read out of `threats.json` rather than typed,
for the same reason.

Anything working against a swing is named above the commands, before the swing,
rather than turning up in the miss line afterward.

## The advisory voice

An optional narrator, on by default, off in one tap from the bay. Twenty-two
advisories live in `src/content/guidance.json`, each capped at 240 characters by
a test; each fires at most once a run,
the first moment its condition is true — the arithmetic in the first hour, what
a wound really cost you the first time one lands, what an empty weapon means,
where the medbay comes in, and what is still worth doing once the shuttle is out
of reach. They are written in the same voice as everything else and marked with
`::` so they read as somebody explaining rather than the hull reporting.

Only one fires at a time. A bad hour teaches one thing rather than five, and the
rest wait their turn — the first version said everything at once and read as a
wall of text.

The conditions are code (`src/ui/guidance.ts`), the words are content. The
evaluator is a pure function of the state and the set already said, so it is
tested directly and cannot affect the engine, the replays or the balance.
