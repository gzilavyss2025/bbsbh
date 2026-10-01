# The postseason cutoff is a date, not a seal

**Status:** Accepted
**Date:** 2026-09-28
**Issue:** #1225 (slice 1 of #1224)

## Context

#1224 adds a postseason bracket, a series line on each slate card, and an
in-progress series page. All three show a series' state, which is a result —
exactly what the app's spoiler rule (root `CLAUDE.md`) otherwise seals behind
a tap.

Gary decided the shape of the rule for this feature on 2026-09-28. This ADR
records that decision so later slices (3–7) can cite it instead of restating
it, and so it is written down before any of them ship.

A second, narrower problem surfaced while scoping slice 1: live statsapi,
checked 2026-09-28, shows that an unplayed "if necessary" game drops off the
schedule the moment a series ends, with no cancelled marker, and a
placeholder club (for example "SD/CHC") turns into the winner's real row the
same moment. So a slate for a date after today can show today's result
plainly, even before any bracket exists on the page at all — that trap is
this ADR's second decision.

## Decision

**1. Heading into the cutoff date, not "now".** The bracket, the cards'
series line and the series page all show a series' state **heading into** a
cutoff date — the slate's own date, or the series page's `?d=`. A game
counts only once it went Final *before* that date. Today's games in progress
never change what these surfaces show; tomorrow's slate will.

**2. Yesterday's results are not protected. This is a decision, not a bug.**
A reader who has not watched last night's game yet sees its effect on the
bracket, the card and the series page the next time they open the app. The
cutoff moves forward with the calendar date, not with what the reader has
personally watched.

**3. No seal, no kraft tape on any of it.** The date cutoff IS the seal.
These three surfaces never wrap in a `SealBox`, and nothing here uses the
kraft-amber `--seal*` tokens (ADR-0083's scope guard). A tap opens a series
page or the full bracket; it does not reveal anything that was withheld.

**4. Scores Unlocked does not apply here.** The bracket, the cards' series
line and the series page do not read `useScoresUnlocked()` or
`spoilersOffFor()`. They show the same heading-into-the-cutoff state with the
pass on or off. This is a deliberate, narrow exception to ADR-0026's standing
rule that the pass drops every date cutoff in the app — the pass still
reveals the slate's own scores through `fetchSlateScores`, unchanged.

**5. In the postseason window, the MLB slate never shows a date after
today.** The window is `postSeasonStartDate` through the day before
`offseasonStartDate`, read off the season row (`fetchSeasonMeta` in
`src/api/schedule.js`) — never off the clock, and never inferred from an
empty slate (the same rule `src/hooks/useOffseason.js` already follows for
the regular-season/offseason line). Inside that window: the forward date
arrow stops at today, and a future date named directly in the URL
(`/{MMDDYYYY}`) shows today's slate instead. Outside the window — including
every other MLB slate and every minor-league slate, which this rule does not
touch at all — browsing ahead still works exactly as it does today.

`src/lib/postseason/capSlateDate.js` carries decision 5 as two pure
functions: `capSlateDate` (the cap itself) and `atForwardLimit` (the arrow's
disabled state), both pinned in `test/postseason/cap-slate-date.test.js`.
`GameSelect.jsx` is the only caller so far. A still-loading or missing season
row is treated as "assume the window" for any date after today — the row not
being in hand yet is never a reason to risk a flash of a spoiling slate.

## Consequences

- A "Game 3" card on today's slate spoils nothing under decision 1: the
  bracket already shows the series' 1–1 record heading in, which is public
  knowledge the moment Game 2 ended.
- Decision 2 means a user who skips a night's game and opens the app the next
  morning will see that night's series result on the home page, with no
  warning. Slices 3–6 must not add one; that would undo this decision.
- Decision 4 means the bracket module and its callers must not import
  `useScoresUnlocked` or `spoilersOffFor` — a lint or review that finds one
  should treat it as a regression against this ADR, not a hardening.
- Decision 5 is scoped to MLB and to the postseason window alone. A slice
  that wants the cap somewhere else (a different sport, a different date
  range) needs its own decision, not an extension of this one.

## Addendum (2026-09-28): the slate pages ahead again

Gary reversed decision 5 on the same day, after he used the finished home
page. In the postseason window, the forward date arrow and a future
`/{MMDDYYYY}` show that day's schedule again, the same as in the regular
season.

- **The cost is accepted.** A future day's slate can show today's result: an
  "if necessary" game that is gone, or a placeholder club that is now the
  winner. Gary takes this cost so that he can see the days ahead.
- **The bracket does not move.** `usePostseasonBracket` still caps its own
  cutoff at today (`bracketCutoff`, `capSlateDate` with no season row), so the
  results read never runs past today. On a slate day after today, the bracket
  shows the state heading into today, with no tickets for today's games
  (`seriesPlayingToday(bracket, slateDate)`), and the full bracket opens by
  itself. The cards on that day show no series line, because the bracket's
  `gameIndex` holds only games dated on or before its cutoff.
- `GameSelect.jsx` no longer calls `capSlateDate`. `atForwardLimit` is gone.
  Decisions 1 to 4 do not change.

## Addendum (2026-09-30): revealing the day's live scores moves the bracket

Decision 4 stands for the series page and for any reader who has not revealed
anything. One departure, Gary's call: on the home slate, when Scores Unlocked is
on for the slate's date, the bracket and the cards' series line count that day's
Final games too (`usePostseasonBracket(date, { live: true })`, and it refetches
on foreground). A game still in progress counts only once it is Final. The
switch is read in `GameSelect.jsx` and passed in; the bracket code still never
reads it.

## Addendum (2026-10-01): the lineup page's season-series strip draws no later postseason card

The same "if necessary" trap reached the lineup page (found in a review of
PR #1314). `seasonSeriesCells` blanked a later game's score, but still drew its
card. A Game 3 card on a Game 2 page meant the series split; no Game 3 card meant
a sweep. Either way the winner of the viewed game followed. On a postseason page
a later postseason game is now not drawn at all. A page whose own game is not in
the fetched list seals every game from its `officialDate` on.
