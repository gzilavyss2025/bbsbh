// Request-level coverage for api/books.js — the Game Log's named-book sync
// endpoint. Modeled on test/api-handlers.test.js's fake-Redis pattern: a small
// in-memory object implementing the subset of the Redis client this handler
// actually calls (hgetall/hget/hset), driving the REAL exported functions
// (`listBooks`/`postBook`/`deleteBook`/`bookRefusal`/`bookEntry`) rather than a
// reimplementation of their rules. Those functions take `redis`/`userId`
// directly, bypassing `authenticateUser`, exactly the way api/stamps.js's
// `mint` does — a live Clerk token isn't reachable from CI, and this is the one
// branch whose behaviour IS the feature.
import assert from 'node:assert/strict'
import test from 'node:test'

import { bookEntry, bookRefusal, deleteBook, listBooks, postBook } from '../api/books.js'
import { MAX_BOOKS } from '../src/lib/books.js'

// A stand-in for Node's (IncomingMessage, ServerResponse) pair, matching
// api-handlers.test.js's own helpers.
function nodeReq(body) {
  return { headers: { 'content-type': 'application/json' }, body }
}
function nodeRes() {
  const headers = {}
  return {
    statusCode: 0,
    payload: null,
    headers,
    setHeader(k, v) {
      headers[k] = v
    },
    end(p) {
      this.payload = p
    },
    get json() {
      return JSON.parse(this.payload)
    },
  }
}

// Only the three Redis calls api/books.js actually makes.
function fakeRedis(seed = {}) {
  const hashes = { ...seed }
  return {
    hashes,
    async hgetall(key) {
      return hashes[key] ? { ...hashes[key] } : {}
    },
    async hget(key, field) {
      return hashes[key]?.[field] ?? null
    },
    async hset(key, obj) {
      hashes[key] = { ...(hashes[key] ?? {}), ...obj }
    },
  }
}

const USER = 'user_1'
const KEY = 'books:user_1'

// --------------------------------------------------------------------------
// bookRefusal — pure
// --------------------------------------------------------------------------
test('bookRefusal rejects a missing or malformed id', () => {
  assert.deepEqual(bookRefusal({ id: undefined, isNew: true, liveCount: 0 }), {
    error: 'id required',
    status: 400,
  })
  assert.deepEqual(bookRefusal({ id: 'not a valid id!', isNew: true, liveCount: 0 }), {
    error: 'id required',
    status: 400,
  })
})

test('bookRefusal blocks a NEW book once the shelf is full', () => {
  assert.deepEqual(bookRefusal({ id: 'b1', isNew: true, liveCount: MAX_BOOKS }), {
    error: 'too many books',
    limit: MAX_BOOKS,
    status: 409,
  })
  assert.equal(bookRefusal({ id: 'b1', isNew: true, liveCount: MAX_BOOKS - 1 }), null)
})

test('bookRefusal never blocks an UPDATE, even at the cap — editing a cover is not adding a book', () => {
  assert.equal(bookRefusal({ id: 'b1', isNew: false, liveCount: MAX_BOOKS }), null)
})

// --------------------------------------------------------------------------
// bookEntry — pure
// --------------------------------------------------------------------------
test('bookEntry builds a create record and ignores a forged state/createdAt', () => {
  const entry = bookEntry(
    { id: 'b1', title: 'Dad and me', subtitle: 'Road trip', coverTeamId: 158, state: 'off', createdAt: 1 },
    null,
    5000,
  )
  assert.deepEqual(entry, {
    id: 'b1',
    state: 'on',
    title: 'Dad and me',
    subtitle: 'Road trip',
    coverTeamId: 158,
    createdAt: 5000,
    updatedAt: 5000,
  })
})

test('bookEntry keeps the existing createdAt on an update', () => {
  const existing = {
    id: 'b1',
    state: 'on',
    title: 'Old title',
    subtitle: '',
    coverTeamId: null,
    createdAt: 1000,
    updatedAt: 1000,
  }
  const entry = bookEntry({ id: 'b1', title: 'New title' }, existing, 9000)
  assert.equal(entry.createdAt, 1000, 'createdAt does not move on a patch')
  assert.equal(entry.updatedAt, 9000)
  assert.equal(entry.title, 'New title')
})

