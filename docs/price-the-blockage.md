# Pricing the blockage

The research behind the first ask in the front-office reading of the prospect
stack (`src/lib/research/diary/frontOffice.js`, PR #901): *for every Triple-A
stay, describe the job above the man — who holds it, how he is playing, how
many years he is signed for, whether he can be moved. Then ask whether that
description predicts the length of the stay better than the prospect's own line
does.*

The answer to the question as asked is **no**, and the no is robust on every
specification but one. The answer to the question underneath it is **yes** —
but the blockage is not paid in waiting. It is paid in position. A third
result, added in this pass, reads the actual transaction behind every stay's
end and finds that most of them are not blockage stories at all. And a real,
statistically significant number turned up in a corrected lag test that this
document reports and then rules out, because it fails blockage's own
falsification check — see "The one asterisk," below.

## Correction (2026-08-25): three bugs, 98 stays restored, one lag test redone

A first version of this document ran on 864 of the 962 Triple-A stays the
cohort should have carried, and its "survives lagging" claims were computed
under a third bug that was not caught until this pass either. Three bugs,
found across two separate follow-up sessions, are fixed here:

- **`model.mjs`** gated a pitcher's rate stat on `ownEra > 0`. A pitcher with a
  cumulative 0.00 ERA at the level — a real outcome for a short dominant
  stint, not missing data — failed that check and was dropped. 23 stays, all
  of them a club's best short pitching performances.
- **`incumbent-bio.json`** was stale relative to the final `incumbent-ids.json`:
  68 real incumbents (confirmed live against statsapi — Jamey Wright, Fernando
  Tatis Sr. among them) had simply never been fetched, so the service clock
  everything else depends on could not be computed for them. 75 stays.
- **Every "lagged" robustness check in this study** — meant to measure the job
  above the man the season *before* the stay begins, so the prospect's own
  readiness can't have caused it — only ever lagged two of the six job terms
  (quality, control years left). Depth, age, the club's win rate and tenure
  silently kept reading the *concurrent* season regardless of the flag. Every
  claim in the first draft that something "survives lagging" was checked
  against a fit that was still half measuring the present.

All three are fixed. `hydrate-incumbents.mjs` and the full `model.mjs` →
`deepen.mjs` → `confound.mjs` → `check.mjs` chain have been rerun against the
existing cached pulls — no new network pulls were needed — and every number
below is on the full **962 of 962** stays, with every "lagged" figure now
genuinely lagged.

**Every conclusion that does not depend on the lag test survives essentially
unchanged.** The waiting model's plain "no" gets slightly *stronger* on the
full cohort. The position-change "yes" gets slightly *weaker* in raw size but
survives its confound test unchanged. The lag test itself is the one place
this correction changes the story, and it changes it in **both** directions —
one claimed survival turns out not to hold under the real lag, and a new,
unexpected signal turns up that the first draft never saw at all. Both are
covered where they belong, below.

## The cohort

962 Triple-A stays, from the 967 that the level-tenure benchmark's date
resolution already produced (`docs/level-tenure-benchmark.md`,
`.scratch/level-benchmarks/dates.json`). Stays run 2009 to 2023 — the
transaction wire has no usable coverage before 2009, so the arrival dates do
not exist earlier.

Five stays were dropped for want of a parent organization, and one because the
parent club had nobody at all at the prospect's position that season.

## Describing the job above the man

One statsapi call returns every MLB player's season fielding split, so a whole
season's games-started-by-position costs one request. The full 2008–2024
record, hitting and pitching lines included, is 51 requests. Triple-A fielding
for the same span is 16 more.

**Who holds it.** For a hitter, the man with the most games started at the
prospect's position group on the parent club that season. Positions are
grouped: left and right field are one job, everything else is its own. For a
starting pitcher the job is the fifth man in the rotation, not the ace — a
rotation has five doors and the marginal one is the door that opens. For a
reliever it is the worst arm in the bullpen with 25 or more appearances.

**The prospect never counts as the job above himself.** He plays the same
position for the same club as soon as he is promoted, so leaving him in lets an
early promotion inflate the very depth count that is supposed to explain it.
Excluding him costs 75 stays outright — the men for whom nobody else held the
job at all. Those men were not blocked by construction, and an earlier pass
that left them in produced a strong, wrong, backwards result.

**How he is playing.** His OPS or ERA that season, divided by the league
average for qualified players in that same season, then standardised inside
season and player group so a hitter's line and a pitcher's line share a scale.

**How many years he is signed for.** There is no historical contract source
here — the Cot's data in `public/data/player-contracts` is a 2026 snapshot. It
does not need one. Three pre-arbitration years then three arbitration years
held for every season in this sample, so for any incumbent inside his first six
years the years of control remaining are arithmetic:
`max(0, 6 - service years)`.

The clock is service time, not seasons since debut. A man called up in
September does not bank a year, so a debut after 15 August starts the clock the
following season. A stricter variant counts only seasons in which he actually
appeared in the majors — the two disagree on 16.5% of stays and no result below
depends on which is used.

Outside the six years the number is a real contract this repo cannot see, and
that group — 40% of stays — is the only place the missing payroll history
actually bites.

**Whether he can be moved** has no honest ex-ante measure. What is used instead
is how many seasons he had already spent with that club, which is observable
before the stay begins. Whether he *was* moved is an outcome, and using it
would be circular.

## Two ways of counting a stay

The benchmark's day count runs straight through the winter. A stay that starts
in late August and ends on opening day reads as 223 days of waiting, and about
180 of those are months when nobody plays anywhere.

| Counting | Median | Middle half |
| --- | --- | --- |
| Calendar days | 162.5 | 51 to 359 |
| Days inside a season | 100.5 | 48 to 176.75 |

Every model below was run both ways. Nothing turns on the choice.

## The answer to the question as asked: no

Outcome `log(days)`, predictors the prospect's own rate line, his age, his
draft tier and the era. Volume is deliberately excluded — plate appearances at
a level are mechanically a function of days spent there, so putting them in
would be close to predicting the outcome with itself.

| Specification | R² his line | R² plus the job | The job buys |
| --- | --- | --- | --- |
| All stays, season days | 0.1354 | 0.1394 | 0.0040, F(6,946) = 0.74 |
| All stays, calendar days | 0.1407 | 0.1460 | 0.0053, F(6,946) = 0.98 |
| Job measured a season earlier * | 0.1354 | 0.1509 | 0.0155, F(6,946) = **2.87** |
| Hitters only | 0.1470 | 0.1551 | 0.0081, F(6,451) = 0.72 |
| Pitchers only | 0.1385 | 0.1508 | 0.0123, F(6,481) = 1.16 |
| Hitters + position held fixed, given every advantage | 0.1668 | 0.1776 | 0.0108, F(5,438) = 1.15 |

*(First draft, 864 stays: 0.0089 / 0.0108 / 0.0036 / 0.0049 / 0.0199 / 0.0102 —
the corrected cohort's "no" is if anything a cleaner no on every row except the
lagged one, marked \*, which is explained in its own section below because it
is the one real change to this study's headline conclusion.)*

Five of six rows are not significant. The single term that reaches p < 0.05
among them — incumbent quality, among pitchers (b = -0.110, p = 0.038) —
carries the **wrong sign**: a better man above him predicts a *shorter* stay.
That is what a contaminated concurrent measurement produces and what a real
effect does not.

The falsification cut on the CONCURRENT specification agrees, split five ways
by job scarcity (catcher/short/center is `scarce`, corner spots are `open`,
the middle infield-adjacent jobs are `mid`, and pitchers split into
`rotation`/`bullpen`): the one specification that clears p < 0.05 — incumbent
depth, in the rotation split (b = -0.121, p = 0.021) — is the fifth-starter
job specifically, not the scarce hitting positions blockage should bite
hardest at. Nothing in the scarce/mid/open splits reaches significance at all.

**On five of six specifications, the job above the man does not predict how
long he waits**, and that holds under both outcomes, split by player group,
and with position held fixed. The sixth — the properly lagged version, marked
\* above — is genuinely significant for the first time in this study. It does
not survive its own falsification test, and the next section explains why it
is reported here rather than folded quietly into the "no."

### The one asterisk: a real number that fails its own test

Once the lag bug above was fixed, the pooled "job measured a season earlier"
model turned up a real, non-trivial signal: F(6,946) = 2.87, p = 0.0089,
carried by incumbent depth specifically (b = 0.0643, p = 0.0004 on its own
term) — more men sharing the job a season before the stay predicts a *longer*
wait. On calendar days the same signal is stronger still (dR² = 0.0269,
F = 5.09, p = 0.00004), and it survives winsorizing away the most extreme 1%
of stays in either direction (dR² = 0.0180, F = 3.30, p = 0.0032), so it is
not a handful of outliers.

It fails the checks blockage itself predicts:

- **Split by job scarcity, it is absent exactly where blockage should bite
  hardest, and strongest in a job the falsification cut treats as the least
  scarce.** Scarce hitting jobs — catcher, short, center — F(6,188) = 0.39,
  p = 0.88, and the depth term alone carries the wrong sign. Open corner
  jobs: F(6,136) = 2.10, p = 0.057, not quite there. The overall test clears
  p < 0.05 in exactly one split, `mid` (F(6,97) = 2.37, p = 0.035) — the
  rotation split's depth term is individually significant (p = 0.041) but the
  rotation split's own overall F-test is not (F(6,294) = 1.32, p = 0.25), and
  the fifth-starter job this study's own construction treats as the *least*
  scarce pitching role is exactly where it would need to concentrate for
  blockage to be the explanation.
- **Split by player group, it is a pitcher pattern more than a hitter one.**
  Pitchers alone: F(6,481) = 2.37, p = 0.029. Hitters alone: F(6,451) = 1.26,
  p = 0.28. The position-change finding below this one is entirely about
  hitters and the defensive ladder; this signal barely touches them.
- **The raw, unmodeled relationship is not even monotonic.** Sorted into
  terciles by lagged depth with no regression at all: low depth, median 96
  season-days; mid depth, 107; high depth, 92. A real dose-response blockage
  effect should climb or fall in one direction. This dips and recovers, which
  is what a regression absorbing some other correlated pattern looks like
  from the outside.

**Read plainly: this is a real number, and it is not evidence of blockage.**
It reads as a pitching-staff-construction pattern — something about how a
rotation or a job several pitchers cycle through relates to wait time — that
the falsification test this whole study is built around correctly catches and
rules out as the thing being asked about here. It is left in this document
rather than dropped, because a finding a study's own falsification test kills
is still worth a record, and because whatever is actually driving it is a
legitimate open question for someone else's spike.

## The answer underneath: he does not wait, he moves

Waiting is not the only exit from a blocked situation. Two others are
observable, and one of them is enormous.

- **Traded away**: 53 of 962, 5.5%. Blockage does not predict it — stays
  behind a good cost-controlled incumbent left the organization at 5.3%
  against 4.9% for everybody else, not a real gap.
- **Changed position**: 154 of 458 hitters, **33.6%**, arrived in the majors at
  a different position than the one they played at Triple-A. 107 of them,
  **23.4%**, arrived further *down* the defensive ladder.

*(First draft, 864 stays: 6.1% traded, 36.1% changed position, 25.1% moved
down. The direction and the order of magnitude are unchanged; both position
figures came down a couple of points on the corrected cohort.)*

That second outcome is predicted by the job above him, and the direction is the
one blockage predicts and nothing else does.

Ladder order, hardest job to fill first: catcher, shortstop, centre field,
second base, third base, corner outfield, first base, designated hitter.

### Seen without a model

Share of hitters who changed position, by how many men already held the job:

| The job above him | Stays | Changed position | Moved down the ladder |
| --- | --- | --- | --- |
| One man owns it | 152 | 44.1% | 33.6% |
| Two share it | 152 | 30.9% | 25.0% |
| Three or more share it | 154 | 26.0% | 11.7% |

And the two corners of the sample:

| Situation | Stays | Changed position |
| --- | --- | --- |
| One veteran past his control window owns the job | 57 | 40.4% |
| A shared job held by cheap young men | 88 | 19.3% |

### The confound, and what survives it

Depth and the ladder are entangled by construction. Corner outfield is two
slots, so depth there is high by definition, and it sits near the bottom of the
ladder, so there is nowhere to fall. Catcher is one slot at the top.

| Position | Stays | Median depth | Changed | Moved down |
| --- | --- | --- | --- | --- |
| C | 61 | 2 | 9.8% | 9.8% |
| SS | 72 | 1 | 47.2% | 47.2% |
| CF | 66 | 2 | 36.4% | 36.4% |
| 2B | 45 | 2 | 40.0% | 26.7% |
| 3B | 67 | 2 | 41.8% | 28.4% |
| COF | 98 | 4 | 23.5% | 7.1% |
| 1B | 46 | 2 | 39.1% | 10.9% |

The confound is real. The finding survives it, essentially unchanged.
Refitting "moved down the ladder" with a fixed effect for every position:

| Term | Odds ratio | p |
| --- | --- | --- |
| Years of control left on the incumbent | 0.091 | 0.0002 |
| Men already sharing the job | 0.689 | 0.0113 |
| Incumbent's age | 0.847 | 0.0091 |
| Parent club winning percentage | 1.67 per .100 | 0.0034 |
| How the incumbent is playing | 1.297 | 0.076 |

McFadden 0.226, against 0.146 for the model without position controls.
*(First draft: 0.096 / 0.638 / 0.850 / 1.66-per-.100 / 1.163, McFadden 0.228
vs. 0.109 — the corrected fit lands on essentially the same story.)*

Two further tests:

**Lagging.** Measure the job the season *before* the stay begins, so the
prospect's own readiness cannot have caused it. This is the one place the
third bug above (only two of six job terms were ever actually being lagged)
changes a real claim, not just a number. **With position held fixed AND the
job genuinely lagged, nothing survives except the unreliable quality term**:
control years OR 0.843 (p = 0.77), depth OR 0.827 (p = 0.21), age OR 0.983
(p = 0.77), win pct OR 3.62 (p = 0.43) — none of the terms this section
originally reported as surviving actually do, once the lag is real and
position is controlled at the same time.

Drop the position controls and depth's temporally-lagged effect on
*whether* he changes position at all (not specifically down the ladder)
comes back strongly on its own: OR 0.698, p = 0.0001. So the honest
statement is narrower than the first draft's: **depth measured a season
early predicts a future position change in general**, robustly; it does not,
on this cohort, clear significance for the more specific *moved-down* outcome
once position is also held fixed — a stricter test that the smaller,
lagged, position-split sample may simply be underpowered for. **The
control-years effect does not survive true lagging under any specification**,
which was the first draft's claim too and is the one part of this section
that holds up unchanged.

**The placebo.** Moving *up* the ladder should show nothing, because blockage
has no reason to produce it. The three terms the first draft checked still
show nothing: control years p = 0.96, depth p = 0.09, incumbent age p = 0.88.
One wrinkle the corrected cohort surfaces that the first draft did not check:
incumbent quality is significant in this placebo (OR 1.54, p = 0.011), and
also turns up significant in the lagged moved-down model (OR 1.44, p = 0.013)
where it was not significant unlagged. Quality is the least stable term in
every specification here — see caveats.

**Inside a single position**, where no positional arithmetic can operate at
all, splitting each position at its own median depth: 35.2% of men behind a
settled job changed position (n = 330), against 28.0% behind a shared one
(n = 125). A 7.2 point gap, the right way round, on 455 stays. *(First draft:
38.0% vs. 29.4%, an 8.6 point gap on 424 stays — same direction, a touch
smaller.)*

## What could not be priced

**The cost of the move.** For the 325 hitters with six full seasons of WAR on
the record: controlling for the prospect's own line, age, draft tier and era,
moving down the ladder is worth −2.26 WAR over six seasons and **it is not
significant** (p = 0.14). Neither is changing position at all (+1.31,
p = 0.35). *(First draft, n = 302: −2.08 WAR p = 0.16, +1.53 WAR p = 0.27 —
same null, same direction.)*

So the probability that a blocked prospect gets moved can be priced. What that
move costs him cannot, on this sample. That is the honest limit, and it is the
next ask rather than this one.

**How common blockage is.** One man owns the job in 33.2% of hitter stays; the
incumbent is past his control window in 40.0%; both conditions hold at once in
**12.4%**. Real blockage is a minority situation, which is most of the reason
it never moved the pooled waiting number. *(First draft: 31.4% / 40.0% /
11.7% — unchanged in substance.)*

## Two smaller nos

**No service-time cliff.** The classic manipulation is holding a man three
weeks into April to bank an extra year of control. Stays ending in the first 21
days of April: 105. Stays ending in the following 20 days: 98. Flat.
*(First draft: 89 vs. 81.)*

**The calendar beats the job.** Stays end in September 189 times and in August
181 times, against 158 in April. Roster expansion opens more doors than any
description of who is standing in them. *(First draft: 184 / 173 / 135.)*

## New in this pass: what actually ended the stay

The first draft inferred "why did this stay end" only from the level change
itself. This pass joins the real transaction wire (`join-txn.mjs`,
`pull-txn.mjs`) to every stay, matched on each transaction's own `date` field —
an earlier attempt matched on `effectiveDate` instead and it can point at an
unrelated later resolution (one Selected transaction's `date` was 3 days before
the debut it explains; its `effectiveDate` was seven months later). Switching
the match key took the match rate from 659 of 962 to 946 of 962.

For every stay, the prospect's own transaction near the stay's end is read off
the wire, and — when he was promoted — the incumbent's status in the three
weeks before is checked for an injury, a DFA, a trade, a release, or a waiver
claim that could explain why the job opened.

| Why the stay ended | Stays | Share |
| --- | --- | --- |
| Merit — promoted, no roster-rule signal on the incumbent | 573 | 59.6% |
| Roster rule — incumbent DFA'd/traded/released/waived, or a September call-up | 187 | 19.4% |
| Injury — the incumbent hit the IL in the three weeks before | 137 | 14.2% |
| Settled earlier — he was already on the roster well before this "debut"; the roster decision predates the stay's own end | 27 | 2.8% |
| Demoted — the stay ended in a further assignment down, not a promotion | 20 | 2.1% |
| Unresolved — no matching transaction in the window | 16 | 1.7% |
| Traded — the prospect himself changed organizations | 2 | 0.2% |

Read plainly: three in five Triple-A stays end in a clean merit promotion with
no roster-rule or injury signal attached at all. Roster rule and injury
together explain a bit under a third — genuinely more than the crude
"traded away" 5.5% figure above ever captured, and a real, transaction-verified
number rather than an inference from level alone. "Settled earlier" is its own
small, honest finding: for 27 stays, the man was already on the active or
40-man roster well before the date this cohort calls his "debut," meaning the
roster decision this whole study is trying to explain had already been made
earlier, for a different reason, and the debut date is not the event.

### Does the exit reason change the waiting answer?

It does not. Restricted to only the 573 clean merit promotions — the subset
where blockage has the clearest shot at mattering, since nothing else is
plausibly forcing the timing — the job above him still buys essentially
nothing: dR² = 0.0036, F(6,561) = 0.39. Adding the exit reason itself as a
control to the full 962-stay model, instead of subsetting to it, kills every
job term outright (depth's own coefficient goes to exactly 0.0000): the exit
reason and the job description are measuring so much of the same thing that
putting both in a model together leaves nothing distinct for the job terms to
explain. Either way of asking, the answer holds.

### A joint model, so "traded" and "position change" cannot borrow each
other's significance

The waiting/position-change/traded outcomes above were each fit on their own,
which risks one outcome's apparent significance actually being shared
variance with another — a prospect who changes position and one who gets
traded are not independent events competing for the same roster spot. Fitting
all three together as one three-way outcome (stayed / traded / changed
position, n = 458 hitters, McFadden = 0.114) checks this directly.

**The position-change result is unaffected.** Every term — control years left
(OR 0.225, p = 0.0052), depth (OR 0.753, p = 0.0018), incumbent age (OR 0.848,
p = 0.0018), incumbent quality (OR 1.363, p = 0.0094), win pct (OR 25.6,
p = 0.024) — comes out essentially identical to the independent binary fit.
This is the strongest robustness check this study has run on its headline
"yes," and it passes cleanly.

**The "traded" side is where it matters.** Fit on its own, incumbent depth
looked like it predicted a trade (OR 1.48, p = 0.017 in an earlier pass not
shown in this document). Fit jointly against position change, it drops to
marginal — OR 1.36, p = 0.067. Some of what looked like "a crowded job
predicts a trade" was shared variance with "a crowded job predicts a position
change," not two independent effects. The trade result was never a headline
claim of this study and this does not change the "no" on waiting; it is
recorded here because it is exactly the kind of thing a joint model is for
catching.

## Reading the names

The most blocked situations the join found, checked by eye because a join this
deep can be wrong in a way no p-value shows — the same five the first draft
found, still present on the corrected cohort:

- **Austin Riley**, Atlanta 2019, third base at Triple-A, corner outfield in the
  majors. Josh Donaldson had third base.
- **Ryan Rua**, Texas 2014, third base to corner outfield. Adrián Beltré had
  third base.
- **Joshua Fuentes**, Colorado 2019, third base to first. Nolan Arenado had
  third base.
- **José Miranda**, Minnesota 2022, third base to first.
- **Mike Tauchman**, Colorado 2017, centre field to a corner. Charlie Blackmon
  had centre field.

These are textbook blocked prospects, and the method found them without being
told who they were.

## Where the work lives

`.scratch/blockage/` in the worktree, not app code:

| File | What it does |
| --- | --- |
| `pull-mlb.mjs` | MLB fielding, hitting and pitching season splits, 2008–2024 |
| `pull-milb-field.mjs` | Triple-A fielding, 2008–2023 — the prospect's position at the time |
| `build.mjs` | Joins a stay to the job above it, writes `stays.json` |
| `hydrate-incumbents.mjs` | Incumbent debut dates, for the service clock |
| `lib.mjs` | OLS and logistic fits, lifted from `org-regression.mjs` |
| `model.mjs` | The question as asked. Writes `findings.json` |
| `deepen.mjs` | The position outcome and what it costs. Writes `deepen.json` |
| `confound.mjs` | Position fixed effects and the within-position split |
| `check.mjs` | The waiting model given every advantage, plus named cases |
| `pull-txn.mjs` | Pulls and caches the season transaction wire, 2008–2024 |
| `join-txn.mjs` | Joins the wire to every stay's end. Writes `exits.json` |
| `diag-lagged-waiting.mjs` | Throwaway, not part of the pipeline — the falsification checks behind "the one asterisk" above. Re-run it to reproduce those numbers; nothing downstream reads its output. |

Reuse the caches before re-pulling. `mlb-cache.json`, `milb-field-cache.json`
and `txn-season-cache.json` are the expensive part and all three resume.

## Caveats

- Everybody in this study reached the majors. The prospect who was blocked so
  badly he never got there is invisible here, and he is the case the whole
  idea is about.
- The position a man "plays" is taken from where he started the most games. A
  debut season of twenty games is a thin reading.
- The contract effect is concurrent only, per the lag test above.
- The cost of a position change is estimated, not established — the
  confidence range includes zero and a great deal worse.
- Left and right field are treated as one job, so the position-change rate is
  a floor, not a ceiling.
- Triple-A stays before 2009 do not exist in this data at all.
- Incumbent quality is the least stable term in this study — significant with
  the wrong sign among pitchers in the waiting model, significant in the
  moved-UP placebo where nothing else is, and significant in the lagged
  moved-down model where it was not significant unlagged. Every other term
  here (control years, depth, age, win pct) tells a consistent story across
  every cut; quality does not, and no claim in this document rests on it.
- The exit-classification breakdown is new and verified against the wire; it
  has been cross-checked against the waiting model (merit-only subset, and
  exit reason added as a control — see "New in this pass") but not against
  the position-change or WAR-pricing models.
- The lagged-depth waiting-time signal ("the one asterisk") is real by
  conventional significance and survives outlier removal, but fails this
  study's own falsification test and is left as an open, unexplained pattern
  rather than a finding — see that section for the full reasoning. Nothing
  else in this document depends on it.
