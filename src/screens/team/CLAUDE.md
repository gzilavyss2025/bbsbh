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
