import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HIT_COORD_ORIGIN } from '../src/lib/ballpark/hitProjection.js'
import { contactZones } from '../src/screens/player/next/modules/contact/contactZones.js'

// A raw Gameday coordinate `deg` off dead centre (negative = left field), 100 units out.
const at = (deg) => {
  const r = (deg * Math.PI) / 180
  return { x: HIT_COORD_ORIGIN.x + 100 * Math.sin(r), y: HIT_COORD_ORIGIN.y - 100 * Math.cos(r) }
}
const ball = (deg, la, side = 'R') => ({ ...at(deg), launchAngle: la, side })
const cell = (z, dir, type) => z.cells.find((c) => c.dir === dir && c.type === type)

test('a right-handed batter: left field is pull, right field is oppo, by launch angle band', () => {
  const z = contactZones([ball(-30, 5), ball(0, 15), ball(30, 35), ball(30, 60)])
  assert.equal(z.n, 4)
  assert.equal(cell(z, 'pull', 'ground').n, 1)
  assert.equal(cell(z, 'center', 'line').n, 1)
  // A pop-up folds into the fly-ball row (Gary, 2026-11-12).
  assert.equal(cell(z, 'oppo', 'fly').n, 2)
  assert.equal(cell(z, 'oppo', 'fly').share, 0.5)
})

test('a left-handed batter flips pull and oppo', () => {
  const z = contactZones([ball(30, 5, 'L'), ball(-30, 5, 'L')])
  assert.equal(cell(z, 'pull', 'ground').n, 1)
  assert.equal(cell(z, 'oppo', 'ground').n, 1)
})

test('a ball with no launch angle or no coordinate is counted as left out', () => {
  const z = contactZones([ball(0, null), { x: null, y: null, launchAngle: 20, side: 'R' }, ball(0, 20)])
  assert.equal(z.n, 1)
  assert.equal(z.leftOut, 2)
  assert.equal(z.cells.length, 9)
  assert.equal(cell(z, 'center', 'line').share, 1)
})

test('no usable ball gives nine empty cells with null shares, not a crash', () => {
  const z = contactZones([ball(0, null)])
  assert.equal(z.n, 0)
  assert.ok(z.cells.every((c) => c.n === 0 && c.share === null))
})
