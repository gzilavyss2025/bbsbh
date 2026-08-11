// The site-owner gate, shared by every admin-write endpoint (api/copy.js and
// api/ballpark-photo.js today).
//
// WHY IT MOVED HERE. It began as three private functions inside api/copy.js,
// which was right while there was one admin endpoint. The moment a second one
// appeared, a copy of an AUTHORIZATION check is the wrong kind of duplication:
// the two copies drift, and the drift is silent in the direction that matters —
// tightening the allowlist in one file leaves the other wide open, and nothing
// in the test suite or a code review naturally compares two files that look
// finished. One implementation, two importers.
//
// The gate is two independent things, both required:
//
//   1. A Clerk session token that verifies (api/_lib/auth.js).
//   2. That token's user id present in COPY_ADMIN_USER_IDS.
//
// The Clerk `publicMetadata.role === 'admin'` check the front end does is NOT
// this gate and is not consulted here. It decides whether to draw a gear; the
// allowlist below decides whether a write lands. Keep it that way — a value the
// client can read is not a value the server may trust.
//
// The variable is still called COPY_ADMIN_USER_IDS rather than something more
// general. It is already set in production; renaming it would take a deploy to
// go from "admin can edit" to "nobody can edit, silently and fail-closed",
// which is the exact class of outage the KV_* episode was. The name is
// historical, the meaning is "site owner".

import { authenticateUser } from './auth.js'

// Parse COPY_ADMIN_USER_IDS ("user_abc,user_def") into a Set. An unset/empty
// allowlist means NO ONE can write — fail closed, never open.
export function adminIds(env = process.env) {
  return new Set(
    (env.COPY_ADMIN_USER_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

// Optional authorizedParties hardening: set CLERK_AUTHORIZED_PARTIES to the
// app's own origin(s) (comma-separated) so a token minted for a different azp
// can't be replayed here. Left unset, verifyToken skips the check — the
// allowlist still bounds writes to enumerated user ids.
export function authorizedParties(env = process.env) {
  const parties = (env.CLERK_AUTHORIZED_PARTIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parties.length ? parties : undefined
}

// Deliberately null-or-userId, unlike the per-user sync endpoints. Those
// distinguish "this deploy cannot verify" from "you sent no token" because that
// distinction is what makes a broken sync deploy diagnosable. Here every failure
// is one thing — you are not an admin — and saying which of the four reasons
// applied would tell an anonymous caller about the deploy's admin setup for no
// benefit to the one person who is allowed in. The reason still reaches the
// server log through authenticateUser.
export async function authenticateAdmin(req, { env = process.env, ...rest } = {}) {
  const auth = await authenticateUser(req, { env, authorizedParties: authorizedParties(env), ...rest })
  if (!auth.ok) return null
  return adminIds(env).has(auth.userId) ? auth.userId : null
}
