import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { umpireName } from '../src/api/umpires.js'

// Issue 2441: a season view with no games has no `data`, so the page names the
// umpire from the history store first, then the newest umpires/ shard.
const json = (body) => ({ ok: true, status: 200, json: async () => body })
const serve = (t, files) => {
  const fetched = mock.method(globalThis, 'fetch', async (url) => {
    const body = files[String(url).replace(/^https?:\/\/[^/]+/, '')]
    return body ? json(body) : { ok: false, status: 404 }
  })
  t.after(() => fetched.mock.restore())
}

test('the name comes from umpire-history first', async (t) => {
  serve(t, { '/data/umpire-history/52.json': { umpires: { 427552: { name: 'Mike Winters' } } } })
  assert.equal(await umpireName(427552), 'Mike Winters')
})

test('the name falls back to the newest umpires/ shard', async (t) => {
  serve(t, {
    '/data/umpires/seasons.json': { seasons: [2025, 2026], current: 2026 },
    '/data/umpires/2025/777001.json': { id: 777001, name: 'Old Name', games: [] },
    '/data/umpires/2026/777001.json': { id: 777001, name: 'Al Active', games: [] },
  })
  assert.equal(await umpireName(777001), 'Al Active')
})

test('an umpire in neither store has no name', async (t) => {
  serve(t, {})
  assert.equal(await umpireName(999999), null)
})
