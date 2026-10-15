# Second pass, Job C: docs — 2026-10-15

Report for issue #1837, "Job C: docs". It reads only. It changes no ADR,
no doc and no guard. It never proposes to delete an ADR. A superseded ADR gets
a status line at the top that links to its replacement. That is an edit.

Tags: **measured** means a command or a script checked it. **inferred** means
a person read it and judged it.

Scratch scripts (not in the repo):
`/tmp/claude-0/-home-user-bbsbh/f70cfe12-b717-5a73-844d-d9faceaf853c/scratchpad/`
(`paths.mjs`, `links.mjs`, `sim.mjs`, `true_missing.tsv`, `shorthand.tsv`).

## Counts

| What | Count | Command |
| --- | --- | --- |
| ADR files | 111 | `ls docs/adr \| wc -l` |
| ADR files with "superseded" | 14 | `grep -il superseded docs/adr/*.md \| wc -l` |
| ADR files with "supersed" (any form) | 17 | `grep -il supersed docs/adr/*.md \| wc -l` |
| Docs under `docs/` (not `adr/`), all types | 84 | `find docs -type f -not -path 'docs/adr/*' \| wc -l` |
| Of those, `.md` | 84 | same, with `-name '*.md'` |
| Backticked repo paths in those docs | 2,027 | `scratchpad/paths.mjs` |
| Paths that do not exist as written | 85 (70 unique) | same |
| Of those: short form that resolves (`lib/x.js` for `src/lib/x.js`) | 49 | same |
| Of those: truly missing | 36 (20 outside `docs/audits/`) | same |
| `scripts/*.mjs` names in docs that are gone | 0 | loop over `docs`, test `scripts/$s` |
| `scripts/*.mjs` files that no doc names | 6 | loop over `scripts/*.mjs` |
| Doc lines that name a deleted screen or loader | 50 in 16 files | `grep -rnE 'TeamInfo\|PlayerPage\|loadPlayer'` |
| Broken markdown links, ADR refs to missing numbers | 0, 0 | `scratchpad/links.mjs` |
| `npm run lint` | passes, 33 steps | `npm run lint` |

## Q1. The 17 ADRs that say "supersed"

The task listed 14. The real list from `grep -il superseded` is the same 14
(0011, 0022, 0026, 0027, 0030, 0034, 0035, 0043, 0044, 0046, 0061, 0082, 0093,
0100). Three more files use the stem only: 0062, 0099, 0109. All 17 were read.
**measured** (grep) and **inferred** (the status call on each).

| ADR | Line | Really superseded? | By | Top status line? | Link? |
| --- | --- | --- | --- | --- | --- |
| 0027 | 3 | **Yes, whole** | 0026 | Yes (`> SUPERSEDED by ADR-0026`) | No link, plain text |
| 0061 | 3 | Yes, in part (wide-layout half) | 0062 | Yes | Yes |
| 0035 | 3 | Yes, in part (the reveal gate, 2026-08-06) | its own "Second amendment" (line 233) | Yes | No link, internal anchor only |
| 0030 | 77 | Yes, in part (the "line is at the page" paragraph) | its own section "The line moved" | No, banner sits mid-file | n/a, same file |
| 0046 | 81 | Yes, in part (section 2 timings) | its own 2026-08-13 amendment | No, banner sits at section 2 | n/a, same file |
| 0043 | 384 | One amendment is superseded, not the ADR | its own later amendment | Status says `accepted`; fine | n/a |
| 0093 | 45, 59 | Yes, in part (decision 5) | 0099 | **No**: top says `Accepted` only | **No** |
| 0100 | 78 | Yes, in part (birthplaces) | 0106 | **No**: top says `Accepted` only | **No** |
| 0034 | 4, 64 | **No, not yet** | 0082 would | Banner says "Draft ADR-0082 would supersede" | No link |
| 0082 | 11 | It is the draft replacement | supersedes 0034 | `DRAFT`, `Supersedes:` line | Plain text |
| 0011 | 5 | **No.** Status is REMOVED. The text says "not superseded by another mechanism" | none | Yes (`REMOVED`) | n/a |
| 0022 | 117 | **No.** Only names 0027 as superseded | n/a | n/a | n/a |
| 0026 | 8 | **No.** Only names 0027 as superseded | n/a | n/a | n/a |
| 0044 | 82 | **No.** The word means a replaced blob object | n/a | n/a | n/a |
| 0062 | 5 | It is the replacement for 0061 (in part) | n/a | `Supersedes in part:` with link | Yes |
| 0099 | 3 | It is the replacement for 0093 decision 5 | n/a | Yes | No link |
| 0109 | 4 | It amends draft 0082 | n/a | `Amends:` line | No link |

