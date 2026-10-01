# The Former Teammates Ladder sizes to its card

**Status:** Accepted
**Date:** 2026-10-01
**Issue:** #1352

## Context

The lineup page's Former Teammates card is now the Ladder: away players, the
clubs they shared, home players, and a line for each pair. Each player and
each club shows once. The lines are pixel math in JS
(`src/components/team/ladder/layout.js`), so the code must know how wide the
diagram is.

## Decision

**1. The card's measured width picks the layout, not the viewport.**
`Ladder.jsx` reads the diagram's own width with a `ResizeObserver`.
`ladderGeometry` goes sideways only when that width is at least
`SIDEWAYS_MIN` (840px) **and** every column gets 54px. Otherwise it stays
vertical. One viewport can hold a one-column page or a wider card, so a media
query gives the wrong answer. Rays–Yankees needs 19 columns, so at the 960px
screen cap (894px of card) it stays vertical.

**2. A trace lights pairs, never club membership.** Two players on one club box
may never have played together there: Andujar and Bauers both link to the
Yankees box, through two different pairs. `traceOf` lights only the edges of
the traced node's own pairs.

**3. The first tap traces; the traced name is the player link.** A player's
headshot is always the trace button. On a phone, the name is inside that button
until the player is traced, then it becomes his `PlayerLink`: the first tap
traces, the second tap opens his page. With a mouse (`HOVER_CARD_QUERY`),
pointing traces, a click on the headshot pins, and the name is a link from the
start.

## Consequences

- Do not replace the measured width with `WIDE_QUERY` or another media query.
- Do not draw a trace from `groups` or `clubs`. Read `edges`.
- `test/former-teammates-ladder.test.js` pins decisions 1 and 2. Decision 3 is
  in `Ladder.jsx` only; check it in the browser.
