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
//
// A SECOND, SMALLER FACT rides the same (userId, gamePk) address: whether the
// reader has opened this game's BOX SCORE (ADR-0049), at
// `revealbox:{userId}:{gamePk}`. One bit, no position — only that one seal on
// one page was lifted. It lives here rather than on its own endpoint because
// it shares the family: same auth, same erase index (`reveal:index:{u}`, which
// api/account.js reads to find both), one round trip for a client that wants
// both. Its ratchet is set-only: 1, never back to 0.

import { authenticateUser } from './_lib/auth.js'
import { jsonResponse, readJsonBody, requestUrl } from './_lib/nodeHandler.js'
import { getRedis } from './_lib/redis.js'

// Node.js runtime, NOT edge (unlike og.js/preview.js) — @clerk/backend's
// verifyToken pulls in @clerk/shared internals that Vercel's edge sandbox
// rejects outright (confirmed live: NOW_SANDBOX_WORKER_EDGE_FUNCTION_UNSUPPORTED_MODULES).
// The handler below still uses the Web-standard Request/Response shape, which
// Vercel's Node.js runtime supports the same as edge — only `config.runtime` changes.
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
// and club names, doubleheader game number, regulation length, and — once the
// game has ended — the half-index of its true last half (`finalHalfIndex`,
// null until then; see selectFinalHalfIndex in src/api/select.js). Never a
// score, same footing as revealedThrough itself (see ADR-0022).
const SCOREBOOK_MAX = 24

export function sanitizeSnapshot(game) {
  if (!game || typeof game !== 'object') return null
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
  const date = str(game.date, 10)
  const away = str(game.away, 5)
  const home = str(game.home, 5)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !away || !home) return null
  const num = (v, dflt, max) =>
    Number.isInteger(v) && v >= 1 && v <= max ? v : dflt
  const finalHalfIndex =
    Number.isInteger(game.finalHalfIndex) &&
    game.finalHalfIndex >= 0 &&
    game.finalHalfIndex <= MAX_REVEALED_THROUGH
      ? game.finalHalfIndex
      : null
  return {
    date,
    away,
    home,
    awayName: str(game.awayName, 40),
    homeName: str(game.homeName, 40),
    gameNumber: num(game.gameNumber, 1, 3),
    regulation: num(game.regulation, 9, 15),
    finalHalfIndex,
  }
}

// Whether a scorebook entry has finished the arc "Pick up your pencil"
// tracks: the game ended (finalHalfIndex resolved) and the user has revealed
// every half there is. An entry in this state has nothing left to pick up, so
// it drops out of the index rather than sitting there forever — the automatic
// half of "delete games from my pencil" (the DELETE method below is the
// manual half). Pure so the POST ratchet and the GET ?recent=1 prune share one
// answer instead of two chances to disagree.
export function isFullyWrappedUp(entry) {
  return (
    Number.isInteger(entry?.finalHalfIndex) &&
    Number.isInteger(entry?.revealedThrough) &&
    entry.revealedThrough >= entry.finalHalfIndex
  )
}

// Shapes the raw scorebook hash into what GET ?recent=1 returns, splitting
// out any entry that has finished its own arc (isFullyWrappedUp) so the
// handler can prune those from Redis in the same request. Pure — the Redis
// round trip lives in the handler, this only decides what belongs where.
export function recentGamesView(all) {
  const entries = Object.entries(all ?? {})
    .map(([pk, v]) => (v && typeof v === 'object' ? { gamePk: Number(pk), ...v } : null))
    .filter(Boolean)
  const done = entries.filter(isFullyWrappedUp).map((g) => String(g.gamePk))
  const games = entries
    .filter((g) => !isFullyWrappedUp(g))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 12)
  return { games, done }
}

