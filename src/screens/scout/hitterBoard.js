import { hitterCounters } from '../../api/scout/hitterGrid.js'
import { METRICS, band, expected, fmtCell, hitterRegions, typeValue } from '../../lib/scout/metrics.js'
import { REGIONS, rollUp } from '../../lib/zone/regions.js'

// THE SCOUT'S HITTER BOARD (#1411, phase 2): the hitter's map and the numbers
// that join it to the pitcher's. Pure, and shared by the page and its Design
// Lab prototype, so the prototype's fixture exercises the page's own logic.
//
// THE DATA is the hitter-grid store (ADR-0096), read by api/scout/hitterGrid.js:
// `grid` is one hitter's { season, reg, post } and `league` the same shape for
// every MLB hitter summed. `hitterCounters` cuts either one by pitch type,
// pitcher hand, the hitter's side and scope, into 25-cell COUNTERS (pitches,
// swings, whiffs, paEnd, and `wobaSum`, null until the xwOBA estimate for a
// ball in play is on file; then the "xwOBA (est.)" metric is off).
//
// Every sum stays one season: the page reads one season store at a time.
const KEYS = ['pitches', 'swings', 'whiffs', 'paEnd', 'wobaSum']
const SCOPE = { reg: 'R', post: 'P', all: null }
const sum = (a) => a.reduce((x, y) => x + y, 0)
const add = (a, b) => a.map((x, i) => x + b[i])

// Many COUNTERS into one. `wobaSum` survives only if every part has it.
export function sumCounters(list) {
  if (!list.length) return null
  return Object.fromEntries(
    KEYS.map((k) => [k, list.every((c) => Array.isArray(c[k])) ? list.map((c) => c[k]).reduce(add) : null]),
  )
}

// The metrics this hitter's grid can show: xwOBA (est.) only when it carries
// `wobaSum`. The page opens on the first one.
export function metricsFor(grid) {
  const any = Array.isArray(hitterCounters(grid)?.wobaSum)
  return Object.keys(METRICS).filter((m) => m !== 'xwoba' || any)
}

const toneOf = (b) => (b == null ? 'mid' : b < 0 ? `lo${-b}` : b > 0 ? `hi${b}` : 'mid')

// The pitch types in `codes`, summed, for one cut of a grid.
const pooled = (grid, codes, cut) => sumCounters(codes.map((code) => hitterCounters(grid, { ...cut, code })).filter(Boolean))

// One hitter map: `codes` the pitch types it pools (one, or all for All),
// `hand` the pitcher hand ('R' | 'L', or null for both), `stand` the side the
// hitter stands on in this map, `scope` 'reg' | 'post' | 'all'. Each region
// is coloured against the league's rate in the same region, pitch types,
// pitcher hand and stance (column 0 is inside for one stance and away for the
// other, ADR-0096). Under the metric's floor it is hatched and prints its
// count. `leagueFlat` is the league's whole-type rate (Gary, item 12).
export function hitterMap({ grid, league, codes, hand, stand, scope, metric }) {
  const m = METRICS[metric]
  const sc = SCOPE[scope] ?? null
  const counters = pooled(grid, codes, { hand, scope: sc })
  if (!counters || !counters[m.num]) return null
  const hit = hitterRegions(counters, metric)
  const lg = pooled(league, codes, { hand, stand, scope: sc })
  const lgNum = lg?.[m.num] ? rollUp(lg[m.num]) : null
  const lgDen = lg?.[m.den] ? rollUp(lg[m.den]) : null
  const lgRegion = (r) => (lgNum && lgDen?.[r] ? lgNum[r] / lgDen[r] : null)
  const cells = Object.fromEntries(
    REGIONS.map((r) => [r, hit[r].value == null
      ? { tone: 'gray', count: hit[r].n }
      : { tone: toneOf(band(metric, hit[r].value, lgRegion(r))), value: fmtCell(metric, hit[r].value), count: hit[r].n }]),
  )
  const flatDen = lg?.[m.den] ? sum(lg[m.den]) : 0
  return {
    hit,
    cells,
    typeVal: typeValue(counters, metric),
    leagueFlat: flatDen && lg[m.num] ? sum(lg[m.num]) / flatDen : null,
    seen: sum(counters.pitches),
  }
}

// The expected value on one pitch type (the pitcher's share times the
// hitter's value, region by region; the hitter's whole-type value stands in
// for a thin region), and the overall line: each pilled type's expected
// value weighed by its usage, with the share of pitches it covers.
export const expectedOn = (pitcherMap, hitter) =>
  pitcherMap && hitter && !pitcherMap.thin ? expected(pitcherMap.share, hitter.hit, hitter.typeVal) : null

export function expectedAll(types, byType) {
  const scored = types.filter((t) => byType[t.code] != null)
  const covered = sum(scored.map((t) => Number(t.pct))) / 100
  const weigh = (key) =>
    covered ? sum(scored.map((t) => Number(t.pct) * byType[t.code][key])) / 100 / covered : null
  return { value: weigh('exp'), league: scored.every((t) => byType[t.code].league != null) ? weigh('league') : null, covered }
}

// THE WHOLE HITTER SIDE for one pitcher board: the hitter's map for All and
// for each pilled type, each with its expected value and the league's, and
// the overall line. All pools the same types as the pitcher's All map
// (`board.codes`). `league` per map is the league's whole-type rate, and null
// where the pitcher's map is too thin to weigh it. Null with no grid: the page
// keeps its Phase 1 hitter line.
export function hitterSide({ board, grid, league, hand, stand, scope, metric }) {
  if (!board || !grid) return null
  const one = (pitcherMap, codes) => {
    const h = hitterMap({ grid, league, codes, hand, stand, scope, metric })
    return h && { ...h, exp: expectedOn(pitcherMap, h), league: pitcherMap.thin ? null : h.leagueFlat }
  }
  const byType = Object.fromEntries(board.types.map((t) => [t.code, one(board.byType[t.code], [t.code])]))
  const scored = Object.fromEntries(Object.entries(byType).map(([c, h]) => [c, h?.exp != null ? h : null]))
  return { all: one(board.all, board.codes), byType, overall: expectedAll(board.types, scored) }
}
