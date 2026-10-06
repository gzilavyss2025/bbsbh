# Entry-card stat lines end the day before the game

**Status:** Accepted
**Date:** 2026-10-01
**Issue:** #1344

## Context

The full Now Pitching card (#1344) shows when an arm takes the mound in the
innings viewer. It shows his season line, a postseason line, his pitch mix and
his last appearance. The innings viewer is inside the spoiler scope
(ADR-0034), so nothing on the card may show this game's result.

`fetchPitcherSeasonLine` read `stats=season`. That total **includes the game in
progress**. On 2026-09-30 Tyler Mahle's `stats=season` line equalled his line
that night, during WC Gm 2. A reader at the 1st inning would see his runs from
the 6th. The same leak was on the lineup pages' starter card.

The game log had two more problems:

- Without `gameType`, the gameLog endpoint sends the regular season only. In
  October the "last appearance" was a September game, and "Pitched yesterday"
  was wrong.
- The filter `date < officialDate` dropped game 1 of a doubleheader from game 2.

## Decision

**1. Every stat line on an entry card ends the day before the game.**
`fetchPitcherSeasonLine` asks `stats=byDateRange` from `{season}-01-01` to
`officialDate − 1 day`. It returns null when it has no date to stop at. The
regular-season row uses `gameType=R`; the postseason row uses
`gameType=F,D,L,W`.

**2. A traded pitcher gets the combined line.** byDateRange sends one split per
club and one combined split with no `team` key. The order is not fixed (Mahle
2026: ATL, SF, combined). The fetcher picks the split without `team`, never by
position.

**3. The last appearance is strictly before this game.** `fetchPitcherLastGame`
keeps a game with `date < officialDate`, or the same date with a lower
`gameNumber` (a doubleheader). The gameLog call asks for
`gameType=R,F,D,L,W`.

**4. No decision from an earlier game.** In a series, a W, L, SV or HLD tells
the reader how an earlier game ended. The postseason row shows "–" in the
decision column. The last appearance shows no decision. The fetcher does not
return one.

**5. Yesterday is not protected.** WC Gm 1 is in the WC Gm 2 card's postseason
row. This follows ADR-0087's rule: a cutoff is a date, not what the reader
watched.

## Consequences

- The lineup pages' starter card gets the same fix, because it calls the same
  two fetchers (`useGameData.js` now passes `officialDate` and `gameNumber`).
- The card makes up to four more requests when an arm takes the mound. The
  pitch mix reads the existing static shards.
- `test/pitcher-card-data.test.js` pins the URL, the combined split, the
  doubleheader rule and the postseason game types, on responses captured from
  statsapi on 2026-10-01.

## Addendum (2026-10-06, #1509): hitters on the preview poster

The poster's hitter line read the boxscore's `seasonStats`. In a postseason game
that record holds the postseason only: Chase DeLauter, ALDS Gm 2 (gamePk 849834),
read 2 G / 8 AB / .250. His regular season is 133 G / 495 AB / .287
(`stats=season&gameType=R`). So the poster printed an October sample as a season line.

In a postseason game the poster now reads the regular-season line from one
`byDateRange` request for the whole lineup, ending the day before
(`src/api/player/hitterEntryLines.js`). The October line, from `seasonStats` minus
tonight, rides the model as `october`. Until the request lands the season slot is
empty. The callouts (`gen-callouts.mjs`) are not changed: whether an October note
counts October games needs the owner's answer.
