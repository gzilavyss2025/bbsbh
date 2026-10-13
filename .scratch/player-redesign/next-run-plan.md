# Run plan: player-redesign DATA issues (checked against origin/main f4b0d6604, 2026-10-13)

Gary's decisions (2026-10-13), written into the prompts as facts:
- #1910: a pitcher's "All batters" row is vs L + vs R (today's code).
- #1911: a foul tip is a whiff. Add code `T` in the hitter-grid generator only, not in the shared `WHIFF_CODES`.
- #1912: each ball shows real xBA from a second lattice beside `public/data/xwoba-table/` (ADR-0097), with its own accuracy check.
- #1881: now `ready-for-agent`. The league "most in one at-bat" figure is the median of regular hitters (300+ PA); 2026 = 6. It lands together with #1914(b), the per-game fouls; new code goes in `scripts/lib/fouls/`.
- Backfills: a code PR that adds per-game generator columns adds the generator change, a backfill flag and tests, and checks them on a few games only. A SEPARATE Haiku 5.5 (low) row runs the full 2026 re-read after that code PR is merged. It opens a data-only PR right before `/stack-prs`, because the nightly job rewrites the same dumps.
- Not in this plan: the module issues #1926 to #1930.

I applied the backfill rule to two more code rows than Gary named: #1911 (the hitter-grid counters, the same sweep and the same `pitch-arsenal.sql` dump) and #1912(b) (the spray columns; `gen-spray.mjs` runs nightly and rewrites the same shards). Each gets its own Haiku row (18, 19). Drop them if Gary wants those re-reads done another way.

## Run plan

