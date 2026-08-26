# Exit-reason mix: does a clean promotion beat a forced one?

Research spike #11, 2026-08-26. Draws on the same 962-stay Triple-A cohort
`docs/price-the-blockage.md` built (2009-2023), joined to the outcome ladder
by season and team. `docs/team-success-joint-model.md`'s org-tenure lead
flagged this cohort as worth a second look from a different angle: that
spike measures how LONG a player waits at Triple-A; this one measures WHY
his wait ends.

**The question.** When an organization's Triple-A roster empties out, most of
the seats open up because a player earned a promotion. Some open up because
he got hurt, because a roster rule forced a move, or because he got traded.
Does an organization that promotes mostly on merit, rather than mostly by
attrition, go further in October that same season?

## The answer

**No.** Across every way this spike sliced the data, an organization's share
of merit promotions does not predict how far its major-league club goes.
Spearman rho ranges from -0.04 to +0.14 across three volume cuts of the
data, none clears even a loose p<0.10 bar, and the sign itself flips
depending on which cut is used, which is itself a sign of a genuine null
rather than a small real effect buried in noise.

`docs/team-success-joint-model.md` found one place a related measure
(homegrown share, not merit share, a different classifier entirely) told
division winners apart from wild-card teams among postseason clubs. That
result does not repeat here. If anything it runs backward: among 115
postseason organization-seasons (2009-2023), division winners actually ran
a LOWER merit-promotion share than wild-card teams (56.0% versus 64.8%),
and that gap is not significant either (permutation p=0.23; an
era-controlled logistic fit says the same, p=0.33).

Every band comparison tried, made the postseason versus not, reached the
League Championship Series or better versus not, won the World Series
versus not, comes back null and small, several running the "wrong" way
(a slightly higher merit share going with a slightly worse outcome, never
significantly).

## Why the panel is thin, and what was done about it

This is a genuinely thin panel by construction. Of the 450 possible
organization-season cells (30 organizations times 15 seasons), 359 carry at
least one exit that this spike could classify. The median cell has only two
classified exits, and 129 cells have exactly one, which means their merit
share is mechanically either 0% or 100%, with no real precision behind
either number.

A volume control (holding the count of exits fixed via partial
correlation) does not change the conclusion at all: the raw correlation
of -0.0395 barely moves to -0.0398 once exit volume is accounted for.
Restricting to the least noisy cut, organization-seasons with three or
more classified exits (147 of the 359 cells), still does not clear
conventional significance, and the correlation actually flips sign there
(to +0.14, p=0.10) rather than strengthening in one direction, which reads
as further evidence of a real null rather than a signal that a bigger
sample would firm up.

## Method

**Where the classification comes from.** `docs/price-the-blockage.md`
already reads each Triple-A exit's own transaction description and tags it
merit (an outright promotion), injury, roster-rule, or trade. This spike
reuses that read rather than re-pulling statsapi: 899 of the 962 stays
carry one of those four core exit reasons (573 merit, 187 roster-rule, 137
injury, 2 trade); 47 more are demotions or exits that resolved earlier and
are not "why a promotion happened," so they are set aside; 16 have no
matching transaction at all and are the same "unresolved" cases
`docs/price-the-blockage.md` already reports as unresolved.

**Recovering which organization each exit belongs to.** No file in this
worktree carries organization identity directly on each stay, so this spike
parsed the acting team out of the transaction's own description text
(the same text price-the-blockage.md already fetched and cached, no new
network pull). That matched 946 of the 962 stays, exactly the ones with a
transaction at all. One nickname-collision trap turned up along the way and
was fixed before trusting any result: a transaction that reads, for
example, "Pittsburgh Pirates recalled a player from Indianapolis Indians"
can be misread as a Cleveland move if a parser matches "Indians" before it
matches "Pittsburgh." Anchoring the search on the text before the
transaction's verb fixed it, and the fix was checked against two of the
program's own named ground-truth cases (Tauchman to Colorado in 2017, Riley
to Atlanta in 2019), both correct.

**The measure.** For each organization-season, merit share is the count of
merit promotions divided by the count of merit, roster-rule, injury, and
trade exits together. Every correlation below is a Spearman rank
correlation against the outcome ladder's 0-5 scale, checked with a
permutation test that shuffles within season 5,000 times so it can't be
fooled by one unusually good or bad year across the whole league.

## Checking two named worries from the prior spike

`docs/blockage-exit-reason-join.md` (the PR that first classified these
exits) flagged two ways its own classification could be hiding a real
signal. Both were checked here and neither rescues one:

- **Trades are too rare to matter.** Only 2 of 899 classified exits are
  trades, confirmed by counting rather than assumed, so a trade cannot be
  driving anything at this level of grouping.
- **The "other" bucket doesn't hide an opposite-signed effect.** Splitting
  roster-rule-only exits (334 of them) from injury-only exits (322 of them)
  and correlating each against the ladder separately gives two more small,
  same-direction nulls (roughly flat and slightly negative), not one
  positive and one negative canceling out inside the pooled measure.

## A second look at the organization level

