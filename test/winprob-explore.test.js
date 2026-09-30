import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestWinProbEvent, winProbReadout } from '../src/components/charts/winprob/explore.js'
import { selectWinProbPath } from '../src/api/winprob.js'
import { WIN_PROB_FIELDS } from '../src/api/game.js'

test('snap selects recorded events, excludes origin, and clamps edges', () => {
  assert.equal(nearestWinProbEvent(-1, 80), 0)
  assert.equal(nearestWinProbEvent(0, 80), 0)
  assert.equal(nearestWinProbEvent(40 / 80, 80), 39)
  assert.equal(nearestWinProbEvent(40.49 / 80, 80), 39)
  assert.equal(nearestWinProbEvent(40.51 / 80, 80), 40)
  assert.equal(nearestWinProbEvent(2, 80), 79)
  assert.equal(nearestWinProbEvent(0.5, 1), 0)
})
test('readout identifies after-play outs and preserves the recorded delta', () => {
  assert.deepEqual(winProbReadout({ home: 48.1, inning: 7, half: 'top', outs: 1, delta: -4.1 }), {
    context: '▲7 · 1 out', delta: -4.1,
  })
  assert.equal(winProbReadout({ home: 100, inning: 9, half: 'bottom', outs: 3 }).context, '▼9 · Half over')
  assert.equal(winProbReadout({ home: 50, inning: 1, half: 'top' }).delta, null)
})
test('outs and recorded delta inherit reveal clamp and survive field pruning', () => {
  for (const field of ['count', 'outs', 'homeTeamWinProbabilityAdded']) assert.ok(WIN_PROB_FIELDS.includes(field))
  const rows = [1, 2].map(inning => ({ homeTeamWinProbability: 52.2,
    homeTeamWinProbabilityAdded: 2.2, about: { inning, isTopInning: true }, count: { outs: 1 } }))
  const points = selectWinProbPath(rows, { throughHalf: 0 })
  assert.equal(points.length, 1)
  assert.equal(points[0].outs, 1)
  assert.equal(points[0].delta, 2.2)
  assert.equal(selectWinProbPath([{ ...rows[0], count: null, homeTeamWinProbabilityAdded: null }])[0].outs, null)
})
