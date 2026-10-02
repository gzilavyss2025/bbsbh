# Derivations computed in more than one place

The report for #1118. It lists the baseball quantities that this repo computes
in two or more places, compares the formulas, and puts each one in one bucket.
It changes no code. The collapse work comes later, after the owner reads this.

The three homes:

- **`src/api/`** (and a few `src/lib/`, `src/screens/` helpers): the live path,
  in the browser.
- **`scripts/gen-*.mjs` and `scripts/lib/`**: the generators, precomputed into
  `public/data/`.
- **`.scratch/*/`**: research spikes.

Code is cited by file and function name, never by line number. The proof
scripts are not in the repo. Each proof below gives the input and the two
numbers, so that you can run it again.

## Summary

| Bucket | Count |
| --- | --- |
| Actual disagreement (each has an issue, label `needs-triage`) | **9** |
| Deliberate difference (a comment to add, below) | **12** |
| Duplicate (same formula, collapse later) | **12** |

The three that matter most:

1. **The ABS challenge ledger keeps one challenge per at-bat (#1277).**
   `challengeRowsForGame` keys a `Map` on `atBatIndex`, so the second challenge
   in an at-bat is lost. The live bank and the umpire page count both. In
   gamePk 816831 the feed says the home club lost a challenge, and the ledger
   has no lost challenge. This is the ADR-0075 shape: the ledger feeds the bank
   replay and the chances denominator, so every rate on `/abs-challenges` sits
   on it. **Read this one first.**
2. **The Prospect Card mixes a season summed over every level with one-level
   benchmarks (#1279).** 35 of 60 hitters checked. Owen Ayers shows "165% of a
   typical AAA stay" and the 91st percentile. At AAA alone he has 64% and the
   38th percentile.
3. **OPS summed from components skips MLB's rounding in four homes (#1275).**
   For 162 of 673 MLB hitters in 2025, that formula gives an OPS .001 away from
   MLB's own. The other formula in the repo matches MLB on all 673.

Run expectancy and the tier math, which the unit suite pins, have one home
each. Every other caller imports them, and I found no drift there (see
"Checked: one home").

## The list

Bucket codes: **A** = actual disagreement, **D** = deliberate difference,
**U** = duplicate.

### Actual disagreements

| # | Quantity | Homes (file: function) | Where they split | Numbers | Issue |
| --- | --- | --- | --- | --- | --- |
| A1 | OPS from summed components | Rounded halves: `src/api/boxlines/fold.js`: `foldLine`; `src/api/boxlines/careerSplits.js`: `mergeCareerSplits`; `src/api/person/stats.js`: `overallSide`. Full precision: `src/api/person/stats.js`: `aggregateSplits`; `src/api/statsLevels.js`: `sumHitting`; `scripts/gen-vs-team-splits.mjs`: `opsOf`; `scripts/gen-callouts.mjs`: `ttoSplits` | Rounding. MLB rounds OBP and SLG to three places, then adds. Full precision adds, then rounds. | 2025 MLB, 673 hitters: rounded halves differ from statsapi on 0, full precision on 162. Aaron Judge: statsapi 1.145, full precision 1.144. | #1275, fixed in PR #1333 |
| A2 | ERA (and WHIP) with zero outs | No value: `careerSplits.js`: `mergeCareerSplits` (`-.--`); `fold.js`: `era` (`null`); `person/stats.js`: `aggregateSplits` (dash); `gen-callouts.mjs`: `pitcherEnrich` (`null`). Zero: `scripts/gen-vs-team-splits.mjs`: `eraOf` (`'0.00'`); `src/api/statsLevels.js`: `sumPitching` (`0`, read by `prospects.js`: `statLineFrom` and `loadMinors.js`); `src/api/logbookRetrospective.js`: `era`; `src/screens/FirstScorebookPage.jsx` | outs = 0 with earned runs | 11 shipped vs-team lines with 0.0 IP print ERA 0.00. Joe Rock vs TB: 0.0 IP, 2 ER; card 0.00, `mergeCareerSplits` gives -.--. | #1276, fixed in PR #1333 |
| A3 | ABS challenges in one game | All of them: `src/api/challenges.js`: `challengesForPlay`, `selectChallengeState`; `scripts/gen-umpire-accuracy.mjs`: `computeGameAccuracy`. One per at-bat: `scripts/lib/abs/rows.mjs`: `challengeRowsForGame` | An at-bat with two or more challenges | gamePk 816831: 3 against 2 (lost: feed 1, ledger 0). 816935: 7 against 5. 823011: 7 against 6. 815743: 5 against 4. | #1277 |
| A4 | Prospect age against the level average | `src/api/prospectTrend.js`: `ageEdgeFact`, fed `person.currentAge` (whole years) by `src/api/player/analytics.js` and `overview.js`; `scripts/lib/prospectAgeBenchmark.mjs`: `fetchLevelAverageAges` (decimal years) | Any birthday that is not today. The 1.0-year floor turns the bias into a fact that shows or hides. | 738 prospects: the fact differs for 642, and shows on only one basis for 77. Garrett Hawkins: 1.7 against 1.1 years younger. | #1278 (fixed in PR #1330) |
| A5 | Prospect tenure % and level percentile | Season summed over all levels: `scripts/gen-prospect-trend.mjs` (`combineToPool` line, `sampleSize`). One level: `scripts/gen-level-tenure-benchmark.mjs`: `reconstruct`; `scripts/lib/prospectPercentile.mjs`: `qualifiedMetrics`. They meet in `src/api/levelTenure.js`: `tenureFact` and `percentileRank`. | A prospect who played at more than one level this season | 35 of 60 hitters. Owen Ayers (AAA): 165% against 64% of a typical stay; 91st against 38th percentile. | #1279 (fixed in PR #1330) |
| A6 | "On a rehab assignment now" | `src/api/person/activity.js`: `detectRehabAssignment` (open until a closing transaction); `scripts/gen-rehab.mjs` (also `REHAB_MAX_DAYS` = 30, `isStillRehabbing`) | A stint with no closing transaction | 16 MLB players still "on rehab" after 30 days on 2026-09-28. Gavin Lux: banner 90 days after the stint began, absent from `rehab.json`. | #1280 (fixed in PR #1324) |
| A7 | Went to extra innings | `scheduledInnings`: `scripts/lib/team-records.mjs`: `scoredInExtras`; `scripts/lib/abs/bank.mjs`: `firstExtraInning`. Fixed 9: `src/api/seasonSeries.js`: `seasonSeriesCells`; `src/screens/team/modules/TeamGames.jsx`. (`src/api/logbookStats.js` also uses 9, and says why.) | A seven-inning game that went to 8 or 9 | Triple-A May-June 2026: 7 games. gamePk 815611: scheduled 7, played 8, no flag on the MiLB list. | #1281 |
| A8 | Plate appearances in a half-inning | Shared rule: `src/api/playbyplay/eventTypes.js` `NON_PA_EVENT_TYPES`, `scripts/lib/long-at-bats.mjs`: `isPlateAppearance`. `result.type === 'atBat'`: `scripts/lib/team-records.mjs`: `battedAroundHalves` | A half that ends on a caught stealing or pickoff | 187 games: 43 non-PA plays, all typed `atBat`. gamePk 823594 top 3: 4 against 3. The "batted around" count changes only at exactly 9 PAs; not seen in those 187 games. | #1282 |
| A9 | A series | Now one rule, `src/api/scheduleShape.js`: `seriesRuns` (opponent + side of the road; a neutral-site game joins the series beside it, but never carries one across a home/away change). Was `scripts/lib/team-records.mjs`: `tagSeries` (opponent + `venue_id`), `scripts/lib/schedule-shape.mjs`: `tagSeries` (opponent + site; neutral games dropped) and a third copy in the reader `ledgerOf` | A neutral-site game | 2024 Tigers: 53 against 52 series. The Little League Classic is a one-game series in one and no series in the other. | #1283 (fixed in PR #1331) |

### Deliberate differences

| # | Quantity | Homes (file: function) | Where they split | Why it is on purpose |
| --- | --- | --- | --- | --- |
| D1 | Expected wins from runs | `src/api/standings.js`: `expectedRecord` (MLB `xWinLoss`, else PythagenPat, exponent ((RS+RA)/G)^0.287); `scripts/gen-season-score.mjs`: `pythagoreanPace` (same, times 162); `src/api/teamScoreFormula.js`: `pythagoreanPct` (fixed 1.83, park-adjusted runs) | Every club, most in an extreme park | Standings show MLB's own figure. Team Score judges a club apart from its park. Only the Team Score side says so. |
| D2 | Standard deviation | Divide by n: `src/lib/statTiers.js`: `meanAndSd`; `scripts/gen-workload.mjs`: `meanSd`; `scripts/lib/savant.mjs`: `meanSd`. Divide by n−1: `scripts/gen-gate.mjs`: `stdev`; `src/lib/euz.js`: `silverman` | Small pools | A whole league pool is a population. A season in progress, or a bandwidth estimate, is a sample. `savant.mjs` does not say which it uses. |
| D3 | Home win probability of one game | `scripts/gen-season-score.mjs`: `expectedHomeWinProbability` (club home factor, clamp 0.25–0.75 on wins/162); `scripts/gen-postseason-odds.mjs`: `homeWinProbability` (league `HOME_WIN_PROBABILITY`, clamp 0.05–0.95 on rates) | Every club with a home factor far from 0.54 | Different inputs (wins against rates). The odds file does not say why it uses the league edge and not the club edge. |
| D4 | Starter or reliever | 0.5 of games: `src/api/person/identity.js`: `pitcherRole`; `scripts/gen-workload.mjs` (role). 0.4 of games: `scripts/lib/salaries.mjs`: `pitcherRole`; `scripts/lib/contract-pay-rank.mjs`: `pitcherGroup` | A pitcher with 40–49% starts | The money pages ask which pay market a swingman is in. The player page picks a tile set. Only the 0.4 side says so. |
| D5 | "In the zone" | Ball touches the zone (edges widened by `BALL_R`): `src/api/derive.js`: `isMissedCall`; `src/api/umpireFavor.js`; `scripts/gen-umpire-accuracy.mjs`. Centre inside the zone: `src/lib/zone/zoneGeometry.js`: `inZone` (command grid) | A pitch on the black | Accuracy asks if a call was right. Command asks where the pitcher put the ball. |
| D6 | Times through the order: the trip number | Distinct innings faced: `src/api/callout-notes/tto.js`: `enteringStarterTrip`. Every PA in the game: `scripts/gen-callouts.mjs`: `ttoSplits` | A batter who bats twice in one inning against the starter | The live card can only fire later than the generator's bucket, never earlier. But the generator's comment cites a live `timesFacingPitcher` walk that no longer exists and says the two match. Fix the comment. |
| D7 | Average age of a group | `scripts/lib/prospectAgeBenchmark.mjs`: `fetchLevelAverageAges` (age today, PA ≥ 40 or outs ≥ 30, per level); `scripts/lib/youngest-regulars.mjs`: `averageAge` over `ageOnJune30` (age on June 30, regulars, per league) | Every level | Two questions: "how old is this level now" and "how old were this league's regulars this season". |
| D8 | A player's season age | `scripts/lib/youngest-regulars.mjs`: `ageOnJune30` (decimal); `.scratch/team-success/build-roster-age.mjs` (statsapi's integer `stat.age`) | Every player | The spike compares clubs with each other in one season, and its header says the integer is good enough for that. |
| D9 | How far a winner came back | `src/api/dayHighlights.js` (lowest win probability, seeded at 50); `scripts/gen-comeback-wins.mjs`: `bothMinWinProbs` (true minimum) | A winner who never fell below 50 | The seed only matters below the threshold (deficit > 25), so the two agree on every game either one reports. |
| D10 | ABS chances per inning | `.scratch/abs-reports/analysis.mjs`: `chancesByInning` (failures before the half); `scripts/lib/abs/chances.mjs`: `chancesByInning` (`replayBank`, extra-inning re-arm, `scheduled_innings`) | Extra innings, and innings 8–9 of a seven-inning game | The spike is the draft. ADR-0075 records the correction. Quote the export, not the spike. |
| D12 | An umpire's called ball | `scripts/gen-umpire-accuracy.mjs`, `src/api/umpireFavor.js`, `src/api/derive.js` (`'B'`, `'*B'`); `src/api/playbyplay/pitchInfo.js`: `BALL_CODES` (adds pitchouts, HBP, intentional and automatic balls) | A pitchout or an automatic ball | Those codes move the count but are not a zone judgment. |

### Duplicates

| # | Quantity | Homes (file: function) | Edge, if any | Which home should win |
| --- | --- | --- | --- | --- |
| U1 | Innings pitched to outs, and back | `src/lib/math/innings.js`: `ipToOuts`, `outsToIp` (one home since #1306). Copies left: `scripts/gen-workload.mjs`, `scripts/gen-vs-team-splits.mjs`, `scripts/lib/pitcher-starts.mjs` (inline), `.scratch/*`; `scripts/lib/abs/exposure.mjs`: `inningsFromOuts` | All agree on real input. Only `"5.10"` differed, and the feed never sends it. `inningsFromOuts` rejects `".3"`; the others read it as 3 outs. | `src/lib/math/innings.js`. Keep `inningsFromOuts`'s strict parse. The generators left can import it. |
| U2 | Is a play a plate appearance | `src/api/playbyplay/eventTypes.js`: `NON_PA_EVENT_TYPES`, `GAME_ADVISORY_EVENT_TYPE`; `scripts/lib/long-at-bats.mjs`: `isPlateAppearance`; `derive.js`, `callout-notes/tto.js`, `rollup.js`, `progress.js` skip the advisory check | A top-level `game_advisory` play. It exists only before the first pitch, so no revealed count moves. | Move `isPlateAppearance` into `eventTypes.js`. A8 (#1282) is the one copy that disagrees. |
| U3 | Was a called pitch a missed call | `src/api/derive.js`: `isMissedCall`; `src/api/umpireFavor.js`: `selectUmpireFavor`, `missEdge`; `scripts/gen-umpire-accuracy.mjs`: `computeGameAccuracy`, `missRegion` (same body as `missEdge`) | A pitch with a corrupt pre-pitch count: `derive.js` drops it from the missed count, the generator counts it | A pure per-pitch helper in `src/lib/zone/`. The feed walks stay where they are: `derive.js` and `umpireFavor.js` stay reveal-only (ADR-0001). Only one pitch's geometry moves, and geometry is not a score. |
| U4 | Base-out state, play by play | `scripts/gen-run-expectancy.mjs`: `accumulateGame`; `scripts/gen-umpire-accuracy.mjs`: `computeGameAccuracy`; `src/api/umpireFavor.js`: `selectUmpireFavor`; `scripts/lib/abs/rows.mjs`: `challengeRowsForGame` | None found | A pure step function in `src/lib/runExpectancy.js` beside the table code. The reveal-only walk in `umpireFavor.js` stays there. |
| U6 | Quality start | `src/api/person/gameLog.js` (inline); `scripts/lib/team-records.mjs`: `isQualityStart` | None (18 outs, 3 ER) | `isQualityStart`, moved to `src/lib/`. |
| U7 | Level tenure (first ascent) | `.scratch/level-benchmarks/analyze.mjs`: `reconstruct`; `scripts/gen-level-tenure-benchmark.mjs`: `reconstruct` | None. Both keep debut-year MiLB rows after the debut. | The generator. The spike is its source. |
| U8 | A club's Team Score at a cutoff | `src/api/teamScore.js`: `teamScoreFor`; `scripts/gen-postseason-odds.mjs`: `teamScoreSnapshot` (says it is a deliberate copy) | None | `teamScore.js`. `src/api/CLAUDE.md` says a generator that needs app logic imports it. |
| U9 | The league's ABS challenge rate | `src/api/around-the-game/absExposure.js`: `leagueBaseline` and `clubRate` over every club | A player with challenges and no exposure: counted in one, dropped in the other | One function. The gap today is 6.392 against 6.391 per 1,000 pitches, below the printed precision. |
| U10 | A player's ABS challenge rate | `scripts/lib/abs/exposure.mjs`: `exposureRates`; `absExposure.js`: `clubChallengeBoard` (`players[].rate`) | None | The shipped per-player field. |
| U11 | Median and quantile | `scripts/gen-gate.mjs`: `median` (rounds an even pair); `scripts/lib/salaries.mjs`, `scripts/lib/opencommand.mjs`, `scripts/lib/savant.mjs` (`round1`): `median`; `scripts/gen-level-tenure-benchmark.mjs`: `percentile`; `absExposure.js`: `quantile`; `src/api/workload.js` (upper middle) | Even-length lists and storage precision | Low value. Each precision is stated where it lives. Collapse only if one of them moves. |
| U12 | Which season a job is about | the calendar year (`getFullYear` or `getUTCFullYear`) in 36 generators; `scripts/lib/long-at-bats.mjs`: `noteSeasonFor` and `src/lib/time/seasonPhase.js`: `offseasonPhase` in 4; `scripts/gen-workload.mjs`: `SEASON = 2026` | January 1. A calendar-year job can open an empty season (the trap `noteSeasonFor` names). `gen-workload.mjs` stays on 2026. | The season-store work (#1200, #1201) owns this. |

## Checked: one home

These have one home, and every other caller imports it. I found no copy.

- **Run expectancy.** `src/lib/runExpectancy.js`, imported by `gen-run-expectancy.mjs`, `gen-umpire-accuracy.mjs`, `umpireFavor.js` and `scripts/lib/abs/rows.mjs`.
- **Tiers.** `src/lib/statTiers.js` (`tierForZ`, `leanTierForZ`) has one caller, `src/api/umpires.js`. The prospect bands (`levelTier`, `standingLabel`) live only in `src/api/prospectTrend.js`.
- **The percentile strip.** `dotFraction` in `src/lib/percentileStrip.js` takes Savant's own percentile. `gen-savant-percentiles.mjs` does no percentile math.
- **Prospect percentile rank.** `percentileRank` in `scripts/lib/prospectPercentile.mjs` is shared by both trend generators. (A5 is about what goes into it.)
- **Rookie limit.** `scripts/lib/rookie-crossing.mjs`, shared by both rookie generators.
- **Bullpen thresholds.** `gen-workload.mjs` imports `clubPenCounts` from `src/api/workload.js`.
- **Pitch codes.** `WHIFF_CODES`, `FOUL_CODES`, `BALL_CODES` in `src/api/playbyplay/pitchInfo.js`.
- **K% and BB%.** Every home divides by PA (BF for a pitcher).
- **Rehab transaction test.** `src/api/rehab-policy.js`. (The 30-day cap is shared too, since A6. The 7-club-games stale rule is not: it needs game logs.)
- **Hit coordinates.** `HIT_COORD_ORIGIN` in `src/lib/ballpark/hitProjection.js`. Savant's `hc_x`/`hc_y` projection is different, and `gen-spray.mjs` says so.
- **Win probability.** It comes from MLB's endpoint. The repo does not compute it.

## Found on the way

These have one home each, so they are not in the buckets. No issue was opened.

- **Rookie limit: reach or exceed.** `scripts/lib/rookie-crossing.mjs` (`findCrossingSeason`, `crossingDateFromGameLog`) ends rookie status at `>= 130` AB or `>= 150` outs. MLB's rule says "exceeded" 130 AB or 50 IP, and `src/api/person/transactions.js` prints "Exceeded". A player with exactly 130 AB splits them. The 45-day active-roster clause is not modelled.
- **`gen-workload.mjs` has `SEASON = 2026` as a literal** (U12).
- **`docs/scripts/generators.md` is stale on `gen-rehab.mjs`.** It says the script keeps its own copy of the transaction scan. It imports `rehab-policy.js` now. (Named in #1280.)
- **`averageAge` in `scripts/lib/youngest-regulars.mjs`** averages ages that `ageOnJune30` already rounded to 0.1. The error is 0.05 years at most.

## Comments to add

These land with the collapse work, not here. Each one goes beside the code
named. The text is exact.

**`src/api/teamScoreFormula.js`, above `PythagoreanExponent` (D1):**

```js
// NOT THE STANDINGS' "EXP W-L". standings.js's expectedRecord shows MLB's own
// xWinLoss (or PythagenPat on raw runs when the feed omits it). This formula
// uses a fixed 1.83 on PARK-ADJUSTED runs, because Season Quality judges a club
// apart from its park. The two can differ for one club on one day, on purpose.
```

**`src/api/standings.js`, above `expectedRecord` (D1):**

```js
// Not teamScoreFormula.js's pythagWins, which is park-adjusted with a fixed
// 1.83 exponent. This column is MLB's own expected record, raw runs.
```

**`scripts/lib/savant.mjs`, above `meanSd` (D2):**

```js
// Population SD (divide by n), like statTiers.js's meanAndSd: the column is the
// whole board, not a sample of it. gen-gate.mjs's stdev divides by n-1 because
// its rows stand in for a season that is still being played.
```

**`scripts/gen-postseason-odds.mjs`, above `homeWinProbability` (D3):**

```js
// The LEAGUE home edge for every game, not each home club's own factor
// (teamHomeFieldFactor, which gen-season-score.mjs passes). The clamps differ
// from that file's too (0.05-0.95 on rates here, 0.25-0.75 on wins/162 there)
// because the inputs are team-score.json's neutral-site rates.
```

**`src/api/person/identity.js`, above `pitcherRole`, and `scripts/gen-workload.mjs`, above the role block (D4):**

```js
// Half of his games, NOT the 0.4 of scripts/lib/salaries.mjs (STARTER_SHARE)
// and contract-pay-rank.mjs. Those two ask which pay market a swingman is in;
// this picks how his season reads. A pitcher with 40-49% starts is RP here and
// SP on the money pages, on purpose.
```

**`scripts/lib/salaries.mjs`, after the `STARTER_SHARE` comment (D4):**

```js
// person/identity.js's pitcherRole uses half, for the player page's tile set.
// The two answer different questions; neither is a copy of the other.
```

**`src/lib/zone/zoneGeometry.js`, above `inZone` (D5):**

```js
// The pitch's CENTRE inside the rule-book zone. Not the umpire test:
// gen-umpire-accuracy.mjs, umpireFavor.js and derive.js call a pitch a strike
// when any part of the ball touches the zone (edges widened by BALL_R).
// Accuracy asks if the call was right; command asks where the ball went.
```

**`scripts/gen-callouts.mjs`, replace the sentence in the `ttoSplits` header that cites `timesFacingPitcher` (D6):**

```js
// Trips here count every plate appearance against the pitcher in the game, so
// a batter who bats twice in one inning is on his 2nd trip. The live card
// (src/api/callout-notes/tto.js, enteringStarterTrip) counts DISTINCT innings
// instead. It can only fire later than this bucket, never earlier: three
// distinct innings means at least three plate appearances.
```

**`src/api/callout-notes/tto.js`, above `enteringStarterTrip` (D6):**

```js
// Not the count gen-callouts.mjs's ttoSplits files its season split under:
// that one counts plate appearances, this one counts innings. See its header.
```

**`scripts/lib/prospectAgeBenchmark.mjs`, file header (D7):**

```js
// AGE TODAY over every qualified player at one LEVEL (PA >= 40 or outs >= 30).
// Not youngest-regulars.mjs's averageAge, which is age on June 30 over one
// LEAGUE's regulars: "how old is this level now" is a different question
// from "how old were this league's regulars this season".
```

**`src/api/dayHighlights.js`, beside `let worst = 50` (D9):**

```js
// Seeded at 50, so a winner who never trailed reads as a deficit of 0.
// gen-comeback-wins.mjs's bothMinWinProbs takes the true minimum. The two
// agree on every game this signal can fire on (deficit > 25).
```

**`.scratch/abs-reports/analysis.mjs`, above `chancesByInning` (D10):**

```js
// SUPERSEDED by scripts/lib/abs/chances.mjs (docs/adr/0075). This draft counts
// only the failures before the half. It never re-arms a club in extra innings
// and never reads a seven-inning game's length. Quote the export, not this.
```

**`scripts/gen-umpire-accuracy.mjs`, beside `const ballCall` (D12):**

```js
// 'B' and '*B' only: the umpire's own ball calls. BALL_CODES
// (playbyplay/pitchInfo.js) also holds pitchouts, hit-by-pitch, intentional
// and automatic balls. Those move the count but judge no zone.
```

## Not read

**`src/` and `scripts/`.** I read or searched every home named in the tables.
I did not read the UI components one by one: I searched `src/components/` and
`src/screens/` for the formulas above (innings, ERA, OPS, extras) and list what
the search found. I did not read the `check-*.mjs` guards, the `fever/`
generators, or the Express Lane and design-system modules, because they compute
no baseball quantity.

**`.scratch/`.** For formulas, I read:

- The spikes behind a `scripts/research-db.mjs` view: `team-success`
  (`build-roster-age.mjs`, the five `parseInnings`,
  `analyze-october-texture.mjs` rates), `level-benchmarks` (`analyze.mjs`,
  `era-hump.mjs`), `prospect-traits` (`outcomes.mjs`, `lib.mjs`,
  `q1-rookie-traits.mjs`), `service-clock` (`lib.mjs`, `build.mjs`),
  `blockage` (`build.mjs`).
- Spikes that a code comment cites: `abs-reports` (`analysis.mjs`),
  `abs-aaa-gate` (the venue rule is a presence test, not a formula),
  `umpire-accuracy`, `metric-engines`, `umpire-tendencies`, `lineup-strength`
  (notes only, no code).

I did not read these for formulas:

- `top-prospects-history` and `prospect-value`: list parsing and earnings
  joins, with no counterpart in `src/` or `scripts/`.
- `contracts-extensions`: its price of a win has no counterpart in the app.
- `game-notes`: text scans.
- `service-clock-pedigree`: its models read `service-clock`'s panel.
- The `level-benchmarks` `org-*`, `homegrown-*` and `sensitivity` scripts, and
  the `team-success` `analyze-*` scripts past a search for innings, rates and
  ages.
- The spikes with no baseball math: `design-system`, `homefeed`,
  `team-one-scroll`, `offseason-design`, `home-transactions`,
  `team-identity-lab`, `team-page-ia` and the other UI spikes.
