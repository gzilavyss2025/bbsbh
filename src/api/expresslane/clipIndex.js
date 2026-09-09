// EXPRESS LANE, TIER 2 — the clip index.
//
// One map per game: `playId -> { mp4Url, posterUrl, durationSec }`. The rail
// (rail.js) is the complete event list; this is the sparse overlay of film
// that sits on top of it.
//
// SPOILER-FREE, and that is a positive statement rather than a missing gate.
// Nothing here reads a score, a count, an out or a play. There is no prose:
// no clip title, no blurb, no result. Every value is a URL, a duration or a
// null, and a URL is built from a `playId` the app already holds. So this
// module is safe at render top-level, on any surface — unlike rail.js beside
// it, which is reveal-only.
//
// TWO CAUTIONS FOR ITS CALLERS, both of which this module cannot enforce:
//
//   1. A POSTER CARRIES THE BROADCAST SCOREBUG, BURNED INTO THE PIXELS —
//      score, inning, count and outs, read off real frames rather than
//      assumed. The URL is safe; the picture is not. Render a poster only
//      inside a play the reader has ALREADY revealed. Never use the NEXT
//      clip's poster as a loading placeholder: pitch N+1's frame shows the
//      result of the at-bat still being scored. Use a neutral placeholder.
//   2. NEVER PRINT A GAME-WIDE CLIP TOTAL. "Pitch 47 of 333" states how long
//      the game ran, which states whether it went to extra innings — straight
//      against ADR-0008. Show position within the current half only, and keep
//      the same rule on any staging or progress indicator.
//
// THE PLAYABLE MP4 COMES FROM SAVANT, AND ONLY FROM SAVANT.
// `https://baseballsavant.mlb.com/sporty-videos?playId={playId}` returns HTML
// that carries a `sporty-clips.mlb.com/{opaque}.mp4` URL. It is ungated
// (`access-control-allow-origin: *`), cheap (~10.3 KB gzipped, ~0.12 s),
// cached, and DETERMINISTIC — three calls for one playId returned an
// identical URL — so the answer is worth memoizing and worth persisting.
//
// DO NOT USE `fastball-clips.mlb.com/{gamePk}/{home|away}/{playId}.mp4`. It is
// derivable, and it is byte-for-byte the same asset, and it is unusable: it is
// Referer-locked to mlb.com. From this origin a `<video>` gives
// MEDIA_ERR_SRC_NOT_SUPPORTED. It is not written anywhere in this file on
// purpose.
//
// NETWORK DISCIPLINE, WHICH IS NOT OPTIONAL. `sporty-clips.mlb.com` — the host
// that serves the BYTES, which this module never fetches — blocks automated
// access. It began returning empty bodies and then a hard 403 after roughly 25
// requests in a few minutes. So nothing here ever bursts: `resolveClipUrl`
// makes ONE request for ONE playId on demand, and `buildClipIndex` walks its
// list one at a time and stops early when the answers stop arriving. Do not
// add a parallel prefetcher, in this file or above it.
//
// DEGRADES, NEVER THROWS. Clips publish 8 to 26 minutes after the pitch, so a
// just-played at-bat has a `playId` and no clip. A lookup that fails, 404s or
// has not published yet resolves to `mp4Url: null`, which a caller renders as
// "not posted yet" — the same convention every MiLB surface in this app uses.
// There are no clips at all before 2016, none for MiLB (sportIds 11-14,
// verified zero), and none for All-Star or exhibition games (`gameType: "A"`).
// Each of those is the same empty index, reached by the same path.

const SAVANT_LOOKUP = 'https://baseballsavant.mlb.com/sporty-videos?playId='
const POSTER_BASE = 'https://img.mlbstatic.com/mlb-photos/image/upload'
const DEFAULT_TIMEOUT_MS = 10_000

