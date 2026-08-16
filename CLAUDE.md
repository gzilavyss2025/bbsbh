# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Tally Baseball** (repo name `bbsbh`) is a PWA for scoring baseball by hand. It is
spoiler-safe and read-only, made for use as a second screen next to a live game. It
shows lineups, umpires, rosters, and inning totals from the public MLB Stats API. Any
number that would spoil the game stays sealed until you tap to reveal it. This app is
**not** a data-entry tool. The user keeps score on paper.

React 18 + Vite, phone-first (iPhone), installable PWA, **no backend**.

## Maintaining these docs

This file loads into every session and stays loaded for the whole session. Its size
is a fixed token cost per session. **Keep it lean**: stay under **200 lines**.
`scripts/check-claude-md.mjs` enforces this cap; `npm run lint` runs the check in CI.
Detail lives in three tiers, most specific first:

- **Nested `CLAUDE.md`** files in `src/`, `src/api/`, and `scripts/`. Claude Code
  loads these only when it opens that directory, so this detail costs tokens on
  demand, not every session. Put per-module and per-script prose here.
- **`docs/*` and `docs/adr/`** — reference catalogs and the *why* behind decisions.
- **`CONTEXT.md`** — the domain glossary the spoiler and architecture prose relies on.

When you want to add detail here, add it to the right tier instead and leave a
one-line pointer. If the leanness check fails, move content out. Do not raise the
cap. After structural work, check whether the nested `CLAUDE.md` or `docs/adr/`
entry you touched also needs an update. A stale tier is worse than none.

## Workflow & deployment

**All sessions use task branches and pull requests. Never push directly to `main`
or trigger a Vercel deployment.** This is a Vercel Hobby project: keep
work-in-progress off `main`, batch related changes, and cut deployment-triggering
merges to a minimum. Non-`main` previews are disabled. Verify changes locally instead.

Multiple agents may work at once. Treat unfamiliar changes as another agent's work.
Check status and diffs before you edit. Isolate your work by branch or worktree. Stop
and coordinate on any file another agent may be using. Never reset, stash, overwrite, or
reformat someone else's work. In a fresh context, fetch and list worktrees and open PRs
before you pick a base branch: independent work starts from current `origin/main`; work
needing an unmerged PR must name and deliberately base on that PR branch. Record branch,
worktree, and PR state in your handoff, so the next context resumes safely.

For a user-visible change, start the first free reserved localhost dev server, load
the exact route you changed, and keep the server running. Put that clickable local
URL in your final handoff. **Add `?nointro` to any test URL**, so the first-visit
welcome modal does not cover the slate (`e2e` specs add this through
`e2e/fixtures.js`). See `docs/development.md` for the full workflow.

## Commands

```bash
npm install
npm run dev        # dev server (fixed port 5173, strictPort)
npm run build      # production build → dist/
npm run preview    # serve the built app
npm run lint       # eslint + guard scripts (caps, casing, typography, contrast, claude-md, …)
npm test           # node:test unit suite (pure logic; CI-gated)
npm run test:coverage  # same, with a per-file coverage report
npm run e2e        # playwright test — browser verification harness, not CI-gated
```

**Reserved dev ports (multi-agent safe).** `dev` uses port `5173`; `preview` uses
`4173`. `strictPort` is on, so neither port auto-increments. If another worktree
holds that port, use the next numbered script: `npm run dev:2` through `dev:5`
(ports `5172`→`5169`), or `preview:2` through `preview:5` (`4172`→`4169`).
`vite.config.js` has the rationale and the tally-nfl band split.

`scripts/gen-*.mjs` are the data generators (WAR, rehab, umpires, callouts, and more);
`docs/scripts/generators.md` catalogs them. The `npm test` unit suite (`test/*.test.js`,
CI-gated) covers the pure data layer: reveal-only derivations, spoiler gates,
routing, and run-expectancy/tiering math, including the spoiler invariant pinned on a
captured real-game feed (`docs/testing.md`). This suite does not replace the
browser-level check. For anything user-visible, also run `npm run dev` or `npm run
e2e` against a live or recent game. `docs/test-games.md` lists verified gamePks with
rare in-game events; `.claude/skills/run.md` documents that loop.

