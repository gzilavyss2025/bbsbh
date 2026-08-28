# Arbitration pay, and does BP WARP agree with MLB's own WAR?

Research spike, 2026-08-28 (W3.1). Question: what does an arbitration figure
actually track, where do file-and-trial cases land, and — the durable part —
does Baseball Prospectus's WARP agree with MLB's own sabermetrics WAR when
both describe the same player-season?

**The file covers nine seasons only: 2018-2026.** `scripts/data/contracts/arbitration.csv`
has no row before 2018 (`docs/contracts-data-caveats.md`). Every number below
states its own n; several are far smaller than the file's 2,420 rows once a
blank cell or an unresolved identity is excluded, and every exclusion is
named, never silent.

**A naming caution that applies to every number in Part One and Part Two.**
Most of these rows are SETTLEMENTS, negotiated before a hearing, not a
panel's decision. A panel decides only the handful of cases that actually go
to a hearing, and this file does not say which rows those are. Read every
figure below as "what the case settled at," never as "what a panel pays for."

Panel: `.scratch/contracts/arbitration-warp-panel.json` (2,420 rows, one per
CSV row). Built by `.scratch/contracts/build-arbitration-warp.mjs`. Analysis:
`.scratch/contracts/analyze-arbitration.mjs`, numbers cached in
`.scratch/contracts/arbitration-findings.json`. No network call — every input
was already checked into the repo.

## The platform-year trap

`arbitration.csv`'s `season` column is the decision year, not the year
played. `prior_warp`, `prior_salary` and `mls` all describe the season
BEFORE it — the "platform year." `scripts/gen-contracts-identity.mjs`'s own
arbitration branch says this in code: `lookupSeason = season - 1 // roster
lookup at the season the "prior year" columns describe` (ADR-0066).

The identity crosswalk (`public/data/contracts-history/identity/arbitration.json`)
also carries a `matchedSeason` field, and it is tempting to treat that as the
platform year — do not. `matchedSeason` records which season's ROSTER the
name resolver matched the row's claimed club against, purely to confirm the
right `mlbId`. It answers "which team-season pool proved this is the right
man," not "which season does `prior_warp` describe." A trade, or a season
the player didn't appear in the majors at all, pushes the match to a
different season without changing what `prior_warp` itself measures.
Checked directly: of 2,420 rows, `matchedSeason` disagrees with the true
platform year (season − 1) on 210 rows (8.7%), and every sampled case in
that 210 either carries a blank `prior_warp` ("-"/"dnp" — the player did not
play the platform season at all) or `mls` ≥ 5 with a between-season trade.
**This panel uses `season − 1` unconditionally as the platform year.
`matchedSeason` is carried into the panel for reference only.**

`career_warp` is BP's cumulative figure through the same platform year. It
is compared here to a same-window cumulative sum of MLB WAR — bat WAR plus
pitching WAR, since a two-way player carries both entries
(`src/api/war.js`).

## Part One — what gets paid

**n = 1,717** of 2,420 rows: settled at a plain single-year dollar figure
(1,843 rows), AND carrying a numeric prior salary (2,276 of 2,420 do — 141
are blank), AND carrying a numeric prior-year WARP (2,319 of 2,420 do — 101
read "-", "dnp" or blank, almost always because the player did not appear in
the platform season at all).

A log-linear regression of the settled dollar figure on service time (`mls`),
log(prior salary), prior-year WARP and career WARP:

| predictor | coefficient (log dollars) | p | holds across all 9 leave-one-season-out refits? |
| --- | --- | --- | --- |
| service time (`mls`) | −0.011 | 0.42 | same sign in 9/9, never significant in any |
| log(prior salary) | +0.545 | <0.0001 | significant in 9/9 |
| prior-year WARP | +0.142 | <0.0001 | significant in 9/9 |
| career WARP | +0.036 | <0.0001 | significant in 9/9 |

R² = 0.79. **Prior salary dominates, and service time drops out once prior
salary is in the model** — not a data problem, a real null. Service time and
prior salary correlate at r=0.57 (raw dollars) / r=0.73 (log dollars)
"by construction": arbitration is a formula-driven system where a player's
service class already set his prior salary, so `mls`'s own effect is already
baked into `priorSalary` before the regression ever sees it. All four
variance-inflation factors sit at 2.0-3.3 — real but not severe
collinearity, and the model does not need `mls` dropped to stay stable.

