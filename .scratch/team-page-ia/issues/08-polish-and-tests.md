# 08 — Empty tabs, tests, and the final sweep

**Status:** resolved
**Type:** task
**Blocked by:** 07 (merged to `main`)
**Runs:** alone.

Read `.scratch/team-page-ia/PRD.md` first.

## Owns

- `test/`, `e2e/`
- `src/screens/team/TeamTabBar.jsx` and the tab pages, for empty-state handling
- `docs/testing.md`, `docs/test-games.md` if they need a line

## The work

### 1. Don't show a tab that opens onto nothing

PRD non-negotiable 3. On a thin MiLB feed several tabs have no content at all —
no uniform catalog, no prospects, no transactions, sometimes no league stats.
`TeamTabBar` already accepts a `hidden` set (issue 01); decide each tab's
emptiness cheaply, from data the shell already has, and pass it. Do not fetch a
tab's whole payload just to find out whether its button should render.

A tab that is hidden must still work if someone reaches it by URL — hide the
button, not the route.

### 2. Unit tests

The suite covers the pure data layer, and routing is part of it. Add to
`test/`:

- `teamTabPath` builds each tab's path and **carries `?d=` and `?s=` through**.
  This is the spoiler-relevant one: it is the test that fails if someone later
  "simplifies" the link query away.
- `parseRoute` resolves all five team URLs, still resolves `/team/{id}/leaders`,
  and — the ordering trap the route file warns about — does not mistake
  `/team/{id}/roster` for a date-first route.

Per the repo's test discipline: a test must fail without the code it covers.
Write each one, watch it fail against a deliberately broken version, then keep it.

### 3. One end-to-end walk

Add an `e2e/` spec that loads a club's overview and steps through all five
tabs, asserting each renders its headline section. Import `test`/`expect` from
`e2e/fixtures.js`, never `@playwright/test` — the fixture is what puts
`?nointro` on every navigation.

`npm run e2e` is not CI-gated; it is the browser check the maintainer runs.

### 4. Sweep

- Search for dead CSS: the old page's section wrappers may now be unused. Remove
  only what nothing references, and only from the team-hub banners.
- Confirm the five CSS banners from the PRD are all still present and that no
  tab's styles leaked into another's.
- Check the app for links that still point at the old single page expecting a
  section to be there — game pages, the slate, player pages and the standings
  page all link to `/team/{id}`. Any that meant a specific section should now
  point at that tab.

## Definition of done

- A thin MiLB club shows only tabs with something in them; every hidden tab
  still renders when reached directly by URL.
- New unit tests pass, and each was seen to fail before its fix.
- `npm run e2e` passes the five-tab walk locally.
- `npm run lint`, `npm test` and `npm run build` pass.
- Handoff names the MiLB club you tested and its URL.

## Comments

2026-08-18: Closed out — team hub tabs already shipped in `src/screens/team/` (TeamHubShell, RosterTab, GamesTab, NumbersTab, MinorsTab, TeamTabBar). No GitHub issue needed.
