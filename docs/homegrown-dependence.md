# Homegrown dependence and promotion speed

Research spike, 2026-08-24. Follow-up to `docs/team-movement-windows.md`, which
is itself a follow-up to `docs/level-tenure-benchmark.md`. It uses that spike's
duration rows and adds one new measurement to them.

**The question.** Do organizations that lean harder on their own players at the
major-league level move players through the minors faster or slower? And does
either thing relate to winning?

**The answers, in order of how much weight they carry.**

1. **More homegrown-dependent organizations promote SLOWER.** An organization
   one standard deviation above its own average on homegrown share promotes
   about **11% slower** the following year, identified within organization over
   time, org-clustered p=0.0056. It survives every check applied to it.
2. **Homegrown dependence does not predict winning.** 600 organization-seasons,
   a tight interval around zero: roughly **−0.8 to +2.4 wins per 162** per
   standard deviation. This is a well-powered null, not an absent finding.
3. **Fast promotion pays off, descriptively.** A graduate promoted one standard
   deviation faster than the model expects produces about **1 more win above
   replacement in his first six seasons** and is about 4 points less likely to
   bust. Most of that survives a control for how he was actually hitting or
   pitching at the level. It is a description of what happened, not a lever.
4. **Homegrown dependence is NOT low payroll or a bad team in disguise.** The
   most likely way this question could have collapsed. It did not.

None of this is causal. Every statement above is an association, and the
sections below say where each one could be wrong.

## What "homegrown" means here, and why

**Player P is homegrown to organization X if and only if X is the parent
organization of P's FIRST professional minor-league season.**

The obvious alternative is "the club that drafted him". That rule cannot see a
quarter of the population: 25% of the cohort has no draft record at all
(`docs/level-tenure-benchmark.md`) — international signees, plus a few players
posted out of NPB. First professional season treats a Dominican Summer League
signing and a first-round pick the same way, which is what a dependence measure
needs.

Resolving it took more care than expected, and three things had to be right.

**Entry level.** `raw.json` carries only sportIds 11–14 (AAA/AA/High-A/A). A
player's first professional season is usually below that — the complex leagues
(sportId 16, which is where the DSL lives) or short-season A (sportId 15,
abolished at the 2021 reorganization). Reading first-pro-org off `raw.json`
alone starts a player at A ball and mis-attributes anyone traded between rookie
ball and his first full-season assignment.

**The position-conversion trap.** `raw.json`'s per-player sweep asks for the ONE
stat group matching the player's CURRENT primary position. A player who changed
position loses every pre-conversion season. **Sergio Santos** is the case that
caught it: a shortstop drafted in the first round by Arizona in 2002, a pitcher
from 2009, so a pitching-only sweep starts him in 2009 and files him as a Blue
Jays product. Under both groups he resolves to Arizona — which is also who
drafted him. `group=hitting,pitching` returns both blocks in one response
(verified), so the corrected sweep is six calls per player rather than twelve.

**sportId 17 is excluded.** The Arizona Fall League, winter ball and the WBC all
sit under it, and every club there carries `parentOrgId` 11, "Office of the
Commissioner". Including it invents a 31st organization out of fall-league
rosters. 21 players in the full population resolve there and are dropped rather
than counted.

### Coverage, and the cross-check that validates the rule

| | Players | Resolved | Rate |
| --- | --- | --- | --- |
| The 2005–2023 debut cohort | 3,061 | 3,029 | 99.0% |
| Every MLB player 2004–2023 | 5,878 | 5,828 | 99.1% |

30 organizations, 79 (Milwaukee) to 125 (the Yankees) cohort players each. Entry
level is the complex leagues for 1,952, short-season A for 688, full-season A
for 203, and above that for 186 — the last group being older international
professionals who entered above rookie ball.

The rule is validated against the club that actually drafted him, using
`src/api/person/identity.js`'s `draftInfo()` logic — match `drafts[]` on
`person.draftYear` — **not** `raw.json`'s `ped.draftRound`, which came from
`drafts[0]` and can therefore be an EARLIER UNSIGNED draft. That is a real bug
in `pull.mjs`'s `fetchPedigree` and it is not rare: **375 of the cohort have a
`drafts[0]` that is not their signing draft.** Aaron Judge is the canonical case
— a 31st-round high-school pick in 2010, before his 2013 first round.

Against the corrected rule, on the 2,321 resolved players who have a signing
draft:

