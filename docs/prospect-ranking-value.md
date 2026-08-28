# What a top-100 prospect ranking is worth, in dollars

Every prospect finding in this repo stops at a promotion or at WAR. This pass
asks the question the farm pages imply and have never answered: what does a
place on MLB Pipeline's Top 100 turn into, in money?

**Read the cohort paragraph before any number below it.** Survivorship runs
through this whole question, and the way the groups are drawn decides the
answer.

| # | Question | Answer | Verdict |
|---|---|---|---|
| 1 | How many ranked prospects amount to nothing? | Far fewer than the folklore says. 12 of 372 never reached the majors | Holds |
| 2 | What does one rank position buy, and where does the curve bend? | It bends hard. One place costs 26% at rank 5 and 1.6% at rank 95 | Holds |
| 3 | Do hitters and pitchers pay off differently? | No. This is the first trait in this research that does not split | Holds (null) |
| 4 | Does a ranking add anything to what the minor-league record already says? | Yes, but under one percent of the variance | Holds |
| 5 | Does the level-trend percentile predict earnings? | Cannot be asked. The data does not reach a historical cohort | No-ship |

Scripts are in `.scratch/prospect-value/`. The panel is `panel.json`, every
number here comes out of `findings.json`, and both rebuild without this
session.

## The cohort, and the trap it is built around

Prospects are ranked **before** they debut. The rank file starts in 2009. The
debut cohort starts in 2005. So for a man who debuted in 2006, the seasons he
could have appeared on a list are simply not in the file. He is **absent**, and
absent is not the same fact as unranked. Coding him as an unranked zero would
read "no list exists for that year" as "this man was not good enough to be
listed", and every early-cohort figure would be wrong in a way that looks
completely plausible.

The panel therefore measures a **ranking window** for each man and records
whether the window is observed. The window is the six seasons from four before
his debut to one after it, because a rookie-eligible man stays on the list for a
season after he arrives. That window is measured, not assumed: it catches
**98.1%** of the 699 ranked men who have a debut date, and `panel.mjs` throws if
a rebuilt rank file drops the capture rate below 95%.

Three groups come out of it. Counts are of the 3,060-man debut cohort.

| group | what it means | n | of whom ranked |
|---|---|---|---|
| **observed-deep** | the whole window sat inside a published top-100 list (debuts 2016–2023) | **1,398** | 331 |
| **observed-shallow** | the whole window has a list, but at least one is a top-50 list (debuts 2013–2015) | **483** | 117 |
| **censored** | the window reaches into 2005–2008, where no list exists (debuts 2005–2012) | **1,179** | 116 |

**Only observed-deep is used for a ranked-versus-unranked comparison.** The
1,063 unranked-looking men in the censored group are *unobserved*, not unranked,
and they never enter one. The observed-shallow group is reported separately: a
man who would have ranked 51st to 100th in 2010 reads as unranked there, which
is a depth undercount rather than a gap.

**What the trap would have cost, measured rather than asserted.** Pool the
censored group in as though its men were unranked and the headline ratio reads
**3.24**. Draw the groups honestly and it reads **2.40**. The trap overstates
the value of a ranking by 35%.

### The ranked population, which is the survivorship-free one

The debut cohort can only ever answer a narrower question, because every man in
it reached the majors. The population defined **at ranking time** is the honest
one: **757** men appeared on a list between 2009 and 2024. **564** of them are
in the debut cohort, 79 debuted in 2024 or later, 55 debuted but never cleared
the app's rookie threshold, one debuted before 2005, and **58 never reached the
majors at all**. Those 58 carry genuine zeroes and are never dropped.

The rank-curve population is the 372 men **first ranked between 2009 and 2016**,
so that every one of them has had the same ten seasons of chances. **49 of the
372 earned nothing**, and they are carried as zeroes.

### The one man the cohort cannot see

`buildCohort()` returns 3,060 of the 3,061, because `raw.json` gives one player
no stat group. That player is **Shohei Ohtani**, who is also a ranked prospect
and the highest-paid one of the era. He is in the panel through the rank file,
he carries his own `group: 'two-way'`, and he is excluded from both sides of the
hitter-pitcher split rather than being filed as a hitter by accident. He is not
in the rank-curve population — he was first ranked in 2018.

