# OVR: a 0-100 video-game rating for every player

**Status: spec updated 2026-10-07. No code exists yet.** The update takes in two
research reports and Gary's decisions on them. Part A (sources) is
`.scratch/ovr/findings-sources.md` in draft PR #1691. Part B (numbers) is
`.scratch/ovr/findings-numbers.md` in draft PR #1701. Both are unmerged. A number
marked "start value" is still a guess to tune. A number marked "data" comes from a
file. A number marked "decided" is Gary's call. A line marked **inference** is a
conclusion that no source or test states directly.

## The goal

Give each player a card in the style of a baseball video game: one big **OVR**
(overall) from 0 to 100, attribute bars that add up to it for a major leaguer, a
**POT** (potential) for prospects on the Top 100 list, and an arrow that shows how
the rating moved. It is a toy for clicking around. It is not a projection and not a
score, so it needs no seal (root `CLAUDE.md`: player pages are open surfaces,
ADR-0034). The plan below shows it on player pages only. The check that no ADR
forbids a rating on the lineup page is a comment on #1703.

The card layout, tier names and colors, the compare screen, and the rating-change
display are not part of this spec. They are in issue #1703.

## One band for every level

All levels share one 0-100 band, so an A+ player and a major leaguer compare
directly. A minor leaguer's OVR is his level-relative result, squeezed under a
ceiling for his level.

**Decided** ceilings:

| Level | OVR ceiling | Basis |
| --- | --- | --- |
| MLB | 99 | The scale top. |
| AAA | 58 | The anchor. Weakly supported (see below). |
| AA | 55 | Data: 0.91 of AAA's arrival share. |
| A+ | 45 | Data: 0.66 of AAA's arrival share. |
| A | 39 | Data: 0.50 of AAA's arrival share. |
| Rk / complex | 30 | Data: 0.26 of AAA's arrival share, from a separate pool. |

How part B derived them:

- **Cohort.** `docs/level-tenure-benchmark.md` holds 881 MLB debuts from 2019-2023.
  Every one of them reached the majors, so it has no denominator and cannot give
  "the share of a level's players who reach the majors" alone. It also excludes
  sportId 16, so it cannot support Rk at all.
- **Pools.** Part B added the denominator from the full level pools, 2009-2019:
  every player with a season line at the level (hitters 100 PA or more, pitchers 30
  IP or more) who had no MLB game before that season. A player counts as arrived
  when he later crosses the rookie threshold (`public/data/rookies.json`). The Rk
  row uses the Arizona and Gulf Coast leagues only, and it stands on that pool
  alone.
- **Shares (data).** AAA 33.1%, AA 30.3%, High-A 21.7%, A 16.5%, Rk complex 8.6%.
  The ordering and the ratios to AAA are data.
- **Share to points (inference).** The rule is
  `ceiling = 20 + (58 - 20) * share / share(AAA)`: the headroom above the floor
  scales with the share, and AAA is held at 58. This rule is part B's assumption.
  No file holds ground truth for current ability on the MLB scale. The absolute
  level swings 14 points on one definition choice, so trust the ratios and not the
  absolute.
- **A+ is 45, decided.** The earlier example "an A+ player tops out near 40" is
  replaced. All 12 variants in part B give 44 or more.

Known limits, stated as plain facts:

- The AAA anchor of 58 is weakly supported. Regulars with 0 to 1 WAR have a median
  draft OVR of 56 for hitters and 58 for pitchers, from a pool of Savant-qualified
  players that likely runs high.
- A stat-translation (MLE) study would test the ceiling rule. It is not on the
  build order.
- Share to arrive measures distance to the majors. **Inference:** it is closer to a
  POT-flavored number than a pure current-ability number.

## OVR for an MLB player

**Source.** `public/data/savant-percentiles.json` (read by
`src/api/savantPercentiles.js`). Savant already ranks each metric 0-100 against
the qualified pool, so this feature does no percentile math for these metrics. I
read the file on 2026-10-07. It holds these metrics, and no others:

- Hitters (612 players): `xwoba`, `ev`, `hardHit`, `brl`, `chase`,
  `sprintSpeed`, `batSpeed`, `squaredUp`, `swingLength`.
