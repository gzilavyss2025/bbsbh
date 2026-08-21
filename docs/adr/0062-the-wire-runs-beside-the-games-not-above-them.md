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
runs down the right of the games as a rail (`WireRail.jsx`), in margin the page
was already wasting.

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
here it does not: it carries a WIDER window than the card ever did (three days
rather than two — see the amendment below), and none of it costs the games a
pixel of height.

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

**The rail is not its own scroller, and is not sticky.** It was both at first —
capped to the viewport with `overflow-y: auto`, sticky at `top: 56px`,
`overscroll-behavior: contain`. That is the textbook sticky sidebar and it broke
the wheel: with the cursor over the rail, scrolling stopped moving the games.
The light-wire case was the worst of it — at ten moves the rail sat a hair OVER
its own cap, so it claimed the gesture to travel two pixels and `contain`
refused to pass the remainder on. The page did not move at all.

The rail scrolls with the page now. The slate has exactly one scroller, so no
gesture has to be routed between two. Sticky went with the cap and had to:
`position: sticky` on an element taller than the window pins its top and puts
its tail permanently out of reach, and a real 48 hours runs 30 to 54 stories —
taller than the window, often taller than the game list beside it. Sticky is
only safe on a rail whose height you have measured, and measuring the wire is
exactly what the card this replaced did badly. The cost is accepted: on a quiet
wire the column empties out before the games do.

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

## Amendment, 2026-08-21 — a three-day window, and a fit to the games

Two things landed after a day of use, and they turn out to be one thing.

**The window was really about 34 hours, not 48.** `WINDOW_DAYS = 2` means today
and yesterday by calendar date, and a transaction carries a date but no time, so
a rolling 48-hour cutoff is not computable. Two days is 48 hours only for a
reader who opens the app late in the evening; at 10am it is ~34, and just after
midnight it is barely 24. Measured on a Friday morning the rail showed **10
stories while Wednesday's 31 sat one day outside** — three times the news,
excluded for being on the wrong side of a calendar boundary rather than for
being old.

`WINDOW_DAYS` is **3**: the narrowest window that clears 48 hours at every hour
of the day (it runs 48 to 72). `FETCH_DAYS` goes 4 → **5**, backtested the same
way the original was — against a 14-day reference over 12 consecutive windows, 5
misses nothing and 4 misses one story. Re-run that backtest before moving the
window again; the margin is measured, not derived.

**Which made the rail too long, so it now fits itself to the games.** Three days
runs 41 to 65 stories — around 4,000px of rail against a games column that is
typically 1,900. Left alone the wire would have set the length of the slate,
which is the original mistake turned on its side.

So the rail ends where the games end: it measures the column beside it, keeps
the last WHOLE row that clears that height, and puts the rest behind one
control. **The wire may fill the page; it may never lengthen it.** The space the
games do leave is filled rather than left blank, which also settles the
emptying-out that dropping sticky introduced.

This is a measurement, and this ADR is on record calling the old card's
measurement its worst feature, so the difference matters. That card measured
against the VIEWPORT — a budget that moves for reasons the slate's content knows
nothing about. This measures a SIBLING ELEMENT, which changes only when the
slate's own content does (a filter applied, the fetch landing, an Off Day
section appearing), and it watches it with a ResizeObserver rather than
re-probing on window resize. The bug the old one shipped is still the bug to
avoid and is guarded the same way: a measurement can only see rows that are IN
the list, so measuring the already-trimmed list ratchets the count down and
never recovers. Every measurement runs against the FULL list, rendered for
exactly the frame the measurement needs.

Below `MIN_ROWS` (4) the rail holds its ground and overhangs the games instead.
Beside a two-game slate that is the right trade; a column showing one move is
not a ledger.
