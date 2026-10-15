# src/screens/team — the team hub (`/team/{id}`)

The hub is not one page — a pinned identity header (`TeamHubShell`, fed by the deliberately
cheap `loadTeamIdentity`) plus **six tabs, each a real route**: Overview
(`TeamPage.jsx`, the bare `/team/{id}`), Roster, Games, Numbers, Contracts, Minors
(`MinorsTab.jsx`, formerly "Org"), plus the pre-existing `/team/{id}/leaders`.
**Each tab loads only its own data** — one `data/load{Tab}.js` per tab, never
a shared mega-fetch (`data/` also holds `loadStampIn.js`, `loadTeamPhotos.js`, and
`loadTransactions.js` for the pages beside the tabs); that is the whole point, not an implementation detail
(ADR-0034, which also records why the old twenty-module scroll was split and
why the loaders were briefly duplicated).

Where things live: roster projection / 40-man / injured list → Roster; schedule,
every decided game, photos, transactions → Games; standings, batting + pitching
ranks, leaders, jerseys, day-of-week, comebacks → Numbers; payroll and contracts →
Contracts; affiliates, prospects, affiliation history → Minors. The Overview holds **previews only**, each ending in
a `.thub__door` link to the tab that owns it, and each is a `preview`/`limit` prop
on the same module the tab renders in full — never a parallel component. The one
pair that isn't literally the same component still lives in one module:
`modules/TeamGames.jsx` exports the Overview's `LastTenGames` rail and the Games
tab's `AllGames` grid over one shared ticket-stub card, since a sideways rail is
the wrong shape for a whole season and a grid is the wrong shape for a preview.

A tab's secondary modules render as full cards, same as its headline module —
no collapsed/shelved state. Every tab path goes through `teamTabPath` →
`linkQuery`, so a dated link keeps its `?d=` across a tab switch.

**The club schedule runs into October.** `fetchTeamSchedule` returns the postseason rounds at
MLB, each row tagged `gameType`, so the Games tab, Last 10, Stamp In and the photo pages list
them. A number that must reconcile with a regular-season ledger (the day-of-week record, the
Records card's completeness check in `loadNumbers.js`) filters on `gameType === 'R'` first. A
postseason row dated after the page's own day is never returned (ADR-0087).

## The one-scroll page (hidden, `/team/{id}/next`; ADR-0082, #1107)

`next/TeamNextPage.jsx`: `TeamHubShell` with the anchor jump bar (`bar` prop), then one `Band`
per `BANDS` entry (`next/bands.js`: Standing, Ranks, Games, Roster, Farm, Money, About). A band
mounts its folder (`next/<band>/index.jsx`) only when near (`useNearView`), so nothing loads
before it is. **A row edits only its own band folder**, never `bands.js`, `Band.jsx` or the page.
Module props: `{ team, asOf, sportId, onReady, onCount }`; call `useBandData` for the two
reports. Absent bands come from `hiddenTeamSections(team)` (`data/shared.js`; the league test
first). Foundation bands mount the tab bodies as they are (`NumbersBody`, `GamesBody`,
`RosterBody`, `MinorsBody`, `ContractsBody`). Standing and Ranks each have their own loader
(`loadStanding`, `loadRanks`; the Numbers tab's `loadNumbers` runs both). A loader's last
argument is `src` (`data/sources.js`): the tabs pass nothing, the page passes `SHARED`
(`next/once.js`), so standings, schedule, roster and /stats are bought once per page.
`/team/{id}/next/{roster|games|numbers|contracts|minors}` lands on the band (`TEAM_TAB_BAND`,
`lib/route.js`) and keeps `?d=` and `?s=`. The six tab routes stay until the swap (row 7).
