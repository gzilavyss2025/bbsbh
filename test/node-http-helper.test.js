import test from 'node:test'
import assert from 'node:assert/strict'
import { call, nodeReq, nodeRes } from './helpers/node-http.js'

test('nodeReq defaults to GET with no headers', () => {
  assert.deepEqual(nodeReq('/api/x'), { url: '/api/x', method: 'GET', headers: {}, body: undefined })
  assert.equal(nodeReq('/api/x', { method: 'POST', body: 'b' }).method, 'POST')
})

test('nodeRes records headers and parses the payload it was ended with', () => {
  const res = nodeRes()
  res.setHeader('x-a', '1')
  res.end('{"ok":true}')
  assert.deepEqual(res.headers, { 'x-a': '1' })
  assert.deepEqual(res.json, { ok: true })
})

test('call returns status, json and headers for a handler that writes through res', async () => {
  const handler = async (req, res, extra) => {
    res.statusCode = 201
    res.setHeader('x-e', extra)
    res.end(JSON.stringify({ url: req.url }))
  }
  assert.deepEqual(await call(handler, nodeReq('/a'), 'v'), {
    status: 201,
    json: { url: '/a' },
    headers: { 'x-e': 'v' },
  })
})

test('call surfaces a handler that returns a Response instead', async () => {
  const out = await call(async () => Response.json({ n: 1 }, { status: 418 }), nodeReq('/a'))
  assert.deepEqual(out, { status: 418, json: { n: 1 }, viaResponse: true })
})
