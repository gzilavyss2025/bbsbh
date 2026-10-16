# World Series callouts: the orchestrator run plan

Slug: `ws-callouts`. Issue: gzilavyss2025/bbsbh#2235. Written with `write-prompt` on 2026-10-16.
Models: **Sonnet 5.5 and Haiku 5.5 only.** No Opus row.

Read first, in this folder: `contract.md` (shapes, rules, names) and `research.md` (the
patterns and the oracles). The plan PR must be on `main` before row 1 starts, because
every prompt below reads those two files.

**World Series Game 1 is 2026-10-23.** Rows 2 and 3 must be merged by 2026-10-22.

## Before the run (the maintainer's part)

1. Merge this plan PR (`/stack-prs`, or `merge-pr` when CI is green).
2. Start the orchestrator session in **Auto** mode, then give it this file.

## Standing answers

This is an unattended run. The orchestrator never calls `AskUserQuestion` for this plan.

- **S1. Models.** Use only the model in each row. If a row cannot finish on that model,
  mark it blocked. Start no Opus session.
- **S2. Design.** `contract.md` section 1 is settled by the maintainer. Never reopen it.
  A child that thinks it must loosen a gate or change a reveal rule stops with `NEEDS PARENT`.
- **S3. ADR.** The maintainer approved one ADR. Row 2 writes it from `contract.md` section 1.
  No other row writes an ADR.
- **S4. Merges.** When every PR of a wave is green, run `/stack-prs` with those PR numbers
  (standing permission). Then start the next wave from the new `origin/main`.
  Never stack a child on an unmerged PR.
- **S5. Ledger.** One comment thread on #2235. Create no issue. Edit or close no issue.
  Change no label except `wip`.
- **S6. An open choice.** Take the option that spoils nothing and ships less. Write
  `[DECISION: <question> - took <choice> because <reason>]` in the PR body and the ledger.
- **S7. A published claim that our data does not match** (an oracle marked "check", or a
  "match" that fails). The child reports the real number in the PR body and builds the note
  from the data. It never forces the data to match, and never edits an oracle.
- **S8. Time limit.** 30 hours from the start. Check in about every 40 minutes.
- **S9. Network.** `statsapi.mlb.com` is reachable from a cloud session. If a call keeps
  failing after the client's retries, mark the row blocked.

## Run plan

| # | What it does | Model | Effort | Depends on | Parallel with |
| --- | --- | --- | --- | --- | --- |
| 1 | Capture the real API fixtures every later row tests against | Haiku 5.5 | medium | none | none |
| 2 | Series generator, `series.json`, the ADR, docs | Sonnet 5.5 | high | row 1 merged | rows 3, 4 |
| 3 | History reader, odds helpers, `wsSeriesOdds` notes, wiring | Sonnet 5.5 | high | row 1 merged | rows 2, 4 |
| 4 | Classifier, events generator, `events.json` | Sonnet 5.5 | high | row 1 merged | rows 2, 3 |
| 5 | Event notes (play card, roll-up, 9th-inning), shard `wsEvents` | Sonnet 5.5 | high | rows 3 and 4 merged | row 6 |
| 6 | A starting pitcher's World Series line and "Nth World Series start" | Sonnet 5.5 | high | row 3 merged | row 5 |
| 7 | Check in the browser, run the audit, tune the constants | Sonnet 5.5 | medium | rows 2, 5, 6 merged | none |

Waves: wave 1 is row 1. Wave 2 is rows 2, 3, 4. Wave 3 is rows 5, 6. Wave 4 is row 7.
The cap of 3 sessions holds in every wave.

Why this split: five rows ship alone and are reviewed alone (data, reader, classifier, notes,
pitcher line). Row 1 is separate so the three wave-2 rows share one set of fixtures and one
contract, and so a cheap model does the mechanical capture. Rows 2, 3 and 4 run in parallel
because the file shapes in `contract.md` let each be built and tested without the others.

