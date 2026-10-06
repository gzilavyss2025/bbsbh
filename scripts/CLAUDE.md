# scripts — build/precompute generators and guards

Node `.mjs` scripts: the `gen-*.mjs` generators that precompute the static JSON the
app reads at runtime (the **build-time-fetch pattern**, see `src/api/CLAUDE.md`),
plus the lint guards. Most `gen-*.mjs` run on the nightly GitHub Actions cron
(`.github/workflows/update-nightly-data.yml`); a few are hand-run because their data
is immutable. Each generator's READER module is documented in
`docs/api/static-data.md`; this file documents the generators.

## The SQLite data layer (`scripts/lib/schema.sql`, `scripts/lib/db.js`)

The generators that call `openDb()` (for example `gen-team-score.mjs`,
`gen-season-score.mjs`, and `gen-postseason-leaders.mjs`) write into a shared SQLite database instead of hand-rolling their own JSON
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
another bespoke JSON merge. Uses `node:sqlite` (Node ≥22.5) rather than `better-sqlite3` — the workflows run generators with no
`npm install` step, and a built-in avoids adding install latency.
A `bySeason` group keeps every season, one frozen dump per old season (ADR-0086).

## Generator rules

The catalog is `docs/scripts/generators.md`: one entry per `gen-*.mjs`, grouped by cadence
(nightly cron / own cadence / hand-run / assets). Four rules belong HERE, because they
are rules rather than reference:

- **Wire a new generator into the cron that runs it, in the same commit.** A
  nightly step is three edits to `.github/workflows/update-nightly-data.yml`,
  not one: the `run` step, the `git add` list in "Commit if changed", and the
  "Fail if any generator errored" condition. Miss the second and the job
  computes the file and throws it away; miss the third and a broken generator
  reports green. Both have happened (see that workflow's own header).
- **A generator that is NOT on a cron must say what runs it.** The catalog's
  cadence groups are the record. A date-keyed file has no way to look stale, so one
  generator on no cron served a twenty-three-day-old snapshot quietly (the story is the
  head of `docs/scripts/generators.md`).
- **A new nightly dataset needs a stamp in `check-data-freshness.mjs`, in the
  same commit.** Write a top-level `generatedAt` (preferred); only a sharded
  store where a per-shard stamp would rewrite every file nightly for no
  reader's benefit gets `UNSTAMPED_BUDGET` bumped instead, with the reason
  added beside `team-records/`'s. Never raise the budget as a reflex fix for a
  guard failure — that unstamped count is a ratchet the guard checks against
  itself, and widening it on request is exactly the drift it exists to catch.
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

- **A generator reaches statsapi through `lib/statsapi.mjs`'s `getJson(path)`
  and nothing else** — no `fetch`, no retry loop, no `statsapi.mlb.com` string
  of its own (#1116). The client owns one retry policy (3 tries, 2000 ms x
  attempt; network errors, 429 and 5xx), an opt-in `timeoutMs`, and the clear
  DNS error for the Claude Code sandbox. `check-statsapi-client.mjs` fails lint
  otherwise. `cachedGetJson` is a `.scratch` research cache: never in `scripts/`.
  Detail: `docs/scripts/generators.md`.

- **A generator that reads an open dataset (Retrosheet, the Chadwick register) takes the
  extracted file paths as arguments and never downloads** (ADR-0100). Downloads go through
  `lib/open-data/download.mjs` into a new, empty folder outside the repo. Credit lines come from
  `lib/open-data/credits.mjs`.

- **A nightly generator picks its default season with `lib/time/season-in-play.mjs`**,
  not `new Date().getFullYear()` (#1465). From January 1 to Opening Day the calendar
  names a season with no games, and an unguarded generator writes an empty file over
  the finished one. Keep the calendar year only where it is the right meaning (a game
  date's season), and skip the write when a season returns no data.

A generator file is a top-level script: importing one RUNS it. A helper inside
one can therefore never be unit-tested, so a helper worth testing goes in
`scripts/lib/` and the generator imports it (`lib/roster.mjs` is the worked
example).

## Local-environment reporters (read-only; run by `.claude/hooks/session-start.sh`)

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
  `/clean-worktrees`. The staleness rules: `docs/scripts/tooling.md`.

## Lint guards (run by `npm run lint`, CI-enforced via `ci.yml`)

`check-all.mjs` runs eslint and every guard below, in order. A new guard goes in its
`GUARDS` list. Guards that walk the tree share `lib/walk.mjs`.

Guard catalog (one entry per guard): `docs/scripts/tooling.md`.

## Rules every guard follows

- **A ratchet only moves down.** A budget, an allowlist or a cap is pinned at today's
  count. Growth fails, and a shrink must tighten the entry in the same commit
  (`check-dir-size`, `check-file-size`, `check-caption-budget`, `check-raw-values`,
  `check-claude-md`). A stale allowlist entry fails too, the same ratchet rule
  `check-dir-size.mjs` uses.
- **Rebase onto `main` and re-measure before you merge a change to a budget.** A count
  taken on a branch that sits behind `main` goes stale.
- **Fix a failure by retuning, never by lowering a threshold or raising a cap.** Retune
  the hex, never lower the threshold (ADR-0023). If `check-claude-md` fails, move detail
  to `docs/*` and leave a pointer; don't raise a cap.
- **An exemption names its marker and a reason.** The CSS and JSX markers are in
  `src/styles/CLAUDE.md`.
