// The kraft seal's tear path (src/lib/sealTear.js).
//
// The promise this module makes is not "it looks jagged" — it is that the same
// seal tears the SAME way forever, that no two seals in one game tear alike,
// and that the two halves are cut from one shared edge so the cover comes apart
// instead of being swapped for two shapes that nearly meet. All three are
// properties of a function, so all three are pinned here rather than only by
// looking at a running app. The motion itself is CSS and is not this suite's.
import assert from 'node:assert/strict'
import test from 'node:test'

import { stampSeed } from '../src/lib/stampArt.js'
import {
  TEAR_MIDLINE,
  TEAR_SWING,
  TEAR_VERTICES,
  sealTearEdge,
  sealTearPolygons,
  sealTearSeed,
} from '../src/lib/sealTear.js'

const GAME = 776543

// Pull the "x% y%" pairs back out of a polygon() string, as numbers.
const pointsOf = (poly) => {
  const inner = poly.replace(/^polygon\(/, '').replace(/\)$/, '')
  return inner.split(', ').map((p) => p.split(' ').map((n) => Number(n.replace('%', ''))))
}

// ---------------------------------------------------------------------------
// The seed: derived from the stamp's, stepped by the half
// ---------------------------------------------------------------------------

test('the seal seed is built from the stamp seed, not a second hash of its own', () => {
  // Not an implementation detail to restate — it is the reason a seal and a
  // stamp for the same game can never disagree about what "this game's number"
  // means. If stampSeed's fallback or range moves, this moves with it.
  assert.equal(sealTearSeed(GAME, 0), (stampSeed(GAME) * 31) % 1000)
})

test('the same seal seeds the same forever', () => {
  assert.equal(sealTearSeed(GAME, 7), sealTearSeed(GAME, 7))
  assert.deepEqual(sealTearEdge(sealTearSeed(GAME, 7)), sealTearEdge(sealTearSeed(GAME, 7)))
})

test('every half of one game gets its own seed', () => {
  // A full game plus a long extras run — no collisions anywhere in that range,
  // which is what 137 being coprime with 1000 buys.
  const seeds = new Set()
  for (let half = 0; half < 40; half += 1) seeds.add(sealTearSeed(GAME, half))
  assert.equal(seeds.size, 40)
})

test('two different games tear differently in the same half', () => {
  assert.notEqual(sealTearSeed(GAME, 3), sealTearSeed(GAME + 1, 3))
})

test('a missing or unusable gamePk/halfIndex still yields a number, never a random one', () => {
  for (const bad of [undefined, null, NaN, 'not-a-game', Infinity]) {
    const seed = sealTearSeed(bad, bad)
    assert.equal(Number.isFinite(seed), true, `seed for ${String(bad)}`)
    assert.equal(seed, sealTearSeed(bad, bad))
  }
  // A half-index the caller never passed is the zeroth half, not a wildcard.
  assert.equal(sealTearSeed(GAME, undefined), sealTearSeed(GAME, 0))
})

// ---------------------------------------------------------------------------
// The edge
// ---------------------------------------------------------------------------

test('the edge spans the full width and stays inside its swing', () => {
  for (let half = 0; half < 20; half += 1) {
    const edge = sealTearEdge(sealTearSeed(GAME, half))
    assert.equal(edge.length, TEAR_VERTICES)
    assert.equal(edge[0][0], 0)
    assert.equal(edge[edge.length - 1][0], 100)
    for (const [x, y] of edge) {
      assert.ok(x >= 0 && x <= 100, `x ${x} on the cover`)
      assert.ok(
        Math.abs(y - TEAR_MIDLINE) <= TEAR_SWING + 1e-9,
        `y ${y} within ${TEAR_SWING} of the midline`,
      )
    }
  }
})