```
first-pro-org == drafting club:   2,265   97.6%
disagree:                            56    2.4%
  of which the first pro season PRECEDES the draft year: 41
```

Those 41 are Rule 5 selections of already-professional players, which statsapi's
`drafts` hydrate returns beside the amateur draft. They are not failures of the
rule — the rule is right and the draft row is not his entry. That leaves **15
genuine disagreements, 0.6%**, and they are the cases the rule is meant to
handle: Edwin Encarnación was drafted by Texas in 2000, never played a
professional game for Texas, and entered at Billings for Cincinnati in 2001.

The corrected draft record is also used for the draft-round tier in every model
below. It **moves 284 of 3,061 players between tiers** against the tier the
prior spike fitted.

## What "dependence" means, and what it cost

**For organization X in season S: the share of X's major-league playing time
contributed by players homegrown to X.** Plate appearances for hitters, batters
faced for pitchers — batters faced rather than innings because it is the
pitcher's analogue of a plate appearance, so a pooled share is a share of
confrontations rather than a sum of two different units.

`playerPool=all` is mandatory on `/api/v1/stats`. Without it the endpoint
silently applies a qualification floor — 239 rows against 1,562 for one AAA
season, measured in `perf-pull.mjs` — and a floor here would delete exactly the
marginal players a dependence share is about. `src/api/statsLevels.js`'s
`fetchTeamSeasonStats` already passes it.

The stat lines were cheap: 1,200 calls, 35,446 player-team-season rows. The cost
was the 5,878 distinct players behind them, each needing a six-call minor-league
sweep to resolve his entry organization. Both are cached in
`.scratch/level-benchmarks/`, so a rerun is free.

Playing time by a player whose entry organization does not resolve is excluded
from BOTH numerator and denominator, so the share is a share of what the rule
can speak about. That exclusion is tiny: median 0.00% of an organization-season's
playing time, 5.5% at the 95th percentile, 11.0% at worst.

The panel is **600 organization-seasons, 2004–2023**. Homegrown share runs 0.055
to 0.707, median 0.387.

| Most homegrown, 2004–2023 mean | | Least | |
| --- | --- | --- | --- |
| Colorado | 0.532 | San Diego | 0.258 |
| Minnesota | 0.503 | Oakland | 0.262 |
| St. Louis | 0.495 | Chicago (AL) | 0.270 |
| Kansas City | 0.456 | Miami | 0.308 |

Oakland at 0.262 is a useful sanity check on the measure. The A's are known for
young rosters, and this correctly reports that most of those young players came
from somewhere else. The measure distinguishes a young roster from a homegrown
one, which is the distinction it exists to make.

## The cheap check that had to run first

Two things could have killed the question before any model was fitted, so both
were measured before anything was built on top.

### Is dependence just "bad team", or just "small market"?

If homegrown dependence were largely collinear with losing or with a small
market, the headline question would partly collapse into a payroll question. It
is not.

| | pooled n=600 | between-org n=30 | within-org |
| --- | --- | --- | --- |
| share vs. win% (same season) | r=0.071 | r=0.115, p=0.55 | r=0.056 |
| share in S vs. win% in S−1 | r=0.148 | r=0.137, p=0.47 | r=0.154 |
| share vs. home attendance | r=0.176 | r=0.364, p=0.048 | r=0.073 |
| win% vs. attendance, for scale | r=0.355 | r=0.663, p=0.0001 | r=0.240 |

The pooled p-values are anti-conservative — rows repeat down both the org and
the season axis — which is why the other two columns sit beside them rather than
behind them.

Two things stand out. **Every sign runs the opposite way to the naive prior.**
The story that low-payroll clubs are homegrown by necessity predicts a negative
correlation with winning and with market size; both are positive. Clubs that WON
last season carry MORE homegrown playing time now, not less. And **the magnitude
is small either way** — for scale, winning and attendance correlate at 0.663
between organizations, which is what a real relationship in this panel looks
like.

### Does the fixed-effects design have any power?

The plan puts homegrown share into a player-level duration model **with
organization fixed effects**, which identifies the coefficient from WITHIN-org
variation over time alone. If an organization's dependence barely moved across
twenty seasons there would be nothing to identify from, and the resulting null
would mean "no power", not "no effect".

```
between-org SD  0.0685
within-org SD   0.0998
share of variance that is WITHIN org:  68.0%
```