**Test discipline: the suite only has value if it stays honest.** Never delete,
skip, or loosen a test's assertions to make CI or a commit pass — fix the code,
or stop and ask. A fix for a real bug ships with a test that FAILS without the
fix: add the test first, watch it fail, then fix the code. Product code and its
tests land in the same PR. `main` requires the `lint-and-build` check (lint +
`npm test` + build); the nightly data crons bypass it with an admin PAT
(`GH_BOT_TOKEN`) — read `docs/testing.md` before you change CI or that token.

## The spoiler rule — and its scope, which is half the rule

This is the whole point of the app. **Don't let either half drift.** On the surfaces
where you score a game — the slate's score cells, the lineup pages, the innings viewer,
the box score — a score-revealing value never exists in the DOM until you reveal it. It
is never fetched-then-hidden, and never computed early. Everything else about baseball
opens live: season and career stats, player and team pages, leader boards, standings,
and the standalone pages outside the scoring flow. A stat line is not a score, and
gating one was the rule reaching past what it protects (ADR-0034, "The cutoff is opt-in
now"). Four **opt-in, consented** departures lift the seal inside the scope. Three are *render*
overrides that persist nothing: the site-wide **Scores Unlocked** switch, unsealing a day you
agree to spoil (ADR-0026); **Stamp In** (`/team/{id}/stamp-in`), a club's played season shown so
you can stamp it, gated on the PAGE (ADR-0042); and a game carrying your own **stamp** (ADR-0048).
The fourth persists one bit per game, never the reveal mark: **a box score you tapped open stays
open**, on every device you own (ADR-0049). A fifth is a call. `docs/adr/` has the *why* — read it.

Inside that scope, two conventions enforce it structurally:

1. **Reveal-only modules** (`src/api/linescore.js`, `src/api/derive.js`) are callable
   only inside a `SealBox`'s reveal render function — never at render top-level or in an
   eager `useMemo` (ADR-0001). Contrast `src/api/select.js`, spoiler-**free**. Between
   them sit **caller-gated pre-pitch selectors** (`selectPrePitchChanges`,
   `defenseEntering`, `lineupEntering`), spoiler-free only for the half the user has
   reached (`halfIndex <= revealedThrough + 1`) — ADR-0003/0010. Rule in
   `src/api/CLAUDE.md`, catalog `docs/api/`, UI `src/CLAUDE.md`.

2. **`src/components/SealBox.jsx`** takes `children` as a render function and
   calls it only once revealed. Reveal is one-directional. Re-sealing on inning
   navigation works because the parent remounts with `key={inning}` (see
   `InningViewer.jsx`) (ADR-0002).

The PWA service worker uses `NetworkOnly` for `statsapi.mlb.com` (`vite.config.js`),
so a stale, spoiler-revealing score is never served from cache (ADR-0004).

Three gotchas each caused a real spoiler bug and are now ADRs: roster-card
membership and position labels (ADR-0005); per-inning `errors` being a *fielding*
stat, not a score (ADR-0006); and `useRef` caches of reveal-only derivations that
must key on the `feed` object (ADR-0007). **The Pitchers table** is gated by
`revealedThrough` directly, not wrapped in a `SealBox` (ADR-0009). **Extra innings
never spoil** — only `regulation` innings show up front; extras unlock one at a
time as `revealedThrough` advances (ADR-0008). Both are detailed in `src/CLAUDE.md`.

## Architecture (map)

**No backend, by default.** Every device queries `https://statsapi.mlb.com`
directly. Each game's reveal high-water mark (`revealedThrough`) persists in
`localStorage` under `bbsbh:reveal:{gamePk}` — only that half-index, never a score,
so the spoiler rule still holds on return. A same-device tab picks up another tab's
reveal through a `storage` listener in `useRevealProgress.js`.

**Nine narrow, opt-in exceptions (`api/`)**, all Vercel functions, all inert when unconfigured;
**eight never render or fetch a score.** Link previews (`og.js` + `preview.js` + `_lib/cards.js`)
render Open Graph cards, failing safe to the default card (ADR-0012). Reveal sync (Clerk, off
unless `VITE_CLERK_PUBLISHABLE_KEY` is set) mirrors `revealedThrough` via `reveal.js` + Upstash
Redis, ratcheted both sides (ADR-0022); its companion `spoiled-days.js` mirrors which DAYS the user
consented to spoil — consent, never a mark, reversible (ADR-0026). `copy.js` + `src/copy/` store
editable wording behind a cached read and an allowlisted write (ADR-0025), tuned without a deploy
and edited ON the page that renders it — the Ballpark card's gear, whose `ballpark-photo.js` puts
images in Vercel Blob: the only exception taking BYTES (ADR-0044). **My Tally**'s `preferences.js`
+ `src/lib/account/` mirror a CLOSED four-field set, last-write-wins per field; `account.js` erases
every per-user key (ADR-0039). The Game Log's `books.js` mirrors the shelf — a cover's title,
subtitle, club and mark, never a stamp (ADR-0041). `game-story.js` is a CORS hop to MLB.com's team
RSS feeds, which send none. `page.js` + `src/copy/landing/` server-render the `/learn` guides — AI
crawlers run no JS, so they have never seen this app (ADR-0048). **The ninth stores a score, by
design**: the Game Log's stamps (`stamps.js`, `src/lib/stamps.js`) — safe because of WHERE stamp
art may render (`check-stamp-surfaces`), not a mint-time check; the gate was retired in ADR-0035's
second amendment. Naming/voice: `docs/game-log.md`.

Two nested `CLAUDE.md` files carry the detail, loaded only when you work there:
- **`src/CLAUDE.md`** — screens flow (`GameSelect → GameView → TeamInfo →
  InningViewer`), routing (`src/lib/route.js`, `src/App.jsx`), fetching (`useAsync`),
  the token-based design system, and the UI-side spoiler enforcement. `/team/{id}` is a
  five-tab hub; each tab is a real route that loads only its own data (ADR-0034).
- **`src/api/CLAUDE.md`** — the data layer's RULE, not its catalog: the reveal-only vs.
  spoiler-free split (machine-readable in `spoiler-manifest.json`), the
  **build-time-fetch pattern** (static `public/data/*.json` precomputed by
  `scripts/gen-*.mjs`), and the conventions. Per-module notes live a tier down in
  `docs/api/` (`live-game`, `static-data`, `account-layer`), loaded on reference.

## Conventions to follow

- **MiLB data degrades gracefully.** MLB feeds are complete. Minor-league feeds
  (sportIds 11–14, see `src/lib/teams.js`) often miss lineups, weather, coaches, or
  logos. Every selector falls back to `''`/`null`/`—`, and callers render "not
  posted yet" instead of crashing. Keep this pattern for any new field you read.
- **Team ids are the universal key.** The same `teamId` drives schedule data, box
  scores, and the logo CDN (`teamLogoUrl` in `teams.js`). The Brewers (id 158) are
  pinned to the top of the slate (`PINNED_TEAM_ID`).
- **Verify feed field paths against a live game.** The MLB feed shape is
  undocumented; `api/statsapi.js` notes which paths were checked against which
  gamePk. Confirm a new field against a real response; do not guess.
- **Styling is a token-based design system.** `src/index.css` holds only `@import`s:
  `src/tokens/*.css`, then the ordered `src/styles/*.css` partials where the rules live.
  The metaphor is a paper scorebook (manila paper, navy ink, pencil graphite, kraft-tape
  amber seals). Use semantic CSS variables, not raw hex. See `src/CLAUDE.md`.
- **Flat directories don't stay flat.** Subdivide a directory before roughly its
  10th file; `check-dir-size`/`check-file-size` enforce this (ADR-0038).

## Agent skills

- **Issue tracker** — issues live as local markdown under `.scratch/<feature-slug>/`
  (solo project, no GitHub Issues). See `docs/agents/issue-tracker.md`.
- **Triage labels** — `needs-triage` / `needs-info` / `ready-for-agent` /
  `ready-for-human` / `wontfix`, used as-is. See `docs/agents/triage-labels.md`.
- **Domain docs** — single-context: one `CONTEXT.md` + `docs/adr/`. See
  `docs/agents/domain.md`.
- **Callouts / Team Leaders** — catalog (families, triggers, surfaces, gates,
  worthiness) is `docs/callouts.md`; the tense rule is ADR-0014. They come from the
  nightly `gen-callouts.mjs` precompute — extend it, do not build a parallel path.
  See `docs/scripts/generators.md` + `docs/api/`.
- **Writing style** — ASD-STE100 governs chat replies, authored docs, and commit/PR text here, always on. See `docs/agents/writing-style.md`.
