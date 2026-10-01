import test from 'node:test'
import assert from 'node:assert/strict'
import { CLUBS, dayBefore, wireFor, peopleFor } from '../e2e/fixtures/wire-stub.js'

test('dayBefore steps back across month and year edges', () => {
  assert.equal(dayBefore('2026-03-01'), '2026-02-28')
  assert.equal(dayBefore('2026-01-01'), '2025-12-31')
})

test('wireFor gives one CU story per club per day, with unique ids', () => {
  const rows = wireFor(['2026-07-02', '2026-07-01'], CLUBS.slice(0, 12))
  assert.equal(rows.length, 24)
  assert.equal(new Set(rows.map((r) => r.id)).size, 24)
  assert.ok(rows.every((r) => r.typeCode === 'CU'))
})

test('peopleFor echoes each requested id', () => {
  assert.deepEqual(peopleFor(['5', '7']).map((p) => p.id), [5, 7])
})
