# Prompt 1b — the Notable games index: the Retrosheet cross-check

**Model: Sonnet 5.5, medium** (rung 3 in `.claude/skills/improve-prompt/SKILL.md`,
step 5). It adds one hand-run mode that follows ADR-0100's open-data pattern, with a
clear spec. It writes no data and changes no surface.

The file facts below come from a download of `nohitters.zip` and `tripleplays.zip`
on 2026-10-06 (prompt 15b). Check them again before you rely on them.

---

Add a cross-check to the Notable games generator. It reads Retrosheet's no-hitter and
triple-play lists and reports every game where Retrosheet and the committed index
disagree. It is a report for a person to read. It never writes the index or the seed.
A person adds a seed row when the report finds a true miss (decision D3).

## Find the work

1. Run `git fetch origin main`. With the GitHub tools, find the merged PR for prompt 1a
   (it adds `scripts/gen-notable.mjs` and `public/data/notable/`). If 1a is not merged,
   stop and say so.
2. Make a task branch from current `origin/main`. Check open PRs for changes to
   `scripts/gen-notable.mjs` or `scripts/lib/notable/`. If one exists, stop and name it.

## Read first (no edits yet)

- `CLAUDE.md`, `scripts/CLAUDE.md`, `test/CLAUDE.md`, `docs/agents/writing-style.md`.
- ADR-0100 (Retrosheet is a build-time source, run by hand; downloads go outside the
  repo; a generator takes extracted paths as arguments and never downloads).
- `.scratch/old-games/findings.md` Step 1 (the join, and its failures) and Step 2.
- `.scratch/old-games/decisions.md`: D3, D6, D7, D13.
- `scripts/gen-notable.mjs`, `scripts/lib/notable/`, `scripts/notable-seed.json`, and the
  committed `public/data/notable/*.json` with their coverage blocks.
- `scripts/lib/csv.mjs` (`parseCsv`), `scripts/lib/args.mjs` (`--flag=value` and bare
  `--flag`), `scripts/lib/open-data/download.mjs`.

## Get the files (outside the repo)

Download each zip with `node scripts/lib/open-data/download.mjs <url> <new empty folder>`.
Put each one in its own new, empty folder in your scratchpad, outside the repo. Unzip it
there. Never run anything from inside those folders.

- `https://www.retrosheet.org/downloads/nohitters.zip` (1,438,142 B on 2026-10-06)
- `https://www.retrosheet.org/downloads/tripleplays.zip` (2,880,177 B)

Not cycles: Retrosheet has no cycle list today. `cycles.zip` is a copy of `3HR.zip`
(`findings.md` Step 2). The cross-check covers no-hitters and triple plays only.

## What the files hold (check this again)

Each zip holds `gameinfo.csv`, `teamstats.csv`, `batting.csv`, `pitching.csv`,
`fielding.csv`, `allplayers.csv` and `plays.csv`. The check needs only the first two.

- `gameinfo.csv`: one row per game. Columns used: `gid`, `visteam`, `hometeam`, `date`
  (`YYYYMMDD`), `number` (0 for a single game, 1 or 2 in a doubleheader), `vruns`,
  `hruns`, `gametype`, `forfeit`, `season`. 359 rows in `nohitters`, 635 in
  `tripleplays`.
- `gametype` values seen: `regular`, `exhibition`, `allstar`, `worldseries`, `lcs`,
  `divisionseries`, `championship`. `championship` and the 1930 `lcs` row are Negro league
  postseason games (Chicago American Giants at Atlantic City, 1926 and 1927; Detroit at
  St. Louis, 1930).
- `teamstats.csv`: one row per club per game, keyed by `gid` and `team`. `b_h` is the
  club's hits; `d_tp` is its triple plays in the field; `vishome` says its side. A
  no-hitter's no-hit club has `b_h` 0. A triple play's fielding club has `d_tp` above 0.

## What to build

- A mode on the generator:
  `node scripts/gen-notable.mjs --check-retrosheet --nohitters=DIR --tripleplays=DIR [--index=DIR]`.
  Either list may be left out. `--index` defaults to `public/data/notable`. It reads the
  extracted CSVs from the paths given and never downloads.
- The pure half in `scripts/lib/notable/` (for example `retro-check.mjs`). It takes the
  parsed rows, the index, and an injected `scheduleFor(date)` function, so the tests stay
  offline. Keep each file under 600 lines. If the generator nears 600 lines, move more
  into the pure half.

### Matching

Match a Retrosheet game to an index row by **date and score**, with no team-code table.
`findings.md` used a hand-made table of Retrosheet codes; this check needs none.