| # | What | Model | Effort | Depends on | Parallel with |
|---|---|---|---|---|---|
| 1 | #1918 Firsts: `oppId` for the opponent logo | Haiku 5.5 | medium | none | 2-7 |
| 2 | #1913 Form trend: `rollingSeries` | Sonnet 5.5 | medium | none | 1, 3-7 |
| 3 | #1916 On the mound: opponent per app + pitches-per-start bug | Sonnet 5.5 | medium | none | 1, 2, 4-7 |
| 4 | #1909 Season statistics (splits `careerRegister.js` first) | Sonnet 5.5 | high | none | 1-3, 5-7 |
| 5 | #1908 part a: per-pitch whiff %, zone mark, xwOBA (no sweep) | Sonnet 5.5 | medium | none | 1-4, 6, 7 |
| 6 | #1910 part b: vs-team OBP, SLG, K%, BB% | Sonnet 5.5 | medium | none | 1-5, 7 |
| 7 | #1912 part a: the xBA lattice and its check | Sonnet 5.5 | high | none | 1-6 |
| 8 | #1914(a) + #1915 part a: game-log sort, league prefix, score | Opus 5.5 | high | row 4 merged | 9, 10, 11 |
| 9 | #1917 Path to the Majors: games and clubs per level | Sonnet 5.5 | medium | row 4 merged; PR #1924 merged | 8, 10, 11, 12, 13 |
| 10 | #1908 part b code: movement, spin, flight; arsenal re-walk flag | Sonnet 5.5 | high | none (kept out of wave 1: per-game columns) | 8, 9, 11, 12, 13 |
| 11 | #1912 part b code: spray columns, per-ball xBA, game runs; checked on a few games | Sonnet 5.5 | high | row 7 merged | 8, 9, 10, 12, 13 |
| 12 | #1881 + #1914(b) code: fouls by count + per-game fouls; backfill flag | Sonnet 5.5 | xhigh | row 8 merged | 9, 10, 11, 13 |
| 13 | #1910 part a: Splits seasons, Career, All, reads, door columns | Sonnet 5.5 | high | rows 4, 6 and 8 merged | 9-12 |
| 14 | #1911 code: hitter-grid counters + foul-tip rule | Sonnet 5.5 | high | rows 10 and 15 merged | 11, 12, 13, 16 |
| 15 | #1915 part b code: per-start pitch mix | Sonnet 5.5 | high | row 10 merged | 11, 12, 13, 16 (not 14) |
| 16 | Backfill: fouls 2026 re-read (#1881, #1914) | Haiku 5.5 | low | row 12 merged; right before /stack-prs | 17, 19 |
| 17 | Backfill: pitch arsenal 2026 re-walk (#1908, #1915) | Haiku 5.5 | low | rows 10 and 15 merged; right before /stack-prs | 16, 19 |
| 18 | Backfill: hitter-grid 2026 re-walk + gate (#1911) | Haiku 5.5 | low | rows 14 and 17 merged; right before /stack-prs | 16, 19 |
| 19 | Backfill: spray 2026 rebuild (#1912) | Haiku 5.5 | low | row 11 merged; right before /stack-prs | 16, 17, 18 |

Waves: wave 1 = rows 1-7 (no per-game generator columns). Wave 2 = rows 8, 9, 10, 11 (row 9 also waits for PR #1924). Wave 3 = rows 12, 13, 15. Wave 4 = row 14 and the backfill rows whose code is merged. Each backfill row runs right before the `/stack-prs` that follows its code PR's merge, and outside 07:30-10:00 UTC (the nightly job starts at 08:17 UTC).

PR bodies: a row that finishes an issue says "Closes #n". A code row whose issue still waits for a backfill says "Part of #n", and its backfill row says "Closes #n" (rows 16-19). Rows 5 and 7 say "Part of" too; rows 17 and 19 close #1908 and #1912.

Model picks, one line each:
- 1. One field and one pure helper, named files, a test first: Haiku 5.5 medium can do it.
- 2, 3, 5, 6, 9. A slice that follows an existing pattern, with a clear spec: rung 3. Row 3 is a known-cause bug fix.
- 4, 13. Several reshapes across 6-8 files with judgment (the subtotal row, the gap rows; the doors must not change the live card): rung 4.
- 7. A new lattice and a new accuracy check with thresholds set from a measured run: rung 4.
- 8. It adds a final score to `gameLogView`, which is cutoff-gated and also renders in game-context visits. A spoiler-adjacent change never goes below rung 7.
- 10, 11, 14, 15. Schema columns, a sweep change next to a file budget, and a re-walk flag: rung 4.
- 12. Two issues in one generator at 1084/1100 lines, a 12-count state machine (balls are not carried today), a per-game table and a wipe-and-rebuild flag: rung 5. The research suggested Opus 5.5 high; Sonnet 5.5 xhigh costs half as much per token, so try it first.
- 16-19. Run one command, check numbers, commit data: Gary's pick, Haiku 5.5 low (rung 1).

Fact fixes to the research and the issues (all checked on origin/main f4b0d6604; main moved from 3c542261f):
- #1910: `FIELDS`, `doorCells` and `DOOR_COLUMNS` are in `src/api/boxlines/careerSplits.js` (:49, :146, :162), not in `cardFacets.js`. `overallSide` is `src/api/person/stats.js:223`. `SITUATIONAL_SIT_CODES` is `person/stats.js:305`.
- #1908: whiff % per pitch type exists already: `commandView(entry, { code }).whiffPct` in `src/api/commandMap.js`. The zone-mark helper belongs in `commandMap.js`, not beside `heatView` (`pitchArsenal.js:245` is the century-club band). `gen-savant-matchup.mjs` is a nightly Savant rebuild, so its xwOBA part needs no backfill.
- #1914: `seriesAbbr` lives in `src/api/boxlines/rows.js:181`; `person/gameLog.js:8` imports it. `boxlines/fetch.js` already asks the schedule by gamePk for scores (`fetchSchedule`, not exported), and its header says why per-gamePk beats per-season. The game log's loader is `loadPlayerStats` in `src/api/player/stats.js` (via `buildBlock`, `person/activity.js:431`), so row 8 edits the same file as rows 4 and 13.
- #1915: a pitcher's own W/L/SV is likely on each gameLog `stat` already; check live before you add `hydrate=decisions`.
- #1916: `test/mound-card.test.js:132` asserts `pitchesPerStart` 91 on a starters-only fixture. That assertion stays true. The new failing test needs a fixture with relief appearances. `gen-workload.mjs` is a full rebuild: no backfill.
- #1881: `gen-fouls.mjs` carries `preStrikes` but not balls. Its flags today: `--backfill-games` (fills `foul_game_totals` only) and `--backfill-team-pitch-types` (wipes and rebuilds; the pattern to copy). Reader: `src/api/fouls.js` (257 lines, spoiler-free).
- #1911: the hitter grid is swept by `gen-pitch-arsenal.mjs` (695/700) through `scripts/lib/pitch/hitter-grid.mjs` (184 lines). Its counters list is `FIELDS` in `src/api/scout/hitterGrid.js:48`. The re-walk exists: `--clear-hitters=2026 --since=2026-03-20`.
- #1912: `gen-spray.mjs` keeps no SQLite; its shards are the accumulator, and it has `--rebuild`. The xwOBA day cache is the full Savant detail CSV, so `estimated_ba_using_speedangle` is in the same files.
- Budgets: `src/api/person/` 13/13 files (`contract/`, `family/` are subfolders). `scripts/lib/` 43/42, so new helpers go in `scripts/lib/pitch/` (2 files) or a new `scripts/lib/fouls/`. `gen-fouls.mjs` 1084/1100, `gen-pitch-arsenal.mjs` 695/700. `src/api/player/` 11/12, `src/styles` 119/119 (no row touches them).

## File overlap

| File | Rows | How the plan handles it |
|---|---|---|
| `src/api/player/stats.js` | 4, 8, 13 | 4, then 8, then 13. Row 12 must not edit it |
| `src/api/person/careerRegister.js` (600/600) | 4, 9 | 4 moves the level/timeline half to `src/api/person/career/progression.js`; 9 edits that file after 4 merges |
| `src/api/person/gameLog.js` | 8, 12 | 12 after 8 |
| `src/api/person/stats.js`, `person/activity.js` | 4 (maybe), 8, 13 | in order 4, 8, 13 |
| `src/api/player/overview.js` | 9, open PR #1924 | 9 waits for #1924. Row 8 must not edit it |
| `src/api/player/history.js` | 1 (:334), 9 (:175) | different waves |
| `scripts/gen-fouls.mjs` (1084/1100), `scripts/data/fouls.sql` | 12, 16, nightly | one code row for both issues; 16 after 12 |
| `scripts/gen-pitch-arsenal.mjs` (695/700), `scripts/lib/schema.sql`, `scripts/data/pitch-arsenal.sql` | 10, 15, 14, 17, 18, nightly | 10, then 15, then 14; 17 after 10 and 15; 18 after 14 and 17 |
| `scripts/lib/pitch/xwoba.mjs`, `scripts/gen-xwoba-table.mjs` | 7, 11 (reads) | 11 after 7 |
| `public/data/spray/`, `scripts/data/spray-ingested.json` | 11 (few games, not committed), 19, nightly | 19 after 11 |
| `src/api/spoiler-manifest.json` | 4, 8 (maybe), 11 (maybe) | different entries; not an overlap |
| `public/data/workload.json` | 3, nightly | full rebuild; on a conflict take the newer file |

---

## Prompt 1 of 19 — Haiku 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, then src/api/CLAUDE.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits src/api/player/history.js, stop and report.

Task: issue #1918 (Firsts). The Firsts card needs the opponent's team id, so the UI can draw the logo with teamLogoUrl(oppId) (src/lib/teams.js:477).

Facts (checked on origin/main):
- src/api/player/history.js:325-337 builds each first from `g = links.byPk[f.gamePk]`. It outputs oppAbbr and oppName. `g` has awayId and homeId.
- The player page is an open surface (ADR-0034). This change adds no score and no seal.

Steps:
1. Move the opponent fields into one small exported pure function in history.js, for example firstOpponent(f, g) -> { oppId, oppAbbr, oppName }. oppId is (f.isHome ? g.awayId : g.homeId), or null when g is missing.
2. Test first: add test/firsts-opponent.test.js. Cover a home first, an away first and a missing g. Run it and see it fail. Then make it pass.
3. Use the function in the loop at :330.

Done means: every first carries oppId (a number, or null); oppAbbr and oppName do not change; npm run lint, npm test and npm run build pass.
Stop if: history.js does not match these facts, or the test cannot import history.js without network calls.

Handoff: open a draft PR. Body: what changed, in ASD-STE100 style, and "Closes #1918". This changes no screen, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 2 of 19 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, then src/api/CLAUDE.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits src/api/hitterForm.js, stop and report.

Task: issue #1913 (Form trend). Add a pure rollingSeries(log, w) to src/api/hitterForm.js (201 lines today).

Facts (checked on origin/main):
- hitterFormWindows (hitterForm.js:36) sorts by date, then game.gameNumber, then gamePk. Reuse that order. It does NOT drop 0-PA games. Do not change hitterFormWindows.
- aggregateSplits(rows, 'hitting', { dedupe: false }) (src/api/person/stats.js:50) already folds a window into one line with OPS.
- The opponent abbreviation comes from teamAbbr (src/lib/teams.js:117).
- hitterForm.js is cutoff-gated in src/api/spoiler-manifest.json. The function is pure; the caller passes the log.

Rules (from the issue):
- Count a game only if it has a plate appearance (Turang 2026: 151 rows, 150 with a PA; the 0-PA game is 2026-09-19).
- Order doubleheaders by game.gameNumber.
- For w in 10, 15 and 20, give one point per game from game w on: { date, gamePk, opp, isHome, ops }. Also give the best and the worst w-game stretch (start date, end date, OPS).

Steps:
1. Test first: in test/hitter-form-window.test.js, add cases for the 0-PA rule, the doubleheader order and the best/worst stretch. See them fail.
2. Write rollingSeries. Make the tests pass.
3. Check live: fetch Brice Turang 668930's 2026 hitting gameLog from statsapi.mlb.com. His best 15-game stretch must be 1.227 OPS. Put the number in the PR.

Done means: the tests pass, the live check gives 1.227, and npm run lint, npm test and npm run build pass.
Stop if: the live best 15-game OPS is not 1.227 after the two rules are in; report the number and the stretch.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1913". No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 3 of 19 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/api/CLAUDE.md and scripts/CLAUDE.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1916 (On the mound). Two parts.

Facts (checked on origin/main):
- foldGameLog (src/api/workload.js:35) keeps each app as { d, p, gs? } and sums season g, gs, pitches, outs over regular-season games.
- BUG: moundRateFor (workload.js:370) divides ALL pitches by starts (:379, pitchesPerStart). ipPerStart (:378) has the same flaw with outs. Gasser 688107: 86.8 pitches per start, not 91.
- test/mound-card.test.js:131-132 asserts 91 on a starters-only fixture. That stays true. Do not change it.
- scripts/gen-workload.mjs is a nightly FULL rebuild (one gameLog call per pitcher; APPS_KEPT 12 at :46). No backfill is needed.
- The consumer is src/components/playerstats/PitcherWorkloadCard.jsx:112. Do not edit it.

Steps:
1. Test first, in test/mound-card.test.js: a pitcher with starts AND relief apps. pitchesPerStart and ipPerStart must count starts only. See it fail.
2. In foldGameLog, also sum pitches and outs of starts only. Use them in moundRateFor. A store with no starter-only sums gives null for both.
3. Per app, also store the opponent team id, isHome, gameType and gamePk (read the gameLog split; check the field paths against a live response). Keep the keys short, like d and p. Add a test.
4. Run node scripts/gen-workload.mjs. Commit public/data/workload.json and workload-summary.json. Check Gasser's starter-only figure (86.8, which rounds to 87) and one Ashby 676879 app.
5. Render the On the mound card for Gasser in npm run dev (/player/robert-gasser-688107/stats?nointro, or the tab that shows it) in Chromium. Send Gary a screenshot with the route.

Done means: the new tests fail without the fix and pass with it; every app carries the four new fields; npm run lint, npm test and npm run build pass.
Stop if: the live gameLog split has no opponent id, or the regenerated file is more than twice its current size.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1916". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 4 of 19 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md and src/api/CLAUDE.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report. A different entry in src/api/spoiler-manifest.json is not an overlap.

Task: issue #1909 (Season statistics). Split careerRegister.js first, then do the data changes.

Budgets: src/api/person/careerRegister.js is 600 lines, the MAX_LINES cap (scripts/check-file-size.mjs:51). src/api/person/ holds 13 files, its budget (scripts/check-dir-size.mjs:604). Do not raise either.

Step 1, a pure move (its own commit): move the "Level progression" section (from the comment block above levelProgressionView, :398, to the end: levelProgressionView, dropRehabStints, formatSeasonSpan, careerTimelineView) to the new file src/api/person/career/progression.js. Update the re-export in src/api/person.js (:67-74). Add a spoiler-manifest.json entry for the new module (same class as careerRegister.js). npm test must pass with no test change. Issue #1917 builds on this file next.

Step 2, the data (test first for each: add the test, see it fail, then fix):
- Team abbreviation: fetchTeamAbbrevs (src/api/person-fetch.js:325) calls /teams?teamId=... with no season, so 2018 "AZL Brewers" reads "ACL". Make it season-correct: ask /teams with season, once per season. Callers: src/api/player/stats.js:191 and src/api/player/postseasonRegister.js:72.
- "2 TM" subtotal row: withoutMultiTeamAggregate (src/api/person/stats.js:33) drops the live numTeams > 1 row. Keep it in careerRegisterView (careerRegister.js:147) as a subtotal row, marked so the UI can tell it from a team row.
- MiLB career line: sum the per-level career calls (person-fetch.js:206) with aggregateSplits (person/stats.js:50).
- Gap rows: missingSeasonRows (careerRegister.js:125) starts at debutYear (:362). Start at the first pro season. Add a fixed "2020: no minor-league season" note row.
- The All-Star star exists (player/stats.js:182). Do not change it. Do not run gen-league-averages.mjs; that waits for the 2026 World Series final.

Check live with Brice Turang 668930 (2018 AZL Brewers) and Robert Gasser 688107. The player page is an open surface (ADR-0034): no seal.

Done means: careerRegister.js is under 600 lines; the four reshapes have tests that failed first; npm run lint, npm test and npm run build pass. Render /player/brice-turang-668930/stats?nointro in Chromium and send Gary a screenshot (the existing register must still render).
Stop if: the /teams call with season does not give the season's abbreviation for a 2018 complex-league club; report the response.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1909". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 5 of 19 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/api/CLAUDE.md and scripts/CLAUDE.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1908, part a: the per-pitch numbers that need no sweep. Part b (movement, spin, flight) is a later prompt. Do not touch scripts/gen-pitch-arsenal.mjs.

Facts (checked on origin/main):
- Whiff % per pitch type exists: commandView(entry, { code }).whiffPct in src/api/commandMap.js (:63). Reuse it.
- The 25 cells (pitch-command/{season}/{NN}.json) give the zone mark. No centroid helper exists.
- pitcherArsenalMap (scripts/gen-savant-matchup.mjs:173) keeps usage and whiff only. est_woba is on the board rows; the batter side keeps it (:202-205). This generator is a nightly Savant rebuild, so no backfill.
- The reader of the arsenal map is src/api/matchup/savant.js (:58-70).

Steps (test first for each: add the test, see it fail, then write the code):
1. In commandMap.js, add one view that lists each pitch type with pitches, whiffPct and a zone mark: the pitch-weighted centroid of its cells, in the grid's own frame. Test it in test/command-aggregate.test.js.
2. In pitcherArsenalMap, also keep xwoba (est_woba, 3 decimals) under the same PITCH gate. Warn when the column is mostly blank, like :202-205. Read it in matchup/savant.js; a missing value is null.
3. Run node scripts/gen-savant-matchup.mjs to check Gasser 688107 (store shard 07). Do not commit public/data/savant-matchup.json; the nightly cron rewrites it. Use the store's numbers, not Savant usage (FF 23.4 in the store).

Done means: the new view and the xwoba field have tests that failed first; Gasser's per-type whiff % and xwOBA print in the PR; npm run lint, npm test and npm run build pass.
Stop if: est_woba is blank on the pitcher board.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1908" (part b closes it). No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 6 of 19 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/api/CLAUDE.md and scripts/CLAUDE.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1910, part b: the vs-team rates. Part a (seasons, Career, All, reads, door columns) is a later prompt.

Facts (checked on origin/main):
- buildPlayerVs (scripts/gen-vs-team-splits.mjs:198) sums pa, ab, h, d, t, hr, rbi, bb, hbp, sf, tb for a hitter and g, outs, er, k, bb for a pitcher, then writes the line at :258-259. It computes OBP and SLG for ops (:97-100) but does not write them. It keeps no strikeouts for a hitter.
- The reader is vsTeamSplitsFor in src/api/vsTeamSplits.js.
- The generator is a nightly FULL rebuild of every career game log. No backfill is needed.

Steps (test first: add the test in test/vs-team-splits.test.js, see it fail, then write the code):
1. In the hitter line, also write obp, slg (MLB rounding, as ops does) and so.
2. In the reader, give BB% = bb / pa and K% = so / pa. A shard with no so gives null, and the UI shows "—".
3. Do not commit public/data/vs-team-splits/; the nightly cron rewrites it. If one generator run takes under 15 minutes, run it and check Brice Turang 668930 against one club; else check with the unit test only and say so in the PR.

Done means: the hitter line carries obp, slg and so; the reader gives K% and BB%; the tests failed first; npm run lint, npm test and npm run build pass.
Stop if: the callout reader (src/api/callout-notes.js) breaks on the new keys.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1910". No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 7 of 19 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, scripts/CLAUDE.md and docs/adr/0097-xwoba-est-is-a-per-season-lookup-on-exit-velocity-and-launch-angle.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1912, part a. Gary decided (2026-10-13): each ball shows real xBA, from a second lattice beside public/data/xwoba-table/, with its own accuracy check. This prompt builds the lattice and the check. Part b (the spray columns that use it) is a later prompt.

Facts (checked on origin/main):
- scripts/gen-xwoba-table.mjs (109 lines) pulls one Savant detail CSV per day, caches it in $TMPDIR/bbsbh-xwoba/{season}/, and fits [launch_speed, launch_angle, estimated_woba_using_speedangle] with fitTable (scripts/lib/pitch/xwoba.mjs:31).
- The same CSV carries estimated_ba_using_speedangle.
- The xwOBA gate (xwoba.mjs:83-110) checks the hitter grid against a Savant board. The xBA check is new.

Steps:
1. Make fitTable take any estimate column. Build the xBA lattice from the same day files and write public/data/xba-table/{season}.json in the same shape. One run builds both tables; add a flag only if it is needed.
2. Add an xBA accuracy check: a lattice lookup per ball against Savant's own estimated_ba_using_speedangle, over the season's balls in play. Set the thresholds from one measured run, in the shape of GATE. Write the measured numbers in the PR. Expected sample (Turang): a 108.4 mph, 22 degree home run gives about .911; a 106.3 mph, 2 degree single gives about .520.
3. Test first: in test/xwoba-table.test.js, cover the generic fit and the xBA check on a small fixture. See them fail.
4. Run the build for 2026. Commit public/data/xba-table/2026.json (a hand-run file, like the xwOBA table). Add a short note to ADR-0097 and to the gen-xwoba-table entry in docs/scripts/generators.md.

Done means: the 2026 xBA table is on file; the check passes with its measured thresholds; the tests failed first; npm run lint, npm test and npm run build pass.
Stop if: baseballsavant.mlb.com is not reachable from the container, or the measured gap is so large that no sensible threshold passes; report the numbers.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1912". No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 8 of 19 — Opus 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/api/CLAUDE.md, src/api/boxlines/CLAUDE.md and docs/adr/0069-box-lines-are-fetched-on-the-tap-and-gated-before-the-fetch.md. Use the branch the session gives you, cut from current origin/main. Needs: the #1909 PR (Season statistics) merged on main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report. A different entry in src/api/spoiler-manifest.json is not an overlap.

Task: the client half of issue #1914 and of issue #1915: the game log's doubleheader order, the league prefix on the series tag, and the final score. The per-game fouls (#1914) and the per-start pitch mix (#1915) are NOT in this prompt.

Facts (checked on origin/main):
- gameLogView (src/api/person/gameLog.js:76) filters rows to s.date < cutoff (:78), then sorts by date only (:79). Doubleheaders swap (Turang 2026: 04-04, 07-07, 07-11).
- seriesAbbr (src/api/boxlines/rows.js:181) gives WC, DS, LCS, WS. rows.js:317 also calls it.
- boxlines/fetch.js already asks the schedule BY GAMEPK for final scores (fetchSchedule, not exported), and its header says why that beats one call per season.
- The game log's loader is loadPlayerStats (src/api/player/stats.js:37), through buildBlock (src/api/person/activity.js:431). Do not edit src/api/player/overview.js (open PR #1924); the overview preview stays without a score.

The spoiler rule here: person/gameLog.js is cutoff-gated. The player page is an open surface (ADR-0034), but a game-context visit passes a cutoff. A score must follow that same cutoff: ask the schedule only for gamePks of rows that pass the cutoff, and join after the filter. A same-day game 1 is out, as in rows.js.

Steps (test first for each: add the test, see it fail, then write the code):
1. Sort by date, then game.gameNumber, then gamePk.
2. Add an optional league argument to seriesAbbr: AL or NL before WC, DS and LCS (NLDS); WS stays WS. Find the league on the live gameLog split; do not guess the path. Old callers stay the same.
3. Join the final score on gamePk: result (W/L) and the two scores, for batter and pitcher rows. Reuse the boxlines schedule call. For a pitcher, check whether the gameLog stat already has his W/L/SV; add hydrate=decisions only if it does not. Update the manifest's importers if a gated module gains one.
4. Check live: Turang 668930 2026 (postseason: 6 G; log 157 rows) and Gasser 688107 (2026-05-23 vs LAD).

Done means: the three changes have tests that failed first, including one that proves no score is asked for at or after the cutoff; npm run lint, npm test and npm run build pass. Render /player/brice-turang-668930/stats?nointro in Chromium and send Gary a screenshot.
Stop if: the score cannot be gated by the cutoff without a change to boxlines/rows.js's gate.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1914" and "Part of #1915". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 9 of 19 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md and src/api/CLAUDE.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1909 PR (it moved the level views to src/api/person/career/progression.js) and PR #1924 (it edits src/api/player/overview.js). If either is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1917 (Path to the Majors). Each level needs games and clubs.

Facts (check the line numbers again after the #1909 move):
- levelProgressionView gives AB or IP per level. dropRehabStints trims rehab seasons. careerTimelineView has the teams per stint. All three are now in src/api/person/career/progression.js.
- Callers: src/api/player/history.js (~:175, after the debut) and src/api/player/overview.js (~:197, before the debut). Both pass the MiLB year-by-year splits only.

Steps (test first: add the tests in test/career-register.test.js or a new test file, see them fail, then write the code):
1. Per level, add games (the sum of gamesPlayed) and teams: [{ id, name, games }], in the order he played for them.
2. Add the MLB games and the minors total to the same view. If that needs the MLB splits, pass them from both callers.
3. Check live: Brice Turang 668930 Rookie level = 42 G: AZL Brewers 13 and Helena 29. Jesús Made 815908 (shard 08) for a pre-debut player.

Done means: the new fields have tests that failed first; the Turang numbers match; npm run lint, npm test and npm run build pass. The existing cards must render the same: render /player/brice-turang-668930/history?nointro in Chromium and send Gary a screenshot.
Stop if: the moved file is not on main.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1917". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```


## Prompt 10 of 19 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, scripts/CLAUDE.md, src/api/CLAUDE.md and docs/adr/0021-sqlite-data-layer.md. Use the branch the session gives you, cut from current origin/main. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1908, part b, the CODE only. Keep per-pitch-type means of release point, movement, extension, flight time and spin. Gary decided (2026-10-13): this PR adds the generator change, a backfill flag and tests, and checks them on a few games only. A separate session runs the full 2026 re-walk later. Do not run it here.

Facts (checked on origin/main):
- aggregateGamePitchTypes (scripts/gen-pitch-arsenal.mjs:94) and foldGame (:256) fold one game into the pitch_arsenal_* tables (scripts/lib/schema.sql:430) with incrementing upserts. pitch_arsenal_ingested_games marks a game done, so a new column fills only new games.
- The feed fields: pitchData.coordinates (x0, z0, pfxX, pfxZ), pitchData.breaks (spinRate, breakVertical, breakHorizontal), pitchData.extension, pitchData.plateTime. src/api/playbyplay/pitchInfo.js:155-163 reads extension. Check each path against a live MLB and a live AAA feed; do not guess.
- No arsenal re-walk flag exists. --clear-hitters (hitter half) is the pattern.
- Budgets: gen-pitch-arsenal.mjs is 695/700 (check-file-size.mjs:239). scripts/lib/ is 43/42. Put new code in scripts/lib/pitch/. If the wiring does not fit, first move an existing pure block of gen-pitch-arsenal.mjs to scripts/lib/pitch/. Do not raise a budget.

Steps (test first: add the tests in test/pitch-arsenal.test.js, see them fail, then write the code):
1. Per type: a sum and a count for each field (a pitch with no value adds to no count). Add the columns with defaults, so the committed scripts/data/pitch-arsenal.sql still loads and the nightly job keeps working before the re-walk.
2. Export the means in pitch-arsenal/{season}/; src/api/pitchArsenal.js reads them; a missing mean is null.
3. Add a wipe-and-rebuild re-walk flag for the arsenal half, in the shape of --clear-hitters, with a --since window. Name it in the script header. Issue #1915's per-game mix will hook into the same flag.
4. Check on 3-5 games in a scratch copy. Do not commit scripts/data/*.sql or public/data/pitch-arsenal*/.

Done means: the means and the flag have tests that failed first; the committed dump loads; the files hold their budgets; npm run lint, npm test and npm run build pass.
Stop if: a field path is missing on a live AAA feed (then keep that field MLB only and say so).

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1908", the flag name and the exact re-walk command for the backfill session. No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 11 of 19 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, scripts/CLAUDE.md, src/api/CLAUDE.md and the spray notes in docs/api/. Use the branch the session gives you, cut from current origin/main. Needs on main: the "Part of #1912" PR (it added public/data/xba-table/ and the xBA lookup). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1912 (Contact), part b, the CODE only. Gary decided (2026-10-13): each ball shows real xBA from the xBA lattice. This PR adds the generator change and tests, and checks them on a few games only. A separate session runs the full 2026 rebuild later. Do not run it here.

Facts (checked on origin/main):
- scripts/gen-spray.mjs (464 lines) keeps no SQLite; the committed shards are the accumulator, with a ledger in scripts/data/spray-ingested.json. --season=2026 --rebuild sweeps the season again. It runs nightly.
- The reader is decodeSprayBalls (src/api/spray.js). spray.js is spoiler-free (decided games only, never today's).
- Today g merges games into park runs.

Steps (test first: add the tests in test/spray.test.js, see them fail, then write the code):
1. Per ball: launchAngle and totalDistance; xBA from the season's xBA table (null with no table); pitch type and speed. No play text.
2. A barrel flag, derived at read time from exit velocity and launch angle (Savant's rule; write the rule in a comment).
3. Write g as [count, venueId, gamePk] runs.
4. The reader reads old and new shards, so the site works between this PR and the rebuild. A nightly run before the rebuild may mix shapes in one shard: the reader must handle that too.
5. Check on 3-5 games in a scratch copy, and measure one shard before and after (estimate the full-season size). Do not commit public/data/spray/ or the ledger.

Done means: the new columns have tests that failed first; the reader reads old, new and mixed shards; npm run lint, npm test and npm run build pass.
Stop if: the estimated shard grows by more than 2.5 times; report the sizes.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1912", the size estimate and the exact rebuild command for the backfill session. No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 12 of 19 — Sonnet 5.5, effort xhigh

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, scripts/CLAUDE.md, src/api/CLAUDE.md and docs/adr/0021-sqlite-data-layer.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the game-log PR ("Part of #1914", "Part of #1915"). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1881 (foul balls by count) and the per-game fouls of issue #1914, in ONE PR, CODE only. Read both issues and their comments. Gary decided (2026-10-13):
- The league "most in one at-bat" figure is the median of regular hitters (300+ PA). 2026 = 6. The league record is not shown.
- This PR adds the generator change, a wipe-and-rebuild backfill flag and tests, and checks them on a few games only. A separate session runs the full 2026 re-read (2,428 games) later. Do not run it here.

Facts (checked on origin/main):
- scripts/gen-fouls.mjs is 1084/1100 (check-file-size.mjs:233). Put the new code in a new folder scripts/lib/fouls/ (scripts/lib/ is 43/42). Wire it in with few lines. Do not raise a budget.
- aggregateGameFouls (:91) reads the full feed. It carries preStrikes but not balls. A pitch event's count is the count AFTER the pitch.
- --backfill-games fills only foul_game_totals. --backfill-team-pitch-types wipes and rebuilds (:894, :976): copy that pattern.
- The batter row (:116-118) has pa, pitchesSeen, fouls, twoStrikeFouls; no whiffs. Swings use the hitter-grid rule (whiff + foul + in-play codes).
- The reader is src/api/fouls.js (spoiler-free).

Steps (test first: add the tests in test/fouls.test.js, see them fail, then write the code):
1. By count (#1881): carry preBalls beside preStrikes. Per batter, 12 cells each: PA that reach the count, fouls and swings on the pre-pitch count, and the PA end credited to every count the PA reached (hit, walk, strikeout, out in play). Sum the same cells into league.byCount. Add the league median of bestPa fouls for hitters with 300+ PA.
2. Per game (#1914): per batter and gamePk, [pitches, fouls, whiffs], in a new table, exported to the batter's shard.
3. New columns and tables have defaults, so the committed scripts/data/fouls.sql still loads and the nightly job keeps working before the re-read.
4. A reader in src/api/fouls.js for both, and a pure join helper in src/api/person/gameLog.js that adds per-game fouls to gameLogView rows. Do not edit src/api/player/stats.js; the UI issue (#1890) wires the loader.
5. Add the wipe-and-rebuild flag. Check on 3-5 games in a scratch copy. Do not commit scripts/data/fouls.sql or public/data/fouls/.

Done means: the tests failed first; gen-fouls.mjs is at or under 1100 lines; the committed dump loads; npm run lint, npm test and npm run build pass.
Stop if: the feed's ball count does not match a carried preBalls on a sampled game.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1881", "Part of #1914", the flag name and the exact re-read command for the backfill session. No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 13 of 19 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, src/api/CLAUDE.md and src/api/boxlines/CLAUDE.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1909 PR, the game-log PR (Part of #1914/#1915) and the vs-team PR (Part of #1910). If one is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1910 (Splits), part a. Gary decided (2026-10-13): a pitcher's "All batters" row is vs L + vs R, which is overallSide([vl, vr]) today (src/api/person/stats.js:223). Do not change it.

Facts (checked on origin/main; the issue names the wrong file for the doors):
- loadPlayerStats (src/api/player/stats.js) asks statSplits for the current season only (:86, :93, :99-100).
- fetchCareerSplits, mergeCareerSplits, FIELDS, doorCells and DOOR_COLUMNS are all in src/api/boxlines/careerSplits.js (:282, :86, :49, :146, :162). FIELDS already asks for strikeOuts, baseOnBalls, homeRuns and plateAppearances.
- splitsView is person/stats.js:257; SITUATIONAL_SIT_CODES is :305. The sit code is 2s, not s2.

Steps (test first for each: add the test, see it fail, then write the code):
1. Season picker: a loader that takes a season and gives the same vl,vr and situational splits for it.
2. Career: fetchCareerSplits with vl,vr + SITUATIONAL_SIT_CODES, fed to splitsView unchanged.
3. Scope All: mergeCareerSplits also gives OBP, SLG, SO, BB, HR and PA per sit code.
4. A pure helper beside splitsView: OPS delta against the baseline row, best and weak flags, thin under 100 PA, and a one-line read per row. Round K% and BB% half up (Gasser's two .5 rows read 13%, not 12%).
5. Doors: add OBP, SLG, K% and BB%. The live Game lines card draws five columns; keep its output the same (a second export or an option).

Check live: Brice Turang 668930, Robert Gasser 688107 (463 BF in the baseline). The player page is an open surface (ADR-0034).
Done means: the five changes have tests that failed first; the current Splits and Game lines cards render the same (render /player/robert-gasser-688107/stats?nointro in Chromium and send Gary a screenshot); npm run lint, npm test and npm run build pass.
Stop if: a career statSplits call rejects one of the sit codes.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Closes #1910". Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```


## Prompt 14 of 19 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, scripts/CLAUDE.md, src/api/CLAUDE.md and docs/adr/0096-the-hitter-grid-keys-on-pitcher-hand-and-stance.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the "Part of #1908" part b PR and the "Part of #1915" part b PR (both change the same sweep and schema). If one is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1911 (Plate approach), CODE only. Gary decided (2026-10-13): a foul tip is a whiff, the Savant rule. This PR adds the generator change and tests, and checks them on a few games only. A separate session runs the full 2026 hitter re-walk later. Do not run it here.

Facts (checked on origin/main):
- The hitter grid is scripts/lib/pitch/hitter-grid.mjs (184 lines), called by gen-pitch-arsenal.mjs (:48). Its counters are FIELDS in src/api/scout/hitterGrid.js:48; the column names come from FIELDS.
- aggregateGameHitters counts a whiff with the shared WHIFF_CODES (:71). Add code T to the whiff count IN hitter-grid.mjs ONLY. Do not change WHIFF_CODES (src/api/playbyplay/pitchInfo.js); derive.js and the command grid share it. The Scout reads the same grid, so it changes too.
- The re-walk exists: node scripts/gen-pitch-arsenal.mjs --clear-hitters=2026 --since=2026-03-20.
- Draw columns through viewCol, never by stored index (ADR-0096).

Steps (test first: add the tests in test/hitter-grid.test.js, see them fail, then write the code):
1. Count T as a whiff (and as a swing).
2. Add calledStrikes, inPlay and speedSum (start speed) to the per-cell counters and FIELDS, with schema columns that have defaults, so the committed scripts/data/pitch-arsenal.sql still loads. The in-zone count is the middle nine cells (inZone, src/lib/zone/zoneGeometry.js) at read time; it needs no counter.
3. A reader of an old shard (no new counters) gives null for them, not 0.
4. Check on 3-5 games in a scratch copy. Do not commit scripts/data/*.sql or public/data/hitter-grid/.

Done means: the counters and the foul-tip rule have tests that failed first; the committed dump loads; gen-pitch-arsenal.mjs holds its budget; npm run lint, npm test and npm run build pass.
Stop if: the foul-tip code on a live feed is not T; report the codes you see.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1911" and the re-walk command for the backfill session. No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 15 of 19 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md, scripts/CLAUDE.md, src/api/CLAUDE.md and docs/adr/0086-a-season-store-keeps-every-season.md. Use the branch the session gives you, cut from current origin/main. Needs on main: the #1908 part b code PR (it added the arsenal re-walk flag). If it is not merged, stop and report. List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits a file below, stop and report.

Task: issue #1915, the per-start pitch mix { gamePk: { code: n } } for each pitcher, CODE only. The score and the series tag landed already ("Part of #1915" game-log PR). The start detail view is #1851 (UI); it is not here. Gary decided (2026-10-13): this PR adds the generator change and tests, and checks them on a few games only. A separate session runs the full 2026 re-walk later. Do not run it here.

Facts (checked on origin/main):
- The arsenal store is season-level only (foldGame, scripts/gen-pitch-arsenal.mjs:256). A per-game mix needs a new table and a new shard set.
- Budgets: gen-pitch-arsenal.mjs is at or near 700 lines (check-file-size.mjs:239). Put new code in scripts/lib/pitch/. Do not raise a budget.

Steps (test first: add the tests in test/pitch-arsenal.test.js, see them fail, then write the code):
1. A table for (pitcher, gamePk, code, n), filled by the sweep, and an export sharded like pitch-arsenal/{season}/{NN}.json. Write it compact.
2. The #1908 re-walk flag must also wipe and rebuild this table, so one re-walk fills both.
3. A reader in src/api/pitchArsenal.js (433 lines): one pitcher's mix for one gamePk, or null.
4. Check on 3-5 games in a scratch copy, including Gasser 688107's start of 2026-05-23 vs LAD. Estimate the full-season shard size. Do not commit scripts/data/*.sql or the shards.

Done means: the mix has tests that failed first; the committed dump loads; the estimated shard is under 100 KB (else report it); npm run lint, npm test and npm run build pass.
Stop if: the estimated shard is over 250 KB; report the size and a smaller shape.

Handoff: open a draft PR. Body in ASD-STE100 style, with "Part of #1915" and the re-walk command for the backfill session. No screen changes, so send no screenshot; say so in the PR. Remove `wip` when CI is green. Never merge.

Last step: run the ponytail-review skill on the diff, apply the cuts it lists, then run /code-review. Run the checks again and push.
```

## Prompt 16 of 19 — Haiku 5.5, effort low

```
Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md and scripts/CLAUDE.md. Use the branch the session gives you, cut from current origin/main.

Task: a DATA-ONLY backfill: the full 2026 re-read of the foul store, for issues #1881 and #1914. Do not edit any code, test or doc.

Before you start:
- The code PR ("Part of #1881", "Part of #1914") must be merged on main. Its PR body names the flag and the command. If it is not merged, stop and report.
- Run this right before /stack-prs, and not between 07:30 and 10:00 UTC: the nightly job (08:17 UTC) rewrites scripts/data/fouls.sql. If the time is in that window, stop and report.
- List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits scripts/data/fouls.sql or public/data/fouls/, stop and report.

Steps:
1. Run the command from the code PR body (the 2026 wipe-and-rebuild, about 2,428 games, a few minutes).
2. Check Brice Turang 668930 (shard 30): 573 regular-season fouls and a best at-bat of 6. Check the league median best at-bat (300+ PA) is 6. Put the numbers in the PR.
3. Run npm run lint, npm test and npm run build.
4. Commit only scripts/data/fouls.sql and public/data/fouls/.

Stop if: the run fails, or a check number is wrong. Report the error or the number. Do not fix code.

Handoff: open a draft PR. Body in ASD-STE100 style: the command, the run time, the checks, and "Closes #1881" and "Closes #1914". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

## Prompt 17 of 19 — Haiku 5.5, effort low

```
Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md and scripts/CLAUDE.md. Use the branch the session gives you, cut from current origin/main.

Task: a DATA-ONLY backfill: the full 2026 re-walk of the pitch arsenal half (MLB and AAA), for issues #1908 and #1915. Do not edit any code, test or doc.

Before you start:
- Both code PRs must be merged on main: #1908 part b (it added the arsenal re-walk flag) and #1915 part b (the per-start mix, filled by the same flag). Their PR bodies name the command. If one is not merged, stop and report.
- Run this right before /stack-prs, and not between 07:30 and 10:00 UTC: the nightly job (08:17 UTC) rewrites scripts/data/pitch-arsenal.sql. If the time is in that window, stop and report.
- List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits scripts/data/pitch-arsenal.sql or public/data/pitch-arsenal*/ or public/data/pitch-command/, stop and report.

Steps:
1. Run the re-walk command from the PR bodies for 2026 (--since=2026-03-20). It checkpoints every 100 games; if it stops, run it again to resume.
2. Check Robert Gasser 688107 (shard 07): FF usage 23.4 in the store; per-type spin and flight time are not null; his 2026-05-23 start vs LAD has a per-game mix. Put the numbers in the PR.
3. Run npm run lint, npm test and npm run build.
4. Commit only scripts/data/pitch-arsenal.sql and the public/data/ folders the generator wrote.

Stop if: the run fails twice, or a check is wrong. Report the error or the number. Do not fix code.

Handoff: open a draft PR. Body in ASD-STE100 style: the command, the run time, the checks, and "Closes #1908" and "Closes #1915". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

## Prompt 18 of 19 — Haiku 5.5, effort low

```
Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md and scripts/CLAUDE.md. Use the branch the session gives you, cut from current origin/main.

Task: a DATA-ONLY backfill: the full 2026 hitter-grid re-walk, for issue #1911. Do not edit any code, test or doc.

Before you start:
- The #1911 code PR ("Part of #1911") and the pitch-arsenal backfill PR ("Closes #1908", "Closes #1915") must be merged on main. If one is not merged, stop and report.
- Run this right before /stack-prs, and not between 07:30 and 10:00 UTC: the nightly job (08:17 UTC) rewrites scripts/data/pitch-arsenal.sql. If the time is in that window, stop and report.
- List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits scripts/data/pitch-arsenal.sql or public/data/hitter-grid/, stop and report.

Steps:
1. Run: node scripts/gen-pitch-arsenal.mjs --clear-hitters=2026 --since=2026-03-20
2. Run: node scripts/gen-xwoba-table.mjs --gate --season=2026. It must pass.
3. Check Brice Turang 668930 (shard 30): 1,247 swings and 288 whiffs (23.1%). Put the numbers in the PR.
4. Run npm run lint, npm test and npm run build.
5. Commit only scripts/data/pitch-arsenal.sql and public/data/hitter-grid/.

Stop if: the run fails twice, the gate fails, or the whiff count is not 288. Report it. Do not fix code.

Handoff: open a draft PR. Body in ASD-STE100 style: the commands, the run time, the checks, and "Closes #1911". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```

## Prompt 19 of 19 — Haiku 5.5, effort low

```
Repo: /home/user/bbsbh (Tally Baseball). Read CLAUDE.md and scripts/CLAUDE.md. Use the branch the session gives you, cut from current origin/main.

Task: a DATA-ONLY backfill: the full 2026 spray rebuild (MLB and AAA), for issue #1912. Do not edit any code, test or doc.

Before you start:
- The #1912 part b code PR ("Part of #1912", the spray columns) must be merged on main. Its body names the command. If it is not merged, stop and report.
- Run this right before /stack-prs, and not between 07:30 and 10:00 UTC: the nightly job (08:17 UTC) rewrites public/data/spray/. If the time is in that window, stop and report.
- List the open PRs and their files with the GitHub MCP tools (owner gzilavyss2025, repo bbsbh). If an open PR edits public/data/spray/ or scripts/data/spray-ingested.json, stop and report.

Steps:
1. Run: node scripts/gen-spray.mjs --season=2026 --rebuild (or the command in the code PR body, if it differs).
2. Check Brice Turang 668930 (shard 30): his 2026-09-23 home run (108.4 mph, 22 degrees) has an xBA of about .911, a launch angle and a distance. Compare the shard size with the code PR's estimate. Put the numbers in the PR.
3. Run npm run lint, npm test and npm run build.
4. Commit only public/data/spray/ and scripts/data/spray-ingested.json.

Stop if: the run fails twice, a check is wrong, or a shard is more than 2.5 times its old size. Report it. Do not fix code.

Handoff: open a draft PR. Body in ASD-STE100 style: the command, the run time, the checks, and "Closes #1912". Remove `wip` when CI is green. Never merge.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.
```
