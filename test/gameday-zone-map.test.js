// The zone map's data: a batter's season by zone through the day BEFORE the game. Recorded
// response: Arozarena (668227), hotColdZones, season 2026, endDate=2026-08-31 (the day before
// gamePk 824716), battingAverage split only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchBatterZones } from '../src/api/gameday/zones.js'

const recorded = JSON.parse(
  readFileSync(new URL('./fixtures/gameday/hotcoldzones-668227.json', import.meta.url), 'utf8'),
)

// Stub fetch; resolves `body` and records the path asked for.
function stub(body) {
  const asked = []
  globalThis.fetch = async (url) => {
    asked.push(String(url))
    return { ok: true, json: async () => body }
  }
  return asked
}

test('parses avg and temp for zones 01-09, dropping the outer 11-14', async () => {
  stub(recorded)
  const { zones } = await fetchBatterZones(668227, 2026, 1, '2026-09-01')
  assert.deepEqual(Object.keys(zones), ['01', '02', '03', '04', '05', '06', '07', '08', '09'])
  assert.deepEqual(zones['05'], { avg: '.250', temp: 'lukewarm' })
  assert.deepEqual(zones['06'], { avg: '.397', temp: 'hot' })
  assert.deepEqual(zones['01'], { avg: '.133', temp: 'cold' })
})

test('the request ends the day before the game', async () => {
  const asked = stub(recorded)
  await fetchBatterZones(668227, 2026, 1, '2026-09-01')
  assert.match(asked[0], /\/api\/v1\/people\/668227\/stats\?stats=hotColdZones&group=hitting/)
  assert.match(asked[0], /season=2026&sportId=1&endDate=2026-08-31$/)
})

test('a month boundary still ends the day before', async () => {
  const asked = stub(recorded)
  await fetchBatterZones(668227, 2026, 11, '2026-04-01')
  assert.match(asked[0], /sportId=11&endDate=2026-03-31$/)
})

test('null on an empty response (MiLB, a debut) and with no date to stop at', async () => {
  stub({ stats: [{ type: { displayName: 'hotColdZones' }, splits: [] }] })
  assert.equal(await fetchBatterZones(1, 2026, 1, '2026-09-01'), null)
  stub({})
  assert.equal(await fetchBatterZones(1, 2026, 1, '2026-09-01'), null)
  const asked = stub(recorded)
  assert.equal(await fetchBatterZones(668227, 2026, 1, ''), null)
  assert.equal(asked.length, 0)
})

test('a failed fetch is null, not a throw', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404 })
  assert.equal(await fetchBatterZones(668227, 2026, 1, '2026-09-01'), null)
})

test('no level, no request: sportId=undefined would ask for the wrong league', async () => {
  const asked = stub(recorded)
  assert.equal(await fetchBatterZones(668227, 2026, undefined, '2026-09-01'), null)
  assert.equal(asked.length, 0)
})
