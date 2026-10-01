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
`openDb()` loads them all. A later run that changes a frozen season's rows
fails, so a change is never dropped in silence: delete the frozen file on
purpose to freeze it again. No frozen file exists until a newer season has
rows. `test/season-store.test.js` pins this.

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
