# ADR-0043 — Focus mode is a console, not a narrowed page

Status: accepted (2026-08-10)

## Context

Focus mode is what the innings viewer becomes while the half on screen is still
sealed: the reader taps "Next at-bat", reads the result, pencils it onto paper,
glances at bases and outs, and taps again. Forty times a half-hour, for three
hours. It is the app's core loop, and the screen it happens on is the one screen
that has to hold up under repetition.

The first implementation built it as **the ordinary innings page with things
taken away**. It kept the same `.innings__grid`, the same `.pbp__atbat` card,
the same floating scorebug dock and the same two-row action bar, and then took
268px away for a reference rail, folded the stat row behind a flap, and hid
everything else.

Every defect that followed came from that one premise, and there were a lot of
them. A card tuned for a ~780px reading column was re-hosted at ~478px with no
responsive answer, so its pitch list overprinted the batter silhouette and the
matchup names truncated to a single pixel of width. The reference rail was a
fixed-size container for content that ranged from empty to 1006px tall, so it
was either a wasted column or a nested scrollbar. The trail — the navigator for
the card — was a horizontally scrolling strip that hid the earliest at-bats of a
long inning and sat two cards below the thing it navigated. The floating dock,
which exists to survive a long scrolling page, kept landing on top of a page
that no longer scrolled: it covered the reveal button entirely at iPad width and
covered the at-bat card that focus mode had just scrolled into place on a phone.
(That auto-scroll went with the rebuild — the stage mostly fits one viewport, so
revealing an at-bat replaces the card where it already is rather than travelling
to it. Nothing in focus mode calls `scrollIntoView` today; if a comment says
otherwise it predates this.)

Taken one at a time these read as bugs. Taken together they are one decision
being wrong.

## Decision

**While a half is being scored, this screen is an instrument, not a page.**

> Focus mode is composed for its own loop rather than inherited from the
> unfocused page: an **anchored** game-state band across the top, ONE at-bat as
> a full-width hero, a **wrapping** trail directly beneath it, a **tabbed**
> reference column beside it, and a **single solid row** of action at the
> bottom. Nothing floats over anything.

Four things follow from that, and each replaces a piece of inherited furniture.

### 1. The scorebug is placed, not floated

The dock is a 246px portrait card because it has to survive floating over a long
scrolling page. Focus mode has no such page. A fixed overlay on a surface that
mostly fits one viewport is pure collision with zero benefit, and the
tap-to-move-corners affordance was an apology for that collision rather than a
feature — a HUD the reader has to manually dodge is a design failure.

So in focus mode the same component, with the same props, unrolls into a
horizontal band and parks at the top of the stage. It is the same scorebug; only
its placement and shape differ (`ScorebugMount.jsx` owns the choice). Navy
ground under a kraft rule, deliberately the masthead signature `.half__title`
already carries, so the band reads as the game's ink header rather than as a
floating chip from somewhere else.

**The dock survives unchanged outside focus mode**, corner-stepping included.
The unfocused page really does scroll past its own linescore, which is the
condition the dock was built for. This decision is about where the scorebug
lives on one screen, not about deleting a feature from the app.

### 2. The at-bat gets more room in focus mode, not less

This is the inversion that made the first pass indefensible: the mode called
"focus" gave the thing you are focused on a narrower column than the mode that
shows everything. Focus mode overrides `.pbp__atbat`'s inherited 38fr/62fr split
and stacks the pitch-zone pane *below* the card, so the card takes the stage's
full width. The scorebook denotation — the code you actually pencil — steps up
the type scale, because it is the payload.

The header (`AtBatHero.jsx`) **replaces** the card's ordinary name row rather
than sitting above it. The strip it grew from was additive, so the batter's name
was printed twice on the one card the whole screen is built around. The header
now owns the identity outright: name, position, pinch-runner chain, RBI chip.

### 3. Reference is tabbed, and only one section exists at a time

A hand-scorer needs exactly one of these at a time, and which one is predictable
from what they are doing — penciling the next name, decoding a 6-3, logging a
pitching change, checking who is left to hit. Stacking all five into one
scrolling column served none of those moments and produced the scrollbar.