Most of the variation is an organization's own movement over time. On the
organization-seasons the model actually fits, within-org SD is 0.0860 against
between-org 0.0852 — still half. The design has something to work with, which is
what makes the result below readable in either direction.

### The free pilot would not have substituted

Before the full pull existed the cheap stand-in was a count: how many of the
3,061-player debut cohort entered at each organization. It is a production
count, not a playing-time share, and it is limited to players who reached the
majors. Against the funded measure it is **r=0.353 at n=30 (p=0.056)** — related,
but nowhere near a substitute, and the two rank organizations differently. Worth
recording for the next spike that has to decide what to fund: this particular
pilot would have been misleading, and the pull was the right call.

## The model, and the shape it deliberately avoids

**The obvious shape is a trap here.** A 30-point scatter of "organization
homegrown share" against "organization promotion speed" would produce a number
and no information, because the prior spike established that per-org speed
estimates in this data are not reliable: ICC around 1%, 0 of 30 organizations
outside the pooled window, and which organizations look significant flips with
the standard-error method. Correlating one unreliable estimate against another
variable at n=30 is a spurious-finding generator.

So homegrown share goes in as an organization-season covariate in the existing
player-level duration model, over all the duration rows:

```
log(days at level) ~ level + draftTier + era3
                     + homegrownShare[org, S-1] + winPct[org, S-1]
                     + org
```

Transition years are floored at **2011**. The transaction wire does not usefully
exist before 2009 and the two years after it are truncated by the instrument
rather than by behaviour — `docs/team-movement-windows.md`, section A1. The
unfloored fit is reported below as a sensitivity, not hidden. 2,852 durations
survive the floor, out of 3,019.

### The standard-error trap, and which way it actually points

`homegrownShare` varies only at organization-season level while the outcome is
one row per duration. This is the Moulton problem, and clustering by PLAYER —
which every existing script in `.scratch/level-benchmarks/` does, correctly, for
ITS regressors — is the wrong axis for this one.

Measured rather than assumed, on the primary specification:

| Clustering | SE | p |
| --- | --- | --- |
| naive OLS | 0.0291 | 0.00028 |
| by player | 0.0284 | 0.00019 |
| **by organization** | **0.0354** | **0.0056** |
| two-way, organization and player | 0.0354 | 0.0056 |

Player clustering makes the interval slightly NARROWER than naive — the same
direction-is-not-obvious lesson the prior spike learned the hard way — and
organization clustering widens it by 22%. Two-way clustering lands on the
organization-only figure to four decimal places, so the organization axis is the
whole of the correction. **Everything below reports the organization-clustered
figure**, with a t-distribution charged 29 degrees of freedom for 30 clusters.

## The result

```
lagged S-1, transition years >= 2011, 2,852 durations, 30 orgs, 1,291 players

  WITH org fixed effects      +11.2% days per +1 SD of homegrown share
                              (= +9.3% per 10 points of share)
                              org-clustered p = 0.0056
                              R^2 = 0.0871

  WITHOUT org fixed effects    +4.7% per +1 SD,  p = 0.077
                              R^2 = 0.0706

  winPct[org, S-1]            -1.2% per +1 SD,  p = 0.65   (null in every spec)
```

**Organizations that lean harder on their own players move players through the
minors slower.** Within an organization, in the years its major-league roster
carries more of its own players, its prospects wait longer at each level.

In days, at the 2011-on medians: 10 points more homegrown share is about **+32
days at AA** (median 342), **+28 at High-A** (301), **+20 at AAA** (214).

The between-org estimate is less than half the within-org one and only
marginally significant, which is the expected pattern when a between-org
comparison is diluted by everything that differs between organizations for other
reasons. That is why both are reported.

### Lag structure

| Specification | org FE ON | org FE OFF |
| --- | --- | --- |
| lagged S−1 | **+11.2%, p=0.0056** | +4.7%, p=0.077 |
| contemporaneous S | +4.0%, p=0.21 | +1.6%, p=0.50 |
| trailing 3-year mean | +7.0%, p=0.070 | +2.2%, p=0.32 |
| lagged S−1, no year floor | +12.5%, p=0.0018 | +5.1%, p=0.078 |

The lagged specification is the primary one because dependence in season S is
partly the RESULT of past promotion decisions — promote a homegrown player and
his playing time raises that same year's share. Worth noting that the
contemporaneous fit is the WEAKEST of the three, which is the opposite of what
mechanical simultaneity would produce; a share inflated by this year's own
promotions should show up most strongly against this year's durations.

