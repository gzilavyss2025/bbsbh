import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { staticJson, staticJsonBy } from '../src/api/staticJson.js'

// The whole point of this helper is the CONCURRENT case. A cache assigned after
// the await only short-circuits a call that starts once the first has already
// resolved, and React mounts a page's cards on one tick — so every card fired
// its own copy of the same request. Each test below therefore starts its calls
// together, before any of them can resolve.

function countingFetch(bodyFor) {
  const calls = []
  let release
  const gate = new Promise((r) => {
    release = r
  })
  const fn = async (url) => {
    calls.push(String(url))
    await gate // hold every request open, so none can resolve first
    const body = bodyFor(String(url))
    if (body === undefined) return { ok: false, status: 404 }
    return { ok: true, json: async () => body }
  }
  return { fn, calls, release: () => release() }
}

test('concurrent callers share ONE request', async () => {
  const { fn, calls, release } = countingFetch(() => ({ n: 1 }))
  const fetchMock = mock.method(globalThis, 'fetch', fn)
  try {
    const load = staticJson('/data/thing.json')
    const all = Promise.all([load(), load(), load(), load()])
    release()
    const results = await all
    assert.equal(calls.length, 1, `fetched ${calls.length} times for one file`)
    for (const r of results) assert.deepEqual(r, { n: 1 })
    // And a later call is served from the memo, not the network.
    assert.deepEqual(await load(), { n: 1 })
    assert.equal(calls.length, 1)
  } finally {
    fetchMock.mock.restore()
  }
})

test('the shape runs once, on the shared result', async () => {
  const { fn, release } = countingFetch(() => ({ players: [1, 2] }))
  const fetchMock = mock.method(globalThis, 'fetch', fn)
  try {
    let shaped = 0
    const load = staticJson('/data/shaped.json', {
      shape: (d) => {
        shaped += 1
        return { players: d.players ?? [], count: d.players.length }
      },
      fallback: { players: [], count: 0 },
    })
    const all = Promise.all([load(), load()])
    release()
    const [a, b] = await all
    assert.equal(shaped, 1)
    assert.deepEqual(a, { players: [1, 2], count: 2 })
    assert.equal(a, b, 'both callers get the same object')
  } finally {
    fetchMock.mock.restore()
  }
})

test('a null fallback is memoized, not re-fetched forever', async () => {
  const { fn, calls, release } = countingFetch(() => undefined) // always 404
  const fetchMock = mock.method(globalThis, 'fetch', fn)
  try {
    const load = staticJson('/data/missing.json') // fallback defaults to null
    const all = Promise.all([load(), load()])
    release()
    assert.deepEqual(await all, [null, null])
    assert.equal(await load(), null)
    // A `if (value)` guard would refetch on every call, since null is falsy.
    assert.equal(calls.length, 1, `refetched a missing file ${calls.length} times`)
  } finally {
    fetchMock.mock.restore()
  }
})

test('a sharded set memoizes per key, and shares per key', async () => {
  const { fn, calls, release } = countingFetch((url) => ({ url }))
  const fetchMock = mock.method(globalThis, 'fetch', fn)
  try {
    const load = staticJsonBy((key) => `/data/bucket/${key}.json`)
    const all = Promise.all([load(7), load(7), load(8), load('8')])
    release()
    const [a, b, c, d] = await all
    assert.deepEqual(calls.sort(), ['/data/bucket/7.json', '/data/bucket/8.json'])
    assert.equal(a, b, 'same key, same shared result')
    assert.equal(c, d, 'a numeric and a string key are the same shard')
    assert.notEqual(a.url, c.url)
  } finally {
    fetchMock.mock.restore()
  }
})

// #1650: an unanswered request is remembered ~30 s (Date.now is the clock), so an
// offline device fires one fetch per file, not one per call; then it may retry.
test('a request that got no answer is remembered ~30 s, then retried', async () => {
  let down = true
  let calls = 0
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    calls += 1
    if (down) throw new TypeError('Failed to fetch')
    return { ok: true, json: async () => ({ n: 1 }) }
  })
  let t = 1_000_000
  const now = mock.method(Date, 'now', () => t)
  try {
    const load = staticJson('/data/flaky.json', { fallback: { n: 0 } })
    const byKey = staticJsonBy((k) => `/data/flaky/${k}.json`, { fallback: { n: 0 } })
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(await load(), { n: 0 })
      assert.deepEqual(await byKey(1), { n: 0 })
    }
    assert.equal(calls, 2, `fired ${calls} fetches for two offline files`)
    down = false
    t += 31_000
    assert.deepEqual(await load(), { n: 1 }, 'single file retried after the window')
    assert.deepEqual(await byKey(1), { n: 1 }, 'shard retried after the window')
    assert.equal(calls, 4)
    await load()
    assert.equal(calls, 4, 'a good answer is memoized')
  } finally {
    now.mock.restore()
    fetchMock.mock.restore()
  }
})
