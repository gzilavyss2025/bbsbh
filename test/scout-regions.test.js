// The Matchup Scout's 13 regions (src/lib/zone/regions.js; #1408, #1410).
// Two things the page and its prototype rest on:
//
// 1. THE 13 REGIONS partition the 5x5 grid: every cell in exactly one region,
//    every region a rectangle of whole cells, the inner nine the zone's own.
// 2. THE MIRROR keeps the counted cell and the drawn cell the same, in BOTH
//    views — the zone-geometry pin test, run through the toggle (ADR-0077,
//    ADR-0093).
import assert from 'node:assert/strict'
import test from 'node:test'
import { EDGE, GRID, commandCell, inZone, normalizePitch, sx, sy } from '../src/lib/zone/zoneGeometry.js'
import {
  NOMINAL, REGIONS, REGION_OF, drawCol, platePoints, projX, regionLabel, regionRect, rollUp, sidesInOrder, stanceRect,
} from '../src/lib/zone/regions.js'

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
  // Two different stances on the two maps: the name keeps only the field side.
  assert.equal(regionLabel('r1c1', null), 'Up · 3B side')
  assert.equal(regionLabel('side1b', null), 'Off the plate · 1B side')
  for (const r of REGIONS) for (const st of ['R', 'L', null]) assert.doesNotMatch(regionLabel(r, st), /left|right/i, `${r} ${st}`)
  // The side labels follow the drawing: first base on the viewer's left from behind the pitcher.
  assert.deepEqual(sidesInOrder('pitcher'), ['1B side', '3B side'])
  assert.deepEqual(sidesInOrder('hitter'), ['3B side', '1B side'])
  // The plate is symmetric about the zone's centre, so both views draw the same shape.
  const xs = (view) => platePoints(view).split(' ').map((p) => Number(p.split(',')[0])).sort((a, b) => a - b)
  assert.deepEqual(xs('pitcher'), xs('hitter'))
  assert.ok(Math.abs((xs('pitcher')[0] + xs('pitcher')[4]) / 2 - projX(0, 'pitcher')) < 1e-9)
})
