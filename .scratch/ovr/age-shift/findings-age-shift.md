# OVR step 3: age-shift table from Savant percentile boards 2015-2025 (issue #1716)

Label key: **checked** = computed by the scripts in `scripts/`. **inference** = reading of the numbers, not tested.
Source: `percentile-rankings?type=batter|pitcher&year=2015..2025&csv=true` (22 files, cached in `cache/`).
Birth dates: `people?personIds=...&fields=people,id,birthDate` (3,719 ids, all found).
Column map is the one in `scripts/gen-savant-percentiles.mjs`. Savant percentile: higher is better for every metric.
Run order: `scripts/run_all.sh` (python3 + numpy; no scipy, so Spearman, OLS and logistic are in `scripts/lib.py`).

## 1. Setup (checked)

- Unit: delta = pct(t+1) - pct(t), in percentile points per year, grouped by age at t.
- Age used: `season - birth year`. Alternative: age on July 1 of season t.
  It matters. 24-26% of rows change band. Pooled adjusted table: largest cell change 0.9 (fbVelo), 1.4 (sprint),
  2.3 (hitting skills), 2.6 (pitching skills) points. Raw single-metric cells change up to 5.1 (hardHit). Most of it is the thin tail bands.
- Pairs: 2015-16 ... 2024-25, minus every pair that touches 2020. "With 2020" adds 2019-20 and 2020-21.
  Effect of the 2020 pairs: mean cell change 0.7 points, largest 3.3 (pit xera), among cells with n >= 30 (checked).
- Cells with n < 30 are marked thin (`*`). Only the pitcher qualified-board `<=22` band is thin (n = 21 per metric).
- Row counts per metric: hitters 1,989 at-risk rows (qualified metrics), 5,265 (sprint). Pitchers 2,858 (qualified), 5,488 (fbVelo).

## 2. Delta method, raw (checked)

Mean delta in points, bands `<=22 | 23-24 | 25-26 | 27-28 | 29-30 | 31-32 | 33-34 | 35-36 | 37+`. 2020 pairs excluded.
Standard errors and n per cell are in `age-shift-per-metric.csv`.

| metric | <=22 | 23-24 | 25-26 | 27-28 | 29-30 | 31-32 | 33-34 | 35-36 | 37+ |
|---|---|---|---|---|---|---|---|---|---|
| H xwoba | +5.4 | +1.9 | +1.9 | -2.9 | -1.2 | -4.5 | -5.9 | -10.7 | -10.2 |
| H ev | +4.9 | +0.4 | +1.0 | -1.4 | -1.6 | -4.6 | -3.5 | -2.0 | -10.9 |
| H hardHit | +2.9 | -1.0 | +0.1 | -1.3 | -1.0 | -4.0 | -5.0 | -0.8 | -13.0 |
| H brl | -0.2 | +0.7 | +0.7 | -2.9 | -0.4 | -4.2 | -4.8 | -5.9 | -6.3 |
| H chase | +1.0 | +1.1 | -0.5 | +1.4 | +1.2 | 0.0 | -1.2 | -5.2 | -0.1 |
| H sprintSpeed | -3.1 | -3.0 | -4.3 | -4.3 | -4.2 | -4.3 | -3.9 | -2.3 | -4.7 |
| P xera | +7.0* | +2.4 | -1.0 | -2.8 | -4.5 | -5.0 | -6.0 | -4.7 | -10.7 |
| P k | +9.0* | +0.5 | -1.0 | -2.2 | -2.0 | -5.1 | -6.7 | -6.1 | -7.5 |
| P bb | +8.3* | +3.3 | +2.4 | -2.1 | -1.4 | -0.9 | -1.2 | -2.1 | -6.0 |
| P whiff | +10.4* | -0.5 | -0.4 | 0.0 | -2.4 | -3.2 | -5.6 | -5.1 | -4.7 |
| P chase | +15.9* | +1.6 | +3.5 | +1.7 | -1.4 | -3.6 | -4.4 | -0.8 | -5.8 |
| P fbVelo | -2.4 | -1.5 | -2.1 | -3.7 | -4.0 | -5.6 | -4.6 | -5.4 | -6.4 |
| P hardHit | -4.3* | -1.7 | +1.2 | +2.6 | -4.0 | -2.9 | +2.0 | -2.7 | -4.8 |

