# xwOBA (est.) calibration spike (issue #1411, Part C)

Date of all measurements: **2026-10-02**. This is a spike. It writes no product code.
Parent: #1408. Phase 2: #1411. The probes before this one are in PR #1412 (`notes.md`).

"**Verified**" means a script in this folder measured it. "**Inference**" means my own reasoning, not a test.
Raw output of every script is in `xwoba-output/`. Pulled data is in `/tmp/xwoba-cache/` and is not committed.

## Question

Can the sweep compute an estimated xwOBA from exit velocity and launch angle, and is it close
enough to Savant's own xwOBA to show on a hitter heat map labelled "xwOBA (est.)"?
If not, #1411 needs option B: a nightly Savant pull.

## Verdict

**Conditional pass. A table built from the current season passes. A table built from last season fails.**

- **Verified.** A table built from the same season matches Savant's board with a mean gap of 0.0035
  (hitter and pitch type, 40 or more plate appearances) and 0.0037 (10 or more). 99.8% and 99.5% of rows are within 0.020.
- **Verified.** A table built from 2025 and used on 2026 has a mean gap of 0.0068 (40 or more) and 0.0077 (10 or more).
  97.5% and 94.4% of rows are within 0.020. The worst row is off by 0.061. It fails the tolerance below.
- **Verified.** The same exit velocity and launch angle give a different estimate in 2026 than in 2025. No scale or shift fixes it.
  **Inference:** Savant refit its model. I did not find the cause. So the issue's plan to "commit a small static table" does not hold from one season to the next.
- **Consequence.** The lookup must be rebuilt from Savant data of the current season. That needs a Savant pull anyway.
  The cheapest pull is balls in play only (0.63 MB a day). That pull can give the **exact** estimate for each ball
  (see "Option B, cheaper than the issue says"). The lookup then has no job except as a fallback.

## Method

1. **Pull.** One Savant search request per day, 1 s pause, 3 tries, `hfGT=R|F|D|L|W|`, `player_type=pitcher`.
   2025-03-15 to 2025-11-02 (210 days with games) and 2026-03-20 to 2026-10-01 (187 days with games).
   `xwoba_pull.py` asserts fewer than 25,000 rows a day (the largest day had 5,384).
   Three of 429 requests got a transient HTTP 502 and passed on the first retry. **No day is missing.** The stop rule did not fire.
   Completeness check against the statsapi schedule (`xwoba_schedule_check.py`): the same 210 and 187 dates.
   Games: 2,477 in Savant against 2,476 Final in the schedule (2025), and 2,438 against 2,437 (2026).
   Nine days in 2025 and three in 2026 differ by one game each way. **Inference:** a suspended game sits on another date in one source.
2. **Balls in play.** 126,252 in 2025 and 123,813 in 2026 have exit velocity, launch angle and an estimate.
3. **Estimators** (`xw_est.py`), each tuned by 10-fold cross-validation on **2025 only**:
   grid bins (1x1, 2x4, 4x8, with a fall back to the next coarser bin), hierarchical shrinkage,
   a Gaussian kernel, and a nearest-neighbour box (grow a box around the ball until it holds k balls, take the mean).
4. **Scores.** Out of sample: train 2025, test 2026. In sample: 10-fold cross-validation inside 2026 (and inside 2025).
5. **Board.** Reproduce Savant's board from search rows first (step 4 below). Then the gate (step 5).

## Step 3: pitch-level accuracy (verified)

Every number is the mean absolute error (MAE) in xwOBA units unless it says otherwise.
"Table" is the JSON of the table trained on 2025. "gz" is the same file gzipped.
The baseline (predict one mean for every ball) has MAE 0.2943 on 2026.

