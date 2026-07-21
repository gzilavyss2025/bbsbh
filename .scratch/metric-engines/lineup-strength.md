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

> **Correction (July 2026, after shipping). The value input above is wrong — L2
> as built no longer uses WAR at all. The shipped design, and the evidence behind
> every deviation from what this section proposes, now lives in
> [`docs/lineup-strength.md`](../../docs/lineup-strength.md) — read that first;
> the rest of this file is the original engine survey, kept for the alternatives
> it weighs and the research pass behind the constants.**
>
> **Symptom.** A posted Brewers lineup graded 2.2 with a receipt line reading
> "DH — expected Christian Yelich (97 wRC+), starting William Contreras (105)".
> Gary Sánchez, at 132 wRC+ the best rate on the roster, valued below
> replacement. The model's bat ranking was almost exactly inverted.
>
> **Root cause.** WAR bundles bat, glove and a positional adjustment into one
> number, so using it as the value input forced the grade to *reconstruct* a bat
> by subtracting a full-season positional constant. That is not recoverable:
>
> 1. FanGraphs' `Positional` is **prorated by actual playing time**. Contreras
>    had earned +4.7 positional runs at the time; the model stripped the full
>    12.5. Yelich had paid −6.9; the model handed back 17.5. A ~19-run phantom
>    swing between two players, manufactured from a number that was in the feed.
> 2. The Marcel PA shrink had already scaled the embedded adjustment before the
>    constant was removed at full strength, leaving a further
>    `(1 - shrink) * POS_ADJ[primary]` residual pointing the same direction.
> 3. Independently, the adjustment was ALSO applied at assignment time as
>    `POS_ADJ[slot] - POS_ADJ[primary]`, where it does nothing: every lineup
>    fills the same nine slots, so its sum is a constant that cancels, and a
>    per-slot constant can't change which assignment is optimal.
>
> **What replaced it.** Read the components instead of the total —
> `type=6` (Value) carries them at no extra request. Each hitter now gets a bat
> (wRC+ regressed toward 100) and a glove (season Fielding runs regressed toward
> 0) as independent numbers. `slotValue` adds both at a fielding slot and uses
> the bat alone at **DH**, since a designated hitter's fielding contribution is
> definitionally zero — which is also what makes hiding a poor defender there
> correctly free. The positional adjustment is gone from the model entirely:
> with fielding carried explicitly, nothing is left for it to proxy.
>
> **What this buys beyond the fix.** Joey Ortiz — 75 wRC+, worst bat among the
> regulars, but +6.4 fielding runs, the best glove on the roster — keeps third
> base. An offense-only model benches him; the old WAR model couldn't see either
> half clearly. Regressing wRC+ toward *average* rather than replacement also
> dissolved the low-PA problem, where a 27-PA callup used to read as a weakness.
>
> **Lesson for any future engine here: never re-derive a component from a
> composite. Fetch the component.**

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

From the external research pass (July 2026):

- **Order barely matters; personnel dominates.** The Book: proper order strategy
  "will only gain a few runs"; FanGraphs' synthesis of the Markov/sim literature
  (Klaassen 2011) puts optimal-vs-*typical* order at **~5–15 runs/season**
  (≤1.5 wins). Bukiet's Markov work's 30–50 runs/season figure is optimal vs.
  *worst-case* order of the same nine — a different question; don't conflate.
  Implication: a lineup grade should be ~90% "who's playing," ~10% "in what order."
- **BvP is noise at real sample sizes.** The Book's consensus: unreliable below
  ~50 PA; under ~10 AB it's "almost entirely luck." Public models discount raw BvP
  in favor of true talent + platoon estimates.
- **Platoon splits need heavy regression** toward the league-average split:
  ~2,200 PA of league-average weight for RHB, ~1,000 PA for LHB (The Book). A
  single season's observed split is mostly not real.
