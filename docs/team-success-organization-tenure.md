# The organization-tenure lead, forced to predict forward

Research spike #10, 2026-08-26. Direct follow-up to
`docs/team-success-joint-model.md`'s fifth signal, the one it explicitly
flagged as unfinished in its own "What would move this next" section: give
the organization Triple-A tenure lead genuine temporal separation, then test
it head to head against `docs/price-the-blockage.md`'s incumbent-depth
measure, the leading alternative explanation for the same pattern.

**The question.** The joint model found that an organization's typical time
at Triple-A predicts postseason success about as strongly as roster age does
(+0.298 SD, p=0.0003) — but it could not tell two stories apart: slow
development causing winning, or winning organizations blocking their own
prospects behind an established roster. Both stories predict the exact same
number when tenure and outcome are measured in the same season. Does the
lead survive once tenure is measured only from debuts that happened BEFORE
the season it is meant to predict? And once it is fit alongside incumbent
depth, does either measure explain away the other?

**The answers, in order of how much weight they carry.**

1. **No, the lead does not survive prediction forward in time.** On the
   best-powered version of the test — 327 organization-seasons, lagged
   tenure alone, era-controlled — the coefficient drops from +0.298 SD to
   +0.159 SD and misses conventional significance (p=0.145). A permutation
   test built for exactly this question also misses (p=0.154), and not one
   of 30 leave-one-organization-out refits individually clears p<0.05,
   although all 30 keep the same sign.
2. **The drop is caused by the lag itself, not a smaller or different
   sample.** Holding the exact same 104 organization-seasons fixed and
   swapping the lagged tenure value back for the original, same-season value
   restores a strong, clearly significant effect: +0.653 SD, p=0.0032.
   Forcing genuine temporal separation on those identical rows roughly
   halves the coefficient, to +0.364 SD, p=0.077 — a coin flip either way on
   the usual line, not a clean survival.
3. **Lagged tenure and incumbent depth do not compete, in either
   direction, because neither one has anything left to give away.**
   The two measures are close to uncorrelated at the organization-season
   level (r=0.035, n=104). Depth's own coefficient is flat with tenure in
   the model (+0.008 SD, p=0.97), and lagged tenure barely moves whether
   depth is in the model or not (+0.364 either way). This is not two
   real effects canceling each other out — it is a lead too weak, once
   lagged, to need a competing explanation.
4. **This is consistent with, but does not prove, the reverse-causation
   story the joint model suspected** (winning organizations blocking their
   own prospects at Triple-A, rather than slow development causing winning).
   A null in a smaller, lagged sample is equally consistent with a real
   effect this measurement is simply too thin to detect. The honest label is
   "the lead does not survive," never "the lead is disproven."

## What "lagged" means here, and why the sample shrinks

The joint model's tenure number pooled every debut an organization produced
across its whole 2005-2023 window into one figure, then applied that single
number to every season that organization played — the same tenure value
predicting 2013 and predicting 2022 alike. That construction cannot separate
cause from effect, because a 2022 debut can "predict" a 2013 outcome only
by riding along with whatever an organization's identity was throughout the
whole window.

This spike rebuilds the measure so a season's tenure figure uses only debuts
that happened strictly before that season. An organization with few debuts
before a given year gets no lagged value for that year at all, which is why
coverage starts thin (2 of 30 organizations have a usable lagged value in
2012) and only reaches full 30-of-30 coverage by 2017. The wide sample below
keeps every organization-year that clears a floor of six prior debuts,
2012-2025 excluding 2020.

## The model

Ordered logistic regression on the same 0-5 outcome ladder every spike in
this program uses, following the joint model's own convention: every
predictor centered on its own season, then scaled to standard-deviation
units, era controls in every fit.

**Wide sample (n=327 organization-seasons, lagged tenure alone):**

| Predictor | Coefficient | p | Odds ratio |
| --- | --- | --- | --- |
| Lagged tenure | +0.159 SD | 0.145 | 1.17 |
| Era (wild-card game) | −0.264 | 0.252 | 0.77 |

Leave-one-organization-out: same sign in 30 of 30 refits, individually
significant in 0 of 30. A permutation test that reshuffles which
organization gets which lagged-tenure value within each season, refits the
model 2,000 times, and compares the shuffled coefficient to the real one:
p=0.154.

**Depth-matched sample (n=104 organization-seasons, the intersection of
lagged-tenure coverage and organizations with at least two Triple-A hitter
stays in a reconstructed incumbent-depth panel):**

| Model | Lagged tenure | Depth | p (tenure) | p (depth) |
| --- | --- | --- | --- | --- |
| Tenure alone | +0.364 SD | — | 0.077 | — |
| Tenure + depth, joint | +0.364 SD | +0.008 SD | 0.077 | 0.97 |

Correlation between lagged tenure and depth on these 104 rows: r=0.035.
Leave-one-organization-out on the joint fit: same sign in 30 of 30,
individually significant in 4 of 30. A within-season permutation test on
the joint model: p=0.093.

**The isolation check**, run on the identical 104 rows with the tenure
value swapped back to the original, unlagged, contemporaneous figure:

| Predictor | Coefficient | p |
| --- | --- | --- |
| Contemporaneous tenure | +0.653 SD | 0.0032 |

Same rows, same era control, same everything except whether tenure is
measured before or during the season it predicts. That contrast is the
whole finding: +0.653 (contemporaneous) drops to +0.364 (lagged), on rows
that are otherwise identical.

