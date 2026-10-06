# The long at-bat sweep keeps the postseason beside the regular season

**Status:** Accepted
**Date:** 2026-10-06
**Issue:** #1542 (part of the open question #1445; replaces #1505)

## Context

`gen-long-at-bats.mjs` asked the schedule for `gameType=R`, so the offseason note
had no October at-bats. ADR-0094 and ADR-0102 solved the same problem for the pitch
and foul sweeps. #1505 said to count the postseason inside the census. Gary decided
on 2026-10-06 (#1445, #1542) that it counts beside it. The note is a census ("N of
183,866 plate appearances"), so a postseason game must not change that denominator.

## Decision

1. **MLB reads its postseason.** The schedule request asks for `R,F,D,L,W`
   (`ALL_GAME_TYPES` in `scripts/lib/long-at-bats.mjs`). The postseason list is
   `POSTSEASON_GAME_TYPES`, the four rounds and never the umbrella `P`. It is spelled in
   `long-at-bats.mjs` because `records/postseason.mjs` imports `team-records.mjs`, which
   imports this file. A test pins both lists and pins the postseason list equal to the
   shared one. The `Final` check, the played-innings check
   and the first-`dates`-entry de-duplication are unchanged (`playedGamesOf`).
2. **Scope is read off the schedule row, not stored.** `scopeOfGameType` gives `'P'`
   or `'R'` from the game's `gameType` on every run. The scan file keeps its shape, so
   the 2,429 committed entries do not change and nothing is re-read. A stored scope
   would be a second copy of a fact the schedule repeats every night.
3. **The postseason is a new key beside the regular season.** `buildSeasonDoc` writes the
   regular-season census at the top level exactly as before and adds
   `post: { coverage, rows }`, the same shape. `post` exists only once a postseason
   game is on file, so a regular-season-only scan builds the same bytes. Nothing sums
   `post` into the top level. The regular season's `coverage.complete` reads regular
   games only.
4. **The note shows `post` only where there is one.** One line beside the figure
   (the postseason count, its own plate appearances and games), shown when
   `post.coverage.complete` is true (a complete zero is still a count). The wording says
   "regular season" where the figure is the regular season.
5. **Spoiler rule.** A postseason row is a length only: the same keys as a regular row.
   `test/long-at-bats.test.js` runs its vocabulary check on the `post` part too.

## Consequences

- A local run on 2026-10-06 swept the 17 postseason games played so far. The
  regular-season part of `2026.json` was byte for byte what it was (apart from
  `generatedAt`), and all 2,429 scan entries were unchanged. A second run read nothing
  and rewrote neither file. The nightly run owns those two files, so this change does
  not commit them.
- The note renders only in the offseason, which starts the day after the postseason ends
  (`offseasonStartDate` 2026-11-01, `postSeasonEndDate` 2026-10-31). The sweep still
  names 2026 on that day and through February (`noteSeasonFor`), so the last games are
  read before the page shows `post`.
- The nightly run reads the whole season's schedule, not a window, so it adds the
  postseason games by itself. No hand run is needed for the season in play. No 2025
  file exists (the generator first ran on 2026-09-30) and no page reads one, so a
  `--season=2025` run would write a file nothing opens.
- `check-data-freshness.mjs` and the nightly workflow need no change: the file name is
  the same, the nightly step already stages `public` and `scripts/data`, and the
  `long-at-bats/` exception holds.
