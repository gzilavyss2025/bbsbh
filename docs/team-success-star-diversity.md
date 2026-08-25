# Star diversity: is value spread out, or stacked in one or two players?

Research spike, 2026-08-25. Third factor spike under
`docs/team-success-research.md`. Joins three datasets already in this repo —
none newly pulled — none of them built for this program: spike #1's team
roster cache, the FanGraphs-sourced season WAR history built for the player
page, and the All-Star roster archive.

**The question.** Is a team's on-field value concentrated in one or two
standout players, or spread across the roster? Does that concentration (or
its opposite) predict how far a team goes in the postseason, and does it
separate the teams that win their division outright from the ones that
sneak in on a wild card?

**The answers, in order of how much weight they carry.**

1. **On the hitting side, a spread-out lineup is a real, sizable edge — for
   getting IN, more than for going deep once you're there.** Teams that made
   the playoffs had a meaningfully SMALLER share of their hitting value
   riding on their single best hitter than teams that didn't (21.6% vs.
   24.8%), and the correlation against the full 0-5 outcome ladder is one of
   the strongest this program has found (rho≈−0.19 to −0.23, effectively
   p=0.0000 — none of 5,000 random shuffles produced a correlation this
   strong by chance). It holds its sign in every one of 15
   leave-one-season-out refits.
2. **On the pitching side, this barely matters.** The same three measures,
   computed for pitching WAR instead of hitting WAR, come back small and
   mostly not statistically reliable. This is the same hitting/pitching
   split the roster-age and homegrown spikes both found mattered — but here
   it runs the OPPOSITE way from roster age, where pitching carried the
   bigger effect.
3. **Concentration does not separate division winners from wild-card
   teams**, on either side of the ball. Among the 154 clubs that already
   made the playoffs, a division winner's hitting value was spread out about
   as much as a wild-card team's. This matches the roster-age spike's
   pattern (a real "making it" signal, no "how you got there" signal) — the
   mirror image of what the homegrown spike found.
4. **A team's count of All-Stars is a much louder signal (rho=0.56) — and a
   much less trustworthy one.** All-Star selection happens mid-season, based
   heavily on that year's own performance and reputation, so a good team
   racking up All-Star nods is expected almost by construction. Read as a
   sanity check, not a second confirmation: teams with more All-Stars had
   VERY slightly less concentrated hitting value (rho=−0.09), the same
   direction as the main finding, but too weak on its own to lean on.

## What "concentration" means here

For each team-season, on each side of the ball, every player's credited WAR
that season (see the trap below on how a mid-season trade is handled) is
collected. Only players with POSITIVE credited WAR count toward the
denominator — a bench player running −0.3 WAR isn't "diluting" a team's
stars, he's just replacement level or worse, and letting negative numbers
into a share calculation makes it nonsensical. Three measures, each computed
separately for hitting and for pitching:

- **top1Share** — the single highest-WAR player's share of the team's total
  positive WAR.
- **top2Share** — the top two players' combined share.
- **hhi** — a Herfindahl-style concentration index: the sum of every
  positive-WAR player's share, squared. A team that got its value from many
  players evenly scores LOW; a team that got almost all of it from one or
  two players scores HIGH, up toward 1.0.

A typical team-season has about **15 hitters and 16 pitchers** with any
positive WAR at all in a season. A perfectly even 15-way split of value
would put HHI around 0.067 — the hitting average actually observed, 0.141,
is roughly double that, meaning real MLB rosters concentrate value in a
handful of players far more than an even split would, which is exactly what
"stars matter" would predict. The question this spike asks is whether MORE
or LESS of that normal concentration goes with winning.

## The data, and two traps

**450 team-seasons, 2010-2025, excluding 2020** (480 with 2020 included —
every headline number below moves by well under a point either way, no sign
flips; see the sensitivity check in the script output). This is the
narrowest sample of any spike in this program so far, because
`war-history/` — built for the player page, not this research — only goes
back to 2010, six years later than even the homegrown spike's 2004 floor
and sixteen years short of the ladder's 2000-2025 window. **Every season
before 2010 has no WAR data at all** and is dropped outright, not
backfilled. This is the SAME kind of reused-dataset window mismatch the
homegrown spike hit and that `src/lib/research/contenderDiary/standingNotes.js`
already catalogues as a trap
(`reused-panels-have-their-own-season-window`) — cited here rather than
re-explained.

