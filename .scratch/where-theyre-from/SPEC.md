# Where they're from — build spec (issue #1526)

This is the build contract for the "Where they're from" pages. It was written on
2026-10-20 from the design canvas, the decisions Gary made in that session, a live
sweep of the MLB Stats API, and a scan of the repo's conventions. A build session
works from this file. **Where this file and the design canvas disagree, this file
wins** (§13 lists every known difference).

Every number marked *measured* was measured on 2026-10-20 with the scripts in
`prototype/`. Every claim marked *unverified* was not checked; check it before you
depend on it.

---

## 0. How to use this package

- Build it as **four stacked PRs in one unattended session** (§12, §12.1). A Sonnet
  session at high effort can build it from this spec.
- Read these first: this file, then `design/` (the canvas artboards, for look only),
  then the repo files named in §9–§11.
- The scripts in `prototype/` work. They are drafts for the real generators, not
  code to copy as is: the sweep uses the shared `getJson`, but none of them uses
  `writeJsonAtomic`, `mapConcurrent`, `fetchSeasonInPlay` or `scripts/lib/`
  helpers, which the real ones must (§6.1).
- Ask Gary only about things this file does not decide. In an unattended session,
  write `[DECISION: …]` lines in the PR body instead (root `CLAUDE.md`).

## 1. What it is

One page family. Pick a college, a high school, or a hometown (a birthplace), and see
every big leaguer from there, grouped by the decade of his MLB debut.

- The picker has a US map. A tap on a state zooms the map in on it and shows that
  state's **zones** (metro areas plus the rest of the state).
- Players born outside the US are in an "Outside the US" country list.
- It is a standalone page outside the scoring flow, so it **opens live**. No
  `SealBox`, no reveal-only module (root `CLAUDE.md`, "The spoiler rule"; ADR-0034).
  A school or a birthplace says nothing about a game.

**Out of scope for v1** (do not build): minor-league-only players; a world map; a
link-preview card (`api/preview.js`); "raised in" text on player pages; editing data
in the app; per-state hand-curated zones.

## 2. Decisions log (all by Gary, 2026-10-20)

| # | Decision | Notes |
|---|---|---|
| D1 | Name: **"Where they're from"** | Not "college wall". "Alumni" is taken by the MiLB alumni list. |
| D2 | Routes under **`/from`** | §4. |
| D3 | **One full sweep first, then a light nightly check:** new players, plus a rolling re-check of 1/30 of all stored players | About 5–6 requests a night. No weekly job: the repo folded its weekly crons into the nightly job on 2026-08-28 and bans calendar gates (`.github/workflows/update-nightly-data.yml:42-46`). |
| D4 | **Zones = Census metro areas + the rest of the state by compass direction** | One rule for all states. §7.2 gives the exact rule. |
| D5 | **Hometown = birthplace** (`birthCity`, `birthStateProvince`, `birthCountry`) | |
| D6 | **Outside the US = a country list** under the map | Routes `/from/country/...`. Puerto Rico is in this list. |
| D7 | **College location = the IPEDS directory + a hand-kept overrides file** | §7.1. |
| D8 | Design: the Tally Baseball system, the US map, state zoom with zones, a desktop layout, locator maps on place pages | The canvas. |

## 3. Words and copy

Write copy in sentence case; CSS sets the capitals (`src/CLAUDE.md`, the ALL-CAPS
invariant). Never call `.toUpperCase()` on rendered text (`check-name-casing`).

| Thing | Copy |
|---|---|
| Page heading (every `/from` page) | `Where they're from` (curly apostrophe: `Where they’re from`) |
| Document title | `useDocumentTitle('Where they’re from')`; on a place page `useDocumentTitle(`${place} · Where they’re from`)` |
| Picker intro, college/high school | `Pick a school. See every big leaguer who played there.` |
| Picker intro, hometown | `Pick a town. See every big leaguer born there.` |
| Place page intro, school | `Every big leaguer who played at one school, by the decade of the MLB debut.` |
| Place page intro, hometown | `Every big leaguer born in one town, by the decade of the MLB debut.` |
| List toggle | `College` · `High school` · `Hometown` |
| Search label / placeholder | `Find a school` / `Vanderbilt`; hometown: `Find a town` / `Donora` |
| State select label | `State`; first option `All states` |
| Map card name tab | `By state`; zoomed: the state name |
| Zoom-out button | `Back to all states` |
| Legend | `Has a school` (hometown: `Has a hometown`) · `Picked` |
| Zone chips | `All {State}` then each zone name, each with a count |
| List card name tab | `Colleges` / `High schools` / `Hometowns`, then ` · {State or zone}` when one is picked |
| List count tag | `{n} schools` / `{n} school` / `{n} towns` / `{n} town` |
| Country card | Name tab `Outside the US`; rows `{Country}` with a count |
| Unplaced colleges note | `{n} colleges are not on the map yet. Search finds them.` |
| Empty list, a name search | `No school by that name has a big leaguer yet.` / `No town by that name has a big leaguer yet.` |
| Empty list, a state | `No college in {State} has a big leaguer yet.` (and `high school`); hometown: `No big leaguer born in {State} yet.` |
| Place hero subtitle | school: `{City, State} · College` (`High school`); city may be missing, then just `{State} · College`; hometown: `{City}, {State} · Birthplace`; abroad: `{City}, {Country} · Birthplace` |
| Change link | `Change school` / `Change town` |
| Footnote, school | `Schools as the MLB Stats API lists them. A player who did not reach the majors is not listed.` |
| Footnote, hometown | `Birthplaces as the MLB Stats API lists them. A player who did not reach the majors is not listed.` |
| Credit line | IPEDS / Census / GeoNames credit lines from `scripts/lib/open-data/credits.mjs` (§14) |

House rules: no emoji, no exclamation marks, numbers are plain (`103-59`, `.636`),
ranks read `78 of 89`, never `#78`; say "postseason", never the banned word
(`check-word-choice`).

## 4. Routes

