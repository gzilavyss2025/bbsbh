// The percentile radar's geometry (src/lib/radarGeometry.js). The polygon is
// the one part of the player profile card that can be visually wrong in ways a
// screenshot review misses — a spoke rotated to the wrong axis, a label sitting
// on top of the shape, a null metric quietly changing the number of sides — so
// every one of those is pinned here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { AVERAGE_RING, LABEL_ROOM, radarGeometry, spokeAngle } from '../src/lib/radarGeometry.js'

const spoke = (key, percentile, value = null) => ({ key, label: key, percentile, value })
const FIVE = [
  spoke('xera', 72, '3.90'),
  spoke('k', 40, '20.9%'),
  spoke('bb', 52, '8.4%'),
  spoke('hardHit', 16, '44.0%'),
  spoke('whiff', 89, '21.9%'),
]

const pairs = (s) => s.split(' ').map((p) => p.split(',').map(Number))

// --------------------------------------------------------------------------
// spokeAngle — where the spokes point
// --------------------------------------------------------------------------
test('the first spoke points straight up', () => {
  assert.equal(spokeAngle(0, 5), -Math.PI / 2)
})

test('spokes run clockwise and divide the circle evenly', () => {
  const step = spokeAngle(1, 5) - spokeAngle(0, 5)
  assert.ok(step > 0, 'clockwise in SVG coordinates means increasing angle')
  assert.ok(Math.abs(step - (Math.PI * 2) / 5) < 1e-12)
})

// --------------------------------------------------------------------------
// radarGeometry — the shape
// --------------------------------------------------------------------------
test('a polygon needs at least three sides', () => {
  assert.equal(radarGeometry([spoke('a', 50), spoke('b', 50)]), null)
  assert.notEqual(radarGeometry([spoke('a', 50), spoke('b', 50), spoke('c', 50)]), null)
})

test('one point and one axis per spoke, however many there are', () => {
  const g = radarGeometry(FIVE)
  assert.equal(g.points.length, 5)
  assert.equal(g.axes.length, 5)
  assert.equal(pairs(g.shape).length, 5)
  assert.equal(pairs(g.outline).length, 5)
})

test('the outline is the rim and the average ring is half of it', () => {
  const g = radarGeometry(FIVE)
  const [topOutline] = pairs(g.outline)
  const [topAverage] = pairs(g.averageRing)
  // Both sit straight above centre; the average ring at AVERAGE_RING of the way out.
  assert.ok(Math.abs(topOutline[0] - g.center.x) < 0.01)
  assert.ok(Math.abs(g.center.y - topOutline[1] - g.radius) < 0.01)
  assert.ok(Math.abs(g.center.y - topAverage[1] - g.radius * AVERAGE_RING) < 0.01)
})

test('a higher percentile plots farther from the centre', () => {
  const dist = (g, i) => Math.hypot(g.points[i].x - g.center.x, g.points[i].y - g.center.y)
  const g = radarGeometry([spoke('low', 10), spoke('mid', 50), spoke('high', 95)])
  assert.ok(dist(g, 0) < dist(g, 1))
  assert.ok(dist(g, 1) < dist(g, 2))
})

test('a 100th-percentile spoke reaches the rim exactly', () => {
  const g = radarGeometry([spoke('a', 100), spoke('b', 100), spoke('c', 100)])
  for (const p of g.points) {
    assert.ok(Math.abs(Math.hypot(p.x - g.center.x, p.y - g.center.y) - g.radius) < 0.01)
  }
})

test('a 0th-percentile spoke is pinched, not collapsed onto the centre', () => {
  // A point exactly at the centre reads as missing data rather than as
  // worst-in-league, and it takes the polygon's area with it.
  const g = radarGeometry([spoke('a', 0), spoke('b', 50), spoke('c', 50)])
  const d = Math.hypot(g.points[0].x - g.center.x, g.points[0].y - g.center.y)
  assert.ok(d > 0, 'not collapsed')
  assert.ok(d < g.radius * 0.1, 'still clearly the worst spoke')
})

test('a null metric keeps its side and is reported as unknown', () => {
  // Dropping it would turn a pentagon into a square and make this player's
  // shape incomparable to everyone else's at a glance.
  const g = radarGeometry([spoke('a', 80), spoke('b', null), spoke('c', 30)])
  assert.equal(g.points.length, 3)
  assert.equal(g.points[1].known, false)
  assert.equal(g.axes[1].percentile, null)
  const d = Math.hypot(g.points[1].x - g.center.x, g.points[1].y - g.center.y)
  assert.ok(Math.abs(d - g.radius * AVERAGE_RING) < 0.01, 'plotted on the average ring')
})

test('a known spoke is marked known', () => {
  const g = radarGeometry(FIVE)
  assert.ok(g.axes.every((a) => Number.isFinite(a.percentile)))
  assert.ok(g.points.every((p) => p.known))
})

