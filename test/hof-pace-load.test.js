import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPool } from '../src/screens/player/next/modules/hofpace/hofpaceData.js'

test('a failed load of hof-pace.json is not cached: the next call fetches again', async () => {
  const real = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => (++calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ players: [{ id: 1 }] }) })
  try {
    assert.deepEqual(await loadPool(), { players: [] })
    assert.deepEqual(await loadPool(), { players: [{ id: 1 }] })
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = real
  }
})