| Path | `parseRoute` result |
|---|---|
| `/from` | `{ name: 'from', list: 'college', state: null, zone: null }` |
| `/from?list=hometown` | `list` from `?list=` (`college` \| `high-school` \| `hometown`; anything else → `college`) |
| `/from/{st}` | `{ name: 'from', state: 'GA', list, zone }`; `{st}` is a 2-letter code, lowercase in the URL, uppercase in the result; unknown code → bare `/from` |
| `/from/{st}?zone=ga-atlanta&list=hometown` | `zone` is a zone id (§7.2); an unknown zone → `null` (the page shows the whole state) |
| `/from/college/{slug}` | `{ name: 'from-place', kind: 'college', slug }` |
| `/from/high-school/{slug}` | `{ name: 'from-place', kind: 'high-school', slug }` |
| `/from/{st}/{city}` | `{ name: 'from-place', kind: 'hometown', state: 'PA', city: 'donora' }` |
| `/from/country/{country}` | `{ name: 'from-country', country: 'dominican-republic' }` |
| `/from/country/{country}/{city}` | `{ name: 'from-place', kind: 'abroad', country, city }` |

- `college`, `high-school` and `country` are words; states are two letters, so the
  two never clash. `?zone=` and `?list=` set the page's **opening state**, like
  `/standings` (`src/lib/route.js` header, lines 53–56). The page writes its picks
  back into the address with `replace` so a shared link opens the same view (the
  Scout pattern, `src/lib/scout/path.js`).
- **Where the code goes.** `src/lib/route.js` has about 20 lines left under its
  1000-line cap (`scripts/check-file-size.mjs:121`), so put the parse in
  `src/lib/from/route.js` as `parseFromRoute(parts, q)` (returns `null` unless
  `parts[0] === 'from'`) and the builders in `src/lib/from/path.js`
  (`fromPath({ list, state, zone })`, `fromPlacePath(place)`). Wire it the way
  Scout is wired: import at `route.js:129`, call next to `parseScoutRoute`
  (`route.js:531-532`) and **above the generic 3-segment game branch**
  (`route.js:618`). Add the route lines to the `parseRoute` header comment
  (lines 6–97); `src/CLAUDE.md` requires every route name there. `src/lib/` is at
  its flat-file budget, so the new folder is required (`check-dir-size`).
- Use `slugify` from `src/lib/route.js:228` for every slug, in the app and in the
  generators (`scripts/CLAUDE.md`: "imports it, never a second copy"). It caps at
  48 characters (1 college name reaches the cap; *measured*). A Node script can
  import it: `node -e "import('./src/lib/route.js')"` works, `slugify('Miami (FL)')`
  gives `miami-fl` (*measured*), and `scripts/gen-sitemap.mjs` already imports
  `route.js`.
- Builders write only non-default query values (`postseasonRecordsPath`,
  `src/lib/postseason/recordsRoute.js:48`).
- **App wiring:** `src/App.jsx` — a `lazyNamed` declaration and an `else if` branch
  per route name (the Scout branch is `App.jsx:404-417`). Give the component
  `key={route.name + (route.slug ?? route.state ?? '')}` so a new place remounts
  with fresh state (the `photos` precedent, `App.jsx:472`). `App.jsx` has 54 lines
  left under its 700 cap.
