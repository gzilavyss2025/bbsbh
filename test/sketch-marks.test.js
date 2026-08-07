// The sketch modal's per-club mark picker (src/lib/markSources.js's
// sketchMarkVariants) — the list LogoModal renders on the Logo Sheet and in the
// game flow. Two things are pinned here: the fixed order (cap, base, wordmark),
// and that City Connect appears for a club whose CC art we actually have and
// only for that club, since the CDN carries no such mark and a tab offered
// without art would silently fall back to the base logo.
import assert from 'node:assert/strict'
import test from 'node:test'
import { sketchMarkVariants } from '../src/lib/markSources.js'

const keys = (teamId) => sketchMarkVariants(teamId).map((v) => v.key)

test('the fixed marks are cap, base, wordmark, in that order', () => {
  // Yankees (147) opted out of City Connect entirely, so theirs is the bare list.
  assert.deepEqual(keys(147), ['cap', 'base', 'wordmark'])
})

test('primary is gone — base holds that slot', () => {
  assert.ok(!keys(158).includes('primary'))
})

test('City Connect is offered for a club with procured art, fourth and before the wordmark', () => {
  // Brewers (158) — public/team-logos/city-connect/MIL.png is on disk.
  assert.deepEqual(keys(158), ['cap', 'base', 'city-connect', 'wordmark'])
})

test('City Connect is withheld from a club with no art on file', () => {
  // Cubs (112): their City Connect look moved to Alternate 2, so there is no
  // city-connect/CHC file — the tab must not appear.
  assert.ok(!keys(112).includes('city-connect'))
})

test('a MiLB club gets the fixed list — CC art is keyed by MLB abbreviation only', () => {
  assert.deepEqual(keys(556), ['cap', 'base', 'wordmark'])
})

test('no team id still yields a usable list rather than throwing', () => {
  assert.deepEqual(keys(null), ['cap', 'base', 'wordmark'])
})

test('every entry carries a label for the segmented control', () => {
  for (const v of sketchMarkVariants(158)) {
    assert.equal(typeof v.label, 'string')
    assert.ok(v.label.length > 0)
  }
})
