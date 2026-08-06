// The My Tally preference document's rules (src/lib/account/preferences.js).
//
// This module is shared verbatim between the browser and api/preferences.js, so
// every case here is simultaneously a client test and a server test. The ones
// that matter most are the merge cases: a preference that converges wrongly
// shows up on someone's SECOND device, weeks later, which is exactly how the
// spoiled-day backfill gap and the stamps-removal gap both hid.
import assert from 'node:assert/strict'
import test from 'node:test'

import { LEVELS } from '../src/lib/teams.js'
import {
  FIELD_NAMES,
  LEGACY_KEYS,
  LEVEL_SPORT_IDS,
  MAX_CLOCK_SKEW_MS,
  PREFS_KEY,
  adoptRemotePreferences,
  applyRemotePreferences,
  clampUpdatedAt,
  isFieldName,
  isValidValue,
  mergeStrategyFor,
  normalizeEntry,
  normalizePreferences,
  parsePreferences,
  preferenceValue,
  preferencesToPublish,
  seedFromLegacy,
  serializePreferences,
  setPreference,
} from '../src/lib/account/preferences.js'

const at = (n) => n

// --------------------------------------------------------------------------
// The closed field set
// --------------------------------------------------------------------------

test('the field set is exactly the four documented preferences', () => {
  assert.deepEqual([...FIELD_NAMES].sort(), ['club', 'keepAwake', 'level', 'motion'])
})

test('nothing score-bearing can be named as a field', () => {
  // Not a style check — the invariant is that this document holds identity and
  // device behaviour only. A field named after game state would be the first
  // step to storing one.
  for (const name of ['score', 'revealedThrough', 'gamePk', 'scoresUnlocked', 'spoiledDays']) {
    assert.equal(isFieldName(name), false, `${name} must never be a preference`)
  }
})

test('each field validates only its own vocabulary', () => {
  assert.equal(isValidValue('club', 158), true)
  assert.equal(isValidValue('club', 0), false)
  assert.equal(isValidValue('club', -1), false)
  assert.equal(isValidValue('club', 1.5), false)
  assert.equal(isValidValue('club', '158'), false)
  assert.equal(isValidValue('club', 100000), false)

  // The level is a statsapi sportId, the vocabulary the rest of the app already
  // speaks — not a second string name for the same thing.
  assert.equal(isValidValue('level', 1), true)
  assert.equal(isValidValue('level', 14), true)
  assert.equal(isValidValue('level', 16), false, 'ROK is not on the slate toggle')
  assert.equal(isValidValue('level', 'mlb'), false)

  assert.equal(isValidValue('keepAwake', true), true)
  assert.equal(isValidValue('keepAwake', false), true)
  assert.equal(isValidValue('keepAwake', '1'), false)
  assert.equal(isValidValue('keepAwake', 1), false)

  assert.equal(isValidValue('motion', 'system'), true)
  assert.equal(isValidValue('motion', 'reduced'), true)
  assert.equal(isValidValue('motion', 'full'), true)
  assert.equal(isValidValue('motion', 'none'), false)
})

// --------------------------------------------------------------------------
// Malformed local data
// --------------------------------------------------------------------------

test('malformed storage collapses to "no opinion", never to a wrong answer', () => {
  for (const raw of [null, '', 'not json', '[]', '3', '"club"', '{"club":5}']) {
    const doc = parsePreferences(raw)
    assert.deepEqual(doc, {}, `${JSON.stringify(raw)} must parse to {}`)
  }
})

test('a garbled entry is dropped, and the reader falls back rather than inventing', () => {
  const doc = normalizePreferences({
    club: { value: 158, updatedAt: 10 },
    level: { value: 99, updatedAt: 10 }, // not a real sportId
    keepAwake: { value: true, updatedAt: -1 }, // impossible clock
    motion: 'reduced', // not an entry at all
    nickname: { value: 'Gary', updatedAt: 10 }, // not a field
  })
  assert.deepEqual(Object.keys(doc), ['club'])
  assert.equal(preferenceValue(doc, 'club'), 158)
  assert.equal(preferenceValue(doc, 'level'), 1, 'falls back, does not keep 99')
  assert.equal(preferenceValue(doc, 'keepAwake'), false)
  assert.equal(preferenceValue(doc, 'motion'), 'system')
})