- **Registry:** add `{ label: 'Where they’re from', path: '/from' }` to the
  `history` group of `PAGE_GROUPS` in `src/lib/reportPages.js` (lines 43–181), and
  add `'/from'` to `PATHS_BEFORE_GROUPING` in `test/report-pages.test.js:28` in the
  same commit. Add `{ path: '/from', priority: '0.4', changefreq: 'weekly' }` to
  `scripts/gen-sitemap.mjs` (Scout's entry is line 104).
- **Tests:** `test/from-route.test.js` — one `test()` per row of the table above,
  the round trip `parseRoute(fromPath(x))` (as `test/scout-page.test.js:18`), an
  unknown state, an unknown `list`, an unknown zone, upper-case input
  (`/from/GA` → `GA`), and that `/from/ga/donora` does not fall through to the game
  branch.

## 5. Data facts (measured 2026-10-20)

### 5.1 The API

- `GET /api/v1/sports/1/players?season={y}` lists every MLB player of a season
  (1,512 for 2026). It **ignores** `hydrate=education` (0 of 943 for 1985).
- `GET /api/v1/people?personIds={ids}&hydrate=education` takes a batch. 200 ids in
  one request came back complete. Fixture: `fixtures/people-education-batch.json`.
  `scripts/gen-milb-alumni.mjs:156-174` uses batches of 100; either works.
- **All-time sweep: 23,619 players, 270 requests, 14 seconds** (151 season lists
  1876–2026, then 119 batches of 200). Stats: `data/sweep-stats-2026-10-20.json`.
- Useful fields, with `&fields=` slimming (see `prototype/sweep.mjs`):
  `id, fullName, mlbDebutDate, primaryPosition.abbreviation, birthCity,
  birthStateProvince, birthCountry, education.highschools[], education.colleges[]`.
- `education.highschools[]` and `education.colleges[]` are `{ name, city?, state? }`.
  **No school id exists.** Example (`fixtures/people-education-batch.json`):
  Sonny Gray → highschools `[{"name":"Smyrna","state":"TN"}]`, colleges
  `[{"name":"Vanderbilt"}]`.

### 5.2 Coverage

| Field | Count |
|---|---|
| Players | 23,619 |
| With `mlbDebutDate` | 23,239 (380 without; §6.4) |
| With any education | 13,534 |
| With a college | 9,170 (never more than one college a player) |
| With a high school | 10,371 (10,291 with a state, 6,718 with a city) |
| Distinct college names | 1,302 |
| College records with a state from the API | 291 of 9,170 (3%) |
| Distinct high schools (name, city, state) | 6,377 |
| Born in the USA | 19,709 (19,705 with a state, 19,642 with a city) |
| No `birthCountry` | 687 |
| Distinct US birth towns | 6,043 |
| Top countries after the USA | Dominican Republic 966, Venezuela 512, Cuba 403, Puerto Rico 314, Canada 278, Mexico 157, Japan 87, Panama 78 |
| `primaryPosition.abbreviation` values | P 10,189; X 2,291; C 1,982; 2B, LF, 3B, SS, 1B, RF, CF, OF, PH, DH, PR, TWP |

### 5.3 Data traps (each one measured)

- **Puerto Rico** comes back two ways: `birthCountry: "Puerto Rico"` (314) and
  `birthCountry: "USA", birthStateProvince: "PR"` (2). Treat both as the country
  Puerto Rico (D6).
- **State codes are not clean:** `Il` (lowercase), `VI` (Virgin Islands) on high
  schools, and `La Habana` as a US birth state once. Uppercase every code; a US
  record whose state is not one of the 50 + DC is not placed on the map (it still
  counts in totals).
- **`birthStateProvince: "-1"`** means unknown (`src/lib/person/birthplace.js:9`).
- **Position `X`** is unknown. Show `—`.
- **Spelling variants** merge by slug: colleges `Texas-San Antonio` /
  `Texas - San Antonio`, `Mississippi` / `MIssissippi`; towns `St.Louis` /
  `St. Louis`, `Havre De Grace` / `Havre de Grace` (14 town merges, ~10 college
  merges). Display the most common spelling.
- **High-school names repeat across states.** `Central` appears in 29 states,
  `Washington` in 13, `Lincoln` in 12. So the state is always in a high-school slug.
  Within one state, 223 (name, state) groups have more than one city
  (`Central` in Columbus, Toledo and Cleveland, OH) — see §6.3.
- **Brooklyn is not New York.** Towns stay as the API spells them; v1 does not merge
  boroughs or suburbs.

## 6. The data pipeline

### 6.1 Rules that apply (from the repo)

- statsapi only through `getJson(path)` from `scripts/lib/statsapi.mjs:158` — a
  path, not a URL; it owns retries (`check-statsapi-client` fails any other fetch).
  Concurrency: `mapConcurrent` from `scripts/lib/concurrency.mjs:16`, or a small
  pool like `gen-milb-alumni.mjs:121-132`.
- Writes: `writeJsonAtomic` / `readJsonOr` / `writeShards` from `scripts/lib/io.js`.
  `writeShards` deletes stale shards on a full rebuild.
- The season: `fetchSeasonInPlay()` from `scripts/lib/time/season-in-play.mjs:49`,
  never `getFullYear()`.
- Open datasets (IPEDS, Census, us-atlas) follow ADR-0100: the generator takes file
  paths as arguments and **never downloads**. Downloads go through
  `node scripts/lib/open-data/download.mjs <url> <empty-folder-outside-repo>`.
- A generator file is a top-level script; its testable logic goes in `scripts/lib/`
  and is imported (`scripts/CLAUDE.md:85-88`). `scripts/lib/` is at its budget, so
  put the helpers in a new folder `scripts/lib/from/`.
- `scripts/` is at its budget (132). Adding the two generators means raising it to
  134 in `scripts/check-dir-size.mjs` with a reason comment naming #1526 (the
  precedent: "+gen-club-defense-running.mjs (#2316)").
- Catalog entries in `docs/scripts/generators.md`: the nightly one under
  `## Nightly-cron generators`, the map one under `## Hand-run generators`. The reader
  side gets an entry in `docs/api/static-data.md`. The PR quotes the sweep's
  runtime and output size (`generators.md:76-82`).

### 6.2 Two generators

1. **`scripts/gen-where-from-map.mjs` — hand-run, rarely.** Builds the map geometry,
   the zones and the point-to-county table (§7.2, §7.3). Rerun only when Census
   publishes new metro areas, or after `gen-bio-history.mjs` reruns (new birth
   coordinates). Draft: `prototype/gen-map.mjs`.
2. **`scripts/gen-where-from.mjs` — nightly.** Sweeps or updates the players, matches
   colleges, assigns zones and writes the place shards (§6.4–§6.6). Draft of the
   sweep: `prototype/sweep.mjs`; of the college match: `prototype/match-colleges.mjs`.

The map generator's dependencies (`d3-geo@3.1.1`, `topojson-client@3.1.0`,
`topojson-simplify@3.0.3`) are devDependencies. The `us-atlas@3.0.1` files are data:
download `counties-albers-10m.json` and `counties-10m.json` with `download.mjs` from
`https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/`. The nightly generator needs **no**
geo library (the map generator precomputes everything it needs).

### 6.3 Identity and slugs

| Kind | Identity (= slug) | Display name |
|---|---|---|
| College | `slugify(apiName)`, e.g. `Miami (FL)` → `miami-fl` | most common spelling of the API name |
| High school | `slugify(name + ' ' + state)`, e.g. `smyrna-tn`; if two schools share that slug with different cities, every one of them **with** a city becomes `slugify(name + ' ' + city + ' ' + state)` (`central-toledo-oh`); one with no city keeps the short slug | the API name |
| Hometown (US) | `{state}/{slugify(birthCity)}` | most common spelling |
| Abroad | `country/{slugify(country)}/{slugify(city)}` | as the API spells it |
| Country | `slugify(birthCountry)` (`dominican-republic`, `puerto-rico`) | as the API spells it |

A player with no `birthCity` has no hometown. A school record with an empty name is
skipped.

### 6.4 The nightly run (D3)

The cache lives in `scripts/data/from/` (the nightly job stages `scripts/data`
automatically, `update-nightly-data.yml:660`):

- `players.json` — `{ players: { [id]: { name, debut, firstSeason, pos, birth:
  { city, state, country }, hs: [{ name, city, state }], col: [name] } } }`, keys
  sorted, so the bytes change only when a player changes. *Estimate:* about 3.5 MB
  (the prototype's raw sweep, with the API's own field names, is larger).
