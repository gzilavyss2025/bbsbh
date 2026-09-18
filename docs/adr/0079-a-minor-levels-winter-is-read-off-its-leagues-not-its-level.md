# A minor level's winter is read off its leagues, not off its level

**Status:** Accepted
**Date:** 2026-09-18

## Context

ADR-0074 put a real page in the MLB slate's empty games area from November to
February, and it left one sentence open: *"MLB only, for now. The row read here
is sportId 1's, and a minor level's offseason has three leagues finishing on
three different dates."* That is issue #1077, and it is the bigger half of the
problem by every measure that matters.

The minor levels go dark far longer than MLB does, and far earlier. Measured
across 2025-26:

| Tab | Dark from | Dark to | Days |
| --- | --- | --- | --- |
| MLB | 2025-11-02 | 2026-02-19 | 110 |
| AAA | 2025-09-28 | 2026-03-21 | 175 |
| AA | 2025-09-25 | 2026-03-22 | 179 |
| A+ | 2025-09-17 | 2026-04-01 | **197** |
| A | 2025-09-18 | 2026-04-01 | 196 |

For more than half a year those four tabs have said "No games scheduled." and
nothing else — and they start saying it in the middle of September, while MLB is
still playing its pennant races.

The obvious extension of ADR-0074 is to ask the same endpoint with a different
sport id: `/api/v1/seasons/{year}?sportId=13` returns a row shaped exactly like
MLB's. It would be wrong, and the reason is not a corner case.

**A minor level is not a season. It is three leagues.** High-A 2026 is the South
Atlantic League, the Midwest League and the Northwest League, and they do not
finish together:

| League | 2026 season ends | offseason opens |
| --- | --- | --- |
| Northwest | September 11 | September 12 |
| South Atlantic | September 15 | September 16 |
| Midwest | September 15 | September 16 |

The level's own row is a summary of the three, and a summary is not a reading.
Usually it is later than all of them, which would be harmless. **It is not
always.** Checked across 2023-26 at all four levels, sportId 13's 2025 row ended
the season on September 19 while two of its three leagues published September 20.
One day, in the direction that matters: a gate on the level row would have
declared a winter while a league was still playing.

## Decision

**A minor level's winter is the span in which no league at it is playing, and
both ends of that span come off the leagues' own published dates.**

`/api/v1/league?sportId={11..14}&season={y}` returns one row per league with its
own `seasonDateInfo`. `levelOffseasonPhase` in `src/lib/time/seasonPhase.js`
reduces them:

```
the winter opens   max(offseasonStartDate)        — the LAST league to finish
the winter closes  min(regularSeasonStartDate) − 1 — the FIRST league to return
```

Both ends take the conservative side. Taking the max at the front means a level
whose third league is still in a championship series is not called a winter.
Taking the min at the back means the page is gone before the earliest league's
Opening Day rather than after the latest one's.

Everything else about ADR-0074 carries down unchanged. The rows come from
published dates and never from an absence of games. The reading is pure and the
fetch is around it (`hooks/useOffseason.js`, one gate for both readings). It
fails closed: an empty list, or **one** league missing either date, returns
`null` and leaves the ordinary empty slate exactly as it is today — all or
nothing, because the answer is a max and a min over every league and a partial
list silently widens one end.

Three consequences of the level rows follow, and each is part of the decision.

### October is the offseason at a minor level

The exact mirror of ADR-0074's "October is in season" at MLB, off the same kind
of published date. By October 12 — the date the design study's artboards carry —
High-A has been dark for nearly four weeks.

### There is no spring training to count to

No minor-league season row carries a `springStartDate` at all (checked for 2025,
2026 and 2027 at all four sport ids). A minor league goes from no baseball
straight to its own Opening Day, so that is the date the countdown counts to and
the date the calendar strip appends. One component draws both
(`WinterCountdown`); the difference is a date and a label, not a second
countdown.

### The wire does not lead this page

MLB's offseason page leads with the roster wire because from November to
February the wire is the most-read thing in baseball. At High-A in December it is
close to silent, and the rail's own 48-hour rule already drops it. So the four
level tabs lead with the thing that IS true of a level the week its season ends:
**who left it going up**. A season's level path is a fact about a career, not
about a game, so it needs no seal — the same footing the design's picked-game
reason line stands on.

That list is drawn from `minors-leaders.json`, which is already on the wire once
a day, so the page costs no new fetch. It is a leader board and not a census, and
the surface says so under the list rather than implying a completeness it has not
got — `research.md`'s own warning is that a top-25 leaderboard is not a fair
player pool.

## Consequences

- An empty MiLB day costs **one** extra fetch (487 bytes with `fields=`), and
  only on an empty day: the level's rows are asked for only once the MLB season
  row has arrived, and the slate asks for that one on empty days alone.
- The gate is verifiable any day of the year by browsing to a past date, because
  it reads published dates rather than the clock. `e2e/offseason-home.spec.js`
  covers both readings that way.
- `scripts/gen-minors-leaders.mjs` no longer overwrites a finished season's board
  with an empty one. It writes the calendar year it runs in, so the first nightly
  run of January would otherwise replace the board with a season nobody has
  played and hold it there until April — through the exact months this page reads
  it. An empty pool is now "nothing new to say", and the file keeps naming the
  season it holds. The page checks that year regardless, and shows no list rather
  than an emptied one.
- A level's page is still short. The picked-game card the design puts above the
  promotions list — a verified, scoreable game from the season just finished,
  carrying its own reason line — needs a checked game pool that does not exist
  yet, and is the rest of #1077.
- The five slate tabs now have three empty-day states between them, decided in
  one place (`components/offseason/OffseasonSlot.jsx`): MLB's wire, a level's
  promotions, and the ordinary "No games scheduled." that both fail closed to.
