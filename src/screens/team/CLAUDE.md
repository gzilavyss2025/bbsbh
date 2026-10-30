# src/screens/team — the team page (`/team/{id}`)

The team page is **one scroll of seven named bands** (ADR-0082, #1107). It replaced six tabs
(ADR-0034, superseded). `next/TeamNextPage.jsx` draws `TeamHubShell` with the page `top`, the
anchor jump bar (`bar` prop), one `Band` per `BANDS` entry (`next/bands.js`; Roster sits second, after Standings), and the foot. A band
mounts its folder (`next/<band>/index.jsx`) only when near (`useNearView`), so nothing loads
before it is. **A band edits only its own folder**, never `bands.js`, `Band.jsx` or the page.
Module props: `{ team, asOf, sportId, onReady, onCount }`; call `useBandData` for the two reports.
Absent bands come from `hiddenTeamSections(team, { pastSeason })` (`data/shared.js`; the league test comes first). A past season hides Money, and Farm keeps only Affiliates (`loadMinors` returns no prospects).
`/team/{id}/leaders`, `stamp-in`, `photos` and `transactions` are separate pages, not bands.

**Each band loads only its own data.** One `data/load{Band}.js` per band, never a shared
mega-fetch. One exception: Ranks also draws `standings/StandingsRankCards.jsx`, which reads
`loadStandings` through SHARED (the same requests Standings makes, none new). A loader's last argument is `src` (`data/sources.js`): with none it fetches its own
copy; the page passes `SHARED` (`next/once.js`), so standings, schedule, roster, the 40-man
Injured List view, `/stats` and the manager are bought once per page. A new read that two loaders
make joins `DIRECT` in `sources.js`, with a test in `test/team-next-loaders.test.js`.

**Old addresses.** `/team/{id}/{roster|games|numbers|contracts|minors}` and the hidden
`/team/{id}/next[/{tab}]` parse to the page with a `tab`. The page lands on the band
(`TEAM_TAB_BAND`, `lib/route.js`) and rewrites the address to the bare page, keeping `?d=` and
`?s=`. Do not add a tab route. `teamTabPath` still builds the old addresses for `TeamLink`.

## The top, the foot, the bands

- **Top** (`next/top/`): the hero and two tiles above the jump bar, handed to the shell as `top`
  (it replaces the identity header and the club strip). `topData.js` holds the pure shapes: the
  form line, the stretches, Last 10, the days calendar and the record grid read only games with
  a `won`, so `?d=` stops every one of them. The grid's other-league standings are the page's
  one request on a tap.
- **Standings** (`next/standings/`): the division table and Last time. Team score, Records, day of
  week and comeback wins draw at the head of **Ranks** through `standings/StandingsRankCards.jsx`
  (same loader via SHARED, no new request). The jump-bar count is one per card drawn. The **Records card**
  (`standings/records/`) is a rank-strip index of the record groups. Each group folds open in
  place. The half and the month are the two scope levers, and an option with no games in the
  other pick is disabled. It costs no request: the shard holds each club's rank per scope, read
  through the cutoff-gated `rankOf`. `hasRecords` hides the card, its head and its count when no
  game counted at the cutoff.
- **Ranks** (`next/ranks/`): batting and pitching ranks, leaders, run value and the ABS challenge
  card, on `loadRanks`. The challenge card (`ChallengeBoard.jsx`, parts in `ranks/challenges/`) draws a face a player on a plot and a scrolling list; its model is `api/around-the-game/absClubCard.js`, and a face or photo opens the global hover card with the card's own figures (`playerHoverStore`'s `detail`). Absent for a club with no league id. The run value card (`RunValueBoard.jsx`, parts in `ranks/runvalue/`; none unless the file holds the page's season) re-ranks its top six by a part on a tap; spec `.scratch/run-value-motion/handoff.md`. A card that needs MLB data draws
  nothing for a club below it.
  A Regular / Postseason switch sits over the leaders once the club has a postseason game with a result (`loadPostseasonLeaders`, #1437; the stats read is `gameType=P`, only after that gate). The rank cells stay regular season.
- **Games** (`next/games/`): the **season grid** (`SeasonGrid.jsx`, model `seasonGrid.js`, ADR-0119),
  then Highlights and Photos. One stamped card of weeks, a week to a row. A decided game links to
  its box score, one to play to its lineup. The gold Postseason band exists only when a game has
  `gameType !== 'R'`. The card holds the one Stamp In door (ADR-0042). Results come from
  `fetchTeamSchedule`, cut at `?d=`: the grid reads `won`, `runs` and `oppRuns` and never `Final`.
- **Roster** (`next/roster/`): lineup and bench, the staff (starters, bullpen, the seven-day pen
  grid), the coaching staff (`CoachingStaff.jsx`, a swipe row that reads its own `fetchCoachingStaff`), the 40-man,
  the injured list, and a door to the transactions ledger. The lineup and staff cards are one
  ruled table each (`RosterBox.jsx`, rows from `boxRows.js`), never the 40-man's `RosterList` row;
  the diamond stands on the club's own park (`team.venue`) in the current season.
- **Farm** (`next/farm/`): `MinorsBody`, the affiliation history, affiliates, Horizon, prospects
  and the depth chart. Absent for a club with no parent org (a MiLB club or winter ball).
- **Money** (`next/money/`): payroll, contract grid, the cliff and the source line. MLB only.
  Not keyed on `asOf`: it is a season's book (ADR-0052).
- **About** (`next/about/`): the ballpark with the manager, franchise history (MLB), jerseys
  (these follow `?d=`) and, for MiLB, Made The Show.
- **Foot** (`next/foot/`): not a band, no jump-bar button. The level's other clubs with the
  Affiliate chip, and the Game Notes card. It adds no request.

Every link keeps `?d=` and `?s=` (the shell wraps the page in `LinkScope`). `?y=2018` is a past season: the as-of `2018-12-31` with no date labels (`isYearView`, `lib/dates.js`); the banner reads "2018 Season" with Show current; `?d=` wins when both are present. Open surface
(ADR-0034, "The cutoff is opt-in now"): nothing here is sealed, and adding a gate is a regression.
Motion plays once per page visit: every band reads `useViewOnce(team.id, band, ready)` (`hooks/motion/useViewOnce.js`, `docs/motion.md`).

**The club schedule runs into October.** `fetchTeamSchedule` returns the postseason rounds at
MLB and the four full-season MiLB levels (11-14), each row tagged `gameType` and a `round`
name (MiLB's L and W read DS and CS; labels come from `g.round`, never `seriesAbbr`), so the Games band, Stamp In and the photo pages list them. A
number that must reconcile with a regular-season ledger (the day-of-week record, the Records
card's completeness check in `loadStandings`) filters on `gameType === 'R'` first. A postseason
row dated after the page's own day is never returned (ADR-0087).
