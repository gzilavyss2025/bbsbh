// Clerk token verification for the authenticated endpoints (api/reveal.js,
// api/spoiled-days.js, api/stamps.js, and the admin half of api/copy.js).
//
// WHY THIS EXISTS — the same failure as api/_lib/redis.js, one layer down. Each
// of those functions had its own `authenticate()` that collapsed every possible
// problem into `return null`, and every caller turned that into a bare
// `401 unauthorized`. So these four outcomes were indistinguishable from the
// outside:
//
//   1. CLERK_SECRET_KEY is not set on this deploy — nothing can ever verify.
//   2. The request carried no token at all (an anonymous curl, a signed-out app).
//   3. The token is real but this deploy can't verify it — most often a secret
//      key from a DIFFERENT Clerk instance than the publishable key the front
//      end was built with.
//   4. The token is genuinely expired or forged.
//
// (1) and (3) are misconfigurations that need a human; (2) and (4) are the
// system working. Flattening all four into one status meant a deploy could
// reject every real request forever while looking exactly like a correctly
// working one being polled by strangers — which is precisely what happened, and
// what took a Vercel log query rather than a glance to find.
//
// So a missing secret key is now a 501, matching the store's own "not
// configured" answer, and a token that fails verification is distinguishable
// from no token at all. `curl` against any authenticated endpoint now names the
// problem:
//
//   501 sync not configured  — no Redis credentials reaching the function
//   501 auth not configured  — no CLERK_SECRET_KEY reaching the function
//   401 no token             — auth is configured; this request was anonymous
//   401 invalid token        — a token arrived and could not be verified
//
// None of these leak anything: which env vars a deploy has is not a secret, and
// no response says anything about a user.

import { verifyToken } from '@clerk/backend'
import { getHeader } from './nodeHandler.js'

export const AUTH_NOT_CONFIGURED = 'auth not configured'
export const NO_TOKEN = 'no token'
export const INVALID_TOKEN = 'invalid token'

// The bearer token, or '' — never null/undefined, so callers can do string work.
export function bearerToken(req) {
  const auth = getHeader(req, 'authorization')
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

// Everything that can be decided WITHOUT calling Clerk: is this deploy able to
// verify at all, and did the caller even present a token? Pure and
// env-injectable, so both answers are pinned by the unit suite instead of
// resting on a deploy CI cannot run.
//
// Returns `{ ok: true, token, secretKey }` or `{ ok: false, status, error }`.
export function authPreflight(req, env = process.env) {
  const secretKey = typeof env?.CLERK_SECRET_KEY === 'string' ? env.CLERK_SECRET_KEY.trim() : ''
  if (!secretKey) return { ok: false, status: 501, error: AUTH_NOT_CONFIGURED }
  const token = bearerToken(req)
  if (!token) return { ok: false, status: 401, error: NO_TOKEN }
  return { ok: true, token, secretKey }
}

// The full check. `verifyOptions` is passed through to Clerk — api/copy.js adds
// `authorizedParties`, the others don't.
//
// The try/catch is not decoration: @clerk/backend THROWS on some malformed
// tokens rather than returning `errors`, and the previous per-file copies didn't
// catch, so a junk Authorization header was a 500 with a stack trace instead of
// a 401.
export async function authenticateUser(req, { env = process.env, ...verifyOptions } = {}) {
  const pre = authPreflight(req, env)
  if (!pre.ok) return pre
  try {
    const { data, errors } = await verifyToken(pre.token, {
      secretKey: pre.secretKey,
      ...verifyOptions,
    })
    if (errors || !data?.sub) return { ok: false, status: 401, error: INVALID_TOKEN }
    return { ok: true, userId: data.sub }
  } catch {
    return { ok: false, status: 401, error: INVALID_TOKEN }
  }
}