**On making the postseason at all** (n=104, logistic): lagged tenure alone
+0.367 SD (p=0.084); with depth added, +0.369 SD (p=0.083), depth −0.030 SD
(p=0.89). Same story as the ladder model — depth adds nothing, tenure is
weaker than the contemporaneous version and short of significance either
way.

**Incumbent depth construction.** An organization-season's depth value is
the average, across that season's Triple-A hitter stays, of whether an
established player already held that job — the same per-stay method
`docs/price-the-blockage.md` built (its `incumbentAt()`, matched line for
line against this spike's own copy), restricted here to the 466 hitter
stays with a resolvable depth value (out of 967 Triple-A duration records;
497 pitcher stays and 4 stays with no resolvable organization were
dropped), aggregated into 125 organization-seasons with at least two
qualifying stays.

## Replication and robustness

Before trusting the lagged rebuild, the same organization-attribution
method was used to reproduce the already-published, unlagged
`team-windows.json` Triple-A medians: 30 of 30 organizations matched within
one day, at the same minimum-sample floor that document uses. The
gradient-ascent ordered-logit estimator itself was re-validated at the top
of this spike's own script against synthetic data with a known answer
(recovered coefficients within rounding of the true values), the same check
`docs/team-success-joint-model.md`'s own trade-deadline follow-up ran before
trusting it the first time.

Leave-one-organization-out and permutation tests are reported inline above,
on both samples. An independent verification pass re-ran this spike's
script end to end from the same cached inputs and reproduced every number
in this document exactly, including the drop counts behind the depth
panel and the organization-attribution replication check.

One number in an earlier draft of this document did not survive that
verification pass and has been removed: the r=0.035 tenure-versus-depth
correlation was described as "closely matching" the joint model's own
r=0.055 figure. That comparison was wrong — the joint model's r=0.055 is
the correlation between organization tenure and homegrown share, an
unrelated pair of variables the joint model reported for a completely
different reason. The joint model never computed, and had no data to
compute, a tenure-versus-depth correlation; this spike is the first time
those two measures have been compared at all. The r=0.035 figure above
stands on its own, as a directly computed number, but it has no prior
figure to be compared against.

## What this does not settle

- **This is a bounded null, not proof the lead was purely reverse
  causation.** A properly lagged measurement is also a noisier one — fewer
  prior debuts per organization-year, especially in the early seasons — so a
  weak, non-significant estimate is consistent both with "the effect isn't
  really there" and with "the effect is real but this measurement is too
  thin at this sample size to detect it." That is the same epistemic
  status the joint model gave the homegrown-share null.
- **The depth-matched sample is thin.** 104 organization-seasons span only
  10 of the ladder's 26 seasons, and the outcome distribution inside it is
  heavily bottom-loaded: 73 of the 104 organization-seasons sit at the
  bottom rung of the ladder, and only 12 sit above the second rung. Only 4
  of 30 leave-one-organization-out refits on this sample individually clear
  p<0.05. Read the tenure-versus-depth head-to-head as suggestive, not
  decisive, on top of the wide sample's own null.
- **The incumbent-depth measure here is not identical to
  `docs/price-the-blockage.md`'s full cohort.** It averages only that
  season's Triple-A HITTER stays (no pitchers, no rotation or bullpen job),
  matching the specific hitter-only model that document tests, and it is
  deliberately concurrent-season while tenure is lagged — the fairest
  head-to-head available with the data on hand, not a symmetric one.
- **No historical payroll control**, the standing gap across this whole
  program. It would touch a lagged-tenure story ("the organization can
  afford to wait on a prospect") the same way it already touches roster age
  and postseason experience in the joint model.
- **This spike did not re-test the other four joint-model factors**
  (roster age, homegrown share, star diversity, postseason experience)
  alongside lagged tenure. The task was specifically the tenure-versus-depth
  head-to-head the joint model asked for, not a re-run of the full
  five-factor model with a lagged fifth term substituted in.
- **A depth-join detail is a latent fragility, not a live bug.** The depth
  panel keys a fielding pull by team id and treats it as an organization id
  — safe only because no organization covered by the 2013-2023 window used
  here changed franchise in that span. Reusing this method over a wider or
  different window should re-check that assumption before trusting it.

## Where the work lives

`.scratch/team-success/`:

- **`pull-fielding-for-depth.mjs`** — the one new statsapi pull this spike
  needed (30 requests, MLB and Triple-A season fielding splits,
  `group=fielding`, 2009-2023) to reconstruct organization-season incumbent
  depth, since `docs/price-the-blockage.md`'s own cached inputs are
  gitignored and were not present in this worktree.
- **`analyze-tenure-lag.mjs`** — builds the lagged-tenure panel, joins it
  against the outcome ladder and the depth panel, and runs every model,
  robustness check, and the isolation check above.
- **`tenure-lag-panel.json`, `mlb-field-cache.json`,
  `milb-field-cache.json`** — the derived organization-season panel and the
  two statsapi caches behind it, so a re-run costs nothing.

No shared files (`scripts/research-db.mjs`,
`src/lib/research/contenderDiary/index.js`, `docs/team-success-research.md`)
were touched by this spike; a later synthesis pass owns wiring this entry
into the diary index and deciding whether the new panels belong in the
shared DuckDB catalog.
