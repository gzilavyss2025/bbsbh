# The /research store (#2234)

The `/research` page answers questions about past plays: when did this last happen, how
often, who does it most, what happens when. The first slice covers the 2026 MLB season,
regular season and postseason, from Baseball Savant's pitch-level CSV.

## Where it lives

Vercel Blob, outside git (Gary, 2026-11-02), public, under `research/v1/`:

- `index.json`: `{ v, built, seasons: { 2026: { months: { '06': { through, pitches, pas } } } } }`
- `{season}/{MM}.json`: one month, pitch rows in column arrays. The layout is in
  `src/api/research/shard.js`, the one file the writer and the reader share.

`scripts/research/gen-research-store.mjs` builds and uploads it (needs the
`BLOB_READ_WRITE_TOKEN` repo secret). Two workflows run it:

- **Nightly** (`update-nightly-data.yml`, step "Research store", gated on an MLB game going
  Final): `--recent` rebuilds the month or two that the last 3 days fall in, WHOLE. A shard
  holds only the days a run fetched, so a 3-day fetch would shrink a month to 3 days. About
  31 Savant requests a night, 62 on the 1st to 3rd (estimate). After the index upload it
  writes `public/data/research-store.json` (`generatedAt`, `through`), the stamp
  `check-data-freshness.mjs` reads. The page does not read the stamp.
- **By hand** (`research-store.yml`, dispatch): any months, for a backfill or a rebuild.

**A month only grows.** A rebuilt month with fewer pitches than the index has for it is not
uploaded and the run exits 1 (Savant can answer a late or broken day with a 200 and fewer
rows). The trailing window refills it the next night; `--force` (the `force` box on the
manual workflow) overrides.

**Known gaps.** The nightly gate closes about two nights after the season's last Final, so
rows Savant posts later than that need one hand run. The index is read back with a query
that should miss the one-hour CDN cache (not yet confirmed on a run). The manual workflow has
a concurrency group; it does not share one with the nightly job, which runs at 08:17 UTC. The reader is `src/api/research/store.js`. In dev, point `VITE_RESEARCH_STORE`
at a local copy:

```bash
node scripts/research/gen-research-store.mjs --season=2026 --months=06 --out=.scratch/research-store
npx http-server .scratch/research-store -p 5180 --cors
VITE_RESEARCH_STORE=http://localhost:5180/ npm run dev
```

## Spoilers

`/research` is an open page (ADR-0034). The store holds only games dated before the day
it was built (the generator reads days before today, US Pacific). `?d=` holds out that
day and later. No SealBox.

## Definitions (Gary, 2026-11-02, decision 7)

- **Inner third**: the third of the 17-inch plate width nearest the batter, from
  `plate_x` (catcher's view, positive toward first base), flipped by `stand`. A pitch off
  the plate is in no third.
- **Opp field**: a spray angle more than 15° from center toward the batter's opposite
  side, from `hc_x`/`hc_y` in Savant's frame (home plate at 125.42, 198.27). Pull is the
  mirror; center is within 15°.
- **Pitch type and location** read the last pitch of the plate appearance. **Count**
  matches a plate appearance that passed through that count on any pitch.

## Coverage

A filter card names the first season it can answer (`since` in `filters.js`): pitch type,
location and batted-ball location from 2008. The coverage line under the bar lists any
card the store's seasons cannot answer. With 2026 only, every card works.
