// THE MATCHUP SCOUT'S HITTER METRICS (#1408 design, #1411 data): each metric,
// its floor, its colour bands, and the expected value that joins the two maps.
// Pure: the page and its Design Lab prototype both call it. Under a floor a
// region prints its count, never a value (Gary, item 3: swing % floors at 10
// pitches). test/scout-design.test.js pins the floors and the expected sum.
import { REGIONS, rollUp } from '../zone/regions.js'

// ---------------------------------------------------------------------------
// THE HITTER'S METRICS, each with its floor (issue #1408's spike). Under the
// floor a region is gray and prints its count, never a value.
export const METRICS = {
  xwoba: { label: 'xwOBA (est.)', num: 'wobaSum', den: 'paEnd', floor: 10, unit: 'PA-ending pitches', near: 0.03, far: 0.07 },
  whiff: { label: 'Whiff %', num: 'whiffs', den: 'swings', floor: 10, unit: 'swings', near: 0.04, far: 0.1 },
  swing: { label: 'Swing %', num: 'swings', den: 'pitches', floor: 10, unit: 'pitches', near: 0.04, far: 0.1 },
}

// A map cell prints the same figure as the lines below it (".381"). The cell
// is about 27 px wide on a phone, so its figures set tight (scout.css).
export const fmtCell = (metric, v) => (metric === 'xwoba' ? v.toFixed(3).replace(/^0/, '') : `${Math.round(v * 100)}`)

export const fmtMetric = (metric, v) =>
  v == null ? '—' : metric === 'xwoba' ? v.toFixed(3).replace(/^0/, '') : `${Math.round(v * 100)}`

// A rate in running text or a readout, with its unit: ".391" for xwOBA (est.),
// "24%" for Whiff % and Swing % (#1490: every percentage ends in "%").
export const fmtValue = (metric, v) => (v == null ? '—' : metric === 'xwoba' ? fmtMetric(metric, v) : `${fmtMetric(metric, v)}%`)

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