- `cursor.json` — `{ cursor }`, the next index of the rolling re-check.

Each night:

1. If `players.json` is missing or empty: the **first sweep** — every season list
   from 1876 to the season in play, then every player in batches (270 requests).
   Set `firstSeason` to the first season a player appeared in a list.
2. Otherwise: `GET /sports/1/players?season={seasonInPlay}`; every id not in the
   cache is new. Fetch the new ids in batches (usually 0–1 request). `firstSeason`
   = the season in play.
3. The rolling re-check: sort all cached ids; take the next `ceil(N / 30)` from
   `cursor` (wrapping round); re-fetch them (about 790 players, 4 requests); replace
   their cache rows; advance `cursor`. Every player is re-checked each 30 nights.
   Never remove a player from the cache.
4. Rebuild every public file from the cache (§6.6) with sorted keys, so an
   unchanged night writes unchanged bytes.

Debut year = the year of `mlbDebutDate`; when it is missing (380 players), use
`firstSeason`.

Wire it into `update-nightly-data.yml`: a step
`- name: Where they're from / id: where-from / continue-on-error: true / run: node scripts/gen-where-from.mjs`,
plus a line in the "Fail if any generator errored" condition (`:720-776`). It reads
`public/data/birthplaces/` and the map generator's output from disk; both are
hand-run, so no `if:` on another step is needed.

**Freshness:** `public/data/from/index.json` carries a top-level `generatedAt`
(`check-data-freshness.mjs`, 20-hour budget, `:42`). The shards carry no clock (the
`gen-milb-alumni.mjs:203-206` rule). Add an `EXCEPT` entry for `from/map/` with the
reason "hand-run: Census geometry" (the `birthplaces/` entry is the model,
`:48-104`). Read `docs/testing.md:249-284` before you touch the workflow.

### 6.5 Placing each record (state and zone)

| Kind | State from | Zone from | Measured coverage of zones |
|---|---|---|---|
| College | the IPEDS match (§7.1) | IPEDS `COUNTYCD` → `countyZone` | 93.7% of college records matched to a school |
| High school | the API `state` | the school's (state, city) → a known birth town's county (§7.3) | 5,045 of 10,371 records (49%) |
| Hometown | `birthStateProvince` | the player's birth coordinate (`public/data/birthplaces/`, by `personId`) → `pointCounty` → `countyZone` | 17,467 of 19,709 US-born (89%) |
| Abroad | — (country) | — | — |

A record with a state but no zone is listed in its state and in `All {State}`, but
in no zone chip. A college with no IPEDS match has no state: it is on no map, it is
in search, and it counts in the "not on the map yet" note.

### 6.6 Public output (`public/data/from/`)

All compact JSON. Players inside a place are `[id, name, pos, debutYear]` tuples,
sorted by debut year then name, to keep shards small.

| File | Shape | When loaded |
|---|---|---|
| `index.json` | `{ generatedAt, counts: { college: {ST: n}, 'high-school': {ST: n}, hometown: {ST: n} }, zoneCounts: { college: {zoneId: n}, … }, countries: [[slug, name, n]], unplaced: { college: n } }` | the picker, at once (small: about 10 KB) |
| `lookup/college.json` | `[[slug, name, state \| null]]` (about 1,300 rows) | search in College mode; a college page, to find its state shard |
| `lookup/high-school.json` | `[[slug, name, state]]` (about 6,400 rows) | search in High school mode; a high-school page |
| `lookup/hometown.json` | `[[state, citySlug, name]]` (about 6,000 rows) | search in Hometown mode |
| `college/{ST}.json`, `college/_unplaced.json` | `{ places: [{ slug, name, city, state, zone, players: [...] }] }` | a state is picked; a college page |
| `high-school/{ST}.json` | same shape | as above |
| `hometown/{ST}.json` | same shape, `slug` = city slug | as above |
| `country/{slug}.json` | `{ name, places: [{ slug, name, players: [...] }] }` | a country page or an abroad page |
| `map/us.json` | `{ viewBox: [975, 610], states: { ST: { d, b: [x0, y0, x1, y1] } } }` | the picker, at once |
| `map/{ST}.json` | `{ zones: [{ id, name, kind, d }] }` | a state is picked |

Measured sizes: `map/us.json` 91 KB at county simplification 0.5 — use simplification
2 for the national outline (about 26 KB, *measured* on the canvas build); the largest
`map/{ST}.json` is Texas at 12 KB; Georgia is 6 KB (`data/sample-shards/GA.json`).
The largest place shard is `high-school/CA.json` at 137 KB (*measured*, §14). Do not precache any of them; `/data/*.json` already uses the NetworkFirst
cache (`vite.config.js:540-546`). Ship geometry as JSON, never `.svg` files, which
`vite.config.js:475` would precache.

## 7. Matching and zones

### 7.1 College → IPEDS (D7)

- Input: the IPEDS "Directory information" file `HD2023.csv` from
  `https://nces.ed.gov/ipeds/datacenter/data/HD2023.zip` (6,000+ schools; columns
  used: `UNITID, INSTNM, IALIAS, CITY, STABBR, COUNTYCD, CBSA, LATITUDE, LONGITUD,
  ICLEVEL`). Latin-1 encoded, with a byte-order mark before `UNITID`.
