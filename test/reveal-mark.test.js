import test from 'node:test'
import assert from 'node:assert/strict'
import { readRevealMarkFor, REVEAL_KEY } from '../src/lib/account/revealMark.js'
import { parseRevealMark } from '../src/hooks/revealProgressCore.js'

function withStorage(value, fn) {
  const store = value === undefined ? {} : { [`${REVEAL_KEY}1`]: value }
  globalThis.window = { localStorage: { getItem: (k) => store[k] ?? null } }
  try { return fn() } finally { delete globalThis.window }
}

test('readRevealMarkFor parses a stored half-index', () => {
  assert.equal(withStorage('7', () => readRevealMarkFor(1)), 7)
})

test('hostile stored values parse exactly as parseRevealMark does', () => {
  for (const v of ['-3', '1.5', 'NaN', '{"a":1}', '', '7; DROP', undefined]) {
    assert.equal(withStorage(v, () => readRevealMarkFor(1)), parseRevealMark(v ?? null), String(v))
  }
  for (const v of ['-3', '1.5', 'NaN', '{"a":1}', '7; DROP', undefined]) {
    assert.equal(withStorage(v, () => readRevealMarkFor(1)), -1, String(v))
  }
  assert.equal(readRevealMarkFor(0), -1)
})
