// api/rotation/projectedStarters.js — who is LIKELY to start when no probable pitcher is
// announced. Pure math over workload.json's completed appearances: rest days
// since a pitcher's last start, ranked oldest start first. These tests pin the
// rule's four edges (rest floor, relief since the start, regular vs spot
// starter, the strictly-before date gate). The accuracy claim — about 51% exact
// and 82% in the top two over the last 28 days of the 2026 regular season — came
// from a one-off backtest on workload.json and is NOT asserted here; a test that
// read the live file would change every night.
import assert from 'node:assert/strict'
import test from 'node:test'
import { projectStarters } from '../src/api/rotation/projectedStarters.js'

const TEAM = 158
const AS_OF = '2026-09-30'

// apps are written most-recent-first, like workload.json.
const pitcher = (name, apps, teamId = TEAM) => ({ name, teamId, role: 'SP', apps })
const start = (d, p = 90) => ({ d, p, gs: 1 })
const relief = (d, p = 20) => ({ d, p, gs: 0 })

const data = (pitchers) => ({ asOf: AS_OF, pitchers })
const ids = (rows) => rows.map((r) => r.id)

test('ranks rested starters by the oldest last start first', () => {
  const d = data({
    1: pitcher('A', [start('2026-09-24'), start('2026-09-19')]), // 5 days rest
    2: pitcher('B', [start('2026-09-25'), start('2026-09-20')]), // 4 days rest
    3: pitcher('C', [start('2026-09-23'), start('2026-09-18')]), // 6 days rest
  })
  assert.deepEqual(ids(projectStarters(d, TEAM, AS_OF)), ['3', '1'])
})

test('returns at most two names by default and honors a limit', () => {
  const d = data({
    1: pitcher('A', [start('2026-09-24'), start('2026-09-19')]),
    2: pitcher('B', [start('2026-09-25'), start('2026-09-20')]),
    3: pitcher('C', [start('2026-09-23'), start('2026-09-18')]),
  })
  assert.equal(projectStarters(d, TEAM, AS_OF).length, 2)
  assert.equal(projectStarters(d, TEAM, AS_OF, 3).length, 3)
})

test('a pitcher with fewer than four days of rest is not listed', () => {
  const d = data({
    1: pitcher('A', [start('2026-09-26'), start('2026-09-21')]), // 3 days rest
    2: pitcher('B', [start('2026-09-25'), start('2026-09-20')]), // 4 days rest
  })
  assert.deepEqual(ids(projectStarters(d, TEAM, AS_OF)), ['2'])
})

test('a pitcher who relieved after his last start is not listed', () => {
  const d = data({
    1: pitcher('A', [relief('2026-09-27'), start('2026-09-22'), start('2026-09-17')]),
    2: pitcher('B', [start('2026-09-24'), start('2026-09-19')]),
  })
  assert.deepEqual(ids(projectStarters(d, TEAM, AS_OF)), ['2'])
})

test('a regular starter outranks a one-start pitcher with more rest', () => {
  const d = data({
    1: pitcher('Spot', [start('2026-09-20')]), // one start, 9 days rest
    2: pitcher('Regular', [start('2026-09-25'), start('2026-09-20')]), // 4 days rest
  })
  assert.deepEqual(ids(projectStarters(d, TEAM, AS_OF)), ['2', '1'])
})

test('a start older than 35 days does not count', () => {
  const d = data({
    1: pitcher('Old', [start('2026-08-20'), start('2026-08-14')]),
  })
  assert.deepEqual(projectStarters(d, TEAM, AS_OF), [])
})

test('only appearances strictly before the game date count', () => {
  const d = data({
    // His "last start" is the game date itself: it is the game being projected.
    1: pitcher('A', [start('2026-09-30'), start('2026-09-24'), start('2026-09-19')]),
  })
  const rows = projectStarters(d, TEAM, AS_OF)
  assert.equal(rows[0].lastStart, '2026-09-24')
  assert.equal(rows[0].restDays, 5)
})

test('another club\'s pitchers are never listed', () => {
  const d = data({
    1: pitcher('A', [start('2026-09-24'), start('2026-09-19')], 147),
  })
  assert.deepEqual(projectStarters(d, TEAM, AS_OF), [])
})

test('each row carries the facts the card prints', () => {
  const d = data({
    7: pitcher('Pat Pitcher', [start('2026-09-24', 88), start('2026-09-19')]),
  })
  const [row] = projectStarters(d, TEAM, AS_OF)
  assert.equal(row.id, '7')
  assert.equal(row.name, 'Pat Pitcher')
  assert.equal(row.restDays, 5)
  assert.equal(row.lastStart, '2026-09-24')
  assert.equal(row.lastPitches, 88)
})

