// MATCHUP SCOUT — the design prototype's pure half (issue #1408, spec in
// docs/scout-design.md). The region geometry now lives in lib/zone/regions.js
// and the head-to-head labels in lib/scout/format.js, shared with the page.
// What stays is Phase 2's (#1411): the hitter metrics, floors and colour
// bands, run here on ./fixture.js. Nothing here fetches.
import { REGIONS, rollUp } from '../../../lib/zone/regions.js'

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
