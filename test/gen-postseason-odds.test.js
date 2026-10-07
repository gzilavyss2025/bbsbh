import { test } from 'node:test'
import assert from 'node:assert/strict'
import { remainingGamesWindow } from '../scripts/gen-postseason-odds.mjs'

test('remainingGamesWindow runs from the day after asOf to the season buffer', () => {
  assert.deepEqual(remainingGamesWindow(2026, '2026-09-20'), {
    startDate: '2026-09-21',
    endDate: '2026-10-05',
  })
})

test('remainingGamesWindow is null once asOf is at or past the buffer', () => {
  assert.deepEqual(remainingGamesWindow(2026, '2026-10-04'), { startDate: '2026-10-05', endDate: '2026-10-05' })
  assert.equal(remainingGamesWindow(2026, '2026-10-05'), null)
  assert.equal(remainingGamesWindow(2026, '2026-10-06'), null)
})
