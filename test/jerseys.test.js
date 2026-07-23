// Coverage for the jersey/logo-variant data layer: the generator's pure
// export builder (gen-jerseys.mjs) and the reader (src/api/jerseys.js).
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildJerseysExport } from '../scripts/gen-jerseys.mjs'
import { jerseyTreatmentFor } from '../src/api/jerseys.js'

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
