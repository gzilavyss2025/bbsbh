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

### 1. At-bats are longer, by a little

League pitches per plate appearance, 3.827 regular season → 3.865 October.
Mean paired gap **+0.0373** (p=0.0031, n=25 seasons; longer in 17 of 25;
leave-one-season-out range [+0.0341, +0.0417]). Including 2020 changes it to
+0.0375 (p=0.0019).

That is one extra pitch roughly every 27 plate appearances — about 1.4 extra
pitches per team per game. Real, small, and not the thing a viewer is
noticing.

Strikeouts per plate appearance are **+2.04pp** in October (p<0.0001). Walks
are **+0.25pp** (p=0.1163) — nothing.

### 2. The bats do go quiet, but most of it is who is pitching

| Test | Mean gap | p |
| --- | --- | --- |
| Hitters vs. own regular season (one-sided, **do not quote**) | −0.0882 OPS | <0.0001 |
| Pitchers vs. own regular season (one-sided, **do not quote**) | +0.0366 OPS allowed | 0.0005 |
| **Both ends of the matchup held** | **−0.0141 OPS** | **0.0413** |
| Both ends held, batting average | −0.0082 | 0.0019 |
| Both ends held, strikeout rate | +0.40pp | **0.1111** |

Leave-one-season-out on the both-sides OPS gap: [−0.0178, −0.0116]. Below the
line in 16 of 25 seasons. Stable across eras (2000-2012 −0.0138, 2013-2025
−0.0145).

Two things fall out of this that a reader would not guess:

- **The October strikeout surge is entirely the opposition.** Once both ends
  are held, it is +0.40pp and indistinguishable from zero. October hitters
  strike out more because the men on the mound are better, not because of the
  month.
- **The residual is small.** 14 points of OPS is the difference between a
  .700 and a .714 hitter.

Splitting the October arms by role (both groups face the same lineups, so the
comparison *between* them is clean even though each number alone carries the
opposition problem): **starters +0.0361** OPS allowed vs. their own season
(p=0.0007), **relievers +0.0390** (p=0.0001). Nearly identical. The popular
"October is decided by bullpens" story does not show up here as a difference
in how the two groups perform relative to themselves.

### 3. A postseason series is close to a coin flip

213 series (2000-2025) between clubs with different regular-season records.

| Cut | Better club won |
| --- | --- |
| All 213 series | **52.1%** |
| Higher seed (n=213) | 52.6% |
| 1-3 games better (n=64) | 48.4% |
| 4-7 games better (n=87) | 52.9% |
| 8-12 games better (n=39) | 61.5% |
| 13+ games better (n=21) | 47.6% |
| Wild Card round (n=37) | 48.6% |
| Division Series (n=101) | 50.5% |
| Championship Series (n=50) | 58.0% |
| World Series (n=25) | 52.0% |

Size of the record gap vs. whether the better club won: Spearman rho=0.0497,
permutation p=0.4241 (within-season shuffle). **Being much better does not
measurably help.**

The club with the best record in the majors won the World Series **6 times in
26 seasons** (2007, 2009, 2016, 2018, 2020, 2024).

This is the cleanest possible restatement of the null that spikes #1-#4 kept
finding on "advancing once you are in." Those spikes could not separate the
deep runs from the early exits on any roster trait. This one says why: there
is very little there to separate.

### 4. Pitchers throw harder and narrower

1,164 pitcher-seasons with a full arsenal on both sides, 2008-2025.

| Measure | October vs. own regular season | p |
| --- | --- | --- |
| Fastball velocity | **+0.52 mph** | <0.0001 |
| Best-pitch share, naive | +1.94pp | <0.0001 |
| **Best-pitch share, small-sample corrected** | **+1.46pp** | **<0.0001** |
| Squared-share concentration, corrected | +0.0195 | <0.0001 |
| Pitch types used ≥10% of the time, corrected | −0.138 | <0.0001 |
| Fastball share of all pitches | +0.02pp | **0.9286** |

Starters +0.52 mph, relievers +0.51 mph — the velocity jump is not a
composition effect from more relief innings; it is the same men throwing
harder. Starters +1.83pp best-pitch share, relievers +2.04pp (naive figures).

**Pitchers do not throw more fastballs in October. They throw fewer different
things.** The fastball share is flat to four decimal places while the mix
concentrates — the change is dropping a fourth and fifth pitch, not reaching
for the heater.

Biggest real single-October leans (200+ October pitches, ranked against the
shrunken baseline): Sean Manaea 2024 (31% → 55%), Johnny Cueto 2015 (30% →
51%), Yordano Ventura 2015 (33% → 54%), David Peterson 2024 (31% → 49%),
Lance McCullers Jr. 2022 (25% → 43%).

### 5. The hook is much quicker — and it does not win anything

