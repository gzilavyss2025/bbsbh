# scripts — build/precompute generators and guards

Node `.mjs` scripts: the `gen-*.mjs` generators that precompute the static JSON the
app reads at runtime (the **build-time-fetch pattern**, see `src/api/CLAUDE.md`),
plus the lint guards. Most `gen-*.mjs` run on the nightly GitHub Actions cron
(`.github/workflows/update-nightly-data.yml`); a few are hand-run because their data
is immutable. The reader modules are documented in `src/api/CLAUDE.md`; this file
documents the generators.

## Everyday commands

```bash
npm install
npm run dev        # dev server (fixed port 5173, strictPort)
npm run build      # production build → dist/
npm run preview    # serve the built app
npm run lint       # eslint . && check-caps.mjs && check-claude-md.mjs
npm run e2e        # playwright test — verification harness, not a CI suite
```

There is no CI-enforced *test* suite (CI runs lint + build). Verify changes by
running `npm run dev` (or `npm run e2e`, which boots the dev server itself) and
exercising the game-select → team-info → innings flow against a live or recent game.
`docs/test-games.md` has a pack of real, verified gamePks with rare in-game events
(triple play, immaculate inning, position player pitching, suspended/resumed game,
etc.). `.claude/skills/run.md` documents this loop end to end. `e2e/smoke.spec.js` is
the one long-lived example spec; write and delete throwaway specs alongside it.

## The SQLite data layer (`lib/schema.sql`, `lib/db.js`)

`gen-game-score.mjs`, `gen-team-score.mjs`, `gen-season-score.mjs`, and
`gen-postseason-leaders.mjs` write into a shared SQLite database instead of
hand-rolling their own JSON read-merge-write cycle, then export the same JSON
shapes the reader modules already expect — see `docs/adr/0021`. `openDb()`
reconstitutes an in-memory database from committed TEXT
dumps (`scripts/data/*.sql`, plain `INSERT` statements — never a binary `.db`, so
PR diffs stay reviewable); `dumpGroup(db, name)` re-dumps only the table-group a
generator owns. **Dumps are split one file per group, not shared**, because
`game_scores` and `team_snapshots` are written by generators on independently
scheduled crons (every 10 minutes vs. once nightly) — a shared file would let
whichever workflow pushes second silently clobber the other's table with a stale
copy. Add a new table = add a new group in `db.js` + extend `schema.sql`; a new
generator that needs to join against existing tables is the reason this layer
exists, so wire it in rather than adding another bespoke JSON merge. Uses
`node:sqlite` (Node ≥22.5, stable since Node 26) rather than `better-sqlite3` —
the workflows run generators with no `npm install` step, and a built-in avoids
adding install latency to the 10-minute game-score cron. `migrate-json-to-sqlite.mjs`
is the one-time backfill that seeded the dumps from the pre-migration JSON files;
it's not part of any cron.

## Nightly-cron generators (`update-nightly-data.yml`)

Precomputed because they're too heavy (COST) to build on a page load. Normally you
don't run these by hand.

- `gen-war.mjs` → `public/data/war.json` — season WAR per player, from FanGraphs'
  bulk leaderboard API (~1MB, unofficial), plus parallel `pa` (hitter plate
  appearances), `wrc` (wRC+) and `fld` (season fielding runs) maps on the same
  keys. Reads the `type=6` **Value** view, which carries WAR's components
  alongside the total at no extra request; `Fielding` there already includes
  catcher framing (the components sum to WAR, so `CFraming` is NOT additive on
  top). The three extra maps exist because the Lineup Strength grade needs a bat
  and a glove SEPARATELY — see `gen-lineup-values.mjs` for why the WAR total
  can't be decomposed after the fact. The template for the build-time-fetch
  pattern; see `docs/data-enrichment.md` §5. App reads it via `src/api/war.js`.
