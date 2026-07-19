# Lineup-strength score

Status: scoping (no implementation)

**Goal.** Before first pitch, grade the starting lineup the manager actually posted
against the best lineup this roster could plausibly field tonight. One number
(0–10 recommended; A+–F possible as presentation skin). The hard parts:

- "Best possible" must respect **positional legitimacy** — a player only counts as
  an option at a position he actually plays, weighted by how much he plays it
  (the Andrew Vaughn-at-3B guard: a handful of innings at a spot ≠ an option there).
- Defense matters, not just bats (Savant/Statcast defensive metrics).
- Optional context layers: recent form, career/season vs. tonight's opponent or
  starter, season-vs-career trajectory.

**Spoiler class:** spoiler-free by construction. Inputs are the posted starting nine
(`selectLineup` in `src/api/select.js`) plus season/career aggregates — no game
score involved. Natural surface: `TeamInfo.jsx`, next to the existing Statcast
percentile cards; possibly a small badge on the `GameView` masthead.

**Shared sub-problem: the eligibility matrix.** Every engine below needs, per
hitter, *which positions he can be assigned to and at what defensive cost*. One
nightly precompute serves all of them: from statsapi season + career fielding
splits (innings by position), build `eligibility[playerId][pos] = w` where `w`
blends season innings share and career innings share (career floor keeps a veteran
who used to play SS eligible; season weight keeps it current). Below a floor
(e.g. <50 career innings and <20 season innings at the spot) → ineligible.
This is the Vaughn guard, and it is engine-independent.

**Shared caveat: "best possible" ≠ "the manager is wrong."** Rest days, injury
management, and matchup plans the public can't see all depress the grade. Copy
must frame this as "strength of tonight's lineup vs. the roster's ceiling," not a
managerial report card. (Also keeps it fun rather than snarky — house tone.)

---

## Engine L1 — Percentile-composite assignment gap

**Idea.** Player value = a blend of Savant percentile ranks already fetched nightly
(batting: xwOBA as the anchor, with hard-hit/chase as minor terms) plus **OAA** for
defense (in the same CSV `gen-savant-percentiles.mjs` already downloads — currently
dropped, one field to re-add). Compute the value-maximizing assignment of roster
hitters to the 8 field positions + DH subject to the eligibility matrix (Hungarian
algorithm, trivially fast at 9×~13). Grade = actual lineup's summed value ÷
optimal lineup's summed value, mapped onto 0–10.

- **Data:** `savant-percentiles.json` (+oaa), eligibility matrix precompute,
  `selectLineup`, active roster via boxscore `bench` + lineup.
