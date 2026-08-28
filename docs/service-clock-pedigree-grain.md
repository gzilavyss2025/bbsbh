# Does the service-time clock show up at true pedigree grain?

**Verdict: no-ship. The null holds, and the limit it carried is now tested
rather than assumed.**

`docs/service-time-debut-clock.md` shipped a null. It stated one limit it could
not remove:

> This rules out the doubling-or-more that a widespread, uniform practice would
> leave in a cohort of this size. It does **not** rule out a practice confined
> to a handful of men a year [...] A test at that grain needs a prospect ranking
> this repository does not have.

That ranking now exists. `.scratch/top-prospects-history/` holds MLB Pipeline's
own historical Top Prospects lists — 1,448 ranked player-seasons across
2009–2024, on native MLB ids. This pass runs the test the limit said could not
be run.

**The answer is that the test cannot distinguish anything at that grain.** That
is the result. It is not a preliminary finding, and it is not a failure to look
hard enough. It is a property of the design, and it was computed before any
estimate was fitted.

That parent document stays exactly as it is. Nothing here corrects it.

Scripts and panel: `.scratch/service-clock-pedigree/`.

## The power, which was computed and committed first

The parent spike's proxy pedigree cut returned n=116 with an interval from 0.379
to 3.226. An interval that spans a halving and a doubling is consistent with
almost anything. A true-rank cut can only be smaller. So the first question is
not what the effect is. It is what effect the test could see at all.

`power.mjs` and `power-exact.mjs` ran, and their output was committed, in commit
`b898e7c` — **before `analyze.mjs` existed**. The git history carries the order.

### Where the power actually comes from, which is far less than the cohort

The model carries season fixed effects and three-day day-of-season bins. Take a
bin that sits wholly after the line in every season. The line indicator is one in
every cell of that bin, so the bin dummy absorbs it exactly. That bin tells the
line coefficient nothing.

Only the bins the line falls **inside** — in some seasons but not others —
identify the coefficient. The line lands between day 8 and day 15 of the season.
So the whole test rests on about six days of the calendar.

| grain | promotions | of which on identifying days |
| --- | --- | --- |
| top-100, observed-deep | 70 | **5** |
| top-30, observed | 34 | **7** |
| top-10, observed | 12 | **2** |
| top-30, all seasons | 49 | 10 |
| top-10, all seasons | 19 | 4 |
| the whole cohort, for scale | 834 | 133 |

**The honest n of this test is the right-hand column.**

### The minimum detectable effect, fixed before the test ran

Alpha 0.05, two-sided, 80% power, 1,000 simulations a point. The cohort size is
held fixed, so a rate ratio moves men across the line rather than inventing
promotions.

| grain | n | analytic MDE | simulated MDE | 95% interval span at the null |
| --- | --- | --- | --- | --- |
| top-100, observed-deep | 70 | 16.08 | none below 10 | a factor of **48.7** |
| top-30, observed | 34 | 10.24 | none below 10 | a factor of **25.9** |
| top-10, observed | 12 | 73.17 | none below 10 | a factor of **406.0** |
| top-30, all seasons | 49 | 7.66 | none below 10 | a factor of 17.3 |
| top-10, all seasons | 19 | 31.87 | none below 10 | a factor of 126.9 |
| **top-100 × line, interaction** | 70 | **2.45** | **2.40** | a factor of 3.5 |

No subgroup grain reaches 80% power at any rate ratio up to 10. The top-10 cut
would need a **73-fold** effect. One specification — the interaction in the next
section — has usable power, and only one.

### The exact test cannot reject at top-10 at any effect size

A Poisson model with twenty-odd nuisance columns is the wrong instrument for a
dozen events, so the spike also runs the parent's design-based test, which fits
nothing. The line sits a different number of days into each season, so one fixed
band of the calendar falls after the line in some seasons and before it in
others. Same days of April, opposite service consequence. The null distribution
is the exact conditional binomial.

| grain | promotions in the band | peak power at **any** effect size |
| --- | --- | --- |
| top-100, observed-deep | 5 | 0.72 |
| top-30, observed | 7 | 0.74 |
| **top-10, observed** | **2** | **0.00** |
| top-30, all seasons | 9 | 0.93 |
| **top-10, all seasons** | **3** | **0.00** |
| the whole cohort | 133 | 1.00 |

**At top-10 the peak power is zero, and that is arithmetic rather than an
estimate.** Two promotions land in the band. The most extreme outcome available
— both after the line — carries an exact p of 0.130. No data the top-10 cut
could ever produce would reject at 0.05. Three of the six grains cannot reach
80% power however large the truth is.

