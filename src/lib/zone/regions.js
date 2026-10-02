// THE MATCHUP SCOUT'S 13 REGIONS, and how a map draws them (#1408, #1410;
// docs/scout-design.md, A). Pure geometry over zoneGeometry.js: the stored
// 5x5 command cells never change, a region is a read-time sum, and both views
// draw through the same projection a single pitch takes. Shared by the Scout
// page and its Design Lab prototype. test/scout-regions.test.js pins it.
import { EDGE, GRID, sx, sy, viewCol } from './zoneGeometry.js'

// ---------------------------------------------------------------------------
// THE 13 REGIONS. The inner nine are the strike zone's own thirds, one 5x5
// cell each. The ring's 16 cells make four bands: the full top row (corners
// included), the full bottom row, and the three zone-height cells on each
// side. Corners go to the top and bottom bands because they act like them:
// across the 2026 pitcher shards, a low corner's whiff rate per swing is 71%,
// below the zone's 48%, and the sides' 16-28% (docs/scout-design.md, A).
//
// Every region is a rectangle of whole cells, so a map draws it as one rect,
// and REGION_OF is the only table: the stored 5x5 shards never change.
// Columns are the FEED's frame (col 0 = third-base side), as in commandCell.
export const REGIONS = [
  'high', 'low', 'side3b', 'side1b',
  'r1c1', 'r1c2', 'r1c3', 'r2c1', 'r2c2', 'r2c3', 'r3c1', 'r3c2', 'r3c3',
]
export const REGION_OF = Array.from({ length: GRID * GRID }, (_, i) => {
  const row = Math.floor(i / GRID)
  const col = i % GRID
  if (row === 0) return 'high'
  if (row === GRID - 1) return 'low'
  if (col === 0) return 'side3b'
  if (col === GRID - 1) return 'side1b'
  return `r${row}c${col}`
})

// A 25-cell counter, summed into the 13 regions.
export function rollUp(cells) {
  const out = Object.fromEntries(REGIONS.map((r) => [r, 0]))
  cells.forEach((n, i) => { out[REGION_OF[i]] += n })
  return out
}

// ---------------------------------------------------------------------------
// THE MIRROR. 'pitcher' is the house view (ADR-0077): sx as it ships, +pX
// (first base) on the left. 'hitter' is the catcher's view: the same sx read
// through one negation. A drawn cell is computed from the SAME projection a
// pitch would take, so the cell a pitch is counted in is the cell the map
// draws, in both views (test/scout-design.test.js pins it).
export const projX = (px, view) => (view === 'hitter' ? sx(-px) : sx(px))
// A stored column's drawn position, for a card that draws 5x5 cells one by
// one (CommandMap's way): the house mirror is viewCol, the hitter's view none.
export const drawCol = (col, view) => (view === 'hitter' ? col : viewCol(col))

// A nominal zone for the map's frame: a season map spans many batters, so it
// draws one shape (CommandMap does the same). Edges in the normalised units
// normalizePitch returns; one ring cell is one third of the zone, like a cell.
export const NOMINAL = { top: 3.5, bottom: 1.6 }
const X_EDGES = [-5 / 3, -1, -1 / 3, 1 / 3, 1, 5 / 3] // by feed column
const Z_EDGES = [4 / 3, 1, 2 / 3, 1 / 3, 0, -1 / 3] // by row, top first
const pzOf = (zn) => NOMINAL.bottom + zn * (NOMINAL.top - NOMINAL.bottom)

function span(a, b) {
  return [Math.min(a, b), Math.abs(a - b)]
}

// The rect a region draws in, in zoneGeometry's viewBox units.
export function regionRect(region, view) {
  const cells = REGION_OF.flatMap((r, i) => (r === region ? [i] : []))
  const cols = cells.map((i) => i % GRID)
  const rows = cells.map((i) => Math.floor(i / GRID))
  const c0 = Math.min(...cols)
  const c1 = Math.max(...cols)
  const [x, width] = span(projX(X_EDGES[c0] * EDGE, view), projX(X_EDGES[c1 + 1] * EDGE, view))
  const y = sy(pzOf(Z_EDGES[Math.min(...rows)]))
  const height = sy(pzOf(Z_EDGES[Math.max(...rows) + 1])) - y
  return { x, y, width, height }
}

// The batter's box: a right-handed hitter stands on the third-base side
// (negative pX), a left-handed one on the first-base side. Projected, so the
// mirror moves it with the cells.
// 0.42 ft wide: room for the stance letter.
export function stanceRect(stance, view) {
  const sign = stance === 'R' ? -1 : 1
  const [x, width] = span(projX(sign * 1.2, view), projX(sign * 1.62, view))
  const y = sy(pzOf(Z_EDGES[1]))
  return { x, y, width, height: sy(pzOf(Z_EDGES[4])) - y }
}

// Home plate, the zone's width, drawn under the low band. The pentagon is
// symmetric about the zone's centre, so the mirror leaves it alone.
export const PLATE_DEPTH = 9
export function platePoints(view) {
  const [x, width] = span(projX(-EDGE, view), projX(EDGE, view))
  const y = sy(pzOf(Z_EDGES[5])) + 3
  const mid = y + PLATE_DEPTH / 2
  return [[x, y], [x + width, y], [x + width, mid], [x + width / 2, y + PLATE_DEPTH], [x, mid]]
    .map((p) => p.join(',')).join(' ')
}

// The map's viewBox: the ring, the plate, and whichever side the box is on.
export function mapBox(stance, view) {
  const xs = [projX(X_EDGES[0] * EDGE, view), projX(X_EDGES[5] * EDGE, view)]
  const s = stanceRect(stance, view)
  xs.push(s.x, s.x + s.width)
  const top = sy(pzOf(Z_EDGES[0]))
  const bottom = sy(pzOf(Z_EDGES[5])) + 3 + PLATE_DEPTH
  const x0 = Math.min(...xs) - 2
  return `${x0} ${top - 2} ${Math.max(...xs) - x0 + 2} ${bottom - top + 4}`
}

// The map's two sides, the one drawn on the viewer's left first. Field
// sides, never "left" or "right" (ADR-0077).
export const SIDE_LABEL = { side3b: '3B side', side1b: '1B side' }
export const sidesInOrder = (view) =>
  (regionRect('side1b', view).x < regionRect('side3b', view).x ? ['side1b', 'side3b'] : ['side3b', 'side1b'])
    .map((r) => SIDE_LABEL[r])

// A region's name for the readout line, from the hitter's stance: a right-
// handed hitter's inside is the third-base side. Labels, not sentences.
const ROW_WORD = { 1: 'Up', 2: 'Middle', 3: 'Down' }
// `stance` null: the two maps draw different stances (a switch hitter with
// the other hand picked), so "inside" would be true on one map only. The name
// then says only the side of the field, which is true on both (Gary, item 11).
export function regionLabel(region, stance) {
  const insideSide = stance === 'R' ? 'side3b' : 'side1b'
  const on = (side) => (stance ? `${side === insideSide ? 'inside' : 'away'} · ` : '') + SIDE_LABEL[side]
  if (region === 'high') return 'High · above the zone'
  if (region === 'low') return 'Low · below the zone'
  if (SIDE_LABEL[region]) return `Off the plate · ${on(region)}`
  if (region === 'r2c2') return 'Heart'
  const row = Number(region[1])
  const col = Number(region[3])
  if (col === 2) return `${ROW_WORD[row]} · middle`
  return `${ROW_WORD[row]} · ${on(col === 1 ? 'side3b' : 'side1b')}`
}