| Estimator (settings chosen on 2025) | 2025 CV MAE | **2025 -> 2026 MAE** | RMSE | within 0.02 | within 0.05 | 2026 CV MAE | RMSE | within 0.02 | within 0.05 | Table | gz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| grid 4x8 -> mean | 0.0678 | 0.0708 | 0.1183 | 0.365 | 0.582 | 0.0680 | 0.1140 | 0.384 | 0.604 | 5.9 KB | 2.2 KB |
| grid 2x4 -> 4x8 | 0.0407 | 0.0477 | 0.0785 | 0.428 | 0.686 | 0.0417 | 0.0684 | 0.476 | 0.728 | 27 KB | 9.6 KB |
| grid 1x1 -> 2x4 -> 4x8 | 0.0200 | 0.0335 | 0.0574 | 0.505 | 0.807 | 0.0208 | 0.0348 | 0.651 | 0.902 | 150 KB | 53 KB |
| shrinkage 1x1 > 2x4 > 4x8 > 8x16, m=1 | 0.0200 | 0.0334 | 0.0571 | 0.505 | 0.808 | 0.0208 | 0.0345 | 0.650 | 0.903 | 152 KB | 54 KB |
| Gaussian kernel, sigma 0.5 mph x 1 deg | 0.0167 | 0.0307 | 0.0527 | 0.531 | 0.829 | 0.0183 | 0.0296 | 0.665 | 0.941 | 75 KB | 21 KB |
| **nearest-neighbour box, 1 mph x 1 deg, k=3** | **0.0080** | 0.0329 | 0.0554 | 0.505 | 0.811 | **0.0081** | **0.0221** | **0.881** | **0.978** | 82 KB | 22 KB |
| nearest-neighbour box, 1 mph x 2 deg, k=2 | 0.0080 | 0.0329 | 0.0554 | 0.505 | 0.810 | 0.0081 | 0.0222 | 0.881 | 0.977 | 82 KB | 21 KB |
| nearest-neighbour, 0.1 mph x 1 deg, k=1 (ceiling, no table) | 0.0088 | 0.0335 | 0.0564 | 0.498 | 0.802 | 0.0093 | 0.0253 | 0.843 | 0.966 | none | none |

The full list (30 settings) is in `xwoba-output/pitch_level.txt`.

What the table says:

- **Smoothing error is small. Season drift is large.** The best estimator reaches 0.0081 inside a season and 0.0329 across seasons.
  Every estimator, even the finest one, is near 0.033 across seasons. The settings do not matter across seasons.
- The three grids from the task: 1x1 with fall back gives 0.0200 in season. 2x4 gives 0.0407. 4x8 gives 0.0678.
  The coarse grids lose because the estimate has fine structure. A 1 mph x 1 degree neighbourhood is the right scale.
- The nearest-neighbour settings barely matter: k from 2 to 12 gives 0.0080 to 0.0093 (2025 CV).
- **Table size does not matter much. Inference.** The lookup runs in the nightly sweep (Node). The page does not fetch it.
  The best table is a dense 126 x 181 lattice (exit velocity 0 to 125 mph, launch angle -90 to 90), in thousandths. A lookup
  from the lattice gives the same answer as the estimator, apart from a 0.0005 rounding step (**inference**, not run).

### Drift (`xwoba_drift.py`, verified)

- **Inside a season the drift is small.** Train on all earlier months of the season and score the next month:
  MAE 0.0093 to 0.0080 in 2025, 0.0096 to 0.0081 in 2026. A table does not go stale inside a season.
- **Across seasons the gap is in the hard-hit balls.** The 2025 table scored on 2026 balls:

  | Exit velocity | MAE | Mean signed (2026 minus table) |
  | --- | --- | --- |
  | under 60 mph | 0.0312 | +0.0015 |
  | 60 to 80 | 0.0194 | -0.0018 |
  | 80 to 95 | 0.0214 | +0.0017 |
  | 95 to 105 | 0.0469 | +0.0101 |
  | 105 and up | 0.0644 | +0.0433 |

  By launch angle, 25 to 35 degrees is worst (MAE 0.0662, +0.0244). By type: fly balls 0.0484, line drives 0.0350, ground balls 0.0260.
