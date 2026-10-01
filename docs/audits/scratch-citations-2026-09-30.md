# `.scratch/` citation report (issue #1304, report only)

Checked on `origin/main` **f5a7e675a** (2026-09-30). This report deletes nothing and edits nothing in `.scratch/`.
It counts **tracked** files only: 2,510 files, 152.6 MB. Untracked `.scratch/` folders on the owner's laptop are not visible to this check, so they are not in any number here.

## The three numbers

| Verdict | Files | MB | Meaning |
| --- | ---: | ---: | --- |
| **keep** | 332 | 129.9 | The file itself is registered in `scripts/research-db.mjs`, cited by exact path (or by a folder or name prefix that covers it) from a tracked file outside `.scratch/`, imported, or named by a kept file. |
| **ask** | 2,153 | 22.4 | Nothing names this file, but its folder is named somewhere, so the folder rule keeps it alive. Needs your decision. |
| **safe to delete** | 25 | 0.3 | No file outside `.scratch/` names the file or its folder, and nothing imports it. |

- Of the **ask** row, 80 files (4.7 MB) sit in `homefeed/`. Only the research-db catalog names that folder (`scripts/data/research-db-panels.json` and `docs/agents/research-database.md`), and it calls it "design canvas file for a page mock-up". No shipped code, doc or test cites it. It is the one folder with no other citer.
- Strict reading of your rule ("a folder name cited means live"): the **ask** row counts as live, so **keep** would be 2,485 files and 152.3 MB.
- **PNG and HTML only:** 1,818 files, 20.6 MB. Of these, 24 are keep, 1 is safe to delete, and the rest are ask.

## What stands out

1. **Most of the weight is live.** 103 JSON files (118.1 MB) are registered as DuckDB views. That alone is 77% of the bytes. Three folders hold 108.9 MB: `level-benchmarks`, `team-success` and `prospect-traits`. None of these can go without breaking `node scripts/research-db.mjs` or the views in `docs/agents/research-database.md`.
2. **The PNG pile is one folder.** 1,714 of the 1,733 PNG files live under `.scratch/design-system/`. `pill-collapse/` alone holds 1,586 files. Only a few shots are cited by path: `prB/wrapshots/` and `prC/shots/`.
3. **Shipped code cites 46 distinct tracked `.scratch` files by path** (92 files in `src/`, `scripts/` and `api/` cite a `.scratch` path). Often a comment points at a plan or PRD as the reason for behavior.
4. **173 imports** in 113 `.scratch` files reach into `src/` or `scripts/`. No import target is missing today. See section 2.
5. **Some citations already point at nothing.** Four paths that shipped code or docs name are not tracked (section 5). One of them, `.scratch/manager-detail-page/plan.md`, is cited from three shipped files.
6. **A guard reads `.scratch/`.** `scripts/check-statsapi-client.mjs` scans every `.mjs`, `.cjs` and `.js` file under `.scratch/` and keeps a list of allowed exceptions by path. Deleting a listed file means editing that list.

## How this was measured

- **Citation.** Any tracked file outside `.scratch/` that holds the text `.scratch/<folder>` or `.scratch/<folder>/<path>`, a `join('.scratch', '<folder>', ...)` call, or `scratch/<folder>` without the dot. A folder cite covers the folder. A path cite covers that file, or every file under it. A glob (`verdicts-*.json`) or a cut-off name (`issues/04`) covers every file it matches. Searched: all tracked files, including `src/`, `api/`, `scripts/`, `docs/`, `test/`, `e2e/`, `.github/`, `.claude/`, every `CLAUDE.md`, `package.json` and `.gitignore`.
- **Catalog lines do not make a file keep.** `scripts/data/research-db-panels.json` (its `skipped` list) and `docs/agents/research-database.md` name paths to say they are NOT views. Those lines count for the folder test (so a file is ask, not safe) but not as a file-level cite. `docs/audits/` reports are treated the same way.
- **Registered** means a path or glob in the `panels` list of `scripts/data/research-db-panels.json`, or a path written in `scripts/research-db.mjs`. 107 patterns match 103 tracked files.
- **Imported** means a relative `import`, `import()` or `require` in a file that is itself keep (or outside `.scratch/`). **Named by a kept file** means a relative path, such as `<img src>`, in a kept file that resolves to the file.
- Names that only appear inside other `.scratch` files (a sheet or manifest that lists its own shots) are NOT used as evidence. One real exception: `top-prospects-history/fixtures/2015-sample.html`, which `parse.test.mjs` reads through `join(here, 'fixtures', ...)`. It is marked keep by hand.
- Earlier figures, checked again: the 2026-09-16 note said about 103 MB of JSON is registered. **Measured today: 103 files and 118.1 MB.** The file count matches; the size does not. It said about 34 paths are cited by shipped code. **Measured today: 46 distinct tracked files**, counting citations from `src/`, `api/` and `scripts/` but not the catalog file. The count is higher because this scan counts every comment, including ones that only point at a note, not only comments that explain behavior.