test('updatedAt: 0 is legal — it is what a migrated legacy key carries', () => {
  assert.deepEqual(normalizeEntry('club', { value: 158, updatedAt: 0 }), {
    value: 158,
    updatedAt: 0,
  })
  assert.equal(normalizeEntry('club', { value: 158, updatedAt: -1 }), null)
  assert.equal(normalizeEntry('club', { value: 158, updatedAt: 1.5 }), null)
  assert.equal(normalizeEntry('club', { value: 158 }), null)
})

test('serialize round-trips and scrubs on the way out too', () => {
  const doc = { club: { value: 158, updatedAt: 5 }, bogus: { value: 1, updatedAt: 5 } }
  assert.deepEqual(parsePreferences(serializePreferences(doc)), {
    club: { value: 158, updatedAt: 5 },
  })
})

test('the storage key is the documented one', () => {
  assert.equal(PREFS_KEY, 'bbsbh:prefs')
})

// --------------------------------------------------------------------------
// Writing
// --------------------------------------------------------------------------

test('setPreference stamps a clock and leaves the rest alone', () => {
  const first = setPreference({}, 'club', 158, { now: at(1000) })
  const second = setPreference(first, 'level', 11, { now: at(2000) })
  assert.deepEqual(second, {
    club: { value: 158, updatedAt: 1000 },
    level: { value: 11, updatedAt: 2000 },
  })
})

test('an invalid write is a no-op, not a throw and not a blanking', () => {
  const doc = setPreference({}, 'club', 158, { now: at(1000) })
  assert.deepEqual(setPreference(doc, 'club', 'the brewers', { now: at(2000) }), doc)
  assert.deepEqual(setPreference(doc, 'nickname', 'x', { now: at(2000) }), doc)
})

test('an identical write returns the same object so the hook can skip it', () => {
  const doc = setPreference({}, 'club', 158, { now: at(1000) })
  assert.equal(setPreference(doc, 'club', 158, { now: at(1000) }), doc)
})

// --------------------------------------------------------------------------
// Legacy migration
// --------------------------------------------------------------------------

test('the three legacy keys seed the document at updatedAt: 0', () => {
  const doc = seedFromLegacy({}, { club: '158', level: '11', keepAwake: '1' })
  assert.deepEqual(doc, {
    club: { value: 158, updatedAt: 0 },
    level: { value: 11, updatedAt: 0 },
    keepAwake: { value: true, updatedAt: 0 },
  })
})

test('a seeded value loses to ANY real value from another device', () => {
  // This is the whole reason the seed is 0 rather than Date.now(): a fresh
  // install's local default must never overwrite a deliberate choice made on
  // the phone.
  const local = seedFromLegacy({}, { club: '158' })
  const merged = applyRemotePreferences(local, { club: { value: 147, updatedAt: 1 } })
  assert.equal(preferenceValue(merged, 'club'), 147)
})

test('migration never overwrites a document that already answered', () => {
  const doc = setPreference({}, 'club', 147, { now: at(5000) })
  const seeded = seedFromLegacy(doc, { club: '158', level: '14' })
  assert.deepEqual(seeded.club, { value: 147, updatedAt: 5000 })
  assert.deepEqual(seeded.level, { value: 14, updatedAt: 0 })
  // Idempotent: a second pass changes nothing and returns the same object.
  assert.equal(seedFromLegacy(seeded, { club: '158', level: '14' }), seeded)
})

test('garbage in a legacy key seeds nothing', () => {
  assert.deepEqual(seedFromLegacy({}, { club: 'brewers', level: 'x', keepAwake: 'yes' }), {})
  assert.deepEqual(seedFromLegacy({}, {}), {})
})

