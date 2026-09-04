# Visuals: a feasibility study

**Status: study only. Nothing in this document is implemented.** It exists to
answer one question — can COLDWAKE carry small pictures without stopping being
a 1979 terminal — and to price each of the answers so the next decision is a
choice rather than a guess.

The short version: **yes, in three of the four forms, and one of them is worth
doing first and alone.** ASCII plates for the four things aboard and the five
endings are cheap, on-voice, and replaceable by hand-drawn art later without
touching a line of code. Per-action icons are affordable but risk turning a
terminal into a toolbar. Animation is the one to hold back on and to gate hard
if it ever ships.

---

## 1. What the interface will and will not allow

These are not preferences, they are the rules the build already enforces in CI
(`scripts/gate.ts`, gates 5.8–5.12). Anything proposed below has to survive
them:

| Constraint | Gate | What it rules out |
|---|---|---|
| Six colours only | 5.11 | Anti-aliased sprites, shading ramps, PNG art with soft edges |
| `border-radius: 0` everywhere | 5.8 | Rounded icon chrome |
| No gradients but the scanline | 5.9 | Glow falloff, soft light |
| One box-shadow (the vignette), no blur | 5.10 | Drop shadows, bloom |
| Fonts self-hosted, no external requests | 5.12 | Icon fonts from a CDN |
| No new colour, shadow, gradient, transition or easing | `docs/INTERFACE.md` | Tweens; anything that eases |
| Everything skippable, everything finishes alone | `docs/INTERFACE.md` | Animation that blocks input |
| `prefers-reduced-motion` prints instead of moving | e2e 5.14 | Motion with no still fallback |

Two more constraints come from the shape of the product rather than the style:

- **It is a PWA that has to work on a plane.** Every byte is precached by the
  service worker. The build is currently ~349 KiB precached; a megabyte of
  sprites would triple it and slow first install on a phone.
- **The engine is pure and content is JSON.** Art must be content, loaded like
  `cards.json` and `threats.json`, or it will end up hard-coded in components
  and impossible for a non-programmer to replace.

The last one is the important one for this request: **whatever ships must be
a data file the artist edits, not a component the artist has to open.**

---

## 2. The four options, priced

### Option A — ASCII plates (recommended, and recommended alone first)

Multi-line monospace art, stored as string arrays in JSON, rendered in a `<pre>`
in the existing phosphor palette. Exactly what a 1979 terminal could draw,
because it is the only thing a 1979 terminal could draw.

```jsonc
// src/content/plates.json  — a sketch, not a spec
{
  "drifter": {
    "w": 22, "h": 9,
    "art": [
      "      ▄▄████▄▄      ",
      "    ▟█▀      ▀█▙    ",
      "   ██   ▄  ▄   ██   ",
      "   ██   ▀  ▀   ██   ",
      "    ▜█▄  ▄▄  ▄█▛    ",
      "      ▀▀████▀▀      ",
      "     ▟█▘    ▝█▙     ",
      "    ▟▛        ▝▙    ",
      "   ▘              ▝ "
    ]
  }
}
```

**Where it would go.** Four things aboard, five endings, one boot plate, maybe
one per compartment later. Fourteen plates is the whole first pass.

**Cost.** Two days for the renderer, the JSON schema, the content test and the
placeholder set. The renderer is about forty lines: a `<pre>` with
`white-space: pre`, `font-family: var(--data)`, a `clamp()`ed font size and
`overflow-x: auto`, plus an `aria-label` from the existing threat name so a
screen reader gets the word rather than the picture.

**Size.** A 22×9 plate is under 400 bytes. Fourteen of them is ~5 KiB of JSON,
which is under 2 KiB gzipped and rounds to nothing against the 349 KiB
precache.

**Risk.** Low, and the failure mode is visible immediately: block-drawing
characters (`▀▄█▌▐░▒▓`) are **not** in the self-hosted Share Tech Mono subset —
`ShipGraph.tsx` already carries a comment saying the fonts have no block glyphs
at small sizes, which is why the noise bar is drawn as a `<rect>`. So this
option has a prerequisite:

> **Prerequisite P1.** Either restrict plates to pure ASCII (`/\\|_-.'":;()[]{}<>*+=#@%&$`),
> which is authentic and safe, or extend the woff2 subset to include U+2580–259F
> and re-run gate 5.12. Restricting is free; extending costs ~2 KiB of font and
> a subsetting step in the build. **Recommend restricting to pure ASCII** — the
> block characters are a 1990s BBS look, not a 1979 one, and the game is dated
> to 1979 on purpose.

**Placeholders.** This is the part that makes the option safe. Ship all fourteen
plates as legible-but-plainly-provisional art — a bordered box with the thing's
name and its stat line, in the same character grid as the real thing will use:

```
+--------------------+
|      DRIFTER       |
|   3 TO KILL / 2    |
|    [ PLATE TBD ]   |
+--------------------+
```

The schema, the renderer, the tests and the layout are then all real and
finished; replacing one is editing a string array in a JSON file. Nothing about
the code changes when the art arrives, and any subset arriving early ships
early — there is no all-or-nothing moment.

**Authoring.** Hand-drawing ASCII is slow and the results vary. The practical
path is a one-off `scripts/plate.ts` that takes a PNG and emits the JSON array
by luminance-thresholding to a fixed ramp — the artist draws in any tool at
22×9 character cells, runs the script, and pastes the result. That script is
half a day and it is what makes "I draw them later" actually cheap. It runs at
author time only; nothing image-related ships in the app bundle.

---

### Option B — SVG micro-icons for actions and compartments

A 16×16 icon per action verb (walk, creep, listen, search, set aside, into the
vents, bank, seal, repair, read blood, swing, launch) and per compartment,
drawn as inline SVG paths in one `icons.ts` map: `stroke: currentColor`,
`fill: none`, `shape-rendering: crispEdges`, `stroke-width: 1`, no curves.

**Cost.** Three days including the drawing. ~4 KiB inline, no new requests.
Technically trivial — the schematic already proves inline SVG in the palette
works, and `currentColor` means every icon inherits its state colouring free.

**Risk: this is the one that can quietly ruin the thing.** Twelve glyphs down
the left edge of the command list turns a terminal readout into a mobile app's
button bar. The game's whole visual argument is that it is text a machine
printed. There is also a real legibility problem: at 16×16 in one colour with
no curves and no fill, "listen" and "search" and "read blood" are not reliably
distinguishable, so the icon ends up decorating a label that was already doing
the work.

**Verdict.** Feasible, not recommended as drawn. If icons are wanted here, the
defensible version is a **single-character prefix in the existing font** —
`>` walk, `~` creep, `?` listen, `*` search — which costs nothing, cannot go
out of palette, and reads as a terminal's own shorthand rather than as
iconography. That is a two-hour change, and it is reversible.

The compartment half of this option is stronger than the action half: eleven
compartment marks on the schematic would help orientation more than eleven verb
icons would help comprehension, and the schematic is already SVG.

---

### Option C — Animation on resolution

The tempting one: the vent-entry icon slides into a duct, the swing flashes, the
ending plate assembles line by line.

**What is technically available.** Only two things, given the constraints:

1. **Character reveal.** Already built and already load-bearing — the terminal's
   whole rhythm system (`src/ui/hooks.ts`) reveals text on a rAF clock against a
   precomputed per-character schedule. **An ASCII plate is text.** Revealing a
   plate line by line on that same clock is not a new animation system, it is
   the existing one pointed at a new string, and it inherits skip-on-tap,
   hold-to-fast-forward, reduced-motion and the "finishes on its own" guarantee
   for free. This is the single highest-value visual idea in this document.
2. **Frame swapping via `steps()`.** Two or three ASCII frames cycled with
   `animation: … steps(n) infinite`. No tween, no easing, so it passes the
   no-transition rule on a technicality — but only on a technicality.

