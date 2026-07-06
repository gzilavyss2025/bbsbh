# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**bbsbh** ("Baseball Scorebook Helper") is a spoiler-safe, read-only second-screen
PWA for scoring baseball by hand. It displays lineups, umpires, rosters, and
inning totals pulled live from the public MLB Stats API — but every
score-revealing number stays sealed until the user taps to reveal it. It is
**not** a data-entry tool; the user keeps scoring on paper.

React 18 + Vite, phone-first (iPhone), installable PWA, **no backend**.

## Commands

```bash
npm install
npm run dev        # dev server
npm run build      # production build → dist/
npm run preview    # serve the built app
npm run lint       # eslint .
node scripts/gen-icons.mjs   # regenerate PWA PNG icons from public/icons/icon.svg
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
   resets every `SealBox` to sealed. The global "Reveal score" flag
   (`GameView` → `RevealScoreButton` → `forceRevealed`) is the one bypass.

The PWA service worker uses `NetworkOnly` for `statsapi.mlb.com` (see
`vite.config.js`) so a stale, spoiler-revealing score is never served from cache.

## Architecture

**No backend, no router, no persistence.** Every device queries
`https://statsapi.mlb.com` directly. Navigation is plain React `useState` in
`src/App.jsx` (game-select ↔ game-view ↔ logo-sheet); `GameView` walks its own
three steps (away info → home info → innings) with local state. Nothing is stored
because every screen is spoiler-safe by construction.

**Data layer** (`src/api/`):
- `mlb.js` — thin fetch wrapper. Schedule/slate, cross-level team search, the
  full game feed (`/api/v1.1/game/{gamePk}/feed/live`), and a **separate**
  `/teams/{id}/coaches` call for managers (they are **not** in the live feed).
- `select.js` — pure, spoiler-free selectors over the raw feed.
- `linescore.js` / `derive.js` — reveal-only (see spoiler rule above).

**Screens** (`src/screens/`): `GameSelect` → `TeamInfo` (×2, away then home) →
`InningViewer`. `LogoSheet` is a standalone printable grayscale logo sheet for
pencil-sketching, reached from the slate header.

**Fetching**: the `useAsync` hook (`src/hooks/useAsync.js`) runs a promise on
mount/deps-change and exposes `{ loading, error, data, reload }`.

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
