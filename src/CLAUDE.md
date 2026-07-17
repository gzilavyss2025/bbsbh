# src — the app shell

React 18 + Vite SPA, phone-first, no backend. This file covers screens, routing,
fetching, and the design system. The data layer has its own file
(`src/api/CLAUDE.md`); the always-loaded root `CLAUDE.md` carries the spoiler-rule
summary and the high-level architecture map.

## Screens (`src/screens/`)

`GameSelect` (slate with the MLB/AAA/AA/A+/A level toggle) → `GameView` (owns the
site-home bar + grayscale away@home masthead that opens the sketch modal) →
`TeamInfo` (×2, away then home) → `InningViewer`. `LogoSheet` is a standalone
printable grayscale logo sheet for pencil-sketching, reached from the slate header.

## Routing (`src/lib/route.js`, `src/App.jsx`)

A tiny dependency-free layer over the History API (deliberately *not* react-router).
Three route shapes: `/` (slate), `/logos` (logo sheet), and
`/{MMDDYYYY}/{matchup}/{section}` for a deep-linkable game section, where `matchup`
is the away+home team abbreviations lowercased (`milaz`; game 2 of a doubleheader
appends `-2`, game 1 stays bare so old links keep working) and `section` is
`lineup1` / `lineup2` / `top{n}` / `bottom{n}` (the innings viewer shows one
half-inning per page; legacy `inning{n}` links still parse as the top half) /
`boxscore` (the sealed full box score; also reachable straight from a past game's
slate card).

`src/App.jsx` parses `location.pathname` into a route, listens on `popstate`, and
`pushState`s on navigation; the URL is the single source of truth for which game
section shows. `GameRoute` resolves a route to a game object — instantly from the
slate-provided seed, else via `resolveGame` (scans the date's slate across levels
and matches the abbreviation slug) for cold loads / shared links. `vercel.json`
rewrites all non-asset paths to `index.html` so those links resolve on Vercel.

## Fetching (`src/hooks/useAsync.js`)

The `useAsync` hook runs a promise on mount/deps-change and exposes
`{ loading, error, data, reload }`. Two seams it guards: a per-run token discards
out-of-order completions (a slow request left in flight across a deps change must
not clobber newer data), and a deps change resets `data` to null while `reload`
(same deps) keeps the last-good data — stale-while-revalidate for the live-game
Refresh, never across games/dates.

## UI-side spoiler enforcement

The spoiler rule (root `CLAUDE.md`) is enforced structurally in these components —
read the linked ADRs before refactoring:

- **`src/components/SealBox.jsx`** takes `children` as a render function, invoked
  only once revealed; reveal is one-directional, and re-sealing on inning
  navigation works by the parent remounting with `key={inning}` (see
  `InningViewer.jsx`) (ADR-0002).
- The **defense diamond** and both teams' **lineup cards** render *outside* the
  seal as the pre-scoring reference (above it while sealed, below the play-by-play
  once revealed), gated to `revealed || isNextToReveal` (ADR-0010). The data comes
  from the caller-gated pre-pitch selectors in `src/api/` (see `src/api/CLAUDE.md`).
- **The Pitchers table** (`src/api/pitchers.js` → `computePitcherLines`, rendered by
  `PitchersSection` in `InningViewer.jsx`) is gated by the same `revealedThrough`
  high-water mark as the seals rather than wrapped in a `SealBox` (ADR-0009).
- **Extra innings never spoil** — `InningViewer` and `RollingLine` show only
  `regulation` innings up front, unlocking extras one at a time as `revealedThrough`
  advances (ADR-0008). `RollingLine`'s run cells double as the half-inning navigator
  (away row = tops, home row = bottoms, current half inked as selected); its
  Back/Next controls cover the full unlocked range.
- **At-bat stepping**: a sealed half's floating-bar button splits into "Next
  at-bat" / "Rest of half" choices, stepping `PlayByPlay`'s cards one plate
  appearance at a time via a transient cursor (`atBatCountFor`,
  `useRevealProgress`) that always collapses into a normal `revealTo` commit
  rather than becoming a second spoiler boundary (ADR-0016).

## Notification cards, casing, color, and button copy (ADR-0017)

Every mid-inning "something happened" moment in `PlayByPlay.jsx` sorts into one
of three tiers — a fresh/changed actor (`PitcherNotice`/`FielderNotice`/
`PinchRunNotice`), a team/administrative event (mound visit, ejection), or a
baserunning/misc event with no plate appearance of its own (steal, wild pitch,
balk, …) — and all three render in the *same* kraft-amber
`.pitchernotice.pitchernotice--pbp` card, distinguished by what's inside (a
headshot vs. a scorer's-shorthand code) rather than a colored accent rail.
Read ADR-0017 before touching any of `PlayByPlay.jsx`'s notification
components, `MoundVisitPips`, or `HalfInning.jsx`'s `PrePitchChanges` — it
also covers the casing rule (no per-component `.toUpperCase()`, guarded by
`scripts/check-name-casing.mjs`), the `--accent-positive`/`--accent-negative`
color pairing, and the button/label conventions (chevron vs. destination-named
link, "Reveal" always visible, accessible name contains the visible word).

## Design system (`src/index.css` + `src/tokens/*`)

All CSS lives in `src/index.css`, which imports `src/tokens/*.css` (colors,
typography, spacing, effects, fonts). The visual metaphor is a paper scorebook:
manila paper, navy ink, pencil graphite, kraft-tape amber for seals. Use the
semantic CSS variables (`--surface-card`, `--accent-negative`, `--seal-cover`, etc.)
rather than raw hex. Numbers render as mono tabular figures; structural labels are
condensed uppercase. Type size, weight, leading, and tracking must use the semantic
roles in `tokens/typography.css`; `scripts/check-typography.mjs` rejects new ad hoc
values in `index.css`. The global ALL-CAPS invariant (see the block comment in
`src/index.css`) is guarded by `scripts/check-caps.mjs` (the CSS half) and
`scripts/check-name-casing.mjs` (the JS half — no per-component
`.toUpperCase()`/`.toLowerCase()` on rendered text; see ADR-0017) via
`npm run lint`.
