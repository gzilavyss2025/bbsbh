# Prospect traits: the player, not the club

The three passes before this one all asked about **organizations** — how long a
stay at a level takes, whether some clubs move men faster, whether a club that
leans on its own players promotes slower. This pass turns the question around
and asks about the **player**: what he looks like, what he throws, what he had
already won, and what he did once he got there.

Five questions, run against the same cohort the earlier work used.

| # | Question | Answer | Verdict |
|---|---|---|---|
| 1 | What do good MLB rookie seasons share, in the minors? | The two ways of defining "good" disagree, and the traits split with them | Holds |
| 2 | Does size lengthen or shorten a stay in the minors? | Not for hitters. For pitchers, unusual in either direction costs time | Holds |
| 3 | Do handedness, mix or velocity change promotion? | Velocity buys innings, not calendar. Mix, nothing. Left-handers, a little | Holds |
| 4 | What month do top prospects debut? | The pattern is the award calendar, not the promotion calendar | Not shippable |
| 5 | What do the final four have in common in their farms? | They produce more major leaguers. Count, not quality | Holds |

Scripts are in `.scratch/prospect-traits/`. The findings, written for a reader
who does not want a p-value, are on `/admin/research`.

## The cohort

The same 3,061 players as `docs/team-movement-windows.md`: every MLB debut from
2005 through 2023 that cleared the app's own rookie threshold (130 AB or 50 IP,
career), so the September cup of coffee stays out. 3,060 after dropping the one
player with no stat group. 1,370 hitters, 1,690 pitchers.

Reused unchanged from the earlier passes, rather than rebuilt:

| Cache | What it carries |
|---|---|
| `level-benchmarks/raw.json` | per-player MiLB `yearByYear`, sportIds 11–14 |
| `level-benchmarks/milb-cohort-cache.json` | every MiLB team-season, sportIds 11–16 |
| `level-benchmarks/dates.json` | wire-resolved level durations, post-debut rows dropped |
| `level-benchmarks/homegrown-cohort.json` | first professional org and entry level |
| `level-benchmarks/perf-pool.json` | level-season peer pools, the full population |
| `level-benchmarks/homegrown-panel.json` | 600 org-seasons with homegrown share |
| `public/data/war-history/` | per-season MLB WAR, 2010–2025 |

Four caches are new (`.scratch/prospect-traits/pull.mjs`): `bio.json` (height,
weight, bat side, throwing hand), `awards.json` (every award each player ever
won, 21,375 rows), `mlb.json` (MLB `yearByYear`, for the rookie season) and
`arsenal.json` (rookie-season pitch mix and velocity, pitchers only).

`lib.mjs` builds one player table for all five questions. Every rule in it is
borrowed rather than invented: the level reconstruction is `analyze.mjs`'s
`reconstruct()`, the draft tiering is its `draftTier()`, and the corrected draft
round is `homegrown-lib.mjs`'s `draftInfo()` — which exists because `raw.json`'s
own `ped.draftRound` reads `drafts[0]` and therefore files Aaron Judge as a
31st-round high-school pick.

### The ruler problem, again

Every duration in the earlier work came off the transaction wire, and the
standing notes on `/admin/research` list what that costs: the wire barely exists
before 2009, there was no 2020 season, and a big leaguer riding the shuttle
leaves a trail that looks like a prospect climbing.

This pass leans on a **wire-free clock** wherever it can:

- `seasonsToDebut` — calendar seasons from the player's first professional
  season (any of the six MiLB levels) to his debut season.
- `totalVolume` — plate appearances or innings accumulated before the debut.

Both come off the back of a baseball card. No transaction record goes near
them, so no transaction-record problem can reach them. Wire-dated days are
still reported as a third opinion, and are trusted least.

---

## 1. Above-average rookie seasons

`q1-rookie-traits.mjs`, `q1b-confounds.mjs`.

### Which season, and what counts as good

The **rookie season** is the one containing `rookieUntil` — the date the player
crossed 130 AB / 50 IP and stopped being a rookie. That is the app's own
definition and the season a Rookie of the Year ballot covers. It is not always
the debut season: 1,009 of the cohort exhaust their eligibility in the year they
debut, 1,236 in the next year, and a long tail take up to nine. The headline
spec requires the gap to be two years or less.

