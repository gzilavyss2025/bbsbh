// Ballpark art upload — the eighth narrow, opt-in backend exception, and the
// FIRST one that accepts bytes.
//
//   POST /api/ballpark-photo?key={venueKey}&kind=photo|wordmark
//     body:    raw image bytes, content-type image/jpeg or image/png
//     returns: { url }                                        (admin only)
//
// WHY IT EXISTS. The copy store has been able to override a park's photo since
// ADR-0025's amendment, but only by holding a URL to somebody ELSE's host. That
// made the one thing the owner actually wants to do — point a phone at a
// ballpark and put that picture on the page — a chore involving a third-party
// image host, and it left the app rendering `<img src>` at a domain nobody here
// controls. This endpoint closes that gap: the bytes land in the project's own
// Vercel Blob store, and the copy store goes on holding nothing but a URL. The
// registry field, its https:// pattern, and every consumer are unchanged.
//
// WHAT IT DOES NOT DO — and this is the load-bearing part of the design. It
// does not touch the copy store. Uploading is not saving: this endpoint puts an
// object and hands back its URL, and the URL only becomes the park's photo when
// the client subsequently POSTs it to /api/copy like any other override. Two
// consequences worth keeping. A failed or abandoned upload changes nothing the
// site renders, so Cancel is genuinely a cancel. And the copy store keeps ONE
// writer and one validation choke point (sanitizeOverrides), rather than
// growing a second path that can set a field.
//
// SPOILER RULE. Nothing here is score-bearing and nothing can become so. A
// ballpark is a building; the team hub's Overview is deliberately outside the
// scoring flow (CLAUDE.md); and the payload is opaque bytes that an admin
// chose, never anything derived from a game feed. This is the same standing the
// per-park copy fields already have — see the SPOILER GUARD note in
// src/copy/registry.js, which governs the fields this endpoint feeds.
//
// UNCONFIGURED DEGRADES GRACEFULLY, like every other exception: with no
// BLOB_READ_WRITE_TOKEN this returns 501 and the client hides the drop zone,
// leaving the paste-a-URL field that has always worked.

import { FIELD_IDS } from '../src/copy/registry.js'
import { authenticateAdmin } from './_lib/adminAuth.js'
import { jsonResponse, readRawBody, requestUrl } from './_lib/nodeHandler.js'

// Node runtime, not edge — @clerk/backend's verifyToken pulls in internals
// Vercel's edge sandbox rejects. Same reason as api/copy.js.
export const config = { runtime: 'nodejs' }

// The two slots a park's art can fill, with the ceiling each gets and the copy
// field it is destined for. The caps are deliberately different because the two
// images are different objects: a photograph is a 16:9 scene the client has
// already downscaled and re-encoded as JPEG before it gets here, while a
// wordmark is flat-colour lettering on transparency that has no business being
// large. Both are ceilings on an ALREADY-COMPRESSED payload, not targets — see
// src/lib/ballpark/compressImage.js for what the browser does first.
const KINDS = {
  photo: { maxBytes: 1_500_000, field: (key) => `ballpark.${key}Photo` },
  wordmark: { maxBytes: 400_000, field: (key) => `ballpark.${key}Wordmark` },
}

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

// Every park key the copy registry knows, derived from the registry itself
// rather than re-deriving from BALLPARKS. The registry is what an upload is
// ultimately FOR — a key with no `ballpark.{key}Photo` field is a key no admin
// could ever save, so accepting bytes for it would only ever create an orphan.
// Same closed-set argument as sanitizeOverrides, one door earlier.
const PARK_KEYS = new Set(
  FIELD_IDS.map((id) => /^ballpark\.([a-z0-9]+)Photo$/.exec(id)?.[1]).filter(Boolean),
)

// A URL is safe to delete only if it is one of ours. The token would refuse a
// foreign store anyway, but an admin's hand-typed override could be ANY https
// URL — including a page on somebody else's site that we must not so much as
// send a delete for. Checking the host before the call keeps that from being
// the token's problem to catch.
export function isOwnBlobUrl(raw) {
  try {
    const url = new URL(String(raw))
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  const reply = (body, status = 200) =>
    jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })

  if (req.method !== 'POST') return reply({ error: 'method not allowed' }, 405)

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return reply({ error: 'image store not configured' }, 501)

  const userId = await authenticateAdmin(req)
  if (!userId) return reply({ error: 'forbidden' }, 403)

  const { searchParams } = requestUrl(req)
  const key = searchParams.get('key') || ''
  const kindName = searchParams.get('kind') || 'photo'
  const kind = Object.prototype.hasOwnProperty.call(KINDS, kindName) ? KINDS[kindName] : null
  if (!kind) return reply({ error: 'unknown kind' }, 400)
  if (!PARK_KEYS.has(key)) return reply({ error: 'unknown ballpark' }, 400)

  const bytes = await readRawBody(req, kind.maxBytes)
  // readRawBody returns null for BOTH "nothing arrived" and "went over the
  // cap", which are different answers to the caller — so the size case is
  // separated by re-reading content-length purely for the message. The header
  // is untrusted for enforcement (the streaming count above did that) and used
  // only to phrase the error.
  if (!bytes) {
    const declared = Number(req.headers?.['content-length'] ?? 0)
    return declared > kind.maxBytes
      ? reply({ error: `image too large — the limit is ${Math.round(kind.maxBytes / 1000)} KB` }, 413)
      : reply({ error: 'no image received' }, 400)
  }

  const sig = sniffImage(bytes)
  if (!sig) return reply({ error: 'not a JPEG or PNG' }, 415)

  // Import lazily so the module still loads (and answers 501) on a deploy where
  // the dependency is present but the store is not — and so an unconfigured
  // deploy pays nothing at cold start.
  const { put, del } = await import('@vercel/blob')

  let uploaded
  try {
    uploaded = await put(`ballparks/${key}-${kindName}.${sig.ext}`, bytes, {
      access: 'public',
      token,
      contentType: sig.contentType,
      // A NEW URL EVERY TIME, and it must stay that way. Overwriting one stable
      // pathname would leave the old bytes cached at the CDN and in every
      // browser that had loaded the page, so "I replaced the photo" would show
      // the previous one for as long as the cache held — indistinguishable from
      // the save having failed. A unique URL makes the swap atomic and lets the
      // object itself be cached hard, below.
      addRandomSuffix: true,
      cacheControlMaxAge: 31_536_000,
    })
  } catch {
    return reply({ error: 'upload failed' }, 502)
  }

  // Best-effort cleanup of the image this one replaces. AFTER a successful put,
  // never before: if the delete ran first and the put then failed, the park
  // would be left pointing at bytes that no longer exist. A failure here costs
  // an orphaned object and nothing else, so it is swallowed rather than turned
  // into an error the admin has to think about.
  const replaces = searchParams.get('replaces')
  if (replaces && isOwnBlobUrl(replaces) && replaces !== uploaded.url) {
    try {
      await del(replaces, { token })
    } catch {
      // Orphan left behind. Not worth failing a save the admin already watched
      // succeed.
    }
  }

  return reply({ url: uploaded.url, field: kind.field(key) })
}
