# Pitching health (in-game stress-adjusted pitch load)

Status: scoping (no implementation)

**Goal.** In-game, per pitcher: "100 pitches" is not one thing. 100 across 9 clean
innings from the windup differs from 100 across 4 innings of traffic, long counts,
and 30-pitch frames. Produce a stress-adjusted read on how *hard* tonight's outing
has been, as the game unfolds. Broadcaster heuristics the metric should be able to
reproduce: 30+ pitches in an inning is the danger zone; pitching from the stretch
(runners on) is more taxing than the windup; foul-heavy ABs stretch counts.

**Spoiler class:** spoiler-sensitive, in-game. Every engine here must follow the
Pitchers-table pattern (ADR-0009): computed per revealed play via a
`revealedThrough`-gated accumulator (like `computePitcherLines`'s existing
`pitches` field), **never** SealBox-wrapped (a still-active pitcher needs
partial-outing granularity; a seal is all-or-nothing). Natural surfaces: a new
column/gauge in `PitchersSection`, a `StatBox` third-row card next to umpire favor
(both precedented), and pre-half strip callouts ("Peralta labored: 32-pitch 4th").

**Shared input:** everything comes from `liveData.plays.allPlays[].playEvents[]`,
which the repo already walks: per-pitch `isPitch`, count before the pitch, the
play's `runners`/`matchup` (base state), `about.inning/halfInning`,
`pitchData.startSpeed`. No new fetches for any engine below.

**Baseline note (feeds idea 4).** Engines P1/P2 define a per-pitch *stress weight*;
`pitch-workload.md`'s weighted engines reuse the same weight function offline. The
two ideas share one core definition — design it once.

---

## Engine P1 — Codified broadcaster heuristics ("effective pitches")

**Idea.** Each pitch has base weight 1.0 plus additive bumps drawn directly from
the folk wisdom, so the formula is quotable on air:

- **Stretch tax:** +0.15 if any runner on base when thrown (windup vs. stretch,
  approximated by base state — the feed doesn't flag delivery, but runners-on is
  the same signal broadcasters use).
- **Traffic tax:** +0.10 more if RISP.
- **Deep-count tax:** +0.10 if thrown with 3 balls or 2 strikes (long-AB grind).
- **Big-inning tax:** each pitch after the 25th of an inning +0.5 (the "30-pitch
  inning" danger zone made continuous).
- **Foul-fight tax:** +0.10 per pitch from the 7th pitch of a PA onward.

Sum = **effective pitches (eP)**, shown beside actual ("78 pitches, felt like 94").
Weights are made-up-but-legible constants; calibrate once so a league-average
outing has eP ≈ pitches.

- **Gating:** accumulate only over plays `≤ revealedThrough`, exactly as
  `computePitcherLines` does.
- **MiLB fallback:** fully works (count + runners exist in MiLB feeds).
- **Maintenance:** low. Pure function over playEvents; unit-testable against the
  captured real-game feed fixture.
- **Failure modes:** arbitrary constants; double-taxing correlated conditions
  (deep counts and long PAs overlap); no physiological grounding.

## Engine P2 — Leverage/run-expectancy-weighted stress (RE288 reuse)

**Idea.** Replace P1's hand weights with the repo's own empirical table: the RE288
run-expectancy table (`src/lib/runExpectancy.js`) already values every
base×outs×count state. Per-pitch stress weight = 1 + k·(state pressure), where
state pressure is derived from the RE table (e.g. normalized runs-at-stake in the
current base/out state, count-adjusted). Effective pitches = Σ weights, normalized
so bases-empty 0-0 = 1.0. Same display and gating as P1.

- **Why better than P1 in principle:** weights come from measured run environments,
  not vibes; one tuning constant k instead of five.
- **Why maybe not:** RE-derived "pressure" measures *situational importance*, not
  *physiological effort* — a 3-0 count bases empty is low-RE-delta but still a
  grind. Doesn't natively capture the 30-pitch-inning effect (needs P1's
  big-inning term bolted on anyway).
- **MiLB fallback:** works (RE table is MLB-derived but usable as an approximation;
  or hide below MLB).
- **Maintenance:** low-moderate (reuses an existing hand-run-generated table;
  the count dimension of RE288 was built for umpire favor and fits here).

## Engine P3 — Own-baseline deviation ("laboring index")