**Count:** 1 whole ADR is superseded (0027). 6 are superseded in part
(0030, 0035, 0046, 0061, 0093, 0100). 1 has a superseded amendment (0043).
5 only mention the word (0011, 0022, 0026, 0044, plus 0034 for now).
**inferred**.

### Findings, ranked

1. **0093 and 0100 hide a partial supersession.** Top line is `Accepted`.
   A reader who stops at the top will follow decision 5 of 0093 and the
   birthplace key of 0100. Both are replaced. **measured** (lines 45, 59, 78).
   - `docs/adr/0093-...md:3`: change to
     `**Status:** Accepted. Decision 5 superseded by [ADR-0099](0099-the-matchup-scout-scene-plays-in-both-views-from-a-second-camera.md).`
   - `docs/adr/0100-...md:3`: change to
     `**Status:** Accepted. The birthplace files superseded by [ADR-0106](0106-born-near-the-park-is-fifty-miles-by-map-distance.md).`
2. **0106 does not say it supersedes part of 0100.** 0099 says it for 0093.
   0106 only says "builds on". `docs/adr/0106-...md:5`: add a line
   `**Supersedes in part:** [ADR-0100](0100-retrosheet-and-chadwick-are-build-time-sources-run-by-hand.md), the birthplace files.`
   **measured**.
3. **0030, 0035, 0046 put the status at a section, not at the top.** Add one
   line under the title that points down. Example for 0046 (line 1-3):
   `> Superseded in part: section 2 (timings). See the 2026-08-13 amendment at the foot of this file.`
   0035 line 3 already says it, but with no anchor. Add the heading anchor.
   **measured**.
4. **0027 names 0026 without a link.** `docs/adr/0027-...md:3`: link
   `[ADR-0026](0026-scores-unlocked-ephemeral-override.md)`. Also link 0027 in
   0022:117 and 0026:8. **measured**.
5. **0034 and 0082: leave both alone today.** 0034 is still the true page
   (six tabs ship: `src/screens/team/TeamTabBar.jsx` exists, and
   `src/screens/team/CLAUDE.md` says "six tabs, each a real route"). 0082 is
   a draft until #1107 ships. When #1107 lands, add the top line to 0034 and
   flip 0082 to Accepted. **measured** (file check), **inferred** (the timing).
   Note: 0034 line 4 already says "would supersede", which is correct now.
6. **0011 is correct.** `REMOVED` is the right status. Do not re-label it
   "superseded". **inferred**.

No ADR needs deleting. No lint guard reads ADR status. `check-adr-numbers`
checks only that numbers are unique. **measured**.

## Q2. Docs that describe code that no longer exists

Method: `scratchpad/paths.mjs` pulls every backticked token that starts with
`src/ scripts/ api/ public/ test/ e2e/ docs/ .github/ .claude/ lib/` from
84 docs, removes `:line` suffixes, and tests `fs.existsSync`. A second pass
tries `src/` and `scripts/` prefixes for short forms. Result: 36 truly missing.
**measured**.

### Dead references (ranked by how much a reader loses)