n per band, hitter qualified metrics: 36, 144, 278, 294, 268, 209, 111, 51, 31. Sprint: 149, 532, 867, 842, 643, 488, 306, 120, 70.
Pitcher qualified: 21, 149, 343, 406, 355, 272, 186, 74, 49. fbVelo: 62, 391, 844, 921, 692, 514, 316, 146, 85.

Reading (inference): every curve falls with age, but the raw level is shifted down by 1 to 4 points at all ages. That shift is not aging. Section 3 explains it.
The pitcher hardHit raw curve has no clear age shape (checked: it rises at 27-28 (+2.6) and 33-34 (+2.0) and falls elsewhere). It sits in the pitching-skill pool (6 metrics) but should not get its own table.

## 3. Bias analysis (checked unless marked)

### (a) Attrition, sprintSpeed and fbVelo
Share of players with the metric in t who also have it in t+1: hitters sprint 76.3%, pitchers fbVelo 72.4%.
By age band (<=22 ... 37+), hitters sprint: .88 .87 .81 .76 .74 .74 .69 .58 .51. Pitchers fbVelo: .76 .79 .74 .73 .72 .74 .70 .63 .52.
By starting percentile (0-25, 25-50, 50-75, 75+): hitters .64 .78 .78 .85. Pitchers .62 .72 .74 .82.
Players who disappear start lower: the leavers' mean start percentile is under the stayers' in 8 of 9 bands for both groups (up to 17 points; hitters sprint, 23-24: -17.0; pitchers fbVelo, 23-24: -10.9). The one exception is hitters sprint at 35-36 (+2.9).
Older players also leave more often (present rate .51 at 37+ against .88 at <=22 for hitters). So the stayers are a selected, better group (inference: this hides part of the decline).

### (b) Regression to the mean
Model: delta ~ age band + p + p^2 + pair-year dummies (p = start percentile, centred). Coefficient on p, per 25 points of start percentile:
hitters sprint -2.2, xwoba -8.8, ev -5.6; pitchers fbVelo -2.5, xera -13.4, k -7.6. Fast and stable metrics regress little; rate metrics regress a lot.
Controlling for p changes the age shape most for sprintSpeed. Raw centred sprint is flat (+0.9 ... -0.7). With p controlled it falls from +1.7 (<=22) to -3.2 (37+).
Reason (inference): young players start with high sprint percentiles, regress down, and hide their real gain.
Effect at a fixed start percentile, band prediction with band-by-p interaction (full table per metric: `age-shift-per-metric.csv`):
hitters sprint at p=50: -1.5 -3.0 -4.8 -5.0 -5.4 -5.6 -6.3 -4.1 -9.4. At p=75: -5.5 -5.0 -6.2 -5.9 -6.3 -6.0 -7.5 -3.4 -11.6.
pitchers fbVelo at p=50: -1.2 -1.3 -2.3 -4.4 -5.1 -7.0 -6.4 -8.3 -10.3. At p=75: -4.5 -3.2 -4.6 -5.6 -6.7 -8.3 -6.9 -10.0 -12.8.
The age gradient (young minus old) is about the same at p=50 and p=75. The common level is lower at p=75 (mean reversion). The age term can be p-free; mean reversion belongs in the blend's regression step.

