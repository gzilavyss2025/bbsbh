# OVR research, part B: level ceilings and calibration

**Date:** 2026-10-07. **Issue:** gzilavyss2025/bbsbh#1685, research part B. **Spec read:** `docs/ovr-rating.md`
on `main` (PR #1684). **Status:** research only. No `src/` change, no generator, no edit to the spec.

Data as of: `public/data/savant-percentiles.json` generated 2026-10-06T15:17Z, `public/data/war.json`
2026-10-06T15:13Z (both 2026 season, regular season over). Minor-league pools: 2009 to 2019 seasons.

Label rule used below: a number with a file path is data. A line marked **(Inference)** is my reasoning
and has no direct test in the data. Part A (Pipeline grades, fielding source, prior seasons, MiLB fields)
is another session's job. I did not touch it.

## Short answers

1. **Ceilings.** The 881-player cohort cannot give a ceiling alone. It holds only players who reached the
   majors, so it has no denominator. I added the denominator from the full level pools. The share of a
   level's players who cross the rookie threshold is: AAA 33%, AA 30%, High-A 22%, A 16.5%, Rk complex
   (Arizona and Gulf Coast leagues) 8.6%. With AAA held at the spec's 58, the spacing gives AA 55, A+ 45,
   A 39, Rk 30. AA, A+ and A move **up** 4 to 5 points. Rk does not move. The AAA to AA gap shrinks from
   8 points to 3. **(Inference)** The rule that
   turns a share into points is an assumption. The ordering and the ratios are data.
2. **Calibration.** The draft OVR tracks WAR and is not WAR relabelled. Hitters: r = 0.51 with WAR, 0.61
   with wRC+ (n = 246). Pitchers: r = 0.77 with WAR per 200 IP (n = 325). Hitters miss on defense (the
   spec has no data for it yet) and on results that differ from quality of contact. Relievers miss on
   home runs. The roll-up has a scale
   problem: hitter OVR has a standard deviation of 6.0, not 12, and no hitter reaches 80. Fix that before
   you change any weight.

## Method and files

| File | Job |
| --- | --- |
| `.scratch/ovr/pull-pools.mjs` | Pulls the A (sportId 14) and Rk (16) pools, 2009-2019, from the stats API. |
| `.scratch/ovr/pull-mlb-lines.mjs` | Pulls 2026 MLB names, PA, IP, position and ERA, for labels and playing-time floors. |
| `.scratch/ovr/conversion.mjs` | Share of each level's players who reach the majors, by unit, definition and floor. |
| `.scratch/ovr/ceilings.mjs` | Turns the shares into ceilings. Prints every table in Answer 1. |
| `.scratch/ovr/rating.mjs` | The spec's OVR math: bell curve, bucket means, weighted roll-up. Throwaway. |
| `.scratch/ovr/stats.mjs` | Pearson, Spearman, rank, OLS. |
| `.scratch/ovr/calibrate.mjs` | Draft OVR vs `war.json`. Prints every table in Answer 2. |

Run, from the repo root: `OVR_CACHE=/tmp/ovr-cache node .scratch/ovr/pull-pools.mjs`, then
`pull-mlb-lines.mjs`, then `ceilings.mjs` and `calibrate.mjs`. The two pull scripts need network.
Nothing writes into the repo. The cache stays outside it.

---

## Answer 1: level ceilings

### What the cohort can and cannot support

The cohort is `docs/level-tenure-benchmark.md` and `public/data/level-tenure-benchmark.json`: 881 players
who debuted 2019-2023 and crossed the real rookie threshold (130 AB or 50 IP).

- **It cannot give "the share of a level's players who reach the majors".** Every player in it reached the
  majors. A level's share needs the players who did not. The doc says this itself: "Busts ... Unbuilt."
- **It does show how many arrivals pass through each level.** Source: `n` in
  `public/data/level-tenure-benchmark.json`, hitters plus pitchers, over 881.

| Level | Cohort players with a stint | Share of the 881 |
| --- | --- | --- |
| A | 318 + 362 = 680 | 77% |
| High-A | 352 + 418 = 770 | 87% |
| AA | 366 + 437 = 803 | 91% |
| AAA | 355 + 408 = 763 | 87% |

  AA is the level almost every arrival crosses, and it has the longest median stay (410 PA, 205 outs).
  **(Inference)** That fits AA being a real filter, but the cohort has no non-arrivals to prove it.
- **Rk is outside the cohort by design.** The doc excludes sportId 16. The cohort cannot support an Rk
  number at all. The Rk figures below come from a separate pool and stand on that pool alone.

### What I used instead

For each level and season 2009-2019:

- **Denominator:** every player with a season line at the level (hitters 100 PA or more, pitchers 30 IP or
  more), minus players who already had an MLB game before that season. Sources:
  `.scratch/level-benchmarks/perf-pool.json` (AAA, AA, High-A; every player, built with
  `playerPool=all`) and a new pull for A and Rk (`pull-pools.mjs`, same call
  `fetchLevelSeasonStats` in `src/api/statsLevels.js`).
- **Numerator:** the player later crosses the rookie threshold. Source: `public/data/rookies.json`
  (`debutDate` and `rookieUntil` for every MLB debutant to 2026). This is the cohort's own definition.
  The "any MLB game" definition is in the sensitivity table.
- **Why 2009-2019 only:** the file runs to October 2026. A 2019 player has 7 years to arrive. A re-run
  that ends at 2013 (13 years) moves the ceilings by at most 2.6 points (see "Right-censoring check").
- **Unit:** a distinct player seen at the level. This reads the question literally: of the players at a
  level, how many arrive.

### The measured shares

| Level | Players (H+P) | Reach (rookie threshold) | 95% interval | Ratio to AAA |
| --- | --- | --- | --- | --- |
| AAA | 4,046 | 33.1% | 31.7-34.6% | 1.00 |
| AA | 5,714 | 30.3% | 29.1-31.5% | 0.91 |
| High-A | 7,447 | 21.7% | 20.8-22.7% | 0.66 |
| A | 8,426 | 16.5% | 15.7-17.3% | 0.50 |
| Rk, all of sportId 16 | 11,952 | 6.9% | 6.5-7.4% | 0.21 |
| Rk complex only (Arizona + Gulf Coast leagues) | 4,647 | 8.6% | 7.8-9.4% | 0.26 |

`sportId` 16 also holds the Dominican Summer League (800 of 1,662 hitters in 2019), whose players arrive
less often. The spec's "Rk / complex" means the US complex leagues, so I use the complex-only row.

Each step down the ladder lowers the share, except AAA to AA, where the two are close. AAA holds the
organisation's depth players, and the pool shows it: 4A veterans and lifelong AAA pitchers dilute the
share. The interval is a plain binomial one. Players are not fully independent, so treat it as a floor.

Reach by in-level performance (hitters by OPS, pitchers by ERA, each level-season ranked within itself;
`conversion.mjs`):

| Level | Bottom half | 50th-90th | Top decile | Top 5% | n in top decile |
| --- | --- | --- | --- | --- | --- |
| AAA | 14.9% | 28.5% | 38.3% | 41.1% | 833 |
| AA | 16.5% | 31.8% | 48.9% | 51.1% | 958 |
| High-A | 11.4% | 24.4% | 36.8% | 38.2% | 1,007 |
| A | 10.2% | 19.1% | 28.5% | 30.3% | 1,022 |
| Rk, all of sportId 16 | 3.9% | 6.7% | 12.4% | 14.7% | 1,939 |
| Rk complex only | 5.2% | 9.5% | 16.3% | 17.6% | 516 |

The top of AA reaches the majors **more** often than the top of AAA. **(Inference)** Age explains it: the
best AAA lines often belong to older players with no path. This is a second reason the spec's 8-point gap
between AAA and AA has no support in the data.

### From share to ceiling

**(Inference)** The rule: the headroom above the floor of 20 scales with the share.
`ceiling(L) = 20 + (58 - 20) * share(L) / share(AAA)`. I hold AAA at 58 because nothing in these files
fixes an absolute level. Answer 2 gives the only anchor I found: hitters with 0 to 1 WAR have a median
draft OVR of 56.3, and pitchers 58.1. Both are about the spec's 58. That pool is Savant-qualified players,
so it likely runs a little high for true replacement level.

| Level | Spec guess | Derived | Move | Range over 12 variants |
| --- | --- | --- | --- | --- |
| MLB | 99 | 99 | 0 | (scale top) |
| AAA | 58 | 58 | 0 | anchor |
| AA | 50 | 54.8 | +4.8 | 53.6 - 63.4 |
| High-A | 40 | 45.0 | +5.0 | 44.3 - 52.5 |
| A | 35 | 39.0 | +4.0 | 38.8 - 46.8 |
| Rk complex (all of sportId 16: 27.9) | 30 | 29.9 | -0.1 | 28.9 - 37.6 (27.6 - 32.2 for all of 16) |

Which guesses move, and why:

- **AA: up about 5.** The guess puts AA 8 points under AAA. The data put the two within 9% of each other
  (0.91), and the AA top decile beats the AAA top decile. A gap of about 3 fits better.
- **High-A: up about 5.** It reaches 66% as often as AAA. The guess gave it 53% of the headroom
  ((40-20)/(58-20)).
- **A: up about 4.** Same reason: 50% of AAA's rate against 39% of its headroom in the guess.
- **Rk: no move.** About 1 in 12 complex-league players arrives, a quarter of AAA's rate. Counting the
  Dominican league as well gives 28, so the guess of 30 sits inside the range.
- **Gary's "an A+ player tops out near 40" example is at the low end.** The derived value is 45. Every
  variant I ran gives 44 or more. This is a design call for Gary, not a data question.

### Sensitivity and checks

All 12 variants (unit: player or player-season; reach: rookie threshold or any MLB game; floors 50/15,
100/30, 200/50 PA/IP), AAA held at 58. Full table: run `ceilings.mjs`.

- **Player unit (6 variants):** AA 53.6-55.3, High-A 44.3-45.4, A 38.8-39.8, Rk (all of 16) 27.6-29.1.
  Tight.
- **Player-season unit (6 variants):** AA 60.5-63.4, High-A 49.7-52.5, A 44.2-46.8, Rk 28.7-32.2. This
  unit counts a long-staying AAA veteran once per season, so it inflates AAA's denominator and pushes AA
  above AAA. I do not use it for the headline. It shows the direction is robust: AA, High-A and A sit
  higher than the guess in every variant.
- **Unanchored contrast, `ceiling = 20 + 79 * share`** (share 100% maps to 99): AAA 46, AA 44, High-A 37,
  A 33, Rk 26 with the rookie definition; AAA 60, AA 56, High-A 45, A 40, Rk 28 with the any-game
  definition. This shows the weakness of the method. The absolute level swings 14 points on one
  definition choice. The ratios between levels move far less. **Trust the ratios, not the absolute.**
- **Right-censoring check** (`OVR_MAX_SEASON`, same rule, AAA = 58): seasons to 2019 gives AA 54.8 /
  High-A 45.0 / A 39.0 / Rk 27.9. To 2017: 55.8 / 45.6 / 39.6 / 28.8. To 2015: 56.5 / 46.1 / 40.7 / 29.0.
  To 2013: 57.4 / 46.9 / 41.4 / 30.1 (Rk, all of 16). More follow-up lifts the lower levels by up to 2.6
  points and does not change a conclusion.
- **The spec's formula floors every level at 20.** Rating is `20 + (ceiling - 20) * percentile / 100`. But
  a bottom-half AAA player reaches the majors about 15% of the time and a bottom-half A player about
  10% (table above). The shared floor of 20 treats them as equal. **(Inference)** If you want OVR to mean
  the same thing across levels, the floor should rise with the level. I did not model that. It is a spec
  change for Gary.

### What this does not show

- It does not test the share-to-points rule. No ground truth for "current ability on the MLB scale"
  exists in these files. A minor-league equivalency study (stat translation to MLB) would give one.
- Share to arrive measures distance to the majors, which mixes current talent and future growth.
  **(Inference)** Ceilings built from it are closer to a POT-flavoured number than a pure current-ability
  number.
- The pool has no age. Age explains part of the AAA oddity above.
- Rk complex is the Arizona League (id 121) and the Gulf Coast League (id 124). It leaves out the
  Appalachian and Pioneer leagues and the Venezuelan league. League ids come from
  `/api/v1/teams?sportId=16&season=2019`. The stats API files leagues under sportId 16 differently from
  year to year, so I did not try to rebuild a per-year list. The spec lists no short-season A level.

---

## Answer 2: calibration against WAR

### Setup

- **Input:** `public/data/savant-percentiles.json` (`bat`, `pit`). Direction check: for every metric the
  correlation of percentile with raw value has the sign of "higher is better". Hitter chase and pitcher
  xera, bb and hardHit are negative with raw, as they should be. So the percentile feeds the curve
  unflipped.
- **Curve (spec):** rating = 60 + 12 * z(percentile), capped at 99, floored at 20.
- **Buckets (spec):** hitters: Contact = mean(`xwoba`, `squaredUp`), Power = mean(`ev`, `hardHit`, `brl`,
  `batSpeed`), Discipline = `chase`, Speed = `sprintSpeed`. Pitchers: Stuff = mean(`whiff`, `k`, `fbVelo`,
  `hardHit`), Results = `xera`, Control = `bb`. The spec's pitcher table does not use pitcher `chase`,
  so I left it out.
- **Weights (spec):** hitter Power 25, Contact 25, Discipline 15, Speed 15, Fielding 20 (no data, so its
  20 spreads over the other four: 31.25, 31.25, 18.75, 18.75). Pitcher Stuff 40, Results 35, Control 25.
- **Coverage problem found:** 366 of 612 hitters in the file have only `sprintSpeed`, and 364 of 703
  pitchers have only `fbVelo`. The spec's "share a missing bucket's weight" rule would rate each of them
  on one metric. I rated only hitters with Contact and Power (246) and pitchers with all three buckets
  (339). **That is under half of the pool.** Part A (prior seasons) is the likely fix.
- **Target:** `public/data/war.json`: `bat` and `pit` (WAR, MLB's own calculation, FIP-based for
  pitchers: `scripts/gen-war.mjs:110`), `wrc` (wRC+, offense only), `fld` (fielding runs).
  Names, PA and IP come from a 2026 stats pull (`pull-mlb-lines.mjs`). WAR is a counting number, so I also
  use WAR per 600 PA and WAR per 200 IP. Pools: hitters 200 PA or more, pitchers 50 IP or more.

### Correlation

| OVR vs | n | Pearson r [95% interval] | Spearman | r squared |
| --- | --- | --- | --- | --- |
| Hitters: WAR (season) | 246 | 0.51 [0.41, 0.60] | 0.51 | 0.26 |
| Hitters: WAR per 600 PA | 246 | 0.49 [0.39, 0.58] | 0.48 | 0.24 |
| Hitters: wRC+ | 246 | 0.61 [0.53, 0.68] | 0.60 | 0.37 |
| Pitchers: WAR (season) | 325 | 0.61 [0.54, 0.68] | 0.59 | 0.37 |
| Pitchers: WAR per 200 IP | 325 | 0.77 [0.72, 0.81] | 0.71 | 0.59 |
| Starters (GS 10+): WAR per 200 IP | 185 | 0.83 [0.78, 0.87] | 0.79 | 0.69 |
| Relievers (GS under 5): WAR per 200 IP | 121 | 0.83 [0.76, 0.88] | 0.77 | 0.69 |

Median OVR by season WAR (same pools):

| WAR | Hitters (n, median OVR) | Pitchers (n, median OVR) |
| --- | --- | --- |
| under 0 | 14, 53.8 | 36, 51.7 |
| 0 to 1 | 57, 56.3 | 122, 58.1 |
| 1 to 2 | 50, 59.4 | 79, 59.8 |
| 2 to 3 | 54, 60.9 | 55, 62.3 |
| 3 to 5 | 56, 62.4 | 25, 66.8 |
| 5 and up | 15, 67.0 | 8, 73.7 |

The order is right in every row. Better WAR gives better OVR.

### Does OVR track WAR without being WAR relabelled?

**Yes on both counts.** My thresholds for "tracks" (Spearman 0.5 or more) and "relabelled" (0.9 or more)
are a judgement. **(Inference)**

- **Tracks.** Hitters sit at 0.5 to 0.6, pitchers at 0.7 to 0.8. Every WAR band orders correctly.
- **Not relabelled.** OVR explains 24 to 37% of hitter variance and 37 to 69% of pitcher variance. The
  rest is real difference: defense, baserunning, position and results versus quality of contact.
- **Hitters are the looser side, and defense is the biggest reason.** Taking `fld` out of WAR
  (`WAR - fld/10`) lifts r from 0.49 to 0.55. In an OLS of WAR per 600 PA on the four buckets plus `fld`
  per 600 PA, dropping `fld` loses 0.19 of R squared, the most of any term (Contact loses 0.17).
  `fld` is part of WAR by definition, so this shows that fielding matters to WAR. It does not show that
  it should matter to a rating.
- **Pitchers are the closer side.** **(Inference)** Part of that is built in. xERA, K and BB feed both
  OVR and a FIP-based WAR.

### The 10 biggest disagreements

Rank gap = OVR percentile rank minus WAR-rate percentile rank inside the pool. Negative means WAR likes
him more than OVR does. Causes are my reading of the columns shown. **(Inference)** for all of them.

**Hitters (WAR per 600 PA, n = 246).** Columns: OVR; buckets Contact/Power/Discipline/Speed; WAR/600;
wRC+; `fld`; xwOBA.

| Player | Pos | OVR | Buckets | WAR/600 | wRC+ | fld | xwOBA | Gap | Likely cause |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ceddanne Rafaela | CF | 51.2 | 51/48/32/75 | 4.27 | 109 | +11.6 | .285 | -80.5 | Glove: +11.6 fielding runs, and no Fielding bucket yet. Bat also beat its xwOBA. |
| Jonny DeLuca | RF | 47.8 | 32/45/49/78 | 3.89 | 102 | +10.0 | .261 | -80.5 | Glove again (+10.0), on 370 PA. |
| Trent Grisham | CF | 69.9 | 74/64/88/55 | 0.87 | 98 | -8.4 | .337 | +74.8 | Bat under-produced its xwOBA (OPS .703) and the glove costs 8.4 runs. |
| Andrés Giménez | SS | 46.0 | 48/41/35/62 | 3.31 | 81 | +14.1 | .276 | -72.8 | Glove: +14.1 at shortstop on a bat 19% below average. |
| Nolan Arenado | 3B | 50.2 | 53/49/55/42 | 3.51 | 120 | +2.3 | .300 | -70.3 | Results beat quality of contact: wRC+ 120 on a .300 xwOBA. |
| Alec Bohm | 3B | 63.7 | 71/61/67/53 | 0.19 | 90 | -7.4 | .327 | +70.3 | The reverse: wRC+ 90 on a .327 xwOBA, plus -7.4 fielding runs. |
| Keibert Ruiz | C | 47.0 | 46/53/43/42 | 3.22 | 105 | -1.4 | .289 | -69.9 | Catcher. MLB's WAR includes a positional term, which OVR lacks; bat also beat its xwOBA. |
| Isaac Paredes | 3B | 53.7 | 64/43/65/41 | 4.01 | 130 | -0.7 | .323 | -67.5 | wRC+ 130 on a low Power bucket (43): pulled fly balls that exit velocity understates. |
| Taylor Ward | RF | 68.5 | 72/52/99/60 | 0.99 | 102 | +0.4 | .334 | +66.3 | Chase percentile 99 inflates Discipline, but the bat under-produced (OPS .670). |
| Ty France | 1B | 55.1 | 57/67/50/37 | 4.32 | 141 | +6.8 | .327 | -63.8 | Bat beat its xwOBA by a wide margin (wRC+ 141), and Speed 37 drags OVR. |

Pattern. Five of ten (Rafaela, DeLuca, Grisham, Giménez, Bohm) have `fld` of 7 runs or more in size,
France is at 6.8, and Ruiz is a catcher. Seven (Arenado, Bohm, Grisham, Paredes, Ward, France, Ruiz) turn
on results versus expected quality of contact. Both causes are real MLB signal that Statcast percentiles cannot
see. The first fixes itself when the Fielding bucket lands. The second does not, and I would not try to
fix it: it is why expected stats exist.

**Pitchers (WAR per 200 IP, n = 325).** Role by games started. Columns: OVR; Stuff/Results/Control;
WAR/200; xERA, ERA, HR.

| Player | Role | IP | OVR | Buckets | WAR/200 | xERA / ERA / HR | Gap | Likely cause |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Steven Cruz | RP | 58.2 | 64.7 | 70/61/62 | -1.37 | 4.06 / 4.30 / 14 | +70.8 | 14 HR in 58 IP; FIP-based WAR charges for HR, OVR has no HR input. |
| Paul Sewald | RP | 53.1 | 62.4 | 57/59/75 | -1.88 | 4.12 / 4.73 / 13 | +63.1 | 13 HR in 53 IP; the HR cost sits outside every OVR metric. |
| Tyler Kinley | RP | 57.1 | 62.7 | 67/69/48 | -1.40 | 3.47 / 3.45 / 10 | +63.1 | ERA matches xERA; 10 HR and weak Control (48) make the FIP poor. |
| Chase Shugart | RP | 53.2 | 63.1 | 65/65/58 | -0.38 | 3.78 / 4.02 / 10 | +61.2 | 10 HR in 53 IP, on a 53 IP sample. |
| Jovani Morán | RP | 65.2 | 63.9 | 70/70/45 | 0.31 | 3.35 / 3.15 / 9 | +58.5 | Control 45 plus 9 HR. |
| Seranthony Domínguez | RP | 62.0 | 62.8 | 70/66/46 | 0.00 | 3.65 / 3.63 / 9 | +56.5 | Same shape: Control 46, 9 HR. |
| Andrew Alvarez | SP | 112.2 | 55.5 | 57/58/50 | 4.46 | 4.21 / 3.43 / 7 | -56.3 | ERA 0.8 under xERA and only 7 HR; WAR rewards both. |
| Enyel De Los Santos | RP | 71.1 | 66.7 | 62/69/71 | 0.84 | 3.42 / 4.79 / 11 | +55.7 | ERA 1.4 over xERA, 11 HR. |
| Kyle Leahy | SP | 140.0 | 54.6 | 51/49/69 | 3.71 | 4.89 / 3.66 / 15 | -52.6 | ERA 1.2 under xERA. |
| Davis Martin | SP | 146.0 | 54.4 | 51/52/64 | 3.56 | 4.69 / 3.95 / 14 | -51.7 | ERA 0.7 under xERA. |

Pattern. Seven of ten are relievers with 53 to 71 IP and 1.2 or more HR per nine, where one bad month
moves WAR a lot. Three are starters whose ERA beat their xERA by 0.7 to 1.2 runs. **(Inference)** The
reliever misses come from HR. None of the six OVR metrics counts HR directly (xERA and hard-hit rate only
proxy it). The starter misses are
results versus expected results again.

### Scale problem: the roll-up squeezes the band

Averaging imperfectly correlated buckets shrinks the spread. From `calibrate.mjs`, pools above:

| | Mean | SD | At 70 or more | At 80 or more | At 90 or more |
| --- | --- | --- | --- | --- | --- |
| Hitters | 59.7 | 6.0 | 10 | 0 | 0 |
| Pitchers | 60.1 | 7.8 | 34 | 3 | 0 |

A single-metric rating has SD 12 by design. The spec says "the 98th percentile is about 84". No hitter in
2026 gets near it: the top hitter is 78.4. The card would show almost nothing above 78, and the 99 cap
never applies. Stretching the roll-up about its mean by 2.0 (hitters) or 1.5 (pitchers) restores SD 12
and does not change a correlation. **(Inference)** Better: re-run the bell curve on the roll-up's own
pool percentile. That makes 84 mean "98th percentile overall".

### Which weights I would change

Shares come from OLS on one season (n = 246 and 325), with correlated predictors. **(Inference)** Treat
them as direction, not as values. I moved each spec weight about halfway to the data and rounded. Three deviate by hand: Discipline stays
at 10 (halfway is 7.5), Fielding is 25 (halfway is 27), and Results is 45 (halfway is 41; I leaned
toward the starter fit).

Hitters, with Fielding in (Fielding stands in for `fld600`):

| Bucket | Spec | Data share (WAR per 600 PA) | Proposed |
| --- | --- | --- | --- |
| Contact | 25 | 34% | 30 |
| Power | 25 | 17% (41% against wRC+) | 20 |
| Discipline | 15 | 0% | 10 |
| Speed | 15 | 15% | 15 |
| Fielding | 20 | 34% | 25 |

Reasons. Contact (xwOBA, squared-up) carries the signal. Discipline adds nothing once Contact is in: its
correlation with wRC+ is 0.16 and its OLS coefficient is zero. Speed holds its share through WAR's
baserunning term. Power splits by target: 41% against wRC+, 17% against WAR. I kept it at 20. I left
Discipline at 10, not 0, because the card shows it as a bar and a reader expects it to count. That is a
product call, not a data call. Fielding at 25 assumes the OAA source from part A is as good as MLB's
`fld`. It is noisier. **Until Fielding lands, drop it and renormalise:** Contact 40, Power 27, Discipline
13, Speed 20.

Pitchers:

| Bucket | Spec | Data share, all (starters) | Proposed |
| --- | --- | --- | --- |
| Stuff | 40 | 24% (20%) | 30 |
| Results | 35 | 47% (62%) | 45 |
| Control | 25 | 30% (18%) | 25 |

Reasons. xERA (Results) already contains strikeouts and walks, so Stuff adds little once it is in:
dropping Stuff loses 0.02 of R squared. I did not cut it further. Stuff is the part of the card that
looks ahead, and one season of WAR cannot test that.

## Revised numbers table

Ceilings, anchor AAA = 58 held (ratios from Answer 1). Weights, halfway from the spec to the data.

| Item | Spec | Revised | Basis |
| --- | --- | --- | --- |
| AAA ceiling | 58 | 58 | Anchor. OVR of 0 to 1 WAR regulars: 56 (hitters), 58 (pitchers). |
| AA ceiling | 50 | 55 | 91% of AAA's arrival share. Range 54 to 63. |
| High-A ceiling | 40 | 45 | 66% of AAA's share. Range 44 to 53. |
| A ceiling | 35 | 39 | 50% of AAA's share. Range 39 to 47. |
| Rk (complex) ceiling | 30 | 30 | 26% of AAA's share. Range 29 to 38 over variants; 28 if the Dominican league counts. Outside the cohort. |
| Hitter weights, with Fielding (Power/Contact/Disc/Speed/Field) | 25/25/15/15/20 | 20/30/10/15/25 | Table above. |
| Hitter weights, no Fielding yet (Power/Contact/Disc/Speed) | 31/31/19/19 | 27/40/13/20 | Same, renormalised. |
| Pitcher weights (Stuff/Results/Control) | 40/35/25 | 30/45/25 | Table above. |
| Roll-up scale | none | stretch to SD 12 (x2.0 hitters, x1.5 pitchers) or re-rank | Hitter SD 6.0. |
| Minimum data to rate | none | Contact+Power (hitters), all three buckets (pitchers) | 60% of hitters have Speed only. |

## Decisions that belong to Gary

1. **A+ ceiling.** Data say about 45. His example says near 40. Which one wins?
2. **Does the floor of 20 rise with the level?** The data say a bottom-half AAA player is not the same as
   a bottom-half A player.
3. **Stretch or re-rank the roll-up?** Either fixes the empty top of the band. A stretch is simpler. A
   re-rank is more honest.

## Limits

- One season of Savant data and one season of WAR. No out-of-sample test is possible until part A finds
  prior seasons.
- The ceilings rule is an assumption. Only the ordering and the ratios are data.
- The pools hold players with 100 PA or 30 IP in a season. A different floor changes ceilings by about
  1 point or less (see the variants).
- WAR is MLB's own calculation, not fWAR or bWAR (`scripts/gen-war.mjs`). It is the only WAR on file.
