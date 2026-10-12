import test from 'node:test'
import assert from 'node:assert/strict'

import PINNED from '../src/lib/data/park-keys.json' with { type: 'json' }
import MILB_BALLPARKS from '../src/lib/data/milb-ballparks.json' with { type: 'json' }
import { parkKey, parkRecord, pinParkKeys } from '../src/lib/ballpark/parkKeys.js'
import { CREDITS, fieldIds, venueKey } from '../src/lib/ballpark/ballparkArt.js'
import { BALLPARKS } from '../src/lib/ballpark/ballparkData.js'
import { parkBackdrop } from '../src/lib/ballpark/parkBackdrop.js'
import { FIELD_IDS } from '../src/copy/registry.js'
import { capacityFor } from '../src/api/around-the-game/gate.js'
import { capacityOf } from '../scripts/gen-attendance.mjs'
import { milbParks } from '../scripts/gen-milb-ballparks.mjs'

// A sponsor rename changes a park's name and never its Stats API venue id.
// Every per-park store is filed under a name-derived key, so these tests pin
// the one rule that keeps them attached: the key is minted once per venue id
// and never moves (src/lib/ballpark/parkKeys.js).

const reader = (overrides = {}) => (id) => overrides[id] ?? ''

// Lehigh Valley's park, venue 3230: "Coca-Cola Park" in 2026, "Jefferson Park"
// in the 2027 data.
const LEHIGH = 3230

test('Jefferson Park keeps the Coca-Cola Park key, by id and by name', () => {
  assert.equal(parkKey('Coca-Cola Park', LEHIGH), 'cocacolapark')
  assert.equal(parkKey('Jefferson Park', LEHIGH), 'cocacolapark')
  // No id at all (a lean feed row, the attendance generator): the name alias.
  assert.equal(parkKey('Jefferson Park'), 'cocacolapark')
})

test('a renamed MiLB park still finds the photo and copy an admin saved', () => {
  const ids = fieldIds('cocacolapark')
  // The fields exist in the registry (they are Redis field names) …
  assert.ok(FIELD_IDS.includes(ids.photo))
  assert.ok(!FIELD_IDS.some((id) => id.startsWith('ballpark.jeffersonpark')))
  // … and the new name reaches the photo saved under the old one.
  const saved = reader({ [ids.photo]: 'https://x.public.blob.vercel-storage.com/ballparks/ironpigs.jpg' })
  const park = parkBackdrop('Jefferson Park', saved, LEHIGH)
  assert.equal(park.src, 'https://x.public.blob.vercel-storage.com/ballparks/ironpigs.jpg')
  // The printed name is the park's current one.
  assert.equal(park.name, 'Jefferson Park')
})

// An MLB rename that has not happened: American Family Field (venue 32) under
// a new sponsor, with the same id. The id alone must carry the bundled photo,
// the admin copy and the capacity across.
const AFF = Object.entries(PINNED).find(([, e]) => e.key === 'americanfamilyfield')
const RENAMED = 'Brew City Bank Ballpark'

test('a renamed MLB park finds its bundled photo by venue id', () => {
  assert.ok(AFF, 'American Family Field is pinned')
  const venueId = Number(AFF[0])
  const park = parkBackdrop(RENAMED, reader(), venueId)
  assert.equal(park.src, '/ballparks/americanfamilyfield.jpg')
  assert.equal(parkKey(RENAMED, venueId), 'americanfamilyfield')
  // The admin's own photo wins over the bundled one, through the same key.
  const mine = reader({ [fieldIds('americanfamilyfield').photo]: 'https://example.com/mine.jpg' })
  assert.equal(parkBackdrop(RENAMED, mine, venueId).src, 'https://example.com/mine.jpg')
})

test('a renamed park keeps its capacity, by id and through a recorded name', () => {
  const venueId = Number(AFF[0])
  const capacity = BALLPARKS.americanfamilyfield.capacity
  assert.equal(capacityFor(RENAMED, venueId), capacity)
  assert.equal(parkRecord(RENAMED, venueId), BALLPARKS.americanfamilyfield)
  // A name the pinned table records is enough with no id (gen-attendance's rows).
  const pinned = pinParkKeys(PINNED, [{ venueId, venueName: RENAMED }])
  assert.deepEqual(pinned[venueId].names, ['American Family Field', RENAMED])
  // An unknown venue still has none, so its fill rate stays blank.
  assert.equal(capacityOf('Field of Dreams'), null)
  assert.equal(capacityFor('Field of Dreams'), null)
})

test('the generator keeps the key and moves the name on a rename', () => {
  const lines = []
  const before = { [LEHIGH]: { key: 'cocacolapark', names: ['Coca-Cola Park'] } }
  const pinned = pinParkKeys(before, [{ venueId: LEHIGH, venueName: 'Jefferson Park' }], (l) => lines.push(l))
  assert.equal(pinned[LEHIGH].key, 'cocacolapark')
  assert.deepEqual(pinned[LEHIGH].names, ['Coca-Cola Park', 'Jefferson Park'])
  assert.equal(lines.length, 1)
  // The input is not mutated (the generator compares before and after).
  assert.deepEqual(before[LEHIGH].names, ['Coca-Cola Park'])

  // The 2027 teams.json: the MiLB list stays under the old key, new heading.
  const bySportId = { 11: [{ name: 'Lehigh Valley IronPigs', venueId: LEHIGH, venueName: 'Jefferson Park' }] }
  assert.deepEqual(milbParks(bySportId, pinned), {
    cocacolapark: { venue: 'Jefferson Park', venueId: LEHIGH, teams: ['Lehigh Valley IronPigs'] },
  })
})

test('a new venue gets its name key, and a clash takes the id as a suffix', () => {
  const pinned = pinParkKeys({}, [
    { venueId: 1, venueName: 'Memorial Field' },
    { venueId: 2, venueName: 'Memorial Field' },
  ])
  assert.equal(pinned[1].key, 'memorialfield')
  assert.equal(pinned[2].key, 'memorialfield2')
})

test('the pinned table is the key every store already used', () => {
  const keys = Object.values(PINNED).map((e) => e.key)
  assert.equal(new Set(keys).size, keys.length, 'one venue per key')
  for (const { key } of Object.values(PINNED)) {
    // A key resolves to itself, so resolvePhoto(key) and fieldIds(key) agree.
    assert.equal(parkKey(key), key)
    assert.match(key, /^[a-z0-9]+$/)
  }
  // Every bundled photo belongs to a pinned venue.
  for (const key of Object.keys(CREDITS)) assert.ok(keys.includes(key), `${key} pinned`)
  // Every MiLB editor entry is filed under its venue's pinned key.
  for (const [key, { venueId }] of Object.entries(MILB_BALLPARKS)) {
    assert.equal(PINNED[venueId]?.key, key, `${key} pinned to ${venueId}`)
  }
  // Every MLB park's copy fields sit under its pinned key, which is still the
  // name key the registry has always used.
  for (const park of new Set(Object.values(BALLPARKS))) {
    assert.equal(parkKey(park.name), venueKey(park.name))
  }
})

// The two halves of the rename work agree (#1859 x #1866): ballparkFor finds an
// MLB park by venue id, so a park under a name nobody has recorded yet still
// measures as its park and files under its canonical key.
test('a park under an unrecorded name still finds its record and key by id', () => {
  assert.equal(parkRecord('Some New Sponsor Field', 32)?.name, 'American Family Field')
  assert.equal(parkKey('Some New Sponsor Field', 32), PINNED[32].key)
})
