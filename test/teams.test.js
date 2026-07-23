// Coverage for the jersey-logo-variant lookups in src/lib/teams.js:
// localLogoUrl, teamLogoUrl's alternate/city-connect routing, and the
// treatmentBgColor/treatmentScale readers PR #339 pulled out of
// TeamColorLab.jsx so the home-page game cards could share them. PR #343
// added hasAlternate2/hasAlternate3/hasCityConnect, the Main-tile
// mainTreatment* readers, and treatmentPinstripeColor — covered below.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  localLogoUrl,
  teamLogoUrl,
  treatmentBgColor,
  treatmentScale,
  treatmentPinstripeColor,
  hasAlternate2,
  hasAlternate3,
  hasCityConnect,
  mainTreatmentTint,
  mainTreatmentScale,
  mainTreatmentPinstripe,
  mainTreatmentPinstripeColor,
  mainTreatmentRecolor,
  mainOverrideLogoUrl,
} from '../src/lib/teams.js'

// --------------------------------------------------------------------------
// localLogoUrl
// --------------------------------------------------------------------------
test('localLogoUrl builds a curated-art path from the team abbreviation', () => {
  assert.equal(localLogoUrl(158, 'alternate'), '/team-logos/alternate/MIL.png')
  assert.equal(localLogoUrl(158, 'city-connect'), '/team-logos/city-connect/MIL.png')
})

test('localLogoUrl uses .svg only for the ALT_LOGO_SVG teams, and only on alternate', () => {
  assert.equal(localLogoUrl(118, 'alternate'), '/team-logos/alternate/KC.svg') // Royals
  assert.equal(localLogoUrl(118, 'city-connect'), '/team-logos/city-connect/KC.png') // svg only applies to alternate
})

test('localLogoUrl returns null for a team with no known abbreviation', () => {
  assert.equal(localLogoUrl(999999, 'alternate'), null)
})

// --------------------------------------------------------------------------
// teamLogoUrl
// --------------------------------------------------------------------------
test('teamLogoUrl routes alternate/city-connect to the curated local asset', () => {
  assert.equal(teamLogoUrl(158, 'alternate'), localLogoUrl(158, 'alternate'))
  assert.equal(teamLogoUrl(158, 'city-connect'), localLogoUrl(158, 'city-connect'))
})

test('teamLogoUrl returns null without a teamId, even for alternate/city-connect', () => {
  assert.equal(teamLogoUrl(null, 'alternate'), null)
})

test('teamLogoUrl routes alternate-2/alternate-3 to the curated local asset', () => {
  assert.equal(teamLogoUrl(158, 'alternate-2'), localLogoUrl(158, 'alternate-2')) // Brewers
  assert.equal(teamLogoUrl(146, 'alternate-3'), localLogoUrl(146, 'alternate-3')) // Marlins
})

test('teamLogoUrl falls back to the plain CDN base logo for an ALT_USES_BASE_LOGO team', () => {
  assert.equal(teamLogoUrl(133, 'alternate'), 'https://www.mlbstatic.com/team-logos/133.svg') // Athletics
  assert.equal(teamLogoUrl(108, 'alternate'), 'https://www.mlbstatic.com/team-logos/108.svg') // Angels
})

test('teamLogoUrl falls back to the plain CDN base logo for an ALT2_USES_BASE_LOGO team', () => {
  assert.equal(teamLogoUrl(118, 'alternate-2'), 'https://www.mlbstatic.com/team-logos/118.svg') // Royals
})

test('teamLogoUrl routes main-recolor to the hand-edited Main override asset', () => {
  assert.equal(teamLogoUrl(114, 'main-recolor'), mainOverrideLogoUrl(114)) // Guardians
})

// --------------------------------------------------------------------------
// treatmentBgColor
// --------------------------------------------------------------------------
test('treatmentBgColor returns the bg:true hex for a curated team/treatment', () => {
  assert.equal(treatmentBgColor(109, 'alternate'), '#A71930') // Diamondbacks
  assert.equal(treatmentBgColor(158, 'city-connect'), '#0C436A') // Brewers
})

test('treatmentBgColor returns null for a team with no curated background yet', () => {
  assert.equal(treatmentBgColor(116, 'alternate'), null) // Tigers — no ALT_COLORS entry
})

test('treatmentBgColor returns null for a pinstriped tile with no flat bg swatch', () => {
  assert.equal(treatmentBgColor(158, 'alternate'), null) // Brewers Alternate is pinstriped, not a flat swatch
})

