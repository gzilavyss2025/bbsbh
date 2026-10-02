# The hitter grid keys on pitcher hand and stance, and waits for xwOBA

**Status:** Accepted
**Date:** 2026-10-02
**Issue:** #1411 Part B (parent #1408)

## Context

The Matchup Scout (#1408) draws a hitter map beside the pitcher map. The hitter
map shows, per pitch type and per region, the hitter's xwOBA (est.), whiff % or
swing %. A hand control picks the pitcher's hand: All, vs R or vs L. A scope
control picks Regular, Postseason or All. The colour scale compares each region
with the league in the same region and pitch type (`docs/scout-design.md`, B).

The store had no hitter data. `gen-pitch-arsenal.mjs` already walks every pitch
of every swept feed for the pitcher's mix (`pitch_arsenal_totals`) and the
pitcher's locations (`pitch_command_cells`). Every 2026 game is already in both
of their ledgers.

The feed has no xwOBA value for a ball in play. Two routes can supply one: a
per-season lookup on exit velocity and launch angle, or a nightly Savant pull
that joins on the pitch (#1411, the Part C spike). The owner has not picked one.

## Decision

1. **One more half of the same sweep.** `scripts/lib/pitch/hitter-grid.mjs`
   counts the pitches of a feed that the generator already holds. It costs no
   fetch for a new game.
2. **The key.** `pitch_hitter_cells` keys on
   `(season, scope, person_id, level, code, p_throws, stand)`. `person_id` is
   the hitter. `p_throws` is the pitcher's hand, for the hand control. `stand`
   is the side the hitter took, read from the matchup, so a switch hitter
   counts on the side he took.
   - **Why `stand` too.** A cell is in the feed frame: column 0 is the
     third-base side. That side is inside for a right-handed hitter and away for
     a left-handed one. So the league rate for a region is only a fair
     comparison for one stance. The key also lets a map draw the stance of its
     own data (Gary, item 8). It costs little: a switch hitter seldom bats on
     the same side as the pitcher's hand (see Consequences).
   - **Why `scope`.** The same rule as ADR-0094: `'R'` or `'P'`, and All is
     the sum of the two.
3. **The counters.** Each is a 25-value CSV over the 5x5 command grid, a sum:
   `pitches`, `swings`, `whiffs`, `pa_end` and `woba_fixed`.
   - Swings and whiffs use the shared code sets (`WHIFF_CODES`, `FOUL_CODES` in
     `src/api/playbyplay/`), the same as the pitcher grid. A foul tip is a
     swing, not a whiff.
   - `pa_end` counts the pitches that an xwOBA mean counts. A PA ends on the
     last event of a play whose eventType is on the plate-appearance allow
     list (`isPlateAppearance` in `scripts/lib/long-at-bats.mjs`). A PA that
     ended on a call with no pitch has no PA-ending pitch. A sac bunt and a
     ball in play with no exit velocity or launch angle are not counted, as
     Savant's board does not count them. An intentional walk is not counted:
     wOBA gives it no denominator.
   - `woba_fixed` is the part of the wOBA sum that needs no estimate: 0.7 for
     a walk, a hit-by-pitch or catcher interference, and 0 for a strikeout or
     another out (Savant's `woba_value`).
4. **xwOBA waits.** `xwoba_bip` holds the estimate summed over balls in play.
   It stays NULL, and the export does not write it. The reader gives
   `wobaSum: null`: `woba_fixed` alone would read as a low xwOBA. The route
   that fills `xwoba_bip` is the owner's decision.
5. **Its own ledger.** `pitch_hitter_ingested_games`, for the reason
   `pitch_command_ingested_games` gives. A game owes each half (`arsenal`,
   `command`, `hitter`) to its own ledger, and `ingestGame` builds only the
   halves that the game owes. So a re-walk for the hitter grid never adds a
   pitch type or a command cell a second time.
6. **MLB only.** The Scout's v1 is MLB only. The sweep asks the hitter half of
   an MLB game only. A Triple-A phase turns it on for `aaa` and re-walks.
7. **The files.** A season store (ADR-0086), `hitter-grid/{season}/`:
   - `{NN}.json`, bucketed on `personId % 100`: `{ season, bat, post }`. `bat`
     is the regular season and `post` the postseason, the ADR-0094 pattern.
     An entry is `{ mlb: { [code]: { [p_throws]: { [stand]: counters } } } }`.
     An all-zero counter is left out.
   - `league.json`: `{ season, bat, post }`, each one entry of the same shape,
     summed from the same rows at export time. It is not a separate sweep.
8. **The reader.** `src/api/scout/hitterGrid.js` (spoiler-free, ADR-0034):
   `fetchHitterGridFor`, `fetchHitterLeague`, `hitterCounters` and
   `flatRates`. One season per read, never two (the 2026 zone is not the 2025
   zone).
9. **No stamp.** `hitter-grid/` is a sharded season store, like
   `pitch-command/`. A stamp would go stale every winter, when no game is
   played. So `UNSTAMPED_BUDGET` in `check-data-freshness.mjs` goes from 22
   to 23, as `scripts/CLAUDE.md` says for such a store.
10. **No partial season.** `writeHitterGrid` writes nothing while an MLB game
    of the season is in the arsenal ledger and not in the hitter ledger. So
    the nightly cannot publish three days of hitter cells as the season before
    the re-walk runs.

## Consequences

- **Measured on a copy of the 2026 store** (both levels swept, 2026-03-20 to
  2026-10-01: the regular season and the first 9 postseason games):
  - 12,263 regular-season rows (662 hitters) and 733 postseason rows (96
    hitters). 16 (hitter, pitch type, pitcher hand, scope) groups hold two
    stances, so `stand` in the key costs 16 rows.
  - 100 buckets plus `league.json`, 3.4 MB in all. The largest bucket is
    79,573 bytes (11,490 gzipped). `league.json` is 35,951 bytes.
    `test/bucket-shards.test.js` sets a 100 KB ceiling. With Triple-A hitters
    in the same buckets, the largest was 127,787 bytes; that is one more
    reason for MLB only.
  - `scripts/data/pitch-arsenal.sql` grows from 19,184,839 to 25,997,417
    bytes (15,435 more lines: 12,996 cells and 2,439 ledger rows). That is
    below GitHub's 50 MB warning.
  - The re-walk fetched 2,431 feeds in 85 seconds. A second run found 0 games
    and left the dump the same, byte for byte.
  - Aaron Judge (592450): 1,217 regular-season pitches in the grid, and
    statsapi's `numberOfPitches` is 1,217. 280 PA-ending pitches against 285
    plate appearances: his 5 intentional walks had no pitch.
- The re-walk of the 2,430 MLB games already on file added no row to
  `pitch_arsenal_totals` or `pitch_command_cells`. The one change came from a
  Triple-A game that the nightly had not swept (gamePk 816317), and it equals
  that game's own rows.
- **Checked against Savant**, 7 games (6 regular season on 2026-06-14, 1 on
  2026-09-29), per hitter: pitches, swings and PA-ending pitches are equal.
  Whiffs are lower by the foul tips, which Savant counts as whiffs: 252 against
  274 (8%). The page's whiff % runs that much under Savant's.
- The committed dump does not change in this ADR's PR: the new tables are
  empty, and a dump writes no line for an empty table. The first re-walk adds
  them to `scripts/data/pitch-arsenal.sql`.
- The first 2026 re-walk is by hand:
  `node scripts/gen-pitch-arsenal.mjs --since=2026-03-20`, both levels.
  `--sports=1` would drop a Triple-A-only pitcher's hand from the arsenal
  export.
- When the owner picks an xwOBA route, the filled column needs one more
  re-walk: the cells keep no per-ball record. Clear the season's hitter rows
  and ledger, then re-walk.
