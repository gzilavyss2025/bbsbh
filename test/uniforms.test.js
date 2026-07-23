// Coverage for src/api/uniforms.js's pure text helpers — classifyUniformAsset
// in particular, since PR #343 gave it a JERSEY_TREATMENT_OVERRIDES table
// (moved out of TeamColorLab.jsx) that both this module's own callers and the
// nightly gen-jerseys.mjs precompute now share, so a game whose jersey naming
// doesn't match its actual on-field logo (e.g. a club's "Away Grey" paired
// with the Alternate mark, not Main) classifies the same way everywhere.
import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyUniformAsset, uniformSummary, jerseyLabel } from '../src/api/uniforms.js'

// --------------------------------------------------------------------------
// classifyUniformAsset
// --------------------------------------------------------------------------
test('classifyUniformAsset uses the naming convention when no override code matches', () => {
  assert.equal(classifyUniformAsset('Brewers City Connect', 'Brewers'), 'city-connect')
  assert.equal(classifyUniformAsset('Brewers Home White', 'Brewers'), 'main')
  assert.equal(classifyUniformAsset('Brewers Away Grey', 'Brewers'), 'main')
  assert.equal(classifyUniformAsset('Brewers Alt 2 Navy Blue', 'Brewers'), 'alternate')
})

test('classifyUniformAsset defers to JERSEY_TREATMENT_OVERRIDES when the code matches, even against the naming convention', () => {
  // Mariners "Home White" would classify as 'main' by name alone, but it's
  // actually worn with the Alternate mark this season.
  assert.equal(
    classifyUniformAsset('Mariners Home White', 'Mariners', '136_jersey_1_2026'),
    'alternate',
  )
  // Marlins "Alt 2 Teal" would classify as plain 'alternate' by name alone,
  // but it's worn with the Alternate 3 mark.
  assert.equal(
    classifyUniformAsset('Marlins Alt 2 Teal', 'Marlins', '146_jersey_4_2026'),
    'alternate-3',
  )
})

test('classifyUniformAsset falls back to the naming convention for an unrecognized code', () => {
  assert.equal(classifyUniformAsset('Marlins Alt 2 Teal', 'Marlins', 'not_a_real_code'), 'alternate')
})

// --------------------------------------------------------------------------
// uniformSummary / jerseyLabel — smoke coverage, unchanged by PR #343 but
// previously untested in this file.
// --------------------------------------------------------------------------
test('uniformSummary strips the club name and stamps tonight\'s side on a non-standard jersey', () => {
  const assets = [{ text: 'Brewers Alt 2 Navy Blue Jersey', piece: 'J' }]
  assert.equal(uniformSummary(assets, 'home', 'Brewers'), 'Home Alternate Navy Blue')
})

test('jerseyLabel drops the club name and the redundant Jersey noun', () => {
  assert.equal(jerseyLabel('Brewers Alt 2 Navy Blue Jersey', 'Brewers'), 'Alt 2 Navy Blue')
})
