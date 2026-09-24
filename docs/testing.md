# Testing

Two layers, deliberately split by what each can check cheaply and
deterministically, plus a local screenshot suite for design-system changes
(`npm run visual`, below).

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

## Browser harness — `npm run e2e` (only when Gary asks)

Playwright specs under `e2e/`. This is a **verification harness**, not a
regression suite (see the config header and CLAUDE.md). **An agent runs it only
when Gary asks for it in that session.** `.claude/hooks/e2e-on-request.mjs`
enforces this: a `UserPromptSubmit` hook sets a flag for the session when
Gary's prompt asks to run the browser tests, and a `PreToolUse` hook refuses
`npm run e2e`, `npm run visual` and `playwright test` without that flag.
`test/e2e-on-request-hook.test.js` pins which prompts and commands count. The
default checks are `npm test`, `npm run lint`, the build and a dev-server link. The invariant specs (`e2e/invariants/**`) fetch the live
statsapi at test time, so they depend on network and on games that age out —
deliberately kept out of CI. They're the only place the **DOM-level**
guarantee is checked (a `SealBox` never renders its children until revealed),
which the unit suite can't reach because `SealBox` is a `.jsx` component. When
Gary asks for them, run them against a live or recent game;
`docs/test-games.md` lists gamePks with rare events.

Specs pinned to the anchor game (823035) can skip live network entirely via
`e2e/fixtures/mock-api.js` — a captured real feed/schedule/logo/headshot,
falling back to a Node-`fetch` relay (works in sandboxes where Chromium's own
network is blocked) for anything not captured. See `.claude/skills/run/SKILL.md`
for usage; never troubleshoot a network failure by re-running headed —
Chromium unreachable is a sandbox limitation the mock/relay already handles,
not something a visible browser window fixes.