## The cohort, and the three traps it is built around

834 first-time roster additions, in the first 45 days of a season, across 16
seasons. That is the parent spike's cohort exactly, and `panel.mjs` throws if it
does not reproduce the number.

**1. Absent is not unranked.** Men are ranked before they debut, and the rank
file starts in 2009. A man who debuted in 2009 was listed in 2007 or 2008, which
the file does not hold. The ranking-window groups are **reused** from
`.scratch/prospect-value/panel.mjs` rather than derived a second time, and the
copy is asserted row by row against that panel's own output: all **2,585** shared
players land in the same group, and the window still catches **98.5%** of ranked
debutants.

| group | debut years | promotions in the cohort |
| --- | --- | --- |
| observed-deep | 2016–2023 | 399 |
| observed-shallow | 2013–2015 | 148 |
| censored | 2009–2012, 2024–2025 | 287 |

**2. Depth is not 100 every year.** 2009, 2010 and 2011 are top-50 lists, and
2020 and 2021 stop at 99. Depth is read per season from `seasons.json`, never
assumed. A rank of 30 means the same thing on a top-50 list, so the top-30 and
top-10 cuts run on the whole observed window. A "ranked at all" cut does not, so
the top-100 cut runs on observed-deep alone.

**3. The anchor.** Day 0 of a season is the **league opener** — the first date
carrying ten or more games — and never a club's first game. Six seasons open
overseas and then pause six to ten days. Anchored on the first game the parent
spike returned 1.702 at p=0.0012, which was entirely the travel gap. This pass
takes `preLineDays` straight from the parent panel and changes nothing. The
rebuilt schedule cache reproduces every documented gap: 2008 six days, 2012 ten,
2014 nine, 2019 eight, 2024 eight, 2025 nine.

A fourth choice is the spike's own. **A rank counts only if it was known when the
club acted.** MLB Pipeline publishes a season's list before that season opens, so
a rank in the debut season is known to a club promoting in April. A rank
published the following season is not, and it is excluded. It changes almost
nothing, and the sensitivity block reports both.

### The join is right, and it can be checked by eye

The twelve top-10 men in the observed window:

| season | rank | man | day of season | days past the line |
| --- | --- | --- | --- | --- |
| 2015 | 2 | Kris Bryant | 11 | **+1** |
| 2015 | 5 | Addison Russell | 15 | +5 |
| 2015 | 10 | Noah Syndergaard | 33 | +23 |
| 2018 | 3 | Gleyber Torres | 24 | +9 |
| 2018 | 2 | Ronald Acuña Jr. | 27 | +12 |
| 2019 | 1 | Vladimir Guerrero Jr. | 29 | +15 |
| 2019 | 6 | Nick Senzel | 36 | +22 |
| 2021 | 4 | Jarred Kelenic | 42 | +28 |
| 2022 | 5 | MacKenzie Gore | 7 | −2 |
| 2022 | 5 | Royce Lewis | 28 | +19 |
| 2022 | 2 | Adley Rutschman | 43 | **+34** |
| 2023 | 6 | Grayson Rodriguez | 6 | −9 |

Kris Bryant at +1 and Adley Rutschman at +34 both reproduce the parent document
exactly, from a join built on native ids with no name matching. These are the
men the whole question is about, and there are twelve of them.

## The results

### The parent's model, at each grain

| grain | n | rate ratio | 95% CI | Wald p | LRT p |
| --- | --- | --- | --- | --- | --- |
| top-100, observed-deep | 70 | **0.529** | 0.056–4.958 | 0.58 | 0.56 |
| top-30, observed | 34 | **1.413** | 0.275–7.268 | 0.68 | 0.68 |
| top-10, observed | 12 | **not estimable** | — | — | 0.077 |
| top-30, all seasons | 49 | 0.757 | 0.180–3.179 | 0.70 | 0.70 |
| top-10, all seasons | 19 | 1.781 | 0.146–21.785 | 0.65 | 0.65 |
| the whole cohort | 834 | 1.266 | 0.856–1.872 | 0.24 | 0.24 |

**The top-10 cut is reported as not estimable, and that is deliberate.** The fit
separates: every in-band promotion sits on one side of the line, so the
likelihood has no interior maximum and the solver runs the coefficient off to
the ridge. It prints a rate ratio of 5,233,467. That number is a numerical
artifact of a fit that did not converge to anything, and printing it as an
estimate would be the worst thing this document could do. The pre-registered
power says the same thing in advance: peak power zero.

