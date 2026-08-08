// Cross-device sync for the Game Log's named books (the shelf a passport lives
// on) — the cover half of ADR-0036, riding the same Clerk + Upstash stack as
// api/spoiled-days.js (ADR-0026) and api/stamps.js (ADR-0035).
//
//   GET    /api/books                 -> { books: [ { id, state, title, subtitle, coverTeamId, coverMark, coverColor, createdAt, updatedAt } ] }
//   POST   /api/books { id, title?, subtitle?, coverTeamId?, coverMark?, coverColor? }
//                                      -> creates (new id) or updates (existing id) one book -> { book }. 201 new / 200 update.
//   DELETE /api/books?id={bookId}     -> tombstones -> { ok: true }
//
// ONE Redis hash per user, key `books:${userId}`, fields are book ids. Unlike
// api/stamps.js there is no season sharding: a stamp collection can run into
// the hundreds over a career, so it is split by year to keep any one hash
// small, but MAX_BOOKS caps a user at 20 books, total, forever — one hash is
// already smaller than a single stamps.js season shard, so splitting it
// further would only add a second key to keep in sync for no benefit. GET
// always returns the whole hash, tombstones included: that is the reasoning
// stamps.js gives its own `?export=1` route (the merge has to see a removal to
// apply it), and here it applies to EVERY read, because with at most 20
// records there is no lighter "display" projection worth having — a season's
// worth of stamps needs one route for a page and a separate one for a sync
// engine; twenty books do not.
//
// Why a state map and not a set (restating spoiled-days.js's argument for this
// data): a book is a shelf the user arranges, not a mark that only advances.
// Create a book, sync it, remove it on the same device, and a plain union merge
// would see the server's stale 'on' on the next fetch and resurrect a book its
// owner just took away. So a removal is published as an explicit 'off'
// tombstone and the two sides reconcile per id on `updatedAt`, last write wins
// — src/lib/books.js's `applyRemoteBooks` runs the client half of the same
// rule. Safe for the same reason spoiled-days.js gives: a book only ever
// changes by a deliberate action on one of THIS user's own devices, so the
// loser of a tie is always one of the user's own two taps, never a stranger's.
//
// Nothing here is score-bearing. A book is a name, a subtitle, and a cover
// club — the same footing as a stamp's own cover fields, never the stamps
// filed inside it (those live in src/lib/stamps.js's own records, each
// carrying its own `bookId`).
//
// Unconfigured degrades exactly like the other three: no Redis (or no Clerk)
// and the endpoint 501s, leaving the client local-only. Sync has always been
// opt-in infrastructure, never a requirement.

import {
  MAX_BOOKS,
  isBookId,
  normalizeBook,
  sanitizeBookSubtitle,
  sanitizeBookTitle,
  sanitizeCoverColor,
  sanitizeCoverMark,
} from '../src/lib/books.js'
import { authenticateUser } from './_lib/auth.js'
import { jsonResponse, readJsonBody, requestUrl } from './_lib/nodeHandler.js'
import { getRedis } from './_lib/redis.js'

// Node runtime, not edge — same reason as reveal.js/spoiled-days.js/stamps.js:
// @clerk/backend's verifyToken pulls in internals Vercel's edge sandbox rejects.
export const config = { runtime: 'nodejs' }

// Per-user, auth-gated data — never let a shared cache (or the browser) hold
// one user's books and hand them to another request.
function reply(res, body, status = 200) {
  return jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })
}

const booksKey = (userId) => `books:${userId}`

// Re-validate whatever Redis hands back before it reaches a client: a
// hand-edited or cross-version hash can only ever yield known-shape books,
// never a surprise field the client would then have to defend against.
function sanitizeStored(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const value of Object.values(raw)) {
    const entry = normalizeBook(value)
    if (entry) out[entry.id] = entry
  }
  return out
}

// Every reason a create/update is refused, as `{ error, status }` or null for
// "go ahead" — pure, and exported, so what this endpoint will and will not
// write is readable at a glance and pinned by the unit suite rather than
// inferred from `mint`'s early returns (api/stamps.js's `mintRefusal` is the
// same idea for the Logbook's other collection).
//
// `isNew` distinguishes a create from a patch: the MAX_BOOKS refusal only ever
// blocks a NEW book. A user editing an existing book's title must never be
// told the shelf is full — they are not adding a book, they are decorating one
// that already fits.
export function bookRefusal({ id, isNew, liveCount } = {}) {
  if (!isBookId(id)) return { error: 'id required', status: 400 }
  if (isNew && liveCount >= MAX_BOOKS) {
    return { error: 'too many books', limit: MAX_BOOKS, status: 409 }
  }
  return null
}

