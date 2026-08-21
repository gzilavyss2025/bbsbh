# ADR-0061 — The wire docks to the thumb on a phone, and the games keep the top

Status: accepted (2026-08-20) — **superseded in part by [ADR-0062](0062-the-wire-runs-beside-the-games-not-above-them.md)**

> The phone half of this decision stands exactly as written: the wire docks
> to the thumb and the games keep the top. What ADR-0062 revisits is the
> claim below that the in-flow card is "correct" on a tablet or a desktop.
> Measured, it was not — at 1440x900 it ran 658px of a 900px window and put
> every game card below the fold, which is this ADR's own complaint at a
> different width. The wide surface is now a rail beside the games
> (`WireRail.jsx`); `LeagueMovesCard` and its fitted-row spec are gone.
> Read the Context below as the reasoning of its day.

## Context

The slate is the app's home screen and the reason anyone opens it: today's
games, one card each, in the order a scorer wants them. Since issue #772 it also
carries the league's roster moves from the last 48 hours — every club's recalls,
options, injured-list moves and trades, read live off the wire
(`src/api/transactions/leagueFeed.js`, spoiler-free by construction).

That card, `LeagueMovesCard`, sits **above** the game list, and it is good at
what it does: it measures the space it has, ends on a whole row, and leaves the
first game card showing beneath it (`e2e/league-moves-card.spec.js`). On a
tablet or a desktop that arrangement is correct — there is room for a section of
league news and a slate of games on the same screen, and the reader takes both
in at once.

On a phone there is not. A 390×844 screen spends its first fold on a masthead,
a club strip, a date banner and then up to eight rows of other clubs'
paperwork, and the games — the thing the page is named after — begin below all
of it. The card is not too big; it is in the wrong place. A reader scoring a
game glances at the wire between innings and looks at the slate constantly, and
the layout had those two frequencies backwards.

The obvious fixes are both bad. Cutting the card to two rows makes it useless
for its actual job (a real 48 hours holds about 35 stories across 20 clubs, and
the worst 48 hours of a measured month held 125). Moving it below the game list
makes it unreachable — nobody scrolls past a full slate to read transactions.

## Decision

**On a phone the wire leaves the flow and docks to the bottom edge of the
screen.** `WireDock.jsx` is a sheet pinned to the bottom with three rest
positions the reader drags between:

```
RAIL   the resting peek — the newest move on one line, a count, ~62px
HALF   the working height (~54vh) — the ledger scrolls, the slate is still
       visible and still tappable behind it, and there is no scrim
FULL   the whole ledger (~92vh), with a scrim across the half→full stretch
```

**The split is by width, at the app's one layout breakpoint.** Below
`WIDE_QUERY` the feed is the dock; at and above it, the in-flow card, unchanged.
Two presentations of one feed and never both at once — `GameSelect` picks, and
`e2e/wire-dock.spec.js` asserts the exclusion in both directions. A strip pinned
across the bottom of a 1200px window is a phone idiom worn in the wrong place,
and the card's careful fit-to-the-fold arithmetic is exactly right on a screen
that has a fold to spare.

**One module draws a move.** `MoveRow.jsx` holds the row, the day grouping and
the cutline, and both surfaces import it. The split is about where the ledger
sits and how it opens, never about what a move looks like, so the two must not
be allowed to drift.

**The slate pads its floor by the rail's MEASURED height.** `WireDock` publishes
`--wire-rail-h` onto the document element and `.screen--wiredock` consumes it, so
the last game card, the site footer and — the one that matters — the floating
**Reveal all results** bar all finish above the dock. That bar is a seal control
on a scoring surface; a dock that covered it would be a spoiler-rule bug wearing
a layout bug's clothes. The rail is watched with a `ResizeObserver` rather than
measured once, because a font swap or a count chip gaining a digit changes that
floor without firing a resize event.

**A dock is not a modal, and the difference is load-bearing.** It traps no
focus, locks no scroll, and takes no tap it was not given: the frame is
click-through and the scrim is inert until the sheet reaches FULL. At the
working height the slate behind it is fully live — that is the whole reason the
wire can live on this screen at all rather than behind a route.

## The motion, and where each rule came from

The feel is not decoration here; a sheet that is the only way to reach a feature
has to be worth reaching for. Every value below is deliberate, and the
arithmetic behind all of it is pure and unit-tested (`dockPhysics.js`,
`test/dock-physics.test.js`) rather than tuned by flicking a phone.

