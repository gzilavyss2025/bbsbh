// My Tally's preference document — the FIFTH opt-in backend exception, riding
// the same Clerk + Upstash stack as api/reveal.js (ADR-0022),
// api/spoiled-days.js (ADR-0026) and api/stamps.js (ADR-0035). One Redis hash
// per Clerk userId, `prefs:{userId}`, one field per preference, each value
// `{ value, updatedAt }`.
//
//   GET  /api/preferences                          -> { prefs: { field: {…} } }
//   POST /api/preferences { field, value, updatedAt } -> { prefs: { field: {…} } }
//
// This stores IDENTITY AND DEVICE BEHAVIOUR — which club you follow, which
// level the slate opens on, whether to hold the screen awake, how much motion
// you want. **Never a score, and never anything derived from one.** The field
// set is closed and lives in src/lib/account/preferences.js, imported verbatim
// here so the client and the server cannot disagree about what a valid
// preference is (the same contract api/stamps.js has with src/lib/stamps.js).
// A field not in that registry does not exist: it is dropped on the way in and
// on the way out.
//
// WHY A STATE MAP AND NOT A DOCUMENT — the design decision worth protecting.
// The reveal mark syncs with a monotonic ratchet because it only moves one way.
// A preference cannot: a club change is not "more" than the club before it. And
// a whole-DOCUMENT write would silently drop one of two concurrent edits — the
// exact defect that ruled out storing this in Clerk's `unsafeMetadata` and sent
// it here instead. So the unit of last-write-wins is the FIELD, one POST writes
// one field, and two devices changing two different preferences both win.
//
// WHY ONE FIELD PER POST. Absence has to keep meaning "no opinion". If this
// took a whole document, a fresh device with an empty one would tell the server
// to erase every setting the user has. Posting `{ field, value, updatedAt }`
// says only what this device actually decided — the same rule, for the same
// reason, as api/spoiled-days.js's per-day POST.
//
// Unconfigured degrades exactly like its three siblings: with no Redis (or no
// Clerk) the endpoint 501s and the client stays local-only. Sync has always
// been opt-in infrastructure, never a requirement.

import {
  FIELD_NAMES,
  clampUpdatedAt,
  isFieldName,
  isValidValue,
  normalizeEntry,
} from '../src/lib/account/preferences.js'
import { authenticateUser } from './_lib/auth.js'
import { jsonResponse, readJsonBody } from './_lib/nodeHandler.js'
import { getRedis } from './_lib/redis.js'

// Node runtime, not edge — same reason as reveal.js/spoiled-days.js/stamps.js:
// @clerk/backend's verifyToken pulls in internals Vercel's edge sandbox rejects.
export const config = { runtime: 'nodejs' }

// Per-user, auth-gated data — never let a shared cache (or the browser) hold one
// user's settings and hand them to another request.
function reply(res, body, status = 200) {
  return jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })
}

// Re-validate whatever Redis hands back before it reaches a client, exactly as
// spoiled-days.js and stamps.js do: a hand-edited or cross-version hash can only
// ever yield known fields with known-shape entries, never a surprise key the
// client would then have to defend against.
export function sanitizeStored(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const field of FIELD_NAMES) {
    const entry = normalizeEntry(field, raw[field])
    if (entry) out[field] = entry
  }
  return out
}

async function readAll(redis, key) {
  try {
    return sanitizeStored(await redis.hgetall(key))
  } catch {
    return {}
  }
}

// The entry a POST should store, or null to leave the stored one alone. Pure,
// and exported, so the server's half of last-write-wins is pinned by the unit
// suite rather than resting on a Redis round trip CI cannot run.
//
// The server runs the SAME rule the client does — later `updatedAt` wins, ties
// go to what is already stored — so a stale device replaying an old value can't
// walk another device's newer choice backwards. That mirrors api/reveal.js
// doing its own max() rather than trusting the client's ratchet.
//
// There is deliberately no Lua here, unlike reveal.js's RATCHET_SCRIPT. The
// read-modify-write race is real but narrow (the same user changing the SAME
// preference on two devices in the same few milliseconds), both values are the
// user's own, and the system self-heals: this endpoint answers with the stored
// document, the client merges it, and any device left holding a newer value
// republishes it on its next comparison. A cjson round trip in Lua to close a
// gap that closes itself is not worth the untestable surface.
export function entryToStore(existing, incoming) {
  if (!incoming) return null
  if (!existing) return incoming
  return incoming.updatedAt > existing.updatedAt ? incoming : null
}

// Exported so the unit suite can drive the real read/write path against a fake
// Redis (test/api-handlers.test.js). The store-backed branches are otherwise
// unreachable in CI — @upstash/redis needs a live REST endpoint — and this is
// the one branch whose behaviour is the feature. Same shape as api/stamps.js's
// exported `mint`, and for the same reason.
export async function handleRequest(req, res, redis, userId) {
  const key = `prefs:${userId}`

  if (req.method === 'GET') {
    return reply(res, { prefs: await readAll(redis, key) })
  }

  // POST — publish this device's decision about ONE preference.
  const body = await readJsonBody(req)
  if (body == null) return reply(res, { error: 'invalid body' }, 400)

  const field = body?.field
  if (!isFieldName(field)) return reply(res, { error: 'unknown field' }, 400)
  if (!isValidValue(field, body?.value)) return reply(res, { error: 'invalid value' }, 400)

  // A clock further ahead than the skew bound is a broken device, not a choice;
  // clamp rather than refuse, so a user with a wrong system clock still keeps
  // their setting. Same posture as reveal.js bounding MAX_REVEALED_THROUGH.
  const incoming = {
    value: body.value,
    updatedAt: clampUpdatedAt(body?.updatedAt, Date.now()),
  }

  let existing = null
  try {
    existing = normalizeEntry(field, await redis.hget(key, field))
  } catch {
    existing = null
  }

  const next = entryToStore(existing, incoming)
  if (next) {
    try {
      await redis.hset(key, { [field]: next })
    } catch {
      return reply(res, { error: 'write failed' }, 503)
    }
  }

  // Answer with the whole stored document, not just the written field: the
  // client uses it to refresh its baseline AND to converge immediately when
  // another device's newer value won the comparison above.
  return reply(res, { prefs: await readAll(redis, key) })
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return reply(res, { error: 'method not allowed' }, 405)
  }

  // Store BEFORE auth, so `curl` against this endpoint distinguishes "no Redis
  // credentials reaching the function" (501) from "the store is live and the
  // problem is elsewhere" (401) — the diagnosis docs/development.md rests on.
  const redis = getRedis()
  if (!redis) return reply(res, { error: 'sync not configured' }, 501)

  const auth = await authenticateUser(req)
  if (!auth.ok) return reply(res, { error: auth.error }, auth.status)

  return handleRequest(req, res, redis, auth.userId)
}
