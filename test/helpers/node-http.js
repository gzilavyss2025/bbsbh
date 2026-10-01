// Stand-ins for Node's (IncomingMessage, ServerResponse) pair, for tests that
// call an `api/*.js` handler directly.

export function nodeReq(url, { method = 'GET', headers = {}, body } = {}) {
  return { url, method, headers, body }
}

export function nodeRes() {
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

export async function call(handler, req, ...rest) {
  const res = nodeRes()
  const returned = await handler(req, res, ...rest)
  // The Node path writes through `res` and returns undefined; if a handler ever
  // returns a Response instead, surface that rather than silently passing.
  if (returned !== undefined) {
    return { status: returned.status, json: await returned.json(), viaResponse: true }
  }
  return { status: res.statusCode, json: res.json, headers: res.headers }
}
