// /research's postseason detail (#3141): the series state joined from the schedule, the
// Series game card, and All-Star games apart from the postseason.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seriesByGame, seriesValues } from '../src/api/research/series.js'
import { FILTER_BY_KEY, buildQuery, matcher, parseQuery } from '../src/api/research/filters.js'
import { savantDayUrl } from '../scripts/lib/research/store.mjs'

// A schedule game on `date`: home club `h` wins when `hw` (null: no winner yet).
const game = (gamePk, date, gameType, n, of, h, a, hw) => ({
  gamePk, gameType, officialDate: date, seriesGameNumber: n, gamesInSeries: of,
  teams: { home: { team: { id: h }, isWinner: hw === true }, away: { team: { id: a }, isWinner: hw === false } },
})
const day = (date, ...games) => ({ date, games })

// A World Series 158 v 119 that 158 wins 4-1, a one-game wild card, and a best-of-3 to a
// Game 3 whose Game 2 was postponed: listed under its old date too, with the new
// officialDate and no winner (the 2020 shape, postseason/fetch.js keptGames).
const SCHEDULE = {
  dates: [
    day('2025-10-24', game(1, '2025-10-24', 'W', 1, 7, 158, 119, true)),
    day('2025-10-25', game(2, '2025-10-25', 'W', 2, 7, 158, 119, true)),
    day('2025-10-27', game(3, '2025-10-27', 'W', 3, 7, 119, 158, false), game(4, '2025-10-28', 'W', 4, 7, 119, 158, null)),
    day('2025-10-28', game(4, '2025-10-28', 'W', 4, 7, 119, 158, true)),
    day('2025-10-29', game(5, '2025-10-29', 'W', 5, 7, 119, 158, false)),
    day('2025-09-30', game(10, '2025-09-30', 'F', 1, 1, 111, 112, true)),
    day('2025-10-01', game(20, '2025-10-01', 'F', 1, 3, 140, 141, true), game(21, '2025-10-03', 'F', 2, 3, 140, 141, null)),
    day('2025-10-03', game(21, '2025-10-03', 'F', 2, 3, 140, 141, false), game(22, '2025-10-03', 'F', 3, 3, 140, 141, true)),
  ],
}
const S = seriesByGame(SCHEDULE)

test('series state before each game: clinch and elimination by club, the decider, sudden death', () => {
  // Game 4: 158 leads 3-0 (158 away). 158 can clinch, 119 can be eliminated.
  assert.deepEqual(S.get(4), { n: 4, sudden: false, home: { clinch: false, elim: true }, away: { clinch: true, elim: false }, decider: false })
  // Game 5 ended it 4-1.
  assert.equal(S.get(5).decider, true)
  assert.equal(S.get(1).home.clinch, false)
  // A one-game wild card is sudden death, the decider, and a clinch and elimination for both.
  assert.deepEqual(S.get(10), { n: 1, sudden: true, home: { clinch: true, elim: true }, away: { clinch: true, elim: true }, decider: true })
  // Best of 3 at 1-1: Game 3 is sudden death; Game 2 counted once, from its Final listing.
  assert.equal(S.get(21).home.elim, false)
  assert.equal(S.get(21).away.elim, true)
  assert.equal(S.get(22).sudden, true)
  assert.equal(S.get(22).decider, true)
  assert.equal(S.size, 9)
})

test('a broken or empty schedule gives no series', () => {
  assert.equal(seriesByGame(null).size, 0)
  assert.equal(seriesByGame({ dates: [day('2025-10-24', game(1, '2025-10-24', 'W', 1, 7, 1, 2, null))] }).size, 0)
})

test('the Series game card reads clinch and elimination from the batting club', () => {
  const g4 = S.get(4) // 158 away, up 3-0
  assert.deepEqual(seriesValues({ series: g4, top: true }), ['g4', 'clinch'])
  assert.deepEqual(seriesValues({ series: g4, top: false }), ['g4', 'elim'])
  assert.deepEqual(seriesValues({ series: S.get(10), top: true }), ['g1', 'last', 'sd', 'clinch', 'elim'])
  assert.deepEqual(seriesValues({ top: true }), [])

  const q = parseQuery('?sg=clinch')
  const hit = matcher(q)
  assert.equal(hit({ series: g4, top: true }), true)
  assert.equal(hit({ series: g4, top: false }), false)
  assert.equal(hit({ top: true }), false) // a regular-season PA has no series
  assert.equal(buildQuery(parseQuery('?sg=g7.sd')), '?sg=g7.sd')
})

test('an inverted Series game chip still reads only postseason series games', () => {
  const notG7 = matcher(parseQuery('?sg=!g7'))
  assert.equal(notG7({ series: S.get(4), top: true }), true)
  assert.equal(notG7({ gameType: 'R', top: true }), false)
})

test('an All-Star game is its own game type, not the postseason', () => {
  const gt = FILTER_BY_KEY.gt
  assert.deepEqual(gt.values({ gameType: 'A' }), ['A'])
  assert.deepEqual(gt.values({ gameType: 'W' }), ['P'])
  assert.deepEqual(gt.values({ gameType: 'R' }), ['R'])
  assert.equal(matcher(parseQuery('?gt=P'))({ gameType: 'A' }), false)
  // An All-Star PA counts only when the card picks All-Star, never in a default query.
  assert.equal(matcher(parseQuery('?bat=1'))({ gameType: 'A', batter: 1 }), false)
  assert.equal(matcher(parseQuery('?gt=!R'))({ gameType: 'A' }), false)
  assert.equal(matcher(parseQuery('?gt=A'))({ gameType: 'A' }), true)
  assert.equal(matcher(parseQuery('?bat=1'))({ gameType: 'R', batter: 1 }), true)
  assert.match(decodeURIComponent(savantDayUrl('2025-07-15')), /hfGT=R\|F\|D\|L\|W\|A\|/)
})