// The record to store, built field by field from the request body — never
// trusted wholesale. Pure, and exported, for the same reason `stampEntry` is:
// this is where the endpoint's integrity claim lives. A body carrying `state`
// or `createdAt` contributes nothing to either — both are server-decided, the
// same way a stamp's `date` comes from the server's own game facts and never
// from the client.
//
// A PATCH, not a replace — same rule as src/lib/books.js's own
// `updateBookCover`: a field only changes when the body actually names it
// (`!== undefined`). `BooksCloudSync` always publishes the full local record,
// so this only matters for a caller that sends less — but a caller that sends
// less must not have this endpoint blank a title it never mentioned. A new or
// revived book has no "existing" value to fall back to, so an unnamed field
// there is simply empty/null, exactly what `createBook` in src/lib/books.js
// gives a fresh book.
export function bookEntry(body, existing, now) {
  const reviving = !existing || existing.state === 'off'
  const title =
    body?.title !== undefined ? sanitizeBookTitle(body.title) : reviving ? '' : existing.title
  const subtitle =
    body?.subtitle !== undefined ? sanitizeBookSubtitle(body.subtitle) : reviving ? '' : existing.subtitle
  const coverTeamId =
    body?.coverTeamId !== undefined
      ? Number.isInteger(body.coverTeamId) && body.coverTeamId > 0
        ? body.coverTeamId
        : null
      : reviving
        ? null
        : existing.coverTeamId
  // Both fall to their own safe default rather than to whatever the body said:
  // sanitizeCoverMark/sanitizeCoverColor (src/lib/books.js) close over the
  // closed sets, so an unknown value never reaches Redis and never comes back
  // out at a client that would have to render it.
  const coverMark =
    body?.coverMark !== undefined
      ? sanitizeCoverMark(body.coverMark)
      : reviving
        ? 'team'
        : sanitizeCoverMark(existing.coverMark)
  const coverColor =
    body?.coverColor !== undefined
      ? sanitizeCoverColor(body.coverColor)
      : reviving
        ? null
        : sanitizeCoverColor(existing.coverColor)
  return {
    id: existing?.id ?? body?.id,
    state: 'on',
    title,
    subtitle,
    coverTeamId,
    coverMark,
    coverColor,
    // A revived tombstone is a NEW keepsake for this purpose, same as
    // stampEntry's `reviving` — its original createdAt is gone with it.
    createdAt: reviving ? now : existing.createdAt,
    updatedAt: now,
  }
}

// The three Redis-touching verbs, each taking its `redis`/`userId` as
// parameters rather than reaching for them itself — exactly the shape
// api/stamps.js's `mint` takes, and for the same reason: these are the
// branches a live Clerk token can't reach in CI, so the unit suite drives the
// REAL production code against a fake Redis instead of a reimplementation of
// it. `handler` below is the only caller that wires them to an authenticated
// request.

export async function listBooks(res, redis, userId) {
  let stored
  try {
    stored = sanitizeStored(await redis.hgetall(booksKey(userId)))
  } catch {
    stored = {}
  }
  return reply(res, { books: Object.values(stored) })
}

export async function postBook(req, res, redis, userId) {
  const body = await readJsonBody(req)
  if (body == null) return reply(res, { error: 'invalid body' }, 400)

  const key = booksKey(userId)
  let existing = null
  try {
    existing = isBookId(body?.id) ? normalizeBook(await redis.hget(key, body.id)) : null
  } catch {
    existing = null
  }
  const isNew = !existing || existing.state === 'off'

  let liveCount = 0
  if (isNew) {
    try {
      const stored = sanitizeStored(await redis.hgetall(key))
      liveCount = Object.values(stored).filter((b) => b.state === 'on').length
    } catch {
      liveCount = 0
    }
  }

  const refusal = bookRefusal({ id: body?.id, isNew, liveCount })
  if (refusal) {
    return reply(res, { error: refusal.error, ...(refusal.limit ? { limit: refusal.limit } : {}) }, refusal.status)
  }

  const entry = bookEntry(body, existing, Date.now())
  await redis.hset(key, { [entry.id]: entry })
  return reply(res, { book: entry }, isNew ? 201 : 200)
}

export async function deleteBook(res, redis, userId, id) {
  if (!isBookId(id)) return reply(res, { error: 'id required' }, 400)

  const key = booksKey(userId)
  let existing = null
  try {
    existing = normalizeBook(await redis.hget(key, id))
  } catch {
    existing = null
  }
  // Nothing to take back reads as success — removal is idempotent, same as
  // stamps.js's unmint.
  if (!existing || existing.state === 'off') return reply(res, { ok: true })

  await redis.hset(key, { [id]: { ...existing, state: 'off', updatedAt: Date.now() } })
  return reply(res, { ok: true })
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return reply(res, { error: 'method not allowed' }, 405)
  }

  const redis = getRedis()
  if (!redis) return reply(res, { error: 'sync not configured' }, 501)

  const auth = await authenticateUser(req)
  if (!auth.ok) return reply(res, { error: auth.error }, auth.status)
  const userId = auth.userId

  if (req.method === 'GET') return listBooks(res, redis, userId)

  if (req.method === 'DELETE') {
    const { searchParams } = requestUrl(req)
    return deleteBook(res, redis, userId, searchParams.get('id'))
  }

  return postBook(req, res, redis, userId)
}
