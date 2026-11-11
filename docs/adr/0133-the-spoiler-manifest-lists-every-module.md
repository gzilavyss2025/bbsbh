# The spoiler manifest lists every module, not only the hazards

**Status:** Accepted (Gary, 2026-11-11). Rejects the change proposed in #3037.
**Date:** 2026-11-11

## Context

`src/api/spoiler-manifest.json` classifies every module under `src/api/`, and
`scripts/check-spoiler-manifest.mjs` fails lint when a module has no entry. About two
thirds of the entries are `spoiler-free` (192 of 289 on 2026-11-11). File moves change
manifest keys, so the file churns: 21 non-merge commits on `main` between 2026-10-11 and
2026-11-11, many of them moves (#3031 moved five logbook modules and renamed five keys).

The 2026-11-11 architecture audit (candidate #4) asked whether the manifest should list
only the non-free classes and treat an unlisted module as spoiler-free.

What the guard would still catch. Containment (`GATED_CLASSES` in the guard) fails an
importer that is not on the allowlist of a `reveal-only` or `reveal-gated` module, or that
imports a `revealOnlyExports` name from a `mixed` module. It does **not** police
`caller-gated`, `cutoff-gated` or `progress-only` modules, or the spoiler-free exports of
a `mixed` one. So an unlisted hazard module escapes the guard when it imports no
reveal-only, reveal-gated or sealed-mixed code.

The tripwire we measured for that case: fail when an unlisted module, comments stripped,
matches

```
\b(linescore|liveData|allPlays|scoringPlays|currentPlay|isScoringPlay|homeScore|awayScore|playsByInning|decisions)\b
```

- It trips 11 of the 192 spoiler-free modules, which is workable.
- Of the 67 `reveal-only`, `reveal-gated`, `mixed`, `progress-only` and `caller-gated`
  modules, **13 escape both containment and the tripwire**: `expresslane/runners.js`,
  `gameStory.js`, `heritage/records.js`, `highlights.js` (mixed), `matchup/forHalf.js`
  (caller-gated), `notable/notable.js`, `performanceScore.js`,
  `playbyplay/entriesView.js`, `playbyplay/scorebookCode.js`, `savant/attackAngle.js`,
  `savant/gameFeed.js`, `scorecard/alignment.js` (caller-gated) and `umpireFavor.js`. The
  rest are reveal-only. They receive plays or a feed as arguments, or read Savant or
  static data, and never name a feed path or import gated code.
- Widening the pattern (`.result`, `.about`, `rbi`, `boxscore`, `gamePk`, …) trips 53
  spoiler-free modules and still misses most of these.

So a new module shaped like `performanceScore.js` or `umpireFavor.js` would default to
spoiler-free under "hazards only", and lint would pass.

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
  check that catches a module like the 13 above. The regex and list here let them
  re-run this measurement.
- Module headers keep stating their class in prose. When a header and the manifest
  disagree, the manifest wins and the header is the bug (also stated in
  `src/api/CLAUDE.md`).
