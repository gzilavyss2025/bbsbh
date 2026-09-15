`ranOutFor` in the lib already counts, per club, how many games it emptied its challenges in and how many of those were early. What does not exist is a per-GAME board: which clubs ran out earliest, and when.

## The derivation

Group rows by `(game_pk, team_id)`, keep `outcome = 'fail'`, sort by inning then half then `seq`. The **second** one is the moment that club was emptied.

## The tie pile is the finding, so do not hide it

Measured on the season on file, MLB: **9 clubs emptied in the first inning, 18 more in the second, 47 in the third.** A "top 10" would be an arbitrary slice of the first-inning nine plus one of twenty-seven second-inning rows.

Ship a **band**, not a top 10: every club that emptied inside the earliest inning that has any, with the full distribution beside it so the reader can see the shape (1,140 of 4,508 MLB club-games ran out at all, most of them late).

Tiebreak inside the band, for ordering only: earliest half (top before bottom), then earliest `seq`, then date.

## What the row carries

Club, opponent, date, the half and inning it emptied in, and for each of the two failed challenges: who asked, what the umpire had called, and how far off the edge the pitch was. Five of the MLB nine were emptied by one man asking twice, which the row should show rather than a summary line stating it.

> **SPOILER RULE.** This board names specific games. `/abs-challenges` is classed `spoiler-free` in `src/api/spoiler-manifest.json` and must stay that way. Club, opponent, date, inning, the call and the miss distance are all fine — a challenge is a ball-strike judgment. **Never a score, a winner, a run total, or anything one can be read from.** `check-spoiler-manifest` is in `npm run lint`.

## Acceptance

- The board derived in `scripts/lib/abs/export.js`, the band cut and any floor in the reader (`src/api/around-the-game/absChallenges.js`), per that module's own split
- Tests: a club with one fail only (never emptied), a club emptied in extras, a club whose two fails are in the same half, and the tiebreak order
- Nothing score-shaped in the exported rows. Assert it in a test
