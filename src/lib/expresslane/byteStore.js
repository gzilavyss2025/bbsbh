// EXPRESS LANE, TIER 3a — the byte store.
//
// One clip's mp4 bytes, on this device, keyed by game and playId. The clip
// index (Tier 2) turns a playId into a URL; this turns that URL into a Blob
// that is HERE, which is the condition the film gate waits on.
//
// SPOILER-FREE, on the same footing as clipIndex.js beside it: nothing here
// reads a score, a count, an out or a play. It moves opaque bytes and reports
// how many. Staging bytes for a pitch the scorer has not reached is safe for
// the reason src/api/highlights.js already gives — the store is not the DOM.
// Nothing here renders, and one thing here must never be rendered EARLY: a
// clip's first frame carries the broadcast scorebug burned into the pixels.
//
// IT IS INDEXEDDB BLOBS, NOT THE CACHE API, AND WEBKIT DECIDED THAT.
// `Cache.put()` rejects a 206 by spec, so a Range request cannot also be the
// method that stores the answer. Worse, WebKit issues Range requests whenever
// a <video> loads a URL a service worker intercepts, and expects a real 206
// with Content-Range back; answering from a cached 200 is the classic "plays
// in Chrome, silently fails on iPhone" bug, and synthesising the 206 means
// arrayBuffer() on a 6 MB mp4 inside a content process with a low memory
// ceiling. A Blob avoids all of it: WebKit stores one out of line, so reading
// it back does not transit the JS heap, and URL.createObjectURL is served
// natively with full range support. THE SERVICE WORKER STAYS OUT OF THE
// PLAYBACK PATH — vite.config.js needs no rule for the clip host, and
// ADR-0004's NetworkOnly rule for statsapi.mlb.com is untouched.
//
// ITS OWN DATABASE, SEPARATE FROM THE CLIP INDEX'S, AND THAT IS THE POINT.
// The bytes are disposable and the index is not: a clip re-downloads from a
// deterministic URL, and the index is what makes that possible without asking
// Savant again. So "drop every byte to reclaim the disk" has to be one call
// that leaves the index standing, which a shared database could not give.
// Sharing one would also break the index outright: clipIndex.js asks for
// version 1, and version 1 of a database that has reached 2 is a VersionError
// it degrades to "no cache" forever.
//
// REVOKE EVERY OBJECT URL. `checkoutClip` hands back the call that ends it,
// and a caller leaving a clip makes that call. 84 unrevoked 6 MB blobs is
// about 500 MB resident and a certain crash.
//
// DEGRADES, NEVER THROWS, like every store in this app. IndexedDB is absent in
// a Node test run and refused in some private-browsing modes, so an empty read
// is an ordinary answer rather than an error. WebKit also evicts by ORIGIN
// rather than by entry, so pressure can drop this store, the clip index AND
// localStorage together — which is why `revealedThrough` has to be pushed to
// reveal.js on each advance rather than trusted to survive here.

const DB_NAME = 'bbsbh-express-lane-bytes'
const DB_VERSION = 1
const STORE = 'clips'
const GAME_INDEX = 'gamePk'

// The composite key, flattened. A string key needs no compound-key support and
// sorts one game's clips together, which is all this store asks of it.
function clipKey(gamePk, playId) {
  return `${Number(gamePk)}:${playId}`
}