- **Drag tracks the pointer 1:1** from the grab offset, with the transform
  written straight onto the element. Not through a CSS custom property: a var
  invalidates inherited style down the whole subtree every frame, which is the
  documented way to make a long list drag badly.
- **A release projects momentum before it snaps.** It does not choose the detent
  nearest where the finger let go; it runs Apple's exponential deceleration
  (`projectMomentum`, `d = 0.998`, *Designing Fluid Interfaces*, WWDC 2018)
  and snaps to whatever detent that projected point is nearest. A small flick
  therefore throws the sheet, which is the entire feel. The physics-textbook
  `v²/2a` form is **not** what ships and under-throws badly at thumb
  velocities; the test pins the exact curve.
- **A flick never skips a detent.** The tallest detent covers the slate, and
  covering the page the reader came for is not something a gesture may do by
  accident. A deliberate second drag still gets there.
- **A drag past the tallest detent rubber-bands.** A hard stop reads as frozen;
  progressive resistance reads as "responsive, but there is nothing more here".
- **The settle is interruptible.** A pointer down mid-animation reads the LIVE
  on-screen transform and drags on from there, never from the target — that is
  the whole of interruptibility, and skipping it is what makes a grabbed
  animation jump.
- **The curve is the iOS sheet curve**, `cubic-bezier(0.32, 0.72, 0, 1)`, over a
  distance-scaled duration clamped to 200–480ms. Not `--ease-out`: that token is
  tuned for a short one-shot entrance and arrives with a visible slow tail over
  a 400px throw.
- **The header re-labels itself continuously.** The rail's one-line headline and
  the open sheet's section head share one box and cross-fade with the drag, so
  nothing swaps at a boundary.

**Scroll versus drag is resolved by one rule and no timer**: the ledger drags
the sheet only DOWNWARD and only from `scrollTop` 0. Upward always scrolls. At
`scrollTop` 0 a downward drag has no native scrolling to compete with, and
`overscroll-behavior: contain` takes care of the page bounce behind it.

**A tap is handled by the sheet, not by the button under it.** The pointer is
captured the moment the rail is pressed — which is what makes a drag track
through the gutters — and a captured pointer does not reliably deliver a click.
So a press that travels less than 6px is treated as a tap and opens one step,
making the whole 62px strip the target rather than the chevron drawn at the end
of it. Controls that own their own press carry `data-nodrag` and never start a
gesture at all.

**Reduced motion keeps the drag and drops only the settle.** Direct
manipulation is not decoration; a sheet that stopped following the finger would
be broken, not calmer.

## Consequences

**The card's own spec had to move to a wide viewport.** Two of its cases
asserted `.wirecard` at 390px, where the dock now renders instead. The two
"must not appear" cases stayed narrow and gained a matching assertion for the
dock, so neither presentation can leak onto a past day or a Triple-A slate.
(That spec is `e2e/wire-rail.spec.js` now, and asserts the rail — ADR-0062.)

**The dock is deliberately still a LEDGER and not a card deck.** The obvious
bottom-anchored idiom is a horizontally swiped deck, and it was rejected for the
same measured reason the in-flow card rejected it: 35 stories typical and 125 at
the worst is not a swipe, it is a chore. A vertical ledger under a thumb is
scannable at any length. What the deck idiom was actually offering — always
anchored, always in reach — is what the rail provides without the cost.

**One bit of screen is now permanently spent.** 62px of a phone's height belongs
to the rail whenever the wire has anything to say. That is the price of the
trade and it is paid knowingly: it buys back the ~300px the card was taking
above the games, and it renders nothing at all on a quiet 48 hours, on a failed
fetch, on a past day, and on any level but MLB.

**Nothing here touches the spoiler rule.** A roster move and its date carry no
score, so there is no `SealBox` in the dock and none is wanted. What the dock
does have to respect is that it floats over a scoring surface, and that is what
the measured floor above is for — asserted in `e2e/wire-dock.spec.js`, because
no unit test can see two rendered boxes overlap.

- Pinned by `test/dock-physics.test.js`: the detent ladder and its degenerate
  viewports, the exact deceleration curve, rubber-band monotonicity and its
  asymptote, tie-breaking toward the open detent, momentum-projected landing,
  the no-skip rule, settle clamping, tail-weighted velocity, and the scrim
  staying clear until the sheet passes the working height.
- Pinned by `e2e/wire-dock.spec.js`: the width split in both directions, the
  measured floor, tap-steps-open, drag-lands-on-a-detent, list-scrolls-without-
  moving-the-sheet, pull-down-from-the-top-closes, Escape, and that a link in
  the ledger still navigates.