test('the legacy key names are the ones the app actually shipped', () => {
  assert.deepEqual(LEGACY_KEYS, {
    club: 'bbsbh:favoriteTeam',
    level: 'bbsbh:level',
    keepAwake: 'bbsbh:keepAwake',
  })
})

// --------------------------------------------------------------------------
// Merge — the cases that only ever fail on someone's second device
// --------------------------------------------------------------------------

test('remote-newer wins', () => {
  const local = { club: { value: 158, updatedAt: 100 } }
  const merged = applyRemotePreferences(local, { club: { value: 147, updatedAt: 200 } })
  assert.deepEqual(merged.club, { value: 147, updatedAt: 200 })
})

test('local-newer survives an older remote', () => {
  const local = { club: { value: 158, updatedAt: 300 } }
  const merged = applyRemotePreferences(local, { club: { value: 147, updatedAt: 200 } })
  assert.deepEqual(merged.club, { value: 158, updatedAt: 300 })
})

test('a tie goes to the remote, so a round trip is idempotent', () => {
  const local = { club: { value: 158, updatedAt: 200 } }
  const remote = { club: { value: 147, updatedAt: 200 } }
  const once = applyRemotePreferences(local, remote)
  const twice = applyRemotePreferences(once, remote)
  assert.deepEqual(once.club, { value: 147, updatedAt: 200 })
  assert.deepEqual(twice, once)
})

test('absence means "no opinion", never "erase"', () => {
  // A fresh device with an empty document must not be able to blank the
  // settings of a device that has them.
  const local = { club: { value: 158, updatedAt: 100 }, level: { value: 11, updatedAt: 100 } }
  assert.deepEqual(applyRemotePreferences(local, {}), local)
  assert.deepEqual(applyRemotePreferences(local, null), local)
})

test('simultaneous changes to DIFFERENT fields both win', () => {
  // The case that ruled out a whole-document clock (and Clerk metadata's
  // whole-object PATCH): the phone changes the club, the laptop changes the
  // level, in the same window. Neither may be lost.
  const phone = setPreference({ level: { value: 1, updatedAt: 10 } }, 'club', 147, { now: 500 })
  const laptop = setPreference({ club: { value: 158, updatedAt: 10 } }, 'level', 12, { now: 501 })
  const converged = applyRemotePreferences(phone, laptop)
  assert.equal(preferenceValue(converged, 'club'), 147)
  assert.equal(preferenceValue(converged, 'level'), 12)
})

test('simultaneous changes to the SAME field converge on the later tap, both ways round', () => {
  const early = { club: { value: 158, updatedAt: 500 } }
  const late = { club: { value: 147, updatedAt: 900 } }
  assert.deepEqual(applyRemotePreferences(early, late).club, late.club)
  assert.deepEqual(applyRemotePreferences(late, early).club, late.club)
})

test('a malformed remote degrades to no change rather than a wrong one', () => {
  const local = { club: { value: 158, updatedAt: 100 } }
  for (const remote of [null, undefined, 'x', 42, [], { club: 'nope' }, { club: { value: 0, updatedAt: 999 } }]) {
    assert.deepEqual(applyRemotePreferences(local, remote), local)
  }
})

// --------------------------------------------------------------------------
// Publish — the guest-to-account backfill
// --------------------------------------------------------------------------

test('an empty account takes everything this device holds', () => {
  // The first sign-in. Nothing on the server, so every local field publishes —
  // including the ones seeded from legacy keys at updatedAt: 0, which IS the
  // guest-to-account merge.
  const local = seedFromLegacy({}, { club: '158', level: '11', keepAwake: '1' })
  const changes = preferencesToPublish(local, {})
  assert.deepEqual(changes.map((c) => c.field).sort(), ['club', 'keepAwake', 'level'])
  assert.deepEqual(
    changes.find((c) => c.field === 'club'),
    { field: 'club', value: 158, updatedAt: 0 },
  )
})