- **Where it runs:** player values + eligibility precomputed nightly; the
  assignment solve runs client-side at game load (lineups only post pregame, so it
  can't be fully precomputed).
- **Defense handling:** OAA is position-blind-ish (it's outs above average at
  positions actually played); a player projected to an unfamiliar position gets his
  OAA discounted by the eligibility weight — crude but directionally right.
- **MiLB fallback:** no Savant data below MLB → not shown.
- **Maintenance:** low-moderate. Rides two existing generators; one new small
  precompute (eligibility); one client-side solver module (pure, unit-testable).
- **Failure modes:** percentiles are league-relative ranks, not run values — summing
  ranks across nine players has no natural unit, so the 0–10 mapping needs
  empirical calibration (distribution of nightly gaps league-wide).

## Engine L2 — WAR-rate replacement delta (runs-denominated)

**Idea.** Player value = FanGraphs WAR per 600 PA (already in `war.json`), converted
to runs, plus the standard FanGraphs positional-adjustment constants (C +12.5 …
DH −17.5 runs/season, prorated) when a player is assigned off his primary spot.
Optimal lineup = same Hungarian assignment as L1 but in run units. Grade = runs/game
gap between optimal and actual, scaled (≈0.15 runs/game per grade point, to be
calibrated against the league-wide nightly distribution).

- **Data:** `war.json` (exists), eligibility matrix, positional-adjustment constant
  table (static, well-known).
- **Why runs matter:** the gap becomes *interpretable* — "this lineup gives up about
  0.4 expected runs vs. the ceiling" is a real sentence; L1's percentile-point gap
  is not.
- **Defense handling:** fWAR already folds in fielding value at positions actually
  played; off-position projection handled by the positional adjustment + eligibility
  discount. Caveat: WAR is season-cumulative and early-season noisy (small-sample
  April WAR swings hard) — needs a PA floor with regression toward a prior.
- **MiLB fallback:** none (FanGraphs is MLB-only) → not shown.
- **Maintenance:** low. One existing generator + one small precompute + one solver.
- **Failure modes:** injured/unavailable players on the roster inflate the "optimal"
  (the model doesn't know who's actually available tonight); needs the IL/rehab feed
  (`rehab.js` exists) to exclude IL'd players, and bench availability is still fuzzy.

## Engine L3 — Markov/simulation batting-order model

**Idea.** Go all the way: model expected runs of the *ordered* lineup, not just the
personnel. Build per-player PA-outcome distributions (BB/1B/2B/3B/HR/out rates from
season stats), run a Markov chain over the 24 base-out states (or a Monte Carlo
sim, ~10k games) for (a) the actual posted order and (b) the best order over the
best personnel from the L2 assignment. Grade = expected-runs ratio.

- **Data:** season rate stats per hitter (statsapi, cheap), eligibility matrix,
  the L2 assignment as the personnel-optimizer inner loop.
- **What it adds:** batting-*order* value (lineup construction, not just lineup
  selection). Also produces fun byproducts ("optimal order bats Chourio leadoff").
- **What it costs:** the most math, the most calibration, the most CPU (a client-side
  Markov solve is feasible; full order search is 9! — needs heuristics or simulated
  annealing); hardest to explain; and (from first principles) order effects are
  known to be small relative to personnel effects, so most of the signal is L2's.
- **MiLB fallback:** could actually run on MiLB season stats (statsapi has them) —
  the only engine with a real MiLB story, though rate stats there are level-noisy.
- **Maintenance:** high. A simulation engine is a new subsystem with its own tests
  and calibration debt.

## Engine L4 — Matchup-adjusted overlay (platoon + form + vs-starter)

**Idea.** Not a standalone base engine — a context layer over L1 or L2 that answers
"best lineup *tonight*," not "best lineup in the abstract." Adjust each player's
base value with: (a) platoon split vs. tonight's starter's hand (statsapi
`statSplits vl/vr` — `gen-callouts.mjs` already computes platoon deviations),
(b) recent form (last-14/30-day wOBA from gameLog, regressed hard toward season
value), (c) career batter-vs-pitcher line vs. the probable starter (verified
`vsPlayer` endpoint per `docs/enhancement-proposals.md` §1 — tiny samples, so cap
its weight severely or use it for copy only, not the number). Optimal lineup is
re-solved under tonight's adjusted values, so a platoon bench bat can correctly
beat the slumping regular.

- **Data:** adds a per-team nightly precompute of platoon/form adjustments (rides
  the `gen-callouts.mjs` sweep, which already fetches gameLogs and splits); BvP
  fetched client-side pregame (1 call per lineup slot, or skipped).
- **Why it matters:** this is the layer that makes the grade feel *smart* — "sat the
  lefty masher against a lefty" is exactly what a scorekeeper wants acknowledged.
- **Failure modes:** double-counting (form + season + matchup are correlated);
  each knob is a calibration liability. Weights must be few and fixed.
- **MiLB fallback:** platoon/form computable from statsapi at MiLB; BvP is not.
- **Maintenance:** moderate, and it compounds whichever base engine it sits on.

## Engine L5 — Deviation ledger (transparent point deductions)

**Idea.** Skip optimization entirely. Precompute nightly each team's *canonical
lineup* — the modal configuration over the last ~30 games (who plays, where, in
what order slot) blended with a value ranking. Tonight's grade starts at 10 and
takes visible, itemized deductions: regular resting (−1 each, scaled by his value
over replacement-on-bench), player at an unfamiliar position (−0.5 × unfamiliarity),
platoon mismatch (−0.5), bottom-heavy order quirk (−0.25). The receipt *is* the UI:
every deduction is a line a scorekeeper can nod at.

- **Data:** 30-game lineup history (statsapi schedule + boxscores — `gen-callouts.mjs`
  sweep territory), eligibility matrix, a value ranking (WAR or percentile).
- **Why it's attractive:** maximum understandability; failure modes are visible
  (a wrong deduction is one legible line, not a mystery number); no solver.
- **Failure modes:** the canonical lineup is a lagging indicator (trades, injuries,
  September call-ups distort the mode); "deduction" framing reads as blame unless
  copy is careful; caps/weights are arbitrary in a different way than L1's.
- **MiLB fallback:** fully computable from statsapi → the only engine that works
  everywhere as designed.
- **Maintenance:** low-moderate (one nightly precompute, no solver, but copy rules
  accrete).

---

## Research findings

(to be filled by the research pass)

## Re-evaluation

(to be filled after research)

## Stack rank

(to be filled after research)
