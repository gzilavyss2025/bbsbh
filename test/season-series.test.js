import assert from 'node:assert/strict'
import test from 'node:test'
import { centeredScrollLeft, seasonSeriesCells, seasonSeriesRecord } from '../src/api/seasonSeries.js'
import { extraInningsOf, regulationInnings } from '../src/api/select.js'

const NYM = 121
const MIL = 158

test('seasonSeriesCells: winner/loser and score ordering for a finished game', () => {
  const games = [
    { gamePk: 1, apiDate: '2026-07-20', gameDate: '2026-07-20T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 3, homeScore: 8 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, /* currentGamePk */ 2)
  assert.equal(cell.final, true)
  assert.equal(cell.winnerId, MIL)
  assert.equal(cell.winnerScore, 8)
  assert.equal(cell.loserScore, 3)
  assert.equal(cell.loserAbbr, 'NYM')
  assert.equal(cell.isHome, true)
  assert.equal(cell.opponentAbbr, 'NYM')
  assert.equal(cell.extraInnings, null)
})

test('seasonSeriesCells: a completed game that ran past 9 flags its inning count', () => {
  const games = [
    { gamePk: 5, apiDate: '2026-07-19', gameDate: '2026-07-19T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 6, homeScore: 5, innings: 11 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, 2)
  assert.equal(cell.extraInnings, 11)
})

test('seasonSeriesCells: a regulation 9-inning final has no extra-innings flag', () => {
  const games = [
    { gamePk: 6, apiDate: '2026-07-18', gameDate: '2026-07-18T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 6, homeScore: 5, innings: 9 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, 2)
  assert.equal(cell.extraInnings, null)
})

test('seasonSeriesCells: the currently-viewed game never carries a score, even if the feed marks it Final', () => {
  const games = [
    { gamePk: 2, apiDate: '2026-07-21', gameDate: '2026-07-21T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 5, homeScore: 1 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, /* currentGamePk */ 2)
  assert.equal(cell.isCurrent, true)
  assert.equal(cell.final, false)
  assert.equal(cell.winnerId, null)
  assert.equal(cell.winnerScore, null)
  assert.equal(cell.loserScore, null)
})

test('seasonSeriesCells: a not-yet-played game carries no score or winner, and passes its venue tz through', () => {
  const games = [
    { gamePk: 3, apiDate: '2026-08-25', gameDate: '2026-08-25T23:10:00Z', gameNumber: 1, awayId: MIL, homeId: NYM, final: false, awayScore: null, homeScore: null, tzId: 'America/New_York' },
  ]
  const [cell] = seasonSeriesCells(games, MIL, /* currentGamePk */ 2)
  assert.equal(cell.final, false)
  assert.equal(cell.winnerId, null)
  assert.equal(cell.isHome, false)
  assert.equal(cell.opponentAbbr, 'NYM')
  assert.equal(cell.tzId, 'America/New_York')
})

test('seasonSeriesCells: degrades to no winner on a tied/incomplete score pair', () => {
  const games = [
    { gamePk: 4, apiDate: '2026-06-01', gameDate: '2026-06-01T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: null, homeScore: 4 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, 2)
  assert.equal(cell.winnerId, null)
  assert.equal(cell.winnerScore, null)
  assert.equal(cell.loserAbbr, null)
  assert.equal(cell.hasScore, false)
})

test('seasonSeriesCells: a genuine tie (equal scores) is final with no winner, flagged hasScore false', () => {
  const games = [
    { gamePk: 7, apiDate: '2026-05-15', gameDate: '2026-05-15T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 4, homeScore: 4 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, 2)
  assert.equal(cell.final, true)
  assert.equal(cell.hasScore, false)
  assert.equal(cell.winnerId, null)
  assert.equal(cell.winnerScore, null)
  assert.equal(cell.loserAbbr, null)
})

test('seasonSeriesCells: a seven-inning game that went to eight is flagged as extras', () => {
  const [cell] = seasonSeriesCells(
    [{ gamePk: 7, apiDate: '2026-05-06', gameDate: '2026-05-06T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 3, homeScore: 2, innings: 8, scheduledInnings: 7 }],
    MIL,
    999,
  )
  assert.equal(cell.extraInnings, 8)
})

test('seasonSeriesCells: a seven-inning game that ended in seven has no flag', () => {
  const [cell] = seasonSeriesCells(
    [{ gamePk: 8, apiDate: '2026-05-06', gameDate: '2026-05-06T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 3, homeScore: 2, innings: 7, scheduledInnings: 7 }],
    MIL,
    999,
  )
  assert.equal(cell.extraInnings, null)
})

test('extraInningsOf: falls back to nine when scheduledInnings is missing', () => {
  assert.equal(extraInningsOf(9, null), null)
  assert.equal(extraInningsOf(10, undefined), 10)
  assert.equal(extraInningsOf(8, 7), 8)
})

test('extraInningsOf: a bad inning count is null, never a falsy value JSX would print', () => {
  // Review of #1295: `{cell.extraInnings && …}` rendered a stray "0".
  assert.equal(extraInningsOf(0, 7), null)
  assert.equal(extraInningsOf(undefined, 9), null)
  assert.equal(extraInningsOf(null, 9), null)
})

test("regulationInnings: the game's own length, else nine", () => {
  assert.equal(regulationInnings(7), 7)
  assert.equal(regulationInnings(9), 9)
  assert.equal(regulationInnings(null), 9)
  assert.equal(regulationInnings(undefined), 9)
  assert.equal(regulationInnings(0), 9)
})

const post = (gamePk, gameType, seriesGameNumber, awayScore, homeScore, extra = {}) => ({
  gamePk, apiDate: '2026-10-0' + seriesGameNumber, gameDate: '2026-10-0' + seriesGameNumber + 'T23:10:00Z', gameNumber: 1,
  awayId: NYM, homeId: MIL, final: true, awayScore, homeScore, gameType, seriesGameNumber, ...extra,
})

test('seasonSeriesCells: a postseason game carries its round tag and series game number', () => {
  const games = [post(10, 'F', 1, 2, 3), post(11, 'D', 2, 4, 1), post(12, 'L', 3, 0, 1), post(13, 'W', 4, 5, 6)]
  const cells = seasonSeriesCells(games, MIL, 99)
  assert.deepEqual(cells.map((c) => c.round), ['WC', 'DS', 'LCS', 'WS'])
  assert.deepEqual(cells.map((c) => c.seriesGame), [1, 2, 3, 4])
})

test('seasonSeriesCells: a regular-season game (or a row with no game type) has no round tag', () => {
  const games = [post(14, 'R', 1, 2, 3), { gamePk: 15, apiDate: '2026-07-01', gameNumber: 1, awayId: NYM, homeId: MIL, final: false }]
  for (const c of seasonSeriesCells(games, MIL, 99)) {
    assert.equal(c.round, null)
    assert.equal(c.seriesGame, null)
  }
})

test('seasonSeriesCells: the viewed postseason game is still sealed', () => {
  const [cell] = seasonSeriesCells([post(16, 'D', 2, 9, 0)], MIL, 16)
  assert.equal(cell.round, 'DS')
  assert.equal(cell.final, false)
  assert.equal(cell.winnerScore, null)
})

test('seasonSeriesRecord: postseason games stay out of the season record', () => {
  const games = [post(17, 'R', 1, 2, 3), post(18, 'R', 2, 1, 4), post(19, 'D', 1, 7, 0), post(20, 'D', 2, 8, 1)]
  const cells = seasonSeriesCells(games, MIL, 99)
  assert.deepEqual(seasonSeriesRecord(cells, MIL, NYM), { aWins: 2, bWins: 0 })
})

// A replayed postseason page must not tell you how the series ended: every game
// AFTER the viewed one is sealed, the way the viewed game is.
const series = () => [
  post(30, 'W', 1, 1, 4), post(31, 'W', 2, 3, 5), post(32, 'W', 3, 6, 2),
  post(33, 'W', 4, 2, 7, { innings: 11 }), post(34, 'W', 5, 0, 1),
]

// The same five games as regular-season rows: those later cells are still
// drawn, so they must be sealed.
const regularSeries = () => series().map((g) => ({ ...g, gameType: 'R', seriesGameNumber: null }))

test('seasonSeriesCells: games after the viewed game are sealed, games before keep their score', () => {
  const cells = seasonSeriesCells(regularSeries(), MIL, 32)
  const [g1, g2, g3, g4, g5] = cells
  for (const c of [g1, g2]) {
    assert.equal(c.final, true)
    assert.equal(c.hasScore, true)
  }
  assert.equal(g1.winnerId, MIL)
  assert.equal(g1.winnerScore, 4)
  assert.equal(g3.isCurrent, true)
  assert.equal(g3.final, false)
  for (const c of [g4, g5]) {
    assert.equal(c.isCurrent, false)
    assert.equal(c.final, false)
    assert.equal(c.hasScore, false)
    assert.equal(c.winnerId, null)
    assert.equal(c.winnerAbbr, null)
    assert.equal(c.winnerScore, null)
    assert.equal(c.loserScore, null)
    assert.equal(c.extraInnings, null)
  }
})

test('seasonSeriesCells: a postseason page keeps the games before it with their round tag and score', () => {
  const [g1, g2, g3] = seasonSeriesCells(series(), MIL, 32)
  assert.equal(g1.round, 'WS')
  assert.equal(g2.seriesGame, 2)
  for (const c of [g1, g2]) assert.equal(c.hasScore, true)
  assert.equal(g3.isCurrent, true)
  assert.equal(g3.final, false)
})

test('seasonSeriesCells: a regular-season game after the viewed game is sealed too', () => {
  const games = [post(40, 'R', 1, 2, 3), post(41, 'R', 2, 1, 4)]
  const [before, after] = seasonSeriesCells(games, MIL, 40)
  assert.equal(before.final, false)
  assert.equal(after.final, false)
  assert.equal(after.winnerScore, null)
})

test('seasonSeriesCells: in a doubleheader, only the later game number is sealed', () => {
  const dh = (gamePk, gameNumber) => ({ ...post(gamePk, 'R', 1, 2, 3), apiDate: '2026-07-07', gameNumber })
  const [g1, g2] = seasonSeriesCells([dh(50, 1), dh(51, 2)], MIL, 50)
  assert.equal(g1.isCurrent, true)
  assert.equal(g2.final, false)
  assert.equal(g2.winnerScore, null)
  const [h1, h2] = seasonSeriesCells([dh(50, 1), dh(51, 2)], MIL, 51)
  assert.equal(h1.final, true)
  assert.equal(h1.winnerScore, 3)
  assert.equal(h2.isCurrent, true)
})

test('seasonSeriesCells: with no current game in the list, nothing is sealed', () => {
  for (const pk of [undefined, null, 999]) {
    for (const c of seasonSeriesCells(series(), MIL, pk)) assert.equal(c.final, true)
  }
})

// MLB drops an unplayed "if necessary" postseason game from its schedule once a
// series is decided, so a later card that EXISTS (or is missing) says how the
// series ended, and so who won the viewed game. Later postseason games are not
// drawn at all, blanked scores or not.
test('seasonSeriesCells: a postseason page draws no later postseason card', () => {
  const cells = seasonSeriesCells(series(), MIL, 32)
  assert.deepEqual(cells.map((c) => c.gamePk), [30, 31, 32])
})

test('seasonSeriesCells: a postseason page keeps every earlier postseason card', () => {
  const cells = seasonSeriesCells(series(), MIL, 34)
  assert.deepEqual(cells.map((c) => c.gamePk), [30, 31, 32, 33, 34])
  assert.equal(cells[3].final, true)
})

test('seasonSeriesCells: a regular-season page still draws a later postseason card', () => {
  const games = [post(70, 'R', 1, 2, 3), post(71, 'D', 1, 1, 4)]
  assert.deepEqual(seasonSeriesCells(games, MIL, 70).map((c) => c.gamePk), [70, 71])
})

// A page whose game is not in the fetched list (a spring-training or MiLB
// postseason game) cannot tell which row is its own, so it seals every game
// from its own date on.
test('seasonSeriesCells: with the viewed game missing, games on or after its date are sealed', () => {
  const games = [post(80, 'R', 1, 2, 3), post(81, 'R', 2, 1, 4), post(82, 'R', 3, 5, 0)]
  const cells = seasonSeriesCells(games, MIL, 999, '2026-10-02')
  assert.deepEqual(cells.map((c) => c.final), [true, false, false])
  assert.equal(cells[2].winnerScore, null)
})

test('seasonSeriesRecord: counts only the regular-season games before the viewed game', () => {
  const games = [post(60, 'R', 1, 2, 3), post(61, 'R', 2, 1, 4), post(62, 'R', 3, 5, 0), post(63, 'R', 4, 0, 6)]
  assert.deepEqual(seasonSeriesRecord(seasonSeriesCells(games, MIL, 62), MIL, NYM), { aWins: 2, bWins: 0 })
  assert.deepEqual(seasonSeriesRecord(seasonSeriesCells(games, MIL, 60), MIL, NYM), { aWins: 0, bWins: 0 })
})

// The strip is not its cards' offsetParent, so offsetLeft counts the page
// distance to the strip too and the current card landed off centre. The helper
// works from on-screen rects, which do not care who the offsetParent is.
test('centeredScrollLeft: puts the card at the strip centre, wherever the strip sits on the page', () => {
  // Strip 292 wide at x=69, scrolled 0. The card sits 517 px into the content,
  // so on screen it starts at 69 + 517 = 586 and is 90 wide (centre 631).
  // The strip centre is 69 + 146 = 215, so the strip must scroll 416 more.
  const left = centeredScrollLeft({ scrollLeft: 0, stripLeft: 69, stripWidth: 292, cellLeft: 586, cellWidth: 90 })
  assert.equal(left, 416)
  // Already scrolled 100: the card is 100 px further left on screen.
  assert.equal(
    centeredScrollLeft({ scrollLeft: 100, stripLeft: 69, stripWidth: 292, cellLeft: 486, cellWidth: 90 }),
    416,
  )
  // The same card in a strip at another page position gives the same answer.
  assert.equal(centeredScrollLeft({ scrollLeft: 0, stripLeft: 229, stripWidth: 292, cellLeft: 746, cellWidth: 90 }), 416)
})

test('seasonSeriesCells: startTimeTBD rides through to the cell, absent reads false', () => {
  const base = { apiDate: '1927-07-05', gameDate: '1927-07-05T07:33:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: false }
  const [tbd, real] = seasonSeriesCells(
    [{ ...base, gamePk: 7, startTimeTBD: true }, { ...base, gamePk: 8 }],
    MIL,
    2,
  )
  assert.equal(tbd.startTimeTBD, true)
  assert.equal(real.startTimeTBD, false)
})
