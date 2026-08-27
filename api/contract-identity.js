// Admin corrections for the historical contract-identity crosswalk
// (ADR-0066) — a sibling of api/identity.js and api/copy.js, same narrow,
// authenticated backend exception.
//
//   GET   /api/contract-identity  -> { overrides: { rowKey: {...}, ... } }  (public, cacheable)
//   PATCH /api/contract-identity  -> the same, for a client's correction    (admin only)
//
// This endpoint stores ONLY the override map — a rowKey's corrected mlbId,
// or a `dismissed` flag for a row confirmed genuinely unresolvable (a free
// agent who signed and never played, for instance). The base crosswalk rows
// themselves (public/data/contracts-history/identity/*.json,
// scripts/gen-contracts-identity.mjs) are already public static files; this
// is deliberately NOT a re-serving of them, both because they are already
// CDN-cacheable as static assets and because reading four JSON files
// (salaries.json alone is ~27k rows) inside a serverless function on every
// request would be needless work a static fetch already does better. The
// admin review page fetches the base rows and this override map separately
// and merges them client-side.
//
// THE SAME THREE GUARANTEES AS api/identity.js:
//   1. A CLOSED shape. Both the GET's returned map and a PATCH's accepted
//      body run through sanitizeOverrides()/sanitizeOverrideValue(), so a
//      malformed or out-of-budget value can never be stored or served.
//   2. Writes are gated twice: a valid Clerk token AND membership in the
//      COPY_ADMIN_USER_IDS allowlist (api/_lib/adminAuth.js). Reads are
//      public — a corrected player id carries no score and is not secret.
//   3. The read-merge-write happens INSIDE the request that writes, against
//      Redis itself, never against a CDN-cached GET — the exact bug
//      ADR-0025's amendment fixed for copy.js, and the reason this endpoint
//      is a PATCH-body-only shape (see acceptableBody below).
//
// Unconfigured degrades gracefully: with no Redis, GET answers an empty map
// (the review page shows every non-exact row as still pending) and a write
// answers 501.

import { authenticateAdmin } from './_lib/adminAuth.js'
import { jsonResponse, readJsonBody } from './_lib/nodeHandler.js'
import { getRedis } from './_lib/redis.js'

export const config = { runtime: 'nodejs' }

const OVERRIDES_KEY = 'contracts:identity:overrides'
const ROW_KEY_RE = /^(extensions|arbitration|free_agency|salaries)#\d+$/
const NOTE_MAX_LENGTH = 500
const ORIGINAL_CONFIDENCE_VALUES = new Set(['fuzzy', 'ambiguous', 'unresolved'])

function reply(res, body, status = 200, extraHeaders = {}) {
  return jsonResponse(res, body, status, extraHeaders)
}

// `automaticDeserialization: false`, same reason api/copy.js and
// api/identity.js both spell out: with it on, a stored JSON string gets
// silently re-parsed by the client library, which then trips the "is this a
// string" half of sanitization. Off, every hash field round-trips as the
// exact string this endpoint wrote, and JSON.parse/stringify happens here,
// once, deliberately.
function overridesRedis() {
  return getRedis({ automaticDeserialization: false })
}

// Deliberately a second copy of the same pairing helper api/copy.js and
// api/identity.js each already have, not a shared import — see
// api/identity.js's hashFromReply for why duplicating this one small
// function is the correct choice.
function hashFromReply(reply) {
  if (!reply || typeof reply !== 'object') return {}
  if (!Array.isArray(reply)) return reply
  const out = {}
  for (let i = 0; i + 1 < reply.length; i += 2) out[String(reply[i])] = reply[i + 1]
  return out
}

// One override is either "the real id is X" or "reviewed, confirmed no
// confident id exists" — never both unset, which would be an override that
// overrides nothing. `undefined` means the raw value did not pass.
function sanitizeOverrideValue(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const mlbId = raw.mlbId == null ? null : Number(raw.mlbId)
  if (mlbId != null && (!Number.isInteger(mlbId) || mlbId <= 0)) return undefined
  const dismissed = raw.dismissed === true
  if (mlbId == null && !dismissed) return undefined
  const note = typeof raw.note === 'string' ? raw.note.slice(0, NOTE_MAX_LENGTH) : null
  const correctedBy = typeof raw.correctedBy === 'string' ? raw.correctedBy : null
  const correctedAt = typeof raw.correctedAt === 'string' ? raw.correctedAt : null
  // `confidence: 'exact'` means a human confirmed the match; `originalConfidence`
  // preserves the tier the automated pipeline assigned before that confirmation.
  // Both default to null and both reject any non-null value outside their fixed
  // vocabulary — same "invalid means invalid, not dropped" rule as every other
  // field here.
  const confidence = raw.confidence == null ? null : raw.confidence === 'exact' ? 'exact' : undefined
  if (confidence === undefined) return undefined
  const originalConfidence =
    raw.originalConfidence == null
      ? null
      : ORIGINAL_CONFIDENCE_VALUES.has(raw.originalConfidence)
        ? raw.originalConfidence
        : undefined
  if (originalConfidence === undefined) return undefined
  return { mlbId, dismissed, note, correctedBy, correctedAt, confidence, originalConfidence }
}

