// THE STRIKE ZONE's plot geometry — pure, shared by the in-game diagram and by
// the season command map, so the two cannot drift into two different zones.
//
// Lifted verbatim out of components/scoring/StrikeZone.jsx, which now imports
// it back. Nothing here reads a feed or a game: it is arithmetic on the "feet"
// domain the MLB feed reports (pX/pZ, catcher's-eye view) plus each batter's
// own strikeZoneTop/Bottom. Same move api/hitchart.js's projection makes into
// lib/ballpark/, and for the same reason — a projection with two consumers
// belongs to neither of them.
//
// It lives in a DIRECTORY rather than a flat src/lib/zone.js because src/lib
// sits at its check-dir-size budget; a subdirectory is what that guard asks
// for, and it gives the normalisers below a home beside the plot maths.

// Plot geometry, in the same "feet" domain the feed reports. The plate is
// 17in = 1.417ft wide, so the rulebook zone's vertical edges sit at ±0.708ft;
// the domain is a touch wider so pitches just off the plate still land inside.
export const W = 190
export const H = 238
export const PAD = 6
export const DOM_X = [-1.55, 1.55]
export const DOM_Z = [0.4, 4.6]
export const EDGE = 0.708 // half plate width, ft

export const sx = (px) => PAD + ((px - DOM_X[0]) / (DOM_X[1] - DOM_X[0])) * (W - 2 * PAD)
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
// Columns run catcher's-eye LEFT to RIGHT (col 0 is the third-base side, which
// is a right-handed batter's inside); rows run TOP to BOTTOM (row 0 is above
// the zone). Anything beyond the outer ring clamps into it — a pitch that
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

// The EDGE ring: the outermost band of the zone itself plus the chase ring
// against it — where command actually lives. Kept as its own reading rather
// than "in zone or not", because a pitcher who lives on the black and one who
// lives middle-middle can share a zone rate exactly.
export function onEdge(cell) {
  if (!cell) return false
  const mid = (GRID - 1) / 2
  return Math.abs(cell.col - mid) >= 1 || Math.abs(cell.row - mid) >= 1
}
