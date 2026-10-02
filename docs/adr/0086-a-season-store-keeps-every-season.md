# A season store keeps every season

**Status:** Accepted
**Date:** 2026-09-24
**Issue:** #1200 (step 1 of #1199), which closes #1168. This ADR covers the first
two stores, `umpires/` and `spray/`. The other four (fouls, pitch-arsenal, ABS,
umpire accuracy) follow the same rule in #1200.

## Context

Several nightly generators keep a season-to-date store. Before this ADR, none of
them kept an old season:

- `gen-umpires.mjs` rebuilt `public/data/umpires/` for the calendar year and
  deleted every shard it did not write.
- `gen-spray.mjs` read its buckets back only when `shard.season` was the
  calendar year, and it wrote 100 buckets in all cases.

#1168 ran both generators with the clock set to 2027-01-01 08:00 UTC. The
umpire run found no Final 2027 game and deleted all 154 shards. The spray run
wrote 100 empty buckets over the 2026 data. The umpire pages and the spray card
would be blank from January 1 to Opening Day (2027-03-25), and the 2026 data
would be gone.

Gary also wants to keep every season, compare 2026 with 2027, and combine
seasons (#1199). So the fix cannot be "carry the old season until the new one
starts, then delete it".

## Decision

A season store keeps every season.

1. **One folder per season:** `public/data/<store>/<season>/…`.
2. **An index:** `public/data/<store>/seasons.json` is
   `{ seasons, current, generatedAt }`. `current` is the latest season with data.
3. **A run writes only its own season's folder.** The sweep of stale shards
   stays inside that folder. A completed season is frozen.
4. **A run with no data for its season writes nothing.** It does not create the
   folder, touch the index or touch the ledger. So on January 1 `current` still
   names last season, and it moves to the new season with the new season's
   first game.
5. **Readers ask the index first.** `currentSeasonOf(store)` in
   `src/api/staticJson.js` reads `seasons.json` (memoized), and the reader then
   fetches `/data/<store>/<current>/…`.
6. **The index is written only when it changes**, so a normal night does not
   dirty it with a new stamp.

The helpers are `readSeasons`, `seasonsAfter` and `writeSeasons` in
`scripts/lib/io.js`. `test/season-store.test.js` pins the layout and the rule.

## Consequences

- The January 1 simulation in #1168 passes: 0 changed files under `umpires/`
  and `spray/`, and all five floor tests pass.
- A season picker (#1201, #1202) can read `seasons` from the same index.
- Each completed season adds its files to `public/data` once (about 12 MB for
  these two stores) and never changes after that.
- The spray ledger (`scripts/data/spray-ingested.json`) holds one season, the
  last one written. A backfill of a completed season must start from an empty
  ledger for that season.
- `umpires/` and `spray/` stay unstamped for `check-data-freshness.mjs`, as
  before: a frozen season must not count as stale.

## The other four stores (#1200)

Umpire accuracy, fouls, ABS and pitch arsenal had a different defect. They did
not go blank on January 1. They added the new season onto the old one: the first
2027 game would add to the 2026 totals and relabel them 2027 (#1168). The fix is
the same rule. Each row goes to the folder of its game's season, never the
calendar year. A season that is not complete keeps changing, and a completed
season stays frozen. Each store also has an `all/` file for its league-wide
files only. A run builds it from the rows or counts of every season, never as an
average of two seasons' rates, and writes it only when its content changes. The
app does not read `all/` yet (#1201). `seasonToServe(today, seasonsOnFile)` in
`scripts/lib/io.js` names the rule that `seasonsAfter` uses: the latest season
on file, whatever the date.

**Umpire accuracy.** `umpire-accuracy/{season}/` holds the row shards and
`umpire-accuracy-summary.json` (before: `public/data/umpire-accuracy-summary.json`).
`all/umpire-accuracy-summary.json` runs the same aggregates over every season's
rows. The merge base is the season's own folder. `writeAccuracyStore` in
`scripts/lib/umpire-accuracy-merge.mjs` holds the rule, and
`test/umpire-accuracy-merge.test.js` pins it. The summary moved into a folder
with no `index.json`, so `check-data-freshness.mjs` does not check it now. This
is the same as `umpires/` and `spray/`: a frozen season must not count as stale.

**Per-season dumps.** A SQLite group with `bySeason: true` (`scripts/lib/db.js`)
dumps its newest season to the live `<group>.sql`. The first dump that sees a
newer season writes each older season once to `<group>-<season>.sql`, and
`openDb()` loads them all. A season with a frozen file never goes back into
the live file, even when the newest season loses its last row. A later run
that changes a frozen season's rows fails, so a change is never dropped in
silence. When the change is on purpose (a backfill, a new column), rerun with
`REFREEZE=1`: it rewrites the frozen file from the rows in memory. Never delete
a frozen file to get there, because `openDb()` loads that season only from it.
No frozen file exists until a newer season has rows. `test/season-store.test.js`
pins this.

**Fouls.** `season` is now the first column of the key of every accumulating
foul table, and of each `ON CONFLICT`. `foul_batter_pa_high`,
`foul_ingested_games` and `foul_game_totals` got a `season` column (2026 for
every existing row: every ingested date was in 2026). A one-time migration
copied each row to the new keys, and every row count and column sum of the ten
tables came out the same. JSON: `fouls/{season}/fouls.json` and
`fouls/{season}/{NN}.json` (before: `public/data/fouls.json` and
`public/data/fouls/{NN}.json`), `fouls/seasons.json`, and `fouls/all/fouls.json`.
`exportFouls(db, null)` builds `all/` from the rows: counts add, a `max_*`
high keeps the higher game with its context, and `isStarter` comes from the
summed starts and games. `--backfill-team-pitch-types` wipes and rebuilds one
season (`--season`, default the newest). `fouls.json` lost its `asOf` freshness
check, as the umpire accuracy summary did.

**ABS.** The three ABS tables already had `season`, so no key changed. The
`abs-challenges` group is a season group, and its dump came out byte for byte
the same. `buildExport`, `buildExposureExport` and `buildExposureClubsExport`
(`scripts/lib/abs/export.mjs`) now cut the rows of the season they name;
`season: null` is the `all/` cut over every row. The per-club file folds a
man's rows per club (`exposureByPlayer`), so `all/` adds his seasons and never
lists him twice. JSON: `abs/{season}/` holds `abs-challenges.json`,
`abs-exposure.json` and `abs-exposure-clubs-{mlb,aaa}.json` (before: all four
in `public/data/`), plus `abs/seasons.json` and `abs/all/`. Every file is
written only when its content changes. `--exposure` reads the rosters of the
newest season on file, not the calendar year, so on January 1 it re-reads last
season's final rosters. `--rebuild` needs `--season` and clears only that one
(`clearSeasonRows`). `abs/` is in `check-data-freshness.mjs`'s `EXCEPT`: a
completed season must not count as stale.

**Pitch arsenal, command and pools.** `season` now leads the keys of
`pitch_arsenal_totals` and `pitch_command_cells`, and each `ON CONFLICT`; the
command grid's read-modify-write reads the row of its own season. The two
ingested-games ledgers got a `season` column. The migration kept every row:
counts, column sums and a hash of every row came out the same. The
`pitch-arsenal` group is a season group. JSON: `pitch-arsenal/{season}/{NN}.json`,
`pitch-command/{season}/{NN}.json` and `pitch-arsenal-pool/{season}/{mlb,aaa}.json`,
a `seasons.json` in each folder, and `pitch-arsenal-pool/all/{mlb,aaa}.json`. The
pool carries `avgVelo`, a ratio, so `all/` is not built from the season pools:
`exportPitchArsenal(db, hands, null)` folds every season's rows through the same
sums (`velocity_sum` / `velocity_n`), and the pool is cut from that. The
throwing hands come from the season being written, not the clock year.
`century-club.mjs` and `arsenal-side.mjs` (the callouts' readers of the same
table) read the newest season only, so they never add two seasons together.

**In short.** On Opening Day 2027 none of the four stores adds a 2027 game onto
2026. A store's first 2027 game opens a 2027 folder, its index moves `current`
to 2027, and every 2026 file stays as it is. Until then, a run with no 2027
game writes nothing. What this does not do: the app still reads only `current`
(#1201 adds `all/` and a season picker, #1202), no season before 2026 is on
file, and 35 other generators still take the season from the calendar year
(row U12 in `docs/duplicate-derivations.md`, #1201).
