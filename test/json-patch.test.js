// Unit coverage for src/lib/jsonPatch.js — the generic RFC 6902 applier
// behind the diffPatch feed-polling path (ADR-0032). The single most
// important property under test is immutability: the reveal-progress cache
// (useRevealProgress.js) invalidates on feed object IDENTITY (ADR-0007), so
// an in-place patcher would silently freeze stale reveals in production.
import assert from 'node:assert/strict'
import test from 'node:test'
import { applyJsonPatch } from '../src/lib/jsonPatch.js'

test('replace at a nested path returns a new value without mutating the base', () => {
  const base = { a: { b: 1 }, c: 2 }
  const result = applyJsonPatch(base, [{ op: 'replace', path: '/a/b', value: 99 }])
  assert.equal(result.a.b, 99)
  assert.equal(base.a.b, 1)
  assert.notEqual(result, base)
})

test('add appends to an array via the "-" token and inserts at an index', () => {
  const base = { list: [1, 2] }
  const result = applyJsonPatch(base, [{ op: 'add', path: '/list/-', value: 3 }])
  assert.deepEqual(result.list, [1, 2, 3])
  assert.deepEqual(base.list, [1, 2])

  const inserted = applyJsonPatch(base, [{ op: 'add', path: '/list/0', value: 0 }])
  assert.deepEqual(inserted.list, [0, 1, 2])
})

test('remove deletes an object key and splices an array index', () => {
  const base = { keep: 1, drop: 2, list: ['a', 'b', 'c'] }
  const result = applyJsonPatch(base, [
    { op: 'remove', path: '/drop' },
    { op: 'remove', path: '/list/1' },
  ])
  assert.deepEqual(result, { keep: 1, list: ['a', 'c'] })
  assert.deepEqual(base, { keep: 1, drop: 2, list: ['a', 'b', 'c'] })
})

test('move relocates a value and copy duplicates it', () => {
  const base = { from: { x: 5 }, to: {} }
  const moved = applyJsonPatch(base, [{ op: 'move', from: '/from/x', path: '/to/x' }])
  assert.deepEqual(moved, { from: {}, to: { x: 5 } })

  const copied = applyJsonPatch(base, [{ op: 'copy', from: '/from/x', path: '/to/x' }])
  assert.deepEqual(copied, { from: { x: 5 }, to: { x: 5 } })
  assert.deepEqual(base, { from: { x: 5 }, to: {} }) // still untouched
})

test('test op passes silently on a match and throws on a mismatch', () => {
  const base = { value: 42 }
  assert.doesNotThrow(() => applyJsonPatch(base, [{ op: 'test', path: '/value', value: 42 }]))
  assert.throws(() => applyJsonPatch(base, [{ op: 'test', path: '/value', value: 43 }]))
})

test('an unsupported op throws rather than silently applying nothing', () => {
  assert.throws(() => applyJsonPatch({}, [{ op: 'bogus', path: '/x', value: 1 }]))
})

test('replace at the root path swaps the entire document', () => {
  const base = { old: true }
  const result = applyJsonPatch(base, [{ op: 'replace', path: '', value: { fresh: true } }])
  assert.deepEqual(result, { fresh: true })
  assert.deepEqual(base, { old: true })
})

test('a sequence of ops mirrors real diffPatch shapes (add + copy + replace)', () => {
  const base = {
    gamePk: 1,
    liveData: { plays: { allPlays: [{ result: { awayScore: 0, rbi: null } }] } },
  }
  const ops = [
    { op: 'replace', path: '/liveData/plays/allPlays/0/result/awayScore', value: 1 },
    { op: 'copy', from: '/liveData/plays/allPlays/0/result/awayScore', path: '/liveData/plays/allPlays/0/result/rbi' },
    { op: 'add', path: '/metaData', value: { timeStamp: '20260101_000000' } },
  ]
  const result = applyJsonPatch(base, ops)
  assert.equal(result.liveData.plays.allPlays[0].result.awayScore, 1)
  assert.equal(result.liveData.plays.allPlays[0].result.rbi, 1)
  assert.equal(result.metaData.timeStamp, '20260101_000000')
  assert.equal(base.liveData.plays.allPlays[0].result.awayScore, 0) // base untouched
})