**A second, new trap surfaced building this join.** `war-history`'s WAR
number is a SEASON TOTAL with no team split at all (`src/api/war.js`'s own
header says so plainly: "no team attribution"). Spike #1's roster cache,
`roster-age-cache.json`, correctly splits a traded player's playing time
between his two teams — verified directly against a real 2015 case (Troy
Tulowitzki, Rockies → Blue Jays: 351 plate appearances credited to Colorado,
183 to Toronto, matching his real stint split). But war-history has only ONE
number for his whole 2015 season: 2.4 WAR combined. Crediting that whole 2.4
to BOTH teams would double-count him and inflate both rosters' apparent
star power. Fixed by **prorating**: each player's credited WAR at a given
team is his season WAR multiplied by (his plate appearances or innings at
that team ÷ his total plate appearances or innings across every team he
played for that season). For Tulowitzki, that split his 2.4 combined WAR
into 1.58 credited to Colorado and 0.82 to Toronto — proportional to how
much of the season he actually spent at each stop, and the two pieces sum
back to his real total exactly. Recorded as a new trap in
`src/lib/research/contenderDiary/standingNotes.js`
(`traded-player-war-has-no-team-split`) for the next spike that touches
war-history.

**WAR coverage was complete: 32,292 of 32,292 player-roster-slot references,
100%.** Every player in the roster cache for 2010-2025 had a matching
season-WAR entry — a cleaner join than the homegrown spike's 99.1%, likely
because FanGraphs' leaderboard pull (`gen-war-history.mjs`) has no minimum
playing-time cutoff. Zero team-seasons had to be dropped for lacking any
positive-WAR player.

## The result

```
450 team-seasons, 2010-2025 excluding 2020

Hitting — Spearman rho vs. the 0-5 ladder (permutation p, 5,000 within-season shuffles):
  top1Share   rho=-0.1907   p=0.0000   same sign in 15/15 leave-one-season-out refits
  top2Share   rho=-0.2260   p=0.0000   same sign in 15/15 leave-one-season-out refits
  hhi         rho=-0.2241   p=0.0000   same sign in 15/15 leave-one-season-out refits

Pitching — Spearman rho vs. the 0-5 ladder:
  top1Share   rho=-0.0548   p=0.2518   same sign in 15/15 leave-one-season-out refits
  top2Share   rho=-0.0433   p=0.3904   same sign in 15/15 leave-one-season-out refits
  hhi         rho=-0.0680   p=0.1888   same sign in 15/15 leave-one-season-out refits
```

The negative sign means the same thing every time: MORE concentration (a
bigger share riding on fewer players) goes with a LOWER finish on the
ladder. On the hitting side this is a real, precisely-estimated effect —
comparable in size to the roster-age spike's rho≈0.2-0.3, this program's
strongest finding to date. On the pitching side, all three measures point
the same direction but none is distinguishable from noise at this sample
size.

**Band comparisons** (average share of hitting value from the top player or
top two, by how far a team went):

| Team went | Top 1 hitter's share | Top 2 hitters' share | Concentration index (HHI) |
| --- | --- | --- | --- |
| Missed the postseason (296 teams) | 24.8% | 42.2% | 0.148 |
| Made the postseason (154 teams) | 21.6% (real difference) | 37.6% (real difference) | 0.128 (real difference) |
| Reached the LCS or better (60 teams) | 22.3% (not distinguishable from the rest) | 38.2% (real difference) | 0.130 (real difference) |
| Won the World Series (15 teams) | 22.6% (too few champions to tell) | 38.4% (too few champions to tell) | 0.132 (too few champions to tell) |

The same table for pitching:

| Team went | Top 1 pitcher's share | Top 2 pitchers' share | Concentration index (HHI) |
| --- | --- | --- | --- |
| Missed the postseason (296 teams) | 24.1% | 40.8% | 0.138 |
| Made the postseason (154 teams) | 23.0% (borderline, not reliable at the usual bar) | 39.7% (not a reliable difference) | 0.131 (real, but small, difference) |
| Reached the LCS or better (60 teams) | 23.3% (not a reliable difference) | 40.2% (not a reliable difference) | 0.134 (not a reliable difference) |
| Won the World Series (15 teams) | 23.1% (too few champions to tell) | 40.4% (too few champions to tell) | 0.135 (too few champions to tell) |

Read the pattern across both tables together: on the hitting side, the gap
between "missed it" and "made it" is where almost all of the signal lives,
and it mostly holds up (weaker but still real for two of three measures)
through the LCS+ cut. By the World Series cut, with only 15 champions in the
sample, nothing can be told apart from noise — the same thin-top-rungs
problem every spike in this program runs into. On the pitching side, only
the concentration index clears the bar for "made the playoffs at all," and
even that is a small effect.

**Division winners vs. wild-card teams, restricted to the 154 clubs that
already made the playoffs:**

| | Hitting (division winners vs. wild card) | Pitching (division winners vs. wild card) |
| --- | --- | --- |
| Top 1 player's share | 21.1% vs. 22.2% (not a reliable difference) | 22.8% vs. 23.4% (not a reliable difference) |
| Top 2 players' share | 37.3% vs. 38.1% (not a reliable difference) | 39.6% vs. 39.8% (not a reliable difference) |
| Concentration index | 0.127 vs. 0.129 (not a reliable difference) | 0.131 vs. 0.131 (not a reliable difference) |

