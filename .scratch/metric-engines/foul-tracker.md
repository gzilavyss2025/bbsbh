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

(to be filled by the research pass)

## Re-evaluation

(to be filled after research)

## Stack rank

(to be filled after research)
