# 02 — Extract TeamPage's modules into components

**Status:** ready-for-agent
**Type:** task
**Blocked by:** nothing — starts immediately
**Runs alongside:** issue 01 (disjoint files, safe in parallel)

Read `.scratch/team-page-ia/PRD.md` first.

This is a **pure mechanical refactor with zero visual change**. `/team/{id}`
must render pixel-identically before and after. Its whole purpose is to turn
`TeamPage.jsx`'s twenty inline sections into components the four tab agents can
compose without copying JSX — so the more faithfully it moves code, the better
it has done its job.

## Owns

- `src/screens/TeamPage.jsx`
- new `src/screens/team/modules/*.jsx`

## Must not touch

`src/lib/route.js`, `src/App.jsx`, anything under `src/screens/team/` that
isn't `modules/` (issue 01 is creating the shell there right now), `src/index.css`.

## The work

Move each top-level section of `TeamPage.jsx` — its JSX, its local helper
functions, and its module-scope constants — into its own file under
`src/screens/team/modules/`, then have `TeamPage.jsx` import and render them in
the same order it does today. Suggested files:

| From TeamPage | New module |
| --- | --- |
| standings table + odds pill | `StandingsCard.jsx` |
| `LastTenGamesStrip` | `LastTenGames.jsx` |
| `SeriesStrip` | `SeasonSchedule.jsx` |
| `TeamPhotosRail` | `TeamPhotosRail.jsx` |
| `TeamStats` + day-of-week helpers | `TeamStatsCard.jsx` |
| `ComebackCard` + `ComebackRail` | `ComebackCard.jsx` |
| roster super-section | `RosterProjection.jsx` |
| current roster columns | `CurrentRosterCard.jsx` |
| injured list | `InjuredListCard.jsx` |
| affiliates grid | `AffiliatesCard.jsx` |
| prospects showcase + table | `ProspectsCard.jsx` |
| `RosterList` | `RosterList.jsx` (shared by several) |

`TeamScoreCard`, `TeamTransactionsCard`, `JerseyCombos`, `MilbUniformStrip` and
`CareerTimeline` are already standalone components — leave them where they are.

### Rules

- **Props in, JSX out.** A module takes the data it renders as props. It must
  not fetch, and it must not reach into `loadTeam`'s result shape by importing
  it — pass what it needs explicitly, so a tab agent can hand it data from a
  different loader.
- **Keep every comment.** The existing header comments encode real bugs that
  were fixed once (why the roster projection uses the 40-man list, why the
  photos rail may only ever be given cutoff-filtered games, why the pitcher
  role gets patched from the most recent outing). Move them with their code
  verbatim. Losing them is the main risk in this issue.
- **Don't fix anything.** Not naming, not a stale prop, not an inefficiency. If
  you spot a real bug, write it in the PR description and leave the code alone.
  A refactor PR that also changes behaviour can't be reviewed by eye.
- `loadTeam` stays exactly as it is, in `TeamPage.jsx`. Issue 07 retires it.

### Verifying "no visual change"

Before you start, run the dev server and screenshot `/team/158?nointro` and one
MiLB club (e.g. `/team/5015?nointro`) at full page height. Repeat after, and
compare. Do the same for one section that only appears on MiLB (affiliation
history) and one that only appears on MLB (jersey combos).

## Definition of done

- `TeamPage.jsx` is down to roughly the loader plus a composition of imports.
- Both screenshots match before and after.
- The Season/Current roster toggle, the prospects "show all", the injured-list
  expander, and both horizontal strips still behave identically.
- `npm run lint` and `npm test` pass.
- PR description lists any bug you noticed and deliberately left alone.
- Handoff includes `http://localhost:<port>/team/158?nointro`.
