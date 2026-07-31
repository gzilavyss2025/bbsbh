// Unit coverage for useGameData.js's lazy-fetch gate (nextEverActiveState in
// useGameDataCore.js): winProb and highlights must not fetch until their
// consuming surface (innings view / box score) is actually opened, but once
// they have, a later visit to a lineup page must not drop the cached result,
// and opening a different game must not inherit the previous game's flag.
import assert from 'node:assert/strict'
import test from 'node:test'
import { nextEverActiveState } from '../src/hooks/useGameDataCore.js'

test('stays inactive across renders where the consuming surface was never opened', () => {
  let state = { resetKey: 42, everActive: false }
  for (const active of [false, false, false]) {
    state = nextEverActiveState(state, active, 42)
  }
  assert.equal(state.everActive, false)
})

test('latches active on first visit to the consuming surface', () => {
  let state = { resetKey: 42, everActive: false }
  state = nextEverActiveState(state, false, 42) // lineup page
  state = nextEverActiveState(state, true, 42) // innings/box score opened
  assert.equal(state.everActive, true)
})

test('stays latched after navigating back away from the consuming surface', () => {
  let state = { resetKey: 42, everActive: false }
  state = nextEverActiveState(state, true, 42) // opened once
  state = nextEverActiveState(state, false, 42) // back to a lineup page
  assert.equal(state.everActive, true, 'a later visit must not drop the cached fetch')
})

test('a new game (resetKey change) drops the previous game latch', () => {
  let state = { resetKey: 42, everActive: true } // game 42's surface was visited
  state = nextEverActiveState(state, false, 99) // cold open on game 99's lineup1
  assert.equal(state.resetKey, 99)
  assert.equal(state.everActive, false, 'game 99 must not inherit game 42s flag')
})

test('a new game that opens directly on the consuming surface seeds active immediately', () => {
  let state = { resetKey: 42, everActive: true }
  state = nextEverActiveState(state, true, 99) // e.g. a deep link straight to boxscore
  assert.equal(state.resetKey, 99)
  assert.equal(state.everActive, true)
})

test('returns the same object reference when nothing changes (no needless re-render)', () => {
  const state = { resetKey: 42, everActive: true }
  const next = nextEverActiveState(state, false, 42)
  assert.equal(next, state)
})
