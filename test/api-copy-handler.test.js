// Request-level coverage for api/copy.js's READ path — the one thing about the
// copy store that had no test, and the one thing that broke.
//
// WHY THIS DRIVES THE REAL CLIENT. Every other handler test here (books,
// account prefs) hands the endpoint a small fake Redis whose `hgetall` returns
// an object. That is the right fake for those endpoints, which use the client's
// default settings — and it is exactly why none of them could have caught this
// bug. api/copy.js is the ONE endpoint that passes
// `automaticDeserialization: false`, and that flag does not only disable the
// JSON.parse the copy store wanted gone: it replaces the whole deserializer
// with the identity function, including HGETALL's own step that pairs Redis's
// flat [field, value, field, value] reply into an object. A fake answering an
// object asserts a shape this endpoint's client never produces.
//
// So this stubs the TRANSPORT instead of the client: a real Redis instance, the
// real flag, the real deserializer, and a `fetch` returning what the Upstash
// REST API actually returns for HGETALL — a flat array, base64-encoded, because
// the client sends `Upstash-Encoding: base64` and decodes what comes back.
// Everything above that stub is the production path.
//
// The '42' case is load-bearing in the other direction. The flag exists because
// an admin-authored "42" or "true" would otherwise come back as a
// number/boolean and be dropped by sanitizeOverrides as "not a string" — silent
// loss of a perfectly good line of copy. Asserting the exact string round-trips
// is what stops a future fix from deleting the flag and trading this bug for
// the one it was added to prevent.
import assert from 'node:assert/strict'
import test from 'node:test'

import handler, { hashFromReply } from '../api/copy.js'

const PHOTO_URL =
  'https://store123.public.blob.vercel-storage.com/ballparks/fenwaypark-photo-Ab3xY9.jpg'

// Two fields on purpose: a blob-store URL (the ballpark art that sent us
// looking) and a numeric-LOOKING string (the reason the flag is there).
const STORED = {
  'ballpark.fenwayparkPhoto': PHOTO_URL,
  'scoresUnlocked.toggleLabel': '42',
}

// What the REST API puts on the wire for HGETALL: field/value flattened in
// order, every element base64-encoded.
function wireReply(hash) {
  return Object.entries(hash).flatMap(([field, value]) => [
    Buffer.from(field).toString('base64'),
    Buffer.from(value).toString('base64'),
  ])
}

// Minimal stand-ins for Node's (IncomingMessage, ServerResponse), matching the
// helpers in test/api-books-handlers.test.js.
function nodeReq() {
  return { method: 'GET', url: '/api/copy', headers: {} }
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

// Answer every Upstash REST call with `result`, in the shape its HTTP client
// reads (`ok`/`status`/`headers.get`/`text`).
function stubFetch(result) {
  const previous = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({ result }),
  })
  return () => {
    globalThis.fetch = previous
  }
}

// getRedis() reads process.env at call time, so setting these per call is
// enough — there is no module-level client to defeat.
function stubEnv() {
  const previous = { ...process.env }
  process.env.UPSTASH_REDIS_REST_URL = 'https://stub.invalid'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'stub-token'
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  return () => {
    process.env = previous
  }
}

async function getCopy(result) {
  const restoreEnv = stubEnv()
  const restoreFetch = stubFetch(result)
  try {
    const res = nodeRes()
    await handler(nodeReq(), res)
    return res
  } finally {
    restoreFetch()
    restoreEnv()
  }
}

// --------------------------------------------------------------------------
// The handler, over the real client
// --------------------------------------------------------------------------
test('GET /api/copy returns the stored overrides from a real HGETALL reply', async () => {
  const res = await getCopy(wireReply(STORED))

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json.copy, STORED)
})

test('a numeric-looking override stays the exact STRING it was saved as', async () => {
  const res = await getCopy(wireReply(STORED))

  // Not 42. Dropping `automaticDeserialization: false` to fix the pairing would
  // turn this into a number and sanitizeOverrides would silently discard it.
  assert.strictEqual(res.json.copy['scoresUnlocked.toggleLabel'], '42')
})

test('an empty copy store still reads as no overrides, not an error', async () => {
  const res = await getCopy([])

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json.copy, {})
})

test('an unknown id in the store is still dropped — the registry stays the closed set', async () => {
  const res = await getCopy(wireReply({ 'not.a.registry.field': 'x', ...STORED }))

  assert.deepEqual(res.json.copy, STORED)
})

// --------------------------------------------------------------------------
// hashFromReply — pure
// --------------------------------------------------------------------------
test('hashFromReply pairs a flat reply and passes an object through', () => {
  assert.deepEqual(hashFromReply(['a', '1', 'b', '2']), { a: '1', b: '2' })
  // If a future client version pairs the hash up despite the flag, that must
  // widen what the endpoint reads rather than break it.
  assert.deepEqual(hashFromReply({ a: '1' }), { a: '1' })
})

test('hashFromReply answers an empty map for every no-data shape', () => {
  for (const empty of [null, undefined, [], '', 0]) {
    assert.deepEqual(hashFromReply(empty), {}, `expected {} for ${JSON.stringify(empty)}`)
  }
})

test('hashFromReply ignores a trailing unpaired field rather than storing undefined', () => {
  assert.deepEqual(hashFromReply(['a', '1', 'orphan']), { a: '1' })
})
