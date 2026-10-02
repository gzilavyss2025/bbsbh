// parseCsv / csvObjects — the CSV reader the Savant generators and the Matchup
// Scout head-to-head share. It moved from scripts/lib/savant.mjs to src/lib/csv/
// so the app can import it. The behaviour did not change; these cases pin it.
// (test/csv.test.js covers the other, line-based reader in scripts/lib/csv.mjs.)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { csvObjects, parseCsv } from '../src/lib/csv/parse.js'
import * as savantLib from '../scripts/lib/savant.mjs'

test('parseCsv keeps a quoted comma inside one field', () => {
  assert.deepEqual(parseCsv('a,b\n"Whitlock, Garrett",5\n'), [['a', 'b'], ['Whitlock, Garrett', '5']])
})

test('parseCsv un-escapes doubled quotes', () => {
  assert.deepEqual(parseCsv('"say ""hi""",x'), [['say "hi"', 'x']])
})

test('parseCsv reads CRLF and bare CR line ends like LF', () => {
  const want = [['a', 'b'], ['1', '2'], ['3', '4']]
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n3,4\r\n'), want)
  assert.deepEqual(parseCsv('a,b\r1,2\r3,4\r'), want)
})

test('parseCsv keeps a newline inside a quoted field', () => {
  assert.deepEqual(parseCsv('a\n"x\ny"\n'), [['a'], ['x\ny']])
})

test('parseCsv skips blank lines and keeps a last row with no final newline', () => {
  assert.deepEqual(parseCsv('a,b\n\n1,2'), [['a', 'b'], ['1', '2']])
})

test('csvObjects strips the BOM and trims header names', () => {
  const rows = csvObjects('﻿"last_name, first_name", pitch_type \r\n"Judge, Aaron",FF\r\n')
  assert.deepEqual(rows, [{ 'last_name, first_name': 'Judge, Aaron', pitch_type: 'FF' }])
})

test('csvObjects returns [] for a header with no data rows', () => {
  assert.deepEqual(csvObjects('a,b\n'), [])
  assert.deepEqual(csvObjects(''), [])
})

test('scripts/lib/savant.mjs still exports the same two functions', () => {
  assert.equal(savantLib.parseCsv, parseCsv)
  assert.equal(savantLib.csvObjects, csvObjects)
})

test('the Savant board fetchers parse through the moved reader', async () => {
  // fetchArsenalBoard calls csvObjects itself, not only re-exports it. A move
  // that drops the local import passes every other test and breaks the cron.
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('"last_name, first_name",pitch_type\n"Judge, Aaron",FF\n')
  try {
    const rows = await savantLib.fetchArsenalBoard('batter', { season: 2026, attempts: 1 })
    assert.equal(rows[0].pitch_type, 'FF')
  } finally {
    globalThis.fetch = realFetch
  }
})