// The mp4 the Savant page points at. Matched by host and extension rather than
// by the markup around it, so a template change on their side does not break
// the parse. First match wins; the page carries one clip.
const SPORTY_MP4 = /https:\/\/sporty-clips\.mlb\.com\/[^"'\s<>\\]+\.mp4/

// Pull the playable mp4 URL out of a `sporty-videos` response body. Pure, so
// the parse is testable with no network at all. Returns null for an empty
// body, an error page, or a play with no clip.
export function parseSportyVideoHtml(html) {
  const match = SPORTY_MP4.exec(String(html ?? ''))
  if (!match) return null
  // The URL sits in an HTML attribute, so an ampersand may arrive escaped.
  return match[0].replace(/&amp;/g, '&')
}

// playId -> in-flight or resolved lookup. This memoizes the REQUEST, not only
// its result, for the reason staticJson.js gives: a page mounts its cards on
// one tick, so a cache assigned after the `await` lets every caller that
// started before the first resolved fire its own copy.
//
// A MISS IS NOT CACHED. A clip that has not published yet resolves to null and
// the entry is dropped, so the same playId asked again 20 minutes later makes
// a fresh request. Caching the miss would seal a game against its own film for
// the length of the session.
const clipUrlCache = new Map()

// THE SHARED RESOLVER. One playId in, one playable mp4 URL out, or null.
//
// This is the single place in the app that turns a `playId` into a clip URL.
// Import it; do not write a second one. `fetchImpl` is injectable so a test —
// or another feature's test — can drive it with a fake, and so nothing here
// needs a live network.
//
// Never throws. A refusal, a timeout, an abort and a play with no clip all
// return null, which is the "not posted yet" answer.
export async function resolveClipUrl(
  playId,
  { fetchImpl = null, signal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  if (!playId || signal?.aborted) return null
  const cached = clipUrlCache.get(playId)
  if (cached) return cached

  const doFetch = fetchImpl ?? ((...args) => globalThis.fetch(...args))
  const pending = (async () => {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) controller.abort()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await doFetch(`${SAVANT_LOOKUP}${encodeURIComponent(playId)}`, {
        credentials: 'omit',
        signal: controller.signal,
      })
      if (!res?.ok) return null
      return parseSportyVideoHtml(await res.text())
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  })()

  clipUrlCache.set(playId, pending)
  const url = await pending
  // Keep the hit, drop the miss. See the cache's own note above.
  if (!url) clipUrlCache.delete(playId)
  return url
}

// A clip's poster frame. NEEDS NO NETWORK CALL — it derives from the playId
// alone, on the same Cloudinary-style transform path the rest of this app
// already reads mlbstatic images through.
//
// `feed` is the booth: every clip exists in BOTH 'home' and 'away' at no extra
// cost. `width` picks the rendition.
//
// Read the scorebug caution at the top of this file before you render one.
export function clipPosterUrl(playId, { feed = 'home', width = 640 } = {}) {
  if (!playId) return null
  const booth = feed === 'away' ? 'away' : 'home'
  return `${POSTER_BASE}/w_${width},q_auto:good/fastball/${playId}_${booth}.jpg`
}

// One index entry, in the shape the whole feature reads:
//   mp4Url      the playable clip, or null for "not posted yet"
//   posterUrl   derived, always present, gated by WHERE it may render
//   durationSec optional; null until something supplies it (see below)
function entryFor(playId, mp4Url, durationSec, feed) {
  return {
    playId,
    mp4Url: mp4Url ?? null,
    posterUrl: clipPosterUrl(playId, { feed }),
    durationSec: typeof durationSec === 'number' ? durationSec : null,
  }
}

// Read an optional duration for one playId out of a Map or a plain object.
function durationFor(durations, playId) {
  if (!durations) return null
  if (typeof durations.get === 'function') return durations.get(playId) ?? null
  return durations[playId] ?? null
}

// Build the index for a list of playIds — ONE AT A TIME, in the order given.
//
// Sequential on purpose. The lookups themselves are cheap, but a burst is the
// shape that gets a client blocked, and the block is silent and mid-game. A
// queue that reads as a person watching clips keeps working.
//
// `maxConsecutiveMisses` is the circuit breaker. Once that many lookups in a
// row come back empty, this stops asking and marks the rest not posted. Two
// different states share that shape and both want the same answer: a host that
// has started refusing, and the publication frontier of a game that finished
// minutes ago, where the tail of the list simply does not exist yet. Asking
// eighty more times helps neither.
//
// Every requested playId gets an entry, resolved or not, so a caller can index
// straight off a rail row and get "not posted yet" rather than `undefined`.
export async function buildClipIndex(
  playIds,
  {
    fetchImpl = null,
    signal = null,
    feed = 'home',
    durations = null,
    maxConsecutiveMisses = 5,
  } = {},
) {
  const index = new Map()
  let misses = 0
  let stopped = false
  for (const playId of playIds ?? []) {
    if (!playId) continue
    if (stopped || signal?.aborted) {
      index.set(playId, entryFor(playId, null, durationFor(durations, playId), feed))
      continue
    }
    const url = await resolveClipUrl(playId, { fetchImpl, signal })
    index.set(playId, entryFor(playId, url, durationFor(durations, playId), feed))
    misses = url ? 0 : misses + 1
    if (misses >= maxConsecutiveMisses) stopped = true
  }
  return index
}

// ---------------------------------------------------------------------------
// The IndexedDB cache, keyed by gamePk.
//
// Worth persisting because the Savant token is deterministic: the same playId
// gives the same URL on every call, so the index never goes stale and staging
// survives an app restart. Only `mp4Url` and `durationSec` are stored — a
// poster derives for free, and storing one would freeze the booth and the
// rendition into the record.
//
// Every path degrades to "no cache" rather than throwing. IndexedDB is absent
// in a Node test run, refused in some private-browsing modes, and WebKit
// evicts by ORIGIN under storage pressure, so an empty read is normal and not
// an error. The bytes behind this index are disposable for the same reason.
// ---------------------------------------------------------------------------

const DB_NAME = 'bbsbh-express-lane'
const DB_VERSION = 1
const STORE = 'clip-index'

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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'gamePk' })
    }
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