League pitchers used per club per game: regular season → October, **+0.514**
(p<0.0001, more in 24 of 25 seasons, LOO [0.491, 0.545]). Batters faced per
appearance: **−1.05** (p<0.0001).

Same pitcher, same year — 655 pitcher-seasons who started in October and
started all year:

| | Regular season | October | Gap |
| --- | --- | --- | --- |
| Innings per start | 6.11 | 5.08 | **−1.04** (p<0.0001) |
| Pitches per start | 96.3 | 83.9 | −12.4 (p<0.0001) |
| Batters per start | — | — | −3.40 (p<0.0001) |
| Pitches per batter faced | 3.82 | 3.85 | +0.03 |

That last row is the tell: **each batter costs the starter more pitches, and
he still throws twelve fewer, because he faces three and a half fewer men.**
The shorter outing is a decision, not fatigue.

And it is growing. Extra pitchers per game in October: **+0.37** in 2000-2012,
**+0.67** in 2013-2025. Starter innings lost against his own season: **−0.85**
(2000-2012, n=321) → **−1.21** (2013-2025, n=334). Managers manage October
differently than they did, and more differently every era.

**Does it work?** Among the 233 clubs that reached October:

| | Raw rho vs. ladder | p | Holding October volume fixed | p |
| --- | --- | --- | --- | --- |
| Starter innings per start | +0.2812 | <0.0001 | **+0.0097** | 0.8699 |
| Pitchers used per game | −0.2382 | <0.0001 | **+0.0300** | 0.8156 |

This is the trap from `docs/team-success-postseason-usage.md` firing again,
exactly as the framework predicted it would. Raw, it looks like a strong
finding in both directions — long starts go deep, quick hooks go home. Both
collapse to nothing once you hold fixed how much October baseball the club
actually played. A club that plays twenty games got there by winning, and
winning teams get more innings out of the starters they let finish.

**Quick hooks are a real, growing, measurable change in how October is
managed, and there is no evidence in 233 team-seasons that it wins or loses a
single series.**

### 6. Does the quick hook explain the quiet bats?

Across 25 seasons, the size of a season's hook gap vs. the size of its offense
residual: rho=+0.158 — the wrong sign for the mechanism, and far too thin a
sample (n=25 seasons) to mean anything either way. Listed as an open question,
not a finding.

## Caveats

- **The both-sides expectation is an approximation.** The additive form for
  OPS is the standard rough matchup combination, not a fitted model; the log5
  form for strikeout rate is exact for a probability but assumes independence
  between the hitter's and the pitcher's rates. A properly fitted matchup
  model would move the −0.014 somewhat. Its sign and rough size are the
  claim; its third decimal is not.
- **Park and weather are not controlled at all.** October is played in twelve
  clubs' parks, in colder weather, at night. Any of those could account for
  some or all of a 14-point OPS residual. This spike cannot tell them apart
  from "October pressure," and nothing here should be read as evidence for the
  pressure story specifically.
- **The regular-season baseline is the whole season, not September.** A tired
  player in October is being compared against his own April. Fatigue is inside
  the residual, not controlled out of it.
- **The strikeout null is a null, not a zero.** +0.40pp with p=0.11 over 25
  seasons means this spike cannot detect a difference, not that one is
  impossible. A player-level version would have far more power.
- **The arsenal panel starts in 2008**, so it covers 18 of the window's 26
  seasons and cannot speak to the 2000s at all.
- **The coin-flip finding uses regular-season record as "the better team."**
  Record is itself noisy and partly reflects schedule. A better strength
  estimate (run differential, or a projection) would raise the better club's
  win rate somewhat — the point stands directionally, but 52.1% is a floor
  reading, not a precise one.
- **2020 is excluded throughout** and reported alongside where it matters.
- **The role split in finding 2 compares each group to itself.** It does not
  say relievers and starters are equally good in October — they are not — only
  that neither group departs from its own regular-season form more than the
  other.

## What this leaves open

- A player-level version of finding 2. The season-level test has 25 data
  points; a hitter-level one would have tens of thousands and could separate
  "who declines" from "everyone declines a little."
- Third-time-through-the-order. The mechanism behind both the quick hook and
  any real offense residual is most likely how often a hitter meets a fresh
  arm, and that needs play-by-play, not season splits.
- Whether the velocity jump is adrenaline, shorter outings, or colder-weather
  measurement drift. Splitting +0.52 mph by outing length would start on it.
- Whether the quick hook's null holds at the SERIES level rather than the
  team-season level, where a single bad hook decision is not averaged away.
- Whether the 58.0% better-club win rate in the Championship Series (n=50) is
  real or the noise you expect from fifty coin flips. It is the only round
  that looks different, and n=50 is exactly the sample size where that means
  nothing.
