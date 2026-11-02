import assert from 'node:assert/strict'
import test from 'node:test'
import { gamedayNotices } from '../src/screens/gameday/next/notices.js'

const records = { away: { extraInning: '5-2' }, home: { extraInning: '2-5' } }
const names = { away: 'Brewers', home: 'Cubs' }
const base = { delays: [], inning: 9, half: 'bottom', regulation: 9, records, names, live: false }

test('the extras line is absent before the reader reaches the 10th (#2748, ADR-0046)', () => {
  assert.deepEqual(gamedayNotices(base), [])
})

test('the extras line names each club\'s extra-inning record once the 10th is on screen', () => {
  assert.deepEqual(gamedayNotices({ ...base, inning: 10, half: 'top' }), ['Extra innings this season: Brewers 5-2 · Cubs 2-5'])
  assert.deepEqual(gamedayNotices({ ...base, inning: 10, records: { home: { extraInning: '2-5' } } }), ['Extra innings this season: Cubs 2-5'])
  assert.deepEqual(gamedayNotices({ ...base, inning: 10, records: null }), [])
})

test('a delay in the half on screen reads its reason and its length, as DelayCard did', () => {
  const delays = [
    { inning: 9, half: 'bottom', reason: 'Rain', durationMinutes: 72, resolved: true },
    { inning: 9, half: 'bottom', reason: '', durationMinutes: null, resolved: false },
    { inning: 3, half: 'top', reason: 'Rain', durationMinutes: 10, resolved: true },
  ]
  assert.deepEqual(gamedayNotices({ ...base, delays, live: true }), ['Rain delay · Play stopped for 1 hr 12 min', 'Delay in progress'])
})

test('a delay with no end time is "in progress" only on the half being played now', () => {
  // selectDelays leaves a stoppage unresolved when it ran under a minute or the
  // feed never stamped its end: on a past half it is over, not in progress.
  const delays = [{ inning: 9, half: 'bottom', reason: 'Rain', durationMinutes: null, resolved: false }]
  assert.deepEqual(gamedayNotices({ ...base, delays }), ['Rain delay'])
  assert.deepEqual(gamedayNotices({ ...base, delays, live: true }), ['Rain delay in progress'])
})
