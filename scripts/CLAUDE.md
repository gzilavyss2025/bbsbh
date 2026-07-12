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
- `gen-umpires.mjs` → `public/data/umpires.json` — every MLB umpire's season game
  log, indexed by umpire id. A full-season schedule scan
  (`/api/v1/schedule?...&hydrate=officials,team`, one call) re-indexed by umpire id.
  MLB-only.
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
  a one-time season backfill is `--since=YYYY-MM-DD [--until=…]`. MLB-only. App reads
  it via `src/api/umpires.js`. Full write-up: `.scratch/umpire-accuracy/plan.md`.
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

## Hand-run generators (immutable data — NOT on a cron)

Re-run only to fold in a new season.

- `gen-war-history.mjs` → `public/data/war-history.json` — season WAR per player for
  COMPLETED seasons (2010+), the multi-year companion to `war.json`. Same FanGraphs
  source/join. A finished season's WAR is immutable.
- `gen-milb-history.mjs` → `public/data/milb-history.json` — per-season parent-org +
  club-name history for every AAA/AA/A+/A affiliate. Sweeps statsapi's season-scoped
  team snapshots for 2005+ (where its affiliate data is clean) and merges a small
  hand-verified seed (`scripts/milb-history-seed.json`) for pre-2005 eras. **Edit the
  SEED, never the output.** See the generator header for the 2005-floor rationale.

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
- `check-claude-md.mjs` — guards the CLAUDE.md leanness rule: fails if the root
  `CLAUDE.md` exceeds `MAX_LINES` (200). Keeps subsystem detail in the nested
  `CLAUDE.md` files (this one, `src/CLAUDE.md`, `src/api/CLAUDE.md`) that load only
  when Claude works in that directory, so the always-loaded root stays cheap. When
  it fails, move detail into the relevant nested file or `docs/*` and leave a pointer
  in root — don't just raise the cap.
- `vercel-ignore-build.sh` — Vercel's Ignored Build Step (skips a deploy when a push
  touched only docs/scripts/workflow files). See `docs/development.md`.