Note also that **two of the four estimable subgroup point estimates sit below
1.0** — fewer promotions after the line, the opposite of the claim. The
estimates run 0.529, 1.413, 0.757, 1.781 with no ordering by pedigree. That is
what noise looks like.

### The exact test, which fits nothing

| grain | in band | after / before | rate ratio | 95% CI | exact p |
| --- | --- | --- | --- | --- | --- |
| top-100, observed-deep | 5 | 1 / 4 | 0.333 | 0.01–3.37 | 0.40 |
| top-30, observed | 7 | 4 / 3 | 1.167 | 0.20–7.96 | 1.00 |
| top-10, observed | 2 | 2 / 0 | infinite | 0.33–infinite | 0.13 |
| top-30, all seasons | 9 | 4 / 5 | 0.859 | 0.17–3.99 | 1.00 |
| top-10, all seasons | 3 | 2 / 1 | 2.516 | 0.13–148.44 | 0.59 |
| the whole cohort | 133 | 70 / 63 | 1.193 | 0.84–1.70 | 0.34 |

The top-10 row is the pre-registered impossibility, observed. Both in-band
promotions fall after the line — the most extreme outcome the cut can produce —
and the exact p is 0.130.

## The one specification with power, and it fails its placebo

The rank-matched criterion is best asked as one model rather than as a thin
subset. Give the whole observed-deep cohort a shared April shape, then ask
whether the line coefficient **differs** between ranked and unranked men. The day
bins are then estimated off all 399 men instead of off the 70 ranked ones.

| cut | interaction | 95% CI | p |
| --- | --- | --- | --- |
| top-100 × line | **1.250** | 0.649–2.410 | 0.51 |
| top-30 × line | 0.814 | 0.313–2.117 | 0.67 |
| top-10 × line | 0.961 | 0.196–4.711 | 0.96 |

This is the only informative cell in the document. Its minimum detectable effect
is 2.40, and the estimate is 1.250 with an upper bound of 2.410. So it does rule
something out: **top-100 prospects are not treated more than about two and a half
times differently from everyone else at the line.**

**But it buys its power with an assumption the subset fits never make** — that
absent a service clock a ranked man follows the same April promotion shape as an
unranked one. The placebo tests exactly that, and it fails.

| shift, days | interaction | p |
| --- | --- | --- |
| −10 | 0.464 | 0.21 |
| −4 | 0.807 | 0.57 |
| **0 — the true line** | **1.250** | **0.51** |
| +6 | 1.747 | 0.059 |
| **+8** | **1.922** | **0.023** |
| **+10** | **1.882** | **0.021** |
| **+12** | 1.692 | **0.048** |
| **+14** | 1.685 | **0.049** |
| +20 | 0.853 | 0.59 |

Ten of 25 placebo shifts are at least as large as the true line, a permutation p
of **0.423**. Four shifted dates are individually significant while the real line
is not.

**And the shape of that sweep is the diagnosis.** The estimate does not step at
the line. It climbs smoothly from 0.464 at ten days early, through 1.250 at the
line, to a peak near 1.9 about ten days late, then falls away. A service line is
a discontinuity. This is a ramp. It says ranked men are promoted on a different
and later April curve than unranked men, which is what the shared-shape
assumption forbids. The interaction is reading that shape difference, not the
service line. **This criterion trips.**

## The other kill criteria

**The placebo, on the subsets.** No subgroup grain distinguishes the true line
from its neighbours.

| grain | placebos at least as large | permutation p | placebos individually significant |
| --- | --- | --- | --- |
| top-100, observed-deep | 20 of 25 | 0.808 | 0 |
| top-30, observed | 8 of 25 | 0.346 | 0 |
| top-30, all seasons | 17 of 25 | 0.692 | 0 |

**Roster need runs against the clock reading, exactly as it did in the parent.**
Mean same-side injured-list placements by the promoting club in the prior 21
days:

| grain | before the line | after the line |
| --- | --- | --- |
| top-100, observed-deep | **2.38** (n=13) | 1.53 (n=57) |
| top-30, observed | **1.83** (n=6) | 1.36 (n=28) |
| the whole cohort | **2.26** (n=155) | 1.64 (n=679) |

Need is higher **before** the line at pedigree grain too. A club promoting a top
prospect in the first days of April is answering an injury.

**Club fixed effects cannot be asked here, and the parent already showed why the
obvious version is empty.** The line falls on the same date for all thirty clubs
in a season, so a club dummy is orthogonal to it and cannot move the coefficient.
The parent asked the within-club question properly instead — one line coefficient
per club — and that model needs thirty coefficients. At this grain it has nothing
to fit them on:

| grain | promotions | clubs | per club |
| --- | --- | --- | --- |
| top-100, observed-deep | 70 | 27 | 2.59 |
| top-30, observed | 34 | 24 | 1.42 |
| top-10, observed | 12 | 10 | 1.20 |

The test is not run, and **no club is named.**

**Leave one season out.** Every refit is null, and the range at top-100 reaches
zero because dropping one season separates the fit.

| grain | refits | range | significant |
| --- | --- | --- | --- |
| top-100, observed-deep | 7 | 0.000–1.213 | **0 of 7** |
| top-30, observed | 10 | 0.542–1.978 | **0 of 10** |
| top-30, all seasons | 16 | 0.231–0.941 | **0 of 16** |

## Sensitivity — the choices that could have changed the answer

**Rank known at promotion time, against rank over the whole window.** Letting in
a rank published after the debut season moves nothing: 0.529 against 0.505 at
top-100 (n=70 against 71), and 1.413 against 1.511 at top-30 (n=34 against 35).

**The censored years.** The extended arm carries every debut season 2009–2025,
including the years whose earlier lists are missing. It is reported as a labelled
power arm and never as the primary. It is admissible here for a reason the
ranked-versus-unranked question could not use: unranked men never enter this
test. The denominator is calendar exposure, not men. An undercount of ranked men
in a season is absorbed by that season's fixed effect, because it does not vary
across days within the season.

| window group | promotions | of which top-30 |
| --- | --- | --- |
| censored | 287 | 15 (5.2%) |
| observed-shallow | 148 | 10 (6.8%) |
| observed-deep | 399 | 24 (6.0%) |

The censored share is lower because the lists that would have named those men do
not exist, not because the men were worse.

## What the raw calendar looks like, and why it proves nothing

| grain | promotions after the line |
| --- | --- |
| top-100, observed-deep | 57 of 70 — 81.4% |
| top-30, observed | 28 of 34 — 82.4% |
| top-10, observed | 10 of 12 — 83.3% |
| the whole cohort | 679 of 834 — 81.4% |

Ten of the twelve top-10 men joined a roster after the line. That looks like the
claim, and it is the trap the parent spike was built to avoid. Every grain sits
on the cohort share, and the cohort share is mostly exposure: only about a week
or two of the first 45 days falls before the line at all. The shares are the
same because the calendar is the same.

## What this null does and does not say

**It removes the parent's stated limit by testing it, not by answering it.** The
limit said a practice confined to a handful of men a year could not be ruled out
without a real ranking. There is now a real ranking. The practice still cannot be
ruled out — but the reason is now measured rather than assumed, and the reason is
that a handful of men a year does not produce a testable cohort.

Stated plainly:

- **At top-30 and top-10 the test cannot distinguish anything.** Not "found
  nothing". Cannot distinguish. The intervals span factors of 26 and 406, the
  minimum detectable effects are 10-fold and 73-fold, and the exact test at
  top-10 cannot reject at any effect size whatsoever.
- **One thing is ruled out.** Top-100 prospects are not treated more than about
  2.4 times differently from other debutants at the line — and even that estimate
  fails its placebo, so it should be read as a bound, not as a measurement.
- **Nothing is overturned.** The parent's 1.266 with an interval of 0.856 to
  1.872 stands untouched. This work adds no reason to revisit it.
- **No individual promotion is described here.** Twelve men appear in a table so
  that the join can be checked. The test says nothing about any of them, and this
  document makes no claim about the conduct of any club.

The finding is that the pedigree grain is out of reach of this evidence, and
that the size of the gap can now be quoted.

## What would actually answer it

A cohort, not a sharper test. The binding constraint is that about six days of
each season carry the contrast, and only a handful of ranked men land there. More
seasons is the only lever this repository could pull: the rank file starts in
2009, and a third-party source for 2005–2008 is issue #946. Four more seasons
would add roughly two in-band top-30 promotions. That is not enough, and it is
worth saying so before anyone spends the effort.

## Reproducing

```bash
cd .scratch/service-clock/
node pull-schedule.mjs        # the league opener; the cache is git-ignored
cd ../service-clock-pedigree/
node panel.mjs                # panel.json — the cohort joined to the rank lists
node power.mjs                # power.json — run and committed BEFORE analyze
node power-exact.mjs          # power-exact.json — likewise
node analyze.mjs              # findings.json
```

`panel.mjs` throws rather than writing a panel if the window groups disagree with
`.scratch/prospect-value/panel.mjs`, if the window capture rate falls below 95%,
or if the base cohort is not the parent spike's 834. `power.mjs` throws if the
mirrored model fails to reproduce the parent's published 1.560 and 1.266.