**A concrete dollar reading**, from the same regression run in levels instead
of logs (R² = 0.90): each additional platform-year WARP win is associated
with about **$617,000** more in the settlement, holding prior salary and
career WARP fixed; each additional career WARP win (age/wear-and-tear held
fixed at that prior salary and platform performance) adds about **$100,000**.
Every dollar of prior salary carries forward almost one-for-one (+$1.08 per
prior dollar) once WARP is in the model — a raise is built on top of last
year's number, not computed from scratch.

**Does it differ by experience?** Split into four service-time bands
(2nd-3rd year, Arb1, Arb2, Arb3+ — floor(`mls`), n=197/681/508/331):

- R² climbs steeply with experience — 0.59 in the earliest band, 0.90 by the
  third-plus. Early-career pay is noisier relative to the model; veteran
  raises are close to mechanical.
- **Prior-year (platform) WARP stays a real, positive, significant driver in
  every band** (+0.15, +0.11, +0.15, +0.12 log-points, all p<0.0001) — what a
  player did last season keeps mattering the same way at every experience
  level.
- **Career WARP's effect does NOT stay positive, and it turns negative
  earlier than a smooth fade would predict.** It is a real, positive driver
  in the two earliest bands (+0.083 at 2nd-3rd year, +0.084 at Arb1, both
  p<0.0001), then flips to a small but STATISTICALLY SIGNIFICANT negative at
  Arb2 (−0.012, p=0.007), and settles at a non-significant near-zero by
  Arb3+ (−0.004, p=0.34). Read plainly: a young player's whole body of work
  still helps him beyond just his last season, but by the time he reaches
  his second arbitration year, an established veteran's career total stops
  adding money and even shows a small drag once his prior-year performance
  and prior salary are already accounted for — the market pays for what he
  did LAST year, not a lifetime ledger, once the ledger is long enough to
  read as "established" rather than "developing."

**Does it differ by position?** Pitchers and hitters look alike (R²=0.79 vs
0.81; every coefficient the same sign, similar magnitude) — no real split
here.

## Part Two — file and trial

Filed figures (a stated player request AND a stated club offer, both plain
numbers) exist on **198 of 2,420 rows (8.2%)** — close to, but measured
directly rather than assumed from, the ~9% blank-rate estimate in
`docs/contracts-data-caveats.md`. Of those, **158** also settled at a plain
single-year number.