**Idea.** Stress is relative to the pitcher himself. Nightly precompute per pitcher
(riding the `gen-callouts.mjs` sweep): season pitches/inning, pitches/PA, strike%,
first-pitch-strike%. In-game, compare tonight's revealed totals to his baseline and
report the deviation: "18.5 pitches/inning tonight — his season norm is 14.8."
Optionally condensed to a 0–10 laboring index via `statTiers` z-scores.

- **What it adds:** answers "is *he* laboring?" rather than "is this outing
  abstractly stressful?" — arguably the question the scorekeeper is actually asking
  mid-game, and it needs no stress-weight function at all.
- **Data:** one small nightly per-pitcher baseline JSON (few KB); in-game math is
  two divisions.
- **MiLB fallback:** baselines computable from statsapi MiLB gameLogs → works.
- **Maintenance:** low (one precompute + trivial in-game math), but rookies/debuts
  have no baseline (fall back to league-average baseline by role).
- **Failure modes:** small in-game samples (2 innings of data swing hard — needs
  an innings floor before showing); says nothing about *which* innings were hard.

## Engine P4 — Velocity-decay fatigue signal (Statcast in-feed)

**Idea.** The only *physiological* signal in the feed: `pitchData.startSpeed`
(already read for max-velo superlatives). Track the pitcher's fastest-pitch-type
average velo by inning vs. his first-two-innings anchor (or nightly-precomputed
season average); a sustained drop (e.g. ≥1.5 mph) flags fatigue regardless of
pitch count. Surface as a flag/sparkline, not a score: "FB velo down 1.8 from the
1st."

- **Why include it:** catches the tired arm the count-based engines miss (easy
  innings, but the gas is gone), and it's the signal most respected in modern
  broadcasts.
- **Failure modes:** needs pitch-type discrimination (velo mix ≠ fatigue if he's
  throwing more offspeed — must compare within fastball type, `details.type.code`);
  deliberate velo modulation exists; small per-inning samples.
- **MiLB fallback:** `pitchData` absent at most MiLB parks → MLB-only, hide when
  absent (null-guard convention already established in `derive.js`).
- **Maintenance:** low-moderate. Pure in-feed derivation; the pitch-type grouping
  logic is the only fiddly part.

## Engine P5 — Blended Pitching Health gauge (composite of P1/P2 + P3 + P4)

**Idea.** The ADR-0013 move (blend a context-aware half with a context-neutral
half), applied here: one 0–10 per-pitcher health gauge = weighted blend of
(a) volume stress — effective pitches from P1 or P2 scaled against role-typical
limits, (b) own-baseline deviation (P3), (c) velo-decay flag (P4) as a capped
penalty. Tiered green/amber/red via `statTiers`-style cuts; the gauge expands to
show its three drivers (the Season Grade "drivers stay visible" rule, ADR-0020).

- **Why:** a single legible gauge is the product-shaped answer; components alone
  are stat-nerd answers.
- **Why not first:** it inherits every sub-engine's calibration debt *plus* blend
  weights; shipping it before its components exist inverts the build order. This is
  a v2 target, not an engine to start with.
- **MiLB fallback:** degrade to P1+P3 blend where `pitchData` is missing.
- **Maintenance:** highest of the five (it owns everything the others own).

---

## Research findings

From the external research pass (July 2026):

- **Leverage-weighted pitch counts were tested and rejected.** Russell Carleton
  (Baseball Prospectus, "Why Do Pitchers Get Tired?", ~2015) built exactly engine
  P2 — pitches × leverage of the PA — and ran it against outcomes 2010–2014:
  **raw pitch count won every specification; the leverage-adjusted count never
  entered significantly** (including a RISP-only variant). His conclusion: the
  physical act of throwing is the fatigue driver; situational stress adds nothing
  measurable on top of volume. Separately, pitchers *do* throw harder in big spots
  (real, modest velo uptick with leverage) — but that supports "effort varies,"
  not "leveraged pitches should count extra toward fatigue."
- **Windup vs. stretch is a dead heuristic.** Fleisig et al. 2024 (*AJSM* +
  *Sports Biomechanics*): <0.5 mph velocity difference, no significant kinetic/
  kinematic differences between windup and stretch in professional pitchers. The
  broadcaster "stretch is more taxing" claim has no biomechanical support.
- **Velocity decline is the best-validated in-game fatigue signal.** Starters lose
  ~0.9–1.0 mph on average first-to-last inning (Zimmerman/FanGraphs); peak-velo
  loss explains ~23% of variance in K-rate change late in starts; outlier
  droppers (−2 to −3 mph) are meaningful flags. Physiologically direct, unlike
  any count-based scheme.