// Runs stored Redis strings AND an incoming patch's raw values through the
// same closed validator — an unknown rowKey shape or an out-of-budget value
// can never be stored or served, from either direction.
export function sanitizeOverrides(stored) {
  const out = {}
  for (const [key, rawValue] of Object.entries(stored || {})) {
    if (!ROW_KEY_RE.test(key)) continue
    let value = rawValue
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value)
      } catch {
        continue
      }
    }
    const clean = sanitizeOverrideValue(value)
    if (clean) out[key] = clean
  }
  return out
}

// A patch value of `null` clears that row's override (the row goes back to
// whatever the base pipeline resolved) — same "null/empty clears" idiom as
// copy.js's fields. Anything else must sanitize to a valid override or the
// whole patch is refused; a request that named one bad row must not
// silently apply the rest and drop that one.
export function mergeOverrides(prev, patch, stamp) {
  const merged = { ...prev }
  for (const [key, value] of Object.entries(patch)) {
    if (!ROW_KEY_RE.test(key)) return undefined
    if (value == null) {
      delete merged[key]
      continue
    }
    const clean = sanitizeOverrideValue(value)
    if (!clean) return undefined
    merged[key] = { ...clean, correctedBy: stamp.userId, correctedAt: stamp.now }
  }
  return merged
}

// Only a patch, never a full-map replace — a reviewer correcting one row
// never has (and must never be trusted to send) the complete queue, unlike
// /admin's copy editor which holds every field on screen.
export function acceptableBody(body) {
  const patch = body?.patch
  return patch != null && typeof patch === 'object' && !Array.isArray(patch)
}

export default async function handler(req, res) {
  const method = req.method
  if (method !== 'GET' && method !== 'PATCH') {
    return reply(res, { error: 'method not allowed' }, 405)
  }

  const redis = overridesRedis()

  if (method === 'GET') {
    let stored = {}
    if (redis) {
      try {
        stored = hashFromReply(await redis.hgetall(OVERRIDES_KEY))
      } catch {
        stored = {}
      }
    }
    return reply(
      res,
      { overrides: sanitizeOverrides(stored) },
      200,
      { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600' },
    )
  }

  if (!redis) return reply(res, { error: 'contract-identity override store not configured' }, 501)

  const userId = await authenticateAdmin(req)
  if (!userId) return reply(res, { error: 'forbidden' }, 403)

  const body = await readJsonBody(req)
  if (body == null || !acceptableBody(body)) return reply(res, { error: 'invalid body' }, 400)

  // Read fresh from Redis inside this request, same reason as api/identity.js
  // at length: a GET is CDN-cached, so merging against anything the browser
  // holds can silently resurrect or delete a row another reviewer just fixed.
  let prev
  try {
    prev = sanitizeOverrides(hashFromReply(await redis.hgetall(OVERRIDES_KEY)))
  } catch {
    return reply(res, { error: 'write failed' }, 502)
  }

  const merged = mergeOverrides(prev, body.patch, { userId, now: new Date().toISOString() })
  if (!merged) return reply(res, { error: 'invalid patch' }, 422)

  const staleKeys = Object.keys(prev).filter((key) => !(key in merged))
  try {
    if (Object.keys(merged).length || staleKeys.length) {
      const tx = redis.multi()
      const toStore = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, JSON.stringify(v)]))
      if (Object.keys(toStore).length) tx.hset(OVERRIDES_KEY, toStore)
      if (staleKeys.length) tx.hdel(OVERRIDES_KEY, ...staleKeys)
      await tx.exec()
    }
  } catch {
    return reply(res, { error: 'write failed' }, 502)
  }

  return reply(res, { overrides: merged }, 200, { 'cache-control': 'no-store' })
}