## 1. Citation table, by folder

"Cited by" counts tracked files outside `.scratch/` that name the folder or something in it, and lists the first three. "Catalog" means only the research-db catalog names it. "Research-db" says whether `research-db.mjs` registers files in the folder (`yes`, with the file count), lists them as skipped (`skip list`), or neither (`no`).

| Folder | Size | Tracked files | Cited by (count, first 3) | Research-db | keep / ask / safe |
| --- | ---: | ---: | --- | --- | --- |
| `abs-aaa-gate` | 22 KB | 11 | 4: `docs/adr/0068-the-challenge-row-gates-on-a-pregame-key-never-on-play-data.md`, `docs/test-games.md`, `src/api/challenges.js` | no | 2 / 9 / 0 |
| `abs-challenges` | 8 KB | 3 | 0 | no | 0 / 0 / 3 |
| `abs-reports` | 201 KB | 46 | 4: `.gitignore`, `docs/abs-challenges.md`, `docs/duplicate-derivations.md` | skip list (9) | 5 / 41 / 0 |
| `account-profile-experience` | 111 KB | 2 | 1: `docs/adr/0039-my-tally-preferences-document.md` | no | 2 / 0 / 0 |
| `blockage` | 654 KB | 19 | 4: `.gitignore`, `docs/price-the-blockage.md`, `docs/team-success-exit-reason-mix.md` | yes (7) | 10 / 9 / 0 |
| `box-lines` | 8 KB | 1 | 0 | no | 0 / 0 / 1 |
| `caps-invariant-specificity` | 3 KB | 1 | 0 | no | 0 / 0 / 1 |
| `club-live-overlay` | 12 KB | 5 | 2: `docs/transactions-wire.md`, `scripts/check-statsapi-client.mjs` | no | 2 / 3 / 0 |
| `contracts` | 2.22 MB | 4 | 3: `.gitignore`, `docs/contracts-arbitration-warp.md`, `scripts/gen-contracts-season-players.mjs` | yes (2) | 4 / 0 / 0 |
| `contracts-extensions` | 1.28 MB | 6 | 1: `docs/contracts-extension-value.md` | yes (2) | 6 / 0 / 0 |
| `design-system` | 17.75 MB | 1,891 | 14: `.claude/skills/start-day/SKILL.md`, `docs/adr/0083-kraft-amber-means-sealed-and-nothing-else.md`, `docs/adr/0084-a-block-is-named-for-its-job-never-its-shape.md` | skip list (1891) | 56 / 1835 / 0 |
| `dev-environment` | 4 KB | 1 | 1: `.claude/hooks/session-start.sh` | no | 1 / 0 / 0 |
| `express-lane` | 32 KB | 1 | 2: `src/api/CLAUDE.md`, `src/api/expresslane/rail.js` | no | 1 / 0 / 0 |
| `farm-digest` | 54 KB | 2 | 0 | no | 0 / 0 / 2 |
| `fever-radar-home-surface` | 6 KB | 1 | 0 | no | 0 / 0 / 1 |
| `focus-mode` | 4 KB | 1 | 0 | no | 0 / 0 / 1 |
| `game-notes` | 73 KB | 15 | 7: `.gitignore`, `docs/adr/0021-sqlite-data-layer.md`, `docs/api/static-data.md` | yes (1) | 14 / 1 / 0 |
| `game-over-indicator` | 3 KB | 1 | 1: `docs/enhancement-proposals.md` | no | 1 / 0 / 0 |
| `game-photos-by-subject` | 9 KB | 2 | 3: `docs/api/static-data.md`, `src/components/player/PlayerPhotosRail.jsx`, `src/screens/team/modules/media/TeamPhotosRail.jsx` | no | 2 / 0 / 0 |
| `game-stamps` | 187 KB | 7 | 5: `docs/adr/0035-logbook-stamps-are-gated-by-the-reveal-mark.md`, `docs/adr/0036-the-logbook-is-a-passport-book-you-arrange-by-hand.md`, `docs/game-log.md` | no | 7 / 0 / 0 |
| `gamecard-team-colors` | 4 KB | 1 | 3: `src/components/game/GameCardParts.jsx`, `src/lib/teams.js`, `src/styles/06-loader-and-cards.css` | no | 1 / 0 / 0 |
| `highlights-cascade` | 83 KB | 5 | 8: `docs/api/live-game.md`, `docs/scripts/generators.md`, `scripts/gen-highlights.mjs` | no | 3 / 2 / 0 |
| `home-transactions` | 285 KB | 25 | 9: `docs/adr/0058-a-windowed-feed-selects-on-the-date-a-move-took-effect.md`, `docs/transactions-wire.md`, `scripts/check-statsapi-client.mjs` | no | 12 / 13 / 0 |
| `homefeed` | 4.66 MB | 80 | 0 (catalog only: `research-database.md`, `research-db-panels.json`) | skip list (75) | 0 / 80 / 0 |
| `identity-admin-drawer` | 6 KB | 1 | 1: `docs/adr/0054-a-precomputed-store-can-carry-a-runtime-override-too.md` | no | 1 / 0 / 0 |
| `level-benchmarks` | 51.05 MB | 60 | 12: `.claude/hooks/research-diary-reminder.mjs`, `.gitignore`, `docs/agents/research-diary.md` | yes (31) | 47 / 13 / 0 |
| `lineup-strength` | 19 KB | 2 | 4: `docs/callouts.md`, `docs/scripts/generators.md`, `scripts/gen-war.mjs` | no | 1 / 1 / 0 |
| `live-feed-diffpatch` | 9 KB | 4 | 4: `docs/adr/0032-diffpatch-feed-polling-for-follow-live.md`, `scripts/probe-diffpatch.mjs`, `src/api/game.js` | skip list (4) | 4 / 0 / 0 |
| `live-follow-and-scores-unlocked` | 48 KB | 2 | 0 | no | 0 / 0 / 2 |
| `metric-engines` | 61 KB | 5 | 9: `docs/api/static-data.md`, `scripts/gen-fouls.mjs`, `scripts/gen-workload.mjs` | no | 4 / 1 / 0 |
| `mets-interim-manager` | 2 KB | 1 | 0 | no | 0 / 0 / 1 |
| `milb-team-colors` | 5 KB | 1 | 2: `docs/scripts/generators.md`, `src/lib/CLAUDE.md` | no | 1 / 0 / 0 |
| `milb-wire` | 3 KB | 1 | 2: `src/api/transactions/leagueFeed.js`, `test/home-transactions.test.js` | no | 1 / 0 / 0 |
| `milestone-watch` | 18 KB | 1 | 1: `docs/enhancement-proposals.md` | no | 1 / 0 / 0 |
| `offseason-design` | 766 KB | 38 | 3: `.gitignore`, `docs/adr/0078-a-league-ships-only-if-its-data-cannot-make-the-app-state-something-false.md`, `src/lib/winter/leagues.js` | skip list (38) | 25 / 13 / 0 |
| `page-turn-full-screen` | 8 KB | 1 | 0 | no | 0 / 0 / 1 |
| `pbp-scoring-review` | 13 KB | 6 | 5: `docs/unresolved-scoring-conventions.md`, `src/components/inning/EnteringReference.jsx`, `test/pinch-hitter-notice.test.js` | no | 5 / 1 / 0 |
| `placed-runner-card` | 14 KB | 1 | 1: `docs/api/live-game.md` | no | 1 / 0 / 0 |
| `player-ovr` | 3 KB | 1 | 0 | no | 1 / 0 / 0 |
| `player-profile-card` | 19 KB | 1 | 3: `docs/api/static-data.md`, `src/lib/pitcherSimilarity.js`, `test/pitcher-similarity.test.js` | no | 1 / 0 / 0 |
| `pr-655-prospect-desk` | 14 KB | 1 | 0 | no | 0 / 0 / 1 |
| `prospect-traits` | 25.20 MB | 27 | 5: `.claude/hooks/research-diary-reminder.mjs`, `docs/agents/research-diary.md`, `docs/agents/writing-style.md` | yes (14) | 16 / 11 / 0 |
| `prospect-value` | 4.76 MB | 7 | 3: `.claude/hooks/research-diary-reminder.mjs`, `docs/prospect-ranking-value.md`, `docs/service-clock-pedigree-grain.md` | yes (4) | 5 / 2 / 0 |
| `rookie-crossover` | 4 KB | 1 | 0 | no | 0 / 0 / 1 |
| `savant-matchup-callouts` | 35 KB | 2 | 0 | no | 0 / 0 / 2 |
| `savant-percentiles` | 15 KB | 1 | 3: `docs/enhancement-proposals.md`, `scripts/gen-savant-percentiles.mjs`, `src/components/charts/StatcastPercentiles.jsx` | no | 1 / 0 / 0 |
| `scored-by-inning` | 2 KB | 1 | 0 | no | 0 / 0 / 1 |
| `scorekeeper-review` | 10 KB | 1 | 0 | no | 0 / 0 / 1 |
| `season-score` | 15 KB | 1 | 0 | no | 0 / 0 / 1 |
| `seo-landing-pages` | 39 KB | 2 | 0 | no | 0 / 0 / 2 |
| `service-clock` | 4.92 MB | 26 | 4: `.gitignore`, `docs/duplicate-derivations.md`, `docs/service-clock-pedigree-grain.md` | yes (9) | 11 / 15 / 0 |
| `service-clock-pedigree` | 2.68 MB | 13 | 1: `docs/service-clock-pedigree-grain.md` | yes (5) | 5 / 8 / 0 |
| `starter-matchups` | 3 KB | 1 | 0 | no | 0 / 0 / 1 |
| `table-name-wrap` | 4 KB | 1 | 0 | no | 0 / 0 / 1 |
| `team-identity-lab` | 106 KB | 10 | 0 | no | 1 / 9 / 0 |
| `team-one-scroll` | 1.96 MB | 74 | 2: `docs/adr/0082-the-team-page-is-one-scroll-of-named-bands.md`, `scripts/check-statsapi-client.mjs` | skip list (62) | 4 / 70 / 0 |
| `team-page-ia` | 39 KB | 9 | 11: `e2e/team-hub-tabs.spec.js`, `src/App.jsx`, `src/lib/route.js` | no | 4 / 5 / 0 |
| `team-scores` | 11 KB | 1 | 0 | no | 0 / 0 / 1 |
| `team-success` | 32.64 MB | 52 | 26: `.claude/hooks/contender-diary-reminder.mjs`, `.gitignore`, `docs/agents/contender-diary.md` | yes (25) | 52 / 0 / 0 |
| `team-transactions` | 60 KB | 3 | 6: `docs/transactions-wire.md`, `scripts/gen-team-transactions.mjs`, `src/api/teamTransactions.js` | no | 2 / 1 / 0 |
| `top-prospects-history` | 225 KB | 8 | 10: `.claude/hooks/research-diary-reminder.mjs`, `docs/prospect-ranking-value.md`, `docs/scripts/generators.md` | yes (3) | 5 / 3 / 0 |
| `umpire-accuracy` | 25 KB | 2 | 11: `docs/api/live-game.md`, `docs/enhancement-proposals.md`, `docs/scripts/generators.md` | no | 2 / 0 / 0 |
| `umpire-tendencies` | 87 KB | 6 | 3: `scripts/gen-umpire-accuracy.mjs`, `src/components/umpire/UmpireTendencies.jsx`, `src/styles/53-umpire-tendencies.css` | no | 1 / 5 / 0 |
| `video-highlights` | 18 KB | 3 | 2: `docs/api/live-game.md`, `src/api/highlights.js` | no | 1 / 2 / 0 |

