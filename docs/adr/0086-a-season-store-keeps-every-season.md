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

## Addendum (#1201): one season parameter

Every reader of the six stores above now takes `{ seasonYear }`: a year, `'all'`,
or nothing. `seasonFolderOf(store, seasonYear)` in `src/api/staticJson.js` is the
one rule. Nothing means `current`. A year that is not in `seasons` also means
`current`: the stores sweep no spring training, so a new season's year is not on
file until Opening Day, and a spring game page shows last season, as it did
before. `'all'` is the `all/` folder. (`hitter-grid/` is a later store and keeps
its own positional `season`.)

- **League files** (the foul board, the umpire accuracy summary, the ABS files, the
  arsenal pools) read their `all/` copy for `'all'`. An `all/` file that is not on
  disk yet gives the reader's fallback.
- **One player's shard** has no `all/` copy. `readSeasonShard` reads his slice from
  each season on file, and `src/lib/seasons/combine.js` adds them: counts add, a
  high keeps its game, a mean is weighted by its count, names come from the latest
  season. The shard keeps `avgVelo`, not the velocity sums, so the arsenal's
  combined mean is exact only to the file's 0.1 mph rounding. A foul pitcher row
  now carries `gs` (starts), so a combined `isStarter` uses the `all/` file's own
  rule (summed starts against summed games). A row from before `gs` falls back to
  a vote of the seasons, weighted by games. The command grid
  takes a year only; no surface draws a combined grid.
- **The name is `seasonYear`**, because `u.season` in `umpires.js` is an umpire's
  aggregate.
- **A game page reads the game's season** (`selectGameSeason(feed)`): the
  opposing-starter arsenal, the pitcher card, and every umpire surface on a lineup,
  box score, preview or innings page. An old 2026 game still reads 2026 after 2027
  starts. A spring 2027 game reads 2026 until 2027 is on file.
- The URL and the picker are #1202 (the next addendum). The umpire modal's "Full
  umpire page" link now opens the game's season.

## Addendum (#1202): the season views

Gary's answers to the four #1199 questions (2026-10-05): all surfaces in one PR;
"all" is 2026 onward, except umpire assignments, which go back to 2023; compare is
a change column with a side-by-side toggle on a board, and the two seasons stacked
on one person's card; the winter default is the last complete season, which is
`current` in `seasons.json`.

- **The address.** A season view takes one more path segment, a year or `all`,
  and a compare season as `?vs={year}`: `/fouls/2026`, `/fouls/all`,
  `/fouls/2027?vs=2026`. The five views are `/fouls`, `/umpires`,
  `/abs-challenges`, `/umpire/{name-id}` and `/player/{name-id}/analytics`.
  `src/lib/seasons/route.js` parses and builds them. A malformed year is dropped,
  so the page shows the current season. A well-formed year that is not on file
  is also the current season: `src/lib/seasons/view.js`'s `resolveSeasonView`
  uses the same rule as `seasonFolderOf`.
- **The picker** is `components/season/SeasonPicker.jsx`: Pill controls (a pill
  control filters the content under it, #1131). It shows only when a store has
  more than one season. The "all" choice is labelled with its years
  ("All 2026–2027"), never only "All".
- **Compare.** A board adds one column beside its main figure:
  `boardCompare` words a change with what it compares ("+3.1% vs 2026"), or prints
  the other season's figure in side-by-side mode. A row with no row in the vs
  season gets a dash, never a zero. A person's card stacks the two seasons
  (`components/season/SeasonStack.jsx`), each with the card's own empty line.
- **The player's Analytics tab** moves four cards: Foul balls, Pitches, Spray map
  and Pitches like. Every other card on the tab is the current season. The current
  season's Pitches card stays statsapi's mix; another season reads the
  pitch-arsenal shard (`arsenalMixRows`, `loadArsenalSeason`). The tab reads the
  fouls index for the season list, because one nightly run writes all six stores.
- **The umpire backfill.** `umpires/2023` to `umpires/2025` were written once by
  hand (`node scripts/gen-umpires.mjs --season=YYYY`). The nightly run rebuilds
  only the current season. Accuracy starts in 2026, so `api/umpires.js`'s
  `beforeAccuracy` gives a season BEFORE the accuracy store's first season no
  accuracy at all. `seasonFolderOf`'s fallback to `current` is for a season AFTER
  the last on file (a spring game page), and it would put 2026 accuracy on a 2024
  page.
- **Not yet.** No surface writes `fouls/all/fouls.json` until the nightly run does;
  until then `/fouls/all` shows the board's normal empty state. Only 2026 is on
  file in five of the six stores, so their pickers stay hidden until 2027 data
  lands. `test/season-view.test.js` and `test/umpire-season-backfill.test.js` hold
  the two-season fixtures.
