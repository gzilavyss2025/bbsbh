# Foul-ball tracker

Status: scoping (no implementation)

**Goal.** Make foul balls a first-class stat: fouls per inning and per game (team
and individual), where they spike, starter vs. bullpen splits, pitch-type effects,
and whether multi-foul at-bats correlate with AB success or failure.

**Current state.** Fouls exist only as per-pitch classification —
`FOUL_CODES = {F, L, T}` and `pitchDotCategory()` in `src/api/playbyplay.js`, used
to color pitch dots. **No aggregation exists anywhere.** The per-half derivation
bucket in `derive.js` counts `pitches` and `whiffs` but not fouls; adding a `fouls`
counter is the same shape as `whiffs`.

**Spoiler class — two distinct halves.**
- *In-game counts* (fouls this half/this game) attach to plays past the reveal mark
  → reveal-only, live in `derive.js` (ADR-0001), surfaced only inside seals / the
  inning digest.
- *Cross-game aggregates* (season leaders, per-inning distributions, correlation
  baselines) are built from completed games → spoiler-free, nightly precompute,
  showable pregame on `TeamInfo`/`PlayerPage`.

The five engines below are deliberately a **severity ladder** — each subsumes the
previous — because the real scoping question here is *how much* of this to build,
not which algorithm (the counting itself is trivial; the analytics are not).

---

## Engine F1 — In-game counters (derive-bucket extension)

**Idea.** Add `fouls` (and `twoStrikeFouls` — fouls that *extended* an AB, the
interesting kind) to `computeDerivedByInning`'s per-half bucket, counted via the
existing `FOUL_CODES`. Surface beside pitches/whiffs in the inning digest and the
box-score roll-up; per-batter and per-pitcher game totals derivable in the same
pass.

- **Data:** live feed only; zero new fetches.
- **MiLB fallback:** works everywhere (pitch result codes exist in MiLB feeds).
- **Maintenance:** near-zero — one more counter in an existing loop, pinned by the
  existing spoiler-invariant test fixture.
- **Limit:** counts with no context. "7 fouls in the 4th" — is that a lot? Needs
  F2's baselines to mean anything.

## Engine F2 — Nightly foul aggregate + leaderboards (`gen-fouls` sweep)

**Idea.** A nightly sweep over completed games' play-by-play (the
`gen-umpire-accuracy.mjs` incremental-sweep + SQLite pattern, ADR-0021: only new
gamePks swept, aggregates committed) producing per-player and per-team season foul
stats: fouls/game, fouls per PA, two-strike fouls, longest foul-fight AB; league
leaders via the existing pool-agnostic `computeLeaders` machinery; per-inning
distribution (does fouling spike in inning 6? — answerable directly);
vs-starter/vs-reliever split (pitcher role inferable the way `gen-callouts.mjs`
already infers `isReliever`).

- **Data:** statsapi play-by-play for completed games; payload small (per-player
  scalar aggregates, well under the 100 KB precache line).
- **MiLB fallback:** computable, but sweeping four full MiLB levels multiplies cost;
  scope v1 to MLB.
- **Maintenance:** moderate — a new generator on the nightly cron, but on the most
  worn groove in the repo.
- **This is the engine that answers most of the stated questions** (leaders,
  per-inning spikes, starter-vs-bullpen) as *descriptive* stats.

## Engine F3 — Foul-outcome correlation priors (batch study → baked thresholds)

**Idea.** The "does fouling a lot predict AB success?" question is a *research
computation*, not a live metric. Run a season-scale batch analysis over the F2
SQLite store: P(hit | n fouls in AB), P(strikeout | n two-strike fouls), batter vs.
pitcher win rates by foul count, split by count-state. Bake the resulting
percentages in as static priors that give F1's live counts meaning ("6-foul ABs
end in a hit 31% of the time — league is 24% overall"). Re-run rarely (hand-run,
immutable-history style, like `gen-war-history.mjs`).

- **Data:** F2's store; no new sources.
- **Maintenance:** low once run — the priors are stable facts, refreshed maybe
  yearly.
- **Failure modes:** correlation-vs-causation copy traps (long ABs select for
  good batters *and* two-strike counts select for pitcher advantage — the split-by-
  count-state control is mandatory or the headline number will mislead).

## Engine F4 — Pitch-type foul profile

