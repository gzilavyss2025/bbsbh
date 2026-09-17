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
  surfaceOf,
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

// THE POSITIONS HE PLAYED (#1002). The hitting game log carries
// `positionsPlayed`, ordered by when he played each one, and the row carries it
// through so the pinch-hit facet can read it. A pitcher's log does not have it,
// and a row that claimed ['LF'] for a pitcher would put him in the outfield.
test('a hitter row carries the positions he played, in order', () => {
  const rows = boxLineRows({
    splits: [
      {
        date: '2024-07-04',
        gameType: 'R',
        team: { id: 121 },
        opponent: { id: 158 },
        game: { gamePk: 1, gameNumber: 1 },
        positionsPlayed: [{ code: '11', abbreviation: 'PH' }, { code: '7', abbreviation: 'LF' }],
        stat: { hits: 1, atBats: 2 },
      },
    ],
    schedule: [sched(1, '2024-07-04')],
    group: 'hitting',
  })
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].positions, ['PH', 'LF'])
  // And `started` stays null: the hitting log has no gamesStarted, and a
  // position list is not one.
  assert.equal(rows[0].started, null)
})

test('a hitter row with no positions is an empty list, never null or a crash', () => {
  // MiLB feeds drop fields MLB's carry (src/CLAUDE.md's degradation rule), and
  // a null here would throw in the facet rather than keep nothing.
  const rows = boxLineRows({
    splits: [
      {
        date: '2024-07-04',
        gameType: 'R',
        team: { id: 121 },
        opponent: { id: 158 },
        game: { gamePk: 1, gameNumber: 1 },
        stat: { hits: 1, atBats: 2 },
      },
    ],
    schedule: [sched(1, '2024-07-04')],
    group: 'hitting',
  })
  assert.deepEqual(rows[0].positions, [])
})

test('a pitcher row carries no positions at all', () => {
  const rows = boxLineRows({
    splits: [split('2024-07-04', 1)],
    schedule: [sched(1, '2024-07-04')],
    group: 'pitching',
  })
  assert.equal(rows[0].positions, null)
})

