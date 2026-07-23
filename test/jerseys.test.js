// Coverage for the jersey/logo-variant data layer: the generator's pure
// export builder (gen-jerseys.mjs) and the reader (src/api/jerseys.js).
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildJerseysExport } from '../scripts/gen-jerseys.mjs'
import { fetchJerseysData, jerseyTreatmentFor } from '../src/api/jerseys.js'

const row = (gamePk, teamId, assets) => ({
  game_pk: gamePk,
  team_id: teamId,
  payload_json: JSON.stringify(assets),
})

// --------------------------------------------------------------------------
// buildJerseysExport
// --------------------------------------------------------------------------
test('buildJerseysExport keeps alternate/city-connect, drops main', () => {
  const rows = [
    row(1, 158, [{ text: 'Brewers Home Cream', piece: 'J' }]), // main
    row(2, 120, [{ text: 'Nationals Alt 1 Red "W" Jersey', piece: 'J' }]),
    row(3, 143, [{ text: 'Phillies City Connect', piece: 'J' }]),
  ]
  assert.deepEqual(buildJerseysExport(rows), {
    '2:120': 'alternate',
    '3:143': 'city-connect',
  })
})

test('buildJerseysExport applies JERSEY_TREATMENT_OVERRIDES via the asset code, overriding the naming-convention guess', () => {
  const rows = [
    // "Home White" would classify as 'main' (dropped) by name alone, but
    // this code is one of the Mariners' known naming/logo exceptions.
    row(4, 136, [{ text: 'Mariners Home White', piece: 'J', code: '136_jersey_1_2026' }]),
  ]
  assert.deepEqual(buildJerseysExport(rows), { '4:136': 'alternate' })
})

test('buildJerseysExport skips a row with no jersey-piece asset', () => {
  const rows = [row(1, 158, [{ text: 'Brewers Road Gray Pants', piece: 'P' }])]
  assert.deepEqual(buildJerseysExport(rows), {})
})

test('buildJerseysExport skips malformed/empty payload_json without throwing', () => {
  const rows = [
    { game_pk: 1, team_id: 158, payload_json: 'not json' },
    { game_pk: 2, team_id: 158, payload_json: '' },
    { game_pk: 3, team_id: 158, payload_json: '[]' },
  ]
  assert.deepEqual(buildJerseysExport(rows), {})
})

// --------------------------------------------------------------------------
// jerseyTreatmentFor
// --------------------------------------------------------------------------
test('jerseyTreatmentFor looks up the compound key, null when absent', () => {
  const data = { '2:120': 'alternate' }
  assert.equal(jerseyTreatmentFor(data, 2, 120), 'alternate')
  assert.equal(jerseyTreatmentFor(data, 2, 999), null)
  assert.equal(jerseyTreatmentFor(data, null, 120), null)
  assert.equal(jerseyTreatmentFor(null, 2, 120), null)
})

// --------------------------------------------------------------------------
// fetchJerseysData — this suite is the only place that exercises it, since
// its cache is module-level singleton state; keep it that way rather than
// adding a second call site elsewhere in the test suite.
// --------------------------------------------------------------------------
test('fetchJerseysData shares one in-flight request across concurrent callers', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return { ok: true, status: 200, json: async () => ({ '2:120': 'alternate' }) }
  }
  try {
    // Every GameCard on the home slate calls this on the same mount tick —
    // simulate that with several concurrent callers before the first
    // request resolves.
    const [a, b, c] = await Promise.all([
      fetchJerseysData(),
      fetchJerseysData(),
      fetchJerseysData(),
    ])
    assert.equal(calls, 1)
    assert.deepEqual(a, { '2:120': 'alternate' })
    assert.equal(a, b)
    assert.equal(b, c)

    // Once resolved, a later caller hits the plain in-memory cache — still
    // no second network request.
    await fetchJerseysData()
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