### (c) Inverse-probability weighting
Logistic for "appears in t+1" on band, p, p^2 and season. Weights 1/p-hat, floor 0.02. Largest weight 2.4 to 4.3. Weighted cell mean and SE per metric are in the CSV.
IPW alone moves cells by up to about 3.5 points for qualified metrics (hitters xwoba 35-36: -10.7 raw, -7.4 weighted; pitchers xera 25-26: -1.0, +1.0). Sprint and fbVelo move by 0.1 to 0.3 only.
The SE ignores the uncertainty of the weights (limit).

### (d) Pool composition
Percentiles are ranks inside each year's pool. The pool mean is about 50 each year: 49.4 to 50.0 at t, and the same at t+1 (checked).
So the n-weighted sum of deltas over everybody is about zero by construction. The table for stayers is not zero:
n-weighted mean delta of stayers is hit skills -1.3, sprint -4.0, pitch skills -1.5, fbVelo -3.6.
Cause (checked numbers): stayers start above the pool mean (xwoba 54.4 vs 49.6) and drift back toward 50. Sprint entrants at t+1 average 53.8 against 48.9 for stayers, so the entrants take the rank space.
Meaning (inference): the table gives age shifts relative to peers in the same year. It does not give absolute change in sprint speed or velocity. A raw, uncentred table would push every player down by 1 to 4 points per year.
The final table is therefore centred: the n-weighted mean over bands is zero, with the band mix of the sample (mean row age 28.0 to 28.9).
Consequence (inference): the zero crossing of a centred curve sits at the mean age of the sample. It does not prove a peak age.

### (e) Missing next year, qualified-only metrics
Hitters with a qualified metric in t: 71.5% have it in t+1. 24.2% are on the board but not qualified. 4.3% are not on the board at all.
Pitchers: 65.0% present. 23.3% on the board, not qualified. 11.7% off the board.
By age band, hitters present: .90 .77 .79 .74 .74 .68 .59 .57 .49. Pitchers: .68 .70 .69 .63 .68 .66 .67 .49 .49.
By start percentile (0-25 ... 75+): hitters xwoba .55 .68 .77 .86; pitchers xera .53 .64 .70 .74.
Second selection step: a player who falls under the qualifying line in t+1 drops out of the delta sample. Playing time follows performance and age, so the loss is not random.
IPW on observed p, age and season corrects the part that p and age explain. It cannot correct a loss that depends on injury or demotion. That part stays an open limit.

## 4. Final tables (checked)

Final adjusted = band coefficients from the regression with p, p^2, pair-year dummies and IPW, pooled across metrics inside each group, centred. Cluster-robust SE by player.
Groups: hitting skills (xwoba, ev, hardHit, brl, chase), sprintSpeed, pitching skills (xera, k, bb, whiff, chase, hardHit), fbVelo.
Values are percentile points per year of age at t, relative to peers.

| group | <=22 | 23-24 | 25-26 | 27-28 | 29-30 | 31-32 | 33-34 | 35-36 | 37+ |
|---|---|---|---|---|---|---|---|---|---|
| hitting skills | +4.2 | +2.0 | +1.0 | -0.7 | +1.2 | -1.6 | -2.6 | -1.2 | -5.3 |
| SE | 2.0 | 1.1 | 0.7 | 0.6 | 0.7 | 0.8 | 1.1 | 1.8 | 2.0 |
| sprintSpeed | +1.7 | +1.7 | +0.2 | +0.1 | -0.4 | -0.9 | -1.2 | -0.6 | -3.2 |
| SE | 1.1 | 0.5 | 0.3 | 0.3 | 0.4 | 0.4 | 0.5 | 0.6 | 0.6 |
| pitching skills | +5.6 | -0.1 | +0.6 | +1.5 | -0.4 | -1.2 | -0.8 | -1.4 | -4.0 |
| SE | 3.0 | 1.2 | 0.7 | 0.7 | 0.7 | 0.8 | 1.0 | 1.6 | 2.0 |
| fbVelo | +2.4 | +3.1 | +2.1 | +0.2 | -0.5 | -2.5 | -2.3 | -3.6 | -4.9 |
| SE | 1.5 | 0.6 | 0.4 | 0.4 | 0.4 | 0.4 | 0.5 | 0.7 | 0.6 |