// What a POST body actually asks to store, or the refusal — pure, so the one
// piece of this endpoint that decides what a request may write is unit-tested
// directly rather than through a fake Redis (same reason `sanitizeSnapshot` and
// `isFullyWrappedUp` are exported).
//
// Two writes, either one on its own. `revealedThrough` was mandatory before
// ADR-0049 and the box bit came along, and a box-only POST is the ORDINARY case
// now, not an edge one: opening a box score is exactly the thing a reader does
// on a game they have never hand-revealed a half of, so `revealedThrough` is
// genuinely absent then rather than 0. An out-of-range mark is still a 400
// whether or not the box bit rode along — a malformed field is refused, never
// silently dropped while the rest of the request succeeds.
export function plannedWrites(body) {
  const raw = body?.revealedThrough
  const wantsMark = raw !== undefined && raw !== null
  if (
    wantsMark &&
    (!Number.isInteger(raw) || raw < 0 || raw > MAX_REVEALED_THROUGH)
  ) {
    return { error: 'revealedThrough out of range' }
  }
  // Strictly `true`. A truthy string or 1 from some future client is a shape we
  // did not agree to, and this bit lifts a seal — so it must be spelled.
  const box = body?.boxRevealed === true
  if (!wantsMark && !box) return { error: 'nothing to store' }
  return { mark: wantsMark ? raw : null, box }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
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

  // GET ?recent=1 — the scorebook index, newest first. Any entry that's
  // finished its own arc (fully revealed, game over) is dropped from the
  // response AND pruned from Redis here as a safety net — the ordinary path
  // is the POST ratchet below never writing one back in the first place, but
  // this catches an entry an older client wrote before this check existed.
  if (wantRecent) {
    if (req.method !== 'GET') return reply(res, { error: 'method not allowed' }, 405)
    const bookKey = `scorebook:${userId}`
    const all = (await redis.hgetall(bookKey)) || {}
    const { games, done } = recentGamesView(all)
    if (done.length) {
      try {
        await redis.hdel(bookKey, ...done)
      } catch {
        // Best-effort tidy; already excluded from THIS response either way.
      }
    }
    return reply(res, { games })
  }

  // DELETE ?gamePk= — the manual half of "delete games from my pencil."
  // Removes only this game's scorebook-index entry, never the
  // `reveal:{userId}:{gamePk}` mark itself: this clears the card from the
  // slate strip, not the user's own reveal progress, so returning to the game
  // directly still resumes where they left off. If they keep scoring it, the
  // next reveal's POST below folds it back into the index — the same as any
  // other progress update.
  if (req.method === 'DELETE') {
    await redis.hdel(`scorebook:${userId}`, gamePk)
    return reply(res, { ok: true })
  }

  const key = `reveal:${userId}:${gamePk}`
  const boxKey = `revealbox:${userId}:${gamePk}`

  if (req.method === 'GET') {
    // Both facts in one trip, in parallel: the client that asks for one of them
    // (BoxScore) and the client that asks for the other (InningViewer) send the
    // same request, and a second round trip would buy nothing.
    const [current, box] = await Promise.all([redis.get(key), redis.get(boxKey)])
    const revealedThrough = Number.isInteger(current) ? current : -1
    // Anything stored is a 1 this endpoint wrote; an absent key is the answer
    // that leaves the seal on, which is the direction to fail in.
    const boxRevealed = Boolean(box)
    // Backfill the erase index for a mark this user made before the index
    // existed. Without this, `reveal:index:{u}` is populated FORWARD ONLY, so
    // every pre-index mark survives "erase my Tally data everywhere" — and is
    // then pulled straight back onto the freshly-wiped device the next time
    // that game is opened, which is a reveal resurrecting itself after the user
    // asked for it to be gone. Opening a game is the one moment we can name a
    // gamePk that is certainly this user's, so the repair belongs here.
    //
    // The box bit is indexed the same way and for the same reason: an erase
    // that left it behind would re-open a box score on the next visit to a
    // freshly-wiped device, which is the same resurrection in a smaller size.
    if (revealedThrough >= 0 || boxRevealed) {
      try {
        await redis.sadd(`reveal:index:${userId}`, gamePk)
      } catch {
        // Same posture as the ratchet's own index write below: losing this
        // costs completeness on a future erase, never a mark.
      }
    }
    return reply(res, { revealedThrough, boxRevealed })
  }

  // POST — ratchet: the stored value can only ever increase.
  const body = await readJsonBody(req)
  if (body == null) {
    return reply(res, { error: 'invalid body' }, 400)
  }
  const plan = plannedWrites(body)
  if (plan.error) {
    return reply(res, { error: plan.error }, 400)
  }
  // The mark, when one was sent. `null` (a box-only POST) leaves the stored
  // integer exactly as it is — a reader who opened a box score has not scored a
  // half by hand, and writing a 0 would claim they had.
  const next =
    plan.mark === null ? null : Number(await redis.eval(RATCHET_SCRIPT, [key], [plan.mark]))
  // Set-only, no ratchet script needed: the value is always 1, so a concurrent
  // second write cannot disagree with the first.
  if (plan.box) await redis.set(boxKey, 1)

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
  //
  // Unless this reveal just finished the game's own arc — the whole point of
  // "go away once you've unlocked every half inning and the game is over":
  // rather than writing an entry back in only to have the next GET prune it,
  // drop it here on the very reveal that completes it.
  //
  // A box-only POST never lands here even if a client sent a snapshot with it:
  // the scorebook strip is "pick up your pencil where you left off", and it
  // reads `revealedThrough`. Opening a box score is not picking up a pencil.
  const snapshot = next === null ? null : sanitizeSnapshot(body?.game)
  if (snapshot) {
    const bookKey = `scorebook:${userId}`
    const entry = { ...snapshot, revealedThrough: next, updatedAt: Date.now() }
    if (isFullyWrappedUp(entry)) {
      try {
        await redis.hdel(bookKey, gamePk)
      } catch {
        // Best-effort; a leftover finished entry is caught by the next
        // GET ?recent=1's own prune either way.
      }
    } else {
      await redis.hset(bookKey, { [gamePk]: entry })
      const all = (await redis.hgetall(bookKey)) || {}
      const stale = Object.entries(all)
        .sort(([, a], [, b]) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0))
        .slice(SCOREBOOK_MAX)
        .map(([pk]) => pk)
      if (stale.length) await redis.hdel(bookKey, ...stale)
    }
  }

  // `revealedThrough` is the ratcheted value the caller should adopt, or null
  // when this POST carried no mark — a box-only write reports on what it wrote
  // and stays quiet about what it did not touch, rather than inventing a -1 the
  // client might merge.
  return reply(res, { revealedThrough: next, boxRevealed: plan.box })
}
