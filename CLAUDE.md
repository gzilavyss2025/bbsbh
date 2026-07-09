# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**bbsbh** ("Baseball Scorebook Helper") is a spoiler-safe, read-only second-screen
PWA for scoring baseball by hand. It displays lineups, umpires, rosters, and
inning totals pulled live from the public MLB Stats API — but every
score-revealing number stays sealed until the user taps to reveal it. It is
**not** a data-entry tool; the user keeps scoring on paper.

React 18 + Vite, phone-first (iPhone), installable PWA, **no backend**.

## Development workflow

The maintainer is the sole developer here and wants a fast, direct loop: **work
on `main`, and commit and push after every change** — no feature branches, no
pull requests, no waiting for approval to push. Land each self-contained change
as its own commit with a clear message and push it straight to `origin/main`.
(Still run `npm run lint` / `npm run build` before pushing so `main` stays green.)

## Commands

```bash
npm install
npm run dev        # dev server
npm run build      # production build → dist/
npm run preview    # serve the built app
npm run lint       # eslint .
node scripts/gen-icons.mjs   # regenerate PWA PNG icons from public/icons/icon.svg
node scripts/gen-og-image.mjs
                   # NOT currently used — public/og-image.jpg (1200×630
                   # link-preview / Open Graph card) is a hand-provided phone-
                   # mockup asset instead. This script/scripts/og-image.html
                   # render an alternate generated-art version; kept in case
                   # we go back to that. The og:*/twitter:* tags in
                   # index.html point at the current .jpg; URLs there are
                   # absolute.
node scripts/game-buzz.mjs <gamePk>
                   # post-game: top social posts from the game's time window,
                   # ranked by engagement, to seed handwritten GAME NOTES. FREE
                   # sources — Bluesky (no auth) always, plus the Reddit game
                   # thread when REDDIT_CLIENT_ID/SECRET are set. Deliberately a
                   # terminal script, NOT part of the app (game-night posts are
                   # spoilers). Source scoping/queries: docs/game-buzz.md
node scripts/gen-milb-history.mjs
                   # regenerate public/data/milb-history.json (per-season parent-org
                   # + club-name history for every AAA/AA/A+/A affiliate). Sweeps
                   # statsapi's season-scoped team snapshots for 2005+ (where its
                   # affiliate data is clean) and merges a small hand-verified
                   # seed (scripts/milb-history-seed.json) for pre-2005 eras. Run
                   # by hand — NOT on a cron (affiliate history is near-immutable);
                   # re-run to fold in a new season. Edit the SEED, never the
                   # output. See the generator header for the 2005-floor rationale.
node scripts/gen-war.mjs
                   # regenerate public/data/war.json (season WAR per player,
                   # from FanGraphs' leaderboard API) — normally you don't run
                   # this by hand, it's on a nightly cron; see
                   # .github/workflows/update-war.yml and docs/data-enrichment.md §5
node scripts/gen-war-history.mjs
                   # regenerate public/data/war-history.json (season WAR per
                   # player for COMPLETED seasons, 2010+ — the multi-year
                   # companion to war.json above, same FanGraphs source/join).
                   # Run by hand, NOT on a cron (a finished season's WAR is
                   # immutable) — like gen-milb-history.mjs; re-run once a year
                   # to fold in the season that just ended. The player page's
                   # career-register WAR column + season-tile WAR read the UNION
                   # of this file (past seasons) and war.json (the live season)
                   # via src/api/war.js (fetchWarHistory + warByYearFor).
node scripts/gen-rehab.mjs
                   # regenerate public/data/rehab.json (the league-wide Rehab
                   # Assignments list). Same build-time-fetch pattern as
                   # gen-war.mjs: the list can't be built spoiler-cheaply on a
                   # page load (each candidate is verified against his game log +
                   # his club's schedule to drop stints that have really ended),
                   # so a daily cron precomputes it. Normally you don't run this
                   # by hand; see .github/workflows/update-rehab.yml. Keeps its
                   # OWN copy of the transaction-scan logic (it's self-contained,
                   # like the other gen-*.mjs scripts) — the app just reads the
                   # static file via src/api/rehab.js.
node scripts/gen-umpires.mjs
                   # regenerate public/data/umpires.json (every MLB umpire's
                   # season game log, indexed by umpire id, for the umpire
                   # detail page reached by tapping a name in the Umpires card).
                   # Same build-time-fetch pattern as gen-war.mjs, driven by
                   # COST: there's no "games by umpire" endpoint, so building
                   # this means a full-season schedule scan (one call — see
                   # .github/workflows/update-umpires.yml) then re-indexing
                   # thousands of (game, official) rows by umpire id — too much
                   # to redo on every umpire-page visit. MLB-only, like war.js.
                   # App reads it via src/api/umpires.js.
node scripts/gen-minors-leaders.mjs
                   # regenerate public/data/minors-leaders.json (the combined
                   # ALL-MINORS leaderboard — every farmhand's season totals SUMMED
                   # across the levels he's climbed, so a two-level slugger ranks on
                   # his combined line). Same build-time-fetch pattern as gen-war.mjs
                   # (daily cron; see .github/workflows/update-minors-leaders.yml),
                   # driven by COST: it's a league-wide, four-level board (eight full-
                   # level stat pulls, ~4,700 players) — too heavy to combine on a
                   # page load. Stores PRE-RANKED top rows per category (not the
                   # ~2.4MB raw pool) so the committed file stays ~150KB and the
                   # leader-relative qualifier's floor is baked in. UNLIKE the other
                   # gen-*.mjs it is NOT self-contained: it imports the app's own
                   # combineToPool (statsLevels.js) + computeLeaders (teamLeaders.js),
                   # the same code the live 'org' board uses, to stay in lockstep.
                   # App reads it via src/api/minorsLeaders.js.
node scripts/gen-former-teammates.mjs
                   # regenerate public/data/former-teammates.json (for each
                   # upcoming MLB matchup, the pairs of players on the two
                   # OPPOSING clubs who were once teammates — majors or minors —
                   # the lineup page's FORMER TEAMMATES card). Same build-time-
                   # fetch pattern as gen-war.mjs (daily cron; see
                   # .github/workflows/update-former-teammates.yml), driven by
                   # COST: two opposing players are teammates iff their careers
                   # share a (teamId, season) pair, and reducing a career to that
                   # set is a year-by-year pull PER MiLB level per player —
                   # hundreds of calls per matchup, too heavy for a page load.
                   # Self-contained like gen-rehab.mjs; scopes to the next few
                   # days' MLB slate only (MiLB never shows the card), skips
                   # Rookie ball, and reuses person.js's REHAB_CAP idea to drop a
                   # veteran's rehab cameo. App reads it via src/api/formerTeammates.js.
node scripts/gen-vs-team-splits.mjs
                   # regenerate public/data/vs-team-splits.json (for every player
                   # on an MLB active roster, his CAREER regular-season line vs
                   # each opposing club plus the LAST meeting's stat line — the
                   # player page's SPLITS VS TEAM card). Same build-time-fetch
                   # pattern as gen-former-teammates.mjs (daily cron; see
                   # .github/workflows/update-vs-team-splits.yml), driven by COST:
                   # the API's vs-team split types carry no game granularity, so
                   # getting both the career totals AND the last-game line means
                   # sweeping each player's whole MLB game log season by season —
                   # dozens of calls per veteran, too heavy for a page load. Self-
                   # contained like gen-rehab.mjs; MLB only. The file is large
                   # (~3MB) so it's kept OUT of the PWA precache and fetched at
                   # runtime (see vite.config.js). App reads it via src/api/vsTeamSplits.js.
npm run e2e        # playwright test — verification harness, not a CI suite (see below)
```