test('nothing republishes when the server already agrees', () => {
  const local = { club: { value: 158, updatedAt: 100 } }
  assert.deepEqual(preferencesToPublish(local, local), [])
})

test('only strictly-newer local values publish', () => {
  const known = { club: { value: 147, updatedAt: 200 } }
  assert.deepEqual(preferencesToPublish({ club: { value: 158, updatedAt: 100 } }, known), [])
  assert.deepEqual(preferencesToPublish({ club: { value: 158, updatedAt: 200 } }, known), [])
  assert.deepEqual(preferencesToPublish({ club: { value: 158, updatedAt: 201 } }, known), [
    { field: 'club', value: 158, updatedAt: 201 },
  ])
})

test('a seeded field does not fight a value the server already has', () => {
  const local = seedFromLegacy({}, { club: '158' })
  const known = { club: { value: 147, updatedAt: 1 } }
  assert.deepEqual(preferencesToPublish(local, known), [])
})

test('a device that holds nothing publishes nothing — it cannot erase an account', () => {
  const known = { club: { value: 147, updatedAt: 200 }, level: { value: 12, updatedAt: 200 } }
  assert.deepEqual(preferencesToPublish({}, known), [])
})

test('publish is a comparison against the remote, not a diff against a previous local', () => {
  // The regression this shape exists to prevent: a document that predates
  // sign-in never "changes", so a change log would publish nothing for it,
  // forever (ADR-0026's 2026-08-06 amendment; PR #545 for stamps).
  const untouchedSinceBeforeSignIn = { club: { value: 158, updatedAt: 0 } }
  assert.deepEqual(preferencesToPublish(untouchedSinceBeforeSignIn, {}), [
    { field: 'club', value: 158, updatedAt: 0 },
  ])
})

// --------------------------------------------------------------------------
// Sign-out and account switching — the shared-device leak
// --------------------------------------------------------------------------

test('a guest document backfills into the account that first signs in', () => {
  assert.equal(mergeStrategyFor('', 'user_a'), 'backfill')
  assert.equal(mergeStrategyFor(null, 'user_a'), 'backfill')
  assert.equal(mergeStrategyFor(undefined, 'user_a'), 'backfill')
})

test('signing back in as the same user still backfills', () => {
  assert.equal(mergeStrategyFor('user_a', 'user_a'), 'backfill')
})

test('a DIFFERENT account adopts rather than publishes — user A never lands in user B', () => {
  assert.equal(mergeStrategyFor('user_a', 'user_b'), 'adopt')
})

test('signed out, there is no remote to reconcile against', () => {
  assert.equal(mergeStrategyFor('user_a', ''), 'none')
  assert.equal(mergeStrategyFor('user_a', null), 'none')
})

test('adopting replaces the document outright, so nothing of the previous user survives', () => {
  const usersA = { club: { value: 158, updatedAt: 900 }, keepAwake: { value: true, updatedAt: 900 } }
  const usersBEmptyAccount = {}
  const adopted = adoptRemotePreferences(usersBEmptyAccount)
  assert.deepEqual(adopted, {})
  assert.equal(preferenceValue(adopted, 'club'), 158, 'falls back to the pinned club, not A’s')
  // And crucially: nothing left to publish into B's account.
  assert.deepEqual(preferencesToPublish(adopted, usersBEmptyAccount), [])
  // Where a merge would have leaked A's club upward:
  assert.deepEqual(
    preferencesToPublish(applyRemotePreferences(usersA, usersBEmptyAccount), usersBEmptyAccount)
      .map((c) => c.field),
    ['club', 'keepAwake'],
    'this is what adopt exists to prevent',
  )
})

// --------------------------------------------------------------------------
// Clock skew (server side)
// --------------------------------------------------------------------------

test('a clock in the past is taken as-is', () => {
  assert.equal(clampUpdatedAt(1000, 5000), 1000)
  assert.equal(clampUpdatedAt(0, 5000), 0)
})

