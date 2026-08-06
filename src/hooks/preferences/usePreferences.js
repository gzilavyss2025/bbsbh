import { useCallback, useEffect, useState } from 'react'
import {
  PREFS_KEY,
  adoptRemotePreferences,
  applyRemotePreferences,
  preferenceValue,
  setPreference,
} from '../../lib/account/preferences.js'
import {
  browserStorage,
  readOwnerFrom,
  readPreferencesFrom,
  writeOwnerTo,
  writePreferencesTo,
} from '../../lib/account/preferencesStorage.js'

// My Tally's preference store. Mirrors useStamps.js exactly: the rules are the
// React-free core in src/lib/account/preferences.js (unit-tested there, and
// shared verbatim with api/preferences.js so client and server cannot disagree
// about what a valid preference is); this hook owns only the storage I/O and
// the React wiring.
//
// LOCAL-FIRST, and that is the design rather than a fallback posture. A club
// chosen with no account, no network and no Clerk on the deploy at all still
// persists on this device and still works. Signing in merges that document
// upward through PreferencesCloudSync; nothing about the page waits on it.
//
// Storage-disabled (private mode, a locked-down browser) degrades to
// in-session memory: every read and write is wrapped, and React state stays
// authoritative for the session. That is the same degrade the two hooks this
// one absorbed always had.

// All four storage paths live in src/lib/account/preferencesStorage.js, drivable
// from the unit suite with a stub that throws — so private mode is a tested
// path rather than an assumed one. The legacy keys it migrates from are
// deliberately NOT deleted and deliberately NOT kept up to date: leaving them
// costs a few bytes and means a rollback restores the values as of the
// migration, whereas dual-writing would be a drift vector with two sources of
// truth for one setting.
const readPreferences = () => readPreferencesFrom(browserStorage())
const writePreferences = (doc) => writePreferencesTo(browserStorage(), doc)

export const readPrefsOwner = () => readOwnerFrom(browserStorage())
export const writePrefsOwner = (userId) => writeOwnerTo(browserStorage(), userId)

// A same-tab echo of the `storage` event. The browser fires `storage` only in
// OTHER tabs, and several instances of this hook really are mounted at once —
// the slate's level toggle, the header avatar's club, a game view's keep-awake
// switch, and PreferencesCloudSync. Same mechanism, and same reason, as
// useStamps.js's notifyLocalChange.
function notifyLocalChange() {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: PREFS_KEY }))
  } catch {
    // StorageEvent unavailable — cross-instance updates degrade to next render.
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState(readPreferences)

  // One writer for every mutation: apply a pure transform, persist, then echo.
  // No caller touches localStorage or the document shape directly.
  const commit = useCallback((transform) => {
    setPrefs((prev) => {
      const next = transform(prev)
      if (next === prev) return prev
      writePreferences(next)
      return next
    })
    notifyLocalChange()
  }, [])

  const set = useCallback(
    (field, value) => {
      commit((prev) => setPreference(prev, field, value, { now: Date.now() }))
    },
    [commit],
  )

  // The only way a remote document reaches local state (PreferencesCloudSync).
  // Last-write-wins per FIELD, deliberately not per document: two devices
  // changing two different preferences must both win.
  const mergeRemote = useCallback(
    (remote) => {
      commit((prev) => applyRemotePreferences(prev, remote))
    },
    [commit],
  )

  // Replace the document wholesale — the 'adopt' strategy, for when the local
  // one belongs to a different account on a shared device.
  const adoptRemote = useCallback(
    (remote) => {
      commit(() => adoptRemotePreferences(remote))
    },
    [commit],
  )

  useEffect(() => {
    function onStorage(e) {
      // `key === null` is a whole-storage clear, which is also our business.
      if (e.key !== PREFS_KEY && e.key !== null) return
      // `() => readPreferences()`, NOT `readPreferences()` — the difference is
      // a bug, not a style point. `commit` persists INSIDE its state updater,
      // which React runs at render time, but it dispatches the same-tab echo
      // synchronously right after QUEUEING that updater. An eager read here
      // therefore runs before the write it is reacting to and queues the
      // pre-change document behind the change: React applies the updater, then
      // applies this, and the change is reverted in state while localStorage
      // keeps the new value. useScoresUnlocked and useStamps both shipped that
      // bug (ADR-0026's 2026-08-05 amendment, ADR-0036's addendum). Reading
      // from inside the updater puts the read after the write, where it belongs.
      setPrefs(() => readPreferences())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // `has` is what tells a first visit from a deliberate choice: the document
  // records only what the user (or the migration) actually set, so an absent
  // field means "never answered", not "answered with the default".
  const has = useCallback((field) => prefs[field] != null, [prefs])

  return {
    prefs,
    has,
    set,
    mergeRemote,
    adoptRemote,
    club: preferenceValue(prefs, 'club'),
    level: preferenceValue(prefs, 'level'),
    keepAwake: preferenceValue(prefs, 'keepAwake'),
    motion: preferenceValue(prefs, 'motion'),
  }
}
