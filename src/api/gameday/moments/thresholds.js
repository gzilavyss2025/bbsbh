// The measured numbers behind Gameday's moments (#2608). The "Worthiness" rule in
// docs/callouts.md: set each threshold from the league distribution, not from a
// guess. Spoiler-free: constants only.
//
// Measured 2026-10-26 by .scratch/gameday-engine/measure-moments.mjs over 134
// Final regular-season MLB games on nine dates from April to September 2026:
//
//   measure        n       p50    p90    p95    p99    p99.5  p99.9
//   exit velo      6,894   90.9   104.2  106.4  110.4  111.7  114.6   mph
//   distance       6,895   164    354    380    413    425    442     ft
//   pitch speed    39,768  90.5   96.6   97.7   99.5   100.1  101.4   mph
//   odds swing     10,275  2.2    7.6    10.8   21.7   27.4   45.7    points
//
// The floor of each Statcast kind is its p99 and its full magnitude is at
// p99.9. The odds swing starts at p95 (about four plays a game) and earns its
// full magnitude at p99 (about one play a game), so the one swing a game that
// decides it reaches the Quiet level.

export const STATCAST = {
  hitHard: { floor: 110, full: 115 }, // exit velocity, mph
  hitFar: { floor: 413, full: 442 }, // distance, ft
  thrownFast: { floor: 99.5, full: 101.4 }, // pitch speed, mph
}

export const ODDS_SWING = { floor: 11, full: 22 } // home win %, points
