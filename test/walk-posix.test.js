import test from 'node:test'
import assert from 'node:assert/strict'
import { toPosix } from '../scripts/lib/walk.mjs'

test('toPosix turns Windows separators into / so budget keys match', () => {
  assert.equal(toPosix('src\\styles\\system\\stack.css'), 'src/styles/system/stack.css')
})

test('toPosix leaves a path that already uses / alone', () => {
  assert.equal(toPosix('src/styles/system/stack.css'), 'src/styles/system/stack.css')
})
