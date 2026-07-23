// Coverage for src/api/uniforms.js's pure text helpers — classifyUniformAsset
// in particular, since PR #343 gave it a JERSEY_TREATMENT_OVERRIDES table
// (moved out of TeamColorLab.jsx) that both this module's own callers and the
// nightly gen-jerseys.mjs precompute now share, so a game whose jersey naming
// doesn't match its actual on-field logo (e.g. a club's "Away Grey" paired
// with the Alternate mark, not Main) classifies the same way everywhere.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyUniformAsset,
  uniformSummary,
  jerseyLabel,
  uniformFriendlyName,
  formatUniformName,
  uniformDisplayName,
  fetchUniformNameOverrides,
  primeUniformNameOverridesCache,
} from '../src/api/uniforms.js'

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

// --------------------------------------------------------------------------
// uniformFriendlyName — the Level 1/2/3 breakdown (Home/Away/City Connect,
// or Alternate + a derived/curated specific name)
// --------------------------------------------------------------------------
test('uniformFriendlyName names a standard home/away jersey at Level 1 only, from its own text', () => {
  assert.deepEqual(uniformFriendlyName('Brewers Home Cream Jersey', 'Brewers', null), {
    level1: 'Home',
    level2: null,
    level3: null,
  })
  assert.deepEqual(uniformFriendlyName('Brewers Road Powder Blue Jersey', 'Brewers', null), {
    level1: 'Away',
    level2: null,
    level3: null,
  })
})

test('uniformFriendlyName names City Connect at Level 1 only', () => {
  assert.deepEqual(uniformFriendlyName('Brewers City Connect 2.0 Jersey', 'Brewers', null), {
    level1: 'City Connect',
    level2: null,
    level3: null,
  })
})

test('uniformFriendlyName names an override-forced main jersey Home when its text carries no side', () => {
  // Braves "Alt 2 Navy" is worn with the plain Main mark (JERSEY_TREATMENT_OVERRIDES),
  // but its own label never says Home/Away/Road — an "Alt N" jersey is never a road jersey.
  assert.deepEqual(uniformFriendlyName('Braves Alt 2 Navy', 'Braves', '144_jersey_4_2026'), {
    level1: 'Home',
    level2: null,
    level3: null,
  })
})

test('uniformFriendlyName derives a Level 3 name for an alternate from its own label', () => {
  assert.deepEqual(uniformFriendlyName('Brewers Alt 2 Navy Blue Jersey', 'Brewers', null), {
    level1: null,
    level2: 'Alternate',
    level3: 'Navy Blue',
  })
  assert.deepEqual(uniformFriendlyName('Brewers Alt 1 Pinstripe Jersey', 'Brewers', null), {
    level1: null,
    level2: 'Alternate',
    level3: 'Pinstripe',
  })
  assert.deepEqual(uniformFriendlyName('Blue Jays Alt 4 Canada Red Jersey', 'Blue Jays', null), {
    level1: null,
    level2: 'Alternate',
    level3: 'Canada Red',
  })
})

test('uniformFriendlyName still derives a Level 3 name for an override-driven alternate', () => {
  // Mariners "Home White" classifies as 'alternate' via JERSEY_TREATMENT_OVERRIDES
  // even though the raw text reads like a standard home jersey.
  assert.deepEqual(uniformFriendlyName('Mariners Home White', 'Mariners', '136_jersey_1_2026'), {
    level1: null,
    level2: 'Alternate',
    level3: 'White',
  })
})

// --------------------------------------------------------------------------
// formatUniformName / uniformDisplayName — the flattened full-line name and
// the curated override that can replace it outright, per jersey.
// --------------------------------------------------------------------------
test('formatUniformName flattens each Level 1/2/3 shape to one line', () => {
  assert.equal(formatUniformName({ level1: 'Home', level2: null, level3: null }), 'Home')
  assert.equal(
    formatUniformName({ level1: null, level2: 'Alternate', level3: 'Navy Blue' }),
    'Alternate: Navy Blue',
  )
})

test('uniformDisplayName falls back to the derived default with no curated entry', () => {
  assert.equal(uniformDisplayName('Brewers Home Cream Jersey', 'Brewers', null, {}), 'Home')
  assert.equal(
    uniformDisplayName('Brewers Alt 1 Pinstripe Jersey', 'Brewers', '158_jersey_3_2026', {}),
    'Alternate: Pinstripe',
  )
})

test('uniformDisplayName prefers a curated full name over the derived default, for any jersey', () => {
  const overrides = {
    '158_jersey_1_2026': 'Home Cream',
    '158_jersey_3_2026': 'Glove Barrel Pinstripe',
  }
  // Even a standard Home/Away jersey (Level 1 only) can be overwritten outright.
  assert.equal(
    uniformDisplayName('Brewers Home Cream Jersey', 'Brewers', '158_jersey_1_2026', overrides),
    'Home Cream',
  )
  assert.equal(
    uniformDisplayName('Brewers Alt 1 Pinstripe Jersey', 'Brewers', '158_jersey_3_2026', overrides),
    'Glove Barrel Pinstripe',
  )
})

test('uniformDisplayName ignores overrides for a code with no matching entry', () => {
  const overrides = { some_other_code: 'Whatever' }
  assert.equal(
    uniformDisplayName('Brewers Alt 1 Pinstripe Jersey', 'Brewers', '158_jersey_3_2026', overrides),
    'Alternate: Pinstripe',
  )
})

// --------------------------------------------------------------------------
// primeUniformNameOverridesCache — keeps fetchUniformNameOverrides' module
// cache in step with a just-saved map (see UniformNamesPage.jsx's handleSave),
// instead of it silently continuing to serve whatever it cached on first load
// for the rest of the session.
// --------------------------------------------------------------------------
test('primeUniformNameOverridesCache makes fetchUniformNameOverrides return the primed value without refetching', async () => {
  const primed = { '158_jersey_1_2026': 'Home Creams' }
  primeUniformNameOverridesCache(primed)
  assert.deepEqual(await fetchUniformNameOverrides(), primed)
})