### Robustness

**Full season fixed effects instead of three era buckets.** The sharpest
alternative explanation is a league-wide time pattern in both series leaking
through a coarse control. Homegrown share does drift across the span, and
days-at-level has a time pattern of its own that the prior spike spent a whole
pass showing is mostly instrument. With a full set of transition-year dummies —
so the coefficient is an organization's deviation from its own average against
the LEAGUE's deviation that same year — the effect gets slightly stronger:
**+12.2% per SD, p=0.0036.** Not a time trend.

**Leave one organization out.** 30 clusters is few, and a coefficient resting on
one club would not be a finding. Refitting 30 times, dropping each organization
in turn: the coefficient runs **9.0% (drop Houston) to 13.2% (drop Cleveland)**
and stays p<0.05 in **30 of 30**.

**A within-organization permutation test.** The organization-clustered t charges
df=29, which is the standard small-sample correction, but 30 clusters with a
regressor constant within an organization-season is exactly where that
correction is known to stay optimistic. So the p-value is checked against a
randomization distribution instead of taken on faith. WITHIN each organization,
the season → share mapping is shuffled across that organization's own seasons —
organization means untouched, each organization's marginal distribution
untouched, only the alignment between a season's share and that season's
durations destroyed. `winPct` rides the same permutation. 500 seeded draws:

```
null distribution of the coefficient:  p05 -0.047, median 0.002, p95 +0.048
observed:                              +0.106
two-sided permutation p = 0.0040       (1 of 500 draws at least as extreme)
for comparison, the org-clustered t:   p = 0.0056
```

The clustered t is calibrated here rather than optimistic.

**By level.** Positive at all three, strongest low: High-A **+17.1%**
(p=0.0031), AA **+8.4%** (p=0.066), AAA **+9.8%** (p=0.19). The two upper levels
are individually underpowered at n≈1,000 with 30 organization effects; the
consistent sign is the readable part.

**How much does it buy?** Incremental R² is **0.0043**. Both facts are true and
both belong in the sentence: the effect is real, survives every check, and
explains less than half a percent of the variance in how long a player stays at
a level. That is entirely consistent with the prior spike's finding that
individual-player noise dominates this outcome. A real organizational signal and
a nearly unpredictable outcome are not in conflict.

### What it might mean

One mechanism fits the sign and the lag without straining, and it is offered as
speculation rather than as a finding: **a major-league roster full of an
organization's own homegrown players is a roster with less room on it.** The
next wave waits. That reading makes the effect a blocking story rather than a
philosophy story — not "patient organizations develop patiently" but "an
organization that just graduated a wave has nowhere to put the next one". It
also explains why the effect is strongest at High-A, furthest from the
bottleneck, if what propagates down is a queue.

Nothing here tests that. A test would need roster-mechanics data this spike does
not have — 40-man status, option years, service time — which is the same missing
feature set the prior spike named as the likeliest home of its unexplained
variance.

## Related angle: does dependence predict winning?

Unlike "which organization promotes fast", this one has real power: 600
organization-seasons, and an outcome with no transaction wire anywhere near it,
so none of the instrument artifacts that dominate `docs/team-movement-windows.md`
apply.

```
winPct ~ homegrownShare, with and without season and org fixed effects
SEs two-way clustered on organization and season
```

| Specification | wins per 162, per +1 SD | p (two-way) |
| --- | --- | --- |
| contemporaneous, pooled | +0.85 | 0.24 |
| contemporaneous, season FE | +0.90 | 0.27 |
| contemporaneous, org FE + season FE | +0.80 | 0.35 |
| lagged S−1, org FE + season FE | +0.81 | 0.36 |
| trailing 3-year, org FE + season FE | −0.29 | 0.79 |

**No.** Every point estimate is small, most are positive, none is close to
significance, and the trailing-mean version flips sign. Splitting the share into
its hitting and pitching halves does not rescue it (+0.94 and +0.23 wins,
p=0.33 and 0.75), so a pooled null is not two opposite effects cancelling.

The interval is the useful part. On the within-organization specification the
95% interval is roughly **−0.8 to +2.4 wins per 162 per standard deviation**.
Building a roster out of your own players is not worth a meaningful number of
wins, in either direction, at the resolution twenty seasons of thirty clubs can
measure. That is a stronger statement than "nothing found".

