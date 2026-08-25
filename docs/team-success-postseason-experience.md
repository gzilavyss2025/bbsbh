# Does prior postseason experience matter?

Research spike #4, 2026-08-25. Fourth factor in the Contender Diary program
(`docs/team-success-research.md`) and the first one that was NOT in the
original factor catalog — commissioned directly, and added to the catalog by
this spike.

**The commissioning ask, in four parts.** Are the teams that reach the World
Series and the Championship Series made up of players who had been to the
postseason before that year? Is that a differentiator between clubs that
merely qualify and clubs that advance? Is it more noticeable on the pitching
or the batting side? And — the part the spike itself added — is any of it
real, or is "experience" just roster continuity wearing a disguise?

**The answers.**

1. **Prior postseason experience is one of the strongest signals this
   program has found — for GETTING IN.** Across 750 team-seasons, the share
   of a club's playing time given to previously-experienced players
   correlates with the outcome ladder at rho=+0.35 (batting) and +0.37
   (pitching), and the sign holds in all 25 leave-one-season-out refits on
   both sides. Clubs that reached October gave about **20 percentage points
   more** of their playing time to previously-experienced players than clubs
   that did not.
2. **It is NOT a differentiator for advancing.** Restrict the sample to the
   234 clubs that already made the postseason, and the relationship
   collapses to nothing: rho=−0.02 (batting), +0.02 (pitching), neither
   distinguishable from chance. Teams that reached the LCS were **0.4
   percentage points** more experienced than postseason teams that didn't
   (batting, p=0.89). Teams that reached the World Series were **1.0
   percentage point LESS** experienced (batting, p=0.79). The answer to the
   commissioned question is a clean, well-powered null.
3. **One thread survives, barely, and it is a different measure.** Prior
   experience *in the late rounds specifically* — a player who had been in a
   Championship Series or World Series before, not merely a Wild Card game —
   does separate the LCS-or-better band: **+6.9pp on the batting side
   (p=0.056) and +7.1pp on the pitching side (p=0.037)**. It does not
   survive a roster-age control. Treat it as a lead, not a finding.
4. **Pitching, marginally — but the sides are closer than any previous
   spike found.** Pitching edges batting on nearly every raw number, and the
   only band tests that clear p<0.05 are pitching-side. But once controls go
   in, the two sides are indistinguishable (+0.164 vs. +0.166). This is a
   weaker hitting/pitching split than spikes #1 or #3 reported.
5. **The confound is real and it eats roughly half the effect, but not all
   of it.** Controlling for the club's OWN ladder rung in the previous season
   plus its roster age cuts rho from +0.35 to +0.17 (batting) and +0.37 to
   +0.16 (pitching) — both still highly significant. A within-club test, which
   removes club quality entirely, gives +0.18 and +0.21. So it is not
   *purely* continuity. See "What this does not settle" before reading that
   as causal.

## The measure

For every team-season 2000-2025 and each side of the ball:

```
expShare = share of the club's REGULAR-SEASON playing time (PA for hitters,
           IP for pitchers) that went to players who had appeared in at
           least one postseason game in a STRICTLY EARLIER season, on any club
```

Four variants ride alongside it: `deepShare` (prior appearance in an LCS or
World Series game specifically), `wsShare` (prior World Series game),
`expYears` (weighted count of prior postseason seasons) and `expDepth`
(weighted mean of `log1p` of prior postseason PA/IP). Each also has a
`*Relative` version subtracting that season's own playing-time-weighted
league average, per the framework's rule.

**Two design choices carry most of the weight here.**

**It is a pre-October property, on purpose.** Experience is counted only from
postseasons strictly before the season being scored, so nothing a club does
in the current October can leak into its own predictor. This is the whole
reason the measure is weighted by REGULAR-SEASON playing time rather than
postseason playing time — a postseason-weighted version would have its
denominator grow with how far the club went, which is exactly the trap
`docs/team-success-postseason-usage.md` documents at rho=0.91.

**Experience is career-wide, not club-wide.** A veteran who played in the
2015 World Series for another club counts as experienced when he signs
somewhere new for 2016. That is what makes the measure a statement about
roster CONSTRUCTION rather than about continuity — though, as the confound
check below shows, the two are still heavily entangled.

## What teams at each rung actually looked like

Batting side, share of plate appearances given to previously-experienced
players. 2020 is dropped throughout (60-game season, 16-team bracket).

| Rung | n | Experienced share | vs. league that year | Prior LCS/WS share |
| --- | --- | --- | --- | --- |
| 0 — missed the postseason | 516 | 47.8% | −6.3pp | 29.4% |
| 1 — lost its first series | 116 | 70.7% | +15.9pp | 45.5% |
| 2 — won a round, no LCS | 18 | 52.8% | −3.9pp | 28.5% |
| 3 — lost the LCS | 50 | 69.0% | +14.7pp | 50.7% |
| 4 — lost the World Series | 25 | 63.9% | +9.6pp | 51.6% |
| 5 — won the World Series | 25 | 69.9% | +15.6pp | 49.8% |

