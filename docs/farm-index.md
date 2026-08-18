# The Farm Index

The research pass behind `/farm-system-rankings` (The Farm Report). The arithmetic lives in
`src/api/around-the-game/farmSystem.js`; the facts it runs on are shipped nightly by
`scripts/gen-farm-system.mjs`. This document is the *why* — the part a reader
who disagrees with the ranking is entitled to argue with.

## The question

"How good is a club's farm system" is asked constantly and answered almost
entirely by assertion. The public answers fall into two families, and each one
is missing the other half:

- **Scouting lists** (MLB Pipeline, Baseball America, FanGraphs) rank the
  players. They are the real content, and they say nothing about whether the
  organisation is winning anything with them.
- **Minor-league standings** are public, complete and updated daily, and are
  treated by most fans as a farm-system scoreboard. They are a much weaker
  signal than that use implies.

The index joins both, weights them by how much each is actually worth, and —
this is the part that matters — exposes the weighting as a control so the
reader can see how much of the ranking is the data and how much is the
judgement.

## Pillar 1 — Talent (60%)

**Prospect value is not linear in rank.** FanGraphs' prospect valuation work
puts a 70-FV prospect (roughly a top-five name) at **$150–200M** of surplus
value, a 65-FV hitter at **$75–105M**, a 60-FV pitcher at **$60–78M**, a 45-FV
position player at about **$16M**, and a 40 FV at **$3–7M**. Mapped onto
ordinal Top-100 rank, that spread is an exponential decay.

So the index scores a prospect at

```
value(rank) = 100 · e^(−k·(rank−1)),   k = ln(100/8) / 99
```

which puts the No. 1 prospect in baseball at 100 and the hundredth at 8 —
about a **twelve to one** ratio. An organisation's talent pillar is the sum of
that curve over every ranked name it holds.

The practical consequence, and the reason the curve is here at all: a system of
six names ranked in the nineties does **not** outscore a system holding the
best player in the minors. A flat "count the Top 100 names" ranking says it
does, and that is the single most common way a farm-system list goes wrong.

A prospect outside the published pool scores **zero**, not a small positive.
The list is the definition of "ranked"; inventing value for names it does not
carry would be inventing data.

## Pillar 2 — Winning (25%)

Affiliate won-lost records are real evidence and weak evidence.

The one public attempt to regress farm-system rankings against system-wide
minor-league winning percentage found **R² ≈ 0.11** — a gentle positive
relationship inside very noisy data. That is not nothing, and it is nowhere
near enough to carry a ranking. Three structural reasons it is weak:

1. **Affiliate rosters are not prospect rosters.** They carry organisational
   filler, repeat-level veterans, and rehabbing major leaguers.
2. **Promotion strips the winner.** A club that moves its best players up
   aggressively takes them off the affiliate that was winning with them —
   so *doing the thing a good farm system is for* costs it standings points.
3. **The schedule is not balanced across organisations** in any way that makes
   thirty systems' records directly comparable.

So the pillar is a quarter of the index, not half. The page prints the
correlation between its own two pillars, measured live on the thirty rows in
front of the reader, next to the published figure — a caveat a page can check
on its own numbers is worth more than one it only cites.

**The ladder is not flat.** The four full-season affiliates are weighted by
proximity to the majors rather than averaged:

| Level | sportId | Weight |
| --- | --- | --- |
| Triple-A | 11 | 0.40 |
| Double-A | 12 | 0.30 |
| High-A | 13 | 0.18 |
| Single-A | 14 | 0.12 |

A Triple-A club is one phone call from the major league roster; a Single-A club
is three years away. Rookie ball is excluded outright — short schedules,
leagues that re-form year to year, and a 28-game complex record standing next
to a 140-game Triple-A one is noise wearing the same clothes as signal.

Weights are **renormalised over the levels actually present**, so an affiliate
with no record on file is dropped rather than scored as if it lost every game.

## Pillar 3 — Youth (15%)

Age is the cheapest forecast in the minors. Two prospects ranked identically
are not identical if one is 19 and the other 24: the nineteen-year-old has more
development runway left and, historically, more of the outcomes that matter.

The pillar is the **value-weighted** average age of the organisation's ranked
names — weighted, so a 19-year-old at No. 1 moves it far more than a
24-year-old at No. 96 — measured against a pivot of 21 (close to the Top 100's
own centre of mass), at 12 points of the 0–100 scale per year.

It is the smallest pillar deliberately. It modifies talent that has already
been counted rather than adding any, and it cuts both ways: **young is runway,
not readiness.** A very young system is further from helping the major league
club, and the page says so in those words.

## Scaling and weighting

Each pillar is rescaled across the thirty organisations — worst at 0, best at
100 — **min-max rather than percentile**. Percentiles would space thirty
organisations evenly and hide the thing the index exists to show: the top two
or three systems are not marginally ahead of the field, they are a different
distance from it.

Because the scaling is relative to the league, **a score is a position in this
league in this season** and never a number that carries between seasons.

The page ships four weightings, and the point is not that one of them is right:

| Preset | Talent | Winning | Youth |
| --- | --- | --- | --- |
| Balanced (default) | 60% | 25% | 15% |
| Talent only | 100% | — | — |
| Scoreboard | 20% | 80% | — |
| Upside | 45% | 10% | 45% |

The order of the league changes when the weights do. A composite that hides
that is selling a judgement call as a measurement.

## What the index cannot see

Stated on the page as well as here, because a number this confident-looking
needs it:

- **Tools.** It reads ordinal ranks. It has never seen a player throw.
- **Depth below the published list.** A system's seventh-through-thirtieth
  best prospects are invisible to it, and that is where a lot of real
  organisational strength lives.
- **The international class just signed**, which will not appear on a public
  Top 100 for two years.
- **Injuries.** The arm that blew out in June still holds its rank here until
  the list is republished.
- **Development record.** Whether a club is good at turning these players into
  major leaguers is the question everyone actually wants answered, and it is
  not in any of this.

It is a snapshot of held assets and recent results, and it is worth exactly
that.

## Sources

- FanGraphs, *The Details of Our New Prospect Valuation Methodology* — the FV →
  surplus-value figures the decay curve is fitted to.
- FanGraphs, *Introducing an Updated Method for Prospect Valuation*.
- Complete Game Loss, *Do Farm System Rankings Relate to Minor League
  Standings?* — the R² ≈ 0.11 regression.
- MLB Stats API — minor-league standings by `leagueId` (note: `?sportId=11`
  returns an empty `records: []`, which is why the generator resolves leagues
  first).
- MLB Pipeline Top 100, via `scripts/fetch-top-prospects.mjs` —
  `docs/top-prospects.md`.
