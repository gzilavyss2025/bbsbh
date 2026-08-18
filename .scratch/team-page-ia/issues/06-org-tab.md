# 06 — Org tab, with the index grid

**Status:** resolved
**Type:** task
**Blocked by:** 01, 02 (both must be merged to `main` first)
**Runs alongside:** issues 03, 04, 05

Read `.scratch/team-page-ia/PRD.md` first. Branch from a freshly fetched
`origin/main` that already contains issues 01 and 02.

## Owns

- `src/screens/team/OrgTab.jsx` (currently a stub from issue 01)
- new `src/screens/team/data/loadOrg.js`
- `src/index.css`, **only** inside `/* ==== TEAM HUB: ORG TAB ==== */`

## Must not touch

`src/screens/TeamPage.jsx`, `src/lib/route.js`, `src/App.jsx`, the shell/tab
bar/shelf components, the other three tab files, or anything in
`src/screens/team/modules/` (import them, don't edit them).

## The work

Fill in the tab, rendering inside `TeamHubShell` with `active="org"`.

This is the one tab that opens with an **index grid** rather than a reading
order, because its contents are a browse-by-tile list: affiliates, prospects,
jerseys, history. Four tiles, each a label plus one figure (affiliate count,
prospect count, jersey-combo count, seasons of history), each scrolling to its
section below. Tiles for sections with no data don't render.

Below the grid:

**Full — affiliates.** `AffiliatesCard`. On a MiLB club's page, lead with the
parent MLB club's card, as the page does today.

**Full — prospects.** `ProspectsCard`, showing the **whole org list** — drop
today's ten-row preview cap and its "Show all" button. The tab has the room;
that cap only existed because the list was competing with nineteen other
sections. Keep the headshot showcase strip above the table.

**Shelf — jersey combos.** `JerseyCombos` for an MLB club, `MilbUniformStrip`
for a MiLB one, closed by default, summary figure = the combo count.

**Shelf — affiliation history.** MiLB clubs only; `CareerTimeline` with the
parent-org stops, closed by default.

### The loader

Write `loadOrg.js` by **copying** what the above needs out of `loadTeam` in
`TeamPage.jsx` — the team, the affiliate tree, the complex/rookie affiliates,
the prospects snapshot with its level resolution, the uniform catalog and name
overrides, and (MiLB only) the parent-org history. Do not import from or edit
`TeamPage.jsx`; the temporary duplication is intentional and issue 07 removes it.

Fetch nothing else. Roster, standings, schedule, photos, league stats,
transactions and odds all belong to other tabs.

Two details in the copied code are load-bearing and have comments saying so:

- **prospects belong to the org, not the affiliate** — an affiliate's page shows
  the same org-wide list its MLB parent does, keyed off `parentOrgId`;
- **a prospect's level is resolved by live roster membership**, with a stats
  fallback, precisely so the ambiguous scraped level string (`"ALL (2)"`) never
  reaches the screen. Keep both passes.

The jersey strip needs per-game uniform assignments joined against games with a
**visible** result — the same `won != null` filter the rest of the page uses, so
a dated page never counts a game past its cutoff. Keep that filter.

## Definition of done

- `/team/{id}/org` renders the index grid and every section it points at, and
  each tile scrolls to its section.
- The full prospect list renders with no truncation, and every row resolves a
  real level (never `"ALL (2)"`).
- A MiLB affiliate shows the parent club first, plus affiliation history; an
  MLB club shows neither an empty history shelf nor an empty tile.
- `?d=` and `?s=` survive arriving on this tab and leaving it.
- `npm run lint` and `npm test` pass.
- Handoff includes both `http://localhost:<port>/team/158/org?nointro` and a
  MiLB club's org tab.

## Comments

2026-08-18: Closed out — team hub tabs already shipped in `src/screens/team/` (TeamHubShell, RosterTab, GamesTab, NumbersTab, MinorsTab, TeamTabBar). No GitHub issue needed.
