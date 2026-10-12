// Unit coverage for scripts/lib/ballpark/field-svg.mjs: the Gameday field SVG
// → fence outline extraction and its audit against Savant (#1859).
//
// The fixtures are tiny hand-made SVGs with known geometry, in Gameday's 250×250
// frame. What is pinned: the scale (feet per unit), the orientation (left field
// is negative x, center is +y), home plate read from the foul lines, a parent
// group's `transform` (several real SVGs flip the field layer in a
// matrix(.98 0 0 -.98 250 420) group), and the audit's pass/fail edges.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fenceFromSvg, auditOutline, pathPoints, SCALE_FT_PER_UNIT } from '../scripts/lib/ballpark/field-svg.mjs'
import { fenceDistanceAt } from '../src/lib/ballpark/layout/fenceAudit.js'

// Home at (125, 200). Foul lines 100 units long at ±45°. The wall: the LF pole,
// a corner 110 units out at straightaway center, the RF pole.
const P = 100 / Math.SQRT2
const wall = `M${125 - P} ${200 - P} L125 90 L${125 + P} ${200 - P} L125 200 Z`
const lines =
  `<path id="left-foul-line_2_" d="M125 200l${-P} ${-P}"/>` +
  `<path id="right-foul-line_2_" d="M125 200l${P} ${-P}"/>`
const svg = (field) => `<svg viewBox="0 0 250 250"><g id="field">${field}${lines}</g></svg>`

test('the outline comes out in feet, left to right, center up', () => {
  const out = fenceFromSvg(svg(`<path id="Outfield_1_" d="${wall}"/>`))
  const p = out.points
  const ft = 100 * SCALE_FT_PER_UNIT
  assert.ok(Math.abs(Math.hypot(...p[0]) - ft) < 1, 'LF pole')
  assert.ok(Math.abs(Math.hypot(...p.at(-1)) - ft) < 1, 'RF pole')
  assert.ok(p[0][0] < 0 && p.at(-1)[0] > 0, 'left field is negative x')
  assert.ok(Math.abs(fenceDistanceAt(p, 0) - 110 * SCALE_FT_PER_UNIT) < 1, 'straightaway CF')
  assert.equal(out.foulAngleDeg, 90)
})

test('a parent group transform is applied', () => {
  // The same wall drawn flipped (y → 400 - y) inside a flipping group.
  const flipped = pathPoints(wall)[0].map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${400 - y}`).join(' ')
  const out = fenceFromSvg(svg(`<g transform="matrix(1 0 0 -1 0 400)"><path id="Outfield_1_" d="${flipped}"/></g>`))
  assert.ok(Math.abs(fenceDistanceAt(out.points, 0) - 110 * SCALE_FT_PER_UNIT) < 1)
})

test('the scale fitted to the poles is reported, not used', () => {
  const out = fenceFromSvg(svg(`<path id="Outfield_1_" d="${wall}"/>`), { poles: { lf: 250, rf: 250 } })
  assert.ok(Math.abs(out.fittedScale - 2.5) < 1e-6)
  assert.ok(Math.abs(Math.hypot(...out.points[0]) - 240) < 1, 'still drawn at the fixed scale')
})

test('missing layers return null rather than a guess', () => {
  assert.equal(fenceFromSvg('<svg><path id="grass_1_" d="M0 0L1 1"/></svg>'), null)
})

test('relative and curve commands parse', () => {
  const [sp] = pathPoints('M10 10h5v5l-5 0c0-1 1-2 2-2s3 1 3 2z')
  assert.deepEqual(sp[0], [10, 10])
  assert.deepEqual(sp[1], [15, 10])
  assert.deepEqual(sp[2], [15, 15])
  assert.deepEqual(sp[3], [10, 15])
  assert.deepEqual(sp.at(-1), [10, 10], 'z closes to the start')
  // Compact Illustrator numbers: "1.6-1.6" and ".7-.2" are two numbers each.
  const [c] = pathPoints('M0 0l1.6-1.6.7-.2')
  assert.deepEqual(c.map((q) => q.map((n) => Math.round(n * 10) / 10)), [[0, 0], [1.6, -1.6], [2.3, -1.8]])
})

test('the audit passes a matching outline and fails a moved wall', () => {
  const out = fenceFromSvg(svg(`<path id="Outfield_1_" d="${wall}"/>`))
  const at = (deg) => fenceDistanceAt(out.points, deg)
  const measured = {
    dist: { lf: 240, lc: at(-18), cf: 264, rc: at(18), rf: 240 },
    deepest: 264,
    areaSqFt: out.areaSqFt,
  }
  assert.equal(auditOutline(out.points, out.areaSqFt, measured).pass, true)
  // Center field moved in 10 ft: the CF and deepest checks catch it.
  const moved = { ...measured, dist: { ...measured.dist, cf: 254 }, deepest: 254 }
  const r = auditOutline(out.points, out.areaSqFt, moved)
  assert.equal(r.pass, false)
  assert.equal(r.errors.cf, 10)
  // The area alone catches a wall moved along one stretch.
  assert.equal(auditOutline(out.points, out.areaSqFt, { ...measured, areaSqFt: measured.areaSqFt * 0.96 }).pass, false)
})