There is no CI-enforced test suite. Verify changes by running `npm run dev` (or
`npm run e2e`, which boots the dev server itself) and exercising the game-select →
team-info → innings flow against a live or recent game. `playwright.config.js` pins
the dev server to a fixed port (`5173`, `strictPort` in `vite.config.js`) and
auto-starts/reuses it, so a verification pass never needs a separate manual
start/poll/kill cycle. `docs/test-games.md` has a pack of real, verified gamePks
with rare in-game events (triple play, immaculate inning, position player pitching,
suspended/resumed game, etc.) for exercising edge cases without hunting for a live
game each session — check there before going looking for a new one.
`.claude/skills/run.md` documents this loop end to end. `e2e/smoke.spec.js` is the
one long-lived example spec; write and delete throwaway specs alongside it for
one-off checks.

## The spoiler rule — the core invariant

This is the whole point of the app. **Do not let it drift.** The rule: a
score-revealing value must never exist in the DOM until the user reveals it —
there is no fetched-then-hidden node to leak. `CONTEXT.md` defines the
vocabulary this section relies on (Seal, SealBox, reveal-only module,
spoiler-free selector, revealedThrough, half-inning, regulation/extra
innings, Pitchers table, primary position); `docs/adr/` records *why* each
enforcement mechanism is shaped the way it is — read the linked ADR before
"simplifying" any of these.

