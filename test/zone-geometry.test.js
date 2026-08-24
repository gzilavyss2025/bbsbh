// Unit coverage for src/lib/zone/zoneGeometry.js — the plot maths the in-game
// StrikeZone diagram and the season command map now share.
//
// THE PIN TEST is the one that matters. The command map's whole claim is that
// it reuses the in-game zone's vocabulary, so a cell it counts a pitch into has
// to be the cell the diagram DRAWS that pitch in. Those are two different
// pieces of arithmetic — one bins normalised coordinates, the other projects
// feet to SVG — and nothing but a test keeps them agreeing.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EDGE, GRID, commandCell, inHeart, inZone, isChase, normalizePitch, sx, sy,
} from '../src/lib/zone/zoneGeometry.js'

const TOP = 3.4
const BOT = 1.6
const cellFor = (px, pz) => commandCell(normalizePitch(px, pz, TOP, BOT))

// Where StrikeZone.jsx draws the zone rect and its thirds, from the same
// constants — the drawing side of the comparison.
const zx = sx(-EDGE)
const zr = sx(EDGE)
const zyT = sy(TOP)
const zyB = sy(BOT)
const colEdges = [zx, zx + (zr - zx) / 3, zx + (2 * (zr - zx)) / 3, zr]
const rowEdges = [zyT, zyT + (zyB - zyT) / 3, zyT + (2 * (zyB - zyT)) / 3, zyB]

// Which drawn third a projected point lands in, 1..3, or 0/4 outside the box.
function drawnCol(px) {
  const x = sx(px)
  if (x < colEdges[0]) return 0
  if (x > colEdges[3]) return GRID - 1
  return 1 + Math.min(2, [0, 1, 2].filter((i) => x > colEdges[i + 1]).length)
}
function drawnRow(pz) {
  const y = sy(pz)
  if (y < rowEdges[0]) return 0
  if (y > rowEdges[3]) return GRID - 1
  return 1 + Math.min(2, [0, 1, 2].filter((i) => y > rowEdges[i + 1]).length)
}

test('PIN: a counted cell is the cell the in-game diagram draws the pitch in', () => {
  // A lattice across and beyond the zone, so every cell and the chase ring
  // outside it are exercised rather than a happy handful.
  for (let px = -1.4; px <= 1.4; px += 0.1) {
    for (let pz = 0.8; pz <= 4.2; pz += 0.1) {
      const cell = cellFor(px, pz)
      assert.deepEqual(
        [cell.col, cell.row],
        [drawnCol(px), drawnRow(pz)],
        `binning and drawing disagree at pX=${px.toFixed(1)} pZ=${pz.toFixed(1)}`,
      )
    }
  }
})

test('normalisation is against THIS batter\'s zone, not absolute feet', () => {
  // The same cell for a tall batter and a short one, at very different heights
  // in feet. Raw pZ would put these two pitches three cells apart and smear a
  // pitcher's command across every zone he faced.
  const tall = commandCell(normalizePitch(0, 3.5, 3.9, 1.9))   // letters of a 6'7" hitter
  const short = commandCell(normalizePitch(0, 2.9, 3.2, 1.5))  // letters of a 5'8" hitter
  assert.deepEqual([tall.col, tall.row], [short.col, short.row])
  assert.equal(tall.row, 1) // top third of the zone for both
})

test('the plate\'s black is +/-1, and just past it is the chase ring', () => {
  assert.equal(inZone(cellFor(EDGE * 0.99, 2.5)), true)
  assert.equal(inZone(cellFor(EDGE * 1.01, 2.5)), false)
  assert.equal(cellFor(EDGE * 1.01, 2.5).col, GRID - 1)
})

test('a pitch with no tracking is not a pitch at coordinate zero', () => {
  // MiLB parks below Triple-A send no pX/pZ at all. Treating a missing
  // location as (0,0) would pile a whole level's pitches into middle-middle.
  assert.equal(normalizePitch(null, 2.5, TOP, BOT), null)
  assert.equal(normalizePitch(0, 2.5, undefined, BOT), null)
  assert.equal(commandCell(null), null)
  // A zero-height or inverted zone is bad data, not a very short batter.
  assert.equal(normalizePitch(0, 2.5, 2.0, 2.0), null)
  assert.equal(normalizePitch(0, 2.5, 1.6, 3.4), null)
})

test('the heart is ONE cell, and it is not the whole zone', () => {
  // The reading this replaced was "on the edge", which on a three-by-three zone
  // means every cell except the middle — it measured 94% against real data and
  // would have measured about that for every pitcher alive. A rate that is
  // really a constant is worse than no rate.
  assert.equal(inHeart(cellFor(0, 2.5)), true)          // middle-middle
  assert.equal(inHeart(cellFor(EDGE * 0.9, 2.5)), false) // on the black
  assert.equal(inZone(cellFor(EDGE * 0.9, 2.5)), true)   // and still a strike
  assert.equal(isChase(cellFor(EDGE * 1.5, 2.5)), true)  // off the plate
  assert.equal(isChase(cellFor(0, 2.5)), false)
})