test('missing data, an unknown club or a missing date gives an empty list', () => {
  assert.deepEqual(projectStarters(null, TEAM, AS_OF), [])
  assert.deepEqual(projectStarters({}, TEAM, AS_OF), [])
  assert.deepEqual(projectStarters(data({}), TEAM, AS_OF), [])
  assert.deepEqual(projectStarters(data({}), null, AS_OF), [])
  assert.deepEqual(projectStarters(data({}), TEAM, null), [])
})

// --- live rotation read -------------------------------------------------------
//
// workload.json holds REGULAR-SEASON rows only (gen-workload.mjs keeps
// gameType 'R') and is up to a day old. In October that makes a pitcher who
// started game 1 of the series look fully rested: on 2026-10-01 it showed Chris
// Sale on "7 days rest, 9/23" when he had started the Wild Card opener on 9/29.
// The file may only NAME the candidates; their appearances come from a live
// game log that carries every game type.
import { rotationCandidateIds, projectFromLiveLogs } from '../src/api/rotation/liveStarters.js'

// A game-log split as statsapi sends it, for the fields the reader uses.
const split = (date, gs, pitches, gameType = 'R') => ({
  date,
  gameType,
  stat: { gamesStarted: gs, numberOfPitches: pitches },
})

test('rotationCandidateIds names this club\'s pitchers with a start in the window, nothing else', () => {
  const d = data({
    1: pitcher('Starter', [start('2026-09-24')]),
    2: pitcher('Reliever', [relief('2026-09-29')]),
    3: pitcher('Old start', [start('2026-08-01')]),
    4: pitcher('Other club', [start('2026-09-24')], 147),
  })
  assert.deepEqual(rotationCandidateIds(d, TEAM, AS_OF), ['1'])
})

test('a postseason start in the live log removes a pitcher the file shows as rested', async () => {
  const d = data({
    1: pitcher('Sale', [start('2026-09-23'), start('2026-09-11')]),
    2: pitcher('Third starter', [start('2026-09-24'), start('2026-09-18')]),
  })
  const logs = {
    // WC game 1 is not in the file: the file is regular season only.
    1: [split('2026-09-11', 1, 94), split('2026-09-23', 1, 97), split('2026-09-29', 1, 95, 'F')],
    2: [split('2026-09-18', 1, 98), split('2026-09-24', 1, 91)],
  }
  const rows = await projectFromLiveLogs(d, TEAM, '2026-10-01', async (id) => logs[id])
  assert.deepEqual(ids(rows), ['2'])
})

test('a postseason relief outing after his last start removes a pitcher', async () => {
  const d = data({ 1: pitcher('A', [start('2026-09-22'), start('2026-09-17')]) })
  const logs = {
    1: [split('2026-09-17', 1, 90), split('2026-09-22', 1, 88), split('2026-09-30', 0, 25, 'F')],
  }
  assert.deepEqual(await projectFromLiveLogs(d, TEAM, '2026-10-01', async (id) => logs[id]), [])
})

test('the live rows feed the same rest rule and report the live last start', async () => {
  const d = data({ 1: pitcher('A', [start('2026-09-20'), start('2026-09-15')]) })
  const logs = { 1: [split('2026-09-15', 1, 90), split('2026-09-20', 1, 85), split('2026-09-26', 1, 77, 'F')] }
  const [row] = await projectFromLiveLogs(d, TEAM, '2026-10-01', async (id) => logs[id])
  assert.equal(row.lastStart, '2026-09-26')
  assert.equal(row.restDays, 4)
  assert.equal(row.lastPitches, 77)
})

test('a pitcher whose live log is empty or fails is dropped, never read from the stale file', async () => {
  const d = data({
    1: pitcher('Empty', [start('2026-09-20'), start('2026-09-15')]),
    2: pitcher('Throws', [start('2026-09-20'), start('2026-09-15')]),
  })
  const fetchLog = async (id) => {
    if (id === '2') throw new Error('network')
    return []
  }
  assert.deepEqual(await projectFromLiveLogs(d, TEAM, '2026-10-01', fetchLog), [])
})

test('the live read ignores a log row on or after the game date', async () => {
  const d = data({ 1: pitcher('A', [start('2026-09-20'), start('2026-09-15')]) })
  const logs = { 1: [split('2026-09-15', 1, 90), split('2026-09-20', 1, 85), split('2026-10-01', 1, 40, 'F')] }
  const [row] = await projectFromLiveLogs(d, TEAM, '2026-10-01', async (id) => logs[id])
  assert.equal(row.lastStart, '2026-09-20')
})
