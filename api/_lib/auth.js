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

// ---------------------------------------------------------------------------
// WHY THE SERVER LOGS WHAT THE RESPONSE WON'T SAY
// ---------------------------------------------------------------------------
// `401 invalid token` is the right answer to hand a CLIENT: a caller has no
// business learning whether it failed on a signature, an expiry, or this
// deploy's inability to reach Clerk at all. But it was also all the SERVER
// knew, and that is a different problem — the same one this file was written
// to solve, one level further down.
//
// Production hit exactly that wall: every genuine token rejected as `invalid
// token`, while the publishable key, the token's issuer, and the secret key
// had each been independently verified to belong to the same Clerk instance.
// Nothing was left to check from outside, because Clerk's own reason —
// `token-invalid-signature` vs `token-expired` vs `jwk-remote-failed-to-load`,
// which are three unrelated faults with three unrelated fixes — was being
// caught and thrown away right here.
//
// So the reason now goes to the log, where only the operator can read it, and
// the response is untouched. Two rules keep that safe:
//
//   - The token NEVER gets logged. It is a live credential; a log line is not
//     the place for one, and the reason is what's diagnostic anyway.
//   - The secret key is logged as its PREFIX only (`sk_live_` / `sk_test_`),
//     which is 8 characters, secret-free, and answers the two questions that
//     actually recur: is this the live instance or the test one, and is it
//     even a secret key rather than a publishable key pasted into the wrong
//     variable. That specific mix-up is easy to make — the two sit side by
//     side in Clerk's dashboard — and impossible to see once Vercel marks the
//     variable Sensitive and stops echoing it back.
function keyShape(secretKey) {
  const prefix = String(secretKey).slice(0, 8)
  // A publishable key here is a real, seen-in-the-wild misconfiguration, so it
  // gets named rather than reported as just another opaque prefix.
  if (prefix.startsWith('pk_')) return `${prefix} (PUBLISHABLE KEY — belongs in VITE_CLERK_PUBLISHABLE_KEY)`
  if (!prefix.startsWith('sk_')) return `${prefix} (not a Clerk secret key)`
  return prefix
}

// ---------------------------------------------------------------------------
// THE RETURN SHAPE — read before touching the call below
// ---------------------------------------------------------------------------
// `verifyToken` RESOLVES TO THE JWT PAYLOAD ITSELF, and THROWS when a token
// does not verify. Its signature in @clerk/backend 3.x is:
//
//   verifyToken(token, options) => Promise<JwtPayload>
//
// It does NOT resolve to `{ data, errors }`. This file used to destructure
// exactly that, and the consequence was total and silent: a payload has no
// `data` property, so `data` came back `undefined` for a PERFECTLY VALID
// token, `!data?.sub` was therefore always true, and every authenticated
// request in production was answered `401 invalid token` — reveal sync, the
// spoiled-day map, and the Logbook alike, since the day Clerk was added.
//
// It hid so well because it fails in the direction that looks like a
// misconfiguration. A bad token throws and is caught, and a GOOD token was
// rejected too, so the endpoint's outward behaviour was indistinguishable from
// a wrong secret key — which is what it was mistaken for, through several
// rounds of re-issuing keys that were correct all along. What finally named it
// was logging the reason: "no sub claim on a token that verified" only makes
// sense if verification SUCCEEDED and we discarded the result.
//
// So: read the payload directly, and let the catch handle failure. If a future
// bump changes this again, the symptom will be a 100% auth failure rate with
// valid credentials — check this contract first.
function failureReason(caught) {
  if (!caught) return 'verified, but the payload carried no `sub` claim'
  return `${caught?.name ?? 'Error'}: ${caught?.message ?? String(caught)}`
}

// The full check. `verifyOptions` is passed through to Clerk — api/copy.js adds
// `authorizedParties`, the others don't. `log` and `verify` are injectable so
// the unit suite can pin both the logging and the return-shape contract above
// without a live Clerk instance, which CI has no way to reach.
export async function authenticateUser(
  req,
  { env = process.env, log = console.error, verify = verifyToken, ...verifyOptions } = {},
) {
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
    // `sub` is the Clerk user id. Absent means this is not a session token we
    // can attribute to a user, which is a rejection — but a different one from
    // "did not verify", and the log says which.
    if (!payload?.sub) return reject(null)
    return { ok: true, userId: payload.sub }
  } catch (caught) {
    return reject(caught)
  }
}
