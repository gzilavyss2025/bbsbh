// Admin-editable copy store — a second narrow, authenticated backend exception
// alongside multi-device reveal sync (api/reveal.js). It stores nothing but UI
// text: the wording of the spoiler-consent pop-ups and banners, so the site
// owner can tune them (and the humor) as the site matures without a code change
// or a deploy. See the ADR and src/copy/registry.js for the closed set of keys.
//
// GET  /api/copy            -> { copy: { id: text, ... } }   (public, cacheable)
// POST /api/copy            -> { copy: { ... } }             (admin only)
//
// Two things keep this safe to expose:
//   1. The registry is a CLOSED set. Both the GET's returned overrides and the
//      POST's accepted body are run through sanitizeOverrides(), so only known
//      ids with in-budget string values can ever be stored or served — a
//      hand-crafted POST can't inject a new key or an oversized value, and a
//      corrupted Redis blob can't serve a bad one.
//   2. Writes are gated twice: a valid Clerk token AND membership in the
//      COPY_ADMIN_USER_IDS allowlist. Reads are public (copy is not secret and
//      contains no score), which lets the GET be edge-cached.
//
// Unconfigured degrades gracefully, exactly like reveal.js: with no Redis, GET
// returns an empty override map (the app renders shipped defaults) and POST
// returns 501. The app has never required a backend and still does not.

import { verifyToken } from '@clerk/backend'
import { Redis } from '@upstash/redis'
import { sanitizeOverrides } from '../src/copy/registry.js'

// Node runtime, not edge — same reason as reveal.js: @clerk/backend's
// verifyToken pulls in internals Vercel's edge sandbox rejects.
export const config = { runtime: 'nodejs' }

// One hash holds every override, site-wide (copy is global, not per-user).
const COPY_KEY = 'copy:overrides'

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  })
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// Parse COPY_ADMIN_USER_IDS ("user_abc,user_def") into a Set. An unset/empty
// allowlist means NO ONE can write — fail closed, never open.
function adminIds() {
  return new Set(
    (process.env.COPY_ADMIN_USER_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

async function authenticateAdmin(req) {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const { data, errors } = await verifyToken(token, { secretKey })
  if (errors || !data?.sub) return null
  if (!adminIds().has(data.sub)) return null
  return data.sub
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  const redis = getRedis()

  if (req.method === 'GET') {
    // Public read. No Redis -> empty overrides, app uses defaults.
    let stored = {}
    if (redis) {
      try {
        stored = (await redis.hgetall(COPY_KEY)) || {}
      } catch {
        stored = {}
      }
    }
    return jsonResponse(
      { copy: sanitizeOverrides(stored) },
      200,
      // Copy is global and non-secret: let the CDN and browser hold it briefly
      // so a cold page paints from cache, while staying fresh within a minute
      // of an admin edit.
      { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600' },
    )
  }

  // POST — admin write.
  if (!redis) return jsonResponse({ error: 'copy store not configured' }, 501)

  const userId = await authenticateAdmin(req)
  if (!userId) return jsonResponse({ error: 'forbidden' }, 403)

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid body' }, 400)
  }

  // The client sends the FULL desired override map (only non-default fields).
  // Sanitize to known ids + in-budget strings, then replace the stored hash so
  // that clearing a field (dropping it from the map) actually removes it.
  const clean = sanitizeOverrides(body?.copy)
  try {
    await redis.del(COPY_KEY)
    if (Object.keys(clean).length) await redis.hset(COPY_KEY, clean)
  } catch {
    return jsonResponse({ error: 'write failed' }, 502)
  }

  return jsonResponse({ copy: clean }, 200, { 'cache-control': 'no-store' })
}
