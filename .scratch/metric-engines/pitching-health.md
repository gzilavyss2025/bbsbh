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

(to be filled by the research pass)

## Re-evaluation

(to be filled after research)

## Stack rank

(to be filled after research)