- **One scale and shift does not fix it.** Fitted on half of 2026: `2026 = 1.0427 x table - 0.0080`. Held-out MAE 0.0328 goes to 0.0334.
- **Same exact key in both seasons** (33,382 keys): mean absolute change 0.0292. The mean change is +0.0055.
  Example: exit velocity 103.4, launch angle 8: 0.586 in 2025, 0.666 in 2026.
- **Season is the biggest factor in the spread** (`xwoba_spread.py`). Spread about the key mean: 0.0170 with seasons pooled,
  0.0054 inside one season (ratio 0.32 when the key includes the season).
- **Cold start** (`xwoba_extras.py`): train on the first N days of 2026, score July onward.
  3 days (949 balls) MAE 0.0350. 7 days 0.0224. 14 days 0.0162. 30 days 0.0106. 60 days 0.0090. 90 days 0.0086.
  The 2025 table scored 0.0328 on the same balls. A table from two weeks of the new season beats last year's table by half.

### The spread among identical keys (`xwoba_spread.py`, verified)

- Inside 2026, 26,763 exact keys appear two or more times. 35.7% of them carry more than one distinct estimate.
  (2025: 36.1%.) The median range inside such a key is 0.024. The mean absolute deviation about the key mean is **0.0054**.
  That is the floor for any lookup on exit velocity and launch angle alone, inside one season.
- **The issue said 20 of 123 repeated keys (16%) in 5 days.** That is the same effect in a small sample.
- A split always shrinks a group's spread a little. So each variable needs a control. A random two-way label gives ratio **0.91**
  (spread of key+label over spread of key, same balls, 2026 only).

  | Added to the key (2026 only) | Ratio | Reading |
  | --- | --- | --- |
  | random label (control) | 0.91 | no information |
  | `bb_type` | 1.00 | none |
  | `hit_location` | 0.90 | none (same as control) |
  | `stand` | 0.92 | none |
  | `p_throws` | 0.94 | none |
  | `game_type` | 1.00 | none |
  | random label, launch angle under 10 | 0.93 | no information |
  | **batter sprint speed (thirds), launch angle under 10** | **0.64** | **explains the spread** |
  | batter sprint speed (thirds), launch angle 10 and over | 0.84 | small, near the control |

  A first version of this table used both seasons together. It showed `hit_location` at 0.86 and `stand` at 0.91. That looked like
  signal. It was the season effect plus the group-split effect. Do not read the pooled table.

### Sprint speed (`xwoba_sprint.py`, verified)

The 119 search columns have no sprint speed. I joined Savant's sprint-speed leaderboard
(`leaderboard/sprint_speed`, 36 KB, 567 players for 2026) on the batter id.
Residual = Savant's estimate minus a leave-fold-out nearest-neighbour estimate.

| Batted ball | 2025 r | 2025 slope (xwOBA per ft/s) | 2026 r | 2026 slope |
| --- | --- | --- | --- | --- |
| ground ball, exit velocity under 85 | +0.744 | +0.0093 | +0.692 | +0.0088 |
| ground ball, 85 and over | +0.652 | +0.0092 | +0.653 | +0.0093 |
| line drive | +0.019 | +0.0002 | +0.003 | +0.0000 |
| fly ball | +0.012 | +0.0003 | +0.002 | +0.0000 |
| popup | +0.043 | +0.0001 | +0.004 | +0.0000 |

- **What I can conclude.** Savant's estimate depends on batter sprint speed for ground balls (launch angle under 10).
  The slope is about +0.009 xwOBA per ft/s in both seasons. It is zero for air balls. The hypothesis in #1411 is now a finding.
  A fast hitter (+1.5 ft/s above average) gains about +0.013 on each ground ball.
