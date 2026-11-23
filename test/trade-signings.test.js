// Hand-entered offseason deals laid over a club's Cot's ledger (src/lib/trade/signings.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applySignings } from '../src/lib/trade/signings.js'
import { lineIndex } from '../src/lib/trade/value.js'

const cells = (vals) => [2026, 2027, 2028].map((year, i) => (vals[i] == null ? { year, kind: 'none' } : { year, kind: 'salary', value: vals[i] }))
const ledger = () => ({
  season: 2026,
  years: [2026, 2027, 2028],
  groups: [{ key: 'lineup', label: 'Lineup', players: [
    { id: 1, name: 'Kept', cells: cells([10, 10, null]) },
    { id: 2, name: 'Resigned', age: 29, cells: cells([6, null, null]) },
  ] }],
  totals: [
    { year: 2026, committed: 16, players: 2 },
    { year: 2027, committed: 10, players: 1 },
    { year: 2028, committed: 0, players: 0 },
  ],
  counts: { guaranteed: 3 },
})

test('a new arrival adds a row and moves the totals by his deal', () => {
  const out = applySignings(ledger(), 99, { 7: { name: 'New', teamId: 99, group: 'lineup', terms: '2 y', cells: [{ year: 2027, value: 20 }, { year: 2028, value: 20 }] } })
  const row = out.groups[0].players.find((p) => p.id === 7)
  assert.deepEqual(row.cells.map((c) => c.value ?? null), [null, 20, 20])
  assert.deepEqual(out.totals.map((t) => t.committed), [16, 30, 20])
  assert.deepEqual(out.totals.map((t) => t.players), [2, 2, 1])
  assert.equal(out.payroll, 16)
  assert.equal(out.counts.guaranteed, 5)
})

test('a re-signing keeps his current-season pay, so the rows still add up to the totals', () => {
  const out = applySignings(ledger(), 99, { 2: { name: 'Resigned', teamId: 99, terms: '1 y', cells: [{ year: 2027, value: 8 }] } })
  const rows = out.groups.flatMap((g) => g.players)
  assert.equal(rows.filter((p) => p.id === 2).length, 1)
  const row = rows.find((p) => p.id === 2)
  assert.deepEqual(row.cells.map((c) => c.value ?? null), [6, 8, null])
  assert.equal(row.age, 29)
  for (const t of out.totals) {
    const sum = rows.reduce((s, p) => s + (p.cells.find((c) => c.year === t.year)?.value ?? 0), 0)
    assert.equal(t.committed, sum, `${t.year} column`)
  }
  assert.deepEqual(out.totals.map((t) => t.players), [2, 2, 0])
})

test('a deal Cot\'s already prices for next season is skipped', () => {
  const before = ledger()
  const out = applySignings(before, 99, { 1: { name: 'Kept', teamId: 99, terms: 'x', cells: [{ year: 2027, value: 50 }] } })
  assert.equal(out, before)
})

test('another club\'s entry and a missing ledger change nothing', () => {
  const before = ledger()
  assert.equal(applySignings(before, 99, { 7: { teamId: 12, cells: [] } }), before)
  assert.equal(applySignings(null, 99), null)
})

test('a line with no at-bats or innings has no league index', () => {
  const lg = { ops: 0.71, era: 4.1 }
  assert.equal(lineIndex({ ops: '.---' }, lg), null)
  assert.equal(lineIndex({ era: '-.--' }, lg), null)
})