**Above average** is defined two ways, and keeping both is the first finding:

- **Rate** — OPS against the same season's league OPS for hitters, ERA against
  the same season's league ERA for pitchers, both scaled so 100 is average and
  higher is better. Asks *did he play well?*
- **WAR** — FanGraphs season WAR ≥ 2.0, an everyday regular's worth. Asks *was
  the season worth something?*

Cohort for both: debuts 2010–2023 (WAR starts at 2010), 2,059 players; 1,673
with enough playing time in the rookie season to grade a rate (150 PA / 40 IP).

### The two definitions disagree

|  | WAR ≥ 2 | WAR < 2 |
|---|---|---|
| **Rate ≥ 100** | 206 | 607 |
| **Rate < 100** | 27 | 833 |

They agree on 62% of players. Almost every 2-WAR rookie also cleared the rate
bar (206 of 233); only a quarter of the rate-clearers reached 2 WAR. WAR is the
strictly harder bar, and the traits that separate the two groups are **not the
same traits**.

### What separates them

Standardized difference `d` between the above-average and below-average groups,
p from a Mann-Whitney U with a tie correction, q from Benjamini-Hochberg across
the fourteen traits tested in each comparison.

**Hitters, by rate** (345 above, 439 below):

| Trait | Above | Below | d | q |
|---|---|---|---|---|
| AA+AAA OPS | .830 | .780 | 0.57 | <0.0001 |
| Peer percentile at last level | .78 | .64 | 0.54 | <0.0001 |
| **Weight** | 215 lb | 202 lb | 0.49 | <0.0001 |
| **Height** | 73" | 72" | 0.35 | <0.0001 |
| Seasons to debut | 4 | 4 | −0.15 | 0.098 |

**Hitters, by WAR** (142 above, 810 below):

| Trait | Above | Below | d | q |
|---|---|---|---|---|
| AA+AAA OPS | .830 | .800 | 0.48 | <0.0001 |
| Total MiLB PA | 1,224 | 1,520 | −0.43 | <0.0001 |
| Peer percentile at last level | .82 | .68 | 0.46 | <0.0001 |
| Seasons to debut | 3 | 4 | −0.41 | <0.0001 |
| Age at debut | 23.8 | 24.3 | −0.33 | 0.0008 |
| Triple-A PA | 250 | 337 | −0.24 | 0.010 |
| Weight | 210 lb | 206 lb | 0.11 | 0.379 |

Size is the second-largest separator of a good **rate** line and nothing at all
for **WAR**. Speed through the system is the reverse.

**Pitchers, by rate** (453 above, 412 below): fewer total innings (−0.39),
fewer Triple-A innings (−0.24), better peer percentile (0.29), better AA/AAA ERA
(−0.31), less likely to have reached Triple-A at all (−0.21).

**Pitchers, by WAR** (81 above, 1,002 below): fewer seasons to debut (−0.57),
younger at debut (−0.40), fewer levels used (−0.42), lower walk rate (−0.33).

### The two confounds, chased down

**The pitcher age paradox.** The first pass says an older pitching debutant
posts a *better* rate line and a *worse* season by WAR. Both cannot be a fact
about age. It is role:

| | n | median debut age | median ERA+ | median WAR |
|---|---|---|---|---|
| Starters | 462 | 24.1 | 93–98 | 0.5–0.8 |
| Relievers | 636 | 25.3 | 108–128 | 0.2 |

With start share in the model the age term on rate collapses (+1.56 → −1.88,
both n.s.) while start share carries −13.3 points of ERA+ per SD (p<0.0001) and
+0.243 WAR per SD (p<0.0001). Relievers debut later, post gaudy ERAs in 50
innings, and are worth almost nothing.

**Hitter size and position.** OPS+ is position-blind, so "bigger hitters hit
better" could just be "corner players hit better than middle infielders". It is
not. With position group in the model:

| Term | β (per SD) | p |
|---|---|---|
| Height | −0.44 | 0.449 |
| **Weight** | **+3.49** | **<0.0001** |
| Corner (vs C) | +9.19 | <0.0001 |
| Middle (vs C) | +4.48 | 0.007 |

And within position group, in terciles:

