# CLAUDE.md

## What this is

**Tally Baseball** (repo name `bbsbh`) is a PWA for scoring baseball by hand. It is
spoiler-safe and read-only, made for use as a second screen next to a live game. It
shows lineups, umpires, rosters, and inning totals from the public MLB Stats API. Any
number that would spoil the game stays sealed until you tap to reveal it. This app is
**not** a data-entry tool. The user keeps score on paper.

React 19 + Vite, phone-first (iPhone), installable PWA with Vercel backend.

## Maintaining these docs

This file loads into every session and stays loaded for the whole session. Its size
is a fixed token cost per session. **Keep it lean**: stay under **200 lines**.
`scripts/check-claude-md.mjs` enforces this cap, a character cap, and a cap on every
nested file; `npm run lint` runs the check in CI. Detail lives in three tiers, most
specific first:

- **Nested `CLAUDE.md`** files. One loads the first time Claude reads a file in its
  folder, then stays for the session, and its parent files load with it. So put a rule
  in the deepest folder that every edit it governs passes through (ADR-0098). The
  guard finds them on disk; the facts guard checks this list.
  - `api/` — the Vercel functions, one line each.
  - `src/` — screen flow, routing, fetching, the design system, and the UI half of the
    spoiler rule. Folder detail sits below it: `src/screens/team/` (the six-tab hub),
    `src/screens/profile/` (My Tally), `src/styles/`, `src/components/`, and in that
    folder `src/components/ui/`, `src/components/boxlines/`, `src/components/chrome/`,
    `src/components/logbook/`, `src/components/offseason/`, `src/components/passport/`,
    `src/components/playbyplay/`, and `src/components/transactions/`.
  - `src/api/` — the data layer's RULE: the reveal-only vs. spoiler-free split
    (`spoiler-manifest.json`) and the build-time-fetch pattern. Folder detail:
    `src/api/around-the-game/`, `src/api/boxlines/`, `src/api/expresslane/`, and
    `src/api/transactions/`.
  - `src/lib/` — club identity: colours, logo treatments, stamp ink. The stores:
    `src/lib/data/`.
  - `scripts/` — generator and guard rules. `test/` — the unit suite.
- **`docs/*` and `docs/adr/`** — reference catalogs (per-module notes in `docs/api/`) and
  the *why* behind decisions.
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
needing an unmerged PR must name and deliberately base on that PR branch. Record that
state in your handoff. **Cloud sessions** (`CLAUDE_CODE_REMOTE`): `docs/development.md`.

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
npm run e2e        # playwright — ONLY when Gary asks (hook-enforced, see docs/testing.md)
```

**Reserved dev ports (multi-agent safe).** `dev` uses port `5173`; `preview` uses
`4173`. `strictPort` is on, so neither port auto-increments. If another worktree
holds that port, use the next numbered script: `npm run dev:2` through `dev:5`
(ports `5172`→`5169`), or `preview:2` through `preview:5` (`4172`→`4169`).
`vite.config.js` has the rationale and the tally-nfl band split.

`scripts/gen-*.mjs` are the data generators (WAR, rehab, umpires, callouts, and more);
`docs/scripts/generators.md` catalogs them. The `npm test` suite does not replace the
browser-level check. For anything user-visible, also check it in `npm run dev`
against a live or recent game. `docs/test-games.md` lists verified gamePks with
rare in-game events; `.claude/skills/run/` documents that loop.

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
is never fetched-then-hidden, and never computed early. Everything else about baseball opens live:
season and career stats, player and team pages, leader boards, standings, the money pages (`/salaries`
and a club's Contracts tab, ADR-0052), and the standalone pages outside the scoring flow. A stat line
is not a score, and gating one was the rule reaching past what it protects (ADR-0034, "The cutoff is
opt-in now"). Four **opt-in, consented** departures lift the seal inside the scope. Three are *render*
overrides that persist nothing: the site-wide **Scores Unlocked** switch, unsealing a day you agree to
spoil (ADR-0026); **Stamp In** (`/team/{id}/stamp-in`), a club's played season shown so you can stamp
it, gated on the PAGE (ADR-0042); and a game carrying your own **stamp** (ADR-0048). The fourth
persists one bit per game, never the reveal mark: **a box score you tapped open stays open**, on every
device you own (ADR-0049). A fifth is a call. `docs/adr/` has the *why* — read it.

Inside that scope, two conventions enforce it structurally:

1. **Reveal-only modules** (`src/api/linescore.js`, `derive.js`, `hitchart.js`) are
   callable only inside a `SealBox`'s reveal render function — never at render top-level
   or in an eager `useMemo` (ADR-0001). `src/api/select.js` is spoiler-**free**; the
   caller-gated selectors between them are ADR-0003/0010. The classes are in
   `src/api/CLAUDE.md`, the catalog in `docs/api/`, the UI half in `src/CLAUDE.md`.

2. **`src/components/SealBox.jsx`** takes `children` as a render function and
   calls it only once revealed. Reveal is one-directional. Re-sealing on inning
   navigation works because the parent remounts with a key of inning and half (see
   `src/screens/InningViewer.jsx`) (ADR-0002).

The PWA service worker uses `NetworkOnly` for `statsapi.mlb.com` (`vite.config.js`),
so a stale, spoiler-revealing score is never served from cache (ADR-0004).

Three gotchas each caused a real spoiler bug: roster cards (ADR-0005), per-inning
`errors` (ADR-0006), and `useRef` caches (ADR-0007). Two more rules: the Pitchers table
(ADR-0009) and extra innings (ADR-0008). `src/CLAUDE.md` has all five.

## Architecture (map)

**Game data is client-direct.** Every device queries `https://statsapi.mlb.com`
directly. Each game's reveal high-water mark (`revealedThrough`) persists in
`localStorage` under `bbsbh:reveal:{gamePk}` — only that half-index, never a score,
so the spoiler rule still holds on return. A same-device tab picks up another tab's
reveal through a `storage` listener in `useRevealProgress.js`.

