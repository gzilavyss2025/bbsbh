# The spoiler manifest lists every module, not only the hazards

**Status:** Accepted (Gary, 2026-11-11). Rejects the change proposed in #3037.
**Date:** 2026-11-11

## Context

`src/api/spoiler-manifest.json` classifies every module under `src/api/`, and
`scripts/check-spoiler-manifest.mjs` fails lint when a module has no entry. About two
thirds of the entries are `spoiler-free` (192 of 289 on 2026-11-11). File moves change
manifest keys, so the file churns: 18 commits in the month before 2026-11-11, most of
them moves (#3031 edited 5 keys for one pure move).

The 2026-11-11 architecture audit (candidate #4) asked whether the manifest should list
only the hazard classes and treat an unlisted module as spoiler-free. The guard already
fails when an unlisted module imports a reveal-only, reveal-gated or mixed module
(containment), so the open question was a new hazard module that imports none of them.

We measured a tripwire for that case: fail when an unlisted module reads score-shaped
feed fields (`linescore`, `liveData`, `allPlays`, `homeScore`, `awayScore`,
`isScoringPlay`, `scoringPlays`, `currentPlay`, `decisions`, …), comments stripped.

- The narrow pattern trips 11 of the 192 spoiler-free modules, which is workable.
- It misses about half of today's non-free modules. They get plays or a feed as
  arguments and never name a feed path.
- A broad pattern (adding `.result`, `.about`, `rbi`, `boxscore`, `gamePk`, …) trips 53
  spoiler-free modules and still misses 9 reveal-only, gated or mixed modules, among
  them `playbyplay.js`, `gameday/stepCut.js`, `performanceScore.js` and `umpireFavor.js`.

So the field-name check we tried cannot catch a new module shaped like `playbyplay.js`.
Under "hazards only" that module would default to spoiler-free and lint would pass.

## Decision

1. **Every `src/api` module keeps an entry**, `spoiler-free` ones included. The
   completeness assertion stays. A `spoiler-free` entry is a reviewed statement, not
   noise (the manifest's `$about` says so).
2. **The churn from moves is accepted.** It is mechanical, and the guard names each
   stale or missing key, so a move costs a rename of keys and no judgment.
3. **Option 3 of #3037 (a header marker as the record) is not taken either.** It would
   end the doubled prose, but it means a 289-file migration and does not change the
   safety trade-off.

## Consequences

- Future audits should not propose "list only the hazards" again unless they bring a
  check that catches a module which gets the feed as an argument. This ADR records the
  measurement showing a field-name tripwire does not.
- Module headers keep stating their class in prose. When a header and the manifest
  disagree, the manifest wins and the header is the bug.
