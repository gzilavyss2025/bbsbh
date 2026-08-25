# Roster age and postseason depth

Research spike, 2026-08-25. First factor spike under
`docs/team-success-research.md` — the age-of-roster question was picked to
run first because its data path needed no external source and no new
classifier, to prove the outcome-ladder pipeline end to end.

**The question.** Relative to that season's own league average, does an
older roster correlate with going deeper in the postseason? And does it
separate division winners from wild-card teams among clubs that already
qualified?

**The answers.**

1. **Older teams go deeper, and it is real, not noise.** Both batting age and
   pitching age correlate positively with the outcome ladder (0-5), survive a
   permutation test at p<0.0001, and hold the same sign in every one of 25
   leave-one-season-out refits. **Pitching age carries the larger effect.**
2. **The gap widens the deeper a team goes**, most sharply on the pitching
   side: World Series winners' pitching staffs run **1.3 years older** than
   league average, against a league-wide gap of essentially zero.
3. **Age stops mattering once a team is already in the tournament.** Among
   postseason teams, division winners and wild-card teams have statistically
   indistinguishable ages (p=0.31 batting, p=0.49 pitching). Whatever age
   buys, it buys on the way IN, not once you're there.
4. **This is very likely partly circular, and the write-up says so before
   anyone else has to.** A team already good enough to contend routinely adds
   proven veterans at the trade deadline — which raises exactly the
   full-season age number this spike measures, as a CONSEQUENCE of being good
   rather than a cause of it. See "What this does not settle."

## What "age," here, means

**Batting age**: each team-season's plate-appearance-weighted mean of
statsapi's own `stat.age` field, one row per player PER TEAM STINT (see
the trap below). **Pitching age**: the same, weighted by innings pitched
(baseball's fractional notation — "121.1" is 121⅓ innings — converted to
decimal before weighting). Both are then expressed **relative to that
season's own league-wide weighted average** — the same "compare a team to
its own year" discipline `gen-team-score.mjs` already applies elsewhere in
this app — so a 2003 team and a 2023 team are read on the same scale despite
whatever the league's age profile did over 20 years.

statsapi's `age` value is used as reported rather than re-derived from a
birthdate; this spike did not independently verify which reference date it
uses internally. Good enough for a same-season relative comparison, which is
all this question needs.

### The trap this almost fell into

`GET /api/v1/stats?stats=season&group={hitting,pitching}&season=YYYY&sportId=1
&playerPool=all` — the SAME endpoint, called with no `teamId` filter — collapses
a player traded mid-season to a **single row under his final team, carrying his
whole-season total**. Verified live: Lucas Giolito's 2023 (White Sox → Angels →
Guardians) shows up in the unfiltered pull as a Guardian with 184⅓ innings, his
combined season total. Passing `teamId` as a filter on the identical endpoint
returns the correct, team-specific STINT instead — the same query scoped to
`teamId=145` (Chicago) returns him as a White Sox pitcher at 121 innings,
matching a direct per-player breakdown exactly. This spike calls the endpoint
once per team per season (1,560 calls total, cached), never the unfiltered
version, for exactly this reason. Anyone reusing this endpoint for a different
factor spike needs to know this before trusting it.

`playerPool=all` is the second requirement — without it, the endpoint
defaults to batting-title/ERA-title qualifiers only (roughly 500+ PA/IP),
silently dropping every bench player and reliever and biasing the weighted
age toward whoever played every day.

## The data

780 team-seasons, 2000-2025 (30 teams × 26 seasons) — the same population as
the outcome ladder. 2020 is EXCLUDED from every headline number below
(pandemic-shortened, 16-team field; see `docs/team-success-research.md`) but
changes nothing meaningful when included — a sensitivity check with it folded
back in moves every statistic below by 0.01-0.05, never a sign flip.

## The result

```
750 team-seasons, 2000-2025 excluding 2020

Spearman rho vs. the 0-5 ladder (permutation p, 5,000 draws, shuffled WITHIN season):
  battingAgeRelative   rho=0.205   p<0.0002   same sign in 25/25 leave-one-season-out
  pitchingAgeRelative  rho=0.282   p<0.0002   same sign in 25/25 leave-one-season-out
  rosterAgeRelative    rho=0.289   p<0.0002   same sign in 25/25 leave-one-season-out
  (rosterAgeRelative = the mean of the batting and pitching relative ages)
```

Effect sizes are modest, and stating that plainly matters more than the
p-values: rho≈0.2-0.3 means age explains something on the order of 4-8% of
the variance in how far a team goes, not most of it. Consistent with a real
lever among many, not the lever.

**Band comparisons** (mean age relative to that season's league average, in
years):

