import test from 'node:test'
import assert from 'node:assert/strict'
import { latestAtOrBefore } from '../src/lib/math/snapshot.js'

const snaps = { '2026-05-03': 'c', '2026-05-01': 'a', '2026-05-02': 'b' }

test('latestAtOrBefore takes the newest entry on or before the cutoff', () => {
  assert.equal(latestAtOrBefore(snaps, '2026-05-02'), 'b') // the cutoff day counts
  assert.equal(latestAtOrBefore(snaps, '2026-05-02T23'), 'b')
  assert.equal(latestAtOrBefore(snaps, '2026-12-31'), 'c')
})

test('latestAtOrBefore is null before the first entry, and unlimited without a cutoff', () => {
  assert.equal(latestAtOrBefore(snaps, '2026-04-30'), null)
  assert.equal(latestAtOrBefore({}, '2026-05-02'), null)
  for (const none of [undefined, null, '']) assert.equal(latestAtOrBefore(snaps, none), 'c')
})