**What is not available.** Anything that eases, fades, scales smoothly, or
tweens a path. `docs/INTERFACE.md` names four moments of motion and says nothing
else moves; that list is the interface's spine, not a default.

**Cost.** Plate reveal: half a day, because the machinery exists. Frame-swapped
idle animation: two days including the reduced-motion still, the pause-when-
offscreen logic, and the battery check on a real phone.

**Risk.** Ambient looping motion is the one thing the design brief explicitly
refused ("no ambient movement"), and it is refused for a reason that survives
this request: a thing that twitches on a loop stops being frightening within
about ninety seconds and then it is just a busy screen. Idle animation also
burns battery on a game meant to be opened daily and left open.

**Verdict.** Take the reveal (1). Refuse the loop (2) unless it is one-shot,
tied to an event, and dead still afterward — a drifter's plate assembling once
when it first resolves out of the dark, then holding.

---

### Option D — Bitmap art (PNG/WebP sprites)

**Verdict: no.** It fails gate 5.11 the moment anything is anti-aliased, it
fails the "everything is content" test because artists would be editing binaries
the schema cannot validate, and a dozen sprites at phone resolution is 200–400
KiB against a 349 KiB precache. Anything a sprite could do here, an ASCII plate
does in 400 bytes and in voice.

The one exception is the PWA icons, which are already generated as raw pixels
with no image library (`scripts/icons.ts`) and are not part of the interface.

---

## 3. Recommended order

| # | Work | Effort | Reversible | Ships without art |
|---|---|---|---|---|
| 1 | `plates.json` schema + renderer + content test + 14 placeholders | 2 d | yes | **yes** |
| 2 | `scripts/plate.ts` (PNG → character array, author-time only) | 0.5 d | yes | n/a |
| 3 | Plate reveal on the existing rAF clock | 0.5 d | yes | yes |
| 4 | Compartment marks on the schematic | 1 d | yes | yes |
| 5 | Single-character action prefixes | 2 h | yes | yes |
| 6 | One-shot frame swap on first sighting | 2 d | yes | no |

Steps 1–3 are one coherent piece of work and are the whole recommendation.
4 and 5 are independent and can be judged on their own. 6 should wait until
1–3 have been lived with for a week on a real phone, because it is the only
item on the list that can make the game worse in a way tests cannot catch.

## 4. What would have to be added to CI

None of this is safe on review alone; the gates are what have kept the interface
honest so far.

- **Plate schema test** — every plate is rectangular, within its declared `w`/`h`,
  drawn only from the permitted character set, and has an `aria-label`. Same
  shape as the existing `content.test.ts` zod checks.
- **Gate 5.11 extension** — assert no plate introduces a colour, i.e. plates
  render with inherited `color` only.
- **Reduced-motion e2e** — a plate renders complete and instantly under
  `prefers-reduced-motion`, mirroring the existing boot test.
- **Precache budget gate** — fail the build if the precache passes, say, 500 KiB.
  This does not exist yet and is worth adding regardless of whether any of this
  ships.
- **Vocabulary gate** — plate `alt`/`aria-label` text goes through the same
  `test/voice.test.ts` check as every other player-facing string.

## 5. The open question

Not a technical one. **Do the things aboard survive being seen?**

Right now a DRIFTER is `D` in a box, a count in the readout, and a sentence
about hunting you by ear. It is frightening in the way a sonar contact is
frightening. A picture of it — even a good one — answers a question the game is
currently better for not answering, and the answer is permanent.

The safe version of this, and the one worth trying first, is to **give plates to
the endings and the boot and not to the monsters**: the endings are where the
run is over and there is nothing left to imagine, and a CLEAN BREAK plate that
assembles line by line as the epilogue types is pure gain. Then look at a
monster plate once, on a real phone, in the dark, and decide.

That decision is the author's, not the engine's, and nothing above forecloses
it: the schema, the renderer and the placeholder set are identical either way.
