# Weighted pitch-count workload (rolling 1/3/10-game load)

Status: scoping (no implementation)

**Goal.** For every pitcher on tonight's staffs: how many pitches over the last 1,
3, and 10 appearances, how *stressful* were they (companion to
`pitching-health.md` — same stress definition, applied retrospectively), and how
does that load compare to baselines: his own norm, league norms by role, and
norms for winning-record vs. losing-record teams.

**Current state.** `gen-callouts.mjs` already computes reliever `recentPitches` /
`recentAppearances` over a fixed **4-day** window from gameLog splits, a
league-level `bullpenAvgBySport` peer baseline, `pitchedYesterday`, and
`backToBack` — surfaced as the Pitchers-table `workload` note (≥1.5× peer gate).
This idea generalizes that from one day-window to game-count buckets, adds
starters, adds stress weighting, and adds richer baselines.

**Spoiler class:** spoiler-free. Everything is backward-looking over *completed*
appearances (same footing as WAR/milestones); pregame surfaces are fine
(`TeamInfo` bullpen/rotation section, pre-half strip via the existing workload
callout family, Pitchers-table notes). No gating needed.

**Design note — buckets vs. windows.** "Last 3 games" for a reliever who pitched
three straight days is a very different physiological fact than for one with two
rest days mixed in. Game-count buckets (the request) and day-windows (what ships
today) disagree exactly where it matters, so every engine below reports **days
covered** alongside each bucket ("41 pitches over his last 3 appearances — in 4
days"), and rest-days stay a first-class input.

---

## Engine W1 — Raw rolling buckets (gameLog extension)

**Idea.** Extend the existing `gen-callouts.mjs` gameLog sweep to emit, per
pitcher: pitches and batters faced over last 1/3/10 appearances, days spanned,
rest-day pattern (e.g. `0-1-0`), and appearances in last 7 days. Baselines: league
mean/SD per role (starter/reliever, via the existing `isReliever` inference) for
the same buckets. Surface as a small table/pills, tiered by `statTiers` z-scores.

- **Data:** gameLog `numberOfPitches` per appearance — already fetched nightly for
  callouts; this reshapes rather than refetches.
- **Team-record cohorts:** deferred to W4 — cohort plumbing is separable.
- **MiLB fallback:** gameLogs exist for MiLB → works (the current 4-day workload
  note already runs across levels).
- **Maintenance:** low — new fields in an existing sweep + a reader. The natural
  v1.
- **Limit:** raw counts, deliberately; a 20-pitch mop-up inning counts like a
  20-pitch bases-loaded escape.

## Engine W2 — Stress-weighted rolling load (effective-pitch backfill)

**Idea.** Replace raw pitch counts with **effective pitches** — the per-pitch
stress weight defined in `pitching-health.md` (P1 heuristic or P2 RE-weighted),
computed offline per completed appearance by sweeping each game's play-by-play,
stored per appearance in the SQLite layer (incremental, ADR-0021 — each game swept
once, ever). Buckets and baselines as in W1 but in eP units: "58 pitches, 71
effective, over 3 appearances."

- **Data cost:** the real cost of this engine — one play-by-play fetch per new
  game per night (~15 MLB games) is fine; backfilling a season is a one-time
  hand-run.
- **Coupling:** hard dependency on finalizing the stress-weight function first;
  changing the weights later means re-sweeping history (version the weight
  function in the store).
- **MiLB fallback:** feasible but 4 extra levels of nightly play-by-play sweeps —
  scope to MLB v1.
- **Maintenance:** moderate — a second sweep pipeline with backfill/versioning
  concerns, on established patterns.

## Engine W3 — Acute:chronic workload ratio (ACWR framing)

**Idea.** Borrow the sports-science load-management construct: **acute** load
(last 7 days) ÷ **chronic** load (rolling 28-day average of weekly load), computed
on raw pitches (or eP if W2 exists). Ratio ≈ 1.0 = normal; elevated (≳1.3) =
working meaningfully above his own established norm; low (<0.8) = under-worked/
rusty. One number per pitcher with a three-zone gauge, plus the 1/3/10 buckets as
supporting detail.

- **Why it's attractive:** it directly encodes "have they been needing to work
  more than their baseline?" — the user's actual question — as a *self-relative*
  ratio, robust to role differences (a closer and a long man each get their own
  chronic denominator). Simple arithmetic on W1's data; no new fetches.
- **Failure modes:** needs ~4+ weeks of history (April cold-start → fall back to
  role baseline); ACWR's injury-prediction validity is contested territory —
  present it as "vs. his own recent norm," never as injury risk; call-ups/IL
  returns distort the chronic window (exclude IL gaps via the rehab feed).
- **MiLB fallback:** works (same gameLog data).
- **Maintenance:** low incremental over W1.

## Engine W4 — Cohort-comparative baselines (winning/losing-team norms)

**Idea.** The comparison layer: z-score each pitcher's bucket loads against
(a) his own season norm, (b) role cohort league-wide, (c) staff-usage cohorts —
including the requested winning-record vs. losing-record team split (standings
already computed in the nightly pipeline for callout families), plus
team-level rollups ("Brewers bullpen has thrown the 3rd-most pitches in MLB over
the last 10 days"). Rendered as comparative copy and tier pills rather than a new
number.

- **Why separate:** it's presentation-layer analytics over W1/W2 outputs; scoping
  it apart keeps W1 shippable without cohort plumbing.
- **Honest caveat to carry into copy:** the winning/losing split is a
  *descriptive* comparison (good teams protect leads differently, get more save
  situations, fewer blowout mop-ups) — interesting color, weak as a health
  baseline; own-norm (W3) and role cohort are the load-bearing comparisons.
- **Maintenance:** low-moderate — mostly aggregation + copy; team-record joins add
  a little pipeline surface.

## Engine W5 — Bullpen availability board (rest-rule model)

**Idea.** The most product-shaped endpoint: translate load into tonight's
*availability*. Per reliever, a traffic-light using the known managerial rules of
thumb: pitched yesterday (existing flag), back-to-back days (existing), 3 of last
4 days, 25+ pitches yesterday, 40+ over two days → likely unavailable / limited /
fresh. Pregame board on `TeamInfo`: "Available tonight: Megill, Koenig · Limited:
Payamps (B2B) · Likely down: Uribe (32 pitches yest.)."

- **Why it's compelling:** for a second-screen scorekeeper mid-game ("who's left
  in their pen?"), availability is more actionable than any load number; it's
  also the least numeric, most glanceable framing.
- **Data:** W1's buckets + existing flags; rules are a static table.
- **Failure modes:** it makes *predictions* a manager can visibly contradict that
  night (model says down, he pitches) — copy must hedge ("likely"); rules differ
  by manager/era and need occasional retuning.
- **MiLB fallback:** works on gameLog data; usage conventions differ (piggybacks,
  development schedules) → lower confidence, consider MLB-only.
- **Maintenance:** moderate — the rule table is opinionated and will need
  seasonal upkeep.

---

## Research findings

(to be filled by the research pass)

## Re-evaluation

(to be filled after research)

## Stack rank

(to be filled after research)
