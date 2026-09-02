// The Box Lines cutoff gate (src/api/boxlines/rows.js, ADR-0069): the
// game-by-game rows behind a "Career vs MIL" line, opened from the lineup page
// — a SCORING surface. A row carries a final score, so a row for a game on or
// after the day being scored must not exist at all. This pins:
//   • date == cutoff (a same-day doubleheader game 1) is out, date > cutoff is
//     out, date < cutoff is in;
//   • a game the schedule does not report Final produces no row, cutoff or not;
//   • the cutoff season's game log is requested only through the day BEFORE
//     the cutoff, and later seasons are not requested at all;
//   • the row shape the sheet renders (newest first, his club's runs first,
//     the box-score path from the schedule join).
import assert from 'node:assert/strict'
import test from 'node:test'
import { boxLineRows, dayBefore, logRequestPlan } from '../src/api/boxlines/rows.js'

// A pitching game-log split as statsapi returns it (trimmed to the fields the
// module reads; shape verified live on personId 656849, 2026-09-02).
function split(date, gamePk, extra = {}) {
  return {
    date,
    gameType: 'R',
    isHome: false,
    isWin: true,
    team: { id: 121, name: 'New York Mets' },
    opponent: { id: 158, name: 'Milwaukee Brewers' },
    game: { gamePk, gameNumber: 1, dayNight: 'day' },
    stat: {
      gamesStarted: 1,
      inningsPitched: '7.0',
      hits: 1,
      runs: 0,
      earnedRuns: 0,
      strikeOuts: 8,
      baseOnBalls: 3,
    },
    ...extra,
  }
}

// The matching schedule record (`/api/v1/schedule?gamePks=...&hydrate=team`).
function sched(gamePk, officialDate, extra = {}) {
  return {
    gamePk,
    officialDate,
    gameNumber: 1,
    dayNight: 'day',
    status: { abstractGameState: 'Final' },
    venue: { id: 32, name: 'American Family Field' },
    teams: {
      away: { score: 5, team: { id: 121, abbreviation: 'NYM' } },
      home: { score: 0, team: { id: 158, abbreviation: 'MIL' } },
    },
    ...extra,
  }
}

const CUTOFF = '2024-09-29'

test('a game dated ON the cutoff produces no row (a same-day game 1 included)', () => {
  const rows = boxLineRows({
    splits: [split('2024-09-29', 745932)],
    schedule: [sched(745932, '2024-09-29')],
    group: 'pitching',
    cutoff: CUTOFF,
  })
  assert.deepEqual(rows, [])
})

test('a game dated AFTER the cutoff produces no row', () => {
  const rows = boxLineRows({
    splits: [split('2025-07-03', 777257)],
    schedule: [sched(777257, '2025-07-03')],
    group: 'pitching',
    cutoff: CUTOFF,
  })
  assert.deepEqual(rows, [])
})

test('a game before the cutoff is a row', () => {
  const rows = boxLineRows({
    splits: [split('2024-09-20', 745800)],
    schedule: [sched(745800, '2024-09-20')],
    group: 'pitching',
    cutoff: CUTOFF,
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].date, '2024-09-20')
})

test('a game the schedule does not report Final produces no row, with or without a cutoff', () => {
  const live = sched(745800, '2024-09-20', { status: { abstractGameState: 'Live' } })
  for (const cutoff of [CUTOFF, null]) {
    const rows = boxLineRows({
      splits: [split('2024-09-20', 745800)],
      schedule: [live],
      group: 'pitching',
      cutoff,
    })
    assert.deepEqual(rows, [], `cutoff=${cutoff}`)
  }
})

test('a game with no schedule record produces no row', () => {
  const rows = boxLineRows({
    splits: [split('2024-09-20', 745800)],
    schedule: [],
    group: 'pitching',
    cutoff: null,
  })
  assert.deepEqual(rows, [])
})

test('a postseason game is not a regular-season row', () => {
  const rows = boxLineRows({
    splits: [split('2024-10-02', 775200, { gameType: 'F' })],
    schedule: [sched(775200, '2024-10-02')],
    group: 'pitching',
    cutoff: null,
  })
  assert.deepEqual(rows, [])
})

test('rows come newest first, his club first in the score, linked to the box score', () => {
  const rows = boxLineRows({
    splits: [split('2024-09-20', 745800), split('2024-09-29', 745932)],
    schedule: [sched(745800, '2024-09-20'), sched(745932, '2024-09-29')],
    group: 'pitching',
    cutoff: null,
  })
  assert.deepEqual(
    rows.map((r) => r.date),
    ['2024-09-29', '2024-09-20'],
  )
  const r = rows[0]
  assert.equal(r.season, 2024)
  assert.equal(r.gamePk, 745932)
  assert.equal(r.home, false)
  assert.equal(r.teamId, 121)
  assert.equal(r.teamAbbr, 'NYM')
  assert.equal(r.opponentAbbr, 'MIL')
  assert.equal(r.started, true)
  assert.equal(r.runs, 5)
  assert.equal(r.oppRuns, 0)
  assert.equal(r.won, true)
  assert.equal(r.venueName, 'American Family Field')
  assert.equal(r.dayNight, 'day')
  assert.equal(r.boxScorePath, '/09292024/nymmil/boxscore')
  assert.match(r.line, /^GS, 7\.0.IP, 1.H, 0.R, 0.ER, 3.BB, 8.K$/)
})

test('a hitter row carries the hitter chyron', () => {
  const s = split('2026-05-18', 824680, {
    team: { id: 158, name: 'Milwaukee Brewers' },
    opponent: { id: 112, name: 'Chicago Cubs' },
    stat: { hits: 2, atBats: 4, doubles: 0, triples: 0, homeRuns: 1, rbi: 2, baseOnBalls: 0, stolenBases: 0, strikeOuts: 1 },
  })
  const g = sched(824680, '2026-05-18', {
    teams: {
      away: { score: 9, team: { id: 158, abbreviation: 'MIL' } },
      home: { score: 3, team: { id: 112, abbreviation: 'CHC' } },
    },
  })
  const rows = boxLineRows({ splits: [s], schedule: [g], group: 'hitting', cutoff: null })
  assert.equal(rows.length, 1)
  assert.match(rows[0].line, /^2-4, HR, 2.RBI, K$/)
  assert.equal(rows[0].runs, 9)
  assert.equal(rows[0].oppRuns, 3)
  assert.equal(rows[0].started, null)
})

test('dayBefore steps back one calendar day across a month boundary', () => {
  assert.equal(dayBefore('2024-09-29'), '2024-09-28')
  assert.equal(dayBefore('2026-03-01'), '2026-02-28')
  assert.equal(dayBefore('2026-01-01'), '2025-12-31')
})

test('the request plan asks for the cutoff season only through the day before, and never a later season', () => {
  const plan = logRequestPlan([2022, 2023, 2024, 2025, 2026], CUTOFF)
  assert.deepEqual(plan, [
    { season: 2022, endDate: null },
    { season: 2023, endDate: null },
    { season: 2024, endDate: '2024-09-28' },
  ])
})

test('the request plan on a January 1 cutoff drops that season entirely', () => {
  // endDate would land in the prior year; a season with nothing before its
  // cutoff day costs no request.
  assert.deepEqual(logRequestPlan([2025, 2026], '2026-01-01'), [{ season: 2025, endDate: null }])
})

test('without a cutoff every season is requested whole', () => {
  assert.deepEqual(logRequestPlan([2025, 2026], null), [
    { season: 2025, endDate: null },
    { season: 2026, endDate: null },
  ])
})
