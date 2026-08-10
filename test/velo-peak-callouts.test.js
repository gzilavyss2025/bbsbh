import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCallouts } from '../src/api/callout-notes.js'
import { ELITE_VELO_MPH } from '../src/api/pitchArsenal.js'

// veloPeak — the standalone single-pitch spotlight (docs/callouts.md), reading
// progress.js's per-play `newPeakVelo` (this game's own running max) against
// bundle.starterRecords' season-high on file. Independent of veloVariety,
// which needs 2+ distinct pitch types this game; this fires on ONE pitch.

const BUNDLE = {
  away: { teamId: 1, name: 'Away Club' },
  home: { teamId: 2, name: 'Home Club' },
  starterRecords: { 555: { centuryClub: { seasonMaxVelo: 103.8 } } },
}
const entry = { atBatIndex: 4, batterId: 99, eventType: 'field_out', pitcher: { id: 555, last: 'Miso' } }

function progressWith(newPeakVelo) {
  return { byPlay: new Map([[4, { newPeakVelo }]]) }
}

test('veloPeak fires a new-season-high note and names the pitcher', () => {
  const notes = buildCallouts(entry, {
    bundle: BUNDLE,
    battingSide: 'away',
    progress: progressWith({ mph: 105.1, type: 'Four-Seam Fastball' }),
  })
  const n = notes.find((x) => x.kind === 'veloPeak')
  assert.ok(n, 'expected a veloPeak note')
  assert.equal(n.personId, 555)
  assert.equal(n.side, 'home') // the pitcher's own side, not the batter's
  assert.equal(n.dedupeKey, 'veloPeak-555')
  assert.match(n.text, /^New season high for Miso/)
  assert.match(n.text, /105\.1 mph/)
  assert.match(n.text, /103\.8/)
})

test('veloPeak fires on an elite-tier pitch even without a season-high', () => {
  const notes = buildCallouts(entry, {
    bundle: BUNDLE,
    battingSide: 'away',
    progress: progressWith({ mph: ELITE_VELO_MPH + 0.5, type: 'Slider' }),
  })
  const n = notes.find((x) => x.kind === 'veloPeak')
  assert.ok(n, 'expected a veloPeak note')
  assert.match(n.text, /touched/)
  assert.match(n.text, /slider/)
})

test('veloPeak stays quiet below both bars', () => {
  const notes = buildCallouts(entry, {
    bundle: BUNDLE,
    battingSide: 'away',
    progress: progressWith({ mph: ELITE_VELO_MPH - 1, type: 'Four-Seam Fastball' }),
  })
  assert.equal(notes.find((x) => x.kind === 'veloPeak'), undefined)
})

test('veloPeak needs no season baseline to fire on the elite bar alone', () => {
  const notes = buildCallouts(
    { ...entry, pitcher: { id: 556, last: 'Newcomer' } },
    {
      bundle: { ...BUNDLE, starterRecords: {} }, // no centuryClub on file for 556
      battingSide: 'away',
      progress: progressWith({ mph: ELITE_VELO_MPH + 1, type: 'Curveball' }),
    },
  )
  const n = notes.find((x) => x.kind === 'veloPeak')
  assert.ok(n, 'expected a veloPeak note even with no season data on file')
})

test('veloPeak does not fire when the play set no new game peak', () => {
  const notes = buildCallouts(entry, { bundle: BUNDLE, battingSide: 'away', progress: progressWith(null) })
  assert.equal(notes.find((x) => x.kind === 'veloPeak'), undefined)
})