Enforced structurally by two conventions:

1. **Reveal-only modules**, callable only from inside a `SealBox`'s reveal
   render function — never at render top-level or in an eager `useMemo`
   (ADR-0001): `src/api/linescore.js` (per-inning R/H/E/LOB, full-game
   totals) and `src/api/derive.js` (pitches/whiffs/first-pitch strikes +
   Statcast superlatives). Contrast `src/api/select.js`, spoiler-**free**
   (lineups, umpires, venue, rosters). In between sit **caller-gated pre-pitch
   selectors**, spoiler-free only when restricted to the half the user has
   reached (`halfIndex <= revealedThrough + 1`): `selectPrePitchChanges`
   (`select.js`), rendered above the seal (ADR-0003), and `defenseEntering`
   (`src/api/defense.js`) + `lineupEntering` (`src/api/battingorder.js`) — the
   defense diamond and both teams' lineup cards (each name with jersey +
   position) **as they stand entering a half** (subs through that half's first
   pitch only, none made during it), rendered *outside* the seal as the
   pre-scoring reference (above it while sealed, below the play-by-play once
   revealed) and gated to `revealed || isNextToReveal` (ADR-0010). The box
   score draws the whole-game alignment via
   `defenseEntering(…, Infinity, 'bottom')` inside its own seal.

2. **`src/components/SealBox.jsx`** takes `children` as a render function,
   invoked only once revealed; reveal is one-directional, and re-sealing on
   inning navigation works by the parent remounting with `key={inning}` (see
   `InningViewer.jsx`) (ADR-0002).

The PWA service worker uses `NetworkOnly` for `statsapi.mlb.com` (see
`vite.config.js`) so a stale, spoiler-revealing score is never served from
cache (ADR-0004).

Three implementation gotchas have each caused a real spoiler-safety bug
before — now recorded as ADRs so a future refactor doesn't quietly
reintroduce them: roster-card membership/position labels (ADR-0005),
per-inning `errors` being a *fielding* stat (ADR-0006), and manual
(`useRef`) caches of reveal-only derivations needing to key on the `feed`
object (ADR-0007).

**The Pitchers table** (`src/api/pitchers.js` → `computePitcherLines`,
rendered by `PitchersSection` in `InningViewer.jsx`) is gated by the same
`revealedThrough` high-water mark as the seals rather than wrapped in a
`SealBox` — see ADR-0009.

**Extra innings never spoil** — `InningViewer` and `RollingLine` show only
`regulation` innings up front, unlocking extras one at a time as
`revealedThrough` advances — see ADR-0008. `RollingLine`'s run cells double
as the half-inning navigator (away row = tops, home row = bottoms, current
half inked as selected); its Back/Next controls above cover the full
unlocked range for the rare case where the visible window has scrolled a
half off.

