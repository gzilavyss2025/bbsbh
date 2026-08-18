# 05 — Numbers tab

**Status:** resolved
**Type:** task
**Blocked by:** 01, 02 (both must be merged to `main` first)
**Runs alongside:** issues 03, 04, 06

Read `.scratch/team-page-ia/PRD.md` first. Branch from a freshly fetched
`origin/main` that already contains issues 01 and 02.

## Owns

- `src/screens/team/NumbersTab.jsx` (currently a stub from issue 01)
- new `src/screens/team/data/loadNumbers.js`
- `src/index.css`, **only** inside `/* ==== TEAM HUB: NUMBERS TAB ==== */`

## Must not touch

`src/screens/TeamPage.jsx`, `src/lib/route.js`, `src/App.jsx`, the shell/tab
bar/shelf components, the other three tab files, `src/screens/TeamLeadersPage.jsx`,
or anything in `src/screens/team/modules/` (import them, don't edit them).

## The work

Fill in the tab, rendering inside `TeamHubShell` with `active="numbers"`.

**Full — the division standings table.** `StandingsCard`, complete, with the
Postseason Odds pill and its modal unchanged. The Overview will later show a
three-row preview that links here; this is the full table's home.

**Full — team batting and team pitching ranks.** Both `TeamStatsCard`s.

**Full — team leaders.** The existing `TeamLeaders` component with the featured
categories, keeping both of today's links out: "See all" to
`/team/{id}/leaders` and "Org leaders". Those pages already exist and stay as
they are.

**Shelf — record by day of week.** `TeamStatsCard` in its day-of-week form,
closed by default. Keep today's highlight of the current weekday.

**Shelf — comeback wins.** `ComebackCard`, closed by default, summary figure =
the club's rate at the ≤30% threshold, or the number of comeback wins.

### The loader

Write `loadNumbers.js` by **copying** what the above needs out of `loadTeam` in
`TeamPage.jsx` — the team, division standings, league hitting/pitching team
stats, the postseason-odds snapshot, comeback-win rates, the leaderboard pool
(`loadCombinedPoolForTeams`), and the schedule rows the day-of-week record is
tallied from. Do not import from or edit `TeamPage.jsx`; the temporary
duplication is intentional and issue 07 removes it.

Fetch nothing else. Roster, 40-man, WAR, uniforms, photos, prospects,
affiliates and transactions all belong to other tabs.

Two details in the copied code are load-bearing:

- **standings use the day-before cutoff** on a dated page (`dayBefore(asOf)`),
  and the precomputed scores use the same one, so a dated page never looks
  ahead. Keep both.
- **the day-of-week record reads only cutoff-gated rows** — it tallies `won`,
  which `fetchTeamSchedule` leaves null past the cutoff. Don't re-derive it
  from Final status.

The injured-list cross that marks a hurt player in the leaders list needs the
IL ids, which belong to the Roster tab. Fetch the IL directly here (it is one
cheap call) rather than reaching into another tab's loader.

## Definition of done

- `/team/{id}/numbers` renders standings, both rank tables and leaders; both
  shelves open and close; the odds modal opens and closes.
- "See all" and "Org leaders" still reach their existing pages, carrying `?d=`
  and `?s=`.
- On a dated URL, the standings match what the old page showed for that date.
- A MiLB club renders without crashing (no league rank tables, no odds, no
  comeback data is normal).
- `npm run lint` and `npm test` pass.
- Handoff includes `http://localhost:<port>/team/158/numbers?nointro`.

## Comments

2026-08-18: Closed out — team hub tabs already shipped in `src/screens/team/` (TeamHubShell, RosterTab, GamesTab, NumbersTab, MinorsTab, TeamTabBar). No GitHub issue needed.
