import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/cron/nightly-dispatch.js'

const req = (auth) => new Request('https://x/api/cron/nightly-dispatch', { headers: auth ? { authorization: auth } : {} })

async function run(env, request) {
  const saved = { ...process.env }
  const calls = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 204 }) }
  Object.assign(process.env, env)
  try { return { res: await handler(request), calls } } finally {
    globalThis.fetch = realFetch
    for (const k of Object.keys(env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
  }
}

test('without its secrets the dispatch is inert', async () => {
  const { res, calls } = await run({}, req('Bearer x'))
  assert.equal(res.status, 503)
  assert.equal(calls.length, 0)
})

test('a request without the cron secret dispatches nothing', async () => {
  const env = { CRON_SECRET: 's3cret', NIGHTLY_DISPATCH_TOKEN: 'tok' }
  for (const auth of [null, 'Bearer wrong']) {
    const { res, calls } = await run(env, req(auth))
    assert.equal(res.status, 401)
    assert.equal(calls.length, 0)
  }
})

test('the Vercel cron dispatches the nightly workflow on main as a cron run', async () => {
  const { res, calls } = await run({ CRON_SECRET: 's3cret', NIGHTLY_DISPATCH_TOKEN: 'tok' }, req('Bearer s3cret'))
  assert.equal(res.status, 202)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.github.com/repos/gzilavyss2025/bbsbh/actions/workflows/update-nightly-data.yml/dispatches')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.authorization, 'Bearer tok')
  assert.deepEqual(JSON.parse(calls[0].init.body), { ref: 'main', inputs: { trigger: 'cron' } })
})
