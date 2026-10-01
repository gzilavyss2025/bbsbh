import assert from 'node:assert/strict'
import test from 'node:test'
import { dayShape } from '../../src/lib/postseason/dayShape.js'

const mil = { venueId: 32 }
const sd = { venueId: 2680 }

test('the next day in the same park says nothing', () => {
  assert.equal(dayShape({ date: '2026-10-03', ...mil }, { date: '2026-10-04', ...mil }), '')
})

test('a gap day with a new park is a travel day', () => {
  assert.equal(dayShape({ date: '2026-10-04', ...mil }, { date: '2026-10-06', ...sd }), 'Travel day before')
})

test('a gap day in the same park is an off day', () => {
  assert.equal(dayShape({ date: '2026-10-04', ...mil }, { date: '2026-10-06', ...mil }), 'Off day before')
})

test('a new park on the very next day is said out loud', () => {
  assert.equal(dayShape({ date: '2026-10-06', ...mil }, { date: '2026-10-07', ...sd }), 'No off day before')
})

test('an unknown park never claims a travel day', () => {
  assert.equal(dayShape({ date: '2026-10-04' }, { date: '2026-10-06', ...sd }), 'Off day before')
  assert.equal(dayShape({ date: '2026-10-04' }, { date: '2026-10-05', ...sd }), '')
})

test('no previous game, a missing date, or the same date says nothing', () => {
  assert.equal(dayShape(null, { date: '2026-10-03', ...mil }), '')
  assert.equal(dayShape({ date: '2026-10-03', ...mil }, { date: null }), '')
  assert.equal(dayShape({ date: '2026-10-03', ...mil }, { date: '2026-10-03', ...mil }), '')
})

test('the month boundary counts days, not dates', () => {
  assert.equal(dayShape({ date: '2026-09-30', ...mil }, { date: '2026-10-02', ...sd }), 'Travel day before')
  assert.equal(dayShape({ date: '2026-09-30', ...mil }, { date: '2026-10-01', ...mil }), '')
})
