// Unit coverage for src/lib/spoiledDays.js — the durable half of the Scores
// Unlocked pass (ADR-0026). These pin the fail-sealed posture: a garbled stored
// value can lose a day's consent, but it can never INVENT one, and no code path
// here produces or touches a reveal mark.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_SPOILED_DAYS,
  addSpoiledDay,
  isDaySpoiled,
  isDayString,
  applyRemoteStates,
  isDayState,
  parseSpoiledDays,
  removeSpoiledDay,
  serializeSpoiledDays,
  statesFromDays,
} from '../src/lib/spoiledDays.js'

// --------------------------------------------------------------------------
// Shape validation — only the app's one date vocabulary is storable
// --------------------------------------------------------------------------
test('isDayString accepts only the YYYY-MM-DD shape toApiDate produces', () => {
  assert.equal(isDayString('2026-07-24'), true)
  for (const bad of ['2026-7-24', '07/24/2026', '2026-07-24T00:00:00Z', '', 'today', null, 20260724]) {
    assert.equal(isDayString(bad), false, `${JSON.stringify(bad)} must not parse as a day`)
  }
})

// --------------------------------------------------------------------------
// parseSpoiledDays — every failure collapses to "nothing spoiled"
// --------------------------------------------------------------------------
test('parseSpoiledDays reads a normal stored list', () => {
  assert.deepEqual(parseSpoiledDays('["2026-07-24","2026-07-22"]'), ['2026-07-24', '2026-07-22'])
})

test('parseSpoiledDays fails SEALED on anything malformed', () => {
  // The spoiler-critical direction: garbage must never unseal a day. Each of
  // these is something a hand-edited or cross-version storage value could hold.
  for (const raw of [null, undefined, '', 'not json', '{"2026-07-24":true}', '42', '"2026-07-24"', '[[]]']) {
    assert.deepEqual(parseSpoiledDays(raw), [], `${JSON.stringify(raw)} must yield no spoiled days`)
  }
})

test('parseSpoiledDays drops non-day entries but keeps the valid ones', () => {
  assert.deepEqual(
    parseSpoiledDays('["2026-07-24", 5, null, "yesterday", "2026-07-23", {"a":1}]'),
    ['2026-07-24', '2026-07-23'],
  )
})

test('parseSpoiledDays dedupes and orders newest first', () => {
  assert.deepEqual(
    parseSpoiledDays('["2026-07-22","2026-07-24","2026-07-22","2026-07-23"]'),
    ['2026-07-24', '2026-07-23', '2026-07-22'],
  )
})

test('parseSpoiledDays caps the list, keeping the newest days', () => {
  const many = Array.from({ length: MAX_SPOILED_DAYS + 50 }, (_, i) => {
    const d = new Date(Date.UTC(2020, 0, 1 + i))
    return d.toISOString().slice(0, 10)
  })
  const out = parseSpoiledDays(JSON.stringify(many))
  assert.equal(out.length, MAX_SPOILED_DAYS)
  assert.equal(out[0], many[many.length - 1]) // newest survives
  assert.equal(out.includes(many[0]), false) // oldest dropped
})

// --------------------------------------------------------------------------
// isDaySpoiled — the one predicate every reader goes through
// --------------------------------------------------------------------------
test('isDaySpoiled matches only a day actually consented to', () => {
  const days = ['2026-07-24', '2026-07-22']
  assert.equal(isDaySpoiled(days, '2026-07-24'), true)
  assert.equal(isDaySpoiled(days, '2026-07-23'), false)
})

test('isDaySpoiled says NO when the caller cannot name the day', () => {
  // A surface that doesn't know its own date must not get an unsealed answer —
  // this is what keeps a missing/lean officialDate failing sealed.
  const days = ['2026-07-24']
  for (const bad of [undefined, null, '', 'today', '2026-7-24']) {
    assert.equal(isDaySpoiled(days, bad), false)
  }
  assert.equal(isDaySpoiled(null, '2026-07-24'), false)
  assert.equal(isDaySpoiled('2026-07-24', '2026-07-24'), false) // not a list
})

// --------------------------------------------------------------------------
// add / remove — consent, and taking it back the same day
// --------------------------------------------------------------------------
test('addSpoiledDay records a day and is idempotent', () => {
  const once = addSpoiledDay([], '2026-07-24')
  assert.deepEqual(once, ['2026-07-24'])
  assert.deepEqual(addSpoiledDay(once, '2026-07-24'), ['2026-07-24'])
})