- Rules, first hit wins (`prototype/match-colleges.mjs`):
  1. `college-overrides.json` (`{ apiName: unitid | null }`; null = "known, not in
     IPEDS").
  2. A flagship table for short names (`Michigan` → University of Michigan-Ann
     Arbor; 70 entries in the prototype, each checked to exist in HD2023).
  3. Expansions: `UC X` → `University of California-X`; `Cal State X`; `X State` →
     `X State University[-Main Campus]`; `CC` → Community College; `JC` → Junior
     College; `St.` → Saint.
  4. An exact normalized key against `INSTNM` or `IALIAS`, when it names one school.
  5. A parenthetical hint `(FL)` / `(Ohio)` narrows several hits to one; else prefer
     the one four-year school (`ICLEVEL = 1`).
- **Measured result:** 93.7% of 9,170 college records matched (flagship 34.5%, exact
  34.2%, expansion 24.3%, the rest from hints). 227 names (578 records) do not
  match; they are in `data/college-unmatched.json` with candidates where the matcher
  had them. Top unmatched: `Missouri State` 27, `State College of Florida` 19,
  `Saint Mary's (CA)` 18, `Penn State Erie` 16, `Southern` 15, `Columbia` 13,
  `Cornell` 12, `Cal Poly Pomona` 12. Old schools that have closed are not in
  IPEDS; they stay unplaced (override to `null`).
- **Check the matches by eye before you ship.** `data/college-matched-top200.json`
  lists the 200 biggest with the IPEDS name; the top 140 looked right on
  2026-10-20, but an exact-key match can still pick the wrong school of a shared
  name (for example `Xavier` → Xavier University in Ohio, not Xavier of Louisiana).
- The nightly run prints every unmatched name with its player count, so the
  overrides file can grow. Put the overrides at `scripts/data/from/college-overrides.json`.
- Name the IPEDS year in the generator header. A later HD file (HD2024 …) is a
  drop-in; rerun and diff the matches.

### 7.2 Zones (D4)

Input: `data/metro-zones-2023.csv` (pre-built here; commit it as
`scripts/data/from/metro-zones-2023.csv`). It was built from the Census
"List 1" delineation file (July 2023,
`https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx`)
and the 2023 population estimates
(`https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/metro/totals/cbsa-est2023-alldata.csv`).

- **Metro zones:** each **Metropolitan** Statistical Area (not micropolitan) is cut
  to the state; the in-state part qualifies when its 2023 population is
  **≥ 500,000**; at most **6** per state, largest first. *Measured:* 104 metro zones
  in 42 states. Cut by the cap: Fresno, Bakersfield, Oxnard, Stockton, Modesto (CA);
  Lakeland, Deltona, Palm Bay, Pensacola, Port St. Lucie (FL); Killeen (TX).
- A metro that spans states becomes one zone in each (`Kansas City metro` in KS and
  in MO; `New York metro` in NY and NJ; `Washington metro` in DC, MD and VA).
- **Names:** the first principal city plus ` metro`, with these overrides already in
  the CSV: `Poughkeepsie metro` (the Census title starts with Kiryas Joel),
  `Winston-Salem metro`, `Boise metro`, `Honolulu metro`, `Louisville metro`,
  `Nashville metro`.
- **The rest of the state** (every county not in a metro zone) splits by county
  centroid along the state's longer axis: 9 or more counties → 3 zones
  (`Northern {State}`, `Central {State}`, `Southern {State}`; or `Western`,
  `Central`, `Eastern` for a wide state); 4–8 → 2 zones; 1–3 → `Rest of {State}`.
  A compass zone may be in pieces where a metro cuts through it; that is fine.
- **Zone ids:** `{st}-{slug}` with ` metro` dropped: `ga-atlanta`,
  `ga-northern-georgia`, `ca-los-angeles`, `tx-western-texas`.
- **Measured:** 245 zones over 51 states and DC; all 3,142 counties placed. Georgia:
  `Atlanta metro` (29 counties), `Northern Georgia` (43), `Central Georgia` (44),
  `Southern Georgia` (43).
- **Connecticut:** the 2023 metro file uses Connecticut's new planning regions, but
  the 2017 county shapes use the old 8 counties. So Connecticut has compass zones only
  (`Western Connecticut`, `Eastern Connecticut`). Fix it later only if the map moves
  to newer shapes.
- **Puerto Rico** is in the Census files but not on the `us-atlas` map; it is in the
  country list (D6).

### 7.3 The point-to-county table

The map generator also reads every coordinate in `public/data/birthplaces/*.json`
(411 shards, 20,403 players; built by the hand-run `scripts/gen-bio-history.mjs` from
Retrosheet, the Chadwick register and GeoNames; ADR-0106), finds the county that
contains it (`d3-geo` `geoContains` on the unprojected `counties-10m.json`), and
writes `scripts/data/from/point-county.json` (`{ "lat,lon": "13121" }`). The nightly
run then needs only lookups:

- hometown: `personId` → birthplace coordinate → county → zone;
- high school: (state, `slugify(city)`) → any birth town in that state with the same
  slug → its county → zone.

### 7.4 Totals and facts on a place page

| Fact | Rule |
|---|---|
| Big leaguers | players at the place |
| Debuts `{first}–{latest}` | min and max debut year |
| Second tile | `Busiest decade`: the decade with the most players, caption `The {decade}s`; when every decade has one player, show `Span` = latest − first, caption `Years, first debut to latest` |
| First debut, Latest | years |
| Decades | number of decades with a player |
| Pitchers | `pos` is `P` or `TWP` |
| Hitters | the rest (including `X`) |
| Newest class | `{latest year} · {players with that debut year}` |

Decades go newest first, players within a decade by debut year (newest first), then
name. Every player links to his page with `PlayerLink` / `playerPath(id, { name })`
(`src/components/player/PlayerLink.jsx:87`, `src/lib/route.js:798`).

### 7.5 Credits and licences

- IPEDS: US Department of Education, National Center for Education Statistics — a
  US government work (public domain). Credit line: §14.
- Census delineations and population estimates: US Census Bureau, public domain.
- `us-atlas`: ISC licence (Mike Bostock); the data is Census 2017 cartographic
  boundaries.
- Birth coordinates: the existing birthplaces credit (Retrosheet, Chadwick, GeoNames
  CC BY 4.0) carries through. Credit lines: §14.

## 8. Client data layer

- New folder `src/api/from/` (`src/api/` is at its budget, 115). One module
  `src/api/from/whereFrom.js` with readers built on `staticJson` / `staticJsonBy`
  (`src/api/staticJson.js:49,79`): `fetchFromIndex()`, `fetchFromMap()`,
  `fetchFromStateMap(st)`, `fetchFromLookup(kind)`, `fetchFromPlaces(kind, st)`,
  `fetchFromCountry(slug)`. Never a hand-rolled cache (`src/api/CLAUDE.md:80-86`).
- Header line `// SPOILER FOOTING: spoiler-FREE.` and an entry in
  `src/api/spoiler-manifest.json`:
  `"from/whereFrom.js": { "class": "spoiler-free", "why": "Static from/*.json: schools, birthplaces and map shapes. Where a man went to school or was born says nothing about a game. Open surface (ADR-0034); no SealBox." }`
  (`check-spoiler-manifest` fails without it).
- Pure helpers (facts, decade grouping, zoom transform) go in `src/lib/from/`, each
  with a test. `check-dead-exports` fails an export nothing uses.

## 9. UI

### 9.1 Screens and files

`src/screens/` is at its budget (41), so: `src/screens/from/FromPage.jsx` (the
picker), `src/screens/from/FromPlacePage.jsx` (one place), `FromCountryPage.jsx`,
plus parts (`UsMap.jsx`, `Locator.jsx`, `PlaceList.jsx`). Styles in
`src/styles/from/*.css`, imported by the screen, not by `src/index.css`
(`src/styles/CLAUDE.md:9-14`). Add the new stylesheets to
`scripts/layout/layout-ratchet-budget.json`. Each new folder holds at most 12 files.

Page chrome: `<SiteHeader />` … `<ReportFooter />`, wrapped in `.screen`, as on
`/more` (`src/screens/MorePage.jsx:40,77`).

### 9.2 Design → code

| Design part | Code |
|---|---|
| Stamped card with name tab and count tag | `Card frame="stamped" label=… count=… tone=…` (`src/components/ui/frame/Card.jsx:39`). `label` and `head` cannot both be set; `count` needs `frame="stamped"`. Flush body for tables: `body="flush"`. |
| Ink / tint stat tiles | `StatTile tone="ink"` / `tone="tint"` (`src/components/ui/frame/StatTile.jsx:106`) |
| Fact strip | `FactGrid look="strip"` with `.fact` / `.fact__label` / `.fact__value` children (`src/components/ui/frame/FactGrid.jsx:152`; markup example `src/screens/team/modules/ballpark/BallparkCard.jsx:168-172`). 3 columns on a phone, 6 from 740px — built in. |
| Decade jump bar (sticky, counts, scroll-spy) | `HubTabBar variant="anchor" tabs={[{ key, label, count }]}` (`src/components/chrome/HubTabBar.jsx:30`); the caller makes it sticky (`src/styles/team-next/page.css:15`) and sets `offset` to match `scroll-margin-top` (the `BAR_H` rule, `src/screens/team/next/TeamNextPage.jsx:26`) |
| Decade table | `Table frame="bare"` inside a flush stamped `Card` (`src/components/ui/table/Table.jsx:248`; usage `src/components/salaries/ContractGrid.jsx:61`) |
| College / High school / Hometown toggle | `Segmented` (`src/components/ui/control/Segmented.jsx:119`) |
| Zone chips | `Chips layout="wrap"` (`src/components/ui/control/Chips.jsx:139`) with counts in the labels |
| Search field | `<input type="search">` with a `<label>`; model: `src/components/team/TeamSearchBox.jsx:44` |
| State select | a native `<select>` with a `<label>`; model: `src/components/season/SeasonPicker.jsx:56` |
| Empty list | `EmptyState` (`src/components/ui/state/EmptyState.jsx:182`) |
| Loading / failed load | `AsyncStatus` (`src/components/ui/AsyncGate.jsx:58`) |
| Stamp-in on the tiles | `stampIn` with `--stamp-delay: calc(var(--stagger-step) * i)`, gated by `useViewOnce` (`src/screens/team/next/money/index.jsx:28`) |
| Layout | `Stack`, `Cluster`, `Grid` (`src/components/ui/layout/`) |

Live examples of every part: `/design-lab` (`src/screens/designlab/`).

### 9.3 The map

- An inline `<svg viewBox="0 0 975 610">`; each state is a `<path d>` from
  `map/us.json`. No map library in the client.
- **Zoom:** a `<g>` with `transform: translate(tx, ty) scale(k)`, where for a
  state's box `b = [x0, y0, x1, y1]`: `k = min(975 / w, 610 / h) * 0.86`,
  `tx = (975 − w·k) / 2 − x0·k`, `ty = (610 − h·k) / 2 − y0·k`. Transition
  `transform var(--dur-stamp-in) var(--ease-stamp)`; none under
  `prefers-reduced-motion` or `:root[data-motion='reduced']`
  (`src/styles/team-next/top.css:502-512`). Every stroke has
  `vector-effect="non-scaling-stroke"` so lines stay the same width at every zoom.
- When zoomed, draw the zone paths from `map/{ST}.json` over the state.
- **Fills and strokes (tokens):**
  | State / zone | Fill | Stroke |
  |---|---|---|
  | has entries | `--accent-tint` | `--border-stamped`, 1.5px |
  | no entries | `--bg-canvas` | `--border-rule`, 1px |
  | picked | `--surface-stamped-ink` | `--border-stamped` |
  | outside the zoomed state | `--border-grid` | `--border-rule` |
  The mint fill is only 1.86:1 against the paper (*measured*), under WCAG 1.4.11's
  3:1. The heavy ink edge is what tells "has entries" apart; keep it.
- **Accessibility:** the `<svg>` is `aria-hidden="true"`. The State `<select>` and
  the zone `Chips` are the accessible controls and do everything the map does (51
  tab stops on a map would be worse). A tap on a state path calls the same handler
  as the select. Map paths take no `title=` and no SVG `<title>`
  (`docs/scout-design.md:214`). The other pattern, `role="button"` on each region,
  is in `src/components/scout/ScoutMap.jsx:84-87`; do not use it here.
- **Small states** (RI, DE, DC) are a few pixels wide on a phone; the select covers
  them. No zoomed Northeast panel in v1.

### 9.4 The locator map (place pages)

The same `map/us.json`, zoomed to the place's state with factor `0.6`, the state in
`--surface-card` with an ink edge, the others `--border-grid`, and an ink dot with a
paper ring at the place. In a `<figure>` whose `<svg role="img"
aria-label="Map: {City}, in {State}">`. The dot needs the place's projected point:
add `[x, y]` (geoAlbersUsa, `scale(1300).translate([487.5, 305])`, the projection of
the us-atlas Albers files) to each place in the shards. A place with no point shows
the state with no dot; a college with no state and an abroad place show no locator.

### 9.5 Layouts

- **Phone (390px):** heading, toggle, search, map card (legend, zone chips, select),
  list card. Place page: heading, hero card (subtitle, locator, two tiles, fact
  strip), sticky decade bar that scrolls sideways, one stamped card per decade.
- **Desktop (from 740px; drawn at 1180px):** picker = heading and toggle in one row;
  map card left (`minmax(0, 1fr)`), right column 340px with select, search and the
  list card (the list scrolls inside its card, max height 520px). Place page = hero
  grid of 4 columns (ink tile, tint tile, subtitle + 3-column facts, locator), the
  decade bar wraps in its box, decade cards in two balanced columns (put each card in
  the column with fewer rows so far).
- 740px is the only wide step (`check-media-widths`).

## 10. Accessibility checklist

- Every control is a real `<button>`, `<a href>`, `<input>` or `<select>` with a
  label; tap targets ≥ `--tap-min` (44px).
- Focus: `var(--focus-ring)` / `var(--ring)` (`check-focus-ring`).
- Text pairs hold 4.5:1 (`check-contrast` checks token pairs). Captions on the tint
  tile take `--text-muted`, not `--text-caption` (4.52:1 is the edge; README of the
  design system).
- No `title=` tooltips. Nothing needs hover.
- The decade bar marks the current item with `aria-current="location"` (built into
  `HubTabBar`).

## 11. Guards you will hit

| Guard | Limit / rule | What to do |
|---|---|---|
| `check-file-size` | `src/lib/route.js` 1000 (980 now); `src/App.jsx` 700 (646 now); 600 for a new file | Sub-modules (§4) |
| `check-dir-size` | 12 files per folder; budgets full: `src/lib` 53, `src/screens` 41, `src/api` 115, `scripts` 132, `scripts/lib` 42 | New folders `from/`; raise `scripts` to 134 with a reason |
| `check-spoiler-manifest` | every `src/api/**/*.js` classified | §8 |
| `check-statsapi-client` | statsapi only via `getJson` | §6.1 |
| `check-dead-exports` | every export used | |
| `check-typography`, `check-raw-values`, `check-caps`, `check-component-reuse`, `layout/check-layout-ratchet` | tokens only, no raw hex; no hand-drawn card | §9.2 |
| `check-word-choice` | "postseason" | |
| `docs/check-doc-paths` | backticked paths in `docs/*.md` must exist | |
| `check-data-freshness` (nightly, not lint) | 20 h for `index.json`; `from/map/` exempt | §6.4 |
| `test/report-pages.test.js` | exact path set | add `/from` |

## 12. PR plan

Each PR: task branch from `origin/main`, draft PR, `npm run lint` and `npm test`
green, product code and tests together (root `CLAUDE.md`). A real bug fix starts
with a failing test.

1. **PR 1 — map data (hand-run).** `scripts/gen-where-from-map.mjs`,
   `scripts/lib/from/zones.mjs` (pure: compass split, zone ids, the zoom box),
   `scripts/data/from/metro-zones-2023.csv`, output `public/data/from/map/` and
   `scripts/data/from/point-county.json`, devDependencies, the freshness `EXCEPT`
   entry, the catalog entry, `test/from-zones.test.js`. *Done when:* 51 + DC state
   outlines and 245 zones are written, every county is in a zone, and Georgia has the
   four zones in §7.2.
2. **PR 2 — player data (nightly).** `scripts/gen-where-from.mjs`,
   `scripts/lib/from/college-match.mjs` (the §7.1 rules, the flagship table),
   `scripts/lib/from/places.mjs` (identity, slugs, merges, facts input),
   `scripts/data/from/college-overrides.json` (start from `data/college-unmatched.json`;
   resolve at least the top 50 by the §12.1 rule: certain → `unitid`, unsure → `null`), the first sweep's
   committed output, the workflow step, catalog and static-data docs, tests for the
   matcher and the identity rules using `fixtures/`. *Done when:* the run reports its
   match rate (≥ 93%) and unmatched list, a second run with no API change writes
   identical bytes (except `index.json`'s `generatedAt`), and the PR body states the
   runtime and the output size.
3. **PR 3 — routes and the picker.** `src/lib/from/route.js` and `path.js`,
   `route.js` and `App.jsx` wiring, `reportPages.js`, sitemap, `src/api/from/`, the
   manifest entry, `FromPage.jsx` with the map, zoom, zones, select, search and list,
   `test/from-route.test.js`. *Done when:* `/from?nointro`, `/from/ga?nointro` and
   `/from/ga?zone=ga-atlanta&list=hometown&nointro` render at 390px and 1180px, and
   the select alone can do everything the map does.
4. **PR 4 — place pages.** `FromPlacePage.jsx`, `FromCountryPage.jsx`, the locator,
   the facts helper and its test. *Done when:* `/from/college/vanderbilt`,
   `/from/high-school/smyrna-tn`, `/from/pa/donora`,
   `/from/country/dominican-republic` and
   `/from/country/dominican-republic/santo-domingo` render (with `?nointro`) at 390px
   and 1180px, and every player name opens his player page.

For each UI PR, render the routes in the preinstalled Chromium and send Gary the
screenshots with the exact routes (root `CLAUDE.md`, "Cloud sessions").

### 12.1 Running unattended (decided by Gary, 2026-10-20)

**One session builds all four PRs, stacked, with no stop for a merge.** Gary lands
them together with one `/stack-prs` at the end.

- **Start after #2423 has merged**, so this spec is on `main`. If it has not, read
  the spec from `origin/claude/where-theyre-from-spec` and cut PR 1 from `main` all
  the same.
- **Branches:** `claude/where-from-1-map` from `origin/main`; `claude/where-from-2-data`
  from branch 1; `claude/where-from-3-picker` from branch 2; `claude/where-from-4-places`
  from branch 3. A later fix to an earlier PR is committed on that PR's branch and then
  merged forward into each later branch (`git merge`, never a rebase or a force-push).
- **Every PR targets `main`, not the previous branch.** CI (`lint-and-build`) runs only on
  PRs into `main` (`.github/workflows/ci.yml:12`), so a PR based on another branch would
  get no CI. PR 2's diff therefore also shows PR 1's commits. Say so at the top of each
  body: `Stacked on #<previous>. Review only the commits after <sha>.` and give the
  `Part of #1526` line (`Closes #1526` on PR 4 only). `/stack-prs` merges each PR head in
  turn with `--no-ff`; a head that already holds an earlier one merges cleanly.
- **Open each PR as a draft, and remove `wip` when its CI is green.** `/stack-prs` skips
  a PR that still has `wip` (`.claude/skills/stack-prs/SKILL.md:35`). Never merge.
- **Never stop to ask.** Where this spec does not decide something, choose the option
  that keeps to the repo's rules and write a `[DECISION: …]` line in that PR's body
  (root `CLAUDE.md`).
- **College overrides:** set a name to a `unitid` only when the IPEDS school is certain
  (the same name and the right state, or a well-known short form). When in doubt, set it
  to `null`: the college is then not on the map, but it is still in search and still
  counted. **Never guess.** List every `null` you set, with its player count, in PR 2's
  body for Gary to check later.
- **Network:** the session needs `statsapi.mlb.com`, `nces.ed.gov`, `www2.census.gov` and
  `cdn.jsdelivr.net`. All four answered from this environment on 2026-10-20. If one is
  blocked, use the copies under `.scratch/where-theyre-from/data/` where they exist (the
  metro-zone CSV), and say what was missing in the PR body.
- **Context:** commit and push at the end of each PR before you start the next one, so a
  context compaction loses nothing. Re-read this file (§12 and the section the next PR
  needs) at the start of each PR.
- **Done:** four draft PRs, each with CI green and no `wip` label, each body with its
  route screenshots sent to Gary, its `[DECISION]` lines and its checks from §12. Then
  tell Gary they are ready for `/stack-prs`.

## 13. Where the canvas differs from this spec

| On the canvas | Build this instead |
|---|---|
| Georgia zones: an 11-county Atlanta metro and a Coast zone, cut at 33.9° and 32.3° | The Census rule (§7.2): a 29-county Atlanta metro, then Northern, Central, Southern Georgia |
| Zone names "North Georgia", "Middle Georgia" | "Northern Georgia", "Central Georgia" |
| Hex colours | Tokens (§9.3) |
| Sample data from memory | The real data |
| Every list link opens the Vanderbilt or Donora artboard | Real routes |
| Only Georgia has zones | Every state |
| Artboard file names `Main`, `Wide`, `HomeWall` | Not used in code |

## 14. Resolved after review (2026-10-20)

- **Credits:** open-data credit lines live in `scripts/lib/open-data/credits.mjs`
  and the About page prints them (`src/screens/AboutPage.jsx:18-19`; a test pins the
  GeoNames line, `test/on-this-day.test.js`). Add two constants there and print them
  on the About page and in the `/from` footer:
  `IPEDS_CREDIT = 'College locations from the U.S. Department of Education, National Center for Education Statistics, IPEDS.'`
  and
  `CENSUS_CREDIT = 'Metro areas and populations from the U.S. Census Bureau.'`
  (Both are US government works; neither source requires exact wording.)
- **Place shard sizes (*measured* on the sweep, tuple format of §6.6):** the largest
  `hometown/{ST}.json` is California at 118 KB (Pennsylvania 94 KB, Texas 73 KB),
  1.2 MB across all states; the largest `high-school/{ST}.json` is California at
  137 KB (Texas 64 KB, Florida 58 KB), 0.9 MB in all. Colleges are smaller (9,170
  records against 10,371 high-school ones). No shard needs splitting.
- **The 380 players with no `mlbDebutDate` are real big leaguers.** Sample, with MLB
  career games from the API: Darby O'Brien (b. 1863) 709, Jack Taylor (b. 1873) 310
  pitching, Eufemio Abreu (b. 1901, a Negro Leagues player MLB now counts) 265. Keep
  them; their debut year is `firstSeason` (§6.4). A record with no first name
  (`819396 Gerhart`, 1 game) also appears: show the name as the API gives it.

## 15. Files in this package

| Path | What |
|---|---|
| `SPEC.md` | this file |
| `design/*.dc.html`, `design/canvas.json` | the canvas artboards (look only; they load map data from the canvas's own store, so they do not run here) |
| `prototype/sweep.mjs` | the all-time sweep, measured |
| `prototype/match-colleges.mjs` | the college matcher, measured |
| `prototype/gen-map.mjs` | the map, zones and county table builder (without §7.3), measured |
| `data/metro-zones-2023.csv` | the metro-zone input, ready to commit (554 counties, 104 zones) |
| `data/sample-shards/GA.json` | Georgia's zone shard as the prototype writes it |
| `data/college-unmatched.json` | the 227 unmatched college names with counts, the start of the overrides |
| `data/college-matched-top200.json` | the 200 biggest matches, for the eye check |
| `data/sweep-stats-2026-10-20.json` | coverage and trap counts from the sweep |
| `fixtures/people-education-batch.json` | a live batch response: Yelich, Gray, Núñez |
| `fixtures/season-players-2026-first2.json` | a live season-list response, cut to 2 players |
