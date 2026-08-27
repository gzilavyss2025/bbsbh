// Unit coverage for src/api/contractsHistory.js's pure merge step — the read
// side that makes an admin's /api/contract-identity correction visible to a
// reader without regenerating any static file. Exercised through
// mergeContractHistoryRows directly (no fetching) per that module's design.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeContractHistoryRows } from '../src/api/contractsHistory.js'

const GARY = 547989

test('a reassigned row disappears from the original player\'s merged history', () => {
  const shardRows = [
    { rowKey: 'cots-2026#10', sourceFile: 'cots-2026', season: 2026, teamId: 158, terms: '1 yr $5M', confidence: 'exact' },
  ]
  const overrides = {
    'cots-2026#10': { mlbId: 999999, dismissed: false, confidence: 'exact', originalConfidence: 'exact' },
  }
  assert.deepEqual(mergeContractHistoryRows(GARY, shardRows, overrides, {}), [])
})

test('a dismissed row disappears', () => {
  const shardRows = [
    { rowKey: 'cots-2026#11', sourceFile: 'cots-2026', season: 2025, teamId: 158, terms: '2 yr $10M', confidence: 'fuzzy' },
  ]
  const overrides = { 'cots-2026#11': { mlbId: GARY, dismissed: true } }
  assert.deepEqual(mergeContractHistoryRows(GARY, shardRows, overrides, {}), [])
})

test('a brand-new row from an override appears, joining its terms from the bucket lookup', () => {
  const overrides = {
    'cots-2024#420': { mlbId: GARY, dismissed: false, confidence: 'exact', originalConfidence: 'exact' },
  }
  const termsByRowKey = {
    'cots-2024#420': { season: 2024, teamId: 108, terms: '3 yr $30M' },
  }
  assert.deepEqual(mergeContractHistoryRows(GARY, [], overrides, termsByRowKey), [
    {
      rowKey: 'cots-2024#420',
      sourceFile: 'cots-2024',
      season: 2024,
      teamId: 108,
      terms: '3 yr $30M',
      confidence: 'exact',
      originalConfidence: 'exact',
    },
  ])
})

test('a new row with no matching terms bucket is skipped, not thrown', () => {
  const overrides = {
    'cots-2024#420': { mlbId: GARY, dismissed: false, confidence: 'exact', originalConfidence: 'exact' },
  }
  assert.deepEqual(mergeContractHistoryRows(GARY, [], overrides, {}), [])
})

test('a promoted row reads as exact everywhere, carrying its original confidence for context', () => {
  const shardRows = [
    { rowKey: 'cots-2023#5', sourceFile: 'cots-2023', season: 2023, teamId: 133, terms: '1 yr $2M', confidence: 'fuzzy' },
  ]
  const overrides = {
    'cots-2023#5': { mlbId: GARY, dismissed: false, confidence: 'exact', originalConfidence: 'fuzzy' },
  }
  const [row] = mergeContractHistoryRows(GARY, shardRows, overrides, {})
  assert.equal(row.confidence, 'exact')
  assert.equal(row.originalConfidence, 'fuzzy')
})

test('an absent shard yields an empty array, whether rows is [] or missing entirely', () => {
  assert.deepEqual(mergeContractHistoryRows(GARY, [], {}, {}), [])
  assert.deepEqual(mergeContractHistoryRows(GARY, null, {}, {}), [])
  assert.deepEqual(mergeContractHistoryRows(GARY, undefined, {}, {}), [])
})

test('a failed override fetch (degraded to {}) still returns the shard\'s rows, untouched', () => {
  const shardRows = [
    { rowKey: 'cots-2022#1', sourceFile: 'cots-2022', season: 2022, teamId: 158, terms: '1 yr $1M', confidence: 'exact' },
  ]
  assert.deepEqual(mergeContractHistoryRows(GARY, shardRows, {}, {}), [
    {
      rowKey: 'cots-2022#1',
      sourceFile: 'cots-2022',
      season: 2022,
      teamId: 158,
      terms: '1 yr $1M',
      confidence: 'exact',
      originalConfidence: 'exact',
    },
  ])
})

test('merged rows sort by season descending, shard and appended rows together', () => {
  const shardRows = [
    { rowKey: 'cots-2021#1', sourceFile: 'cots-2021', season: 2021, teamId: 158, terms: '1 yr $1M', confidence: 'exact' },
    { rowKey: 'cots-2025#1', sourceFile: 'cots-2025', season: 2025, teamId: 158, terms: '1 yr $6M', confidence: 'exact' },
  ]
  const overrides = {
    'cots-2023#1': { mlbId: GARY, dismissed: false, confidence: 'exact', originalConfidence: 'exact' },
  }
  const termsByRowKey = {
    'cots-2023#1': { season: 2023, teamId: 158, terms: '1 yr $3M' },
  }
  const seasons = mergeContractHistoryRows(GARY, shardRows, overrides, termsByRowKey).map((row) => row.season)
  assert.deepEqual(seasons, [2025, 2023, 2021])
})

test('nothing this function returns ever carries meta.source, sourceUrl, or attribution', () => {
  const shardRows = [
    { rowKey: 'cots-2022#1', sourceFile: 'cots-2022', season: 2022, teamId: 158, terms: '1 yr $1M', confidence: 'exact' },
  ]
  const overrides = {
    'cots-2024#420': { mlbId: GARY, dismissed: false, confidence: 'exact', originalConfidence: 'exact' },
  }
  const termsByRowKey = {
    'cots-2024#420': { season: 2024, teamId: 108, terms: '3 yr $30M' },
  }
  const rows = mergeContractHistoryRows(GARY, shardRows, overrides, termsByRowKey)
  for (const row of rows) {
    assert.equal('source' in row, false)
    assert.equal('sourceUrl' in row, false)
    assert.equal('attribution' in row, false)
    assert.deepEqual(Object.keys(row).sort(), [
      'confidence',
      'originalConfidence',
      'rowKey',
      'season',
      'sourceFile',
      'teamId',
      'terms',
    ])
  }
})