- Pitchers (703 players): `xera`, `k`, `bb`, `whiff`, `chase`, `fbVelo`,
  `hardHit`. No bucket uses pitcher `chase`.

For every metric, the percentile has the sign "higher is better" (part B checked
it against the raw values), so it feeds the curve unflipped.

**Percentile to rating.** Use a bell curve, as the scouting 20-80 scale does
([FanGraphs](https://blogs.fangraphs.com/?p=161314): 50 is average, about 10
points per standard deviation). Start value: percentile 50 maps to 60, and one
standard deviation is 12 points. So the 84th percentile is about 72, the 98th
is about 84, and the result is floored at 20 and capped at 99.

**Attribute buckets.**

| Bucket | Hitter metrics | Pitcher metrics |
| --- | --- | --- |
| Contact | `xwoba`, `squaredUp` | |
| Power | `ev`, `hardHit`, `brl`, `batSpeed` | |
| Speed | `sprintSpeed` | |
| Fielding | `fld` from `war.json` | |
| Stuff | | `whiff`, `k`, `fbVelo`, `hardHit` |
| Results | | `xera` |
| Control | | `bb` |

Each bar is the mean of its metrics' ratings. A bucket with no metric shows no
bar. Discipline (`chase`) is dropped for hitters: no bar and no bucket. Part B
found that it adds nothing once Contact is in (its correlation with wRC+ is 0.16
and its OLS coefficient is zero).

**Fielding (decided).** Use `fld` from `public/data/war.json` for every hitter, as a
percentile among hitters. The app ranks it, because `war.json` is not pre-ranked.
There is no generator change and no outs-above-average fetch in version one.

- `fld` is MLB's own season fielding runs above average, rounded to 0.1. It leaves
  out the positional adjustment, which is a separate field. It correlates 0.93 with
  Savant outs above average across 563 players (part A).
- It is a counting stat. A part-timer's near-zero value means few chances, not an
  average glove, and the file has no innings field. The playing-time floor for the
  rank is not set yet. Build step 6 must set it.
- **Inference (part A):** catcher `fld` leaves out most framing value. Part A did
  not check this against a framing source.
- Not in version one: Savant outs above average. The `oaa` column is already in the
  percentile CSV that `gen-savant-percentiles.mjs` fetches (254 of 612 hitters
  filled in part A's probe).

**Gap:** the pitcher side has no durability or arsenal-depth metric.

**Roll-up weights (decided).** Weights come from part B. Part B moved each earlier
weight about halfway toward an OLS fit on one season (n = 246 hitters, 325
pitchers, correlated predictors). **Inference:** treat them as direction and not as
exact values.

- Hitter: Power 22, Contact 33, Speed 17, Fielding 28. These are part B's
  20/30/15/25 with Discipline removed, rescaled to sum to 100. The rescaling is
  mine, not part B's.
- Pitcher: Stuff 30, Results 45, Control 25. These are part B's numbers.

If a bucket is missing, share its weight across the rest.

**Minimum data (decided).** A hitter needs the Contact and Power buckets. A pitcher
needs all three buckets. Reason: 366 of 612 hitters in the file have only
`sprintSpeed`, and 364 of 703 pitchers have only `fbVelo`. On one season, the rule
leaves 246 of 612 hitters and 339 of 703 pitchers. That is under half of the pool.
Prior seasons are the coverage fix.

**Roll-up spread (decided).** Averaging imperfectly correlated buckets squeezes the
band. On part B's one-season pool, hitter OVR has a standard deviation of 6.0 and
the top hitter is 78.4. Pitcher OVR has a standard deviation of 7.8. A single
metric has 12 by design. So stretch the deviation from the mean, about 2.0 for
hitters and 1.5 for pitchers, then cap at 99. This follows what EA did for
Madden 10: it widened attribute ranges
([Destructoid](https://destructoid.com/?p=39867); also the
[Madden 10 developer blog](https://www.osftw.com/news/293928/madden-nfl-10-blog-player-ratings-a-new-philosophy-a-new-era)).
A web search found both links, and only the search summary was read, not the
pages. Treat the claim as unchecked. Part B says the stretch restores a
standard deviation of 12 and does not change a correlation.

- The mean is 60, the curve's midpoint. This is my choice. On part B's pool the
  means are 59.7 (hitters) and 60.1 (pitchers).
- The factors 2.0 and 1.5 were measured on the old weights, with no Fielding
  bucket. They are start values.
- **Test first.** Before the module takes the stretch, write tests that FAIL
  without it: the roll-up's standard deviation on a fixture lands near 12, the
  result never passes 99, and the order of players does not change.
- The other option, a re-rank on the roll-up's own pool percentile, was not chosen.

**Calibration against `war.json` (part B, data).** The draft OVR tracks WAR and is
not WAR relabelled:

| OVR vs | n | Pearson r | Spearman |
| --- | --- | --- | --- |
| Hitters: WAR | 246 | 0.51 | 0.51 |
| Hitters: wRC+ | 246 | 0.61 | 0.60 |
| Pitchers: WAR per 200 IP | 325 | 0.77 | 0.71 |

The thresholds for "tracks" (Spearman 0.5 or more) and "relabelled" (0.9 or more)
are part B's judgment, so they are an **inference**. These numbers used the old
weights, with Discipline and no Fielding. They do not test the new weights.

- The weights come from one season, so no out-of-sample test exists until prior
  seasons are built.
- Hitter misses come from defense, which Fielding now addresses, and from results
  that differ from quality of contact. Part B would not try to fix the second:
  it is why expected stats exist.
- Pitcher misses come from home runs. None of the pitcher metrics counts them
  directly. **Inference:** WAR is FIP-based, so relievers with many home runs
  show the largest gaps.

**The Show.** MLB The Show gives every player a 0-100 overall, and reports say it
uses a three-year average of Statcast and advanced stats
([The Comeback](https://amp.thecomeback.com/gaming/mlb-the-show-23-player-ratings-released.html)).
Its formula and weights are not public, so this rating is ours. Say that on the
card. Do not use the word "official" or copy The Show's tier names.

**Career rating (decided direction).** The rating covers a player's whole career,
weighted for recency and adjusted with an age term (see below). One hot month should
not swing a rating. It includes minor-league career history.

- **Recency decay (start values).** Marcel-style weights of 5/4/3 on the last three
  seasons, plus a smaller tail for earlier ones. The weights and the tail are
  guesses to tune. `docs/season-score.md` already uses a Marcel-style baseline
  (prior three seasons weighted 3/2/1, regressed with 50 games of .500 baseball),
  so the idea has precedent here. Its weights differ from these.
- **Age term (decided form).** The fit is in `.scratch/ovr/age-shift/`
  (`findings-age-shift.md`, with the tables and scripts). It uses Savant percentile
  boards for 2015-2025 and birth dates from the stats API. Version one:
  - In the career blend, move older seasons to the player's current age with the
    smooth, centred age-shift table **for sprint speed and fastball velocity
    only**. Start values, in percentile points per year: fastball velocity +5.5 at
    age 21, +0.7 at 27, -1.7 at 31, -4.6 at 39; sprint speed +2.1, +0.2, -0.8, -2.1.
  - The other metrics get no blend shift. The gain is inside the noise. Bat speed,
    squared-up rate and swing length have 3 seasons and get no table.
  - Use an age term in POT for players 25 and under. How the POT term is computed
    is not decided.
  - Checked in the fit: a percentile is a rank inside each year's pool, so the shift
    is relative to peers and not absolute change. With 5/4/3 recency weights the
    shift barely changes the order of players (rank correlation 0.998 or higher). In
    a holdout test only fastball velocity improved (error 13.07 to 12.38).
  - **Inference:** the table is partly corrected for players who leave the board
    and for regression to the mean. It cannot confirm a peak age (the zero crossing
    is the sample mean age). Refit the start values when more seasons exist.
- **MLB seasons.** Savant percentile boards by year (see Prior seasons). The boards
  exist for 2015-2025 (checked in the age-shift fit). Bat speed, squared-up rate and
  swing length exist from 2023 only.
- **Minor-league seasons.** They enter through the level ceilings above, at a
  discount. Minor-league years have no Statcast (part A), so they use the
  level-relative stats percentile. **Gap:** the per-player minor-league season
  lines need a new fetch. Nobody has scoped it.
- **Career Fielding.** `public/data/war-history/` holds WAR per season only, not
  `fld`. A career Fielding bar needs a new per-season `fld` store, hand-run like
  `gen-war-history.mjs`. The playing-time floor is still set at build time.
  **Inference:** pooling seasons reduces the counting-stat noise.

**Prior seasons (decided).** `savant-percentiles.json` holds one season only. Prior
MLB seasons come from Savant's `percentile-rankings?year=` board for 2024 and 2025
(part A: 2025 has 617 hitters and 711 pitchers, 2024 has 606 and 696).

- Shard by `personId % 100`, with both seasons in each shard. One shard is about
  3 KB (the average; the largest is 5.2 KB), and a player page opens one shard. One
  flat file for both seasons is 296 KB, which would double what the page parses.
- A reader through `staticJsonBy`, then the career weighting.
- `public/data/war-history/` holds WAR only, with no Statcast percentiles. It
  cannot feed the buckets.
- **Inference:** a hand-run generator fits, like `gen-war-history.mjs`, because a
  finished season's percentiles do not change. Part A did not check whether Savant
  revises past-year ranks.
- This is on the critical path. It is the coverage fix for the minimum-data rule.

## OVR for a minor leaguer

Savant has no percentiles for most minor leaguers (`savantPercentilesFor`
returns null). The input is `public/data/prospect-trend.json`: a level-relative
OPS or ERA percentile, with sample size and weekly history. Its header says it is
the app's own number and not a major-league equivalent.

Rating = `20 + (ceiling - 20) * percentile / 100`, using the level ceiling above.
With the fixed floor of 20, a 97th-percentile A+ hitter is about 44.

**Level floor.** The floor stays fixed at 20 for now. The spec's formula floors every
level at 20, but part B's data (hitters by OPS, pitchers by ERA, ranked inside the
level-season) show a bottom-half AAA player reaches the majors 14.9% of the time and
a bottom-half A player 10.2%. **Inference:** if OVR is to mean the same thing at
every level, the floor should rise with the level. Part B did not model it. A
modelling task comes before the minor-league build step (see Build order).

**Bars (decided).** A minor leaguer's card shows OVR and POT only, with no
attribute bars. Rough bars from slash-line parts: not in version one.

## POT (potential)

The only potential signal on file is MLB Pipeline's Top 100 rank in
`public/data/top-prospects.json` (96 players at last read). It holds a rank and
no scouting grades. `docs/farm-index.md` already maps rank to a 20-80 future
value (FV) grade, so reuse that map and convert FV to the 0-100 band.

- **Decided:** POT shows only for players on the Top 100 list, from rank. Start
  values: ranks 1-5 are 90 and up, rank 100 is about 70.
- Everyone not on the list shows a dash, including MLB regulars. Do not invent a POT.

**No scouting grades found (part A).** The Top 100 page data has 96 rows and no
grade key. Two profile pages rendered in Chromium (rank 1, Made 815908, and rank 2,
Arias 808265) show no Hit, Power, Run, Arm, or Field value, and no network response
carried one. The statsapi draft endpoints carry prose blurbs and no parseable
grades, and the prospect hydrations return nothing extra. A UI string,
`prospects_scouting_grades_header`, exists on the page. **Inference:** Pipeline has
a grades template that fills for some players or at some times of year. Part A
checked two players, so "no grades anywhere" is not proven. FanGraphs "The Board"
was not checked.

**Known risk: MLB terms.** MLB's Terms of Use, prohibited use (xi), forbid using
"automated scripts to collect information from or otherwise interact with the MLB
Digital Properties". Part A reads this to cover the existing nightly Top 100 scrape
(`scripts/fetch-top-prospects.mjs`). That reading is an **inference**, not a legal
opinion. **Decided:** keep the scrape and do not change it. The clause stays here as
a known risk. A per-player scrape of the profile pages would widen it, and the spec
does not plan one.

**Known risk: MLB copyright notice.** The notice that statsapi responses link to
(`gdx.mlb.com/components/copyright.txt`) says: "Only individual, non-commercial,
non-bulk use of the Materials is permitted". **Inference:** its scope reaches the
statsapi data this app reads, not only the Top 100 page. Part A recorded it and
changed nothing. Record only, no action.

## Rating changes over time

- A nightly snapshot of each player's OVR and bars goes into a sharded file, for
  example `public/data/ovr-history/`, written by a new `scripts/gen-ovr.mjs`.
  The reader goes through `staticJson.js` (`src/api/CLAUDE.md`).
- `prospect-trend.json` already keeps weekly history for prospects. Reuse its
  weeks for the first version.
- How the card shows the change (the arrow and the season sparkline) is in #1703.

## Build order

1. Calibration against posted video-game ratings (time-boxed; see below). It runs
   first and must not block step 2.
2. Pure rating module with tests, test first: percentile-to-rating curve, bucket
   means, the stretch with the 99 cap, the minimum-data rule, missing-bucket
   handling.
3. Age-shift fit from Savant 2015-2025 (done; the form is decided, see Career
   rating).
4. Sharded prior-season store and reader (`staticJsonBy`), then the career
   weighting (recency decay, and the age shift for sprint speed and fastball
   velocity).
5. Per-season `fld` store, and the minor-league season-lines fetch. Both come
   before `gen-ovr.mjs`.
6. `gen-ovr.mjs` and MLB hitters and pitchers.
7. Floor modelling task, then minor leaguers with ceilings and POT. The task tests
   whether the floor should rise with level.
8. Rating history file and arrows (UI in #1703).

**Step 1: calibrate against posted ratings.** Treat posted video-game ratings as the
answer key. Use them to calibrate only. Do not copy or reproduce their numbers.

- (a) Fit posted attributes (Contact, Power, Speed, and so on) to posted OVR to
  recover the weights. One report says The Show's ratings are formula-driven
  ([The Comeback](https://thecomeback.com/gaming/mlb-the-show-23-player-ratings-released.html):
  "They depend on the numbers so there is no human element involved."), so the fit
  could be close. **Inference** from that one report, and unproven. The report gives
  no weights. The NBC Sports Bay Area article on The Show 20 states no formula, so it
  is not a source for this claim.
- (b) Fit each attribute to the Statcast percentiles we already have, to set the
  curve shape, the mean, and the spread, and to test the 2.0 / 1.5 stretch
  factors.
- (c) Optional: check the rank-to-future-value POT map in `docs/farm-index.md`
  against posted scouting grades.
- **Time box.** If no lawful data source is found, or the terms forbid use, record
  that and go on with this spec's own start weights.

What a quick web search found on 2026-10-07 (not a full survey):

- No Kaggle or GitHub dataset of The Show ratings paired with stats.
- An official public API for The Show was not confirmed. The spec names no
  endpoint.
- Possible third-party sources, all unchecked: the
  [ShowZone player database](https://showzone-payload.onrender.com/players),
  showdd.io, and the community tool
  [theshowutil](https://pypi.python.org/project/theshowutil/). Ranking articles
  list only a few top players.

Limits:

- **Known risk: fan-database terms.** The terms of use for any fan database are
  unchecked. Read them before any scraping. This is a third known risk beside the
  two MLB notes above. The scope of any clause is an **inference**.
- **Inference (from reports):** the game averages about three years of data and may
  add human judgment. A fit explains part of the spread, not all of it.
- Only 246 of 612 hitters pass the minimum-data rule on one season, and the
  predictors are correlated. Single-weight estimates stay unstable until prior
  seasons exist.
- The card must not say "official" and must not reuse The Show's tier names.

Classify each new `src/api/` module in `src/api/spoiler-manifest.json`: this
feature is spoiler-free. Check each step in the browser against a real player
before the next step. `docs/test-games.md` and `.claude/skills/run/` describe the
loop.

## Prior art (searched 2026-10-07, quick pass)

- MLB The Show: the video-game 0-100 overall, above.
- [Baseball Savant](https://www.mlb.com/news/baseball-savant-statcast-player-pages-new-look):
  0-100 percentile bars on a card-style page, and no single overall number. It
  added a [player comparison tool](https://baseballsavant.mlb.com/changelog/2026-07-20-player-comparison-tool)
  in July 2026.
- The 20-80 scouting scale ([FanGraphs](https://blogs.fangraphs.com/?p=161314)):
  the model for the curve above. It also notes that a 50 OVR is not a
  league-average player, because OVR includes playing time.
- I found no public site that publishes a real-stats 0-100 OVR with minor
  leaguers and potential on one band. The search did not cover GitHub.
