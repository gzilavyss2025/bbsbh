# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Tally Baseball** (repository name: `bbsbh`) is a spoiler-safe, read-only second-screen
PWA for scoring baseball by hand. It displays lineups, umpires, rosters, and
inning totals pulled live from the public MLB Stats API — but every
score-revealing number stays sealed until the user taps to reveal it. It is
**not** a data-entry tool; the user keeps scoring on paper.

React 18 + Vite, phone-first (iPhone), installable PWA, **no backend**.

## Maintaining these docs

This file is loaded into context on **every** session and persists the whole
session, so its size is a fixed per-session token tax. **Keep it lean** — under
**200 lines**, enforced by `scripts/check-claude-md.mjs` (run by `npm run lint`,
gated in CI). Detail lives in three tiers, most-specific first:

- **Nested `CLAUDE.md`** in `src/`, `src/api/`, and `scripts/` — loaded only when
  Claude Code navigates into that directory, so subsystem detail is paid for on
  demand, not every session. Per-module and per-script prose goes here.
- **`docs/*` and `docs/adr/`** — reference catalogs and the *why* behind decisions.
- **`CONTEXT.md`** — the domain glossary the spoiler/architecture prose relies on.

When you're tempted to add detail here, add it to the right tier and leave a
one-line pointer. If the leanness check fails, move content out — don't raise the
cap. After structural work, check whether the nested `CLAUDE.md` or `docs/adr/` entry
it touched needs updating too — a stale tier is worse than none.

## Workflow & deployment

**All sessions use task branches and pull requests. Never push directly to `main`
or invoke a Vercel deployment.** This is a Vercel Hobby project, so keep
work-in-progress off `main`, batch related changes, and reduce deployment-triggering
merges ruthlessly. Non-`main` previews are disabled; verify locally instead.

Multiple agents may be active at once. Treat unfamiliar changes as another agent's
work, inspect status/diffs before editing, isolate work by branch/worktree, and stop
to coordinate any overlapping files. Never reset, stash, overwrite, or reformat
someone else's work. In a fresh context, fetch and inventory worktrees/open PRs
before choosing a base: independent work starts from current `origin/main`; work that
needs an unmerged PR must name and intentionally base on that PR branch. Record
branch/worktree/PR state in the final handoff so the next context can resume safely.

For user-visible changes, start the first free reserved localhost dev server, verify
the exact changed route, keep it running, and include that clickable local URL in the
final handoff. **Append `?nointro` to any test URL** so the first-visit welcome modal
doesn't cover the slate (e2e specs get it via `e2e/fixtures.js`). See
`docs/development.md` for the full workflow.

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

**Reserved dev ports (multi-agent safe).** `dev`/`preview` are `5173`/`4173`
(`strictPort` — no silent auto-increment); if a slot is taken by another worktree use
the next numbered one, `npm run dev:2..5` (`5172`→`5169`) / `preview:2..5`
(`4172`→`4169`). Rationale + the tally-nfl band split are in `vite.config.js`.

The `scripts/gen-*.mjs` data generators (WAR, rehab, umpires, callouts,
…) are documented in `scripts/CLAUDE.md`. The `npm test` unit suite (`test/*.test.js`,
CI-gated) covers the pure data layer — reveal-only derivations, spoiler gates,
routing, run-expectancy/tiering math — including the spoiler invariant pinned on a
captured real-game feed (`docs/testing.md`). It is not a substitute for the
browser-level check: for anything user-visible also run `npm run dev` / `npm run e2e`
against a live or recent game. `docs/test-games.md` has verified gamePks with rare
in-game events; `.claude/skills/run.md` documents the loop.

**Test discipline (the suite only has value if it stays honest).** Never delete,
skip, or loosen a test's assertions to make CI or a commit pass — fix the code, or
stop and ask. A fix for a real bug lands with a test that FAILS without the fix (add
it first, watch it fail, then fix); product code and its tests land in the same PR.
`main` requires the `lint-and-build` check (lint + `npm test` + build); the nightly
data crons bypass it via an admin PAT (`GH_BOT_TOKEN`) — see `docs/testing.md` before
changing CI or that token.