Pitching side, share of innings:

| Rung | n | Experienced share | vs. league that year | Prior LCS/WS share |
| --- | --- | --- | --- | --- |
| 0 — missed the postseason | 516 | 39.1% | −6.4pp | 24.5% |
| 1 — lost its first series | 116 | 61.8% | +15.6pp | 41.1% |
| 2 — won a round, no LCS | 18 | 45.8% | −2.6pp | 28.1% |
| 3 — lost the LCS | 50 | 60.1% | +14.4pp | 45.1% |
| 4 — lost the World Series | 25 | 56.5% | +10.7pp | 47.0% |
| 5 — won the World Series | 25 | 66.6% | +20.8pp | 50.0% |

**Read the shape, not the individual rows.** The gap between rung 0 and rung
1 is enormous — roughly 22 points on both sides. Every gap ABOVE rung 1 is
small and non-monotonic: rung 4 sits BELOW rung 1 on both sides of the ball.
That is the finding in one table. The line that experience draws is the line
between missing October and reaching it, not any line inside October.

**Rung 2 is an artifact, not a counter-signal.** Its n=18 all sit in
2022-2025 (the rung is structurally empty before 2012 and nearly so before
2022), and those clubs are wild-card winners — the weakest qualifiers in the
field. Do not read its dip as "winning a round takes inexperience."

## The advancing cut, which is the commissioned question

Restricted to the 234 clubs that made the postseason:

| Test (batting / pitching) | Batting | Pitching |
| --- | --- | --- |
| expShareRelative vs. ladder 1-5 | rho=−0.017, p=0.80 | rho=+0.023, p=0.73 |
| deepShareRelative vs. ladder 1-5 | rho=+0.070, p=0.29 | rho=+0.104, p=0.12 |
| Reached LCS+ vs. not — experienced share | +0.42pp, p=0.89 | +1.90pp, p=0.53 |
| Reached LCS+ vs. not — prior LCS/WS share | **+6.91pp, p=0.056** | **+7.08pp, p=0.037** |
| Reached WS vs. not — experienced share | −1.02pp, p=0.79 | +2.26pp, p=0.54 |
| Reached WS vs. not — prior LCS/WS share | +5.01pp, p=0.27 | +7.33pp, p=0.075 |

**Holding regular-season quality fixed changes none of it.** Seed (1-6, a
compact stand-in for how good a club was over 162 games) is available for
every postseason club. Controlling for it, the batting experienced share
moves from −0.017 to −0.030 (p=0.68) and the pitching from +0.023 to +0.013
(p=0.85). Adding prior-year rung and roster age on top leaves both slightly
negative and nowhere near significance.

Worth noting what seed itself does: experienced clubs DO seed better
(rho=−0.23 batting, −0.18 pitching, negative meaning a better seed), and
seed itself barely predicts the ladder (rho=−0.053). Both facts point the
same way — experience buys a club a better regular season, and the
postseason then mostly ignores what the regular season said.

## Is it just roster continuity?

This was the spike's own added question, and the honest answer is "partly."

A club that went deep last October has experienced players BECAUSE it went
deep. Three progressively harder controls:

| Control (all 750 team-seasons, vs. ladder 0-5) | Batting | Pitching |
| --- | --- | --- |
| raw | +0.348 | +0.372 |
| + club's own ladder rung last season | +0.214 | +0.249 |
| + roster age | +0.288 | +0.269 |
| + both | **+0.166** (p<0.001) | **+0.164** (p<0.001) |

**Within-club test** — compare each club against its OWN 26-year average, so
club quality differences out entirely. Does a club go further in the years
when its roster is more experienced than that club usually is?

| Within-club, ladder demeaned per club | Batting | Pitching |
| --- | --- | --- |
| All 750 team-seasons | +0.180 (p<0.001) | +0.206 (p<0.001) |
| Postseason clubs only (234) | −0.032 (p=0.62) | −0.012 (p=0.86) |

The controls cut the qualifying effect roughly in half but do not erase it,
and the within-club version — the strictest test available here — still
lands at +0.18/+0.21. So the qualifying signal is not purely a continuity
artifact. The advancing null, meanwhile, is a null under every specification
tried, including the ones that were most likely to rescue it.

## Division winners vs. wild cards

Restricted to postseason clubs, experience DOES separate the two, matching
the homegrown spike's pattern and the opposite of the roster-age spike's:

| | Batting | Pitching |
| --- | --- | --- |
| Experienced share | +7.13pp, p=0.024 | +5.55pp, p=0.075 |
| Prior LCS/WS share | +9.63pp, p=0.011 | +7.00pp, p=0.041 |

This is consistent with everything above rather than a separate finding:
winning a division is a regular-season achievement, and experience is a
regular-season predictor.

## The cases that make the null concrete

The extremes are more persuasive than the correlations, and they run in both
directions.