## Architecture

**No backend.** Every device queries `https://statsapi.mlb.com` directly. The
one thing kept between sessions is each game's reveal high-water mark
(`revealedThrough`), stored in `localStorage` under `bbsbh:reveal:{gamePk}` so
returning to a game keeps your place. Only that half-index is stored, never a
score — on return the app re-reveals up to the half you'd already reached, so
the spoiler rule still holds. Nothing else is persisted.

**The one exception — link previews (`api/`).** Dynamic Open Graph / Twitter
cards for shared deep links are the sole thing that can't be done statically
(crawlers don't run our JS, and the player/game space is unbounded), so they
live in a thin Vercel edge layer: `api/og.js` renders the 1200×630 card image
(`@vercel/og`), `api/preview.js` serves `index.html` with the route's `og:*`
tags swapped into the `<!-- OG:BEGIN…OG:END -->` block, and `api/_lib/cards.js`
resolves a route to the card's strings (the only server-side statsapi calls in
the app). `vercel.json` rewrites the deep-link paths there. It's crawler-only:
the SPA still fetches all game data client-side, no feature depends on it, it
fails safe to the static default card, and it never renders/fetches a
score-revealing value — see ADR-0012.

**Routing** is a tiny dependency-free layer over the History API
(`src/lib/route.js` — deliberately *not* react-router). Three route shapes: `/`
(slate), `/logos` (logo sheet), and `/{MMDDYYYY}/{matchup}/{section}` for a
deep-linkable game section, where `matchup` is the away+home team abbreviations
lowercased (`milaz`; game 2 of a doubleheader appends `-2`, game 1 stays bare so
old links keep working) and `section` is `lineup1` / `lineup2` / `top{n}` /
`bottom{n}` (the innings viewer shows one half-inning per page; legacy
`inning{n}` links still parse as the top half) / `boxscore` (the sealed full box
score; also reachable straight from a past game's slate card).
`src/App.jsx` parses `location.pathname` into a route, listens on `popstate`, and
`pushState`s on navigation; the URL is the single source of truth for which game
section shows. `GameRoute` resolves a route to a game object — instantly from the
slate-provided seed, else via `resolveGame` (scans the date's slate across levels
and matches the abbreviation slug) for cold loads / shared links. `vercel.json`
rewrites all non-asset paths to `index.html` so those links resolve on Vercel.

**Data layer** (`src/api/`) — fetch wrappers around the public MLB Stats API,
split by topic (all share `statsapi.js`'s `getJson`; a shared header there
notes the gamePk field paths were verified against):
- `statsapi.js` — the one `getJson` fetch wrapper every topic file below calls.
- `schedule.js` — slate/schedule (`hydrate=team` for the abbreviation +
  teamName the bare row lacks), `resolveGame`, `fetchGamesByPk`,
  `fetchHeadToHead`, `fetchTeamSchedule`.
- `uniforms.js` — `/api/v1/uniforms/game` for what each club is wearing (not in
  the live feed; spoiler-free but empty until ~first pitch, so it rides the
  feed's fetch/reload in `GameView` and renders on the lineup pages + box
  score).
- `game.js` — the full game feed (`/api/v1.1/game/{gamePk}/feed/live`), a
  **separate** `/teams/{id}/coaches` call for managers (they are **not** in the
  live feed), and a **separate** `/api/v1/game/{gamePk}/winProbability` call
  for per-play WPA — the sole source of the box score's three stars (the feed
  carries no WPA). It's score-revealing, so `GameView` fetches it lazily and
  the DOM only gets it inside the box-score seal; it's null-guarded (absent at
  most MiLB parks).
- `person-fetch.js` — the player page's bio/stats/logo-tint/"firsts" fetchers
  (see `person.js` below for the pure shaping). Read by the player page only —
  never wired into a sealed game surface.