Band means are noisy for the skill groups (29-30 hitters and 27-28 pitchers jump against their neighbours). Use the smooth fit (quadratic in age, same adjustments, centred; SE in `age-shift-smooth.csv`):

| age at t | 21 | 23 | 25 | 27 | 29 | 31 | 33 | 35 | 37 | 39 |
|---|---|---|---|---|---|---|---|---|---|---|
| hitting skills | +3.1 | +2.3 | +1.4 | +0.6 | -0.2 | -1.0 | -1.9 | -2.7 | -3.5 | -4.3 |
| sprintSpeed | +2.1 | +1.4 | +0.8 | +0.2 | -0.3 | -0.8 | -1.2 | -1.6 | -1.9 | -2.1 |
| pitching skills | +1.1 | +1.1 | +0.9 | +0.6 | +0.2 | -0.4 | -1.0 | -1.8 | -2.7 | -3.8 |
| fbVelo | +5.5 | +3.7 | +2.1 | +0.7 | -0.6 | -1.7 | -2.7 | -3.5 | -4.1 | -4.6 |

How the bias steps change the table (hitting skills, 37+): raw centred -6.8, IPW only -6.0, regression with p -5.6, regression plus IPW -5.3. Sprint 37+: -0.7, -0.6, -3.3, -3.2.
So the p control matters (sprint, pitchers); IPW matters little once p is in. Neither step changes the sign of any band.

## 5. Comparison with WAR and Marcel

WAR numbers are the ones given in the issue (not recomputed here).
- Six WAR bands (20-24, 25-26, 27-28, 29-30, 31-32, 35-36) against our hitting-skill bands: Pearson 0.91 (raw, uncentred), 0.85 (final adjusted). Spearman 0.94 and 0.77. n = 6 points, so this is a direction check only.
- Mean yearly change, ages 30-37 against ages 21-28 (smooth fits): hitters -2.06 / +1.65 (ratio -1.25), pitchers -1.30 / +0.88 (-1.47), sprint -1.28 / +0.95 (-1.35), fbVelo -2.76 / +2.62 (-1.06).
  WAR (issue numbers): about -0.38 / +0.35 (ratio about -1.1). Marcel: -0.3 / +0.6 (ratio -0.5).
- Inference: the shape follows the WAR check (accelerating decline, ratio near -1 to -1.5), not the Marcel ratio of -0.5.
  The zero crossing (age 27 to 29) is set by the centring, so it neither confirms nor refutes the WAR peak (27-28) or the Marcel peak (29).
  Our table is relative to peers and in percentile points. WAR and Marcel are absolute. Do not compare the sizes.

## 6. Plug-in test (checked)

Sample: hitters with sprintSpeed in 2023, 2024, 2025 (n = 400); pitchers with fbVelo in all three (n = 362). Qualified metrics: n = 130 hitters, 148 pitchers.
Recency weights 5/4/3 on 2025/2024/2023. Shift: each older season moved to the player's 2025 age by adding the smooth table's yearly values. No clipping.
Table fit on all pairs 2015-2025 ("all") and on pairs up to 2021-22 only ("pre-2023", no overlap with the test seasons).

| set | table | Spearman | mean abs change | max abs | players > 3 pts |
|---|---|---|---|---|---|
| hitters sprintSpeed (400) | all | 1.000 | 0.58 | 1.83 | 0 |
| | pre-2023 | 1.000 | 0.56 | 1.85 | 0 |
| pitchers fbVelo (362) | all | 0.998 | 1.41 | 3.97 | 24 |
| | pre-2023 | 0.999 | 1.32 | 3.79 | 13 |
| hitters skill metrics (130 each) | all | 0.998-0.999 | 0.94 | 3.13 | 2 |
| | pre-2023 | 0.998-0.999 | 0.97 | 2.77 | 0 |
| pitchers skill metrics (148 each) | all | 0.999 | 0.66 | 3.62 | 2 |
| | pre-2023 | 0.999 | 0.66 | 2.85 | 0 |

