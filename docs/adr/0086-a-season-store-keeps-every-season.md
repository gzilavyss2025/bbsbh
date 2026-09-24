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
