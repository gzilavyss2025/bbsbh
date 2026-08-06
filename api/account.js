// "Erase my Tally data" — the one endpoint that takes everything back.
//
//   DELETE /api/account -> { ok: true, erased: { prefs, spoiled, scorebook, reveal, stamps } }
//
// WHY THIS EXISTS. Four features store per-user state in Redis behind a Clerk
// identity — the reveal mark (ADR-0022), the spoiled-day consent map
// (ADR-0026), the Logbook (ADR-0035) and now the preference document. Deleting
// a Clerk account does NOT cascade into any of them. Until this endpoint, the
// only honest thing the app could have told a user asking to be forgotten was
// "we can't". Now it can, and the copy on My Tally states the ordering plainly:
// erase first, then delete the account, because deleting the account first
// leaves this data addressed to a userId that can never be re-issued —
// unreachable, but not erased.
//
// (A Clerk `user.deleted` webhook is the robust version and is deliberately not
// built here: it needs a signing secret, a public unauthenticated endpoint and
// dashboard configuration. Recorded as an open thread rather than half-built.)
//
// ---------------------------------------------------------------------------
// WHAT IT DELETES, AND THE ONE THING IT MUST NOT
// ---------------------------------------------------------------------------
// Everything keyed to the VERIFIED `sub` claim, and nothing else:
//
//   prefs:{u}                 the preference document
//   spoiled:{u}               the day-consent map
//   scorebook:{u}             the "pick up your pencil" index
//   stamps:{u}:{season}       every season shard, then stamps:{u}:seasons
//   reveal:{u}:{gamePk}       every reveal mark, via reveal:index:{u}
//
// `game:final:{gamePk}` is deliberately NOT deleted. It is a SHARED, immutable
// cache of public facts, keyed by game and belonging to no user; erasing it
// would degrade every other user's Logbook to punish nobody. It contains
// nothing about who looked at it.
//
// The reveal family is the only one with no natural index, which is why
// api/reveal.js maintains `reveal:index:{u}` — a set of gamePks, an identity
// and never a mark or a score. It exists so this deletion can be COMPLETE
// rather than best-effort, which is the whole difference between an erase and
// a gesture.
//
// Unconfigured degrades like every sibling: no Redis (or no Clerk) and this
// 501s, which is correct — there is nothing stored to erase.

import { isSeasonNumber } from '../src/lib/stamps.js'
import { authenticateUser } from './_lib/auth.js'
import { jsonResponse } from './_lib/nodeHandler.js'
import { getRedis } from './_lib/redis.js'

// Node runtime, not edge — same reason as every other authenticated function
// here: @clerk/backend's verifyToken pulls in internals Vercel's edge sandbox
// rejects.
export const config = { runtime: 'nodejs' }

function reply(res, body, status = 200) {
  return jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })
}

// Every key belonging to one user, resolved from the two indexes rather than a
// SCAN. Pure apart from the two reads, and exported so the unit suite can pin
// the key set — including the negative: `game:final:*` is never in it.
export async function keysForUser(redis, userId) {
  const keys = [`prefs:${userId}`, `spoiled:${userId}`, `scorebook:${userId}`]

  let seasons = []
  try {
    const raw = await redis.smembers(`stamps:${userId}:seasons`)
    seasons = (Array.isArray(raw) ? raw : []).map(Number).filter(isSeasonNumber)
  } catch {
    seasons = []
  }
  for (const season of seasons) keys.push(`stamps:${userId}:${season}`)
  keys.push(`stamps:${userId}:seasons`)

  let gamePks = []
  try {
    const raw = await redis.smembers(`reveal:index:${userId}`)
    gamePks = (Array.isArray(raw) ? raw : [])
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0)
  } catch {
    gamePks = []
  }
  for (const gamePk of gamePks) keys.push(`reveal:${userId}:${gamePk}`)
  keys.push(`reveal:index:${userId}`)

  return { keys, seasons: seasons.length, reveals: gamePks.length }
}

// Exported so the unit suite can drive the real deletion against a fake Redis
// (test/api-handlers.test.js) — the same reason api/stamps.js exports `mint`.
// This is the one branch whose behaviour is the feature, and the one where
// deleting too much would be worse than deleting too little.
export async function erase(res, redis, userId) {
  const { keys, seasons, reveals } = await keysForUser(redis, userId)

  // Deleted in one call where the client supports it, and never partially
  // reported: an erase that half-succeeded must say so rather than answer
  // `ok` and leave the user believing otherwise.
  try {
    await redis.del(...keys)
  } catch {
    return reply(res, { error: 'erase failed' }, 503)
  }

  // Counts of what was addressed, so the confirmation can be specific without
  // naming a single game. Note what is absent from this response and from this
  // whole file: any game, club, date, or number that came out of a ballpark.
  return reply(res, {
    ok: true,
    erased: { prefs: 1, spoiled: 1, scorebook: 1, stamps: seasons, reveal: reveals },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return reply(res, { error: 'method not allowed' }, 405)
  }

  // Store before auth, same ordering and same diagnostic reason as every other
  // authenticated function here.
  const redis = getRedis()
  if (!redis) return reply(res, { error: 'sync not configured' }, 501)

  const auth = await authenticateUser(req)
  if (!auth.ok) return reply(res, { error: auth.error }, auth.status)

  return erase(res, redis, auth.userId)
}
