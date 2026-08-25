# Spike #5 — October texture: what is actually different about a postseason game

Part of the team-success research program (`docs/team-success-research.md`).
Diary entry: `src/lib/research/contenderDiary/octoberTexture.js`, rendered at
`/admin/contenders`.

**This spike breaks the program's pattern on purpose.** Spikes #1-#4 each took
a regular-season ROSTER trait (age, homegrown share, star diversity, prior
postseason experience) and regressed it against the outcome ladder. This one
does not touch the ladder until its third question. It asks the fan's version
instead — October *feels* different, so is it? — and answers it by comparing
the same men in the same year to themselves.

Commissioned directly (2026-08-25) rather than drawn from the planned spike
order, in the same way the postseason-experience spike was.

## The questions asked

1. Are at-bats longer in October?
2. Do players over- or under-perform their own regular-season numbers?
3. How much of a postseason series is a coin flip?
4. Do pitchers change what they throw?
5. Do managers pull starters earlier — and does it help?

## Data

`\.scratch/team-success/build-october-texture.mjs` → `october-texture.json`.
Three panels, all off statsapi's `gameType` split (`R` regular season, `P`
postseason; statsapi folds F/D/L/W into `P` for season-stat purposes —
verified against 2024, where the `P`-side team rows sum to the games the
committed bracket in `public/data/postseason-history.json` lists).

| Panel | Endpoint | Rows | Window |
| --- | --- | --- | --- |
| `teamSeason` | `/api/v1/teams/stats`, both groups, both gameTypes | 2,060 | 2000-2025 |
| `playerSeason` | `/api/v1/stats`, league-wide, both groups, both gameTypes | 54,486 | 2000-2025 |
| `arsenal` | `/api/v1/people/{id}/stats?stats=pitchArsenal`, both gameTypes | 1,209 pitcher-seasons | 2008-2025 |

A fourth input needed no pull: `public/data/postseason-history.json` already
carries every series, both seeds, and every game score.

Two deliberate departures from the house data conventions, both documented in
the script header:

- **The league-wide (un-`teamId`-filtered) player call is used on purpose.**
  `build-roster-age.mjs` warns that this endpoint collapses a traded player
  into one row under his last club carrying his whole-season total. That is a
  bug when attributing a player to a roster. It is exactly right here: the
  baseline for "did he hit better or worse in October" is the season he
  actually had, not the slice of it after the trade.
- **The arsenal panel floors at 2008** (PITCHf/x) and at 50 October pitches.
  Below that a pitch mix is one outing's worth of selection.

**Neither `october-texture-cache.json` (70 MB) nor `october-texture.json`
(51 MB) is committed** — unlike the earlier spikes' caches, these are large
enough to be a real burden on the repo, and both rebuild from scratch in about
two minutes. Only the scripts and
`october-texture-findings.json` (the distilled result) are checked in.

## Method

`\.scratch/team-success/analyze-october-texture.mjs`. Every question is
answered with a **paired** design — the same player or the same season on both
sides — tested with a sign-flip permutation test (20,000 draws, deterministic
seed), and re-fit leaving each season out in turn. 2020 is excluded from every
season-level comparison (60-game season, 16-team bracket) and what including
it would have done is reported alongside.

### The selection problem, and the trap inside the fix

"October offense is worse than regular-season offense" is true and measures
almost nothing: October rosters are not the league. So every performance
question is answered against a **selection-free expectation** — take each man
who actually appeared in October, take his own regular-season rates, weight
him by the plate appearances or batters faced he actually got in October, and
add it up.

**The first pass of this spike did that from the hitters' side only, and it
was wrong.** An October hitter is better than the league-average hitter, so
his own rates set a high bar. An October pitcher is better than the
league-average pitcher, so his own rates set a low one. Run the identical test
from the mound and the sign flips: pitchers "underachieve" their own season
too, by +0.037 of OPS allowed (p=0.0005). Both sides cannot be underachieving
in the same game. Each one-sided test is really measuring **the quality of the
opposition**, not October.

The reported numbers therefore hold **both ends of the matchup**:

- For OPS and batting average, the additive form `E_hitters + E_pitchers −
  E_league` — a hitter 50 points above league meeting a pitcher who holds the
  league 40 points down should produce 10 points above league.
- For strikeout rate per plate appearance, a genuine probability, the odds
  ratio (log5): `odds(h)·odds(p)/odds(L)`.

This matters enormously to the headline. The one-sided hitter number is
**−0.088** of OPS. The both-sides number is **−0.014**.

### The small-sample trap in the arsenal panel

"Share of his best pitch" is a **maximum**, and the maximum of a handful of
noisy shares is biased upward in a small sample. An October sample is roughly
a tenth the size of a regular season, so a pitcher who changed nothing would
still *look* like he narrowed his mix. The control: draw the same number of
pitches October gave him, at random, from his own regular-season mix (60
multinomial draws per pitcher-season), and measure that the same way. About a
quarter of the naive "narrowing" was the small sample. The rest is real.

Velocity is a mean, not a maximum, and is not subject to this bias.

