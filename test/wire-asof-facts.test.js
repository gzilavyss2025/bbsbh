// playerFacts.js asOfFacts: a move's facts as they stood the day before it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asOfFacts } from '../src/api/transactions/playerFacts.js'

// statsapi answers every dated range with no splits: he had played no MLB game yet.
function stubEmpty() {
  const real = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ stats: [{ splits: [] }] }), { status: 200 })
  return () => (globalThis.fetch = real)
}

test('a first call-up carries no career line, not the career he went on to have', async () => {
  const restore = stubEmpty()
  try {
    const facts = { pitcher: false, season: 2026, careerLine: { games: 120, avg: '.270' }, rows: [] }
    const out = await asOfFacts(1, { birthDate: '2002-01-01' }, facts, '2026-05-01')
    assert.equal(out.careerLine, null)
  } finally {
    restore()
  }
})

test('a move after the season keeps that season on the sheet', async () => {
  const restore = stubEmpty()
  try {
    const facts = { pitcher: false, season: 2026, rows: [{ season: 2025 }, { season: 2026 }] }
    const out = await asOfFacts(1, {}, facts, '2026-11-05')
    assert.deepEqual(out.rows.map((r) => r.season), [2025, 2026])
    const april = await asOfFacts(1, {}, facts, '2026-04-14')
    assert.deepEqual(april.rows.map((r) => r.season), [2025])
  } finally {
    restore()
  }
})
