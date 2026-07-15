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

- **Nested `CLAUDE.md`** in `src/`, `src/api/`, and `scripts/` — Claude Code loads
  these only when it navigates into that directory, so subsystem detail is paid for
  on demand, not every session. Per-module and per-script prose goes here.
- **`docs/*` and `docs/adr/`** — reference catalogs and the *why* behind decisions.
- **`CONTEXT.md`** — the domain glossary the spoiler/architecture prose relies on.

When you're tempted to add detail here, add it to the right tier and leave a
one-line pointer. If the leanness check fails, move content out — don't raise the
cap.

## Workflow & deployment

Two working modes land in this repo's history — know which you're in
(full detail in `docs/development.md`):

- **Interactive CLI session** (maintainer at a terminal): work on `main`, commit
  and push each self-contained change straight to `origin/main` (Vercel
  auto-deploys to production). No branches, no PRs.
- **Autonomous/remote session** (web, GitHub-triggered, background): pushed to a
  `claude/<slug>` branch and required to open a draft PR by the launching harness.
  Don't force a direct `main` push; open the PR and let the maintainer merge.

Always run `npm run lint` / `npm run build` before pushing so `main` stays green
(the direct-to-prod loop makes a red `main` a live-site problem). `claude/*`
branches don't get a Vercel preview, so verify locally (`npm run dev` /
`npm run e2e`). Screenshots are unreliable here — the sandbox usually can't reach
`statsapi.mlb.com`. See `docs/development.md` for concurrent-agent guidance and the
`vercel.json` deploy-cap setup.

## Commands

```bash
npm install
npm run dev        # dev server (fixed port 5173, strictPort)
npm run build      # production build → dist/
npm run preview    # serve the built app
npm run lint       # eslint . && check-caps.mjs && check-claude-md.mjs
npm run e2e        # playwright test — verification harness, not a CI suite
```

The `node scripts/gen-*.mjs` data generators (WAR, rehab, umpires, callouts,
vs-team-splits, game-notes, minors-leaders, milb-history, …) are documented in
`scripts/CLAUDE.md`. There is no CI-enforced *test* suite; verify by running
`npm run dev` / `npm run e2e` against a live or recent game. `docs/test-games.md`
has verified gamePks with rare in-game events; `.claude/skills/run.md` documents
the loop.

## The spoiler rule — the core invariant

This is the whole point of the app. **Do not let it drift.** The rule: a
score-revealing value must never exist in the DOM until the user reveals it —
there is no fetched-then-hidden node to leak, with one narrow, explicit
exception (All-Star Rosters shows final scores plainly — see ADR-0019). `CONTEXT.md` defines the vocabulary
(Seal, SealBox, reveal-only module, spoiler-free selector, revealedThrough,
half-inning, regulation/extra innings, Pitchers table, primary position);
`docs/adr/` records *why* each mechanism is shaped as it is — read the linked ADR
before "simplifying" any of these.

Enforced structurally by two conventions:

1. **Reveal-only modules**, callable only from inside a `SealBox`'s reveal render
   function — never at render top-level or in an eager `useMemo` (ADR-0001):
   `src/api/linescore.js` and `src/api/derive.js`. Contrast `src/api/select.js`,
   spoiler-**free**. In between sit **caller-gated pre-pitch selectors**,
   spoiler-free only when restricted to the half the user has reached
   (`halfIndex <= revealedThrough + 1`): `selectPrePitchChanges` (`select.js`,
   above the seal, ADR-0003) and `defenseEntering` (`defense.js`) +
   `lineupEntering` (`battingorder.js`) — the defense diamond and both lineup cards
   as they stand *entering a half*, rendered outside the seal and gated to
   `revealed || isNextToReveal` (ADR-0010). See `src/api/CLAUDE.md` for the module
   catalog and `src/CLAUDE.md` for the component wiring.

2. **`src/components/SealBox.jsx`** takes `children` as a render function, invoked
   only once revealed; reveal is one-directional, and re-sealing on inning
   navigation works by the parent remounting with `key={inning}` (see
   `InningViewer.jsx`) (ADR-0002).

The PWA service worker uses `NetworkOnly` for `statsapi.mlb.com` (`vite.config.js`)
so a stale, spoiler-revealing score is never served from cache (ADR-0004).

Three gotchas each caused a real spoiler bug and are now ADRs: roster-card
membership/position labels (ADR-0005), per-inning `errors` being a *fielding* stat
(ADR-0006), and manual (`useRef`) caches of reveal-only derivations needing to key
on the `feed` object (ADR-0007). **The Pitchers table** is gated by `revealedThrough`
directly rather than wrapped in a `SealBox` (ADR-0009), and **extra innings never
spoil** — only `regulation` innings show up front, extras unlock one at a time as
`revealedThrough` advances (ADR-0008). Details of both live in `src/CLAUDE.md`.

## Architecture (map)

**No backend.** Every device queries `https://statsapi.mlb.com` directly. The one
thing persisted between sessions is each game's reveal high-water mark
(`revealedThrough`), in `localStorage` under `bbsbh:reveal:{gamePk}` — only that
half-index, never a score, so the spoiler rule still holds on return.

**The one exception — link previews (`api/`).** Dynamic Open Graph / Twitter cards
for shared deep links can't be done statically (crawlers don't run our JS), so a
thin Vercel edge layer renders them: `api/og.js` (the 1200×630 image), `api/preview.js`
(swaps `og:*` tags into `index.html`), `api/_lib/cards.js` (the only server-side
statsapi calls). Crawler-only, fails safe to the static default card, never
renders/fetches a score — see ADR-0012.

Two nested `CLAUDE.md` files carry the detail, loaded when you work there:
- **`src/CLAUDE.md`** — screens flow (`GameSelect → GameView → TeamInfo →
  InningViewer`), routing (`src/lib/route.js`, `src/App.jsx`), fetching (`useAsync`),
  the token-based design system, and the UI-side spoiler enforcement.
- **`src/api/CLAUDE.md`** — the data layer: per-topic fetch wrappers/selectors over
  statsapi, the reveal-only vs. spoiler-free split, and the **build-time-fetch
  pattern** (static `public/data/*.json` precomputed by `scripts/gen-*.mjs`, read
  same-origin) behind WAR, rehab, umpires, vs-team-splits, game-notes,
  minors-leaders, milb-history, and the leader boards.

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
- **Styling is a token-based design system.** All CSS is `src/index.css` importing
  `src/tokens/*.css`. The metaphor is a paper scorebook (manila paper, navy ink,
  pencil graphite, kraft-tape amber seals). Use the semantic CSS variables, not raw
  hex. See `src/CLAUDE.md`.

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
