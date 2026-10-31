// #2695: which parks a batted ball would have left, by the parkFit.js rule (distance past the wall
// plus its height on the ball's own bearing). Pure geometry over our own layouts.
import assert from 'node:assert/strict'
import test from 'node:test'

import { hrParks } from '../src/lib/ballpark/layout/hrParks.js'
import { HOME } from '../src/lib/ballpark/ballparkGeometry.js'

// A ball straight to centre: x at home plate, y `feet` up the diagram (1 SVG unit = 1 ft).
const toCenter = (distance) => ({ x: HOME.x, y: HOME.y - distance, distance, gameDate: '2026-07-01' })

test('a 470 ft ball to centre leaves all 30 current parks', () => {
  const r = hrParks(toCenter(470))
  assert.equal(r.leaves.length, 30)
  assert.equal(r.stays.length, 0)
})

test('a 300 ft ball to centre leaves none', () => {
  const r = hrParks(toCenter(300))
  assert.equal(r.leaves.length, 0)
  assert.equal(r.stays.length, 30)
})

test('a 405 ft ball to centre splits the parks, each named once', () => {
  const r = hrParks(toCenter(405))
  assert.ok(r.leaves.length > 0 && r.stays.length > 0)
  assert.equal(new Set([...r.leaves, ...r.stays]).size, 30)
})

test('the park list follows the game date (Globe Life Park before 2020)', () => {
  const r = hrParks({ ...toCenter(470), gameDate: '2019-07-01' })
  assert.ok(r.leaves.includes('Globe Life Park in Arlington'))
  assert.ok(!r.leaves.includes('Globe Life Field'))
})

test('no coordinates, no distance, or a foul ball: null', () => {
  assert.equal(hrParks(null), null)
  assert.equal(hrParks({ ...toCenter(400), distance: null }), null)
  assert.equal(hrParks({ x: null, y: null, distance: 400, gameDate: '2026-07-01' }), null)
  assert.equal(hrParks({ x: HOME.x - 300, y: HOME.y + 10, distance: 300, gameDate: '2026-07-01' }), null)
})

test('a park with no wall on the ball\'s ray is left out, not the whole list (stack review)', () => {
  // On the right-field line (45°) 16 of the 30 layouts have no wall point; the other 14 still answer.
  const d = 450
  const rad = (45 * Math.PI) / 180
  const r = hrParks({ x: HOME.x + d * Math.sin(rad), y: HOME.y - d * Math.cos(rad), distance: d, gameDate: '2026-07-01' })
  assert.ok(r, 'a list, not null')
  assert.ok(r.leaves.length + r.stays.length > 0 && r.leaves.length + r.stays.length < 30)
})
