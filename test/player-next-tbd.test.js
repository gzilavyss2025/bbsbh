// Which cards the new player page's tbd module draws (src/screens/player/next/modules/tbd/tbdView.js, #1896).
import test from 'node:test'
import assert from 'node:assert/strict'
import { tbdCards } from '../src/screens/player/next/modules/tbd/tbdView.js'

const bat = { isPitcher: false, twoWay: false }
const arm = { isPitcher: true, twoWay: false }
const both = { isPitcher: false, twoWay: true }

test('Season: only Command received is left, on the hitting role (the other cards have their own modules)', () => {
  assert.deepEqual(tbdCards('season', 'pitching', arm), [])
  assert.deepEqual(tbdCards('season', 'hitting', bat), ['cmdreceived'])
  assert.deepEqual(tbdCards('season', 'hitting', both), ['cmdreceived'])
  assert.deepEqual(tbdCards('season', 'pitching', both), [])
})

test('Career holds nothing here: Prospect rankings moved to #1927', () => {
  assert.deepEqual(tbdCards('career', 'hitting', bat), [])
})

test('History: team history and media, once per player (Awards and Transactions have their own modules)', () => {
  const all = ['timeline', 'media']
  assert.deepEqual(tbdCards('history', 'hitting', bat), all)
  assert.deepEqual(tbdCards('history', 'pitching', arm), all)
  assert.deepEqual(tbdCards('history', 'hitting', both), all)
  assert.deepEqual(tbdCards('history', 'pitching', both), [])
})

test('On the mound: nothing left here (Target command has its own module)', () => {
  assert.deepEqual(tbdCards('on-the-mound', 'pitching', arm), [])
  assert.deepEqual(tbdCards('on-the-mound', 'hitting', bat), [])
})

test('Game log: Foul balls for a pitcher only (Milestone watch has its own module)', () => {
  assert.deepEqual(tbdCards('game-log', 'pitching', arm), ['fouls'])
  assert.deepEqual(tbdCards('game-log', 'pitching', both), ['fouls'])
  assert.deepEqual(tbdCards('game-log', 'hitting', bat), [])
  assert.deepEqual(tbdCards('game-log', 'hitting', both), [])
})
