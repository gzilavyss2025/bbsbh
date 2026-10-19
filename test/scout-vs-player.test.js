// Bonds vs Maddux, before pitch tracking: the statsapi `vsPlayerTotal` split is
// the only source. The fixture also holds per-season `vsPlayer` splits, which
// list each plate appearance twice and must never be read.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseVsPlayerTotal } from '../src/api/scout/vsPlayer.js'

const JSON_ = JSON.parse(readFileSync(new URL('./fixtures/scout/vs-player-bonds-maddux.json', import.meta.url), 'utf8'))

test('reads the career total split, not the per-season splits', () => {
  assert.deepEqual(parseVsPlayerTotal(JSON_), { pa: 154, avg: '.262', obp: '.370', slg: '.485', hr: 8, k: 16, bb: 23 })
})

test('null when there is no total split', () => {
  assert.equal(parseVsPlayerTotal({ stats: JSON_.stats.filter((s) => s.type.displayName === 'vsPlayer') }), null)
  assert.equal(parseVsPlayerTotal(null), null)
})
