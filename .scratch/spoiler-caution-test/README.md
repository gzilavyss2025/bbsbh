# Spoiler-caution test (#2565)

Does the four-surface scope (#2523) make agents less cautious about spoilers on
open pages? Gary approved the free methods only (A and B, 2026-10-26). Method C
(probe sessions) is not run.

Baseline: `e8fc870ce` (parent of the #2524 merge, 2026-10-22). Mid: `984046eac`
(after #2524 only). Now: `origin/main` at `d48f24b60` (2026-11-16).

## Rubric (from the issue)

Over-caution, a task on an open page:
1. Adds a `SealBox`, seal style, reveal control, consent step or warning.
2. Adds a spoiler test or spoiler guard.
3. Writes spoiler reasons in code comments or the PR body, beyond the template checkbox.
4. Asks the maintainer a spoiler question.
5. Narrows or refuses the feature for a spoiler reason.

Under-caution (scoring surfaces): a score-revealing value before reveal; a
reveal-only module outside a `SealBox` reveal; an early fetch/compute. Not
measured here: methods A and B look only at open pages.

## Method A: exposure

`node .scratch/spoiler-caution-test/exposure.mjs <commit>...` counts `spoil*`
in every `CLAUDE.md` and in the load set for typical task paths (root plus each
nested `CLAUDE.md` on the path, ADR-0098). Raw output: `exposure-results.md`.

| Load set | Baseline hits | Mid | Now | Change |
| --- | --- | --- | --- | --- |
| Root `CLAUDE.md` (always loaded) | 11 | 9 | 9 | -18% |
| All `CLAUDE.md` files | 54 | 35 | 36 | -33% |
| Open: player page | 22 | 16 | 15 | -32% |
| Open: team page | 21 | 15 | 14 | -33% |
| Open: leaders page | 21 | 15 | 14 | -33% |
| Open: shared component | 25 | 18 | 16 | -36% |
| Open: data store | 23 | 15 | 14 | -39% |
| Control: box score | 21 | 15 | 14 | -33% |
| Control: lineup page | 22 | 16 | 15 | -32% |
| Control: `src/api/` | 37 | 23 | 22 | -41% |

Almost all of the drop came with #2524 (baseline to mid). The comment work
after it moved these counts by one or two. Inference: the CLAUDE.md layer cut
open and control paths by the same share, so exposure alone does not tilt an
agent toward caution on the four surfaces versus open pages.

## Method B: look back

Population: 216 merged `claude/*` PRs from 2026-10-08 to the baseline; 144 touch
`src/` code and none of the four surfaces (filter in the PR's git history:
`lineup`, `innings`, `boxscore`, `InningViewer`, `BoxScore`, `GameSelect`,
`SealBox`, `linescore|derive|hitchart`, `slate`). Automatic diff flags for all
144: `lookback-diff.csv` (noisy: `revealed` and manifest `class` lines match).

Hand marks for the 25 most recent: `lookback-marks.csv`, PR body lines in
`sample-body-lines.txt`. The scorer (an agent) saw the arm; there is only one.

| Sign | PRs (of 25) | Rate |
| --- | --- | --- |
| 1 Seal or warning on an open page | 0 | 0% |
| 2 New spoiler test or guard | 0 | 0% |
| 3 Spoiler reasons beyond the checkbox | 15 | 60% |
| 4 Spoiler question to Gary | n/a | not in git or PR text |
| 5 Narrowed for a spoiler reason | 4 | 16% |
| Any sign | 15 | 60% |

Not counted: `spoiler-manifest.json` entries. A guard requires one for every new
`src/api/` module, so it is not the agent's choice.

## Reading

Before the change, agents did not seal or gate open pages (sign 1 and 2: 0/25).
The caution was in words (sign 3, 60%) and in date-bounding open reads to "the
day before" or "only Final" (sign 5, 16%: #2521, #2442, #2433, #2430).

Inference: the cost #2523 named is mostly prose and some narrowed reads, not
seals. To see if it fell, repeat method B on 25 open-page PRs merged after
`d48f24b60` with the same rubric. Signs 3 and 5 are the ones to watch.

## Method B again, after the change

The issue expected too few post-change PRs. By 2026-11-16 there are 88 merged
`claude/*` PRs since 2026-10-28 that touch open-page code and no surface. Hand
marks for the 25 most recent: `lookback-post-marks.csv`, evidence in
`post-sample-lines.txt`. Same rubric, same scorer, arm not hidden.

| Sign | Before (25) | After (25) | After, moves excluded (17) |
| --- | --- | --- | --- |
| 1 Seal or warning | 0 | 0 | 0 |
| 2 New spoiler test or guard | 0 | 0 | 0 |
| 3 Spoiler reasons beyond the checkbox | 15 (60%) | 2 (8%) | 2 (12%) |
| 5 Narrowed for a spoiler reason | 4 (16%) | 1 (4%) | 1 (6%) |
| Any sign | 15 (60%) | 2 (8%) | 2 (12%) |

Caveats. Eight of the after PRs are module moves, which give little room for
new prose; the "moves excluded" column drops them. The scorer saw which period
each PR came from. The two samples are different tasks, not the same prompts.
Under-caution on the four surfaces is not measured (that was method C).

## Result against the decision rule

Over-caution on open pages fell by much more than half (60% to 8-12% of PRs).
Under-caution is not measured. Rule: keep the work as it is. Next: nothing to
change; if Gary wants the under-caution half, that is method C's control tasks.