1. **`docs/enhancement-proposals.md`** — the worst file. 16 lines name
   `TeamInfo.jsx`, `PlayerPage.jsx`, `src/api/loadPlayer.js`,
   `src/api/vsPitcher.js`. None exist. The lineup page is now
   `src/screens/lineup/next/`; the player page is `src/screens/player/next/`.
   Lines 33, 57, 68, 75, 175, 209, 245, 270, 288, 299, 316, 321, 364, 375,
   383, 397. Also `public/data/umpires.json` (line 189) and
   `public/data/umpire-accuracy.json` (line 174): both are now directories
   (`public/data/umpires/`, `public/data/umpire-accuracy/`, 870 umpire files
   under `public/data/`). The file is a dated proposal (written 2026-07-11).
   Edit: add a status line at the top, "Historical. Paths below name code
   deleted in #1898 and the lineup swap." Do not rewrite the body.
   **measured** for the paths, **inferred** for the fix.
2. **`docs/api/static-data.md`** lines 78, 140, 229, 383 cite `loadPlayer.js`;
   lines 165, 213, 494 cite `TeamInfo.jsx`. This is a catalog that agents read
   to find the reader of a data file. Replace with the module that now reads
   it: `src/api/player/context.js`, `core.js`, `overview.js` (player) and
   `src/screens/lineup/next/` (lineup). **measured**.
3. **`docs/player-redesign-data.md`** lines 78, 90, 103 cite
   `src/api/player/stats.js`, which is gone. `ls src/api/player` shows
   `context.js core.js history.js overview.js` and six more. `yearByYear` is
   now `yearByYearFor` in `src/api/player/context.js:220`, and
   `yearByYearCells` in `src/api/person/careerRegister.js:28`. Line 103 also
   names `loadPlayerStats`. **measured**.
4. **`docs/design-system-naming.md`** lines 95, 96, 113, 276 list
   `screens/TeamInfo.jsx` as a file that uses a renamed class. It is a rename
   ledger, so old paths are partly history. Line 282 cites `lib/clerkAppearance.js`
   and line 300 `api/boxlines/cardFacets.js`; both resolve only by short form
   and need a check. **measured** (TeamInfo), **inferred** (the ledger intent).
5. **`docs/milb-historical-logos.md:86, 90`** cites `src/api/loadPlayer.js`
   for the `historicalParentOrg` call. The call now lives in
   `src/api/careerTimeline.js:79, 114`. **measured**.
6. **`docs/duplicate-derivations.md:60`** (row A4) cites
   `src/api/player/analytics.js`. It does not exist. The comment in
   `src/api/prospectTrend.js:281` has the same dead path. The current callers
   are `overview.js` and the other `src/api/player/` files. **measured**.
7. **`docs/lineup-redesign.md:5, 48`** says `TeamInfo.jsx` "is deleted". That
   is correct history. **Keep.** Likewise `docs/api-audit.md:131, 357`
   (`api/og.js` "was deleted") are correct history. **inferred**.
8. **`docs/api-audit.md:401, 411`** cite `src/api/schedule.js:192,229` and
   `src/api/person-fetch.js:262-321,435`. Both files exist. The comma range
   breaks the path test, so this is a false hit. The line numbers will have
   drifted. **inferred**.
9. **`docs/team-success-exit-reason-mix.md:94`** cites
   `docs/blockage-exit-reason-join.md`. The file does not exist. The nearest
   file is `docs/price-the-blockage.md`. Fix the name or drop the pointer.
   **measured**.
10. **`docs/scripts/generators.md:2022`** says `public/og-image.jpg`. The
    file is `public/og-image.png`. `scripts/gen-og-image.mjs` exists, so the
    "NOT currently used" note still holds. **measured**.
11. **`docs/ballpark-stamp-prompt.md:13`** says to add art in
    `public/ballparks/stamp/`. `ls public/ballparks` shows only `thumb/` and
    the `.jpg` files. Line 31 names `ballparkStampArt()`, which the file says
    was deleted as dead code; `src/lib/ballpark/stampPrint.js` is the
    nearest. The doc is a prompt for a future job, so say that the folder is
    to be created. **measured**.
