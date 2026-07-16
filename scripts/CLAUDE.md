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

## Nightly-cron generators (`update-nightly-data.yml`)

Precomputed because they're too heavy (COST) to build on a page load. Normally you
don't run these by hand.

- `gen-war.mjs` → `public/data/war.json` — season WAR per player, from FanGraphs'
  bulk leaderboard API (~1MB, unofficial). The template for the build-time-fetch
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
  figure only). App reads it via `src/api/umpires.js`. Full write-up:
  `.scratch/umpire-accuracy/plan.md`.
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
  stay MLB-only. Per-date files are ~1MB, kept out of the PWA precache. See
  `docs/callouts.md` + ADR-0014; extend this pipeline, don't build a parallel path.
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
  `docs/season-score.md` and ADR-0018.
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
  entry-point-guarded, so the formula is importable for tests.

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

## Lint guards (run by `npm run lint`, CI-enforced via `ci.yml`)

- `check-caps.mjs` — guards the global ALL-CAPS invariant (no CSS `text-transform`
  sneaks a caps-defeating value back in). See the block comment in `src/index.css`.
- `check-name-casing.mjs` — the JS half of the same invariant: fails if a
  component calls `.toUpperCase()`/`.toLowerCase()` on rendered text (redundant
  with the CSS invariant, and can drift from it on real Unicode names) without
  a `caps-js-exempt` marker comment on the same line. See ADR-0017.
- `check-claude-md.mjs` — guards the CLAUDE.md leanness rule: fails if the root
  `CLAUDE.md` exceeds `MAX_LINES` (200). Keeps subsystem detail in the nested
  `CLAUDE.md` files (this one, `src/CLAUDE.md`, `src/api/CLAUDE.md`) that load only
  when Claude works in that directory, so the always-loaded root stays cheap. When
  it fails, move detail into the relevant nested file or `docs/*` and leave a pointer
  in root — don't just raise the cap.
- `vercel-ignore-build.sh` — Vercel's Ignored Build Step (skips a deploy when a push
  touched only docs/scripts/workflow files). See `docs/development.md`.
