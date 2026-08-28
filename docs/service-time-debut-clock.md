# Does the debut calendar follow the service-time clock?

**Verdict: no-ship. The null holds.**

A player who joins a major-league active roster after a date in mid-April
cannot reach 172 days of service that season, so he finishes short of a
service year and reaches free agency a year later. The question is whether the
observed promotion calendar clusters after that date by more than talent,
roster need and the ordinary rhythm of April explain.

It does not, on this evidence. The raw jump is large and highly significant.
It disappears once the model knows how many days into the season it is.

| Model | Rate ratio after the line | 95% CI | p |
| --- | --- | --- | --- |
| Season fixed effects only | **1.560** | 1.309–1.859 | <0.0001 |
| **+ day-of-season shape** | **1.266** | 0.856–1.872 | 0.24 |

Three of the four kill criteria set for this spike trip. The fourth cannot be
answered in the form it was written. The sections below give each one.

Scripts and panel: `.scratch/service-clock/`.

## The cohort

**5,008 major-league debuts, 2005–2025**, from
`/api/v1/sports/1/players?season=YYYY`, which lists every man who appeared for
an MLB club in a season and carries his `mlbDebutDate`. A season's debut class
is that list filtered on the debut year. No performance threshold and no
salary-file membership decides who is in it. Zero rows are missing a debut
date.

That choice is not a convenience. The kill check below shows that both the
service-time column's blankness and a man's presence in `salaries.csv` track
the calendar, so a cohort drawn from that file would be selected by the very
thing the spike measures.

**2020 is excluded from every figure.** Its championship season ran 67 days,
so no man could reach 172, and the pro-rated grant that replaced the count is
in no feed this repository reads. The line cannot be derived for that season,
only guessed at.

The **transaction wire** supplies the day a man actually joined the active
roster. It covers 2009 onward: 102 to 177 rows a season in 2005–2008 against
6,055 in 2009 and 9,291 in 2010. From 2009 it resolves a roster addition for
92% of debutants.

## The line, and why it is not a constant

A service year is 172 days on the active roster. A man added on date D and
held to the last day of the championship season accrues `end − D + 1` days, so
the last date on which a full year is still reachable is:

```
line = regularSeasonEndDate − 171 days
```

The line is derived per season and never hard-coded. It depends only on the
season's **last** day, so it moves from 2011-04-10 to 2025-04-10 across the
window.

**It reproduces the canonical case exactly.** The 2015 season ended
2015-10-04, so the line was 2015-04-16. Kris Bryant was recalled on
2015-04-17, one day past, and finished the season with 171 days of service —
one short of the 172 he needed.

### The anchor correction that changed the answer

The distance from the start of the season to the line is the identifying
variation this spike depends on, and it must be measured from the day the
**league** opened, not from the season's first game.

Six seasons in the window open overseas — 2008 and 2012 in Japan, 2014 in
Australia, 2019 in Japan, 2024 in Seoul, 2025 in Tokyo. Two clubs play one or
two games, then the league waits six to ten days before the other twenty-eight
start. `regularSeasonStartDate` names the overseas game.

| Anchor | Where the line falls | Spread |
| --- | --- | --- |
| Season's first game | day 10 (2011) to day 23 (2025) | 13 days |
| **League opener** (first date with ten or more games) | day 8 (2012) to day 15 (2018, 2023, 2024) | 7 days |

Anchored on the first game, the spread is **almost entirely the overseas gap**,
and the "long" seasons are exactly 2014, 2019, 2024 and 2025. A test built on
that spread compares overseas seasons with ordinary ones and calls the
difference a service clock. Run that way, this spike produced a rate ratio of
1.702 (p=0.0012) and a fixed-calendar-band contrast of 14.4% against 5.5%
(p=0.0001) — a clean, wrong, publishable-looking finding.

Anchored on the league opener the late-line group is three overseas seasons
(2019, 2024, 2025) and three ordinary ones (2018, 2021, 2023), and both
results collapse. **This is the single largest reason the spike ships a null
rather than a finding.**

## The kill criteria

### 1. The service-time blank rate — checked first

`salaries.csv`'s `mls` column is blank on 8,041 of 27,349 rows, **29.4%**. The
blankness is a coverage window, not scatter:

| Rows | Blank | Rate |
| --- | --- | --- |
| 2000–2009 | 7,970 of 7,970 | **100%** |
| 2010–2026 | 71 of 19,379 | **0.4%** |

Read literally over the whole file, the criterion **trips**. Among salary rows
joined to a known debut, the blank rate is 10.0% for men who debuted on or
before the line against 6.3% for men who debuted after it (z=6.83, p<0.0001).