| Group | light | middle | heavy |
|---|---|---|---|
| C | 200 lb → 92 | 220 lb → 94 | 235 lb → 94 |
| Middle | 180 lb → 91 | 195 lb → 93 | 210 lb → 97 |
| Corner | 195 lb → 98 | 215 lb → 103 | 230 lb → 105 |

It is **mass, not stature**. Height contributes nothing once weight is in.
And it is worth only 0.111 WAR per SD (p=0.052) — a heavy corner outfielder
gives back at the other end of the game what he adds with the bat.

---

## 2 and 3. The body and the arm

`q2-size.mjs`, `q2b-size-robustness.mjs`, `q3-pitchers.mjs`.

### Testing "above or below the average" literally

The question as asked is not "does bigger move faster". It asks whether being
**unusual in either direction** costs a player time. That is a U, not a slope,
and a linear term cannot see it. Every model is run three ways: `z`, `z + z²`,
and `|z|`.

Size is standardized **within position group** — a 6'4" pitcher is ordinary and
a 6'4" second baseman is not, so a league-wide z-score would only re-measure
position.

### Seasons from the first professional season to the debut

| Term | Form | β | p |
|---|---|---|---|
| Height | linear | +0.069 | 0.034 |
| Height | \|z\| | −0.048 | 0.364 |
| Weight | linear | +0.014 | 0.653 |
| Weight | z² | +0.069 | 0.001 |
| **Weight** | **\|z\|** | **+0.174** | **0.001** |
| BMI | \|z\| | +0.149 | 0.003 |

A U on weight, no U on height. Pooled, in bands:

| Weight, vs the position average | n | mean seasons to debut |
|---|---|---|
| below −1.5 SD | 176 | 4.43 |
| −1.5 to −0.5 | 674 | 4.28 |
| −0.5 to +0.5 | 1,346 | **4.02** |
| +0.5 to +1.5 | 610 | 4.20 |
| above +1.5 SD | 217 | 4.37 |

The same table on height is flat: 4.18 / 4.23 / 4.17 / 4.08 / 4.20.

### It is entirely a pitcher effect

| Cut | \|zWeight\| | p |
|---|---|---|
| everybody | 0.174 | 0.0007 |
| drop pitchers | 0.085 | 0.243 |
| pitchers only | **0.257** | **0.0003** |
| catchers only | 0.108 | 0.557 |
| middle infield / centre only | 0.113 | 0.379 |
| corners only | 0.071 | 0.490 |

Pitchers in quintiles: 190 lb → 4.28 seasons, 205 → 3.86, 215 → 3.96,
225 → 4.11, 240 → 4.43. The most unusual tenth of the whole cohort by weight
takes 4.39 seasons against 4.12 for everyone else — about a third of a season.

**It concentrates in the recent era**, which is the caveat that matters most:
2005–2011 → 0.115 (p=0.19), 2012–2017 → 0.076 (p=0.42), 2018–2023 → 0.308
(p=0.0003).

### Handedness, velocity, mix

443 left-handers, 1,223 right-handers (26.6%).

Raw, left-handers reach the majors at essentially the same pace. But they throw
**1.7 mph slower** (median 91.7 against 93.4, p<0.0001) — a gap of about
two thirds of a standard deviation. Hold velocity and role constant and the
left-hander's edge appears:

| Model | lefty β (seasons) | p |
|---|---|---|
| seasons ~ lefty | −0.108 | 0.286 |
| seasons ~ lefty + role | −0.079 | 0.429 |
| **seasons ~ lefty + velocity + mix + role** | **−0.224** | **0.042** |

**Velocity is measured in the MLB rookie season and this is a real limitation,
not a shortcut.** Double-A and below have never carried pitch tracking; Triple-A
only got Hawk-Eye in the 2020s (`scripts/gen-pitch-arsenal.mjs`). There is no
measurement of what a 2014 prospect threw at Double-A and there never will be.
Everything below is an association measured after the promotion it is about.

Velocity is standardized within the rookie season — the league four-seamer went
from 91.0 mph in 2008 to 94.2 in 2024, and without that correction this would
mostly re-measure the calendar. Within-season SD is 2.55 mph.

