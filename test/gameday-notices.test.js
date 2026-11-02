import assert from 'node:assert/strict'
import test from 'node:test'
import { gamedayNotices } from '../src/screens/gameday/next/notices.js'

const records = { away: { extraInning: '5-2' }, home: { extraInning: '2-5' } }
const names = { away: 'Brewers', home: 'Cubs' }
const format = (min) => (min === 72 ? '1 hr 12 min' : `${min} min`)
const base = { format, delays: [], inning: 9, half: 'bottom', regulation: 9, records, names }

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
  assert.deepEqual(gamedayNotices({ ...base, delays }), ['Rain delay · Play stopped for 1 hr 12 min', 'Delay · Delay in progress'])
})