Every cell in this table is a null. Whatever a spread-out lineup buys a
team, it buys on the way IN to October — same as roster age's finding, and
the opposite of the homegrown spike's finding, which had nothing to say
about "made it" but did separate division winners from wild-card teams.

## STRETCH: All-Star count, a louder but shakier second measure

Alongside WAR concentration, `docs/team-success-research.md`'s factor
catalog also names a simpler proxy: how many recognized stars a roster had,
counted as All-Star selections. Every player named to a team's All-Star
roster that season (starters, bullpen, and substitutes combined, 2010-2025
excluding 2020, n=450) was counted per team.

```
allStarCount: Spearman rho=0.5568 vs the 0-5 ladder, permutation p=0.0000,
  same sign in 15/15 leave-one-season-out refits
wonDivision (among 154 playoff teams): 3.98 All-Stars vs. 3.70 — not a
  reliable difference (permutation p=0.34)
```

This is a MUCH stronger correlation than any concentration measure above —
by a wide margin the largest single number in this spike. It should be read
with real suspicion rather than excitement, for a reason the technical
section spells out: All-Star selection happens mid-season and is driven
heavily by how well a player (and often his team) is doing THAT YEAR, so a
team that is winning is already likely to rack up All-Star nods as a
consequence of winning, not necessarily a cause of it — the same kind of
circularity the roster-age spike flagged for trade-deadline rentals, in a
more direct form here. As one cross-check: teams with more All-Stars did
have very slightly LESS concentrated hitting value (rho=−0.09) — the same
direction as this spike's main finding, but far too weak on its own to
count as independent confirmation.

## What this does not settle

- **Nothing here is causal.** A spread-out lineup could mean a genuinely
  deep, well-built roster that wins games — or it could simply mean the team
  never had a true star to begin with, and its "diversity" is really just
  the absence of a standout. This spike cannot tell those two stories apart,
  and they point in opposite directions for what a front office should do
  with the finding.
- **The pitching null is a real non-effect at this sample size, not proof of
  an exact zero.** A modest true effect on the pitching side could be hiding
  in 450 team-seasons the same way it hasn't in 750 (roster age) or 570-600
  (homegrown) — this program's usual caveat, restated because the pitching
  numbers here are close enough to the conventional bar (p=0.19-0.39) that a
  slightly larger sample could plausibly tip one across it.
- **The World Series cut (n=15) genuinely cannot tell anything apart from
  noise** — the thinnest slice yet in this program, since 2010-2025 is six
  fewer champions than the roster-age spike's 25 and the homegrown spike's
  19. See the `thin-top-rungs` trap.
- **The traded-player WAR proration is a reasonable estimate, not a measured
  fact.** Splitting a combined-season WAR by playing-time share assumes a
  player performed at roughly the same per-plate-appearance or per-inning
  rate at both stops, which is not always true (a player can be traded
  BECAUSE he was struggling, or get hot after a change of scenery). This
  affects a minority of rows — most players spend a whole season with one
  team — but it is an approximation, not a re-derivation of his actual
  stint-by-stint value.
- **No payroll control**, same standing gap as every other spike in this
  program.
- **This spike only used FanGraphs' season-total WAR, not a postseason-actual
  reweighting** the way the homegrown and roster-age spikes both ran as a
  follow-up check. That check is a natural next step here too (see below).

## What would move this next

- **A postseason-actual reweighting** — using the reusable postseason-usage
  primitive (`docs/team-success-postseason-usage.md`) to check whether the
  players who actually took the field in October were a more or less
  concentrated group than the full-season roster, the same follow-up both
  earlier spikes ran.
- **A joint model with roster age and homegrown share** — three spikes into
  this program, all three found something on the hitting/making-the-playoffs
  cut and comparatively little on the pitching or division-winner cuts.
  Whether these are three independent signals or the same underlying
  "well-run organization" trait showing up three ways is still open.
- **Extending `war-history`'s own pull back before 2010**, if the cost of
  the additional FanGraphs sweep is judged worth it — this is the tightest
  season-window constraint of any spike so far.
- **A payroll control**, if a historical source is ever found.

## Where the work lives

`.scratch/team-success/`:
- **`analyze-star-diversity.mjs`** — the whole spike. Loads
  `roster-age-cache.json` (spike #1's own cache, not rebuilt), every shard
  under `public/data/war-history/`, `outcome-ladder.json`, and
  `public/data/all-star-rosters.json`. Computes the traded-player WAR
  proration, the three concentration measures split by hitting/pitching,
  Spearman correlation, the within-season permutation test,
  leave-one-season-out, the band and division-winner comparisons, the 2020
  sensitivity check, and the All-Star-count stretch section. Run: `node
  .scratch/team-success/analyze-star-diversity.mjs`.
- No new data was pulled for this spike — everything above reuses spike #1's
  cache, the player page's existing WAR history, and the existing All-Star
  archive.
