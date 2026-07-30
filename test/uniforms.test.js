// Coverage for src/api/uniforms.js's pure text helpers — classifyUniformAsset
// in particular, since PR #343 gave it a JERSEY_TREATMENT_OVERRIDES table
// (moved out of the Team Identity Lab) that both this module's own callers and the
// nightly gen-jerseys.mjs precompute now share, so a game whose jersey naming
// doesn't match its actual on-field logo (e.g. a club's "Away Grey" paired
// with the Alternate mark, not Main) classifies the same way everywhere.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyUniformAsset,
  liveJerseyTreatment,
  liveTreatmentFor,
  uniformSummary,
  jerseyLabel,
  uniformFriendlyName,
  formatUniformName,
  uniformDisplayName,
  fetchUniformNameOverrides,
  primeUniformNameOverridesCache,
  uniformNamesSaveBody,
  uniformNameOverridesLoaded,
  buildJerseyCombos,
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
// liveJerseyTreatment — classifies a fetchGameUniforms side the moment
// statsapi posts it, same-day, instead of waiting for the next nightly
// gen-jerseys.mjs run.
// --------------------------------------------------------------------------
test('liveJerseyTreatment classifies the jersey-piece asset by the naming convention', () => {
  const assets = [
    { text: 'Brewers Alt 2 Navy Blue Jersey', piece: 'J', code: null },
    { text: 'Brewers Road Grey Pants', piece: 'P', code: null },
  ]
  assert.equal(liveJerseyTreatment(assets, 'Brewers'), 'alternate')
})

test('liveJerseyTreatment defers to JERSEY_TREATMENT_OVERRIDES via the jersey asset\'s own code', () => {
  const assets = [
    { text: 'Mariners Home White Jersey', piece: 'J', code: '136_jersey_1_2026' },
    { text: 'Mariners Home Grey Pants', piece: 'P', code: null },
  ]
  assert.equal(liveJerseyTreatment(assets, 'Mariners'), 'alternate')
})

test('liveJerseyTreatment returns null before the side has posted or with no jersey-piece asset', () => {
  assert.equal(liveJerseyTreatment(null, 'Brewers'), null)
  assert.equal(liveJerseyTreatment([], 'Brewers'), null)
  assert.equal(
    liveJerseyTreatment([{ text: 'Brewers Road Grey Pants', piece: 'P', code: null }], 'Brewers'),
    null,
  )
})

// --------------------------------------------------------------------------
// liveTreatmentFor — same classification as liveJerseyTreatment, keyed for a
// fetchGameJerseys batch (GameCard's slate-wide live lookup) instead of a
// single fetchGameUniforms side.
// --------------------------------------------------------------------------
test('liveTreatmentFor classifies the batched jersey by the naming convention', () => {
  const gameJerseys = {
    662001: { 109: { code: null, text: 'Diamondbacks Alt 2 Sedona Red Jersey' } },
  }
  assert.equal(liveTreatmentFor(gameJerseys, 662001, 109, 'Diamondbacks'), 'alternate')
})

test('liveTreatmentFor defers to JERSEY_TREATMENT_OVERRIDES via the jersey asset\'s own code', () => {
  const gameJerseys = {
    662002: { 136: { code: '136_jersey_1_2026', text: 'Mariners Home White Jersey' } },
  }
  assert.equal(liveTreatmentFor(gameJerseys, 662002, 136, 'Mariners'), 'alternate')
})

