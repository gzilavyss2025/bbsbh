// Coverage for the jersey-logo-variant lookups in src/lib/teams.js:
// localLogoUrl, teamLogoUrl's alternate/city-connect routing, and the
// treatmentBgColor/treatmentScale readers PR #339 pulled out of
// TeamColorLab.jsx so the home-page game cards could share them.
import assert from 'node:assert/strict'
import test from 'node:test'
import { localLogoUrl, teamLogoUrl, treatmentBgColor, treatmentScale } from '../src/lib/teams.js'

// --------------------------------------------------------------------------
// localLogoUrl
// --------------------------------------------------------------------------
test('localLogoUrl builds a curated-art path from the team abbreviation', () => {
  assert.equal(localLogoUrl(158, 'alternate'), '/team-logos/alternate/MIL.png')
  assert.equal(localLogoUrl(158, 'city-connect'), '/team-logos/city-connect/MIL.png')
})

test('localLogoUrl uses .svg only for the ALT_LOGO_SVG teams, and only on alternate', () => {
  assert.equal(localLogoUrl(133, 'alternate'), '/team-logos/alternate/ATH.svg') // Athletics
  assert.equal(localLogoUrl(133, 'city-connect'), '/team-logos/city-connect/ATH.png') // svg only applies to alternate
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

// --------------------------------------------------------------------------
// treatmentBgColor
// --------------------------------------------------------------------------
test('treatmentBgColor returns the bg:true hex for a curated team/treatment', () => {
  assert.equal(treatmentBgColor(158, 'alternate'), '#6CACE4')
  assert.equal(treatmentBgColor(158, 'city-connect'), '#0C436A')
})

test('treatmentBgColor returns null for a team with no curated background yet', () => {
  assert.equal(treatmentBgColor(108, 'alternate'), null) // Angels — no ALT_COLORS entry
})

test('treatmentBgColor returns null for main/base, even for a team with alt colors curated', () => {
  assert.equal(treatmentBgColor(158, 'main'), null)
  assert.equal(treatmentBgColor(158, 'base'), null)
})

// --------------------------------------------------------------------------
// treatmentScale
// --------------------------------------------------------------------------
test('treatmentScale returns a curated per-team/treatment override', () => {
  assert.equal(treatmentScale(139, 'alternate'), 1.3) // Rays
  assert.equal(treatmentScale(113, 'city-connect'), 0.75) // Reds
})

test('treatmentScale defaults to 1 for an uncurated team or treatment', () => {
  assert.equal(treatmentScale(158, 'alternate'), 1)
  assert.equal(treatmentScale(139, 'city-connect'), 1) // Rays has no city-connect override
})