- **What I cannot conclude.** That Savant uses this exact leaderboard value (it may use a per-run speed). That the effect is linear.
  That nothing else matters: 0.0054 of spread remains inside a key, and I did not look for a third factor.
- **A one-slope term helps the lookup.** Weak ground balls in 2026: MAE 0.0122 goes to 0.0091 with the term (slope fitted on 2025).
  At board level it nearly halves the error (see step 5). The feed has no sprint speed. The leaderboard is one 36 KB request. **Inference:** it is cheap enough to fetch with the sweep.

## Step 4: reproduce the board (verified)

Board: `leaderboard/pitch-arsenal-stats?type=batter&year=2026&min=10` (3,617 rows, as #1408 says). Saved 2026-10-02.

The first rule in the task (PA-ending pitch with `woba_denom` = 1, group by pitch type, average the estimate on balls in play and
`woba_value` otherwise) matched Judge exactly (.424, .531, .248) but **not the board as a whole**: only 2,795 of 3,617 `pa` values matched.
The board's real definition (`xwoba_board.py`):

| Part | The board's rule |
| --- | --- |
| scope | `game_type` R only |
| pitch type | the PA-ending pitch's type, with **KC and CS folded into CU**. The board has no KC row |
| `pa` | every row with a non-empty `events`, except `truncated_pa`. It counts sac bunts, balls in play with no tracking data, and catcher interference. `woba_denom` = 1 is **not** its `pa` |
| `est_woba` | the mean of one value per PA over the PAs that have a value. Ball in play with an estimate: the estimate. Any other PA: `woba_value` (strikeout 0, walk 0.7, hit-by-pitch 0.7, catcher interference 0.7). Sac bunts and balls in play with no estimate are skipped |

Result: **`pa` matches on 3,617 of 3,617 rows. `est_woba` matches within 0.0005 (the board rounds to 3 decimals) on 3,617 of 3,617 rows.**
Judge: four-seam 62 PA, mine .4242 against .424. Sinker 47, .5315 against .531. Slider 44, .2484 against .248.
2025 board (3,543 rows): `pa` matches on all rows. `est_woba` within 0.002 on 99.97% of rows. The worst row is 0.0149.
Both boards are regular season only. Step 5 can run.

Three things the task text did not say, found by trial. See "Wrong turns".

## Step 5: the gate (verified)

For each board row, I computed the estimate from search rows with the lookup in place of Savant's per-ball estimate. Strikeouts, walks and the rest follow the board's rule.
The plate appearances are the same on both sides, so the gap is lookup error only, averaged over each hitter's balls in play.
Estimator: nearest-neighbour box, 1 mph x 1 degree, k=3. Columns: the table built from 2025 (out of sample), from 2026 (in sample, the same balls),
and from 2026 by 10-fold cross-fitting (each ball scored by a table built without its fold). The cross-fitted column is the honest in-season number.
`gap` is mine minus the board's.

### pa 40 or more (the app's own floor, `BATTER_PA_MIN`), n = 1,631

| Table | MAE | RMSE | corr | max gap | within 0.010 | within 0.020 | within 0.030 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025 (out of sample) | 0.0068 | 0.0087 | 0.993 | 0.039 | 77.2% | 97.5% | 99.6% |
| 2026 (in sample) | 0.0033 | 0.0045 | 0.997 | 0.028 | 95.8% | 99.9% | 100.0% |
| **2026 cross-fitted** | **0.0035** | 0.0048 | 0.997 | 0.029 | 94.6% | 99.8% | 100.0% |
| 2026 cross-fitted + sprint term | 0.0019 | 0.0026 | n/a | 0.026 | 99.4% | 99.9% | n/a |

### pa 10 or more, n = 3,617

| Table | MAE | RMSE | corr | max gap | within 0.010 | within 0.020 | within 0.030 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025 (out of sample) | 0.0077 | 0.0102 | 0.994 | 0.061 | 72.0% | 94.4% | 98.8% |
| 2026 (in sample) | 0.0034 | 0.0048 | 0.998 | 0.039 | 95.0% | 99.8% | 99.9% |
| **2026 cross-fitted** | **0.0037** | 0.0052 | 0.998 | 0.040 | 93.9% | 99.5% | 99.9% |
| 2026 cross-fitted + sprint term | 0.0022 | 0.0033 | n/a | 0.040 | 98.4% | 99.8% | n/a |

### By pa bucket (pa 10 or more)

| Bucket | n | 2025 table MAE | within 0.020 | max | 2026 cross-fitted MAE | within 0.020 | max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 to 19 | 911 | 0.0091 | 88.6% | 0.052 | 0.0038 | 99.1% | 0.029 |
| 20 to 39 | 1,075 | 0.0078 | 94.6% | 0.061 | 0.0038 | 99.3% | 0.040 |
| 40 to 79 | 1,043 | 0.0069 | 97.0% | 0.039 | 0.0037 | 99.7% | 0.029 |
| 80 and up | 588 | 0.0066 | 98.5% | 0.035 | 0.0033 | 100.0% | 0.019 |

### By pitch type (pa 10 or more, MAE)

| | FF | SI | SL | CH | ST | FC | CU | FS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2025 table | 0.0066 | 0.0082 | 0.0070 | 0.0068 | 0.0073 | **0.0095** | 0.0083 | 0.0087 |
| 2026 cross-fitted | 0.0026 | **0.0049** | 0.0034 | 0.0041 | 0.0027 | 0.0040 | 0.0037 | 0.0045 |

(CU holds KC and CS, as on the board. SV has 2 rows.) In season the worst types are SI, FS and CH. **Inference:** they draw the most ground balls, which carry the sprint term.

### Other estimators on the same gate (pa 40 or more, 2025 table, 2026 cross-fitted, MAE)

| Estimator | 2025 table | 2026 cross-fitted |
| --- | --- | --- |
| nearest-neighbour 1x1, k=3 | 0.0068 | 0.0035 |
| kernel, sigma 0.5 mph x 1 deg | 0.0065 | 0.0038 |
| grid 1x1 -> 2x4 -> 4x8 | 0.0067 | 0.0042 |
| grid 2x4 -> 4x8 | 0.0080 | 0.0062 |
| grid 4x8 | 0.0105 | 0.0095 |

Averaging over a hitter's plate appearances shrinks the error. Even the 4x8 grid is within 0.010 of the board on average.
The ranking holds, and the 2025-built column is worse than the in-season column for every estimator.

## Recommendation

1. **Best estimator.** Nearest-neighbour box, 1 mph x 1 degree, k=3, from the current season's balls in play.
   The table is a dense 126 x 181 lattice in thousandths: 82 KB, 22 KB gzipped. Ball-level MAE 0.0081 in season.
   Settings from 2 to 12 neighbours and 1 or 2 degrees are within noise. The kernel (75 KB) is a close second.
2. **Tolerance for #1411's calibration check.** Compare each board row with `pa` of 40 or more against the estimate from a table
   built from the **same season**. Require all three:
   - mean gap at most **0.006**;
   - at most **1%** of rows above **0.020**;
   - no row above **0.040**.

   Evidence: in season (cross-fitted) the check passes with margin: MAE 0.0035 (1.7x margin), 0.2% of rows above 0.020, worst row 0.029.
   With a table from 2025 it fails two of three: MAE 0.0068 and 2.5% of rows above 0.020 (worst row 0.039, inside the cap).
   So the check separates a good table from a stale one. At `pa` of 10 or more the in-season numbers are 0.0037, 0.5% and 0.040,
   which is why the cap is 0.040 and the floor stays at 40.
   **Inference:** this check needs a board snapshot and per-ball data. It fits a generator or a script check better than `npm test`, which has no network.
3. **Pass or fail against it.**
   - Table from the current season: **pass**.
   - Table from 2025: **fail**. It fails on the mean and on the 1% share. The error has one sign: the estimate runs low (mean gap -0.0049).
     It sits in hard-hit balls (exit velocity 95 and up, launch angle 10 to 35). By pitch type, FC, FS, CU and SI are worst (0.0082 to 0.0095).
     By bucket, 10 to 19 PA is worst (0.0091, 88.6% within 0.020).
4. **Does a 2025 table hold on 2026?** **No** (verified). 0.0329 per ball against 0.0081 in season. Rebuild every season.
   Inside a season, a table built from earlier months holds (next-month MAE 0.0080 to 0.0096). Early in a season, 14 days of data
   (8,200 balls) already halves last year's error. 30 days gives 0.0106.
5. **The label.** `xwOBA (est.)`. Say in the legend that it is estimated from exit velocity and launch angle.
   **Verified:** in season, 94% of hitter and pitch-type values sit within 0.010 of Savant's, and the mean gap is about 0.004.
   A printed value can differ from Savant's in the third decimal. The label must stay.
6. **What the design should know.**
   - **Season and refresh.** The lookup is per season. The first two weeks of a season are rougher (ball-level MAE 0.016 at 14 days). Show "(est.)" always.
   - **Sprint speed.** Fast and slow hitters carry a bias of about +/-0.004 on a hitter's xwOBA, from ground balls. A sprint term halves the gap (0.0035 to 0.0019).
     It needs one extra 36 KB request. It is optional. A page that shows colours in steps of 0.050 will not show a 0.004 difference.
   - **Region values.** A map region needs 10 plate-appearance-ending pitches. That is the "pa 10 to 19" bucket: in season, MAE 0.0038, 99.1% within 0.020.
   - **Pitch types.** The board folds KC and CS into CU. The page's pitch pills use the feed's codes. A KC pill has no board row to check against, and the CU board row covers CU + KC + CS.
   - **Walks and hit-by-pitch.** Use 0.7 for both, as `woba_value` does. See "Where the issues disagree".
   - **Balls in play with no estimate** (1.0% of 2026: untracked balls and sac bunts) are skipped by the board. Skip them too.
   - **Sac bunts** count in `pa` but not in the mean.
7. **Option B, cheaper than the issue says.** The in-season table needs a Savant pull of balls in play. That pull works with `hfPR`:
   - **Verified.** `hfPR=hit%5C.%5C.into%5C.%5C.play%7C` returned exactly the `hit_into_play` rows (same set of pitches) on 3 days:
     743 of 4,294 rows (2025-06-15), 734 of 4,276 (2026-05-10), 720 of 4,265 (2026-09-20). 0.62 to 0.63 MB against 2.93 MB.
     First call 2.3 to 2.7 s. A repeat 0.3 to 0.6 s (server cache). 2026 holds 125,062 such rows in 187 days.
     **Inference:** a build from scratch is about 108 MB and 11 minutes at one request a second.
   - **Verified.** A feed pitch joins to a Savant row on `(game_pk, at_bat_number = atBatIndex + 1, pitch_number = count of isPitch events)`
     with no coordinates: 597 of 599 balls in play joined over 12 games on 2 days (`xwoba_join.py`). Exit velocity and launch angle matched on all 594 that had both. 2 balls hit a row that is not `hit_into_play` (a shifted number, **inference:** a pitch-clock row).
   - **Inference.** So option B does not need the frame re-projection that #1411 names. Only the estimate crosses over, not a location.
     A nightly balls-in-play pull of 0.63 MB gives each ball its **exact** estimate. The lookup and the sprint term then matter only for the 0.3% of balls that fail to join, and for games Savant has not published yet. I did not test Savant's lag on a same-day game. No games were scheduled today.
   - The owner should choose between (a) an in-season lookup rebuilt now and then, and (b) the exact join. Both pull the same balls-in-play rows from Savant. (b) is exact, has no drift and needs no sprint term, but it makes the nightly sweep depend on Savant being up.
     If Savant fails, (a) is the fail-soft fallback. **Inference:** the page can keep the "(est.)" label for any ball that fell back.

## Where the issues disagree with what I measured

| Issue text | What I measured |
| --- | --- |
| #1411 Part C: commit "a small static table. Say which season it came from." | A 2025 table fails on 2026 (0.0329 per ball, 0.0068 on the board). The table must be rebuilt from the current season. |
| #1411 Part C: "Not verified: the error of a lookup built from a full season." | Verified: 0.0081 per ball in season, 0.0329 across seasons. |
| #1408 and #1411: leave-one-out error 0.010 (1x1) and 0.047 (2x4) in 5 days | Same shape in a full season (grid 2x4 -> 4x8 0.041). But a nearest-neighbour box reaches 0.0081, and the 1x1 grid with fall back reaches 0.0200. |
| #1411: "A possible cause is a sprint-speed term for some ground balls (not tested)." | Verified. r = +0.65 to +0.74 on ground balls, 0 on air balls, +0.009 xwOBA per ft/s in both seasons. |
| #1411 rule: "A walk or hit-by-pitch uses that season's wOBA weight." #1411 handoff: Savant's `woba_value` "carries the weight". | `woba_value` is a flat 0.7 for both walks and hit-by-pitch in both seasons. The board uses it. The season weights sit in `estimated_woba_using_speedangle` (walk 0.6915, hit-by-pitch 0.7223 in 2025; 0.6982 and 0.7292 in 2026). Use 0.7 to match the board. The gap is about 0.0002 per hitter. |
| "A strikeout is 0." | True for 99.87% of strikeouts. 52 of 40,549 in 2026 (56 of 40,493 in 2025) have `woba_value` 0.7. The board uses `woba_value`. |
| The board's `pa` is the count of PA-ending pitches (my first rule: `woba_denom` = 1). | The board's `pa` includes sac bunts, untracked balls in play and catcher interference, and excludes `truncated_pa`. `woba_denom` = 1 matched 2,795 of 3,617 rows. |
| The board lists pitch types as the feed does. | The board has no KC or CS. It folds them into CU. |
| #1411: "Filtering to balls in play would cut the volume (not tested)." | Tested. It works and cuts a day from 2.93 MB to 0.63 MB. |
| #1411: option B "also needs a re-projection between Savant's frame and the feed's." | Not for the estimate. A key join on `(game_pk, at_bat_number, pitch_number)` works on 597 of 599 balls. Only a pitch location needs re-projection. **Inference** until built. |
| #1411: the board has 3,617 rows. | Agrees: 3,617 data rows. |
| Judge four-seam .424 (62 PA), sinker .531 (47), slider .248 (44). | Agrees. The board did not move: the 2026 regular season is over. |
| A day costs about 4,300 rows and 2.9 MB (9 s). | Agrees: 4,265 to 4,294 rows, 2.93 MB on three days. A day pull took 1 to 14 s. |

## Wrong turns

1. **The task's board rule was incomplete.** It matched Judge to the third decimal and still missed 822 of 3,617 `pa` values.
   Judge's rows happened to match. I stopped at "several rows match" and checked every row. Three fixes: fold KC and CS into CU, count `pa` the board's way, and skip sac bunts and untracked balls in the mean.
   Catcher interference was the last 7 rows (a `hit_into_play` description with no estimate that the board counts at 0.7).
2. **I stopped my own shell.** To fetch the board between day requests I paused the pull with `kill -STOP $(pgrep -f ...)`. The pattern matched my own shell too.
   The shell hung until I sent `kill -CONT`. No data was lost: the pull had a request in flight, finished it (116 s) and went on.
   Lesson: never pause a job with `pgrep` output without checking the PIDs. The board is one request, so a plain request would have done.
3. **The first "cross-fitted" column equalled the in-sample column.** I looked up each ball by `id()` across two separate `load()` calls.
   The second call returns new objects, so every ball fell back to the in-sample table. The two columns were identical to four decimals, which gave it away. Fixed by loading once.
4. **A small sample and a wide kernel ranked the smoothers backwards.** On 8 days of data my first kernel (sigma 2 mph x 4 deg) looked worst (MAE 0.054 against 0.027 for the grid). With a full season and a narrow kernel (0.5 mph x 1 deg) it beats every grid. The first sweep was thrown away.
5. **The pooled spread table looked like signal.** See the note under "The spread among identical keys". A random control and a one-season table removed it.
6. **A half-honest tuning note.** Before the 2025 data existed I tried several nearest-neighbour settings on 2026 cross-validation. The final table ranks by 2025 cross-validation only.
   Both rankings pick the same family and the same plateau (k from 2 to 3, 1 mph, 1 or 2 degrees), so the choice does not rest on the 2026 numbers.
7. **Savant sometimes returns HTTP 502.** Three times in 429 requests. The first retry passed each time. `h.py savant()` and `xwoba_pull.py` both retry.

## What I did not do

- **Not tested:** Savant's same-day lag (no games today). Whether a Triple-A table needs its own build. Whether the sprint term helps the regional (13-region) values, since regions need a stable count of balls.
- **Not tested:** the 13-region averages themselves. The board-level gate stands in for them. A region average mixes fewer plate appearances, so its error is at least the "10 to 19" bucket's.
- The postseason is in the training balls (2026 through 10-01) and out of the board (regular season only).
- The estimate is not a finished product. Nothing here touched `src/`, `api/`, `public/`, `scripts/` or `docs/adr/`.

## Files

| File | What it does |
| --- | --- |
| `xwoba_pull.py` | Pulls one Savant day per request into `/tmp/xwoba-cache`. Resumes. Stop rule. |
| `xw_common.py` | Loads and parses the cached days. |
| `xw_est.py` | The estimators (grid, shrinkage, kernel, nearest-neighbour). |
| `xwoba_pitch_level.py` | Step 3: pitch-level accuracy and table sizes. |
| `xwoba_spread.py` | Step 3: spread among identical keys, with a random control. |
| `xwoba_drift.py` | Drift inside a season and across seasons. |
| `xwoba_fetch_sprint.py`, `xwoba_sprint.py` | Sprint-speed leaderboard and its link to the residual. |
| `xwoba_fetch_board.py`, `xwoba_board.py` | The board and its reproduction (step 4). |
| `xwoba_gate.py` | Step 5: the gate. |
| `xwoba_extras.py` | Cold start, and the gate with a sprint term. |
| `xwoba_checks.py` | The `hfPR` filter and the walk / hit-by-pitch values. |
| `xwoba_join.py` | The key join between feed pitches and Savant rows. |
| `xwoba_schedule_check.py` | Completeness of the pull against the statsapi schedule. |
| `xwoba-output/` | Raw output of each script, as run on 2026-10-02. |

Run order: `xwoba_pull.py START END` (twice), `xwoba_fetch_board.py`, `xwoba_fetch_sprint.py`, then any analysis script. Python 3.11 and `curl` only.

## Sources

- Savant search CSV (`statcast_search/csv`), pulled 2026-10-02, one day per request.
- Savant board: `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=batter&pitchType=&year=2026&team=&min=10&csv=true`
- Savant sprint speed: `https://baseballsavant.mlb.com/leaderboard/sprint_speed?min_season=2026&max_season=2026&position=&team=&min=10&csv=true`
- statsapi schedule and live feed (`/api/v1/schedule`, `/api/v1.1/game/{pk}/feed/live`).
- Repo: `scripts/gen-savant-matchup.mjs` (`BATTER_PA_MIN`), `scripts/lib/savant.mjs` (`fetchArsenalBoard`), issues #1408, #1410, #1411.
