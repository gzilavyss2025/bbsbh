# Prompt 1c — the Notable games index: the full history run

**Model: Haiku 4.5** (rung 1 in `.claude/skills/improve-prompt/SKILL.md`, step 5; no
effort setting). Mechanical: run two commands that exist, compare counts to a table,
paste a report, and commit data. It changes no code.

The cost figures below come from prompt 1a's measured runs (gzilavyss2025/bbsbh#1575).
The full-history totals are estimates from those runs, not measurements.

---

Run the Notable games generator for every finished season, 1901 to 2025. Then run the
Retrosheet cross-check against the result. Commit the data. Do not change any code.

## Find the work

1. Run `git fetch origin main`. Check that `scripts/gen-notable.mjs` on `origin/main`
   has the `--check-retrosheet` mode (prompt 1b). If it does not, stop and say that 1b
   must merge first.
2. Make a task branch from current `origin/main`. Check open PRs for any change to
   `scripts/gen-notable.mjs`, `scripts/lib/notable/`, `scripts/notable-seed.json` or
   `public/data/notable/`. If one exists, stop and name it.

## Read first (no edits)

- `CLAUDE.md`, `scripts/CLAUDE.md`, `docs/agents/writing-style.md`.
- The header of `scripts/gen-notable.mjs` and its entry in `docs/scripts/generators.md`.
  They give the flags and the cross-check command. Use the commands exactly as written
  there. If they differ from this prompt, the repo wins. Say so in the PR.
- ADR-0100 (Retrosheet downloads go outside the repo, into a new empty folder).

## Step 1. The history run

The generator writes after each season, so a stopped run keeps every season it
finished. Run it in chunks, so each command ends inside the 10-minute foreground limit.

```bash
node scripts/gen-notable.mjs --from=1901 --to=1920
node scripts/gen-notable.mjs --from=1921 --to=1940
node scripts/gen-notable.mjs --from=1941 --to=1960
node scripts/gen-notable.mjs --from=1961 --to=1980
node scripts/gen-notable.mjs --from=1981 --to=2000
node scripts/gen-notable.mjs --from=2001 --to=2025
```

- Each season prints one line with its counts. Each chunk prints its calls and bytes.
  Save every line for the PR.
- If a chunk stops at its time limit, read the last season it printed. Run again from
  the next season. Do not run a season twice on purpose; it is safe, but it costs calls.
- If a command fails twice for the same reason, stop and report it. Do not retry more,
  and do not change the code.
- Do not run 2026. The nightly cron owns the season in play. If the committed files
  already hold 2026, the generator keeps it.

**Expected cost (estimate):** about 6,000 calls and about 900 MB of JSON. 1a measured
29 to 30 calls for 1927 and 1956, and 69 to 77 calls for 2021, 2023 and 2025.

## Step 2. Check the counts

Count the rows by kind, by era and by game type in the three committed files. Compare
them with this table. `findings.md` measured the 1960 to 2025 regular-season numbers
with the same rules, so they must agree exactly.

| Rows | Expected | Source |
| --- | --- | --- |
| No-hitters, 1960 to 2025, `R` | 196 | `findings.md` Step 2 (197 candidates minus the 1979 forfeit) |
| Triple plays, 1960 to 2025, `R` | 266 | 265 from the API plus the seed row (gamePk 716945) |
| Cycles, 1960 to 2025, `R` | 198 | `findings.md` Step 2 |
| No-hitters, postseason | at least 3 | 1956 Larsen (`W`), 2010 Halladay (`D`), 2022 Astros combined (`W`) |
| Cycles, postseason | at least 1 | 2018 Brock Holt (`D`, gamePk 563375) |
| Triple plays, postseason | at least 1 | 1920 World Series, BRO@CLE, 1920-10-10 |
| 1901 to 1959, every kind | report the count | No exact figure: `findings.md` counted Negro league games, and the generator drops them (D6). |

Spot-check these rows by gamePk:

- 67524 (1956-10-08): no-hitter, `side: home`, pitchers `[Don Larsen]`.
- 177426 (1979-07-12, the forfeit): **absent**.
- 716945 (2023-08-18): triple play, `side: home`, from the seed.
- The two 2021 seven-inning no-hitters (2021-04-25, 2021-07-07): `shortened: true`; the
  2021-07-07 row lists five pitchers.

If any 1960 to 2025 count differs, list the gamePks that cause the difference. Do not
fix code and do not edit the seed. Report it, and keep going with Step 3.

## Step 3. The Retrosheet cross-check

1. Download each zip with `node scripts/lib/open-data/download.mjs <url> <new empty folder>`.
   Use a new, empty folder in your scratchpad for each one, outside the repo. Unzip them
   there. Never run anything from inside those folders.
   - `https://www.retrosheet.org/downloads/nohitters.zip`
   - `https://www.retrosheet.org/downloads/tripleplays.zip`
2. Run the check command from `docs/scripts/generators.md` against the committed index.
   Write the JSON report outside the repo.
3. Expect `missed` to be small. Each `missed` row is a candidate for the seed file. Do
   **not** add seed rows. Gary or a person he names checks each one first.
4. Delete the downloaded folders when you finish. Never commit a Retrosheet file.

## Step 4. Check the files

- The size of each file, raw and gzipped. Each must be well under 1 MB (GitHub's
  recommended file size).
- `npm run lint; echo "exit=$?"` and `npm test; echo "exit=$?"`, in the foreground. Both
  must exit 0. `test/notable.test.js` reads the committed files and fails on any key that
  is not allowed. That test is the spoiler check for this data. Never loosen it.
- `npm run build` must pass.

## Commit, PR

1. Commit only `public/data/notable/*.json`. Nothing else may change. If `git status`
   shows any other file, stop and report it.
2. Before you push, run `git fetch origin main` and merge `origin/main`. The nightly cron
   writes the same three files for the season in play. If they conflict, keep your
   branch's files, then run `node scripts/gen-notable.mjs --season=<season in play>` once
   to bring that season back. Commit the result.
3. Push with `git push -u origin <branch>`. Open a **draft** PR. Follow the repo's PR
   template.
4. The PR body holds:
   - the count table from Step 2, with expected and actual side by side;
   - each chunk's calls, bytes and time, and the total;
   - the spot-check results;
   - the cross-check report: the count for each label, and every `missed` row in full;
   - the file sizes;
   - a line that says this PR changes data only, adds no reader and no surface, and
     touches no sealed surface.
5. Do not push to `main`. Do not merge. Gary merges.

## Rules

- ASD-STE100 and the house word list ("postseason", never the other word).
- Change no code, no test and no seed. If the run needs a code change, stop and report
  what failed.
- If a command fails twice for the same reason, stop and report it. Do not widen the PR.
- Out of scope: seed rows, the perfect-game mark, the reader, the shelf, the callout,
  gzilavyss2025/bbsbh#1525, gzilavyss2025/bbsbh#1527 and gzilavyss2025/bbsbh#1570.
