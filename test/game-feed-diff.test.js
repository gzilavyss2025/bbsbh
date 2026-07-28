// Unit coverage for mergeFeedDiff (src/api/game.js) — the diffPatch merge +
// sanity check behind ADR-0032's Follow Live feed polling. Never throws;
// every failure mode is a null return so callers fall back to a full fetch.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeFeedDiff } from '../src/api/game.js'

const BASE = { gamePk: 823035, liveData: { linescore: { currentInning: 4 } } }

test('applies a patch array onto the base and returns a fresh object', () => {
  const diffResponse = [{ diff: [{ op: 'replace', path: '/liveData/linescore/currentInning', value: 5 }] }]
  const merged = mergeFeedDiff(BASE, diffResponse, 823035)
  assert.equal(merged.liveData.linescore.currentInning, 5)
  assert.notEqual(merged, BASE)
  assert.equal(BASE.liveData.linescore.currentInning, 4) // base untouched
})

test('a zero-entry patch array still returns a fresh object, not the same base reference', () => {
  const merged = mergeFeedDiff(BASE, [], 823035)
  assert.deepEqual(merged, BASE)
  assert.notEqual(merged, BASE)
})

test('a full-feed fallback response (non-array) passes through when gamePk matches', () => {
  const fallback = { gamePk: 823035, liveData: { linescore: { currentInning: 9 } } }
  const merged = mergeFeedDiff(BASE, fallback, 823035)
  assert.equal(merged, fallback)
})

test('returns null when the merged/fallback gamePk does not match the requested game', () => {
  const wrongGame = { gamePk: 999999 }
  assert.equal(mergeFeedDiff(BASE, wrongGame, 823035), null)

  const diffResponse = [{ diff: [{ op: 'replace', path: '/gamePk', value: 999999 }] }]
  assert.equal(mergeFeedDiff(BASE, diffResponse, 823035), null)
})

test('returns null (never throws) when a patch op is malformed', () => {
  const badDiff = [{ diff: [{ op: 'replace', path: '/nonexistent/deeply/nested', value: 1 }] }]
  assert.equal(mergeFeedDiff(BASE, badDiff, 823035), null)
})

test('returns null when the base is missing entirely (no prior cache to diff against)', () => {
  const diffResponse = [{ diff: [{ op: 'replace', path: '/liveData/linescore/currentInning', value: 5 }] }]
  assert.equal(mergeFeedDiff(null, diffResponse, 823035), null)
})
