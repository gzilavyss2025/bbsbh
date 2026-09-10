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
import {
  askableGameTypes,
  boxLineRows,
  dayBefore,
  logRequestPlan,
  matchingSplits,
  POSTSEASON,
  seriesAbbr,
} from '../src/api/boxlines/rows.js'

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

// ---------------------------------------------------------------------------
// THE FACET LAYER (#997). A facet narrows; it must never widen. Everything
// below pins that `keep` runs AFTER the cutoff and Final checks, so no facet
// — present or future — can reach around the gate the sheet rests on.

test('keep cannot resurrect a row the CUTOFF dropped', () => {
  // Two games: one before the cutoff, one on it. A `keep` that says yes to
  // everything must still not bring the on-cutoff game back.
  const rows = boxLineRows({
    splits: [split('2024-09-20', 1), split(CUTOFF, 2)],
    schedule: [sched(1, '2024-09-20'), sched(2, CUTOFF)],
    group: 'pitching',
    cutoff: CUTOFF,
    keep: () => true,
  })
  assert.deepEqual(
    rows.map((r) => r.gamePk),
    [1],
  )
})

test('keep cannot resurrect a row the FINAL check dropped', () => {
  const rows = boxLineRows({
    splits: [split('2024-09-20', 1), split('2024-09-21', 2)],
    schedule: [
      sched(1, '2024-09-20'),
      sched(2, '2024-09-21', { status: { abstractGameState: 'Live' } }),
    ],
    group: 'pitching',
    cutoff: CUTOFF,
    keep: () => true,
  })
  assert.deepEqual(
    rows.map((r) => r.gamePk),
    [1],
  )
})

test('keep narrows the rows that DID pass the gate', () => {
  const rows = boxLineRows({
    splits: [split('2024-09-20', 1), split('2024-09-21', 2)],
    schedule: [sched(1, '2024-09-20'), sched(2, '2024-09-21')],
    group: 'pitching',
    cutoff: CUTOFF,
    keep: (r) => r.gamePk === 2,
  })
  assert.deepEqual(
    rows.map((r) => r.gamePk),
    [2],
  )
})

test('the default is regular season only, and a facet may widen the GAME TYPES only by asking', () => {
  const splits = [split('2024-09-20', 1), split('2024-10-05', 2, { gameType: 'D' })]
  const schedule = [sched(1, '2024-09-20'), sched(2, '2024-10-05')]
  // Default: the postseason split produces no row at all.
  const regular = boxLineRows({ splits, schedule, group: 'pitching' })
  assert.deepEqual(
    regular.map((r) => r.gamePk),
    [1],
  )
  assert.equal(regular[0].gameType, 'R')
  // Asked for: both. The gate is unchanged — this widens the QUESTION, not the
  // cutoff, and a cutoff still applies to whatever it lets through.
  const withPost = boxLineRows({ splits, schedule, group: 'pitching', gameTypes: ['R', 'D'] })
  assert.deepEqual(
    withPost.map((r) => r.gamePk),
    [2, 1],
  )
  const gated = boxLineRows({
    splits,
    schedule,
    group: 'pitching',
    gameTypes: ['R', 'D'],
    cutoff: '2024-10-01',
  })
  assert.deepEqual(
    gated.map((r) => r.gamePk),
    [1],
  )
})

test('matchingSplits keeps the asked-for game types and no others', () => {
  const splits = [
    split('2024-09-20', 1),
    split('2024-10-05', 2, { gameType: 'D' }),
    split('2024-03-01', 3, { gameType: 'S' }),
  ]
  assert.deepEqual(matchingSplits(splits).map((s) => s.game.gamePk), [1])
  assert.deepEqual(
    matchingSplits(splits, { gameTypes: ['R', 'D'] }).map((s) => s.game.gamePk),
    [1, 2],
  )
  // An empty list is not "everything": it falls back to the regular season.
  assert.deepEqual(matchingSplits(splits, { gameTypes: [] }).map((s) => s.game.gamePk), [1])
})

test('a POSTPONED game produces no row, though the schedule calls it Final', () => {
  // Verified live 2026-09-02: a postponed game reports
  // `abstractGameState: 'Final'` with `detailedState: 'Postponed'` and NO
  // scores — gamePks 776691, 777459 and 632997 all reached Yelich's sheet as
  // scoreless rows for games that were never played. Every row in this sheet
  // is a game the player played and a score he can be shown, so the gate
  // requires the score itself, not the word Final.
  const rows = boxLineRows({
    splits: [split('2024-09-20', 1), split('2024-09-21', 2)],
    schedule: [
      sched(1, '2024-09-20'),
      {
        gamePk: 2,
        officialDate: '2024-09-21',
        gameNumber: 1,
        dayNight: 'day',
        status: { abstractGameState: 'Final', detailedState: 'Postponed' },
        venue: { id: 32, name: 'American Family Field' },
        teams: {
          away: { team: { id: 121, abbreviation: 'NYM' } },
          home: { team: { id: 158, abbreviation: 'MIL' } },
        },
      },
    ],
    group: 'pitching',
    cutoff: CUTOFF,
  })
  assert.deepEqual(
    rows.map((r) => r.gamePk),
    [1],
  )
})

