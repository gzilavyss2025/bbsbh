# The joint model: one trait, or four?

Research spike #6, 2026-08-26. Sixth spike in the Contender Diary program
(`docs/team-success-research.md`), promoted to the front of the queue after
spikes #1-#5 each found something real on the "made the postseason" cut and
little on "advanced once there." Run as one category inside a 9-category,
4-wave research workflow that also stress-tested three other findings in this
program — see `docs/team-movement-windows.md`, `docs/price-the-blockage.md`,
and the workflow's own cross-reference (`docs/level-tenure-benchmark.md`,
`docs/homegrown-dependence.md`) for the categories folded in below as
covariates and context.

**The question.** Roster age, homegrown share, star diversity, and postseason
experience were each tested one at a time. Model them together, controlling
for each other, and answer the specific gap the earlier spikes left open:
does homegrown dependence's null on "how far a team goes" change once star
diversity and roster age sit in the same model?

**The answers, in order of how much weight they carry.**

1. **No, homegrown dependence's null does not change.** Its coefficient
   barely moves, marginal to joint, and stays far short of conventional
   significance either way (p=0.16 marginal, p=0.12 joint). This is not
   because something is drowning it out — homegrown share is close to
   unrelated to the other three factors (variance inflation factor 1.06), so
   there was never a confound available to mask it.
2. **The four factors are not four independent things, and they are not one
   trait either — it splits two and two.** Roster age and prior postseason
   experience overlap heavily (rho +0.58) and share more than half of each
   other's predictive power once both sit in the same model. Star diversity
   and homegrown share are each close to unrelated to everything else and
   keep their own behavior intact under joint control.
3. **Homegrown share's one real result gets stronger, not weaker, under joint
   control.** Among postseason clubs, a more homegrown roster still separates
   division winners from wild-card teams (p=0.013 joint, versus p=0.015
   alone) — the only one of the four factors that says anything on that cut.
4. **A fifth signal turned up while folding in this program's other
   findings: an organization's typical time at Triple-A predicts October
   about as strongly as roster age does, on its own, independent of all
   four factors.** It survives every robustness check run against it. It is
   reported as a **lead, not a finding** — the direction of cause and effect
   is not settled, and the more likely reading runs the other way: winning
   clubs block their own prospects, rather than slow-developing organizations
   going on to win.

## The window, and why it grew

**570 team-seasons, 2004-2023, excluding 2020** — the intersection of all
four factor panels. This is the homegrown-share panel's own window
(`docs/homegrown-dependence.md`), the tightest of the four, the same limit
that already bounded spike #2 on its own. Every earlier attempt at this
spike used 2010-2023 (420 team-seasons, 14 champions), bounded by
`war-history`'s old floor. **PR #912 lifted that floor to 1901**, so the true
limit is now the homegrown panel's window, not WAR — the joint sample grew
36%, and the champion count from 14 to 19, for free.

Where homegrown share is not needed, the wider window applies: roster age,
star diversity, and postseason experience alone run on **750 team-seasons,
2000-2025 excluding 2020** (the full ladder window), 25 champions.

Every number below was checked against a published spike figure before being
trusted. All 13 replication checks — Spearman correlations for all four
factors, on their own original windows — matched the published values to
three or four decimal places. Two side notes worth recording, neither of
which changes a published spike doc: star diversity's correlation reproduces
to the third decimal on MLB's own `stats=sabermetrics` WAR (the FanGraphs-to-
MLB source swap that doc flagged as needing a check moves nothing), and WAR
coverage over the full roster-age panel is **100%** — the roster-age doc
expected a re-check would fall short of that; it does not.

## The model

Ordered logistic regression (proportional odds) on the existing 0-5 outcome
ladder — the same ordinal structure `docs/team-success-research.md` already
specifies, not a series of separate yes/no cuts. Plain logistic regression
for `madePostseason`, `wonDivision`, and advancing once in. Every predictor
is centered on its own season's average, then scaled to standard-deviation
units, so every coefficient reads as "per one standard deviation," the same
convention every earlier spike used. Era controls sit in every fit.
Standard errors cluster by club (30 clusters).

**All four factors, together, against the 0-5 ladder (n=570):**

| Factor | Alone | Together | p (together) | Odds ratio |
| --- | --- | --- | --- | --- |
| Roster age | +0.60 | +0.29 | 0.0006 | 1.34 |
| Homegrown share | +0.16 | +0.14 | 0.1228 | 1.15 |
| Star diversity (hitting) | −0.54 | −0.47 | 0.0001 | 0.62 |
| Postseason experience | +0.89 | +0.68 | <0.0001 | 1.98 |

Same sign on all four in 19/19 leave-one-season-out refits and 30/30
leave-one-club-out refits. Folding 2020 back in (n=600) moves nothing.

## The motivating question, answered

