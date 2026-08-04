// Request-level coverage for the four `runtime: 'nodejs'` serverless functions.
//
// This is the test that was missing. The previous smoke check imported each
// module and called it with a Web `Request` — a shape Vercel's Node runtime
// never passes — so all three shipped to production throwing
// `TypeError: Invalid URL` on every single request. Every case here drives the
// handler with the NODE shape instead: `req.url` a bare path, `headers` a plain
// lower-cased object, and a `res` to write through.
//
// No Redis or Clerk env is set, so these exercise the unconfigured paths, which
// is exactly where the crash lived: reveal.js and copy.js both parse the URL
// BEFORE they check whether the store is configured.
import assert from 'node:assert/strict'
import test from 'node:test'

import copyHandler from '../api/copy.js'
import revealHandler from '../api/reveal.js'
import spoiledDaysHandler from '../api/spoiled-days.js'
import stampsHandler from '../api/stamps.js'

// A stand-in for Node's (IncomingMessage, ServerResponse) pair.
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

async function call(handler, req) {
  const res = nodeRes()
  const returned = await handler(req, res)
  // Node path writes through `res` and returns undefined; if a handler ever
  // returns a Response instead, surface that rather than silently passing.
  if (returned !== undefined) {
    return { status: returned.status, json: await returned.json(), viaResponse: true }
  }
  return { status: res.statusCode, json: res.json, headers: res.headers }
}

// --------------------------------------------------------------------------
// The regression: a bare path must not throw
// --------------------------------------------------------------------------
test('reveal handler survives the bare path Vercel passes', async () => {
  // The exact URL from the production stack trace.
  const out = await call(revealHandler, nodeReq('/api/reveal?gamePk=1'))
  // Unconfigured -> 501, NOT a 500 from ERR_INVALID_URL.
  assert.equal(out.status, 501)
  assert.deepEqual(out.json, { error: 'sync not configured' })
})

test('reveal handler still validates its query off the parsed path', async () => {
  // gamePk is read from searchParams — proof the URL actually parsed, rather
  // than the handler skipping the query entirely.
  const out = await call(revealHandler, nodeReq('/api/reveal'))
  assert.equal(out.status, 400)
  assert.deepEqual(out.json, { error: 'gamePk required' })
})

test('copy handler serves the public read from a bare path', async () => {
  const out = await call(copyHandler, nodeReq('/api/copy'))
  assert.equal(out.status, 200)
  assert.deepEqual(out.json, { copy: {} }) // no store configured -> defaults
  assert.match(out.headers['cache-control'], /max-age=60/)
})

test('copy handler reads ?history=1 off the parsed path', async () => {
  const out = await call(copyHandler, nodeReq('/api/copy?history=1'))
  // Admin-only branch, and unconfigured -> 501. Reaching it at all proves the
  // searchParams were parsed.
  assert.equal(out.status, 501)
})

test('spoiled-days handler survives a bare path', async () => {
  const out = await call(spoiledDaysHandler, nodeReq('/api/spoiled-days'))
  assert.equal(out.status, 501)
  assert.deepEqual(out.json, { error: 'sync not configured' })
})

// --------------------------------------------------------------------------
// Method + body handling under the Node shape
// --------------------------------------------------------------------------
test('every handler rejects an unsupported method without throwing', async () => {
  for (const [name, handler, url] of [
    ['reveal', revealHandler, '/api/reveal?gamePk=1'],
    ['copy', copyHandler, '/api/copy'],
    ['spoiled-days', spoiledDaysHandler, '/api/spoiled-days'],
    ['stamps', stampsHandler, '/api/stamps?season=2026'],
  ]) {
    const out = await call(handler, nodeReq(url, { method: 'PUT' }))
    assert.equal(out.status, 405, `${name} rejects PUT`)
  }
})

test('a POST body arrives via Vercel’s pre-parsed req.body', async () => {
  // Vercel's Node runtime parses a JSON body onto req.body — the handler must
  // read it there rather than calling req.json(), which does not exist.
  const out = await call(
    spoiledDaysHandler,
    nodeReq('/api/spoiled-days', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { day: '2026-07-25', state: 'on' },
    }),
  )
  // Unconfigured store short-circuits before the body is used; the point is
  // that nothing threw on the way there.
  assert.equal(out.status, 501)
})

// --------------------------------------------------------------------------
// Auth header lookup under the Node shape (plain object, not Headers)
// --------------------------------------------------------------------------
test('authorization is read from Node plain-object headers', async () => {
  // With CLERK_SECRET_KEY unset, authenticate() returns null regardless — but
  // it must reach that decision by reading `headers.authorization` as an object
  // property, not by calling `.get()` on it and throwing.
  const out = await call(
    copyHandler,
    nodeReq('/api/copy', {
      method: 'POST',
      headers: { authorization: 'Bearer nope', 'content-type': 'application/json' },
      body: { copy: {} },
    }),
  )
  assert.equal(out.status, 501) // store unconfigured; no TypeError en route
})

// --------------------------------------------------------------------------
// Logbook stamps (ADR-0035)
// --------------------------------------------------------------------------
// The score-bearing endpoint, so the unconfigured path matters more here than
// anywhere else: with no store it must refuse cleanly, and — the part worth
// pinning — it must refuse BEFORE any statsapi fetch or reveal-gate work, so an
// unconfigured deploy cannot be used to probe game data at all.
test('stamps handler survives the bare path on every verb it accepts', async () => {
  for (const [method, url, body] of [
    ['GET', '/api/stamps?season=2026', undefined],
    ['GET', '/api/stamps?seasons=1', undefined],
    ['GET', '/api/stamps?export=1', undefined],
    ['POST', '/api/stamps', { gamePk: 778241, mode: 'watched' }],
    ['DELETE', '/api/stamps?gamePk=778241', undefined],
  ]) {
    const out = await call(
      stampsHandler,
      nodeReq(url, { method, body, headers: { 'content-type': 'application/json' } }),
    )
    assert.equal(out.status, 501, `${method} ${url}`)
    assert.deepEqual(out.json, { error: 'sync not configured' })
  }
})

test('stamps responses are never shared-cacheable', async () => {
  // A stamp carries a final score. This is the one response in the codebase
  // where a shared cache would leak one directly.
  const out = await call(stampsHandler, nodeReq('/api/stamps?season=2026'))
  assert.equal(out.headers['cache-control'], 'private, no-store')
})
