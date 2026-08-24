# Team movement windows — research spike

Follow-up to `docs/level-tenure-benchmark.md`, which flagged team-level
comparisons as measured but unshipped. This spike asks the concrete
question: **can we turn "days at level, by org" into a per-team estimated
movement range?** Short answer: not yet, on this cohort — write-up below is
the evidence for that call, so the next attempt doesn't have to re-derive it.

## Method

Same 881-player, 2019–2023-debut cohort as the level-tenure benchmark. For
each player-level duration (`dates.json`'s `allDurations`, disputed
ordering cases excluded), resolve the organization: the player's own
minor-league team for that stint, joined against a real **season-by-season**
team→org map (`/api/v1/teams?sportId&season`, 52 calls across sportIds
11–14 and seasons 2010–2023) — not the current 2026 affiliate file, which
would mis-attribute any player who moved through a relocated or realigned
affiliate.

For every org/level cell with n≥8, compute p25/median/p75 (not just a
median — a single point estimate can't become a "range").

## The numbers

Days at level, p25–p75 (median), by org, n≥8 only:

**High-A** (25 of 30 orgs meet n≥8; global pooled window 115–444d):

Fastest few: Orioles n=10 82–280d (96), Braves n=13 99–308d (118), Angels
n=11 70–344d (124). Slowest few: Padres n=10 288–763d (687), Royals n=14
380–759d (690), Blue Jays n=10 354–710d (608).

**AA** (30 of 30 orgs; global pooled window 113–457d):

Fastest: Cubs n=19 95–718d (161), Royals n=18 115–418d (211), Angels n=18
65–386d (212). Slowest: White Sox n=14 277–685d (452), Mariners n=13
283–629d (454).

**AAA** (27 of 30 orgs; global pooled window 60–371d):

Fastest: Reds n=15 47–276d (82), Yankees n=9 45–253d (107), Rockies n=11
72–307d (141). Slowest: Milwaukee n=16 54–544d (387), Texas n=9 45–533d
(476).

**A**: zero orgs qualify. A player's first level's arrival date is
undated in this reconstruction (would need extended-spring-training
records) — so no duration, and no org cut, exists at A yet.

Full per-org rows: `.scratch/level-benchmarks/team-windows.json`.

## The finding that matters: medians spread, windows don't separate

Org medians look like real signal — a 6x gap between the fastest and
slowest AAA org (Reds 82d vs. Rangers 476d) isn't sampling noise dressed
up as a ranking. But the question a "movement window" feature has to
answer isn't "which org has the lower median" — it's "does this org's
range actually distinguish it from the pack."

It doesn't, not on this cohort. At every level with coverage, **0 of the
25–30 qualifying orgs have a p25–p75 window that sits fully outside the
pooled (all-org) p25–p75 window.** Every org's own spread is wide enough
to swallow the global spread. Concretely: Cincinnati's AAA window is
47–276 days on n=15 — that's already a 5.9x range for one team, wider than
the median gap between the fastest and slowest orgs. The variance *within*
one org's cohort is larger than the variance *between* orgs at this sample
size.

Practically: if this shipped as "the Reds typically move AAA players in
82 days," it would read as precise. It isn't — the honest statement is "the
Reds' AAA players have moved anywhere from 47 to 276 days, and that range
overlaps every other team's range too."

## What would change this

- **A wider cohort.** n=8–27 per org/level cell is thin for a spread
  estimate (medians need much less data than the tails). A 2015–2023
  window (~1,600 players per the level-tenure doc's own trade-off) would
  roughly double most cells — worth retrying `team-windows.mjs` against
  that pull before concluding org-level windows are unbuildable, not just
  unbuilt with today's n.
- **A different estimator.** A per-org median/IQR is the simplest cut and
  it's the one that failed the overlap check. A regression that holds
  pedigree and level constant and estimates an org fixed-effect (rather
  than comparing raw per-org quantiles) could isolate org signal from the
  pedigree-mix confound — a team with more prep-pick position players will
  look "slow" here for reasons that have nothing to do with how it manages
  promotions.
- **Accept a coarser output.** Instead of one movement range per org, a
  three-bucket fast/typical/slow label (using each org's median only,
  with the window collapsed into the global one) would be honest about
  what the data actually supports, at the cost of being a much smaller
  feature than "estimated movement range."

## Where the work lives

`.scratch/level-benchmarks/team-windows.mjs` — reuses `org-and-timing.mjs`'s
historical org sweep, extends it to all four levels, computes p25/p75 (not
just median), and runs the overlap check. Output: `team-windows.json`.
Depends on `raw.json`, `dates.json`, `findings.json` already in that
directory; `txn-cache.json` is gitignored (~62MB) but cheap to rebuild —
see `docs/level-tenure-benchmark.md`.