test('treatmentBgColor returns null for main/base, even for a team with alt colors curated', () => {
  assert.equal(treatmentBgColor(158, 'main'), null)
  assert.equal(treatmentBgColor(158, 'base'), null)
})

// --------------------------------------------------------------------------
// treatmentScale
// --------------------------------------------------------------------------
test('treatmentScale returns a curated per-team/treatment override', () => {
  assert.equal(treatmentScale(139, 'alternate'), 1.6) // Rays
  assert.equal(treatmentScale(113, 'city-connect'), 0.75) // Reds
})

test('treatmentScale defaults to 1 for an uncurated team or treatment', () => {
  assert.equal(treatmentScale(158, 'city-connect'), 1) // Brewers has no city-connect override
  assert.equal(treatmentScale(139, 'city-connect'), 1) // Rays has no city-connect override
})

// --------------------------------------------------------------------------
// treatmentPinstripeColor
// --------------------------------------------------------------------------
test('treatmentPinstripeColor returns the curated line color for a pinstriped non-Main tile', () => {
  assert.equal(treatmentPinstripeColor(158, 'alternate'), 'rgba(0, 0, 0, 0.16)') // Brewers Alternate
})

test('treatmentPinstripeColor returns null for a team/treatment with no pinstripe', () => {
  assert.equal(treatmentPinstripeColor(158, 'city-connect'), null)
  assert.equal(treatmentPinstripeColor(109, 'alternate'), null)
})

// --------------------------------------------------------------------------
// hasAlternate2 / hasAlternate3 / hasCityConnect
// --------------------------------------------------------------------------
test('hasAlternate2 is true for a team with curated colors or an explicit base-logo opt-in', () => {
  assert.equal(hasAlternate2(112), true) // Cubs — ALT2_COLORS entry
  assert.equal(hasAlternate2(118), true) // Royals — ALT2_USES_BASE_LOGO opt-in
})

test('hasAlternate2 is false for a team with no Alternate 2 set up', () => {
  assert.equal(hasAlternate2(109), false) // Diamondbacks
})

test('hasAlternate3 is true only for teams with an ALT3_COLORS entry', () => {
  assert.equal(hasAlternate3(146), true) // Marlins
  assert.equal(hasAlternate3(158), false) // Brewers — has Alternate 2 but no Alternate 3
})

test('hasCityConnect is false only for NO_CITY_CONNECT teams', () => {
  assert.equal(hasCityConnect(147), false) // Yankees — opted out
  assert.equal(hasCityConnect(158), true) // Brewers
})

// --------------------------------------------------------------------------
// mainTreatmentTint / mainTreatmentScale / mainTreatmentPinstripe(Color) / mainTreatmentRecolor
// --------------------------------------------------------------------------
test('mainTreatmentTint resolves a bg role to that team\'s swatch hex', () => {
  assert.equal(mainTreatmentTint(109), '#E3D4AD') // Diamondbacks — bg: 'secondary'
})

test('mainTreatmentTint prefers a literal bgHex over any swatch role', () => {
  assert.equal(mainTreatmentTint(158), '#FFF5EA') // Brewers — bgHex, not one of the three brand swatches
})

test('mainTreatmentTint returns null for a pinstriped team and for an uncurated team', () => {
  assert.equal(mainTreatmentTint(147), null) // Yankees — pinstripe, no flat swatch
  assert.equal(mainTreatmentTint(999999), null) // no MAIN_OVERRIDES entry at all
})

test('mainTreatmentScale returns a curated override or defaults to 1', () => {
  assert.equal(mainTreatmentScale(140), 0.75) // Rangers
  assert.equal(mainTreatmentScale(999999), 1)
})

test('mainTreatmentPinstripe is true only for the pinstriped Main-tile teams', () => {
  assert.equal(mainTreatmentPinstripe(115), true) // Rockies
  assert.equal(mainTreatmentPinstripe(147), true) // Yankees
  assert.equal(mainTreatmentPinstripe(109), false) // Diamondbacks
})

test('mainTreatmentPinstripeColor defaults to black unless a team overrides it', () => {
  assert.equal(mainTreatmentPinstripeColor(147), 'rgba(0, 0, 0, 0.16)') // Yankees — no override, shares the default
})

test('mainTreatmentRecolor is true only for teams whose Main mark swaps to the hand-edited asset', () => {
  assert.equal(mainTreatmentRecolor(114), true) // Guardians
  assert.equal(mainTreatmentRecolor(115), false) // Rockies — pinstriped but not recolored
})
