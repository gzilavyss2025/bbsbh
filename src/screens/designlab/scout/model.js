// MATCHUP SCOUT — the design prototype's pure half (issue #1408, spec in
// docs/scout-design.md). Throwaway: Phase 1 (#1410) lifts REGION_OF, rollUp,
// projX/regionRect and the head-to-head helpers into the real page's modules.
// Nothing here fetches. Every number it sees comes from ./fixture.js.
import { EDGE, GRID, sx, sy, viewCol } from '../../../lib/zone/zoneGeometry.js'

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
export function regionLabel(region, stance) {
  const insideSide = stance === 'R' ? 'side3b' : 'side1b'
  const inOrAway = (side) => (side === insideSide ? 'inside' : 'away')
  if (region === 'high') return 'High · above the zone'
  if (region === 'low') return 'Low · below the zone'
  if (SIDE_LABEL[region]) return `Off the plate · ${inOrAway(region)} · ${SIDE_LABEL[region]}`
  if (region === 'r2c2') return 'Heart'
  const row = Number(region[1])
  const col = Number(region[3])
  if (col === 2) return `${ROW_WORD[row]} · middle`
  const side = col === 1 ? 'side3b' : 'side1b'
  return `${ROW_WORD[row]} · ${inOrAway(side)} · ${SIDE_LABEL[side]}`
}

// ---------------------------------------------------------------------------
// THE HITTER'S METRICS, each with its floor (issue #1408's spike). Under the
// floor a region is gray and prints its count, never a value.
export const METRICS = {
  xwoba: { label: 'xwOBA (est.)', num: 'wobaSum', den: 'paEnd', floor: 10, unit: 'PA-ending pitches', near: 0.03, far: 0.07 },
  whiff: { label: 'Whiff %', num: 'whiffs', den: 'swings', floor: 10, unit: 'swings', near: 0.04, far: 0.1 },
  swing: { label: 'Swing %', num: 'swings', den: 'pitches', floor: 10, unit: 'pitches', near: 0.04, far: 0.1 },
}

// Inside a map cell there is room for three figures, not four: xwOBA drops
// its leading point there (".381" prints "381"); the lines below the maps
// keep it.
export const fmtCell = (metric, v) => (metric === 'xwoba' ? String(Math.round(v * 1000)) : `${Math.round(v * 100)}`)

export const fmtMetric = (metric, v) =>
  v == null ? '—' : metric === 'xwoba' ? v.toFixed(3).replace(/^0/, '') : `${Math.round(v * 100)}`

// Per region: { value, n } with value null under the floor.
export function hitterRegions(counters, metric) {
  const m = METRICS[metric]
  const num = rollUp(counters[m.num])
  const den = rollUp(counters[m.den])
  return Object.fromEntries(
    REGIONS.map((r) => [r, { n: den[r], value: den[r] >= m.floor ? num[r] / den[r] : null }]),
  )
}

// The hitter's whole-type value, the fallback for a thin region. Null under
// the floor too: a postseason-only type on four pitches has no value at all.
export function typeValue(counters, metric) {
  const m = METRICS[metric]
  const sum = (a) => a.reduce((x, y) => x + y, 0)
  const den = sum(counters[m.den])
  return den >= m.floor ? sum(counters[m.num]) / den : null
}

// -2..2 against the league's rate in the same region and pitch type.
export function band(metric, value, league) {
  if (value == null || league == null) return null
  const { near, far } = METRICS[metric]
  const d = value - league
  return Math.abs(d) < near ? 0 : Math.sign(d) * (Math.abs(d) < far ? 1 : 2)
}

// Expected value on one pitch type: sum over regions of the pitcher's share
// times the hitter's value there, the hitter's whole-type value standing in
// for a thin region.
export function expected(pitchShare, hitter, fallback) {
  if (fallback == null) return null
  return REGIONS.reduce((s, r) => s + pitchShare[r] * (hitter[r].value ?? fallback), 0)
}

// ---------------------------------------------------------------------------
// HEAD TO HEAD. The cutoff is a date (ADR-0087, ADR-0088): a plate appearance
// counts only when its game is dated before the cutoff. The totals are built
// from the same filtered rows, so the line and the list cannot disagree.
export const h2hBefore = (rows, cutoff) => rows.filter((r) => r.date < cutoff)

export const ROUND = { R: 'REG', F: 'WC', D: 'DS', L: 'LCS', W: 'WS' }

const HITS = { single: 1, double: 2, triple: 3, home_run: 4 }
const NO_AB = new Set(['walk', 'intent_walk', 'hit_by_pitch', 'sac_fly', 'sac_bunt'])

export function h2hTotals(rows) {
  const t = { pa: rows.length, ab: 0, h: 0, tb: 0, bb: 0, hbp: 0, sf: 0, k: 0 }
  for (const { event } of rows) {
    if (!NO_AB.has(event)) t.ab++
    if (HITS[event]) { t.h++; t.tb += HITS[event] }
    if (event === 'walk' || event === 'intent_walk') t.bb++
    if (event === 'hit_by_pitch') t.hbp++
    if (event === 'sac_fly') t.sf++
    if (event === 'strikeout' || event === 'strikeout_double_play') t.k++
  }
  const rate = (n, d) => (d > 0 ? (n / d).toFixed(3).replace(/^0/, '') : '—')
  t.slash = [rate(t.h, t.ab), rate(t.h + t.bb + t.hbp, t.ab + t.bb + t.hbp + t.sf), rate(t.tb, t.ab)].join('/')
  return t
}

// Scorebook shorthand for a Savant `events` value (plus bb_type for an out).
const SHORT = {
  strikeout: 'K', walk: 'BB', intent_walk: 'IBB', hit_by_pitch: 'HBP', single: '1B',
  double: '2B', triple: '3B', home_run: 'HR', sac_fly: 'SF', field_error: 'E',
  grounded_into_double_play: 'DP',
}
const OUT = { ground_ball: 'GO', fly_ball: 'FO', line_drive: 'LO', popup: 'PO' }
export const resultShort = ({ event, bbType }) => SHORT[event] ?? OUT[bbType] ?? 'Out'
