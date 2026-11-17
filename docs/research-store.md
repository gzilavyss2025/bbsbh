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

## More cards (#3140, Gary 2026-11-16)

- **Score**: the batting club's margin when the PA began: Tied, Ahead, Behind, Up or Down
  1, 2, 3+.
- **Moment**: from the margin before and after the PA's last pitch. Go-ahead (tied or
  behind to ahead), walk-off (a go-ahead in the bottom of the 9th or later), tying, and the
  game's first or last PA. A run with no PA (a wild-pitch walk-off) is not found.
- **Count** groups: Batter ahead (1-0, 2-0, 3-0, 2-1, 3-1), Even (0-0, 1-1, 2-2), Batter
  behind (0-1, 0-2, 1-2), read off the last pitch's count. A full count is in none.
- **Batted ball type** (Savant `bb_type`), **Batting slot** (1–9), **Month**, **Home or road**
  (the batting club).

**Store v2.** Moment, batted-ball type and batting slot need columns added in shard v2:
`rs` (runs on the pitch, `post_bat_score - bat_score`), `bb`, and `order`, each game's
lineup from its MLB box score (`battingOrder`, so a pinch hitter has the slot they batted
in). A rebuilt month keeps the lineups of the shard on file and fetches only new games'
box scores. The index records each month's `v`; a card with `v: 2` is blocked, and named
"not built yet" in the coverage line, while any searched month is older.

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

## Win probability (#3141, Gary 2026-11-16/17)

**Side file per month**: `research/v1/{season}/{MM}.wp.json`, written with each shard by
`gen-research-store.mjs` (`winprob.js` `encodeWinProb`): per decoded PA, summed Savant
`delta_home_win_exp` (x1000, home view) and `delta_run_exp` (x100, batting view). About 11%
of a shard gzipped (measured on 2025-06-15: 4.5 KB vs 39.4 KB). The index marks such a month
`wp: 1`. The main shards did not change and were not rebuilt; a month built before this has
no side file until a backfill (`research-store.yml`) rebuilds it, and until then the
Leverage card and the Win prob toggle are blocked for its season ("not built yet").

**Loaded only when asked**: the **Win prob** toggle (`wp=1`) or a **Leverage** chip (`lev`).
Then `store.js` `attachWinProbSeason` sets `wpa` (batting club's view), `re24` and `li` on
each PA. The rows show them; the summary line adds summed WPA and RE24 and the mean LI.

**Leverage Index**: Savant has none. `scripts/research/gen-leverage.mjs` (hand-run) builds
`public/data/leverage-index.json` from the 2024-2025 regular seasons, Tango's method: a
state's mean |WPA| over the league's mean |WPA|. State: inning (9 = 9th or later), half,
outs, runners, batting margin clamped to ±4, at the PA's start; a state with fewer than 30
PAs falls back to inning + half + margin. Buckets: Low < 0.85, Medium, High > 2.0.

## History store, 1961-2014 (#3135)

A second store, `retro/v1/` in the same Blob, holds the 1961-2014 regular seasons from
Retrosheet play-by-play: one row per plate appearance, no pitch rows. The page does not
read it yet; a follow-up wires it into `/research`. Decisions: #3135 and its comments
(Gary, 2026-10-21 and 2026-11-16). Measurements: `.scratch/research-retrosheet-pa/findings.md`.

| Path | What |
|---|---|
| `manifest.json` | credit lines; per season: games, PAs, `pitchString` and `knownCount` (% of PAs), per month `{ pas, through }`, and `unbridged` (Retrosheet ids with no MLBAM id; their rows hold a null id) when any. Month keys are not in order in the JSON; sort them. |
| `pa/{season}/{MM}.json` | the 18 columns below, as column arrays (371 files) |
| `pitches/{season}/{MM}.json` | `pseq`: Retrosheet's raw pitch string per row, same order as `pa/` (371 files) |
| `games/{season}.json` | gamePk, date, home and away club ids, Retrosheet park code, venue id, game number, night, DH, pitch info (0 none, 1 count, 2 pitches), final score |
| `by-park/{code}.json` | every season's rows at one park, the `pa/` columns plus `pseq` (73 files) |
| `parks.json` | park code → the venue id it holds most games at, its name, first and last season |
| `people.json` | MLBAM id → name, from the Chadwick register |

The columns, their meaning and the row order are in `scripts/lib/research/retro.mjs` (the
one place the layout is written). Two points a reader needs:

- **Count.** `balls` and `strikes` are the count before the PA's last pitch, and `null`
  when Retrosheet does not know it. They do not say the PA passed through a count; that
  needs the pitch string.
- **Coverage.** Pitch strings and counts are near-complete from 1988 (90% to 100% a
  season) and scattered before (0% to 16%; 1961 is 12.5%). `manifest.json` has each
  season's share. Pitch type, location and batted-ball location do not exist before
  2015 here; Gary's rule (2026-11-16) blocks those chips for any range that starts
  before 2015.

**Build.** `scripts/research/gen-retro-store.mjs`, run only by the dispatch workflow
`.github/workflows/retro-store.yml`. It first runs `scripts/research/retro-header-test.mjs`
(one throwaway 1 MB file: compression and CORS required, Range reported), then downloads
the inputs, builds `cwevent`, builds all 54 seasons, and uploads only when every
Retrosheet game joined a gamePk and every `cwevent` row matched its raw play line.
Each upload retries; `manifest.json` uploads last. An upload that still fails part way
leaves new and old files under the old manifest, so rerun the workflow. Files carry a
one-hour cache, as `research/v1/` does. Local test (no upload), with the inputs extracted outside
the repo as in `.scratch/research-retrosheet-pa/findings.md`, "Reproduce":

```bash
node scripts/research/gen-retro-store.mjs --events=$DL/ev --register=$DL/chad \
  --cwevent=$DL/cw/bin/cwevent --seasons=1961,1988,2014 --out=$DL/out
```

Measured on that run (2026-11-16): 1961 109,571 PAs, 1988 159,380, 2014 183,929, the
research's counts; every game joined; no unbridged person.
