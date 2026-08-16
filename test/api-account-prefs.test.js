// Request-level coverage for the two new `runtime: 'nodejs'` serverless
// functions — api/preferences.js and api/account.js.
//
// Every case drives the handler with the NODE shape Vercel really passes:
// `req.url` a bare path, `headers` a plain lower-cased object, and a `res` to
// write through. That is not a formality. Three endpoints shipped to production
// throwing `TypeError: Invalid URL` on every single request because their smoke
// test called them with a Web `Request`, which is a shape production never
// passes (ADR-0022's 2026-07-25 amendment, api/_lib/nodeHandler.js's header).
// These two are covered from the start.
//
// The helpers below are deliberately duplicated from test/api-handlers.test.js
// rather than shared: they are eight lines, and a test-support module that both
// files import is a thing that can be changed to make a failing test pass.
import assert from 'node:assert/strict'
import test from 'node:test'

import accountHandler, { erase, keysForUser } from '../api/account.js'
import preferencesHandler, {
  entryToStore,
  handleRequest,
  sanitizeStored,
} from '../api/preferences.js'

function nodeReq(url, { method = 'GET', headers = {}, body } = {}) {
  return { url, method, headers, body }
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
async function call(handler, req, ...rest) {
  const res = nodeRes()
  const returned = await handler(req, res, ...rest)
  // The Node path writes through `res` and returns undefined; if a handler ever
  // returns a Response instead, surface that rather than silently passing.
  if (returned !== undefined) {
    return { status: returned.status, json: await returned.json(), viaResponse: true }
  }
  return { status: res.statusCode, json: res.json, headers: res.headers }
}

// `erase` takes (res, redis, userId) — it has no request to read, so it does
// not share the (req, res, …) shape the two handlers above do.
async function callErase(redis, userId) {
  const res = nodeRes()
  await erase(res, redis, userId)
  return { status: res.statusCode, json: res.json, headers: res.headers }
}

// A stand-in for the Upstash client, recording what it was asked to do.
function fakeRedis({ hashes = {}, sets = {}, store = {} } = {}) {
  return {
    deleted: [],
    hashes,
    sets,
    store,
    async hgetall(key) {
      return hashes[key] ?? null
    },
    async hget(key, field) {
      return hashes[key]?.[field] ?? null
    },
    async hset(key, obj) {
      hashes[key] = { ...(hashes[key] ?? {}), ...obj }
    },
    async smembers(key) {
      return sets[key] ?? []
    },
    async hkeys(key) {
      return Object.keys(hashes[key] ?? {})
    },
    async del(...keys) {
      this.deleted.push(...keys)
      for (const k of keys) {
        delete hashes[k]
        delete sets[k]
        delete store[k]
      }
    },
  }
}

const authed = (url, opts) =>
  nodeReq(url, { headers: { authorization: 'Bearer x' }, ...opts })

// --------------------------------------------------------------------------
// Unconfigured — the supported degrade, and the shape that used to crash
// --------------------------------------------------------------------------

test('preferences survives the bare path Vercel passes, and 501s unconfigured', async () => {
  const out = await call(preferencesHandler, nodeReq('/api/preferences'))
  assert.equal(out.status, 501)
  assert.deepEqual(out.json, { error: 'sync not configured' })
})

test('account survives the bare path too, and 501s unconfigured', async () => {
  const out = await call(accountHandler, nodeReq('/api/account', { method: 'DELETE' }))
  assert.equal(out.status, 501)
  assert.deepEqual(out.json, { error: 'sync not configured' })
})

test('the store is checked BEFORE auth, so curl can tell the two apart', async () => {
  // docs/development.md's diagnosis rests on this ordering: 501 means the Redis
  // credentials are not reaching the function; 401 means the store is live and
  // the problem is elsewhere. An authenticated request with no store must still
  // answer 501, never 401.
  const out = await call(preferencesHandler, authed('/api/preferences'))
  assert.equal(out.status, 501)
})

test('unsupported methods are refused before anything else happens', async () => {
  assert.equal((await call(preferencesHandler, nodeReq('/api/preferences', { method: 'DELETE' }))).status, 405)
  assert.equal((await call(preferencesHandler, nodeReq('/api/preferences', { method: 'PUT' }))).status, 405)
  assert.equal((await call(accountHandler, nodeReq('/api/account', { method: 'GET' }))).status, 405)
  assert.equal((await call(accountHandler, nodeReq('/api/account', { method: 'POST' }))).status, 405)
})

// --------------------------------------------------------------------------
// Reading
// --------------------------------------------------------------------------

test('a stored document round-trips, and unknown fields never reach the client', async () => {
  const redis = fakeRedis({
    hashes: {
      'prefs:u1': {
        club: { value: 158, updatedAt: 100 },
        level: { value: 11, updatedAt: 200 },
        nickname: { value: 'Gary', updatedAt: 300 },
        motion: { value: 'sideways', updatedAt: 400 },
      },
    },
  })
  const out = await call(handleRequest, nodeReq('/api/preferences'), redis, 'u1')
  assert.equal(out.status, 200)
  assert.deepEqual(out.json.prefs, {
    club: { value: 158, updatedAt: 100 },
    level: { value: 11, updatedAt: 200 },
  })
})

test('an empty account reads as an empty document, not an error', async () => {
  const out = await call(handleRequest, nodeReq('/api/preferences'), fakeRedis(), 'u1')
  assert.equal(out.status, 200)
  assert.deepEqual(out.json, { prefs: {} })
})

test('every reply is private and uncached — this is per-user, auth-gated data', async () => {
  const out = await call(handleRequest, nodeReq('/api/preferences'), fakeRedis(), 'u1')
  assert.equal(out.headers['cache-control'], 'private, no-store')

  const erased = await callErase(fakeRedis(), 'u1')
  assert.equal(erased.headers['cache-control'], 'private, no-store')
})

test('sanitizeStored is the same filter on the way out as on the way in', () => {
  assert.deepEqual(sanitizeStored(null), {})
  assert.deepEqual(sanitizeStored('nope'), {})
  assert.deepEqual(sanitizeStored({ club: { value: 158, updatedAt: 1 }, x: 1 }), {
    club: { value: 158, updatedAt: 1 },
  })
})

// --------------------------------------------------------------------------
// Writing
// --------------------------------------------------------------------------

test('a valid write stores the field and answers with the whole document', async () => {
  const redis = fakeRedis()
  const out = await call(
    handleRequest,
    nodeReq('/api/preferences', {
      method: 'POST',
      body: { field: 'club', value: 147, updatedAt: 500 },
    }),
    redis,
    'u1',
  )
  assert.equal(out.status, 200)
  assert.deepEqual(out.json.prefs, { club: { value: 147, updatedAt: 500 } })
  assert.deepEqual(redis.hashes['prefs:u1'], { club: { value: 147, updatedAt: 500 } })
})

test('a body naming an unknown field stores nothing', async () => {
  const redis = fakeRedis()
  const out = await call(
    handleRequest,
    nodeReq('/api/preferences', {
      method: 'POST',
      body: { field: 'nickname', value: 'Gary', updatedAt: 500 },
    }),
    redis,
    'u1',
  )
  assert.equal(out.status, 400)
  assert.deepEqual(out.json, { error: 'unknown field' })
  assert.equal(redis.hashes['prefs:u1'], undefined)
})

test('a body naming a real field with a nonsense value stores nothing', async () => {
  const redis = fakeRedis()
  for (const value of ['brewers', 0, null, { id: 158 }]) {
    const out = await call(
      handleRequest,
      nodeReq('/api/preferences', { method: 'POST', body: { field: 'club', value, updatedAt: 1 } }),
      redis,
      'u1',
    )
    assert.equal(out.status, 400)
    assert.deepEqual(out.json, { error: 'invalid value' })
  }
  assert.equal(redis.hashes['prefs:u1'], undefined)
})

test('a malformed body is a 400, not a 500', async () => {
  const out = await call(
    handleRequest,
    nodeReq('/api/preferences', { method: 'POST', body: 'not json' }),
    fakeRedis(),
    'u1',
  )
  assert.equal(out.status, 400)
  assert.deepEqual(out.json, { error: 'invalid body' })
})

test('nothing but the named field reaches Redis — a hostile body contributes zero', async () => {
  const redis = fakeRedis()
  await call(
    handleRequest,
    nodeReq('/api/preferences', {
      method: 'POST',
      body: {
        field: 'club',
        value: 158,
        updatedAt: 500,
        // None of this may be stored, and none of it may be echoed.
        revealedThrough: 40,
        score: '7-3',
        userId: 'someone-else',
        prefs: { club: { value: 1, updatedAt: 9e15 } },
      },
    }),
    redis,
    'u1',
  )
  assert.deepEqual(redis.hashes['prefs:u1'], { club: { value: 158, updatedAt: 500 } })
})

test('the server runs last-write-wins too — a stale device cannot walk a newer choice back', async () => {
  const redis = fakeRedis({ hashes: { 'prefs:u1': { club: { value: 147, updatedAt: 900 } } } })
  const out = await call(
    handleRequest,
    nodeReq('/api/preferences', {
      method: 'POST',
      body: { field: 'club', value: 158, updatedAt: 500 },
    }),
    redis,
    'u1',
  )
  // Accepted as a request, refused as a change — and the reply carries the
  // value that won, so the losing device converges immediately.
  assert.equal(out.status, 200)
  assert.deepEqual(out.json.prefs.club, { value: 147, updatedAt: 900 })
})

test('a newer write does land', async () => {
  const redis = fakeRedis({ hashes: { 'prefs:u1': { club: { value: 147, updatedAt: 900 } } } })
  const out = await call(
    handleRequest,
    nodeReq('/api/preferences', {
      method: 'POST',
      body: { field: 'club', value: 158, updatedAt: 901 },
    }),
    redis,
    'u1',
  )
  assert.deepEqual(out.json.prefs.club, { value: 158, updatedAt: 901 })
})

test('entryToStore is the whole write rule, in one pure place', () => {
  const older = { value: 1, updatedAt: 10 }
  const newer = { value: 2, updatedAt: 20 }
  assert.deepEqual(entryToStore(null, newer), newer, 'nothing stored yet: take it')
  assert.deepEqual(entryToStore(older, newer), newer)
  assert.equal(entryToStore(newer, older), null, 'older loses')
  assert.equal(entryToStore(newer, { value: 3, updatedAt: 20 }), null, 'a tie keeps the stored one')
  assert.equal(entryToStore(older, null), null)
})

test('a broken client clock is clamped, not refused — the setting still lands', async () => {
  const redis = fakeRedis()
  const out = await call(
    handleRequest,
    nodeReq('/api/preferences', {
      method: 'POST',
      body: { field: 'club', value: 158, updatedAt: Date.now() + 400 * 24 * 60 * 60 * 1000 },
    }),
    redis,
    'u1',
  )
  assert.equal(out.status, 200)
  const stored = redis.hashes['prefs:u1'].club
  assert.equal(stored.value, 158)
  assert.ok(stored.updatedAt <= Date.now() + 1000, 'clamped back to about now')
})

test('one user cannot write another user’s key', async () => {
  // The key is derived from the verified `sub` the handler was called with,
  // never from the body — which is why `userId` is a parameter here rather
  // than something the request can name.
  const redis = fakeRedis()
  await call(
    handleRequest,
    nodeReq('/api/preferences', {
      method: 'POST',
      body: { field: 'club', value: 158, updatedAt: 1, userId: 'victim' },
    }),
    redis,
    'u1',
  )
  assert.deepEqual(Object.keys(redis.hashes), ['prefs:u1'])
})

// --------------------------------------------------------------------------
// Erase
// --------------------------------------------------------------------------

test('erase resolves every per-user key from the two indexes', async () => {
  const redis = fakeRedis({
    sets: {
      'stamps:u1:seasons': ['2025', '2026'],
      'reveal:index:u1': ['777', '778'],
    },
  })
  const { keys, seasons, reveals } = await keysForUser(redis, 'u1')
  assert.equal(seasons, 2)
  assert.equal(reveals, 2)
  // Two keys per indexed game since ADR-0049: the half-index mark and the box
  // score's own bit. The bit rides the same gamePk set precisely so it cannot be
  // the one thing an erase forgets — leaving it behind would re-open a box score
  // on the next visit to a device the user had just wiped.
  assert.deepEqual(keys.sort(), [
    'prefs:u1',
    'reveal:index:u1',
    'reveal:u1:777',
    'reveal:u1:778',
    'revealbox:u1:777',
    'revealbox:u1:778',
    'scorebook:u1',
    'spoiled:u1',
    'stamps:u1:2025',
    'stamps:u1:2026',
    'stamps:u1:seasons',
  ])
})

test('a box-score bit found only through the scorebook index is erased too', async () => {
  // Same argument as the reveal mark's own pre-index case below: a gamePk
  // discovered from the older `scorebook:{u}` hash must carry BOTH keys, or the
  // erase is complete for the mark and future-only for the bit.
  const redis = fakeRedis({
    hashes: { 'scorebook:u1': { 777004: { updatedAt: 1 } } },
  })
  const out = await callErase(redis, 'u1')
  assert.equal(out.status, 200)
  assert.ok(redis.deleted.includes('revealbox:u1:777004'))
})

test('erase never touches the shared game-facts cache', async () => {
  // `game:final:{gamePk}` is public, immutable, keyed by GAME and belonging to
  // nobody. Deleting it would degrade every other user's Game Log to punish no
  // one, and it holds nothing about who looked at it.
  const redis = fakeRedis({
    sets: { 'reveal:index:u1': ['777'] },
    store: { 'game:final:777': { status: 'Final' } },
  })
  await callErase(redis, 'u1')
  assert.equal(
    redis.deleted.some((k) => k.startsWith('game:final:')),
    false,
  )
  assert.deepEqual(redis.store['game:final:777'], { status: 'Final' })
})

test('erase only ever touches the one user', async () => {
  const redis = fakeRedis({
    sets: { 'reveal:index:u1': ['777'], 'reveal:index:u2': ['888'] },
    hashes: { 'prefs:u1': { club: { value: 1, updatedAt: 1 } }, 'prefs:u2': { club: { value: 2, updatedAt: 1 } } },
  })
  await callErase(redis, 'u1')
  assert.equal(redis.deleted.some((k) => k.includes('u2')), false)
  assert.ok(redis.hashes['prefs:u2'], 'the other user is untouched')
  assert.equal(redis.hashes['prefs:u1'], undefined)
})

test('erasing an empty account succeeds and reports honest zeroes', async () => {
  const redis = fakeRedis()
  const out = await callErase(redis, 'u1')
  assert.equal(out.status, 200)
  assert.equal(out.json.ok, true)
  assert.equal(out.json.erased.stamps, 0)
  assert.equal(out.json.erased.reveal, 0)
})

test('a failed delete says so rather than answering ok', async () => {
  // An erase that half-succeeded must not tell the user they have been
  // forgotten. That is the one lie this endpoint exists not to tell.
  const redis = fakeRedis()
  redis.del = async () => {
    throw new Error('upstash down')
  }
  const out = await callErase(redis, 'u1')
  assert.equal(out.status, 503)
  assert.deepEqual(out.json, { error: 'erase failed' })
})

test('an index that cannot be READ is not deleted, and the erase does not claim success', async () => {
  // The inverted version of this test used to assert a 200. It was wrong, and
  // dangerously so: if `smembers` fails, the shards it names are never added to
  // the delete list — but the INDEX ITSELF was still deleted, destroying the
  // only way to find them. A retry then enumerated nothing and answered `ok`
  // again, so the residue was unrecoverable by construction. The client wipes
  // the device on `ok`, so the user is told they were forgotten while the
  // server still holds everything.
  const redis = fakeRedis()
  redis.smembers = async () => {
    throw new Error('nope')
  }
  const out = await callErase(redis, 'u1')
  assert.equal(out.status, 503, 'a partial erase must not report ok')
  assert.equal(
    redis.deleted.includes('reveal:index:u1'),
    false,
    'the index that could not be read must survive, so a retry can still find the keys',
  )
  assert.equal(redis.deleted.includes('stamps:u1:seasons'), false)
})

test('reveal marks are found through the scorebook index too, so an erase is not future-only', async () => {
  // `reveal:index:{u}` is only populated from the deploy that introduced it
  // forward. Every mark written before that is invisible to it — and would
  // survive "erase everywhere" permanently, then be pulled straight back onto
  // the freshly-wiped device by RevealCloudSync. `scorebook:{u}` is a hash
  // keyed by gamePk that predates the index and covers the same games.
  const redis = fakeRedis({
    sets: { 'reveal:index:u1': ['777001'] },
    hashes: { 'scorebook:u1': { 777002: { updatedAt: 1 }, 777003: { updatedAt: 2 } } },
  })
  const out = await callErase(redis, 'u1')
  assert.equal(out.status, 200)
  for (const pk of ['777001', '777002', '777003']) {
    assert.ok(
      redis.deleted.includes(`reveal:u1:${pk}`),
      `reveal:u1:${pk} must be erased however it was discovered`,
    )
  }
  assert.equal(out.json.erased.reveal, 3, 'and counted once each, not twice')
})

test('erase still never reaches another user, however a gamePk was discovered', async () => {
  const redis = fakeRedis({
    hashes: { 'scorebook:u1': { 999: {} }, 'scorebook:u2': { 111: {} } },
  })
  await callErase(redis, 'u1')
  for (const key of redis.deleted) {
    assert.ok(key.includes('u1'), `${key} is not this user's to erase`)
    assert.equal(key.includes('u2'), false)
  }
})

test('the erase response names no game, club, date, or score', async () => {
  const redis = fakeRedis({ sets: { 'reveal:index:u1': ['777'] } })
  const out = await callErase(redis, 'u1')
  const body = JSON.stringify(out.json)
  assert.equal(/\d{6,}/.test(body), false, 'no gamePk may appear in the confirmation')
  assert.deepEqual(Object.keys(out.json.erased).sort(), [
    'prefs',
    'reveal',
    'scorebook',
    'spoiled',
    'stamps',
  ])
})