Totals: 64 folders, 2,510 files, 152.6 MB.

## 2. What `.scratch/` code imports from `src/` or `scripts/`

173 relative imports, from 113 `.scratch` files in 19 folders, reach 29 modules. All 29 targets exist today. If you move or rename one, the builders below break. No file outside `.scratch/` imports `.scratch/` code, and `npm test` and `npm run build` do not run these builders. Only a person running a builder would see it break.

### By `.scratch` folder

| Folder | Builder files | Modules imported from `src/` or `scripts/` |
| --- | ---: | --- |
| `level-benchmarks` | 22 | `scripts/lib/concurrency.mjs`, `scripts/lib/statsapi.mjs`, `src/api/rehab-policy.js`, `src/api/statsLevels.js`, `src/lib/shardKey.js` |
| `abs-reports` | 16 | `scripts/lib/db.js`, `scripts/lib/statsapi.mjs` |
| `home-transactions` | 13 | `scripts/lib/statsapi.mjs`, `src/api/rehab-policy.js`, `src/api/teamTransactions.js`, `src/api/transactions/league.js`, `src/lib/data/mlb-team-colors.json` |
| `offseason-design` | 11 | `scripts/lib/statsapi.mjs` |
| `team-success` | 11 | `scripts/lib/csv.mjs`, `scripts/lib/statsapi.mjs`, `src/lib/contracts/clubCodes.js`, `src/lib/contracts/parseMoney.js`, `src/lib/contracts/positions.js`, `src/lib/teams.js` |
| `abs-aaa-gate` | 10 | `scripts/lib/statsapi.mjs`, `src/api/challenges.js` |
| `blockage` | 4 | `scripts/lib/statsapi.mjs` |
| `design-system` | 4 | `src/components/admin/contracts/CandidateList.jsx`, `src/components/admin/contracts/LookupDeck.jsx`, `src/components/ui/control/Button.jsx`, `src/index.css`, `src/lib/design/contrastPairings.js`, `src/styles/62-identity-admin.css`, `src/styles/74-contract-workbench.css` |
| `club-live-overlay` | 3 | `scripts/lib/statsapi.mjs`, `src/api/teamTransactions.js`, `src/api/transactions/clubFeed.js`, `src/api/transactions/leagueFeed.js` |
| `contracts-extensions` | 3 | `scripts/lib/csv.mjs`, `src/lib/contracts/parseMoney.js`, `src/lib/contracts/positions.js`, `src/lib/shardKey.js` |
| `game-notes` | 3 | `src/api/whatsBrewing.js` |
| `prospect-traits` | 3 | `scripts/lib/concurrency.mjs`, `scripts/lib/statsapi.mjs`, `src/api/rehab-policy.js`, `src/lib/shardKey.js` |
| `prospect-value` | 2 | `scripts/lib/csv.mjs`, `scripts/lib/statsapi.mjs`, `src/lib/contracts/parseMoney.js`, `src/lib/contracts/positions.js` |
| `service-clock` | 2 | `scripts/lib/statsapi.mjs` |
| `top-prospects-history` | 2 | `scripts/lib/csv.mjs`, `scripts/lib/io.js` |
| `abs-challenges` | 1 | `scripts/lib/statsapi.mjs`, `src/api/challenges.js` |
| `contracts` | 1 | `scripts/lib/csv.mjs`, `src/lib/contracts/clubCodes.js`, `src/lib/contracts/parseMoney.js`, `src/lib/contracts/positions.js` |
| `rookie-crossover` | 1 | `scripts/lib/io.js`, `scripts/lib/rookie-crossing.mjs`, `scripts/lib/rookie-shards.mjs`, `scripts/lib/statsapi.mjs` |
| `team-one-scroll` | 1 | `src/api/situationalRecordRankings.js` |

