// Request/response adapter for the `runtime: 'nodejs'` functions, where Vercel hands the handler
// Node's `(req, res)` and `req.url` is a bare path (not the Web fetch shape; ADR-0127). Every
// non-edge function runs on Node, so only the Node shape is read here.

// A header, or '' (Node lower-cases its keys).
export function getHeader(req, name) {
  return req?.headers?.[String(name).toLowerCase()] || ''
}

// A parsed URL from the bare path Node gives (or an absolute one). The base only makes a relative
// path parseable; the host is never trusted for anything.
export function requestUrl(req) {
  return new URL(req?.url || '/', 'https://local.invalid')
}

// The JSON body, or null if there isn't a valid one: Vercel pre-parses a JSON body onto `req.body`,
// otherwise the stream is read. Never throws; every caller turns null into a 400.
export async function readJsonBody(req) {
  if (req?.body && typeof req.body === 'object') return req.body
  try {
    if (typeof req?.body === 'string') return JSON.parse(req.body)
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    if (chunks.length === 0) return null
    const decoder = new TextDecoder()
    return JSON.parse(chunks.map((c) => (typeof c === 'string' ? c : decoder.decode(c, { stream: true }))).join(''))
  } catch {
    return null
  }
}

// The raw request body as a Uint8Array, or null (the endpoints that take image bytes).
// `maxBytes` is enforced WHILE READING so an oversized body is never resident (ADR-0127).
// Vercel hands a Buffer on `req.body` for a content-type its parser does not own; otherwise the
// stream is read. Never throws; every failure is null.
export async function readRawBody(req, maxBytes) {
  const tooBig = (n) => Number.isFinite(maxBytes) && n > maxBytes
  const body = req?.body
  if (body instanceof Uint8Array) return tooBig(body.byteLength) ? null : body
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

// Write a JSON response to Node's `res`; handlers `return jsonResponse(res, …)`.
export function jsonResponse(res, body, status = 200, headers = {}) {
  res.statusCode = status
  for (const [k, v] of Object.entries({ 'content-type': 'application/json', ...headers })) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

// jsonResponse for per-user, auth-gated answers: never let a shared cache (or the browser) hold one
// user's data and hand it to another. Never relax the header; stamps.js answers carry a score.
export function privateJson(res, body, status = 200) {
  return jsonResponse(res, body, status, { 'cache-control': 'private, no-store' })
}
