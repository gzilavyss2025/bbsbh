import assert from 'node:assert/strict'
import test from 'node:test'
import { fencePoints, tripTiles } from '../../src/lib/postseason/worldseries/trip.js'

const rogers = { lat: 43.6414, lon: -79.3894, offset: -4, roof: 'Retractable', seats: 41500 }
const dodger = { lat: 34.0739, lon: -118.24, offset: -7, roof: 'Open', seats: 56000 }

test('tiles: miles park to park, the clock change, the next park\'s roof and seats', () => {
  const t = tripTiles(rogers, dodger)
  assert.equal(t.distance, '2,170 mi')
  assert.equal(t.clock, '−3 h')
  assert.equal(t.roof, 'Open')
  assert.equal(t.seats, '56,000')
})

test('the clock reads "None" within a zone and "+" going east', () => {
  assert.equal(tripTiles(rogers, { ...rogers, lat: 44 }).clock, 'None')
  assert.equal(tripTiles(dodger, rogers).clock, '+3 h')
})

test('missing roof or seats read as a dash, never undefined', () => {
  const t = tripTiles(rogers, { ...dodger, roof: '', seats: null })
  assert.deepEqual([t.roof, t.seats], ['—', '—'])
})

test('fence points: centre field straight up, the lines at 45 degrees', () => {
  const p = fencePoints({ lf: 330, lc: 375, cf: 400, rc: 375, rf: 330 })
  assert.equal(p.length, 5)
  assert.ok(Math.abs(p[2].x) < 1e-9 && p[2].y === 400)
  assert.ok(p[0].x < 0 && p[4].x > 0)
  assert.deepEqual(fencePoints(null), [])
})
