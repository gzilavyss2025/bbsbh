// Cross-device sync for the spoiled-day list — the durable half of the Scores
// Unlocked pass (ADR-0026), riding the same Clerk + Upstash stack as the reveal
// mark (api/reveal.js, ADR-0022). Per Clerk userId, one Redis hash whose fields
// are 'YYYY-MM-DD' and whose values are 'on' or 'off'.
//
// GET  /api/spoiled-days                    -> { days: { 'YYYY-MM-DD': 'on'|'off' } }
// POST /api/spoiled-days { day, state }     -> { days: { ... } }
//
// This stores CONSENT, never scoring progress and never a score. A day being
// listed means "the user agreed to see this date plainly"; it cannot advance,
// corrupt, or even touch `revealedThrough`, which is the whole reason the two
// are kept in separate keys with separate shapes.
//
// Why a state map and not a set (the design decision worth protecting):
// the reveal mark syncs with a monotonic ratchet because it only moves one way.
// A day set can't. A plain union would resurrect a day the user just took back —
// consent on the phone, sync, undo on the phone, and the next fetch unions the
// stale 'on' straight back in, silently reversing the undo the same-day
// recoverability promise depends on. So a withdrawal is published as an explicit
// 'off' and last write wins per day. Safe here because a day is only mutable
// while it is "today" on some device: past days are frozen and converge, and any
// disagreement about today self-heals the next time the switch is touched.
//
// Direction of risk: an 'on' can only ever originate from a real consent tap on
// one of this user's own devices, and an 'off' only ever re-seals. Neither can
// unseal a day the user never agreed to.
//
// Unconfigured degrades exactly like reveal.js: with no Redis (or no Clerk) the
// endpoint 501s and the client simply stays local-only. Sync has always been
// opt-in infrastructure, never a requirement.

import { verifyToken } from '@clerk/backend'
import { Redis } from '@upstash/redis'
import { isDayState, isDayString, MAX_SPOILED_DAYS } from '../src/lib/spoiledDays.js'
import { getHeader, jsonResponse, readJsonBody } from './_lib/nodeHandler.js'

// Node runtime, not edge — same reason as reveal.js: @clerk/backend's
// verifyToken pulls in internals Vercel's edge sandbox rejects.
export const config = { runtime: 'nodejs' }

// Per-user, auth-gated data — never let a shared cache (or the browser) hold one
// user's consent record and hand it to another request.
function reply(res, body, status = 200) {
  return jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })
}

async function authenticate(req) {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null
  const auth = getHeader(req, 'authorization')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const { data, errors } = await verifyToken(token, { secretKey })
  if (errors || !data?.sub) return null
  return data.sub
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// Re-validate whatever Redis hands back before it reaches a client: a hand-edited
// or cross-version hash can only ever yield known-shape days and states, never a
// surprise key the client would then have to defend against.
function sanitizeStored(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [day, state] of Object.entries(raw)) {
    if (isDayString(day) && isDayState(state)) out[day] = state
  }
  return out
}

// Keep the hash from growing without bound, mirroring the client's own cap. The
// newest days are the ones that still matter; lexicographic order IS chronological
// for YYYY-MM-DD.
async function trim(redis, key, stored) {
  const days = Object.keys(stored).sort().reverse()
  if (days.length <= MAX_SPOILED_DAYS) return
  const stale = days.slice(MAX_SPOILED_DAYS)
  if (stale.length) await redis.hdel(key, ...stale)
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return reply(res, { error: 'method not allowed' }, 405)
  }

  const redis = getRedis()
  if (!redis) return reply(res, { error: 'sync not configured' }, 501)

  const userId = await authenticate(req)
  if (!userId) return reply(res, { error: 'unauthorized' }, 401)

  const key = `spoiled:${userId}`

  if (req.method === 'GET') {
    let stored
    try {
      stored = sanitizeStored(await redis.hgetall(key))
    } catch {
      stored = {}
    }
    return reply(res, { days: stored })
  }

  // POST — publish this device's decision about ONE day.
  const body = await readJsonBody(req)
  if (body == null) {
    return reply(res, { error: 'invalid body' }, 400)
  }
  const day = body?.day
  const state = body?.state
  if (!isDayString(day) || !isDayState(state)) {
    return reply(res, { error: 'day and state required' }, 400)
  }

  await redis.hset(key, { [day]: state })
  let stored
  try {
    stored = sanitizeStored(await redis.hgetall(key))
    await trim(redis, key, stored)
  } catch {
    stored = { [day]: state }
  }
  return reply(res, { days: stored })
}
