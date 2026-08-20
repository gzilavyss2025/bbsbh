// WHOSE STATE IS THIS? — the shared-device leak, as three primitives.
//
// A local-first store plus an account leaks on a family iPad. User A signs in;
// their state syncs DOWN into localStorage. A signs out — the state stays,
// because local-first means the device keeps working with what it has, and a
// signed-out user is still a user. B signs in, and the device is now holding A's
// state as ordinary local state: every sync channel's "what do I have that the
// server doesn't?" comparison reports it as missing from B's account and
// publishes it there, and every channel that is a RENDER override shows it.
//
// Nulling a sync component's in-memory baseline on sign-out does not prevent
// any of that. It guards against a STALE baseline; here the baseline is
// perfectly good and belongs to the new user, while the state on disk belongs to
// the old one. That mistaken reasoning was in the comments of every channel.
//
// So each channel records WHICH ACCOUNT its local state was last held for, and
// `mergeStrategyFor` (preferences.js) reads it back. This module is only the
// storage mechanics those tags share — the DECISION is `mergeStrategyFor`'s, and
// what `adopt` means is each channel's own, since the channels differ:
// preferences and books and stamps have one document to replace, while the
// reveal mark and the box-score bit are one key PER GAME with nothing to replace
// them with, so their adopt is a sweep.
//
// EVERY CHANNEL KEEPS ITS OWN OWNER KEY. Never one shared tag: the channels sync
// independently, over different endpoints, and a device that reached one but not
// another must not be recorded as holding both. A single tag would have the
// first channel to succeed vouch for the ones that failed.
//
// React-free and dependency-free, with the storage object passed IN and every
// access individually guarded, so no path here throws — same posture as
// preferencesStorage.js and localData.js, and pinned by test/device-owner.test.js.

function keyAt(storage, i) {
  try {
    return storage.key(i)
  } catch {
    return null
  }
}

// Every key with this prefix currently in this storage, or [] if it cannot be
// read at all. Snapshotted into an array before anything mutates it — removing
// while iterating `storage.key(i)` re-indexes the remaining keys underneath you
// and silently skips every other one. That is localData.js's lesson; this is the
// one implementation of it the owner guards share.
function keysWithPrefixIn(storage, prefix) {
  if (!storage || typeof prefix !== 'string' || !prefix) return []
  let length = 0
  try {
    length = Number(storage.length) || 0
  } catch {
    return []
  }
  const out = []
  for (let i = 0; i < length; i += 1) {
    const key = keyAt(storage, i)
    if (typeof key === 'string' && key.startsWith(prefix)) out.push(key)
  }
  return out
}

// Take every key under this prefix off the device. Returns the keys actually
// removed, so a caller can announce each one to whatever is mounted without
// re-deriving the list.
//
// A key that refuses to be removed is skipped rather than thrown over, the same
// posture clearTallyDataIn takes: a partial clear that reports what it did is
// honest, and an exception here would abandon the rest.
export function clearKeysWithPrefixIn(storage, prefix) {
  const keys = keysWithPrefixIn(storage, prefix)
  const cleared = []
  for (const key of keys) {
    try {
      storage.removeItem(key)
      cleared.push(key)
    } catch {
      // Storage refused this key. Keep going — the rest can still go.
    }
  }
  return cleared
}

// The account a channel's local state was last held for. Empty string for
// "nobody's yet", which `mergeStrategyFor` reads as a guest's own state and
// BACKFILLS rather than discards — that is the case the tag exists to carry up,
// not throw away.
export function readOwnerIn(storage, ownerKey) {
  try {
    return storage?.getItem(ownerKey) || ''
  } catch {
    return ''
  }
}

// Records the owner, or removes the tag entirely for a falsy user. Never called
// on sign-OUT: the tag is what protects the NEXT account, so clearing it then
// would turn a foreign device back into a guest's and backfill A's state into
// whoever signs in next.
export function writeOwnerIn(storage, ownerKey, userId) {
  try {
    if (!userId) storage?.removeItem(ownerKey)
    else storage?.setItem(ownerKey, String(userId))
    return true
  } catch {
    return false
  }
}
