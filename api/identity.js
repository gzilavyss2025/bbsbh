// Club-identity overrides — a sibling of api/copy.js, and the same narrow,
// authenticated backend exception (ADR-0025, ADR-0044). It stores nothing but
// per-club IDENTITY: a tile's scale and nudge, a brand colour, a header triad,
// a stamp mark's placement, a win-probability band's fill.
//
//   GET   /api/identity   -> { identity: { id: value, ... } }   (public, cacheable)
//   PATCH /api/identity   -> { identity: { ... } }              (admin only)
//   POST  /api/identity   -> the same, for a client that cannot send PATCH
//
// IDENTITY IS NEVER STATE, so none of this touches the spoiler rule. Every id
// here is keyed on `(teamId, treatment)` and holds a colour or a number
// (src/lib/identity/fields.js); nothing in it can be derived from a score, an
// inning, or a win probability, and src/lib/CLAUDE.md's "rule that must not
// drift" is untouched — see ADR-0050.
//
// THREE THINGS KEEP THIS SAFE TO EXPOSE:
//
//   1. The field catalog is a CLOSED set. Both the GET's returned map and the
//      write's accepted body run through sanitizeIdentityOverrides(), so only
//      known ids with values their field's kind accepts can be stored or served.
//   2. A proposed save is merged into the SHIPPED stores and re-validated with
//      the very validator the dev-only file write uses
//      (scripts/lib/dev-data-stores.mjs, ADR-0029). One implementation guards
//      both write paths, so they cannot drift — which is the whole reason those
//      validators were pulled out of vite.config.js in the first place.
//   3. Writes are gated twice: a valid Clerk token AND membership in the
//      COPY_ADMIN_USER_IDS allowlist (api/_lib/adminAuth.js). Reads are public —
//      a club's colours are not secret and carry no score — which lets the GET
//      be edge-cached.
//
// Unconfigured degrades gracefully, exactly like every other exception here:
// with no Redis, GET answers an empty map (the app renders the shipped JSON) and
// a write answers 501. The app has never required a backend and still does not.

import { DEV_DATA_STORES } from '../scripts/lib/dev-data-stores.mjs'
import { applyIdentityOverrides, overridesByStore, teamsInOverrides } from '../src/lib/identity/apply.js'
import { bundledIdentityStore } from '../src/lib/identity/stores.js'
import {
  IDENTITY_DIMENSIONS,
  headerTriadRefusal,
  mergeIdentityOverrides,
  sanitizeIdentityOverrides,
} from '../src/lib/identity/fields.js'
import { authenticateAdmin } from './_lib/adminAuth.js'
import { jsonResponse, readJsonBody } from './_lib/nodeHandler.js'
import { getRedis } from './_lib/redis.js'

// Node runtime, not edge — same reason as copy.js: @clerk/backend's verifyToken
// pulls in internals Vercel's edge sandbox rejects.
export const config = { runtime: 'nodejs' }

// One hash holds every override, site-wide (a club's identity is global, not
// per-user).
const IDENTITY_KEY = 'identity:overrides'

function reply(res, body, status = 200, extraHeaders = {}) {
  return jsonResponse(res, body, status, extraHeaders)
}

// `automaticDeserialization: false`, for the reason api/copy.js's `copyRedis`
// spells out at length: with it on, @upstash/redis JSON-parses a stored value
// like "0.85" or "true" and hands back a number or a boolean, which the
// sanitizer then drops as "not a string" — a silent data-loss bug where a saved
// tuning value vanishes on the next read. Off, every value round-trips as the
// exact string we stored. It costs this endpoint the hash PAIRING, which is why
// every read below goes through hashFromReply; the two are a matched pair, and
// removing either alone reintroduces the bug the other prevents.
function identityRedis() {
  return getRedis({ automaticDeserialization: false })
}

// Pair Upstash's HGETALL reply into `{ field: value }`. Identical to
// api/copy.js's, and deliberately a second copy rather than a shared import:
// this is a workaround for a client option each endpoint sets for its own
// reasons, and a future client version that pairs the hash up would be a WIDENING
// for whichever endpoint upgraded first. An object is passed through unchanged
// so that day is a no-op rather than a break.
export function hashFromReply(reply) {
  if (!reply || typeof reply !== 'object') return {}
  if (!Array.isArray(reply)) return reply
  const out = {}
  for (let i = 0; i + 1 < reply.length; i += 2) out[String(reply[i])] = reply[i + 1]
  return out
}

// Is this a body the write can act on at all? Only a patch: unlike /api/copy,
// there is no editor here that holds every field of every club on screen, so
// "the full desired map" is a shape nothing can honestly produce, and accepting
// one would mean a drawer for one club could delete every other club's tuning.
export function acceptableBody(body) {
  const patch = body?.patch
  return patch != null && typeof patch === 'object' && !Array.isArray(patch)
}

