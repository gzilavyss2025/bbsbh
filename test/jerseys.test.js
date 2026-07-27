// Coverage for the jersey/logo-variant data layer: the generator's pure
// export builder (gen-jerseys.mjs) and the reader (src/api/jerseys.js).
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildJerseysExport } from '../scripts/gen-jerseys.mjs'
import { fetchJerseysData, jerseyTreatmentFor, jerseyWearDates } from '../src/api/jerseys.js'

const row = (gamePk, teamId, assets) => ({
  game_pk: gamePk,
  team_id: teamId,
  payload_json: JSON.stringify(assets),
})

// --------------------------------------------------------------------------
// buildJerseysExport
// --------------------------------------------------------------------------
test('buildJerseysExport keeps main alongside alternate/city-connect', () => {
  const rows = [
    row(1, 158, [{ text: 'Brewers Home Cream', piece: 'J' }]), // main
    row(2, 120, [{ text: 'Nationals Alt 1 Red "W" Jersey', piece: 'J' }]),
    row(3, 143, [{ text: 'Phillies City Connect', piece: 'J' }]),
  ]
  assert.deepEqual(buildJerseysExport(rows), {
    '1:158': 'main',
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

// --------------------------------------------------------------------------
// jerseyWearDates — the gamePk-keyed assignments joined to a dated schedule,
// behind the Team Identity Lab's per-tile "see a real photo" date links.
// --------------------------------------------------------------------------

const sched = (...rows) => rows.map(([gamePk, apiDate]) => ({ gamePk, apiDate, won: true }))

test('jerseyWearDates returns only the games that club wore that treatment, newest first', () => {
  const data = {
    '1:158': 'city-connect',
    '2:158': 'main',
    '3:158': 'city-connect',
    '3:120': 'alternate', // the OTHER club in the same game
  }
  const schedule = sched([1, '2026-04-10'], [2, '2026-05-01'], [3, '2026-07-25'])
  assert.deepEqual(jerseyWearDates(data, schedule, 158, 'city-connect'), [
    { gamePk: 3, apiDate: '2026-07-25' },
    { gamePk: 1, apiDate: '2026-04-10' },
  ])
  // Same schedule, the other club's assignment — must not pick up 158's rows.
  assert.deepEqual(jerseyWearDates(data, schedule, 120, 'alternate'), [
    { gamePk: 3, apiDate: '2026-07-25' },
  ])
})

test('jerseyWearDates caps at the limit, keeping the most recent', () => {
  const data = Object.fromEntries(
    Array.from({ length: 15 }, (_, i) => [`${i + 1}:158`, 'alternate']),
  )
  const schedule = sched(...Array.from({ length: 15 }, (_, i) => [i + 1, `2026-06-${String(i + 1).padStart(2, '0')}`]))
  const out = jerseyWearDates(data, schedule, 158, 'alternate')
  assert.equal(out.length, 10)
  assert.equal(out[0].apiDate, '2026-06-15')
  assert.equal(out.at(-1).apiDate, '2026-06-06')
  assert.equal(jerseyWearDates(data, schedule, 158, 'alternate', 3).length, 3)
})

test('jerseyWearDates degrades to [] rather than throwing on missing halves', () => {
  const schedule = sched([1, '2026-04-10'])
  assert.deepEqual(jerseyWearDates(null, schedule, 158, 'main'), [])
  assert.deepEqual(jerseyWearDates({ '1:158': 'main' }, null, 158, 'main'), [])
  assert.deepEqual(jerseyWearDates({ '1:158': 'main' }, schedule, null, 'main'), [])
  assert.deepEqual(jerseyWearDates({ '1:158': 'main' }, schedule, 158, null), [])
  // A game the club played but whose assignment never posted is simply absent.
  assert.deepEqual(jerseyWearDates({}, schedule, 158, 'main'), [])
})

// A doubleheader puts two gamePks on one date; both are real, distinct looks,
// so neither is collapsed away and the ordering between them stays stable.
test('jerseyWearDates keeps both halves of a doubleheader', () => {
  const data = { '10:158': 'main', '11:158': 'main' }
  const schedule = sched([10, '2026-07-04'], [11, '2026-07-04'])
  assert.deepEqual(jerseyWearDates(data, schedule, 158, 'main'), [
    { gamePk: 11, apiDate: '2026-07-04' },
    { gamePk: 10, apiDate: '2026-07-04' },
  ])
})