Models: row 1 is mechanical (a script, named files). Rows 2 to 6 are features across several
files that follow patterns already in the repo (rung 4). Row 7 judges a screenshot and moves
constants (rung 3). No row changes the spoiler rule: each one applies it, and each one stops
if it would have to loosen it. That is why no row needs Opus.

Append-only files that rows in one wave may both edit: see `contract.md` section 9.

---

## Prompt 1 of 7 - Haiku 5.5, effort medium

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Goal: capture real World Series API responses as test fixtures. Later rows test against them.

Read first: .scratch/world-series-callouts/contract.md (sections 2 and 4) and research.md (the oracle table). Then read test/fixtures/postseason/capture.mjs. Copy its style.

Do this:
1. Create test/fixtures/world-series/capture.mjs. It runs by hand: node test/fixtures/world-series/capture.mjs. It uses fetch against https://statsapi.mlb.com (a fixture script may; the generator rule in scripts/CLAUDE.md is for scripts/).
2. For each gamePk in this list, save the play-by-play (GET /api/v1/game/{pk}/playByPlay) as {pk}-plays.json, pruned with the `fields` query parameter to what the classifier needs: allPlays, about (atBatIndex, halfInning, isTopInning, inning), result (event, eventType, description, rbi, awayScore, homeScore), matchup (batter id and fullName, pitcher id and fullName), playEvents (details eventType and description, player id, isSubstitution). Keep each file under 120 KB. Verify the pruned file still has every play.
   gamePks: 67524 (1956 G5), 67553 (1960 G7), 67878 (1986 G6), 67961 (1991 G7), 813024 (2025 G7), 813031 (2025 G1; if this is not the 2025 Game 1 Dodgers at Blue Jays, find the real pk from the 2025 schedule and say so in your report), 813032 (2025 G3, 18 innings), 563409 (2018 G3, 18 innings).
   Also find, from the schedule, one pk for each of these and capture its plays too: 2024 Game 1 (walk-off grand slam, 2024-10-25), 2025 Game 5 (opened with two home runs, 2025-10-29), 1975 Game 7, 1912 Game 8 (the Series that had a tied Game 2), 1907 Game 1 (tied).
3. Save the schedule rows for seasons 1912, 2006 and 2022 as schedule-1912.json, schedule-2006.json, schedule-2022.json. URL: /api/v1/schedule?sportId=1&season={Y}&gameType=W&hydrate=linescore,team. These hold the traps: a tied game (1912), a game with no seriesGameNumber (2006, pk 57780), a game listed twice (2022 Game 3).
4. Write test/fixtures/world-series/README.md. For each file: what it holds, the oracle or trap it serves, and the capture date.
5. Run the script. Commit the script, the README and the JSON files.

Done means:
- Every file above exists, parses as JSON, and is under 120 KB.
- A short node check you run once (do not commit it) confirms two things: the 2022 schedule file lists one gamePk under two dates, and one 1912 play-by-play fixture ends with equal scores (the tied game).
- npm run lint passes.