// Every header triad `overrides` could have changed, as `{ label, triad }`.
// Reads the EFFECTIVE stores, so a save that overrides only `onBar` is judged
// against the `bar` that ships — which is the whole reason this cannot be
// checked from the patch alone.
function triadsToCheck(overrides) {
  const teams = teamsInOverrides(overrides)
  const out = []
  for (const [name, dimension] of Object.entries(IDENTITY_DIMENSIONS)) {
    if (!dimension.triad) continue
    const storeKey = dimension.store()
    const bundled = bundledIdentityStore(storeKey)
    if (!bundled) continue
    const store = applyIdentityOverrides(storeKey, bundled, overrides)
    for (const teamId of teams) {
      for (const key of dimension.keys) {
        const triad = store[teamId]?.treatments?.[key]?.header
        if (triad) out.push({ label: `${name} ${teamId} ${key}`, triad })
      }
    }
  }
  return out
}

// Why this save must be refused, or null. Pure and exported: it is the whole of
// the endpoint's write RULE and the one part CI cannot exercise through the
// handler, which needs a live Clerk token — the same split api/copy.js's
// `writePlan` and api/books.js's `bookRefusal` make.
//
// Two checks, in the order that gives the better message. The store validators
// answer "is this a shape the app can read at all"; the contrast gate answers
// "is this a bar anyone can read text on". A triad that fails AA is refused
// here as well as in the browser, because the browser's copy is a courtesy and
// this one is the answer that counts. Never lower the threshold — retune the
// pair (src/lib/identity/fields.js).
export function identityWriteRefusal(overrides) {
  for (const [storeKey, mine] of Object.entries(overridesByStore(overrides))) {
    const bundled = bundledIdentityStore(storeKey)
    const validate = Object.hasOwn(DEV_DATA_STORES, storeKey) ? DEV_DATA_STORES[storeKey].validate : null
    if (!bundled || !validate) return `no identity store called "${storeKey}"`
    const problem = validate(applyIdentityOverrides(storeKey, bundled, mine))
    if (problem) return problem
  }
  for (const { label, triad } of triadsToCheck(overrides)) {
    const problem = headerTriadRefusal(triad)
    if (problem) return `${label}: ${problem}`
  }
  return null
}

export default async function handler(req, res) {
  const method = req.method
  if (method !== 'GET' && method !== 'POST' && method !== 'PATCH') {
    return reply(res, { error: 'method not allowed' }, 405)
  }

  const redis = identityRedis()

  if (method === 'GET') {
    // Public read. No Redis -> an empty map, and the app renders the JSON it
    // shipped with.
    let stored = {}
    if (redis) {
      try {
        stored = hashFromReply(await redis.hgetall(IDENTITY_KEY))
      } catch {
        stored = {}
      }
    }
    return reply(
      res,
      { identity: sanitizeIdentityOverrides(stored) },
      200,
      // Global, non-secret, and small: let the CDN and the browser hold it
      // briefly so a cold page paints from cache, while staying fresh within a
      // minute of an edit. Same budget as /api/copy, for the same trade.
      { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600' },
    )
  }

  if (!redis) return reply(res, { error: 'identity store not configured' }, 501)

  const userId = await authenticateAdmin(req)
  if (!userId) return reply(res, { error: 'forbidden' }, 403)

  const body = await readJsonBody(req)
  if (body == null || !acceptableBody(body)) return reply(res, { error: 'invalid body' }, 400)

  // READ THE CURRENT MAP HERE, from Redis, inside the request that writes it.
  // The alternative — having the browser GET, merge, and send the whole map back
  // — cannot be made correct: that GET is CDN-cached, `cache: 'no-store'` governs
  // the browser's cache and not the shared edge, and a save reading a map minutes
  // old deletes every field missing from it. It cost a run of ballpark photos
  // before the same fix landed for copy; see ADR-0025's amendment and
  // src/lib/admin/saveCopyPatch.js.
  let prev
  try {
    prev = sanitizeIdentityOverrides(hashFromReply(await redis.hgetall(IDENTITY_KEY)))
  } catch {
    // Deliberately NOT an empty map. Treating an unreadable store as "nothing is
    // stored" would compute `staleKeys` against {} and quietly leave every other
    // club's tuning in place while reporting a clean save — but the same reflex
    // is what made copy.js's unpaired-hash bug survive for months. A read that
    // failed is a failed write.
    return reply(res, { error: 'write failed' }, 502)
  }

  const clean = mergeIdentityOverrides(prev, body.patch)

  // Validated AFTER the merge, never against the patch alone — a save that
  // clears one half of a header triad has to be judged on the triad it leaves
  // behind.
  const refusal = identityWriteRefusal(clean)
  if (refusal) return reply(res, { error: refusal }, 422)

  const staleKeys = Object.keys(prev).filter((id) => !(id in clean))
  try {
    // As a transaction, and crucially WITHOUT a `del` first: hset the new values
    // and hdel only the removed keys, so a mid-write crash leaves the previous
    // tuning intact rather than resetting every club to shipped defaults. A GET
    // can never observe an empty hash mid-save either.
    //
    // A patch that changed nothing leaves the transaction empty, which Upstash
    // rejects — nothing to do is not a failure.
    if (Object.keys(clean).length || staleKeys.length) {
      const tx = redis.multi()
      if (Object.keys(clean).length) tx.hset(IDENTITY_KEY, clean)
      if (staleKeys.length) tx.hdel(IDENTITY_KEY, ...staleKeys)
      await tx.exec()
    }
  } catch {
    return reply(res, { error: 'write failed' }, 502)
  }

  return reply(res, { identity: clean }, 200, { 'cache-control': 'no-store' })
}
