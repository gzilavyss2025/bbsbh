// The Matchup Scout design prototype's pure half (src/screens/designlab/scout/
// model.js, spec docs/scout-design.md). Three things the design rests on:
//
// 1. THE 13 REGIONS partition the 5x5 grid: every cell in exactly one region,
//    every region a rectangle of whole cells, the inner nine the zone's own.
// 2. THE MIRROR keeps the counted cell and the drawn cell the same, in BOTH
//    views — the zone-geometry pin test, run through the toggle (ADR-0077).
// 3. THE CUTOFF hides a plate appearance dated on or after it, and the totals
//    come from the same rows (ADR-0087, ADR-0088).
import assert from 'node:assert/strict'
import test from 'node:test'
import { EDGE, GRID, commandCell, inZone, normalizePitch, sx, sy } from '../src/lib/zone/zoneGeometry.js'
import {
  NOMINAL, REGIONS, REGION_OF, band, drawCol, expected, h2hBefore, h2hTotals, hitterRegions, platePoints, projX, regionLabel, regionRect,
  rollUp, sidesInOrder, stanceRect,
} from '../src/screens/designlab/scout/model.js'
import { h2hRows } from '../src/screens/designlab/scout/fixture.js'
import { isoToday } from '../src/lib/dates.js'

const VIEWS = ['pitcher', 'hitter']

test('every 5x5 cell is in exactly one of 13 regions, and each region is a rectangle', () => {
  assert.equal(REGION_OF.length, GRID * GRID)
  assert.deepEqual([...new Set(REGION_OF)].sort(), [...REGIONS].sort())
  assert.equal(REGIONS.length, 13)
  for (const r of REGIONS) {
    const cells = REGION_OF.flatMap((x, i) => (x === r ? [i] : []))
    const rows = cells.map((i) => Math.floor(i / GRID))
    const cols = cells.map((i) => i % GRID)
    const box = (Math.max(...rows) - Math.min(...rows) + 1) * (Math.max(...cols) - Math.min(...cols) + 1)
    assert.equal(box, cells.length, `${r} is not a rectangle`)
  }
})

test('the inner nine regions are the strike zone cells, one each; the corners join high and low', () => {
  REGION_OF.forEach((r, i) => {
    const cell = { row: Math.floor(i / GRID), col: i % GRID }
    assert.equal(r.startsWith('r'), inZone(cell), `cell ${i}`)
  })
  assert.deepEqual([0, 4, 20, 24].map((i) => REGION_OF[i]), ['high', 'high', 'low', 'low'])
  assert.deepEqual(rollUp(Array(25).fill(1)), { ...Object.fromEntries(REGIONS.map((r) => [r, 1])), high: 5, low: 5, side3b: 3, side1b: 3 })
})

test('in both views, a pitch is drawn inside the region it is counted in', () => {
  // A lattice across the ring's span, kept off the exact cell edges.
  for (let px = -1.17; px <= 1.17; px += 0.0613) {
    for (let pz = 0.98; pz <= 4.12; pz += 0.0717) {
      const cell = commandCell(normalizePitch(px, pz, NOMINAL.top, NOMINAL.bottom))
      for (const view of VIEWS) {
        const { x, y, width, height } = regionRect(REGION_OF[cell.index], view)
        const dx = projX(px, view)
        const dy = sy(pz)
        assert.ok(dx >= x && dx <= x + width && dy >= y && dy <= y + height, `px ${px} pz ${pz} ${view}`)
      }
    }
  }
})

test('drawCol (viewCol in the pitcher’s view) orders cells the way the projection draws them', () => {
  for (const view of VIEWS) {
    const xs = [1, 2, 3].map((c) => regionRect(`r2c${c}`, view).x)
    const order = [1, 2, 3].map((c) => drawCol(c, view))
    assert.deepEqual(order.map((d) => xs[order.indexOf(d)]), [...xs], view)
    for (let i = 0; i < 2; i++) assert.equal(Math.sign(order[i + 1] - order[i]), Math.sign(xs[i + 1] - xs[i]), view)
  }
})

