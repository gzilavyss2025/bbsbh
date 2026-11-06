// The "Kept it in the infield" page's census (#2976).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInfield } from '../src/api/infield/infield.js'

const q = (gamePk, date) => ({ gamePk, date, teamId: 1, oppId: 2, ofHits: 3, home: true, gameNumber: 1 })

test('sums the census and orders seasons and rows newest first', () => {
  const out = buildInfield([
    { season: 2021, teamGames: 10, nearMiss: 2, qualifiers: [q(1, '2021-05-01'), q(2, '2021-09-01')] },
    null,
    { season: 2022, teamGames: 12, nearMiss: 1, qualifiers: [q(3, '2022-04-01')] },
  ])
  assert.equal(out.qualifiers, 3)
  assert.equal(out.teamGames, 22)
  assert.equal(out.nearMiss, 3)
  assert.deepEqual([out.first, out.last], [2021, 2022])
  assert.deepEqual(out.seasons.map((s) => s.season), [2022, 2021])
  assert.deepEqual(out.seasons[1].rows.map((r) => r.gamePk), [2, 1])
})

test('no files gives an empty census', () => {
  const out = buildInfield([null, null])
  assert.equal(out.seasons.length, 0)
  assert.equal(out.qualifiers, 0)
  assert.equal(out.first, null)
})