### Depth is not 100 every year

2009, 2010 and 2011 are top-50 lists. 2020 and 2021 stop at 99. Every other year
is 100. Depth is read per season from `seasons.json`, never assumed. Rank 45
means the same thing on a top-50 list as on a top-100 list — 45th best — so
pooling by rank is sound; what the short years lack is any observation of ranks
51 to 100. The curve is refitted on the deep years alone in the robustness
block, and the slope moves from −0.648 to −0.595.

**2005 to 2008 do not exist in this data.** Those four seasons return an empty
page from the source and are recorded `status: "unavailable"`, not as zero. A
third-party file could supply them; that is issue #946 and it is deliberately
deferred.

## The money, and how it is counted

Career earnings are summed per `mlbId` from `salaries.csv` through the identity
crosswalk, with three rules that are not optional:

- **Front-office rows leave through `resolveRole()`, never the position cell.**
  23 rows are club executives. 27 more carry a front-office title while the man
  was still playing — Robin Ventura reads "mgr" in 2000 through 2003 while
  playing third base — and filtering on the cell would delete real player pay.
- **A non-numeric salary is a status, not a number.** 3,974 rows carry no
  salary figure. They contribute no dollars and enter no denominator.
- **`rowKey` is a positional index.** The crosswalk is aligned to the CSV by
  position, and `panel.mjs` asserts the alignment row by row rather than
  trusting it. If a row ever moves, the build throws.

**Dollars are indexed, not deflated.** Consumer prices are the wrong ruler for a
labour market that grew far faster than they did. Every figure is restated in
2025 league-average-salary terms using `salaries_summary.csv`'s own average for
its season: a 2005 dollar counts 2.081, a 2015 dollar 1.207, a 2025 dollar 1.000.
Nominal dollars are carried beside the indexed ones and change nothing.

**Earnings stop at 2025.** 2026 is an announced season, not a paid one.

**Windows are strictly truncated.** Every man in the rank curve is measured over
the same ten seasons, beginning with the one he was first ranked in. 38.3% of
the population's career-so-far dollars fall outside that window, which is the
point: without the truncation a 2009 name would be compared against a 2016
name's shorter career.

### What a zero in this file actually means, which is the caveat that matters

`salaries.csv` is a **salary roster** of roughly 870 to 970 men a season, not a
payroll ledger. Test it against a population that indisputably drew
major-league pay — the debut cohort, every man of whom cleared 130 at-bats or 50
innings — and **10.3% of them have no salary row at all**. Among men with three
or more major-league seasons it is still 7.2%.

**And the miss is not even.** Inside the observed-deep group, 4.8% of ranked men
have no salary row against **12.8%** of unranked men. Some of that gap is real —
an unranked man is more marginal, so he is likelier to be the short-service man
a roster snapshot never lists — but the rest is a file gap, and a file gap coded
as a zero pushes the unranked median down and inflates every ratio below.

Two consequences, both carried through the whole document:

1. **"Never earned a major-league salary" is not measurable from this file.** It
   is reported twice: once from the authoritative fact (statsapi says the man
   never debuted) and once from the file (no salary row). The second is an upper
   bound on the first, not a measurement of it.
2. **Every ranked-versus-unranked ratio is reported as a range**, once with the
   missing men carried as zeroes and once with them dropped from both sides. The
   true answer sits between the two.

---

## 1. How many ranked prospects amount to nothing?

The honest version of this question does not touch `salaries.csv` at all. "Never
debuted" comes from statsapi's own `mlbDebutDate`. "Cleared the rookie
threshold" is membership of the debut cohort. Population: the 372 men first
ranked 2009 to 2016, so the youngest has had nine full seasons.

