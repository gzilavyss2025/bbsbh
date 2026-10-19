# Research page spike (#2311, for #2234)

Scratch scripts behind the numbers in the #2311 comment. No data is committed.
Run from this folder. `pull.mjs` writes `raw/`, `load.mjs` writes `spike.duckdb`,
`build.mjs` writes `out/`. Delete all three after a run.

- `pull.mjs`: 30 daily Savant CSVs (June 2026).
- `load.mjs`: CSVs to DuckDB. Builds the `pitch` and `pa` tables.
- `build.mjs`: writes the PA, pitch and pitch-only grains as 100 shards and measures gzip.
- `query.mjs`, `duck.mjs`: the example query in JS and in DuckDB. `query.mjs` holds the Opp Field and Inner Third cut-offs.
- `season.mjs`: applies the cut-offs to a full-season Savant pull.
- `retro.mjs`: Retrosheet 2023 join. Needs the event zip, the game log and the Chadwick register downloaded OUTSIDE the repo; edit `S` to point at them.
- `oldyears.mjs`: batter-id bridge for 1955, 1975, 1995.
- `startyear.mjs`: Savant column fill by year.
