// Coverage for the attendance data layer: the generator's pure parser
// (gen-attendance.mjs) and the reader/selectors (src/api/attendance.js).
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAttendance } from '../scripts/gen-attendance.mjs'
import { attendanceFor, attendanceRatesFor } from '../src/api/attendance.js'

// --------------------------------------------------------------------------
// parseAttendance — the boxscore info[] row -> a number, or null.
// --------------------------------------------------------------------------
test('parseAttendance strips commas and the trailing period', () => {
  assert.equal(parseAttendance([{ label: 'Att', value: '15,952.' }]), 15952)
})

test('parseAttendance is null on a missing Att row, empty value, or zero', () => {
  assert.equal(parseAttendance([{ label: 'Weather', value: '72 degrees.' }]), null)
  assert.equal(parseAttendance([]), null)
  assert.equal(parseAttendance(null), null)
  assert.equal(parseAttendance([{ label: 'Att', value: '' }]), null)
  assert.equal(parseAttendance([{ label: 'Att', value: '0.' }]), null)
})

// --------------------------------------------------------------------------
// reader/selectors
// --------------------------------------------------------------------------
const DATA = {
  generatedAt: '2026-08-01T00:00:00.000Z',
  seasons: {
    2026: {
      byTeamId: {
        158: { games: 10, avg: 40000, high: 45000, low: 32000 },
        147: { games: 12, avg: 38000, high: 41000, low: 30000 },
        121: { games: 8, avg: 38000, high: 39000, low: 36000 },
      },
    },
  },
}

test('attendanceFor selects one team/season row, null when absent', () => {
  assert.deepEqual(attendanceFor(DATA, 158, 2026), { games: 10, avg: 40000, high: 45000, low: 32000 })
  assert.equal(attendanceFor(DATA, 999, 2026), null)
  assert.equal(attendanceFor(null, 158, 2026), null)
})

test('attendanceRatesFor: rank is by average, richest gate first', () => {
  const top = attendanceRatesFor(DATA, 158, 2026)
  assert.deepEqual(top, { games: 10, avg: 40000, high: 45000, low: 32000, rank: 1, of: 3, tied: false })
})

test('attendanceRatesFor: ties on average share the best rank', () => {
  const tiedA = attendanceRatesFor(DATA, 147, 2026)
  const tiedB = attendanceRatesFor(DATA, 121, 2026)
  assert.equal(tiedA.rank, 2)
  assert.equal(tiedB.rank, 2)
  assert.equal(tiedA.tied, true)
  assert.equal(tiedB.tied, true)
})

test('attendanceRatesFor: null for a missing club, a missing file, or no games ingested', () => {
  assert.equal(attendanceRatesFor(DATA, 999, 2026), null)
  assert.equal(attendanceRatesFor(null, 158, 2026), null)
  const empty = { seasons: { 2026: { byTeamId: { 200: { games: 0, avg: null, high: null, low: null } } } } }
  assert.equal(attendanceRatesFor(empty, 200, 2026), null)
})
