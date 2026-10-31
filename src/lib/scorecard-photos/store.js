// Photos of your own paper scorecard, attached to a stamp (#2511). DEVICE ONLY (Gary, 2026-10-23):
// IndexedDB in this browser, never synced, never uploaded. Up to four a stamp (Gary, 2026-10-31).
//
// A photo may show the final score, so it renders only on the Game Log's own pages, where every
// game is one its owner already revealed (ADR-0035). scripts/check-stamp-surfaces.mjs holds that
// line for the component, ScorecardPhotos.jsx.
//
// One record per stamp: { gamePk, photos: [{ id, blob, addedAt }] }. Every read and write degrades
// (no IndexedDB, private mode, a quota error) to "no photos" or false, never a throw.

export const MAX_PHOTOS = 4
const DB_NAME = 'bbsbh-scorecard-photos'
const DB_VERSION = 1
const STORE = 'photos'

// Pure: the list with one more photo, unless the stamp is full.
export function withPhoto(list, photo) {
  return list.length >= MAX_PHOTOS ? list : [...list, photo]
}

export function withoutPhoto(list, id) {
  return list.filter((p) => p.id !== id)
}

function openDb(idb) {
  return new Promise((resolve) => {
    if (!idb?.open) return resolve(null)
    let request
    try {
      request = idb.open(DB_NAME, DB_VERSION)
    } catch {
      return resolve(null)
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'gamePk' })
    }
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

// Run one request in one transaction; `fallback` on any failure.
async function run(idb, mode, act, fallback) {
  const db = await openDb(idb)
  if (!db) return fallback
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, mode)
      const request = act(tx.objectStore(STORE))
      let result = fallback
      if (request) request.onsuccess = () => { result = request.result }
      tx.oncomplete = () => resolve(mode === 'readwrite' ? true : (result ?? fallback))
      tx.onerror = () => resolve(fallback)
      tx.onabort = () => resolve(fallback)
    })
  } catch {
    return fallback
  } finally {
    db.close?.()
  }
}

export async function loadPhotos(gamePk, { idb = globalThis.indexedDB } = {}) {
  const record = await run(idb, 'readonly', (s) => s.get(Number(gamePk)), null)
  return Array.isArray(record?.photos) ? record.photos : []
}

export function savePhotos(gamePk, photos, { idb = globalThis.indexedDB } = {}) {
  return run(idb, 'readwrite', (s) => (photos.length
    ? s.put({ gamePk: Number(gamePk), photos: photos.slice(0, MAX_PHOTOS) })
    : s.delete(Number(gamePk))), false)
}

export function allPhotoRecords({ idb = globalThis.indexedDB } = {}) {
  return run(idb, 'readonly', (s) => s.getAll(), [])
}

// "Erase this device" calls this beside clearing the bbsbh: keys.
export function clearAllPhotos({ idb = globalThis.indexedDB } = {}) {
  return run(idb, 'readwrite', (s) => s.clear(), false)
}

export function photoExportFilename(now = Date.now()) {
  const iso = new Date(Number.isFinite(now) ? now : 0).toISOString()
  return `tally-scorecard-photos-${iso.slice(0, 10)}.json`
}