| peak rank | n | never debuted | debuted, below the threshold | cleared it |
|---|---|---|---|---|
| 1–10 | 69 | 0 | 0 | **69 (100%)** |
| 11–25 | 75 | 0 | 4 | 71 (94.7%) |
| 26–50 | 110 | 6 | 12 | 92 (83.6%) |
| 51–75 | 66 | 2 | 6 | 58 (87.9%) |
| 76–100 | 52 | 4 | 9 | 39 (75.0%) |
| **all** | **372** | **12 (3.2%)** | **31 (8.3%)** | **329 (88.4%)** |

**The bust rate is far lower than the folklore.** 88.4% of top-100 prospects
become real major leaguers, and **every one of the 69 men who peaked in the top
ten did**. Not one of them missed. The failure is concentrated at the bottom of
the list, where a quarter of the 76-to-100 band never got a real career.

The file-based version, on the wider population of 474 men first ranked 2009 to
2018: 18 (3.8%) never reached the majors, and 60 (12.7%) never appear in
`salaries.csv`. The 42-man gap between those two figures is the roster gap
above, not 42 men who played for nothing.

## 2. The curve, and where it bends

Population: the 372 men first ranked 2009 to 2016. Earnings over the ten seasons
from the first ranking, indexed to 2025.

| peak rank | n | earned nothing | median | 95% interval on the median | mean | 90th percentile |
|---|---|---|---|---|---|---|
| 1–10 | 69 | 1 | **$33,140,787** | $28.7M – $45.3M | $48.6M | $114.5M |
| 11–25 | 75 | 6 | $21,351,570 | $5.6M – $33.1M | $34.0M | $83.9M |
| 26–50 | 110 | 18 | $7,605,829 | $4.4M – $13.4M | $21.9M | $67.9M |
| 51–75 | 66 | 13 | $5,537,022 | $2.3M – $11.0M | $23.0M | $72.0M |
| 76–100 | 52 | 11 | **$2,763,785** | $1.2M – $15.3M | $16.3M | $47.3M |

A top-ten prospect earns **twelve times** the median of a man ranked 76th to
100th. The ordering is monotone across all five bands and the rank correlation
is −0.343.

**The curve is not a line.** A model in the logarithm of rank beats a model
linear in rank (AIC 655.4 against 659.1), and once the log term is in, the
linear term adds nothing (p = 0.48). Reading one step down the list off the
fitted curve:

| at rank | cost of one place further down | at that band's median |
|---|---|---|
| 5 | **25.8%** | −$8,547,021 |
| 30 | 4.9% | −$368,856 |
| 95 | 1.6% | −$43,049 |

Sliding from 5th to 6th costs about as much as sliding from 95th to 111th would,
if the list went that far. The gap between 1 and 10 is nothing like the gap
between 90 and 100.

**Read the R² out loud, because it is the deflationary half of this finding.**
Peak rank explains **7.7%** of the variance in what a man earns. It moves the
average a great deal and predicts the individual barely at all. A club deciding
about one player learns much less from his rank than this table's medians
suggest.

### Which side of the hurdle the rank works on

Splitting the question in two — whether a man earns anything, and how much he
earns once he does:

- **Whether**: R² = 0.040, slope −0.063 per log rank, p = 0.00008.
- **How much, among the 323 who earned anything**: R² = 0.116, slope −0.213,
  p = 9 × 10⁻¹¹.

Rank predicts **the size of the career better than it predicts the existence of
one**. That is the opposite of the intuition, and it follows from finding 1:
almost everyone on the list gets there, so there is little variation left in
"whether" for rank to explain.

### Where the money sits

The 69 men who peaked in the top ten are 18.5% of the population and take
**31.4%** of its $10.68 billion. The top 25 are 38.7% of the men and 55.3% of the
dollars. Ranks 51 to 100 — 118 men, 31.7% of the population — take 22.2%.

## 3. Peak rank beats first-appearance rank, and the number of years adds nothing

| measure | rank correlation with earnings | R² on its own |
|---|---|---|
| peak rank | **−0.343** | 0.077 |
| rank at first appearance | −0.288 | 0.043 |
| number of seasons ranked | −0.023 | — |

Put peak rank and first-appearance rank in together and first appearance falls
away (p = 0.68). Add the number of ranked seasons to peak rank and it does
nothing (p = 0.84). **The best number a list gives you is the highest a man ever
got, and nothing else the list records adds to it.** Appearing five years
running is not evidence of anything beyond how high you climbed.

