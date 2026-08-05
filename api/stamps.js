// The Logbook — a user's collection of game stamps (ADR-0035). The fourth
// opt-in backend exception, and the FIRST one that stores score-bearing data,
// riding the same Clerk + Upstash stack as api/reveal.js (ADR-0022) and
// api/spoiled-days.js (ADR-0026).
//
//   GET    /api/stamps?season=2026     -> { season, stamps: [ { gamePk, …, game } ] }
//   GET    /api/stamps?seasons=1       -> { seasons: [ { season, count } ] }
//   GET    /api/stamps?export=1        -> { stamps: [ … every season, tombstones included … ] }
//   POST   /api/stamps { gamePk, mode?, note? }  -> { stamp }   201 new / 200 update
//   DELETE /api/stamps?gamePk=824680   -> { ok: true }
//
// WHAT MAKES THIS SAFE — read before touching `mint` below. A stamp carries a
// final score by definition; that is the whole point of the artifact. The
// spoiler rule survives because of one server-enforced invariant:
//
//   You cannot own a stamp for a game you have not finished revealing.
//
// `meetsRevealGate` (src/lib/stamps.js) is that sentence, and it runs HERE, on
// the server, against this user's own `reveal:{userId}:{gamePk}` ratchet and
// `spoiled:{userId}` consent map — never against a client-supplied claim. So
// every number the Logbook renders, however plainly, is a number this user
// already chose to see. Do not add a "trust the client" path; the known gap
// (a user who revealed a game before signing in has no server mark) is closed
// by the CLIENT posting its local mark to /api/reveal first — that endpoint is
// a one-directional ratchet and safe to feed — not by weakening this.
//
// The score itself lives in `game:final:{gamePk}`, a SHARED, immutable cache of
// public facts the server fetches for itself. The per-user record holds only
// state/mode/timestamps/note, which keeps it on exactly the same footing as
// revealedThrough, and means a client cannot mint a fabricated 20-0 stamp.
//
// Unconfigured degrades like the other two: no Redis (or no Clerk) and the
// endpoint 501s, leaving the client local-only. Sync has always been opt-in.

import { verifyToken } from '@clerk/backend'
import {
  DEFAULT_STAMP_MODE,
  MAX_STAMPS_PER_SEASON,
  isSeasonNumber,
  isStampMode,
  meetsRevealGate,
  normalizePlacement,
  normalizeStamp,
  sanitizeNote,
  seasonFromDate,
  toGamePk,
} from '../src/lib/stamps.js'
import { getHeader, jsonResponse, readJsonBody, requestUrl } from './_lib/nodeHandler.js'
import { getRedis } from './_lib/redis.js'

// Node runtime, not edge — same reason as reveal.js/spoiled-days.js:
// @clerk/backend's verifyToken pulls in internals Vercel's edge sandbox rejects.
export const config = { runtime: 'nodejs' }

// Per-user, auth-gated, and score-bearing — the one response in this codebase
// where a shared cache would leak an actual score. Never relax this header.
function reply(res, body, status = 200) {
  return jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })
}

async function authenticate(req) {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null
  const auth = getHeader(req, 'authorization')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const { data, errors } = await verifyToken(token, { secretKey })
  if (errors || !data?.sub) return null
  return data.sub
}

const stampsKey = (userId, season) => `stamps:${userId}:${season}`
const seasonsKey = (userId) => `stamps:${userId}:seasons`

// ---------------------------------------------------------------------------
// game:final — the shared, immutable public-facts cache
// ---------------------------------------------------------------------------