The column is permanently open, which retires `railOpen` and its Show/Hide flap
entirely. The reserved track — not a piece of React state — is what keeps
opening a section from reflowing the at-bat card, which was ADR-0010's
requirement all along. On a phone the tabs themselves become the surface: a chip
row that opens the same panel in a sheet, already showing the section asked for.

### 4. The running line is demoted, not removed

Mid-half the linescore duplicates the console band's score, and writing R/H/E is
a *between-halves* act — the moment the half closes it commits, focus mode ends,
and the ordinary page returns. So in focus mode `RollingLine` moves **below** the
at-bat and its trail instead of sitting above them, and the hero takes the top of
the stage.

It was briefly removed outright, and that was wrong: `RollingLine`'s run cells
double as the **half-inning navigator**, and they are the only way to reach a
half that is not one step away — `.inningnav`'s Back/Next move ±1 only.
`e2e/innings-page-turn.spec.js` drives every one of its transitions through those
cells and caught the removal immediately. Demoting a surface is a layout
decision; deleting the only affordance for a whole navigation path is not, and
the two should not be confused because they save the same 90px.

## What this does NOT change

Nothing here touches the seal. Every value on this screen arrives already
resolved and already reveal-gated; focus mode adds no second reveal boundary,
and revealing stays the floating bar's "Next at-bat" alone. `revealRunsThrough`
moved down one component with the scorebug's placement logic and is reached
under exactly the gate it always was — `spoiler-manifest.json` records the move.
The stat/WPA row is hidden by CSS visibility only: no seal, no caller-gated
pre-pitch selector (ADR-0010), no fetch is affected either way.

## Consequences

- Focus mode is now genuinely its own composition, so a change to the unfocused
  innings page no longer silently reshapes the scoring loop. That cuts both
  ways: the two can drift, and a future change to the at-bat card must be
  checked at both widths.
- `61-focus-mode.css` outgrew the 600-line file cap. `src/styles` is a flat
  directory at its own ratchet, so it could neither fold back into an earlier
  partial (it must load after everything it overrides) nor split into a 68th
  numbered sibling. It subdivided into `src/styles/focus/` instead — the first
  partial here to take ADR-0038's own prescription. A future split under the
  same pressure should follow it rather than reach for another sibling.
- The floating bar gains a second layout. `e2e/reveal-hit-area.spec.js` pins the
  behaviours that must survive it — a near miss still reveals, Refresh still
  keeps its own taps, and the page above the bar still keeps its own — and those
  assertions were carried over to the new geometry rather than relaxed.

## Amendment (2026-08-11): the band is placed, not pinned, and wears the dock's own size

Placed at the top of the stage was the decision. **Sticky** was not — it arrived
with it and cost more than it paid.

Three things come off, all on the band:

- **The phone sticky is gone** (`.consolebar`). Desktop had already dropped the
  pin for the reason that applies just as well to a phone: a bar that follows
  the reader down the page spends the top of every scroll on a header. While a
  half is being scored, the reference is the at-bat card directly under the
  band, and it moves with it. The band is now `static` at every width, so
  `position: static` in the wide block is a restatement of the grid placement,
  not an override.
- **The phone scale-up is gone** (`.gamehud--console`'s `max-width` block).
  Bigger type, a 92px strip and larger pips answered "the band has the whole
  width to itself down here". What they bought was ~40px of the smallest
  viewport, spent ahead of the card being read. The band keeps the dock's own
  sizing at every width now — full width on a phone, dock scale.
- **The height floor comes off the BLANK band** (`.gamehud--console.gamehud--blank`).
  The floor stops the band collapsing when the batter and pitcher rows unmount;
  what it actually rendered was ~60px of bare navy under the strip, on every
  landing, since a half is blank until its first at-bat opens. A dark slab reads
  as a rendering fault, which is worse than the shift it prevents — and that
  shift is now small, and lands as a half ends rather than mid-read.

`--console-hud-h`'s phone value follows the measurement down, 167px -> 126px.
Both numbers are still measured, and the due-up cards beside the band still
stand on them.