The 30-point between-organization scatter a reader would imagine is r=0.115,
p=0.55 — included so it can be seen next to the panel result rather than
imagined.

## Related angle: does fast promotion pay off?

The whole of `docs/team-movement-windows.md` asks who promotes fast. This asks
whether it works, which is more decision-useful, and the outcome side is already
in the repo: `public/data/war-history/`, FanGraphs season WAR joined on
`xMLBAMID`.

**Asked at player level, not organization level.** "Organization promotion speed
against its graduates' career WAR" is the same n=30 two-unreliable-estimates
shape as before. The player-level version has 769 units and can carry an
organization fixed effect on top, which turns it into "within one organization,
did the players it moved faster turn out better?"

**Speed** is a player's mean duration residual from `log(days) ~ level + tier +
era3 + org`. Residualising is what makes players comparable — a raw mean would
rank a player who passed through AAA (the fastest level) against one who did
not. **Positive residual means SLOWER**, so every coefficient below is signed for
slowness.

**Outcome** is WAR over a fixed six-season window from the debut year, not career
WAR. Career WAR is censored at both ends here — `war-history` starts at 2010, and
a 2023 debut has played three seasons against a 2010 debut's sixteen — so a
career total would mostly measure how long ago a player debuted. Debuts are
restricted to 2010–2018 so every player has all six seasons inside the data. A
season with no WAR row counts as zero, which is the right reading: he produced no
major-league value that year.

```
769 graduates, debut 2010-2018.  Median WAR6 1.60, mean 4.04, bust rate 23.9%

  +1 SD SLOWER  ->  -0.93 WAR6, org-clustered p=0.0011   (no org FE)
  +1 SD SLOWER  ->  -0.97 WAR6, org-clustered p=0.0017   (dev-org FE, within-org)
  +1 SD SLOWER  ->  +3.5 points of bust rate, p=0.027    (no org FE)
  +1 SD SLOWER  ->  +3.8 points of bust rate, p=0.019    (dev-org FE)
```

| Promotion speed | n | median WAR6 | mean WAR6 | bust rate |
| --- | --- | --- | --- | --- |
| fastest third | 256 | 2.30 | 4.66 | 19.9% |
| middle third | 256 | 2.05 | 4.72 | 20.3% |
| slowest third | 257 | 1.20 | 2.74 | **31.5%** |

### The objection that matters

**Speed is not exogenous.** Clubs promote the players who are playing well, and
players who play well in the minors go on to produce in the majors. The prior
spike measured the first half of that directly, at z=−8.7, the strongest single
effect anywhere in this research. So "fast movers turned out better" is, to an
unknown degree, "good players turned out better" restated.

The one test this data can give it is to hold in-level performance constant —
each duration's OPS percentile (hitters) or inverted-ERA percentile (pitchers)
within its own level-season, from `perf-pool.json`, averaged to the player:

```
performance-eligible subsample (760 of 769 players)
  no performance control:    -0.92 WAR6 per +1 SD slower, p=0.0015
  with performance control:  -0.81 WAR6 per +1 SD slower, p=0.0030
  performance itself:        +0.38 WAR6 per +10 percentile points
