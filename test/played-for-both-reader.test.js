import test from 'node:test'
import assert from 'node:assert/strict'

// #2579 slice 2: the "Played for both" reader. Offline: a stub `fetch` serves one shard.
const asked = []
const shard = {
  credit: ['Retrosheet', 'Chadwick'],
  teams: [108, 109],
  throughSeason: 2025,
  top: [2, 1],
  rows: [
    [2, 'Randal Grichuk', [2023], [2024, 2025]],
    [1, 'Andrew Chafin', [2025], [2014, 2015]],
  ],
}
globalThis.fetch = async (url) => {
  const u = String(url)
  asked.push(u)
  const ok = u.endsWith('/data/played-for-both/108-109.json')
  return { ok, status: ok ? 200 : 404, headers: new Headers(), json: async () => shard, text: async () => JSON.stringify(shard) }
}

const { playedForBoth } = await import('../src/api/history/playedForBoth.js')

test('the same result for either club order, and one file read', async () => {
  const ab = await playedForBoth(108, 109)
  const ba = await playedForBoth(109, 108)
  assert.deepEqual(ab, ba)
  assert.equal(asked.filter((u) => u.includes('played-for-both/')).length, 1)
  assert.ok(asked.every((u) => u.includes('/108-109.json')), 'ids ascending in the file name')
})

test('rows carry the seasons per club id, most recent first as filed', async () => {
  const r = await playedForBoth(109, 108)
  assert.equal(r.rows[0].name, 'Randal Grichuk')
  assert.deepEqual(r.rows[0].seasons[108], [2023])
  assert.deepEqual(r.rows[0].seasons[109], [2024, 2025])
  assert.deepEqual(r.top.map((p) => p.id), [2, 1])
  assert.equal(r.top[0].name, 'Randal Grichuk')
  assert.equal(r.throughSeason, 2025)
  assert.deepEqual(r.credit, ['Retrosheet', 'Chadwick'])
})

test('a missing shard (MiLB, a 404) reads empty and does not throw', async () => {
  const r = await playedForBoth(158, 159)
  assert.deepEqual(r.rows, [])
  assert.deepEqual(r.top, [])
  assert.equal(await playedForBoth(null, 109).then((x) => x.rows.length), 0)
})
