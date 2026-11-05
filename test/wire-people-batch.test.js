// person-fetch.js fetchPersonBatched: the career/bio read of every move that asks in
// one tick is ONE people?personIds= call, split back out per player.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchPersonBatched } from '../src/api/person-fetch.js'

// `known` ids exist; `failBatch` answers every personIds call 400 (not retried).
function stubPeople(known, { failBatch = false } = {}) {
  const real = globalThis.fetch
  const urls = []
  globalThis.fetch = async (url) => {
    const u = new URL(String(url))
    urls.push(String(url))
    const ids = u.searchParams.has('personIds')
      ? u.searchParams.get('personIds').split(',').map(Number)
      : [Number(u.pathname.split('/').pop())]
    if ((failBatch && u.searchParams.has('personIds')) || ids.some(Number.isNaN)) return new Response('{}', { status: u.searchParams.has('personIds') ? 400 : 404 })
    const people = ids.filter((id) => known.includes(id)).map((id) => ({ id, fullName: `P${id}` }))
    // A single read of an unknown id is a 404, as statsapi answers it.
    if (!u.searchParams.has('personIds') && !people.length) return new Response('{}', { status: 404 })
    return new Response(JSON.stringify({ people }), { status: 200 })
  }
  return { urls, restore: () => (globalThis.fetch = real) }
}

test('players asked for in one tick share one call, each gets his own person', async () => {
  const { urls, restore } = stubPeople([11, 22, 33])
  try {
    const got = await Promise.all([fetchPersonBatched(11), fetchPersonBatched(22), fetchPersonBatched(33), fetchPersonBatched(22)])
    assert.equal(urls.length, 1)
    assert.match(urls[0], /personIds=11,22,33&hydrate=transactions,draft,stats/)
    assert.deepEqual(got.map((d) => d.people[0].id), [11, 22, 33, 22])
  } finally {
    restore()
  }
})

test('a player the feed leaves out rejects alone, as his 404 did, so he is retried', async () => {
  const { restore } = stubPeople([11])
  try {
    const [a, b] = await Promise.allSettled([fetchPersonBatched(11), fetchPersonBatched(99)])
    assert.equal(a.value.people[0].id, 11)
    assert.equal(b.status, 'rejected')
  } finally {
    restore()
  }
})

test('a bad id never goes into the batch', async () => {
  const { urls, restore } = stubPeople([11])
  try {
    const [a, b] = await Promise.allSettled([fetchPersonBatched(11), fetchPersonBatched(undefined)])
    assert.equal(a.value.people[0].id, 11)
    assert.equal(b.status, 'rejected')
    assert.ok(urls.some((u) => u.includes('personIds=11&')))
    assert.ok(!urls.some((u) => /personIds=[^&]*NaN/.test(u)))
  } finally {
    restore()
  }
})

test('a failed batch falls back to a single read per player', async () => {
  const { urls, restore } = stubPeople([11, 22], { failBatch: true })
  try {
    const got = await Promise.all([fetchPersonBatched(11), fetchPersonBatched(22)])
    assert.deepEqual(got.map((d) => d.people[0].id), [11, 22])
    assert.ok(urls.some((u) => u.includes('/people/11?')) && urls.some((u) => u.includes('/people/22?')))
  } finally {
    restore()
  }
})

test('26 players make two calls and none is dropped', async () => {
  const ids = Array.from({ length: 26 }, (_, i) => i + 1)
  const { urls, restore } = stubPeople(ids)
  try {
    const got = await Promise.all(ids.map((id) => fetchPersonBatched(id)))
    assert.equal(urls.length, 2)
    assert.deepEqual(got.map((d) => d.people[0].id), ids)
  } finally {
    restore()
  }
})
