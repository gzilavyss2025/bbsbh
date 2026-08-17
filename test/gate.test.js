// The two halves of the gate/pace pipeline: what scripts/gen-gate.mjs reduces
// a schedule response down to, and what src/api/reports/gate.js turns those
// aggregates into for The Gate and The Clock.
//
// The assertions worth having here are the ones about DENOMINATORS and about
// rows that should not count at all, because those are the mistakes that
// produce a plausible-looking board rather than an obviously broken one: a
// postponed game counted twice, a road game folded into a club's home gate, a
// club with no listed park quietly ranked last on fill rate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { toRow, dayOfWeek, aggregate, leagueFor, buildSeason } from '../scripts/gen-gate.mjs'
import {
  gateBoard,
  paceBoard,
  asClock,
  capacityFor,
  latestSeason,
  monthsIn,
} from '../src/api/reports/gate.js'

const game = (over = {}) => ({
  gamePk: 1,
  officialDate: '2026-06-12',
  dayNight: 'night',
  status: { abstractGameState: 'Final' },
  gameInfo: { attendance: 30000, gameDurationMinutes: 170, delayDurationMinutes: 0 },
  teams: { home: { team: { id: 158 } }, away: { team: { id: 112 } } },
  venue: { name: 'American Family Field' },
  ...over,
})

// ---- toRow ----

test('toRow keeps a Final game filed under its own officialDate', () => {
  const row = toRow(game(), '2026-06-12')
  assert.equal(row.homeId, 158)
  assert.equal(row.attendance, 30000)
  assert.equal(row.minutes, 170)
})

test('toRow drops a game that is not Final', () => {
  assert.equal(toRow(game({ status: { abstractGameState: 'Live' } }), '2026-06-12'), null)
})

// The postponed-replay trap: a replayed game is listed under BOTH the original
// date and the date it was played, so a sweep that walked dates without this
// check would count one game twice.
test('toRow drops a game listed under a date that is not its officialDate', () => {
  assert.equal(toRow(game({ officialDate: '2026-06-14' }), '2026-06-12'), null)
})

test('toRow keeps a game with only one of the two figures', () => {
  const noGate = toRow(game({ gameInfo: { gameDurationMinutes: 170 } }), '2026-06-12')
  assert.equal(noGate.attendance, null)
  assert.equal(noGate.minutes, 170)
  const noClock = toRow(game({ gameInfo: { attendance: 30000 } }), '2026-06-12')
  assert.equal(noClock.minutes, null)
})

test('toRow drops a game reporting neither figure', () => {
  assert.equal(toRow(game({ gameInfo: {} }), '2026-06-12'), null)
})

test('toRow treats a zero attendance as absent, not as a crowd of none', () => {
  const row = toRow(game({ gameInfo: { attendance: 0, gameDurationMinutes: 150 } }), '2026-06-12')
  assert.equal(row.attendance, null)
})

// The timezone trap: parsed as a local Date, a Sunday game reads as Saturday
// for anyone west of Greenwich, and every weekend split would be wrong.
test('dayOfWeek reads a calendar date without the machine timezone shifting it', () => {
  assert.equal(dayOfWeek('2026-06-14'), 0) // a Sunday
  assert.equal(dayOfWeek('2026-06-12'), 5) // a Friday
  assert.equal(dayOfWeek(null), null)
})

// ---- aggregate: the two denominators ----

const rows = [
  toRow(game({ gamePk: 1, officialDate: '2026-06-12' }), null),
  toRow(
    game({
      gamePk: 2,
      officialDate: '2026-07-04',
      dayNight: 'day',
      gameInfo: { attendance: 44000, gameDurationMinutes: 200, delayDurationMinutes: 30 },
    }),
    null,
  ),
  // The same two clubs, roles reversed: a ROAD date for 158.
  toRow(
    game({
      gamePk: 3,
      officialDate: '2026-08-01',
      teams: { home: { team: { id: 112 } }, away: { team: { id: 158 } } },
      venue: { name: 'Citizens Bank Park' },
      gameInfo: { attendance: 20000, gameDurationMinutes: 140, delayDurationMinutes: 0 },
    }),
    null,
  ),
]

test('attendance counts home dates only; pace counts every game a club played', () => {
  const clubs = aggregate(rows)
  // 158 hosted twice and travelled once.
  assert.equal(clubs[158].gate.games, 2)
  assert.equal(clubs[158].pace.games, 3)
  // Its road date's 20,000 belongs to the host, not to it.
  assert.equal(clubs[158].gate.avg, 37000)
  assert.equal(clubs[112].gate.games, 1)
  assert.equal(clubs[112].gate.avg, 20000)
})

