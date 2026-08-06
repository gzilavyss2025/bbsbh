// The preference document's storage layer (src/lib/account/preferencesStorage.js).
//
// These are the cases a browser produces and a dev machine never does: a
// private-mode profile that throws on `setItem`, a locked-down one that throws
// on merely reading `window.localStorage`, and a value that is unreadable at the
// moment a storage event fires. The contract in all of them is the same —
// **degrade to in-session memory** — and it is worth pinning because the failure
// mode if it breaks is a white screen on a browser nobody here runs.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PREFS_KEY,
  PREFS_OWNER_KEY,
  preferenceValue,
} from '../src/lib/account/preferences.js'
import {
  browserStorage,
  readOwnerFrom,
  readPreferencesFrom,
  writeOwnerTo,
  writePreferencesTo,
} from '../src/lib/account/preferencesStorage.js'

// A localStorage stand-in whose reads and writes can be made to throw.
function fakeStorage(seed = {}, { throwOnGet = false, throwOnSet = false } = {}) {
  const data = { ...seed }
  return {
    data,
    getItem(key) {
      if (throwOnGet) throw new Error('SecurityError')
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error('QuotaExceededError')
      data[key] = String(value)
    },
    removeItem(key) {
      if (throwOnSet) throw new Error('QuotaExceededError')
      delete data[key]
    },
  }
}

// --------------------------------------------------------------------------
// The ordinary path
// --------------------------------------------------------------------------

test('a stored document reads back', () => {
  const storage = fakeStorage({
    [PREFS_KEY]: JSON.stringify({ club: { value: 147, updatedAt: 5 } }),
  })
  assert.deepEqual(readPreferencesFrom(storage), { club: { value: 147, updatedAt: 5 } })
})

test('the three legacy keys migrate on first read, and the seed is persisted', () => {
  const storage = fakeStorage({
    'bbsbh:favoriteTeam': '158',
    'bbsbh:level': '11',
    'bbsbh:keepAwake': '1',
  })
  const doc = readPreferencesFrom(storage)
  assert.deepEqual(doc, {
    club: { value: 158, updatedAt: 0 },
    level: { value: 11, updatedAt: 0 },
    keepAwake: { value: true, updatedAt: 0 },
  })
  // Durable: the next reader sees it from the document, not the legacy keys.
  assert.deepEqual(JSON.parse(storage.data[PREFS_KEY]), doc)
})

test('the legacy keys are left in place — a rollback must not cost a user their club', () => {
  const storage = fakeStorage({ 'bbsbh:favoriteTeam': '158' })
  readPreferencesFrom(storage)
  assert.equal(storage.data['bbsbh:favoriteTeam'], '158')
})

test('migration is idempotent — the second and third mounted hook write nothing', () => {
  const storage = fakeStorage({ 'bbsbh:favoriteTeam': '158' })
  const first = readPreferencesFrom(storage)
  const written = storage.data[PREFS_KEY]
  const second = readPreferencesFrom(storage)
  assert.deepEqual(second, first)
  assert.equal(storage.data[PREFS_KEY], written)
})

test('write round-trips through the same scrubbing the reader applies', () => {
  const storage = fakeStorage()
  writePreferencesTo(storage, {
    club: { value: 158, updatedAt: 1 },
    nickname: { value: 'Gary', updatedAt: 1 },
  })
  assert.deepEqual(readPreferencesFrom(storage), { club: { value: 158, updatedAt: 1 } })
})

test('the owner tag round-trips and clears', () => {
  const storage = fakeStorage()
  assert.equal(readOwnerFrom(storage), '')
  writeOwnerTo(storage, 'user_a')
  assert.equal(readOwnerFrom(storage), 'user_a')
  assert.equal(storage.data[PREFS_OWNER_KEY], 'user_a')
  writeOwnerTo(storage, '')
  assert.equal(readOwnerFrom(storage), '')
})

// --------------------------------------------------------------------------
// Private mode and a hostile storage
// --------------------------------------------------------------------------

test('a storage that throws on write still returns a usable document', () => {
  // Safari private mode at quota. The migration cannot be persisted, but the
  // visitor still gets their club for this session — which is the whole
  // "degrade to in-session memory" contract.
  const storage = fakeStorage({ 'bbsbh:favoriteTeam': '158' }, { throwOnSet: true })
  const doc = readPreferencesFrom(storage)
  assert.equal(preferenceValue(doc, 'club'), 158)
  assert.equal(storage.data[PREFS_KEY], undefined, 'nothing was persisted, and nothing threw')
})

test('a failed write reports failure rather than throwing', () => {
  const storage = fakeStorage({}, { throwOnSet: true })
  assert.equal(writePreferencesTo(storage, { club: { value: 1, updatedAt: 1 } }), false)
  assert.equal(writeOwnerTo(storage, 'user_a'), false)
  assert.equal(writeOwnerTo(storage, ''), false)
})

test('a storage that throws on READ degrades to "no opinion", not to a crash', () => {
  const storage = fakeStorage({ [PREFS_KEY]: '{"club":{"value":147,"updatedAt":5}}' }, { throwOnGet: true })
  assert.deepEqual(readPreferencesFrom(storage), {})
  assert.equal(readOwnerFrom(storage), '')
})

test('no storage at all is a supported state', () => {
  assert.deepEqual(readPreferencesFrom(null), {})
  assert.equal(readOwnerFrom(null), '')
  assert.equal(writePreferencesTo(null, {}), true, 'nothing to write to is not a failure')
  assert.equal(writeOwnerTo(null, 'u'), true)
})

test('an unreadable owner tag falls back to backfill, the safe direction', () => {
  // 'backfill' only ever publishes what this device already holds. Guessing
  // 'adopt' instead would silently discard a guest's own settings on sign-in.
  assert.equal(readOwnerFrom(fakeStorage({}, { throwOnGet: true })), '')
})

test('browserStorage survives having no window at all — which is how CI runs', () => {
  assert.equal(browserStorage(), null)
})