**Idea.** The feed's `details.type.code` gives pitch type per pitch, so the F2
sweep can also aggregate foul rate by pitch type per pitcher/batter ("hitters foul
off his cutter 28% of the time — highest of any pitch he throws") and league
pitch-type foul baselines, answering the "does pitch type matter?" question.

- **Data:** same sweep, one more group-by.
- **MiLB fallback:** pitch-type labels spotty/absent below MLB → MLB-only.
- **Maintenance:** low incremental over F2; the risk is *surface* bloat, not
  pipeline cost — where does this render without cluttering the scorebook? Likely
  a PlayerPage card and callout copy only.

## Engine F5 — Live "foul watch" callout family

**Idea.** The delivery vehicle: a new callout family in the established system
(extends `gen-callouts.mjs` for baselines + live `buildCallouts` triggers) that
fires when live counts (F1) cross baselines (F2/F3): marathon-AB callout (6+ foul
AB, with the F3 prior in the copy), "spoiler" batter callout (league-leading
fouler, pregame-safe from F2), laboring-via-fouls team note ("Cubs have fouled off
19 tonight, most vs. any starter this month"). Needs `kind`, `dedupeKey`,
`SCORE_BASE` row, tense decision per ADR-0014 — the standard family checklist.

- **Why it's the point:** raw foul counts are trivia; a well-timed card during a
  10-pitch AB is the product. But it can only exist on top of F1+F2 (+F3 for good
  copy).
- **Maintenance:** the ongoing cost of any callout family (copy, worthiness tuning,
  dedupe) — the repo's most familiar kind of debt.

---

## Research findings

From the external research pass (July 2026):

- **Fouls are a rising, load-bearing feature of the modern game**: league foul
  rate ~16.3% of pitches (1998) → ~18.3% recently (~130k fouls/season); since
  2017 fouls have exceeded balls in play every year; nearly half of all strikes
  are now whiffs-or-fouls. 2025 note: three-ball-count pitches fouled at 23.9%,
  a pitch-tracking-era high (attributed to cutter usage; secondhand, treat as
  directional).
- **The "battling" narrative is empirically supported.** SABR's peer-reviewed
  study (Howard, *Baseball Research Journal* 2018; Retrosheet 1945–2015):
  two-strike counts *reached via fouls* produce a **.291 hit probability vs.
  .102** when reached via swinging/called strikes (with 3 accumulated fouls:
  .335 vs. .124). Counterpoint (Fink, FanGraphs 2021): outside two-strike
  counts, fouls are net negative (a strike without payoff), and whiff rate
  dwarfs foul rate for predicting strikeouts — so the pro-batter story is
  specifically about *foul-accumulated two-strike* counts.
- **Fouling is a real but noisy skill**: year-over-year foul% correlation
  explains only ~40% of variance (Sarris) — vs. ~90% for K-rate. Two-strike
  spoiling ability specifically is worth up to ~20 wRC+ between the best and
  worst (Clemens, FanGraphs 2025), with modest stability (r≈0.3). Known leaders
  exist and are recognizable (Freeman ~4,225 fouls since 2016; Bichette 24.3%
  foul rate; Arraez 5.45 fouls per whiff).
- **The most informative pitcher-side cut is fouls-to-whiffs ratio** (Baumann,
  FanGraphs 2024): high foul-to-whiff pitchers are "missing the barrel, not the
  bat" — opponent wOBA r≈0.40 — while raw foul% mostly tracks swing rate.
- **Two of this idea's questions are genuinely unpublished**: no public
  pitch-type foul leaderboard exists, and **no one has published foul rate by
  inning / starter-vs-reliever** — both are open niches where the data exists
  (Savant pitch-level) but the cut hasn't been done.
- **Fouls as workload weapon**: pitch-efficiency research (pitches/out ↔ team
  outcomes; each prior-start pitch ≈ +0.007 next-start ERA in one unconfirmed
  regression) supports the mechanism, but nothing isolates fouls specifically —
  another open niche.

## Re-evaluation

The severity-ladder structure survives contact with the research; the changes
are about sequencing and copy:

- **F3 gets cheaper**: v1 doesn't need our own correlation study — the SABR
  .291-vs-.102 numbers, the Fink two-strike caveat, and the Clemens ~20 wRC+
  spread can ship as *literature priors* in callout copy immediately. Run the
  in-house study later to localize priors (and because our store enables the
  by-count controls Fink showed are mandatory). The copy trap flagged in the
  first-principles pass is confirmed as real: the batter advantage is specific
  to foul-reached two-strike counts — `twoStrikeFouls` (already in F1's design)
  is the counter that matters, not raw fouls.
- **F2 gains a metric**: add the **fouls-to-whiffs ratio** per pitcher — the one
  cut the literature identifies as actually informative on the pitcher side —
  alongside the descriptive aggregates. And F2's per-inning distribution +
  starter/reliever split would be *publishing something that doesn't publicly
  exist*, which is unusual leverage for a hobby app.
- **F4 confirmed novel but stays last**: no published pitch-type foul
  leaderboard means it's genuinely new, but it's also the least demanded
  question and the most surface-bloat-prone; unchanged position.
- **F5's copy writes itself now** ("Six fouls this AB — batters who battle to
  two strikes this way hit .291, triple the usual"), and the leaders angle
  (Freeman/Bichette-style "spoiler" pregame notes) is validated as recognizable.
- **F1 unchanged** — it was always the trivial, mandatory foundation.

## Stack rank

Scores 1–5: **E** effectiveness · **C** ease of creation/maintenance ·
**U** understandability. (These engines are a ladder, so the rank is build
order/value, not either-or.)

| # | Engine | E | C | U | Σ |
|---|--------|---|---|---|---|
| 1 | **F1 In-game counters** (incl. `twoStrikeFouls`) | 3 | 5 | 5 | 13 |
| 2 | **F2 Nightly aggregates + leaders** (+ fouls-to-whiffs) | 4 | 3 | 4 | 11 |
| 3 | **F5 Live "foul watch" callout family** | 5 | 3 | 4 | 12 |
| 4 | **F3 Outcome-correlation priors** (v1: literature priors; v2: own study) | 4 | 4 | 3 | 11 |
| 5 | **F4 Pitch-type foul profile** | 2 | 3 | 3 | 8 |

**Verdict.** Build **F1 immediately** — it's a one-counter change with outsized
charm for a scorebook app. **F2 + F3-as-literature-priors** is the real feature:
season leaders, per-inning spikes, starter-vs-bullpen splits (two of which would
be genuinely novel public stats), with SABR/FanGraphs numbers giving live counts
meaning from day one. **F5** is the payoff surface and should land in the same
release as F2, since callouts are how this app talks. The in-house F3 study and
**F4** are backlog: run F3 when a season of swept data exists; build F4 only if
a surface asks for it. Note F5 outranks F2 on Σ but ships after it — the family
needs F2's baselines to gate worthiness honestly.
