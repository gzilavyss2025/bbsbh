// The player page's photo rail keeps only games dated before the baseball day
// (US Pacific). After 00:00 UTC the UTC date is already tomorrow, so a game
// still in progress tonight must not slip into the rail and show its result.
import assert from 'node:assert/strict'
import test from 'node:test'
import { photoGameRows } from '../src/lib/dates.js'

const row = (gamePk, date) => ({ game: { gamePk }, date })

test('at the UTC flip, tonight\'s game stays out and yesterday\'s stays in', () => {
  const now = new Date('2026-07-15T02:30:00Z') // still 2026-07-14 in baseball time
  const rows = photoGameRows([row(2, '2026-07-14'), row(1, '2026-07-13')], now)
  assert.deepEqual(rows, [{ gamePk: 1, apiDate: '2026-07-13' }])
})

test('rows are oldest first and skip a row with no gamePk or date', () => {
  const now = new Date('2026-07-20T18:00:00Z')
  const rows = photoGameRows([row(3, '2026-07-12'), row(4, '2026-07-02'), row(null, '2026-07-01'), row(5)], now)
  assert.deepEqual(rows.map((r) => r.gamePk), [4, 3])
})
