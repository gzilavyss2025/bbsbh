import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seriesOdds, clubFacts } from '../../src/lib/worldSeries/odds.js'
import { HISTORY } from './ws-fixture.js'

const O = seriesOdds(HISTORY, '2001-10-20')

test('Game 1 winners: a tied Game 1 counts for nobody', () => {
  assert.deepEqual(O.game1, { w: 2, l: 1 }) // 1990 W, 1991 L, 1992 tie, 2000 W
})

test('2-0 leaders', () => {
  assert.deepEqual(O.lead20, { w: 1, l: 1 })
})

test('3-1 comebacks are read from winsNeeded (a best-of-nine 4-2 is a different shape)', () => {
  assert.equal(O.winsNeeded, 4)
  assert.deepEqual(O.trail31, { w: 1, l: 0, last: 1991 })
})

test('winner-take-all: home and road records, road streak, last one', () => {
  assert.deepEqual(O.wta.home, { w: 1, l: 2 })
  assert.equal(O.wta.roadStreak, 2)
  assert.equal(O.wta.last, 2000)
})

test('nothing from the same or a later year is counted', () => {
  const early = seriesOdds(HISTORY, '1992-10-12')
  assert.deepEqual(early.game1, { w: 1, l: 1 })
  assert.equal(early.wta.last, 1991)
  assert.deepEqual(seriesOdds(HISTORY, '1990-10-12').game1, { w: 0, l: 0 })
})

test('a 1986 game with a before of 1986-10-25 never receives a later row', () => {
  const h = { series: [{
    season: 1986, winsNeeded: 4, clubs: [1, 2], winner: 1,
    games: [22, 23, 24, 25].map((d, i) => ({
      pk: i, n: i + 1, date: `1986-10-${d}`, away: 1, home: 2,
      awayRuns: 3, homeRuns: 1, innings: 9, venue: null, tie: false,
    })),
  }] }
  assert.equal(seriesOdds(h, '1986-10-25').game1.w, 0) // the Series ended that day
  assert.equal(seriesOdds(h, '1986-10-26').game1.w, 1)
})

test('club facts: repeat champion, last meeting, last appearance', () => {
  const f = clubFacts(HISTORY, '2001-10-20', 1, 2)
  assert.equal(f.champion, 1) // 2000 winner
  assert.equal(f.lastMeeting, 2000)
  assert.deepEqual(f.lastSeen, { 1: 2000, 2: 2000 })
  assert.equal(clubFacts(HISTORY, '2001-10-20', 3, 4).lastMeeting, 1991)
  assert.equal(clubFacts(HISTORY, '2001-10-20', 2, 9).lastMeeting, null)
  assert.equal(clubFacts(HISTORY, '2001-10-20', 2, 9).lastSeen[9], null)
  assert.equal(clubFacts(HISTORY, '2002-10-20', 2, 9).champion, null) // 2001 has no row
})