## 4. Hitters and pitchers do not split

This is the first trait in this research that does not.

| | n | earned nothing | median | mean | 90th percentile | slope on log rank |
|---|---|---|---|---|---|---|
| hitters | 200 | 24 | $14,580,277 | $31.4M | $81.8M | −0.640 (p = 7 × 10⁻⁶) |
| pitchers | 172 | 25 | $12,883,451 | $25.5M | $68.2M | −0.647 (p = 0.0012) |

The two medians are $1.7M apart on figures whose intervals overlap almost
completely, and a rank-sum test says nothing: **p = 0.16** across the whole
population, **p = 0.12** inside the top 25 where the groups are most comparable.
The slopes are within 0.007 of each other. **A ranked hitter and a ranked pitcher
at the same place on the list are worth the same money.**

The pitcher's R² is lower (0.058 against 0.092), which is the one real
difference: rank tells you slightly less about a pitcher than about a hitter,
even though it tells you the same thing on average.

A caution the earlier trait work earns the right to: the pitchers' outcome
ladder is a little worse (86.0% cleared the threshold against 90.5%), so
attrition does differ. It is the **money** that does not.

## 5. What a ranking adds to the minor-league record

Population: the 839 of the 849 observed-deep men with six complete seasons of
earnings (debuts 2016 to 2020) who carry both development measures. Both are
computed off the back of a baseball card, with no transaction record anywhere
near them.

| measure | rank correlation with six-year earnings |
|---|---|
| age relative to his level | −0.301 |
| seasons from first professional season to debut | −0.250 |
| age at debut | −0.301 |

Being young for your level is worth real money, and so is arriving quickly. Put
all three in one model and each keeps its own effect: age relative to level
p = 0.011, seasons to debut p = 0.0019, having been ranked p = 0.0050.

**But a ranking adds under one percent.** Its incremental R² over the two
development measures is **0.0089**. Knowing that a man was on the Top 100
improves a guess about what he will earn by less than one percent, once you
already know how old he was for his level and how fast he moved.

### The ranked-versus-unranked comparison itself

Debut cohort only, so it answers "among men who made it, what did a ranking
add", not "what is a ranking worth". Observed-deep window only.

| horizon | ranked | unranked | ranked median | unranked median | ratio |
|---|---|---|---|---|---|
| 3 seasons | 331 | 1,067 | $1,258,239 | $755,764 | 1.66 |
| **6 seasons** | **209** | **640** | **$5,356,195** | **$2,228,597** | **2.40** |
| 9 seasons | 90 | 265 | $13,350,613 | $2,589,988 | 5.15 |

The ratio grows with the horizon, which is what team control predicts: the first
three years are priced by the rule book, not the market, so almost nobody can
separate from anybody. The gap opens when arbitration and free agency arrive.

Drop the men with no salary row from both sides and the six-season ratio falls
from 2.40 to **2.14**. **Quote the range, not the point.** The split by group
runs the same way as everything else here: hitters 3.21, pitchers 1.68, both
strongly significant.

## 6. What could not be measured

**The level-trend percentile is not available for any historical cohort, and it
is dropped rather than approximated.** `public/data/prospect-trend.json` is a
snapshot of the current season — `dataThrough` reads 2026-08-28 — holding 732
active minor leaguers. Its overlap with the 3,061-man debut cohort is **exactly
0 players**, and with the 757 ranked men **exactly 23**, all of them men still in
the minors today. The file is a weekly snapshot, not an archive. Measure 3 of the
spike brief cannot be asked of this data at all.

## Robustness

**Leave one ranking season out.** The curve was refitted eight times, dropping
one first-ranking season each time. It held **8 of 8**, with the slope between
−0.693 and −0.615 against a full-population −0.648, and p below 4 × 10⁻⁶ every
time.

**Leave one debut year out.** The ranked-versus-unranked comparison was refitted
five times. It held **5 of 5**, ratio between 2.31 and 2.49.

**Every variant of the curve.** All eleven keep a negative, significant slope.

