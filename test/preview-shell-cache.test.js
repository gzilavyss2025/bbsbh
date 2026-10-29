// api/preview.js answers every deep link (/team/{id}, /player/{id}, the report
// routes) by fetching the app's own index.html and swapping its OG block. That
// fetch is a second CDN request for every page view, and a crawler storm on
// 2026-10-29 paused the Vercel Hobby team at 3x its request allowance. The
// shell changes only on a deploy, so a warm instance fetches it once.

import test from 'node:test'
import assert from 'node:assert/strict'

import handler from '../api/preview.js'

const SHELL = '<!doctype html><html><head><!-- OG:BEGIN --><!-- OG:END --></head><body><div id="root"></div></body></html>'

function stubFetch(t, respond) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    calls.push(url)
    return respond(url)
  }
  t.after(() => {
    globalThis.fetch = original
  })
  return calls
}

test('the app shell is fetched once per origin, not once per request', async (t) => {
  const calls = stubFetch(t, () => new Response(SHELL, { status: 200 }))
  for (let i = 0; i < 3; i++) {
    const res = await handler(new Request('https://cache-a.test/api/preview?route=about'))
    assert.equal(res.status, 200)
  }
  assert.equal(calls.filter((u) => u === 'https://cache-a.test/index.html').length, 1)
})

test('a failed shell fetch is not cached', async (t) => {
  let ok = false
  const calls = stubFetch(t, () => (ok ? new Response(SHELL, { status: 200 }) : new Response('', { status: 503 })))
  const first = await handler(new Request('https://cache-b.test/api/preview?route=about'))
  assert.match(await first.text(), /http-equiv="refresh"/)
  ok = true
  const second = await handler(new Request('https://cache-b.test/api/preview?route=about'))
  assert.match(await second.text(), /id="root"/)
  assert.equal(calls.filter((u) => u === 'https://cache-b.test/index.html').length, 2)
})
