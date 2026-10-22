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

test('closer with a few DH at-bats stays a pitcher', () => {
  const closer = { outs: 8, wins: 0, losses: 0, saves: 3, earnedRuns: 0, strikeOuts: 6 }
  const first = mvpStatLine({ batting: { 3: { ...bat, atBats: 6 } }, pitching: { 3: closer } }, 3)
  assert.equal(first[0][0], 'IP')
})

test('hitter who pitched one inning stays a hitter', () => {
  const mop = { outs: 3, wins: 0, losses: 0, saves: 0, earnedRuns: 1, strikeOuts: 0 }
  const first = mvpStatLine({ batting: { 4: { ...bat, atBats: 5 } }, pitching: { 4: mop } }, 4)
  assert.equal(first[0][0], 'AVG')
})