### By imported module (most shared first)

| Module | `.scratch` files that import it | From folders |
| --- | ---: | --- |
| `scripts/lib/statsapi.mjs` | 79 | `abs-aaa-gate`, `abs-challenges`, `abs-reports`, `blockage`, `club-live-overlay`, `home-transactions`, `level-benchmarks`, `offseason-design`, `prospect-traits`, `prospect-value`, `rookie-crossover`, `service-clock`, `team-success` |
| `scripts/lib/db.js` | 11 | `abs-reports` |
| `src/api/rehab-policy.js` | 9 | `home-transactions`, `level-benchmarks`, `prospect-traits` |
| `scripts/lib/concurrency.mjs` | 7 | `level-benchmarks`, `prospect-traits` |
| `src/api/teamTransactions.js` | 7 | `club-live-overlay`, `home-transactions` |
| `scripts/lib/csv.mjs` | 5 | `contracts`, `contracts-extensions`, `prospect-value`, `team-success`, `top-prospects-history` |
| `src/api/transactions/league.js` | 5 | `home-transactions` |
| `src/lib/contracts/parseMoney.js` | 5 | `contracts`, `contracts-extensions`, `prospect-value`, `team-success` |
| `src/api/challenges.js` | 4 | `abs-aaa-gate`, `abs-challenges` |
| `src/lib/contracts/positions.js` | 4 | `contracts`, `contracts-extensions`, `prospect-value`, `team-success` |
| `src/lib/data/mlb-team-colors.json` | 4 | `home-transactions` |
| `scripts/lib/io.js` | 3 | `rookie-crossover`, `top-prospects-history` |
| `src/api/transactions/leagueFeed.js` | 3 | `club-live-overlay` |
| `src/api/whatsBrewing.js` | 3 | `game-notes` |
| `src/index.css` | 3 | `design-system` |
| `src/lib/shardKey.js` | 3 | `contracts-extensions`, `level-benchmarks`, `prospect-traits` |
| `src/api/statsLevels.js` | 2 | `level-benchmarks` |
| `src/lib/contracts/clubCodes.js` | 2 | `contracts`, `team-success` |
| `src/lib/teams.js` | 2 | `team-success` |
| `scripts/lib/rookie-crossing.mjs` | 1 | `rookie-crossover` |
| `scripts/lib/rookie-shards.mjs` | 1 | `rookie-crossover` |
| `src/api/situationalRecordRankings.js` | 1 | `team-one-scroll` |
| `src/api/transactions/clubFeed.js` | 1 | `club-live-overlay` |
| `src/components/admin/contracts/CandidateList.jsx` | 1 | `design-system` |
| `src/components/admin/contracts/LookupDeck.jsx` | 1 | `design-system` |
| `src/components/ui/control/Button.jsx` | 1 | `design-system` |
| `src/lib/design/contrastPairings.js` | 1 | `design-system` |
| `src/styles/62-identity-admin.css` | 1 | `design-system` |
| `src/styles/74-contract-workbench.css` | 1 | `design-system` |

