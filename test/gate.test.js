// The two halves of the gate/pace pipeline: what scripts/gen-gate.mjs reduces
// a schedule response down to, and what src/api/around-the-game/gate.js turns those
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
  paceMargin,
  asClock,
  capacityFor,
  latestSeason,
  monthsIn,
} from '../src/api/around-the-game/gate.js'

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
// THE DOUBLE-COUNT INVARIANT. Both clubs in a delayed game carry that game's
// delay in their own row, so the club column can never be summed into a league
// total — a page that did exactly that printed 243 hours of weather delay
// against a true 122, under a caption promising each game was counted once.
// This pins the relationship so the two can never drift apart silently.
test('every club carries its delays, so the club column is exactly twice the league total', () => {
  const clubs = aggregate(rows)
  const league = leagueFor(rows)
  const clubGames = Object.values(clubs).reduce((n, c) => n + (c.pace?.delays.games ?? 0), 0)
  const clubMinutes = Object.values(clubs).reduce((n, c) => n + (c.pace?.delays.minutes ?? 0), 0)
  assert.equal(league.delays.games, 1)
  assert.equal(league.delays.minutes, 30)
  assert.equal(clubGames, league.delays.games * 2)
  assert.equal(clubMinutes, league.delays.minutes * 2)
})

// The columns these feed are captioned "3:00+" and "3:30+". A game of exactly
// three hours belongs in the first of those to any reader reading the label.
test('the three-hour counts include a game of exactly three hours', () => {
  const exact = [
    toRow(game({ gamePk: 9, gameInfo: { attendance: 1, gameDurationMinutes: 180 } }), null),
    toRow(game({ gamePk: 10, gameInfo: { attendance: 1, gameDurationMinutes: 210 } }), null),
    toRow(game({ gamePk: 11, gameInfo: { attendance: 1, gameDurationMinutes: 179 } }), null),
  ]
  const clubs = aggregate(exact)
  assert.equal(clubs[158].pace.over180, 2)
  assert.equal(clubs[158].pace.over210, 1)
  assert.equal(leagueFor(exact).over180, 2)
})

// The per-game spread is the only thing that lets the page say how much of a
// club-to-club gap is real, so it has to actually ship.
test('the league line carries the per-game spread the margin is built from', () => {
  const league = leagueFor(rows)
  assert.ok(league.paceSd > 0)
  assert.equal(leagueFor([rows[0]]).paceSd, null)
})

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

// THE RANK AND THE NUMBER BESIDE IT MUST COME FROM THE SAME PLACE. The board
// sorts on the float and prints the minute; ranking on the float printed
// "T3 2:47 / T3 2:47 / T3 2:47 / 6 2:47" — three clubs tied and a fourth
// showing the identical clock denied the same tie.
test('two clubs whose printed clock is the same are ranked the same', () => {
  const near = {
    seasons: {
      2026: {
        through: '2026-06-12',
        league: { paceSd: 19, paceGames: 4 },
        clubs: {
          1: { pace: { games: 100, avg: 167.1, median: 167, over180: 0, over210: 0, byMonth: {} } },
          2: { pace: { games: 100, avg: 166.9, median: 167, over180: 0, over210: 0, byMonth: {} } },
          3: { pace: { games: 100, avg: 160.0, median: 160, over180: 0, over210: 0, byMonth: {} } },
        },
      },
    },
  }
  const board = paceBoard(near, 2026, 'avg')
  const [a, b] = board.rows
  assert.equal(asClock(a.avg), asClock(b.avg))
  assert.equal(a.rank, b.rank)
  assert.ok(a.tied && b.tied)
})

// A board with eighteen games a club apiece is a coin flip, and the page has
// to know that before it prints a 1-30 order over it.
test('the board reports whether it has enough games to be ranked at all', () => {
  const thin = {
    seasons: {
      2026: {
        through: '2026-04-15',
        league: { paceSd: 19.4 },
        clubs: {
          1: { pace: { games: 18, avg: 167, median: 167, over180: 0, over210: 0, byMonth: {} } },
          2: { pace: { games: 18, avg: 160, median: 160, over180: 0, over210: 0, byMonth: {} } },
        },
      },
    },
  }
  const early = paceBoard(thin, 2026, 'avg')
  assert.equal(early.rankable, false)
  // ±9 minutes on an 18-game sample, against a 7-minute gap: the whole board.
  assert.ok(early.margin > 8)

  // The same two clubs a full season in. Nothing about the gap changed; the
  // sample did, and that alone is what earns the board its numbers.
  const late = structuredClone(thin)
  for (const club of Object.values(late.seasons[2026].clubs)) club.pace.games = 125
  const full = paceBoard(late, 2026, 'avg')
  assert.equal(full.rankable, true)
  assert.ok(full.margin < early.margin)
})

test('paceMargin narrows as the season lengthens, and is null before it starts', () => {
  assert.ok(paceMargin(19.4, 18) > paceMargin(19.4, 125))
  assert.equal(paceMargin(19.4, 0), null)
  assert.equal(paceMargin(null, 125), null)
})

// The caption promises a club that has played more games is not penalised on
// the three-hour column, which is only true if the SHARE is what sorts it.
test('the three-hour sort ranks on the share, not the raw count', () => {
  const uneven = {
    seasons: {
      2026: {
        through: '2026-06-12',
        league: { paceSd: 19 },
        clubs: {
          // Fewer games, higher rate — must lead.
          1: { pace: { games: 50, avg: 165, median: 165, over180: 20, over210: 0, byMonth: {} } },
          2: { pace: { games: 125, avg: 165, median: 165, over180: 30, over210: 0, byMonth: {} } },
        },
      },
    },
  }
  const board = paceBoard(uneven, 2026, 'over180Pct')
  assert.equal(board.rows[0].teamId, 1)
  assert.equal(board.rows[0].over180Pct, 40)
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