- `gen-rehab.mjs` → `public/data/rehab.json` — the league-wide Rehab Assignments
  list. Starts from a transaction scan, then verifies each candidate against his
  game log + club's schedule to drop ended stints. Keeps its own self-contained copy
  of the transaction-scan logic (mirrors `person.js`'s `detectRehabAssignment`).
- `gen-umpires.mjs` → `public/data/umpires.json` — every MLB + AAA umpire's season
  game log, indexed by umpire id. A full-season schedule scan per level
  (`/api/v1/schedule?...&hydrate=officials,team`, one call each for sportId 1 + 11)
  re-indexed by umpire id, each game row tagged with its `level` + `gameType`. AAA
  rides along because the same umpires shuttle between the levels (shared
  personIds); AA and below stay out (thinner officials data + no pitch tracking for
  the accuracy companion). Sweeps regular season + postseason + the All-Star Game
  (`gameType=R,F,D,L,W,A`) so six-man crews (Left/Right Field, ASG + postseason) and
  variable MiLB crews (two/three-man) all land in the log; `UMP_LABELS` maps every
  role incl. LF/RF, and `selectOfficials` (`src/api/select.js`) mirrors it for the
  live crew card.
- `gen-umpire-accuracy.mjs` → `public/data/umpire-accuracy.json` — COMPANION to
  `umpires.json`: each home-plate umpire's season called-pitch accuracy + a compact
  zone-tendency breakdown, keyed by the same personId. Needs each game's full live
  feed (per-pitch `pX/pZ` vs the batter's strike zone), so unlike `gen-umpires.mjs`'s
  one-call full rebuild, this is a feed fetch PER GAME — too costly to redo nightly
  for the whole season. Runs APPEND-ONLY/incremental like `gen-game-notes.mjs`: each
  run sweeps a small trailing window of finals and merges per-game rows in, deduped
  by gamePk. Each row also carries a 3×3 zone grid (`cellCalled`/`cellStrikeCall`/
  `cellMiss`, `cellIndex`) that feeds the app's zone map (perceived-zone shading +
  over-league-average miss overlay); a schema change means a one-time `--since`
  backfill so old rows gain the grid. Nightly cron uses the default trailing window;
  a one-time season backfill is `--since=YYYY-MM-DD [--until=…]`. Covers MLB + AAA
  (sportId 1 + 11 — every AAA park feeds Hawk-Eye coordinates; AA/below carry none
  and score to null). The two levels stay SEPARATE (different regime + peer pool):
  the per-umpire aggregate splits into `season` (MLB) + `seasonAAA`, each row carries
  a `level`, and `--sports=1,11` restricts the sweep (its use: `--since=… --sports=11`
  backfills a newly-added level alone without re-fetching the others' immutable rows).
  Also splits by game CONTEXT (`gameType=R,F,D,L,W,A`): only regular-season rows feed
  the ranked `season`/`seasonAAA`; postseason (F/D/L/W) rolls up into a separate
  unranked `seasonPost`; the All-Star Game (A) counts toward no aggregate (per-game
  figure only). Each row also carries `consistent`/`consistentCalled` (agreement with
  the umpire's OWN game-fitted zone — `src/lib/euz.js`'s kernel-density Estimated
  Umpire Zone) and `favorAway`/`favorHome`/season `favorMagnitude` (run-expectancy
  swing of each missed call — `src/lib/runExpectancy.js`, reading the table
  `gen-run-expectancy.mjs` builds; degrades to null before that table exists). App
  reads it via `src/api/umpires.js`. Full write-up: `.scratch/umpire-accuracy/plan.md`
  + `.scratch/umpire-accuracy/consistency-favor-scope.md`.
- `gen-run-expectancy.mjs` → `public/data/run-expectancy.json` — a base(8)×outs(3)×
  count(12) = 288-state run-expectancy table (RE288), averaged over real MLB
  regular-season play-by-play. **Hand-run, NOT on the nightly cron** (run expectancy
  is a slow-moving league constant, unlike per-game accuracy): `node
  scripts/gen-run-expectancy.mjs --seasons=2024,2025` (defaults to the last 2
  complete seasons). Walks each Final game's `liveData.plays.allPlays` — including
  the top-level stolen-base/caught-stealing/pickoff/wild-pitch/passed-ball/balk plays
  interleaved with real plate appearances — to reconstruct base occupancy + outs,
  verified against a real 5–14 game (runs-per-half matched `linescore.innings[]`
  exactly on all 17 halves). Each pitch tags its PRE-pitch `(baseMask, outs, balls,
  strikes)` state (note: `playEvents[].count` is the count AFTER that pitch, an
  off-by-one caught during verification) with the half-inning's remaining runs.
  Writes both the 288-bucket table and a 24-bucket base/out-only RE24 fallback for
  thin per-count buckets (`src/lib/runExpectancy.js`'s `lookupRE`). Consumed by
  `gen-umpire-accuracy.mjs` (nightly season favor) and, live, `src/api/umpireFavor.js`
  (the box score's reveal-only per-game favor card). Full write-up:
  `.scratch/umpire-accuracy/consistency-favor-scope.md` §2.
- `gen-minors-leaders.mjs` → `public/data/minors-leaders.json` — the combined
  ALL-MINORS leaderboard (every farmhand's totals SUMMED across levels). Eight
  full-level stat pulls (~4,700 players). Stores PRE-RANKED top rows per category, so
  the file stays ~150KB and the leader-relative qualifier's floor is baked in.
  **NOT self-contained** — imports the app's own `combineToPool` (`statsLevels.js`) +
  `computeLeaders` (`teamLeaders.js`), the same code the live `org` board uses, to
  stay in lockstep.
- `gen-former-teammates.mjs` → `public/data/former-teammates.json` — for each
  upcoming matchup (MLB + MiLB), the pairs of players on the two OPPOSING clubs who
  were once teammates (majors or minors). Two players are teammates iff their careers
  share a (teamId, season) pair — a year-by-year pull PER MiLB level per player.
  Self-contained; scopes to the next few days' slate, skips Rookie/complex ball
  (sportId 16), reuses `person.js`'s REHAB_CAP idea to drop a rehab cameo. App reads
  it via `src/api/formerTeammates.js`.
- `gen-vs-team-splits.mjs` → `public/data/vs-team-splits.json` — for every MLB
  active-roster player, his career line vs each opposing club + the last meeting's
  line. The API's vs-team splits carry no game granularity, so it sweeps each
  player's whole MLB game log season by season. Self-contained; MLB only. Large
  (~3MB), kept OUT of the PWA precache. App reads it via `src/api/vsTeamSplits.js`.
- `gen-game-notes.mjs` → `public/data/game-notes.json` — each MLB club's pre-game
  "Game Notes" PDF links (title/date/url). **APPEND-ONLY**: the source feed
  (dapi.mlbinfra.com) only lists a club's last ~10 games, so the job MERGES new links
  and never drops old ones (the img.mlbstatic.com PDF stays live forever, keeping a
  game reachable after mlb.com de-lists it). The twist vs. the other generators,
  which regenerate from scratch. Self-contained; MLB only; kept OUT of the PWA
  precache (grows each game day). App reads it via `src/api/gameNotes.js`.
- `gen-callouts.mjs` → per-date callout files — every team-record, starter-record,
  hitter-split, and situational callout. Covers MLB + the four full-season MiLB
  levels (each MiLB person-stats fetch must carry the level's `sportId` or the API
  silently returns the empty MLB line); career-derived families + standings splits
  stay MLB-only. Per-date files are ~1MB, kept out of the PWA precache. Also
  reads the LOCAL `public/data/fouls.json` once per run for two MLB-only bundle
  keys — `foulSpoilers` (top-10 foul-per-game hitters on the two clubs) and
  `foulRate.perPitch` (league baseline) — skipped gracefully if that file is
  absent. See `docs/callouts.md` + ADR-0014; extend this pipeline, don't build a
  parallel path.
- `gen-fouls.mjs` → `public/data/fouls.json` — season foul-ball aggregates
  (per-batter/pitcher/team totals, two-strike fouls, single-game highs, league
  by-inning + by-pitch-type rates with a starter/reliever split). SQLite-backed
  (`fouls` group, ADR-0021) APPEND-ONLY incremental sweep of Final MLB games'
  live feeds like `gen-umpire-accuracy.mjs` (`--days` trailing window;
  `--since`/`--until` backfill with checkpoints); `foul_ingested_games` is the
  idempotency guard. Imports `FOUL_CODES`/`pitchCallCode` from
  `src/api/playbyplay.js` so live (`derive.js`) and precomputed tallies can't
  drift; two-strike detection carries the PRE-pitch count forward across
  non-PA plays (the `count`-is-post-pitch off-by-one). App reads it via
  `src/api/fouls.js` (Foul Tracker page, player-page card).
- `gen-comeback-wins.mjs` → `public/data/comeback-wins.json` — per-team,
  per-season COMEBACK WIN counts: wins in which the club's win probability fell
  below 10/20/30% at some point (nested: `sub10 <= sub20 <= sub30`). SQLite-backed
  (`comeback-wins` group, ADR-0021) APPEND-ONLY incremental sweep of newly-Final
  MLB regular-season games like `gen-game-score.mjs` (`--days` trailing window /
  backfill); `comeback_ingested_games` is the idempotency guard. Per game it takes
  the WINNER's minimum win prob (home share directly; away = `100 − home max`) from
  the MLB-only `/winProbability` endpoint. App reads it via
  `src/api/comebackWins.js` (Team Page's ranked "Comeback wins" card).
- `gen-workload.mjs` → `public/data/workload.json` — per-pitcher recent
  workload: last-12 appearance list (date/pitches/started), season totals, SP/RP
  role inference, league mean/SD baselines per role, and winning/losing-record
  team cohort means (descriptive color only). Full nightly rebuild from each
  active-roster pitcher's season gameLog; MLB only. All bucket math (last
  1/3/10, consecutive days, availability rules) lives in the reader
  `src/api/workload.js`, computed relative to a caller-supplied date.
- `gen-lineup-values.mjs` → `public/data/lineup-values.json` — per-hitter value
  as **two separate numbers**, from the local `war.json`'s components: `rpg`
  (bat — wRC+ regressed toward the 100 league average by PA) and `fldRpg`
  (glove — season fielding runs regressed toward 0 by innings), plus
  `positions`, the boolean set of spots he can cover, gated on RECENT innings
  (`stats=season,yearByYear`). The consumer adds bat and glove at a fielding slot
  and uses the bat ALONE at DH. **Read `docs/lineup-strength.md` before touching
  any of this.** Three things were removed from this model after each produced
  provably wrong answers, and all three look like obvious additions: the
  positional adjustment (never re-derive a component from the WAR total — WAR's
  own `Positional` is playing-time-prorated), the familiarity weight (it was the
  only term that varied by arrangement, so it drove every rearrangement the model
  ever proposed), and career-based eligibility (a third of all eligibilities were
  stale — Bryce Harper still "qualified" in right field). Feeds the Lineup
  Strength grade (`src/lib/lineupSolver.js` Hungarian assignment +
  `src/api/lineupStrength.js`); MLB only, nightly rebuild.
- `gen-milestones.mjs` → `public/data/milestones.json` — the league-wide Milestone
  Watch list: every debuted player on an MLB org's `fullRoster` (active, IL, or in
  the minors) within reach of a round career-total milestone (`MILESTONE_DEFS` in
  `src/api/person.js`), each with a projected timeframe. Undebuted prospects are
  filtered out on the roster's hydrated `mlbDebutDate` (a career MLB milestone
  needs a debut) so they never cost a stats fetch; an injured or optioned veteran
  near a milestone still shows. Per kept player, one `yearByYear` stats call
  (MLB-only, so MiLB totals never inflate a milestone) yields both his career total
  and this season's pace; each of the 30 teams' season schedule (fetched once, not
  per player — `sportId=1` is REQUIRED or the endpoint 400s) supplies
  games-played-so-far + remaining dates, so the projection can scale by how often
  the player actually plays rather than assuming every team game. An inclusion floor
  (`MILESTONE_PROGRESS_FLOOR`, 75%) trims barely-started chases the wide `farWindow`
  admits. Imports `aggregateSplits`/`MILESTONE_DEFS`/`MILESTONE_PROGRESS_FLOOR`/
  `projectMilestoneETA`/`careerPerSeasonRate`/`milestoneRarityRank` straight from
  `src/api/person.js` (pure, no DOM deps) — extend the projection math there, not in
  the script. MLB careers only.
- `gen-rookies.mjs` → `public/data/rookies.json` — each player's rookie window
  (debut date + the date, if any, his career crossed the rookie limit: 130
  at-bats or 50 innings pitched — AB/IP only, not MLB's full official rule,
  which also has a 45-active-roster-days clause). Feeds `RookiePill` + the
  player page's "Lost Rookie Status" timeline row (`src/api/rookies.js`).
  Same `fullRoster` scan as `gen-milestones.mjs`, but APPEND-ONLY/incremental
  like `gen-game-notes.mjs`/`gen-umpire-accuracy.mjs`, not a full rebuild: a
  closed record is a frozen historical fact the timeline already shows, so
  this script only ever adds a new debut or closes a still-open one — it
  never recomputes a closed record, and never touches a player who's fallen
  off every MLB org's roster (his existing record, open or closed, is left
  alone). `scripts/gen-rookies-backfill.mjs` (hand-run, below) establishes
  everyone else. Shares its crossing-detection helpers with that script by
  deliberate small duplication (self-contained generators, same convention as
  `gen-rehab.mjs` mirroring `person.js`'s `detectRehabAssignment`), not a
  shared import.
- `gen-season-score.mjs` → `public/data/season-score.json` — an MLB-only,
  date-keyed 0.0–10.0 Season Surprise Score. One normal run adds yesterday's
  snapshot; `--date` and `--from`/`--to` make a reproducible backfill. The
  generator sums schedule-adjusted preseason win expectations through the
  cutoff, stores actual-vs-expected as the headline, and keeps earned pace plus
  last-30 form as diagnostics. Market baselines live in the hand-curated
  `season-expectations-seed.json`; incomplete seasons fall back to Marcel. See
  `docs/season-score.md` and ADR-0018. Backed by the SQLite layer above
  (`team_snapshots`, `metric='surprise'`); `public/data/season-score.json` is
  exported from the table, byte-for-byte the same reader shape.
- `gen-team-score.mjs` → `public/data/team-score.json` — date-keyed MLB Quality
  plus a last-10 Current Form diagnostic. Quality blends 60% actual wins with
  40% Pythagorean wins. The browser combines same-cutoff Quality and Season
  Surprise into the headroom-aware Season Grade; see `docs/season-grade.md` and
  ADR-0020. Backed by the SQLite layer above (`team_snapshots`,
  `metric='quality'`/`'current_form'`); `public/data/team-score.json` is
  exported from the table.
- `gen-team-transactions.mjs` → `public/data/team-transactions/{season}.json` —
  an MLB-only, season-chunked roster-move story feed for all 30 organizations.
  The nightly job rebuilds only the current season; once the season file is
  marked `final`, later runs leave it immutable unless explicitly forced.

## Own-cadence generators (not the nightly batch)

- `gen-game-score.mjs` → `public/data/game-score.json` — the 0.0–10.0 "how
  exciting was this game" rating shown unsealed next to FINAL on the slate
  (`FINAL · 7.5`). Each entry is `{ score, sportId, homeId, awayId }` — the
  level + both team ids come straight off the same feed already fetched to
  score the game (no extra call), so the Top Games page can filter its pool by
  level/team. Regular season only (`gameType 'R'`; spring training/exhibition
  are skipped). APPEND-ONLY/incremental like `gen-umpire-accuracy.mjs`: each
  run sweeps a trailing window of dates (`--days`, default 3) across MLB + the
  four full-season MiLB levels, fetches the live feed for every newly-Final
  gamePk not yet scored, and merges the result in (deduped by gamePk — a
  Final game's score never changes). Runs on its OWN tight cron
  (`.github/workflows/update-game-score.yml`, every 10 minutes), not
  `update-nightly-data.yml` — the whole point is a score within minutes of a
  game going Final, which the once-nightly batch can't deliver. Self-contained
  except for `selectRegulationInnings` (`src/api/select.js`), reused so
  "extra innings" never drifts from what the innings viewer itself calls
  extra. The five-bucket formula (drama, action, spectacle, **dominance**, dud)
  scores from the feed's linescore + play-by-play + **boxscore** (individual
  pitching/batting lines drive the dominance axis) + **gameData** bios
  (`birthDate`/`mlbDebutDate` for the career-arc modifier). See
  `docs/game-score.md` for the factor table + calibration anchors, and ADR-0015
  for why this is the one score-derived number allowed to render outside a
  `SealBox`. App reads it via `src/api/gameScore.js`. A full backfill (new
  season, schema change, or **formula change** — a Final game is never
  recomputed otherwise) is a hand-run **`--rescore`**: re-scores every gamePk
  already in the file plus the trailing window, checkpointing every 200 so a
  long run resumes cleanly. `computeGameScore` is exported and the sweep is
  entry-point-guarded, so the formula is importable for tests. Backed by the
  SQLite layer above (`game_scores`); `public/data/game-score.json` is
  exported from the table.
- `warm-previews.mjs` — NOT a data generator (writes no `public/data/*` file,
  no entry in the nightly commit step). Runs in `update-nightly-data.yml`
  alongside the generators above, but is the one script here that calls
  `bbsbh.vercel.app` itself rather than only statsapi: proactively warms
  `api/preview.js` + `api/og.js`'s edge cache (see
  `docs/adr/0012-dynamic-link-previews.md`) for today's MLB slate — every
  game's `lineup1`/`lineup2`/`boxscore` pages + shared `og:image`, every
  playing team's page, and every one of those teams' active-roster players —
  so the first real crawl of a shared link isn't a cold, statsapi-contested
  resolution. Fetches each pretty page and reads its own rendered `og:image`
  tag back out to warm rather than reconstructing `/api/og`'s query params by
  hand, so it can't drift from what `api/_lib/cards.js` actually builds.
  Best-effort only (`mapConcurrent`, same helper as `gen-milestones.mjs`) —
  a failed warm is logged and skipped, never fatal to the run.

## Hand-run generators (immutable data — NOT on a cron)

Re-run only to fold in a new season.

- `gen-war-history.mjs` → `public/data/war-history.json` — season WAR per player for
  COMPLETED seasons (2010+), the multi-year companion to `war.json`. Same FanGraphs
  source/join. A finished season's WAR is immutable.
- `gen-awards-history.mjs` → `public/data/awards-history.json` — who won each major
  MLB award (MVP, Cy Young, Rookie of the Year, Silver Slugger, Gold Glove, Platinum
  Glove, Reliever of the Year, Comeback Player, Hank Aaron, Roberto Clemente, All-MLB
  First/Second Team) over the last 5 seasons, grouped by award then by season. Loops
  `MAJOR_AWARDS`' ids (imported straight from `src/api/person.js`, not duplicated, so
  this page can't drift from what the player page's own Trophy Case counts as
  hardware) × season through `GET /api/v1/awards/{awardId}/recipients?season=YYYY`.
  The in-progress current season simply comes back empty per award until decided —
  no special-casing needed. App reads it via `src/api/awardsHistory.js`.
- `gen-all-star-rosters.mjs` → `public/data/all-star-rosters.json` — every MLB
  All-Star Game roster, year over year back to 1933. Loops
  `GET /api/v1/awards/{ALAS,NLAS}/recipients?sportId=1&season=YYYY` — the same
  authoritative-selections endpoint `fetchAllStarRosterIds` (`src/api/person-fetch.js`)
  already uses, which still names a player who was picked but withdrew (injury, or
  pitched the Sunday before) and never played. Each season's game is looked up via
  `GET /api/v1/schedule?sportId=1&season=YYYY&gameType=A`, but the file stores only
  the `gamePk` — the app resolves team/date info live via `fetchGameCardsByPk`
  (`src/api/schedule.js`), same as the Top Games page, so a franchise rename never
  goes stale in this file. Team NAMES in the roster itself are resolved per
  `(teamId, season)` via the season-scoped `GET /api/v1/teams/{id}?season=YYYY` (not
  the app's current-team table) so a historical pick reads under the name he actually
  played under (a 1933 Washington Senator, not a Minnesota Twin) — deduped across the
  whole run so the same team only costs one extra call per season it's named in.
  ONE more call per season, `GET /api/v1/game/{gamePk}/boxscore`, classifies every
  recipient into a precomputed `{ starters, bullpen, substitutes }` bucket per league
  (same `battingOrder`-multiple-of-100 convention as `select.js`'s `selectLineup`,
  plus `team.pitchers[0]` for the starting pitcher) so the page needs no client-side
  grouping/sorting; a recipient who can't be matched (fetch failure, thin old data)
  falls back to pitcher-or-not. Also stores `mvps[season]` (the Ted Williams
  All-Star MVP award, `GET /api/v1/awards/ASMVP/recipients?season=YYYY`, absent
  before 1962) and `venues[season]` (the venue name off the same schedule row, plus
  a best-effort host-team id resolved against a ONE-TIME fetch of the 30 current
  MLB teams' home parks — an older/relocated venue just carries no team match).
  App reads it via `src/api/allStarRosters.js`.
- `gen-milb-history.mjs` → `public/data/milb-history.json` — per-season parent-org +
  club-name history for every AAA/AA/A+/A affiliate. Sweeps statsapi's season-scoped
  team snapshots for 2005+ (where its affiliate data is clean) and merges a small
  hand-verified seed (`scripts/milb-history-seed.json`) for pre-2005 eras. **Edit the
  SEED, never the output.** See the generator header for the 2005-floor rationale.
- `gen-postseason-history.mjs` → `public/data/postseason-history.json` — the
  completed bracket (who played, who won, how many games, each team's 1-6
  seed) for every MLB postseason back to 2000 (`EARLIEST_YEAR`), plus the
  round MVP where one exists (LCS/World Series only — Wild Card/Division
  Series carry no official MVP award). Sweeps
  `/api/v1/schedule?...&gameType=F,D,L,W&hydrate=team,seriesStatus` per
  season, grouping games into a series by (gameType, seriesDescription,
  sorted team-id pair), then `/api/v1/awards/{ALCSMVP,NLCSMVP,WSMVP}/recipients`
  for the MVP. Seeding has no statsapi field of its own — derived per league
  from `/api/v1/standings`' `divisionChamp` flag plus the Wild Card round's
  own game-1 home/away (the higher seed always hosts), which degrades
  correctly through all three Wild Card formats this range spans (see the
  generator header). Walks backward from the current year, skipping any
  season whose postseason hasn't finished. The app's own UI
  (`PostseasonHistoryPage.jsx`) shows 2020-present eagerly and gates
  2000-2019 behind a "Load more" — that's a UI cutoff, not a generator one;
  this file always carries the full range. App reads it via
  `src/api/postseasonHistory.js`.
- `gen-postseason-leaders.mjs` → `public/data/postseason-leaders.json` — since-
  2000 career postseason batting/pitching leaderboards, plus franchise
  (titles/pennants/appearances) and repeat-Series-MVP leaders computed
  straight from `postseason-history.json` (no extra fetch). Batting/pitching
  need per-game boxscore stat lines that file never carries, so this script
  sweeps every gamePk in it (`GET /api/v1/game/{gamePk}/boxscore`, verified
  live — batting/pitching stats are direct fields, no separate decision
  lookup for W/L/SV) and folds each game into a running CAREER TOTAL per
  player via an incrementing upsert into the SQLite layer's
  `postseason_batting_totals`/`postseason_pitching_totals` (scripts/lib/
  schema.sql) — not one row per game, which would be ~30x more rows for value
  this page doesn't need (see the schema file's own comment: a full re-sweep
  of every postseason game since 2000 takes under a minute, so there's no
  real cost to re-deriving it fresh over keeping a bulky per-game ledger in
  git). `postseason_ingested_games` is the idempotency guard, so a resumed or
  re-run sweep never double-counts a game. RUN gen-postseason-history.mjs
  FIRST — this script reads its gamePk list, never re-walks the schedule API
  itself. AVG/ERA carry a minimum-AB/IP qualifier (same idea as the live
  leader boards' floor) so a single pinch-hit or mop-up inning can't top a
  rate-stat board. App reads it via `src/api/postseasonLeaders.js`.
- `gen-rookies-backfill.mjs` → `public/data/rookies.json` — the one-time
  historical sweep that establishes every player's rookie window before
  `gen-rookies.mjs` (nightly, above) is ever live. Enumerates every MLB
  season's player pool (`/api/v1/sports/1/players?season=YYYY`, which carries
  each player's own `mlbDebutDate` — no separate debut lookup needed), deduped
  by personId, defaulting to the full modern-era range (1901–present;
  `--since`/`--until` narrow it for a chunked run). A re-run only computes
  personIds NOT already in the output file, so widening the range later never
  recomputes — or overwrites — anyone already done. Not "immutable data" in
  quite the same sense as the other two generators in this section (a
  player's crossing date doesn't change once computed, but the file is still
  actively appended to every night by `gen-rookies.mjs`) — it's here because,
  like them, it's a large one-time crawl, never re-run wholesale.

## Assets / off-app

- `gen-icons.mjs` — regenerate PWA PNG icons from `public/icons/icon.svg`.
- `gen-og-image.mjs` — NOT currently used. `public/og-image.jpg` (1200×630
  link-preview card) is a hand-provided phone-mockup asset instead. This script +
  `scripts/og-image.html` render an alternate generated-art version, kept in case we
  go back to it. The `og:*`/`twitter:*` tags in `index.html` point at the current
  `.jpg` (absolute URLs).
- `game-buzz.mjs <gamePk>` — post-game: top social posts from the game's time window,
  ranked by engagement, to seed handwritten GAME NOTES. FREE sources — Bluesky (no
  auth) always, plus the Reddit game thread when `REDDIT_CLIENT_ID/SECRET` are set.
  Deliberately a terminal script, NOT part of the app (game-night posts are
  spoilers). Source scoping/queries: `docs/game-buzz.md`.

## Local-environment reporters (read-only; run by `session-start.sh`)

Both report and never act. The acting counterparts are on-demand skills that
confirm every target with the maintainer first — deliberate, because multiple
agents work concurrently and nothing should reap another one's checkout or
process automatically.

- `dev-servers.mjs` — running `vite` dev/preview processes started from a
  worktree of this repo, each classified stale (worktree deleted, or branch
  merged) or active. Acted on by `/clean-dev-servers`.
- `worktrees.mjs [--brief]` — every worktree, classified stale (merged into
  `origin/main`, or upstream branch deleted) or active, with an uncommitted-file
  count. Reads last-fetched remote state, so `git fetch origin --prune` must come
  first. `--brief` prints only the summary and stays silent when nothing is
  stale — that's the mode the SessionStart hook uses. Acted on by
  `/clean-worktrees`. The staleness verdicts are pure and unit-tested in
  `test/worktrees.test.js`; four cases there are non-obvious and were all live
  bugs. A freshly branched worktree is an ancestor of `origin/main` and so looks
  merged; requiring commits-ahead to tell those apart flips it and mislabels
  every genuinely merged branch; tip-equality (`HEAD == origin/main`) only holds
  until `main` next moves, after which every already-open fresh worktree
  reclassifies as merged — so freshness is decided by membership of `main`'s
  **first-parent chain**, which is stable as `main` advances; and the upstream
  must be read with
  `for-each-ref`, never `@{u}`, because `@{u}` stops resolving the moment the
  remote branch is deleted — which is the end state of every squash-merged PR,
  so `@{u}` reports "no upstream" for precisely the worktrees this script
  exists to find. That last one shipped in #312 and made the
  upstream-deleted branch unreachable dead code.

## Lint guards (run by `npm run lint`, CI-enforced via `ci.yml`)

- `check-caps.mjs` — guards the global ALL-CAPS invariant (no CSS `text-transform`
  sneaks a caps-defeating value back in). See the block comment in `src/index.css`.
- `check-name-casing.mjs` — the JS half of the same invariant: fails if a
  component calls `.toUpperCase()`/`.toLowerCase()` on rendered text (redundant
  with the CSS invariant, and can drift from it on real Unicode names) without
  a `caps-js-exempt` marker comment on the same line. See ADR-0017.
- `check-typography.mjs` — rejects ad hoc size, weight, line-height, and tracking
  declarations in `src/index.css`; add or reuse the semantic roles in
  `src/tokens/typography.css` instead.
- `check-focus-ring.mjs` — every `:focus-visible` rule that draws a ring must use
  `var(--focus-ring)` (outline) or `var(--ring)` (box-shadow), never a hand-rolled
  color; a ring-less focus style (reusing a `:hover` border/background change) is
  fine, and a deliberate one-off opts out with a `focus-ring-exempt` comment. See
  ADR-0023.
- `check-contrast.mjs` — resolves the color tokens to hex and asserts WCAG AA
  (≥4.5:1 text, ≥3:1 large/UI) for the known text-on-background pairings (seal ink
  on the kraft stripes, white on the IL clay stripes, the core semantic text roles).
  Fix a failure by retuning the hex, never by lowering the threshold. See ADR-0023.
- `check-claude-md.mjs` — guards the CLAUDE.md leanness rule: fails if the root
  `CLAUDE.md` exceeds `MAX_LINES` (200). Keeps subsystem detail in the nested
  `CLAUDE.md` files (this one, `src/CLAUDE.md`, `src/api/CLAUDE.md`) that load only
  when Claude works in that directory, so the always-loaded root stays cheap. When
  it fails, move detail into the relevant nested file or `docs/*` and leave a pointer
  in root — don't just raise the cap.
- `check-report-pages.mjs` — fails if `SiteMenu.jsx` (the hamburger menu) or
  `SiteFooter.jsx` (the slate's "More Baseball" list) stops importing the shared
  `REPORT_PAGES` array from `src/lib/reportPages.js` — the guard against those two
  page lists silently drifting apart again.
- `vercel-ignore-build.sh` — Vercel's Ignored Build Step (skips a deploy when a push
  touched only docs/scripts/workflow files). See `docs/development.md`.
