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

**5. No minimum sample, except a floor on the all-years board.** Any club
with one game in a split is ranked, as on the regular-season page. Over all
years that puts a 3-0 club ahead of 13-1, so that view alone offers a floor
(`?min=3|5|10`, "Any games" by default). A club under the floor keeps its row
and its figure but takes no rank, the same as a club that never played the
split (`minPlayed` in `rankMetric`). A single postseason has no floor: its
samples are a handful of games for every club.

**6. A record opens onto its games from the ledger, with no fetch.** Each W-L
figure on the page is a door to a sheet of the games it counts, with final
scores and a link to each box score (the player Box Lines, ADR-0069, drawn for
a team). The ledger carries `pk`, `gt` and a per-season `abbrs` map for it. The
abbreviations are stored because a box-score address is spelled from the
schedule's abbreviations of that date (FLA, not today's MIA). The page is an
open surface (ADR-0034) and its W-L already counts these games, so the sheet
shows the scores; the box score itself stays sealed.

**7. The team view can drop its club filter.** "All teams" in the club picker
(`?view=teams&team=all`) tallies every club's games as one ledger
(`combinedEntry`), so each split reads how the whole field fared in it, with
no rank column (there is nothing to rank against). The tally is the same
`teamRecordsFor`, so the combined figure is the sum of the clubs' figures. A
split both clubs can meet in one game counts that game twice, once for each
side, as a single club's figure counts it; the games list shows one row per
club side, so it adds up to the figure. Long lists show 100 games, then ask.

## Consequences

- The postseason regenerates with `--export-only` and no network when a
  definition changes, like the regular-season ledger.
- The nightly job commits an `index.json` timestamp every night, outside
  October as well. This is the cost of the freshness guard seeing the dataset.
- Month, division and season-count splits are not offered (`data.postseason`
  in `teamRecordsFor` and `buildRankingIndex`).