As an independent, less-noisy cross-check, this spike also pooled every
organization's exits across the whole 2009-2023 window (not season by
season) and compared its overall merit share to its average ladder finish
over that span. Thirty organizations, one number each. That check agrees
with the null (rho=0.065) and it turns up a vivid illustration of why a
high merit share is not the same as winning: the Seattle Mariners have both
the highest merit share of any organization in the window (86.2%, meaning
their Triple-A roster rarely had a good enough incumbent to block a
prospect) and the lowest average ladder finish, matching the club's
well-known long stretch without a postseason trip.

This organization-level check is the least stable number in the whole
spike. Dropping a single organization moves its correlation from close to
zero to as high as 0.17, depending on whether Houston or Seattle is the one
removed. It was always meant as a secondary sanity check, not the main
result, and it stays near zero and non-significant under every removal
tried, but the specific 0.065 figure, and the Mariners/Astros illustration
built on it, should be read as a picture of the data, not a precise
estimate.

## The full numbers

```
DATA: 962 Triple-A stays (2009-2023), joined to the outcome ladder by
(season, teamId). Acting-team recovery: 946/962 matched (the 16 unmatched
are exactly price-the-blockage.md's own "unresolved" no-transaction stays).
899 of the matched stays carry one of the four core exit reasons: merit
573, roster-rule 187, injury 137, traded 2. 47 more (demoted/settled
earlier) are excluded from the mix measure.

MEASURE: meritShare = merit / (merit + rosterRule + injury + traded), per
organization-season. 359 of a possible 450 organization-season cells (30
orgs x 15 seasons) carry at least one classified exit. Exits per cell:
median 2, mean 2.50, 129 cells at exactly 1, 83 at 2, 147 at 3 or more.

MAIN RESULT, Spearman rho versus the 0-5 ladder (permutation p, 5,000
draws, shuffled within season):
  total >= 1 exit (n=359): rho=-0.0395, p=0.4516; partial rho controlling
    for exit volume=-0.0398; same sign in 15/15 leave-one-season-out and
    30/30 leave-one-organization-out refits
  total >= 2 exits (n=230): rho=-0.0422, p=0.5162; partial rho=-0.0310;
    same sign in 15/15 and 30/30 refits
  total >= 3 exits (n=147, the least noisy cut): rho=+0.1386, p=0.1010;
    partial rho=+0.1423; same sign in 14/14 and 30/30 refits (the sign
    flip between cuts is itself read as evidence for a genuine null, not
    a small effect obscured by noise)

BAND COMPARISONS (mean meritShare, total >= 1 exit, n=359):
  Made the postseason (n=115) vs not (n=244): 59.5% vs 63.4%, diff -3.9pp,
    permutation p=0.3454
  Reached the LCS or better (n=45) vs not (n=314): 61.6% vs 62.2%, diff
    -0.6pp, permutation p=0.9236
  Won the World Series (n=12) vs not (n=347): 59.7% vs 62.2%, diff -2.5pp,
    permutation p=0.8318

DIVISION WINNER VS WILD CARD (postseason organization-seasons only,
n=115): division winners (n=70) 56.0% vs wild card (n=45) 64.8%, diff
-8.8pp, permutation p=0.2300. Era-controlled logistic fit,
wonDivision ~ meritShare_z + era: meritShare_z beta=-0.196, se=0.202,
p=0.333, odds ratio=0.822; McFadden pseudo-R2=0.0195, era terms also not
significant (p=0.28-0.93).

ORDERED LOGIT (proportional odds), ladder(0-5) ~ meritShare_z (season-
relative) + log(exitVolume)_z + era dummies, n=359: meritShare_z
beta=-0.0964, se=0.1089, p=0.3757, odds ratio=0.908; logExitVolume_z
beta=-0.0587, p=0.5990. Era terms: wildcard-game era odds ratio=1.63
(p=0.18), pandemic-expanded era odds ratio=2.38 (p=0.14), expanded-3-wild-
card era odds ratio=2.01 (p=0.11), none significant, model well-identified
(Hessian invertible). Dropping 2020 outright instead of dummying it
(n=342) moves nothing: meritShare_z beta=-0.0953, p=0.3955.

ADDITIONAL SPECIFICATIONS run during verification, not in the original
build: raw Pearson correlation -0.015 (same sign, same null); logistic
madePostseason ~ meritShare_z + volume + era, beta=-0.111, p=0.325, same
direction as the ordered logit; merit-share tercile means 0.739/0.655/0.719,
non-monotonic, consistent with a genuine null rather than a real
relationship a linear-only test would miss.

CONFOUND CHECKS: traded exits are 2 of 899 classified exits (0.2%),
confirmed by direct count, too rare at this grain to matter. Splitting
"other" into roster-rule-only (n=334, rho vs ladder=+0.0035) and injury-
only (n=322, rho=-0.0343): both null, both roughly the same sign as the
pooled -0.0395, no hidden opposite-sign cancellation.

ORGANIZATION-LEVEL SENSITIVITY CHECK (30 organizations, meritShare pooled
across all 2009-2023 exits vs mean ladder rung over the same window):
Spearman rho=0.0646. Highest meritShare: Seattle Mariners 86.2% (29
exits, mean ladder 0.13), LA Angels 83.3% (24 exits, ladder 0.27), Houston
Astros 81.0% (42 exits, ladder 1.93), Colorado Rockies 76.7% (30 exits,
ladder 0.27), Boston Red Sox 74.3% (35 exits, ladder 1.07). Lowest:
Washington Nationals 38.1% (21 exits, ladder 0.60), San Francisco Giants
45.5% (22 exits, ladder 1.20), Cincinnati Reds 48.0% (25 exits, ladder
0.27), Minnesota Twins 50.0% (26 exits, ladder 0.47), Detroit Tigers 51.4%
(35 exits, ladder 0.73). This point estimate is not robust to removing a
single organization: dropping Houston brings it to -0.006, dropping
Seattle brings it to +0.173.

UNREPORTED SELECTION CHECK found during verification: organization-seasons
with ZERO classified Triple-A exits that season have a higher mean ladder
rung (0.901, n=91) than organization-seasons with at least one classified
exit (0.705, n=359), permutation p=0.22, not significant, so it does not
change the conclusion, but is a real pattern worth a look in a future spike
on exit volume itself rather than exit reason.
```