Do not write a classifier, a generator or a test. Do not touch src/ or scripts/.
```

---

## Prompt 2 of 7 - Sonnet 5.5, effort high

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Goal: build the hand-run generator that writes public/data/world-series/series.json, run it, commit the result, and write the one ADR.

Needs first: row 1 merged (test/fixtures/world-series/). Read first, in order:
  1. .scratch/world-series-callouts/contract.md (all of it; sections 1, 2, 3 and 9 bind you)
  2. .scratch/world-series-callouts/research.md (oracles O1 to O3, O11)
  3. scripts/CLAUDE.md (generator rules), docs/scripts/generators.md (the entry for gen-notable.mjs and gen-postseason-history.mjs), scripts/gen-notable.mjs and scripts/lib/notable/ (the closest pattern: hand-run, frozen, coverage block, no generatedAt)
  4. docs/adr/0087-the-postseason-cutoff-is-a-date-not-a-seal.md and 0101-*.md (for ADR style)
  5. test/world-series/ does not exist yet. You create it.

Build:
1. scripts/lib/world-series/series.mjs: the pure half. Input: schedule rows and a play-by-play per gamePk. Output: the series.json object of contract.md section 3. Rules: contract.md section 2, traps 1 to 5. Winner-take-all is NOT in this file; row 4 owns it.
2. scripts/gen-world-series.mjs: the thin top-level script. Use lib/statsapi.mjs getJson only, mapConcurrent from scripts/lib/concurrency.mjs (about 8). One schedule call per season, then one playByPlay call per distinct gamePk (707). Flags: --from, --to (default 1903 and the last finished season, read from lib/time/season-in-play.mjs or passed), --out=DIR, --check (print games, distinct pks, ties, duplicate pks dropped, games with no seriesGameNumber; write nothing). It REPLACES the whole file on a full run. Write with writeJsonAtomic from scripts/lib/io.js.
3. Run it: node scripts/gen-world-series.mjs --from=1903 --to=2025. Commit public/data/world-series/series.json. It must show 121 series, 707 games, 3 ties.
4. Tests in test/world-series/: series-build.test.js (pure half against the row 1 schedule fixtures: the 2022 duplicate keeps the played date; the 1912 tie has tie: true and no winner and takes game number 2; the 2006 game with no seriesGameNumber gets the right n; a 1903 series has winsNeeded 5) and series-file.test.js (reads the committed file: counts 121, 707, 3; size under 80 KB; the oracle figures: 41 winner-take-all games by your own count of games where both clubs had winsNeeded - 1 wins, home won 19; O11 repeat champion 2025 follows 2000). Write each test before the code it covers and watch it fail.
5. Docs: add the entry to docs/scripts/generators.md under the hand-run group (say it runs by hand after each World Series and what a run costs). Add an EXCEPT entry with a reason to scripts/check-data-freshness.mjs. Add the nested CLAUDE.md one-liners that ADR-0098 asks for if a folder you touched has one.
6. ADR: take the next free number (node scripts/check-adr-numbers.mjs). Record contract.md section 1 and the two-store split. Context: a static file regenerated after tonight's game would put tonight's events in the network response before the reader reveals them, which breaks the root CLAUDE.md spoiler rule. Decision: the six points of section 1. Consequences: the frozen file adds a season by hand; the current Series needs the shard; every lookup needs a date. Status: Accepted, 2026-10-16, approved by the maintainer. Follow docs/agents/writing-style.md (ASD-STE100) and the house word list ("postseason", never "playoffs").

Stop with NEEDS PARENT if: the API data breaks a rule in contract.md (say which), or you think section 1 must change.

Verify with the tests you wrote, the existing tests that import a file you changed, and npm run lint. Let CI run the full npm test and npm run build. Do not run npm run e2e. Do not weaken or skip any test.

Done means: series.json committed with the three counts; tests pass; lint passes; the ADR is in docs/adr/; the generator entry is in docs/scripts/generators.md. PR body: the --check output, and the figures from research.md "Corrected proof-of-concept figures" as your code derives them (state any difference).
```

---

## Prompt 3 of 7 - Sonnet 5.5, effort high

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Goal: the reader, the odds helpers and the `wsSeriesOdds` notes, wired into the pre-half strip and Margin Notes, for World Series games only.

Needs first: row 1 merged. Row 2 runs in parallel and writes the real public/data/world-series/series.json. You do NOT wait for it. You build against a small hand-made fixture of the contract.md section 3 shape, and your reader returns nothing when the file does not exist yet.

Read first, in order:
  1. .scratch/world-series-callouts/contract.md (all; sections 1, 3, 5, 6, 7, 8 bind you)
  2. docs/callouts.md ("The five surfaces", "Voice", "Worthiness", "Extending")
  3. docs/adr/0014-*.md and docs/adr/0087-*.md
  4. src/api/CLAUDE.md and src/api/spoiler-manifest.json (a new module in src/api needs an entry or lint fails)
  5. The closest existing note: buildDayOfWeekNote in src/api/callout-notes/checkpoints.js and buildDayOfWeekNotes in heldNotes.js. Grep "dayOfWeek" across src/ to find every place a first-half, once-per-game note is wired. Do the same for your kind.
  6. src/api/callouts.js, seriesBlockFor and the "series" block: it lists the Series' games heading into the slate date, with runs.

