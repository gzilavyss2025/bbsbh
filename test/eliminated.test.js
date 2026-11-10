// The /eliminated page's summary (src/api/eliminated/eliminated.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarize } from '../src/api/eliminated/eliminated.js'

const g = (date) => ({ date, oppId: 109, home: true, entering: '85-75' })
const data = {
  seasons: {
    2021: { 158: { games: 162, out: null, rows: [] }, 118: { games: 162, out: '2021-09-01', rows: [g('2021-09-01')] } },
    2022: { 158: { games: 162, out: '2022-10-04', rows: [g('2022-10-04'), g('2022-10-05')] }, 118: { games: 161, out: null, rows: [] } },
  },
}

test('sums games and games out over the range, fewest out first', () => {
  const out = summarize(data, 2021, 2022)
  assert.deepEqual(out.map((c) => [c.teamId, c.games, c.outGames, c.rank]), [[118, 323, 1, 1], [158, 324, 2, 2]])
  assert.deepEqual(out[1].seasons.map((s) => s.out), [null, '2022-10-04'])
})

test('the range limits the seasons, and tied clubs share a rank', () => {
  const out = summarize(data, 2021, 2021)
  assert.deepEqual(out.map((c) => [c.teamId, c.outGames, c.rank]), [[158, 0, 1], [118, 1, 2]])
  assert.deepEqual(summarize({ seasons: { 2021: { 1: { games: 1, out: null, rows: [] }, 2: { games: 1, out: null, rows: [] } } } }, 2021, 2021).map((c) => c.rank), [1, 1])
})

test('no file gives no clubs', () => {
  assert.deepEqual(summarize(null, 2017, 2025), [])
})
