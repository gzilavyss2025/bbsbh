// The player page's photo rail keeps a row for every game with a gamePk and a date, oldest first
// (ADR-0117, which retired ADR-0110). Whether a game is over is the `finals` map's call
// (photosView.js), not this function's.
import assert from 'node:assert/strict'
import test from 'node:test'
import { photoGameRows } from '../src/lib/dates.js'

const row = (gamePk, date) => ({ game: { gamePk }, date })

test('the rows keep a game whatever its date; the Final check lives in fetchFinalScores', () => {
  const rows = photoGameRows([row(2, '2026-07-14'), row(1, '2026-07-13')])
  assert.deepEqual(rows, [
    { gamePk: 1, apiDate: '2026-07-13' },
    { gamePk: 2, apiDate: '2026-07-14' },
  ])
})

test('rows are oldest first and skip a row with no gamePk or date', () => {
  const rows = photoGameRows([row(3, '2026-07-12'), row(4, '2026-07-02'), row(null, '2026-07-01'), row(5)])
  assert.deepEqual(rows.map((r) => r.gamePk), [4, 3])
})
