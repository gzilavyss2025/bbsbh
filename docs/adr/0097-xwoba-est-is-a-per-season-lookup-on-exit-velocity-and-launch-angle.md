# xwOBA (est.) is a per-season lookup on exit velocity and launch angle

**Status:** Accepted
**Date:** 2026-10-02
**Issue:** #1411 Part C (parent #1408)

## Context

The Matchup Scout's hitter map shows xwOBA (est.) per region (ADR-0096). The
feed has exit velocity and launch angle for each ball in play, but no xwOBA.
Savant has an estimate per ball (`estimated_woba_using_speedangle`). The
hitter grid kept `pitch_hitter_cells.xwoba_bip` NULL until the owner chose a
route: a lookup table, or a nightly Savant join on each pitch. Gary chose the
lookup (route 1).

The Part C spike measured the lookup against Savant's pitch-arsenal-stats
batter board:

- A table built from the same season passes. A table built from 2025 fails on
  2026: Savant's estimate for the same exit velocity and launch angle moved
  between the seasons, most for hard-hit balls.
- The best estimator is a nearest-neighbour box on a 1 mph x 1 degree lattice,
  with 3 balls. About 82 KB of JSON, 22 KB gzipped.
- Sprint speed explains part of the error on ground balls.

## Decision

1. **One table per season, never pooled.** `gen-xwoba-table.mjs` writes
   `public/data/xwoba-table/{season}.json`: a 126 x 181 lattice (0 to 125 mph,
   -90 to 90 degrees) in thousandths. Each cell is the mean of Savant's
   estimate over the smallest box around the cell that holds 3 balls. The
   estimator and the lookup are in `scripts/lib/pitch/xwoba.mjs`.
2. **The source.** Savant's search CSV, balls in play only (`hfPR`), regular
   season and postseason, one request for each day that has a Final MLB game.
   Each day is cached outside the repo, so a re-run resumes. Three days in a
   row that fail stop the run, and no table is written.
3. **Hand-run, like `gen-run-expectancy.mjs`.** A table from the earlier
   months of a season holds on the next month. Build the first table about 30
   days into a season, and build it again when the season ends. The page does
   not read the table, so it is not precached.
4. **The sweep fills `xwoba_bip`.** Each tracked ball in play that ends a PA
   adds the table's value for its exit velocity and launch angle to its cell.
   The table is the one of the game's own season. A ball in play with no exit
   velocity or launch angle adds nothing. It goes into a new counter,
   `bip_untracked`, so the page can say how many balls were not tracked.
5. **No table is unknown, not 0.** A game swept with no table writes NULL.
   NULL stays NULL when more games fold in. The export writes `xwobaBip` and
   `xwoba: true` (in every bucket and in `league.json`) only when every hitter
   row of the season has a value. Otherwise the reader keeps `wobaSum` null,
   and the page keeps xwOBA off.
6. **A re-walk after each new table.**
   `gen-pitch-arsenal.mjs --clear-hitters=<season> --since=<first day>`
   deletes the season's hitter rows and ledger, and the sweep then walks the
   season again (about 75 s for 2026).
7. **The reader.** `hitterCounters` gives `wobaSum` = `wobaFixed` +
   `xwobaBip`, cell by cell, when the grid has `xwoba: true`. It also gives
   `bipUntracked`. No export changes its name or shape.
8. **The gate.** `gen-xwoba-table.mjs --gate` compares the committed
   hitter-grid files with the board, through the page's reader. It uses board
   rows of 40 or more PA, and it folds KC and CS into CU, as the board does.
   It passes when all three are true: the mean gap is at most 0.006, at most 1%
   of rows are above 0.020, and no row is above 0.040. A failure is the
   owner's decision. Do not change the tolerance to make it pass.

## Consequences

- **Measured on 2026-10-02** (2026-03-20 to 2026-10-01, 187 days, no day
  failed): 123,813 balls in play, the same count as the spike. The table is
  83,068 bytes, 22,518 gzipped.
- **The gate on a copy, after the re-walk:** 1,631 rows, 0 with no value, mean
  gap 0.0036, 7 rows above 0.020 (0.43%), largest gap 0.0327. It passes. The
  lookup alone, scored on Savant's own PAs as the spike did: mean gap 0.0033,
  1 row above 0.020, largest 0.0286.
- The league's regular-season xwOBA (est.) is .314 over 181,958 PA-ending
  pitches. 494 balls in play were not tracked.
- The largest hitter-grid bucket grows from 79,573 to 100,703 bytes (20,717 of
  them for `xwobaBip`). That is 1.7 KB under the 100 KB ceiling in
  `test/bucket-shards.test.js`. The ceiling does not change here; the rest of
  the postseason may need a higher one, and that is the owner's decision.
- `scripts/data/pitch-arsenal.sql` grows to 27,722,987 bytes after the
  re-walk (25,997,417 without the estimate, ADR-0096). The committed dump does
  not change in this ADR's PR: it holds no hitter row yet.
- The table rounds a speed of x.5 mph up. The spike's Python rounded it to
  even, so 24% of the cells differ from the spike's table (mean 0.001). The
  gate numbers above are for this table.
- A cell sums the estimates of the table on file when its game was swept. A
  new table changes only the games swept after it, until the next re-walk.
- **Follow-up: sprint speed.** A sprint-speed term for ground balls nearly
  halves the board-level error in the spike (0.0035 to 0.0019). It needs one
  more Savant request (the sprint-speed board). It is not in this decision.
- Triple-A has no table. The hitter grid is MLB only (ADR-0096).