// One schedule call, ~20 KB, with everything a stamp needs to draw itself. The
// field paths were verified live against gamePk 778241 (2025-04-20 SEA@TOR);
// `hydrate=team` is what supplies `abbreviation` and `sport.id`, which the bare
// row does not carry (same reason src/api/schedule.js hydrates it).
const SCHEDULE_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1/schedule?gamePk=${gamePk}` +
  '&hydrate=linescore,decisions,venue,team'

function sideFacts(side, lineSide) {
  return {
    id: side?.team?.id ?? null,
    abbreviation: side?.team?.abbreviation ?? '',
    name: side?.team?.name ?? '',
    runs: typeof lineSide?.runs === 'number' ? lineSide.runs : (side?.score ?? null),
    hits: typeof lineSide?.hits === 'number' ? lineSide.hits : null,
    errors: typeof lineSide?.errors === 'number' ? lineSide.errors : null,
  }
}

// The server fetches the score itself and never trusts a client's. Returns null
// when the game can't be resolved at all, and a bare `{ gamePk, status }` when
// it resolves but isn't Final — the caller turns each into its own error, which
// is worth distinguishing ("no such game" vs. "not over yet").
async function fetchGameFinal(gamePk) {
  let game
  try {
    const r = await fetch(SCHEDULE_URL(gamePk), { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const json = await r.json()
    game = json?.dates?.[0]?.games?.[0]
  } catch {
    return null
  }
  if (!game || game.gamePk !== gamePk) return null

  const status = game?.status?.abstractGameState ?? ''
  if (status !== 'Final') return { gamePk, status: status || 'Unknown' }

  const line = game.linescore ?? {}
  const innings = Array.isArray(line.innings) ? line.innings.length : 0
  const last = innings ? line.innings[innings - 1] : null
  // The same test liveEdge.js's edgeFromLinescore makes: a home entry with an
  // actual number means the bottom was reached. A home team leading after the
  // top of the last inning never bats, and the reveal gate has to know that or
  // it would demand a half that does not exist.
  const homeBattedLast = typeof last?.home?.runs === 'number'

  const away = sideFacts(game.teams?.away, line.teams?.away)
  const home = sideFacts(game.teams?.home, line.teams?.home)
  const winnerId = game.teams?.away?.isWinner
    ? away.id
    : game.teams?.home?.isWinner
      ? home.id
      : null

  return {
    gamePk,
    date: game.officialDate ?? '',
    gameNumber: Number.isInteger(game.gameNumber) ? game.gameNumber : 1,
    sportId: game.teams?.home?.team?.sport?.id ?? 1,
    gameType: game.gameType ?? 'R',
    venue: game.venue?.name ?? '',
    innings,
    homeBattedLast,
    status: 'Final',
    away,
    home,
    winnerId,
    decisions: {
      winner: game.decisions?.winner?.fullName ?? '',
      loser: game.decisions?.loser?.fullName ?? '',
      save: game.decisions?.save?.fullName ?? '',
    },
  }
}

// Cache-then-fetch. A Final game's score never changes, so the cached blob has
// no TTL and the first stamper pays for everyone. Only Final blobs are written —
// caching a live game would freeze a score that is still moving.
async function resolveGameFinal(redis, gamePk) {
  const key = `game:final:${gamePk}`
  let cached = null
  try {
    cached = await redis.get(key)
  } catch {
    cached = null
  }
  if (cached && typeof cached === 'object' && cached.status === 'Final') return cached

  const fetched = await fetchGameFinal(gamePk)
  if (fetched?.status === 'Final' && seasonFromDate(fetched.date) != null) {
    try {
      await redis.set(key, fetched)
    } catch {
      // A cache write failing must not fail the mint — the facts are in hand.
    }
  }
  return fetched
}

// ---------------------------------------------------------------------------
// Reading the collection
// ---------------------------------------------------------------------------

// Re-validate whatever Redis hands back before it reaches a client, exactly as
// spoiled-days.js does: a hand-edited or cross-version hash can only ever yield
// known-shape entries.
function sanitizeStored(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [field, value] of Object.entries(raw)) {
    const gamePk = toGamePk(field)
    if (gamePk == null) continue
    const entry = normalizeStamp(value)
    if (entry) out[gamePk] = entry
  }
  return out
}

async function readSeasons(redis, userId) {
  try {
    const raw = await redis.smembers(seasonsKey(userId))
    return (Array.isArray(raw) ? raw : [])
      .map((s) => Number(s))
      .filter(isSeasonNumber)
      .sort((a, b) => b - a)
  } catch {
    return []
  }
}

// The user hash as response rows, joined against the shared facts cache.
//
// ---------------------------------------------------------------------------
// WHY `includeRemoved` EXISTS — the un-stamp propagation fix
// ---------------------------------------------------------------------------
// A removal is stored as an explicit 'off' tombstone rather than a deleted
// field (see `applyRemoteStamps` in src/lib/stamps.js for why deleting would
// resurrect the stamp on the next merge). This function used to filter those
// tombstones out of EVERY response — which meant the removal reached the server
// and stopped there: a second device holding that stamp saw a payload with the
// gamePk simply absent, absence correctly means "no opinion" in the merge, and
// so it kept showing a stamp its owner had taken back. ADR-0035 named that gap;
// this closes it.
//
// The split is by PURPOSE, not by caller convenience:
//
//   - `?export=1` is the SYNC payload. It carries tombstones, because the merge
//     needs to see the removal to apply it (last write wins on `updatedAt`).
//   - `?season=` and `?seasons=1` are DISPLAY payloads. A tombstone has nothing
//     to render and nothing to count, so they stay live-only.
//
// Every row now carries an explicit `state`, including the live ones. A client
// must read it rather than assuming 'on' — an assumption is exactly what made
// the old payload unable to express a removal at all.
//
// Pure, and exported, so the tombstone rules above are pinned by the unit suite
// (test/api-handlers.test.js) rather than resting on a Redis round trip nobody
// can run in CI.
export function seasonRows(stored, facts, { includeRemoved = false } = {}) {
  const entries = Object.entries(stored ?? {}).filter(
    ([, entry]) => entry?.state === 'on' || (includeRemoved && entry?.state === 'off'),
  )
  return entries
    .map(([gamePk, entry]) => ({
      gamePk: Number(gamePk),
      state: entry.state,
      mode: entry.mode,
      stampedAt: entry.stampedAt,
      updatedAt: entry.updatedAt,
      note: entry.note,
      date: entry.date,
      // Where the stamp sits in the user's passport book. A page number and
      // two fractions — nothing score-bearing — and it travels for the same
      // reason the note does: a book arranged on the phone must be the same
      // book on the laptop. Rows are built field by field here, so a new
      // field that isn't listed is silently dropped on the way out.
      placement: entry.placement ?? null,
      // A stamp whose facts are missing still belongs to the user — it renders
      // from the abbreviation-and-date it carries rather than vanishing. A
      // tombstone never joins facts at all: there is nothing left to draw.
      game:
        entry.state === 'on' && facts?.[gamePk] && typeof facts[gamePk] === 'object'
          ? facts[gamePk]
          : null,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.stampedAt - a.stampedAt))
}

async function readSeason(redis, userId, season, { includeRemoved = false } = {}) {
  let stored
  try {
    stored = sanitizeStored(await redis.hgetall(stampsKey(userId, season)))
  } catch {
    return []
  }
  // Only live stamps have facts to join, so only they are looked up — a season
  // of tombstones costs no mget at all.
  const live = Object.keys(stored).filter((gamePk) => stored[gamePk].state === 'on')
  const facts = {}
  if (live.length) {
    try {
      const blobs = await redis.mget(...live.map((gamePk) => `game:final:${gamePk}`))
      live.forEach((gamePk, i) => {
        facts[gamePk] = blobs?.[i] ?? null
      })
    } catch {
      // Facts unavailable — the stamps themselves still travel.
    }
  }
  return seasonRows(stored, facts, { includeRemoved })
}

// ---------------------------------------------------------------------------
// Minting
// ---------------------------------------------------------------------------

// The gate. Both reads are of THIS user's own keys, written by the two existing
// ratchets — nothing here comes from the request body.
async function gatePasses(redis, userId, game) {
  let revealedThrough = -1
  let daySpoiled = false
  try {
    const [mark, consent] = await Promise.all([
      redis.get(`reveal:${userId}:${game.gamePk}`),
      redis.hget(`spoiled:${userId}`, game.date),
    ])
    if (Number.isInteger(mark)) revealedThrough = mark
    daySpoiled = consent === 'on'
  } catch {
    // Fail CLOSED: if we cannot prove the user revealed this game, we do not
    // mint. A Redis blip costs a retry, never a stamp the gate didn't allow.
    return false
  }
  return meetsRevealGate({ game, revealedThrough, daySpoiled })
}

async function mint(req, res, redis, userId) {
  const body = await readJsonBody(req)
  if (body == null) return reply(res, { error: 'invalid body' }, 400)

  const gamePk = toGamePk(body.gamePk)
  if (gamePk == null) return reply(res, { error: 'gamePk required' }, 400)

  const game = await resolveGameFinal(redis, gamePk)
  if (!game) return reply(res, { error: 'game not found' }, 404)
  if (game.status !== 'Final') return reply(res, { error: 'game not final' }, 409)

  const season = seasonFromDate(game.date)
  if (season == null) return reply(res, { error: 'game not found' }, 404)

  if (!(await gatePasses(redis, userId, game))) {
    return reply(res, { error: 'game not revealed' }, 403)
  }

  const key = stampsKey(userId, season)
  let existing = null
  try {
    existing = normalizeStamp(await redis.hget(key, String(gamePk)))
  } catch {
    existing = null
  }

  const now = Date.now()
  const reviving = !existing || existing.state === 'off'

  if (reviving) {
    // Reject at the cap rather than pruning: a stamp is a keepsake and must
    // never vanish on its own (contrast the scorebook index, which prunes).
    let count = 0
    try {
      count = Number(await redis.hlen(key)) || 0
    } catch {
      count = 0
    }
    if (count >= MAX_STAMPS_PER_SEASON) {
      return reply(res, { error: 'season full', limit: MAX_STAMPS_PER_SEASON }, 409)
    }
  }

  const asked = normalizePlacement(body.placement)
  const entry = {
    state: 'on',
    mode: isStampMode(body.mode) ? body.mode : DEFAULT_STAMP_MODE,
    // Re-stamping keeps the keepsake's original date; only `updatedAt` moves.
    stampedAt: reviving ? now : existing.stampedAt,
    updatedAt: now,
    note: sanitizeNote(body.note),
    date: game.date,
    // Same rule as the client's addStamp: a publish that carries no placement
    // must not knock the stamp off the page it already sits on, and a revived
    // tombstone starts unplaced. Validated server-side like every other field
    // — the client's number is never trusted, it is re-checked.
    placement: asked ?? (reviving ? null : (existing.placement ?? null)),
  }

  await redis.hset(key, { [gamePk]: entry })
  try {
    await redis.sadd(seasonsKey(userId), String(season))
  } catch {
    // The season index is a nav convenience; losing a write costs a season
    // heading, never a stamp.
  }

  return reply(res, { stamp: { gamePk, ...entry, game } }, reviving ? 201 : 200)
}

// Un-stamp. Reversible, deliberately NOT ratcheted — the one place the Logbook
// differs in character from revealedThrough. Writes a tombstone rather than
// deleting the field, so the removal survives a merge from another device.
async function unmint(res, redis, userId, gamePk) {
  const game = await (async () => {
    try {
      return await redis.get(`game:final:${gamePk}`)
    } catch {
      return null
    }
  })()

  // Normally the facts cache tells us the season shard. If it's missing (a
  // stamp minted before a cache eviction), fall back to walking the user's own
  // small seasons set rather than leaving a stamp the user cannot remove.
  const seasons =
    seasonFromDate(game?.date) != null
      ? [seasonFromDate(game.date)]
      : await readSeasons(redis, userId)

  const now = Date.now()
  for (const season of seasons) {
    const key = stampsKey(userId, season)
    let existing = null
    try {
      existing = normalizeStamp(await redis.hget(key, String(gamePk)))
    } catch {
      existing = null
    }
    if (!existing) continue
    await redis.hset(key, { [gamePk]: { ...existing, state: 'off', updatedAt: now } })
    return reply(res, { ok: true })
  }
  // Nothing to take back reads as success — un-stamping is idempotent.
  return reply(res, { ok: true })
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return reply(res, { error: 'method not allowed' }, 405)
  }

  const { searchParams } = requestUrl(req)

  const redis = getRedis()
  if (!redis) return reply(res, { error: 'sync not configured' }, 501)

  const userId = await authenticate(req)
  if (!userId) return reply(res, { error: 'unauthorized' }, 401)

  if (req.method === 'GET') {
    // The cheap nav payload.
    if (searchParams.get('seasons') === '1') {
      const seasons = await readSeasons(redis, userId)
      const counts = await Promise.all(
        seasons.map(async (season) => ({
          season,
          count: (await readSeason(redis, userId, season)).length,
        })),
      )
      return reply(res, { seasons: counts.filter((s) => s.count > 0) })
    }

    // A keepsake collection with no way to take it with you is a bad promise,
    // so the export is a first-class route rather than a someday feature. It is
    // also the SYNC payload (StampsCloudSync GETs it on sign-in), which is why
    // it — and only it — carries tombstones: see `seasonRows`.
    if (searchParams.get('export') === '1') {
      const seasons = await readSeasons(redis, userId)
      const all = await Promise.all(
        seasons.map((s) => readSeason(redis, userId, s, { includeRemoved: true })),
      )
      return reply(res, { stamps: all.flat() })
    }

    const season = Number(searchParams.get('season'))
    if (!isSeasonNumber(season)) return reply(res, { error: 'season required' }, 400)
    return reply(res, { season, stamps: await readSeason(redis, userId, season) })
  }

  if (req.method === 'POST') return mint(req, res, redis, userId)

  const gamePk = toGamePk(searchParams.get('gamePk'))
  if (gamePk == null) return reply(res, { error: 'gamePk required' }, 400)
  return unmint(res, redis, userId, gamePk)
}