test('the pitcher’s view is the house view and the hitter’s view is its mirror', () => {
  assert.equal(projX(1, 'pitcher'), sx(1))
  const side = (view, r) => regionRect(r, view).x
  // From behind the pitcher the third-base side is on the right…
  assert.ok(side('pitcher', 'side3b') > side('pitcher', 'side1b'))
  // …and from behind the plate it is on the left.
  assert.ok(side('hitter', 'side3b') < side('hitter', 'side1b'))
  // A right-handed hitter stands on the third-base side in both views.
  const zone = (view) => projX(0, view)
  assert.ok(stanceRect('R', 'pitcher').x > zone('pitcher'))
  assert.ok(stanceRect('R', 'hitter').x < zone('hitter'))
  assert.ok(stanceRect('L', 'pitcher').x < zone('pitcher'))
  assert.ok(Math.abs(regionRect('r2c2', 'pitcher').width - (sx(-EDGE) - sx(EDGE)) / 3) < 1e-9)
})

test('a region is named by row, inside or away from the hitter, and the side of the field — never left or right', () => {
  // A right-handed hitter stands on the third-base side, so that side is inside for him.
  assert.equal(regionLabel('r1c1', 'R'), 'Up · inside · 3B side')
  assert.equal(regionLabel('r1c1', 'L'), 'Up · away · 3B side')
  assert.equal(regionLabel('r3c3', 'L'), 'Down · inside · 1B side')
  assert.equal(regionLabel('side1b', 'R'), 'Off the plate · away · 1B side')
  assert.equal(regionLabel('r2c2', 'R'), 'Heart')
  assert.equal(regionLabel('r2c2', 'L'), 'Heart')
  for (const r of REGIONS) for (const st of ['R', 'L']) assert.doesNotMatch(regionLabel(r, st), /left|right/i, `${r} ${st}`)
  // The side labels follow the drawing: first base on the viewer's left from behind the pitcher.
  assert.deepEqual(sidesInOrder('pitcher'), ['1B side', '3B side'])
  assert.deepEqual(sidesInOrder('hitter'), ['3B side', '1B side'])
  // The plate is symmetric about the zone's centre, so both views draw the same shape.
  const xs = (view) => platePoints(view).split(' ').map((p) => Number(p.split(',')[0])).sort((a, b) => a - b)
  assert.deepEqual(xs('pitcher'), xs('hitter'))
  assert.ok(Math.abs((xs('pitcher')[0] + xs('pitcher')[4]) / 2 - projX(0, 'pitcher')) < 1e-9)
})

test('a region under the floor has a count and no value, and no colour band', () => {
  const zeros = () => Array(25).fill(0)
  const counters = { wobaSum: zeros(), paEnd: zeros() }
  counters.paEnd[12] = 9
  counters.wobaSum[12] = 9 * 0.4
  counters.paEnd[6] = 10
  counters.wobaSum[6] = 10 * 0.3
  const hit = hitterRegions(counters, 'xwoba')
  assert.deepEqual(hit.r2c2, { n: 9, value: null })
  assert.equal(hit.r1c1.n, 10)
  assert.ok(Math.abs(hit.r1c1.value - 0.3) < 1e-9)
  assert.equal(band('xwoba', hit.r2c2.value, 0.32), null)
  // The expected value uses the whole-type value where a region is thin.
  const share = Object.fromEntries(REGIONS.map((r) => [r, 0]))
  share.r2c2 = 0.5
  share.r1c1 = 0.5
  assert.ok(Math.abs(expected(share, hit, 0.35) - (0.5 * 0.35 + 0.5 * 0.3)) < 1e-9)
})

test('the head-to-head hides every plate appearance dated on or after the cutoff', () => {
  const rows = h2hRows()
  assert.equal(rows.at(-1).date, isoToday(), 'the fixture carries a row dated today')
  const shown = h2hBefore(rows, isoToday())
  assert.equal(shown.length, rows.length - 1)
  assert.ok(shown.every((r) => r.date < isoToday()))
  // ?d= moves the cutoff: a game ON that date is hidden too.
  const dated = h2hBefore(rows, '2025-10-08')
  assert.ok(dated.every((r) => r.date < '2025-10-08'))
  assert.equal(dated.length, 5)
  const t = h2hTotals(dated)
  assert.deepEqual([t.pa, t.k, t.bb], [5, 1, 1])
  assert.equal(t.slash, '.500/.600/1.250')
})
