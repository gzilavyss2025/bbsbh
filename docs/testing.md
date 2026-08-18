# Testing

Two layers, deliberately split by what each can check cheaply and
deterministically.

## Unit suite — `npm test` (CI-gated)

Plain `node:test` over `test/*.test.js`, no transform step, so it covers the
**pure data layer only** (`.js` modules — not `.jsx` components, which would
need Vite's JSX transform). It runs on every PR via `.github/workflows/ci.yml`
alongside lint + build. Keep it fast and dependency-free; that's why it lives in
`node --test` rather than a framework.

What's covered:

| Area | File | What it pins |
| --- | --- | --- |
| Reveal-only derivations | `reveal-only.test.js` | `derive.js` / `linescore.js` / `pitchers.js` — the numbers that ARE the spoiler surface: per-inning pitches/whiffs/first-pitch strikes, R/H/E lines, reveal-gated pitcher lines, inherited-runner attribution |
| Pre-pitch selectors | `pre-pitch-selectors.test.js` | `defenseEntering` / `lineupEntering` self-gate to `revealedThrough + 1` (ADR-0010); one team's subs don't bleed into the other's card |
| Spoiler-gate primitives | `spoiler-gates.test.js` | `halfIndex`, `safeToShowEntering`, `selectPrePitchChanges` |
| Reveal ratchet | `reveal-progress-core.test.js` | `revealProgressCore.js` — the mark only moves forward; malformed storage can't over-reveal; extras unlock one at a time (ADR-0008) |
| Real-game invariant | `invariant-real-game.test.js` | the spoiler invariant on a **captured real feed** (see below) |
| Graceful degradation | `graceful-degradation.test.js` | every selector falls back to `''`/`[]`/`null` on sparse MiLB feeds instead of throwing |
| Routing | `route.test.js` | `parseRoute` branch ordering + path builder round-trips + the spoiler-cutoff query |
| Pure helpers | `lib-helpers.test.js` | `ordinal`, `dates`, `statTiers`, `runExpectancy` |
| Formulas / transactions | `season-score.test.js`, `team-score.test.js`, `team-transactions.test.js`, `statsapi.test.js`, `game-notes-regressions.test.js` | the statistical generators and the transaction grouper |

### Coverage

`npm run test:coverage` runs the same suite with Node's built-in
`--experimental-test-coverage` (test/scripts excluded). It's a report, not a
gate — use it to spot an untested branch before adding a test. The
reveal-critical modules (`derive`, `linescore`, `pitchers`, `defense`,
`battingorder`, `revealProgressCore`, `route`) sit at ~100% line coverage; use
that as the floor when touching them.

### The captured real-game fixture

`test/fixtures/game-823035.trimmed.json` is a field-trimmed snapshot of
statsapi's `/api/v1.1/game/823035/feed/live` — the pinned 2026-07-07 MIL@STL g2
(final 10–2), the same game the e2e specs use. It's trimmed to only the feed
paths the reveal-only and reveal-gated selectors read (players, plays,
linescore, boxscore, decisions), which drops it from ~800 KB to ~220 KB.
`invariant-real-game.test.js` loads it to assert the reveal gating holds on
real data — offline and identically every run, unlike the e2e specs which
fetch the live feed. `scorecard-game.test.js` reads the same fixture, and is
why the per-play trim grew: the scorecard grid also needs `about.atBatIndex`,
`result.{event,description,rbi,isOut}`, each runner's full `movement` +
`details` + `credits`, and — the one that bit — the substitution playEvents'
`player`/`position`/`replacedPlayer`/`base` fields, without which a pinch
runner's run silently vanishes from the grid (that test pins the exact case).

To refresh or capture another game, fetch the live feed and keep only the read
paths:

```bash
curl -s "https://statsapi.mlb.com/api/v1.1/game/<gamePk>/feed/live" -o feed.json
# then trim gameData.{datetime,status,teams,players,probablePitchers} and
# liveData.{linescore,boxscore.teams/officials,plays.allPlays,decisions} — see
# the shape of the existing fixture (including the per-play fields named
# above); drop per-player bios and per-pitch fields the selectors don't read.
```

Prefer a hand-built minimal fixture (`test/fixtures/mini-game.js`) for
unit-level assertions where you want to control exactly one behavior; use the
captured real feed for "does the real shape still parse" confidence.

## Browser harness — `npm run e2e` (not CI-gated)

Playwright specs under `e2e/`. This is a **verification harness**, not a
regression suite (see the config header and CLAUDE.md), and it's **opt-in**:
reach for it only when a change is something the unit suite can't see —
layout, interaction, DOM-level spoiler timing — not routinely on top of a
passing `npm test`. The invariant specs (`e2e/invariants/**`) fetch the live
statsapi at test time, so they depend on network and on games that age out —
deliberately kept out of CI. They're the only place the **DOM-level**
guarantee is checked (a `SealBox` never renders its children until revealed),
which the unit suite can't reach because `SealBox` is a `.jsx` component. Run
them locally against a live or recent game when changing anything
user-visible; `docs/test-games.md` lists gamePks with rare events.

Specs pinned to the anchor game (823035) can skip live network entirely via
`e2e/fixtures/mock-api.js` — a captured real feed/schedule/logo/headshot,
falling back to a Node-`fetch` relay (works in sandboxes where Chromium's own
network is blocked) for anything not captured. See `.claude/skills/run/SKILL.md`
for usage; never troubleshoot a network failure by re-running headed —
Chromium unreachable is a sandbox limitation the mock/relay already handles,
not something a visible browser window fixes.

**`e2e/fixtures/manifest.json`** is the registry for what's captured — one
entry per file under `e2e/fixtures/`, each naming its capture date, source
URL, and a short note (a generic image sets `noExpiry: true` since it doesn't
go stale the way live-game data does). It's the source of truth; don't
hand-duplicate its contents elsewhere. Two guards read it:

- `check-fixture-freshness.mjs` (`npm run lint`, no network needed) fails a
  captured fixture past a 180-day budget — same "a convention with no script
  behind it drifts" argument as `check-dir-size.mjs` (ADR-0038), aimed at
  fixture age instead of directory size.
- `check-feed-shape-drift.mjs` (`npm run check:feed-shape-drift`, needs live
  network so it's **not** part of `npm run lint` — see the PR template) fetches
  a fresh copy of the anchor game's feed and checks that every path the
  captured fixture depends on still resolves. A completed historical game's
  own content never changes, so a missing path means MLB changed the API
  shape, not the game — this automates the half of "confirm a new field
  against a real response; do not guess" (root CLAUDE.md) a script can do. It
  runs nightly from `update-nightly-data.yml` (the one environment in this
  repo with real, scheduled network access).

Recapturing a fixture: refetch it with the same recipe as the unit-suite
fixture above, save it under `e2e/fixtures/api/` or `e2e/fixtures/images/`,
and update its `capturedAt` (and `sourceUrl` if it changed) in manifest.json.

The unit suite's `invariant-real-game.test.js` now pins the same spoiler
guarantee at the **data layer** deterministically in CI, so a regression in the
reveal-only selectors is caught automatically even though the browser specs
aren't.

## Making the tests actually bite

A test only has impact if a failure *stops* something. The chain here:

1. **`main` requires the `lint-and-build` check** (branch protection). CI runs
   lint + `npm test` + build on every PR; the merge button is blocked until it's
   green. This is the substitute for a human code reviewer — the robot refuses
   the merge so a regression can't reach `main` unnoticed. If you ever find you
   *can* merge a red PR, the required-check setting has come undone; re-add it
   under **Settings → Branches → Branch protection rules** (require a PR, and
   require the `lint-and-build` status check).
2. **Every session goes through a PR** (CLAUDE.md: never push straight to
   `main`). That's what routes your own work through the gate — branch
   protection can't check a commit that never opens a PR.
3. **The suite stays deterministic** so a red build always means a real
   problem, never "re-run it" flake. That's why the spoiler invariant is pinned
   on a captured feed, not the live-API e2e.
4. **The agent can't quietly defang the suite.** The standing rules in CLAUDE.md
   forbid deleting/skipping/loosening a test to go green, and require a failing
   regression test to accompany every bug fix. When reviewing a PR, the one
   thing worth eyeballing even without reading the code: did any test get
   *removed* or any assertion get *weaker*? That's the tell for a hollowed-out
   check.

### The nightly crons and branch protection (important)

The data crons (`update-nightly-data.yml`, `update-teams.yml`, …) **push
generated `public/data/*.json` straight to `main`** — they don't open PRs. A
required status check would normally reject
those pushes (the default `GITHUB_TOKEN` can't satisfy a check on a bare push,
and a PR opened by `GITHUB_TOKEN` doesn't even trigger CI). They get around this
by checking out with **`GH_BOT_TOKEN`**, a fine-grained PAT owned by the repo
admin, whose pushes bypass the required check — the same way the maintainer's
own admin pushes do. This already broke once (2026-07-13, before the switch to
`GH_BOT_TOKEN`); the fix is baked in now.

Consequences to keep in mind when touching CI:

- **Do NOT enable "Include administrators" / "Do not allow bypassing" on the
  branch rule.** That would enforce the check on `GH_BOT_TOKEN` too and silently
  break every data cron again. The bypass for admins is load-bearing here.
- The trade-off is that admin (including your own) direct pushes skip the gate —
  which is why rule #2 above (always PR your own work) matters.
- If you ever rotate or remove `GH_BOT_TOKEN`, the crons stop being able to push
  to `main`. Keep it valid and admin-scoped.
- `regenerate-readme.yml` pushes as `github-actions[bot]` with the default token
  rather than `GH_BOT_TOKEN` — if the nightly README rewrite ever stops landing,
  that token mismatch is the first thing to check (give it `GH_BOT_TOKEN` too).

## A local safety net (optional): the pre-commit hook

`.githooks/pre-commit` runs the unit suite before each commit, so a broken suite
is caught on your machine before it ever reaches a PR. It's wired up
automatically: `npm install` runs the `prepare` script, which points git at
`.githooks/`. The hook **skips itself in CI** (`$CI` is set), so it never
interferes with the nightly crons or the Actions runners — it only guards local
commits. To bypass it for a genuine work-in-progress commit,
`git commit --no-verify`.

The hook blocks a commit in two cases: a test **failed**, or the run collected
**zero tests**. The second case guards against a stale local Node — the
`node --test "test/**/*.test.js"` glob needs Node ≥ 21, and on an older Node it
would otherwise run nothing and report a false "all clear." The repo pins Node
via `.nvmrc` (Node 22, matching CI); if the hook reports no tests ran, `nvm use`
or update Node.