test('the vertices march left to right, never doubling back', () => {
  // A polygon whose edge reverses direction folds over itself, which clips as a
  // notch out of the middle of a half rather than as a tooth.
  const edge = sealTearEdge(sealTearSeed(GAME, 2))
  for (let i = 1; i < edge.length; i += 1) assert.ok(edge[i][0] > edge[i - 1][0])
})

test('teeth alternate across the midline, and none of them sits on it', () => {
  // A vertex parked on the midline reads as a cut, not a tear; a run of teeth
  // on one side reads as a fold.
  const edge = sealTearEdge(sealTearSeed(GAME, 5))
  edge.forEach(([, y], i) => {
    assert.ok(i % 2 === 0 ? y < TEAR_MIDLINE : y > TEAR_MIDLINE, `vertex ${i} crosses the midline`)
    assert.ok(Math.abs(y - TEAR_MIDLINE) > 1e-9)
  })
})

test('neighbouring halves do not tear near-identically', () => {
  // The failure this guards is specific: near-neighbour seeds fed to a plain
  // linear generator hand back near-identical FIRST values, which would put the
  // same opening tooth on every seal in a game. The finaliser in tearRandom is
  // what stops that, and this is what would notice if it were dropped.
  //
  // Measured across the WHOLE edge, not one vertex: two genuinely independent
  // teeth land within half a per cent of each other often enough by chance
  // (they are draws from one narrow band) that a single-vertex assertion fails
  // on a healthy generator. Summed over nine vertices the two cases separate
  // cleanly — a degenerate generator scores near 0 here, and the closest pair
  // in a full game's worth of seals scores 8.5.
  const edgeOf = (half) => sealTearEdge(sealTearSeed(GAME, half)).map(([, y]) => y)
  const spread = (a, b) => a.reduce((sum, y, i) => sum + Math.abs(y - b[i]), 0)
  for (let half = 0; half < 20; half += 1) {
    assert.ok(
      spread(edgeOf(half), edgeOf(half + 1)) > 4,
      `halves ${half} and ${half + 1} tear alike`,
    )
  }
})

// ---------------------------------------------------------------------------
// The two polygons
// ---------------------------------------------------------------------------

test('the halves are cut from one shared edge', () => {
  const edge = sealTearEdge(sealTearSeed(GAME, 4))
  const { top, bottom } = sealTearPolygons(sealTearSeed(GAME, 4))

  // Top: the two upper corners, then the edge walked backwards.
  const topPts = pointsOf(top)
  assert.deepEqual(topPts.slice(0, 2), [[0, 0], [100, 0]])
  assert.deepEqual(topPts.slice(2), [...edge].reverse())

  // Bottom: the edge forwards, then the two lower corners.
  const bottomPts = pointsOf(bottom)
  assert.deepEqual(bottomPts.slice(0, edge.length), edge)
  assert.deepEqual(bottomPts.slice(edge.length), [[100, 100], [0, 100]])
})

test('both polygons are well-formed clip-path values', () => {
  const { top, bottom } = sealTearPolygons(sealTearSeed(GAME, 1))
  for (const poly of [top, bottom]) {
    assert.match(poly, /^polygon\((\d+(\.\d+)?% \d+(\.\d+)?%, )+\d+(\.\d+)?% \d+(\.\d+)?%\)$/)
    assert.equal(pointsOf(poly).length, TEAR_VERTICES + 2)
  }
})

test('the pair covers the whole cover between them', () => {
  // Every corner belongs to exactly one half, so nothing of the cover is left
  // undrawn while it tears.
  const { top, bottom } = sealTearPolygons(sealTearSeed(GAME, 6))
  const has = (poly, pt) => pointsOf(poly).some(([x, y]) => x === pt[0] && y === pt[1])
  for (const corner of [[0, 0], [100, 0]]) {
    assert.ok(has(top, corner) && !has(bottom, corner))
  }
  for (const corner of [[0, 100], [100, 100]]) {
    assert.ok(has(bottom, corner) && !has(top, corner))
  }
})
