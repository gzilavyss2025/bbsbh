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
  // An index we could not READ must not be deleted. Deleting it anyway would
  // destroy the only way to find the shards it names, turning a transient Redis
  // failure into permanent, unreachable residue — and the reply would still say
  // `ok`, so the client would wipe the device and the user would be told they
  // had been forgotten. `partial` is how the caller knows to refuse.
  let partial = false

  let seasons = []
  try {
    const raw = await redis.smembers(`stamps:${userId}:seasons`)
    seasons = (Array.isArray(raw) ? raw : []).map(Number).filter(isSeasonNumber)
    keys.push(`stamps:${userId}:seasons`)
  } catch {
    partial = true
  }
  for (const season of seasons) keys.push(`stamps:${userId}:${season}`)

  // The reveal family is resolved from BOTH indexes, and deliberately so.
  //
  // `reveal:index:{u}` only started being written by the deploy that introduced
  // it, so every mark a user made before that is invisible to it. Left at that,
  // "erase everywhere" would silently spare an existing user's entire reveal
  // history — and RevealCloudSync would then pull those marks straight back
  // onto the freshly-wiped device, which is a reveal resurrecting itself after
  // the user asked for it to be gone.
  //
  // `scorebook:{u}` is the older index of the same games: a hash keyed by
  // gamePk, written alongside the ratchet whenever the client sends a snapshot.
  // Unioning the two makes the erase as complete as anything short of a SCAN,
  // which a shared store rules out.
  const gamePks = new Set()
  const addPks = (raw) => {
    for (const v of Array.isArray(raw) ? raw : []) {
      const n = Number(v)
      if (Number.isInteger(n) && n > 0) gamePks.add(n)
    }
  }

  try {
    addPks(await redis.smembers(`reveal:index:${userId}`))
    keys.push(`reveal:index:${userId}`)
  } catch {
    partial = true
  }
  try {
    addPks(await redis.hkeys?.(`scorebook:${userId}`))
  } catch {
    // The scorebook hash is a bonus source, not the index of record — its own
    // key is already on the delete list either way, so a failure here costs
    // completeness for pre-index games only. Not worth refusing the erase over.
  }
  for (const gamePk of gamePks) keys.push(`reveal:${userId}:${gamePk}`)

  return { keys, seasons: seasons.length, reveals: gamePks.size, partial }
}

// Exported so the unit suite can drive the real deletion against a fake Redis
// (test/api-handlers.test.js) — the same reason api/stamps.js exports `mint`.
// This is the one branch whose behaviour is the feature, and the one where
// deleting too much would be worse than deleting too little.
export async function erase(res, redis, userId) {
  const { keys, seasons, reveals, partial } = await keysForUser(redis, userId)

  // An index we could not read means we cannot know what to delete. Refuse
  // before deleting anything, so the indexes survive and a retry can still
  // find the keys — the alternative is an unrecoverable residue reported as a
  // success. The client only wipes the device on `ok`.
  if (partial) {
    return reply(res, { error: 'erase failed' }, 503)
  }

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
