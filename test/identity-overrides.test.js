// The runtime club-identity overlay: the field catalog, the merge rules, the
// seam that puts an override under a rendered tile, and the endpoint's write
// rule (ADR-0050, issue #726).
//
// The seam tests are the ones worth reading. They assert the thing the whole
// feature rests on — that writing an override changes what a PURE RESOLVER
// answers, with no component, no fetch and no signature change — and that
// clearing it puts the shipped value back. If those two ever stop holding, the
// gear is drawing a form over data it does not actually control.
//
// Every test restores the overlay before it finishes. Module state shared inside
// one file is a real trap, and `node --test` only isolates per FILE.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HEADER_CONTRAST_MIN,
  IDENTITY_DIMENSIONS,
  MLB_TREATMENTS,
  coerceIdentityValue,
  headerTriadRefusal,
  identityFieldId,
  mergeIdentityOverrides,
  parseIdentityFieldId,
  sanitizeIdentityOverrides,
} from '../src/lib/identity/fields.js'
import { applyIdentityOverrides, overridesByStore, teamsInOverrides } from '../src/lib/identity/apply.js'
import { effectiveStore, setIdentityOverrides, setIdentityPreview } from '../src/lib/identity/overlay.js'
import { bundledIdentityStore } from '../src/lib/identity/stores.js'
import {
  MLB_TREATMENT_KEYS,
  MAIN_OVERRIDES,
  treatmentBgColor,
  treatmentHeaderColorOverride,
  treatmentScale,
  treatmentTile,
} from '../src/lib/teams.js'
import { TEAM_COLOR_PAIRS } from '../src/lib/brandColors.js'
import { stampLogoTuning } from '../src/lib/stampLogoTuning.js'
import { identityWriteRefusal } from '../api/identity.js'

const BREWERS = '158'
// A club id no store carries, for the "an override can create an entry" cases.
const SCRATCH = '999999'

function withOverrides(map, run) {
  try {
    setIdentityOverrides(map)
    run()
  } finally {
    setIdentityOverrides({})
    setIdentityPreview({})
  }
}

// --- the catalog -----------------------------------------------------------

test('an id resolves to a store, a team, a key and a field', () => {
  const scale = parseIdentityFieldId('identity.mlbTuning.158.city-connect.scale')
  assert.equal(scale.store, 'mlb-treatment-tuning')
  assert.equal(scale.teamId, '158')
  assert.deepEqual(scale.path, ['158', 'treatments', 'city-connect', 'scale'])

  const primary = parseIdentityFieldId('identity.colors.158.primary')
  assert.equal(primary.store, 'mlb-team-colors')
  assert.deepEqual(primary.path, ['158', 'primary'])

  const onBar = parseIdentityFieldId('identity.mlbHeader.158.main.onBar')
  assert.deepEqual(onBar.path, ['158', 'treatments', 'main', 'header', 'onBar'])

  const offsetY = parseIdentityFieldId('identity.stamp.158.away.offsetY')
  assert.deepEqual(offsetY.path, ['158', 'treatments', 'away', 'offsetY'])

  // The one dimension with no field segment — a treatment has exactly one
  // background — and the one whose store depends on the key.
  const bg = parseIdentityFieldId('identity.tileBg.158.city-connect')
  assert.equal(bg.store, 'city-connect-colors')
  assert.equal(bg.path, null)
  assert.equal(parseIdentityFieldId('identity.tileBg.158.alternate-3').store, 'alt3-colors')
})

test('an id outside the catalog resolves to nothing', () => {
  for (const id of [
    'identity.mlbTuning.158.city-connect.rotation', // not a field of this dimension
    'identity.mlbTuning.158.road.scale', // not a treatment
    'identity.mlbHeader.158.alternate-3.bar', // not one of the two bars a club owns
    'identity.tileBg.158.main', // Main's fill is bgHex, not a swatch store
    'identity.nope.158.main.scale',
    'identity.colors.abc.primary',
    'identity.colors.158.__proto__',
    'identity.colors.158.primary.extra',
    'copy.ballpark.name',
    'identity.colors.158',
    '',
  ]) {
    assert.equal(parseIdentityFieldId(id), null, id)
  }
  assert.equal(parseIdentityFieldId(null), null)
})

