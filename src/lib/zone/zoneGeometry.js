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
// THE VIEW — every pitch plot in this app is drawn from the BROADCAST CAMERA,
// the one in centre field behind the pitcher, and never from the umpire's eye.
//
// The feed reports pX from behind the plate: positive is the catcher's right,
// which is the first-base side. Plot that straight and the picture is the
// umpire's view, where a right-handed batter stands on the LEFT — the mirror
// of the only view of a pitch most people have ever watched. A scorer with the
// game on beside them should not have to flip a diagram in their head to know
// whether a slider ran in on the hitter or away from him, so the projection
// negates pX: +pX (first base) draws to the LEFT, a right-handed batter stands
// to the RIGHT, the way he does on the telecast.
//
// THE MIRROR IS A VIEW, NEVER A STORED FACT. `normalizePitch` and
// `commandCell` below still bin in the feed's own frame, because the nightly
// precompute writes those cells to disk and a stored coordinate that means
// "whichever way we happened to draw it" is a coordinate that rots. A card
// draws a binned cell through `viewCol` instead. test/zone-geometry.test.js
// pins the two together: the cell a pitch is COUNTED into is the cell the
// diagram DRAWS it in, with the same mirror applied to each.
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

// Horizontal MIRRORS the feed — see THE VIEW above. The domain is symmetric,
// so negating pX is the whole of it: sx(EDGE) is the zone's left edge on
// screen, sx(-EDGE) its right.
export const sx = (px) => PAD + ((-px - DOM_X[0]) / (DOM_X[1] - DOM_X[0])) * (W - 2 * PAD)
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
// third-base side, a right-handed batter's inside); rows run TOP to BOTTOM
// (row 0 is above the zone). A card mirrors a column with `viewCol` on its way
// to the screen — see THE VIEW at the top of this file, and never store a
// mirrored cell. Anything beyond the outer ring clamps into it — a pitch that
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

// A binned column, mirrored for the screen — the `sx` of the grid side. Cell
// `i` of a stored counter is drawn at column viewCol(i % GRID), so the season
// map and the in-game diagram put the third-base side in the same place.
export const viewCol = (col) => GRID - 1 - col

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

// Outside the rulebook zone entirely — the chase ring.
export function isChase(cell) {
  return Boolean(cell) && !inZone(cell)
}
