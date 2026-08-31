// Pure write-rule coverage for api/contract-identity.js — the admin override
// store behind /admin/contracts (ADR-0066). Same property api/copy.js's
// write-plan tests pin, applied to a per-row override instead of a per-field
// one: A PATCH MAY ONLY CHANGE WHAT IT EXPLICITLY NAMES, and a bad value
// anywhere in the patch must refuse the WHOLE write rather than silently
// apply the rest and drop the bad one.
import assert from 'node:assert/strict'
import test from 'node:test'

import { acceptableBody, mergeOverrides, sanitizeOverrides } from '../api/contract-identity.js'

const STAMP = { userId: 'user_admin1', now: '2026-08-26T00:00:00.000Z' }

test('sanitizeOverrides keeps a valid mlbId override and a valid dismissed override', () => {
  const clean = sanitizeOverrides({
    'extensions#3': JSON.stringify({ mlbId: 605141, dismissed: false, note: 'confirmed', correctedBy: 'x', correctedAt: 'y' }),
    'salaries#10': JSON.stringify({ mlbId: null, dismissed: true, note: null, correctedBy: 'x', correctedAt: 'y' }),
  })
  assert.equal(clean['extensions#3'].mlbId, 605141)
  assert.equal(clean['salaries#10'].dismissed, true)
})

test('sanitizeOverrides drops an unrecognized rowKey shape', () => {
  const clean = sanitizeOverrides({ 'not-a-real-file#3': JSON.stringify({ mlbId: 1 }) })
  assert.deepEqual(clean, {})
})

// BOTH KEY SHAPES PASS, and they have to for as long as an un-migrated
// correction can still sit in Redis. A row is named by a content hash now
// (ADR-0069); it used to be named by its position in the source CSV. This
// endpoint drops what it does not match, so rejecting the old shape would hide
// a stored correction from the very migration written to move it.
test('sanitizeOverrides keeps both the content and the legacy rowKey shape', () => {
  const clean = sanitizeOverrides({
    'salaries#3f0c7a1e58d4b269': JSON.stringify({ mlbId: 605141 }),
    'salaries#24340': JSON.stringify({ mlbId: 279578 }),
  })
  assert.equal(clean['salaries#3f0c7a1e58d4b269'].mlbId, 605141)
  assert.equal(clean['salaries#24340'].mlbId, 279578)
})

test('sanitizeOverrides drops a hash that is the wrong length or not hex', () => {
  // The two shapes are disjoint by length, which is what stops one being read
  // as the other. A near-miss is a typo, not a third shape.
  const clean = sanitizeOverrides({
    'salaries#3f0c7a1e58d4b2': JSON.stringify({ mlbId: 1 }),
    'salaries#3f0c7a1e58d4b2690': JSON.stringify({ mlbId: 1 }),
    'salaries#3f0c7a1e58d4b26g': JSON.stringify({ mlbId: 1 }),
    'salaries#3F0C7A1E58D4B269': JSON.stringify({ mlbId: 1 }),
    'salaries#12345678': JSON.stringify({ mlbId: 1 }),
  })
  // All five are refused: fifteen hex characters, seventeen, a non-hex digit,
  // upper case, and a positional index eight digits wide — wider than any of
  // these four files can address, and the width cap is what keeps the two
  // shapes from overlapping.
  assert.deepEqual(Object.keys(clean), [])
})

test('a patch may name a row under either key shape', () => {
  const merged = mergeOverrides(
    {},
    { 'arbitration#1219': { mlbId: 571510 }, 'arbitration#00f2f1fb36d1742a': { mlbId: 571510 } },
    STAMP,
  )
  assert.deepEqual(Object.keys(merged).sort(), ['arbitration#00f2f1fb36d1742a', 'arbitration#1219'])
})

test('sanitizeOverrides drops a value that is neither a real id nor dismissed', () => {
  const clean = sanitizeOverrides({ 'arbitration#1': JSON.stringify({ mlbId: null, dismissed: false }) })
  assert.deepEqual(clean, {})
})

test('sanitizeOverrides drops a non-positive-integer mlbId', () => {
  const clean = sanitizeOverrides({
    'arbitration#1': JSON.stringify({ mlbId: -5 }),
    'arbitration#2': JSON.stringify({ mlbId: 1.5 }),
    'arbitration#3': JSON.stringify({ mlbId: 0 }),
  })
  assert.deepEqual(clean, {})
})

test('sanitizeOverrides round-trips a human-confirmed match through confidence/originalConfidence', () => {
  const clean = sanitizeOverrides({
    'extensions#3': JSON.stringify({
      mlbId: 605141,
      dismissed: false,
      note: 'confirmed',
      correctedBy: 'x',
      correctedAt: 'y',
      confidence: 'exact',
      originalConfidence: 'fuzzy',
    }),
  })
  assert.equal(clean['extensions#3'].confidence, 'exact')
  assert.equal(clean['extensions#3'].originalConfidence, 'fuzzy')
})

test('sanitizeOverrides defaults confidence/originalConfidence to null when absent', () => {
  const clean = sanitizeOverrides({
    'extensions#3': JSON.stringify({ mlbId: 605141, dismissed: false, note: null, correctedBy: 'x', correctedAt: 'y' }),
  })
  assert.equal(clean['extensions#3'].confidence, null)
  assert.equal(clean['extensions#3'].originalConfidence, null)
})

