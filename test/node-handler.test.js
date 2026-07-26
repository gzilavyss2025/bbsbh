// Unit coverage for api/_lib/nodeHandler.js — the adapter that lets the
// `runtime: 'nodejs'` functions read whichever request shape Vercel hands them.
//
// These exist because the previous smoke test for these endpoints imported the
// module and called it with a Web `Request`, which is a shape production never
// passes. Every case below therefore asserts BOTH shapes: the Node one Vercel
// actually uses (`req.url` a bare path, `headers` a plain object, body on
// `req.body` or the stream) and the Web one it might again.
import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import {
  getHeader,
  jsonResponse,
  readJsonBody,
  requestUrl,
} from '../api/_lib/nodeHandler.js'

// --------------------------------------------------------------------------
// requestUrl — THE bug. A bare path must parse, not throw.
// --------------------------------------------------------------------------
test('requestUrl parses the bare path Node hands the handler', () => {
  // The exact input from the production stack trace.
  const url = requestUrl({ url: '/api/reveal?gamePk=1' })
  assert.equal(url.pathname, '/api/reveal')
  assert.equal(url.searchParams.get('gamePk'), '1')
})

test('requestUrl still parses an absolute URL (edge shape)', () => {
  const url = requestUrl({ url: 'https://tally.example/api/copy?history=1' })
  assert.equal(url.pathname, '/api/copy')
  assert.equal(url.searchParams.get('history'), '1')
})

test('requestUrl never throws on a missing or junk url', () => {
  for (const req of [{}, { url: '' }, null, undefined]) {
    assert.doesNotThrow(() => requestUrl(req))
  }
})

// --------------------------------------------------------------------------
// getHeader — Node's plain object vs the edge's Headers
// --------------------------------------------------------------------------
test('getHeader reads Node plain-object headers (lower-cased keys)', () => {
  const req = { headers: { authorization: 'Bearer abc', host: 'x.test' } }
  assert.equal(getHeader(req, 'authorization'), 'Bearer abc')
  // Callers use canonical casing; Node lower-cases its keys.
  assert.equal(getHeader(req, 'Authorization'), 'Bearer abc')
})

test('getHeader reads a Web Headers object', () => {
  const req = { headers: new Headers({ authorization: 'Bearer xyz' }) }
  assert.equal(getHeader(req, 'authorization'), 'Bearer xyz')
})

test('getHeader returns empty string when absent, never null', () => {
  assert.equal(getHeader({ headers: {} }, 'authorization'), '')
  assert.equal(getHeader({}, 'authorization'), '')
  assert.equal(getHeader(null, 'authorization'), '')
})

// --------------------------------------------------------------------------
// readJsonBody — three sources, and never a throw
// --------------------------------------------------------------------------
test('readJsonBody uses a pre-parsed object body (Vercel Node runtime)', async () => {
  assert.deepEqual(await readJsonBody({ body: { day: '2026-07-25', state: 'on' } }), {
    day: '2026-07-25',
    state: 'on',
  })
})

test('readJsonBody parses a string body', async () => {
  assert.deepEqual(await readJsonBody({ body: '{"revealedThrough":4}' }), { revealedThrough: 4 })
})

test('readJsonBody uses req.json() when present (edge shape)', async () => {
  const req = { json: async () => ({ ok: true }) }
  assert.deepEqual(await readJsonBody(req), { ok: true })
})

test('readJsonBody reads a raw Node stream', async () => {
  const req = Readable.from([Buffer.from('{"state":"off"}')])
  assert.deepEqual(await readJsonBody(req), { state: 'off' })
})

test('readJsonBody returns null on anything malformed, never throws', async () => {
  assert.equal(await readJsonBody({ body: 'not json' }), null)
  assert.equal(await readJsonBody({ json: async () => { throw new Error('bad') } }), null)
  assert.equal(await readJsonBody(Readable.from([Buffer.from('{oops')])), null)
  assert.equal(await readJsonBody(Readable.from([])), null)
})

// --------------------------------------------------------------------------
// jsonResponse — write to Node's res, or return a Response
// --------------------------------------------------------------------------
function fakeRes() {
  const headers = {}
  return {
    statusCode: 0,
    body: null,
    headers,
    setHeader(k, v) {
      headers[k] = v
    },
    end(payload) {
      this.body = payload
    },
  }
}

test('jsonResponse writes through Node res and returns undefined', () => {
  const res = fakeRes()
  const out = jsonResponse(res, { error: 'unauthorized' }, 401)
  assert.equal(out, undefined)
  assert.equal(res.statusCode, 401)
  assert.equal(res.headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(res.body), { error: 'unauthorized' })
})

test('jsonResponse merges extra headers (the private no-store guard)', () => {
  const res = fakeRes()
  jsonResponse(res, { ok: 1 }, 200, { 'cache-control': 'private, no-store' })
  assert.equal(res.headers['cache-control'], 'private, no-store')
})

test('jsonResponse falls back to a Response when there is no res', async () => {
  const out = jsonResponse(undefined, { days: {} }, 200)
  assert.ok(out instanceof Response)
  assert.equal(out.status, 200)
  assert.equal(out.headers.get('content-type'), 'application/json')
  assert.deepEqual(await out.json(), { days: {} })
})
