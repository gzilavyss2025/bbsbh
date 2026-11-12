// The pure half of gen-tensest.mjs: wording a play and finding the tense ones; and the
// ranking the page applies (src/api/tensest/rank.js). Merging, filing by club and
// slicing the flat list are in test/tensest-slices.test.js (#2981).
import assert from 'node:assert/strict'
import test from 'node:test'
import { describePlay, gameRowsOrThrow, isPlayedFinal, playRows } from '../scripts/lib/tensest/tensest.mjs'
import { rankTop } from '../src/api/tensest/rank.js'
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

import { postseasonLabel } from '../src/api/tensest/tensest.js'
import { gameNumbers } from '../scripts/lib/tensest/tensest.mjs'

test('postseasonLabel names the round, league and game', () => {
  assert.equal(postseasonLabel({ gt: 'D', aw: 135, d: '2026-10-04', sg: 2 }), 'NLDS G2')
  assert.equal(postseasonLabel({ gt: 'W', aw: 147, d: '2026-10-28', sg: 7 }), 'WS G7')
  assert.equal(postseasonLabel({ gt: 'L', aw: 147, d: '2026-10-14' }), 'ALCS')
  assert.equal(postseasonLabel({ gt: 'R', aw: 147, d: '2026-06-01' }), '')
})

test('gameNumbers keeps a doubleheader game 2 and a postseason series game', () => {
  assert.deepEqual(gameNumbers({ gameType: 'R', gameNumber: 1, seriesGameNumber: 3 }), {})
  assert.deepEqual(gameNumbers({ gameType: 'R', gameNumber: 2 }), { gn: 2 })
  assert.deepEqual(gameNumbers({ gameType: 'D', gameNumber: 1, seriesGameNumber: 1 }), { sg: 1 })
})

import { boardBars } from '../src/api/tensest/tensest.js'

test('boardBars spreads the page\'s range (4 to 9.99) over the 10 bars', () => {
  assert.equal(boardBars(9.99), 10)
  assert.equal(boardBars(4), 1)
  assert.equal(boardBars(6.1), 4)
  assert.ok(boardBars(6.1) < boardBars(8.48))
  assert.equal(boardBars(undefined), null)
})
