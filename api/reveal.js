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

export const config = { runtime: 'edge' }

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

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  const { searchParams } = new URL(req.url)
  const gamePk = searchParams.get('gamePk')
  if (!gamePk || !/^\d+$/.test(gamePk)) {
    return jsonResponse({ error: 'gamePk required' }, 400)
  }

  const redis = getRedis()
  if (!redis) return jsonResponse({ error: 'sync not configured' }, 501)

  const userId = await authenticate(req)
  if (!userId) return jsonResponse({ error: 'unauthorized' }, 401)

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
  return jsonResponse({ revealedThrough: next })
}
