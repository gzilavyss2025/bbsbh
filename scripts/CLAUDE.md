# scripts — build/precompute generators and guards

Node `.mjs` scripts: the `gen-*.mjs` generators that precompute the static JSON the
app reads at runtime (the **build-time-fetch pattern**, see `src/api/CLAUDE.md`),
plus the lint guards. Most `gen-*.mjs` run on the nightly GitHub Actions cron
(`.github/workflows/update-nightly-data.yml`); a few are hand-run because their data
is immutable. Each generator's READER module is documented in
`docs/api/static-data.md`; this file documents the generators.

## Everyday commands

```bash
npm install
npm run dev        # dev server (fixed port 5173, strictPort)
npm run build      # production build → dist/
npm run preview    # serve the built app
npm run lint       # eslint + guard scripts (caps, casing, typography, contrast, claude-md, …)
npm test           # node:test unit suite (pure logic; CI-gated)
npm run e2e        # playwright test — verification harness, not a CI suite
```

CI (`ci.yml`) runs lint + `npm test` + build. `npm test` is a pure-logic unit suite;
it is not a substitute for the browser check. Verify user-visible changes by running
`npm run dev` (or `npm run e2e`, which boots the dev server itself) and exercising the
game-select → team-info → innings flow against a live or recent game.
`docs/test-games.md` has a pack of real, verified gamePks with rare in-game events
(triple play, immaculate inning, position player pitching, suspended/resumed game,
etc.). `.claude/skills/run.md` documents this loop end to end. `e2e/smoke.spec.js` is
the one long-lived example spec; write and delete throwaway specs alongside it.

## The SQLite data layer (`lib/schema.sql`, `lib/db.js`)

`gen-team-score.mjs`, `gen-season-score.mjs`, and `gen-postseason-leaders.mjs`
write into a shared SQLite database instead of hand-rolling their own JSON
read-merge-write cycle, then export the same JSON shapes the reader modules
already expect — see `docs/adr/0021`. `openDb()` reconstitutes an in-memory
database from committed TEXT dumps (`scripts/data/*.sql`, plain `INSERT`
statements — never a binary `.db`, so PR diffs stay reviewable);
`dumpGroup(db, name)` re-dumps only the table-group a generator owns.
**Dumps are split one file per group, not shared**, so two generators on
independently scheduled crons can never silently clobber each other's table —
whichever workflow pushes second to a shared file would overwrite the other's
table with a stale copy. Add a new table = add a new group in `db.js` +
extend `schema.sql`; a new generator that needs to join against existing
tables is the reason this layer exists, so wire it in rather than adding
another bespoke JSON merge. Uses `node:sqlite` (Node ≥22.5, stable since
Node 26) rather than `better-sqlite3` — the workflows run generators with no
`npm install` step, and a built-in avoids adding install latency.
`migrate-json-to-sqlite.mjs` is the one-time backfill that seeded the dumps
from the pre-migration JSON files; it's not part of any cron.

## The generator catalog lives in `docs/scripts/generators.md`

One entry per `gen-*.mjs` — what it writes, where the data comes from, and its
own traps — grouped by cadence (nightly cron / own cadence / hand-run /
assets). It moved out of this file because it was two thirds of a document that
loads IN FULL for every session that works in this directory, and per-generator
detail is reference you look up, not a rule you must hold before touching
anything here. Same split `src/api/CLAUDE.md` made into `docs/api/`.

Four things about that catalog belong HERE, because they are rules rather than
reference:

