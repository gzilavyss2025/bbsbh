import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchCallouts, calloutsForGame } from '../src/api/callouts.js'

// The callouts set is one file per game. What matters at the reader is that a
// surface pays for the games it asks about and nothing else — a lineup page
// showing one game must not pull the slate, which is what the single
// per-date file made it do.

function mockFetch(bundlesByPath) {
  const asked = []
  const fn = async (url) => {
    asked.push(String(url))
    const body = bundlesByPath[String(url)]
    if (!body) return { ok: false, status: 404 }
    return { ok: true, json: async () => body }
  }
  return { fn, asked }
}

test('one game costs one file', async () => {
  const original = globalThis.fetch
  const { fn, asked } = mockFetch({
    '/data/callouts/08042026/777.json': { gamePk: 777, leaders: {} },
    '/data/callouts/08042026/778.json': { gamePk: 778, leaders: {} },
  })
  globalThis.fetch = fn
  try {
    const data = await fetchCallouts('08042026', [777])
    assert.deepEqual(asked, ['/data/callouts/08042026/777.json'])
    assert.equal(calloutsForGame(data, 777).gamePk, 777)
    // The rest of the slate is not in hand, and was never asked for.
    assert.equal(calloutsForGame(data, 778), null)
  } finally {
    globalThis.fetch = original
  }
})

test('a set of games comes back in one { games } map, deduped', async () => {
  const original = globalThis.fetch
  const { fn, asked } = mockFetch({
    '/data/callouts/08052026/1.json': { gamePk: 1 },
    '/data/callouts/08052026/2.json': { gamePk: 2 },
  })
  globalThis.fetch = fn
  try {
    const data = await fetchCallouts('08052026', [1, 2, 1])
    assert.deepEqual(Object.keys(data.games).sort(), ['1', '2'])
    assert.equal(asked.length, 2, 'a repeated gamePk must not be fetched twice')
  } finally {
    globalThis.fetch = original
  }
})

test('a missing game degrades to no notes, not a broken view', async () => {
  const original = globalThis.fetch
  const { fn } = mockFetch({ '/data/callouts/08062026/1.json': { gamePk: 1 } })
  globalThis.fetch = fn
  try {
    // 2 has no file (an un-generated date, a MiLB game predating the sweep,
    // a failed nightly run). 1 still resolves.
    const data = await fetchCallouts('08062026', [1, 2])
    assert.equal(calloutsForGame(data, 1).gamePk, 1)
    assert.equal(calloutsForGame(data, 2), null)

    globalThis.fetch = async () => {
      throw new Error('offline')
    }
    assert.deepEqual(await fetchCallouts('08072026', [9]), { games: {} })
  } finally {
    globalThis.fetch = original
  }
})

test('no gamePks means no request at all', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return { ok: false, status: 404 }
  }
  try {
    assert.deepEqual(await fetchCallouts('08082026', []), { games: {} })
    assert.deepEqual(await fetchCallouts('', [1]), { games: {} })
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = original
  }
})
