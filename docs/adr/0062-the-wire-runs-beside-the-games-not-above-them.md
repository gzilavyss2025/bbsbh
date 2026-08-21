# ADR-0062 — The wire runs beside the games, not above them

**Status:** Accepted
**Date:** 2026-08-21
**Supersedes in part:** [ADR-0061](0061-the-wire-docks-to-the-thumb-on-a-phone.md) —
its phone half stands unchanged; its wide half (the in-flow `LeagueMovesCard`)
is replaced by the rail described here.

## Context

The home slate's 48-hour roster wire had two presentations, split at
`WIDE_QUERY`: a bottom-anchored dock on a phone (ADR-0061), and an in-flow card
above the game list everywhere wider.

ADR-0061 fixed the phone by moving the wire out of the flow. It left the wide
surface alone on the reasoning that "a tablet and a desktop have the room". They
do not, and the numbers say so. Measured on the running app at 1440 x 900:

| | |
| --- | --- |
| Card top | y = 183 |
| Card bottom | y = 841 |
| Viewport | 900 |
| First game card | y = 857 |
| **Games above the fold** | **0 of 15** |

The card took 658px of a 900px window and put every game below the fold. The
slate — the page the app is named after — opened on other clubs' paperwork. This
is the same complaint ADR-0061 made about the phone, at a different width.

The card was also **too wide for what it held**. Its rows ran 896px and the
longest cutline in a real 48 hours used about 55% of that. Meanwhile `.screen`
caps at 960px inside windows that are routinely 1440, so roughly 480px of the
page sat empty while the games were pushed off it.

Too tall and too wide at once, next to unused margin. That is what the fix is
made of.

## Decision

**The wire stops taking vertical space and starts taking horizontal space.** It
runs down the right of the games as a sticky, independently scrolling rail
(`WireRail.jsx`), in margin the page was already wasting.

Three numbers, and they are related — change them together:

```
rail   288px
gutter  24px
shell  1272px  =  928 + 24 + 288
```

`928` is what the games column already measures inside the unwidened 960px
shell. So **the game grid keeps exactly the size, column count and card width it
had**; the rail is added beside it rather than taken out of it. A 1280 x 800
laptop — the commonest desktop there is — gets the full two-column layout with
no fallback, because the cap is set so it just fits.

Two further decisions fall out of that one.

**The games column trades width with the rail through `auto-fit`, not a
breakpoint.**

```css
grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
```

Two cards fit, you get two; they do not, you get one. Below about 1090px the
rail leaves too little for two columns and the grid drops to one on its own. No
second media query decides this, and it gives way continuously as the window is
dragged rather than snapping at a number someone picked. At 928 it resolves to
exactly the two 458px columns the old fixed `repeat(2, …)` produced, so every
width with room to spare is unchanged.

**The rail's row drops the photo rail** (`MoveRow`'s `compact` variant). 288px
minus a 33px face column and its gutter leaves about 220px for a sentence that
runs to 104 characters. The photo gives way because it is the only part carrying
nothing the cutline does not already say — the cutline still bolds every name.
The leading banner moves up into the kicker rather than going, because "did he
come up or go down?" is the one thing a reader wants before reading the
sentence.

## Consequences

Measured against the card it replaces, at 1440 x 900:

| | Games above the fold | Moves shown |
| --- | --- | --- |
| `LeagueMovesCard` | 0 of 15 | 7 of 10, behind a door |
| `WireRail` | 6 of 15 | 10 of 10, no door |

**The rail is better for the wire, not a demotion of it.** That is worth stating
plainly, because "move it out of the way" usually means "show less of it", and
here it does not. The whole 48 hours is on screen at once; a busy day (a
measured month's worst held 125 stories) scrolls inside the rail instead of
pushing the slate down. Three mechanisms went with the card and are not coming
back: the fitted-row measurement, the "All N moves" door, and the expanded
state. A rail that scrolls has no fold to end on.

**The slate is now the only screen in the app that goes past 960px**, and only
when a rail is actually there to fill the extra. `.screen`'s global cap is
untouched; the widening is `.screen--slate.screen--wirerail`.

**The width is reserved before the wire answers.** GameSelect adds the class on
what it knows synchronously (today + MLB + wide) and `WireRail` reports back
only to take it away, on a quiet 48 hours or a failed fetch. The other order —
widening once the moves land — slides the whole game grid sideways a beat after
first paint. In season the reserved case is right essentially always; the
give-back is the offseason path, and `e2e/wire-rail.spec.js` covers it, because
the failure mode is 288px of margin holding nothing.

**The rail sticks for the games column, then releases.** Its containing block is
the two-column wrapper, so it stays beside the reader for the whole game list
and then scrolls away rather than floating beside the footer.

**On a light slate the rail can be the tallest thing on the page** — a
three-game day with a busy wire. It is capped at one viewport
(`calc(100vh - 72px)`) and it is still to the side, with the games at the
top-left where the eye lands. Accepted rather than solved.

## Alternatives considered

Both were built as full mockups at 1440 x 900 before this was chosen.

**A one-line slug that expands in place.** The direct desktop translation of the
phone's dock: 40px at rest, click to open into the existing ledger. Cheapest to
build and works at every width from 740 up. Rejected because it shows 1 move of
10 at rest — the wire stops being something you glance at and becomes something
you have to open, which is a real demotion for a feed only two days deep.

**A two-column newspaper agate block.** All 10 moves, no photos, no banner
chips, 230px instead of 658px. The most at home in a paper-scorebook app, and it
needs no breakpoint or interaction. Rejected because it still spends vertical
space the rail spends none of: 4 games above the fold against the rail's 6. It
remains the natural fallback if the rail ever proves too much at narrow widths.