Naive uncentred raw table for contrast: every hitter sprint and pitcher fbVelo score moves by 3.3 to 3.4 points on average (a uniform level shift, Spearman still 1.0). Do not use an uncentred table.

Holdout check (extra, checked): predict 2025 from 2024/2023 (4:3), table fit on pairs up to 2021-22.
fbVelo: RMSE 13.07 without shift, 12.38 with shift (bias -5.03 to -3.97; mean-removed RMSE 12.06 to 11.73; Spearman to 2025 .913 to .919).
sprintSpeed: 12.76 to 12.86 (no gain). Hitting skills: RMSE moves between -0.2 and +0.03. Pitching skills: -0.16 to +0.01.

Meaning (inference): the shift reorders almost nothing (Spearman >= 0.998). It moves a typical score by under 1.5 points. Only pitcher fbVelo shows a clear holdout gain, about 5% RMSE.
For hitters the table is within noise.

## 7. Final form of the age term (options and recommendation)

| option | what it does | pro | con |
|---|---|---|---|
| A. Blend adjustment | shift older seasons to the current age before the 5/4/3 blend, using the centred table | simple; fixes the stale-season bias for veterans and youngsters | moves scores by under 1.5 points on average; only fbVelo shows a holdout gain |
| B. POT only | use age only in the potential/ceiling for prospects and youngsters | no effect on settled veterans; uses the large young-age gains (+2 to +5 points per year at 21-23) | does nothing for the decline side; MiLB has no Statcast table |
| C. Both | A for physical metrics, B for prospects | covers both ends | two places to tune |
| D. None | no age term | no extra parameters; a table of 1-point effects is under the noise of one season | veteran fbVelo and sprint ratings stay stale by 1-4 points |

**Recommendation (inference, not tested beyond the holdout above):**
Option C in a small form. Apply the table only to the two physical metrics, sprintSpeed and fbVelo, in the blend (fbVelo is where the holdout gain is).
Use the smooth centred table, not the bands. Keep the p-free form. Do not apply a table to the skill metrics in the blend (gain is inside the noise). Use the age term in POT for players 25 and under.
Reason: the physical metrics have the largest, cleanest age slope and the smallest SE. The skill metrics have a weak, noisy slope after the bias fixes.
Bat speed, squared-up and swing length have 3 seasons (2023-2025). No table is possible. They get no age shift.
Also no own table: pitcher hardHit (no age shape).

## 8. Limits

- Percentile deltas are relative to the pool. They are not absolute change in the skill (section 3d).
- Qualified-board metrics lose 29-35% of players each year. IPW covers only observed p, age and season.
- The first and last bands are thin or noisy (SE 1.5 to 3.0 for qualified groups). Pitcher `<=22` has n = 21 per metric.
- Metrics inside a group are correlated, so the pooled n is not independent. The cluster-robust SE handle repeated players; they do not remove metric overlap.
- Age is `season - birth year`. July-1 age moves cells by up to 2.6 points (pooled).
- The plug-in "all" table was fit with the test seasons inside. The pre-2023 table and the holdout test avoid that.
- Savant may revise past ranks (not checked). Each board was fetched once, 2026-10-07.
- WAR numbers were taken from the issue, not recomputed.

## 9. Files

`age-shift-tables.json/.csv` (group band tables), `age-shift-smooth.csv` (by age), `age-shift-per-metric.csv` (per metric: n, raw, SE, thin, IPW, regression, p=50/75, with-2020, July-1),
`out_*.json` (raw script output), `scripts/` (code).
