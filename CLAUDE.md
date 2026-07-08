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
                   # regenerate public/og-image.png (1200×630 link-preview /
                   # Open Graph card) from scripts/og-image.html. The og:*
                   # tags in index.html point at it; URLs there are absolute.
node scripts/game-buzz.mjs <gamePk>
                   # post-game: top social posts from the game's time window,
                   # ranked by engagement, to seed handwritten GAME NOTES. FREE
                   # sources — Bluesky (no auth) always, plus the Reddit game
                   # thread when REDDIT_CLIENT_ID/SECRET are set. Deliberately a
                   # terminal script, NOT part of the app (game-night posts are
                   # spoilers). Source scoping/queries: docs/game-buzz.md
node scripts/gen-war.mjs
                   # regenerate public/data/war.json (season WAR per player,
                   # from FanGraphs' leaderboard API) — normally you don't run
                   # this by hand, it's on a nightly cron; see
                   # .github/workflows/update-war.yml and docs/data-enrichment.md §5
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
  `TeamPage.jsx`'s roster sections are the only consumer so far; this
  build-time-fetch pattern (bulk/unofficial source → nightly script → static
  JSON → same-origin read) is meant to be reused for the next source shaped
  like this — see `docs/data-enrichment.md` §5.

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
