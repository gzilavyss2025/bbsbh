# CLAUDE.md

## What this is

**Tally Baseball** (repo name `bbsbh`) is a PWA for scoring baseball by hand. It is
read-only, made for use as a second screen next to a live game. It shows lineups,
umpires, rosters, and inning totals from the public MLB Stats API. On the scoring
surfaces, a number that would spoil the game stays sealed until you tap to reveal it.
This app is **not** a data-entry tool. The user keeps score on paper.

React 19 + Vite, phone-first (iPhone), installable PWA with Vercel backend.

## Maintaining these docs

This file loads into every session, so its size is a fixed token cost. **Keep it
lean**: stay under **200 lines**. `scripts/check-claude-md.mjs` caps it, its characters,
and every nested file; `npm run lint` runs the check. Detail lives in three tiers, most
specific first:

- **Nested `CLAUDE.md`** files. One loads the first time Claude reads a file in its
  folder, then stays for the session, and its parent files load with it. So put a rule
  in the deepest folder that every edit it governs passes through (ADR-0098). The
  guard finds them on disk; the facts guard checks this list.
  - `api/` — the Vercel functions, one line each.
  - `src/` — screen flow, routing, fetching, the design system, and the UI half of the
    spoiler rule. Folder detail sits below it: `src/screens/team/` (the seven-band page),
    `src/screens/profile/` (My Tally), `src/screens/player/next/` (the new player page, module contract), `src/screens/lineup/next/` (the new lineup page), `src/screens/gameday/next/` (the new Gameday shell), `src/styles/`, `src/components/`, and in that
    folder `src/components/ui/`, `src/components/boxlines/`, `src/components/chrome/`,
    `src/components/worldseries/`, `src/components/honors/`, `src/components/logbook/`, `src/components/offseason/`, `src/components/passport/`,
    `src/components/playbyplay/`, and `src/components/transactions/`.
  - `src/api/` — the data layer's RULE: the reveal-only vs. spoiler-free split
    (`spoiler-manifest.json`) and the build-time-fetch pattern. Folder detail:
    `src/api/around-the-game/`, `src/api/boxlines/`, `src/api/expresslane/`,
    `src/api/gameday/` (Gameday's data), and `src/api/transactions/`.
  - `src/lib/` — club identity: colours, logo treatments, stamp ink. The stores:
    `src/lib/data/`.
  - `scripts/` — generator and guard rules. `test/` — the unit suite.
- **`docs/*` and `docs/adr/`** — reference catalogs (per-module notes in `docs/api/`) and
  the *why* behind decisions.
- **`CONTEXT.md`** — the domain glossary the spoiler and architecture prose relies on.

Add detail to the right tier and leave a one-line pointer here. If the leanness check
fails, move content out; do not raise the cap. After structural work, update the nested
`CLAUDE.md` or `docs/adr/` entry you touched.

## Workflow & deployment

**All sessions use task branches and pull requests. Never push directly to `main`
or trigger a Vercel deployment.** Two exceptions: a `/stack-prs` merge, run by Gary or
by the orchestrator under his standing permission (`.claude/skills/orchestrate/`), and
`merge-pr` when Gary says "merge the pr" (green CI only, no stack). Keep
work-in-progress off `main` and batch related changes into one stack (Vercel Pro since
2026-10-29). Every push to a PR branch gets a preview URL on the PR's Vercel check; it
needs a Vercel sign-in. Verify in your own container first; the preview is for Gary:
end your handoff with the preview link for the route you changed, `?nointro` added.

**Cloud is the default** (`CLAUDE_CODE_REMOTE=true`; Gary works in claude.ai/code). One
container, one branch: use the branch the session gives you, cut from current
`origin/main`. No worktree. No `gh`: use the GitHub MCP tools. Other sessions run in
parallel, so list the open PRs and their files before you edit. Stop only on a real
collision (the same code, budget numbers, lockfiles, generated files); otherwise go on
and name the other PR in yours.
Open your PR as a draft (`mark-ready.yml` flips it to ready and adds `wip`); remove `wip` when
the work is done and CI is green; never merge it. `/stack-prs` lands it. Every push starts a
CI run, so while Gary iterates, commit locally and push at his checkpoints, when the PR is
ready, or before you stop (the PR is the handoff) — never every turn. Verify in the
container by rendering the route you changed in the preinstalled Chromium.
**Add `?nointro` to any test URL**, so the first-visit welcome modal does
not cover the slate (`e2e` specs add this through `e2e/fixtures.js`). A session Gary is
watching may ask with `AskUserQuestion`, one question at a time. A child or unattended
session writes `[DECISION: ...]` lines instead. Detail: `docs/development.md`, "Cloud
sessions".

**Long runs:** keep going unless blocked or about to do something destructive, keep a
checklist file, end with `Blocked on me` / `Changed` / `Found`, and mark what you could
not confirm. Detail: `docs/development.md`, "Long runs".

**Local sessions** (worktree, a second dev server on `npm run dev -- --port N`): `docs/development.md`,
"Local sessions only".

## Commands

```bash
npm install
npm run dev        # dev server (fixed port 5173, strictPort)
npm run build      # production build → dist/
npm run preview    # serve the built app
npm run lint       # eslint + guard scripts (caps, casing, typography, contrast, claude-md, …)
npm test           # node:test unit suite (pure logic; CI-gated)
npm run test:coverage  # same, with a per-file coverage report
npm run knip       # unused files/exports/deps (advisory, not in CI; config: knip.json;
                   #   add -- --production for code only tests or scripts use)
npm run e2e        # playwright — ONLY when Gary asks (hook-enforced, see docs/testing.md)
```

`scripts/gen-*.mjs` are the data generators (WAR, rehab, umpires, callouts, and more);
`docs/scripts/generators.md` catalogs them. The `npm test` suite does not replace the
browser-level check. For anything user-visible, also check it in `npm run dev`
against a live or recent game. `docs/test-games.md` lists verified gamePks with
rare in-game events; `.claude/skills/run/` documents that loop.

**Test discipline: the suite only has value if it stays honest.** Never delete,
skip, or loosen a test's assertions to make CI or a commit pass — fix the code,
or stop and ask. A fix for a logic bug ships with a test that FAILS without the
fix: add the test first, watch it fail, then fix the code. A bug in layout, CSS, or
copy has no unit test; check it in the browser. Product code and its
tests land in the same PR. `main` requires the `lint-and-build` check (lint +
`npm test` + build); the nightly data crons bypass it with an admin PAT
(`GH_BOT_TOKEN`) — read `docs/testing.md` before you change CI or that token.

## The spoiler rule

It covers four scoring surfaces and nothing else: the slate's score cells, the lineup
pages, the innings viewer, and the box score. On those, a score-revealing value never
exists in the DOM until you reveal it. It is never fetched-then-hidden, and never
computed early. Everything else opens live and needs no spoiler thought: season and
career stats, player and team pages, leader boards, standings, the money pages, and the
standalone pages. A stat line is not a score. Do not seal, gate, or warn about anything
outside the four surfaces (ADR-0034, ADR-0052). Opt-in departures inside them (Stamp In,
stamps, a box score you opened) and their reasons: `docs/adr/` (ADR-0042, 0048, 0049, 0116, 0117).

Inside the four surfaces, two conventions enforce it structurally:

1. **Reveal-only modules** (`src/api/linescore.js`, `derive.js`, `hitchart.js`) are
   callable only inside a `SealBox`'s reveal render function — never at render top-level
   or in an eager `useMemo` (ADR-0001). `src/api/select.js` is spoiler-**free**. The
   classes are in `src/api/CLAUDE.md`, the catalog in `docs/api/`, the UI half in `src/CLAUDE.md`.

2. **`src/components/SealBox.jsx`** takes `children` as a render function and
   calls it only once revealed. Reveal is one-directional (ADR-0002).

The PWA service worker uses `NetworkOnly` for `statsapi.mlb.com` (`vite.config.js`),
so a stale score is never served from cache (ADR-0004). Five gotchas, each from a real
bug, are in `src/CLAUDE.md`.

## Architecture (map)

**Game data is client-direct.** Every device queries `https://statsapi.mlb.com`
directly. Each game's reveal high-water mark (`revealedThrough`) persists in
`localStorage` under `bbsbh:reveal:{gamePk}` — only that half-index, never a score,
so the spoiler rule still holds on return. A same-device tab picks up another tab's
reveal through a `storage` listener in `useRevealProgress.js`.

## Conventions to follow

- **Make the best decision for UX, DX, and AX.** User experience, developer experience, and
  agent experience: serve all three. When they conflict, UX and AX win over DX. Keep the
  change minimal and the tests green.
- **Build the smallest version that works.** No new abstraction, option, or component the
  request does not need. A small idea you spot goes under `Found` in your report; a big one
  becomes a `needs-triage` issue. Ask Gary only when you are blocked.
- **Show wireframes as an Artifact.** For a new or redesigned screen, put a wireframe in an
  Artifact and iterate with Gary before you build (`.claude/skills/design-brief/`).
- **Claude Code practice moves fast.** Before you change hooks, skills, or CLAUDE.md
  structure, ask the `claude-code-guide` agent.
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
- **Pitch types have one shape and one colour everywhere.** Read `pitchMark(code)` in
  `src/lib/pitch/pitchTypes.js`; never pick a pitch colour in a screen (`docs/pitch-types.md`).
- **Flat directories don't stay flat.** Subdivide a directory before roughly its
  10th file; `check-dir-size` fails past 12 (`MAX_FILES`) and `check-file-size` caps
  file length (ADR-0038).

## Agent skills

- **Issue tracker** — issues go to **GitHub Issues** (`gh issue` locally; the GitHub MCP tools in the cloud). `.scratch/<slug>/`
  holds working notes, not the tracker. See `docs/agents/issue-tracker.md`.
- **Triage labels** — `needs-triage` / `needs-info` / `ready-for-agent` /
  `ready-for-human` / `wontfix`, used as-is. See `docs/agents/triage-labels.md`.
- **Domain docs** — single-context: one `CONTEXT.md` + `docs/adr/`. See
  `docs/agents/domain.md`.
- **On request** — design-system sync to claude.ai/design: `docs/design-sync.md`. What other
  baseball sites do: start from `docs/peer-sites.md` and add to it.
- **Word list** — `check-word-choice` enforces the house word list: say "postseason", never "playoffs". <!-- word-choice-exempt: states the rule -->