- `team.js` — team identity, roster, affiliates, standings, ranked team stats.
- `search.js` — the footer's player/team directory search.
- `select.js` — pure, spoiler-free selectors over the raw feed. `selectLineup`
  returns the STARTING nine, from each boxscore player's own `battingOrder`
  value (a starter's is an exact multiple of 100; a sub's is offset 801/802…) —
  never `team.battingOrder`, which mutates to the current slot occupants and
  would sprout PH rows on the staging pages late in a game. It also feeds
  `DefenseDiamond` (the scorebook-style opposing-defense drawing on the lineup
  pages).
- `linescore.js` / `derive.js` — reveal-only (see spoiler rule above).
  `derive.js` also computes the per-half Statcast superlatives (fastest pitch /
  hardest-hit / longest ball from `playEvents[].pitchData`/`hitData`) — absent
  at most MiLB parks, so every field is null-guarded and the UI hides the row.
  Constants shared across the reveal-only modules (`NON_PA_EVENT_TYPES`,
  `WHIFF_CODES`, `pitchCallCode`) live in `playbyplay.js`: baserunning-only
  top-level plays are NOT plate appearances for PA/BF counts, but their pitches
  DO count.
- `docs/data-enrichment.md` — verified (July 2026) catalog of free, CORS-open
  enrichment endpoints (statsapi season/matchup/standings stats, Baseball
  Savant `/gf` with xBA/barrels/bat speed) with per-endpoint spoiler risk. Read
  it before wiring any new data source.
- `docs/uniforms-and-logos.md` — verified (July 2026) findings on statsapi's
  `/api/v1/uniforms/team` (per-team catalog of jersey/pants/cap options) and
  `/api/v1/uniforms/game` (what each team actually wore — spoiler-free, but
  empty until ~game time), plus the full inventory of what logo art the
  mlbstatic CDNs do and don't serve (no alternate/City Connect marks exist).
  Read it before touching uniforms or logo variants.
