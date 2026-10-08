// OVR step 6 (#1720): the rating shard reader. fetch is stubbed; no network.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchOvr } from '../../src/api/ovr/ovrData.js'

const hit = { ovr: 72, bars: { contact: 80, power: 70 }, seasons: [2026, 2025] }
const shard = { bat: { 100: hit }, pit: { 200: { ovr: 61, bars: { stuff: 65 }, seasons: [2026] } } }
globalThis.fetch = async (url) =>
  String(url).endsWith('/ovr/00.json') ? { ok: true, json: async () => shard } : { ok: false, status: 404 }

test('reads the hitter or pitcher side of the one shard by group', async () => {
  assert.deepEqual(await fetchOvr(100, 'hitting'), hit)
  assert.equal((await fetchOvr(200, 'pitching')).ovr, 61)
})

test('a player with no rating, or in no shard, gets null', async () => {
  assert.equal(await fetchOvr(100, 'pitching'), null) // shard 00, wrong side
  assert.equal(await fetchOvr(101, 'hitting'), null) // shard 01 is a 404
})