## Findings

> **Read the method note above first.** Two findings from this spike's first
> pass are retracted below rather than reported: "October at-bats are longer"
> and "the October strikeout surge is entirely the opposition." Both fell to
> this spike's own matchup rule.

### 1. At-bats are NOT longer — the first pass got this wrong

| Pitches per plate appearance | mean gap | t |
| --- | --- | --- |
| Naive league-vs-league (**what the first pass reported**) | +0.0373 | +3.44 |
| Hitter-side expectation only | +0.0210 | +2.70 |
| Pitcher-side expectation only | +0.0073 | +0.62 |
| **Both ends of the matchup held** | **−0.0090** | **−1.05** |

95% [−0.0259, +0.0078], p=0.3033, n=25 seasons.

The naive gap is the **zero-sided** version of exactly the error finding 2
exists to catch. October hitters already see more pitches per trip in their own
regular seasons, and October pitchers already throw more per batter in theirs.
Hold both and the effect is gone. **The extra pitch per plate appearance is a
roster fact, not an October fact.**

### 2. Walks, not strikeouts, are October's plate-discipline story

Both rates by the same log5 method. The first pass used log5 for strikeouts and
the naive gap for walks, which inverted the conclusion.

| Per plate appearance, matchup held | mean | t | 95% |
| --- | --- | --- | --- |
| **Walks** | **+0.492pp** | **+3.54** | [+0.22, +0.76] |
| Strikeouts | +0.398pp | +1.65 | [−0.08, +0.87] |

The raw uncontrolled October strikeout gap is +2.04pp, so the matchup accounts
for roughly four-fifths of it — but the interval leaves anywhere from about
half to all. **"Entirely the opposition" is not supported and is not claimed.**

### 3. The hitting dip is small, and its sign is not settled

| Test | Mean gap | p |
| --- | --- | --- |
| Hitters vs. own regular season (one-sided, **never quote**) | −0.0882 OPS | <0.0001 |
| Pitchers vs. own regular season (one-sided, **never quote**) | +0.0366 OPS allowed | 0.0005 |
| Both ends held, additive | −0.0141 | 0.0413 |
| Both ends held, multiplicative | **−0.0089** | **0.1863** |

**Three undisclosed choices move it by more than its own size**:

| Minimum October usage | residual | t |
| --- | --- | --- |
| ≥1 PA/BF (as shipped) | −0.0141 | −2.14 |
| ≥5 | −0.0111 | −1.60 |
| ≥10 | −0.0057 | −0.81 |
| ≥20 | **+0.0081** | **+1.07** |

The residual is carried entirely by participants with fewer than ten October
trips. And the realized-PA weighting is **endogenous**: clubs whose October
went well batted more, so the sample over-weights the good Octobers, and
weighting clubs equally makes the dip larger. **Report this as "the famous
collapse is mostly the opposition, and what is left is between a small dip and
nothing" — not as a number.**

Role split (each group against its own regular season; the *between*-group
comparison is clean): starters +0.0361 (p=0.0007), relievers +0.0390
(p=0.0001). Neither departs from its own form more than the other.

### 4. Pitchers throw harder; the mix narrows only in short outings

Velocity **+0.516 mph** (t=16.16, n=1,074 pitcher-seasons from 589 men), a
*mean* and so not subject to the maximum bias.

| Role, measured across BOTH months | n | velocity |
| --- | --- | --- |
| Started in both | 537 | +0.53 |
| Relieved in both | 455 | +0.41 |
| Rotation → bullpen for October | 82 | **+1.02** |

The first pass split on **October role only**, so 82 regular-season starters
working October relief were counted as "relievers" — a role effect wearing
October's clothes. By tracking era: PITCHf/x 2008-2016 +0.64, Trackman
2017-2019 +0.43, Hawk-Eye 2021-2025 **+0.39**. Quote the newest.

**The mix narrowing does not survive where the measurement is trustworthy:**

| October pitches | n | corrected best-pitch share | t |
| --- | --- | --- | --- |
| 50-99 | 497 | +2.07pp | 5.13 |
| 100-149 | 200 | +1.92pp | 3.34 |
| 150-199 | 129 | +1.01pp | 1.51 |
| 200-299 | 138 | +0.68pp | 1.18 |
| **300+** | 108 | **+0.32pp** | **0.47** |

A complete correction would be flat in sample size. Velocity *is* flat across
the same bins (0.53/0.44/0.47/0.59/0.58), so this is specific to the mix
statistics. The multinomial control treats pitches as independent when real
sequences cluster by outing, handedness and count, so it **under-corrects**.
The pooled +1.56pp is an **upper bound**; the fix is a cluster bootstrap over
whole outings.

Corrected shares: 61% narrowed the mix, 56% leaned harder on the best pitch —
barely a coin. Fastball share +0.13pp (p=0.5884, 95% [−0.36, +0.62]): they do
not reach for the heater.

### 5. The quick hook is real, growing, and mostly not a decision

League: pitcher appearances per club-game **+0.514** (t=8.26, 24 of 25
seasons); batters faced per appearance −1.05.

