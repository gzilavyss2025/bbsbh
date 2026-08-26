# Roster age, with the trade deadline cut out

Research spike #8, 2026-08-26. Direct follow-up to `docs/team-success-roster-age.md`,
which flagged its own biggest open worry: a team's SEASON-LONG age counts every
veteran added at the trade deadline, and a club already winning in July is
exactly the club that goes out and rents one. This spike answers that worry
literally, not by reweighting for who actually played in October (that is
`docs/team-success-postseason-usage.md`, a different check) but by throwing out
every plate appearance and inning a team accrued **after July 31** before
computing its age at all. If a player was added at the deadline, he now
contributes nothing to his team's measured age, full stop.

**The answers, in order of weight.**

1. **Cutting the deadline out shrinks the age effect, and it shrinks the two
   sides of the roster very differently.** Pre-deadline pitching age keeps
   about three-quarters of the whole-season correlation with how far a team
   goes; pre-deadline batting age keeps only about half. Whatever the
   whole-season roster-age finding was picking up, roughly half of the
   batting side of it was a trade-deadline artifact, and most of the pitching
   side was not.
2. **That shrinkage is a real, measured effect, not a coincidence of running
   two numbers off the same rows.** A season-level bootstrap on the gap
   between the whole-season correlation and the pre-deadline correlation
   comes back positive and clearly away from zero for both sides of the
   roster.
3. **The one number that actually flips from a real finding to a shrug: the
   World Series-winner batting-age gap.** Whole-season, champions' hitters run
   noticeably older than the league and the gap was a real result. Cut the
   deadline out, and the gap shrinks and stops clearing the bar for "probably
   not chance" — at a sample of one champion a year, this is the single
   thinnest comparison in the whole program, and it should be read as a
   caution, not as a reversal of "batting age doesn't matter for champions."
   The equivalent pitching-side gap barely moves at all.
4. **Everything else about the original spike's shape survives untouched.**
   The postseason-qualification bands still widen the deeper a team goes; the
   division-winner-versus-wild-card comparison is still a real nothing.
   Nothing here changes those conclusions.
