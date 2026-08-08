import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPitchLocations } from '../src/api/playbyplay.js'

// The predicate an at-bat card asks before it draws a strike zone at all, and
// now also what decides whether its row keeps a second grid column at the wide
// breakpoint (.pbp__atbat--nozone). A false positive at an untracked park is a
// zone with nothing in it; a false negative at an MLB park drops a pane that has
// data. Both halves matter, so both are pinned here.

const tracked = { px: 0.3, pz: 2.4, szTop: 3.4, szBottom: 1.6 }

test('a pitch with plate coordinates and a batter zone counts as tracked', () => {
  assert.equal(hasPitchLocations([tracked]), true)
})

test('one tracked pitch is enough, even beside untracked ones', () => {
  assert.equal(hasPitchLocations([{ px: null, pz: null, szTop: null, szBottom: null }, tracked]), true)
})

test('no pitches at all is not tracked', () => {
  assert.equal(hasPitchLocations([]), false)
})

test('missing pitch detail is not tracked, and does not throw', () => {
  assert.equal(hasPitchLocations(null), false)
  assert.equal(hasPitchLocations(undefined), false)
})

test('plate coordinates without a batter zone are not plottable', () => {
  // The MiLB shape this exists for: some feeds carry px/pz and no zone to scale
  // them against, which cannot be drawn.
  assert.equal(hasPitchLocations([{ px: 0.3, pz: 2.4 }]), false)
  assert.equal(hasPitchLocations([{ px: 0.3, pz: 2.4, szTop: 3.4 }]), false)
})

test('a batter zone without plate coordinates is not plottable either', () => {
  assert.equal(hasPitchLocations([{ szTop: 3.4, szBottom: 1.6 }]), false)
})

test('a zero coordinate is a real location, not a missing one', () => {
  // Dead center of the plate: 0 is falsy, so a truthiness check here would read
  // a tracked park as untracked.
  assert.equal(hasPitchLocations([{ px: 0, pz: 0, szTop: 3.4, szBottom: 1.6 }]), true)
})
