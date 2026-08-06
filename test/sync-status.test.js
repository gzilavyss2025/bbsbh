// The sync-status reducer (src/lib/account/syncStatus.js) — the mechanism My
// Tally's receipt renders, and the answer to the lesson ADR-0022 records: a
// graceful degrade can mask a hard failure indefinitely.
//
// The distinction these tests exist to protect is `unavailable` vs `error`. A
// 501 is a deploy with no store, which is a SUPPORTED state; a 401 or a dead
// network is a real fault. Collapsing them would either cry wolf on a correct
// deployment or hide a broken one — which is exactly the four-outcomes-into-one
// flattening api/_lib/auth.js was written to undo.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SYNC_CHANNELS,
  initialSyncState,
  isRecoverable,
  lastSyncedAt,
  phaseForResponse,
  reasonForResponse,
  reduceSync,
  rollupSync,
} from '../src/lib/account/syncStatus.js'

const report = (state, channel, phase, extra = {}) =>
  reduceSync(state, { channel, phase, at: 1000, ...extra })

test('the four channels are the four things that cross devices', () => {
  assert.deepEqual([...SYNC_CHANNELS], ['reveal', 'spoiledDays', 'stamps', 'prefs'])
})

test('a deploy with no account feature starts (and stays) off', () => {
  const state = initialSyncState(false)
  assert.equal(rollupSync(state), 'off')
  for (const channel of SYNC_CHANNELS) assert.equal(state[channel].phase, 'off')
})

test('a Clerk-configured deploy starts local — everything works, on this device', () => {
  assert.equal(rollupSync(initialSyncState(true)), 'local')
})

test('an unknown channel or phase is ignored, not stored', () => {
  const state = initialSyncState(true)
  assert.equal(reduceSync(state, { channel: 'nope', phase: 'synced', at: 1 }), state)
  assert.equal(reduceSync(state, { channel: 'prefs', phase: 'excellent', at: 1 }), state)
  assert.equal(reduceSync(state, null), state)
})

test('an unchanged report returns the SAME object, so nothing re-renders on focus', () => {
  let state = initialSyncState(true)
  state = report(state, 'prefs', 'synced')
  assert.equal(reduceSync(state, { channel: 'prefs', phase: 'synced', at: 1000 }), state)
})

test('the rollup is the worst channel — it can never say synced while one is failing', () => {
  let state = initialSyncState(true)
  for (const channel of SYNC_CHANNELS) state = report(state, channel, 'synced')
  assert.equal(rollupSync(state), 'synced')

  state = report(state, 'stamps', 'pulling')
  assert.equal(rollupSync(state), 'pulling')

  state = report(state, 'prefs', 'unavailable')
  assert.equal(rollupSync(state), 'unavailable')

  state = report(state, 'reveal', 'error', { reason: 'auth' })
  assert.equal(rollupSync(state), 'error', 'a real fault outranks a deploy without a store')
})

test('a 501 is unavailable, not an error — it is a supported deployment shape', () => {
  assert.equal(phaseForResponse(501), 'unavailable')
  assert.equal(isRecoverable('unavailable'), false)

  assert.equal(phaseForResponse(401), 'error')
  assert.equal(phaseForResponse(500), 'error')
  assert.equal(phaseForResponse(undefined), 'error')
  assert.equal(isRecoverable('error'), true)

  assert.equal(phaseForResponse(200), 'synced')
  assert.equal(phaseForResponse(204), 'synced')
})

test('the reason is coarse on purpose — a user cannot act on a status code', () => {
  assert.equal(reasonForResponse(401), 'auth')
  assert.equal(reasonForResponse(403), 'auth')
  assert.equal(reasonForResponse(503), 'server')
  assert.equal(reasonForResponse(undefined), 'network')
  assert.equal(reasonForResponse(418), 'unknown')
})

test('a later error keeps the last success time, so "last checked" stays sayable', () => {
  let state = initialSyncState(true)
  state = reduceSync(state, { channel: 'prefs', phase: 'synced', at: 5000 })
  state = reduceSync(state, { channel: 'prefs', phase: 'error', at: 9000, reason: 'network' })
  assert.equal(state.prefs.phase, 'error')
  assert.equal(state.prefs.at, 9000)
  assert.equal(state.prefs.syncedAt, 5000)
  assert.equal(state.prefs.reason, 'network')
})

test('lastSyncedAt is the newest success across every channel, or null', () => {
  let state = initialSyncState(true)
  assert.equal(lastSyncedAt(state), null)
  state = reduceSync(state, { channel: 'prefs', phase: 'synced', at: 5000 })
  state = reduceSync(state, { channel: 'stamps', phase: 'synced', at: 7000 })
  state = reduceSync(state, { channel: 'reveal', phase: 'error', at: 9000 })
  assert.equal(lastSyncedAt(state), 7000)
})

test('rollupSync says off about nothing at all', () => {
  assert.equal(rollupSync({}), 'off')
  assert.equal(rollupSync(null), 'off')
})
