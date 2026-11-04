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
// IDENTITY, NEVER STATE (src/lib/CLAUDE.md's "The theming rule"): the
// payload is opaque bytes an admin chose, keyed on (teamId, slot), and nothing
// here reads a feed or can be derived from one.
//
// UNCONFIGURED DEGRADES GRACEFULLY: no BLOB_READ_WRITE_TOKEN answers 501 and
// the drawer falls back to its paste-a-URL field, which always works.

import { describeLogoRejection, LOGO_MAX_BYTES } from '../src/lib/logoArt.js'
import { IDENTITY_DIMENSIONS, identityFieldId } from '../src/lib/identity/fields.js'
import { uploadImage } from './_lib/blob.js'

// Node runtime, not edge — @clerk/backend's verifyToken pulls in internals
// Vercel's edge sandbox rejects. Same reason as api/copy.js.
export const config = { runtime: 'nodejs' }

// The slots an upload may fill — exactly the `logo` dimension's own key set, so
// this endpoint and the store that will eventually hold the URL cannot disagree
// about the vocabulary. A slot outside it is a field id no save could land.
const SLOTS = new Set(IDENTITY_DIMENSIONS.logo.keys)

export default (req, res) =>
  uploadImage(req, res, (q) => {
    const teamId = q.get('teamId') || ''
    const slot = q.get('slot') || ''
    if (!/^[1-9]\d*$/.test(teamId)) return { error: 'unknown team' }
    if (!SLOTS.has(slot)) return { error: 'unknown slot' }
    return {
      maxBytes: LOGO_MAX_BYTES,
      limit: `${LOGO_MAX_BYTES / 1024} KB`,
      prefix: 'identity-logos/',
      // The curated-art standard, judged by the function the dev lab shares (512x512 PNG).
      vet: (bytes, sig) => describeLogoRejection(bytes) || (sig?.ext === 'png' ? null : 'not a PNG'),
      pathname: () => `identity-logos/${teamId}-${slot}.png`,
      field: identityFieldId('logo', teamId, slot),
    }
  })
