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

## Seasons (scope #2, Gary 2026-11-13)

The store holds Savant seasons from 2015 (built by hand, one season per dispatch of
`research-store.yml`). `filters.js` `seasonsFor` decides what a query reads:

- A **Seasons** card (`yr=2015-2019`) reads its range.
- With no range, **Last time** searches every season, newest first, with a progress line
  and a Stop. A season whose `index.json` result counts (`events` per month) hold none of
  a picked result is skipped without a fetch. Each searched season is freed once read.
- With no range, **How often**, **Who most** and **What happens** read the latest season,
  so a rate or a leader board is one season's.

A decoded plate appearance is compact: the last pitch's type and `plate_x`, a 12-bit mask
of the counts it passed through, and its pitch count (`shard.js`). No pitch list.

**Pitch-clock rows.** From 2023 a pitch-clock violation is a row with no `plate_x` and no
pitch type. The shard drops it unless it ends the plate appearance, so a PA that ends on
one has a null last pitch type and location, and matches no pitch-type or location chip.

## Postseason detail (#3141, Gary 2026-11-16)

**Series game card** (`sg`): Game 1 to 7, Series-deciding, Sudden death, Potential clinch,
Potential elimination. The shards hold no series facts. Only when a query has a Series game
chip, `store.js` `attachSeries` fetches each searched season's postseason schedule from
statsapi (`gameType=F,D,L,W`, about 10 KB) and `series.js` joins it by gamePk: one listing
per game (`postseason/fetch.js` `keptGames`; a postponed game is listed twice, 2020), games
with a winner, in `seriesGameNumber` order, a series won at more than half of
`gamesInSeries`. An inverted chip still reads only postseason series games.
Clinch and elimination read from the **batting** club: a Game 6 at 3-2 is a potential
clinch in the leader's at-bats and a potential elimination in the other club's.
Series-deciding is the game the series ended in; sudden death is both clubs one win away
(a one-game wild card counts). A failed fetch is an error on the answer; the next ask retries.

**All-Star games**: the generator asks Savant for game type `A` too (clubs `AL`/`NL`), and
the Game type card has an All-Star chip. An All-Star PA counts only when that card picks
All-Star, so a default count or leader board stays official games, and `AL`/`NL` stay out of
the club pickers.
A July shard built before 2026-11-16 holds no All-Star game until it is rebuilt.