- `war.js` — season WAR per player, read from a static same-origin
  `public/data/war.json`. That file is **not** fetched live: FanGraphs'
  leaderboard API is CORS-open but bulk-only (~1MB for the whole league) and
  unofficial, so `scripts/gen-war.mjs` fetches + trims it to `{personId: war}`
  and a nightly GitHub Action (`.github/workflows/update-war.yml`) commits the
  refreshed file to `main`, which Vercel then auto-deploys — no server, no
  runtime dependency on FanGraphs. Keyed by MLB Stats API `personId`
  (FanGraphs' own `xMLBAMID` field is that same id, so no name-matching).
  `TeamPage.jsx`'s roster sections and the player page consume it; this
  build-time-fetch pattern (bulk/unofficial source → nightly script → static
  JSON → same-origin read) is meant to be reused for the next source shaped
  like this — see `docs/data-enrichment.md` §5. A companion
  `public/data/war-history.json` (same shape but keyed by season, generated
  hand-run by `scripts/gen-war-history.mjs` — completed-season WAR is
  immutable, so no cron) covers past seasons; `fetchWarHistory` +
  `warByYearFor(personId, group, current, history)` union the two into a
  player's `{season: war}` map (live season from war.json wins its own year),
  which `loadPlayer.js` threads into the player page's season-tile WAR and the
  career register's WAR column. WAR is MLB-only at the source, so MiLB
  rows/tiles fall back to a dash.
- `rehab.js` — the Rehab Assignments page's data, read from a static same-origin
  `public/data/rehab.json`. The SECOND use of `war.js`'s build-time-fetch pattern,
  but here the driver is *cost*, not an unofficial source: the list starts from a
  league-wide transaction scan (who's been *assigned* a rehab), then verifies each
  candidate against his own game log + his rehab club's schedule to drop stints
  that have really ended (activated back to the majors, sent down, or shut down
  for the season) — dozens of statsapi calls, too heavy for a page load. So
  `scripts/gen-rehab.mjs` does it on a daily cron (`.github/workflows/update-rehab.yml`)
  and this module just reads the shaped result. The transaction-scan half mirrors
  `person.js`'s single-player `detectRehabAssignment`; the script keeps its own
  self-contained copy (like the other `gen-*.mjs`).
- `umpires.js` — the umpire detail page's data (every game an umpire has worked
  this season + which base, most recent first), read from a static same-origin
  `public/data/umpires.json`, keyed by umpire personId. Cost-driven like
  `rehab.js`: there's no "games by umpire" endpoint, so building the index means
  a full-season schedule scan (`scripts/gen-umpires.mjs`, one call —
  `/api/v1/schedule?...&hydrate=officials,team` returns every game's officials
  in one shot) then re-indexing thousands of rows by umpire id — too much to
  redo on every visit, so a daily cron (`.github/workflows/update-umpires.yml`)
  precomputes it. MLB-only, like `war.js`. Wired up via `selectOfficials`
  (`select.js`) now threading each official's `id` through to the Umpires card
  (`TeamInfo.jsx`), which renders each name as an `UmpireLink` to `/umpire/{id}`
  (`route.js`); the page itself needs no `SealBox` — umpire assignments and game
  dates carry no score, same as the rest of the roster-move surfaces.
- `vsTeamSplits.js` — the player page's SPLITS VS TEAM card data (career
  regular-season line vs each opposing club + the last meeting's stat line, per
  MLB active-roster player), read from a static same-origin
  `public/data/vs-team-splits.json`. Same build-time-fetch pattern as `war.js` /
  `former-teammates.js`, cost-driven: the API's vs-team split types carry no game
  granularity, so getting both the career totals AND the last-game line means
  sweeping each player's whole MLB game log season by season (one request per
  season) — too heavy for a page load, so `scripts/gen-vs-team-splits.mjs`
  precomputes it on a daily cron (`.github/workflows/update-vs-team-splits.yml`).
  Threaded into the player page via `loadPlayer.js` (`vsTeamSplitsFor`), which
  pre-selects the player's club's next scheduled opponent. The player page is a
  spoiler-FREE surface (open game logs / season splits), so the career totals
  belong here like the "Season splits" card; the one score-revealing element —
  the last-game line — is gated against the page's `asOf` cutoff in
  `SplitsVsTeam.jsx`, exactly as the game log is. The file is large (~3MB) so it's
  kept OUT of the PWA precache and fetched at runtime (see `vite.config.js`).
