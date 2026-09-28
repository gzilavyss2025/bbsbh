// A game called off — postponed OR cancelled — reports abstractGameState
// 'Final' with no result behind it (#1248). The slate must not flip it to a
// result face, which drew a cancelled game as a 0-0 final.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectGameStatus, selectHasResult } from '../src/api/select.js'

// A slate row as schedule.js's normalizeGame flattens it. The cancelled row
// is gamePk 823490 (BAL @ NYY, 2026-09-27) as statsapi reports it.
const row = (detailedState, extra = {}) => ({
  gamePk: 1,
  abstractState: 'Final',
  detailedState,
  reason: '',
  ...extra,
})

test('a cancelled game is called off, labelled Cancelled, and has no result', () => {
  const g = row('Cancelled', { reason: 'Rain' })
  const status = selectGameStatus(g)
  assert.equal(status.isCancelled, true)
  assert.equal(status.isPostponed, false)
  assert.equal(status.isCalledOff, true)
  assert.equal(status.label, 'Cancelled')
  assert.equal(selectHasResult(g), false)
})

test('a postponed game is called off and has no result', () => {
  const g = row('Postponed')
  const status = selectGameStatus(g)
  assert.equal(status.isCalledOff, true)
  assert.equal(status.label, 'Postponed')
  assert.equal(selectHasResult(g), false)
})

test('a played final has a result', () => {
  const g = row('Final')
  assert.equal(selectGameStatus(g).isCalledOff, false)
  assert.equal(selectHasResult(g), true)
})

test('a game shortened by rain still has a result', () => {
  // "Completed Early" is a played, official game — not called off.
  assert.equal(selectHasResult(row('Completed Early: Rain')), true)
})

test('a game not yet final has no result', () => {
  assert.equal(selectHasResult(row('In Progress', { abstractState: 'Live' })), false)
  assert.equal(selectHasResult(row('Scheduled', { abstractState: 'Preview' })), false)
})

test('the same reads work off a full live feed', () => {
  const feed = { gameData: { status: { abstractGameState: 'Final', detailedState: 'Cancelled' } } }
  assert.equal(selectGameStatus(feed).isCalledOff, true)
  assert.equal(selectHasResult(feed), false)
})