### Reads by path string (not an `import`)

These `.scratch` files name a `src/` or `scripts/` file in a string, for example to read it as text.

| `.scratch` file | Names | Exists |
| --- | --- | --- |
| `.scratch/design-system/card-collapse/census.mjs` | `scripts/check-seal-scope.mjs` | yes |
| `.scratch/design-system/card-collapse/census.mjs` | `scripts/check-stamp-surfaces.mjs` | yes |
| `.scratch/design-system/pill-collapse/census.mjs` | `scripts/check-seal-scope.mjs` | yes |
| `.scratch/design-system/pill-collapse/census.mjs` | `scripts/check-stamp-surfaces.mjs` | yes |
| `.scratch/design-system/prD/build-ledger.mjs` | `scripts/check-seal-scope.mjs` | yes |
| `.scratch/level-benchmarks/perf-pull.mjs` | `src/api/statsLevels.js` | yes |
| `.scratch/team-success/build-free-agency-market.mjs` | `scripts/lib/csv.mjs` | yes |
| `.scratch/team-success/build-free-agency-market.mjs` | `src/lib/contracts/parseMoney.js` | yes |
| `.scratch/team-success/build-free-agency-market.mjs` | `src/lib/contracts/positions.js` | yes |
| `.scratch/team-success/build-free-agency-market.mjs` | `src/lib/contracts/clubCodes.js` | yes |

