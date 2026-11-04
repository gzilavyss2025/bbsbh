// The response order of the two shared api flows: withUser (405, pre 400, 501 sync, 501/401 auth)
// and uploadImage (405, 501, 403, resolve 400, body 400/413, 415, then success).
import assert from 'node:assert/strict'
import test from 'node:test'
import { withUser } from '../api/_lib/auth.js'
import { uploadImage } from '../api/_lib/blob.js'
import { call, nodeReq } from './helpers/node-http.js'

function withEnv(t, vars) {
  const saved = {}
  for (const k of Object.keys(vars)) saved[k] = process.env[k]
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v)
  t.after(() => {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v)
  })
}

test('withUser answers 405, then the pre guard, then 501 sync, then the auth outcome', async (t) => {
  const handler = withUser(['GET'], () => assert.fail('must not run'), (req, res) => {
    if (req.url.includes('bad')) {
      res.statusCode = 400
      res.end('{}')
      return true
    }
  })
  const env = { UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined, KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined, CLERK_SECRET_KEY: undefined }
  withEnv(t, env)
  assert.equal((await call(handler, nodeReq('/x', { method: 'PUT' }))).status, 405)
  assert.equal((await call(handler, nodeReq('/x?bad'))).status, 400, 'pre runs before the store check')
  const noStore = await call(handler, nodeReq('/x'))
  assert.deepEqual([noStore.status, noStore.json.error], [501, 'sync not configured'])

  withEnv(t, { UPSTASH_REDIS_REST_URL: 'https://r.test', UPSTASH_REDIS_REST_TOKEN: 't' })
  const noAuth = await call(handler, nodeReq('/x'))
  assert.deepEqual([noAuth.status, noAuth.json.error], [501, 'auth not configured'])
  withEnv(t, { CLERK_SECRET_KEY: 'sk_test_x' })
  const noToken = await call(handler, nodeReq('/x'))
  assert.deepEqual([noToken.status, noToken.json.error], [401, 'no token'])
})

test('uploadImage answers 405, 501, 403, 400, 413, 415 in that order', async (t) => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
  const plan = (q) => (q.get('bad') ? { error: 'unknown thing' } : {
    maxBytes: 10,
    limit: '10 B',
    prefix: 'p/',
    vet: (_b, sig) => (sig ? null : 'not an image'),
    pathname: () => 'p/x.png',
    field: 'f',
  })
  const asAdmin = async () => 'admin'
  const asNobody = async () => null
  withEnv(t, { BLOB_READ_WRITE_TOKEN: undefined })
  assert.equal((await call((rq, rs) => uploadImage(rq, rs, plan, asAdmin), nodeReq('/u'))).status, 405)
  const post = (url, body, headers = {}) => nodeReq(url, { method: 'POST', body, headers })
  const run = (req, auth = asAdmin) => call((rq, rs) => uploadImage(rq, rs, plan, auth), req)
  assert.equal((await run(post('/u', png))).status, 501)
  withEnv(t, { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_abc_secret' })
  assert.equal((await run(post('/u', png), asNobody)).status, 403)
  assert.equal((await run(post('/u?bad=1', png))).status, 400)
  assert.equal((await run(post('/u', undefined))).json.error, 'no image received')
  const big = new Uint8Array(50)
  const tooBig = await run(post('/u', big, { 'content-length': '50' }))
  assert.deepEqual([tooBig.status, tooBig.json.error], [413, 'image too large — the limit is 10 B'])
  const notImage = await run(post('/u', new Uint8Array(9)))
  assert.deepEqual([notImage.status, notImage.json.error], [415, 'not an image'])
})
