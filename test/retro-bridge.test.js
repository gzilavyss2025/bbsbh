import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRetroBridge } from '../scripts/lib/open-data/retro-bridge.mjs'

// Chadwick register rows -> the two id maps (ADR-0100). Pure.

const row = (key_retro, key_mlbam) => ({ key_retro, key_mlbam })

test('maps both ways, ids as strings', () => {
  const { retroToMlbam, mlbamToRetro } = buildRetroBridge([row('griffk002', '112424'), row('bondb001', '111188')])
  assert.equal(retroToMlbam.get('griffk002'), '112424')
  assert.equal(mlbamToRetro.get('111188'), 'bondb001')
  assert.equal(retroToMlbam.size, 2)
})

test('a row missing either id counts as no match and enters neither map', () => {
  const out = buildRetroBridge([row('a1', ''), row('', '5'), row('', ''), row('b1', '7')])
  assert.equal(out.rows, 4)
  assert.equal(out.matched, 1)
  assert.equal(out.noMatch, 3)
  assert.equal(out.retroToMlbam.size, 1)
  assert.equal(out.mlbamToRetro.size, 1)
})

test('a repeated retro id keeps the first row and counts the clash', () => {
  const out = buildRetroBridge([row('a1', '10'), row('a1', '11')])
  assert.equal(out.retroToMlbam.get('a1'), '10')
  assert.equal(out.mlbamToRetro.has('11'), false)
  assert.equal(out.conflicts, 1)
  assert.equal(out.matched, 1)
})

test('a repeated mlbam id keeps the first row and counts the clash', () => {
  const out = buildRetroBridge([row('a1', '10'), row('a2', '10')])
  assert.equal(out.mlbamToRetro.get('10'), 'a1')
  assert.equal(out.retroToMlbam.has('a2'), false)
  assert.equal(out.conflicts, 1)
})
