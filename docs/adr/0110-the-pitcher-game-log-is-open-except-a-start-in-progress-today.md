# The pitcher Game Log is open, except a start in progress today

**Status:** Accepted
**Date:** 2026-10-13
**Issue:** #1851; parent #1878 (the player page redesign)

## Context

#1851 adds a Game Log to the pitcher's player page: one row per start, with the final
score, his decision, his stat line and the pitch mix of the start. A later slice adds a
detail view for one start. The result strip of that view says who won ("BREWERS LOSE")
and who took the decision ("Gasser takes the loss.").

A final score is the value that the spoiler rule keeps sealed on the scoring surfaces
(root `CLAUDE.md`). The player page is not a scoring surface. It is an open surface
(ADR-0034, "The cutoff is opt-in now"): it shows current stats, and a link out of a game
carries no `?d=`. Scores Unlocked (ADR-0026) is the one way to unseal a day on the
scoring surfaces. It is a consented render override, and the player page does not need
it.

A reader can still come to the player page from a game that is in progress. For example,
the reader taps the starting pitcher of tonight's game while the reader scores it. If the
Game Log shows that start with its final score, or with "W", the page tells the reader
the result of the game that the reader is scoring.

## Decision

Gary decided this on 2026-10-12.

1. **The pitcher Game Log and its start detail view are open.** They follow ADR-0034.
   They have no seal and no gate. A final score and a decision read like a stat line on
   this page.
2. **The one guard: a start in progress today shows no final score and no decision.**
   The row stays, with its date, opponent and stat line. The result cell shows a dash.
3. **The guard is the one that is already on main.** It is not a second guard.
   - `fetchFinalScores` (`src/api/boxlines/fetch.js`) does not ask for the score of a
     game on today's baseball date (US Pacific), or of a suspended game that resumes
     today. The game log of the live player page uses it (#1914, Gary, 2026-10-13).
   - `gameLogView` (`src/api/person/gameLog.js`) gives no decision to a row with no
     score. The gameLog split carries `wins` and `losses` for a game in progress, so
     the decision must come from the row with a score, never from the split alone.
   - `pitchlogView.js` (`src/screens/player/next/modules/pitchlog/`) reads both. The
     totals row counts W and L from the rows that show a decision.
     `test/player-next-pitchlog.test.js` pins the guard.
4. **The name stays "Game Log".** The stamp Game Log (ADR-0035) is a different thing.
   `CONTEXT.md` says which is which.

## Alternatives considered

**Seal the score and the decision behind a tap.** That puts the scoring-surface rule on
an open surface. ADR-0034 undid that mistake on the team page.

**Show nothing for a start on today's date.** The stat line of a start is a stat line,
and the page shows it for every other start. Only the score and the decision tell the
result.

**Hold the score with the page's `asOf` cutoff alone.** A link out of a game carries no
cutoff now, so this does not hold anything on the usual path.

## Consequences

- A start played today shows its score and decision on the next baseball day.
- The start detail view (a later slice of #1851) must take its score and decision from
  the same row, so that the guard also covers it.
- If a start detail view fetches the game feed for its strikeouts and big plays, those
  are plays, not a score. They are open on this page.
