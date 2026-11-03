// scripts/lib/records/manager-split.mjs: the change date a source W-L implies (#2761).
import assert from 'node:assert/strict'
import test from 'node:test'
import { findSplit, parseRecord, teamSeasonGames, pickManagers, seedSegments, findSplits, pickOrder } from '../scripts/lib/records/manager-split.mjs'

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

// Brewers 2002: gamePk 11244 is listed first as Postponed (abstractGameState
// 'Final', no isWinner) and then as the game played. The played game counts.
test('a postponed listing does not hide the game played under its gamePk', () => {
  const schedule = { dates: [
    { games: [{ gamePk: 11244, officialDate: '2002-09-02', status: { abstractGameState: 'Final', detailedState: 'Postponed' },
      teams: { home: { team: { id: 158 } }, away: { team: { id: 112 } } } }] },
    { games: [{ gamePk: 11244, officialDate: '2002-09-02', status: { abstractGameState: 'Final' },
      teams: { home: { team: { id: 158 }, isWinner: false }, away: { team: { id: 112 }, isWinner: true } } }] },
  ] }
  assert.deepEqual(teamSeasonGames(schedule, 158), [{ date: '2002-09-02', won: false }])
})

test('seedSegments: a three-manager season splits the schedule into three records', () => {
  const season = [g('2015-05-01', true), g('2015-05-02', false), g('2015-05-03', false), g('2015-05-04', true), g('2015-05-05', true), g('2015-05-06', false)]
  const seg = seedSegments({ transitions: [
    { date: '2015-05-03', outgoingManagerId: 1, incomingManagerId: 2 },
    { date: '2015-05-05', outgoingManagerId: 2, incomingManagerId: 3 },
  ] })
  const rec = ({ from, to }) => {
    const gs = season.filter((x) => (from === null || x.date >= from) && (to === null || x.date < to))
    return { w: gs.filter((x) => x.won).length, l: gs.filter((x) => !x.won).length }
  }
  assert.deepEqual(seg.map((s) => s.managerId), [1, 2, 3])
  assert.deepEqual(seg.map(rec), [{ w: 1, l: 1 }, { w: 1, l: 1 }, { w: 1, l: 1 }])
})

test('seedSegments: the single-change shorthand still means two managers', () => {
  assert.deepEqual(seedSegments({ transitionDate: '2015-05-03', outgoingManagerId: 1, incomingManagerId: 2 }), [
    { managerId: 1, from: null, to: '2015-05-03' },
    { managerId: 2, from: '2015-05-03', to: null },
  ])
})

test('pickManagers ignores accents in the last name', () => {
  assert.deepEqual(pickManagers([{ id: 1, name: 'Ozzie Guillén' }, { id: 2, name: 'Joe Smith' }], 'Guillen'), { outgoingManagerId: 1, incomingManagerId: 2 })
})

const run = (...r) => r.flatMap(([n, won]) => Array.from({ length: n }, () => won))
const season = (...r) => run(...r).map((won, i) => g(`2015-05-${String(i + 1).padStart(2, '0')}`, won))
// A 1-1, B 1-0, C 1-1.
const three = season([1, true], [1, false], [1, true], [1, true], [1, false])

test('three managers: a date between each pair', () => {
  const r = findSplits(three, [{ w: 1, l: 1 }, { w: 1, l: 0 }, { w: 1, l: 1 }])
  assert.deepEqual(r, { status: 'ok', dates: ['2015-05-03', '2015-05-04'] })
})

test('three managers: a middle record that never happens is no-match at that manager', () => {
  const r = findSplits(three, [{ w: 1, l: 1 }, { w: 3, l: 0 }, { w: 0, l: 1 }])
  assert.equal(r.status, 'no-match')
  assert.equal(r.at, 1)
})

test('three managers: a wrong last record is incoming-mismatch', () => {
  assert.equal(findSplits(three, [{ w: 1, l: 1 }, { w: 1, l: 0 }, { w: 2, l: 0 }]).status, 'incoming-mismatch')
})

test('two managers through findSplits match findSplit', () => {
  const r = findSplits(games, [{ w: 1, l: 2 }, { w: 2, l: 0 }])
  assert.equal(r.dates[0], findSplit(games, { w: 1, l: 2 }, { w: 2, l: 0 }).transitionDate)
})

test('pickOrder: ids in the given order, or why not', () => {
  const m = [{ id: 1, name: 'Dave Bristol' }, { id: 2, name: 'Roy McMillan' }, { id: 3, name: 'Del Crandall' }]
  assert.deepEqual(pickOrder(m, ['Crandall', 'Bristol', 'McMillan']), { ids: [3, 1, 2] })
  assert.equal(pickOrder(m, ['Bristol', 'Bristol', 'Crandall']).status, 'two-stints')
  assert.equal(pickOrder(m, ['Bristol', 'Nobody', 'Crandall']).status, 'name-not-matched')
  assert.equal(pickOrder(m, ['Bristol', 'Crandall']).status, 'count-mismatch')
})
