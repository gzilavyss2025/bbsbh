// Multi-device reveal sync — the one narrow, authenticated backend exception
// (see docs/adr/ and the root CLAUDE.md "no backend" section). Stores a
// single integer per (Clerk userId, gamePk): the same revealedThrough
// high-water mark useRevealProgress.js already keeps in localStorage. Never
// a score itself — only how far a signed-in user has revealed, mirrored
// across their devices. See src/components/RevealCloudSync.jsx for the
// client side of this.
//
// Ratcheted server-side too, not just client-side: a write can only raise
// the stored value, never lower it, so a stale or malformed client can't
// regress another device's already-synced progress.

import { verifyToken } from '@clerk/backend'
import { Redis } from '@upstash/redis'

// Node.js runtime, NOT edge (unlike og.js/preview.js) — @clerk/backend's
// verifyToken pulls in @clerk/shared internals that Vercel's edge sandbox
// rejects outright (confirmed live: NOW_SANDBOX_WORKER_EDGE_FUNCTION_UNSUPPORTED_MODULES,
// deployment dpl_F3DPPSY3uQvXPyecXSRMVhwPCWtw). The handler below still uses
// the Web-standard Request/Response shape, which Vercel's Node.js runtime
// supports the same as edge — only the `config.runtime` value changes.
export const config = { runtime: 'nodejs' }

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function authenticate(req) {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null
  const auth = req.headers.get('authorization') || ''
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

// The cloud scorebook index — the user's own recently-scored games, one hash
// per user (`scorebook:{userId}`, field = gamePk). Each entry is the SAME
// high-water mark plus just enough spoiler-free identity to draw a "pick up
// your pencil" card without fetching the game feed: date, team abbreviations
// and club names, doubleheader game number, regulation length. Never a score,
// same footing as revealedThrough itself (see ADR-0022).
const SCOREBOOK_MAX = 24

function sanitizeSnapshot(game) {
  if (!game || typeof game !== 'object') return null
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
  const date = str(game.date, 10)
  const away = str(game.away, 5)
  const home = str(game.home, 5)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !away || !home) return null
  const num = (v, dflt, max) =>
    Number.isInteger(v) && v >= 1 && v <= max ? v : dflt
  return {
    date,
    away,
    home,
    awayName: str(game.awayName, 40),
    homeName: str(game.homeName, 40),
    gameNumber: num(game.gameNumber, 1, 3),
    regulation: num(game.regulation, 9, 15),
  }
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  const { searchParams } = new URL(req.url)
  const wantRecent = searchParams.get('recent') === '1'
  const gamePk = searchParams.get('gamePk')
  if (!wantRecent && (!gamePk || !/^\d+$/.test(gamePk))) {
    return jsonResponse({ error: 'gamePk required' }, 400)
  }

  const redis = getRedis()
  if (!redis) return jsonResponse({ error: 'sync not configured' }, 501)

  const userId = await authenticate(req)
  if (!userId) return jsonResponse({ error: 'unauthorized' }, 401)

  // GET ?recent=1 — the scorebook index, newest first.
  if (wantRecent) {
    if (req.method !== 'GET') return jsonResponse({ error: 'method not allowed' }, 405)
    const all = (await redis.hgetall(`scorebook:${userId}`)) || {}
    const games = Object.entries(all)
      .map(([pk, v]) => (v && typeof v === 'object' ? { gamePk: Number(pk), ...v } : null))
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 12)
    return jsonResponse({ games })
  }

  const key = `reveal:${userId}:${gamePk}`

  if (req.method === 'GET') {
    const current = await redis.get(key)
    const revealedThrough = Number.isInteger(current) ? current : -1
    return jsonResponse({ revealedThrough })
  }

  // POST — ratchet: the stored value can only ever increase.
  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid body' }, 400)
  }
  const incoming = body?.revealedThrough
  if (!Number.isInteger(incoming) || incoming < 0) {
    return jsonResponse({ error: 'revealedThrough must be a non-negative integer' }, 400)
  }
  const current = await redis.get(key)
  const next = Math.max(Number.isInteger(current) ? current : -1, incoming)
  await redis.set(key, next)

  // Fold this game into the scorebook index when the client sent a valid
  // snapshot (older clients simply don't, and the entry is skipped — the
  // ratchet above is unaffected either way). Pruned to the newest
  // SCOREBOOK_MAX so one user's hash can't grow without bound.
  const snapshot = sanitizeSnapshot(body?.game)
  if (snapshot) {
    const bookKey = `scorebook:${userId}`
    await redis.hset(bookKey, {
      [gamePk]: { ...snapshot, revealedThrough: next, updatedAt: Date.now() },
    })
    const all = (await redis.hgetall(bookKey)) || {}
    const stale = Object.entries(all)
      .sort(([, a], [, b]) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0))
      .slice(SCOREBOOK_MAX)
      .map(([pk]) => pk)
    if (stale.length) await redis.hdel(bookKey, ...stale)
  }

  return jsonResponse({ revealedThrough: next })
}
