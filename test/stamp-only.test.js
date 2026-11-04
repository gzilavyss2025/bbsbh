// The nightly commit step drops a file whose only change is a run stamp, so a
// quiet night commits no public/ data and starts no Vercel deploy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStampOnlyChange } from '../scripts/nightly/stamp-only.mjs'

const j = (o) => JSON.stringify(o)

test('a fresh generatedAt alone is stamp-only', () => {
  assert.equal(isStampOnlyChange(j({ generatedAt: '2026-11-03T08:00:00Z', rows: [1] }), j({ generatedAt: '2026-11-04T08:00:00Z', rows: [1] })), true)
})

test('nested stamps (contracts meta, per-player confirmedAt) are stamps too', () => {
  const at = (d) => j({ meta: { generatedAt: `${d}T08:00:00Z`, sourceGeneratedAt: `${d}T11:39:46+00:00` }, players: { 1: { confirmedAt: `${d}T11:39:29+00:00`, aav: 5 } } })
  assert.equal(isStampOnlyChange(at('2026-11-03'), at('2026-11-04')), true)
})

test('an asOf run timestamp is a stamp; an asOf date is data', () => {
  assert.equal(isStampOnlyChange(j({ asOf: '2026-11-03T08:01:26.747Z', bat: {} }), j({ asOf: '2026-11-04T08:29:04.707Z', bat: {} })), true)
  assert.equal(isStampOnlyChange(j({ asOf: '2026-11-03', n: 1 }), j({ asOf: '2026-11-04', n: 1 })), false)
})

test('any other change is real', () => {
  assert.equal(isStampOnlyChange(j({ generatedAt: 'a', payRank: { of: 399 } }), j({ generatedAt: 'b', payRank: { of: 398 } })), false)
  assert.equal(isStampOnlyChange(j({ generatedAt: 'a', x: 1 }), j({ generatedAt: 'b', x: 1, y: 2 })), false)
  assert.equal(isStampOnlyChange(j({ generatedAt: 'a' }), j({})), false, 'a stamp that disappears is a shape change')
})

test('a file that is not JSON is never dropped', () => {
  assert.equal(isStampOnlyChange('INSERT 1;', 'INSERT 2;'), false)
  assert.equal(isStampOnlyChange('{', '{'), false)
})
