`src/screens/around-the-game/AbsChallengesPage.jsx` is **575 lines against the 600-line cap** in `scripts/check-file-size.mjs`. Six new sections cannot go in it. The guard's own header says the default answer is to split, not to widen the budget table.

This issue does the split ALONE, with no new behaviour, so the six section PRs behind it are each small and reviewable.

## What to do

Move each of the six existing sections into its own component under a new `src/screens/around-the-game/abs/` directory. `src/screens/around-the-game/` holds 7 files today, so six more siblings would take it to 13 and break `check-dir-size`; a subdirectory is the move (ADR-0038).

Suggested shape, one file per `BroadcastSection` already on the page:

- `abs/WhoCalls.jsx` — the role board and the call-split anomaly line
- `abs/ClubBoard.jsx` — the club board and its sort chips
- `abs/PlayerBoards.jsx` — the `.rptpair` pair
- `abs/UmpireBoard.jsx` — the plate-umpire board and its sort chips
- `abs/MissBands.jsx` — the distance bands
- `abs/BiggestOverturn.jsx` — the slab row and its sentence

Each takes `summary` (and `clubs` where it names a club) as props. **Every section must read the `summary` it is given, never the file.** That is what makes the page's existing MLB / Triple-A chip work for the new sections for free, instead of needing its own follow-up.

The page keeps the masthead, the level chips, the slab row, the `useAsync` calls and the source line.

## Acceptance

- `AbsChallengesPage.jsx` is comfortably under 600 lines with headroom for the new sections
- No visual change at all. Load `/abs-challenges?nointro` at MLB and at Triple-A and compare against `main` before and after
- `npm run lint` and `npm test` pass, verified by exit code, not by reading output
- The header comment on `AbsChallengesPage.jsx` keeps its argument (the "FIGURES, NOT PROSE" paragraph) and gains a line saying where the sections now live
