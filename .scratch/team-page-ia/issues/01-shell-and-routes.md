# 01 — Shell, tab bar, shelf, and the five routes

**Status:** resolved
**Type:** task
**Blocked by:** nothing — starts immediately
**Runs alongside:** issue 02 (disjoint files, safe in parallel)

Read `.scratch/team-page-ia/PRD.md` first. This issue lands **every shared-file
change the effort needs**, once, so that no later agent has to touch routing.

## Owns

- `src/lib/route.js`, `src/App.jsx` (the only issue that may touch these)
- new `src/screens/team/TeamHubShell.jsx`, `TeamTabBar.jsx`, `TeamShelf.jsx`
- new `src/screens/team/loadTeamIdentity.js`
- new stub pages `src/screens/team/RosterTab.jsx`, `GamesTab.jsx`,
  `NumbersTab.jsx`, `OrgTab.jsx`
- `src/index.css` — your own banner plus the four empty ones for issues 03–06

## Must not touch

`src/screens/TeamPage.jsx` (issue 02 has it open right now), or any module
under `src/screens/team/modules/`.

## The work

### 1. Routes

Add four routes beside the existing `/team/{id}/leaders`:

```
/team/{id}/roster    /team/{id}/games    /team/{id}/numbers    /team/{id}/org
```

`parseRoute` in `src/lib/route.js` already has a 3-segment `team` branch for
`leaders`, and its header comment records why that branch must come **before**
the generic date branch (otherwise `date='team'` swallows it). Extend that same
branch — do not add a second one — and keep `leaders` working unchanged.

Add a path helper next to `teamLeadersPath`:

```js
export function teamTabPath(id, tab, opts = {}) { … }
```

It must go through `linkQuery(opts)` so `?d=` / `?s=` ride along. **A tab
switch that drops `?d=` is a spoiler bug** — see PRD non-negotiable 1.

Wire the four new route names to their screens in `src/App.jsx`, following how
`team-leaders` is wired today.

### 2. `TeamHubShell`

One component every tab (and later the Overview) renders inside. It owns
everything that is identical across tabs, lifted from `TeamPage.jsx`'s current
header — copy it, don't move it, since that file belongs to issue 02:

- `LinkScope` wrapper with `asOf` / `sportId`
- `SiteHeader`, `AsOfBanner`, `BackBtn`
- the `.team-hub__id` identity header: treatment mark, name, level chip,
  record + division rank, manager line, MiLB parent-org link, Game Notes link
- the header theme (`headerThemeFor` / `headerThemeClass` / `headerThemeStyle`)
- the `TeamFilterStrip` club-browsing strip
- `TeamTabBar` beneath it
- `{children}` for the tab body

Props: `{ team, record, manager, asOf, sportId, active, children }`.

`loadTeamIdentity.js` is its loader: `fetchTeam`, the division standings row for
the record, and `fetchManager`. Nothing else — it must stay cheap, because every
tab pays for it.

### 3. `TeamTabBar`

Five tabs — Overview, Roster, Games, Numbers, Org. The active one is marked
with `aria-current="page"`. Navigation uses `useNav()` with `teamTabPath`, so
it is real routing, not local state: the URL changes, back/forward work, and
each tab is shareable.

Accept an optional `hidden` prop (a set of tab keys) so issue 08 can suppress
tabs that would be empty on a thin MiLB club. Render nothing special for it
now; just don't hard-code five.

Scrolls horizontally if it doesn't fit; the app is phone-first. Follow the
casing invariant — no `.toUpperCase()` in JS, uppercase comes from CSS
(`scripts/check-name-casing.mjs` enforces this).

### 4. `TeamShelf`

The collapsible section every tab uses for secondary modules.

- Closed: one row — title, a headline figure (`summary` prop, e.g. `"4"` or
  `"7–3"`), a chevron. A button, keyboard-reachable, focus ring via
  `var(--focus-ring)`.
- Open: renders `children`.
- `children` is a **render function**, invoked only when open, so a shelf's
  contents (and its fetch) cost nothing while closed. This mirrors
  `SealBox.jsx`'s render-function shape — read it for the pattern. It is *not*
  a spoiler mechanism and must not be described as one.
- Open/closed state is keyed by team id, the same idiom `TeamPage.jsx` already
  uses for `expandedProspectsTeamId` — so navigating to a different club starts
  from the default state instead of inheriting the last club's.
- Optional `defaultOpen`.

### 5. Stubs

Each of the four tab pages renders `TeamHubShell` with its tab active and a
single placeholder line ("Nothing here yet"). Issues 03–06 fill these in;
shipping them as stubs is what lets those four run in parallel.

### 6. CSS banners

Add your styles under `/* ==== TEAM HUB: SHELL + TAB BAR + SHELF ==== */`, and
add the four empty banners for issues 03–06 (exact text in the PRD), spaced
apart so parallel edits merge cleanly.

## Definition of done

- All five URLs render the shell with the correct tab active, on MLB and on a
  MiLB club (try a AAA affiliate).
- `/team/158?d=2026-07-04&s=1` → tapping every tab keeps `?d=` and `?s=` in the
  URL. Check this explicitly; it is the one thing that must not regress.
- Browser back and forward step through tabs correctly.
- `/team/{id}/leaders` still works exactly as before.
- The old `/team/{id}` page is untouched and still renders in full.
- `npm run lint` and `npm test` pass.
- Handoff includes `http://localhost:<port>/team/158/roster?nointro`.

## Comments

2026-08-18: Closed out — team hub tabs already shipped in `src/screens/team/` (TeamHubShell, RosterTab, GamesTab, NumbersTab, MinorsTab, TeamTabBar). No GitHub issue needed.
