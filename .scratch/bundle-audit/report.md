# Bundle audit: the first-load JS and CSS (#2875)

**Measured on `origin/main` at `f926d5a493aee544b25142649547a49835a172de`** (2026-11-04, "Merge
pull request #2736"). This audit only reads code; it changes no product code.

**Units.** kB = 1,000 bytes. The issue's "595 KB / 188 KB" and "518 KB / 82 KB" are KiB.
They are the same files: the entry JS is 609.4 kB (595 KiB) raw and 192.7 kB (188 KiB) gzip;
the entry CSS is 531.0 kB (518 KiB) raw and 84.8 kB (82.8 KiB) gzip. Gzip numbers are zlib
at its default level, as in `scripts/bundle/check-bundle-size.mjs`.

## Summary

- **The entry chunk is not the whole first load.** `index.html` loads the entry and
  modulepreloads 97 more chunks that it imports statically. Together they are **1,252 kB
  raw / 397.6 kB gzip** on every route before any route code runs. That is close to the
  407 kB budget in `bundle-size-budget.json` (`firstLoadJsGzipKB`).
- **React DOM is about 63 kB gzip of that, and it stays.** Most of the rest is the slate:
  `App.jsx` imports `GameSelect` statically. `GameSelect` imports every seasonal panel
  statically: the World Series home, bracket, series primer, offseason slot, and wire.
  So a deep link to `/team/158` or `/player/660271` also downloads the World Series
  scouting report.
- **The copy registry carries all of the server-rendered `/learn` guides** (about 38 kB
  gzip), because `main.jsx → CopyProvider → registry.js → landing/fields.js` is static.
  The SPA never renders that prose. Only the lazy admin editor needs it.
- **The entry CSS is 12.3% used on `/`** (65.5 of 531.0 kB, Chromium coverage).
  `src/index.css` `@import`s the scorecard, box score, strike zone, hit chart, and pitcher
  card CSS, and those render only on lazy routes.
- **Proposed target:** first-load JS **≤ 260 kB gzip on `/`** and **≤ 160 kB gzip on a
  non-slate route**, entry CSS **≤ 60 kB gzip**. Why: slices A + B + C1 (+ D) drop an
  estimated 154 kB gzip from the static closure, and slice E drops about 108 kB more on
  non-slate routes. The floor is React + React DOM + the shell (≈ 75–90 kB gzip). The
  budget file should ratchet down after each slice lands (`--write` only lowers it).

## How I measured

All scripts are in this folder. Each one has its usage in its header.

1. `npx vite build --sourcemap --config .scratch/bundle-audit/vite.measure.config.mjs`.
   This config is `vite.config.js` plus one `generateBundle` plugin. The plugin writes
   `out/graph.json`: each chunk's static and dynamic imports, plus Rollup's
   `getModuleInfo` importers for every module. The hashes match a plain `npx vite build`,
   so the plugin does not change the output. No dependency was added to `package.json`.
2. `node .scratch/bundle-audit/attribute.mjs`: **module sizes come from the minified output's
   sourcemaps**, using the same rule as source-map-explorer. I also ran
   `npx --yes source-map-explorer@2.5.3` on the entry, and it gives the same top modules.
   I did not use Rolldown's `renderedLength`, because in this build it is measured
   *before* minification (it gives React DOM as 529 kB; the minified bytes are 203 kB).
   A module's "gzip" is the gzip of its own minified code alone. That is an upper bound
   on what removing it saves.
3. `node .scratch/bundle-audit/why.mjs <path>` and `analyze.mjs <path>` print the static
   import chain from `src/main.jsx` to a module (BFS over Rollup's importers).
4. `node .scratch/bundle-audit/simulate.mjs`: **the slice estimates.** It cuts the named
   static import edges, as if each one became a `lazy()`/`import()` or moved, and
   recomputes what `main.jsx` still reaches. It then gzips the dropped modules' minified
   code joined in one stream. These are estimates: Rolldown may regroup chunks after a
   real change. Its baseline (410.7 kB gzip joined) is 3% above the real 397.6 kB,
   because JSON modules have no sourcemap and are measured as minified JSON from disk.
5. `npx vite preview`, then `node .scratch/bundle-audit/measure-routes.mjs`: each route in a
   new Chromium context (`/opt/pw-browsers/chromium`, 390 × 844, `?nointro`, service
   workers blocked, empty cache). It waits for network idle + 3 s, then sums every
   script and stylesheet from the app's origin.
6. `node .scratch/bundle-audit/css-coverage.mjs`: entry-CSS sources (the `@import` tree of
   `src/index.css` plus CSS that entry JS modules import) and Chromium `page.coverage`
   on `/`, grouped by rule with postcss.

**Mocked: nothing.** Game data came live from `statsapi.mlb.com`. `vite preview` does not
serve the Vercel functions, so `/api/*` calls (copy overrides, identity overrides)
returned 404 and the app used its defaults. That changes data, not which chunks load.

## 1. Top 20 modules in the entry chunk

Entry `assets/index-DqfAg8kL.js`: 609.4 kB raw, 192.7 kB gzip, 247 source files. Two
pieces have no source module: `[unmapped head]` (19.3 kB raw: the `__vite__mapDeps` list
of every chunk name, 11.7 kB, plus the import statements for the 97 static chunks) and
3.4 kB of `export` lists.

| # | Module | raw kB | gzip kB (alone) | Pulled in by |
|---|---|---:|---:|---|
| 1 | `node_modules/react-dom/cjs/react-dom-client.production.js` | 203.1 | 62.8 | `main.jsx` (`createRoot`) |
| 2 | `src/App.jsx` | 20.2 | 5.8 | `main.jsx` |
| 3 | `src/components/worldseries/Hero.jsx` | 9.6 | 3.1 | GameSelect → WorldSeriesHome |
| 4 | `src/components/bracket/FullBracket.jsx` | 8.1 | 2.8 | GameSelect → BracketDock |
| 5 | `src/screens/GameSelect.jsx` | 7.3 | 3.0 | App (static import) |
| 6 | `src/api/teamTransactions.js` | 7.1 | 2.8 | GameSelect → WireDock → transactions/leagueFeed → league |
| 7 | `src/api/playbyplay/halfInningFeed.js` | 6.8 | 2.5 | GameSelect → OffseasonSlot → LevelOffseason → PickedGame → useRevealProgress → derive → playbyplay |
| 8 | `src/api/person-fetch.js` | 6.8 | 2.1 | App → PlayerHoverCard → usePlayerHoverStats → playerHoverCard |
| 9 | `src/api/umpires.js` | 5.5 | 2.1 | GameSelect → SeriesPrimer → edges/SeriesEdges |
| 10 | `src/api/transactions/cutline.js` | 5.5 | 2.0 | GameSelect → WireDock → … → teamTransactions |
| 11 | `src/components/ui/dock/SheetDock.jsx` | 5.3 | 2.1 | GameSelect → BracketDock |
| 12 | `src/components/worldseries/cards/scouting/FilmMeeting.jsx` | 5.3 | 1.7 | GameSelect → WorldSeriesHome |
| 13 | `src/lib/stamps.js` | 5.0 | 1.8 | … PickedGame → useRevealProgress → derive → linescore |
| 14 | `src/components/transactions/MoveRow.jsx` | 5.0 | 2.0 | GameSelect → WireDock |
| 15 | `src/components/chrome/HubTabBar.jsx` | 4.9 | 1.8 | GameSelect → WorldSeriesHome → ScoutingReport |
| 16 | `src/components/offseason/LongAtBats.jsx` | 4.8 | 1.8 | GameSelect → OffseasonSlot → OffseasonLead |
| 17 | `src/components/worldseries/ScoutingReport.jsx` | 4.6 | 2.0 | GameSelect → WorldSeriesHome |
| 18 | `src/components/player/PlayerHoverCard.jsx` | 4.6 | 1.5 | App (static import) |
| 19 | `src/lib/postseason/worldseries/hero.js` | 4.5 | 2.0 | GameSelect → WorldSeriesHome → Hero |
| 20 | `src/components/teamstats/SeasonSeriesStrip.jsx` | 4.4 | 1.8 | GameSelect → SeriesPrimer |

The chains are the shortest static path (`why.mjs`). A module may have more importers.

**By folder (entry chunk, minified):** react-dom ≈ 203 kB raw, then
`components/worldseries` ≈ 100 kB *pre-minify*, `lib/postseason`, `api/playbyplay`,
`components/offseason`, `components/bracket`, `components/postseason`,
`api/transactions`. Every app folder in that list comes in through `GameSelect`. The
folder sums are from `analyze.mjs` (pre-minify `renderedLength`), so read them as
relative order, not as bytes.

### The other first-load chunks (static imports of the entry)

| Chunk | raw kB | gzip kB | Why it is in the first load |
|---|---:|---:|---|
| `registry-*.js` | 134.9 | 43.7 | `main.jsx → copy/CopyProvider → copy/registry.js`. Holds `copy/landing/pages/*` (the `/learn` guides, 11 page modules, ≈ 117 kB raw) and `milb-ballparks.json` |
| `teams-*.js` | 97.0 | 24.8 | `main.jsx → lib/route.js → lib/teams.js` and its JSON tables (`mlb-treatment-tuning`, `milb-colors`, `logo-art`, `alt*-colors`, …) |
| `ballparkData-*.js` | 59.1 | 19.3 | `lib/ballpark/layout/fields.js` (43.9 kB). Via registry.js and also via slate game-card park art |
| `milbColors-*.js` | 57.9 | 8.1 | `milb-treatment-tuning.json` (101 kB pre-minify, compresses well). Via `headerTheme.js` (PlayerHoverCard, TeamTreatmentMark, parkWash, …) |
| `TeamLogo-*.js` | 22.7 | 5.6 | `season-marks.json` via `identity/seasonMarks.js` |
| `SiteHeader-*.js`, `route-*.js`, `person-*.js`, `parkKeys-*.js`, `pillClass-*.js`, `schedule-*.js` | 11–19 each | 3–7 each | shell, router, slate data |
| react + react-dom wrapper + jsx-runtime | ≈ 9 | ≈ 3.5 | |

## 2. Per-route first visit (390 px, `?nointro`, live data, cold cache)

| Route | JS files | JS raw kB | JS gzip kB | CSS files | CSS raw kB | CSS gzip kB | Rendered |
|---|---:|---:|---:|---:|---:|---:|---|
| `/` (slate) | 114 | 1,339.4 | 441.9 | 1 | 531.0 | 84.8 | post–World Series home (TB vs MIL, series MVP) |
| game page, gamePk 823035 (`/07072026/milstl-2/lineup1`) | 137 | 1,429.0 | 475.8 | 6 | 580.9 | 94.9 | "Milwaukee Brewers" lineup |
| `/team/158` | 127 | 1,369.6 | 453.4 | 5 | 555.6 | 90.6 | "Milwaukee Brewers" |
| `/player/660271` | 120 | 1,358.2 | 448.1 | 3 | 553.9 | 89.7 | "Shohei Ohtani" |
| `/profile` | 106 | 1,278.7 | 417.3 | 1 | 531.0 | 84.8 | "My Tally" |

The JS counts include `registerSW.js` and the two Vercel insight stubs (≈ 0.1 kB).
These gzip numbers are summed per file. Every route pays the same ~398 kB gzip static
closure, and the route's own lazy chunks add only 20–80 kB gzip. **The route code is not
the problem; the shared first load is.** Raw output: `out/routes.json`. Screenshot of
`/`: `out/slate-390.png` (not committed).

## 3. Proposed slices, ranked

The savings are on the gzip first-load JS (`simulate.mjs`). They overlap, so they do not
add up; the combined lines are at the end.

| Rank | Slice | Est. gzip saving | Files (≤ 5) | Scoring surface? | Risk |
|---|---|---|---|---|---|
| 1 | **A. Lazy-load the slate's seasonal panels.** `lazyNamed` + `Suspense` in `GameSelect` for `WorldSeriesHome`, `PostseasonBracket`/`BracketDock`, `SeriesPrimer`, `OffseasonSlot`, `WireDock`/`WireRail`, `DerbyCard`, `LeaguePicker`. Each one renders only in its season. | **105 kB** off every route (231 modules). On `/` **today** about **45 kB**, because the World Series home shows now and would still load, one round trip later. About 14 kB gzip of their CSS (`worldseries/*`, `postseason/*`, `80-postseason-bracket.css`, …, imported by those JS modules) also leaves the entry CSS. | `src/screens/GameSelect.jsx` (only) | **Yes: the slate.** These panels sit on the slate page but are not its score cells. The World Series home and bracket do show results; they stay the same components. No reveal-only call moves. | Low–medium. A panel that renders appears one chunk later (fallback / layout shift); pick a fixed-height fallback. Sub-slices if one PR is too big: World Series home 35.9 kB, offseason slot 21.4 kB, series primer 9.6 kB; bracket and wire are small (< 1.5 kB) |
| 2 | **E. Lazy-load `GameSelect` in `App.jsx`**, like every other screen. Optionally start `import('./screens/GameSelect.jsx')` at boot when the route is the slate, so `/` does not wait an extra round trip. | **152 kB** on every non-slate route alone; **≈ 108 kB more** on top of A + B + C1 + D (262 vs 154 kB). `/` gains nothing. | `src/App.jsx` | **Yes: the slate.** It moves the whole slate screen; nothing inside it changes. | Medium. `/` gets a second request in series unless it is preloaded; `GameRoute` uses `resolveGame` from `api/schedule.js`, which stays static. Check that the `vite:preloadError` repair still covers it (it does for other lazy routes). |
| 3 | **C1. Take the `/learn` guide prose out of the runtime copy registry.** `registry.js` builds `FIELDS` from `landingFields()`, so the SPA ships every guide's default text. Only `AdminCopy` (lazy) and `api/copy.js` need those fields. Split one runtime field set (offseason, awards, ballparks) from the full set that admin and the API validate against. | **37.8 kB** off every route (14 modules). Including the ballpark tables (C) adds only ≈ 3.7 kB, because `ballparkData` is also reached from the slate's game-card park art. | `src/copy/registry.js`, `src/copy/CopyProvider.jsx`, `src/copy/copyContext.js`, `src/screens/AdminCopy.jsx`, `api/copy.js` | No | Low–medium. `api/copy.js` and `AdminCopy` must keep the FULL field set, or a guide edit would be rejected. With the runtime set, the cached override blob would drop `learn.*` keys, which the SPA never renders. Note: the `/learn/{slug}?edit` route opens the lazy admin editor and needs the full set. |
| 4 | **B. Move `readRevealMarkFor` out of `useRevealProgress.js`.** `offseason/PickedGame.jsx` imports only this localStorage reader, and the hook file statically imports `derive.js`, `linescore.js`, `stamps.js`, and play-by-play. Put the reader, and the `REVEAL_KEY`/`readRevealMark` it needs, in a small module that both files import. | **13.9 kB** (22 modules). It is included in A if A lands first (it is part of the offseason slot), but it is worth doing alone: it is smaller and removes reveal-only modules from the slate's static graph. | `src/hooks/useRevealProgress.js`, `src/components/offseason/PickedGame.jsx`, one new module (e.g. `src/hooks/revealMark.js`), its test | **Yes: reveal persistence (lineup pages / innings viewer).** `readRevealMarkFor` reads only the stored half-index (`bbsbh:reveal:{gamePk}`), never a score. `derive.js`/`linescore.js` calls stay inside their `SealBox` reveal functions (ADR-0001, ADR-0002); this slice moves no call. | Low. Keep the parse/ratchet helpers in one place (they guard a hostile stored value). |
| 5 | **CSS-1. Move game-view CSS out of `src/index.css`.** The scorecard (`styles/scorecard/*`), box score (`21-*`, `21a`, `21b`, `22-*`, `23-*`, `box-score/*`), `14-strike-zone`, `69-hit-chart`, and `pitcher-card/*` (20 files) go into imports from the lazy screens that render them, so Vite's CSS code splitting gives them route CSS. | **≈ 16 kB gzip** off the entry CSS (98 kB minified). Coverage: `.sc` 25.6 kB, `.bs` 16.2 kB, `.hitchart` 6.2 kB, `.pcard` 5.4 kB unused on `/`. | `src/index.css` plus ≤ 4 screen entry modules. Which screens receive each file: **unconfirmed.** The strike zone, hit chart, and pitcher card are shared with the player and scout pages and Gameday panels, so they need a grep first. If that is more than 4 modules, split this slice. | **Yes: the box score and innings viewer** (styling only; no data or reveal logic moves). | Medium. Moving an `@import` changes cascade order; a rule that now loads after a later rule can win or lose. Verify each route visually. |
| 6 | **CSS-2. Postseason/offseason CSS that `index.css` imports** (`31-wild-card`, `78-offseason`, `styles/postseason/*`, `styles/offseason/*`, 6 files) goes into imports from the panels in slice A. | **≈ 7 kB gzip** entry CSS | `src/index.css` + the slice-A panel modules | Yes: the slate (styling only) | Medium (cascade order); do it with or after A. |
| 7 | **D. Lazy-load `PlayerHoverCard` and `HeadshotLogPanel` in `App.jsx`.** | **2.6 kB** | `src/App.jsx` | No | Low, small win. `headerTheme`/`milbColors` stay in the first load through other importers. |

**Combined (simulator):** A + B + C1 + D ≈ **154 kB gzip** off the static closure
(≈ 411 → ≈ 256 kB). Adding E on a non-slate route: ≈ **262 kB gzip**
(≈ 411 → ≈ 150 kB). The real numbers will differ by a few percent after Rolldown
regroups the chunks.

### Looked at, not proposed

- **React DOM (62.8 kB gzip).** It is necessary. A swap to Preact would save about 50 kB (unconfirmed),
  but it changes the renderer under the whole app (React 19 compatibility unconfirmed). Not worth
  it before slices 1–5.
- **`teams.js` JSON tables (`teams-*.js`, 24.8 kB gzip).** `route.js` needs `teams.js` for
  the matchup slugs, and the logo and treatment tables serve the slate cards. A split of
  `mlb-treatment-tuning.json` (33.5 kB pre-minify) out of `teams.js` might save ≈ 5–8 kB
  gzip: **unconfirmed**, not simulated. A later audit could look at it.
- **`milbColors` (8.1 kB gzip).** It compresses well, and many first-load modules import it.
- **The `__vite__mapDeps` list (11.7 kB raw, about 3 kB gzip, unconfirmed).** It grows
  with the number of chunks. It is Vite's mechanism; leave it.

## 4. The entry CSS (531.0 kB raw / 84.8 kB gzip)

- **Coverage on `/` at 390 px:** **65.5 of 531.0 kB (12.3%)** of the stylesheet's bytes
  are in ranges Chromium marked used. The top-level rules that were touched at all
  hold 85.5 kB, and the rules never used hold 449.7 kB. Coverage measures one page state
  (today's post–World Series slate). Hover, open sheets, and other seasons use more,
  so 12% is a lower bound for `/`.
- **Where it comes from:** 147 source files. Most are `@import`s in `src/index.css`. The
  other 19 are CSS that entry-chunk JS modules import (the World Series and postseason
  components), so they leave with slice A. Largest source folders: `styles/system`
  (108 kB source, shared, keep), `styles/scorecard` (73 kB), `styles/worldseries` (58 kB),
  `styles/postseason` (49 kB), `styles/motion` (43 kB), `styles/offseason` (38 kB).
- **Largest unused blocks on `/`** (first class name before `-`/`_`): `.sc` (scorecard)
  25.6 kB, `.ww` (wire) 25.3 kB unused / 9.2 kB used, `.psseries` 23.9 kB, `.bs` (box
  score) 16.2 kB, `.gamecard` 15.0 kB (states not on screen today), `.pbkt` (bracket)
  8.7 kB, `.mytally` 7.5 kB, `.hitchart` 6.2 kB, `.pregameboard` 5.5 kB, `.pcard` 5.4 kB,
  `.pbp` 5.3 kB, `.winprob` 5.2 kB.
- **Proposals:** CSS-1 and CSS-2 above, plus the ≈ 14 kB that leaves with slice A. Together
  that is about 37 kB gzip, so the entry CSS goes from ≈ 85 to ≈ 48 kB gzip (estimate:
  minified source, comments stripped, joined gzip). A per-route CSS split of
  `styles/motion/*` (2.5 kB gzip) is too small to be worth the cascade risk.

## Spoiler rule

The audit changed nothing. These proposed slices touch the four scoring surfaces:
**A, E, CSS-2** (the slate page; not the score cells' logic), **B** (reveal persistence
used by the lineup pages and innings viewer), and **CSS-1** (box score and innings viewer
styling). None of them moves a call to a reveal-only module. Any PR that builds one must
keep every `linescore.js`/`derive.js`/`hitchart.js` call inside its `SealBox` reveal
function (ADR-0001, ADR-0002). Code splitting changes when code downloads, not when it
runs. One fact for whoever builds B: today the slate's static graph includes `derive.js`
and `linescore.js` (through `PickedGame → useRevealProgress`). That is allowed, since
importing is not calling, but B removes it.

## Files here

- `vite.measure.config.mjs`: the build config with the graph dump.
- `attribute.mjs`, `analyze.mjs`, `why.mjs`, `simulate.mjs`: module sizes, chains, slices.
- `measure-routes.mjs`, `css-coverage.mjs`: Chromium per-route and coverage runs.
- `out/` (not committed): the generated JSON and the screenshot. Rerun the scripts to
  get them again.
