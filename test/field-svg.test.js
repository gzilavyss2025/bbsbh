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
import {
  fenceFromSvg, auditOutline, pathPoints, SCALE_FT_PER_UNIT,
  legacyFenceFromSvg, auditPosted, LEGACY_SCALE_FT_PER_UNIT, checkLayers,
} from '../scripts/lib/ballpark/field-svg.mjs'
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

// The older minor-league art: no ids. A fill="none" three-point polyline is the
// foul-line template (its lowest point is home), the field is drawn in track and
// grass colours, and the grey shapes are the compass glyph, which never counts.
const legacy = (extra = '') =>
  `<svg viewBox="0 0 250 250">` +
  `<polygon fill="#A68D4B" points="${125 - P},${200 - P} 125,90 ${125 + P},${200 - P} 125,200"/>` +
  `<polygon fill="#989898" points="5,5 60,5 60,60"/>` +
  extra +
  `<polyline fill="none" points="15,90 125,200 235,90"/></svg>`

test('the legacy art is read from its template and its field colours', () => {
  const out = legacyFenceFromSvg(legacy())
  const ft = 100 * LEGACY_SCALE_FT_PER_UNIT
  assert.ok(Math.abs(Math.hypot(...out.points[0]) - ft) < 1, 'LF pole')
  assert.ok(Math.abs(fenceDistanceAt(out.points, 0) - 110 * LEGACY_SCALE_FT_PER_UNIT) < 1, 'straightaway CF')
  assert.ok(out.points[0][0] < 0, 'left field is negative x')
})

test('the compass glyph never becomes the wall', () => {
  // A grey shape far out in center field changes nothing; a field-coloured one would.
  const glyph = legacyFenceFromSvg(legacy('<polygon fill="#DCDCDC" points="115,20 135,20 125,10"/>'))
  assert.ok(Math.abs(fenceDistanceAt(glyph.points, 0) - 110 * LEGACY_SCALE_FT_PER_UNIT) < 1)
})

test('legacy art with no template returns null', () => {
  assert.equal(legacyFenceFromSvg('<svg><polygon fill="#1B833C" points="0,0 10,0 10,10"/></svg>'), null)
})

test('the posted-sign audit passes within 10 ft and fails past it', () => {
  const out = legacyFenceFromSvg(legacy())
  const ft = Math.round(100 * LEGACY_SCALE_FT_PER_UNIT)
  const cf = Math.round(110 * LEGACY_SCALE_FT_PER_UNIT)
  assert.equal(auditPosted(out.points, { lf: ft, cf, rf: ft }).pass, true)
  assert.equal(auditPosted(out.points, { lf: ft, cf: cf + 15, rf: ft }).pass, false)
  assert.equal(auditPosted(out.points, { lf: null, cf, rf: ft }).pass, false, 'a missing sign is not a pass')
})

// The softer layers (slice 5): a playing surface and a track edge are stored
// only when plausible against the audited fence.
test('checkLayers keeps a plausible surface and track, and drops a bad one', () => {
  const fence = [[-240, 240], [-100, 380], [0, 400], [100, 380], [240, 240]]
  const fair = 100000
  // A surface 30 ft beyond the wall all round, with a 55-ft backstop.
  const surface = [[-300, 240], [-110, 420], [110, 420], [300, 240], [60, -55], [-60, -55]]
  const track = [[-226, 226], [-94, 362], [0, 384], [94, 362], [226, 226]]
  assert.deepEqual(checkLayers(fence, fair, { surface, trackInner: track }), { track: true, surface: true })
  // A backstop 20 ft behind the plate is not a ballpark.
  const tight = surface.map(([x, y]) => (y < 0 ? [x, -20] : [x, y]))
  assert.equal(checkLayers(fence, fair, { surface: tight, trackInner: track }).surface, false)
  // A surface that cuts inside the wall at center.
  const short = surface.map(([x, y]) => (y > 400 ? [x, 380] : [x, y]))
  assert.equal(checkLayers(fence, fair, { surface: short, trackInner: track }).surface, false)
  // A track 60 ft wide somewhere.
  const wide = track.map(([x, y], i) => (i === 2 ? [0, 340] : [x, y]))
  assert.equal(checkLayers(fence, fair, { surface, trackInner: wide }).track, false)
})
