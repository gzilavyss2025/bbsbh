import { readOwnerIn, writeOwnerIn } from './deviceOwner.js'

// The localStorage plumbing the local-first stores (stamps, books, preferences)
// each hand-wrote: a guarded read, a guarded write, and the same-tab `storage`
// echo.
//
// Every access here can throw — Safari private mode, a profile that blocks
// storage, a quota error — and the contract in every case is the one those
// stores always had: DEGRADE TO IN-SESSION MEMORY. A read that fails answers
// what `parse(null)` answers (each parser's "nothing stored" value), a write
// that fails is dropped, and nothing throws. This module changes no key name
// and no stored shape; the keys and the parse/serialize pair stay with the
// rules files that own them (src/lib/stamp/stamps.js and friends).

// A same-tab echo of the `storage` event. The browser fires `storage` only in
// OTHER tabs, so without this two hook instances mounted at once in this tab
// would not see each other's writes until a reload. Dispatching the event
// ourselves lets each hook's `storage` listener serve as its single refresh
// path for every source — another tab, this tab, or the cloud merge.
export function notifyStorage(key) {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key }))
  } catch {
    // StorageEvent unavailable — cross-instance updates degrade to next render.
  }
}

// Subscribe to `storage` AND to a back/forward-cache restore (#2937). A page frozen
// in the bfcache misses every `storage` event another tab fires meanwhile, so on a
// persisted `pageshow` this replays `handler` with the event shape a hook already
// reads, `{ key, newValue }`, but only when the stored value differs from the last
// one this subscription saw. That last value is read at subscribe time and after
// every live event on the key (the same-tab echo carries no newValue). The rule
// protects the in-memory session when storage refuses writes or reads, because
// there the stale stored value is not news. It also spares an unchanged Back a
// re-render. The handler keeps its own key filter and merge rules. Returns the
// unsubscribe. useRevealProgress.js keeps its own copy of this restore path (#2917).
const READ_FAILED = Symbol('read failed')
function rawRead(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return READ_FAILED
  }
}

export function onStorageOrRestore(key, handler) {
  let last = rawRead(key)
  function onStorage(e) {
    if (e.key === key || e.key === null) last = rawRead(key)
    handler(e)
  }
  function onPageShow(e) {
    if (!e.persisted) return
    const newValue = rawRead(key)
    if (newValue === READ_FAILED || newValue === last) return
    last = newValue
    handler({ key, newValue })
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('pageshow', onPageShow)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('pageshow', onPageShow)
  }
}

export function localStore(key, parse, serialize) {
  return {
    read() {
      try {
        return parse(window.localStorage.getItem(key))
      } catch {
        return parse(null)
      }
    },
    write(value) {
      try {
        window.localStorage.setItem(key, serialize(value))
      } catch {
        // Storage disabled — the value still applies for this session.
      }
    },
    drop() {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // Nothing to remove, or refused — the caller already treats it as gone.
      }
    },
    notify: () => notifyStorage(key),
  }
}

// The per-channel owner tag (see deviceOwner.js for the leak it closes), with
// the `window.localStorage` access itself guarded — reading that property can
// throw where the calls on it cannot.
export function readOwner(ownerKey) {
  try {
    return readOwnerIn(window.localStorage, ownerKey)
  } catch {
    return ''
  }
}

export function writeOwner(ownerKey, userId) {
  try {
    return writeOwnerIn(window.localStorage, ownerKey, userId)
  } catch {
    return false
  }
}
