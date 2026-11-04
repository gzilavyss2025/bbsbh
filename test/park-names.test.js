import test from 'node:test'
import assert from 'node:assert/strict'

import PINNED from '../src/lib/data/park-keys.json' with { type: 'json' }
import MILB_BALLPARKS from '../src/lib/data/milb-ballparks.json' with { type: 'json' }
import { BALLPARKS } from '../src/lib/ballpark/ballparkData.js'
import { CONFIGURATIONS } from '../src/lib/ballpark/layout/configurations.js'
import { PARK_NAMES } from '../src/lib/data/parkNames.js'
import { parkKey } from '../src/lib/ballpark/parkKeys.js'
import { FIELD_IDS as RUNTIME_IDS } from '../src/copy/registry.js'
import { FIELDS as FULL_FIELDS } from '../src/copy/registryFull.js'

// The park field ids, derived the way registry.js did before #2898: straight
// from BALLPARKS. Ids are Redis field names, so they must not move.
function oldParkIds() {
  const ids = new Set()
  const mlbKeys = new Set([
    ...Object.keys(BALLPARKS),
    ...Object.values(BALLPARKS).map((p) => parkKey(p.name)),
  ])
  for (const p of new Set(Object.values(BALLPARKS))) {
    const k = parkKey(p.name)
    for (const s of ['', 'Name', 'Wordmark', 'Photo', 'Credit', 'Focus']) ids.add(`ballpark.${k}${s}`)
  }
  for (const key of Object.keys(MILB_BALLPARKS)) {
    if (mlbKeys.has(key)) continue
    for (const s of ['Name', 'Wordmark', 'Photo', 'Credit', 'Focus']) ids.add(`ballpark.${key}${s}`)
  }
  return ids
}

test('PARK_NAMES matches BALLPARKS key for key, name for name', () => {
  const names = Object.fromEntries(Object.entries(BALLPARKS).map(([k, p]) => [k, p.name]))
  assert.deepEqual(PARK_NAMES, names)
})

test('runtime and full sets carry exactly the old park field ids', () => {
  const park = (ids) => new Set(ids.filter((id) => id.startsWith('ballpark.')))
  assert.deepEqual(park(RUNTIME_IDS), oldParkIds())
  assert.deepEqual(park(FULL_FIELDS.map((f) => f.id)), oldParkIds())
})

test('every current MLB venue id is pinned, so parkKey needs no geometry', () => {
  for (const c of CONFIGURATIONS) {
    if (c.park && c.to == null) assert.ok(PINNED[c.venueId], `venue ${c.venueId} not pinned`)
  }
})
