// Vercel Blob helpers shared by api/ballpark-photo.js and api/identity-logo.js: sniff, own-URL
// checks, reclaiming orphans, and the one admin upload flow (method, token, admin, body, put).
// @vercel/blob is imported lazily: a deploy without a store pays nothing at cold start.
import { authenticateAdmin } from './adminAuth.js'
import { privateJson, readRawBody, requestUrl } from './nodeHandler.js'

// Content sniffing, not content-type trust. The header says whatever the caller
// typed; these are the first bytes of the file itself. It is a small check and
// it is not the security boundary (the allowlist above it is) — its job is to
// keep a mistyped upload from becoming a broken <img> on the live site, and to
// make sure the extension we store matches what the bytes actually are.
const SIGNATURES = [
  { ext: 'jpg', contentType: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'png', contentType: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
]

export function sniffImage(bytes) {
  if (!bytes || bytes.byteLength < 8) return null
  for (const sig of SIGNATURES) {
    if (sig.magic.every((byte, i) => bytes[i] === byte)) return sig
  }
  return null
}

// A URL is safe to delete only if it is one of ours. The token would refuse a
// foreign store anyway, but an admin's hand-typed override could be ANY https
// URL — including a page on somebody else's site that we must not so much as
// send a delete for. Checking the host before the call keeps that from being
// the token's problem to catch.
//
// With BLOB_READ_WRITE_TOKEN set (`vercel_blob_rw_<storeId>_<secret>`), the host
// must be THIS store's own; any other Vercel Blob store is somebody else's.
const STORE_HOST_SUFFIX = '.public.blob.vercel-storage.com'
export function isOwnBlobUrl(raw, env = process.env) {
  try {
    const url = new URL(String(raw))
    if (url.protocol !== 'https:' || !url.hostname.endsWith(STORE_HOST_SUFFIX)) return false
    const storeId = /^vercel_blob_rw_([a-z0-9]+)_/i.exec(env.BLOB_READ_WRITE_TOKEN ?? '')?.[1]
    return !storeId || url.hostname === `${storeId.toLowerCase()}${STORE_HOST_SUFFIX}`
  } catch {
    return false
  }
}

// The same check, narrowed to one folder of the store — what a DELETE needs.
// The host check alone proves only "ours", and our store holds more than one
// kind of thing: ballpark photos, club marks, and whatever comes next. A
// replaces= pointing at a neighbouring folder is still our own URL, so the
// host check waves it through and the upload quietly deletes an object some
// other saved override still points at. A delete should only ever reach the
// folder the uploader just wrote to.
export function isOwnBlobUrlUnder(raw, prefix) {
  if (!isOwnBlobUrl(raw) || !prefix) return false
  try {
    return new URL(String(raw)).pathname.startsWith(`/${prefix}`)
  } catch {
    return false
  }
}

// --- reclaiming the upload a save replaced -----------------------------------
//
// Every upload lands on a UNIQUE pathname (`addRandomSuffix` below), and that
// stays: overwriting a stable one would leave the old bytes cached hard at the
// CDN, so "I replaced the photo" would keep showing the previous one. The price
// of that choice is that the bytes a save REPLACES stay in the store with
// nothing pointing at them.
//
// The upload endpoints already reclaim ONE case: a draft abandoned by
// re-uploading before saving, which the drawer names in `?replaces=`. They
// cannot reclaim the other, and deliberately do not try -- at upload time the
// old URL is still the live one, so deleting it and then failing the save would
// break the page it is still rendering on.
//
// The SAVE is where it becomes dead, and where both maps are already in hand.

// Every URL in our own store, under `prefix`, that a store map's values name.
// Both stores hold flat string values (sanitizeOverrides and
// sanitizeIdentityOverrides each drop anything else), so this does not recurse.
function blobUrlsIn(map, prefix) {
  const found = new Set()
  for (const value of Object.values(map ?? {})) {
    if (typeof value === 'string' && isOwnBlobUrlUnder(value, prefix)) found.add(value)
  }
  return found
}

// What a save orphaned: named by `prev`, named by nothing in `keep`.
//
// `keep` is a LIST of maps rather than one, because "still referenced" is wider
// than "in the new map" wherever a store keeps an undo history -- an entry that
// can still be restored is still a reference. Two clubs sharing one mark also
// keep it when only one of them is re-pointed, which falls out of the same set.
export function reclaimableBlobUrls(prev, keep, prefix) {
  const kept = new Set()
  for (const map of keep ?? []) for (const url of blobUrlsIn(map, prefix)) kept.add(url)
  return [...blobUrlsIn(prev, prefix)].filter((url) => !kept.has(url))
}

// Best-effort, and deliberately so: the write this follows has already
// succeeded, so a failed delete must leave an orphan rather than turn a good
// save into an error the admin cannot act on. No token means the store is not
// configured, so there is nothing to reclaim and nothing to report.
export async function reclaimBlobs(urls, token) {
  if (!urls?.length || !token) return
  try {
    const { del } = await import('@vercel/blob')
    await del(urls, { token })
  } catch {
    // Orphans left behind. Nothing the admin did was wrong.
  }
}


// The admin image upload both endpoints run. `resolve(searchParams)` returns `{ error }` (a 400)
// or `{ maxBytes, limit, prefix, vet(bytes, sig) -> error string | null (415), pathname(sig), field }`.
// A NEW URL EVERY TIME (addRandomSuffix): overwriting one stable pathname would leave the old
// bytes cached at the CDN and in browsers, so "I replaced it" would look like a failed save.
export async function uploadImage(req, res, resolve, authenticate = authenticateAdmin) {
  if (req.method !== 'POST') return privateJson(res, { error: 'method not allowed' }, 405)

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return privateJson(res, { error: 'image store not configured' }, 501)

  const userId = await authenticate(req)
  if (!userId) return privateJson(res, { error: 'forbidden' }, 403)

  const { searchParams } = requestUrl(req)
  const plan = resolve(searchParams)
  if (plan.error) return privateJson(res, { error: plan.error }, 400)
  const { maxBytes, limit, prefix, vet, pathname, field } = plan

  const bytes = await readRawBody(req, maxBytes)
  // null for BOTH "nothing arrived" and "over the cap"; content-length is re-read only to
  // phrase the error (the streaming count already enforced the cap).
  if (!bytes) {
    const declared = Number(req.headers?.['content-length'] ?? 0)
    return declared > maxBytes
      ? privateJson(res, { error: `image too large — the limit is ${limit}` }, 413)
      : privateJson(res, { error: 'no image received' }, 400)
  }

  const sig = sniffImage(bytes)
  const refusal = vet(bytes, sig)
  if (refusal) return privateJson(res, { error: refusal }, 415)

  let uploaded
  try {
    const { put } = await import('@vercel/blob')
    uploaded = await put(pathname(sig), bytes, {
      access: 'public',
      token,
      contentType: sig.contentType,
      addRandomSuffix: true,
      cacheControlMaxAge: 31_536_000,
    })
  } catch {
    return privateJson(res, { error: 'upload failed' }, 502)
  }

  // Reclaim the draft this one replaces, AFTER a successful put (never before: a failed put
  // would leave the page pointing at deleted bytes), and only a URL in our own folder.
  const replaces = searchParams.get('replaces')
  if (replaces && isOwnBlobUrlUnder(replaces, prefix) && replaces !== uploaded.url) {
    await reclaimBlobs([replaces], token)
  }

  return privateJson(res, { url: uploaded.url, field })
}