test('sanitizeOverrides refuses a confidence value other than the literal "exact"', () => {
  const clean = sanitizeOverrides({ 'extensions#3': JSON.stringify({ mlbId: 605141, confidence: 'fuzzy' }) })
  assert.deepEqual(clean, {})
})

test('sanitizeOverrides refuses an originalConfidence value outside its fixed vocabulary', () => {
  const clean = sanitizeOverrides({ 'extensions#3': JSON.stringify({ mlbId: 605141, originalConfidence: 'nonsense' }) })
  assert.deepEqual(clean, {})
})

test('mergeOverrides: a patch never touches a row it does not name', () => {
  const prev = { 'extensions#1': { mlbId: 111, dismissed: false, note: null, correctedBy: 'a', correctedAt: 't' } }
  const merged = mergeOverrides(prev, { 'arbitration#2': { mlbId: 222 } }, STAMP)
  assert.equal(merged['extensions#1'].mlbId, 111, 'the row not named in the patch survives untouched')
  assert.equal(merged['arbitration#2'].mlbId, 222)
})

test('mergeOverrides: a patch value of null clears exactly that row', () => {
  const prev = {
    'extensions#1': { mlbId: 111, dismissed: false, note: null, correctedBy: 'a', correctedAt: 't' },
    'extensions#2': { mlbId: 222, dismissed: false, note: null, correctedBy: 'a', correctedAt: 't' },
  }
  const merged = mergeOverrides(prev, { 'extensions#1': null }, STAMP)
  assert.ok(!('extensions#1' in merged), 'the cleared row is gone')
  assert.equal(merged['extensions#2'].mlbId, 222, 'the other row survives')
})

test('mergeOverrides: correctedBy/correctedAt are always server-stamped, never client-supplied', () => {
  const merged = mergeOverrides({}, { 'salaries#5': { mlbId: 999, correctedBy: 'someone-else', correctedAt: '1999-01-01' } }, STAMP)
  assert.equal(merged['salaries#5'].correctedBy, STAMP.userId)
  assert.equal(merged['salaries#5'].correctedAt, STAMP.now)
})

test('mergeOverrides: one bad entry refuses the WHOLE patch, never a partial apply', () => {
  const prev = { 'extensions#1': { mlbId: 111, dismissed: false, note: null, correctedBy: 'a', correctedAt: 't' } }
  const merged = mergeOverrides(
    prev,
    { 'arbitration#2': { mlbId: 222 }, 'salaries#9': { mlbId: -1 } }, // the second entry is invalid
    STAMP,
  )
  assert.equal(merged, undefined, 'a patch with any invalid entry is refused outright')
})

test('mergeOverrides: a patch value of neither field still round-trips as it does today', () => {
  const merged = mergeOverrides({}, { 'salaries#5': { mlbId: 999 } }, STAMP)
  assert.equal(merged['salaries#5'].mlbId, 999)
  assert.equal(merged['salaries#5'].confidence, null)
  assert.equal(merged['salaries#5'].originalConfidence, null)
})

test('mergeOverrides: a promoted match round-trips confidence and originalConfidence', () => {
  const merged = mergeOverrides(
    {},
    { 'salaries#5': { mlbId: 999, confidence: 'exact', originalConfidence: 'ambiguous' } },
    STAMP,
  )
  assert.equal(merged['salaries#5'].confidence, 'exact')
  assert.equal(merged['salaries#5'].originalConfidence, 'ambiguous')
})

test('mergeOverrides: confidence "fuzzy" is refused', () => {
  const merged = mergeOverrides({}, { 'salaries#5': { mlbId: 999, confidence: 'fuzzy' } }, STAMP)
  assert.equal(merged, undefined)
})

test('mergeOverrides: originalConfidence "nonsense" is refused', () => {
  const merged = mergeOverrides({}, { 'salaries#5': { mlbId: 999, originalConfidence: 'nonsense' } }, STAMP)
  assert.equal(merged, undefined)
})

test('mergeOverrides: a patch with one bad confidence value among several rows changes nothing', () => {
  const prev = { 'extensions#1': { mlbId: 111, dismissed: false, note: null, correctedBy: 'a', correctedAt: 't', confidence: null, originalConfidence: null } }
  const merged = mergeOverrides(
    prev,
    { 'arbitration#2': { mlbId: 222, confidence: 'exact' }, 'salaries#9': { mlbId: 333, confidence: 'close-enough' } },
    STAMP,
  )
  assert.equal(merged, undefined, 'the whole patch is refused, including the otherwise-valid row')
})

test('mergeOverrides: an unrecognized rowKey in the patch refuses the write', () => {
  const merged = mergeOverrides({}, { 'not-a-real-file#1': { mlbId: 1 } }, STAMP)
  assert.equal(merged, undefined)
})

test('acceptableBody: only a plain patch object is accepted', () => {
  assert.equal(acceptableBody({ patch: { 'extensions#1': { mlbId: 1 } } }), true)
  assert.equal(acceptableBody({ patch: [] }), false)
  assert.equal(acceptableBody({ patch: null }), false)
  assert.equal(acceptableBody({}), false)
  assert.equal(acceptableBody(null), false)
})
