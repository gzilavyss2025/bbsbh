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

From the external research pass (July 2026):

- **Volume thrown beats days-rested as the fatigue predictor.** Burris & Coleman
  (*JQAS* 2018) modeled reliever fatigue as dose-response: recent pitch volume
  has a "virtually linear" negative relationship with subsequent performance,
  while days-of-rest alone is only weakly associated. Velocity effects are
  consistent across studies: ~0.4–0.5 mph down when tired (2019 and 2025 data
  alike), up to ~1.5 mph after **three consecutive days** (Kalk 2008) — the
  worst pattern found. Back-to-backs occur in ~16% of modern reliever
  appearances; elite relievers' share of appearances jumped 37%→50% (2019→2025).
- **ACWR's science is seriously contested.** Origin: Gabbett; acute (7-day) ÷
  chronic (28-day) load, "sweet spot" 0.8–1.3. But Impellizzeri et al.
  (2020–21) show the ratio suffers **mathematical coupling** (acute is a subset
  of chronic → partly spurious correlation), the sweet spot may be a bucketing
  artifact, and the windows are arbitrary — papers now argue to "dismiss ACWR
  and its underlying theory." The only baseball-specific result is high-school
  (ACWR >1.27 → 14.9× injury odds, n=18 pitchers); **no MLB validation exists**.
- **The product space converged on rules and grids, not ratios.** ESPN publishes
  an explicit reliever "tired" formula — flagged if **≥2 of {25+ pitches
  yesterday, 35+ over last 3 days, pitched both prior days}** — and the standard
  presentation is a rolling per-team pitch-count grid (Razzball's 7-day bullpen
  chart; InsidethePen and Fantrax trackers similar). This is exactly the W5
  shape, with published thresholds to borrow.
- **Stress-weighted retrospective load has prior art but weak legs**: "leveraged
  pitch count" concepts exist (BP/Bucs Dugout), but Carleton's BP test (see
  `pitching-health.md`) found leverage-weighted counts add no predictive value
  over raw counts. PAP³ (cubed pitches past 100) is the one weighting scheme
  with published pedigree, and it's per-outing tail-weighting, not situational.
- **Baselines to compare against**: starters now average mid-80s pitches/start
  (~5.0 IP); ~3.3 relievers used per team-game. **The winning-vs-losing-team
  usage split is an open research gap** — analysts assume contenders lean on top
  arms harder (esp. September/postseason), but no effect-sized study exists.
- Context worth carrying: MLB's own 2024 injury report argues velocity-chasing,
  not workload per se, drives the elbow-injury epidemic — one more reason to
  present workload as *usage description*, never injury prediction.

## Re-evaluation

- **W1 upgraded from "the simple option" to "the evidence-aligned option"**:
  Burris & Coleman's volume-dominates finding means raw pitch buckets track the
  right variable. Add the **consecutive-days pattern** as a first-class field
  (the 3-straight-days velo cliff is the sharpest documented effect) — the
  first-principles design's rest-day emphasis is confirmed, and then some.
- **W5 strengthened and de-risked**: its rule table no longer needs inventing —
  seed it with ESPN's published thresholds (25 yesterday / 35 over 3 days /
  B2B, flag on 2 of 3) plus a 3-straight-days hard flag, and present per-team as
  a Razzball-style recent-usage grid. Prior art validates both the rules and
  the UI idiom.
- **W3 demoted**: mathematical-coupling critique + zero MLB validation means
  ACWR should not be a shipped number. Salvage its one good idea — *load
  relative to own recent norm* — as a plain percentage inside W4 ("40% above
  his usual 10-game load"), no ratio branding, no sweet-spot zones, never
  injury-flavored.
- **W2 demoted further**: it inherits Carleton's negative result via the shared
  stress-weight function (see `pitching-health.md` — P2 dropped, P1 reduced to
  narrative), and it's the only engine requiring a second sweep pipeline. A
  cheaper salvage exists if wanted later: per-outing PAP³ tail-weighting needs
  only `numberOfPitches` already in hand — no play-by-play sweep at all.
- **W4 refocused**: own-norm and role-cohort comparisons are the load-bearing
  ones; the winning/losing-record split stays (it's cheap and the user asked)
  but explicitly labeled as descriptive color — the research gap confirms
  there's no evidentiary baseline to imply more.

## Stack rank

Scores 1–5: **E** effectiveness · **C** ease of creation/maintenance ·
**U** understandability.

| # | Engine | E | C | U | Σ |
|---|--------|---|---|---|---|
| 1 | **W1 Raw rolling buckets** (+ consecutive-days pattern) | 4 | 5 | 5 | 14 |
| 2 | **W5 Availability board** (ESPN-threshold rules, grid UI) | 4 | 4 | 5 | 13 |
| 3 | **W4 Cohort baselines** (own-norm % + role cohort; record-split as color) | 3 | 4 | 4 | 11 |
| 4 | **W3 ACWR** | 2 | 4 | 3 | 9 |
| 5 | **W2 Stress-weighted backfill** | 2 | 2 | 3 | 7 |

**Verdict.** **W1 + W5 together are the feature**: the 1/3/10-game buckets with
days-spanned and consecutive-day patterns (W1) feeding a rule-based
availability board with published, defensible thresholds (W5) — evidence-aligned,
entirely on the existing `gen-callouts.mjs` gameLog sweep, spoiler-free, and
matching how every prior-art product presents this data. **W4**'s own-norm
percentage is the natural second release and quietly delivers what W3 promised
without ACWR's baggage. **W3** should not ship as a branded ratio. **W2** is
last: its premise lost its empirical footing and it carries the only real
pipeline cost in the group — if stress-weighting ever returns, the PAP³-on-
`numberOfPitches` shortcut delivers 80% of it for ~5% of the work.
