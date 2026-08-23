// Gameday hit coordinates → the ballpark diagram's SVG space, plus the one
// exit-velocity line every "this was struck" mark in the app is drawn against.
//
// PURE GEOMETRY, NO FEED. Nothing here reads a game feed, so nothing here can
// reveal a score. That is why it sits in lib/ rather than in api/hitchart.js,
// where it started: TWO cards now share this projection and they sit on
// opposite sides of the spoiler line. The per-game hit chart is reveal-only
// (a dot in the left-field seats is a home run — ADR-0001), while the player
// page's season spray map is a completed-game aggregate on an open surface
// (ADR-0034's footing, the same one war.js and pitchArsenal.js stand on). A
// spray map that imported the projection from hitchart.js would put a
// reveal-only module in an open surface's import graph for four constants,
// which the spoiler manifest forbids outright and should. api/hitchart.js
// re-exports these so its own callers and test/hitchart.test.js are unchanged.
//
// The empirical work behind the two constants is unchanged and still pinned by
// test/hitchart.test.js.

import { HOME } from './ballparkGeometry.js'

// Exit velocity at or above which a batted ball is "hard hit" — MLB's own
// Statcast definition.
export const HARD_HIT_MPH = 95

// Gameday's hit coordinates are pixels on a fixed, park-agnostic overlay whose
// origin (home plate) sits here. Verified against a caught-fly-ball sample:
// every ball's distance from this point, times the scale, agrees with the
// feed's own `totalDistance`.
export const HIT_COORD_ORIGIN = { x: 125.42, y: 198.27 }

// Feet per Gameday coordinate unit. DERIVED EMPIRICALLY, not documented by
// MLB: for each caught fly ball (trajectory `fly_ball`/`popup`, eventType
// `field_out`) carrying a `totalDistance`, the ratio
//   totalDistance / hypot(coordX - 125.42, 198.27 - coordY)
// clusters tightly. Over 39 such balls across gamePks 823427, 823589 and
// 824320 the median was 2.509, with a p10–p90 range of 2.478–2.679. The
// outliers are all short foul popups behind the plate, where the landing
// coordinate sits almost on top of the origin and a few pixels of jitter
// swamp the ratio — see test/hitchart.test.js, which pins this constant
// against that same sample so a feed change that silently shifts every dot
// fails the suite instead of the chart.
export const HIT_COORD_FT_PER_UNIT = 2.51

const round1 = (n) => Math.round(n * 10) / 10

// A Gameday hit coordinate → a point in the ballpark diagram's SVG space. The
// diagram maps FEET 1:1 to SVG units with home plate at HOME, +x toward right
// field and +y up the screen toward center (SVG y grows down, so center field
// SUBTRACTS from home's y — the same convention ballparkGeometry.js's own
// `toSvg` uses). HOME is imported rather than copied so the projection can
// never drift from the drawing it plots onto.
//
// Returns null when either coordinate is missing — a MiLB park that tracked
// the swing but not where the ball landed.
export function hitCoordToSvg(coordX, coordY) {
  if (coordX == null || coordY == null) return null
  const feetX = (coordX - HIT_COORD_ORIGIN.x) * HIT_COORD_FT_PER_UNIT
  const feetY = (HIT_COORD_ORIGIN.y - coordY) * HIT_COORD_FT_PER_UNIT
  return { x: round1(HOME.x + feetX), y: round1(HOME.y - feetY) }
}