**`e2e/fixtures/manifest.json`** is the registry for what's captured — one
entry per file under `e2e/fixtures/`, each naming its capture date, source
URL, and a short note. Two kinds of fixture set `noExpiry: true`: a generic
image, and a finished game day (the anchor feed and its schedule). A finished
game's content cannot change, so its only risk is API shape, which the nightly
drift check covers (#1194). It's the source of truth; don't
hand-duplicate its contents elsewhere. Two guards read it:

- `check-fixture-freshness.mjs` (`npm run lint`, no network needed) fails a
  captured fixture past a 180-day budget — same "a convention with no script
  behind it drifts" argument as `check-dir-size.mjs` (ADR-0038), aimed at
  fixture age instead of directory size.
- `check-feed-shape-drift.mjs` (`npm run check:feed-shape-drift`, needs live
  network so it's **not** part of `npm run lint` — see the PR template) fetches
  a fresh copy of the anchor game's feed and of that day's schedule, and checks
  that every path each captured fixture depends on still resolves. A completed historical game's
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

## Screenshot suite — `npm run visual` (not CI-gated)

A design-system change moves many pages at once: one edit to `Pill`, `Card` or a
token changes every page that uses it (#1177). This suite shows which pages a
change moved. It shoots each page in `e2e/visual/routes.js` on two dev servers,
one that runs `main` (the BASE) and one that runs your branch (the BRANCH), at
390px (the phone) and at 760px (just past the 740px breakpoint). Then it
compares each pair of shots, to the pixel.

**When to run it.** Before you open a design-system PR, run it on your branch.
Put the list of changed pages in the PR body. A changed page that the PR did not
mean to change is a bug.

**How to run it.** You need two dev servers:

1. The BASE: a dev server on current `main`, in its own worktree. For example,
   `git worktree add --detach ../bbsbh-baseline origin/main`, then `npm install`
   and `npm run dev` there (port 5173). Update it to the `main` that your branch
   starts from.
2. The BRANCH: your worktree's own dev server, on your reserved port. If it is
   not running, the suite starts it.

Then, in your worktree (the sandbox must be off, because the suite reads the
live network):

```bash
VISUAL_BASE=http://localhost:5173 E2E_PORT=5172 npm run visual
npx playwright show-report visual-report/html   # base, branch, and the difference
```

| Variable | What it sets |
|---|---|
| `VISUAL_BASE` | The base server's URL. Default `http://localhost:5173`. |
| `E2E_PORT` | The branch server's port, as for `npm run e2e`. It must not be the base's. |
| `VISUAL_REUSE=1` | Replay the last run's recording and do not record again. Use it to run again after a fix, with the same data. |

At the end, the run prints the list of changed shots (`[visual] … changed
shot(s)`), and then each page that could not be shot. It exits non-zero when
either list has a line. In the report, each changed shot has three images:
"expected" is the BASE shot, "actual" is the BRANCH shot, and "diff" marks each
changed pixel in red.

**How a run works.** Three passes (`playwright.visual.config.js`):

1. RECORD (`e2e/visual/record.visual.js`). Open each route on the BASE server at
   both widths, and record its external traffic: statsapi.mlb.com, the image
   CDNs and the weather. One recording per route serves both widths. Requests
   to the dev servers are NOT recorded: each server serves its own tree's code
   and `public/data`, and a change there is a change the suite must show.
2. BASE. Open each route on the BASE server, replay the recording, and shoot it.
3. BRANCH. Open the same route on the BRANCH server, replay the SAME recording,
   shoot it, and compare.

So the two shots of a page get the same data. The clock is fixed at
`FROZEN_NOW` (`routes.js`) on both servers, and `Math.random` is seeded. Images
are replayed from the recording, not replaced with a placeholder: a logo or a
photo sets the size of its box on some pages, and a placeholder would hide a
layout change there. A request that the recording does not hold is aborted,
never sent live, and the test fails with the list of those requests.

**Why nothing is committed.** The first design of this suite committed a
baseline image for each shot and a HAR file for each page's traffic: about 70 MB
that grew with every baseline update. Gary chose on 2026-09-23 to compare with
`main` on the spot instead. The "before" image is shot from `main` on every run.
Everything the suite writes goes to `visual-report/` (git-ignored): the
recording (`recording/`), the base shots (`base/`), the test results
(`results/`) and the report (`html/`). The next run replaces all of it.

**The pages.** `/design-lab` (as five element shots: the page head and its four
bands), the anchor date's slate (2026-07-07), the slate's result filter chips,
the anchor game's lineup page, innings viewer and box score (823035, see
`docs/test-games.md`), the Brewers' team hub (Overview and Numbers), a hitter
and a pitcher (each with a contract card), `/salaries`, `/standings`,
`/postseason-race` and `/situational-records`. `routes.js` says why each one is
there.

Every shot is of a **sealed** page. The game pages are shot with nothing
revealed. The filter chips exist only after "Reveal all results", so that shot
is the chip bar alone: the revealed cards, which hold the scores, are not in
the image.

**Zero tolerance.** `maxDiffPixels` and `threshold` are both 0
(`pages.visual.js`), so one changed pixel is a change. Two servers on the same
tree draw the same pixels: the replayed data, the frozen clock, the settle steps
and a set of Chromium raster flags (`playwright.visual.config.js`) make that
true. If a page differs between two servers on the same tree, find what moves
and freeze it or mask it (`MASKS` in `routes.js`). Do not raise the tolerance.
A part that differs between two servers BY DESIGN is hidden from every shot
(`HIDDEN` in `routes.js`): today only the footer's "build 1234567" link, which
prints the commit each server was started from. The one allowance is for LOADING, not pixels: a route's `offShot` names requests
the recording may not hold, for parts of the page that no shot shows, and says
why beside it.

**Why it is not in CI.** It needs two dev servers and the live network, and it
takes about seven minutes.

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

The data cron (`update-nightly-data.yml` — the only one since the three weekly
crons folded into it on 2026-08-28) **pushes generated `public/data/*.json`
straight to `main`** — it doesn't open a PR. A
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
- Nothing in CI regenerates the README any more. `regenerate-readme.yml` was
  deleted on 2026-08-28: it had never once succeeded (it called
  `anthropics/claude-code-action` with an `ANTHROPIC_API_KEY` secret this repo
  has never had, and checked out with the default token rather than
  `GH_BOT_TOKEN`, so even a success could not have pushed). README regeneration
  is a step in the `/start-day` skill now, run in the maintainer's own session
  and landed through a normal PR. Do not put it back in a workflow — see
  `update-nightly-data.yml`'s header for the four nights of generator output
  that credential cost in July 2026.

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