Homegrown share alone: +0.161 (p=0.163). Homegrown share with the other
three factors held: +0.140 (p=0.123). A within-season permutation test that
reshuffles homegrown share and refits the whole joint model 1,000 times
agrees: p=0.153. The model could have detected an effect the size of any of
its three neighbors — 0.29, 0.47, or 0.68 — several times over; it is not
being suppressed by anything. The closest homegrown share ever gets to
significance, under any specification tried, is p=0.073.

This is a bounded null, not a proof of zero. Ruling out an effect the size
of 0.14 at conventional power would take roughly three times the current
sample — about 1,780 team-seasons, more than this program is ever likely to
reach. Extending the homegrown classifier back to 2000-2003 and forward to
2024-2025 (cheap: six statsapi calls per newly-covered player) would grow
the sample to 750, which moves the detectable floor only slightly. Say
**"not a large effect,"** never **"no effect."**

## The one positive, stronger under joint control

Among the 178 clubs that made the postseason, homegrown share separates
division winners (n=114) from wild-card teams (n=64): +0.407 per standard
deviation, p=0.013, together with the other three factors — a touch
stronger than the +0.433, p=0.015 it showed alone. A permutation test
refitting the whole joint model 1,000 times agrees, p=0.024. None of the
other three factors says anything on this cut. Split by side of the ball,
this result lives on the hitting side (p=0.032); the pitching side is flat
(p=0.91) — spike #2 found both sides moving together at about the same
size, so this is a real change worth a note, not a correction to that doc.

## The structure: two factors merge, two stand alone

The program's headline question was whether roster age, homegrown share,
star diversity, and postseason experience are four independent signals or
one underlying "well-run organization" trait wearing four names. Measuring
how the four factors correlate with each other answers it directly: the
only meaningful pair is **roster age and postseason experience, rho +0.58**.
Every other pair sits at |rho| ≤ 0.15. Age alone predicts the ladder at
+0.62; with experience in the model, that drops to +0.29 — experience
accounts for over half of what age was picking up. Experience alone
predicts at +0.84; with age in the model, that only drops to +0.68 —
experience keeps most of its own signal. Read the pair as one factor best
measured by postseason experience, not two.

Star diversity and homegrown share are both close to independent of
everything else (variance inflation factors 1.03 and 1.06) and keep their
marginal behavior almost unchanged under joint control. So the honest answer
to "one trait or four" is: **two of the four are one thing, wearing two
names; the other two are genuinely separate.**

Splitting age and homegrown share by side of the ball (eight predictors at
once) confirms spike #1's own finding that pitching age carries the roster-
age effect (pitching +0.38, p=0.0025; batting −0.02, p=0.89, not
significant). It also surfaces one lead worth a second look, not yet a
finding: pitching-side star concentration, flat alone (p=0.11), turns up
significant only once the other seven predictors are held (p=0.037) — one
result out of eight tested together, after the fact.

## Other outcome cuts

- **Made the postseason at all (n=570):** age +0.234 (p=0.021), homegrown
  +0.128 (p=0.163), star diversity −0.553 (p=0.0001), experience +0.756
  (p<0.0001).
- **Reached the LCS or better (n=570):** age +0.503 (p=0.0006), experience
  +0.462 (p=0.014), star diversity −0.243 (p=0.047), homegrown +0.184
  (p=0.255).
- **Advancing, once already in the postseason (n=178):** only age says
  anything, +0.384 (p=0.047). On the wider 3-factor window (n=234), age
  +0.463 (p=0.0011) and experience −0.301 (p=0.051) — a collinearity
  see-saw from the age/experience overlap above, not evidence that
  experience hurts a club once October starts. Read the pair as one factor,
  as above, not two competing ones.
- **The wide, homegrown-free window confirms the narrow one is not a
  small-sample artifact** (n=750): age +0.280 (p=0.0003), star diversity
  −0.461 (p<0.0001), experience +0.730 (p<0.0001).

## The fifth signal: organization Triple-A tenure

Folding in this workflow's stress-test of the org-movement program
(`docs/team-movement-windows.md`) and its cross-reference against
level-tenure and homegrown share (`docs/level-tenure-benchmark.md`) turned
up a candidate fifth factor: an organization's typical number of days a
player spends at Triple-A before his debut. Added to the joint ladder model
as a fifth, organization-level covariate: +0.298 per standard deviation
(p=0.0003); on making the postseason, +0.316 (p=0.0010). An exact
permutation test that shuffles which organization gets which tenure value
(2,000 refits) agrees, p=0.0020. It survives leave-one-organization-out
(30/30, same sign, p<0.05 every time) and survives dropping any two
organizations at once, including the two that most look like they are
driving it. It sits close to unrelated to all four other factors
(correlation ≤ 0.18 with each, every p > 0.33), and reproduces this same
workflow's cross-reference finding that organization tenure and homegrown
share are themselves unrelated (r=0.055, p=0.774).