test('the extremes carry the day and the opponent, not just the figure', () => {
  const clubs = aggregate(rows)
  assert.equal(clubs[158].gate.high.n, 44000)
  assert.equal(clubs[158].gate.high.date, '2026-07-04')
  assert.equal(clubs[158].gate.high.oppId, 112)
})

test('the day/night and weekend splits are counted separately', () => {
  const clubs = aggregate(rows)
  assert.equal(clubs[158].gate.day.g, 1)
  assert.equal(clubs[158].gate.night.g, 1)
  // 2026-07-04 is a Saturday, 2026-06-12 a Friday: both weekend dates.
  assert.equal(clubs[158].gate.weekend.g, 2)
  assert.equal(clubs[158].gate.weekday, null)
})

test('delay minutes are summed only over the games that carried one', () => {
  const clubs = aggregate(rows)
  assert.equal(clubs[158].pace.delays.games, 1)
  assert.equal(clubs[158].pace.delays.minutes, 30)
})

// Averaging thirty per-club averages weights a club with 59 home dates the
// same as one with 66. The league line has to come off the rows.
test('the league line is computed from the games, not from the club averages', () => {
  const league = leagueFor(rows)
  assert.equal(league.attGames, 3)
  assert.equal(league.attAvg, Math.round((30000 + 44000 + 20000) / 3))
  assert.equal(league.over180, 1)
})

test('buildSeason reports the latest date it saw', () => {
  assert.equal(buildSeason(rows).through, '2026-08-01')
})

// ---- the reader ----

const data = { generatedAt: 'x', seasons: { 2026: buildSeason(rows) } }

test('latestSeason picks the newest season on file', () => {
  assert.equal(latestSeason(data), 2026)
  assert.equal(latestSeason({ seasons: {} }), null)
})

test('fill rate divides the average by the listed capacity of a known park', () => {
  const board = gateBoard(data, 2026, 'fill')
  const brewers = board.rows.find((r) => r.teamId === 158)
  // American Family Field is on file at 41,700.
  assert.equal(capacityFor('American Family Field'), 41700)
  assert.equal(brewers.fill, Math.round((37000 / 41700) * 1000) / 10)
})

// A park not in the static table must cost the club its fill rate and nothing
// else — a null there is "not on file", never "ranked last".
test('a club with no park on file still ranks on every other column', () => {
  const noPark = {
    seasons: {
      2026: {
        through: '2026-06-12',
        league: leagueFor(rows),
        clubs: { 999: { venue: 'Some Unlisted Yard', gate: aggregate(rows)[158].gate, pace: null } },
      },
    },
  }
  const board = gateBoard(noPark, 2026, 'avg')
  assert.equal(board.rows[0].fill, null)
  assert.equal(board.rows[0].rank, 1)
})

test('the swing column is the distance between a club’s best night and its worst', () => {
  const board = gateBoard(data, 2026, 'swing')
  assert.equal(board.rows[0].swing, 44000 - 30000)
})

// Its own fixture: in the three-row set above both clubs played exactly the
// same three games, so their averages are identical and a sort has nothing to
// order. A fourth game only one of them played is what makes the two ends
// distinguishable.
test('paceBoard can be sorted from either end of the clock', () => {
  const spread = [
    ...rows,
    toRow(
      game({
        gamePk: 4,
        officialDate: '2026-08-09',
        teams: { home: { team: { id: 112 } }, away: { team: { id: 143 } } },
        gameInfo: { attendance: 30000, gameDurationMinutes: 260 },
      }),
      null,
    ),
  ]
  const spreadData = { seasons: { 2026: buildSeason(spread) } }
  const slow = paceBoard(spreadData, 2026, 'avg')
  const quick = paceBoard(spreadData, 2026, 'avgFast')
  assert.equal(slow.rows[0].teamId, 143)
  assert.equal(quick.rows[0].teamId, 158)
  assert.equal(slow.rows[slow.rows.length - 1].teamId, 158)
})

test('asClock reads minutes the way baseball says them', () => {
  assert.equal(asClock(164), '2:44')
  assert.equal(asClock(120), '2:00')
  assert.equal(asClock(null), '—')
})

test('monthsIn reads the axis off the data rather than assuming a season shape', () => {
  const board = gateBoard(data, 2026, 'fill')
  assert.deepEqual(monthsIn(board.rows), ['06', '07', '08'])
})