Build:
1. src/lib/worldSeries/lastBefore.js: lastBefore(rows, { before, tag, filter }). Throws a plain Error when `before` is not an ISO date string. Returns rows with date < before, newest first, after `filter`.
2. src/lib/worldSeries/odds.js (pure): from the series.json object and a `before` date, return the numbers the notes need: Game 1 winner's Series record; the record of the club that led 2-0; the record of the club that trailed 3-1 (use winsNeeded; compare like with like) and the last such comeback; Game 7 (winner-take-all) home and road record, the road club's current streak, and the last Game 7; repeat champion (the season before this one's winner); the clubs' last World Series meeting or "first"; each club's last appearance. A tied game counts for nobody. Count only series with season < the game's season, plus no game of the current Series.
3. src/api/worldSeries/history.js: loadSeriesHistory(), a staticJson read of /data/world-series/series.json (use src/api/staticJson.js). Returns null on a missing file. Add the manifest entry: class cutoff-gated, an importers list, a plain `why`.
4. src/api/callout-notes/worldSeries.js: buildWorldSeriesOddsNotes({ history, bundle, gameDate, gameType }). It returns [] unless gameType is 'W'. It reads the Series state heading into the game from bundle.series (seriesBlockFor). It never reads tonight's score. Which note fires when:
     - entering Game 2: the Game 1 winner's record
     - entering Game 3 after a 2-0 lead: the 2-0 record
     - entering Game 5 after a 3-1 lead: the 3-1 comeback record (for the trailing club)
     - entering Game 7 (winner-take-all): home and road record, and the road streak if 2 or more
     - entering Game 1: repeat champion; first meeting or last meeting; the drought of a club that has not played since 20 or more seasons ago
   One note per game for each family above, none twice. kind 'wsSeriesOdds'; dedupeKey `wsSeriesOdds-${family}`; score per contract.md section 8. Add the kind to SCORE_BASE, to ONCE_PER_GAME_KINDS and to BETWEEN_INNINGS_ALLOWED_KINDS (shared.js, between-innings.js), and not to RECORD_KINDS.
5. Wire it: load the history only when the game is a World Series game (contract.md section 6) and pass it to the pre-half builder. Follow the wiring of the day-of-week note. Show it on the first half only.
6. Tests in test/world-series/: last-before.test.js (before is required and strict; same-day row excluded); odds.test.js (against a hand-made 4-series fixture you write: a tie, a best-of-nine, a 3-1 comeback, a Game 7); odds-notes.test.js (each family fires on its entering game and not on another; none for a non-W game; none when history is null; no note reads a score from tonight; the wording follows contract.md section 8). Add a test that a 1986 game with a `before` of 1986-10-25 never receives a row dated later. Write each test before the code it covers.
7. Docs: add the kinds to the rubric table in docs/callouts.md; add the reader entry to docs/api/static-data.md. Append-only files are listed in contract.md section 9.

Stop with NEEDS PARENT if: section 1 of the contract would have to change; bundle.series lacks the data you need (say what is missing).

Verify with the tests you wrote, the existing tests that import a file you changed (callout-repetition, between-innings, prehalf), and npm run lint. Let CI run the full npm test and npm run build. Do not run npm run e2e. Do not weaken or skip any test.

Done means: all of the above; every number in a note comes from the data at run time, never from a constant; the first-half strip of a World Series game shows the right note in the unit tests; a non-W game is unchanged.
```

---

## Prompt 4 of 7 - Sonnet 5.5, effort high

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Goal: the one classifier that decides what each tag means, the hand-run events generator, and public/data/world-series/events.json.

Needs first: row 1 merged. Rows 2 and 3 run in parallel; you share no file with them except the append-only files in contract.md section 9.

Read first, in order:
  1. .scratch/world-series-callouts/contract.md (all; sections 2, 4, 5 bind you)
  2. .scratch/world-series-callouts/research.md (every oracle, O1 to O13)
  3. scripts/CLAUDE.md, docs/scripts/generators.md (gen-notable.mjs entry), scripts/lib/notable/ (the pure-half pattern)
  4. test/fixtures/world-series/README.md and the plays fixtures
  5. src/api/callout-notes/shared.js: the event sets (STRIKEOUT_EVENTS, ON_BASE_EVENTS) show the repo's eventType spelling

Build:
1. src/lib/worldSeries/classify.js (pure, no I/O): classifyGame(playByPlay, { innings, wta, clubs }) returns the event rows of contract.md section 4, using the exact rules in its tag table. It exports one small function per rule so a test can call it alone. A header comment states each rule once.
2. scripts/lib/world-series/events.mjs: the pure half of the generator. It decides `wta` for each game from series.json (read the committed file if it exists; if row 2 has not merged, derive the same thing from the schedule: a game is winner-take-all when it is the last decided game of a Series and both clubs had winsNeeded - 1 wins before it; ties are not wins). Add a note in the PR if you had to derive it.
3. scripts/gen-world-series-events.mjs: the thin script. getJson only; mapConcurrent about 8; one playByPlay call per distinct gamePk; same flags as row 2 (--from, --to, --out, --check). It replaces the whole file. Hand-run. Run it for 1903 to 2025 and commit public/data/world-series/events.json.
4. Tests in test/world-series/:
   - classify.test.js: one fixture per tag, a positive and a negative. The negative for `triplePlay` is a play with event "Triple" (a hit). The negative for `pinchHitHr` is a pinch-hit single. Walk-off tags use 2024 Game 1 and 2025 Game 3; opening pair uses 2025 Game 5; pinch-hit grand slam uses the 2025 Game 1 fixture; extra innings uses the 18-inning fixtures.
   - events-file.test.js: reads the committed file. Size under 120 KB. The oracles: wtaTrailing9 has 3 rows with value 1 and 33 with value 0 (O1); walkOffGrandSlam has 1 row on 2024-10-25 (O8); Freeman is the only player with 2 walkOffHr rows (O9); openingHrPair has 1 row on 2025-10-29 (O10); pitcherHit rows include 1975, 1986 and 2025 (O4); no `pitcherHit` row exists outside a `wta` game; every row has a pk that appears in the data; rows are sorted. For O12 and O13 write the real count into the PR body and assert only what the data gives.
   Write each test before the code it covers and watch it fail.
5. Docs: generator entry in docs/scripts/generators.md; EXCEPT entry in scripts/check-data-freshness.mjs. No cron step: this generator is hand-run, and the entry must say what runs it.

If an oracle in research.md does not match what the code produces, follow Standing answer S7: report the number, build from the data, and do not force a match or edit the oracle.

Stop with NEEDS PARENT if: a tag rule in contract.md cannot be written exactly from the feed (say which and show the feed fields).

Verify with the tests you wrote, the existing tests that import a file you changed, and npm run lint. Let CI run the full npm test and npm run build. Do not run npm run e2e. Do not weaken or skip any test.

Done means: classify.js has one definition per tag and nothing else in the repo redefines it; events.json is committed within budget; every "match" oracle passes; the PR body lists the count of rows per tag.
```

---

## Prompt 5 of 7 - Sonnet 5.5, effort high

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Goal: the event notes. `wsLastTime` on a revealed play card, `wsLastTimeGame` in the Final roll-up, `wsWtaTrailing9` entering the 9th, and the `wsEvents` block in the nightly shard so the current Series is covered without a static file.

Needs first: rows 3 and 4 merged (the reader, `lastBefore`, `classify.js`, `events.json`).

Read first, in order:
  1. .scratch/world-series-callouts/contract.md (all; sections 1, 4, 6, 7, 8 bind you)
  2. docs/callouts.md and docs/adr/0014-*.md (the two tenses), and the ADR row 2 wrote
  3. src/api/callout-notes/liveAtBat.js (buildCallouts: the play-card builder) and rollup.js (computeGameCalloutNotes). The roll-up is the only result-aware surface.
  4. src/api/prehalf-callouts.js and buildAfterInningNote in checkpoints.js: the model for a note that reads tonight's score and self-gates on revealedThrough.
  5. scripts/gen-callouts.mjs around the "series block" (search "seriesBlock"); src/lib/postseason/primer/seriesBlock.js; test/postseason/series-block.test.js

Build:
1. src/api/worldSeries/history.js: add loadEventHistory() for events.json (same class and manifest rules as the series reader).
2. src/api/callout-notes/worldSeriesEvents.js:
   - `wsLastTime` (play card): the revealed play is classified with classify.js's per-play functions (the same code the history used). For a tag in the v1 list that is rare enough, look up lastBefore(rows, { before: gameDate, tag }). Rows come from events.json plus bundle.wsEvents (the current Series). Fire when the gap is WS_MIN_GAP_SEASONS (3) or more, or when no earlier row exists ("the first in World Series history"). Which tags may fire on a play card: grandSlam, walkOffHr, walkOffGrandSlam, openingHrPair, pinchHitHr, pinchHitGrandSlam, extraInningHr, multiHrGame, pitcherHit, triplePlay, gameEndingDp. Prefer the most specific tag for one play (a walk-off grand slam note replaces the grand slam note and the walk-off note).
   - `wsLastTimeGame` (roll-up, Final only): extraInnings, shutout, bigScore, bigComeback, reachedBase. Gate by the same gap rule.
   - `wsWtaTrailing9` (pre-half strip): entering the top of the 9th of a winner-take-all game, for the club that trails. It uses the same revealedThrough self-gate as buildAfterInningNote. History: the wtaTrailing9 rows give the record, for example 3 and 33 (count value 1 as a win).
   - Wording follows contract.md section 8. Add kinds to SCORE_BASE; wsWtaTrailing9 and wsLastTime* are NOT in BETWEEN_INNINGS_ALLOWED_KINDS.
3. Shard: in scripts/gen-callouts.mjs, beside the `series` block, write `wsEvents` for a World Series game: classify the counted games of the current Series (the bracket's own counted games, date before the slate date) with classify.js. One playByPlay call per counted game. A game on or after the slate date is never in it. Add a test in the style of test/postseason/series-block.test.js that pins the cutoff. Older shards without the key must still work.
4. Wire the builders into the three surfaces. Load events only for a World Series game.
5. Tests in test/world-series/: notes-play.test.js (a revealed grand slam gets a note with the right last date; the same play unrevealed gets none; an old game's `before` never sees a later row); notes-game.test.js (Final only; not in an in-progress view); notes-9th.test.js (the revealedThrough gate: no note when the 8th is not revealed; only the trailing club; only in a winner-take-all game; the 3-33 numbers from the fixture); shard.test.js (the cutoff); a spoiler test that no builder is reachable from a module outside the manifest's importer list. Write each test before the code it covers.
6. Docs: rows in docs/callouts.md; the shard key in docs/api/static-data.md.

Stop with NEEDS PARENT if: a surface cannot be reached without reading a score that is not yet revealed; the shard needs more than the counted games; section 1 would have to change.

Verify with the tests you wrote, the existing tests that import a file you changed (callout-notes, callout-repetition, callout-ledger, series-block), and npm run lint. Let CI run the full npm test and npm run build. Do not run npm run e2e. Do not weaken or skip any test.

Done means: one definition of each tag (classify.js) is used by the history and the live builders; no note appears before its play is revealed; a non-W game is unchanged; the shard for a game on the slate date holds no event from that date.
```

---

## Prompt 6 of 7 - Sonnet 5.5, effort high

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Goal: a starting pitcher's all-time World Series line, and one note, "his Nth World Series start", for World Series games.

Needs first: row 3 merged (it set the reader class, the kind registries and the wiring pattern). Row 5 runs in parallel; you share only the append-only files in contract.md section 9.

Read first, in order:
  1. .scratch/world-series-callouts/contract.md (sections 1, 2, 6, 7, 8)
  2. docs/adr/0088-entry-card-stat-lines-end-the-day-before-the-game.md
  3. src/api/postseason/pitcherCareer.js (fetchPitcherPostseasonCareer: the pattern to copy; it avoids stats=career because that counts a game in progress)
  4. src/components/postseason/SeriesStarters.jsx and src/components/playbyplay/pitcherCard/PitcherCard.jsx (the two callers) and docs/api/postseason.md, "The series pages' parts" (the Starting pitchers row)

Build:
1. src/api/postseason/pitcherWorldSeries.js: fetchPitcherWorldSeriesCareer(personId, season, thisSeasonWs = null). Same shape and same rule as pitcherCareer.js, with gameType=W only: yearByYear for seasons BEFORE `season`, plus this season's World Series line when the caller has it. It never uses stats=career. Verified endpoint behaviour (2026-10-16): /api/v1/people/{id}/stats?stats=yearByYear&group=pitching&gameType=W returns World Series rows only; Kershaw's career call with gameType=W returned 8 games and 41 strikeouts. Add a manifest entry.
2. Show an "All-time World Series" row in the starting-pitchers part of the live series page, only when the series is the World Series and the pitcher has World Series games. Reuse the existing row component; add no new component unless the repo has none that fits.
3. Note kind `wsStarterStart`: "{n}th World Series start", for a starter whose count of earlier starts is 0 ("first World Series start"), or is a milestone (5, 10). Counts are earlier starts plus this one. Pregame fact only. Fires on the first half of the pre-half strip with the same wiring as `wsSeriesOdds`. Add to SCORE_BASE (base 40) and ONCE_PER_GAME_KINDS.
4. Check two known pitchers by hand before you write a test and say what you saw in the PR body: Clayton Kershaw (person id 477132, 8 World Series games) and one pitcher with no World Series game (the note must say "first").
5. Tests in test/world-series/: pitcher-ws.test.js (mock the API: only earlier seasons are summed; a traded pitcher's keyless combined split is used; no stats=career in the URL; null for a pitcher with no World Series game); starter-note.test.js (first start, fifth start, ordinary start fires nothing; non-W game fires nothing). Write each test before the code it covers.
6. Docs: the reader entry in docs/api/static-data.md; the row in docs/callouts.md.

Stop with NEEDS PARENT if: a World Series row would need a game still in progress, or section 1 would have to change.

Verify with the tests you wrote, the existing tests that import a file you changed, and npm run lint. Let CI run the full npm test and npm run build. Do not run npm run e2e. Do not weaken or skip any test.

Done means: the row and the note appear for a World Series pitcher in unit tests; nothing changes for an LCS or a regular-season game; the line ends the day before the game.
```

---

## Prompt 7 of 7 - Sonnet 5.5, effort medium

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

Keep working until everything asked for is done. Stop to ask only when you cannot go on without the user, or before a risky step. When the work is done and checked, stop and report; do not add features, tests, files or docs that were not asked for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked for.

Goal: prove the notes work in a real browser on real World Series games, and tune the numbers.

Needs first: rows 2, 5 and 6 merged. Read first: .scratch/world-series-callouts/contract.md (sections 7 and 8), docs/callouts.md ("Auditing the rubric"), docs/test-games.md, .claude/skills/run/SKILL.md.

Do this:
1. Start the dev server (npm run dev). Open these routes with ?nointro at 390 px width in the preinstalled Chromium and take one screenshot each. Find the exact route of each game from docs/test-games.md ("/11012025" is the 2025 World Series Game 7, gamePk 813024) or from the schedule:
   - 2025 Game 7 (gamePk 813024), the first half of the first inning: expect a `wsSeriesOdds` Game 7 note (home and road record, the road streak).
   - Entering the top of the 9th of that game, after the 8th is revealed: expect `wsWtaTrailing9` only for the trailing club.
   - 2025 Game 3 (gamePk 813032) at the box score, once revealed: expect `wsLastTimeGame` for the 18-inning game.
   - An LCS game (2026 NLCS, gamePk 849811) and a regular-season game: expect no World Series note.
   Because history is cut at the game's own date, an old game shows only earlier history. Check one line of that: the 1986 Game 6 page (gamePk 67878) must not name a later year.
2. Run the audit: node scripts/audit-callouts.mjs --bundle-only, and a --date run for the days that have shards. Report, per World Series kind: how often it fired, its score spread, and how many survived the surface cap.
3. Tune. You may change only these constants: the scores in SCORE_BASE for the four new kinds, WS_MIN_GAP_SEASONS, and the magnitude bonus. Change one only with a number from the audit, and write the number in the PR body. Do not change any other file for tuning. If a note reads badly, list it in the PR body with a one-line fix and do not change the wording yourself.
4. Send each screenshot to the maintainer with SendUserFile, with the route and the gamePk in the caption.

Stop with NEEDS PARENT if: a note appears before its play is revealed, a World Series note appears on a game that is not a World Series game, or a note names a date later than the game's own date. These are spoiler bugs. Do not fix them in this row.

Verify with npm run lint and the unit tests for any constant you changed. Let CI run the rest. Do not run npm run e2e.

Done means: the screenshots are sent; the audit table is in the PR body; the constants you changed each cite an audit number.
```

---

## Grade

**A-.** Evidence: every file and function named exists, or is named by the contract as new. Each row
has a done test. Test-first is stated where code is written. Each row has a stop rule. The
oracles give an agent a number to hit instead of a guess.

Points taken off:

- **-1: two rows need data from an earlier row.** Row 5 needs rows 3 and 4 merged, so the third wave
  waits on two stacks. This is the price of the contract, not a flaw in a prompt.
- **Polish only:** the 2025 Game 1 gamePk in row 1 (`813031`) is inferred from Game 3 (`813032`) and
  Game 7 (`813024`). Row 1 is told to verify it.

Problems that would make an agent stall: none that I know of. The ones I found were fixed
(the shutout `value`, the tie handling, the duplicate-pk trap).

## What I changed and why

- **Split into seven rows.** The work is five deliverables that ship and review alone (data,
  reader, classifier, notes, pitcher line), plus a fixture row and a verify row. It is far more
  than 10 files.
- **Row 1 on Haiku 5.5 (medium).** A script with named files and a named list of gamePks.
  Haiku 5.5 may take medium for a narrow, fully specified change.
- **Rows 2 to 6 on Sonnet 5.5 (high).** Each follows a pattern the repo already has and touches
  several files (rung 4). None is below rung 4, and none needs Opus because none changes the spoiler rule.
- **Row 7 on Sonnet 5.5 (medium).** It judges a screenshot and moves constants (rung 3).
- **A contract file.** Three rows run in parallel against file shapes they do not own. One file
  fixes the shapes, names and tag rules, so they cannot drift.
- **Oracles.** Published numbers that our data reproduced (3-33, 19-22, Orosco and Ohtani,
  18 innings, 7:20 and 6:39) are now test targets, so a cheaper model can tell when a rule is wrong.
- **Slice 4 (park, crowd, game length) is left out** by your choice. Slice 3 is row 6, narrowed to
  a starting pitcher's line, because that is the one surface with a repo pattern to copy.
- **No code-review step.** The PRs land through `/stack-prs`, which reviews once.
- **The "keep working" line** is in rows 1 and 7 only: the unattended Sonnet-or-Haiku rows at medium.