## The spoiler rule — the core invariant

This is the whole point of the app. **Do not let it drift.** The rule: a
score-revealing value must never exist in the DOM until the user reveals it — there
is no fetched-then-hidden node to leak, with one narrow, explicit exception (All-Star
Rosters shows final scores plainly — ADR-0019). One **opt-in, consented** departure
also lifts the seal on demand: the site-wide **Scores Unlocked** switch — a *render*
override that unseals a day you explicitly agree to spoil (and keeps a live game's
view current), while never writing the persisted reveal mark — ADR-0026.
`CONTEXT.md` defines the vocabulary
(Seal, SealBox, reveal-only module, spoiler-free selector, revealedThrough,
half-inning, regulation/extra innings, Pitchers table, primary position); `docs/adr/`
records *why* each mechanism is shaped as it is — read the linked ADR before
"simplifying" any of these.

Enforced structurally by two conventions:

1. **Reveal-only modules** (`src/api/linescore.js`, `src/api/derive.js`), callable
   only from inside a `SealBox`'s reveal render function — never at render top-level
   or in an eager `useMemo` (ADR-0001). Contrast `src/api/select.js`,
   spoiler-**free**. In between sit **caller-gated pre-pitch selectors** —
   `selectPrePitchChanges` (`select.js`, ADR-0003), `defenseEntering` (`defense.js`),
   and `lineupEntering` (`battingorder.js`) — spoiler-free only when restricted to the
   half the user has reached (`halfIndex <= revealedThrough + 1`); the defense diamond
   and both lineup cards render *outside* the seal, gated to
   `revealed || isNextToReveal` (ADR-0010). See `src/api/CLAUDE.md` for the module
   catalog and `src/CLAUDE.md` for the component wiring.

2. **`src/components/SealBox.jsx`** takes `children` as a render function, invoked
   only once revealed; reveal is one-directional, and re-sealing on inning navigation
   works by the parent remounting with `key={inning}` (see `InningViewer.jsx`)
   (ADR-0002).

The PWA service worker uses `NetworkOnly` for `statsapi.mlb.com` (`vite.config.js`)
so a stale, spoiler-revealing score is never served from cache (ADR-0004).

Three gotchas each caused a real spoiler bug and are now ADRs: roster-card
membership/position labels (ADR-0005), per-inning `errors` being a *fielding* stat
(ADR-0006), and manual (`useRef`) caches of reveal-only derivations needing to key on
the `feed` object (ADR-0007). **The Pitchers table** is gated by `revealedThrough`
directly rather than wrapped in a `SealBox` (ADR-0009), and **extra innings never
spoil** — only `regulation` innings show up front, extras unlock one at a time as
`revealedThrough` advances (ADR-0008). Both are detailed in `src/CLAUDE.md`.

## Architecture (map)

**No backend, by default.** Every device queries `https://statsapi.mlb.com` directly.
Each game's reveal high-water mark (`revealedThrough`) persists in `localStorage`
under `bbsbh:reveal:{gamePk}` — only that half-index, never a score, so the spoiler
rule still holds on return; a same-device tab picks up another tab's reveal via a
`storage` listener in `useRevealProgress.js`.

