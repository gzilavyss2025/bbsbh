// The one place the four backend exceptions (api/reveal.js, api/spoiled-days.js,
// api/copy.js, api/stamps.js) decide whether a Redis store is configured at all.
//
// WHY THIS EXISTS — the failure it was written for. Each of those functions used
// to read `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` itself, and each
// returned its "sync not configured" 501 when either was missing. That is the
// correct degrade (sync has always been opt-in; see ADR-0022) and it is
// deliberately indistinguishable from a deploy that has no store on purpose.
//
// Which is exactly how it hid a real misconfiguration for as long as it did.
// Connecting an Upstash database through Vercel's **KV** integration injects the
// same REST credentials under a different pair of names —
// `KV_REST_API_URL`/`KV_REST_API_TOKEN` — so a project could be correctly linked
// to a running store and still 501 on every request, forever, with nothing in
// the logs and every client quietly falling back to local-only. The store was
// there. The names didn't match.
//
// So the resolution is a LIST of accepted name pairs rather than one hardcoded
// pair. Two rules keep that from becoming a guessing game:
//
//   1. **A pair is atomic.** A URL from one integration is never combined with a
//      token from another — that would hand @upstash/redis a credential for a
//      different database and fail at request time instead of at startup, which
//      is strictly worse than the 501 it replaced.
//   2. **Only REST credentials, and only read-write ones.** `KV_URL` and
//      `REDIS_URL` are `rediss://` connection strings for a TCP client, not the
//      REST endpoint @upstash/redis wants, and `KV_REST_API_READ_ONLY_TOKEN`
//      cannot write. All three are deliberately absent from the list below;
//      adding one would turn a clean 501 into a runtime error on the first
//      ratchet or mint.
//
// Order matters only when a project somehow has both pairs set: the
// Upstash-native names win, because that is the pair this repo documents
// (docs/development.md) and the one an operator would have set by hand.

import { Redis } from '@upstash/redis'

// Accepted `[urlVar, tokenVar]` pairs, most-preferred first. Both halves of a
// pair must be present for it to be used — see rule 1 above.
export const REDIS_ENV_PAIRS = [
  // What docs/development.md tells you to set, and what the Upstash marketplace
  // integration adds today.
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  // What Vercel's KV integration adds for the very same Upstash database. Same
  // credentials, different names.
  ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
]

// Pure, and exported, so the pairing rules above are pinned by the unit suite
// rather than resting on a deploy nobody can run in CI. Returns `{ url, token }`
// or null for "no store configured", which is the 501 every caller already
// knows how to render.
//
// Values are trimmed because a credential pasted into a dashboard field picks up
// whitespace surprisingly often, and an all-whitespace value is "not set" rather
// than a URL that fails on first use.
export function redisConfigFromEnv(env = process.env) {
  if (!env || typeof env !== 'object') return null
  for (const [urlVar, tokenVar] of REDIS_ENV_PAIRS) {
    const url = typeof env[urlVar] === 'string' ? env[urlVar].trim() : ''
    const token = typeof env[tokenVar] === 'string' ? env[tokenVar].trim() : ''
    if (url && token) return { url, token }
  }
  return null
}

// The client, or null when nothing is configured. `options` is passed straight
// through to the Redis constructor — api/copy.js needs
// `automaticDeserialization: false`, for a reason its own call site explains.
export function getRedis(options = {}) {
  const config = redisConfigFromEnv()
  if (!config) return null
  return new Redis({ ...config, ...options })
}
