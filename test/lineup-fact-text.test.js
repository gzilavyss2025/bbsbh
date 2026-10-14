import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parkShort, shortDate } from '../src/screens/lineup/next/logic/factText.js'
import { seriesPosition } from '../src/screens/lineup/next/logic/seriesPosition.js'

test('the date prints as weekday, month and day', () => {
  assert.equal(shortDate('2026-10-14'), 'Wed Oct 14')
  assert.equal(shortDate(''), '')
  assert.equal(shortDate('not a date'), '')
})

test('a sponsor name is dropped from "<sponsor> at <park>"', () => {
  assert.equal(parkShort('UNIQLO Field at Dodger Stadium'), 'Dodger Stadium')
  assert.equal(parkShort('American Family Field'), 'American Family Field')
  assert.equal(parkShort(''), '')
})

const g = (gamePk, apiDate, homeId = 119) => ({ gamePk, apiDate, homeId })

test('a series is the run of meetings at one park on consecutive days', () => {
  const games = [g(1, '2026-08-13'), g(2, '2026-08-14'), g(3, '2026-08-15'), g(4, '2026-08-16'), g(5, '2026-09-20', 158)]
  assert.deepEqual(seriesPosition(games, 4), { n: 4, of: 4 })
  assert.deepEqual(seriesPosition(games, 1), { n: 1, of: 4 })
})

test('a one-off meeting has no series position', () => {
  assert.equal(seriesPosition([g(1, '2026-08-13'), g(2, '2026-09-20', 158)], 1), null)
  assert.equal(seriesPosition([], 1), null)
})

test('a doubleheader counts as two games of the series', () => {
  const games = [g(1, '2026-08-13'), { ...g(2, '2026-08-14'), gameNumber: 1 }, { ...g(3, '2026-08-14'), gameNumber: 2 }]
  assert.deepEqual(seriesPosition(games, 3), { n: 3, of: 3 })
})
