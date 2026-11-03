// scripts/lib/records/manager-split.mjs: the change date a source W-L implies (#2761).
import assert from 'node:assert/strict'
import test from 'node:test'
import { findSplit, parseRecord } from '../scripts/lib/records/manager-split.mjs'

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
