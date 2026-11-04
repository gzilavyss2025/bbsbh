// Ballpark art upload — the eighth narrow, opt-in backend exception, and the
// FIRST one that accepts bytes.
//
//   POST /api/ballpark-photo?key={parkKey}&kind=photo|wordmark
//   (the park's PINNED key, src/lib/ballpark/parkKeys.js — a rename keeps it)
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
// NOT SCORE-BEARING. The payload is opaque bytes an admin chose, never anything
// derived from a game feed: the same standing the per-park copy fields have (see
// the SPOILER GUARD note in src/copy/registry.js, which governs the fields this
// endpoint feeds).
//
// UNCONFIGURED DEGRADES GRACEFULLY, like every other exception: with no
// BLOB_READ_WRITE_TOKEN this returns 501 and the client hides the drop zone,
// leaving the paste-a-URL field that has always worked.

import { FIELD_IDS } from '../src/copy/registry.js'
import { uploadImage } from './_lib/blob.js'

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

// Re-exported: the Blob helpers moved to _lib/blob.js, and identity.js and the tests import them here.
export { isOwnBlobUrl, isOwnBlobUrlUnder, reclaimableBlobUrls, reclaimBlobs, sniffImage } from './_lib/blob.js'

// Every park key the copy registry knows, derived from the registry itself
// rather than re-deriving from BALLPARKS. The registry is what an upload is
// ultimately FOR — a key with no `ballpark.{key}Photo` field is a key no admin
// could ever save, so accepting bytes for it would only ever create an orphan.
// Same closed-set argument as sanitizeOverrides, one door earlier.
const PARK_KEYS = new Set(
  FIELD_IDS.map((id) => /^ballpark\.([a-z0-9]+)Photo$/.exec(id)?.[1]).filter(Boolean),
)

export default (req, res) =>
  uploadImage(req, res, (q) => {
    const key = q.get('key') || ''
    const kindName = q.get('kind') || 'photo'
    const kind = Object.hasOwn(KINDS, kindName) ? KINDS[kindName] : null
    if (!kind) return { error: 'unknown kind' }
    if (!PARK_KEYS.has(key)) return { error: 'unknown ballpark' }
    return {
      maxBytes: kind.maxBytes,
      limit: `${Math.round(kind.maxBytes / 1000)} KB`,
      prefix: 'ballparks/',
      vet: (_bytes, sig) => (sig ? null : 'not a JPEG or PNG'),
      pathname: (sig) => `ballparks/${key}-${kindName}.${sig.ext}`,
      field: kind.field(key),
    }
  })