Paired starters (n=627 pitcher-seasons from **326 men**, 2020 excluded):

| | Regular season | October | Gap |
| --- | --- | --- | --- |
| Innings per start (**decimal**, not ⅓ notation) | 6.13 | 5.09 | −1.04 |
| Pitches per start | 96.6 | 84.0 | −12.56 |

Era: **−0.85 IP** (2000-2012) → **−1.24 IP** (2013-2025). That trend is the
strongest evidence here that October managing genuinely changed.

**But "a decision, not fatigue" is retracted.** Splitting by October form:

| | n | innings lost vs. his own season |
| --- | --- | --- |
| Pitched at or better than his own season | 259 | **−0.24** |
| Pitched worse | 368 | **−1.61** |

Most of the lost innings belong to a starter being hit, not to a manager with a
plan. The pure managerial component is about a quarter of an inning. The first
pass's tell (pitches per batter 3.82 → 3.85) is itself an opposition effect.

Filter coverage: 1,395 of 1,772 October starts (79%). The excluded starts
belong disproportionately to flexibly-used staffs — the treatment itself.

**Does it win anything?**

| | Raw rho | Partial rho (October volume held) | 95% |
| --- | --- | --- | --- |
| Starter innings per start | +0.2812 | +0.0097 | [−0.12, +0.14] |
| Pitchers used per game | −0.2382 | +0.0300 | [−0.10, +0.16] |

The point estimate is zero, but n=233 only rules out |rho| above about 0.13.
Say "no effect large enough for 233 club-seasons to see," not "no effect."

### 6. October is close to a coin — but say what "close" means

198 series (2020 excluded), better record won **50.5%**, 95% [43.5%, 57.5%].

**A fair-opponent model is the comparison the first pass was missing.**
Empirical-Bayes shrink each club's record by that season's reliability, log5
between the two talents, a 0.54/0.46 home odds multiplier, each series walked
in its real format. That world — where the better club genuinely *is* better —
predicts **56.4%**.

**The sample cannot tell 50% from 56.4%.** Both sit inside the interval. The
honest statement is "October is close enough to a coin that a quarter century
cannot see the difference," not "there is very little there."

| Format | n | Better club won |
| --- | --- | --- |
| One game | 13 | 53.8% |
| Best-of-3 | 16 | 37.5% |
| Best-of-5 | 97 | 49.5% |
| Best-of-7 | 72 | 54.2% |

Record-gap Spearman rho=0.0361 (p=0.5772). **This null is about power**:
simulating the fair-opponent world 2,000 times, a test on 198 series clears the
conventional bar only **15.7%** of the time even when the effect is exactly as
big as the records imply.

**"Best record won it all 6 of 26" is evidence FOR the better team, not
against.** That club must win three rounds. A pure coin predicts 3.25
champions; the fair-opponent model predicts 4.67. Six is above both. (It is
also the maximum of 30 noisy records, so it carries the same upward bias
finding 4 corrects for.)

Two code bugs found in review and fixed: equal-seed series silently awarded to
`teamB` (five #1-vs-#1 World Series, four won by teamB; higher-seed rate 52.6%
→ 50.5%), and a `bestOf` derivation that labelled all 18 single-game wild cards
and all 31 best-of-five sweeps as best-of-three.

## Caveats

- **The matchup combination is an approximation.** Additive for OPS, log5 for
  rates. The additive form is systematically the most negative of the plausible
  choices because it drops the cross term. Sign and rough size only.
- **Park and weather are not controlled at all**, nor is fatigue (the baseline
  is the whole season, April included). Nothing here supports the pressure
  story specifically.
- **The realized-PA weighting is endogenous** (finding 3). Direction of the
  bias is known — toward zero — its size is not.
- **The velocity gap is measured against a whole-season baseline**, and league
  velocity ramps from April to midsummer, so some of +0.5 mph is the calendar.
  A September-only baseline is the fix. Cold pushes the other way.
- **The arsenal panel starts in 2008** and covers 18 of 26 seasons.
- **"Better team" means better record**, which is noisy and partly schedule.
- **2020 is excluded everywhere**, including — unlike the first pass — the
  series, arsenal and paired-starter panels.
- Counts described as "pitchers" are **pitcher-seasons**: 1,074 from 589 men,
  627 from 326 men. Re-running the headline tests clustering by pitcher leaves
  both at p<0.0001.
- Leave-one-season-out ranges are a **leverage check, not an interval** — a LOO
  range has width about SE×2/(n−1). Every interval quoted here is a proper one.

## What this leaves open

- A player-level version of finding 3 — 25 seasons is 25 data points.
- Third-time-through-the-order, which needs play-by-play and is the likeliest
  mechanism behind both the hook and any real hitting residual.
- A cluster bootstrap over whole outings for the arsenal panel. If the
  narrowing does not survive it above 300 October pitches, finding 4's mix half
  should be retracted.
- Velocity split by outing length, against a September baseline.
- Whether the hook null holds at the SERIES level rather than the club-season.
- Whether the walk result is the real plate-discipline story, one hitter at a
  time.
