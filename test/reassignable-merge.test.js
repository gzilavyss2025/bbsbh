import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeReassignableRows } from '../scripts/lib/reassignable-merge.mjs'

const opts = {
  getKey: (r) => r.who,
  getRowId: (r) => r.eventId,
  getName: (r) => r.whoName,
  toRow: (r) => ({ eventId: r.eventId, value: r.value }),
}

test('a fresh row for an unseen key is just added', () => {
  const merged = mergeReassignableRows({}, [{ who: 1, whoName: 'A', eventId: 'e1', value: 5 }], opts)
  assert.deepEqual(Object.keys(merged), ['1'])
  assert.equal(merged['1'].rows.length, 1)
})

test('a reassigned event moves to its new key instead of duplicating', () => {
  const prev = { 1: { id: 1, name: 'A', rows: [{ eventId: 'e1', value: 5 }] } }
  const fresh = [{ who: 2, whoName: 'B', eventId: 'e1', value: 5 }]
  const merged = mergeReassignableRows(prev, fresh, opts)
  assert.equal(merged['1'], undefined, 'old key left with no rows must be dropped entirely')
  assert.ok(merged['2'])
  assert.equal(merged['2'].rows.length, 1)
  assert.equal(merged['2'].rows[0].eventId, 'e1')
})

test('a key keeps its other rows when only one event is reassigned away', () => {
  const prev = {
    1: {
      id: 1,
      name: 'A',
      rows: [
        { eventId: 'e1', value: 5 },
        { eventId: 'e2', value: 9 },
      ],
    },
  }
  const fresh = [{ who: 2, whoName: 'B', eventId: 'e1', value: 5 }]
  const merged = mergeReassignableRows(prev, fresh, opts)
  assert.equal(merged['1'].rows.length, 1)
  assert.equal(merged['1'].rows[0].eventId, 'e2')
})

test('re-merging the same event under the same key just overwrites it', () => {
  const prev = { 1: { id: 1, name: 'A', rows: [{ eventId: 'e1', value: 5 }] } }
  const fresh = [{ who: 1, whoName: 'A', eventId: 'e1', value: 7 }]
  const merged = mergeReassignableRows(prev, fresh, opts)
  assert.equal(merged['1'].rows.length, 1)
  assert.equal(merged['1'].rows[0].value, 7)
})

test('name refreshes to the freshest spelling seen', () => {
  const prev = { 1: { id: 1, name: 'Old Name', rows: [{ eventId: 'e1', value: 5 }] } }
  const fresh = [{ who: 1, whoName: 'New Name', eventId: 'e2', value: 6 }]
  const merged = mergeReassignableRows(prev, fresh, opts)
  assert.equal(merged['1'].name, 'New Name')
})
