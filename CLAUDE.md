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
node scripts/game-buzz.mjs <gamePk>
                   # post-game: top social posts from the game's time window,
                   # ranked by engagement, to seed handwritten GAME NOTES. FREE
                   # sources — Bluesky (no auth) always, plus the Reddit game
                   # thread when REDDIT_CLIENT_ID/SECRET are set. Deliberately a
                   # terminal script, NOT part of the app (game-night posts are
                   # spoilers). Source scoping/queries: docs/game-buzz.md
```

There is no test suite. Verify changes by running `npm run dev` and exercising the
game-select → team-info → innings flow against a live or recent game.

## The spoiler rule — the core invariant

This is the whole point of the app. **Do not let it drift.** The rule: a
score-revealing value must never exist in the DOM until the user reveals it —
there is no fetched-then-hidden node to leak.

It is enforced structurally by two conventions:

1. **Score-revealing selectors are isolated in their own modules** and are
   "reveal-only": `src/api/linescore.js` (per-inning R/H/E/LOB, full-game totals)
   and `src/api/derive.js` (pitches/whiffs/first-pitch strikes computed from
   play-by-play). These must only be *called from inside* a `SealBox`'s reveal
   render function. Never call them at render top-level or in a `useMemo` that
   runs before reveal. Contrast `src/api/select.js`, which holds only
   spoiler-**free** selectors (lineups, umpires, venue, rosters) and touches no
   runs/hits/errors.

2. **`src/components/SealBox.jsx`** takes `children` as a *render function*,
   invoked only in the revealed branch — so the sealed value is computed lazily
   and nothing puts it in the DOM beforehand. Reveal is one-directional (a stray
   double-tap can't flash-and-rehide). Re-sealing on inning navigation works by
   the parent remounting with `key={inning}` (see `InningViewer.jsx`), which
   resets every `SealBox` to sealed. There is no "reveal the whole game" bypass —
   reveal is strictly per-half-inning, gated by `revealedThrough`.

The PWA service worker uses `NetworkOnly` for `statsapi.mlb.com` (see
`vite.config.js`) so a stale, spoiler-revealing score is never served from cache.

Three conventions guard the live-refresh + reveal seam (all have bitten before):
- **Roster-card membership and position labels key on PRIMARY position, never
  the in-game box position.** A bench catcher mopping up a sealed blowout gets a
  box position of 'P' (subs get 'PH'/'PR'); classifying or labeling by that
  moves/renames his roster row the moment the sealed substitution happens — a
  spoiler through the card's shape. See `isPitcherByTrade` in `select.js`. Only
  the reveal-gated strike-through may change with game events.
- **Any manual (`useRef`) cache of a reveal-only derivation MUST key on the
  `feed` object and rebuild when it changes.** `computeDerivedByInning` is cached
  in `InningViewer` keyed on `feed`; caching it across feeds froze the live
  inning's pitch/whiff stats after a Refresh.
- **Per-inning `errors` is a *fielding* stat.** The MLB linescore stores a team's
  per-inning `errors` under that team's node but for the half it *fields* (home
  fields the top, away the bottom) — the opposite half from its `runs`/`hits`.
  Read E from the fielding side and gate it on the fielding half, or you both
  show the wrong number and leak a still-sealed half's errors.

**The Pitchers table** (`src/api/pitchers.js` → `computePitcherLines`, rendered by
`PitchersSection` in `InningViewer.jsx`) shows the running line of every pitcher
who has appeared, one block per team. A pitcher's line (IP/R/ER/H…) is
score-revealing, so although it is *not* wrapped in a `SealBox` it is gated by the
same reveal high-water mark as the seals: `InningViewer` keeps `revealedThrough`
(a `halfIndex` — the furthest half-inning uncovered; revealing a later inning
auto-reveals everything before it), and `computePitcherLines` accumulates stats
*only* from plays at or below that mark. So the table only ever shows innings the
user has already revealed. A pitcher whose whole outing is revealed uses his exact
boxscore line; a still-active pitcher mid-outing uses a partial computed from
revealed plays only (runs/earned-runs attributed via each play's
`responsiblePitcher`, so inherited runners are charged correctly). The same
`revealedThrough` mark drives `RollingLine` and each half-inning's `SealBox`
(`forceRevealed` when its `halfIndex` is at/below the mark). Don't reintroduce a
separate inning-navigation gate or read the boxscore for a pitcher whose outing
isn't fully revealed — either would leak the current inning.

**Extra innings never spoil.** `InningViewer` shows only `regulation` innings
(`selectRegulationInnings` — 9, or 7 for short games) up front. Each inning past
regulation unlocks one at a time via `unlocked`, and only once the prior inning's
bottom is at/below `revealedThrough` — so the navigator and running line never
hint a game went to extras before the user reveals their way there. The
`RollingLine` boxscore holds only `regulation` columns, so once extras unlock it
scrolls that window forward (dropping inning 1 when 10 appears, etc.) while R/H/E
totals stay cumulative over every revealed inning. `RollingLine` also *is* the
half-inning navigator: every run cell is a button that jumps to that half (away
row = tops, home row = bottoms), the current half inked as selected — so
selecting a half reads like reading a line score, with no separate scrolling chip
strip. The Back/Next controls above it cover the full unlocked range for the rare
extras case where the visible window has scrolled a half off. Never derive the visible
inning count from `selectInningCount` (the *actual* count) directly — that leaks
the extras.

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

**Data layer** (`src/api/`):
- `mlb.js` — thin fetch wrapper. Schedule/slate (`hydrate=team` for the
  abbreviation + teamName the bare row lacks), `resolveGame`, the full game feed
  (`/api/v1.1/game/{gamePk}/feed/live`), and a **separate** `/teams/{id}/coaches`
  call for managers (they are **not** in the live feed).
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
  undocumented; `mlb.js` notes paths were checked against a specific gamePk. When
  reading a new field, confirm it against a real response, don't guess.
- **Styling is a token-based design system.** All CSS lives in `src/index.css`
  which imports `src/tokens/*.css` (colors, typography, spacing, effects, fonts).
  The visual metaphor is a paper scorebook: manila paper, navy ink, pencil
  graphite, kraft-tape amber for seals. Use the semantic CSS variables
  (`--surface-card`, `--accent-negative`, `--seal-cover`, etc.) rather than raw
  hex. Numbers render as mono tabular figures; structural labels are condensed
  uppercase.