- **Recency has *some* signal at the right window**: a rolling ~25-AB window shows
  statistically significant (small) predictive value; 3–5-day "he's hot" windows
  add roughly nothing over a proper baseline. Marcel (weighted multi-year +
  regression) is the canonical simplest defensible true-talent estimate.
- **Defense: prefer FRV over OAA.** Statcast's Fielding Run Value is the all-in-one
  run-denominated metric (range + arm + framing/blocking for catchers); OAA
  excludes catcher framing/blocking entirely (catcher OAA widely flagged as
  unusable alone). Both are free Savant leaderboard CSVs — same fetch pattern as
  the percentile CSV. **There is no published method for projecting OAA/FRV to a
  position a player hasn't played** — public practice is the fixed FanGraphs
  positional-adjustment constants (C +12.5 … DH −17.5 runs/162, confirmed current)
  prorated by innings, exactly as engine L2 assumed.
- **Prior art: white space.** Lineup *trackers* (RosterResource) and DFS
  *optimizers* exist; nothing surfaced that grades a team's actual announced
  lineup against its own optimal for a general audience.

## Re-evaluation

What the research changes:

- **L3 (Markov/sim) is demoted to last, decisively.** Its entire marginal value
  over L2 is order effects, which the literature caps at ~1 win/season — the most
  expensive engine buys the smallest validated signal.
- **L2 is strengthened**: its two load-bearing assumptions (runs-denominated
  value; fixed positional-adjustment constants as the out-of-position cost model)
  are exactly current public practice. Add a Marcel-flavored regression to the
  WAR-rate input (weight prior season + regress to mean at low PA) to fix the
  April-noise failure mode already flagged.
- **L1 amended**: use **FRV** (not OAA) as the defensive input — one different
  column from the same Savant CSV family, and it fixes the catcher hole. The
  unitless-sum objection stands; L1 works best as the *presentation* layer
  (percentile language matches the app's existing Statcast cards) over L2's
  run-denominated engine rather than as its own engine.
- **L4 amended**: drop BvP from the math entirely (copy-only garnish, if that —
  "career 8-for-19 vs. Webb" as flavor text); platoon term uses the
  league-average split with The Book's regression weights, not raw observed
  splits; form term uses a ~25-AB/30-day window, never shorter. So amended, L4
  remains the highest-upside v2 layer.
- **L5 unchanged** — research neither supports nor undermines it; its case was
  always product-shaped (legibility), not evidentiary.

## Stack rank

Scores 1–5 (higher better): **E** = effectiveness, **C** = ease of
creation/maintenance, **U** = understandability.

| # | Engine | E | C | U | Σ |
|---|--------|---|---|---|---|
| 1 | **L2 WAR-rate replacement delta** (+ Marcel-style regression) | 4 | 4 | 4 | 12 |
| 2 | **L5 Deviation ledger** | 3 | 4 | 5 | 12 |
| 3 | **L4 Matchup overlay** (amended: no BvP, regressed platoon) | 4 | 2 | 3 | 9 |
| 4 | **L1 Percentile-composite gap** (amended: FRV) | 3 | 4 | 3 | 10 |
| 5 | **L3 Markov/sim order model** | 3 | 1 | 1 | 5 |

**Verdict.** Build **L2** as the engine: runs-denominated, every constant it needs
is validated public practice, and the Hungarian solve is a small pure module.
Present it **through an L5-style receipt** — the grade plus itemized lines ("Yelich
resting −0.8", "Vaughn at 3B −0.4") — which is where L5's understandability
actually belongs (a UI decision, not a competing engine). L1's percentile language
can skin the same output for consistency with the existing Statcast cards. **L4**
(platoon + regressed form) is the v2 layer once the base grade has a season of
calibration; sequencing it later also gives the eligibility matrix time to prove
out. **L3** is not worth building at any point: its cost buys the one input the
literature says is nearly worthless. Note L4 ranks above L1 despite the lower Σ —
Σ is not the rank; effectiveness upside on the same base engine outweighs a
redundant standalone engine.
