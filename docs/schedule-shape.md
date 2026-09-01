# Schedule shape — the "when did we last win one of these" family

The dataset and the reasoning behind a stat that reads like this:

> The last time the Brewers won Game 1 of a road trip was July 3rd.

That sentence is not a rate. It is a **drought in a recurring slot**: a position
in the schedule a club arrives at over and over — the first game of a road trip,
the last game of a homestand, the opener of a series in one particular city —
plus the date it last won one. The app could not answer it before, because
answering it needs the *shape* of a schedule across more than one season.

This file is the catalog: what the shape supports, which candidates were
measured and thrown out, and how the noteworthiness gate was calibrated.

- **Generator** — `scripts/gen-schedule-shape.mjs`, nightly, one statsapi
  request per season for all thirty clubs.
- **Segmentation** — `scripts/lib/schedule-shape.mjs` (build side),
  `src/api/scheduleShape.js` (read side). Both are unit-tested against each
  other in `test/schedule-shape.test.js`.
- **Surface** — the Team hub's Numbers tab, the **Last Time** card, under
  Records (`src/screens/team/modules/records/LastTimeCard.jsx`).

## Why a second ledger, next to team-records

`gen-team-records.mjs` already keeps a per-game ledger and already tags series.
Two things it cannot do, both structural:

| | `team-records` | `schedule-shape` |
| --- | --- | --- |
| Span | one season | 2015 → now (12 seasons) |
| Cost | 3 calls **per game** (~73,000 for a decade) | 1 call **per season** (12 total, ~6s) |
| Per row | runs, hits, errors, HR, starter lines, batted-around | date, opponent, side of the road, W/L |
| Answers | a rate ("34-27 when scoring first") | a drought ("last won one on July 3") |

So this is deliberately the *thin* ledger: four facts a row, a decade deep. Both
follow the same rule — **store facts, never flags**. Every segment tag is
recomputed at read time, so changing the definition of "road trip" costs a code
change and no regeneration at all.

## The three segments

A club's season is cut three ways, all derived from the played ledger and never
from the feed's own `seriesGameNumber` / `gamesInSeries` (those describe the
schedule as *planned* — a rained-out middle game leaves them describing a series
nobody played).

- **Series** — consecutive games against the same opponent in the same place.
- **Homestand** — a run of consecutive home games, however many opponents visit.
- **Road trip** — a run of consecutive away games, however many cities it crosses.

Segments are cut **per season**: a road trip does not run from one October into
the next March.

### Neutral-site games are transparent

A game at neither club's park — London, Mexico City, Seoul, Tokyo, the Field of
Dreams, and the 2020–21 COVID relocations — belongs to **no** series, stand or
trip, and **does not break the run around it**.

This is not fussiness. MLB names one club the "home" team at every one of those,
and reading that designation literally hands a club a homestand it never had.
Worse, letting such a game *split* a run invents an opener nobody played, which
is fatal to a dataset whose whole job is saying when an opener was last won.

The case that proved it is real and is pinned as a test: on **2020-09-25 the
Brewers played a designated home game against the Cardinals at Busch Stadium**, a
COVID makeup relocated to save a trip, sitting in the middle of a four-game
Milwaukee visit to St. Louis. Keyed on its own site it split that visit in two
and produced a phantom series opener on 2020-09-26.

Each club's home park is inferred **per season** as the venue it hosted the most
games in, rather than read off `teams.json`, which carries only the current park.
Clubs move — the Athletics to Sutter Health Park and the Rays to Steinbrenner
Field in 2025, the Rangers to Globe Life Field in 2020 — and resolving a decade
against today's park would file real home games as neutral ones for every year
before the move.

## The slots

`SLOTS` in `src/api/scheduleShape.js`. `every` is how often a full season
presents the slot, **measured** over 2015–2025, not guessed — the gate divides by
it.

| Slot | Declared `every` | Measured |
| --- | --- | --- |
| `trip-opener` | 13 | 12.6 |
| `homestand-opener` | 13 | 12.6 |
| `trip-finale` | 13 | 12.6 |
| `homestand-finale` | 13 | 12.6 |
| `long-trip-opener` (6+ games) | 9 | 9.6 |
| `series-opener` | 52 | 52.1 |
| `series-opener-away` | 26 | 26.1 |
| `series-opener-home` | 26 | 26.1 |
| `series-finale` | 52 | 52.1 |
| `getaway-day` | 26 | 26.1 |

