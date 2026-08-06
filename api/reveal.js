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

import { authenticateUser } from './_lib/auth.js'
import { jsonResponse, readJsonBody, requestUrl } from './_lib/nodeHandler.js'
import { getRedis } from './_lib/redis.js'

// Node.js runtime, NOT edge (unlike og.js/preview.js) — @clerk/backend's
// verifyToken pulls in @clerk/shared internals that Vercel's edge sandbox
// rejects outright (confirmed live: NOW_SANDBOX_WORKER_EDGE_FUNCTION_UNSUPPORTED_MODULES,
// deployment dpl_F3DPPSY3uQvXPyecXSRMVhwPCWtw). The handler below still uses
// the Web-standard Request/Response shape, which Vercel's Node.js runtime
// supports the same as edge — only the `config.runtime` value changes.
export const config = { runtime: 'nodejs' }

// Per-user, auth-gated data — never let a shared cache (or the browser) hold one
// user's reveal progress and hand it to another request.
function reply(res, body, status = 200) {
  return jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })
}

// A revealedThrough is a half-index; even a marathon extra-inning game stays
// well under this. Bounds a malformed/hostile client so it can't store an
// absurd integer that would then gate every device to a nonsense high-water.
const MAX_REVEALED_THROUGH = 200

// Atomically ratchet KEYS[1] up to ARGV[1] server-side, returning the resulting
// value. Doing the max in Lua (rather than GET then SET in JS) closes the
// read-modify-write race where two concurrent devices could each read the old
// value and the lower write land last.
const RATCHET_SCRIPT = `local cur = tonumber(redis.call('GET', KEYS[1]))
local inc = tonumber(ARGV[1])
if cur == nil or inc > cur then
  redis.call('SET', KEYS[1], inc)
  return inc
end
return cur`

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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return reply(res, { error: 'method not allowed' }, 405)
  }

  const { searchParams } = requestUrl(req)
  const wantRecent = searchParams.get('recent') === '1'
  const gamePk = searchParams.get('gamePk')
  if (!wantRecent && (!gamePk || !/^\d+$/.test(gamePk))) {
    return reply(res, { error: 'gamePk required' }, 400)
  }

  const redis = getRedis()
  if (!redis) return reply(res, { error: 'sync not configured' }, 501)

  const auth = await authenticateUser(req)
  if (!auth.ok) return reply(res, { error: auth.error }, auth.status)
  const userId = auth.userId

  // GET ?recent=1 — the scorebook index, newest first.
  if (wantRecent) {
    if (req.method !== 'GET') return reply(res, { error: 'method not allowed' }, 405)
    const all = (await redis.hgetall(`scorebook:${userId}`)) || {}
    const games = Object.entries(all)
      .map(([pk, v]) => (v && typeof v === 'object' ? { gamePk: Number(pk), ...v } : null))
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 12)
    return reply(res, { games })
  }

  const key = `reveal:${userId}:${gamePk}`

  if (req.method === 'GET') {
    const current = await redis.get(key)
    const revealedThrough = Number.isInteger(current) ? current : -1
    return reply(res, { revealedThrough })
  }

  // POST — ratchet: the stored value can only ever increase.
  const body = await readJsonBody(req)
  if (body == null) {
    return reply(res, { error: 'invalid body' }, 400)
  }
  const incoming = body?.revealedThrough
  if (!Number.isInteger(incoming) || incoming < 0 || incoming > MAX_REVEALED_THROUGH) {
    return reply(res, { error: 'revealedThrough out of range' }, 400)
  }
  const next = Number(await redis.eval(RATCHET_SCRIPT, [key], [incoming]))

  // Remember that this user has a mark for this game. `reveal:{u}:{gamePk}` is
  // the only per-user key family with no natural index, so without this set
  // "erase my Tally data" (api/account.js) could only ever be best-effort —
  // there is no way to enumerate them, and a SCAN across a shared store is not
  // one. The set holds gamePks: an identity, never a mark and never a score,
  // exactly the footing of the scorebook index below it.
  //
  // Deliberately unbounded, unlike SCOREBOOK_MAX. A cap here would make the
  // erase silently incomplete for whatever fell off it, which defeats the only
  // reason the index exists; a set of integers bounded by how many games a
  // human actually opens is small enough to leave alone. Failing to record one
  // must never fail the ratchet, which is the write that matters.
  try {
    await redis.sadd(`reveal:index:${userId}`, gamePk)
  } catch {
    // Losing an index write costs completeness on a future erase, never a mark.
  }

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

  return reply(res, { revealedThrough: next })
}
