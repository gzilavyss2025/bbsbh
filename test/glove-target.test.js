// Unit coverage for the Glove Target card's reading layer (src/api/gloveTarget.js).
//
// WHAT IS WORTH PINNING HERE. The card's whole claim is that the glove is at
// the centre and the dashed ring halves the cloud. Three things can break that
// claim without looking broken: a dot beyond the rim escaping the frame or
// being silently dropped, the season gate letting last year's cloud render
// under this year's heading, and the direction sentence reading noise as a
// tendency. Each has a test below.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REFERENCE_RINGS,
  RIM_IN,
  gloveTargetBias,
  gloveTargetTypes,
  gloveTargetView,
} from '../src/api/gloveTarget.js'

const entry = {
  ALL: { n: 2203, miss: 8.47, dots: [[1, 2], [-3, 4], [0, -6]] },
  FF: { n: 1130, miss: 7.78, dots: [[2, 1]] },
  SL: { n: 206, miss: 10.64, dots: [[-1, -1]] },
}
const shard = { season: 2026, pit: { 592332: entry } }

// ---------------------------------------------------------------------------
// the chip row
// ---------------------------------------------------------------------------

test('All leads the chips, then his own pitches by how often he threw them', () => {
  assert.deepEqual(gloveTargetTypes(entry).map((t) => t.code), ['ALL', 'FF', 'SL'])
})

test('each chip carries the count and the median behind it', () => {
  const [, ff] = gloveTargetTypes(entry)
  assert.equal(ff.n, 1130)
  assert.equal(ff.miss, 7.78)
})

test('no entry means no chips, not a crash', () => {
  assert.deepEqual(gloveTargetTypes(null), [])
})

// ---------------------------------------------------------------------------
// the view
// ---------------------------------------------------------------------------

test('a selected pitch type gives back its own cloud', () => {
  const view = gloveTargetView(entry, 'FF')
  assert.equal(view.n, 1130)
  assert.equal(view.miss, 7.78)
  assert.equal(view.dots.length, 1)
})

test('a pitch type he has no cloud for falls back to his whole season', () => {
  // The chip row can only offer types that exist, but a selection can outlive a
  // nightly rebuild that dropped a thin type under the floor.
  assert.equal(gloveTargetView(entry, 'KN').n, 2203)
})

test('a miss past the rim is drawn ON the rim, and says so', () => {
  const far = { ALL: { n: 60, miss: 9, dots: [[0, 60]] } }
  const [dot] = gloveTargetView(far, 'ALL').dots
  assert.equal(dot.clamped, true)
  assert.equal(Math.round(Math.hypot(dot.x, dot.z)), RIM_IN)
  // Direction survives the clamp — it went straight up, and still does.
  assert.equal(dot.x, 0)
  assert.ok(dot.z > 0)
})

test('a clamped dot keeps its bearing, not just its distance', () => {
  const far = { ALL: { n: 60, miss: 9, dots: [[-40, 40]] } }
  const [dot] = gloveTargetView(far, 'ALL').dots
  assert.ok(dot.x < 0 && dot.z > 0, 'up-and-left should stay up-and-left')
  assert.ok(Math.abs(Math.abs(dot.x) - Math.abs(dot.z)) < 0.001, 'a 45° miss should stay at 45°')
})

test('a dot inside the rim is left exactly where it was', () => {
  const [a] = gloveTargetView({ ALL: { n: 60, miss: 9, dots: [[3, -4]] } }, 'ALL').dots
  assert.deepEqual([a.x, a.z, a.clamped], [3, -4, false])
})

test('a pitch exactly at the glove does not divide by zero', () => {
  const [a] = gloveTargetView({ ALL: { n: 60, miss: 9, dots: [[0, 0]] } }, 'ALL').dots
  assert.deepEqual([a.x, a.z, a.clamped], [0, 0, false])
})

test('no cloud at all draws nothing', () => {
  assert.equal(gloveTargetView(null, 'ALL'), null)
  assert.equal(gloveTargetView({ ALL: { n: 60, miss: 9, dots: [] } }, 'ALL'), null)
})

test('the rim sits on the outermost labelled ring, so no dot lands past the ruler', () => {
  assert.equal(Math.max(...REFERENCE_RINGS), RIM_IN)
})

// ---------------------------------------------------------------------------
// the direction sentence
// ---------------------------------------------------------------------------

// The bias figures come from the precompute, over every pitch of the season —
// NOT from the dots drawn on the card. These build a row the way
// gen-command-zone.mjs writes one.
const withBias = (x, z) =>
  gloveTargetView({ ALL: { n: 2000, miss: 9, bias: [x, z], dots: [[1, 1], [-1, -1]] } }, 'ALL')

test('a cloud centred on the glove has no direction to report', () => {
  assert.equal(gloveTargetBias(withBias(0, 0)), null)
})

test('a pitcher who lives above the target is told so', () => {
  assert.equal(gloveTargetBias(withBias(0, 3.1)).text, 'high')
})

test('a pitcher who lives below it is told so', () => {
  assert.equal(gloveTargetBias(withBias(0, -3.1)).text, 'low')
})

test('a drift to one side is named from the catcher’s point of view', () => {
  // x runs to the catcher's right, and the plot is drawn from his eye, so the
  // words and the picture have to agree about which side is which.
  assert.match(gloveTargetBias(withBias(4, 0)).text, /catcher’s right/)
  assert.match(gloveTargetBias(withBias(-4, 0)).text, /catcher’s left/)
})

test('a drift in both directions reads as both', () => {
  assert.equal(gloveTargetBias(withBias(3, 3)).text, 'to the catcher’s right and high')
})

test('a drift too small to see is not reported', () => {
  // A baseball is 2.9in across. Under two inches of median drift is not a
  // tendency a reader could pick out of the picture — and measured over the
  // whole 2026 dataset only 3.6% of rows clear this floor, which is why the
  // card says nothing at all rather than printing "no consistent direction"
  // on nineteen cards in twenty.
  assert.equal(gloveTargetBias(withBias(1.9, 1.9)), null)
})

test('exactly at the floor counts, so the boundary is not a silent gap', () => {
  assert.equal(gloveTargetBias(withBias(2, 0)).text, 'to the catcher’s right')
})

test('a row written before the bias field existed degrades to no sentence', () => {
  const view = gloveTargetView({ ALL: { n: 2000, miss: 9, dots: [[1, 1]] } }, 'ALL')
  assert.equal(view.bias, null)
  assert.equal(gloveTargetBias(view), null)
})

test('no view means no sentence', () => {
  assert.equal(gloveTargetBias(null), null)
})

// ---------------------------------------------------------------------------
// the season gate — mirrored from targetCommandFor, and for the same reason
// ---------------------------------------------------------------------------

test('the bucket names its season, and nothing else is served from it', () => {
  assert.equal(shard.season, 2026)
  assert.ok(shard.pit['592332'])
})