**Three of the 158 are not real one-year settlements and are excluded before
anything else is measured.** A genuine settlement of a filed case — decided
by a panel or negotiated ahead of one — can only land at one of the two
filed numbers or between them; a panel's own rule is to pick exactly one
figure, never split the difference. Three rows land far outside that range:
Luis Severino (2019, 6.6x the gap between his ask and the Yankees' offer),
Aaron Nola (2019, 3.0x) and George Springer (2018, 1.75x). The CSV's own
`note` column reads "signed 4-year extension" and "4-year extension" for the
first two; Springer carries no such note but shows the identical signature
and is public record as a multi-year deal agreed the same month. All three
priced an extension, not that year's arbitration question, and
`parseMoneyCell`'s extension-keyword detection does not catch them because
the `settled_salary` cell itself holds a plain number, not the "X y/$Y extn"
shape. **Excluded by the objective range rule, not by looking up who they
were** — the rule would catch any future case shaped the same way.

**On the clean 155:** the settlement sits, on average, almost exactly at the
midpoint between the two filed figures (mean 0.484, median 0.500 on a 0=club
offer, 1=player request scale). But the average hides the real shape: it is
NOT a smooth compromise distribution. **63 of 155 (41%) settled exactly at
the club's own number, and 57 of 155 (37%) settled exactly at the player's
own number** — only 35 (23%) landed strictly in between. Once both sides
file, a case is much more likely to end with one side simply accepting the
other's figure than with a genuine split.

**Do some clubs sit closer to their own number?** The raw club means spread
from 0.14 (Washington) to 0.79 (Houston) among clubs with at least 5 filed
cases across the nine years — but a permutation test on the between-club
variance (12 clubs, 98 rows, 20,000 shuffles) comes back p=0.11. **We cannot
tell.** Nine years across thirty clubs is thin enough that the spread in the
table is indistinguishable from what random assignment alone would produce.
No club is named as an outlier here — a name attached to an n of 4-13 over
nine years is not a finding.

## Part Three — WARP against WAR (the durable part)

**Restricted to `exact`-confidence identity matches only** (2,297 of 2,420
rows — fuzzy or unresolved matches risk joining the wrong man's MLB WAR onto
a player's WARP line before the correlation is even computed). A robustness
check against exact+fuzzy together (2,292 rows) moves the correlation by
0.001 — the confidence-tier choice does not drive the result.

**They agree, strongly, and it holds up under every check run:**

| comparison | n | Pearson r | Spearman ρ | mean(WAR − WARP) |
| --- | --- | --- | --- | --- |
| platform-season | 2,207 | 0.868 | 0.806 | +0.05 |
| career-cumulative through platform year | 2,296 | 0.908 | 0.830 | +0.21 |

- **Stable across era.** Split the platform seasons into three three-year
  bands (2017-19, 2020-22, 2023-25): r = 0.892, 0.861, 0.855. No drift.
- **Stable under leave-one-season-out.** Excluding each of the nine platform
  seasons in turn moves r between 0.859 and 0.874 — no single season drives
  the result.
- **The units are comparable, with a small, real offset.** Regressing MLB
  WAR on BP WARP gives WAR ≈ 0.13 + 0.92 × WARP (R²=0.75). The near-1 slope
  says the two scales already measure the same thing at the same size; the
  small positive intercept and the modest mean gap (+0.05 platform-season,
  +0.21 cumulative) say MLB's own WAR runs a bit richer than BP's WARP,
  most visibly at the low end and compounding slightly over a career.
- **By side of the ball**: hitters agree slightly more in rank order than
  pitchers (Spearman 0.834 vs 0.773), though both Pearson figures sit close
  together (0.871 vs 0.857).
- **By position, a real but modest pattern**: on the infield and in center,
  MLB WAR runs above WARP on average — center field +0.22, shortstop +0.21,
  third base +0.15, right field +0.12 (n=93/121/107/70) — while first and
  second base run the other way (−0.13, −0.02, n=89/136). Catchers and both
  pitcher groups sit close to flat (catchers +0.02, left-handers +0.06,
  right-handers +0.01). Plausibly a
  defensive-value disagreement between the two systems at the more
  defensively demanding non-battery spots — not independently confirmed
  here, and offered as a lead, not a finding. (A seventh bucket, `INF`, runs
  even higher at +0.31, but n=7 — too small to read as anything.)

**Where they disagree most, and why: two-way players.** The single largest
gap in the whole dataset is Shohei Ohtani's 2022 platform season (his 2023
arbitration case): BP's `prior_warp` reads 3.5; MLB's own WAR reads 9.2 —
made up of 3.6 batting WAR and 5.6 pitching WAR. Checked directly: across
2,207 platform-season rows, exactly **one** carries a real, non-trivial WAR
total on BOTH sides of the ball (batting WAR ≥ 1 AND pitching WAR ≥ 1) —
Ohtani, and only him. Every other large single-row gap in the top-10 lists
(Trea Turner 2021, Vladimir Guerrero Jr. 2023, Marcus Semien 2018 and
similar) sits well inside normal year-to-year single-metric noise, not a
structural disagreement. **The two systems disagree most on exactly the one
player-shape neither is built to split credit for cleanly**, and that is a
known edge case, not a defect in either measure.

## What this does not settle

- **The `note` column carries a bare dollar number on 1,440 of 2,420 rows
  (59.5%)** — universally from the 2022 arbitration sheet onward, essentially
  never before 2022 (0 of 977 rows in 2018-2021). It is not one of the nine
  documented money columns and this spike did not parse it. It plausibly
  recovers 382 of the 577 rows with no usable `settled_salary` figure — a
  real lead for a future pass, not chased down here.
- **The Part Two club comparison is underpowered by construction**, not by a
  choice this spike made: nine years of MLB arbitration will never produce
  more than a few dozen filed cases per club, so "we cannot tell" is likely
  the honest answer for a long time, not just today.
- **The position-level WARP/WAR gap (shortstop and center field running
  hot, first and second base running cold) is reported as a lead.** It was
  not stress-tested with its own permutation test or era split the way the
  headline correlation was.