test('addSpoiledDay ignores a malformed date rather than storing it', () => {
  assert.deepEqual(addSpoiledDay(['2026-07-24'], 'today'), ['2026-07-24'])
  assert.deepEqual(addSpoiledDay([], undefined), [])
})

// The recoverability property: turning the pass off the same day takes the
// consent back, so a mis-tap on the confirm button costs nothing. After 8am no
// caller passes that date any more, which is what makes the day permanent.
test('removeSpoiledDay takes back one day and leaves the others alone', () => {
  const days = ['2026-07-24', '2026-07-23']
  assert.deepEqual(removeSpoiledDay(days, '2026-07-24'), ['2026-07-23'])
  assert.deepEqual(removeSpoiledDay(days, '2026-07-01'), ['2026-07-24', '2026-07-23'])
  assert.deepEqual(removeSpoiledDay([], '2026-07-24'), [])
})

test('add and remove never mutate the list handed in', () => {
  const days = ['2026-07-24']
  addSpoiledDay(days, '2026-07-25')
  removeSpoiledDay(days, '2026-07-24')
  assert.deepEqual(days, ['2026-07-24'])
})

// --------------------------------------------------------------------------
// Round trip — nothing this app writes can be unreadable by its own parser
// --------------------------------------------------------------------------
test('serializeSpoiledDays round-trips through parseSpoiledDays', () => {
  const days = addSpoiledDay(addSpoiledDay([], '2026-07-23'), '2026-07-24')
  assert.deepEqual(parseSpoiledDays(serializeSpoiledDays(days)), days)
})

test('serializeSpoiledDays normalizes junk on the way OUT too', () => {
  assert.equal(serializeSpoiledDays(['2026-07-24', 'nope', 7]), '["2026-07-24"]')
  assert.equal(serializeSpoiledDays(null), '[]')
})

// --------------------------------------------------------------------------
// Cross-device sync — a state map, not a set (see the module header for why)
// --------------------------------------------------------------------------
test('applyRemoteStates adds days the server says are on', () => {
  assert.deepEqual(
    applyRemoteStates(['2026-07-24'], { '2026-07-25': 'on' }),
    ['2026-07-25', '2026-07-24'],
  )
})

// THE reason this is a state map and not a union. Consent on the phone, sync,
// then undo on the phone: a union would pull the stale "on" back in on the next
// fetch and silently reverse the undo. An explicit 'off' has to win.
test('applyRemoteStates removes a day the server says is off', () => {
  assert.deepEqual(applyRemoteStates(['2026-07-25', '2026-07-24'], { '2026-07-25': 'off' }), [
    '2026-07-24',
  ])
})

test('applyRemoteStates leaves days the server says nothing about alone', () => {
  assert.deepEqual(applyRemoteStates(['2026-07-24'], { '2026-07-22': 'on' }), [
    '2026-07-24',
    '2026-07-22',
  ])
  assert.deepEqual(applyRemoteStates(['2026-07-24'], {}), ['2026-07-24'])
})

test('applyRemoteStates degrades to no change on a garbled response', () => {
  const local = ['2026-07-24']
  for (const bad of [null, undefined, 'nope', 42, []]) {
    assert.deepEqual(applyRemoteStates(local, bad), local, `${JSON.stringify(bad)} is inert`)
  }
  // Malformed keys and states are skipped individually, not fatal.
  assert.deepEqual(
    applyRemoteStates(local, { 'not-a-day': 'on', '2026-07-23': 'maybe', '2026-07-22': 'on' }),
    ['2026-07-24', '2026-07-22'],
  )
})

test('applyRemoteStates never invents a day from an off row', () => {
  // An 'off' for a day we never had is a no-op, not an add.
  assert.deepEqual(applyRemoteStates([], { '2026-07-25': 'off' }), [])
})

test('statesFromDays reports only what this device holds, as on', () => {
  assert.deepEqual(statesFromDays(['2026-07-25', '2026-07-24']), {
    '2026-07-25': 'on',
    '2026-07-24': 'on',
  })
  // Absence must mean "no opinion" — a fresh device publishes nothing rather
  // than telling the server to erase the user's history.
  assert.deepEqual(statesFromDays([]), {})
  assert.deepEqual(statesFromDays(null), {})
})

test('isDayState accepts only the two wire states', () => {
  assert.equal(isDayState('on'), true)
  assert.equal(isDayState('off'), true)
  for (const bad of ['ON', '1', true, null, undefined, '']) assert.equal(isDayState(bad), false)
})
