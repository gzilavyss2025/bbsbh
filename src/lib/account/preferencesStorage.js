// The localStorage side of the preference document, kept separate from both the
// rules (preferences.js) and the React wiring (hooks/preferences/usePreferences.js)
// for one reason: **private mode has to be a tested path, not an assumed one.**
//
// Every browser storage call here can throw, and in more ways than the obvious
// one. Safari's private mode has historically thrown on `setItem` at quota;
// a locked-down profile can throw on merely READING `window.localStorage`, before
// any method is called; and a storage event can fire while the underlying value
// is unreadable. So every access takes a `storage` object passed in, every one is
// wrapped, and the whole module is drivable from the unit suite with a stub that
// throws on demand (test/preferences-storage.test.js).
//
// The contract in every failure case is the same and is the one the two hooks
// this replaced always had: **degrade to in-session memory.** A preference the
// user sets still applies for this visit; it just does not survive the tab. No
// path here throws, and no path returns a wrong answer instead of no answer.

import {
  LEGACY_KEYS,
  PREFS_KEY,
  PREFS_OWNER_KEY,
  parsePreferences,
  seedFromLegacy,
  serializePreferences,
} from './preferences.js'

// `window.localStorage` itself, or null. Reading the property can throw — that
// is not a hypothetical, it is how a browser configured to block storage
// signals it — so the resolution is guarded too, not just the calls on it.
export function browserStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

function getItem(storage, key) {
  try {
    return storage ? storage.getItem(key) : null
  } catch {
    return null
  }
}

function setItem(storage, key, value) {
  try {
    if (storage) storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

// Read the document, seeding it once from the three legacy single-purpose keys
// it replaced, and persisting the seed so the migration is durable.
//
// Idempotent by construction: `seedFromLegacy` returns the SAME object when it
// had nothing to add, so the second and third mounted instance of the hook
// write nothing at all. And it is safe with no storage — an unreadable browser
// yields `{}` and every reader falls back, which is exactly right.
export function readPreferencesFrom(storage) {
  const stored = parsePreferences(getItem(storage, PREFS_KEY))
  const legacy = {}
  for (const [field, key] of Object.entries(LEGACY_KEYS)) {
    legacy[field] = getItem(storage, key)
  }
  const seeded = seedFromLegacy(stored, legacy)
  // A failed write is not a failed read. The seeded document is returned either
  // way, so a private-mode visitor still gets their old club for this session.
  if (seeded !== stored) setItem(storage, PREFS_KEY, serializePreferences(seeded))
  return seeded
}

export function writePreferencesTo(storage, doc) {
  return setItem(storage, PREFS_KEY, serializePreferences(doc))
}

// Which account's remote document was last merged into the local one — the
// shared-device guard. See `mergeStrategyFor` for the leak it prevents.
//
// An unreadable owner tag resolves to '', which `mergeStrategyFor` treats as
// 'backfill'. That is the safe direction on purpose: backfill only ever
// publishes what this device already holds, whereas guessing 'adopt' would
// silently discard a guest's own settings on every sign-in.
export function readOwnerFrom(storage) {
  return getItem(storage, PREFS_OWNER_KEY) || ''
}

export function writeOwnerTo(storage, userId) {
  if (!userId) {
    try {
      if (storage) storage.removeItem(PREFS_OWNER_KEY)
      return true
    } catch {
      return false
    }
  }
  return setItem(storage, PREFS_OWNER_KEY, String(userId))
}