**Reached a World Series with almost no October experience:**

| Team | Share of PA experienced | Result |
| --- | --- | --- |
| 2002 Angels | 2% | **Won the World Series** |
| 2014 Royals | 13% | Lost the World Series |
| 2007 Rockies | 16% | Lost the World Series |
| 2010 Rangers | 16% | Lost the World Series |
| 2003 Marlins | 19% | **Won the World Series** |
| 2008 Rays | 20% | Lost the World Series |

**Deeply experienced and missed October entirely:**

| Team | Share of PA experienced |
| --- | --- |
| 2022 Brewers | 96% |
| 2021 Athletics | 96% |
| 2019 Cubs | 96% |
| 2009 Rays | 95% |
| 2008 Yankees | 95% |
| 2017 Blue Jays | 93% |

The 2002 Angels are the single cleanest refutation of the "October
experience wins in October" story available in the window: a club that gave
**2% of its plate appearances** to players who had ever been in a postseason
game, and won the World Series.

## What this does not settle

- **Nothing here is causal, in either direction.** The qualifying
  association survives every control tried, but "experienced players make a
  club better" and "good clubs accumulate experienced players" both predict
  exactly this pattern, and no observational design in this program can
  separate them. The within-club test narrows the gap; it does not close it.
- **A null is not a proof of zero.** The advancing sample is 234 team-seasons
  and the LCS+ band is 100 — enough to rule out an effect of the size seen on
  the qualifying cut (which would have been detected many times over), not
  enough to rule out a small one. The specific claim supported is "prior
  experience is not a large differentiator for advancing," not "it has
  exactly no effect."
- **The `deepShare` lead is fragile and should not be reported as a
  finding.** It clears p<0.05 on the pitching LCS band (p=0.037) and comes
  close on the batting side (p=0.056), but it does not survive a roster-age
  control (pitching p=0.209, batting p=0.253), and it is one of ten related
  measures tested — roughly what would be expected to clear the bar by chance
  at this many cuts. It is listed as an open question, not a result.
- **"Appeared in a postseason game" is a blunt threshold.** A pinch-runner
  who took one October at-bat in 2011 counts the same as a Game 7 starter.
  `expDepth` (weighted by how MUCH prior postseason work a player had) was
  built for exactly this concern and tracks the plain share closely (+0.360
  vs. +0.348 batting), so the threshold does not appear to be driving
  anything — but a finer role-weighted version was not tried.
- **Experience and age are close cousins and cannot be fully separated.**
  Controlling for roster age is the right move and it is done above, but a
  35-year-old who has never been to October is a rare bird; the two measures
  share a lot of the same players.
- **No payroll control exists anywhere in this program**, same gap as every
  other spike. A club that buys experienced veterans is also a club that
  spends, and spending is unmeasured here.

## Where the work lives

`.scratch/team-success/`:

- **`build-postseason-experience.mjs`** → `postseason-experience.json` — the
  measure. Pulls the game list for every postseason **1969-2025** from
  `GET /api/v1/schedule?sportId=1&season=YYYY&gameType=F,D,L,W`, then a
  boxscore per game. The 2000-2025 half is reused from spike #2's
  `postseason-boxscore-cache.json` (918 of 1,473 games already on disk), so
  only the 555-game 1969-1999 backfill is actually fetched, cached in
  `prior-postseason-cache.json`. Regular-season playing-time weights come
  from spike #1's `roster-age-cache.json` — no new regular-season pull.
- **`analyze-postseason-experience.mjs`** — every number in this document.
  The stats library is lifted verbatim from `analyze-star-diversity.mjs`;
  `ols`/`partialSpearman`/`permutationTestPartial` are new and are the
  program's first partial-correlation tooling that takes more than one
  control at a time.

**Two API facts worth reusing.** `gameType=P` returns **zero** postseason
games in every year tested, including seasons with a known bracket — the
working codes are `F` (Wild Card), `D` (Division), `L` (Championship), `W`
(World Series), as `gen-postseason-history.mjs` already uses. And postseason
boxscores are complete for PA/IP back to at least **1969**, well before this
app's own 2000 data floor — verified live against the 1975 World Series
(Luis Tiant IP=9.0, Carl Yastrzemski PA=5). Any future spike needing
pre-2000 player participation can use that path rather than assuming the
2000 floor binds.

## What would move this next

- **A player-level version.** Every measure here is a team aggregate. The
  sharper question — does an individual experienced player perform better in
  October than his own regular-season baseline predicts — is answerable with
  the same two caches and is the natural follow-up.
- **A role-weighted experience measure.** Weight prior experience by the
  leverage of the innings/PA it came in, not just their count.
- **The joint model three spikes have now asked for.** Roster age, homegrown
  share, star diversity and postseason experience have all found something on
  the qualifying cut and little or nothing on the advancing cut. Whether that
  is four signals or one underlying "this is a good, established club" trait
  is the most valuable open question in the program.