test('a row with only one side of the score is dropped too', () => {
  const g = sched(2, '2024-09-21')
  delete g.teams.home.score
  const rows = boxLineRows({
    splits: [split('2024-09-21', 2)],
    schedule: [g],
    group: 'pitching',
    cutoff: CUTOFF,
  })
  assert.equal(rows.length, 0)
})

// ---------------------------------------------------------------------------
// The postseason facet (#1006). Its rows are the only ones on the card that are
// not regular season, and the game type they carry is both the filter and the
// pill — which is why the umbrella 'P' is a trap rather than a synonym.
// ---------------------------------------------------------------------------

test('seriesAbbr names the round, and a regular-season row has no pill', () => {
  assert.equal(seriesAbbr('F'), 'WC')
  assert.equal(seriesAbbr('D'), 'DS')
  assert.equal(seriesAbbr('L'), 'LCS')
  assert.equal(seriesAbbr('W'), 'WS')
  // Not a round: no pill, rather than a confident wrong one.
  assert.equal(seriesAbbr('R'), '')
  assert.equal(seriesAbbr('S'), '')
  assert.equal(seriesAbbr('A'), '')
  // 'P' is deliberately unnamed — a row still carrying it came from a call that
  // asked the wrong question, and a blank pill is the visible end of that.
  assert.equal(seriesAbbr('P'), '')
  assert.equal(seriesAbbr(undefined), '')
})

test('a split from each round is kept under the postseason facet and dropped under the default', () => {
  const splits = [
    split('2024-09-20', 1),
    split('2024-10-01', 2, { gameType: 'F' }),
    split('2024-10-05', 3, { gameType: 'D' }),
    split('2024-10-14', 4, { gameType: 'L' }),
    split('2024-10-26', 5, { gameType: 'W' }),
  ]
  const schedule = [
    sched(1, '2024-09-20'),
    sched(2, '2024-10-01'),
    sched(3, '2024-10-05'),
    sched(4, '2024-10-14'),
    sched(5, '2024-10-26'),
  ]
  // The default keeps the regular-season game and none of the four rounds.
  assert.deepEqual(boxLineRows({ splits, schedule, group: 'pitching' }).map((r) => r.gamePk), [1])
  // The postseason facet keeps the four rounds and not the regular-season game.
  const post = boxLineRows({ splits, schedule, group: 'pitching', gameTypes: POSTSEASON })
  assert.deepEqual(
    post.map((r) => r.gamePk),
    [5, 4, 3, 2],
  )
  // Newest first, each wearing its own round.
  assert.deepEqual(
    post.map((r) => r.series),
    ['WS', 'LCS', 'DS', 'WC'],
  )
})

test("a split still tagged 'P' is dropped by BOTH the default and the postseason facet", () => {
  // A pitching game log asked with `gameType=P` returns the right games and
  // labels every one of them 'P' (verified 2026-09-10 on 660271). Nothing
  // downstream can name that row's round, so nothing downstream shows it.
  const splits = [split('2024-10-05', 9, { gameType: 'P' })]
  const schedule = [sched(9, '2024-10-05')]
  assert.deepEqual(boxLineRows({ splits, schedule, group: 'pitching' }), [])
  assert.deepEqual(boxLineRows({ splits, schedule, group: 'pitching', gameTypes: POSTSEASON }), [])
})

test("askableGameTypes rewrites the umbrella 'P' to the four rounds, and leaves everything else alone", () => {
  assert.deepEqual(askableGameTypes(['P']), ['F', 'D', 'L', 'W'])
  // Already spelled out: unchanged, and not duplicated when both are asked.
  assert.deepEqual(askableGameTypes(POSTSEASON), ['F', 'D', 'L', 'W'])
  assert.deepEqual(askableGameTypes(['P', 'D']), ['F', 'D', 'L', 'W'])
  assert.deepEqual(askableGameTypes(['R']), ['R'])
  assert.deepEqual(askableGameTypes(['R', 'P']), ['R', 'F', 'D', 'L', 'W'])
  // Empty is not "everything": the regular season, as everywhere else.
  assert.deepEqual(askableGameTypes([]), ['R'])
  assert.deepEqual(askableGameTypes(undefined), ['R'])
})

test('the cutoff gate applies to a postseason row exactly as it does to any other', () => {
  const splits = [split('2024-10-05', 3, { gameType: 'D' }), split('2024-10-14', 4, { gameType: 'L' })]
  const schedule = [sched(3, '2024-10-05'), sched(4, '2024-10-14')]
  // The October being scored is out; the one before it is in.
  const rows = boxLineRows({ splits, schedule, group: 'pitching', gameTypes: POSTSEASON, cutoff: '2024-10-14' })
  assert.deepEqual(
    rows.map((r) => r.gamePk),
    [3],
  )
  // And a postseason game the schedule has not finished has no row either.
  const live = boxLineRows({
    splits,
    schedule: [sched(3, '2024-10-05', { status: { abstractGameState: 'Live' } }), sched(4, '2024-10-14')],
    group: 'pitching',
    gameTypes: POSTSEASON,
  })
  assert.deepEqual(
    live.map((r) => r.gamePk),
    [4],
  )
})
