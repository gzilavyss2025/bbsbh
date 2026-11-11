// Best Stretch (/best-stretch): a hitter's best N games in a row, across seasons.
import assert from 'node:assert/strict'
import test from 'node:test'
import { bestStretch, era, ip, isStarter, kRate, measureByKey, obp, presetsFor, showsHolds, slg, toGame, whip } from '../src/api/streaks/bestStretch.js'

const day = (i) => `20${String(18 + Math.floor(i / 200)).padStart(2, '0')}-${String(4 + Math.floor((i % 200) / 31)).padStart(2, '0')}-${String(((i % 200) % 31) + 1).padStart(2, '0')}`
const game = (i, s) => toGame({ date: day(i), game: { gameNumber: 1 }, team: { id: 158 }, stat: { atBats: 4, plateAppearances: 4, ...s } })

test('finds the hottest window, and a window may cross a season', () => {
  const games = Array.from({ length: 400 }, (_, i) => game(i, i >= 190 && i < 200 + 3 ? { hits: 3, homeRuns: 1, totalBases: 6 } : { hits: 1, totalBases: 1 }))
  const b = bestStretch(games, 13, measureByKey('hr'))
  assert.equal(b.homeRuns, 13)
  assert.equal(b.first, day(190))
  assert.equal(b.last, day(202))
  assert.notEqual(b.first.slice(0, 4), b.last.slice(0, 4))
})

test('games arrive out of order: the window still runs by date', () => {
  const games = [game(2, { hits: 4 }), game(0, {}), game(1, { hits: 4 })]
  const b = bestStretch(games, 2, measureByKey('h'))
  assert.equal(b.hits, 8)
  assert.equal(b.first, day(1))
})

test('fewer games than the window is no stretch', () => {
  assert.equal(bestStretch([game(0, {})], 162, measureByKey('ops')), null)
})

test('a tie keeps the earlier window', () => {
  const b = bestStretch([game(0, { hits: 1 }), game(1, { hits: 1 })], 1, measureByKey('h'))
  assert.equal(b.first, day(0))
})

test('OBP counts walks, HBP and sac flies; SLG is total bases over at-bats', () => {
  const t = { hits: 3, baseOnBalls: 1, hitByPitch: 1, sacFlies: 1, atBats: 10, totalBases: 7 }
  assert.equal(obp(t), 5 / 13)
  assert.equal(slg(t), 0.7)
  assert.equal(obp({ hits: 0, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, atBats: 0 }), 0)
})

const outing = (i, s) => toGame({ date: day(i), game: { gameNumber: 1 }, team: { id: 158 }, stat: { outs: 18, ...s } }, 'pitching')

test('pitching: ERA is lower-is-better, from summed earned runs over outs', () => {
  const games = [outing(0, { earnedRuns: 5 }), outing(1, { earnedRuns: 0 }), outing(2, { earnedRuns: 1 }), outing(3, { earnedRuns: 6 })]
  const b = bestStretch(games, 2, measureByKey('era', 'pitching'), 'pitching')
  assert.equal(b.first, day(1))
  assert.equal(era(b), 1 * 27 / 36)
  assert.equal(ip({ outs: 20 }), '6.2')
})

test('pitching: a starter is someone with at least half his outings started', () => {
  assert.equal(isStarter([outing(0, { gamesStarted: 1 }), outing(1, {})]), true)
  assert.equal(isStarter([outing(0, { gamesStarted: 1 }), outing(1, {}), outing(2, {})]), false)
})

test('pitching: a window with no outs is the worst ERA and WHIP, not a perfect one', () => {
  const games = [outing(0, { outs: 0, earnedRuns: 3 }), outing(1, { earnedRuns: 2 })]
  assert.equal(era({ outs: 0, earnedRuns: 3 }), Infinity)
  assert.equal(whip({ outs: 0, hits: 1, baseOnBalls: 0 }), Infinity)
  assert.equal(bestStretch(games, 1, measureByKey('era', 'pitching'), 'pitching').first, day(1))
})

test('a window keeps the club names the log carries, defunct clubs included', () => {
  const g = toGame({ date: '1994-07-01', team: { id: 9999, name: 'Montreal Expos' }, stat: {} })
  assert.deepEqual(bestStretch([g], 1, measureByKey('h')).teams, ['Montreal Expos'])
})

test('the card wears the club he played most of the stretch for', () => {
  const at = (i, id) => toGame({ date: day(i), team: { id, name: String(id) }, stat: {} })
  assert.equal(bestStretch([at(0, 1), at(1, 2), at(2, 2)], 3, measureByKey('h')).mainTeamId, 2)
})

test('presets: season length is the default for each role', () => {
  assert.equal(presetsFor('hitter').season, 162)
  assert.equal(presetsFor('starter').season, 32)
  assert.equal(presetsFor('reliever').season, 65)
})

test('a setup man shows holds; a closer keeps saves', () => {
  assert.equal(showsHolds({ holds: 20, saves: 2 }), true)
  assert.equal(showsHolds({ holds: 0, saves: 42 }), false)
  assert.equal(kRate({ strikeOuts: 107, battersFaced: 239 }), 107 / 239)
})
