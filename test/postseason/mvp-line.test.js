import test from 'node:test'
import assert from 'node:assert/strict'
import { mvpStatLine } from '../../src/lib/postseason/mvpLine.js'

const bat = { atBats: 20, hits: 8, homeRuns: 2, rbi: 6, baseOnBalls: 3, stolenBases: 1 }
const pit = { outs: 19, wins: 2, losses: 0, saves: 0, earnedRuns: 3, strikeOuts: 14, baseOnBalls: 2 }

test('hitter: batting first, AVG without a leading zero', () => {
  const first = mvpStatLine({ batting: { 1: bat }, pitching: {} }, 1)
  assert.deepEqual(first[0], ['AVG', '.400'])
  assert.deepEqual(first[3], ['RBI', '6'])
  assert.equal(first.length, 5)
})

test('pitcher: pitching first, outs as innings', () => {
  const first = mvpStatLine({ batting: {}, pitching: { 2: pit } }, 2)
  assert.deepEqual(first[0], ['IP', '6.1'])
  assert.deepEqual(first[1], ['W-L', '2-0'])
})

test('unknown player: both empty', () => {
  assert.deepEqual(mvpStatLine({ batting: {}, pitching: {} }, 9), [])
})
