import assert from 'node:assert/strict'
import test from 'node:test'
import registry from '../src/lib/anchors/anchors.json' with { type: 'json' }
import { isExpired } from '../src/lib/anchors/pick.js'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const UNITS = new Set(['people', 'things', 'teams'])
const KINDS = new Set(['static', 'volatile'])
const STATUSES = new Set(['verified', 'unverified', 'disputed', 'stale', 'unsourced'])

test('every anchor has a source and a checked date', () => {
  assert.ok(registry.anchors.length > 0)
  for (const a of registry.anchors) {
    assert.ok(Array.isArray(a.sources) && a.sources.length > 0, `${a.id}: no source`)
    for (const s of a.sources) {
      assert.match(String(s.url), /^https:\/\//, `${a.id}: source has no https url`)
      assert.match(String(s.checked), ISO, `${a.id}: source has no checked date`)
    }
  }
})

test('every anchor has the fields pick reads', () => {
  const ids = new Set()
  for (const a of registry.anchors) {
    assert.ok(a.id && !ids.has(a.id), `duplicate or empty id ${a.id}`)
    ids.add(a.id)
    assert.ok(Number.isInteger(a.count) && a.count > 0, `${a.id}: count`)
    assert.ok(UNITS.has(a.unit), `${a.id}: unit`)
    assert.ok(KINDS.has(a.kind), `${a.id}: kind`)
    assert.ok(STATUSES.has(a.status), `${a.id}: status`)
    assert.ok([1, 2, 3].includes(a.tier), `${a.id}: tier`)
    assert.ok(typeof a.phrase === 'string' && a.phrase.length > 0, `${a.id}: phrase`)
  }
})

test('no anchor uses an excluded id', () => {
  const excluded = new Set(registry.excluded.map((e) => e.id))
  assert.ok(excluded.size > 0)
  for (const a of registry.anchors) assert.ok(!excluded.has(a.id), `${a.id} is on the excluded list`)
})

// The picker never fails CI over a date (spec, "Picker rules" 2). This lists the volatile
// anchors past their re-check window today, so a run log shows which to re-read.
test('lists the volatile anchors past their re-check window (report only)', (t) => {
  const today = new Date().toISOString().slice(0, 10)
  const late = registry.anchors.filter((a) => a.status === 'verified' && isExpired(a, today))
  t.diagnostic(late.length ? `re-check: ${late.map((a) => a.id).join(', ')}` : 'no anchor is past its re-check window')
  assert.ok(Array.isArray(late))
})