12. **Stale `lib/` short forms (49).** Docs write `lib/postseason/...`,
    `lib/ovr/card.js`, `api/workload.js`, `lib/zone/zoneGeometry.js`. They
    resolve under `src/`, but the form is ambiguous: `lib/` could be
    `src/lib/` or `scripts/lib/`. Seen in `docs/components.md`
    (lines 7-51), `docs/motion.md` (110-115), `docs/print-sheet.md`
    (47-58), `docs/api/postseason.md` (388-394), `docs/api/account-layer.md`
    (105, 107), `docs/scripts/generators.md` (204-1563). Not wrong; costs a
    reader one search. **measured** (resolves), **inferred** (the cost).
13. **Function names (55 checked).** `grep -w` in all tracked code finds 5
    unknown: `ballparkStampArt()` (deleted, doc says so), `buildCohort()`
    (`docs/prospect-ranking-value.md:78`, a `.scratch` script),
    `draftTier()` (`docs/prospect-traits.md:48`, a `.scratch` script),
    `firstProOrg()` (`docs/homegrown-dependence.md:520`, a `.scratch`
    script), `statcast_search_minors()` (an outside Python library in
    `docs/peer-sites.md:64`). Only the first is wrong, and it is labelled.
    **measured**.
14. **`.scratch/` risk.** 53 docs cite `.scratch/`; 233 unique `.scratch/...`
    paths. Issue #1304 plans to delete about 110k lines there. After that
    cut, these 233 paths will break. No guard checks them. **measured**
    (count), **inferred** (risk).

### Catalogs that list gone items

- **Scripts catalog:** `docs/scripts/generators.md` and the other docs name 140
  `*.mjs` scripts. Every one exists. **measured**.
- **Scripts the docs do not name** (6 of 129 in `scripts/`):
  `check-component-reuse.mjs`, `check-slate-final.mjs`,
  `check-sw-learn-fallback.mjs`, `gen-contracts-season-players.mjs`,
  `gen-nine-keys.mjs`, `gen-prospect-trend-backfill.mjs`. The `check-*` guards
  may be named only in `scripts/CLAUDE.md`.
  Proposed edit: add one line each for the three `gen-*` files to
  `docs/scripts/generators.md`. **measured**.
- **Routes:** every `/api/...` function named in docs exists in `api/`
  (14 files). **measured**. The doc/code route table for the app (React
  routes) was not extracted. **inferred** gap.
- **`npm run` names in docs:** all exist in `package.json`. **measured**
  (the check printed no misses).

### What `npm run lint` catches and what it misses

`npm run lint` runs `scripts/check-all.mjs`: 33 steps, all pass today
(**measured**). The steps that touch docs:

| Guard | What it checks in docs |
| --- | --- |
| `check-claude-md`, `check-claude-md-facts` | Root and nested `CLAUDE.md`: size caps, listed paths, counts |
| `check-adr-numbers` | ADR numbers are unique |
| `check-word-choice`, `check-typography`, `check-name-casing`, `check-diary-voice`, `check-line-endings` | Wording and form in `docs/` |
| `check-caps`, `check-dir-size`, `check-file-size` | File counts and sizes |

It **misses** (all **measured** above, so the guard gap is real):

1. Paths in backticks inside `docs/*.md`. 36 dead today. `check-claude-md-facts`
   checks only `CLAUDE.md`, by its own header.
2. Dead `.scratch/` paths (233).
3. ADR status: a partial supersession with no top line (0093, 0100) and a
   missing back-link (0106 to 0100).
4. A doc for a deleted screen. `docs/enhancement-proposals.md` has no status.
5. Markdown links. Only 9 exist, none broken, so this gap costs nothing now.

Proposed guard (a note for Gary; this job does not touch guards): extend
`check-claude-md-facts` or add `check-doc-paths`. Scan backticked tokens that
start with `src/`, `scripts/`, `api/`, `public/`; fail on a miss; keep an
allow-list for `docs/audits/` and for the "was deleted" lines. **inferred**.

## Q3. The 12 "Duplicate" formulas in `docs/duplicate-derivations.md`

The summary table (lines 19-30) says 12 Duplicates. The list (lines 83-98)
has 11 rows: U1-U4 and U6-U12. **U5 is missing.** **measured**. Either the
count is 11 or a row was lost. Fix the count or restore U5.

