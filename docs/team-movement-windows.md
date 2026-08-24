# Team movement windows — research spike

Follow-up to `docs/level-tenure-benchmark.md`, which flagged team-level
comparisons as measured but unshipped. This spike asks the concrete
question: **can we turn "days at level, by org" into a per-team estimated
movement range?** Short answer: not yet. A second pass with 3.5x the data
confirmed that rather than overturning it, and a third pass — a
confound-controlled regression instead of raw per-org quantiles — confirmed
it again, more rigorously (see "The regression check" below).

## Method

Two runs, same technique:

1. **v1** — the level-tenure benchmark's 881-player, 2019–2023-debut cohort.
2. **Widened** — 3,061 players, 2005–2023 debuts. 2005 is the floor because
   `docs/api/static-data.md` documents statsapi's own affiliate data as
   unreliable before then; the sportId level structure (AAA/AA/High-A/A)
   and player `yearByYear` stats are both stable well before that, so this
   is an org-data floor, not a stats floor (see "How far back the raw data
   actually goes" below).

For each player-level duration (`dates.json`'s `allDurations`, disputed
ordering cases excluded), resolve the organization: the player's own
minor-league team for that stint, joined against a real **season-by-season**
team→org map (`/api/v1/teams?sportId&season`, 52 calls across sportIds
11–14) — not the current affiliate file, which would mis-attribute any
player who moved through a relocated or realigned affiliate. For every
org/level cell with n≥8, compute p25/median/p75 (not just a median — a
single point estimate can't become a "range").

## Did the data change? Yes — both the pooled numbers and the per-org ones

| | v1 (881, 2019–2023) | Widened (3,061, 2005–2023) |
| --- | --- | --- |
| AAA PA before promotion | 327 [180–529] | 380 [205–557] |
| AAA IP before promotion | 54.0 [26.3–88.8] | 60.3 [28.3–112.3] |
| AAA days-at-level (median) | n=389, 250d | n=967, 171d |
| AA days-at-level (median) | n=437, 349d | n=1,277, 331d |
| High-A days-at-level (median) | n=351, 308d | n=1,034, 286d |
| Orgs meeting n≥8 (High-A / AA / AAA) | 25 / 30 / 27 of 30 | 30 / 30 / 30 of 30 |

PA/IP-at-level went **up** across the board when the older cohort is
folded in (+15–20% roughly) — the recent-only cohort needs meaningfully
less volume than the 2005–2023 average, plausibly the 2021 contraction's
roster crunch pushing faster promotion in the current era. Calendar-day
medians moved the other way, especially at AAA (250d → 171d) — treat that
shift with more suspicion than the PA/IP one: only 78% of transitions
resolved a date this run (transaction-wire coverage thins for older
seasons), so the drop may partly be a measurement artifact rather than a
real behavior change. **This "2021 contraction" explanation was never
tested directly against calendar-day data and, once it was (see "The
omnibus check" below), didn't hold up** — the within-cohort time trend is
a hump peaking in 2016–2020, not a step change at the contraction. That
doesn't resolve the PA/IP-volume question above, which is a different
metric and a different (v1-vs-widened cohort) comparison — flagging so the
two don't get conflated.

Per-org rankings also reshuffled with more data. The v1 fastest AAA org
(Reds, 82d median, n=15) is no longer the fastest; the widened run's
fastest AAA orgs are the Blue Jays (53d, n=21) and Nationals (55d, n=24).
That instability — a team's *rank*, not just its precision, changing when
n roughly triples — is itself evidence the v1 per-org medians weren't a
trustworthy ranking, exactly as flagged at the time.

## The finding that matters: still 0 of 30

Org medians still look like real signal — a wide spread between fastest
and slowest orgs at every level, both runs. But the question a "movement
window" feature has to answer isn't "which org has the lower median" —
it's "does this org's range actually distinguish it from the pack." It
doesn't, in either run:

| | v1 | Widened |
| --- | --- | --- |
| n per org/level cell | 8–27 | 20–61 |
| Orgs whose p25–p75 window sits fully outside the pooled window | 0 of 25–30 | 0 of 30 |

Tripling the sample and getting full 30-of-30 coverage at every level
didn't rescue the per-team-range idea — every org's own spread is still
wide enough to swallow the pooled spread. Concretely, in the widened run:
Toronto's AAA window is 35–348 days on n=21 — a 10x range for one team,
still wider than the gap between the fastest and slowest org medians. The
variance *within* one org's cohort is larger than the variance *between*
orgs, at both sample sizes.

Practically: if this shipped as "the Blue Jays typically move AAA players
in 53 days," it would read as precise. It isn't — the honest statement is
"the Blue Jays' AAA players have moved anywhere from 35 to 348 days, and
that range overlaps every other team's range too." A wider cohort was the
first, cheapest thing to try before concluding org-level windows are
unbuildable rather than just unbuilt — it's now been tried, and the
conclusion held.

## The regression check: same answer, more rigorous

The obvious objection to the quantile-overlap check above: a per-org median
conflates real organizational tendency with pedigree mix (an org that
happens to have more prep-pick position players in this cohort will look
"slow" for reasons that have nothing to do with how it manages promotions).
A regression that holds level and draft pedigree constant and estimates an
org fixed effect is the right tool to isolate the two — so that's the
third run, not just a bigger version of the first two.

**Model**: `log(days-at-level) ~ level + draftTier + org`, all three factors
sum-to-zero (effect) coded, fit by ordinary least squares (normal equations,
solved directly — no external stats library). Effect coding makes each org's
coefficient its estimated deviation from the *grand mean* days-at-level,
holding level and draft tier fixed, with its own standard error from the
fitted coefficient covariance matrix — which is the direct test for "does
this org actually differ," rather than the ad hoc "do the quantile windows
touch" check used above. Same cohort as the widened run: 3,278 durations
(A-level durations are absent from the source data — see below — so this
covers High-A/AA/AAA only), all 30 orgs clear a n≥20-per-org floor.

```
fit: n=3278, p=36 (intercept + 2 level + 4 tier + 29 org), R^2=0.044
orgs with a 95% CI excluding 0 (uncorrected):        6 of 30
orgs with a 95% CI excluding 0 (Bonferroni-corrected): 1 of 30
```

**Numbers below corrected 2026-08-24** — an adversarial pass found a real bug
in how this run resolved org (see "Adversarial review" at the end of this
doc): R² is unaffected (0.043), but the "1 of 30" Bonferroni survivor
(Nationals) does not survive once the bug is fixed. Read the two paragraphs
below as they stood before that fix; the corrected picture is in the review
section.

Two results, and they agree:

1. **R² = 0.044.** Level, draft tier, and org together explain 4.4% of the
   variance in log-days-at-level. Even the "right" model, with the
   confounds explicitly controlled for, barely explains the outcome at
   all — the dominant source of variation in how long a player spends at
   a level is neither org nor pedigree, it's individual-player noise the
   model has no feature for (performance, injury, the 40-man/option
   clock, roster need at the level above).
2. **1 of 30 orgs survive multiple-comparison correction.** Testing 30
   organizations at once and calling a plain 95% CI "significant" is
   exactly the setup where ~1–2 false positives are expected by chance
   alone — which is what the uncorrected pass shows (6 of 30, all with
   CIs that still cross zero by a wide margin once corrected). Applying a
   Bonferroni correction (α = 0.05/30) leaves exactly one: the
   **Washington Nationals**, −32.7% vs. the grand mean (CI narrows to
   roughly [−45%, −16%] even after correction). One survivor out of 30
   simultaneous tests is itself within the range chance alone would
   produce — this is not strong evidence for a single standout org, it is
   confirmation that the pack has none.

The quantile-overlap check and the regression fixed effect are different
methods, built to fail in different ways, and they land on the same
conclusion: **org identity is not a usable signal for days-at-level, even
after controlling for the pedigree-mix confound.** That's a stronger
result than "we didn't find it" — it's "a more sensitive test didn't find
it either." Script: `.scratch/level-benchmarks/org-regression.mjs`. Output:
`org-regression.json`. Reused `team-windows.mjs`'s historical org sweep,
`dates.mjs`'s draft-tier bucketing, and the same disputed-player exclusion
list.

Level and tier came along for the ride and are directionally sane, though
they aren't the question this asks: AAA is −25.6% vs. the grand mean
(consistent with the raw AAA-vs-AA-vs-High-A medians above — the highest
level moves fastest), and Round 11+/undrafted players move faster
(−7.7%/−2.1%) than mid-round picks (+2.8% to +4.2%) — plausible if a lower
pedigree tier gets less rope before either a promotion or a release forces
the next transition.

## What would change this now

The regression above was the candidate named here as of the last pass —
tried, and it returned the same null, more rigorously. What's left:

- **Accept a coarser output.** A three-bucket fast/typical/slow label
  (org median only, window collapsed to the global one) would be honest
  about what the data supports, at the cost of being a much smaller
  feature than "estimated movement range." Given R²=0.044, even a
  three-bucket label should be treated skeptically — the org term barely
  moves the outcome at all once level and pedigree are accounted for.
- **A richer feature set**, if this is worth another pass: the current
  model's low R² says the missing variance is elsewhere. Performance
  in-level (OPS/ERA percentile within level-season) or roster mechanics
  (option years remaining, 40-man status) are plausible candidates, but
  each is a materially bigger pull than what this spike has built so far,
  and drifts from "does org predict movement" toward "what predicts
  movement" — a different, larger question.
- **Ship the pedigree-tier split on its own**, independent of org. It was
  measured but never shipped even for the v1 level-only numbers (see
  `docs/level-tenure-benchmark.md`) and the effect above (Round 11+ movers
  faster than mid-round picks) is a real, usable signal completely apart
  from the org question this spike was chasing.

## How far back the raw data actually goes

Checked directly against statsapi rather than assumed:

- **Level structure** (sportIds 11/12/13/14 = AAA/AA/High-A/A) has been
  stable since at least 2000 — only the *label* on sportId 13 changed at
  the 2021 reorg ("A(Adv)" → "High-A"), same id, same tier concept.
- **Player `yearByYear` stats** are populated at least into the early
  2000s (spot-checked against a 2001 draftee).
- **`parentOrgId` itself is essentially fully populated back to 1990** —
  0–1% missing per season, checked at 1990/1995/1998/2000/2002/2003/2004.
  So the documented "unreliable before 2005" risk is not missing cells; it
  is **silently wrong ones** — an id reused across a relocation, like the
  Colorado Springs Sky Sox/San Antonio Missions case `scripts/milb-history-
  seed.json` documents. No script can find that kind of error; it takes a
  human cross-check against an independent source (that seed file's own
  method: statsapi's season-scoped endpoint vs. Wikipedia's franchise
  history, per club).
- **Checked specifically against this cohort**: `org-gaps.mjs` cross-checks
  every (team, season) pair the 2005–2023 cohort actually touches against
  the org sweep. Zero gaps — 3,278 durations checked, 0 missing an org.
  The 2005 floor is clean for *this* cohort's own scope; the accuracy risk
  above only bites if the cohort is pushed earlier.

**If someone wants to hand-verify affiliate history** (which would let a
future run push past 2005, or firm up spots the current sweep already
trusts but hasn't been cross-checked), `org-gaps.mjs` also ranks the 176
distinct minor-league team ids this cohort touches by how many cohort
players pass through them — research time is best spent on the top of
that list, not spread evenly. Top 5: Oklahoma City RedHawks (n=410),
Buffalo Bisons (n=390), Round Rock Express (n=386), Syracuse Chiefs
(n=377), Tacoma Rainiers (n=374). Full ranked list in
`.scratch/level-benchmarks/org-gaps.json`. Add findings to
`scripts/milb-history-seed.json` in its existing format — that file
already feeds the shipped Minors tab "Affiliation history" strip
(`src/api/milbHistory.js`), so verified entries help there immediately;
wiring this research pipeline (`team-windows.mjs`, `org-and-timing.mjs`)
to prefer the seed over the raw sweep is unbuilt, not yet needed since
today's window has zero measured gaps.

## Adversarial review

A follow-up pass tried to break the "org identity isn't a usable signal"
conclusion rather than confirm it — read `org-regression.mjs` line by line
for bugs, tried other response transforms, tried a less conservative
multiple-comparison correction, checked the independence assumption, and
named the confounds the model leaves out. One real bug turned up. It doesn't
overturn the conclusion — if anything it makes the null cleaner — but it
does retract the one positive claim the regression pass made.

### 1. A real bug: every duration for a multi-transition player got the same season

`orgForDuration` needs a season to look up which team (and therefore which
org) a player belonged to. The original code got that season from:

```js
const seasonGuess = Number((dates.allPromotionDates.find((pp) => pp.playerId === d.playerId)?.date || '2020').slice(0, 4))
```

`.find()` filters only by `playerId` — not by level, not by which duration
is being resolved. It always returns the player's FIRST promotion-date
entry, regardless of which of his (often several) durations is being
processed. 1,818 of 2,402 players in `dates.json` have more than one
promotion-date entry, and 1,140 of 1,530 have more than one duration — so
most rows in the regression got a season guess belonging to a *different*
level transition than the one being priced. For a player who spent, say,
2013 at AA and 2016 at AAA, the AAA row's org lookup used the 2013 season
guess — close enough to land on the same org only by luck.

The fix: `dates.mjs` already computes the exact date each duration ended
(the same date `days` is computed from) — it just wasn't being carried
through. One-line addition, stamping each `allDurations` entry with
`season: Number(t.date.slice(0, 4))`, then using that directly instead of
guessing. Rerunning with the fix:

| | Buggy (as published) | Fixed |
| --- | --- | --- |
| R² | 0.044 | 0.043 |
| Orgs significant, uncorrected (95% CI) | 6 of 30 | 4 of 30 |
| Orgs surviving Bonferroni | **1 of 30** (Nationals) | **0 of 30** |

R² barely moves — misattributing org is noise added to a categorical label,
and noise in a group label attenuates (biases toward zero) that group's
estimated effect, so a bug like this should make org look *less* different
from the pack than the truth, not more. That's the direction it moved: the
one org that had cleared the strictest bar no longer does. The bug made the
paper's single positive claim, not its null conclusion, and fixing it
removes that claim rather than adding one back. Everything below uses the
fixed org attribution.

The rest of the regression code — the effect-coding algebra (reference
category recovered as `-sum(others)`, its variance from the full covariance
submatrix, not just the diagonal), the Gauss-Jordan inversion, and the
`ORG_MIN_N`/`keptRows` filter — checked out. All 30 orgs cleared the n≥20
floor both before and after the fix (`droppedOrgsForLowN: 0`), so that
filter isn't quietly picking which orgs get evaluated. Reimplementing the
whole pipeline independently (a second script, own season-resolution logic,
same OLS solver) landed on R²=0.043 — matching the fixed run to the
percent, which is the cross-check that the OLS/effect-coding math itself is
right; the bug was in data assembly, not in the regression.

### 2. Response transform: doesn't matter

`log(days)` was the modeled response. Refit with raw days (`levels`) and
`sqrt(days)`:

| Transform | R² | Uncorrected significant | Bonferroni survivors |
| --- | --- | --- | --- |
| `log(days)` | 0.043 | 4 of 30 | 0 of 30 |
| raw days | 0.042 | 3 of 30 | 0 of 30 |
| `sqrt(days)` | 0.045 | 5 of 30 | 0 of 30 |

R² sits in a tight 0.042–0.045 band and zero orgs clear Bonferroni under any
of the three. The conclusion isn't an artifact of the log transform.
(`org-regression-transform.mjs`, `org-regression-transform-{log,levels,sqrt}.json`.)

### 3. Bonferroni vs. Benjamini-Hochberg: this is where it gets closer than "0 of 30" suggests

Bonferroni (α=0.05/30) controls the chance of ANY false positive across 30
tests — strict. Benjamini-Hochberg controls the expected FALSE DISCOVERY
RATE instead — more forgiving by design. Re-ranking the fixed run's 30
p-values and applying BH at q=0.05:

**2 of 30 orgs survive BH: Tampa Bay Rays (+39.1%, p=0.0018) and Washington
Nationals (−30.9%, p=0.0028).**

That's a real difference the correction choice makes — not "0 of 30" but
not "6 of 30" either. It's still weak evidence on its own: at a 5% false
discovery rate among 30 simultaneous tests, roughly 1–2 survivors are the
expected floor even if org has zero true effect, so 2 survivors is
consistent with either "the Rays and Nationals are real outliers" or "this
is exactly what chance alone produces at this q." Section 4 below is why
this evidence should be read as still on the weak side.

### 4. Non-independence: SEs are probably still too small, and that cuts against the two BH survivors

OLS assumes every row is an independent observation. It isn't: a player who
passes through High-A, AA, and AAA contributes up to three rows to his
org's "n," not three independent players. Checked directly: 3,278 rows
resolve to 1,707 distinct (org, player) pairs — a 1.92 rows-per-player
ratio overall. The two BH survivors are typical, not outliers on this axis:
Tampa Bay's n=134 rows come from 60 distinct players (ratio 2.23, the
*highest* of any org); Washington's n=96 come from 53 (ratio 1.81).
(`clustering-check.mjs`.)

Classical measurement-error and clustering theory both point the same way
here: treating within-player rows as independent understates the true
variance of an org's coefficient, so the naive SEs used above are
anti-conservative (too narrow) — confirmed direction, not assumed. A
cluster-robust or player-random-effects refit was not run (a materially
bigger lift than the checks above), but the direction of the correction it
would apply is unambiguous: CIs widen, p-values grow. Applied to section 3,
that cuts against, not for, the two BH survivors — Tampa Bay's effective n
is closer to 60 than 134. This doesn't resolve whether the Rays/Nationals
effect is real; it says the BH result above is more likely to shrink than
grow under a correctly-clustered SE, which is the direction that favors the
null this spike has been building toward.

A smaller, separate residual: 59 of 3,278 durations (1.8%) have more than
one team row at the same level in the same season — a plausible mid-season
trade the nearest-season match doesn't disambiguate by date-within-season.
Too small to move R² or the significance counts; not fixed.

### 5. Confounds not in the model — plausible, not measured here

The model controls for level and draft-round tier only. Two omissions could
plausibly matter and neither is quantified in this spike:

- **In-level performance.** An org whose players simply hit or pitch better
  in this cohort would look "fast" for reasons that have nothing to do with
  how it manages promotion decisions — the confound this regression exists
  to rule out for draft pedigree, unaddressed for performance.
- **Era.** The fixed cohort's resolved durations span transition-year 2009
  through 2023 (2020 thin, no MiLB season) — 15 seasons that include the
  2021 contraction (roughly 160 full-season affiliates down to 120), which
  could shift baseline durations for reasons unrelated to any org's own
  practice. Whether orgs are evenly represented across that span, or
  whether some orgs' cohort rows cluster in different eras than others',
  isn't checked. If they don't, part of an org's fitted effect could be
  absorbing an era shift rather than an org tendency.

Position group (hitters vs. pitchers) was considered and set aside as lower
priority — the level effect above is large and directionally consistent
with the raw medians in `docs/level-tenure-benchmark.md`, which already
splits by hitter/pitcher and finds the same broad pattern, so it's less
likely to be silently distorting the org term specifically.

### 6. Cohort selection: the debut requirement is a real, unaddressed gap

This entire spike — the widened one and the regression — is built on
players who **reached the majors**. An org that promotes aggressively but
also releases failed prospects at a high rate wouldn't show up as "fast" in
this cohort at all: the failures never debut, so they never enter the data.
Org speed and org failure rate are entangled here in a way this spike
cannot separate — doing so would need a cohort of drafted-but-never-debuted
players with their own level/date history, a materially different pull
than anything built so far. Flagged, not measured: no claim in this
document should be read as "how fast an org promotes," only "how fast an
org's cohort of players who *made it* moved."

### What this changes

- **The R²=0.044 / "barely any of the variance is explained" reading holds
  up.** Every check above left it in a 0.042–0.045 band. Individual-player
  noise, not org or pedigree, remains the dominant source of variation.
- **The single Bonferroni survivor (Nationals) was a bug, not a finding.**
  Retracted above.
- **The honest post-review headline is "2 of 30 orgs (Rays, Nationals)
  survive a less conservative correction, and even that is likely
  optimistic once player-level clustering is accounted for" — not "0 of
  30" and not "1 of 30."** That's a real softening of the null, but not a
  reversal of it: the practical conclusion for a shipped feature is
  unchanged — org identity is not a reliable basis for a per-team movement
  window, with at most two organizations as arguable, unconfirmed
  exceptions worth someone's judgment call, not a shippable range.
- **Confound completeness (performance, era) and cohort selection
  (debut-only survivorship) remain open, unquantified risks** that could
  shift the picture in either direction and were out of scope for this
  pass.

## The omnibus check: real signal, still not attributable

The adversarial review above tests 30 individual org coefficients and asks
"which one survives correction" — a different, stricter question than "does
org matter at all." A single joint test answers the second question
directly, and it's the one gap the adversarial review named but didn't
close (clustering, era). This pass closes it with two independent methods
and picks up the era check along the way.

**Method 1 — cluster-robust omnibus Wald test.** Same
level+tier+org model, refit with CR1 standard errors clustered by player
(the fix the adversarial review's section 4 named but didn't run), then a
joint Wald F-test on all 29 org coefficients at once instead of one CI at a
time:

```
F(29, 1494) = 1.824, p = 0.0048
```

**Method 2 — player-collapsed variance-component ANOVA**, which sidesteps
clustering by construction rather than modeling around it: fit
`log(days) ~ level + tier + era` with NO org term, collapse each player's
possibly-multiple durations at one org down to a single averaged residual
(3,278 rows → 1,707 independent org×player pairs), then run classical
unbalanced one-way ANOVA of those residuals by org:

```
F(29, 1677) = 1.685, p = 0.0128
tau^2 (between-org variance)  = 0.0146
sigma^2 (within-org variance) = 1.2092
ICC = tau^2/(tau^2+sigma^2)   = 1.2%
```

Both methods reject the null that org has zero effect — independently, by
different means, at different p-values but the same conclusion.
**Transform check** (matching the adversarial review's practice of
re-running under raw and `sqrt` days, applied to this new omnibus test):
the cluster-robust omnibus F holds under `log(days)` (p=0.0048) and
`sqrt(days)` (p=0.027) but is borderline under raw `days` (p=0.069, not
significant at the conventional 0.05). Not a clean sweep like the earlier
per-org-effect transform check — `org-omnibus-transform-check.mjs`. Read
it as: robust under the two transforms actually appropriate for
right-skewed duration data (raw days has a long right tail that violates
OLS's homoscedasticity assumption more severely than either), not as
iron-clad under every possible specification.

**Superseded 2026-08-24 — read this section with "The 2016–2020 hump is an
instrument artifact" below attached.** Both omnibus tests here were fitted
on rows that three measurement artifacts contaminate (11.5% of the set),
with era as a control on top. On corrected rows the omnibus is no longer
significant at 0.05 (p=0.058–0.095) and the ICC below collapses from 1.2%
to 0.02–0.39%. The arithmetic in this section is reproduced exactly there;
what changes is that the aggregate claim it supports does not hold once the
artifact rows come out. The per-org conclusion is unaffected, and Tampa Bay
gets stronger.

With that caveat attached, this sharpens the doc's headline in a real way:
**org identity is not "no signal," it's small, real, aggregate signal that
can't be pinned to a specific franchise.** The ICC is the number that reconciles this with
everything above it: org explains about **1.2%** of the residual
(post-level/tier/era) variance in log-days-at-level. Real enough for an
omnibus test with 1,707+ units to detect; nowhere near large enough for a
per-org point estimate to be trustworthy at n=45-160 per org, which is
exactly the "0-1 of 30 survive individual correction" result above. Both
things are true at once — a large sample can detect that a small effect
exists in aggregate while remaining unable to say which specific group
carries it.

An empirical-Bayes shrinkage estimate — pulling each org's raw effect
toward the grand mean in proportion to how much of its variance is
sampling noise (`shrinkage weight = tau^2/(tau^2+sigma^2/n_org)`, order
~0.34–0.47 here given the tiny tau^2) — is the honest single-number
estimate per org, if one were ever needed for something lower-stakes than
a shipped range: Baltimore and Washington shrink to roughly -17% to -12%,
Milwaukee and Tampa Bay to roughly +12%, everyone else compresses toward
single digits. Full table in `org-variance-components.json`.

**Era is a real, uneven confound — but doesn't explain away the org
signal.** Org rows are not evenly spread across the 2005–2023 span: a
chi-square test of org × era independence rejects cleanly (χ²(29)=85.9,
p<0.0001) — the Dodgers' rows are 70% Era2 (2016+) against a 56% pooled
rate, the Rangers' are 61% Era1 against a 44% pooled rate, and three more
orgs skew similarly. Adding era to the model shifts individual org
coefficients by a mean of 2.5 points (up to 5.9 for the Dodgers) and
nearly doubles the model's R² (0.043 → 0.064) — era predicts days-at-level
better than org or tier do. But the org signal survives era-adjustment:
cluster-robust significant-uncorrected count is 3 of 30 with era controlled
for, same as without. Era was a real, previously-unmeasured confound; it
just isn't the org signal in disguise.

**Correction: it isn't the 2021 contraction, and it isn't monotonic.** The
binary Era1/Era2 split above doesn't distinguish "days-at-level trending
down over time" from "a sharp, dated shift in 2021" — two different
mechanisms this spike had speculated about elsewhere without testing (see
below). A three-bucket split (`org-era-granularity.mjs`: ≤2015 / 2016–2020
/ 2021–2023, isolating the contraction as its own bucket) shows neither:
raw median days-at-level runs **257d → 324d → 265d** across the three
buckets (n=1,448/1,164/666) — a hump, peaking in 2016–2020, not a
monotonic trend and not a step change at the 2021 contraction. The
model-adjusted era effect (holding level/tier/org fixed) shows the same
shape: −21%, +20%, +5.5% vs. the grand mean. The org × era3 signal is even
stronger at this resolution (χ²(58)=159.1, p<0.0001) and the org omnibus
Wald test still holds with era3 controlled for (F(29,1492)=1.758,
p=0.0078) — consistent with the two-bucket result, org isn't absorbing
this. **What actually happened in 2016–2020 to slow promotions down, and
why 2021–2023 partially but not fully reverted, is an open question this
spike doesn't answer** — answered 2026-08-24, see "The 2016–2020 hump is an
instrument artifact" below: mostly nothing happened. The hump is the
transaction wire's own coverage, the lost 2020 season, and the 900-day cap,
and a wire-free measure of the same thing is flat (p=0.31) — worth flagging for anyone who picks up the
"2021 contraction" hypothesis elsewhere in this research (see the PA/IP
discussion above and in `docs/level-tenure-benchmark.md`): the calendar-day
data doesn't actually support a simple contraction-sped-things-up story.

**What this doesn't change:** no per-team movement-window feature should
ship from this. The practical bar was always "can a reader be told which
specific org is fast or slow," and that bar is further from being cleared
than ever — 1 of 30 orgs (Tampa Bay) survives BH correction even under the
more forgiving, clustering-robust test. What it does change is which
sentence is accurate to write in a hypothetical future research note: not
"no evidence org matters," but "org matters a little, in aggregate, and
current sample sizes can't say which org." Script:
`.scratch/level-benchmarks/org-variance-components.mjs`. Output:
`org-variance-components.json`. Self-tests its own numerical primitives
(regularized incomplete gamma/beta for the chi-square and F p-values)
against known reference values before running on real data.

## The in-level performance confound: real, strong — and can't be cleanly tested here

The adversarial review's section 5 named this confound but didn't measure
it: "an org whose players simply hit or pitch better in this cohort would
look 'fast' for reasons that have nothing to do with how it manages
promotions." This pass measures it — and finds a real methodological trap
that limits what the result can say.

**Building the covariate required a real new pull, as flagged.** `raw.json`
only carries the 3,061-player DEBUT cohort's own stat lines. Percentile-
ranking a cohort player against *other cohort players* would rank him
against a survivorship-biased pool — everyone in it reached the majors.
Checked directly against statsapi: the obvious endpoint
(`/api/v1/stats?stats=season&group=...`) silently applies a qualification
floor unless `playerPool=all` is passed — AAA 2015 hitting returns 239
"qualified" rows by default vs. **1,562** with `playerPool=all` (min PA 0).
`perf-pull.mjs` reuses `fetchLevelSeasonStats` from `src/api/statsLevels.js`
(already used by `gen-minors-leaders.mjs`, already passes `playerPool=all`)
across the 45 (level, season) pairs the fixed cohort's durations actually
touch — 90 calls, 46,021 hitter-seasons + 43,027 pitcher-seasons. Each
duration's percentile is OPS-rank (hitters) or ERA-rank, inverted so lower
ERA scores higher (pitchers) within its own (level, season)'s full
population — not the cohort's.

**The result, on its own terms:** refit `log(days) ~ level + tier + org +
perfPctile` against the same row subset as a performance-free baseline
(apples to apples):

```
baseline    (level+tier+org):            n=3026  R^2=0.0559  orgs sig (uncorrected): 3 of 30
augmented   (+ perfPctile):              n=3026  R^2=0.0767  orgs sig (uncorrected): 3 of 30
perfPctile coefficient: -7.9% days per +10 percentile points (z=-8.21)
```

Performance is a strong, obvious-in-retrospect predictor — better hitters
and pitchers move faster, and the coefficient's z=-8.21 is the single
strongest effect measured anywhere in this spike, dwarfing every org
coefficient. It picks up more R² on its own (+0.021) than the entire
29-column org block contributes. But it doesn't explain away org: the same
3 orgs (Atlanta, Cleveland, Tampa Bay) are significant before and after,
and their effects get slightly LARGER with performance controlled for
(mean |shift| 1.8 points, one sign flip out of 30, no org that had been
significant loses significance). That's the opposite of what "performance
is a hidden confound explaining org" would predict.

**But that clean-looking result rests on a subsample that isn't neutral,
and the Washington Nationals are the case that shows it.** Computing a
percentile needs enough volume to mean something — this run requires
PA≥20 (hitters) / IP≥10 (pitchers) at the level. That floor drops 252 of
3,278 durations (7.7%) — and those 252 are not a random slice: their
median duration is **26 days**, against **288 days** for the kept rows.
Requiring enough PA/IP to rank a player is, mechanically, requiring enough
TIME at the level to accumulate it — so the floor disproportionately
excludes exactly the fastest promotions, the ones a "movement window"
feature would care about most. Washington shows the effect directly: −30.9%
and BH-significant in the full, fixed cohort (`org-regression.json`); in
this performance-eligible subsample (n=85, most of Washington's fastest
movers dropped for insufficient volume) it's −11.6% and not significant.
Whether that's "performance genuinely explains Washington's speed" or "the
floor removed the very stints that made Washington look fast, before
performance ever entered the model" can't be told apart from this run —
they're confounded with each other by construction. **Read the 3-orgs-
survive result above as real for Atlanta/Cleveland/Tampa Bay specifically
(their significant rows have enough volume to clear the floor either way),
and read Washington's disappearance from this subsample as inconclusive,
not as evidence performance explains it.**

A cleaner test would need a percentile computed from partial-season stats
(matching the exact PA/IP a player actually accumulated during the
duration, ranked against others' partial-season lines through the same
point) rather than requiring a full qualifying line — a bigger rebuild than
this pass, flagged rather than attempted. Scripts: `perf-pull.mjs`
(the pull), `org-regression-perf.mjs` (baseline-vs-augmented refit and
coefficient-shift comparison). Output: `perf-pool.json`,
`org-regression-perf.json`.

**Adversarial cross-read note:** this section's SE is naive OLS, not the
cluster-robust SE the omnibus-check section above establishes as the more
trustworthy one — kept naive deliberately so the baseline-vs-augmented
*comparison* stays apples-to-apples (the question here is whether adding
performance shifts things, not whether the absolute significance count is
trustworthy on its own). Don't read this section's "3 of 30" as the same 3
orgs as the omnibus-check section's "3 of 30" — they aren't. Naming both
side by side without that flag would read as two analyses agreeing when
they're actually about different orgs entirely, which the table below
makes clear.

## The one thing that's robust: Tampa Bay

Pulling together every specification run across this whole spike — naive
vs. cluster-robust SE, with vs. without era control, with vs. without
performance control, full cohort vs. the performance-eligible subsample —
one pattern falls out that no single section above states directly:

| Specification | Significant orgs (uncorrected) |
| --- | --- |
| Naive SE, full cohort | Nationals, Baltimore, Milwaukee, **Tampa Bay** |
| Naive SE, full cohort, BH-corrected | Nationals, **Tampa Bay** |
| Cluster-robust SE, full cohort | Baltimore, Milwaukee, **Tampa Bay** |
| Cluster-robust SE, full cohort, BH-corrected | **Tampa Bay** |
| Cluster-robust SE, era-controlled | Baltimore, Milwaukee, **Tampa Bay** |
| Naive SE, performance-eligible subsample | Atlanta, Cleveland, **Tampa Bay** |
| Naive SE, performance-eligible subsample + perf control | Atlanta, Cleveland, **Tampa Bay** |

**Update 2026-08-24:** two further specifications have since been tried —
the same model refitted on rows with the era artifacts removed, by two
different COVID handlings — and Tampa Bay is significant under both,
surviving Benjamini-Hochberg each time (+31.0%, p=0.0012 and +37.0%,
p=0.0001). Milwaukee joins it as a BH survivor under the second. That takes
the tally to nine specifications, and it is now the finding that holds
while the aggregate org signal around it does not. See "The 2016–2020 hump
is an instrument artifact" below.

**Tampa Bay Rays is the only organization that comes back significant
under every specification tried in this spike** — every SE method,
correction, and cohort restriction attempted. Nationals and
Baltimore/Milwaukee are each significant under exactly one methodological
family (naive-SE or cluster-robust, respectively) and disappear under the
other. Atlanta and Cleveland appear only in the volume-restricted
performance subsample and nowhere in the full cohort. That instability is
itself the finding: which 3 orgs look "significant" depends heavily on
which defensible methodological choice gets made, which is exactly what
"individual-org attribution is unreliable" (the headline conclusion above)
predicts. Tampa Bay surviving all seven specifications, including the
strictest (BH-corrected, cluster-robust) and the most different in kind
(a completely disjoint subsample under naive SE), is the closest thing to
an actual per-org finding anywhere in this spike — worth a specific,
qualified callout if this research ever gets picked up again, while
everything else stays "org matters a little in aggregate, no specific
team with confidence."

## The 2016–2020 hump is an instrument artifact (2026-08-24)

The omnibus-check section above ends by naming this the biggest open
question left: "**What actually happened in 2016–2020 to slow promotions
down, and why 2021–2023 partially but not fully reverted, is an open
question this spike doesn't answer**," with front-office regimes, rule
changes and PDL restructuring as the candidate causes to go looking for.

This pass asks the prior question instead. **Is the hump real?** Mostly it
is not. The same discipline the performance section used when it found the
PA/IP volume floor was mechanically deleting the fastest promotions applies
here: check the instrument before theorising about the signal.

### The hump is not a hump — it is two depressed edges

Look at the same data one year at a time instead of in three buckets:

| End year | 2009 | 2010 | 2011 | 2012 | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Median days | **34** | **122** | 282 | 275 | 281 | 282 | 301 | 286 | 320 | 321 | 308 |
| n | 56 | 143 | 216 | 235 | 248 | 283 | 267 | 321 | 267 | 235 | 279 |

2011 through 2019 sit in a 275–321 band. There is no step up into 2016. The
"hump" is bucket A being dragged down by **2009 (34 days) and 2010 (122
days)** — two years that look nothing like the other nine — and bucket C
being dragged down by 2021. Three measurement artifacts produce exactly
that, and each one is measured below rather than asserted.

### A1 — the transaction wire does not exist before 2009

A duration needs BOTH of its endpoints dated off the transaction wire.
statsapi's wire is effectively empty before 2009: **457 ASG rows across all
of 1997–2008, against 290,690 from 2009 onward** — 0.16%. The count steps
from 34 rows in 2008 to 9,941 in 2009.

So a duration ending in 2009 can only reach back to the 2009 season. The
ceiling that puts on it is arithmetic, not behavioural:

| End year | Longest span the wire permits | Bound by |
| --- | --- | --- |
| 2009 | 279 days | **the wire** |
| 2010 | 644 days | **the wire** |
| 2011 | 1,009 days | the pipeline's own 900-day cap |
| 2012 | 1,375 days | the 900-day cap |

2009 and 2010 are the only two years where the instrument, not the cap,
sets the limit — and both are shortened well below the 900-day cap every
other year is measured against. That is where this pass's 2011 floor comes
from: a measured boundary, not a round number. Dropping those two years
alone moves bucket A's median from **257 to 283 days**.

### A2 and A3 — the lost 2020 season, and the cap that deletes it

No minor-league games were played in 2020. A stint spanning that year
accrues a full extra year of calendar time with no baseball in it. **283
durations span the would-be 2020 season.**

The 900-day cap then deletes 105 of those 283 outright — **55 in 2021
alone**, more cap-drops than any other year has. The two effects push
opposite ways and both land on bucket C: the lost season inflates
2021-ending durations, and the cap removes the ones it inflated past 900
days. 2021's published median of 142 days is what survives that; the same
year's full set of durations has a median of 641.

The cap is a defensible modelling choice. It is not era-neutral, and
nothing before this pass had checked whether it was.

### What is left after all three come off

| Specification | A (≤2015) | B (2016–2020) | C (2021–2023) |
| --- | --- | --- | --- |
| S0 — as published | 257 | 324 | 265 |
| S1 — drop the wire-truncated years | 283 | 324 | 265 |
| S3 — S1 + subtract the lost season, cap on adjusted days | 283 | **301** | 269 |
| S5 — S1 + drop end-years 2020/2021 outright (no adjustment assumed) | 283 | **312** | 270 |
| S4 — S3 + drop post-debut rows (see below) | 283 | 300 | 265 |

The peak falls from **+26% over bucket A to +6% (S3) or +10% (S5)**. Roughly
two-thirds to three-quarters of the hump was instrument.

S3 and S5 handle COVID two different ways on purpose — one adjusts, one
refuses to adjust and drops the two disrupted years entirely — so the
result does not rest on the adjustment being right. A third spec, S2 (drop
every duration spanning the lost season, keep the years), is in the output
but should **not** be read as a clean answer: any 2021-ending duration
longer than about eight months necessarily spans the dead window, so S2
keeps only the short 2021 stints and manufactures a bias of its own. It is
reported because it was run, not because it settles anything.

### The check that actually decides it: measure the same thing without the wire

The residual 6–10% could still be real. There is a way to test it that none
of A1/A2/A3 can touch — **count seasons at a level and PA/IP at a level
straight off `yearByYear`, with no transaction wire anywhere in the
measurement.** If players genuinely spent 10% longer at a level in the
back half of the 2010s, they had to accumulate more seasons and more plate
appearances doing it.

| Arrival era | (player, level) pairs | Mean seasons at level | Median PA (hitters) |
| --- | --- | --- | --- |
| 2011–2015 | 1,586 | 1.487 | 442 |
| 2016–2018 | 970 | **1.490** | **448** |

Kruskal-Wallis H(1) = 1.051, **p = 0.31**. Flat. On an instrument the
artifacts cannot reach, the 2016–2018 arrival cohort spent the same time at
a level as the 2011–2015 cohort, to three decimal places on seasons and six
plate appearances on volume.

That window stops at 2018 on both sides, and the boundary is forced rather
than chosen: this metric counts SEASONS, and 2020 had no season to count,
so anyone whose stay reached into 2020 is missing a countable season
mechanically. The 2019 arrivals read 1.137 seasons against a 1.44–1.63 band
everywhere else — that artifact, showing up exactly where it should, which
is also a useful sign the metric behaves as expected. The 2023 debut cutoff
censors recent arrivals on top of it. So this check speaks to the *rise
into* 2016–2018 and cannot speak to 2019–2020. That is a real gap, stated
rather than hidden.

One more thing is consistent with the instrument reading, and is reported
as consistent-with rather than proof. Wire density more than doubled across
the window (13,731 ASG rows in 2011 to 27,284 in 2019). A missed arrival
makes the resolver fall through to a later event and understate a duration,
so thinner early coverage predicts shorter early durations. Across
2011–2019 the correlation between wire density and median days-at-level is
Pearson r = 0.72, Spearman rho = 0.87 (n = 9 years). **Wire density is very
nearly monotone in year, so this cannot separate "denser wire, longer
measured durations" from any other monotone trend over the same nine
years.** The wire-free check above is the one that discriminates.

### The knock-on: the aggregate org signal does not survive this

The omnibus-check section's headline — "org matters a little in aggregate
(ICC ≈ 1.2%)" — was fitted on the rows these artifacts contaminate
(**11.5%** of the published set), with era as a control on top. Refitting
the identical model on corrected rows:

| Specification | Cluster-robust omnibus Wald | Player-collapsed ANOVA | ICC |
| --- | --- | --- | --- |
| Published | F(29,1494)=1.824, p=0.0048 | F(29,1677)=1.685, p=0.0128 | 1.2% |
| S0 — as published, refitted here | F(29,1494)=1.824, **p=0.0048** | F(29,1677)=1.670, p=0.0143 | 1.16% |
| S3 — lost-season adjusted | F(29,1421)=1.451, **p=0.0579** | F(29,1610)=1.216, p=0.1987 | **0.39%** |
| S5 — disrupted years dropped | F(29,1359)=1.364, **p=0.0947** | F(29,1513)=1.010, p=0.4509 | **0.02%** |

S0 reproduces the published Wald test to the digit, which is the check that
this is the same model refitted and not a different one. (The ANOVA row
differs by 0.015 because the published version carried an era term and this
one does not — era is removed at the source here instead of modelled
around.)

**On corrected rows the aggregate org signal is no longer significant at
0.05, and the between-org variance component collapses by 3× to 60×.**

The obvious objection is that removing rows weakens any signal. That is
tested, not argued: 200 seeded random subsamples of the published rows, each
the same size as the corrected set.

| | Random subsamples at the same n | Observed | Percentile |
| --- | --- | --- | --- |
| S3, Wald F | median 1.804 [p05 1.636, p95 2.037] | 1.451 | **0th** |
| S3, τ² | median 0.0145 [0.011, 0.0185] | 0.0044 | **0th** |
| S5, Wald F | median 1.750 [1.415, 2.233] | 1.364 | 2.5th |
| S5, τ² | median 0.0132 [0.007, 0.0213] | 0.0002 | **0th** |

Random row loss leaves the signal where it was — median F = 1.804 against
the published 1.824. The targeted removal sits at the bottom of that
distribution. **The collapse is about which rows came out, not how many.**
τ² is an effect-size estimate rather than a power quantity, which is why it
was the right thing to watch, and it moved furthest.

### Tampa Bay goes the other way

| Specification | Tampa Bay | Survives BH q=0.05 |
| --- | --- | --- |
| S0 — as published | +39.1%, p<0.0001 | Rays |
| S3 — lost-season adjusted | +31.0%, p=0.0012 | Rays |
| S5 — disrupted years dropped | +37.0%, p=0.0001 | Rays, **Brewers** |

Tampa Bay is significant under every corrected specification, including the
one that assumes nothing about COVID. Milwaukee joins it as a BH survivor
once the disrupted years are dropped.

So the doc's summary sentence inverts. It currently reads "org matters a
little in aggregate, and current sample sizes can't say which org." After
this correction the accurate version is nearer: **the aggregate claim is
the one that fails, and the specific-team one is what holds** — one org
(Tampa Bay, with Milwaukee behind it) is a persistent outlier, and there is
no longer good evidence of a broad, league-wide org effect underneath it.

### What this does not change

**No per-team movement-window feature should ship.** That conclusion is
untouched, and if anything the ground under it is firmer: the aggregate
effect this spike had settled on as "real but tiny" now looks smaller still,
and two orgs standing out against 28 that do not is not a per-team range.
Nothing here revisits the quantile-overlap result (0 of 30), the R²≈0.04
finding, the performance confound, or the cohort-selection gap.

Two prior passages should be read with this section attached, though:

- The era-control results in the omnibus-check section stand as arithmetic,
  but "era predicts days-at-level better than org or tier do" now has a
  plainer reading — a good part of what that era term was absorbing is
  measurement coverage, not baseball.
- The "2021 contraction" correction earlier in this doc was right to reject
  the contraction story. Its replacement, the hump, does not survive either.

### One thing found on the way, unprompted

**434 of 3,549 durations (12.2%) end AFTER the player's MLB debut.** The
date resolver matches transactions by level in cursor order across every
cached season; when a player's pre-debut assignments are thin on the wire it
falls through to his later option and rehab assignments. Those rows are
shuttling, not development — a different phenomenon wearing the same label.
The share is spread fairly evenly across years (6–17%, with 2009 at 27%), so
it is not what produces the hump, and spec S4 above shows dropping the rows
does not move the era picture. It is a standing caveat on every duration
figure in this document, not a new one for this section.

The proper fix is to bound each transition search inside the player's own
pre-debut window rather than let the cursor run past his debut. That is a
change to `dates.mjs`'s resolver, and it would move numbers in every prior
section, so it is flagged here rather than made unilaterally.

## Where the work lives

`.scratch/level-benchmarks/team-windows.mjs` — reuses `org-and-timing.mjs`'s
historical org sweep, extends it to all four levels, computes p25/p75 (not
just median), and runs the overlap check. Output: `team-windows.json`.
`org-gaps.mjs` cross-checks the org sweep against every duration the
cohort actually uses and ranks team ids by cohort impact. Output:
`org-gaps.json`. `org-regression.mjs` is the confound-controlled follow-up:
fits `log(days) ~ level + draftTier + org` by OLS (effect-coded, own
normal-equations solver — no external stats dependency) and reports each
org's fixed effect with a 95% CI, plus Bonferroni and Benjamini-Hochberg
flags. Output: `org-regression.json`. `dates.mjs` now stamps each
`allDurations` entry with the exact `season` its transition resolved to
(the adversarial-review fix above); `org-regression.mjs` reads that field
directly instead of re-deriving a season guess. `org-regression-
transform.mjs` reruns the same model on raw and `sqrt` days (outputs:
`org-regression-transform-{log,levels,sqrt}.json`) to check the conclusion
isn't transform-dependent. `clustering-check.mjs` reports rows-per-player by
org, the non-independence check behind section 4 of "Adversarial review."
`org-variance-components.mjs` is the omnibus follow-up: cluster-robust
(player-clustered) SEs and a joint Wald F-test for the whole org block, an
org × era representation chi-square plus an era-augmented refit, and a
player-collapsed one-way variance-component ANOVA (tau²/sigma²/ICC) with
empirical-Bayes shrunk per-org estimates. Output:
`org-variance-components.json`. `org-omnibus-transform-check.mjs` reruns
just the cluster-robust omnibus Wald test on raw and `sqrt` days, output
`org-omnibus-transform-check.json`. `org-era-granularity.mjs` reruns the era
check at three-bucket resolution (≤2015 / 2016–2020 / 2021–2023) to test
the contraction hypothesis directly. Output: `org-era-granularity.json`.
`perf-pull.mjs` pulls the full (not qualification-floored) hitting/pitching
population for every (level, season) the fixed cohort touches, reusing
`src/api/statsLevels.js`'s `fetchLevelSeasonStats` (`playerPool=all`).
Output: `perf-pool.json` (~7MB, committed — see precedent below).
`org-regression-perf.mjs` adds an in-level performance percentile covariate
to the level+tier+org model and compares baseline vs. augmented fits on the
same row subset. Output: `org-regression-perf.json`.
`era-hump.mjs` is the artifact audit of the era result: transaction-wire
coverage by season and the span ceiling it forces, the lost-2020-season
overlap and the 900-day cap's interaction with it, five specifications
peeling those off one at a time, a debut-window censoring check, and the
wire-independent seasons-at-level / PA-at-level cross-check read straight
off `yearByYear`. It makes no network calls. Output: `era-hump.json`.
`era-hump-org-recheck.mjs` refits the org block (cluster-robust omnibus
Wald, per-org BH, player-collapsed variance components) on those corrected
row sets and compares against what this doc publishes, with a seeded
200-draw random-subsampling control that separates "fewer rows" from "the
right rows removed". It does need the 52-call org sweep. Output:
`era-hump-org-recheck.json`. `dates.mjs` now also stamps each duration's
`startDate`, `endDate` and `debutDate`, and keeps the durations its 900-day
cap drops in a separate `droppedLongDurations` array, so the cap can be
measured instead of assumed neutral — an additive change that regenerates
the existing 3,278 durations with zero mismatches on every shared field.
All depend on `raw.json`, `dates.json`, `findings.json` already in that
directory (now built from the widened 2005–2023 pull — `pull.mjs`'s
`DEBUT_YEAR_MIN` is 2005); `txn-cache.json` is gitignored (~65MB, now spans
1997–2023) but cheap to rebuild — see `docs/level-tenure-benchmark.md`.