test('bookEntry gives a revived tombstone a fresh createdAt, like a new book', () => {
  const tombstoned = {
    id: 'b1',
    state: 'off',
    title: 'Was here',
    subtitle: '',
    coverTeamId: null,
    createdAt: 1000,
    updatedAt: 2000,
  }
  const entry = bookEntry({ id: 'b1' }, tombstoned, 9000)
  assert.equal(entry.createdAt, 9000)
  assert.equal(entry.state, 'on')
})

// --------------------------------------------------------------------------
// postBook — Redis-backed create/update
// --------------------------------------------------------------------------
test('postBook creates a new book', async () => {
  const redis = fakeRedis()
  const res = nodeRes()
  await postBook(nodeReq({ id: 'b1', title: 'Dad and me', subtitle: '', coverTeamId: 158 }), res, redis, USER)

  assert.equal(res.statusCode, 201)
  assert.equal(res.json.book.id, 'b1')
  assert.equal(res.json.book.title, 'Dad and me')
  assert.equal(res.json.book.state, 'on')
  assert.equal(redis.hashes[KEY].b1.title, 'Dad and me')
})

test('postBook updates an existing book as a PARTIAL patch — an omitted field is untouched, createdAt does not move', async () => {
  const redis = fakeRedis({
    [KEY]: {
      b1: {
        id: 'b1',
        state: 'on',
        title: 'Original',
        subtitle: 'Keep me',
        coverTeamId: 158,
        createdAt: 1000,
        updatedAt: 1000,
      },
    },
  })
  const res = nodeRes()
  // Only `title` is named in the body; `subtitle`/`coverTeamId` are absent
  // entirely, not sent as empty — a real caller editing just the title must
  // not blank the cover club along the way.
  await postBook(nodeReq({ id: 'b1', title: 'Renamed' }), res, redis, USER)

  assert.equal(res.statusCode, 200)
  assert.equal(res.json.book.title, 'Renamed')
  assert.equal(res.json.book.subtitle, 'Keep me', 'an omitted field survives the patch untouched')
  assert.equal(res.json.book.coverTeamId, 158, 'an omitted field survives the patch untouched')
  assert.equal(res.json.book.createdAt, 1000, 'createdAt must not move on an update')
  assert.ok(res.json.book.updatedAt >= 1000)
})

test('postBook refuses a NEW book once the shelf is at MAX_BOOKS', async () => {
  const seed = {}
  for (let i = 0; i < MAX_BOOKS; i++) {
    seed[`b${i}`] = {
      id: `b${i}`,
      state: 'on',
      title: '',
      subtitle: '',
      coverTeamId: null,
      createdAt: 1000 + i,
      updatedAt: 1000 + i,
    }
  }
  const redis = fakeRedis({ [KEY]: seed })
  const res = nodeRes()
  await postBook(nodeReq({ id: 'brandnew', title: 'One too many' }), res, redis, USER)

  assert.equal(res.statusCode, 409)
  assert.deepEqual(res.json, { error: 'too many books', limit: MAX_BOOKS })
  assert.equal(redis.hashes[KEY].brandnew, undefined, 'the refused book must not be written')
})

test('postBook does NOT refuse an update at MAX_BOOKS — editing an existing book is not adding one', async () => {
  const seed = {}
  for (let i = 0; i < MAX_BOOKS; i++) {
    seed[`b${i}`] = {
      id: `b${i}`,
      state: 'on',
      title: '',
      subtitle: '',
      coverTeamId: null,
      createdAt: 1000 + i,
      updatedAt: 1000 + i,
    }
  }
  const redis = fakeRedis({ [KEY]: seed })
  const res = nodeRes()
  await postBook(nodeReq({ id: 'b0', title: 'Renamed at the cap' }), res, redis, USER)

  assert.equal(res.statusCode, 200)
  assert.equal(res.json.book.title, 'Renamed at the cap')
})

test('postBook ignores a client-supplied createdAt and state — both are server-decided', async () => {
  const redis = fakeRedis({
    [KEY]: {
      b1: {
        id: 'b1',
        state: 'on',
        title: 'Original',
        subtitle: '',
        coverTeamId: null,
        createdAt: 1000,
        updatedAt: 1000,
      },
    },
  })
  const res = nodeRes()
  // A forged body: an old createdAt trying to rewrite history, and an 'off'
  // state trying to tombstone the book through the wrong verb.
  await postBook(
    nodeReq({ id: 'b1', title: 'Still here', createdAt: 1, state: 'off' }),
    res,
    redis,
    USER,
  )

  assert.equal(res.statusCode, 200)
  assert.equal(res.json.book.state, 'on', 'POST can never write a tombstone')
  assert.equal(res.json.book.createdAt, 1000, 'the forged createdAt must not overwrite the real one')
})

