# 04 — Games tab

**Status:** resolved
**Type:** task
**Blocked by:** 01, 02 (both must be merged to `main` first)
**Runs alongside:** issues 03, 05, 06

Read `.scratch/team-page-ia/PRD.md` first. Branch from a freshly fetched
`origin/main` that already contains issues 01 and 02.

## Owns

- `src/screens/team/GamesTab.jsx` (currently a stub from issue 01)
- new `src/screens/team/data/loadGames.js`
- `src/index.css`, **only** inside `/* ==== TEAM HUB: GAMES TAB ==== */`

## Must not touch

`src/screens/TeamPage.jsx`, `src/lib/route.js`, `src/App.jsx`, the shell/tab
bar/shelf components, the other three tab files, or anything in
`src/screens/team/modules/` (import them, don't edit them).

## The work

Fill in the tab, rendering inside `TeamHubShell` with `active="games"`.

**Full — the season schedule.** `SeasonSchedule` (the series strip). The tab's
headline.

**Full — results.** `LastTenGames`, keeping its scroll-back-to-Opening-Day
behaviour.

**Shelf — Photos.** `TeamPhotosRail`, closed by default. Because `TeamShelf`
takes a render function, a closed shelf must not mount the rail at all — so the
photo walk-back only starts when someone opens it. That is the single biggest
first-load saving on this tab; verify in the network panel that a closed shelf
issues no photo requests.

**Shelf — Transactions.** `TeamTransactionsCard`, closed by default, summary
figure = the number of days in the first page.

### The loader

Write `loadGames.js` by **copying** what the above needs out of `loadTeam` in
`TeamPage.jsx` — the team, the schedule, the All-Star game card, and the first
transactions page. Do not import from or edit `TeamPage.jsx`; the temporary
duplication is intentional and issue 07 removes it.

Fetch nothing else. Roster, WAR, prospects, uniforms, league stats, standings
and odds all belong to other tabs.

**Spoiler footing — read before touching the photos rail.** The rail may only
ever be handed `allDecidedGames(schedule)`, never the raw schedule.
`fetchTeamSchedule` sets `won` only for games at or before the page's `asOf`
cutoff, so that filtered list is what keeps a celebration photo from narrating
a result the visitor hasn't reached. The rail's own header comment explains
this at length; keep it, and keep passing the filtered list.

## Definition of done

- `/team/{id}/games` renders the schedule and results; both shelves open and
  close.
- With the Photos shelf closed, no `/photos` requests are made. Say so in the PR.
- Scroll-back in both the results strip and the photos rail still grows the
  window without jumping the scroll position.
- A MiLB club renders without crashing (no transactions, no photos is normal).
- `?d=` and `?s=` survive arriving on this tab and leaving it. On a dated URL,
  no game after the cutoff shows a result.
- `npm run lint` and `npm test` pass.
- Handoff includes `http://localhost:<port>/team/158/games?nointro`.

## Comments

2026-08-18: Closed out — team hub tabs already shipped in `src/screens/team/` (TeamHubShell, RosterTab, GamesTab, NumbersTab, MinorsTab, TeamTabBar). No GitHub issue needed.
