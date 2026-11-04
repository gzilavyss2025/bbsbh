// The pure half of gen-tensest.mjs: wording a play, and keeping the tensest rows.
import assert from 'node:assert/strict'
import test from 'node:test'
import { addRows, assertFloorHolds, describePlay, emptyStore, gameRowsOrThrow, isPlayedFinal, mergeTop, playRows, rankTop } from '../scripts/lib/tensest/tensest.mjs'
import { isPostseason, rankLabel } from '../src/api/tensest/tensest.js'

const play = (event, description, extra = {}) => ({
  result: { event, description },
  about: { inning: 9, isTopInning: false },
  matchup: { batter: { id: 1, fullName: 'Jackson Chourio' }, pitcher: { id: 2, fullName: 'Mason Miller' } },
  leverageIndex: 9.99,
  ...extra,
})

test('describePlay words a hit with its direction and the runners who scored', () => {
  const d = 'Jackson Chourio singles on a line drive to center fielder Jackson Merrill. Christian Yelich scores.'
  assert.equal(describePlay(play('Single', d)), 'singled to center, scoring Yelich')
})

test('describePlay counts a homer by the runners who scored with it', () => {
  const d = 'Pete Alonso homers (30) on a fly ball to left center field. Brandon Nimmo scores. Mark Vientos scores.'
  assert.equal(describePlay(play('Home Run', d)), 'hit a three-run homer to left-center')
})

test('describePlay tells a strikeout looking from swinging, and falls back to the feed name', () => {
  assert.equal(describePlay(play('Strikeout', 'X called out on strikes.')), 'struck out looking')
  assert.equal(describePlay(play('Strikeout', 'X strikes out swinging.')), 'struck out swinging')
  assert.equal(describePlay(play('Caught Stealing 2B', 'X caught stealing.')), 'caught stealing 2b')
})

const game = { gamePk: 10, gameType: 'R', officialDate: '2026-06-28', teams: { away: { team: { id: 112 }, score: 4 }, home: { team: { id: 158 }, score: 3 } } }

test('playRows keeps only plays at or above the floor and says who batted', () => {
  const rows = playRows(game, [play('Single', 'x', { leverageIndex: 1.2 }), play('Single', 'x', { leverageIndex: 8.48 })])
  assert.equal(rows.length, 1)
  assert.deepEqual([rows[0].li, rows[0].bn, rows[0].pn, rows[0].top, rows[0].aw, rows[0].hm], [8.48, 'Jackson Chourio', 'Mason Miller', 0, 112, 158])
})

const r = (pk, li) => ({ pk, i: 1, li, aw: 112, hm: 158, top: 0 })

test('rankTop shares a rank across a tie and keeps the whole tie group', () => {
  const out = rankTop([r(1, 9), r(2, 9), r(3, 8), r(4, 7), r(5, 7)], 3)
  assert.deepEqual(out.map((x) => [x.pk, x.rank]), [[1, 1], [2, 1], [3, 3]])
  const wider = rankTop([r(1, 9), r(2, 8), r(3, 7), r(4, 7), r(5, 6)], 3)
  assert.deepEqual(wider.map((x) => x.rank), [1, 2, 3, 3])
})

test('mergeTop replaces a row it has already seen instead of doubling it', () => {
  const once = mergeTop([], [r(1, 9)], 5)
  assert.equal(mergeTop(once, [r(1, 9)], 5).length, 1)
})

test('addRows files a play under the league, the club batting and the club pitching', () => {
  const store = addRows(emptyStore(), [{ ...r(1, 9), top: 0 }])
  assert.equal(store.league.length, 1)
  assert.equal(store.teams[158].bat.length, 1) // home team bats in the bottom half
  assert.equal(store.teams[112].pit.length, 1)
  assert.deepEqual(store.teams[158].pit, [])
})

test('assertFloorHolds throws when a full list has run down to the floor', () => {
  const full = Array.from({ length: 25 }, (_, k) => ({ ...r(k, 4), rank: 25 }))
  assert.throws(() => assertFloorHolds({ league: [], teams: { 1: { bat: full, pit: [] } } }), /floor/)
  assert.doesNotThrow(() => assertFloorHolds({ league: [], teams: { 1: { bat: [{ ...r(1, 4), rank: 1 }], pit: [] } } }))
})

test('describePlay counts a runner whose name ends in Jr.', () => {
  const d = 'Juan Soto homers (10) on a fly ball to right field. Fernando Tatis Jr. scores.'
  assert.equal(describePlay(play('Home Run', d)), 'hit a two-run homer to right')
  assert.equal(describePlay(play('Single', 'Soto singles on a line drive to center field. Fernando Tatis Jr. scores.')), 'singled to center, scoring Tatis Jr.')
})

test('describePlay words a sac-fly double play by its event, not as a grounder', () => {
  const d = 'Soto flies out to right fielder Jones. Runner out at home. Smith scores.'
  assert.equal(describePlay(play('Sac Fly Double Play', d)), 'hit a sacrifice fly to right, scoring Smith')
  assert.equal(describePlay(play('Grounded Into DP', 'Soto grounds into a double play.')), 'grounded into a double play')
})

test('gameRowsOrThrow refuses an empty feed so the game is read again next run', () => {
  assert.throws(() => gameRowsOrThrow(game, []), /no winProbability plays/)
  assert.throws(() => gameRowsOrThrow(game, null), /no winProbability plays/)
  assert.equal(gameRowsOrThrow(game, [play('Single', 'x', { leverageIndex: 6 })]).length, 1)
})

test('rankLabel marks a shared rank with T and isPostseason is every type but R', () => {
  const rows = [{ rank: 1 }, { rank: 2 }, { rank: 2 }]
  assert.deepEqual(rows.map((x) => rankLabel(x, rows)), ['1', 'T2', 'T2'])
  assert.equal(isPostseason({ gt: 'R' }), false)
  assert.equal(isPostseason({ gt: 'W' }), true)
})

test('isPlayedFinal: a cancelled or postponed game is not read, a played Final is', () => {
  // Cancelled reports abstractGameCode F but has no winProbability (404): one such
  // game (823490, rained out 2026-09-27) failed every nightly run from 2026-11-04.
  const status = (codedGameState, abstractGameCode = 'F') => ({ status: { abstractGameCode, codedGameState } })
  assert.equal(isPlayedFinal(status('F')), true)
  assert.equal(isPlayedFinal(status('C')), false)
  assert.equal(isPlayedFinal(status('D')), false)
  assert.equal(isPlayedFinal(status('I', 'L')), false)
})
