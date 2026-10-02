# The postseason records ledger is its own dump group

**Status:** Accepted
**Date:** 2026-10-02

## Context

The Postseason Records page ranks every postseason club on the same situational
splits as the regular-season page, for one postseason or for all of them since
1995. The regular-season ledger (`gen-team-records.mjs`) has the facts for
these splits, but it sweeps regular-season games by date at six levels. It also
holds one season's rows in the live dump.

## Decision

**1. A second ledger with the same row shape, not new columns on the first.**
`gen-postseason-records.mjs` writes `team_record_games`' twin,
`postseason_record_games`, in its own `postseason-records` season group
(ADR-0086). The two generators run on different cadences, and a shared dump
file lets whichever pushes second overwrite the other's table (the rule in
`scripts/CLAUDE.md`). The ingest and ship steps are shared, in
`scripts/lib/records/ingest.mjs`, so the shipped row is the same and the
app's predicates read it as is.

**2. A series is the games played, not the games scheduled.** The schedule's
`gamesInSeries` is the best-of-N. A sweep of a best-of-seven leaves it
describing games that never happened. `tagPostseasonSeries` counts a club's
games against one opponent in one round, so the finale is the game that ended
the series and `completeSeries` in the reader finds whole series only.

**3. League is read per game, not per club.** The `il` flag comes from the
league each club belonged to that season (the schedule's `team.league`).
Today's `teams.json` would call Houston's 2005 World Series an interleague
game.

**4. One file per season, all clubs inside.** A postseason is ten to twelve
clubs and about 40 games, so a season is about 15 KB. The all-years view reads
32 small files, not three hundred club files.

**5. No minimum sample.** Any club with one game in a split is ranked, as on
the regular-season page. A 3-0 club therefore tops an all-years board ahead of
13-1. A minimum-games control is a later, additive change if this reads wrong.

## Consequences

- The postseason regenerates with `--export-only` and no network when a
  definition changes, like the regular-season ledger.
- The nightly job commits an `index.json` timestamp every night, outside
  October as well. This is the cost of the freshness guard seeing the dataset.
- Month, division and season-count splits are not offered (`data.postseason`
  in `teamRecordsFor` and `buildRankingIndex`).