test('identityFieldId builds what parseIdentityFieldId reads', () => {
  const id = identityFieldId('mlbTuning', 158, 'city-connect', 'offsetX')
  assert.equal(id, 'identity.mlbTuning.158.city-connect.offsetX')
  assert.equal(parseIdentityFieldId(id).field, 'offsetX')
})

test('the MLB treatment vocabulary here matches teams.js', () => {
  // fields.js keeps a literal copy rather than importing teams.js (that edge
  // would close a cycle — teams.js reads the overlay). This is what stops the
  // copy drifting.
  assert.deepEqual(new Set(MLB_TREATMENTS), MLB_TREATMENT_KEYS)
})

test('a value is coerced to the type its store holds, or refused', () => {
  const scale = IDENTITY_DIMENSIONS.mlbTuning.fields.scale
  assert.equal(coerceIdentityValue(scale, '1.32'), 1.32)
  assert.equal(coerceIdentityValue(scale, ' 1.32 '), 1.32)
  assert.equal(coerceIdentityValue(scale, '9'), undefined, 'out of range')
  assert.equal(coerceIdentityValue(scale, 'big'), undefined)
  assert.equal(coerceIdentityValue(scale, ''), undefined)

  const color = IDENTITY_DIMENSIONS.colors.fields.primary
  assert.equal(coerceIdentityValue(color, '#12284B'), '#12284B')
  assert.equal(coerceIdentityValue(color, '#abc'), '#abc')
  assert.equal(coerceIdentityValue(color, 'rgba(0, 0, 0, 0.16)'), 'rgba(0, 0, 0, 0.16)')
  assert.equal(coerceIdentityValue(color, 'navy'), undefined, 'a keyword is not a colour here')
  assert.equal(coerceIdentityValue(color, 'javascript:alert(1)'), undefined)

  const pick = IDENTITY_DIMENSIONS.colors.fields.offDayTreatment
  assert.equal(coerceIdentityValue(pick, 'alternate-2'), 'alternate-2')
  assert.equal(coerceIdentityValue(pick, 'road'), undefined)

  const originY = IDENTITY_DIMENSIONS.mlbTuning.fields.originY
  assert.equal(coerceIdentityValue(originY, 'top'), 'top')
  assert.equal(coerceIdentityValue(originY, '30%'), '30%')
  assert.equal(coerceIdentityValue(originY, 'sideways'), undefined)
})

test('sanitize keeps only known ids with values their field accepts', () => {
  const clean = sanitizeIdentityOverrides({
    'identity.mlbTuning.158.city-connect.scale': '1.1',
    'identity.mlbTuning.158.city-connect.offsetX': '   ', // blank = no override
    'identity.mlbTuning.158.city-connect.offsetY': 4, // not a string
    'identity.mlbTuning.158.city-connect.originY': 'sideways',
    'identity.stamp.158.away.rotation': '400', // out of range
    'identity.nope.158.main.scale': '1',
  })
  assert.deepEqual(clean, { 'identity.mlbTuning.158.city-connect.scale': '1.1' })
  assert.deepEqual(sanitizeIdentityOverrides(null), {})
  assert.deepEqual(sanitizeIdentityOverrides(['a']), {})
})

test('a patch leaves what it does not name, and an empty value clears', () => {
  const current = {
    'identity.colors.158.primary': '#111111',
    'identity.colors.158.secondary': '#222222',
  }
  const merged = mergeIdentityOverrides(current, {
    'identity.colors.158.primary': '#333333',
    'identity.colors.158.secondary': '',
  })
  assert.deepEqual(merged, { 'identity.colors.158.primary': '#333333' })
})

// --- applying to a store ---------------------------------------------------

test('a store nothing overrides is returned by identity, not copied', () => {
  const bundled = bundledIdentityStore('wpa-tuning')
  assert.equal(applyIdentityOverrides('wpa-tuning', bundled, {}), bundled)
  assert.equal(
    applyIdentityOverrides('wpa-tuning', bundled, { 'identity.colors.158.primary': '#111111' }),
    bundled,
    'an override for another store leaves this one alone',
  )
})

