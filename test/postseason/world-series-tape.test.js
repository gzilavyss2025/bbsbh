import assert from 'node:assert/strict'
import test from 'node:test'
import { meetingLabel, tapeRows } from '../../src/lib/postseason/worldseries/tape.js'

test('meetingLabel: one series, one month, from the real dates', () => {
  assert.equal(meetingLabel(['2026-06-16', '2026-06-17', '2026-06-18']), 'June 16–18')
  assert.equal(meetingLabel(['2026-06-16']), 'June 16')
})

test('meetingLabel: a series that crosses a month, two series, none', () => {
  assert.equal(meetingLabel(['2026-06-30', '2026-07-01', '2026-07-02']), 'June 30–July 2')
  assert.equal(meetingLabel(['2026-06-16', '2026-06-17', '2026-08-04', '2026-08-05']), 'June 16–17, August 4–5')
  assert.equal(meetingLabel([]), '')
})

const side = (o) => ({ wins: 90, runDiff: 100, octW: 5, octL: 2, lastWs: 2018, lastTitle: 2018, ...o })

test('rows in tape order, wins and run diff drawn as bars', () => {
  const rows = tapeRows({ away: side({}), home: side({ wins: 95 }), meetingDates: ['2026-06-16', '2026-06-18'] })
  assert.deepEqual(rows.map((r) => r.key), ['wins', 'runDiff', 'oct', 'meeting', 'lastWs', 'lastTitle'])
  assert.deepEqual(rows.filter((r) => r.bar).map((r) => r.key), ['wins', 'runDiff'])
  assert.equal(rows.find((r) => r.key === 'oct').away, '5–2')
  assert.equal(rows.find((r) => r.key === 'meeting').label, 'June 16–18')
})

test('the meeting row is hidden when the clubs did not meet', () => {
  const rows = tapeRows({ away: side({}), home: side({}), meetingDates: [] })
  assert.ok(!rows.some((r) => r.key === 'meeting'))
})

test('no Series or no title reads as a dash', () => {
  const rows = tapeRows({ away: side({ lastWs: null, lastTitle: null }), home: side({ lastTitle: null }), meetingDates: [] })
  assert.equal(rows.find((r) => r.key === 'lastWs').away, '—')
  assert.equal(rows.find((r) => r.key === 'lastTitle').away, '—')
  assert.equal(rows.find((r) => r.key === 'lastTitle').home, '—')
  assert.equal(rows.find((r) => r.key === 'lastWs').home, 2018)
})