```

**Most of it survives.** Promotion speed carries information about a player's
future beyond his measured minor-league line — which is unsurprising if
organizations know things about their own players that OPS and ERA do not
capture, and promotion speed is how that knowledge shows up in the data.

The known volume-floor trap runs the harmless way here. The PA/IP floor that
deleted the fastest promotions in the prior spike drops only **9 of 769**
players at this level of aggregation (a player needs just one rankable duration),
and the dropped players are SLOWER than average (mean residual 0.339 against
0.014), not faster. The subsample cannot have manufactured the result.

Entry-organization homegrown share against the graduate's own WAR6 is nothing:
r=−0.043 over 766 players. Being developed by a homegrown-heavy organization
neither helps nor hurts the individual player.

## What this does not address

- **Payroll, the most obvious confound, is unaddressed.** It is not available
  historically anywhere in this repo: `public/data/salaries.json` and
  `public/data/team-contracts/` are current-season-only forward-looking snapshots
  from the Fever/Cot's feed, and `public/data/attendance.json` is 2026-only.
  Historical home attendance stands in as a market-size proxy, and it is a poor
  one — attendance is downstream of winning as well as of market size, which is
  exactly the wrong property for a control. The pre-check above is the reason
  this is a stated gap rather than a fatal one: dependence is not strongly
  related to either winning or attendance to begin with, so there is less for a
  payroll control to take away than there would be if the naive prior had held.
- **Nothing here is causal.** Lagging the covariate removes the most mechanical
  simultaneity and nothing more.
- **Survivorship.** Every player in the duration data reached the majors. An
  organization that promotes aggressively and releases aggressively never shows
  its failures. `docs/team-movement-windows.md`'s cohort-selection section is the
  standing statement of that limit, and nothing here changes it. Pulling the full
  MLB population for the dependence measure addresses this on the DEPENDENCE side
  — that measure is not survivorship-limited at all — but the duration side still
  is.
- **The 2020 season** is kept. Win percentage over 60 games is still a ratio, and
  every playing-time share is a ratio too. Nothing here is counted in absolute
  games.

## What would move this next

- **Roster mechanics.** 40-man status, option years remaining, service time. It
  is the missing feature set behind both this spike's speculated blocking
  mechanism and the prior spike's unexplained variance, and it is the same pull
  either way.
- **A partial-season performance measure.** The performance control above needs a
  full enough line to rank, which is a volume floor, which is time at the level.
  A percentile computed from the exact PA/IP a player accumulated DURING the
  duration, ranked against others' partial lines through the same point, would
  remove the last known selection problem in the "does speed pay off" result.
  `docs/team-movement-windows.md` flags the same rebuild.
- **Historical payroll from outside this repo.** The one control that would
  change how much weight the headline can carry.

## Where the work lives

Everything is in `.scratch/level-benchmarks/`, alongside the prior spike's
scripts, and every network step is behind a read-through cache so a rerun costs
nothing.

- **`homegrown-lib.mjs`** — the homegrown rule and the sweep behind it, shared by
  the cohort resolver and the full-population pull so the two cannot drift. The
  season-scoped org map, the six-level both-groups minor-league sweep,
  `firstProOrg()`, and `identity.js`'s `draftInfo()` rule ported verbatim.
- **`homegrown-stats.mjs`** — every numeric primitive, self-tested against
  published critical values before use: chi-square, F and Student-t tails,
  Pearson and Spearman, OLS by normal equations, one-way and two-way
  (Cameron-Gelbach-Miller) cluster-robust covariance, joint Wald F, and the
  within/between variance decomposition. `node homegrown-stats.mjs` runs the
  self-test alone and exits non-zero on failure. **It caught two bad references
  of mine on its first run**, which is the argument for asserting rather than
  printing — `org-variance-components.mjs` PRINTS the same chi-square test
  against a stated "~0.0400", produces 0.03856, and nobody saw it, because
  printing is not asserting. That implementation is right; the published df=29
  critical is 42.557, not 43.773.
- **`homegrown-firstorg.mjs`** — the cohort resolver and the draft cross-check.
  Output `homegrown-cohort.json`.
- **`homegrown-context.mjs`** — the win-percentage and attendance panel. Output
  `context-panel.json`. Note the standings trap it works around: for a COMPLETED
  season the `date` parameter must be OMITTED, or the endpoint returns empty
  records.
- **`homegrown-pull.mjs`** — the dependence panel. `--scope` stops after the
  1,200 stat calls and prints the distinct-player count, so the expensive sweep
  can be scoped before it is funded. Output `homegrown-panel.json`.
- **`homegrown-precheck.mjs`** — the collinearity check, the within/between power
  check, and the free pilot against the funded measure. Output
  `homegrown-precheck.json`.
- **`homegrown-duration-model.mjs`** — the headline model, all twelve
  lag × floor × fixed-effect specifications, plus incremental R²,
  leave-one-organization-out, the seeded permutation test, the season-fixed-effect
  refit, and the per-level split. Output `homegrown-duration-model.json`.
- **`homegrown-winning.mjs`** — dependence against winning. Output
  `homegrown-winning.json`.
- **`homegrown-outcomes.mjs`** — promotion speed against six-season WAR and bust
  rate, with the in-level performance control. Output `homegrown-outcomes.json`.

Caches committed alongside: `orgmap-ext.json`, `orgmap-wide.json`,
`milb-cohort-cache.json`, `milb-mlb-cache.json`, `draft-cache.json`,
`teamstats-cache.json`, `standings-cache.json`, `attendance-cache.json`. They
depend on `raw.json`, `dates.json` and `findings.json` already in that directory;
`txn-cache.json` stays gitignored and rebuildable, as
`docs/level-tenure-benchmark.md` describes.