// --------------------------------------------------------------------------
// Labels — the part that visibly breaks if it's wrong
// --------------------------------------------------------------------------
test('labels sit outside the rim, never on the shape', () => {
  const g = radarGeometry(FIVE)
  for (const a of g.axes) {
    const d = Math.hypot(a.labelX - g.center.x, a.labelY - g.center.y)
    assert.ok(d > g.radius, `${a.key} label at ${d} is inside the rim ${g.radius}`)
  }
})

test('label anchors stay inside the viewBox', () => {
  for (const g of [radarGeometry(FIVE), radarGeometry(FIVE, { size: 200, padding: 34 })]) {
    for (const a of g.axes) {
      assert.ok(a.labelX >= 0 && a.labelX <= g.width, `${a.key} x=${a.labelX} out of bounds`)
      assert.ok(a.labelY >= 0 && a.labelY <= g.height, `${a.key} y=${a.labelY} out of bounds`)
    }
  }
})

test('side labels have room for their TEXT, not just their anchor', () => {
  // The bug this exists for: the first version had no horizontal gutter, so
  // "Hard-hit ↓" ran off the left edge of the viewBox and was clipped in the
  // browser — while every bounds assertion passed, because the anchor POINT
  // was comfortably inside. SVG text runs outward from an end/start anchor, so
  // the anchor needs LABEL_ROOM of clearance on the side the text grows toward.
  const g = radarGeometry(FIVE)
  for (const a of g.axes) {
    if (a.anchor === 'end') {
      assert.ok(a.labelX >= LABEL_ROOM, `${a.key} has only ${a.labelX} units to its left`)
    }
    if (a.anchor === 'start') {
      assert.ok(g.width - a.labelX >= LABEL_ROOM, `${a.key} has only ${g.width - a.labelX} units to its right`)
    }
  }
})

test('the value line under a bottom label stays in the box', () => {
  // Each spoke prints its raw value one line (~1.15em) below the label; a
  // bottom spoke's label sitting flush with the edge would push that off.
  const g = radarGeometry(FIVE)
  for (const a of g.axes) {
    if (a.baseline === 'hanging') {
      assert.ok(g.height - a.labelY >= 28, `${a.key} value line would overflow the bottom`)
    }
  }
})

test('the viewBox width matches the CSS cap so one unit is one CSS pixel', () => {
  // .statradar__svg caps the rendered width at 400px and the spoke labels use
  // the --fs-* type tokens; if these drift apart every label silently renders
  // at the wrong size. See radarGeometry's size/gutter note.
  assert.equal(radarGeometry(FIVE).width, 400)
})

test('the gutter widens the box without moving the polygon off centre', () => {
  const g = radarGeometry(FIVE, { size: 320, padding: 54, gutter: 40 })
  assert.equal(g.width, 400)
  assert.equal(g.height, 320)
  assert.equal(g.center.x, 200)
  assert.equal(g.center.y, 160)
})

test('the default box is wider than it is tall — the labels need the width', () => {
  const g = radarGeometry(FIVE)
  assert.ok(g.width > g.height)
  assert.equal(g.center.x, g.width / 2)
  assert.equal(g.center.y, g.height / 2)
})

test('a top spoke centres its text, a right-hand spoke left-aligns it', () => {
  const g = radarGeometry(FIVE)
  assert.equal(g.axes[0].anchor, 'middle') // 12 o'clock
  assert.equal(g.axes[1].anchor, 'start') // right side — text runs away from the shape
  assert.equal(g.axes[4].anchor, 'end') // left side
})

test('the top spoke hangs its text above the rim', () => {
  const g = radarGeometry(FIVE)
  assert.equal(g.axes[0].baseline, 'auto')
  assert.ok(g.axes[0].labelY < g.center.y)
})

test('a four-spoke radar puts one label on each side', () => {
  const g = radarGeometry([spoke('n', 50), spoke('e', 50), spoke('s', 50), spoke('w', 50)])
  assert.deepEqual(g.axes.map((a) => a.anchor), ['middle', 'start', 'middle', 'end'])
  assert.deepEqual(g.axes.map((a) => a.baseline), ['auto', 'middle', 'hanging', 'middle'])
})

test('the raw value and the lower-is-better flag ride through to the label', () => {
  const g = radarGeometry([
    { key: 'bb', label: 'BB%', percentile: 52, value: '8.4%', lowerIsBetter: true },
    spoke('b', 50),
    spoke('c', 50),
  ])
  assert.equal(g.axes[0].value, '8.4%')
  assert.equal(g.axes[0].lowerIsBetter, true)
  assert.equal(g.axes[1].lowerIsBetter, false)
})

test('size and padding scale the frame', () => {
  const g = radarGeometry(FIVE, { size: 300, padding: 40, gutter: 0 })
  assert.equal(g.size, 300)
  assert.equal(g.width, 300)
  assert.equal(g.center.x, 150)
  assert.equal(g.radius, 110)
})