### Other relative imports (outside `src/` and `scripts/`)

- `node_modules/pdfjs-dist/legacy/build/pdf.mjs`: 6 files (`.scratch/game-notes/column-scan.mjs`, `.scratch/game-notes/dropped-names-scan.mjs`, `.scratch/game-notes/dump-near.mjs`, ...)
- `public/data/affiliates.json`: 4 files (`.scratch/home-transactions/dump-48h.mjs`, `.scratch/home-transactions/probe-card-fetch.mjs`, `.scratch/home-transactions/probe-card-shape.mjs`, ...)

The other direction: no file outside `.scratch/` imports a `.scratch/` file. Shipped code reaches into `.scratch/` only through comments and through string paths (for example `scripts/gen-prospect-rank-history.mjs` reads `.scratch/top-prospects-history/`, and `scripts/research-db.mjs` reads the registered JSON).

## 3. PNG and HTML files nothing cites

1,818 PNG and HTML files in total (20.6 MB). **24 are cited or named by a kept file. 1,794 are not cited at file level** (18.2 MB): 1 safe to delete, 1,793 ask. Other image kinds (46 SVG, 22 JPG) are not broken out here. They count in the three numbers.

| Folder | PNG (files, MB) | HTML (files, MB) | Cited or kept | Not cited | Verdict for the not-cited files |
| --- | --- | --- | ---: | --- | --- |
| `abs-reports` | 0 / 0.00 | 8 / 0.08 | 0 | 8 / 0.08 MB | ask |
| `design-system` | 1714 / 13.76 | 3 / 0.00 | 11 | 1706 / 11.74 MB | ask |
| `farm-digest` | 0 / 0.00 | 1 / 0.04 | 0 | 1 / 0.04 MB | safe to delete |
| `game-stamps` | 0 / 0.00 | 1 / 0.12 | 1 | 0 / 0.00 MB | (all cited or kept) |
| `homefeed` | 9 / 0.10 | 19 / 4.15 | 0 | 28 / 4.25 MB | ask |
| `offseason-design` | 6 / 0.50 | 12 / 0.19 | 10 | 8 / 0.54 MB | ask |
| `team-one-scroll` | 4 / 0.33 | 38 / 1.23 | 0 | 42 / 1.56 MB | ask |
| `team-transactions` | 0 / 0.00 | 1 / 0.03 | 1 | 0 / 0.00 MB | (all cited or kept) |
| `top-prospects-history` | 0 / 0.00 | 1 / 0.00 | 1 | 0 / 0.00 MB | (all cited or kept) |
| `umpire-tendencies` | 0 / 0.00 | 1 / 0.02 | 0 | 1 / 0.02 MB | ask |

