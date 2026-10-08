// OVR step 4 (#1717): the prior-season shard reader. fetch is stubbed; no network.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchSavantHistory } from '../../src/api/ovr/savantHistory.js'

const shard = { bat: { 100: { 2025: { xwoba: 70 } } }, pit: { 200: { 2024: { k: 80 } } } }
globalThis.fetch = async (url) =>
  String(url).endsWith('/00.json') ? { ok: true, json: async () => shard } : { ok: false, status: 404 }

test('reads the hitter or pitcher side of the one shard by group', async () => {
  assert.deepEqual(await fetchSavantHistory(100, 'hitting'), { 2025: { xwoba: 70 } })
  assert.deepEqual(await fetchSavantHistory(200, 'pitching'), { 2024: { k: 80 } })
})

test('a player with no row, or in no shard, gets {}', async () => {
  assert.deepEqual(await fetchSavantHistory(100, 'pitching'), {}) // shard 00, wrong side
  assert.deepEqual(await fetchSavantHistory(101, 'hitting'), {}) // shard 01 is a 404
})