Status checked against code on this branch. **measured** unless marked.

| # | Quantity | Status | Evidence |
| --- | --- | --- | --- |
| U1 | Innings to outs | **Mostly fixed.** One home at `src/lib/math/innings.js:7,13`. `gen-vs-team-splits.mjs:46` imports it. `gen-workload.mjs` has no `ipToOuts` now. Still copies: `scripts/lib/pitcher-starts.mjs:28` (inline split), `inningsFromOuts` in `scripts/lib/abs/exposure.mjs:50` (strict, kept on purpose) | The doc names `gen-workload.mjs` and `gen-vs-team-splits.mjs` as copies; both are fixed. Update the row. |
| U2 | Is a play a PA | **Still duplicated.** `isPlateAppearance` is in `scripts/lib/long-at-bats.mjs:57`, not in `src/api/playbyplay/eventTypes.js`. 11 `src/` files use `NON_PA_EVENT_TYPES` | Doc proposal not done |
| U3 | Missed call | **Still duplicated.** `isMissedCall` (`derive.js:48`), `missEdge` (`umpireFavor.js:71`), `missRegion` (`gen-umpire-accuracy.mjs:152`). `src/lib/zone/` has `regions.js`, `zoneGeometry.js`, no pure per-pitch helper | Not done |
| U4 | Base-out state | **Still duplicated.** `src/lib/runExpectancy.js` has `stateAfterBall`, `stateAfterStrike`, `advanceOnWalk`, but no play-by-play step function. `umpireFavor.js:21` imports the pitch-level pair | Partly shared at pitch level; the play-level step is not |
| U6 | Quality start | **Still duplicated.** `scripts/lib/team-records.mjs:242` `isQualityStart`; `src/api/person/gameLog.js:108-109` inline `ipToOuts(...) >= 18 && earnedRuns <= 3` | Not done |
| U7 | Level tenure | **Still duplicated.** `.scratch/level-benchmarks/analyze.mjs` and `scripts/gen-level-tenure-benchmark.mjs:128` both exist | Not done. Resolves itself if #1304 deletes the spike |
| U8 | Team Score at a cutoff | **Still duplicated, by design.** `scripts/gen-postseason-odds.mjs:203` `teamScoreSnapshot` | Not done |
| U9 | League ABS rate | **Still duplicated.** `leagueBaseline` (`absExposure.js:140`) and `clubRate` (`absExposure.js:304`) | Not done |
| U10 | Player ABS rate | **Still duplicated.** `exposureRates` (`scripts/lib/abs/exposure.mjs:215`) and `clubChallengeBoard` | Not done |
| U11 | Median, quantile | **Worse than the row says.** `grep -rnE 'function (median\|quantile\|percentile)'` finds 11 homes in `src/` and `scripts/`, including `StrikeZone.jsx:42`, `pitcherCard/atBat.js:23`, `pfoulsView.js:13`. The row lists 8 | Row is out of date; the row itself says "low value" |
| U12 | Season in play | **Mostly fixed.** 11 generators use `fetchSeasonInPlay`, not the 9 listed. New: `gen-league-averages.mjs`, `gen-notable.mjs` | Update the list from 9 to 11 |

Count: **fixed 0 of 11 in full. Mostly fixed 2 (U1, U12). Still duplicated 9.**
**measured**. The doc itself says it changes no code, so that matches.

Proposed edits to `docs/duplicate-derivations.md`:
- Line 24-30 summary: change "12" to "11", or restore U5.
- Row U1: drop `gen-workload.mjs` and `gen-vs-team-splits.mjs` from "Copies
  left". Add "fixed" note.
- Row U12: change "9 nightly generators" to 11 and add the two names.
- Row U11: add `StrikeZone.jsx`, `atBat.js`, `pfoulsView.js` to the homes list.
- Row A4 (line 60): fix the dead `src/api/player/analytics.js` path.
- Add a line at the top: "Status checked 2026-10-15 against `main`."

### Near-duplicate docs

