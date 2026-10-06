# Prompt 1a — the Notable games index: generator, nightly step, tests

**Model: Sonnet 5.5, high** (rung 4 in `.claude/skills/improve-prompt/SKILL.md`, step 5).
It is a feature across several files with some judgment: merge rules, a nightly step,
and field paths that you must check against live responses. It does not change the
spoiler rule: it adds no reader and no surface.

---

Build the data generator for the "Notable games" shelf: no-hitters, cycles and triple
plays, from the MLB Stats API. This prompt writes data only. It adds no reader in
`src/` and no page. Prompt 2b adds the reader. ADR-0076 allows a dataset to ship before
a surface reads it.

## Find the work

1. Run `git fetch origin main`. Find the PR gzilavyss2025/bbsbh#1552 ("Old games plan")
   with the GitHub tools. If it is not merged, stop and say that #1552 must merge
   first. This prompt needs its files on `main`.
2. Make a task branch from current `origin/main`. Check open PRs for any change to
   `scripts/check-dir-size.mjs`, `scripts/check-data-freshness.mjs` or
   `.github/workflows/update-nightly-data.yml`. Name any you find in the PR body.

## Read first (no edits yet)

- `CLAUDE.md`, `scripts/CLAUDE.md`, `src/api/CLAUDE.md`, `test/CLAUDE.md`,
  `docs/agents/writing-style.md`.
- `.scratch/old-games/plan.md` (sections 2 and 3), `decisions.md` (all 13 are
  decided; read the **Decided** lines), and `findings.md` (Step 2 and Step 3).
- DRAFT `docs/adr/0101-an-old-game-seals-like-a-new-one-and-a-feat-is-a-result.md`,
  and ADR-0076, ADR-0080, ADR-0081.
- The worked example: `scripts/gen-long-at-bats.mjs`, `scripts/lib/long-at-bats.mjs`,
  `test/long-at-bats.test.js`, and the `long-at-bats/` entry in
  `scripts/check-data-freshness.mjs`. Copy its shape: a nightly generator, a pure half in
  `scripts/lib/`, a file that states its own coverage, and a vocabulary test on the
  committed file.

## What to build

### Files

- `scripts/gen-notable.mjs`: the generator. It is a top-level script, so all logic
  that a test must reach goes in the pure half.
- `scripts/lib/notable/`: the pure half (a new folder). Keep each file under 600 lines.
- `scripts/notable-seed.json`: the hand-seeded additions (D3). One row now: the triple
  play in gamePk 716945 (2023-08-18 TBA@ANA, Angels in the field). `findings.md`
  Step 2 has the evidence.
- Output: `public/data/notable/nohitters.json`, `cycles.json`, `tripleplays.json`.

### API calls

Use only `getJson` from `scripts/lib/statsapi.mjs` (lint fails otherwise). Use
`mapConcurrent` from `scripts/lib/concurrency.mjs` with a limit of 4. Use `fields=` on
every call (`findings.md` measured a 10 times saving).

1. **The season game map (the spine).** One schedule call per season, with the linescore
   and the team hydrated. Keep each game's gamePk, `officialDate`, `gameType`,
   `gameNumber`, `detailedState`, both clubs (id, abbreviation, name, league id) and
   runs, and the linescore's innings. Every row of every kind gets its date, clubs and
   score from this map, by gamePk. So the score costs no extra call.
2. **No-hitters.** From the map: a game where one club had 0 hits. For each candidate,
   one fielded box score call to get the pitchers of the side that threw it.
3. **Triple plays.** `teams/{id}/stats?stats=gameLog&group=fielding&season={Y}`, field
   `triplePlays`. One call per club per season. The club in the log is the fielding
   side.
4. **Cycles.** `sports/1/players?season={Y}`, then batched
   `people?personIds=...&hydrate=stats(group=[hitting],type=[gameLog],season={Y})`, 100
   players per call, fielded.

### Rules (each one needs a test)