| Band | n | median FB | entry age | mean seasons to debut | median MiLB IP | median debut age |
|---|---|---|---|---|---|---|
| bottom 10% | 142 | 87.9 | 21.5 | 4.22 | 318 | 25.4 |
| 10–30% | 264 | 90.5 | 21.0 | 4.27 | 343 | 25.0 |
| middle 40% | 633 | 93.0 | 21.0 | 4.11 | 277 | 24.7 |
| 70–90% | 287 | 94.9 | 21.0 | 4.01 | 230 | 24.2 |
| top 10% | 131 | 97.1 | 20.0 | 4.41 | 200 | 23.9 |

Innings fall almost monotonically and debut age falls monotonically, while
calendar seasons do not move. The hardest throwers sign youngest — 48% of the
top decile entered professional ball at 19 or younger, 44% never went through a
draft at all — so they spend the same number of summers in the minors and far
fewer innings. Modelled: **−12.9% of minor-league innings per SD of velocity**
(p<0.0001) and **−0.40 years of debut age per SD** (p<0.0001).

**Mix does nothing.** Repertoire size, breaking-ball share and offspeed share
all fail once role is in the model (p = 0.54, 0.80, 0.11). Repertoire looks like
it matters on its own (−0.082 seasons per pitch, p=0.094) only because starters
throw more pitches than relievers.

**Velocity does not explain the weight U.** With velocity in the model the
`|zWeight|` term is unmoved: 0.162 → 0.161 (p=0.001), on the identical subset.

---

## 4. Debut month

`q4-debut-month.mjs`, `q4b-month-checks.mjs`.

### Pedigree from the award shelf

There is no historical top-100 list in this repo — the app's own prospect
snapshot begins 2026-07-07, which is no use for a man drafted in 2013. What does
reach back is the award record. Each player's honors won **before his debut** are
sorted into four tiers:

| Tier | What it is | Types | Pre-debut wins |
|---|---|---|---|
| A | National Player/Pitcher of the Year, MiLB Gold Glove, Futures Game MVP | 12 | 99 |
| B | Futures Game selection, Baseball America and Topps level all-star teams, AFL Rising Stars, a league's own MVP/POY/ROY | 116 | 2,452 |
| C | League mid-season and post-season all-star teams | 45 | 3,994 |
| D | MiLB.com Organization All-Star | 1 | 1,386 |

Weekly awards are excluded on purpose (a player of the week is a hot fortnight,
and there are 26 a season per league). Winter ball, independent ball and the
WBC are excluded as not being minor-league pedigree. 149 wins across 42 types
remain untiered and are printed by the script rather than hidden.

### The whole cohort

| Mar | Apr | May | Jun | Jul | Aug | Sep | Oct |
|---|---|---|---|---|---|---|---|
| 1.9% | 20.0% | 15.6% | 14.8% | 12.4% | 16.0% | 19.0% | 0.3% |

Bimodal, with a July trough. And both humps are front-loaded within their month:
of 613 April debuts, 62.5% land in the first half; of 580 September debuts,
**76.4% land in the first fifteen days** — 297 in the first week alone.

### The finding that did not survive

Sorted by tier, decorated prospects appeared to debut **later** — tier B at
17.1% in April and 18.3%/20.3% in August/September, against 23.2% April and
12.6% August for men with no honors at all (X²=35.4, df=20, p=0.018).

It is an artifact of the award calendar. **A Futures Game selection is played in
mid-July, so a man picked for it in 2019 was by definition still a minor leaguer
in mid-July 2019 — he cannot appear in the April 2019 column.** The award
forbids the very month the finding says he avoids.

Re-tiering on honors won in **strictly earlier seasons**, where nothing about
the award constrains the debut month, the finding evaporates:

| Test | Original rule | Prior seasons only |
|---|---|---|
| chi-square across tiers | p = 0.018 | **p = 0.188** |
| decorated vs undecorated, Mar/Apr | — | 20.5% vs 22.0%, p = 0.40 |
| decorated vs undecorated, Aug/Sep/Oct | — | 34.8% vs 38.6%, p = 0.08 |
| decorated vs undecorated, first half | — | 52.4% vs 50.3%, p = 0.36 |

### What does survive

The calendar, not the pedigree. April week by week: 226 / 144 / 90 / 153 —
a heavy Opening Day week, a decline, then a modest uptick in the last nine days
(17.0 a day against 12.9 in the third week). That is the only trace of anything
resembling service-time management anywhere in the data, and it is thin.

