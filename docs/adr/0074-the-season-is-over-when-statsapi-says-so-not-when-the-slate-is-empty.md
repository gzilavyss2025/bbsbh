# The season is over when statsapi says so, not when the slate is empty

**Status:** Accepted
**Date:** 2026-09-15

## Context

From November to February the MLB tab has no games on it. Measured across
2025-26, the tab had no played game for **110 consecutive days** — November 2 to
February 19 — and the four MiLB tabs are darker still: 175 days at AAA, 179 at
AA, 196 and 197 at the two A levels.

What the slate shows on those 110 days is the words **"No games scheduled."**
That is the same thing it shows on a MiLB Monday, on a rained-out Tuesday, and
on a morning statsapi is having trouble. Issue #1038 asks for a real offseason
home page in that space, which means something has to decide the day is a winter
day and not one of the other three.

The obvious test is the one already on screen: the slate came back empty. It is
the wrong test, in two separate ways.

**An absence is not a fact.** "The season is over", "this level is off today"
and "the fetch failed" arrive at the rendering code in the identical shape — an
empty array. A page that replaced the whole games area on that signal would
replace it during an outage too, telling a reader in June that baseball is over
because a request timed out.

**The fallback is worse than useless here.** When a day comes back empty the
slate scans forward for the next game (`fetchNextGameDate`), one schedule fetch
per day, up to ten days. In June that finds tomorrow. In December the next game
is ninety days away, so the scan spends ten sequential fetches to answer `null` —
and `null` is exactly the ambiguous absence we started with. It cannot establish
that a season ended, and it is expensive on precisely the days it cannot help.

## Decision

**The offseason is read off the dates statsapi publishes for the season, and
never off the absence of games.** `src/lib/time/seasonPhase.js` is the whole
reading, and it is pure; `src/hooks/useOffseason.js` is the fetch around it.

Three things follow from that, and each of them is the decision as much as the
headline is.

### The winter takes two rows, and neither is named for it

A `/api/v1/seasons/{year}?sportId=1` row splits the winter it opens into two
halves and calls neither of them what a reader calls it (checked live against the
2025, 2026 and 2027 rows):

| field | 2026 row |
| --- | --- |
| `regularSeasonEndDate` | 2026-09-27 |
| `postSeasonEndDate` | 2026-10-31 |
| `offseasonStartDate` | 2026-11-01 |
| `offSeasonEndDate` | **2026-12-31** |
| `preSeasonStartDate` | 2026-01-01 |
| `springStartDate` | 2026-02-20 |

`offSeasonEndDate` is New Year's Eve, and `preSeasonStartDate` is New Year's Day
of the *same* row — statsapi splits the winter at the calendar year, not at
anything that happens in baseball. So the offseason a reader lives through is the
**join**: from season Y's `offseasonStartDate` to the day before Y+1's
`springStartDate`. For 2025-26 that join is November 2 to February 19, which
matches the measured schedule gap **to the day**.

Which row to ask for is always the row for the date's own calendar year. In
November that row's `offseasonStartDate` has passed and the season that just
ended is its own year. In January the row is already next season's, its
`springStartDate` is the one coming, and the season that just ended is the year
before — so a January visit needs no second fetch, and only November and December
read forward one row for spring training and Opening Day.

### October is in season, and nothing about the schedule says so

`postSeasonEndDate` runs to October 31 and `offseasonStartDate` opens November 1,
so the postseason is inside the season by the published dates alone. This matters
because an empty-slate test gets October wrong in both directions: there are idle
days inside the postseason with no games at all, and the World Series can end on
the 28th with three dated days still to run.

### It fails closed, everywhere

No row, an unreadable row, a row for the wrong year, a missing bound, or a spring
date that cannot be found all return `null`, and `null` means "not the
offseason". A failure therefore leaves the ordinary empty slate exactly as it is
today. Nothing about the offseason page is reachable by a fetch going wrong.

The same rule governs the winter calendar it draws. The GM meetings, the 40-man
deadline, the Rule 5 draft, arbitration filing, the Hall of Fame vote and report
day are **not in statsapi** and every one of them moves from winter to winter, so
they are typed at `/admin` (`offseason.calendar`) rather than shipped as a table
the code would be asserting without a source. A typed line is dropped unless it
parses as `YYYY-MM-DD | Label` *and* its date falls inside the offseason now on
screen — so a calendar left unedited from last winter renders as nothing rather
than as six confidently wrong dates. The two dates the app can check (spring
training, Opening Day) are appended off the schedule, which is why an unedited
calendar is short instead of empty.

## Consequences

- One fetch answers two questions. The slate already pulled this row on any empty
  day for the All-Star break bounds (`fetchAllStarInfo`, now a reading of
  `fetchSeasonMeta`), so the offseason gate costs an empty day nothing it was not
  already spending.
- **The pointless scan is skipped.** `needsResumeLookup` now takes `!offseason`,
  so a winter morning no longer spends ten sequential schedule fetches to learn
  that the next game is ninety days out.
- MLB only, for now. The row read here is sportId 1's, and a minor level's
  offseason has three leagues finishing on three different dates — #1038's step 3.
- A shipped winter calendar goes quiet, not wrong, if nobody edits it. That is
  the intended failure: a short strip is a smaller cost than a Rule 5 date that
  is off by a year, and the admin field exists precisely so the fix is typing
  rather than a deploy.
- The offseason page is verifiable any day of the year by browsing to a past
  winter's date (`/12102025`), because the gate reads published dates rather than
  the clock. `e2e/offseason-home.spec.js` does exactly that.

## Amendment, 2026-10-06: the regular season ends before the offseason opens

The offseason gate above answers "is the slate over?" from Nov 1. The standings
pages (`/standings`, `/postseason-race`) asked a different question and were
caught by the gap: their "entering today" request is a table dated yesterday, and
statsapi only answers a date the **regular** season played. From the day after
the last regular-season game to Oct 31 the request came back with zero records
(verified live, 2026: `date=2026-10-05` returned 0; no date returned the final
table), so both pages said "no standings" through the whole postseason.

`standingsSeasonPhase` (`src/lib/time/standingsDates.js`) reads the same season
row for `regularSeasonEndDate` and calls the season final two days after it, not
one: a tiebreaker (Game 163) lands the day after the finale and counts in the
regular-season table, so the undated read has to wait for it. A final season is
requested with **no date**, the same fix as the winter. Both pages share that
reading through `useStandingsSeason` and hold their fetch until the row answers.

The same hook is what lets the pages show any earlier year. A season that is not
the current one is final by definition, so it takes the same path with no date
controls. The Standings page offers 1998 on (the six-division era); the
wild-card board and the Postseason Race bracket offer 2022 on, the 12-team
format their cutoff line and bye seeds are drawn for. Earlier years had one or
two wild cards, and 2020 had eight teams a league. A final Race page prints the
whole pooled wild-card order instead of "still alive", because MLB's elimination
numbers stop moving when the regular season does.