test('applying an override never mutates the bundled JSON', () => {
  const bundled = bundledIdentityStore('mlb-treatment-tuning')
  const before = bundled[BREWERS].treatments['city-connect'].scale
  const next = applyIdentityOverrides('mlb-treatment-tuning', bundled, {
    'identity.mlbTuning.158.city-connect.scale': '1.7',
  })
  assert.equal(next[BREWERS].treatments['city-connect'].scale, 1.7)
  assert.equal(bundled[BREWERS].treatments['city-connect'].scale, before)
  // Copy-on-write per node: an untouched club is the same object, not a clone.
  assert.equal(next['147'], bundled['147'])
})

test('a tile background override replaces the bg swatch, or adds one', () => {
  const bundled = bundledIdentityStore('city-connect-colors')
  const next = applyIdentityOverrides('city-connect-colors', bundled, {
    'identity.tileBg.158.city-connect': '#ABCDEF',
  })
  const swatches = next[BREWERS].swatches
  assert.equal(swatches.find((s) => s.bg).hex, '#ABCDEF')
  assert.equal(swatches.length, bundled[BREWERS].swatches.length, 'the other swatches survive')
  assert.equal(swatches.find((s) => s.label === 'Primary').hex, '#0C436A')

  const fresh = applyIdentityOverrides('city-connect-colors', bundled, {
    [`identity.tileBg.${SCRATCH}.city-connect`]: '#123456',
  })
  assert.deepEqual(fresh[SCRATCH].swatches, [{ label: 'Background', hex: '#123456', bg: true }])
})

test('overridesByStore and teamsInOverrides split a map the way the endpoint needs', () => {
  const map = {
    'identity.mlbTuning.158.main.scale': '1.1',
    'identity.colors.147.primary': '#111111',
  }
  assert.deepEqual(Object.keys(overridesByStore(map)).sort(), ['mlb-team-colors', 'mlb-treatment-tuning'])
  assert.deepEqual([...teamsInOverrides(map)].sort(), ['147', '158'])
})

// --- the seam --------------------------------------------------------------

test('an override changes what a pure tile resolver answers, and clearing restores it', () => {
  const shipped = treatmentScale(158, 'city-connect')
  assert.equal(shipped, 0.87, 'fixture assumption: the Brewers ship a City Connect scale')

  withOverrides({ 'identity.mlbTuning.158.city-connect.scale': '1.7' }, () => {
    assert.equal(treatmentScale(158, 'city-connect'), 1.7)
    assert.equal(treatmentTile(158, 'city-connect').scale, 1.7, 'the tile every surface renders')
  })

  assert.equal(treatmentScale(158, 'city-connect'), shipped)
})

test('an override reaches a derived table that was built at module load', () => {
  // MAIN_OVERRIDES is an `export const` assembled once when teams.js evaluated.
  // It refills in place, which is what lets every existing call site stay as it
  // was — see identity/overlay.js's liveTable.
  const shipped = MAIN_OVERRIDES[BREWERS].bgHex
  assert.equal(shipped, '#F3ECD8', 'fixture assumption: the Brewers ship a Main tile fill')
  withOverrides({ 'identity.mlbTuning.158.main.bgHex': '#101010' }, () => {
    assert.equal(MAIN_OVERRIDES[BREWERS].bgHex, '#101010')
  })
  assert.equal(MAIN_OVERRIDES[BREWERS].bgHex, shipped)
})

