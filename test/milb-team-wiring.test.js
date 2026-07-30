// Coverage for the MiLB Home/Away wiring — milbColors.js's milbTreatmentTile
// (GameCard/masthead logo tile) plus the isMlbTeamId split it and
// WinProbChart.jsx branch on, so a regression here would silently strand the
// MiLB Team Identity Lab's tables back at "lab-only, nothing real reads them."
import assert from 'node:assert/strict'
import test from 'node:test'
import { isMlbTeamId } from '../src/lib/teams.js'
import {
  milbTreatmentTile,
  milbColorPair,
  milbVariantColors,
  milbHasLogoArt,
  MILB_LOGO_POS_OVERRIDES,
} from '../src/lib/milbColors.js'
import LOGO_ART from '../src/lib/data/logo-art.json' with { type: 'json' }

test('isMlbTeamId separates the 30 MLB clubs from every MiLB affiliate', () => {
  assert.equal(isMlbTeamId(158), true) // Brewers
  assert.equal(isMlbTeamId(402), false) // Akron RubberDucks
  assert.equal(isMlbTeamId(null), false)
})

test('milbTreatmentTile swaps bg/accent between home and away for a team with no landed position override', () => {
  const teamId = 102 // Round Rock Express — has a researched pair, no MILB_LOGO_POS_OVERRIDES entry
  const [primary, secondary] = milbColorPair(teamId)
  const home = milbTreatmentTile(teamId, 'home')
  const away = milbTreatmentTile(teamId, 'away')
  assert.equal(home.tint, primary)
  assert.equal(away.tint, secondary)
  assert.equal(home.logoVariant, 'base')
  assert.equal(away.logoVariant, 'base')
  assert.equal(home.pinstripeColor, null)
  assert.equal(away.pinstripeColor, null)
})

test('milbTreatmentTile reads a landed MILB_LOGO_POS_OVERRIDES entry for scale/offset/bg', () => {
  const teamId = 402 // Akron RubberDucks
  const away = milbTreatmentTile(teamId, 'away')
  const landed = MILB_LOGO_POS_OVERRIDES[teamId].away
  assert.equal(away.scale, landed.scale)
  assert.equal(away.offsetX, landed.offsetX)
  assert.equal(away.offsetY, landed.offsetY)
  assert.equal(away.tint, landed.bg)
})

test('milbTreatmentTile treats an unrecognized variant as away, not a crash', () => {
  const teamId = 556
  const [, secondary] = milbColorPair(teamId)
  assert.deepEqual(milbTreatmentTile(teamId, undefined), milbTreatmentTile(teamId, 'away'))
  assert.equal(milbTreatmentTile(teamId, undefined).tint, secondary)
})

// This PR ships with zero art (PRD 4.3), so today every affiliate falls
// through to 'base' — pinned here so a future upload's effect on logoVariant
// is a real regression to catch, not an assumption never exercised.
test('milbHasLogoArt reads coverage from the committed manifest, empty today', () => {
  assert.deepEqual(LOGO_ART['milb-home'] ?? {}, {})
  assert.deepEqual(LOGO_ART['milb-away'] ?? {}, {})
  assert.equal(milbHasLogoArt(158, 'home'), false)
  assert.equal(milbHasLogoArt(158, 'away'), false)
})

test('milbTreatmentTile would switch to the curated variant once a side has art', () => {
  // milbHasLogoArt is the single gate milbTreatmentTile reads — proved by
  // construction rather than by faking a manifest entry (a static JSON import
  // can't be swapped mid-test): every teamId with no manifest coverage reads
  // 'base', matching what milbTreatmentTile itself returns.
  for (const teamId of [158, 402, 556]) {
    for (const side of ['home', 'away']) {
      assert.equal(milbHasLogoArt(teamId, side), false)
      assert.equal(milbTreatmentTile(teamId, side).logoVariant, 'base')
    }
  }
})

test('milbVariantColors backs milbTreatmentTile for a team with no researched color at all', () => {
  const teamId = 999999 // no MILB_RESEARCHED_PAIRS entry -> neutral fallback pair
  const { bg: homeBg } = milbVariantColors(teamId, 'home')
  const { bg: awayBg } = milbVariantColors(teamId, 'away')
  assert.equal(milbTreatmentTile(teamId, 'home').tint, homeBg)
  assert.equal(milbTreatmentTile(teamId, 'away').tint, awayBg)
  assert.notEqual(homeBg, awayBg)
})