### Why each `ask` is ask

- `design-system`: 1,706 shots. The folder is cited by 14 files, but only `inventory.md`, `inventory.mjs`, `fable-critique.md`, `prB/`, `prC/`, `prD/ledger.md`, `prD/build-ledger.mjs`, `pill-collapse/map.md` and `card-collapse/census.*` are named. The rest is before and after proof: `pill-collapse/` 1,504, `button-collapse/` 157, `card-c2-followup-1257/` 42, and small sets in `prA/`, `prD/`, `critique-shots/`, `card-collapse/`. The catalog lists the whole folder as "UI measurement output, no research question". Needs your call on whether closed-PR proof shots stay in git.
- `abs-reports`: 8 `.dc.html` design canvases in `design/`. Only the catalog names `design/` ("design canvas file for a page mock-up"). `.gitignore` names one other file there, the seeded canvas it already ignores. Docs, a test fixture and `.gitignore` cite the folder's scripts and JSON, so only `design/` is in question.
- `homefeed`: 28 canvas mocks (19 HTML, 9 PNG) in `canvas/`, about 4.3 MB. Only the catalog names `canvas/`. No shipped code cites the folder.
- `offseason-design`: 6 PNG mocks and 2 HTML files (`index.html`, `research.html`) at the folder root. Shipped code cites `probes/` (`src/lib/winter/leagues.js`, ADR-0078), not these. The 10 `canvas/*.dc.html` files are kept only because `canvas/README.md` (cited by a `.gitignore` comment) names them. That is a thin reason.
- `team-one-scroll`: 42 mocks in `canvas/` (32 in `project/`, 6 in `records/boards/`, 4 review PNG). ADR-0082 cites `scope.md`, and `check-statsapi-client.mjs` cites `count-requests.mjs`. Nothing cites `canvas/`. The catalog lists it as "design canvas files".
- `umpire-tendencies`: `mock.html` is the companion to `design-notes.md`. Shipped code cites `PRD.md` in the same folder, not the mock.
- `top-prospects-history`: `fixtures/2015-sample.html` is kept by hand, because `parse.test.mjs` reads it (see "How this was measured").

Only one folder holds a file with no citation of the file **or** the folder: `.scratch/farm-digest/wireframes.html` (36 KB). `farm-digest/HANDOFF.md` beside it is also uncited.

### The 20 largest PNG and HTML files nothing cites

| # | File | Size | Verdict |
| ---: | --- | ---: | --- |
| 1 | `.scratch/homefeed/canvas/tally-game-feed.html` | 3.45 MB | ask |
| 2 | `.scratch/design-system/pill-collapse/s4/pairs.png` | 651 KB | ask |
| 3 | `.scratch/design-system/pill-collapse/s4/pairs--focus.png` | 232 KB | ask |
| 4 | `.scratch/design-system/pill-collapse/s4/pairs--rest.png` | 223 KB | ask |
| 5 | `.scratch/design-system/pill-collapse/s4/pairs--hover.png` | 196 KB | ask |
| 6 | `.scratch/design-system/pill-collapse/s4/pairs--pressed.png` | 195 KB | ask |
| 7 | `.scratch/design-system/prA/shots/crop-sheet-compare.png` | 185 KB | ask |
| 8 | `.scratch/design-system/pill-collapse/s5/pairs.png` | 155 KB | ask |
| 9 | `.scratch/design-system/button-collapse/montage-pairs-rest.png` | 147 KB | ask |
| 10 | `.scratch/design-system/card-c2-followup-1257/after/awards-741.png` | 133 KB | ask |
| 11 | `.scratch/design-system/card-c2-followup-1257/before/awards-741.png` | 133 KB | ask |
| 12 | `.scratch/design-system/card-c2-followup-1257/after/awards-739.5.png` | 128 KB | ask |
| 13 | `.scratch/design-system/card-c2-followup-1257/after/awards-740.png` | 128 KB | ask |
| 14 | `.scratch/design-system/card-c2-followup-1257/before/awards-739.5.png` | 128 KB | ask |
| 15 | `.scratch/design-system/card-c2-followup-1257/before/awards-740.png` | 128 KB | ask |
| 16 | `.scratch/design-system/prA/shots/crop-ink-compare.png` | 123 KB | ask |
| 17 | `.scratch/design-system/pill-collapse/s4/pairs--selected.png` | 114 KB | ask |
| 18 | `.scratch/team-one-scroll/canvas/review/04-records-open-158.png` | 108 KB | ask |
| 19 | `.scratch/team-one-scroll/canvas/project/P2-Page-675.dc.html` | 107 KB | ask |
| 20 | `.scratch/offseason-design/b-desktop.png` | 104 KB | ask |

