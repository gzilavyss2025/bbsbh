// Club logo-art upload — the second narrow, opt-in backend exception that
// accepts bytes (the first is api/ballpark-photo.js, whose design this follows
// line for line).
//
//   POST /api/identity-logo?teamId={id}&slot={treatment|home|away}
//     body:    raw PNG bytes (512x512, under 400 KB — src/lib/logoArt.js's
//              curated-art standard, the SAME functions the dev lab enforces)
//     returns: { url, field }                                     (admin only)
//
// WHY IT EXISTS. The team hub's identity drawer (ADR-0050) can retune a club's
// colours at runtime, but the one thing the owner most wants to change about a
// tile — the mark on it — lived only in /identity-lab, whose upload writes
// public/team-logos/ through a dev-only middleware and needs a deploy to ship
// (ADR-0029). This endpoint closes the gap the way ballpark-photo closed it for
// park art: the bytes land in the project's own Vercel Blob store, and the
// identity store goes on holding nothing but a URL (fields.js's `logo`
// dimension, `identity.logo.{teamId}.{slot}`).
//
// WHAT IT DOES NOT DO — the load-bearing part, verbatim from ballpark-photo:
// it does not touch the identity store. Uploading is not saving: this endpoint
// puts an object and hands back its URL plus the field id it is destined for,
// and the URL only becomes the club's mark when the drawer's Save PATCHes it to
// /api/identity like any other override. A failed or abandoned upload changes
// nothing the site renders, so Cancel is genuinely a cancel — and the identity
// store keeps ONE writer and one validation choke point.
//
// SPOILER RULE. A logo is identity, never state (src/lib/CLAUDE.md's "rule
// that must not drift"): the payload is opaque bytes an admin chose, keyed on
// (teamId, slot), and nothing here reads a feed or can be derived from one.
//
// UNCONFIGURED DEGRADES GRACEFULLY: no BLOB_READ_WRITE_TOKEN answers 501 and
// the drawer falls back to its paste-a-URL field, which always works.

import { describeLogoRejection, LOGO_MAX_BYTES } from '../src/lib/logoArt.js'
import { IDENTITY_DIMENSIONS, identityFieldId } from '../src/lib/identity/fields.js'
import { isOwnBlobUrl, sniffImage } from './ballpark-photo.js'
import { authenticateAdmin } from './_lib/adminAuth.js'
import { jsonResponse, readRawBody, requestUrl } from './_lib/nodeHandler.js'

// Node runtime, not edge — @clerk/backend's verifyToken pulls in internals
// Vercel's edge sandbox rejects. Same reason as api/copy.js.
export const config = { runtime: 'nodejs' }

// The slots an upload may fill — exactly the `logo` dimension's own key set, so
// this endpoint and the store that will eventually hold the URL cannot disagree
// about the vocabulary. A slot outside it is a field id no save could land.
const SLOTS = new Set(IDENTITY_DIMENSIONS.logo.keys)

export default async function handler(req, res) {
  const reply = (body, status = 200) =>
    jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })

  if (req.method !== 'POST') return reply({ error: 'method not allowed' }, 405)

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return reply({ error: 'image store not configured' }, 501)

  const userId = await authenticateAdmin(req)
  if (!userId) return reply({ error: 'forbidden' }, 403)

  const { searchParams } = requestUrl(req)
  const teamId = searchParams.get('teamId') || ''
  const slot = searchParams.get('slot') || ''
  if (!/^[1-9]\d*$/.test(teamId)) return reply({ error: 'unknown team' }, 400)
  if (!SLOTS.has(slot)) return reply({ error: 'unknown slot' }, 400)

  const bytes = await readRawBody(req, LOGO_MAX_BYTES)
  // null for BOTH "nothing arrived" and "went over the cap"; content-length is
  // re-read purely to phrase the error (enforcement already happened in the
  // streaming count). Same split as ballpark-photo.
  if (!bytes) {
    const declared = Number(req.headers?.['content-length'] ?? 0)
    return declared > LOGO_MAX_BYTES
      ? reply({ error: `image too large — the limit is ${LOGO_MAX_BYTES / 1024} KB` }, 413)
      : reply({ error: 'no image received' }, 400)
  }

  // The curated-art standard, judged by the same function the dev lab and its
  // endpoint already share (512x512 PNG under the cap) — so a file this refuses
  // is one /identity-lab would have refused, with the same sentence.
  const rejection = describeLogoRejection(bytes)
  if (rejection) return reply({ error: rejection }, 415)

  const sig = sniffImage(bytes)
  if (!sig || sig.ext !== 'png') return reply({ error: 'not a PNG' }, 415)

  // Lazy import, so the module still loads (and answers 501) where the
  // dependency exists but the store is not configured.
  const { put, del } = await import('@vercel/blob')

  let uploaded
  try {
    uploaded = await put(`identity-logos/${teamId}-${slot}.png`, bytes, {
      access: 'public',
      token,
      contentType: sig.contentType,
      // A new URL every time, for ballpark-photo's cache reason: overwriting a
      // stable pathname would leave the old bytes cached at the CDN, so "I
      // replaced the mark" would keep showing the previous one. A unique URL
      // makes the swap atomic and lets the object be cached hard.
      addRandomSuffix: true,
      cacheControlMaxAge: 31_536_000,
    })
  } catch {
    return reply({ error: 'upload failed' }, 502)
  }

  // Best-effort cleanup of a blob this one replaces — after a successful put,
  // never before, and only for a URL in our own store. The drawer only ever
  // passes its own ABANDONED draft upload here (re-uploading before saving),
  // never a URL a saved override still points at.
  const replaces = searchParams.get('replaces')
  if (replaces && isOwnBlobUrl(replaces) && replaces !== uploaded.url) {
    try {
      await del(replaces, { token })
    } catch {
      // Orphan left behind; not worth failing an upload the admin watched land.
    }
  }

  return reply({ url: uploaded.url, field: identityFieldId('logo', teamId, slot) })
}