// The cached index for one game, as the same entry shape `buildClipIndex`
// returns. An empty Map means "nothing cached", which is the answer for a
// first visit, a cleared store, and a browser with no IndexedDB at all.
export async function loadClipIndex(gamePk, { idb = globalThis.indexedDB, feed = 'home' } = {}) {
  const db = await openDb(idb)
  if (!db) return new Map()
  try {
    const record = await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(Number(gamePk))
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => resolve(null)
    })
    const index = new Map()
    for (const [playId, row] of Object.entries(record?.clips ?? {})) {
      index.set(playId, entryFor(playId, row?.mp4Url, row?.durationSec, feed))
    }
    return index
  } catch {
    return new Map()
  } finally {
    db.close?.()
  }
}

// Persist one game's index. Returns true when the write landed, false when it
// could not — a caller carries on either way, because the index rebuilds from
// the same deterministic lookups.
export async function saveClipIndex(gamePk, index, { idb = globalThis.indexedDB } = {}) {
  const db = await openDb(idb)
  if (!db) return false
  try {
    const clips = {}
    for (const [playId, entry] of index ?? []) {
      if (!entry?.mp4Url) continue
      clips[playId] = { mp4Url: entry.mp4Url, durationSec: entry.durationSec ?? null }
    }
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ gamePk: Number(gamePk), clips, savedAt: Date.now() })
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    })
  } catch {
    return false
  } finally {
    db.close?.()
  }
}

// ---------------------------------------------------------------------------
// DURATIONS AND TITLES — deliberately not fetched here yet.
//
// `fastball-gateway.mlb.com/graphql` serves them through
// `mediaPlayback(ids: [...], idType: PLAY_ID)`. It is ungated, it reflects the
// caller's origin for CORS, and it batches to a MAXIMUM OF 100 IDS — 200 fails
// with "Error reading data" — so a whole game costs four calls.
//
// What is NOT verified is the selection set: which fields to ask that resolver
// for. This repo's rule is to check a field path against a real response and
// never to guess one, so the call waits for one live probe rather than
// shipping an invented query. `durationSec` is already in the entry shape and
// `buildClipIndex` already takes a `durations` map, so closing this changes no
// caller.
//
// It stays optional in any case. The index must not depend on it, and a clip's
// duration must never be printed BEFORE the clip plays: terminal clips run
// 4.34 to 12.11 MB precisely because a longer one holds more play developing,
// so the runtime of the next clip tells a scorer what kind of play is coming
// (ADR-0046, and the film gate's own waiting-indicator rule).
// ---------------------------------------------------------------------------
