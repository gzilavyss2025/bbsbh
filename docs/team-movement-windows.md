# Team movement windows — research spike

Follow-up to `docs/level-tenure-benchmark.md`, which flagged team-level
comparisons as measured but unshipped. This spike asks the concrete
question: **can we turn "days at level, by org" into a per-team estimated
movement range?** Short answer: not yet — and a second pass with 3.5x the
data confirmed that, rather than overturning it.

## Method

Two runs, same technique:

1. **v1** — the level-tenure benchmark's 881-player, 2019–2023-debut cohort.
2. **Widened** — 3,061 players, 2005–2023 debuts. 2005 is the floor because
   `docs/api/static-data.md` documents statsapi's own affiliate data as
   unreliable before then; the sportId level structure (AAA/AA/High-A/A)
   and player `yearByYear` stats are both stable well before that, so this
   is an org-data floor, not a stats floor (see "How far back the raw data
   actually goes" below).

For each player-level duration (`dates.json`'s `allDurations`, disputed
ordering cases excluded), resolve the organization: the player's own
minor-league team for that stint, joined against a real **season-by-season**
team→org map (`/api/v1/teams?sportId&season`, 52 calls across sportIds
11–14) — not the current affiliate file, which would mis-attribute any
player who moved through a relocated or realigned affiliate. For every
org/level cell with n≥8, compute p25/median/p75 (not just a median — a
single point estimate can't become a "range").

## Did the data change? Yes — both the pooled numbers and the per-org ones

| | v1 (881, 2019–2023) | Widened (3,061, 2005–2023) |
| --- | --- | --- |
| AAA PA before promotion | 327 [180–529] | 380 [205–557] |
| AAA IP before promotion | 54.0 [26.3–88.8] | 60.3 [28.3–112.3] |
| AAA days-at-level (median) | n=389, 250d | n=967, 171d |
| AA days-at-level (median) | n=437, 349d | n=1,277, 331d |
| High-A days-at-level (median) | n=351, 308d | n=1,034, 286d |
| Orgs meeting n≥8 (High-A / AA / AAA) | 25 / 30 / 27 of 30 | 30 / 30 / 30 of 30 |

PA/IP-at-level went **up** across the board when the older cohort is
folded in (+15–20% roughly) — the recent-only cohort needs meaningfully
less volume than the 2005–2023 average, plausibly the 2021 contraction's
roster crunch pushing faster promotion in the current era. Calendar-day
medians moved the other way, especially at AAA (250d → 171d) — treat that
shift with more suspicion than the PA/IP one: only 78% of transitions
resolved a date this run (transaction-wire coverage thins for older
seasons), so the drop may partly be a measurement artifact rather than a
real behavior change.

Per-org rankings also reshuffled with more data. The v1 fastest AAA org
(Reds, 82d median, n=15) is no longer the fastest; the widened run's
fastest AAA orgs are the Blue Jays (53d, n=21) and Nationals (55d, n=24).
That instability — a team's *rank*, not just its precision, changing when
n roughly triples — is itself evidence the v1 per-org medians weren't a
trustworthy ranking, exactly as flagged at the time.

## The finding that matters: still 0 of 30

Org medians still look like real signal — a wide spread between fastest
and slowest orgs at every level, both runs. But the question a "movement
window" feature has to answer isn't "which org has the lower median" —
it's "does this org's range actually distinguish it from the pack." It
doesn't, in either run:

| | v1 | Widened |
| --- | --- | --- |
| n per org/level cell | 8–27 | 20–61 |
| Orgs whose p25–p75 window sits fully outside the pooled window | 0 of 25–30 | 0 of 30 |

Tripling the sample and getting full 30-of-30 coverage at every level
didn't rescue the per-team-range idea — every org's own spread is still
wide enough to swallow the pooled spread. Concretely, in the widened run:
Toronto's AAA window is 35–348 days on n=21 — a 10x range for one team,
still wider than the gap between the fastest and slowest org medians. The
variance *within* one org's cohort is larger than the variance *between*
orgs, at both sample sizes.

Practically: if this shipped as "the Blue Jays typically move AAA players
in 53 days," it would read as precise. It isn't — the honest statement is
"the Blue Jays' AAA players have moved anywhere from 35 to 348 days, and
that range overlaps every other team's range too." A wider cohort was the
first, cheapest thing to try before concluding org-level windows are
unbuildable rather than just unbuilt — it's now been tried, and the
conclusion held.

## What would change this now

- **A different estimator**, not more data. A per-org median/IQR is the
  simplest cut and it's the one that failed the overlap check twice now. A
  regression that holds pedigree and level constant and estimates an org
  fixed-effect (rather than comparing raw per-org quantiles) could isolate
  org signal from the pedigree-mix confound — a team with more prep-pick
  position players will look "slow" here for reasons that have nothing to
  do with how it manages promotions.
- **Accept a coarser output.** A three-bucket fast/typical/slow label
  (org median only, window collapsed to the global one) would be honest
  about what the data supports, at the cost of being a much smaller
  feature than "estimated movement range."

## How far back the raw data actually goes

Checked directly against statsapi rather than assumed:

- **Level structure** (sportIds 11/12/13/14 = AAA/AA/High-A/A) has been
  stable since at least 2000 — only the *label* on sportId 13 changed at
  the 2021 reorg ("A(Adv)" → "High-A"), same id, same tier concept.
- **Player `yearByYear` stats** are populated at least into the early
  2000s (spot-checked against a 2001 draftee).
- **`parentOrgId` itself is essentially fully populated back to 1990** —
  0–1% missing per season, checked at 1990/1995/1998/2000/2002/2003/2004.
  So the documented "unreliable before 2005" risk is not missing cells; it
  is **silently wrong ones** — an id reused across a relocation, like the
  Colorado Springs Sky Sox/San Antonio Missions case `scripts/milb-history-
  seed.json` documents. No script can find that kind of error; it takes a
  human cross-check against an independent source (that seed file's own
  method: statsapi's season-scoped endpoint vs. Wikipedia's franchise
  history, per club).
- **Checked specifically against this cohort**: `org-gaps.mjs` cross-checks
  every (team, season) pair the 2005–2023 cohort actually touches against
  the org sweep. Zero gaps — 3,278 durations checked, 0 missing an org.
  The 2005 floor is clean for *this* cohort's own scope; the accuracy risk
  above only bites if the cohort is pushed earlier.

**If someone wants to hand-verify affiliate history** (which would let a
future run push past 2005, or firm up spots the current sweep already
trusts but hasn't been cross-checked), `org-gaps.mjs` also ranks the 176
distinct minor-league team ids this cohort touches by how many cohort
players pass through them — research time is best spent on the top of
that list, not spread evenly. Top 5: Oklahoma City RedHawks (n=410),
Buffalo Bisons (n=390), Round Rock Express (n=386), Syracuse Chiefs
(n=377), Tacoma Rainiers (n=374). Full ranked list in
`.scratch/level-benchmarks/org-gaps.json`. Add findings to
`scripts/milb-history-seed.json` in its existing format — that file
already feeds the shipped Minors tab "Affiliation history" strip
(`src/api/milbHistory.js`), so verified entries help there immediately;
wiring this research pipeline (`team-windows.mjs`, `org-and-timing.mjs`)
to prefer the seed over the raw sweep is unbuilt, not yet needed since
today's window has zero measured gaps.

## Where the work lives

`.scratch/level-benchmarks/team-windows.mjs` — reuses `org-and-timing.mjs`'s
historical org sweep, extends it to all four levels, computes p25/p75 (not
just median), and runs the overlap check. Output: `team-windows.json`.
`org-gaps.mjs` cross-checks the org sweep against every duration the
cohort actually uses and ranks team ids by cohort impact. Output:
`org-gaps.json`. Both depend on `raw.json`, `dates.json`, `findings.json`
already in that directory (now built from the widened 2005–2023 pull —
`pull.mjs`'s `DEBUT_YEAR_MIN` is 2005); `txn-cache.json` is gitignored
(~65MB, now spans 1997–2023) but cheap to rebuild — see
`docs/level-tenure-benchmark.md`.