function openDb(idb) {
  return new Promise((resolve) => {
    if (!idb?.open) {
      resolve(null)
      return
    }
    let request
    try {
      request = idb.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex(GAME_INDEX, 'gamePk', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

// Run one transaction and resolve to a plain outcome. Every call below wants
// the same three things — a store handle, a completion, and no throw — so the
// wiring lives here once.
async function withStore(idb, mode, work, fallback) {
  const db = await openDb(idb)
  if (!db) return fallback
  try {
    return await new Promise((resolve) => {
      let settled = false
      const done = (value) => {
        if (settled) return
        settled = true
        resolve(value)
      }
      let tx
      try {
        tx = db.transaction(STORE, mode)
      } catch {
        done(fallback)
        return
      }
      tx.onabort = () => done(fallback)
      tx.onerror = () => done(fallback)
      work(tx.objectStore(STORE), tx, done)
    })
  } catch {
    return fallback
  } finally {
    db.close?.()
  }
}

// A refusal for space, told apart from every other write failure. Only the
// NAME is reliable across browsers, and it can arrive on the request or on the
// transaction, so both paths read it the same way.
function writeFailure(error) {
  return error?.name === 'QuotaExceededError' ? 'quota' : 'failed'
}

// PUT — the only write. The outcome is a reason rather than a boolean because
// the staging queue treats one refusal differently from all the others: a
// quota refusal is not a failed clip, it is a full disk, and the queue must go
// `blocked` on it instead of driving the next clip into the same wall.
//
//   'stored'      the bytes are here
//   'quota'       the device refused them for space
//   'unavailable' there is no IndexedDB at all
//   'failed'      anything else
export async function putClip(gamePk, playId, blob, { idb = globalThis.indexedDB } = {}) {
  if (!playId || !blob) return 'failed'
  const record = {
    key: clipKey(gamePk, playId),
    gamePk: Number(gamePk),
    playId: String(playId),
    bytes: blob,
    size: typeof blob.size === 'number' ? blob.size : null,
    stagedAt: Date.now(),
  }
  return withStore(
    idb,
    'readwrite',
    (store, tx, done) => {
      try {
        store.put(record)
      } catch (error) {
        done(writeFailure(error))
        return
      }
      tx.oncomplete = () => done('stored')
      tx.onabort = () => done(writeFailure(tx.error))
      tx.onerror = () => done(writeFailure(tx.error))
    },
    'unavailable',
  )
}

// GET — the Blob, or null when it is not staged. Null is an ordinary answer:
// it is what the film gate reads as "the picture is not here yet".
export async function getClip(gamePk, playId, { idb = globalThis.indexedDB } = {}) {
  if (!playId) return null
  return withStore(
    idb,
    'readonly',
    (store, tx, done) => {
      const request = store.get(clipKey(gamePk, playId))
      request.onsuccess = () => done(request.result?.bytes ?? null)
      request.onerror = () => done(null)
    },
    null,
  )
}

// RESUME reads this. Every playId already staged for one game, so a job
// rebuilt after an app restart knows what it does not have to fetch again.
// Keys only — the Blobs stay on the disk until a clip is really played.
export async function stagedPlayIds(gamePk, { idb = globalThis.indexedDB } = {}) {
  return withStore(
    idb,
    'readonly',
    (store, tx, done) => {
      let request
      try {
        request = store.index(GAME_INDEX).getAllKeys(Number(gamePk))
      } catch {
        done(new Set())
        return
      }
      request.onsuccess = () => {
        const ids = new Set()
        for (const key of request.result ?? []) {
          const text = String(key)
          const playId = text.slice(text.indexOf(':') + 1)
          if (playId) ids.add(playId)
        }
        done(ids)
      }
      request.onerror = () => done(new Set())
    },
    new Set(),
  )
}

// EVICTION, which is what keeps the working set near 100-200 MB instead of the
// 546 MB a whole game weighs. The queue decides WHICH clips are behind the
// scorer; this only deletes them. Returns how many rows went.
export async function deleteClips(gamePk, playIds, { idb = globalThis.indexedDB } = {}) {
  const ids = [...(playIds ?? [])].filter(Boolean)
  if (!ids.length) return 0
  return withStore(
    idb,
    'readwrite',
    (store, tx, done) => {
      for (const playId of ids) {
        try {
          store.delete(clipKey(gamePk, playId))
        } catch {
          // One bad key does not abandon the rest of the sweep.
        }
      }
      tx.oncomplete = () => done(ids.length)
      tx.onabort = () => done(0)
      tx.onerror = () => done(0)
    },
    0,
  )
}

// Drop one game entirely — leaving Express Lane, or reclaiming space. The clip
// index survives it, so re-entering the same game re-stages with no lookups.
export async function clearGame(gamePk, { idb = globalThis.indexedDB } = {}) {
  const ids = await stagedPlayIds(gamePk, { idb })
  if (!ids.size) return true
  return (await deleteClips(gamePk, ids, { idb })) === ids.size
}

// How much of one game is on the disk, in bytes.
//
// Safe to show, and the neighbouring figure is not. A byte total states how
// much film is held; a COUNT of staged clips states how many plate appearances
// the game has, which states whether it went to extra innings (ADR-0008). So
// this returns bytes and there is deliberately no `stagedCount` beside it.
export async function stagedBytes(gamePk, { idb = globalThis.indexedDB } = {}) {
  return withStore(
    idb,
    'readonly',
    (store, tx, done) => {
      let request
      try {
        request = store.index(GAME_INDEX).getAll(Number(gamePk))
      } catch {
        done(0)
        return
      }
      request.onsuccess = () => {
        let total = 0
        for (const row of request.result ?? []) total += Number(row?.size ?? 0) || 0
        done(total)
      }
      request.onerror = () => done(0)
    },
    0,
  )
}

// THE STORAGE PROBE, read before staging starts.
//
// `navigator.storage.estimate()` is PADDED AND ROUNDED on WebKit, on purpose,
// so a site cannot fingerprint the disk. It will therefore not warn that the
// disk is nearly full, and a caller must not present these numbers as exact.
// They are worth reading anyway, because they do catch the device with no room
// for the staging lead at all — the case worth stopping for.
//
// `known: false` means the browser told us nothing. That is not a refusal.
export async function storageHeadroom({ storage = globalThis.navigator?.storage } = {}) {
  const unknown = { known: false, quota: null, usage: null, free: null }
  if (!storage?.estimate) return unknown
  try {
    const { quota, usage } = (await storage.estimate()) ?? {}
    if (typeof quota !== 'number' || typeof usage !== 'number') return unknown
    return { known: true, quota, usage, free: Math.max(0, quota - usage) }
  } catch {
    return unknown
  }
}

// Ask the browser to hold this origin's storage through disk pressure. Safari
// grants it to a Home Screen web app, which is the target here. It is a
// request rather than a guarantee, and a false answer changes nothing about
// how staging runs: the bytes were always disposable.
export async function persistStorage({ storage = globalThis.navigator?.storage } = {}) {
  if (!storage?.persist) return false
  try {
    return (await storage.persist()) === true
  } catch {
    return false
  }
}

// PLAYBACK, and the discipline that has to come with it.
//
// An object URL holds its Blob alive until it is revoked, and a scorer walks
// past dozens of 6 MB clips in one session. So the URL is handed out together
// with the call that ends it, and a caller leaving a clip makes that call.
// Calling it twice is harmless.
export function checkoutClip(blob, { urls = globalThis.URL } = {}) {
  if (!blob || !urls?.createObjectURL) return { url: null, release() {} }
  let url = null
  try {
    url = urls.createObjectURL(blob)
  } catch {
    return { url: null, release() {} }
  }
  let released = false
  return {
    url,
    release() {
      if (released || !url) return
      released = true
      try {
        urls.revokeObjectURL?.(url)
      } catch {
        // A revoke that fails leaves one URL alive. It must not take the
        // screen down with it.
      }
    },
  }
}