## What this does not settle

- **The organization-season grain is thin by construction.** 129 of 359
  cells have exactly one classified exit, so their merit share is
  mechanically 0% or 100% with no precision behind it. The volume control
  and the three-or-more-exit cut partly address this, but no cut here
  reaches the sample size the ordered-logit, era-controlled house method
  usually assumes.
- **This spike had to derive its own organization-per-stay join.** No
  committed panel in this worktree carries organization identity per stay
  directly; `docs/price-the-blockage.md`'s own stay file, which would, is
  built from caches not present here. This spike instead read the acting
  team out of each transaction's free text, which needed its own trap-
  fixing pass (see Method) and is a new derivation, not a preexisting
  registered database view.
- **The transaction-wire classification itself was not re-checked here.**
  Whether a given exit is truly "merit" versus "roster-rule" comes from
  `docs/price-the-blockage.md`'s own read of the transaction wire, inherited
  as given. Independently re-verifying that classification for noise would
  mean re-deriving the whole stay-level read from raw caches this worktree
  does not have, without a fresh statsapi pull. Not attempted here.
- **The organization-level (30-organization) cross-check's own point
  estimate is not stable.** It moves from close to zero to as high as 0.17
  depending on which single organization is dropped. It agrees with the
  null under every removal tried, but its specific number, and the
  Mariners/Astros illustration drawn from it, should be read as a picture,
  not a precise estimate.
- **The World Series band (12 organization-seasons) and the LCS-or-better
  band (45) are thin by the program's own standing caution.** Read any
  claim at those rungs as directional, not conclusive, though none of them
  reached significance regardless.
- **This spike used the outcome ladder's 2009-2023 window**, the floor set
  by `docs/price-the-blockage.md`, not the program's full 2000-2025 window,
  so it is not directly stacked against the wider-window figures in
  `docs/team-success-joint-model.md` without re-running those factors on
  the same restricted years. Not attempted here.
- **Not yet checked against the program's other factors in one joint
  model.** This spike and the organization-tenure spike in the same batch
  are both built from the identical 962-stay cohort and could plausibly be
  picking up related organizational behavior (a deep, winning roster both
  makes prospects wait longer and changes what ends their wait). A genuine
  joint check, the way `docs/team-success-joint-model.md` did for the first
  four factors, is the natural next step once both spikes exist side by
  side. Not attempted here.

## How this differs from the homegrown-share finding

`docs/homegrown-dependence.md` and `docs/team-success-joint-model.md`
classify WHERE a current major-league player's career started (his first
professional organization) and measure a share of playing time on today's
roster. This spike classifies WHY a past Triple-A stint ended (merit,
injury, roster-rule, or trade) and measures a share of promotion events in
a farm system that season. One is about who is on the team; the other is
about how the team fills its roster. They use different source
classifiers, different panels, and different units (a plate appearance or
batter-faced weight versus a discrete promotion event). The only thing
they share is the outcome ladder both are tested against, which is why the
division-winner result that shows up for homegrown share does not carry
over to this measure, and in fact runs the other way here.

## Where the work lives

`.scratch/team-success/build-exit-reason-mix.mjs` builds the panel: reads
the already-cached `.scratch/blockage/exits.json`, recovers the acting
organization from each transaction's description text, classifies exit
reasons, and joins to the outcome ladder by season and team. Output:
`.scratch/team-success/exit-reason-mix.json`.
`.scratch/team-success/analyze-exit-reason-mix.mjs` runs every statistic
in this doc (the three volume-cut correlations, the band comparisons, the
division-winner cut, the ordered logit, both confound checks, and the
organization-level sensitivity check) and writes
`.scratch/team-success/exit-reason-mix-findings.json`.

The panel is a new derivation this spike built and is not yet a registered
view in the shared DuckDB layer (`scripts/research-db.mjs`,
`docs/agents/research-database.md`). A future synthesis pass should
register `.scratch/team-success/exit-reason-mix.json` there.