test('liveTreatmentFor returns null for a missing game, missing team, or unposted assignment', () => {
  assert.equal(liveTreatmentFor(null, 662001, 109, 'Diamondbacks'), null)
  assert.equal(liveTreatmentFor({}, 662001, 109, 'Diamondbacks'), null)
  assert.equal(
    liveTreatmentFor({ 662001: { 158: { code: null, text: 'Brewers Home White Jersey' } } }, 662001, 109, 'Diamondbacks'),
    null,
  )
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

// --------------------------------------------------------------------------
// uniformNamesSaveBody — the guard between an editor's in-progress state and a
// whole-file overwrite of public/data/uniform-names.json.
//
// Both writers (UniformNamesPage.jsx and the Team Identity Lab) POST the WHOLE
// map, so anything they don't send is deleted. Both seed their saved-map state
// to `{}` and fill it from a Promise.all that ALSO fetches the live uniforms
// catalog off statsapi — so when that catalog fetch fails (offline, statsapi
// down, a sandbox with no egress), the names never load, the state stays `{}`,
// and Save writes `{}` over every curated name on disk.
//
// `{}` is itself a legitimate map (everything cleared), so the dev-save
// validator can't tell the two apart. The distinction only exists here: an
// editor that never read the file has nothing to say about its contents.
// --------------------------------------------------------------------------
test('a save body is refused outright when the saved map never loaded', () => {
  // The exact shape of the bug: the catalog fetch rejected, so nothing loaded
  // and the editor is sitting on its initial empty state.
  assert.equal(uniformNamesSaveBody({}, {}, { loaded: false }), null)
  // Even with edits in hand — writing them would delete every name never read.
  assert.equal(uniformNamesSaveBody({}, { '158_jersey_1_2026': 'Home Creams' }, { loaded: false }), null)
})

test('a save body is refused when nothing was actually edited', () => {
  const saved = { '158_jersey_1_2026': 'Home Whites' }
  assert.equal(uniformNamesSaveBody(saved, {}, { loaded: true }), null)
  // Whitespace-only text is an empty box, not an edit.
  assert.equal(uniformNamesSaveBody(saved, { '158_jersey_2_2026': '   ' }, { loaded: true }), null)
})

test("a loaded map merges this session's edits over every untouched name", () => {
  const saved = { '158_jersey_1_2026': 'Home Whites', '158_jersey_2_2026': 'Away Greys' }
  assert.deepEqual(uniformNamesSaveBody(saved, { '158_jersey_1_2026': '  Home Creams  ' }, { loaded: true }), {
    '158_jersey_1_2026': 'Home Creams',
    '158_jersey_2_2026': 'Away Greys',
  })
  assert.deepEqual(
    saved,
    { '158_jersey_1_2026': 'Home Whites', '158_jersey_2_2026': 'Away Greys' },
    'the caller\'s saved map is not mutated',
  )
})

// Clearing one box is a real edit that must land — the one case where the body
// legitimately drops an entry. It stays distinguishable from the never-loaded
// case because the rest of the map is still there.
test('clearing one name drops just that entry and keeps the rest', () => {
  const saved = { '158_jersey_1_2026': 'Home Whites', '158_jersey_2_2026': 'Away Greys' }
  assert.deepEqual(uniformNamesSaveBody(saved, { '158_jersey_1_2026': '' }, { loaded: true }), {
    '158_jersey_2_2026': 'Away Greys',
  })
})

test('clearing the only curated name yields an empty map, not a refusal', () => {
  // `{}` from a LOADED editor is a legitimate write — the guard is about
  // provenance, not about the value happening to be empty.
  assert.deepEqual(
    uniformNamesSaveBody({ '158_jersey_1_2026': 'X' }, { '158_jersey_1_2026': '' }, { loaded: true }),
    {},
  )
})

// --------------------------------------------------------------------------
// uniformNameOverridesLoaded — what feeds the `loaded` flag above.
//
// fetchUniformNameOverrides degrades to `{}` on ANY failure and caches it,
// which is right for render consumers (fall back to the derived default) and
// useless for a writer: it can't tell "no curation yet" from "the fetch blew
// up". This reports which one happened.
// --------------------------------------------------------------------------
test('a primed cache counts as loaded, so a save right after one can proceed', () => {
  primeUniformNameOverridesCache({ '158_jersey_1_2026': 'Home Creams' })
  assert.equal(uniformNameOverridesLoaded(), true)
})

// --------------------------------------------------------------------------
// buildJerseyCombos — the Team Page's record-by-jersey strip. One entry per
// catalog jersey, carrying its logo treatment + the club's W-L in games it
// wore it (joined by uniformAssetCode against the per-game worn assets).
// --------------------------------------------------------------------------
const BREWERS = 158
const CATALOG = [
  { text: 'Brewers Home White Jersey', piece: 'J', code: '158_jersey_1_2026' },
  { text: 'Brewers Road Powder Blue Jersey', piece: 'J', code: '158_jersey_2_2026' },
  { text: 'Brewers Alt 1 Pinstripe Jersey', piece: 'J', code: '158_jersey_3_2026' },
  // A non-jersey piece the builder must ignore.
  { text: 'Brewers Road Grey Pants', piece: 'P', code: '158_pants_1_2026' },
]

test('buildJerseyCombos makes one entry per catalog jersey, tagged with its treatment', () => {
  const combos = buildJerseyCombos({
    catalogAssets: CATALOG,
    clubName: 'Brewers',
    schedule: [],
    wornByGame: {},
    teamId: BREWERS,
  })
  assert.equal(combos.length, 3) // the pants piece is dropped
  const home = combos.find((c) => c.code === '158_jersey_1_2026')
  const alt = combos.find((c) => c.code === '158_jersey_3_2026')
  assert.equal(home.treatment, 'main')
  assert.equal(alt.treatment, 'alternate')
  // No games seen yet → a clean 0-0 the UI shows as "—".
  assert.deepEqual({ w: home.wins, l: home.losses }, { w: 0, l: 0 })
})

test('buildJerseyCombos tallies W-L per jersey, joining worn assets by code', () => {
  const schedule = [
    { gamePk: 1, won: true },
    { gamePk: 2, won: false },
    { gamePk: 3, won: true },
    { gamePk: 4, won: null }, // result not visible yet — never counted
  ]
  const wornByGame = {
    1: { [BREWERS]: { code: '158_jersey_1_2026' } }, // Home, win
    2: { [BREWERS]: { code: '158_jersey_1_2026' } }, // Home, loss
    3: { [BREWERS]: { code: '158_jersey_3_2026' } }, // Alt, win
    4: { [BREWERS]: { code: '158_jersey_3_2026' } }, // gated out by won:null
  }
  const combos = buildJerseyCombos({
    catalogAssets: CATALOG,
    clubName: 'Brewers',
    schedule,
    wornByGame,
    teamId: BREWERS,
  })
  const home = combos.find((c) => c.code === '158_jersey_1_2026')
  const alt = combos.find((c) => c.code === '158_jersey_3_2026')
  assert.deepEqual({ w: home.wins, l: home.losses }, { w: 1, l: 1 })
  assert.deepEqual({ w: alt.wins, l: alt.losses }, { w: 1, l: 0 }) // game 4 excluded
})

test('buildJerseyCombos ignores a worn jersey for the other team and an unknown code', () => {
  const schedule = [
    { gamePk: 1, won: true },
    { gamePk: 2, won: true },
  ]
  const wornByGame = {
    1: { 999: { code: '158_jersey_1_2026' } }, // wrong teamId — not this club
    2: { [BREWERS]: { code: 'not_in_catalog' } }, // code we don't have a card for
  }
  const combos = buildJerseyCombos({
    catalogAssets: CATALOG,
    clubName: 'Brewers',
    schedule,
    wornByGame,
    teamId: BREWERS,
  })
  assert.ok(combos.every((c) => c.wins === 0 && c.losses === 0))
})

test('buildJerseyCombos orders Main before alternates and returns [] for an empty catalog', () => {
  const combos = buildJerseyCombos({
    catalogAssets: CATALOG,
    clubName: 'Brewers',
    schedule: [],
    wornByGame: {},
    teamId: BREWERS,
  })
  assert.deepEqual(
    combos.map((c) => c.treatment),
    ['main', 'alternate', 'alternate-3'],
  )
  assert.deepEqual(
    buildJerseyCombos({ catalogAssets: [], clubName: 'Brewers', schedule: [], wornByGame: {}, teamId: BREWERS }),
    [],
  )
})