September share of all debuts fell from 19.6% (2005–2019) to 16.6% (2021–2023)
after roster expansion shrank from 40 men to 28 — though 2019, the last
40-man September, was itself the lowest year in the run at 12.0%, so the change
does not read cleanly off the rule.

Working backwards from the Futures Game: median gap from a man's last selection
to his debut is 323 days. 32% debut within 90 days, 41% the next season, 27% two
or more seasons later.

---

## 5. The final four

`q5-final-four.mjs`.

600 club-seasons, 2004–2023. 80 reached a Championship Series, 194 reached the
postseason. Farm measures are compared as **within-season percentiles among the
thirty clubs**, since every one of them drifts across twenty years.

| Measure | Final four | Everyone else | p |
|---|---|---|---|
| Homegrown share of the roster | 0.542 | 0.494 | 0.173 |
| Own graduates debuting that year | 0.513 | 0.498 | 0.682 |
| **Own graduates, trailing 5 years** | **0.599** | **0.485** | **0.0013** |
| Their rookie WAR, trailing 5 years | 0.549 | 0.492 | 0.113 |
| Promotion speed (− faster) | 0.448 | 0.508 | 0.088 |
| Winning percentage | 0.853 | 0.446 | <0.0001 |

In raw units: a median of **26 graduates against 23** over five years.

It survives the control that matters — a club reaching a Championship Series won
a lot of games first:

| Model | graduates OR/SD | p |
|---|---|---|
| final four ~ graduates | 2.25 | 0.0004 |
| final four ~ graduates + winning | 1.86 | 0.024 |
| final four ~ everything + winning | 2.83 | 0.001 |

Leave one club out, thirty refits: OR ranges 1.41 to 2.28, significant in 27 of
30. The weakest is dropping Houston (OR 1.41, p=0.23), who went to nine
Championship Series in twenty years off a below-median farm output.

Across the thirty clubs, final-four appearances correlate with graduates per
five years at **r = 0.481** (p=0.007) and with homegrown share at only
r = 0.241 (p=0.20).

### Count, not quality — and one artifact

WAR per graduate points the *wrong* way with winning controlled (OR 0.42,
p=0.001). That is a **collider**, not a discovery: winning is caused both by the
rookies and by everybody else, so holding the record fixed forces the two to
trade off. Without the winning control the same term is neutral (OR 1.09,
p=0.70). The negative sign is an artifact of the control and is reported as one.

What is left is that the **count** of major leaguers a club raises separates the
final four and the quality of them does not.

### Falsification

If graduate count really builds October teams it should also show up in the
berth — the part a club controls. It does: `made the postseason ~ graduates`
gives OR 1.67 (p=0.002). With winning in the model the win term swamps
everything (OR 8,446) and the graduate term goes to p=0.48, which is what a
near-deterministic predictor does to its neighbours rather than evidence
against the finding.

The honest reading is not "producing players wins pennants". It is that
producing a lot of major leaguers is a symptom of a good organization, and good
organizations reach the final four. Homegrown *share* — the measure the earlier
pass showed wins no games — separates nothing here either.

---

## What is missing from all of it

- **Everybody in this cohort reached the majors and stuck.** Nothing here can
  say a trait *makes* a prospect. The men who had the same trait and washed out
  at Double-A are invisible, and they are the ones a causal claim would need.
- **Listed weight is a current listing, not a measurement taken at the time.**
  For a player who retired in 2014 it is whatever he was last listed at. Height
  barely moves after 18; weight does. The Q2 ruler was read at the wrong time
  and no amount of checking inside this data repairs that.
- **Velocity and mix are measured after the promotion they are about.** See
  above; the data to do it properly does not exist for these players.
- **An award is partly a restatement of "he was good"**, since performance in
  the minors is what earns both an award and a promotion. The tiers are not an
  independent read on pedigree.
- **No park factors.** The rate measures are crude OPS+ and ERA+ against the
  raw league line, which flatters a Coors hitter and punishes a Petco one.
- **No historical payroll**, the same gap the earlier passes carry. A club that
  raises 26 major leaguers in five years may simply be a club that could not
  afford to buy any.
