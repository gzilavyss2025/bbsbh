# Pricing the blockage

The research behind the first ask in the front-office reading of the prospect
stack (`src/lib/research/diary/frontOffice.js`, PR #901): *for every Triple-A
stay, describe the job above the man — who holds it, how he is playing, how
many years he is signed for, whether he can be moved. Then ask whether that
description predicts the length of the stay better than the prospect's own line
does.*

The answer to the question as asked is **no**, and the no is robust. The
answer to the question underneath it is **yes** — but the blockage is not paid
in waiting. It is paid in position.

## The cohort

962 Triple-A stays, from the 967 that the level-tenure benchmark's date
resolution already produced (`docs/level-tenure-benchmark.md`,
`.scratch/level-benchmarks/dates.json`). Stays run 2009 to 2023 — the
transaction wire has no usable coverage before 2009, so the arrival dates do
not exist earlier.

Five stays were dropped for want of a parent organization, and one because the
parent club had nobody at all at the prospect's position that season.

864 of those 962 carry everything the waiting model needs. The gap is
explained below and is itself a finding.

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
appeared in the majors. The two disagree on 15.5% of stays and no result below
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
| Calendar days | 162.5 | 56 to 361 |
| Days inside a season | 106 | 51 to 180 |

Every model below was run both ways. Nothing turns on the choice.

## The answer to the question as asked: no

Outcome `log(days)`, predictors the prospect's own rate line, his age, his
draft tier and the era. Volume is deliberately excluded — plate appearances at
a level are mechanically a function of days spent there, so putting them in
would be close to predicting the outcome with itself.

| Specification | R² his line | R² plus the job | The job buys |
| --- | --- | --- | --- |
| All stays, season days | 0.0882 | 0.0970 | 0.0089, F(6,848) = 1.39 |
| All stays, calendar days | 0.0933 | 0.1041 | 0.0108, F(6,848) = 1.70 |
| Job measured a season earlier | 0.0882 | 0.0918 | 0.0036, F(6,848) = 0.56 |
| Hitters only | 0.1365 | 0.1414 | 0.0049, F(6,420) = 0.40 |
| Pitchers only | 0.0589 | 0.0788 | 0.0199, F(6,414) = 1.49 |
| Hitters, position held fixed | 0.1584 | 0.1686 | 0.0102, F(5,407) = 1.00 |

None of these is significant. The single term that reaches p < 0.05 anywhere —
incumbent quality, among pitchers — carries the **wrong sign**: a better man
above him predicts a *shorter* stay. It disappears when the job is measured the
season before the stay begins, which is what a contaminated concurrent
measurement does and what a real effect does not.

The falsification cut agrees. Blockage that is real should bite hardest at
catcher, shortstop and centre field, where the job is one slot and the skill
does not transfer, and should be near zero in a bullpen that turns over every
year. Split five ways, nothing is significant anywhere.

**The job above the man does not predict how long he waits.** That result holds
under both outcomes, under lagging, split by player group, split by position
scarcity, and with position held fixed.

## The answer underneath: he does not wait, he moves

Waiting is not the only exit from a blocked situation. Two others are
observable, and one of them is enormous.

- **Traded away**: 53 of 864, 6.1%. Blockage does not predict it. Stays behind
  a good cost-controlled incumbent left the organization 5.8% of the time
  against 5.5% for everybody else.
- **Changed position**: 154 of 427 hitters, **36.1%**, arrived in the majors at
  a different position than the one they played at Triple-A. 107 of them,
  **25.1%**, arrived further *down* the defensive ladder.

That second outcome is predicted by the job above him, and the direction is the
one blockage predicts and nothing else does.

Ladder order, hardest job to fill first: catcher, shortstop, centre field,
second base, third base, corner outfield, first base, designated hitter.

### Seen without a model

Share of hitters who changed position, by how many men already held the job:

| The job above him | Stays | Changed position | Moved down the ladder |
| --- | --- | --- | --- |
| One man owns it | 134 | 50.0% | 38.1% |
| Two share it | 143 | 32.9% | 26.6% |
| Three or more share it | 150 | 26.7% | 12.0% |

And the two corners of the sample:

| Situation | Stays | Changed position |
| --- | --- | --- |
| One veteran past his control window owns the job | 50 | 46.0% |
| A shared job held by cheap young men | 83 | 20.5% |

### The confound, and what survives it

Depth and the ladder are entangled by construction. Corner outfield is two
slots, so depth there is high by definition, and it sits near the bottom of the
ladder, so there is nowhere to fall. Catcher is one slot at the top.

| Position | Stays | Median depth | Changed | Moved down |
| --- | --- | --- | --- | --- |
| C | 59 | 2 | 10.2% | 10.2% |
| SS | 66 | 1 | 51.5% | 51.5% |
| CF | 63 | 2 | 38.1% | 38.1% |
| 2B | 40 | 2 | 45.0% | 30.0% |
| 3B | 61 | 2 | 45.9% | 31.1% |
| COF | 95 | 4 | 24.2% | 7.4% |
| 1B | 40 | 2 | 45.0% | 12.5% |

The confound is real. The finding survives it. Refitting "moved down the
ladder" with a fixed effect for every position:

| Term | Odds ratio | p |
| --- | --- | --- |
| Years of control left on the incumbent | 0.096 | 0.0005 |
| Men already sharing the job | 0.638 | 0.0032 |
| Incumbent's age | 0.850 | 0.0154 |
| Parent club winning percentage | 1.66 per .100 | 0.0046 |
| How the incumbent is playing | 1.163 | 0.31 |

McFadden 0.228, against 0.109 for the model without position controls.

Two further tests:

**Lagging.** Measure the job the season *before* the stay begins, so the
prospect's own readiness cannot have caused it. Depth survives and strengthens
(odds ratio 0.618, p = 0.0015). Winning percentage survives (p = 0.0028).
**The contract term does not survive** — odds ratio 0.840, p = 0.68. The
control-years effect is concurrent only, and cannot be claimed as causal.

**The placebo.** Moving *up* the ladder should show nothing, because blockage
has no reason to produce it. It shows nothing: control years p = 0.78, depth
p = 0.16, incumbent age p = 0.93.

**Inside a single position**, where no positional arithmetic can operate at all,
splitting each position at its own median depth: 38.0% of men behind a settled
job changed position, against 29.4% behind a shared one. An 8.6 point gap, the
right way round, on 424 stays.

## What could not be priced

**The cost of the move.** For the 302 hitters with six full seasons of WAR on
the record: men who stayed at their position averaged 4.77, men who changed
averaged 4.14, men who moved down the ladder averaged 3.80. Controlling for the
prospect's own line, age, draft tier and era, moving down is worth −2.08 WAR
over six seasons and **it is not significant** (p = 0.16). Neither is changing
position at all (+1.53, p = 0.27).

So the probability that a blocked prospect gets moved can be priced. What that
move costs him cannot, on this sample. That is the honest limit, and it is the
next ask rather than this one.

**How common blockage is.** One man owns the job in 31.4% of hitter stays; the
incumbent is past his control window in 40.0%; both conditions hold at once in
**11.7%**. Real blockage is a minority situation, which is most of the reason it
never moved the pooled waiting number.

## Two smaller nos

**No service-time cliff.** The classic manipulation is holding a man three
weeks into April to bank an extra year of control. Stays ending in the first 21
days of April: 89. Stays ending in the following 20 days: 81. Flat.

**The calendar beats the job.** Stays end in September 184 times and in August
173 times, against 135 in April. Roster expansion opens more doors than any
description of who is standing in them.

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

Reuse the caches before re-pulling. `mlb-cache.json` and `milb-field-cache.json`
are the expensive part and both scripts resume.

## Reading the names

The most blocked situations the join found, checked by eye because a join this
deep can be wrong in a way no p-value shows:

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