- **Played.** A game counts only when `detailedState` is `Final` or `Completed Early`.
  `Forfeit` does not count: the 1979-07-12 DET@CWS 0-0 forfeit (gamePk 177426) is not a
  no-hitter. Never trust `abstractGameState`: postponed and cancelled rows say `Final`
  there (`findings.md` Step 3).
- **Dedupe by gamePk.** The schedule lists a suspended game twice, under the first
  date and the resume date (1975 has 7). A cycle or a triple play counts once per
  gamePk and player or club.
- **AL and NL only (D6).** Keep a game only when both clubs were in the AL (league id
  103) or the NL (104) that season. The `sportId=1` schedule also holds Negro league
  games (12 of the 28 games on 1927-07-04), and Federal League ids may appear. A World
  Series game is AL against NL and stays.
- **Game types (D13).** Regular season (`R`) and the postseason (`F`, `D`, `L`, `W`). No
  spring, exhibition or All-Star games.
- **Seasons.** 1901 to the season in play. Use `scripts/lib/time/season-in-play.mjs` for
  the default season (`scripts/CLAUDE.md` says why). Write nothing for a season with no
  games.
- **No-hitter marks (D8).** Count every played game where a club had 0 hits. Add
  `shortened: true` when the no-hit club batted in fewer than 9 innings. Add
  `lost: true` when the club that threw it lost. List every pitcher who pitched for that
  side, in order, so a combined no-hitter names them all. Do **not** add a perfect-game
  mark: Gary has not decided it. In the PR, say whether a reliable field for it exists
  (test on Larsen, 1956-10-08, gamePk 67524).
- **Cycle.** In one game: 4 or more hits, with at least 1 single, 1 double, 1 triple and
  1 home run. Singles are hits minus doubles, triples and home runs.
- **Triple play.** `triplePlays` greater than 0 in the club's game log for that gamePk.
- **Merge.** Each run replaces every row of each season it swept, in all three files, and
  keeps every other season. It never edits rows one key at a time. So a corrected
  upstream row cannot leave a ghost row. Write that reason in a comment, as
  `scripts/CLAUDE.md` asks of a generator that does not use `reassignable-merge.mjs`.
- **Seed.** After the merge, add each seed row whose season is in the file's coverage.
  Fill its date, clubs and score from the season game map. A seed row for a season that
  was not swept waits. A seed row whose gamePk is not a played AL or NL game fails the
  run, with a clear message.

### File shape

Each file has a coverage block and rows, newest first. Coverage holds the seasons
swept, the date the data runs through, the leagues (`AL`, `NL`) and the game types.
Write no `generatedAt`: the coverage is the file's own clock, as in `long-at-bats/`.

A row holds the gamePk, `officialDate`, `gameType`, `gameNumber`, both clubs (id, the
abbreviation and name **of that season**, and runs), and the kind's own fields:

- no-hitter: the side that threw it, its pitchers (id and name), `shortened`, `lost`;
- cycle: the player (id and name) and his side;
- triple play: the fielding side.

The score is in the row on purpose (D5). Nothing else about the game goes in: no
inning-by-inning line, no hit totals, no other players. Name every key in one exported
allowlist in the pure half. The test reads that list.

### Wiring

- **Nightly.** Add a step to `.github/workflows/update-nightly-data.yml` that runs
  `node scripts/gen-notable.mjs` with no arguments (the season in play). That is three
  edits: the `run` step, the `git add` list in "Commit if changed", and the "Fail if any
  generator errored" condition. Use `continue-on-error: true`, like its neighbours.
- **Freshness.** Add `'notable/'` to `EXCEPT` in `scripts/check-data-freshness.mjs`, with
  a reason in the style of `long-at-bats/`.
- **Directory budget.** `scripts/` is at its budget (121) in
  `scripts/check-dir-size.mjs`. Raise it by 1 for `gen-notable.mjs`, and add a comment in
  the style of the others: a flat `gen-*.mjs`, with its pure half in
  `scripts/lib/notable/`. Do not change any other budget.
- **Catalog.** Add an entry to `docs/scripts/generators.md` in the nightly group. Say
  that the full history (1901 to now) is a hand run with `--from` and `--to`, and that
  the nightly run only refreshes the season in play.
