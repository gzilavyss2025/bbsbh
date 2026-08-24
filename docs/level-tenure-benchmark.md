# The level-tenure benchmark

The research behind a farm-system feature that reads "roughly X% through a
typical stay at this level" for a prospect. No public dataset like this
exists — the closest public figures are career-AGGREGATE (Baseball
Prospectus: ~2,070 career MiLB PA / ~391 IP before an average debut, summed
across every level) or cover one narrow cohort with gaps (Baseball America's
per-level breakdown, high-school first-rounders only, missing a current
Triple-A number). Nothing public covers pitchers at all, or any level split
by pedigree. This document is that benchmark, built from scratch.

## The cohort

881 players: every MLB debut 2019–2023 whose career crossed the REAL rookie
threshold — 130 at-bats or 50 innings, cumulative, `public/data/rookies.json`'s
own `rookieUntil` field. Reused rather than reinvented, and it's what keeps a
scoreless September cup of coffee out of the cohort.

**Why 2019–2023, not wider or narrower.** A 2015-on window would reach
~1,600 players and firm up the thinnest pedigree cells, but pulls in
pre-2021 minor-league structure and older development norms. A
2021-2023-only window sidesteps the 2020 pandemic gap cleanly but drops to
~500 players. 2019–2023 is the balance: recent enough to describe current
practice, large enough for stable per-level percentiles (318–437 players per
level/group cell). 2020 stayed in the cohort — no MiLB games were played that
year at all, so any stint spanning it has a real, small gap, flagged rather
than fixed.

**Excluded**: rookie/complex leagues (sportId 16) — the same exclusion the
Farm Index (`docs/farm-index.md`) already makes: short seasons, leagues that
re-form yearly, noise wearing signal's clothes. Two Mexican League stints
statsapi mislabels sportId 11 (AAA) in some seasons (the same anomaly
`gen-milb-history.mjs`'s header documents) — dropped, not counted as
Triple-A.

## Reconstruction

One data point per player per level: everything accumulated at that level,
first time through, from arrival to the moment he moved to a higher level or
the majors. A later return (option, rehab) doesn't re-enter the count.

Built from `yearByYear` hitting/pitching splits across sportIds 11/12/13/14
(the exact per-player sweep `gen-milb-alumni.mjs` already does, reused
rather than reinvented) — season+level rows sorted chronologically, ties
within one season broken by ascending level rank (AAA > AA > High-A > A).
That tie-break is an assumption, not a certainty: **27% of the cohort (240 of
881) has at least one pre-debut season where they bounced between two levels
more than once** — 40-man emergency-depth shuttling, mostly involving AAA
(63% of the disputed cases). Validated against 13 seasons of the
transactions wire (`docs/transactions-wire.md`, ADR-0058's `effectiveDate`):
of the resolvable cases, 71% confirm the ascending-order assumption. A
robustness check — dropping all 240 touched players and recomputing —
moves every level's median by single digits. That's what makes the
level-only numbers below trustworthy despite the messiness underneath.

## The numbers (v1 — level only, no pedigree split)

PA/IP at level before promotion, median [p25–p75]:

| Level | Hitters — PA | Pitchers — IP |
| --- | --- | --- |
| A | 332 [207–495] | 58.8 [30.4–96.8] |
| High-A | 350 [228–473] | 59.3 [35.7–93.0] |
| AA | 410 [267–553] | 68.3 [36.3–105.3] |
| AAA | 327 [180–529] | 54.0 [26.3–88.8] |

n = 318–437 per cell. Full p10/p90 tails, the sensitivity table, and the
pedigree/timing/org cuts below live in the published write-up (link in the
PR that ships v1 — republish target if the link goes stale: ask for the
"Level Tenure Benchmark" artifact).

## What else was measured, not yet shipped

- **Draft-round and prep/college pedigree** carry real signal (Round 1
  hitters need less PA at every level than later rounds; prep picks need far
  more low-minors reps than college bats) with workable cells (n=30–260) —
  a v2 refinement, not the v1 default. 25% of the cohort (223 players) has no
  draft record at all (international signees, plus a few NPB-posting
  veterans) and that tier currently conflates two very different
  populations — needs splitting before it ships.
- **No historical Top 100 archive exists to build pedigree from.** This
  app's own snapshot (`docs/top-prospects.md`) only started 2026-07-07 —
  seven weeks, useless for a cohort spanning 2013–2023 draft classes. Keep
  the weekly snapshot running regardless of what ships now; in a few years
  it's a real, time-anchored archive nothing else here can substitute for.
- **Calendar days at level** (not just PA/IP volume) — resolved for 91% of
  transitions by walking each player's own transaction-wire assignments.
  Findings: no fixed-duration norm (only 7–15% of stints land within ±15
  days of a full year); real organizational variance (AAA medians run
  82 days to 476 days across orgs, n=8–25 each — suggestive, not a trustworthy
  ranking yet); the "All-Star-break bump" is folklore — the two weeks after
  the break promote players at about the same rate as the two weeks before
  it. A player's very FIRST level's arrival date is still undated (would need
  extended-spring-training reconstruction).
- **Team-level comparisons and bust framing are both out of scope for v1.**
  Team duration rests on a real historical org sweep (not the current-
  affiliate-file approximation): season-by-season `parentOrgId` from
  `/api/v1/teams`, joined to each player's own minor-league team per stint.
  **Result: not ready for a per-team engine yet.** Org medians spread widely
  at every level with enough n (AAA: Reds 82d vs. Rangers 476d, n=8–27 per
  org) — real signal, not noise, per `docs/team-movement-windows.md`. But
  each org's own p25–p75 window is wide enough on this cohort that **zero of
  the 25–30 orgs per level sit fully outside the pooled p25–p75 window** —
  the spread between orgs is smaller than the spread within one org. A
  reader could not yet tell "the Reds move players fast" from "this Reds
  player happened to move fast." Needs either a wider cohort (more seasons,
  at the cost of reaching further from current practice) or a different
  estimator than a per-org median before it ships as a range. A-level has no
  org cut at all — see the note above on undated first-level arrivals.
  Busts (players who never graduated) are a different, harder cohort: no
  clean "end of career" signal for someone released or still active.
  Unbuilt.

## Where the work lives

The pull/analyze/date-resolution scripts (not committed as app code — this
was a research spike) are in `.scratch/level-benchmarks/`: `pull.mjs`
(cohort + yearByYear sweep → `raw.json`), `analyze.mjs` (reconstruction +
ordering validation → `findings.json`), `dates.mjs` + `org-and-timing.mjs`
(calendar-date resolution + historical org mapping →
`dates.json`/`org-timing.json`), `team-windows.mjs` (per-org, per-level
p25/median/p75 movement windows + the overlap check →
`team-windows.json`, `docs/team-movement-windows.md`). Reuse these before
re-pulling from statsapi if this benchmark gets rebuilt or widened.

**`txn-cache.json`** (13 seasons of full transaction dumps, ~62MB) is
**gitignored, not committed** — over GitHub's file-size warning threshold.
It's still cheap to rebuild: `dates.mjs`/`org-and-timing.mjs` populate it on
demand, ~13 season-long pulls. If it's missing on a fresh checkout, just
re-run those scripts; they'll re-fetch and re-cache it locally.
