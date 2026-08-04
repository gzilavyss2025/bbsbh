# 03 — Roster tab

**Status:** blocked
**Type:** task
**Blocked by:** 01, 02 (both must be merged to `main` first)
**Runs alongside:** issues 04, 05, 06

Read `.scratch/team-page-ia/PRD.md` first. Branch from a freshly fetched
`origin/main` that already contains issues 01 and 02.

## Owns

- `src/screens/team/RosterTab.jsx` (currently a stub from issue 01)
- new `src/screens/team/data/loadRoster.js`
- `src/index.css`, **only** inside `/* ==== TEAM HUB: ROSTER TAB ==== */`

## Must not touch

`src/screens/TeamPage.jsx`, `src/lib/route.js`, `src/App.jsx`, the shell/tab
bar/shelf components, the other three tab files, or anything in
`src/screens/team/modules/` (import them, don't edit them).

## The work

Fill in the tab, rendering inside `TeamHubShell` with `active="roster"`.

**Full, at the top — the roster projection.** `RosterProjection` with its
Season / Current toggle intact. This is the tab's headline and the reason
someone opens it.

**Shelf — Current roster (40-man).** `CurrentRosterCard`, closed by default,
summary figure = the player count.

**Shelf — Injured list.** `InjuredListCard`, closed by default, summary figure =
the number of players on the IL. This replaces today's bespoke
"Show N injured" button — use `TeamShelf` rather than keeping a second
expander idiom.

### The loader

Write `loadRoster.js` by **copying** the fetches the above needs out of
`loadTeam` in `TeamPage.jsx` — the active roster, the 40-man roster, the IL,
WAR, All-Star ids, prospect badges, rookie flags, the recent-form window and
the per-pitcher game-log fixup. Do not import from or edit `TeamPage.jsx`; the
temporary duplication is intentional and issue 07 removes it (PRD, "Order of
work").

Fetch nothing this tab doesn't render. Standings, schedule, photos, uniforms,
transactions, comebacks, odds, affiliates and prospects all belong to other
tabs — if any of them appear in your loader, the tab is doing another tab's
work and the main point of the effort is lost.

Two behaviours in the copied code are load-bearing and have comments saying so;
carry them across intact:

- the projection reads the **40-man** roster, not the active one, so an injured
  ace still counts as the club's answer at his spot;
- the "current" view excludes anyone on the IL, because that view answers
  *who is available right now*.

## Definition of done

- `/team/{id}/roster` renders the projection, and both shelves open and close.
- The Season / Current toggle still works, and switching clubs resets it.
- A MiLB club renders without crashing; missing pieces read "not posted yet"
  or drop out rather than showing empty chrome.
- `?d=` and `?s=` survive arriving on this tab and leaving it.
- Your loader's network calls are a strict subset of `loadTeam`'s. Note in the
  PR roughly how many requests the tab makes.
- `npm run lint` and `npm test` pass.
- Handoff includes `http://localhost:<port>/team/158/roster?nointro`.