| Cut | Batting age | Pitching age |
| --- | --- | --- |
| Made the postseason at all (n=234) vs. did not (n=516) | +0.37 vs. −0.18 (diff +0.55, p<0.0002) | +0.57 vs. −0.26 (diff +0.83, p<0.0002) |
| Reached the LCS or better (n=100) vs. did not (n=650) | +0.62 vs. −0.10 (diff +0.72, p<0.0002) | +0.86 vs. −0.13 (diff +0.99, p<0.0002) |
| Won the World Series (n=25) vs. everyone else (n=725) | +0.68 vs. −0.03 (diff +0.71, p=0.0058) | +1.26 vs. −0.05 (diff +1.31, p<0.0002) |

The gap on the pitching side roughly **triples** from "made the postseason at
all" to "won it all" (+0.83yr → +1.31yr); the batting-side gap barely moves
past the first cut. Whatever this effect is measuring, it looks more like a
pitching-staff story than a lineup story.

**Division winners vs. wild-card teams, restricted to the 234 clubs that
already made the postseason:**

| | Division winners (n=150) | Wild card (n=84) | diff | permutation p |
| --- | --- | --- | --- | --- |
| Batting age | +0.44 | +0.26 | +0.18 | 0.31 |
| Pitching age | +0.51 | +0.67 | −0.15 | 0.49 |

Both null, and the pitching-age difference even runs the opposite sign from
the headline story. Age separates "made it" from "didn't"; it does not
separate "won the division" from "snuck in on a wild card."

## What this does not settle

- **This is very likely partly circular, and that is the most important
  caveat on the page.** A team's SEASON-LONG age includes every trade
  deadline move. A club that is already winning in July is exactly the club
  that goes out and rents a 34-year-old proven starter or a veteran bat for
  the stretch run — which raises that team's own measured age BECAUSE it was
  already good enough to be a buyer, not the other way around. This spike
  cannot separate "an older roster wins" from "winning teams become older, by
  their own trade-deadline choices, as a result of winning." A pre-deadline
  age cut (say, roster age as of June 30) is the natural next check and is
  not built yet.
- **Nothing here is causal even setting that aside.** Established, valuable
  players are often older simply because staying valuable long enough to be
  established takes years; this may be substantially a proxy for "already has
  good players" rather than age doing anything on its own.
- **No payroll control.** An older roster is very plausibly correlated with a
  higher payroll — the classic "these are both proxies for a good, expensive
  team" problem — and payroll cannot be tested here at all
  (`docs/team-success-research.md`'s payroll factor is blocked on a data
  source). This is the same gap the prospect-research homegrown-dependence
  spike hit.
- **The division-winner null is a genuine non-effect at the sample size
  available (n=150 vs. 84, p nowhere close to significant), not proof of an
  exact zero.** A modest real effect could hide in a sample this size.
- **A handful of pitching-stint rows are position players making mop-up
  appearances** (e.g. a position player pitching a blowout's final inning).
  IP-weighting keeps their influence on the team average negligible — a
  1-inning outing barely moves a ~1,400-inning team total — but they were not
  filtered out explicitly.

## Follow-up done: does who actually played in October confirm this?

**Yes.** `docs/team-success-postseason-usage.md` reweights each postseason
team's age by ACTUAL postseason playing time instead of full-season role.
The result barely moves (0.09yr batting, −0.01yr pitching), and pitching age
still predicts postseason depth within the postseason field alone (p=0.0070) —
the age effect above is not primarily a trade-deadline-rental artifact. Read
that document for the full check, including a mechanical trap it caught
before it could ship as a wrong-signed finding.

## What would move this next

- ~~A pre-deadline age cut~~ — largely superseded by the postseason-usage
  follow-up above, which answers the same underlying worry more directly (did
  the players who count toward this measure actually play, rather than merely
  guessing at a date before which they probably hadn't been added yet).
- **A payroll control**, if a historical source is ever found.
- Splitting pitching age further — starters vs. relievers — since "the
  pitching-age gap triples toward the World Series" is exactly the kind of
  result that might really be about one or the other.

## Where the work lives

`.scratch/team-success/`:
- **`build-roster-age.mjs`** → `roster-age.json` — the per-team-season pull
  and the PA/IP-weighted age computation, cached in `roster-age-cache.json`
  (1,560 calls, so a rerun costs nothing).
- **`analyze-roster-age.mjs`** — joins `roster-age.json` against
  `outcome-ladder.json` and runs every statistic above: Spearman correlation,
  the within-season permutation test, leave-one-season-out, and the band/
  division-winner comparisons. Re-run for the 2020-included sensitivity check
  with no code change — it is the same script's second `report()` call.