**Fifteen Vercel functions live in `api/`**, each inert when unconfigured;
**fourteen never render or fetch a score.** **The fifteenth stores a score, by design**:
the Game Log's stamps (`stamps.js`, `src/lib/stamps.js`), safe because of WHERE stamp art
may render (`check-stamp-surfaces`), not a mint-time check (ADR-0035). The other
fourteen, each with its ADR: `api/CLAUDE.md`.

## Conventions to follow

- **MiLB data degrades gracefully.** MLB feeds are complete. Minor-league feeds
  (sportIds 11–14, see `src/lib/teams.js`) often miss lineups, weather, coaches, or
  logos. Every selector falls back to `''`/`null`/`—`, and callers render "not
  posted yet" instead of crashing. Keep this pattern for any new field you read.
- **Team ids are the universal key.** The same `teamId` drives schedule data, box
  scores, and the logo CDN (`teamLogoUrl` in `teams.js`). The user's favorite team
  (`useFavoriteTeam`) pins to the top of the slate; the Brewers (158) are only the default.
- **Verify feed field paths against a live game.** The MLB feed shape is
  undocumented; `src/api/statsapi.js` notes which paths were checked against
  gamePk. Confirm a new field against a real response; do not guess.
- **Styling is a token-based design system** (a paper scorebook). Use semantic CSS
  variables, not raw hex. Rules: `src/CLAUDE.md` and `src/styles/CLAUDE.md`.
- **Flat directories don't stay flat.** Subdivide a directory before roughly its
  10th file; `check-dir-size` fails past 12 (`MAX_FILES`) and `check-file-size` caps
  file length (ADR-0038).

## Agent skills

- **Issue tracker** — issues go to **GitHub Issues** (`gh issue`). `.scratch/<slug>/`
  holds working notes, not the tracker. See `docs/agents/issue-tracker.md`.
- **Triage labels** — `needs-triage` / `needs-info` / `ready-for-agent` /
  `ready-for-human` / `wontfix`, used as-is. See `docs/agents/triage-labels.md`.
- **Domain docs** — single-context: one `CONTEXT.md` + `docs/adr/`. See
  `docs/agents/domain.md`.
- **Writing style** — ASD-STE100 governs chat replies, authored docs, and commit/PR
  text here, always on. See `docs/agents/writing-style.md`.
  The house word list is enforced by `check-word-choice`: say "postseason", never "playoffs". <!-- word-choice-exempt: states the rule -->