test('the pinch-hit facet cannot resurrect a game the gate dropped', () => {
  // The same invariant the other facets are held to, for the one facet whose
  // rows MLB publishes no list of. A pinch-hit appearance in a game on the
  // cutoff day is still a game on the cutoff day.
  const hitterSplit = (date, gamePk) => ({
    date,
    gameType: 'R',
    team: { id: 121 },
    opponent: { id: 158 },
    game: { gamePk, gameNumber: 1 },
    positionsPlayed: [{ abbreviation: 'PH' }],
    stat: { hits: 1, atBats: 1 },
  })
  const rows = boxLineRows({
    splits: [hitterSplit('2024-09-28', 1), hitterSplit('2024-09-29', 2)],
    schedule: [sched(1, '2024-09-28'), sched(2, '2024-09-29')],
    group: 'hitting',
    cutoff: CUTOFF,
    keep: (r) => r.positions?.[0] === 'PH',
  })
  assert.deepEqual(
    rows.map((r) => r.gamePk),
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
  // scoreless rows. Every row in this sheet is a game the player played and a
  // score he can be shown, so the gate requires the score itself, not the word
  // Final.
  //
  // Those three were in fact PLAYED, under a schedule row MLB left stuck
  // (#1031, re-checked 2026-09-15) — which is why the score may be recovered
  // from the game's own linescore. That is `recoveredScores`, and it is pinned
  // in test/boxlines-score-recovery.test.js. Without one, as here, the gate is
  // closed and the row does not exist.
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

test('the row carries the park surface the schedule reported for that game', () => {
  // Read off the game, never off a table of parks: the schedule's fieldInfo is
  // season-correct, so a park that was relaid mid-career reads grass before
  // and turf after. A static map of today's surfaces would call every game at
  // Chase Field before 2019 turf.
  const rows = boxLineRows({
    splits: [split('2024-07-04', 1), split('2024-07-05', 2), split('2024-07-06', 3)],
    schedule: [
      sched(1, '2024-07-04', { venue: { id: 15, name: 'Chase Field', fieldInfo: { turfType: 'Grass' } } }),
      sched(2, '2024-07-05', {
        venue: { id: 15, name: 'Chase Field', fieldInfo: { turfType: 'Artificial Turf' } },
      }),
      sched(3, '2024-07-06', { venue: { id: 15, name: 'Chase Field' } }),
    ],
    group: 'pitching',
  })
  assert.deepEqual(
    rows.map((r) => r.surface),
    ['', 'turf', 'grass'],
  )
})

test('grass and turf are the only two answers, and "" means nobody said', () => {
  assert.equal(surfaceOf('Grass'), 'grass')
  assert.equal(surfaceOf('Artificial Turf'), 'turf')
  // A spelling nobody predicted is turf rather than nothing: every park that
  // is not grass is some kind of artificial surface, so an unknown name lands
  // on the right side instead of vanishing from both doors.
  assert.equal(surfaceOf('AstroTurf'), 'turf')
  assert.equal(surfaceOf('Synthetic'), 'turf')
  assert.equal(surfaceOf(''), '')
  assert.equal(surfaceOf(null), '')
  assert.equal(surfaceOf(undefined), '')
})

test('lineupStart is null unless the caller handed over the lineups', () => {
  // The second pass costs a request, so most sheets never make it. A row from
  // a sheet that did not ask must say "unknown", not "he came off the bench".
  const rows = boxLineRows({
    splits: [split('2024-07-04', 1)],
    schedule: [sched(1, '2024-07-04')],
    group: 'hitting',
  })
  assert.equal(rows[0].lineupStart, null)
})

test('lineupStart follows the map, and a game the map never saw stays null', () => {
  // `has` rather than `get`: a game with no lineup posted is absent from the
  // map, and absent must not read as false. This is the whole reason the map
  // is a Map and not a Set of the games he started.
  const rows = boxLineRows({
    splits: [split('2024-07-04', 1), split('2024-07-05', 2), split('2024-07-06', 3)],
    schedule: [sched(1, '2024-07-04'), sched(2, '2024-07-05'), sched(3, '2024-07-06')],
    group: 'hitting',
    // The map speaks in SLOTS now (#1048): 1 through 9, or 0 for "played, did
    // not start". `lineupStart` is derived from it and its three answers are
    // unchanged.
    lineupSlots: new Map([
      [1, 1],
      [2, 0],
    ]),
  })
  assert.deepEqual(
    rows.map((r) => ({ pk: r.gamePk, start: r.lineupStart })),
    [
      { pk: 3, start: null },
      { pk: 2, start: false },
      { pk: 1, start: true },
    ],
  )
})

test('the gate still runs first: a lineup start on the cutoff day has no row', () => {
  // The invariant the whole feature rests on, re-pinned for the two facets
  // that arrived with a fetch of their own. A facet may narrow; it may never
  // reach around the cutoff, and a second pass over the same gamePks cannot
  // introduce a game the splits did not already name.
  const rows = boxLineRows({
    splits: [split('2024-07-04', 1), split('2024-07-05', 2)],
    schedule: [sched(1, '2024-07-04'), sched(2, '2024-07-05')],
    group: 'hitting',
    cutoff: '2024-07-05',
    lineupSlots: new Map([
      [1, 4],
      [2, 4],
    ]),
    keep: (r) => r.lineupStart === true,
  })
  assert.deepEqual(
    rows.map((r) => r.gamePk),
    [1],
  )
})

// THE SLOT HE BATTED IN (#1048), and the two fields that come off one map.
// `lineupSlots` is a Map gamePk -> his 1-based slot, or 0 for "played, did not
// start". It replaced a Map of booleans: the lineup arrays were already in
// batting order, so the same pass answers both questions for no extra bytes.
test('lineupSpot is the slot, and lineupStart is derived from the same map', () => {
  const rows = boxLineRows({
    splits: [split('2024-07-04', 1), split('2024-07-05', 2), split('2024-07-06', 3)],
    schedule: [sched(1, '2024-07-04'), sched(2, '2024-07-05'), sched(3, '2024-07-06')],
    group: 'hitting',
    lineupSlots: new Map([
      [1, 3],
      [2, 0],
    ]),
  })
  assert.deepEqual(
    rows.map((r) => ({ pk: r.gamePk, spot: r.lineupSpot, start: r.lineupStart })),
    [
      // Absent from the map: nobody posted a card. Neither question is
      // answered, and null is not "he came off the bench".
      { pk: 3, spot: null, start: null },
      // 0: he played and did not start. He batted in no SLOT, so the spot is
      // null — a bench appearance is not a tenth place in the order.
      { pk: 2, spot: null, start: false },
      { pk: 1, spot: 3, start: true },
    ],
  )
})

test('every slot from one to nine lands on the row as itself', () => {
  const pks = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const rows = boxLineRows({
    splits: pks.map((pk) => split(`2024-07-0${pk}`, pk)),
    schedule: pks.map((pk) => sched(pk, `2024-07-0${pk}`)),
    group: 'hitting',
    lineupSlots: new Map(pks.map((pk) => [pk, pk])),
  })
  assert.deepEqual(
    rows.map((r) => r.lineupSpot).sort((a, b) => a - b),
    pks,
  )
  assert.equal(
    rows.every((r) => r.lineupStart === true),
    true,
  )
})

test('the gate still runs first: a slot on the cutoff day has no row', () => {
  // The same invariant the lineup doors re-pinned. A list folds rows; it can
  // only ever fold rows the gate already approved.
  const rows = boxLineRows({
    splits: [split('2024-07-04', 1), split('2024-07-05', 2)],
    schedule: [sched(1, '2024-07-04'), sched(2, '2024-07-05')],
    group: 'hitting',
    cutoff: '2024-07-05',
    lineupSlots: new Map([
      [1, 2],
      [2, 2],
    ]),
    keep: (r) => r.lineupSpot === 2,
  })
  assert.deepEqual(
    rows.map((r) => r.gamePk),
    [1],
  )
})

// THE RAW COUNTING STATS A LIST FOLDS (#1048). `line` is a formatted string,
// so a list that wanted "his line at each slot" had nothing to add up. The row
// carries the smallest subset that folds the two figures a list prints — and
// every field is already in LOG_FIELDS, so it costs no bytes.
test('a hitter row carries the at-bats and hits a list folds into an average', () => {
  const rows = boxLineRows({
    splits: [
      split('2024-07-04', 1, { stat: { atBats: 4, hits: 2, homeRuns: 1, rbi: 3 } }),
    ],
    schedule: [sched(1, '2024-07-04')],
    group: 'hitting',
  })
  assert.deepEqual(rows[0].counts, { atBats: 4, hits: 2 })
})

test('a pitcher row carries OUTS, because innings are thirds and do not add', () => {
  // "6.1" is six innings and one out, not six and a tenth. Summing the strings
  // as numbers is the bug this field exists to make impossible: the row stores
  // MLB's own out count and a fold adds integers.
  const rows = boxLineRows({
    splits: [
      split('2024-07-04', 1, { stat: { inningsPitched: '6.1', earnedRuns: 2 } }),
      split('2024-07-05', 2, { stat: { inningsPitched: '7.0', earnedRuns: 0 } }),
      split('2024-07-06', 3, { stat: { inningsPitched: '0.2', earnedRuns: 1 } }),
    ],
    schedule: [sched(1, '2024-07-04'), sched(2, '2024-07-05'), sched(3, '2024-07-06')],
    group: 'pitching',
  })
  assert.deepEqual(
    rows.map((r) => ({ pk: r.gamePk, outs: r.counts.outs, er: r.counts.earnedRuns })),
    [
      { pk: 3, outs: 2, er: 1 },
      { pk: 2, outs: 21, er: 0 },
      { pk: 1, outs: 19, er: 2 },
    ],
  )
})