- **Wire a new generator into the cron that runs it, in the same commit.** A
  nightly step is three edits to `.github/workflows/update-nightly-data.yml`,
  not one: the `run` step, the `git add` list in "Commit if changed", and the
  "Fail if any generator errored" condition. Miss the second and the job
  computes the file and throws it away; miss the third and a broken generator
  reports green. Both have happened (see that workflow's own header).
- **A generator that is NOT on a cron must say what runs it.** The catalog's
  cadence groups are the record. `gen-postseason-odds.mjs` sat in neither group
  for months while its own header said "Normal nightly use appends yesterday's
  snapshot" — the Team hub's odds card served a twenty-three-day-old snapshot,
  quietly, because a date-keyed file has no way to look stale.
- **A generator that needs app logic imports it** rather than keeping a second
  copy (`gen-minors-leaders.mjs` imports `combineToPool`/`computeLeaders`;
  `gen-milestones.mjs` imports the projection math from `src/api/person.js`;
  `gen-callouts.mjs` imports the checkpoint constants from
  `src/api/callout-notes/checkpoints.js`). The deliberate exceptions are small
  self-contained mirrors, and each one says so at its own top.
- **An append-only generator that merges fresh rows into a carried-forward
  store, keyed on an upstream-asserted identity** (an official, a player, any
  id the source itself assigns rather than one this repo mints) **must use
  `scripts/lib/reassignable-merge.mjs`, or say in a comment why its key can't
  be retroactively reassigned.** If the upstream source ever corrects that
  key after the fact, a naive per-key merge leaves a permanent ghost row on
  the old key — real incident: MLB corrected an AAA game's Home Plate umpire,
  and the old umpire kept the game's accuracy stats forever
  (`gen-umpire-accuracy.mjs`, fixed in `scripts/lib/umpire-accuracy-merge.mjs`).

A generator file is a top-level script: importing one RUNS it. A helper inside
one can therefore never be unit-tested, so a helper worth testing goes in
`scripts/lib/` and the generator imports it (`lib/roster.mjs` is the worked
example).

## Local-environment reporters (read-only; run by `session-start.sh`)

Both report and never act. The acting counterparts are on-demand skills that
confirm every target with the maintainer first — deliberate, because multiple
agents work concurrently and nothing should reap another one's checkout or
process automatically.

- `dev-servers.mjs` — running `vite` dev/preview processes started from a
  worktree of this repo, each classified stale (worktree deleted, or branch
  merged) or active. Acted on by `/clean-dev-servers`.
- `worktrees.mjs [--brief]` — every worktree, classified stale (merged into
  `origin/main`, or upstream branch deleted) or active, with an uncommitted-file
  count. Reads last-fetched remote state, so `git fetch origin --prune` must come
  first. `--brief` prints only the summary and stays silent when nothing is
  stale — that's the mode the SessionStart hook uses. Acted on by
  `/clean-worktrees`. The staleness verdicts are pure and unit-tested in
  `test/worktrees.test.js`; four cases there are non-obvious and were all live
  bugs. A freshly branched worktree is an ancestor of `origin/main` and so looks
  merged; requiring commits-ahead to tell those apart flips it and mislabels
  every genuinely merged branch; tip-equality (`HEAD == origin/main`) only holds
  until `main` next moves, after which every already-open fresh worktree
  reclassifies as merged — so freshness is decided by membership of `main`'s
  **first-parent chain**, which is stable as `main` advances; and the upstream
  must be read with
  `for-each-ref`, never `@{u}`, because `@{u}` stops resolving the moment the
  remote branch is deleted — which is the end state of every squash-merged PR,
  so `@{u}` reports "no upstream" for precisely the worktrees this script
  exists to find. That last one shipped in #312 and made the
  upstream-deleted branch unreachable dead code.

## Lint guards (run by `npm run lint`, CI-enforced via `ci.yml`)

- `check-caps.mjs` — guards the global ALL-CAPS invariant (no CSS `text-transform`
  sneaks a caps-defeating value back in). Two assertions, because the marker alone
  was never enough: a caps-defeating declaration needs a `caps-exempt` marker, AND
  the rule carrying it must out-rank the blanket uppercase it sits under. A marked
  rule that loses the cascade is a silent no-op — the marker reads as "deliberate"
  while the text shouts anyway, which is how five paragraphs shipped shouted (issue
  #769). Practically: prefix an exemption with `#root`. See the block comment in
  `src/styles/01-base.css`.
- `check-name-casing.mjs` — the JS half of the same invariant: fails if a
  component calls `.toUpperCase()`/`.toLowerCase()` on rendered text (redundant
  with the CSS invariant, and can drift from it on real Unicode names) without
  a `caps-js-exempt` marker comment on the same line. See ADR-0017.
- `check-typography.mjs` — rejects ad hoc size, weight, line-height, and tracking
  declarations in `src/styles/*.css`; add or reuse the semantic roles in
  `src/tokens/typography.css` instead.
- `check-focus-ring.mjs` — every `:focus-visible` rule that draws a ring must use
  `var(--focus-ring)` (outline) or `var(--ring)` (box-shadow), never a hand-rolled
  color; a ring-less focus style (reusing a `:hover` border/background change) is
  fine, and a deliberate one-off opts out with a `focus-ring-exempt` comment. See
  ADR-0023.
- `check-strike-links.mjs` — every rule that draws a `line-through` must name
  `.plink` in its selector list, because a player name is a `<button
  class="plink">` and neither inherits an ancestor's decoration nor keeps its
  own (`.plink` sets `text-decoration: none`). A rule whose struck text can hold
  no name link opts out with a `strike-link-exempt` comment in the rule. The
  defense diamond shipped a strike-through that never drew on a surname —
  visible only over the un-linked " (6th)" tag beside a substitute — because the
  fix two other rules already carried was never copied to it.
- `check-contrast.mjs` — resolves the color tokens to hex and asserts WCAG AA
  (≥4.5:1 text, ≥3:1 large/UI) for the known text-on-background pairings (seal ink
  on the kraft stripes, white on the IL clay stripes, the core semantic text roles).
  Fix a failure by retuning the hex, never by lowering the threshold. See ADR-0023.
- `check-claude-md.mjs` — guards the CLAUDE.md leanness rule: the root `CLAUDE.md`
  at `ROOT_MAX` (200) lines, AND every nested one at `NESTED_MAX` (250) or a pinned
  `BUDGETS` entry (ratcheting DOWNWARD only, like `check-dir-size.mjs`). A nested
  file still loads IN FULL whenever anyone works in its directory — for this file
  and `src/api/`, most sessions — so "move it to the nested file" was only half a
  fix. Move detail to `docs/*` and leave a pointer; don't raise a cap.
- `check-spoiler-manifest.mjs` — guards `src/api/spoiler-manifest.json`, the
  machine-readable spoiler classification of every module in `src/api/`. Four
  assertions: every module has an entry, every entry names a real file, entries are
  well-formed (known class, non-empty `why`, `importers` on exactly the gated
  classes), and a `reveal-only`/`reveal-gated` module — or a `mixed` module's named
  reveal-only EXPORTS — is imported only from its allowlist. Stale allowlist entries
  fail too, the same ratchet rule `check-dir-size.mjs` uses. Unlike its siblings it
  RESOLVES import specifiers rather than substring-matching a basename, because
  `highlights.js` is a substring of `gamehighlights.js` and those two carry opposite
  classifications. See `src/api/CLAUDE.md` and the manifest's own header.
- `check-dir-size.mjs` — caps source files per directory (`MAX_FILES` 12) across
  `src/`, `api/`, `scripts/`, giving the "flat directories don't stay flat" rule in
  root `CLAUDE.md` the enforcement it never had (that rule was broken to 126 files
  in `src/components`). A **ratchet**: the seven directories already over the line
  carry a `BUDGETS` entry pinned at today's count, editable DOWNWARD only, and it
  fails if one grows past its budget *or* shrinks below it without the number being
  tightened in the same commit — so a cleanup has to record itself and the table can
  only shrink. See ADR-0038.
- `check-file-size.mjs` — caps lines per source file (`MAX_LINES` 600, between p90
  and p99 of the repo's 481 source files), to catch the next 2,620-line `person.js`
  while splitting it is still cheap. Deliberately a **weaker** ratchet than its
  sibling: line counts churn every commit, so a budget here is a ceiling (growth
  fails, shrinkage is free) and rot is bounded from the other end — a file back
  under 600 lines must surrender its entry. The 24 oversized `src/styles/*.css`
  partials are listed individually so
  that splitting it FORCES one entry per oversized partial rather than laundering
  the debt. See ADR-0038.
- `check-dead-exports.mjs` — fails if a named/default export in `src/**/*.{js,jsx}`
  has no reference anywhere (cross-file import OR same-file call) — an orphan left
  behind after its last caller was removed. Regex-based, like its siblings above:
  it cannot tell a forgotten export from a deliberately staged one, so a handful of
  documented-but-not-yet-wired exports sit in an `ALLOWLIST` with the reason, the
  same ratchet-table convention as `check-dir-size.mjs`'s `BUDGETS`. Understands
  this app's two dynamic-import shapes (`lazyNamed(loader, 'Name')` from
  `src/App.jsx`, and `import(...).then((m) => ({ default: m.X }))`/`m.X(...)`) so a
  lazily-routed screen or Clerk-gated component doesn't read as dead just because
  no static `import` statement names it.
- `check-dist-dev-routes.mjs` — post-build (not part of `npm run lint`, since it
  inspects `dist/`): fails if a dev-only save endpoint string reaches the
  production bundle, and equally if `dist/team-logos/` comes out empty. Both
  halves of the same question — the endpoint that WRITES curated art must never
  ship, the art itself always must. Layer 4 of ADR-0029; run it as
  `npm run build && npm run check:dist-dev`.
- `check-report-pages.mjs` — fails if `SiteMenu.jsx` (the hamburger menu) or
  `SiteFooter.jsx` (the slate's "More Baseball" list) stops importing the shared
  `REPORT_PAGES` array from `src/lib/reportPages.js` — the guard against those two
  page lists silently drifting apart again.
- `check-skeleton-ball-frames.mjs` — fails if `BoxScoreSkeleton.jsx`'s
  `BALL_FRAME_COUNT`/`BALL_SPIN_LOOPS` stop matching the hardcoded frame-strip
  width, `steps()` count, and `skel-ball-spin` keyframe fraction in the
  `.skel__ballFrames` CSS rule — those three CSS values can't read the JS
  constants directly (`steps()` needs a literal integer, not a `var()`), so
  this is the guard against them drifting apart.
- `vercel-ignore-build.sh` — Vercel's Ignored Build Step (skips a deploy when a push
  touched only docs/scripts/workflow files). See `docs/development.md`.
