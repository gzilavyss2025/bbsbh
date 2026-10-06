# The foul sweep keeps the postseason beside the regular season

**Status:** Accepted
**Date:** 2026-10-06
**Issue:** #1511 (part of the open question #1445)

## Context

`gen-fouls.mjs` asked the schedule for `gameType=R`, so the foul tracker
(`/fouls`, the player page's `FoulCard`) had no October fouls. ADR-0094 solved
the same problem for the pitch sweep. Three things must not change:

- Every foul rate and league by-inning split on file stays a regular-season
  number. A few postseason games must not move it.
- The committed dump has the whole 2026 regular season. A new key must not
  need a re-walk of those games.
- A key that omits scope lets a postseason row overwrite or add onto a
  regular-season row (the trap ADR-0094 names).

## Decision

1. **MLB reads its postseason.** The schedule request asks for
   `R,F,D,L,W` (`POSTSEASON_GAME_TYPES`). The `Final` check and the
   `officialDate` de-duplication do not change. Both ledgers key on `game_pk`,
   so a postseason game is swept once.
2. **A `scope` column.** Every `foul_*` table gets
   `scope TEXT NOT NULL DEFAULT 'R'` with a CHECK for `'R'` or `'P'`. It is
   second in each key, after `season`, in the eight accumulating tables. In
   `foul_ingested_games` and `foul_game_totals` (keyed on the game) it is a plain
   column. A game's scope comes from its `gameType` (`scopeOfGameType`).
3. **Old rows load as regular season.** A dump line names its columns, so a
   line with no `scope` takes the default. No migration and no re-walk.
4. **Old readers read `'R'` only.** `exportFouls(db, season, scope = 'R')`
   filters every read on the scope. The `fouls.json` an old reader fetches has
   the same keys it always had.
5. **The postseason is a new key beside the regular season.** `exportFoulStore`
   adds `post` to `fouls.json` (the same shape: batters, pitchers, teams,
   league, topFoulGames, teamPitchTypes, gamesIngested, coverageSince) and
   `post: { batters, pitchers }` to each player bucket. `post` exists only once
   a postseason game is on file. Nothing sums `post` into the regular season.

## Consequences

- With the new column and no postseason game, a full export (one season and
  all seasons) is byte for byte what it was, apart from `asOf`.
- The dump writes every column on every line, so the new column rewrites the
  whole `scripts/data/fouls.sql` once, with no new rows.
  `test/season-store.test.js` compares a re-dump with the committed dump, so
  this change commits the migrated dump.
- `--backfill-team-pitch-types` wipes both scopes of a season and rebuilds each
  game under its own scope. `--backfill-games` keeps each game's scope.
- `/fouls` has a Regular season / Postseason toggle, shown once `post` exists
  (`PartOfSeason`, `foulsInScope` in `src/api/fouls.js`). The postseason view
  lowers the board floors (2 games, 60 pitches), since a club plays few October
  games. The player's `FoulCard` has the same toggle, reading the `post` slice of his bucket (`combineFoulShards` combines it beside the regular season for "all").
- Older postseason games are outside the 3-day nightly window. Backfill them by
  hand with `node scripts/gen-fouls.mjs --since=<first postseason date>`.
- Spoiler rule: a foul total over Final games says nothing about a game still
  in play (ADR-0034). The sweep ingests only Final games.