- `leaders.js` / `teamLeaders.js` / `statsLevels.js` — the leader boards. Ranking
  is pool-agnostic: `teamLeaders.js` holds the category descriptors +
  `computeLeaders`, which ranks any normalized `PoolPlayer[]`; `leaders.js`
  produces the pool for a scope (a team level or MLB/AL/NL via `fetchTeamRoster`
  fan-out; an `org` via `statsLevels.js`). `statsLevels.js` reads the roster-
  INDEPENDENT season-stats endpoint and SUMS a player's lines across levels into
  one combined row (recomputing rate stats from summed components) — what lets a
  promoted farmhand rank on his A+ + AA total. Rosters miss him (he's off the
  club he's left); the stats endpoint doesn't.
- `minorsLeaders.js` — the combined ALL-MINORS leaderboard, read from a static
  same-origin `public/data/minors-leaders.json`. The THIRD use of `war.js`'s
  build-time-fetch pattern, cost-driven like `rehab.js`: a league-wide four-level
  board is eight full-level stat pulls (~4,700 players to combine), too heavy for
  a page load, so `scripts/gen-minors-leaders.mjs` precomputes it on a daily cron
  (`.github/workflows/update-minors-leaders.yml`). It stores PRE-RANKED top rows
  per category (via the app's own `combineToPool` + `computeLeaders`, so it can't
  drift from the live `org` board) rather than the raw pool — keeps the committed
  file ~150KB and bakes in the leader-relative qualifier's playing-time floor,
  which the app couldn't reproduce from a trimmed pool. `LeadersPage` reads it for
  the `minors` scope and hands the rows straight to `TeamLeaders`'s `precomputed`
  path.
- `milbHistory.js` — historical MiLB affiliate/franchise data, read from a
  static same-origin `public/data/milb-history.json`. Like `war.js`, that file
  is **script-generated** (`scripts/gen-milb-history.mjs`) but, unlike WAR,
  **not on a cron** — affiliate history is near-immutable, so it's a hand-run
  regenerate. The generator derives 2005+ eras from statsapi's own
  season-scoped team snapshots (`/teams?sportId={11-14}&season={Y}` reports each
  club's parent + name AS OF that season) and merges a small hand-verified seed
  (`scripts/milb-history-seed.json`) for pre-2005 eras — because statsapi's own
  affiliate data is unreliable before ~2005 (it mislabels e.g. the Sky Sox as a
  Cleveland club through 2003 when they were the Rockies' from 1993). **Edit the
  seed, never the output.** It exists to fix a specific illusion: a MiLB
  affiliate's PARENT org can be reassigned (most sweepingly in the 2021 MiLB
  reorganization) independent of the player ever changing organizations, so a
  naive "current parent org" lookup mislabels an old stint as if the player had
  been traded.
  `historicalParentOrg(teamId, year)` is wired into the career timeline
  (`loadPlayer.js`) as a preferred-when-covered override ahead of the
  existing live `fetchTeam()` lookup; deliberately thin (see the JSON's own
  `scope` note), so most (team, year) pairs still fall through to that live
  lookup unchanged. A parallel `historicalClubName()` covers genuine
  franchise renames/relocations (e.g. Huntsville Stars → Rocket City Trash
  Pandas) but isn't wired into any screen yet — no historical logo art exists
  to show alongside a renamed club's badge; see
  `docs/milb-historical-logos.md` for the asset manifest and integration plan.

**Screens** (`src/screens/`): `GameSelect` (slate with the MLB/AAA/AA/A+/A level
toggle) → `GameView` (owns the site-home bar + grayscale away@home masthead that
opens the sketch modal) → `TeamInfo` (×2, away then home) → `InningViewer`.
`LogoSheet` is a standalone printable grayscale logo sheet for pencil-sketching,
reached from the slate header.

**Fetching**: the `useAsync` hook (`src/hooks/useAsync.js`) runs a promise on
mount/deps-change and exposes `{ loading, error, data, reload }`. Two seams it
guards: a per-run token discards out-of-order completions (a slow request left
in flight across a deps change must not clobber newer data), and a deps change
resets `data` to null while `reload` (same deps) keeps the last-good data —
stale-while-revalidate for the live-game Refresh, never across games/dates.

## Conventions to follow

- **MiLB data degrades gracefully.** MLB feeds are complete; minor-league feeds
  (sportIds 11–14, see `src/lib/teams.js`) often miss lineups, weather, coaches,
  or logos. Every selector falls back to `''`/`null`/`—` rather than assuming a
  field is present, and callers render "not posted yet" instead of crashing. Keep
  this pattern for any new field you read.
- **Team ids are the universal key.** The same `teamId` drives schedule data, box
  scores, and the logo CDN (`teamLogoUrl` in `teams.js`). The Brewers (id 158)
  are pinned to the top of the slate (`PINNED_TEAM_ID`).
- **Verify feed field paths against a live game.** The MLB feed shape is
  undocumented; `api/statsapi.js` notes paths were checked against a specific
  gamePk. When reading a new field, confirm it against a real response, don't
  guess.
- **Styling is a token-based design system.** All CSS lives in `src/index.css`
  which imports `src/tokens/*.css` (colors, typography, spacing, effects, fonts).
  The visual metaphor is a paper scorebook: manila paper, navy ink, pencil
  graphite, kraft-tape amber for seals. Use the semantic CSS variables
  (`--surface-card`, `--accent-negative`, `--seal-cover`, etc.) rather than raw
  hex. Numbers render as mono tabular figures; structural labels are condensed
  uppercase.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature-slug>/`; no
external PR surface (solo project, no GitHub Issues). See
`docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`) used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See
`docs/agents/domain.md`.
