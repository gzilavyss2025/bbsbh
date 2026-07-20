Status: resolved

# Fired permanent manager still shown instead of the active interim

## Reported

2026-07-20: the Mets fired manager Carlos Mendoza, but the 7/20/26 Mets @
Brewers lineup page still showed Mendoza as the Mets' manager.

## Reproduction

`GET https://statsapi.mlb.com/api/v1/teams/121/coaches?season=2026` returns
**both** rows for the season, not just the current one:

```json
{ "person": { "fullName": "Carlos Mendoza" }, "job": "Manager", "jobId": "MNGR" },
{ "person": { "fullName": "Andy Green" }, "job": "Interim Manager", "jobId": "NTRM" }
```

MLB's coaches endpoint doesn't remove a fired permanent manager's `'Manager'`
row once an interim replaces him mid-season — it just adds the interim's
`'Interim Manager'` row alongside it. `fetchManager` (`src/api/game.js`)
picked between the two rows with:

```js
const mgr = managers.find((r) => r.job === 'Manager') ?? managers[0] ?? null
```

— i.e. it explicitly preferred the permanent `'Manager'` job whenever both
were present, so it kept surfacing Mendoza for the rest of the season.

## Fix

Flip the preference: when both a permanent and an interim manager appear in
the same season's roster, the interim is the one actually running the team,
so `fetchManager` now prefers `job !== 'Manager'` (the interim) over the
permanent row. A lone permanent manager (the ordinary case) or a lone interim
(no permanent row on file at all — the pre-existing "Don Mattingly, 2026
Phillies" case in the code comment) are both unaffected.

Changed: `src/api/game.js` (`fetchManager` + its header comment).

## Tests

`test/manager.test.js` — mocks the coaches endpoint to reproduce the
Mendoza/Green shape above and asserts the interim wins, plus covers the
sole-permanent, sole-interim, and Associate-Manager-exclusion cases that were
already implicit in the code but untested.

## Note on scope

This only affects the LIVE "who manages this game" surfaces
(`fetchManager` → `useGameData.js`, `loadScorecard.js`, `TeamPage.jsx`) — the
Manager History page (`src/api/managers.js`, `public/data/manager-history.json`)
is unaffected; it already has its own hand-verified
`scripts/manager-transitions-seed.json` mechanism for splitting a shared
season's win-loss record once a transition date is known.
