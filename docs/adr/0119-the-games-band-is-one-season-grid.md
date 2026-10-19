# The Games band is one season grid

**Status:** Accepted (2026-10-19). Gary asked for this design after a canvas review on 2026-10-19.
**Date:** 2026-10-19
**Issue:** none; Gary's request of 2026-10-19
**Amends:** ADR-0082 (the Games band), ADR-0042 (where the Stamp In door sits)
**Relies on:** ADR-0034 ("The cutoff is opt-in now"), ADR-0087 (the postseason rows), ADR-0117

## Context

The Games band drew two cards for the same schedule. The Schedule card showed one block per
series. The Games card showed a ticket stub for each decided game, 24 at a time, newest first.
A reader could not see the shape of the season in either one. The stubs said what happened
last. The series blocks were small and carried no score.

## Decision

**The two cards become one stamped card, the season grid.** It shows every game of the club's
schedule, in weeks, seven days across, one week to a row.

- A game is a link. A decided game opens its box score. A game still to play opens the lineup
  page. Both use the existing game routes.
- A win is solid. A loss is hollow. A game still to play is dashed. The page's own day is gold.
- The postseason is a gold band that opens on the first week with a postseason game. A club
  with no postseason game has no band, and the grid ends. Nothing reserves a place for October.
- A doubleheader splits its day into two halves, game 1 on top. Each half prints its score. The
  second game links to the `-2` address.
- The All-Star Game takes its own ink cell on its day. MLB only, as before.
- Each cell names its opponent with the club's one-colour mark (the `mono` art of ADR-0031), with
  an @ before it on the road. A club with no such art (minor league) keeps its abbreviation.
- Filters fade the games that do not match: Home, Away, Wins, Losses, Day, Night, and Postseason
  when the club has one. Nothing is removed. Day and Night read the schedule's `dayNight`, which
  `fetchTeamSchedule` now asks for. It carries no score.
- The card holds the Stamp In pill. It is still the only door to `/team/{id}/stamp-in`
  (ADR-0042). Highlights and Photos stay below the grid.

Every result still comes from `fetchTeamSchedule`, cut at `?d=` by the loader. The grid reads
`won`, `runs` and `oppRuns` and nothing else. A game newer than the cutoff shows no score. This
is an open surface (ADR-0034), so nothing is sealed.

### What was cut

- The ticket-stub grid, its "Show more" pager and its extra-innings note.
- The series strip and its series blocks. The grid shows a series as a run of cells.
- The extra-innings note the stubs printed beside a score (Gary, 2026-10-19). The box score
  shows the innings.

## Alternatives

- **Weeks across, days down (31 columns).** This was the first canvas. It does not fit the
  960px wide column: a cell would be about 28px wide. Weeks as rows work at 440px and at 960px.
- **Keep the series strip and add scores to it.** It cannot show a postseason and the regular
  season in one calendar. It also has no place for a day with no game.
