// personBatch.js fetchPerson: the career/bio read of every move that comes near
// view in one tick is ONE people?personIds= call, split back out per player.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchPerson } from '../src/api/transactions/personBatch.js'

function stubPeople(known) {
  const real = globalThis.fetch
  const urls = []
  globalThis.fetch = async (url) => {
    urls.push(String(url))
    const ids = new URL(String(url)).searchParams.get('personIds').split(',').map(Number)
    return new Response(JSON.stringify({ people: ids.filter((id) => known.includes(id)).map((id) => ({ id, fullName: `P${id}` })) }), { status: 200 })
  }
  return { urls, restore: () => (globalThis.fetch = real) }
}

test('players asked for in one tick share one call, each gets his own person', async () => {
  const { urls, restore } = stubPeople([11, 22, 33])
  try {
    const got = await Promise.all([fetchPerson(11), fetchPerson(22), fetchPerson(33), fetchPerson(22)])
    assert.equal(urls.length, 1)
    assert.match(urls[0], /personIds=11,22,33&hydrate=transactions,draft,stats/)
    assert.deepEqual(got.map((d) => d.people[0].id), [11, 22, 33, 22])
  } finally {
    restore()
  }
})

test('a player the feed does not return reads as no person, as a single read did', async () => {
  const { restore } = stubPeople([11])
  try {
    const [a, b] = await Promise.all([fetchPerson(11), fetchPerson(99)])
    assert.equal(a.people[0].id, 11)
    assert.deepEqual(b.people, [])
  } finally {
    restore()
  }
})
