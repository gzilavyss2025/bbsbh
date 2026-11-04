// Pins the exact text of the date formatters in dates.js and the month spellings that moved
// onto Intl (#2850): the output must not change when a MONTHS array goes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weekdayAbbr, monthDayName, humanDate, humanDateWithYear, scorebookDate } from '../src/lib/dates.js'
import { seasonAxis } from '../src/screens/player/next/modules/contact/contactPlay.js'
import { filmRoomModel } from '../src/lib/postseason/worldseries/scouting/filmRoom.js'
import { meetingLabel } from '../src/lib/postseason/worldseries/tape.js'
import { buildJumps } from '../src/lib/time/standingsDates.js'

test('dates.js formatters keep their en-US text', () => {
  assert.equal(weekdayAbbr('2026-07-05'), 'SUN')
  assert.equal(humanDate('2026-07-05'), 'Sun, Jul 5')
  assert.equal(humanDateWithYear('2026-07-05'), 'Sun, Jul 5, 2026')
  assert.equal(scorebookDate('2026-06-12'), 'Fri, June 12, 2026')
  assert.equal(monthDayName('2019-07-03'), 'Jul 3')
  assert.equal(monthDayName('2026-09-30'), 'Sep 30')
})

test('every month keeps its three-letter name', () => {
  const names = []
  for (let m = 1; m <= 12; m++) names.push(monthDayName(`2026-${String(m).padStart(2, '0')}-01`))
  assert.deepEqual(names, ['Jan 1', 'Feb 1', 'Mar 1', 'Apr 1', 'May 1', 'Jun 1', 'Jul 1', 'Aug 1', 'Sep 1', 'Oct 1', 'Nov 1', 'Dec 1'])
})

test('the season axis labels each month', () => {
  assert.deepEqual(seasonAxis(['2026-03-28', '2026-12-05']).months.map((m) => m.t), ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
})

test('the meeting label spells the month in full', () => {
  assert.equal(meetingLabel(['2026-08-30', '2026-09-01']), 'August 30–September 1')
})

test('the standings quick-jumps name the month', () => {
  assert.deepEqual(buildJumps('2026-07-15').map((j) => j.label), ['30d ago', 'Apr 1', 'May 1', 'Jun 1', 'Jul 1'])
})

test('the film room day reads "Tue Aug 4"', () => {
  const side = (id) => ({ id, abbr: 'X', runs: 1, hits: 1, errors: 0, starter: { id, name: 'A B', hand: 'R', ip: '6.0', h: 1, r: 0, er: 0, bb: 0, k: 1, pitches: 9, mix: {} }, lineup: [] })
  const [m] = filmRoomModel([{ gamePk: 1, date: '2026-08-04', venue: 'V', ump: 'U', decisions: {}, away: side(1), home: side(2), scoring: [] }])
  assert.equal(m.day, 'Tue Aug 4')
})