5. **This is a genuinely new number, not a restatement of the postseason-usage
   follow-up.** That spike kept the whole-season age numbers and reweighted
   them by how much a player actually played in October — and a deadline
   rental who does play in October still counts fully there. This spike does
   something stricter: a player added at the deadline contributes zero to his
   new team's age, whether or not he ever takes the mound in the postseason.
   The two are compatible, not competing: deadline pickups get real playing
   time (that spike's finding) AND removing their regular-season stat line
   still measurably weakens the age-to-outcome correlation, mostly on the
   batting side (this spike's finding). Worth saying plainly: spike #1's own
   "what would move this next" section had marked "a pre-deadline age cut" as
   largely superseded by the postseason-usage follow-up. Having now actually
   run it, that call does not hold up — the two measure different mechanisms,
   and this one turns up a real, previously unmeasured result the other could
   not have found.

## What "pre-deadline age" means

Same weighting convention as `docs/team-success-roster-age.md` — plate-appearance-
weighted mean age for hitters, innings-pitched-weighted mean age for pitchers,
both expressed relative to that season's own league-wide average — but every
player-team stint is now pulled through `GET /api/v1/stats?stats=byDateRange`
bounded to **March 1 through July 31** of that season, instead of the whole
year. A player traded at the deadline shows up under his OLD team for his
pre-deadline share of the season and simply does not appear under his new
team at all, because he has no PA or IP with that club before the cutoff.
Confirmed live before building the sweep: this endpoint carries no `age`
field of its own (forcing the same cache-join design spike #1 used, against
the season-level age lookup already built), and a March 1 start date returns
zero rows before Opening Day, so nothing from spring training leaks in.

## The data

750 team-seasons, 2000-2025 excluding 2020, the same population as spike #1
and the outcome ladder. 780 team-seasons with 2020 folded back in changes
every number by a hair (no sign flips), matching the pattern spike #1 already
established for that same inclusion choice. The pre-deadline pull is a fresh
statsapi sweep, 1,560 calls (30 teams times 26 seasons times two stat
groups), fully cached; of 38,519 player-team stints pulled, every single one
matched an age from the existing season-level cache with zero misses.

## The result

```
750 team-seasons, 2000-2025 excluding 2020

Spearman rho vs. the 0-5 outcome ladder, pre-deadline vs. whole-season:
  battingAgeRelative:  pre-deadline 0.106  vs. whole-season 0.205  (52% retained), p=0.0046
  pitchingAgeRelative: pre-deadline 0.208  vs. whole-season 0.282  (74% retained), p<0.0001
  rosterAgeRelative:   pre-deadline 0.190  vs. whole-season 0.289  (66% retained), p<0.0001

Season-level bootstrap on the GAP (whole-season minus pre-deadline rho), 95% interval:
  batting:  +0.099  [0.081, 0.116] -- clearly above zero
  pitching: +0.074  [0.052, 0.097] -- clearly above zero
  roster:   +0.099  [0.077, 0.124] -- clearly above zero
```

**Band comparisons, pre-deadline age** (mean age relative to that season's own
pre-deadline league average, in years; whole-season spike #1 figures in
parentheses):

| Cut | Batting age | Pitching age |
| --- | --- | --- |
| Made the postseason (n=234) vs. did not (n=516) | +0.29yr (was +0.55yr), p=0.0038 | +0.63yr (was +0.83yr), p<0.0001 |
| Reached the LCS or better (n=100) vs. did not (n=650) | +0.50yr (was +0.72yr), p=0.0004 | +0.83yr (was +0.99yr), p<0.0001 |
| Won the World Series (n=25) vs. everyone else (n=725) | +0.48yr (was +0.71yr), p=0.08 (was p=0.0058) | +1.20yr (was +1.31yr), p<0.0001 |

Division winners (n=150) vs. wild card (n=84) among postseason clubs, pre-
deadline: batting diff +0.23yr, p=0.21 (was p=0.31); pitching diff -0.09yr,
p=0.69 (was p=0.49). Both null, both unchanged in conclusion from spike #1.

Robustness: same sign in 25/25 leave-one-season-out refits AND, checked
independently during verification, 30/30 leave-one-club-out refits (the
single most influential club, the Yankees, still leaves a clearly positive
correlation when excluded). Every headline correlation and band difference
clears a permutation test except the World Series-winner batting cut, which
is exactly the number flagged above as fragile. A paired test on the age
measure itself (not the correlation, the age number directly) shows most
team-seasons involve no age-moving deadline trade at all — the correlation
drop is driven by concentration among contenders who buy at the deadline, not
a uniform shift across the league.

**Spot check.** The 2014 Oakland A's, the marquee Jon Lester trade-deadline
case from the postseason-usage follow-up: pre-deadline pitching innings were
977⅓ against a whole-season total of 1,463⅓, and the team's pitching age
relative to league moves from -0.61 (pre-deadline) to -0.26 (whole-season) —
the expected size and direction for adding a proven 30-year-old starter for
the stretch run.

Including 2020 (n=780) moves every number above by 0.01 to 0.02 with no sign
flips.

## What this does not settle

- **This measures how much of the age effect is a deadline artifact, not
  whether the surviving effect is causal.** Every caveat from
  `docs/team-success-roster-age.md` still applies to the pre-deadline number
  on its own: no payroll control, and "an established, valuable player is
  older because staying valuable takes years" remains a live alternative
  explanation independent of any trade-deadline story.
- **The World Series-winner flip is the thinnest comparison in this whole
  program.** Twenty-five champions across the whole window, one per year,
  with no way to grow that number from this data source. Read it as "batting
  age's headline result at the very top of the ladder is disproportionately a
  deadline story," not as a settled claim that batting age does not matter
  for champions.
- **This complements `docs/team-success-postseason-usage.md`; it does not
  duplicate or simply extend it.** That spike reweights the whole-season age
  number by actual October playing time, which still fully credits a
  productive deadline rental. This spike zeroes a deadline pickup's
  contribution outright, whether or not he ever appears in October. They are
  different mechanisms and the results are compatible, not contradictory —
  but it is worth being direct that spike #1's own follow-up section had
  called this exact idea "largely superseded" before it was actually run, and
  that call turned out to be wrong. The postseason-usage spike answered "did
  the deadline additions who count toward this measure actually play" (yes);
  this spike answers a different question, "does excluding their regular-
  season stat line change the correlation at all" (yes, especially for
  batting), and both are needed to understand the original finding fully.
- **Leave-one-club-out was not part of this spike's own build**, only leave-
  one-season-out, matching spike #1's choice of robustness check. It was run
  independently during verification and passed cleanly (30/30 same sign, both
  measures) — a future pass should fold it into the script's own robustness
  suite rather than leaving it a one-off check.
- **This spike deliberately left `docs/team-success-research.md`,
  `docs/team-success-roster-age.md`, `scripts/research-db.mjs`, and the diary
  index untouched**, per its own scope. The original spike's "largely
  superseded" framing of a pre-deadline cut is now known to be wrong, per the
  point above, but correcting that framing in the original document is a
  synthesis-step decision, not made here (the diary rule against editing an
  old entry to agree with a new one applies to the write-up too).

## Where the work lives

`.scratch/team-success/`:
- **`build-roster-age-deadline.mjs`** → `roster-age-deadline.json` — the
  pre-deadline (through July 31) per-team-season PA/IP pull via
  `byDateRange`, cached in `roster-age-deadline-cache.json` (1,560 calls, free
  to re-run).
- **`analyze-roster-age-deadline.mjs`** — joins `roster-age-deadline.json`
  against the existing `roster-age.json` and `outcome-ladder.json`, and
  produces every statistic above: the pre-deadline vs. whole-season Spearman
  comparison, the season-level bootstrap on the gap, leave-one-season-out,
  the band and division-winner comparisons, the 2014 A's spot check, and the
  2020-included sensitivity run.

This panel was built via a direct two-file JSON join rather than through the
shared DuckDB layer (`scripts/research-db.mjs`), because that script was
locked by a concurrent session's process during this work — the same fallback
pattern spike #1's own analysis script used before the DuckDB layer existed.
A later pass should register `roster-age-deadline.json` as a DuckDB view
alongside the existing roster-age panel.
