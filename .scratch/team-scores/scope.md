# Team Scores — MLB quality and MiLB development

**Status:** approved · MLB phase 1 in progress
**Slug:** team-scores
**Relationship to prior work:** The current Season Surprise output remains a useful diagnostic. This scope replaces it as the proposed MLB headline direction.

## Product decision

Every team page gets two comparable 0.0–10.0 values.

| Surface | Season-long | Recent | Question |
|---|---|---|---|
| MLB | **Season Score** | **Current Form** | How good has this club been, and how good has it been in its last 30 games? |
| MiLB affiliate | **Farm Score** | **Development Pulse** | How strong has development been here, and what is happening lately? |

The shared scale means 5.0 is neutral, 7+ is strong, and 8+ is excellent. It does not claim that MLB team quality and MiLB development are the same construct; labels and explanations must make that clear.

### Non-goals

- The deferred Player OVR/POT concept is not a dependency.
- Raw prospect count, transaction count, or uneven Statcast coverage never becomes a score by itself.
- No opaque grade: every score has component values and plain-English reasons.

## Common score behavior

Scores round to one decimal and clamp to [0, 10].

For weighted wins above .500, \(s\), over \(n\) completed games:

~~~text
score(s, n) = clamp(5 + 4.5 × tanh((s / sqrt(0.25n + 9)) / 2), 0, 10)
~~~

The +9 prior damps short samples. A score is null until 10 games in its relevant window; the UI says “building sample” instead of showing false precision.

## MLB scores

### Formula

For all completed regular-season games through the date cutoff:

~~~text
pythagPct     = RS^1.83 / (RS^1.83 + RA^1.83)
weightedWins  = 0.60 × actualWins + 0.40 × (games × pythagPct)
s             = weightedWins − 0.50 × games
~~~

| Score | Window | Calculation |
|---|---|---|
| Season Score | all completed season games | score(s, games) |
| Current Form | last 30 completed team games | same formula and transform inside that window |

Actual wins hold the majority weight; run quality moderates luck. This means a 61–36, +149-run Dodgers team grades as elite even if preseason expectations were elite too.

### Supporting diagnostics, not headlines

- **Season Surprise:** schedule-adjusted performance versus preseason expectation.
- **Earned pace:** MLB xWinLoss, with Pythagorean fallback.
- Record, run differential, and last-30 record.
- Later: role-weighted roster resilience, only when meaningful contributor churn can be separated from ordinary bullpen movement.

### Required MLB data

| Data | Source | Use |
|---|---|---|
| Final games, W/L, RS/RA, last 30 | MLB Stats API schedule | core formula |
| xWinLoss and one-run splits | MLB Stats API standings | diagnostic/calibration |
| Preseason expectation seed | existing season-score input | Surprise detail |
| Active/full rosters, roles, IL, rehab | roster, transactions, existing rehab output | later resilience |
| Team Statcast, defense, baserunning | existing/extended enrichment | optional future quality refinement |

## MiLB affiliate scores

MiLB is an affiliate-development product, not a standings product. A promotion that hurts an affiliate’s record may be a success. Initial scope: AAA, AA, High-A, and Single-A; omit rookie/complex teams from headline scores.

### Player calculations

~~~text
roleWeight(hitter)  = min(1, sqrt(PA / 75))
roleWeight(pitcher) = min(1, sqrt(BF / 100))

ageAdvantage        = clamp(50 + 10 × (leagueMedianAge − playerAge), 25, 90)

development_i       = 0.70 × performancePercentile_i
                    + 0.30 × ageAdvantage_i
~~~

Performance is evaluated in the affiliate’s exact league, not across all of MiLB.

| Group | performancePercentile composite |
|---|---|
| Hitter | 55% locally computed OPS+, 25% BB% percentile, 20% inverse K% percentile |
| Pitcher | 50% K−BB% percentile, 30% inverse opponent-OPS percentile, 20% workload/role percentile |

“OPS+” is a locally computed league-normalized index, not a claim to a proprietary published statistic. Players below the documented PA/BF floor cannot earn a performance-breakout credit.

### Prospect capital

Prospect capital measures development opportunity, not team wins. For each prospect currently on an affiliate roster:

~~~text
gradeValue   = clamp(5 × (PipelineOverallGrade − 40), 0, 100)
top100Value  = 100 × exp(−0.023 × (Top100Rank − 1))
orgRankValue = 45 × exp(−0.080 × (OrgRank − 1))
potential_i  = max(gradeValue, top100Value, orgRankValue)
capitalRaw   = sum of the five highest (potential_i × roleWeight_i)
~~~

If scouting grades are temporarily absent, rank-derived values remain the fallback. Capital is percentile-normalized within level. The top-five cap prevents many low-ranked players from outweighing one elite prospect.

### Affiliate components

Each component is 0–100; P, D, and G are percentile-normalized against current affiliates at the same level.

~~~text
P = percentile(capitalRaw)
D = percentile(weighted mean of development_i × roleWeight_i)
T = 100 × (0.60 × W% + 0.40 × pythagPct)
~~~

**Movement/Graduation (G):** A player earns credit only for a promotion to a higher level or MLB after meaningful work for that affiliate. Its event value is potential_i × roleWeight_i, with a 45-day half-life. Demotions create no direct penalty; performance already lowers D. MLB rehab assignments are excluded.

### Final MiLB formulas

~~~text
Farm Score        = 0.10 × (0.30P + 0.45D + 0.15G + 0.10T)

Development Pulse = 0.10 × (0.25P_current + 0.45D_last30
                            + 0.20G_last45 + 0.10T_last30)
