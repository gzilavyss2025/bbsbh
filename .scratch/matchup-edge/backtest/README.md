# Matchup Edge backtest (#1688, plan step 2)

Run on 2026-10-20 over the full 2026 regular season (713,314 pitches, 181,743 PA).

## Result

**The model does not rank a pitcher's opposing hitters better than the hitter's plain
season line against that hand.** No version of it does: without the location factor,
with it, or with each pitch shrunk to the hitter's own line. Do not ship the ranking
(plan step 4) on this model.

## Method

- `pull.mjs <dir>` downloads every 2026 regular-season pitch from Savant, one request a
  day, slimmed to the model's columns (111 MB of JSON; keep it out of the repo).
- `backtest.mjs <dir>` builds the model's inputs only from pitches before a split
  date, then predicts every plate appearance after it. The inputs are the ones
  `matchup-model.mjs` reads: hitter by pitch type, pitcher hand and batter side; the
  league by pitch type and 5x5 cell (the app's `commandCell`); the pitcher's mix and
  cells by batter side (pitch types with 30 or more pitches to that side).
  - Split A: train to June 30, test July (24,598 PA, 430 pitchers). The constants
    are picked here.
  - Split B: train to July 31, test August to September (50,145 PA, 490 pitchers).
    This split confirms, with constants it did not pick.
- **Scored inside each pitcher.** The script subtracts each pitcher's mean from the
  outcome and from every prediction. So pitcher quality cannot help a method, and the
  only question left is the page's question: which of his opponents does best against
  him?
- Outcome per PA: Savant's xwOBA on a tracked ball in play, else the wOBA value.
- Four predictors:
  1. **Season line**: the hitter's xwOBA against that hand, shrunk to the league.
  2. **Model, no location**: `matchup-model.mjs` without the location factor.
  3. **Model + location**: `matchup-model.mjs` as written.
  4. **Hier**: like 2, but each pitch is shrunk to the hitter's own season line, not to
     the league. This is the fairest form of the idea.
- Intervals: 95%, 300 bootstrap resamples by hitter.

## Numbers

Within-pitcher correlation with the outcome (higher is better). The constants are
the ones picked on split A.

| Predictor | Split A | Split B | Gain over season line, split B [95%] |
|---|---|---|---|
| Season line (K 120) | .0646 | .0543 | — |
| Model, no location (K 30) | .0594 | .0443 | −.0100 [−.0158, −.0042] |
| Model + location (K 30) | .0569 | .0417 | −.0126 [−.0186, −.0055] |
| Hier (K 120) | .0652 | .0517 | −.0025 [−.0049, +.0014] |

The matchup part (model minus season line) on top of the season line: its regression
coefficient is 0.29 in split A [0.01, 0.62] and 0.00 in split B [−0.22, 0.25]. For
location it is 0.24 and −0.01. For hier it is 0.50 [−0.19, 1.04] and −0.02
[−0.35, 0.55]. 1 would mean the matchup part is real and the right size; 0 means noise.

Whiff per swing gives the same answer. Within-pitcher skill (MSE cut, units of 0.01%),
split B at each predictor's best K: season line 149 (K 75), model 117 (K 25),
model + location 114, hier 144 (K 300).

All the tables are in the script's output. Re-run:
`node pull.mjs <dir> && node backtest.mjs <dir>` (about 40 minutes, then 40 seconds).

## What this means

- **Shrinkage constants.** For the season line, K about 120 to 250 PA (xwOBA) and 75
  swings (whiff) work best. The model's 60 and 75 are near that. But a constant cannot
  fix the model: at any K, it does not beat the season line.
- **Location factor.** It makes the model worse in both splits. Drop it.
- **Righties read low.** This is not a model bias. Inside a pitcher, righties do score
  about .003 below the mean in the test window, and the season line shows the same
  gap. *Inference:* most pitchers in the sample are right-handed, so this is the
  platoon split.
- **Why the idea fails (inference).** The samples are small. Take the 205 hitters with
  400 or more PA in the full season. Split their PA by pitch type and pitcher hand: the
  median cell holds 17 PA, and 88% of the cells hold fewer than 60 (measured). At that
  size a hitter's results by pitch type are mostly noise, and the noise costs more than
  the signal adds. Split B had more training data than split A and did no better.

## Open

- A pitch-quality layer (Stuff+ or PLV, plan item 5) or several seasons of hitter data
  could change this. Each needs a new data pull and its own backtest.
- The World Series Pitch by pitch card: see the next section.

## The World Series Pitch by pitch card (club level)

`card-backtest.mjs <dir> <hitters.json>` tests the card's own figure
(`src/lib/postseason/worldseries/scouting/pitchByPitch.js`). For each club, it takes
the nine regulars with the most PA before the split date, then pools them on one pitch
type from one pitcher hand, both batter sides, and takes the gap to the league, rounded
as the card rounds it. The outcome is the same nine hitters' gap on the same pitch and
hand after the split date, against any pitcher. `hitters.json` is the statsapi season
hitting list (`/api/v1/stats?stats=season&group=hitting&season=2026&sportId=1&playerPool=ALL&limit=3000`),
used only to put each hitter on a club. Intervals: 500 bootstrap resamples by club.

**Result: the card's figure has a weak, real signal once it has half a season or
more. Its printed gap overstates the true edge about four to seven times (slope 0.14 to 0.23), and its
call at the current band (.010) is close to a coin flip.**

- **Slope** (how much of the card's gap shows up later; 1 = all of it, 0 = none).
  Split A (three months of data): about 0 at every `MIN_PA` (0.02 [−0.16, 0.20] at
  10). Split B (four months): 0.14 [0.01, 0.27] at `MIN_PA` 10, 0.22 [0.05, 0.39] at
  60, 0.23 [0.04, 0.43] at 100. With the club's overall level taken out, the pitch
  part alone is 0.16 at 10 and 0.29 [0.23, 0.47] at 60. So the pitch-specific part is
  real at club level, unlike for one hitter.
- **The call.** The share of "Arm" or "Bats" calls that point the same way later
  (split B, weighted by later PA; 50% is a coin flip):

  | `MIN_PA` | Band .010 | Band .020 | Band .030 | Band .050 |
  |---|---|---|---|---|
  | 10 (now) | 58% (77% of rows called) | 62% (57%) | 61% (41%) | 58% (21%) |
  | 60 | 59% (73%) | 64% (50%) | 64% (33%) | 64% (11%) |
  | 100 | 60% (72%) | 65% (48%) | 65% (31%) | 62% (9%) |

  Split A is 52% to 60% across the table and 36% to 46% at band .050.
- **`MIN_PA` 10 is not the limit in practice.** Nine regulars pool to a median of
  137 PA on a pitch in split B, so most rows pass any threshold up to 100.
- *Inference:* the card in the World Series reads the full regular season (about six
  months), so its signal should be at least as good as split B. The test cannot show
  that, because no later window is left to score.
