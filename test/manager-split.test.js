// scripts/lib/records/manager-split.mjs: the change date a source W-L implies (#2761).
import assert from 'node:assert/strict'
import test from 'node:test'
import { findSplit, parseRecord, teamSeasonGames, pickManagers } from '../scripts/lib/records/manager-split.mjs'

const g = (date, won) => ({ date, won })
const games = [g('2015-05-01', false), g('2015-05-02', true), g('2015-05-03', false), g('2015-05-04', true), g('2015-05-05', true)]

test('the date is the first game after the outgoing record is reached', () => {
  const r = findSplit(games, { w: 1, l: 2 })
  assert.equal(r.status, 'ok')
  assert.equal(r.transitionDate, '2015-05-04')
  assert.deepEqual(r.incoming, { w: 2, l: 0 })
})

test('an incoming record that disagrees is flagged, not accepted', () => {
  assert.equal(findSplit(games, { w: 1, l: 2 }, { w: 1, l: 1 }).status, 'incoming-mismatch')
  assert.equal(findSplit(games, { w: 1, l: 2 }, { w: 2, l: 0 }).status, 'ok')
})

test('a change between the games of a doubleheader is flagged', () => {
  const dh = [g('2015-05-01', true), g('2015-05-02', false), g('2015-05-02', true)]
  assert.equal(findSplit(dh, { w: 1, l: 1 }).status, 'doubleheader')
})

test('a record the season never passes through is no-match', () => {
  assert.equal(findSplit(games, { w: 0, l: 3 }).status, 'no-match')
  assert.equal(findSplit(games, { w: 3, l: 2 }).status, 'no-games-after')
})

test('parseRecord reads W-L', () => {
  assert.deepEqual(parseRecord('7-18'), { w: 7, l: 18 })
  assert.equal(parseRecord('7 18'), null)
})

// Brewers 1975: gamePk 168575 was suspended and resumed, and the schedule lists
// it twice, both Final, so a plain walk read the 68-94 club as 69-94.
test('a game the schedule lists twice counts once', () => {
  const side = (id, won) => ({ team: { id }, isWinner: won })
  const game = (gamePk, date, won) => ({
    gamePk, officialDate: date, status: { abstractGameState: 'Final' },
    teams: { home: side(158, won), away: side(147, !won) },
  })
  const schedule = { dates: [
    { games: [game(168575, '1975-05-14', true)] },
    { games: [game(168575, '1975-05-14', true), game(168576, '1975-05-15', false)] },
  ] }
  assert.deepEqual(teamSeasonGames(schedule, 158), [{ date: '1975-05-14', won: true }, { date: '1975-05-15', won: false }])
})

test('the records are re-tallied the way the generator splits, by date', () => {
  // A makeup listed out of date order: by index the outgoing record is 1-1,
  // but the generator gives the 05-01 game to the outgoing manager.
  const odd = [g('2015-05-02', true), g('2015-05-03', false), g('2015-05-01', true), g('2015-05-04', false)]
  assert.equal(findSplit(odd, { w: 1, l: 1 }).status, 'date-order')
})

test('pickManagers orders the queue ids by the outgoing name', () => {
  const managers = [{ id: 1, name: 'Harvey Kuenn' }, { id: 2, name: 'Del Crandall' }]
  assert.deepEqual(pickManagers(managers, 'crandall'), { outgoingManagerId: 2, incomingManagerId: 1 })
  assert.equal(pickManagers(managers, 'nobody'), null)
  assert.equal(pickManagers([...managers, { id: 3, name: 'Del Smith' }], 'del'), null)
})