The cause is era, not timing. Restricted to 2010–2026 rows the difference is
0.2% against 0.1% (z=1.17, p=0.24). Split by debut era it is 26.8% for men who
debuted in 2005–2009 against 0.3% for 2010–2025.

The remedy is structural rather than a restriction chosen after seeing the
result: **the cohort never comes from `salaries.csv`.** It comes from the
complete player list, so the blank rate cannot select it.

**A second selection, which the criterion does not name, was found anyway.**
Whether a debutant has a following-season salary row *at all* depends on when
he debuted: 70.7% for pre-line debuts against 65.5% for post-line
(z=2.38, p=0.017). Any statistic read out of that column is computed on a
sample selected by the calendar. This bounds the service column further.

### 2. Rank-matched controls — the effect is gone with them

Every rank-matched cut is null, and none is larger where the incentive lives.
A club only gains by managing the clock for a man it expects to hold six
years, so the effect must be **larger** for those men. It is not.

| Cut | n | Rate ratio | 95% CI | p |
| --- | --- | --- | --- | --- |
| Round 1 pick | 87 | 2.126 | 0.424–10.660 | 0.36 |
| Rounds 1–5 | 216 | 0.990 | 0.430–2.277 | 0.98 |
| Round 6+ / no draft record | 281 | 1.239 | 0.609–2.518 | 0.55 |
| Award tier A or B, prior seasons | 143 | 0.988 | 0.358–2.728 | 0.98 |
| Age at debut 23 or under | 85 | 0.933 | 0.258–3.370 | 0.92 |
| **Incentive present** (young + pedigree) | 116 | **1.106** | 0.379–3.226 | 0.85 |

Pedigree is borrowed, not rebuilt: the corrected draft round, the age at debut
and the minor-league record come from the 3,061-player cohort behind
`docs/prospect-traits.md`. The award tier counts only honours won in a
**strictly earlier** season, which is the fix that document's question 4 had
to make — a Futures Game selection is played in mid-July, so counting the
debut season's own awards makes the award forbid the very month under test.

**This criterion trips.**

### 3. The placebo — it shows a comparable effect

Each season's line is slid by a fixed number of days and the model is
refitted. A real line should stand out from its neighbours.

| Shift | Rate ratio | p |
| --- | --- | --- |
| −6 | 1.667 | **0.028** |
| **0 — the true line** | **1.266** | **0.24** |
| +12 | 0.700 | 0.052 |
| +28 | 1.864 | **0.0045** |
| +30 | 1.596 | **0.027** |

Eight of 25 placebo shifts return a ratio at least as large as the true line,
a permutation p of **0.346**. Three placebo dates are individually *more*
significant than the line itself.

**This criterion trips.**

### 4. Club fixed effects — the criterion cannot be answered as written

Adding club dummies leaves the estimate at 1.266, identical to three decimals.
That is arithmetic, not a passed test: the line falls on the same date for all
thirty clubs in a season, so a club dummy is orthogonal to it and cannot move
the coefficient.

The within-club question has to be asked differently — give every club its own
line coefficient and test whether they differ. That test is null:
**likelihood-ratio χ² = 34.79 on 29 df, p = 0.211.** No club departs from the
common estimate by more than chance, so the sample does not support naming
one.

## The two clocks, and why the earlier pass saw nothing

`docs/prospect-traits.md` question 4 measured the debut month and found "the
award calendar, not the promotion calendar". Measured on the **debut date**,
promotions after the line look *less* frequent, not more: a rate ratio of
**0.651**. That is the wrong direction, and it is an artifact.

Service starts on the day a man joins the active roster, not on the day he
first plays. A bench player or a middle reliever who breaks camp may not
appear for a week, and every one of those first appearances lands in the days
before the line without any promotion decision having been made inside the
season. On the **roster-add date** from the wire, the same comparison gives
**1.640**.

So the debut date is the wrong instrument for this question. Correcting it
turns the sign around — and the corrected figure is then explained away in
full by the day-of-season control.

## The decisive test

The line sits a different number of days into the season each year, so a fixed
band of the calendar can sit on either side of it. Days 12 to 14 of the season
are **after** the line in nine seasons and **on or before** it in six.

| Band days 12–14 | Promotions | Share |
| --- | --- | --- |
| Line already passed (free) | 33 of 443 | 7.4% |
| Line not yet reached (costly) | 26 of 346 | 7.5% |

Season-level test on 15 seasons: t=0.02, **p=0.98**. The same three days of
April, opposite service consequence, and no difference at all.

The model version of the same comparison is the headline table at the top: a
Poisson count of first-time roster additions per (season, day) cell, with
season fixed effects absorbing how much a season moves at all, day-of-season
bins absorbing the April ramp every season shares, and one coefficient on
"this day is past the line", identified only by where the line falls.

