// THE STRIKE ZONE's plot geometry — pure, shared by the in-game diagram and by
// the season command map, so the two cannot drift into two different zones.
//
// Lifted verbatim out of components/scoring/StrikeZone.jsx, which now imports
// it back. Nothing here reads a feed or a game: it is arithmetic on the "feet"
// domain the MLB feed reports (pX/pZ, measured from the catcher's side of the
// plate) plus each batter's own strikeZoneTop/Bottom. Same move
// api/hitchart.js's projection makes into lib/ballpark/, and for the same
// reason — a projection with two consumers belongs to neither of them.
//
// It lives in a DIRECTORY rather than a flat src/lib/zone.js because src/lib
// sits at its check-dir-size budget; a subdirectory is what that guard asks
// for, and it gives the normalisers below a home beside the plot maths.
//
// ---------------------------------------------------------------------------
// THE VIEW — every zone chart in this app is drawn from the CATCHER'S side
// (ADR-0124, which supersedes ADR-0077), the way MLB's Gameday draws it.
//
// The feed reports pX from behind the plate: positive is the catcher's right,
// which is the first-base side. `catcherX` plots it as it comes: +pX (first
// base) draws to the RIGHT, and a right-handed batter stands on the LEFT.
// No chart negates pX, and no card mirrors a binned column: the stored 5x5
// cells (commandCell, below) are in the feed's frame and draw in it too.
// test/zone-geometry.test.js pins the two together: the cell a pitch is
// COUNTED into is the cell the diagram DRAWS it in.
// ---------------------------------------------------------------------------

// Plot geometry, in the same "feet" domain the feed reports. The plate is
// 17in = 1.417ft wide, so the rulebook zone's vertical edges sit at ±0.708ft;
// the domain is a touch wider so pitches just off the plate still land inside.
export const W = 190
export const H = 238
export const PAD = 6
export const DOM_X = [-1.55, 1.55]
export const DOM_Z = [0.4, 4.6]
export const EDGE = 0.708 // half plate width, ft

// Horizontal: the feed's pX as it comes — see THE VIEW above. catcherX(-EDGE)
// is the zone's left edge on screen (the third-base side), catcherX(EDGE) its right.
export const catcherX = (px) => PAD + ((px - DOM_X[0]) / (DOM_X[1] - DOM_X[0])) * (W - 2 * PAD)
// In that view a right-handed batter's box (third-base side) is LEFT of the plate, a lefty's right, and
// Gameday's art for his own stance draws as it comes ('left' / 'right' are its folders).
export const boxLeftOfPlate = (batSide) => batSide === 'R'
export const stanceArt = (batSide) => (batSide === 'L' ? 'left' : 'right')
// SVG y grows downward, so height flips: the top of the zone maps to a small y.
export const sy = (pz) => PAD + ((DOM_Z[1] - pz) / (DOM_Z[1] - DOM_Z[0])) * (H - 2 * PAD)

// ---------------------------------------------------------------------------
// NORMALISATION — what makes a SEASON aggregate mean anything.
//
// One at-bat's diagram can draw raw feet against that batter's own zone,
// because there is only one batter. A season's cannot: a 6'7" hitter's letters
// and a 5'8" hitter's are different heights in feet, so raw pZ would smear a
// pitcher's command across the strike zones of everyone he faced. So height is
// expressed against the zone the pitch was actually thrown into, and width in
// half-plate units, where ±1 IS the black of the plate.
//
// Returns null unless the feed gave all four numbers — at MiLB parks with no
// tracking they are simply absent, and a pitch with no location is not a pitch
// at coordinate zero.
// ---------------------------------------------------------------------------
export function normalizePitch(px, pz, szTop, szBottom) {
  if (![px, pz, szTop, szBottom].every((v) => typeof v === 'number' && Number.isFinite(v))) return null
  const height = szTop - szBottom
  // A zone with no height (or an inverted one) is bad data, not a tall batter.
  if (!(height > 0)) return null
  return { xn: px / EDGE, zn: (pz - szBottom) / height }
}

// The command grid: 5x5 cells whose MIDDLE NINE are the strike zone's own
// thirds — the same nine the in-game diagram rules off. The outer ring is one
// cell of chase territory on every side, so a pitch off the plate lands
// somewhere honest instead of being clamped onto the black.
//
// Columns run in the FEED's own frame, not the drawn one (col 0 is the
// third-base side, a right-handed batter's inside), which is also the order a
// card draws them in, left to right (THE VIEW, above); rows run TOP to BOTTOM
// (row 0 is above the zone). Anything beyond the outer ring clamps into it — a pitch that
// bounces to the backstop is still "way low", and a separate bucket for it
// would carry a handful of pitches and no meaning.
export const GRID = 5
export const ZONE_CELLS = 3

function band(value, lo, hi) {
  // Which of the middle three bands `value` falls in, or the outer ring.
  if (value < lo) return 0
  if (value > hi) return GRID - 1
  const t = (value - lo) / (hi - lo) // 0..1 across the zone
  return 1 + Math.min(ZONE_CELLS - 1, Math.floor(t * ZONE_CELLS))
}

export function commandCell(norm) {
  if (!norm) return null
  const col = band(norm.xn, -1, 1)
  // Rows are drawn top-down while zn grows upward, so the vertical band flips.
  const zRow = band(norm.zn, 0, 1)
  const row = GRID - 1 - zRow
  return { col, row, index: row * GRID + col }
}

// True when the pitch was in the rulebook zone — the middle nine cells.
export function inZone(cell) {
  return Boolean(cell) && cell.col > 0 && cell.col < GRID - 1 && cell.row > 0 && cell.row < GRID - 1
}

// THE HEART — the one cell in the middle of the zone, where a mistake gets hit.
//
// This started life as an "edge" reading and the live data killed it: on a
// three-by-three zone, "on the edge" means every cell except the middle one, so
// it measured 94% for the first pitcher it ran against and would have measured
// about that for everyone. A 5x5 grid is too coarse to carry a shadow-zone
// rate honestly, so it reports the thing this resolution CAN say — how often he
// leaves it middle-middle — and leaves the edge rate to a finer grid or to
// Savant, rather than shipping a number that is really a constant.
export function inHeart(cell) {
  if (!cell) return false
  const mid = (GRID - 1) / 2
  return cell.col === mid && cell.row === mid
}
