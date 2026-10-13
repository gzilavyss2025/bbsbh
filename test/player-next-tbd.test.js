// Which cards the new player page's tbd module draws (src/screens/player/next/modules/tbd/tbdView.js, #1896).
import test from 'node:test'
import assert from 'node:assert/strict'
import { tbdCards } from '../src/screens/player/next/modules/tbd/tbdView.js'

const bat = { isPitcher: false, twoWay: false }
const arm = { isPitcher: true, twoWay: false }
const both = { isPitcher: false, twoWay: true }

test('Season: percentile rank, Advanced and Run value, in board order, for either role', () => {
  assert.deepEqual(tbdCards('season', 'pitching', arm), ['percentile', 'advanced', 'runvalue'])
})

test('Season, hitting: Command received sits beside Advanced (it hides itself for a man who never caught)', () => {
  assert.deepEqual(tbdCards('season', 'hitting', bat), ['percentile', 'advanced', 'cmdreceived', 'runvalue'])
  assert.ok(!tbdCards('season', 'pitching', arm).includes('cmdreceived'))
})

test('a two-way player gets the percentile and Advanced cards per role, Run value once', () => {
  assert.deepEqual(tbdCards('season', 'hitting', both), ['percentile', 'advanced', 'cmdreceived', 'runvalue'])
  assert.deepEqual(tbdCards('season', 'pitching', both), ['percentile', 'advanced'])
})

test('Career holds nothing here: Prospect rankings moved to #1927', () => {
  assert.deepEqual(tbdCards('career', 'hitting', bat), [])
})

test('History: awards, team history, transactions, media, once per player', () => {
  const all = ['awards', 'timeline', 'transactions', 'media']
  assert.deepEqual(tbdCards('history', 'hitting', bat), all)
  assert.deepEqual(tbdCards('history', 'pitching', arm), all)
  assert.deepEqual(tbdCards('history', 'hitting', both), all)
  assert.deepEqual(tbdCards('history', 'pitching', both), [])
})

test('On the mound: Target command, for a pitching role only', () => {
  assert.deepEqual(tbdCards('on-the-mound', 'pitching', arm), ['targetcommand'])
  assert.deepEqual(tbdCards('on-the-mound', 'pitching', both), ['targetcommand'])
  assert.deepEqual(tbdCards('on-the-mound', 'hitting', bat), [])
})

test('Game log: Foul balls for a pitcher, then Milestone watch last, for either role', () => {
  assert.deepEqual(tbdCards('game-log', 'pitching', arm), ['fouls', 'milestones'])
  assert.deepEqual(tbdCards('game-log', 'hitting', bat), ['milestones'])
  assert.deepEqual(tbdCards('game-log', 'hitting', both), ['milestones'])
  assert.deepEqual(tbdCards('game-log', 'pitching', both), ['fouls', 'milestones'])
})
