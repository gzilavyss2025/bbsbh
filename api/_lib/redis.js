// Where the backend functions decide whether a Redis store is configured at all. The two incidents
// behind it (the KV-integration env names, the HGETALL array reply) are in ADR-0127: a pair of
// credential names is atomic, and every `automaticDeserialization: false` read goes through readHash.

import { Redis } from '@upstash/redis'

// Accepted `[urlVar, tokenVar]` pairs, most-preferred first; both halves must be present (ADR-0127).
export const REDIS_ENV_PAIRS = [
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  // Vercel's KV integration: same credentials for the same Upstash database, different names.
  ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
]

// Pure and exported so the pairing rules are pinned by the unit suite. `{ url, token }`, or null
// for "no store configured" (the 501 every caller renders). Values are trimmed.
export function redisConfigFromEnv(env = process.env) {
  if (!env || typeof env !== 'object') return null
  for (const [urlVar, tokenVar] of REDIS_ENV_PAIRS) {
    const url = typeof env[urlVar] === 'string' ? env[urlVar].trim() : ''
    const token = typeof env[tokenVar] === 'string' ? env[tokenVar].trim() : ''
    if (url && token) return { url, token }
  }
  return null
}

// The client, or null when nothing is configured. `options` goes straight to the constructor.
// `responseEncoding: 'base64'` is the wire format the callers and tests were written against
// (@upstash/redis 1.40 changed the default to plain JSON).
export function getRedis(options = {}) {
  const config = redisConfigFromEnv()
  if (!config) return null
  return new Redis({ responseEncoding: 'base64', ...config, ...options })
}

// Pair Upstash's HGETALL reply into `{ field: value }`. With `automaticDeserialization: false` the
// client answers a flat array, so every such read goes through here (ADR-0127). An object passes through.
export function hashFromReply(reply) {
  if (!reply || typeof reply !== 'object') return {}
  if (!Array.isArray(reply)) return reply
  const out = {}
  for (let i = 0; i + 1 < reply.length; i += 2) out[String(reply[i])] = reply[i + 1]
  return out
}

// Read a hash as `{ field: value }`. Throws on a Redis failure; callers pick the fallback.
export async function readHash(redis, key) {
  return hashFromReply(await redis.hgetall(key))
}

// hset `clean`, hdel `stale`, in one transaction (never a `del` first: a mid-write crash
// keeps the previous hash). `prep(tx)` adds the caller's own commands to the same transaction.
export async function writeHash(redis, key, clean, stale, prep) {
  const tx = redis.multi()
  prep?.(tx)
  if (Object.keys(clean).length) tx.hset(key, clean)
  if (stale.length) tx.hdel(key, ...stale)
  if (prep || Object.keys(clean).length || stale.length) await tx.exec()
}

// Per-user fixed-window counter: true once `key` has been hit more than `max` times in 60s.
// Fails open: the limit protects an upstream, it is not an access check. NX sets the window only
// when the key has none, so a key whose EXPIRE failed heals on the next hit.
export async function overLimit(redis, key, max) {
  try {
    const n = await redis.incr(key)
    await redis.expire(key, 60, 'NX')
    return n > max
  } catch {
    return false
  }
}
