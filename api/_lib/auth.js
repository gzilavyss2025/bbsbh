// Clerk token verification for the authenticated endpoints. The incidents behind it are in ADR-0127:
// four distinct failures once collapsed to one 401; `verifyToken` RESOLVES TO THE JWT PAYLOAD (not
// `{ data, errors }`) and THROWS on failure; the log names Clerk's reason, never the token.

import { verifyToken } from '@clerk/backend'
import { getHeader, privateJson } from './nodeHandler.js'
import { getRedis } from './redis.js'

export const AUTH_NOT_CONFIGURED = 'auth not configured'
export const NO_TOKEN = 'no token'
export const INVALID_TOKEN = 'invalid token'

// The bearer token, or ''.
export function bearerToken(req) {
  const auth = getHeader(req, 'authorization')
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

// What can be decided without calling Clerk: can this deploy verify at all, did the caller present
// a token? Pure and env-injectable. `{ ok: true, token, secretKey }` or `{ ok: false, status, error }`.
export function authPreflight(req, env = process.env) {
  const secretKey = typeof env?.CLERK_SECRET_KEY === 'string' ? env.CLERK_SECRET_KEY.trim() : ''
  if (!secretKey) return { ok: false, status: 501, error: AUTH_NOT_CONFIGURED }
  const token = bearerToken(req)
  if (!token) return { ok: false, status: 401, error: NO_TOKEN }
  return { ok: true, token, secretKey }
}

// The secret key's 8-character prefix only (`sk_live_` / `sk_test_`), never the key; a publishable
// key pasted into the wrong variable is named (ADR-0127).
function keyShape(secretKey) {
  const prefix = String(secretKey).slice(0, 8)
  if (prefix.startsWith('pk_')) return `${prefix} (PUBLISHABLE KEY — belongs in VITE_CLERK_PUBLISHABLE_KEY)`
  if (!prefix.startsWith('sk_')) return `${prefix} (not a Clerk secret key)`
  return prefix
}

function failureReason(caught) {
  if (!caught) return 'verified, but the payload carried no `sub` claim'
  return `${caught?.name ?? 'Error'}: ${caught?.message ?? String(caught)}`
}

// CLERK_AUTHORIZED_PARTIES (comma-separated origins) is an optional hardening for every
// authenticated endpoint; unset, verifyToken skips the check (ADR-0127).
export function authorizedParties(env = process.env) {
  const parties = (env.CLERK_AUTHORIZED_PARTIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parties.length ? parties : undefined
}

// The full check. `verifyOptions` goes to Clerk; `log` and `verify` are injectable so the unit
// suite can pin the logging and the return-shape contract without a live Clerk instance.
export async function authenticateUser(
  req,
  { env = process.env, log = console.error, verify = verifyToken, ...rest } = {},
) {
  const verifyOptions = { authorizedParties: authorizedParties(env), ...rest }
  const pre = authPreflight(req, env)
  if (!pre.ok) return pre
  const reject = (caught) => {
    log(
      `[auth] verifyToken rejected a token — secretKey=${keyShape(pre.secretKey)} reason=${failureReason(caught)}`,
    )
    return { ok: false, status: 401, error: INVALID_TOKEN }
  }
  try {
    const payload = await verify(pre.token, { secretKey: pre.secretKey, ...verifyOptions })
    // `sub` is the Clerk user id; absent is a rejection, and the log says why.
    if (!payload?.sub) return reject(null)
    return { ok: true, userId: payload.sub }
  } catch (caught) {
    return reject(caught)
  }
}

// The per-user preamble every authenticated function repeats: method guard, store
// BEFORE auth (so a 501 names the missing Redis, not a 401), then the Clerk check.
// `fn(req, res, { redis, userId })` runs only for a verified user. `pre(req, res)`
// is an optional guard that runs after the method check and before the store (reveal's 400);
// it answers and returns true to stop.
export function withUser(methods, fn, pre) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return privateJson(res, { error: 'method not allowed' }, 405)
    if (pre?.(req, res)) return
    const redis = getRedis()
    if (!redis) return privateJson(res, { error: 'sync not configured' }, 501)
    const auth = await authenticateUser(req)
    if (!auth.ok) return privateJson(res, { error: auth.error }, auth.status)
    return fn(req, res, { redis, userId: auth.userId })
  }
}
