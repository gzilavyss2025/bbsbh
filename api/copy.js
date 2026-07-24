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

// A capped list of prior states, newest first, so a bad save is recoverable —
// the owner's workflow is frequent solo wording iteration with no other
// version control. Each entry is a JSON string { at, by, copy }. Undo is just
// re-saving a historical `copy` map through the normal POST path.
const COPY_HISTORY_KEY = 'copy:history'
const COPY_HISTORY_MAX = 20

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
  // `automaticDeserialization: false` is DELIBERATE and specific to the copy
  // store (api/reveal.js keeps the default because it stores an integer). Our
  // values are arbitrary admin-authored strings: with the default on,
  // @upstash/redis JSON-parses a value like "42", "true", or "null" on read
  // and hands back a number/boolean/null, which sanitizeOverrides then drops as
  // "not a string" — a silent data-loss bug where a perfectly good humor line
  // vanishes after saving. Off, every value round-trips as the exact string we
  // stored. The history list (JSON we stringify ourselves) is parsed by hand
  // below for the same reason.
  return new Redis({ url, token, automaticDeserialization: false })
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

// Optional authorizedParties hardening: set CLERK_AUTHORIZED_PARTIES to the
// app's own origin(s) (comma-separated) so a token minted for a different azp
// can't be replayed here. Left unset, verifyToken skips the check — the
// allowlist below still bounds writes to enumerated user ids.
function authorizedParties() {
  const raw = process.env.CLERK_AUTHORIZED_PARTIES || ''
  const parties = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parties.length ? parties : undefined
}

async function authenticateAdmin(req) {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const { data, errors } = await verifyToken(token, {
    secretKey,
    authorizedParties: authorizedParties(),
  })
  if (errors || !data?.sub) return null
  if (!adminIds().has(data.sub)) return null
  return data.sub
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  const redis = getRedis()
  const { searchParams } = new URL(req.url)
  const wantHistory = searchParams.get('history') === '1'

  if (req.method === 'GET') {
    // The history list is admin-only (it records who changed what, when); the
    // current copy map is public.
    if (wantHistory) {
      if (!redis) return jsonResponse({ error: 'copy store not configured' }, 501)
      const userId = await authenticateAdmin(req)
      if (!userId) return jsonResponse({ error: 'forbidden' }, 403)
      let entries = []
      try {
        const raw = (await redis.lrange(COPY_HISTORY_KEY, 0, COPY_HISTORY_MAX - 1)) || []
        entries = raw
          .map((s) => {
            try {
              const e = JSON.parse(s)
              return { at: e.at, by: e.by, copy: sanitizeOverrides(e.copy) }
            } catch {
              return null
            }
          })
          .filter(Boolean)
      } catch {
        entries = []
      }
      return jsonResponse({ history: entries }, 200, { 'cache-control': 'private, no-store' })
    }

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
  // Sanitize to known ids + in-budget strings.
  const clean = sanitizeOverrides(body?.copy)
  try {
    // Snapshot the current state for the history list BEFORE mutating.
    const prev = sanitizeOverrides((await redis.hgetall(COPY_KEY)) || {})
    // Keys being removed by this save (present before, absent now).
    const staleKeys = Object.keys(prev).filter((id) => !(id in clean))

    // Apply as a transaction, and crucially WITHOUT a `del` first: we hset the
    // new values and hdel only the removed keys, so a mid-write crash leaves the
    // previous copy intact rather than wiping every override (a failed `del` +
    // `hset` pair would have reset the whole site to defaults). A GET can never
    // observe an empty hash mid-save either.
    const tx = redis.multi()
    tx.lpush(COPY_HISTORY_KEY, JSON.stringify({ at: Date.now(), by: userId, copy: prev }))
    tx.ltrim(COPY_HISTORY_KEY, 0, COPY_HISTORY_MAX - 1)
    if (Object.keys(clean).length) tx.hset(COPY_KEY, clean)
    if (staleKeys.length) tx.hdel(COPY_KEY, ...staleKeys)
    await tx.exec()
  } catch {
    return jsonResponse({ error: 'write failed' }, 502)
  }

  return jsonResponse({ copy: clean }, 200, { 'cache-control': 'no-store' })
}
