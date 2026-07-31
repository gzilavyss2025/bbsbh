// The custom-mark library/assignment resolution (src/lib/customMarks.js,
// ADR-0029) — a treatment's "Replace art" select can point at either a mark
// recolored in the Logo art editor (a bare slug) or one of the CDN's own
// vectors (`cdn:<variant>`, no recolor needed). Both share one assignments
// map, so parseMarkAssignmentKey is what tells the two apart.
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMarkAssignmentKey, customMarkFor, customMarksFor, customMarkAssignment } from '../src/lib/customMarks.js'

test('parseMarkAssignmentKey: no assignment at all is null', () => {
  assert.equal(parseMarkAssignmentKey(undefined), null)
  assert.equal(parseMarkAssignmentKey(''), null)
})

test('parseMarkAssignmentKey: a bare slug is a custom-mark assignment', () => {
  assert.deepEqual(parseMarkAssignmentKey('serpent-red'), { kind: 'custom', slug: 'serpent-red' })
})

test('parseMarkAssignmentKey: a cdn:-prefixed key is a CDN-variant assignment', () => {
  assert.deepEqual(parseMarkAssignmentKey('cdn:wordmark'), { kind: 'cdn', variant: 'wordmark' })
  assert.deepEqual(parseMarkAssignmentKey('cdn:base'), { kind: 'cdn', variant: 'base' })
})

// Nashville Sounds (556) — a real, currently-landed assignment
// (src/lib/data/custom-marks.json): Home wears their saved "primary1" mark.
test('customMarkFor resolves a real landed custom-mark assignment', () => {
  assert.equal(customMarkAssignment(556, 'milb-home'), 'primary1')
  const resolved = customMarkFor(556, 'milb-home')
  assert.equal(resolved.slug, 'primary1')
  assert.ok(resolved.url.includes('556-primary1'))
})

test('customMarkFor is null for a treatment with no assignment', () => {
  assert.equal(customMarkFor(556, 'milb-away'), null)
  assert.equal(customMarkFor(999999, 'main'), null)
})

test('customMarksFor is empty for a club with no saved marks, not a throw', () => {
  assert.deepEqual(customMarksFor(999999), [])
})
