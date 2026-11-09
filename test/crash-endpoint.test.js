// api/crash.js end to end: a real Request in, the log line and the 204 out.
import assert from 'node:assert/strict'
import test from 'node:test'

import handler from '../api/crash.js'

async function post(body, headers = {}) {
  const logged = []
  const log = console.log
  console.log = (line) => logged.push(line)
  try {
    const res = await handler(new Request('https://example.test/api/crash', {
      method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
    }))
    return { status: res.status, logged }
  } finally { console.log = log }
}

const VITALS = { vitals: { route: 'home', build: 'abc1234', device: 'wide', fcp: 900, bot: false } }

test('a vitals beacon becomes one bbsbh-vitals line and a 204', async () => {
  const r = await post(VITALS, { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Safari/537.36' })
  assert.equal(r.status, 204)
  assert.equal(r.logged.length, 1)
  assert.match(r.logged[0], /^bbsbh-vitals \{/)
  assert.equal(JSON.parse(r.logged[0].slice('bbsbh-vitals '.length)).bot, false)
})

test('the User-Agent header marks a crawler, and the agent string is not logged', async () => {
  const ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  const r = await post(VITALS, { 'user-agent': ua })
  const line = JSON.parse(r.logged[0].slice('bbsbh-vitals '.length))
  assert.equal(line.bot, true)
  assert.equal(r.logged[0].includes('Googlebot'), false)
})

test('a crash beacon still logs as bbsbh-crash', async () => {
  const r = await post({ kind: 'render', route: 'player', status: 404, build: 'abc1234' })
  assert.match(r.logged[0], /^bbsbh-crash /)
})

test('a malformed or empty vitals beacon logs nothing and still answers 204', async () => {
  for (const body of ['{not json', { vitals: 'x' }, { vitals: { route: 'home' } }]) {
    const r = await post(body)
    assert.equal(r.status, 204)
    assert.equal(r.logged.length, 0)
  }
})