**834 first-time roster additions** in the first 45 days of a season across 16
seasons, about 52 a season.

## Roster need

Injured-list placements by the promoting club in the 21 days before the
promotion, taken from the wire and read at the arriving man's own side of the
roster. The position is named inside the sentence — "placed RHP Foo Bar on the
10-day injured list" — so no second pull was needed.

The control is available, and it runs **against** the clock reading. Mean
same-side placements before a promotion: **2.26 before the line against 1.64
after** (difference 0.63, t=3.78, p=0.0002). Roster need is *higher* before
the line. A club promoting in the first ten days of a season is answering an
injury, which is the ordinary reason to promote early and the opposite of
holding a man back.

## What did not hold, stated as plainly as what did

- Leave one season out, 16 refits: the ratio moves only between 1.173 and
  1.429, and is significant in **0 of 16**.
- Every era is null, including the one that should differ most. The 2022
  agreement added promotion incentives that cut against holding a man down.

| Era | n | Rate ratio | p |
| --- | --- | --- | --- |
| 2009–2011 | 116 | 0.965 | 0.97 |
| 2012–2016 | 250 | 1.397 | 0.52 |
| 2017–2021 | 216 | 1.282 | 0.54 |
| 2022–2025, post-CBA | 252 | 1.447 | 0.32 |

## What this null does not say

The controlled estimate is 1.266 with a 95% interval of **0.856 to 1.872**.
The data are consistent with anything from a small reduction to a
1.87-fold rise.

This rules out the doubling-or-more that a widespread, uniform practice would
leave in a cohort of this size. It does **not** rule out a practice confined
to a handful of men a year, which is what the well-known individual cases
actually look like: the pedigree cut keeps about eight promotions a season.
A test at that grain needs a prospect ranking this repository does not have —
the app's own snapshot begins 2026-07-07, which is no use for a man drafted in
2013.

The finding is that the calendar does not carry the practice at league scale.
It is not a finding about any individual promotion.

## A data defect found on the way: `mls` bare integers

**`salaries.csv`'s `mls` column has a numeric sentinel, and it survived the
W0 enumeration.** 2,926 of the 19,308 populated cells — **15.2%** — are bare
integers, and they mix two different things that share one spelling.

Jonny Venters reads `1`, `2`, `3`, `4`, `5` in 2011 through 2015 and then a
real `5.159` in 2019. He debuted 2010-04-17, so entering 2011 he held about
0.168, not 1.000. Josh Collmenter, Brennan Boesch and Brad Bergesen carry the
same ladder. Derek Law reads `1` in 2017 while his own 2018 row (`1.11`)
proves 2017 was `0.110`.

Some bare integers are right. Shohei Ohtani reads `8` in 2026, and an Opening
Day 2018 debut with no demotion really does bank exactly 8.000.

The two can be separated in aggregate but not per cell. Take the men who
**provably** banked no service year, because the wire says they joined an
active roster after the line:

| Cell shape | n | Reads one year or more — provably wrong |
| --- | --- | --- |
| Carries a day count | 2,175 | 12 = **0.6%** |
| Bare integer | 18 | 11 = **61.1%** |

Adley Rutschman joined on 2022-05-21, 34 days past the line. His next-spring
cell reads `1`.

**The bind.** Of the 187 men who joined on or before the line and have a
next-spring cell, 65 carry a bare integer and **all 65 read exactly `1`** —
which is what a correctly banked single year looks like. So the confirmations
and the errors are spelled identically. Excluding the bare integers removes
both: the "banked a full year" rate then reads 1.6% before the line and 1.1%
after, which separates nothing.

**Consequence for the spike's premise.** The premise was that service time is
now in the data, so the rival explanation can finally be tested. It is in the
data, but it cannot carry this test. The line here is established by the
collective bargaining arithmetic and confirmed against Kris Bryant's 171 days,
not by `salaries.csv`.

**Recommended rule for any reader:** treat a bare-integer `mls` cell as an
approximation, not a service figure. Never use it to decide whether a man
crossed a service threshold.

## Reproducing

```bash
cd .scratch/service-clock
node pull.mjs            # season calendar, debut cohort, transaction wire
node pull-schedule.mjs   # games per date, for the league opener
node build.mjs           # panel.json — one row per debut
node k0-blank-rate.mjs   # the kill check, run first
node mls-defect.mjs      # the sentinel, quantified
node analyze.mjs         # descriptive layer, both clocks
node decisive.mjs        # the fixed-calendar-band test
node controls.mjs        # every control, one specification
```

`transactions.json` is 47 MB and is git-ignored; `pull.mjs` rebuilds it in
about two minutes and skips anything already cached.