~~~

Pulse uses a 30-team-game window where possible. Missing/insufficient player data regresses that contribution toward the within-level median; absence never helps a club.

## MiLB data to hydrate

| Dataset | Grain | Source | Purpose |
|---|---|---|---|
| Affiliate directory | team, parent org, level, exact league | existing teams/affiliates | attribution and normalization |
| Active roster | person, age, position, status | Stats API roster hydration | prospect capital/current development |
| Season player stints | PA/BB/K/OPS parts; BF/K/BB/opponent OPS/role | Stats API team-season stats | Farm Score |
| Rolling player stints | same fields, last 30 days | Stats API byDateRange | Development Pulse |
| Game results | W/L, RS/RA, date | Stats API schedule | team-quality component |
| Movement ledger | player, from/to club, date, type | transactions + directory | graduation credit |
| Prospect intelligence | Top-100/org rank, change, ETA, grades | extend current Pipeline snapshot | capital and explanation |
| Rehab exclusions | player/club/start/end | existing rehab output + transactions | false-credit prevention |
| Tracked quality | coverage, EV/whiff/velo/spin | MiLB feed/Savant where present | player-detail only |

### Prospect-intelligence extension

Create a weekly compact snapshot:

~~~text
{ playerId, top100Rank, orgRank, priorTop100Rank, priorOrgRank,
  rankChange, eta, overallGrade, tools, age, level, profileUrl, asOf }
~~~

Use numeric rank and 20–80 tool/overall grades plus a source URL; do not preserve full scouting-report prose. The Pipeline payload is undocumented, so validation failures retain the last known good snapshot and make grades optional.

### Statcast/Savant policy

AAA has strong tracking; other MiLB levels have uneven coverage. Hydrate contact/stuff signals only with explicit coverage and sample flags:

- hitters: max/90th-percentile exit velocity, hard-hit, barrel/xBA where available;
- pitchers: velocity, spin, movement, extension, whiff, and pitch mix.

These become “tools trending” details in an explainer. They are excluded from the base affiliate formula until coverage is balanced enough to be fair.

## Output contracts and UI

| File | Cadence | Purpose |
|---|---|---|
| public/data/team-score.json | nightly | date-keyed MLB Season Score, Current Form, and diagnostics |
| public/data/development-score.json | nightly | date-keyed Farm Score and Development Pulse summaries |
| public/data/development-current.json | nightly | current player/component/breakout/movement explanation detail |
| public/data/prospect-intelligence.json | weekly | scouting/rank source with prior-snapshot change |

Historical pages read the latest summary at or before their spoiler-safe cutoff. Current detail may be current-only; historical pages must not pretend it reconstructs today’s reasons.

~~~text
MLB:  8.7 Season Score     6.1 Current Form
      61–36 · +149 RD      18–12 in last 30 · +7 RD

MiLB: 8.1 Farm Score       7.4 Development Pulse
      2 Top-100 · 3 breakouts · 1 graduate
~~~

Clicking either number expands an inline breakdown with components, named players/events, and reasons. Motion is continuity-first: short expand/collapse, a light stagger for explanation rows, and a reduced-motion path—never an always-on “vibe” effect.

## Guardrails

1. MLB quality is not Surprise; excellent teams must score highly even if expected to be excellent.
2. MiLB rank is not performance; prospect capital is capped at 30% of Farm Score.
3. No raw churn penalty; movement requires role/potential and a performance-aware reading.
4. Normalize by exact MiLB league; never compare raw offense across levels.
5. Missing data regresses toward neutral and never rewards absence.
6. Do not claim Statcast parity where tracking is uneven.
7. Every summary is keyed by asOf; no later score, move, or detail may leak into a historical view.

## Validation

- Unit-test transforms, bounds, role thresholds, percentile behavior, movement half-life, and missing-data fallbacks.
- MLB backtest at least 2024–25 and review strong/weak/hot/cold calibration cases.
- Review a MiLB gallery covering prospect-heavy, veteran-heavy AAA, promotion-active, and low-tracking affiliates.
- Validate nightly affiliate count, roster coverage, player-stat coverage, prospect joins, and transaction parser rates.
- On any generator failure, preserve the last known good output and fail the scheduled workflow visibly.

## Phased implementation

1. **Approval and ADRs:** approve definitions, formulas, source policy, date rules, and fallbacks. No score replacement before this gate.
2. **MLB headline correction:** add team-score generator/reader, preserve Season Surprise as a detail, backtest, then ship the two-value MLB card.
3. **Prospect intelligence + MiLB raw hydration:** extend Pipeline data; gather roster, season/rolling stats, schedules, and transactions with bounded concurrency.
4. **MiLB scoring + calibration:** compute Farm Score/Pulse, graduation credit, rehab exclusion, and review a selected affiliate gallery.
5. **MiLB UI:** add cards and explainers to affiliate pages; defer organization-level rollups until affiliate scores are trusted.
6. **Optional tracked quality:** add Savant/feed cards behind coverage gates; reconsider formula inclusion only after a fairness audit.

## Approval requested

Approve or revise these five choices before implementation resumes:

1. The four labels and their distinct meanings.
2. MLB: 60% actual wins / 40% Pythagorean quality.
3. MiLB: 30% prospect capital / 45% player development / 15% movement / 10% team quality.
4. MLB Pipeline ranks and numeric grades as the first scouting source; no multi-site consensus scrape.
5. Savant/Statcast as an optional explanation layer, not a baseline MiLB score input.