## 4. Lines that describe `.scratch/` today

Not edited. "Right" means it matches the tracked tree on this commit.

| Where | What it says | Verdict |
| --- | --- | --- |
| `CLAUDE.md:190-191` | "`.scratch/<slug>/` holds working notes, not the tracker." | **Right.** It leaves out that `.scratch/` also holds data that code reads (research-db views) and notes that code comments cite. |
| `docs/agents/issue-tracker.md:4-7` | `.scratch/` used to hold issues. Some folders still hold migrated originals, which are history. A line "(Migrated from .scratch/...)" in an issue body points back. | **Mostly right.** 16 tracked folders still have an `issues/` folder. I found no "Migrated from" text in tracked `.scratch/` files, and I did not read GitHub issue bodies. So I could not confirm the pointer lines. |
| `docs/agents/issue-tracker.md:9-11, 20` | `.scratch/<feature-slug>/` is the place for working notes, PRDs, scope documents and maps. Long context is linked from the issue. | **Right.** |
| `docs/agents/issue-tracker.md:38-41` | Wayfinding: map at `.scratch/<effort>/map.md`, child tickets at `.scratch/<effort>/issues/NN-<slug>.md`. | **Not matched by the tracked tree.** The `issues/NN-` shape exists in 16 folders. No folder has `.scratch/<effort>/map.md`. The only tracked `map.md` is `.scratch/design-system/pill-collapse/map.md`. |
| `.claude/skills/start-day/SKILL.md:102-106` | "`.scratch` is load-bearing: code comments cite its notes and `scripts/research-db.mjs` reads its JSON." | **Right.** Matches this report. It also says to keep untracked `.md`, `.json` and `.mjs` files in `.scratch/<slug>/`, and treats before and after PNGs as disposable. Both match. |
| `docs/duplicate-derivations.md:13` | "`.scratch/*/`: research spikes." | **Right, but thin.** Part of `.scratch/` is design mocks, proof shots, PRDs and cached data, not spikes. |
| `docs/agents/research-database.md:295` | `design-system/`, `abs-reports/design/`, `homefeed/canvas/`, `offseason-design/`, `team-one-scroll/canvas/` hold "design and probe output, no research question". | **Right.** This is the only place that already names the canvas and proof-shot folders as not research. |
| `scripts/CLAUDE.md:103, 198` and `scripts/check-statsapi-client.mjs` | `.scratch/` scripts must use the shared statsapi client. The guard scans `.scratch/` and lists exceptions by path. | **Right.** Deleting a listed file means editing the list. |
| `.gitignore:37-71` | Ignores cached dumps and a few folders under `.scratch/` (`game-notes/pdfs`, `mono-logos`, `callout-audit`, `blockage/*-cache.json`, and more). | **Right.** Those paths are not tracked, so they are not in any number above. |

## 5. Citations that point at nothing

Cited from tracked files, but not tracked in `.scratch/` and not ignored by `.gitignore`. They may exist only on your laptop, or they were never committed. Not fixed here.

| Path | Cited from |
| --- | --- |
| `.scratch/manager-detail-page/plan.md` | `scripts/gen-manager-history.mjs:4`, `src/api/managers.js:15`, `src/screens/ManagerPage.jsx:24` |
| `.scratch/bvp-matchup-card/plan.md` | `docs/enhancement-proposals.md:73` (asks for the plan to be written there) |
| `.scratch/my-scorebook-shelf/plan.md` | `docs/enhancement-proposals.md:147` (asks for the plan to be written there) |
| `.scratch/team-success/analyze-joint-model.mjs` | `docs/team-success-joint-model.md:285` |

The other untracked names that shipped code or docs mention are covered by `.gitignore` (for example `blockage/*-cache.json`, `level-benchmarks/txn-cache.json`, `research.duckdb`, `mono-logos/`). Three more (`.scratch/a.mjs`, `.scratch/x/pull.mjs`, `.scratch/spike/pull.mjs`) are sample paths inside `test/statsapi-client-guard.test.js`, not real files.

## What this report did not do

- It did not delete, move or edit any `.scratch/` file.
- It cannot see untracked `.scratch/` folders on your laptop.
- It did not open GitHub issue or PR bodies, so a `.scratch/` path cited only there is not counted.
- Dynamic paths built at run time (`join('.scratch', dir, name)` with a variable) are only caught when the folder is a string. The code cites found this way are included.

