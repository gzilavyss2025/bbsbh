import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeContractRecord,
  normalizeContractsPayload,
  parseOptions,
} from '../scripts/fever/normalize-contracts.mjs'

const BRYAN = {
  player_id: 650559,
  mlbam_name: 'Bryan De La Cruz',
  season: 2026,
  club_abbrev: 'NYY',
  club_name: 'New York Yankees',
  salary_usd: 403209,
  cbt_usd: 403209,
  estimated: false,
  contract_total_usd: null,
  aav_usd: null,
  terms_raw: '1 y (26)',
  out_years: { 2027: { cash: 'A2' }, 2028: { cash: 'A3' }, 2029: { cash: 'FA' } },
  mls_years: 3,
  mls_days: 56,
  mls_approximate: false,
  regime: 'arbitration',
  regime_flag: null,
  options_left: '2 / 3',
  agent: 'Klutch Spts',
  cots_as_of: '2026-08-06',
  confirmed_at: '2026-08-18T13:14:39Z',
}

test('normalizes Fever contract data without losing control-year context', () => {
  const record = normalizeContractRecord('650559', BRYAN)
  assert.equal(record.salaryUsd, 403209)
  assert.deepEqual(record.options, { remaining: 2, total: 3 })
  assert.deepEqual(record.service, { years: 3, days: 56, approximate: false })
  assert.deepEqual(record.outYears, [
    { year: 2027, cash: 'A2', cbt: null },
    { year: 2028, cash: 'A3', cbt: null },
    { year: 2029, cash: 'FA', cbt: null },
  ])
})

test('parses option counts defensively', () => {
  assert.deepEqual(parseOptions('2 / 3'), { remaining: 2, total: 3 })
  assert.equal(parseOptions('unknown'), null)
  assert.equal(parseOptions(null), null)
})

test('validates the feed count and carries source metadata', () => {
  const feed = {
    available: true,
    generated_at: '2026-08-18T13:14:39Z',
    season: 2026,
    source: "Cot's Baseball Contracts",
    source_url: 'https://legacy.baseballprospectus.com/compensation/cots/',
    cots_as_of: '2026-08-06',
    counts: { shipped: 1 },
    players: { 650559: BRYAN },
  }
  const normalized = normalizeContractsPayload(feed)
  assert.equal(normalized.meta.attribution, 'Fever Baseball')
  assert.equal(normalized.players['650559'].name, 'Bryan De La Cruz')

  assert.throws(
    () => normalizeContractsPayload({ ...feed, counts: { shipped: 2 } }),
    /expected 2 shipped players/,
  )
})
