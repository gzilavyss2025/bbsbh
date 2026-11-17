// The pure half of gen-tensest.mjs: wording a play and finding the tense ones; and the
// ranking the page applies (src/api/tensest/rank.js). Merging, filing by club and
// slicing the flat list are in test/tensest-slices.test.js (#2981).
import assert from 'node:assert/strict'
import test from 'node:test'
import { describePlay, gameNumbers, gameRowsOrThrow, isPlayedFinal, playRows } from '../scripts/lib/tensest/tensest.mjs'
import { rankTop } from '../src/api/tensest/rank.js'
import { boardBars, isPostseason, postseasonLabel, rankLabel } from '../src/api/tensest/tensest.js'

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

test('boardBars spreads the page\'s range (4 to 9.99) over the 10 bars', () => {
  assert.equal(boardBars(9.99), 10)
  assert.equal(boardBars(4), 1)
  assert.equal(boardBars(6.1), 4)
  assert.ok(boardBars(6.1) < boardBars(8.48))
  assert.equal(boardBars(undefined), null)
})

import { momentParts, ordinal, postseasonCitation, swingFor } from '../src/api/tensest/tensest.js'

test('ordinal writes innings as a game story does', () => {
  assert.deepEqual([1, 2, 3, 9, 10, 11, 12, 13, 21].map(ordinal), ['1st', '2nd', '3rd', '9th', '10th', '11th', '12th', '13th', '21st'])
})

test('momentParts: a hit is off the pitcher, an out against him, runs trail the pitcher', () => {
  assert.deepEqual(momentParts({ what: 'singled to right, scoring Cheng', inn: 9 }), { lead: 'batter', verb: 'singled to right', prep: 'off', scoring: ', scoring Cheng', runners: null, when: 'in the bottom of the 9th' })
  assert.deepEqual(momentParts({ what: 'flew out to right', inn: 10 }), { lead: 'batter', verb: 'flew out to right', prep: 'against', scoring: '', runners: null, when: 'in the bottom of the 10th' })
  assert.equal(momentParts({ what: 'hit a two-run homer to left', inn: 9 }).prep, 'off')
  assert.equal(momentParts({ what: 'reached on an error, scoring Pages', inn: 10 }).verb, 'reached on an error')
})

test('momentParts: a play the batter did not make leads with the play', () => {
  assert.deepEqual(momentParts({ what: 'wild pitch', inn: 9 }), { lead: 'play', verb: 'Wild pitch', prep: 'with', scoring: '', runners: null, when: 'in the bottom of the 9th' })
})

test('postseasonCitation writes the game out', () => {
  assert.equal(postseasonCitation({ gt: 'D', aw: 135, d: '2026-10-04', sg: 2 }), 'NLDS Game 2')
})

test('momentParts names the half, and hands back the runners who scored', () => {
  const m = momentParts({ what: 'singled to center, scoring Yelich and Frelick', inn: 9, top: 1, sc: [[1, 'Christian Yelich'], [2, 'Sal Frelick']] })
  assert.equal(m.when, 'in the top of the 9th')
  assert.deepEqual(m.runners, [[1, 'Christian Yelich'], [2, 'Sal Frelick']])
})

test('swingFor: the club’s side won the at-bat, from the Batting or Pitching view', () => {
  const hit = { what: 'singled to right', inn: 9 }
  const out = { what: 'flew out to right', inn: 9 }
  const sacFly = { what: 'hit a sacrifice fly to center, scoring Jones', inn: 10 }
  assert.equal(swingFor(hit, 158, 'bat'), 'up')
  assert.equal(swingFor(out, 158, 'bat'), 'down')
  assert.equal(swingFor(sacFly, 158, 'bat'), 'up')
  assert.equal(swingFor(hit, 158, 'pit'), 'down')
  assert.equal(swingFor(out, 158, 'pit'), 'up')
  assert.equal(swingFor(hit, null, 'bat'), null)
})

import { boardRecord } from '../src/api/tensest/tensest.js'

test('boardRecord counts the at-bats the side succeeded in, on either side', () => {
  const rows = [
    { what: 'singled to right, scoring Cheng', sc: [[1, 'A Cheng']] },
    { what: 'struck out swinging' },
    { what: 'hit a two-run homer to left', sc: [[2, 'B'], [3, 'C']] },
  ]
  assert.deepEqual(boardRecord(rows, 'bat'), { succeeded: 2, of: 3, tone: 'up' })
  assert.deepEqual(boardRecord(rows, 'pit'), { succeeded: 1, of: 3, tone: 'down' })
  assert.deepEqual(boardRecord([], 'bat'), { succeeded: 0, of: 0, tone: null })
})

import { mlbRate, versusMlb } from '../src/api/tensest/tensest.js'

test('mlbRate is the batter’s success rate, or the pitcher’s on the Pitching view', () => {
  const plays = [{ what: 'singled to right' }, { what: 'flew out to right' }, { what: 'struck out looking' }, { what: 'walked' }]
  assert.equal(mlbRate(plays, 'bat'), 50)
  assert.equal(mlbRate([...plays, { what: 'grounded out to short' }], 'pit'), 60)
  assert.equal(mlbRate([], 'bat'), null)
})

test('versusMlb says near inside 5 points, then above/below, then well past 10', () => {
  assert.deepEqual(versusMlb(42, 41), { text: 'Near the MLB average of 41%', tone: null })
  assert.deepEqual(versusMlb(48, 41), { text: 'Above the MLB average of 41%', tone: 'up' })
  assert.deepEqual(versusMlb(48, 59), { text: 'Well below the MLB average of 59%', tone: 'down' })
  assert.deepEqual(versusMlb(54, 59), { text: 'Below the MLB average of 59%', tone: 'down' })
  assert.equal(versusMlb(null, 41), null)
})
