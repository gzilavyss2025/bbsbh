// Request/response adapter for the `runtime: 'nodejs'` serverless functions
// (api/reveal.js, api/copy.js, api/spoiled-days.js).
//
// WHY THIS EXISTS — read before "simplifying" any of it. All three functions
// were written against the Web-standard fetch shape: `new URL(req.url)`,
// `req.headers.get(...)`, `await req.json()`, `return new Response(...)`. That is
// the EDGE runtime's contract. Under `runtime: 'nodejs'` Vercel hands the
// handler Node's `(req, res)` instead, where `req.url` is a bare path. Every one
// of those functions therefore threw `TypeError: Invalid URL` on its very first
// line of real work, in production, on every request:
//
//     TypeError: Invalid URL
//         at handler (file:///var/task/api/reveal.js:101:28)
//         { code: 'ERR_INVALID_URL', input: '/api/reveal?gamePk=1' }
//
// It went unnoticed because nothing that matters *breaks* when they fail: the
// client treats every one of these as optional (CopyProvider falls back to
// shipped defaults, both sync components swallow errors and stay local-only), so
// a 500 looks exactly like "this deploy has no backend configured" — which is a
// supported state. The lesson worth keeping: a graceful degrade can hide a hard
// failure indefinitely. These endpoints need real request-level checks against a
// deploy, not just module-level smoke tests — importing the module in Node and
// calling it with a `Request` exercises a shape production never passes, which is
// exactly how this shipped.
//
// The helpers below read whichever shape they are handed rather than assuming
// one, so the functions keep working if Vercel's runtime contract shifts again.

// Header lookup that works with both a Web `Headers` (edge) and Node's plain
// object (`IncomingMessage.headers`, always lower-cased keys). Returns '' rather
// than null/undefined so callers can do plain string work.
export function getHeader(req, name) {
  const headers = req?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') return headers.get(name) || ''
  return headers[String(name).toLowerCase()] || ''
}

// A parsed URL from either shape. Node gives a path ('/api/copy?x=1'), the edge
// gives an absolute URL; `new URL` ignores the base when the input is already
// absolute, so one call covers both. The base is only ever used to make a
// relative path parseable — the host is never trusted for anything.
export function requestUrl(req) {
  return new URL(req?.url || '/', 'https://local.invalid')
}

// The JSON body, or null if there isn't a valid one. Three sources, in the order
// they're likely to exist: Vercel's Node runtime pre-parses a JSON body onto
// `req.body`; the edge shape exposes `req.json()`; otherwise read the stream.
// Never throws — a malformed body is null, which every caller turns into a 400.
export async function readJsonBody(req) {
  if (req?.body && typeof req.body === 'object') return req.body
  if (typeof req?.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }
  if (typeof req?.json === 'function') {
    try {
      return await req.json()
    } catch {
      return null
    }
  }
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    if (chunks.length === 0) return null
    // Chunks are Buffers under Node and Uint8Arrays under an edge-ish stream;
    // decoding each to a string avoids depending on Buffer being a global.
    const decoder = new TextDecoder()
    return JSON.parse(chunks.map((c) => (typeof c === 'string' ? c : decoder.decode(c, { stream: true }))).join(''))
  } catch {
    return null
  }
}

// The raw request body as a Uint8Array, or null. Used by the ONE endpoint that
// takes bytes rather than JSON (api/ballpark-photo.js).
//
// `maxBytes` is enforced WHILE READING, not after. That ordering is the point:
// checking a `content-length` header first would trust a number the caller
// supplies, and checking the total after buffering would mean a 500 MB body had
// already been held in a serverless function's memory before we objected. So we
// count as chunks arrive and abandon the read the moment the running total goes
// over — the caller gets null and answers 413, and nothing larger than the cap
// is ever resident.
//
// Same three-shape tolerance as readJsonBody: Vercel's Node runtime hands a
// Buffer on `req.body` for a content-type its parser does not own (which is
// every image type), the edge shape exposes `arrayBuffer()`, and otherwise we
// read the stream. Never throws — every failure is null.
export async function readRawBody(req, maxBytes) {
  const tooBig = (n) => Number.isFinite(maxBytes) && n > maxBytes
  const body = req?.body
  if (body instanceof Uint8Array) return tooBig(body.byteLength) ? null : body
  if (typeof req?.arrayBuffer === 'function') {
    try {
      const buf = new Uint8Array(await req.arrayBuffer())
      return tooBig(buf.byteLength) ? null : buf
    } catch {
      return null
    }
  }
  try {
    const chunks = []
    let total = 0
    for await (const chunk of req) {
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk)
      total += bytes.byteLength
      if (tooBig(total)) return null
      chunks.push(bytes)
    }
    if (total === 0) return null
    const out = new Uint8Array(total)
    let at = 0
    for (const c of chunks) {
      out.set(c, at)
      at += c.byteLength
    }
    return out
  } catch {
    return null
  }
}

// Send a JSON response through whichever channel exists. With Node's `res` we
// write to it and return undefined; with no `res` (edge) we return a `Response`
// for the platform to send. Handlers just `return jsonResponse(res, …)` and stay
// agnostic — which is what keeps this fix from having to be made twice if the
// runtime contract changes again.
export function jsonResponse(res, body, status = 200, headers = {}) {
  const payload = JSON.stringify(body)
  const allHeaders = { 'content-type': 'application/json', ...headers }
  if (res && typeof res.setHeader === 'function') {
    res.statusCode = status
    for (const [k, v] of Object.entries(allHeaders)) res.setHeader(k, v)
    res.end(payload)
    return undefined
  }
  return new Response(payload, { status, headers: allHeaders })
}
