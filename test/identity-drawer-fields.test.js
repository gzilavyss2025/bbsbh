// The identity drawer's field model (issue #726, ADR-0050) — which tiles a club
// offers, which store each row actually writes into, and what a row reports as
// landed.
//
// Worth pinning because the drawer is admin-only, so nobody will trip over a
// wrong answer here in normal use: a row filed under a key no resolver reads
// would save cleanly, report success, and change nothing.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  barKeyFor,
  identityDraftRefusal,
  identityGroups,
  identityIdsForClub,
  treatmentsForClub,
} from '../src/screens/team/modules/identity/identityFields.js'
import { parseIdentityFieldId } from '../src/lib/identity/fields.js'
import { setIdentityOverrides, setIdentityPreview } from '../src/lib/identity/overlay.js'

const BREWERS = 158
const MEMPHIS = 235 // a Triple-A affiliate, for the MiLB half

const groupBy = (groups, key) => groups.find((g) => g.key === key)
const fieldNamed = (group, name) => group.fields.find((f) => f.name === name)

test('a club offers the tiles it actually has, and no more', () => {
  const mlb = treatmentsForClub(BREWERS, false)
  assert.deepEqual(mlb.slice(0, 2), ['main', 'alternate'])
  assert.ok(mlb.includes('city-connect'))
  // Alternate 2/3/4 are opt-in per club; a club without one gets no tile rather
  // than a control that can only write a record nothing reads.
  assert.ok(mlb.length < 6 || mlb.includes('alternate-4'))
  assert.deepEqual(treatmentsForClub(MEMPHIS, true), ['home', 'away'])
})

test('every treatment but City Connect edits the club shared Main bar', () => {
  assert.equal(barKeyFor('alternate-3', false), 'main')
  assert.equal(barKeyFor('city-connect', false), 'city-connect')
  assert.equal(barKeyFor('away', true), 'away')
})

test('a non-Main tile fill writes to that treatment own swatch store', () => {
  const tile = groupBy(identityGroups(BREWERS, { isMilb: false, treatment: 'city-connect' }), 'tile')
  const fill = fieldNamed(tile, 'tileBg')
  assert.equal(parseIdentityFieldId(fill.id).store, 'city-connect-colors')
  assert.equal(fill.landed, '#ff6c58', 'the landed value is what the page renders today')
  assert.equal(fieldNamed(tile, 'scale').landed, '0.87')
})

test('Main fill is bgHex on the tuning store, not a swatch', () => {
  const tile = groupBy(identityGroups(BREWERS, { isMilb: false, treatment: 'main' }), 'tile')
  assert.equal(fieldNamed(tile, 'tileBg'), undefined)
  assert.equal(parseIdentityFieldId(fieldNamed(tile, 'bgHex').id).store, 'mlb-treatment-tuning')
})

test('the bar group edits the record treatmentHeaderColorOverride reads', () => {
  const bar = groupBy(identityGroups(BREWERS, { isMilb: false, treatment: 'alternate' }), 'bar')
  assert.equal(bar.triad, true)
  assert.equal(bar.title, 'Main bar', 'an alternate jersey wears the club shared Main bar')
  assert.equal(fieldNamed(bar, 'bar').landed, '#12284B')
  assert.deepEqual(parseIdentityFieldId(fieldNamed(bar, 'onBar').id).path, [
    '158',
    'treatments',
    'main',
    'header',
    'onBar',
  ])
})

test('the stamp group carries its retroactive warning and both sides', () => {
  const stamp = groupBy(identityGroups(BREWERS, { isMilb: false, treatment: 'main' }), 'stamp')
  assert.match(stamp.warning, /already placed in a Game Log/)
  assert.equal(stamp.fields.length, 8, 'four fields per side')
  assert.ok(stamp.fields.some((f) => f.label === 'Away nudge down'))
})

test('every tile carries a logo group whose row writes the logo-url store', () => {
  const logo = groupBy(identityGroups(BREWERS, { isMilb: false, treatment: 'city-connect' }), 'logo')
  assert.equal(logo.logo, true, 'the drawer renders this group with the upload control')
  const [field] = logo.fields
  const parsed = parseIdentityFieldId(field.id)
  assert.equal(parsed.store, 'logo-url-overrides')
  assert.equal(parsed.key, 'city-connect')
  assert.ok(field.landed, 'the placeholder names the art the tile resolves today')

  const away = groupBy(identityGroups(MEMPHIS, { isMilb: true, treatment: 'away' }), 'logo')
  assert.equal(parseIdentityFieldId(away.fields[0].id).key, 'away')
})

test('an affiliate gets no club-colours group', () => {
  const groups = identityGroups(MEMPHIS, { isMilb: true, treatment: 'home' })
  assert.equal(groupBy(groups, 'club'), undefined)
  assert.deepEqual(parseIdentityFieldId(fieldNamed(groupBy(groups, 'tile'), 'scale').id).path, [
    '235',
    'treatments',
    'home',
    'position',
    'scale',
  ])
})

test('every id the drawer can write is one the catalog names', () => {
  const ids = identityIdsForClub(BREWERS, false)
  assert.ok(ids.length > 20)
  for (const id of ids) {
    assert.ok(parseIdentityFieldId(id), id)
    assert.equal(parseIdentityFieldId(id).teamId, '158')
  }
  // The same club twice must not grow the list — the strip walks every
  // treatment, and the club/stamp/band groups repeat across all of them.
  assert.equal(new Set(ids).size, ids.length)
})

test('the browser-side gate refuses a draft bar nobody could read text on', () => {
  assert.equal(identityDraftRefusal(BREWERS, false), null)
  try {
    setIdentityPreview({ 'identity.mlbHeader.158.main.onBar': '#7A8B99' })
    const refusal = identityDraftRefusal(BREWERS, false)
    assert.match(refusal, /^Main bar: /)
    assert.match(refusal, /4\.5:1/)
  } finally {
    setIdentityPreview({})
    setIdentityOverrides({})
  }
})
