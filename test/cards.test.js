// Unit coverage for firstNonNull (api/_lib/cards.js), the race helper behind
// resolveGame's fix for a reproduced bug: a shared game link could fall back
// to the static default preview card because resolveGame waited on
// Promise.allSettled across all 5 sport-level schedule calls even after the
// MLB answer was already in — one slow/hung MiLB-level response (more likely
// exactly when a game is live and statsapi is busier) gated an already-found
// match. Exercised here with plain fake-delay promises rather than mocked
// fetch/statsapi calls, since the race behavior itself is network-agnostic.
import assert from 'node:assert/strict'
import test from 'node:test'
import { firstNonNull } from '../api/_lib/cards.js'

const delay = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms))
const rejectAfter = (ms, err) => new Promise((_, reject) => setTimeout(() => reject(err), ms))

test('resolves as soon as the first match lands, without waiting on a slower miss', async () => {
  const start = Date.now()
  // Stands in for: sportId 1 (MLB) answers fast with the real match, sportId
  // 13 (A+) is the one that's slow this time and finds nothing.
  const result = await firstNonNull([delay(10, 'mlb-match'), delay(300, null)])
  const elapsed = Date.now() - start
  assert.equal(result, 'mlb-match')
  // The regression this guards against: the old Promise.allSettled shape
  // waited for every promise to settle, so this would have taken ~300ms.
  assert.ok(elapsed < 150, `expected to resolve well before the slow miss (300ms), took ${elapsed}ms`)
})

test('a match wins the race regardless of which position finds it', async () => {
  const result = await firstNonNull([delay(300, null), delay(10, 'mlb-match')])
  assert.equal(result, 'mlb-match')
})

test('falls through to null only once every level has settled', async () => {
  const start = Date.now()
  const result = await firstNonNull([delay(10, null), delay(120, null)])
  const elapsed = Date.now() - start
  assert.equal(result, null)
  // The intent: firstNonNull waits for the SLOW miss (120ms), never bailing at
  // the fast one (10ms). Assert well past 10ms rather than the exact 120ms — a
  // real setTimeout(120) can be measured a hair under 120ms by Date.now()
  // (timer/clock rounding), which flaked CI at 119ms. 100ms still proves it
  // didn't give up early while tolerating that sub-millisecond jitter.
  assert.ok(elapsed >= 100, `expected to wait for the slow miss (~120ms), took ${elapsed}ms`)
})

test('a rejected promise counts as a miss, not an unhandled rejection', async () => {
  const result = await firstNonNull([rejectAfter(10, new Error('statsapi 500')), delay(50, 'mlb-match')])
  assert.equal(result, 'mlb-match')
})

test('an empty list resolves to null immediately', async () => {
  assert.equal(await firstNonNull([]), null)
})
