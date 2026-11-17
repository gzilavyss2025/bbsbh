import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clipIds } from '../scripts/lib/tensest/tensest.mjs'

const ev = (playId) => ({ playId })

test('a tense play keeps its last pitch’s playId, keyed like its row', () => {
  const plays = [
    { leverageIndex: 1.2, playEvents: [ev('calm')] },
    { leverageIndex: 6.5, playEvents: [ev('first'), { type: 'action' }, ev('last'), { type: 'action' }] },
  ]
  assert.deepEqual(clipIds({ gamePk: 9 }, plays), { '9:1': 'last' })
})

test('a tense play with no pitch playId is left out', () => {
  assert.deepEqual(clipIds({ gamePk: 9 }, [{ leverageIndex: 8, playEvents: [{ type: 'action' }] }]), {})
})

import { scoredOn } from '../scripts/lib/tensest/tensest.mjs'

test('scoredOn keeps each scoring runner whole, and nothing when none scored', () => {
  const run = (id, fullName, score) => ({ details: { isScoringEvent: score, runner: { id, fullName } } })
  assert.deepEqual(scoredOn({ runners: [run(1, 'Christian Yelich', true), run(2, 'Batter Man', false), run(3, 'Sal Frelick', true)] }), { sc: [[1, 'Christian Yelich'], [3, 'Sal Frelick']] })
  assert.deepEqual(scoredOn({ runners: [run(2, 'Batter Man', false)] }), {})
})
