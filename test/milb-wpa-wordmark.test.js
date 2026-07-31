// The minimal MiLB counterpart to MLB's WPA_OWN_ART/WpaArtPicker (Team
// Identity Lab, ADR-0029) — one on/off switch per (affiliate, Home/Away) to
// tile the club's wordmark instead of its normal mark, rather than a whole
// second art-source library. Pins the draft-beats-landed chain and the URL
// resolution the real WinProbChart (via useMilbWpaLogo) depends on.
import assert from 'node:assert/strict'
import test from 'node:test'
import { milbWpaWordmark, milbWpaMarkUrl, milbHasLogoArt } from '../src/lib/milbColors.js'
import { teamLogoUrl } from '../src/lib/teams.js'

// A team id with no entry anywhere in milb-treatment-tuning.json/logo-art.json
// — every resolver here should degrade to "off"/"the plain base mark" rather
// than throwing on a lookup miss.
const UNCURATED_TEAM_ID = 999999

test('milbWpaWordmark defaults to false for an affiliate with no override', () => {
  assert.equal(milbWpaWordmark(UNCURATED_TEAM_ID, 'home'), false)
  assert.equal(milbWpaWordmark(UNCURATED_TEAM_ID, 'away'), false)
})

test('milbWpaWordmark: a draft toggle wins outright over any landed value', () => {
  assert.equal(milbWpaWordmark(UNCURATED_TEAM_ID, 'home', { wpaWordmark: true }), true)
  assert.equal(milbWpaWordmark(UNCURATED_TEAM_ID, 'home', { wpaWordmark: false }), false)
  // A draft with no wpaWordmark key at all falls through to landed (false here).
  assert.equal(milbWpaWordmark(UNCURATED_TEAM_ID, 'home', {}), false)
})

test('milbWpaMarkUrl tiles the wordmark when toggled on, regardless of curated art', () => {
  const url = milbWpaMarkUrl(UNCURATED_TEAM_ID, 'home', { wpaWordmark: true })
  assert.equal(url, teamLogoUrl(UNCURATED_TEAM_ID, 'wordmark'))
})

test('milbWpaMarkUrl off falls back to the same chain the real tile uses', () => {
  assert.equal(milbHasLogoArt(UNCURATED_TEAM_ID, 'home'), false)
  const url = milbWpaMarkUrl(UNCURATED_TEAM_ID, 'home', { wpaWordmark: false })
  assert.equal(url, teamLogoUrl(UNCURATED_TEAM_ID, 'base'))
})

test('milbWpaMarkUrl treats any variant other than "home" as "away"', () => {
  const away = milbWpaMarkUrl(UNCURATED_TEAM_ID, 'away', { wpaWordmark: true })
  const somethingElse = milbWpaMarkUrl(UNCURATED_TEAM_ID, 'nope', { wpaWordmark: true })
  assert.equal(away, teamLogoUrl(UNCURATED_TEAM_ID, 'wordmark'))
  assert.equal(somethingElse, teamLogoUrl(UNCURATED_TEAM_ID, 'wordmark'))
})
