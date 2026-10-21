# src/api/classics — the classics deck

Reference for `src/api/classics/deck.js` (issue #1525, slice 1). Spoiler class:
`spoiler-free` (`src/api/spoiler-manifest.json`).

## What it does

Deals one MLB game from 1960 on, to score by hand. No pool file and no generator:
two small calls per deal.

1. `teams?sportId=1&season=Y&fields=teams,id,abbreviation` — the AL and NL clubs of
   that season, and the abbreviation the game address needs. (A schedule row does not
   carry `abbreviation` for old clubs.)
2. `schedule?sportId=1&teamId=T&season=Y&fields=…` — that club's season, about 57 KB.

## Why no score can arrive

`CLASSICS_FIELDS` lists ids, names, dates, the venue and `status.detailedState`. The
response holds no `score`, `isWinner` or `leagueRecord` (checked on the 1982 Brewers).
The module never sets `hydrate=`. `test/classics-deck.test.js` pins both.

## Exports

- `rollClassic({ seed, step, era, teamId, lastSeason, isStarted, fetchJson })` — walks
  the seasons in a seeded order until one deals a game. `era` is a decade (`1980`),
  `teamId` a club. Returns `{ game, started, total, season }` (`total` is the size of the one club-season dealt from, about 162 games, not the whole deck) or `null`. `game` has
  `{ pk, date, away: { abbr }, home: { abbr }, g }`, the shape `poolGamePath` reads.
- `classicsFrom(rows, abbr)` — the eligibility filter. Keeps `gameType` R, F, D, L or
  W, `officialDate` from 1960-01-01, `detailedState` exactly "Final" (forfeits,
  postponements and cancellations drop), and both clubs in `abbr`.
- `scheduleUrl`, `teamsUrl`, `CLASSICS_FIELDS`, `seedFrom`.

The roll picks season, then club, then game, so games are not weighted equally.

## Not here

The current season, the notable index, a result-based pick (ADR-0080), the card, the
`/classics` page and the off-day mount (slices 2 to 4). A classic's box score stays
open by its date (ADR-0117).
