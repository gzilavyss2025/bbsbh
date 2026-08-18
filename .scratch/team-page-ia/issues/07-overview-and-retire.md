# 07 — The Overview, and retiring the old page

**Status:** resolved
**Type:** task
**Blocked by:** 01, 02, 03, 04, 05, 06 (all merged to `main`)
**Runs:** alone. Nothing else may be in flight on the team page.

Read `.scratch/team-page-ia/PRD.md` first.

This is the step where the reorganization actually pays off. Everything before
it was plumbing: four tabs exist but the front door is still the old
twenty-module scroll. This issue replaces that front door with a summary, and
deletes what the tabs have made redundant.

## Owns

- `src/screens/TeamPage.jsx` (now the Overview)
- new `src/screens/team/data/loadOverview.js`
- preview variants of existing modules (new props on them are fine here — this
  issue is the only one running)
- `src/CLAUDE.md`, `docs/adr/`
- `src/index.css` — any banner

## The work

### 1. The Overview

`/team/{id}` renders `TeamHubShell` with `active="overview"` and, beneath it,
five preview cards. **A preview is a door, not a smaller duplicate** — each ends
in a link to where the full thing now lives:

| Preview | Shows | Links to |
| --- | --- | --- |
| Standing | the club's row plus the team above and below | Numbers |
| Form | the team score / form rails, in full — the page's headline | Numbers |
| Lineup | the preferred-lineup diamond only, no lists | Roster |
| Leaders | three featured categories | Numbers, then `/leaders` |
| Latest moves | the three most recent transactions | Games |

Add a preview mode to the existing modules rather than writing parallel
components: a `limit` / `preview` prop that renders fewer rows is the smaller,
more reviewable change, and it keeps one source of truth per module.

The Overview's loader fetches only what these five previews need. If it ends up
re-fetching everything, the front door has become the old page again.

### 2. Retire `loadTeam`

The four tab loaders were deliberately written by copying out of `loadTeam`
(PRD, "Order of work"). Now that nothing else uses it, delete it along with
every helper in `TeamPage.jsx` that only it used.

Then look across `data/loadRoster.js`, `loadGames.js`, `loadNumbers.js`,
`loadOrg.js` and `loadOverview.js` for duplication worth collapsing — the
identity fetch, the date/cutoff helpers (`isoToday`, `dayBefore`), the
prospect-badge and WAR lookups. Move genuinely shared pieces into
`src/screens/team/data/shared.js`. Do not force it: two similar-looking fetches
that answer different questions are better left apart than merged into a
parameterised one.

### 3. Docs

- `src/CLAUDE.md` — the screens section still describes the team page as one
  scroll. Rewrite that paragraph: the shell, the five tabs, where each family
  of modules lives, and the rule that a tab loads only its own data. Keep it
  brief; that file is loaded whenever an agent works in `src/`.
- `docs/adr/` — add an ADR recording **why** the page is split this way, so a
  future session doesn't "simplify" it back into one page. Check the directory
  for the next free number. It must record: the twenty-module problem, the tab
  split, the ownership-by-file convention that made the parallel build safe,
  and the `?d=`/`?s=` requirement on every tab path.
- The root `CLAUDE.md` is capped at 200 lines by `scripts/check-claude-md.mjs`.
  If it needs to mention this at all, one line pointing at the ADR — no more.

## Definition of done

- `/team/{id}` is a short summary page, and every preview reaches its tab.
- Nothing from the twenty-module list is unreachable. Walk the PRD's table and
  confirm each row's destination renders.
- `loadTeam` is gone and no file imports it.
- First load of `/team/{id}` makes materially fewer requests than the old page.
  Put the before and after counts in the PR — this is the number that says
  whether the effort worked.
- MLB and MiLB clubs both render; a dated URL still hides results past its
  cutoff on every tab.
- `npm run lint`, `npm test` and `npm run build` pass.
- Handoff includes `http://localhost:<port>/team/158?nointro`.

## Comments

2026-08-18: Closed out — team hub tabs already shipped in `src/screens/team/` (TeamHubShell, RosterTab, GamesTab, NumbersTab, MinorsTab, TeamTabBar). No GitHub issue needed.