test('postBook rejects an invalid body without throwing', async () => {
  const redis = fakeRedis()
  const res = nodeRes()
  await postBook({ headers: {}, body: undefined }, res, redis, USER)
  assert.equal(res.statusCode, 400)
})

// --------------------------------------------------------------------------
// deleteBook — tombstone, not delete
// --------------------------------------------------------------------------
test('deleteBook tombstones a live book — the record survives with state off, it is not gone', async () => {
  const redis = fakeRedis({
    [KEY]: {
      b1: {
        id: 'b1',
        state: 'on',
        title: 'Removed later',
        subtitle: '',
        coverTeamId: null,
        createdAt: 1000,
        updatedAt: 1000,
      },
    },
  })
  const res = nodeRes()
  await deleteBook(res, redis, USER, 'b1')

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json, { ok: true })
  const stored = redis.hashes[KEY].b1
  assert.ok(stored, 'the field must still exist in the hash')
  assert.equal(stored.state, 'off')
  assert.equal(stored.title, 'Removed later', 'a tombstone keeps its other fields')
})

test('deleteBook on an unknown or already-tombstoned id is a harmless success', async () => {
  const redis = fakeRedis()
  const res1 = nodeRes()
  await deleteBook(res1, redis, USER, 'never-existed')
  assert.deepEqual(res1.json, { ok: true })

  const redis2 = fakeRedis({
    [KEY]: { b1: { id: 'b1', state: 'off', title: '', subtitle: '', coverTeamId: null, createdAt: 1, updatedAt: 2 } },
  })
  const res2 = nodeRes()
  await deleteBook(res2, redis2, USER, 'b1')
  assert.deepEqual(res2.json, { ok: true })
})

test('deleteBook rejects a malformed id', async () => {
  const redis = fakeRedis()
  const res = nodeRes()
  await deleteBook(res, redis, USER, 'not a valid id!')
  assert.equal(res.statusCode, 400)
})

// --------------------------------------------------------------------------
// listBooks — includes tombstones, this is the one sync payload
// --------------------------------------------------------------------------
test('listBooks returns every book including tombstones — there is no lighter display mode', async () => {
  const redis = fakeRedis({
    [KEY]: {
      b1: { id: 'b1', state: 'on', title: 'Live', subtitle: '', coverTeamId: null, createdAt: 1, updatedAt: 1 },
      b2: { id: 'b2', state: 'off', title: 'Gone', subtitle: '', coverTeamId: null, createdAt: 1, updatedAt: 2 },
    },
  })
  const res = nodeRes()
  await listBooks(res, redis, USER)

  assert.equal(res.statusCode, 200)
  const ids = res.json.books.map((b) => b.id).sort()
  assert.deepEqual(ids, ['b1', 'b2'])
  assert.equal(res.json.books.find((b) => b.id === 'b2').state, 'off')
})

test('every books response is never shared-cacheable', async () => {
  const redis = fakeRedis()
  const res = nodeRes()
  await listBooks(res, redis, USER)
  assert.equal(res.headers['cache-control'], 'private, no-store')
})

// --------------------------------------------------------------------------
// The bare-path / unconfigured-store survival every other endpoint pins
// (test/api-handlers.test.js is the model this restates for books.js)
// --------------------------------------------------------------------------
test('books handler survives the bare path on every verb, unconfigured', async () => {
  const booksHandler = (await import('../api/books.js')).default
  function bareReq(url, { method = 'GET', body } = {}) {
    return { url, method, headers: { 'content-type': 'application/json' }, body }
  }
  for (const [method, url, body] of [
    ['GET', '/api/books', undefined],
    ['POST', '/api/books', { id: 'b1', title: 'x' }],
    ['DELETE', '/api/books?id=b1', undefined],
  ]) {
    const res = nodeRes()
    await booksHandler(bareReq(url, { method, body }), res)
    assert.equal(res.statusCode, 501, `${method} ${url}`)
    assert.deepEqual(res.json, { error: 'sync not configured' })
  }
})

test('books handler rejects an unsupported method without throwing', async () => {
  const booksHandler = (await import('../api/books.js')).default
  const res = nodeRes()
  await booksHandler({ url: '/api/books', method: 'PUT', headers: {} }, res)
  assert.equal(res.statusCode, 405)
})
