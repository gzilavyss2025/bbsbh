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