- Same official date, and the same away and home runs (`vruns`, `hruns`).
- Accept either game of a doubleheader day. The API and Retrosheet number some old
  doubleheaders in the opposite order (the 1904-06-20 case in `findings.md`).
- The side must agree: the no-hit club's side for a no-hitter, the fielding club's side
  for a triple play.

### Labels

Give every Retrosheet game exactly one label. Call the API only for a game that the
index does not explain.

| Label | When | API call? |
| --- | --- | --- |
| `matched` | An index row of the same kind matches. | No |
| `side-differs` | The game matches, but the side does not. | No |
| `out-of-scope-type` | `gametype` is `exhibition` or `allstar`. | No |
| `season-not-swept` | The season is not in the index's coverage block. | No |
| `dropped-league` | The API has the game on that date, but a club was not in the AL or NL that season (D6). | One schedule call for that date |
| `not-in-api` | The API has no game on that date with that score. Before 1901 and Federal League games land here (D7). | Same call |
| `missed` | The API has a played AL or NL game with that date and score, and the index does not hold it. **A seed candidate.** | Same call |

For the date call, use `getJson` from `scripts/lib/statsapi.mjs`, with the team and
league hydrated and `fields=`. Cache by date, so two rows on one date cost one call.

Then the reverse: list each index row, in a season both sources cover, that Retrosheet
does not hold (`index-only`). It is not an error. `findings.md` found one for 1901 to
1959. A person reads it.

### The report

Print one block per label with its count. For every row that is not `matched`, print
the Retrosheet `gid`, the date, the clubs as Retrosheet codes them, the score, and the
gamePk when the API has one. A person must be able to check each `missed` row by hand
from the report alone. Add `--report=FILE` to also write it as JSON to a path outside
the repo. Exit 0 when the inputs parse, whatever the labels say. Exit 1 when a file is
missing or a needed column is gone.

## Verify against real cases

Use 1a's generator with `--out=<scratchpad>` to build a test index for the seasons
1920, 1927, 1956 and 2023. Do not commit it. Run the check against it, and against the
committed index. Spend no more than about 250 API calls.

| Case | Expect |
| --- | --- |
| 1956-10-08 BRO@NYA, 0-2, `worldseries` (Larsen) | `matched` |
| 2023-08-18 TBA@ANA triple play (gamePk 716945) | `matched`, through the seed row |
| 1920-10-10 BRO@CLE, 1-8, `worldseries` triple play | `matched` if 1a's postseason triple-play route works; else `missed`. Report which. This is the first known case for that route. |
| 1927 Negro league rows, and 1926/1927 `championship` | `dropped-league` |
| Any row before 1901 | `not-in-api` or `season-not-swept` |
| 2025 rows against the committed index | all `matched`, or each one explained |

## Tests (`test/notable-retro-check.test.js`)

Pure and offline, with inline fixtures and a comment on why each case matters. Write each
test first and watch it fail.

- A doubleheader game matches either game of that day.
- A score coincidence on the same date with the wrong side is `side-differs`, not
  `matched`.
- Each label, including `dropped-league` and `missed`, through an injected
  `scheduleFor`.
- Two rows on one date make one `scheduleFor` call.
- `index-only` lists a row that Retrosheet lacks.
- A missing `teamstats.csv` column fails with a clear message.

## Docs

- Add the check to the `gen-notable.mjs` entry in `docs/scripts/generators.md`: what to
  download, where it goes, the command, and what each label means. Say that it writes
  nothing and that a person edits `scripts/notable-seed.json`.

## Verify

- `npm run lint; echo "exit=$?"` and `npm test; echo "exit=$?"`, in the foreground. Both
  must exit 0. `npm run build` must pass.
- No user-visible change, so no dev server and no screenshot.

## Commit, PR

- Commit to your task branch. Push with `git push -u origin <branch>`. Open a **draft**
  PR. Follow the repo's PR template.
- Paste both reports in the PR (the test index and the committed index), with the count
  for each label. List every `missed` row. Do **not** add seed rows. Gary or a person he
  names checks each one and adds it.
- Say the API call count, and that this PR writes no data and touches no sealed surface.
- Do not push to `main`. Do not merge. Gary merges.

## Rules

- ASD-STE100 and the house word list ("postseason", never the other word).
- Never commit a Retrosheet file. Never save one inside the repo.
- Never delete, skip or loosen a test to get green.
- If a command fails twice for the same reason, stop and report it. Do not widen the PR.
- Out of scope: cycles, the full history run (prompt 1c), the reader, the shelf, the
  callout, gzilavyss2025/bbsbh#1525, gzilavyss2025/bbsbh#1527 and
  gzilavyss2025/bbsbh#1570.