test('an override reaches the header triad, the tile background, the brand pair and a stamp', () => {
  withOverrides(
    {
      'identity.mlbHeader.158.main.onBar': '#FFFFFF',
      'identity.tileBg.158.city-connect': '#ABCDEF',
      'identity.colors.158.primary': '#010203',
      'identity.stamp.158.away.offsetY': '-12',
    },
    () => {
      assert.equal(treatmentHeaderColorOverride(158, 'main').onBar, '#FFFFFF')
      assert.equal(treatmentHeaderColorOverride(158, 'main').bar, '#12284B', 'the rest of the triad still ships')
      assert.equal(treatmentBgColor(158, 'city-connect'), '#ABCDEF')
      assert.equal(TEAM_COLOR_PAIRS[BREWERS][0], '#010203')
      assert.equal(stampLogoTuning(158, 'away').offsetY, -12)
    },
  )
  assert.equal(treatmentBgColor(158, 'city-connect'), '#ff6c58')
  assert.equal(TEAM_COLOR_PAIRS[BREWERS][0], '#12284B')
  assert.equal(stampLogoTuning(158, 'away').offsetY, 9)
})

test('the draft preview layer paints but is never an override', () => {
  try {
    setIdentityPreview({ 'identity.mlbTuning.158.city-connect.scale': '2.2' })
    assert.equal(treatmentScale(158, 'city-connect'), 2.2)
    setIdentityPreview({})
    assert.equal(treatmentScale(158, 'city-connect'), 0.87)
  } finally {
    setIdentityPreview({})
  }
})

test('effectiveStore is memoized per overlay version', () => {
  const bundled = bundledIdentityStore('mlb-treatment-tuning')
  assert.equal(effectiveStore(bundled), bundled, 'no overrides -> the bundled object itself')
  withOverrides({ 'identity.mlbTuning.158.main.scale': '1.05' }, () => {
    const once = effectiveStore(bundled)
    assert.notEqual(once, bundled)
    assert.equal(effectiveStore(bundled), once, 'same version, same object')
  })
})

// --- the endpoint's write rule ---------------------------------------------

test('a save that clears a header triad below AA is refused, by the same number lint asserts', () => {
  // #7A8B99 on #12284B is ~3.5:1 — the plausible-looking pair the browser check
  // and this one both exist to catch.
  const refusal = identityWriteRefusal({ 'identity.mlbHeader.158.main.onBar': '#7A8B99' })
  assert.match(refusal, /mlbHeader 158 main/)
  assert.match(refusal, new RegExp(String(HEADER_CONTRAST_MIN)))
  assert.equal(identityWriteRefusal({ 'identity.mlbHeader.158.main.onBar': '#FFFFFF' }), null)
})

test('the contrast gate judges the EFFECTIVE triad, not the patch', () => {
  // Overriding only the bar, to one the shipped ink cannot be read on, must be
  // refused — which is only knowable by reading what ships.
  assert.ok(identityWriteRefusal({ 'identity.mlbHeader.158.main.bar': '#F2F2F2' }))
  // A half-written triad on a club with no header at all is not a failure; the
  // resolver answers null and the club keeps default navy chrome.
  assert.equal(headerTriadRefusal({ bar: '#12284B' }), null)
  assert.equal(headerTriadRefusal(null), null)
})

test('a save is validated by the dev-save validator, so both write paths agree', () => {
  // A stamp placement inside this catalog's range is inside the store's range —
  // the two are restated in two places and must not drift.
  assert.equal(identityWriteRefusal({ 'identity.stamp.158.away.rotation': '45' }), null)
  // A value the catalog would refuse cannot reach the store validator at all,
  // because it is dropped one layer earlier.
  assert.deepEqual(sanitizeIdentityOverrides({ 'identity.stamp.158.away.rotation': '120' }), {})
})

test('a well-formed save is accepted across every dimension', () => {
  assert.equal(
    identityWriteRefusal({
      'identity.mlbTuning.158.city-connect.scale': '1.4',
      'identity.milbTuning.235.home.offsetX': '-3',
      'identity.milbHeader.235.away.bar': '#12284B',
      'identity.milbHeader.235.away.onBar': '#FFFFFF',
      'identity.tileBg.158.alternate': '#123456',
      'identity.colors.158.accent': '#FFC52F',
      'identity.colors.158.defaultHomeTreatment': 'city-connect',
      'identity.stamp.158.home.scale': '1.1',
      'identity.wpa.158.bandColor': '#0C436A',
    }),
    null,
  )
})