test('a future clock is clamped to now, not refused', () => {
  const now = 1_700_000_000_000
  assert.equal(clampUpdatedAt(now + MAX_CLOCK_SKEW_MS + 1, now), now)
  assert.equal(clampUpdatedAt(now + MAX_CLOCK_SKEW_MS, now), now + MAX_CLOCK_SKEW_MS)
})

test('the skew bound is minutes, because it is how long one bad clock can freeze a field', () => {
  // Not a style preference. For as long as a stored `updatedAt` sits in the
  // future, every other device's tap loses the comparison, persists locally,
  // publishes nothing, and is reverted by the next pull. The bound IS that
  // outage's duration, so it belongs in minutes and never in days.
  assert.ok(
    MAX_CLOCK_SKEW_MS <= 15 * 60 * 1000,
    'a device with a fast clock must not be able to pin a preference for hours',
  )
})

test('a clock far in the future cannot outrank an honest device', () => {
  const now = 1_700_000_000_000
  const fast = clampUpdatedAt(now + 47 * 60 * 60 * 1000, now)
  const honest = now + 1000
  assert.ok(honest > fast, "the honest device's later tap must win")
})

test('a missing or nonsense clock becomes now — a write with no clock is still a write', () => {
  assert.equal(clampUpdatedAt(undefined, 5000), 5000)
  assert.equal(clampUpdatedAt('later', 5000), 5000)
  assert.equal(clampUpdatedAt(-5, 5000), 5000)
})

// --------------------------------------------------------------------------
// Gaps phase 5's audit found: real behaviour with no test behind it
// --------------------------------------------------------------------------

test('a field the SERVER has and this device does not is taken — the second-device case', () => {
  // The whole point of the feature, and it had no test: every existing merge
  // case had the field present on BOTH sides. Inverting the `!existing` branch
  // in applyRemotePreferences left the entire suite green.
  const out = applyRemotePreferences({}, { club: { value: 147, updatedAt: 5 } })
  assert.deepEqual(out, { club: { value: 147, updatedAt: 5 } })
})

test('a fresh device takes every remote field, and adds nothing of its own', () => {
  const remote = {
    club: { value: 147, updatedAt: 5 },
    level: { value: 11, updatedAt: 6 },
    keepAwake: { value: true, updatedAt: 7 },
  }
  const out = applyRemotePreferences({}, remote)
  assert.deepEqual(Object.keys(out).sort(), ['club', 'keepAwake', 'level'])
  assert.deepEqual(preferencesToPublish(out, remote), [], 'and publishes nothing back')
})

test('a remote clock in the future does not permanently outrank a later local tap', () => {
  // The merge path had no skew test at all — only the server-side clamp did,
  // which is not where the damage happens.
  const now = 1_700_000_000_000
  const remote = { club: { value: 147, updatedAt: clampUpdatedAt(now + 47 * 3600_000, now) } }
  const merged = applyRemotePreferences({}, remote)
  const tapped = setPreference(merged, 'club', 158, { now: now + 1000 })
  assert.equal(preferenceValue(tapped, 'club'), 158)
  assert.equal(
    preferencesToPublish(tapped, remote).length,
    1,
    'and the tap must actually reach the server, not sit unpublishable',
  )
})

test('LEVEL_SPORT_IDS has not drifted from teams.js LEVELS', () => {
  // preferences.js restates this list rather than importing teams.js (a
  // 1,100-line identity module has no business in a serverless bundle) and its
  // header names itself "the second place to change". Nothing enforced that.
  // Add a rung to LEVELS without adding it here and the slate's level toggle
  // silently no-ops: setPreference rejects the value and returns the same
  // reference, so the button does nothing, with no error.
  assert.deepEqual(
    [...LEVEL_SPORT_IDS].sort((a, b) => a - b),
    LEVELS.map((l) => l.sportId).sort((a, b) => a - b),
  )
})
