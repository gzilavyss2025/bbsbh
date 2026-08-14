// The scorecard's per-cell notation override store (src/lib/scorecardNotes.js)
// — the pencil-over-ink layer. What matters here:
//
//   • TOLERANCE — a hand-mangled localStorage value can never crash the sheet
//     or smuggle in a non-string; anything malformed collapses to the empty
//     store, same posture as parseRevealMark.
//   • HYGIENE — fields are trimmed and capped, a blanked field is removed
//     rather than stored empty, an emptied cell disappears, and an emptied
//     store serializes to null so the key is deleted instead of parked.
//   • IDENTITY — a no-op write returns the same object, so a save that
//     changed nothing never causes a storage write or a re-render.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseScorecardNotes,
  serializeScorecardNotes,
  cellNote,
  withCellNote,
  withoutCellNote,
  EMPTY_SCORECARD_NOTES,
} from '../src/lib/scorecardNotes.js'

test('malformed storage collapses to the empty store', () => {
  for (const raw of [
    null,
    '',
    'not json',
    '[]',
    '"x"',
    '{"v":2,"cells":{"1":{"outcome":"HR"}}}', // wrong version
    '{"v":1}', // no cells
    '{"v":1,"cells":null}',
    '{"v":1,"cells":{"abc":{"outcome":"HR"}}}', // non-numeric key
    '{"v":1,"cells":{"1":"HR"}}', // cell isn’t an object
    '{"v":1,"cells":{"1":{"outcome":42}}}', // non-string field
    '{"v":1,"cells":{"1":{"unknown":"x"}}}', // no known field survives
  ]) {
    const parsed = parseScorecardNotes(raw)
    assert.deepEqual(parsed, { cells: {} }, `raw: ${raw}`)
  }
})

test('a good value round-trips, trimmed and capped', () => {
  const notes = withCellNote(EMPTY_SCORECARD_NOTES, 12, {
    outcome: '  6U  ',
    center: 'a-very-long-chain-that-overflows',
    rbi: '234',
  })
  assert.deepEqual(cellNote(notes, 12), {
    outcome: '6U',
    center: 'a-very-lon', // capped at 10
    rbi: '23', // capped at 2
  })
  const raw = serializeScorecardNotes(notes)
  assert.deepEqual(parseScorecardNotes(raw), notes)
})

test('blanking a field drops it; blanking the last field drops the cell', () => {
  let notes = withCellNote(EMPTY_SCORECARD_NOTES, 3, { outcome: 'E5', rbi: '1' })
  notes = withCellNote(notes, 3, { rbi: '   ' })
  assert.deepEqual(cellNote(notes, 3), { outcome: 'E5' })
  notes = withCellNote(notes, 3, { outcome: '' })
  assert.equal(cellNote(notes, 3), null)
  assert.equal(serializeScorecardNotes(notes), null)
})

test('a no-op write returns the same object', () => {
  const notes = withCellNote(EMPTY_SCORECARD_NOTES, 7, { outcome: 'FO' })
  assert.equal(withCellNote(notes, 7, { outcome: ' FO ' }), notes)
  assert.equal(withCellNote(notes, null, { outcome: 'HR' }), notes)
  assert.equal(withoutCellNote(notes, 99), notes)
  assert.equal(withoutCellNote(EMPTY_SCORECARD_NOTES, 7), EMPTY_SCORECARD_NOTES)
})

test('clearing one cell leaves the others alone', () => {
  let notes = withCellNote(EMPTY_SCORECARD_NOTES, 1, { outcome: 'HR' })
  notes = withCellNote(notes, 2, { center: '5-3' })
  notes = withoutCellNote(notes, 1)
  assert.equal(cellNote(notes, 1), null)
  assert.deepEqual(cellNote(notes, 2), { center: '5-3' })
})

test('cells survive independently and only overridden fields are stored', () => {
  const notes = withCellNote(EMPTY_SCORECARD_NOTES, 40, { center: '6-4-3' })
  assert.deepEqual(cellNote(notes, 40), { center: '6-4-3' })
  assert.equal(cellNote(notes, 40).outcome, undefined)
  // Keyed by string internally, reachable by number or string.
  assert.deepEqual(cellNote(notes, '40'), { center: '6-4-3' })
})