| variant | n | slope | p | R² |
|---|---|---|---|---|
| headline | 372 | −0.648 | 3 × 10⁻⁸ | 0.077 |
| deep list years only (drops the top-50 years) | 262 | −0.595 | 0.00016 | 0.052 |
| top-50 list years only | 110 | −0.669 | 0.00016 | 0.117 |
| identity-collision ids removed | 372 | −0.648 | 3 × 10⁻⁸ | 0.077 |
| men who earned nothing dropped | 323 | −0.213 | 9 × 10⁻¹¹ | 0.116 |
| nominal dollars | 372 | −0.643 | 3 × 10⁻⁸ | 0.077 |
| 2020 prorated to 60/162 | 372 | −0.646 | 3 × 10⁻⁸ | 0.077 |
| untruncated career-so-far dollars | 372 | −0.659 | 1 × 10⁻⁸ | 0.081 |
| men who never reached the majors dropped | 360 | −0.527 | 1 × 10⁻⁶ | 0.063 |
| hitters only | 200 | −0.640 | 7 × 10⁻⁶ | 0.092 |
| pitchers only | 172 | −0.647 | 0.0012 | 0.058 |

Two of those rows are findings rather than checks. Dropping the men who earned
nothing cuts the slope from −0.648 to −0.213, which is the hurdle split above
seen from the other side. Dropping the men who never reached the majors cuts it
to −0.527: **the survivorship error is worth about a fifth of the effect**, and
it runs in the direction the trap warns about.

**The 2020 season.** `salaries.csv` records the **contracted** 2020 salary, not
the roughly 37% of it a 60-game season actually paid: the file's 2020 total is
$3,987,209,077 against $3,887,858,407 in 2019, plainly the same scale. It
distorts every man in that season identically, so it cannot bend the rank curve,
and prorating it to 60/162 moves the slope by 0.002. It does overstate a career
total, and any single dollar figure quoted here carries that.

**The identity collisions.** 21 player-seasons have two men sharing one
`mlbId` — twelve real homonym pairs that must never be merged, nine wrong fuzzy
matches in the contract crosswalk. **Zero of them fall in the rank-curve
population**, so the refit is bit-identical. They are flagged in the panel, not
repaired: repairing them belongs in the admin workbench.

## What did not hold

Stated with the same prominence as what did.

1. **Hitters and pitchers do not split on money.** Every earlier trait pass
   found they split; this one does not, at p = 0.16.
2. **Rank explains under 8% of the variance.** The band medians are dramatic and
   the individual prediction is weak. Anyone quoting the twelve-times figure
   about one player is misusing it.
3. **A ranking adds under 1% over the minor-league record.** Age relative to
   level and speed to debut already carry almost all of it.
4. **Nothing on the list beyond peak rank matters.** Not the first-appearance
   rank, not the number of years listed.
5. **The level-trend percentile could not be measured at all**, on a population
   overlap of exactly zero.
6. **"Never earned a salary" is not measurable from `salaries.csv`.** The file
   misses 10.3% of proven major leaguers, and it misses unranked men at nearly
   three times the rate of ranked ones.

## Caveats

- **The debut cohort is selected on reaching the majors.** Every
  ranked-versus-unranked figure answers the narrower question. The
  survivorship-free population is the ranked one, and it has no unranked
  comparison group by construction — nobody publishes a list of men who were not
  on the list.
- **The censored group is 1,179 men, more than a third of the debut cohort, and
  it is excluded from the main comparison rather than fixed.** Issue #946 would
  fix it.
- **The ten-season window still censors on the right.** A man first ranked in
  2016 is measured through 2025; his highest-paid seasons may be ahead of him.
  The truncation makes the men comparable, not complete.
- **`careerIndexed` restates dollars in league-average-salary terms.** That is a
  choice. It says a 2005 dollar was worth 2.081 of a 2025 dollar *to a
  ballplayer*, which is not what it was worth at a shop.
- **A ranking is not a treatment.** Nothing here is causal. A man is ranked
  because scouts already believe he will be good, so the ranking and the
  earnings share a cause and the finding cannot separate them.
