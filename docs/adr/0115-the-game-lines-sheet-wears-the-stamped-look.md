# The Game lines sheet wears the stamped look

**Status:** Accepted
**Date:** 2026-10-16
**Issue:** none; Gary's design session of 2026-10-16 (a private artifact, "Game Lines Sheet Redesign", with comment threads)
**Amends:** ADR-0069, the look of the sheet

## Context

The lineup page and the player page already wear the stamped look of ADR-0109: square
cards with an ink edge and a hard shadow, club band heads with the ripple texture, and
stat grids. The Box Lines sheet that opens from them did not. It was still the older paper
sheet: soft rounded top corners, a raised blurred shadow, a small grey note above a plain
title, alternating banded rows, and the club mark drawn as a white knockout inked black.

Gary asked for a redesign on the design system. The first draft used the system's name tab
and invented a backdrop. A second draft was built against the running app: the real
sheet, the real fonts and real rows from the data layer. Gary then approved it.

## Decision

1. **The sheet has a stamped edge.** Square corners, a 2px ink edge, no blur. The edge is on
   the top on a phone and on the left when the sheet comes off the right edge.
2. **The head is a band.** The card the door sat on lends its club colours and its mark, as
   its own head does (ADR-0030: a club may colour a head that names the club). With no club
   the band is the house navy. The sheet is portalled to `<body>`, outside the page's themed
   root, so the caller hands the band in: `sheet.band` from `bandFor.js`. The note
   ("Game lines · regular season") moved from above the title into the band.
3. **The head controls are stamped.** The close button and the back button are squares with
   the ink edge and the 2px press. The title is 24px.
4. **The lead object is the door's own figures.** The lineup page's "Career vs CIN" door
   is a row of five figures. It now hands them in as `sheet.cells`, and the sheet restates
   them as a stamped grid with the door's own label over it, so the two cannot disagree. A
   door that is a text line keeps the verbatim line, in a tinted stamped card. The verbatim
   line stays the grid's accessible name.
5. **Rows group by season under an ink rule.** The year sits in the gutter, as before. A
   new season starts under a 1.5px ink rule (`startsSeason`). This replaced the alternating
   band. The club mark is the full-colour cap logo (`TeamLogo variant="cap"`), not the
   knockout. A comment of 2026-10-16 asked for full colour. The band keeps the white
   knockout, as every band does.
6. **A postseason pill names its league.** NLWC, ALDS, NLCS. The World Series stays WS.
   `seriesAbbr` already took a league; the sheet's request did not ask for one. Both game-log
   field lists now include `league`, and a split with none keeps the plain round (WC, DS,
   LCS). A comment of 2026-10-16 asked for this.
7. **The list and the figure grid are stamped cards.** Square, ink edge, hard shadow. The
   list has no banding. The picked group's twelve figures are plain cells with no lead cell
   (a comment of 2026-10-16: "remove the emphasis on a card here").

## What does not change

- **The spoiler footing.** The gate is still `api/boxlines/rows.js`. The sheet holds no date
  logic and a row it was not handed does not exist. The new `cells` are the career figures
  the lineup page already shows in the door, on an open surface (ADR-0034). The band colours
  are identity only.
- **The class names and the rules tests pin.** `.boxlines__empty` and `.boxlines__notice` keep
  only a margin; the loading line keeps `.boxlines__hint`. The empty and error states are the
  shared `EmptyState` and `Notice`.
- **The design system project.** The sheet is not one of its parts, so the build in
  `.design-sync/` is unchanged.

## Consequences

- Both game-log field lists add `league`. The cost is a few bytes a row.
- The postseason page's sheet (`GameLinesDoor`) shares the shell and wears the house band.
  Its pills still say WC, DS, LCS, because its rows come from the postseason ledger, which
  does not carry a league.
- `seasonBand` is gone. `startsSeason` replaces it.
