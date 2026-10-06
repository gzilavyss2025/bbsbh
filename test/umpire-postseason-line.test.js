import test from 'node:test'
import assert from 'node:assert/strict'
import { postseasonPlateLine } from '../src/components/umpire/postseasonPlateLine.js'

test('states games, accuracy and call count, and says it is unranked', () => {
  const l = postseasonPlateLine({ games: 3, called: 400, correct: 368 })
  assert.equal(l.text, 'Postseason: 3 games, 92.0% of 400 calls correct. Not ranked.')
})

test('singular game', () => {
  assert.match(postseasonPlateLine({ games: 1, called: 120, correct: 100 }).text, /: 1 game,/)
})

test('nothing without scored postseason plate games', () => {
  assert.equal(postseasonPlateLine(null), null)
  assert.equal(postseasonPlateLine({ games: 0, called: 0, correct: 0 }), null)
  assert.equal(postseasonPlateLine({ games: 2, called: 0, correct: 0 }), null)
})

test('carries no rank, tier or league comparison', () => {
  const l = postseasonPlateLine({ games: 3, called: 400, correct: 368, rank: 1, tier: 'elite' })
  assert.deepEqual(Object.keys(l).sort(), ['accuracy', 'calls', 'games', 'text'])
  assert.doesNotMatch(l.text, /rank \d|elite|league|average/i)
})
