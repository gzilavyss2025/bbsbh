// Unit coverage for scripts/lib/csv.mjs — the parser the contract-identity
// pipeline reads scripts/data/contracts/*.csv through. Names are always
// "Last, First" inside quotes, so comma-inside-quotes handling is the one
// property that actually matters here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCsv, parseCsvLine } from '../scripts/lib/csv.mjs'

test('parseCsvLine keeps a quoted comma inside one field', () => {
  assert.deepEqual(parseCsvLine('2026,"Guerrero Jr., Vladimir",1b,40214286'), [
    '2026',
    'Guerrero Jr., Vladimir',
    '1b',
    '40214286',
  ])
})

test('parseCsvLine un-escapes doubled quotes', () => {
  assert.deepEqual(parseCsvLine('1,"Alex ""Chi Chi"" Ramirez"'), ['1', 'Alex "Chi Chi" Ramirez'])
})

test('parseCsvLine passes unquoted empty cells through as empty strings', () => {
  assert.deepEqual(parseCsvLine('a,,c'), ['a', '', 'c'])
})

test('parseCsv turns a header + rows document into keyed objects', () => {
  const rows = parseCsv('year,player,salary\n2026,"Soto, Juan",61875000\n2026,"Smith, John",\n')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { year: '2026', player: 'Soto, Juan', salary: '61875000' })
  assert.deepEqual(rows[1], { year: '2026', player: 'Smith, John', salary: '' })
})

test('parseCsv skips blank trailing lines', () => {
  const rows = parseCsv('a,b\n1,2\n\n')
  assert.equal(rows.length, 1)
})