- **The 30-pitch-inning danger zone has directional support, thin samples.** BP
  Pitch-F/X work on 40+-pitch first innings found ~3.6 in. of fastball movement
  loss across subsequent innings and worse next starts for the pitchers who lost
  the most — distribution of pitches matters, not just the total — but n≈18–30;
  evidence-supported, not conclusively quantified.
- **PAP/PAP³ is the canonical published weighting scheme** (BP, Jazayerli 1998;
  Woolner 2001): pitches past 100 count increasingly (cubed excess in PAP³) —
  "it's the number of pitches thrown *tired*." Thresholds arbitrary, individual
  variation ignored, and its own author considers it moot as a live tool — but it
  validates the *shape* late-pitch weighting should take (tail-loaded, not
  per-situation).
- **TTO penalty:** ~8–10 wOBA points per pass; mechanism is batter familiarity
  more than fatigue (repertoire-size interaction), and the newest peer-reviewed
  work (Brill/Deshpande/Wyner 2023) finds no sharp third-time cliff. The related
  Verducci-effect folk rule is essentially debunked.
- **No prior product** ships a stress-adjusted live pitch count; nearest analog is
  ESPN's rule-based reliever "tired" flag (a workload-side, not in-game, tool).

## Re-evaluation

The research inverts the first-principles ordering:

- **P2 is refuted for its stated purpose.** Its core premise — situational
  weighting is more principled than heuristics — was specifically tested by
  Carleton and lost to raw counts. Drop it. (The RE288 table keeps earning its
  keep in umpire favor; it just has no fatigue business.)
- **P1 survives only as *narrative*, and amended.** Cut the stretch tax
  (debunked) and the RISP tax (Carleton). What remains defensible: the
  big-inning tax (directional evidence) and a PAP³-style tail weight (pitches
  past ~90–100 count extra). Reframed honestly, eP is a **storytelling stat**
  ("78 pitches that felt like 94") — legitimate for this app, which is a
  scorebook companion, not a projection system — but it must not be presented as
  predictive.
- **P4 is promoted to the top on effectiveness** — it's the one signal the
  literature calls physiologically direct — with its known costs intact
  (within-pitch-type comparison mandatory, MLB-only, small samples early).
- **P3 gains standing**: Carleton's "volume is what matters" conclusion means
  *pitches vs. own norm* is measuring the right thing, and it's the cheapest
  engine here. "Laboring" framing (pitches/inning vs. his baseline) also happens
  to be how broadcasters already talk.
- **P5 re-specced**: the blend should be **P3 + P4** (the two evidence-backed
  signals) with P1's eP as optional flavor — not the P1/P2-volume-stress core
  originally sketched. Still v2.
- A **TTO chip** ("3rd time through the order") is worth adding to whichever
  engine ships — cheap to compute from revealed plays, well-evidenced magnitude —
  as a display element, not a score input.

## Stack rank

Scores 1–5: **E** effectiveness · **C** ease of creation/maintenance ·
**U** understandability.

| # | Engine | E | C | U | Σ |
|---|--------|---|---|---|---|
| 1 | **P3 Own-baseline deviation ("laboring index")** | 4 | 4 | 5 | 13 |
| 2 | **P4 Velocity-decay fatigue signal** | 5 | 3 | 4 | 12 |
| 3 | **P1 Effective pitches** (amended: big-inning + PAP³ tail only) | 2 | 4 | 4 | 10 |
| 4 | **P5 Blended health gauge** (re-specced: P3+P4 core) | 4 | 2 | 3 | 9 |
| 5 | **P2 Leverage/RE-weighted stress** | 1 | 3 | 3 | 7 |

**Verdict.** Ship **P3** first: it is the only engine that is simultaneously
cheap, universally available (MiLB included), aligned with the literature's
"volume vs. own norm" conclusion, and phrased the way the booth already talks.
Pair it with **P4** as a flag ("FB velo −1.8 since the 1st") wherever `pitchData`
exists — together they cover both halves of "is he laboring?" (working harder
than usual; losing stuff). **P1**'s amended eP is optional color for the Pitchers
table — honest as narrative, and cuttable without loss. **P5** waits until
P3/P4 have a season of behavior to calibrate against. **P2** should not be built:
the one study on point says its added complexity buys nothing.