**Why this is a lead, not a finding.** Above-median-success organizations
average 213 days at Triple-A; below-median organizations average 141. That
is the same shape as the mechanism `docs/price-the-blockage.md` already
built a whole spike around: a deep, winning major-league roster makes a
Triple-A prospect wait behind an established player — running from winning
TO slow promotion, not the reverse. Nothing in this measurement can tell the
two directions apart; the tenure cohort and the ladder seasons are
contemporaneous. The organization table itself makes the ambiguity
concrete: three of the five slowest-promoting organizations sit at or below
the league's average postseason performance (Milwaukee, Tampa Bay,
Cleveland), against the two clear outliers on the slow-and-successful side,
Boston and the Los Angeles Dodgers. Tampa Bay — the one organization that
survived this workflow's stress-test of the org-movement program as a real,
Triple-A-specific effect — is itself a counter-example inside this finding:
the second-slowest promoter in the league, with a below-average postseason
record.

## What this does not settle

- **The homegrown result is settled for a structural reason, not just a
  p-value** — it is close to unrelated to the other three factors, so no
  amount of joint modeling could have rescued it either way. What is NOT
  settled: whether the merged age/experience factor means anything causal,
  the org-tenure lead's direction of cause and effect, and a historical
  payroll control, which this program has never had.
- **Nothing here is causal.** A club already winning in July rents veteran
  players at the trade deadline, which raises exactly the roster age this
  model measures — `docs/team-success-postseason-usage.md` already showed
  the age effect is not primarily this artifact, but the joint model does
  nothing new about it. The same logic applies both ways to experience:
  "experienced players make a club better" and "good clubs accumulate
  experienced players" both predict the same numbers above.
- **Age and postseason experience are not separately identified.** At
  rho +0.58, splitting their shared predictive power between two
  coefficients is imprecise — the see-saw in the "advancing" cut above (age
  positive, experience negative) is this collinearity showing up, not a
  finding that experience hurts a club in October.
- **The organization-tenure lead is statistically solid and causally
  open.** It survives every robustness check run against it, but it
  inherits every limit `docs/team-movement-windows.md` already carries: the
  cohort only covers players who reached the majors, so it measures
  "players who made it took longer at Triple-A," not organizational policy
  toward players who did not. A separate PR already retracted the raw
  organization-to-organization signal in that program as mostly an era
  artifact; this workflow's own stress test partially rehabilitates the
  organization ordering with an instrument immune to that artifact, but does
  not settle it either.
- **No payroll control**, the standing gap in every spike in this program.
  It falls hardest on the organization-tenure result — the slow-and-
  successful corner of the table is Boston and the Dodgers — and on the
  merged age/experience factor, a plausible stand-in for an expensive,
  established roster.
- **Multiple comparisons.** The one question asked up front — does homegrown
  share change under joint control — is clean, tested once. Five outcome
  models were then fit with several specifications each; the leads that
  turned up along the way (pitching-side star concentration only becoming
  significant under joint control, the age/experience see-saw on advancing)
  are exactly that: leads, not reported as findings.
- **Thirty clubs is the whole league, not a sample** — every result above
  either clears a wide margin or was checked against a permutation test
  built for exactly this small-cluster problem.
- **The ordinal model form is assumed, not tested**, and rung 2 of the
  ladder (won a round but did not reach the LCS) holds only 12 rows in this
  window — its own cutpoint is barely identified, the same limit
  `docs/team-success-research.md` already flags for that rung.

## What would move this next

- **Find a historical payroll source.** It is now the single largest
  unmeasured confound in this program, touching three of the five signals
  here, not just one.
- **Give the organization-tenure lead temporal separation** — measure
  tenure only on debuts that happened before the ladder season it predicts —
  and test it head to head against `docs/price-the-blockage.md`'s incumbent-
  depth measure, the leading alternative explanation for the same pattern.
- **Extend the homegrown classifier to 2000-2003 and 2024-2025.** Cheap, and
  worth doing for the division-winner result's sample size even though it
  will not resolve the depth null on its own.

## Where the work lives

This spike ran inside a 9-category research workflow (2026-08-26), joining
the four factor panels through the shared DuckDB layer
(`scripts/research-db.mjs`, `docs/agents/research-database.md`):
`team_success_roster_age`, `level_benchmarks_homegrown_panel`,
`team_success_postseason_experience`, and `team_success_outcome_ladder`, plus
`level_benchmarks_team_windows` for the fifth-signal covariate. Star
diversity has no panel of its own — it was recomputed from
`team_success_roster_age_cache`, `public_war_history`,
`public_all_star_rosters`, and `public_awards_history`, the same views the
factor catalog already names for it.

**Housekeeping gap, unlike every earlier spike here:** the analysis scripts
that produced the numbers above ran in the orchestrating session's own
scratchpad, not in `.scratch/team-success/`, because the workflow's task
scope was read-only analysis with no repository writes. Nothing was
committed. A future pass should rebuild and commit
`.scratch/team-success/analyze-joint-model.mjs` and its distilled results
file, the same way every other spike in this program does, so the next spike
can query this one's output instead of re-deriving it.