Method: `scratchpad/sim.mjs`, 6-word shingle overlap between all 84 docs.
**measured**. No pair shares more than 14% of its shingles. The only pair
above 5% is `docs/agents/contender-diary.md` with
`docs/agents/research-diary.md` (0.14, 167 shared shingles), and these are
two logs with the same template. So there is no copy-paste duplication.
Overlap by topic is real (**inferred**):

1. `docs/season-grade.md` (59 lines) and `docs/season-score.md` (125 lines).
   One verdict, one of its two drivers. They cross-link. Keep both. Add one
   line at the top of each saying which one holds the formula.
2. `docs/player-hub.md` (52), `docs/player-redesign.md` (137),
   `docs/player-redesign-data.md` (323), and `src/screens/player/next/CLAUDE.md`.
   Four places describe the new player page. `player-hub.md` lines 3-8 point to
   the other two, so this is a deliberate split. Risk: the status lines. The
   plan says "phase 6 done"; the data audit says "audit done"; both are
   dated 2026-10-14.
3. `docs/MLB_STATS_API.md` (338), `docs/data-enrichment.md` (86),
   `docs/api-audit.md` (535). All three list endpoints. `api-audit.md` says
   it measures against `MLB_STATS_API.md`. `data-enrichment.md` is a July
   note "verified 2026-07-07". Propose: add "Verified 2026-07-07, not
   re-checked" to its first line.
4. `docs/team-success-roster-age.md` with `-deadline-cut.md`, and
   `team-success-star-diversity.md` with `-awards.md`. Each follow-up names
   its parent. Keep. All 14 `team-success-*` files are research spikes.
5. `docs/lineup-redesign.md` (status: swapped) and the `src/screens/lineup/next/`
   `CLAUDE.md`. After a swap, the plan doc is history. Add "History" to its
   top line. **inferred**.

## Ranked action list

| # | Edit | File:line | Tag |
| --- | --- | --- | --- |
| 1 | Add top status lines with links to 0093 and 0100; add `Supersedes in part` to 0106 | `docs/adr/0093-...:3`, `0100-...:3`, `0106-...:5` | measured |
| 2 | Mark `enhancement-proposals.md` historical; 16 dead paths | `docs/enhancement-proposals.md:1` | measured |
| 3 | Fix 7 stale `loadPlayer.js` and `TeamInfo.jsx` cites in the data catalog | `docs/api/static-data.md:78,140,165,213,229,383,494` | measured |
| 4 | Replace `src/api/player/stats.js` | `docs/player-redesign-data.md:78,90,103` | measured |
| 5 | Replace `src/api/player/analytics.js` in the doc and in the code comment | `docs/duplicate-derivations.md:60`, `src/api/prospectTrend.js:281` | measured |
| 6 | Fix the 11-or-12 count and the U1, U11, U12 rows | `docs/duplicate-derivations.md:24-30, 83-98` | measured |
| 7 | Move the status banner to the top in 0030, 0035, 0046; link 0027 | `docs/adr/0030:77`, `0035:3`, `0046:81`, `0027:3` | measured |
| 8 | Fix `og-image.jpg`, `blockage-exit-reason-join.md`, `loadPlayer.js` in `milb-historical-logos.md` | `generators.md:2022`, `team-success-exit-reason-mix.md:94`, `milb-historical-logos.md:86,90` | measured |
| 9 | Add three `gen-*` scripts to the catalog | `docs/scripts/generators.md` | measured |
| 10 | Guard: dead backticked paths in `docs/` (with allow-list) | `scripts/check-claude-md-facts.mjs` or new | inferred |
| 11 | Before #1304 runs, list the 233 `.scratch/` paths that docs cite | docs, 53 files | inferred |

## Limits

- Paths inside code fences and tables with `*`, `{}`, `<>` were skipped.
- Line numbers cited inside docs (`file:192`) were not checked for drift.
- The ADRs under `docs/adr/` were checked only for the word "supersed", for
  links, and for ADR numbers. Their file paths were not tested.
- `docs/audits/` was left out of the findings above. It lists 16 more dead
  paths on purpose: a dated audit names what it found and what it deleted.