Any slot can be narrowed to one opponent, which is what turns "game 1 of a road
series" into "game 1 of a series in Chicago".

## The gate, and the trap it exists for

**A drought is two different facts wearing one sentence.**

> They have not won a series opener in Cleveland since 2016.

That sounds like a decade of futility. It is **nine chances in eleven years**,
because an interleague club visits once every two or three seasons. Measured
across 2015–2026, **45% of club-park pairs have fewer than six series openers on
record at all**. A bare "since" would print schedule *rarity* far more often than
it printed anything a reader would call a drought.

The number is not wrong. The sentence claims a struggle where the truth is an
absence of opportunity. So a drought is printed only when the chances were real:

1. `sinceWin >= max(4, rate / 4)` — enough tries to mean something.
2. The losing run fits inside **3 years** — recent enough to be about this club.

`rate` is the smaller of the slot's league-wide `every` and the rate **measured
in the drought's own scope**. That second half is load-bearing: a club visits any
one park about **2.7** times a season, not 26, so judging an opponent-narrowed
drought against the unnarrowed rate demanded seven straight losses inside three
years — which no club had done in twelve seasons, and the entire rival half of
the card silently never rendered. It is pinned by a test now.

### Calibration

Yield across all thirty clubs, as of 2026-08-31:

| Floor | Total | Season-scope | Rival-scope | Median per club | Max | Clubs with none |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 98 | 20 | 78 | 4 | 7 | 2 |
| **4 (shipped)** | **32** | **13** | **19** | **1** | **4** | **8** |
| 5 | 12 | 5 | 7 | 0 | 1 | 18 |

Four is the value that keeps the card a list of remarkable things. Three triples
it and the card becomes wallpaper; five silences eighteen clubs.

Requiring the run to cross a season boundary was tested and **made no difference
at all** — at 2.7 chances a season, every qualifying rival-scope run already
crosses one — so it is not in the code.

## Measured and rejected

The research pass that produced this catalog also killed several candidates.
They are recorded here so nobody re-proposes them without new evidence.

**A segment opener is not harder to win.** Over 2015–2026, clubs are
**4257-4280 (.499)** in segment openers and **22902-22879 (.500)** in every other
game. For contrast the split that *is* real, in the same rows: home **.533**,
away **.467**.

This is the most important finding here, and it shapes the whole feature. These
slots are a **narrative frame, not a difficulty effect**. The stat is interesting
because a fan counts in trips and homestands, not because game 1 is hard. So the
card reports *when* and *how many*, and never implies a cause — which is also the
"no verdict labels" rule in [`callouts.md`](callouts.md).

**Rest does not help.** First game after at least one off day: **1296-1294
(.500)**. First game with no off day before it: **8019-8017 (.500)**. Dead.

**Trip length does not predict the opener.** Trips of 1–3 games open at .427,
4–6 at .479, 7+ at .477. The short-trip figure is a composition artifact (a
two-game set is usually a makeup or an interleague visit), not a travel effect.
`long-trip-opener` survives as a *slot* because "game 1 of a ten-game trip" is a
thing people say, not because long trips start worse.

## Extending this

Cheap, because the ledger already holds what they need — each is a predicate in
`SLOTS` plus a row in the card:

- **Segment outcomes rather than positions.** "Their last winning road trip
  began May 12." Measured and genuinely notable: as of 2026-08-31 the Angels had
  won 1 of 12 road trips and the Athletics 1 of 11 homestands. Needs a segment-
  level drought helper (a trip is a unit, not a game) — the reason it is not in
  this PR rather than a doubt about the idea.
- **Sweeps and series wins** in a slot, same shape.
- **Callout integration.** These are currently a Team-hub card. Getting them into
  the pre-half strip or the box-score Insights roll-up means a callout family
  with a `SCORE_BASE`, and a new callout kind touches five registries — see
  [`callouts.md`](callouts.md) and the tense rule in `adr/0014`.

Anything opponent-narrowed must go through `isNotable`, or it will print rarity.
That is the one rule this file exists to protect.
