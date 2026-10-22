import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSeasons } from '../scripts/lib/awards/history-merge.mjs'

const fam = (key, years) => ({ key, label: key, years })
const rec = (playerId) => [{ playerId }]
const base = { order: ['MVP', 'Cy Young'], keep: [2026, 2025, 2024] }

test('a refreshed season replaces its old rows; other seasons carry forward', () => {
  const prev = [fam('MVP', { 2025: rec(1), 2026: rec(2) })]
  const fresh = [fam('MVP', { 2026: rec(3) })]
  const out = mergeSeasons({ ...base, prev, fresh, refreshed: [2026] })
  assert.deepEqual(out, [fam('MVP', { 2025: rec(1), 2026: rec(3) })])
})

test('a refreshed season that came back empty is dropped, not left stale', () => {
  const prev = [fam('MVP', { 2025: rec(1), 2026: rec(2) })]
  const out = mergeSeasons({ ...base, prev, fresh: [], refreshed: [2026] })
  assert.deepEqual(out, [fam('MVP', { 2025: rec(1) })])
})

test('seasons outside the rolling window fall off; an empty family is dropped', () => {
  const prev = [fam('MVP', { 2020: rec(1) }), fam('Cy Young', { 2025: rec(2) })]
  const out = mergeSeasons({ ...base, prev, fresh: [], refreshed: [2026] })
  assert.deepEqual(out, [fam('Cy Young', { 2025: rec(2) })])
})

test('a family new to the file is added in canonical order', () => {
  const prev = [fam('Cy Young', { 2025: rec(2) })]
  const fresh = [fam('MVP', { 2026: rec(9) })]
  const out = mergeSeasons({ ...base, prev, fresh, refreshed: [2026] })
  assert.deepEqual(out.map((f) => f.key), ['MVP', 'Cy Young'])
})
