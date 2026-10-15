import test from 'node:test'
import assert from 'node:assert/strict'
import { markPlayed, shouldPlay } from '../src/lib/motion/playOnce.js'

test('a card with no key always plays', () => {
  const seen = new Set()
  markPlayed(null, seen)
  assert.equal(shouldPlay(null, seen), true)
})

test('a card plays until it is marked, and not after', () => {
  const seen = new Set()
  assert.equal(shouldPlay(823035, seen), true)
  assert.equal(shouldPlay(823035, seen), true, 'a read alone does not spend the animation')
  markPlayed(823035, seen)
  assert.equal(shouldPlay(823035, seen), false)
})

test('another game still plays', () => {
  const seen = new Set()
  markPlayed(823035, seen)
  assert.equal(shouldPlay(778442, seen), true)
})