**Four narrow, opt-in exceptions (`api/`)**, all Vercel functions, all inert when
unconfigured. **Three never render or fetch a score.** Link previews (`api/og.js` + `api/preview.js` +
`api/_lib/cards.js`) render dynamic Open Graph cards for shared deep links, failing
safe to the static default card — ADR-0012. Multi-device reveal sync (Clerk, off
unless `VITE_CLERK_PUBLISHABLE_KEY` is set) mirrors `revealedThrough` across a user's
own devices via `api/reveal.js` + Upstash Redis, ratcheted both sides, inert if
unconfigured — ADR-0022; its companion `api/spoiled-days.js` mirrors which DAYS the
user consented to spoil (consent, never a mark — a per-day on/off state map, since
that one can move back) — ADR-0026. Admin-editable copy (`api/copy.js` + `src/copy/`) stores the
consent-pop-up wording (never a score, closed registry, public-cached read,
allowlisted write) so the owner tunes it without a deploy — inert if unconfigured,
ADR-0025. **The fourth stores a score, by design**: the **Game Log**'s game stamps
(`api/stamps.js` + `src/lib/stamps.js`, surfaced at `/logbook` and inside the box
score's seal) — safe because of WHERE stamp art may render (`check-stamp-surfaces`,
never an unrevealed-game surface), not a mint-time permission check; the server-side
reveal gate was retired in ADR-0035's second amendment, which says why. Scope,
naming contract, and copy voice: `docs/game-log.md`.

Two nested `CLAUDE.md` files carry the detail, loaded when you work there:
- **`src/CLAUDE.md`** — screens flow (`GameSelect → GameView → TeamInfo →
  InningViewer`), routing (`src/lib/route.js`, `src/App.jsx`), fetching (`useAsync`),
  the token-based design system, and the UI-side spoiler enforcement. `/team/{id}`
  is a five-tab hub, each tab a real route loading only its own data — ADR-0034.
- **`src/api/CLAUDE.md`** — the data layer: per-topic fetch wrappers/selectors over
  statsapi, the reveal-only vs. spoiler-free split, and the **build-time-fetch
  pattern** (static `public/data/*.json` precomputed by `scripts/gen-*.mjs`, read
  same-origin) behind WAR, rehab, umpires, game-notes, minors-leaders, and the
  leader boards.

## Conventions to follow

- **MiLB data degrades gracefully.** MLB feeds are complete; minor-league feeds
  (sportIds 11–14, see `src/lib/teams.js`) often miss lineups, weather, coaches, or
  logos. Every selector falls back to `''`/`null`/`—` and callers render "not posted
  yet" instead of crashing. Keep this for any new field you read.
- **Team ids are the universal key.** The same `teamId` drives schedule data, box
  scores, and the logo CDN (`teamLogoUrl` in `teams.js`). The Brewers (id 158) are
  pinned to the top of the slate (`PINNED_TEAM_ID`).
- **Verify feed field paths against a live game.** The MLB feed shape is
  undocumented; `api/statsapi.js` notes paths were checked against a specific gamePk.
  Confirm a new field against a real response, don't guess.
- **Styling is a token-based design system.** `src/index.css` is `@import`s only —
  `src/tokens/*.css`, then the ordered `src/styles/*.css` partials where rules live.
  The metaphor is a paper scorebook (manila paper, navy ink, pencil graphite,
  kraft-tape amber seals). Use semantic CSS variables, not raw hex. See `src/CLAUDE.md`.
- **Flat directories don't stay flat.** Subdivide before roughly the 10th file in a
  directory; `check-dir-size`/`check-file-size` enforce it (ADR-0038).

## Agent skills

- **Issue tracker** — issues live as local markdown under `.scratch/<feature-slug>/`
  (solo project, no GitHub Issues). See `docs/agents/issue-tracker.md`.
- **Triage labels** — `needs-triage` / `needs-info` / `ready-for-agent` /
  `ready-for-human` / `wontfix`, used as-is. See `docs/agents/triage-labels.md`.
- **Domain docs** — single-context: one `CONTEXT.md` + `docs/adr/`. See
  `docs/agents/domain.md`.
- **Callouts / Team Leaders** — the callout catalog (families, triggers, surfaces,
  gates, worthiness scores) is `docs/callouts.md`; the tense rule is ADR-0014.
  Callouts are generated by the nightly `gen-callouts.mjs` precompute — extend that
  pipeline, don't build a parallel path. See `scripts/CLAUDE.md` + `src/api/CLAUDE.md`.