- **Flags.** `--season Y`, `--from Y --to Y`, and `--out=DIR` (write to DIR for a
  measuring run, as other generators do). Parse them with `scripts/lib/args.mjs`.

## Check against live data first

The feed shape is not documented (root `CLAUDE.md`). Before you write the rules,
check each field path with a live call. Name the gamePks you checked at the top of the
pure half. Use these cases. Spend no more than about 40 calls on checks.

| Case | Expect |
| --- | --- |
| 1979-07-12, gamePk 177426 | `detailedState` `Forfeit`; not a no-hitter |
| 1956-10-08, gamePk 67524 (`W`) | a no-hitter by the Yankees side |
| 2018-10-08, gamePk 563375 (`D`) | Brock Holt's cycle. A single-player game log with `gameType=D` returns it (checked in prompt 15b). Check whether the **batched** `hydrate=stats(...)` form takes a game type. If it does not, find the cheapest form that does, and say what it costs. |
| 2023-08-18, gamePk 716945 | the team log says 0 triple plays; only the seed adds it |
| 1927-07-04 | Negro league games (for example gamePk 856407, KCM@CAG) are dropped |
| 1975 season | 1,941 schedule rows and 1,934 distinct gamePks |

Two things are not tested yet. Test them and report the result:

- Does the team fielding game log take a postseason game type? Retrosheet shows 0
  postseason triple plays for 1960 to 2025, so no known case exists. If no form works,
  write the gap into the triple-play file's coverage block and say so in the PR. Do not
  invent a route.
- How does the schedule take more than one game type in one call? Check it. Do not
  guess.

## Run it

1. Run `node scripts/gen-notable.mjs --season 2025`. Commit the three files. They hold
   2025 only, and the coverage block says so. Prompt 1c runs the full history.
2. Run `--season 1956 --out=<scratchpad>` and `--season 1927 --out=<scratchpad>`. Do not
   commit them. Report their counts by kind in the PR. 1956 must hold the Larsen game.

## Tests (`test/notable.test.js`)

Pure and offline, with inline fixtures and a comment on why each case matters
(`test/CLAUDE.md`). Write each rule's test first and watch it fail.

- Played: `Forfeit` dropped; a `Postponed` row with `abstractGameState` `Final` dropped.
- Dedupe: a suspended game listed twice gives one row.
- League: a Negro league game dropped; a World Series game kept.
- No-hitter marks: shortened (8 innings batted), lost, combined (two pitchers).
- Cycle: 1B, 2B, 3B, HR is a cycle; 2B, 3B, HR, HR is not; 5 hits with a cycle is a cycle.
- Merge: a re-run of one season replaces that season only; a seed row joins; a seed row
  for an unswept season waits; a bad seed row fails.
- **Vocabulary** (the one that matters most, as in `test/long-at-bats.test.js`): read the
  committed `public/data/notable/*.json` and assert every key, at every depth, is on
  the allowlist.

## Verify

- `npm run lint; echo "exit=$?"` and `npm test; echo "exit=$?"`, in the foreground. Both
  must exit 0.
- `npm run build` must pass.
- No user-visible change, so no dev server and no screenshot.

## Commit, PR

- Commit to your task branch. Push with `git push -u origin <branch>`. Open a **draft**
  PR. Follow the repo's PR template.
- In the PR: the live checks and their results, the 2025 counts by kind, the 1956 and
  1927 counts, the cost of the 2025 run (calls and bytes), the two untested routes, and
  the perfect-game field question.
- Say that this PR adds no reader and no surface, so it touches no sealed surface.
- Do not push to `main`. Do not merge. Gary merges.

## Rules

- ASD-STE100 and the house word list ("postseason", never the other word).
- Never delete, skip or loosen a test to get green.
- If a command fails twice for the same reason, stop and report it. Do not widen the PR.
- Out of scope: the reader, the shelf page, the callout, the Retrosheet cross-check
  (prompt 1b), the full history run (prompt 1c), gzilavyss2025/bbsbh#1525,
  gzilavyss2025/bbsbh#1527 and gzilavyss2025/bbsbh#1570.
