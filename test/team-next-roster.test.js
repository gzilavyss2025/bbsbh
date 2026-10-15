import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rosterCount, transactionsDoor } from '../src/screens/team/next/roster/rosterData.js'

test('the transactions door keeps ?d= and ?s=', () => {
  assert.equal(transactionsDoor(158, '2026-05-01', 1), '/team/milwaukee-brewers-158/transactions?d=2026-05-01&s=1')
})

test('the transactions door with no date carries only ?s=', () => {
  assert.equal(transactionsDoor(158, undefined, 1), '/team/milwaukee-brewers-158/transactions?s=1')
})

test('no transactions door below MLB: that feed has no minor-league rows', () => {
  assert.equal(transactionsDoor(556, '2026-05-01', 11), null)
})

test('the jump-bar count is the players on the roster', () => {
  assert.equal(rosterCount({ position: [1, 2], pitchers: [3] }), 3)
})
