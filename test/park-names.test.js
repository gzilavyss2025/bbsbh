import test from 'node:test'
import assert from 'node:assert/strict'

import PINNED from '../src/lib/data/park-keys.json' with { type: 'json' }
import MILB_BALLPARKS from '../src/lib/data/milb-ballparks.json' with { type: 'json' }
import { BALLPARKS } from '../src/lib/ballpark/ballparkData.js'
import { CONFIGURATIONS } from '../src/lib/ballpark/layout/configurations.js'
import { PARKS, PARK_KEYS, canonicalParkName, parkKey } from '../src/lib/data/parkNames.js'
import { parkKey as reexported } from '../src/lib/ballpark/parkKeys.js'
import { FIELD_IDS as RUNTIME_IDS } from '../src/copy/registry.js'
import { FIELDS as FULL_FIELDS } from '../src/copy/registryFull.js'

// FROZEN from main ff17c307 (before #2898): the 30 MLB park keys the registry
// filed its six fields under. Ids are Redis field names, so they must not move.
// Do not regenerate this list from the code under test.
const OLD_MLB_KEYS = [
  'americanfamilyfield', 'angelstadium', 'buschstadium', 'chasefield', 'citifield',
  'citizensbankpark', 'comericapark', 'coorsfield', 'daikinpark', 'dodgerstadium',
  'fenwaypark', 'globelifefield', 'greatamericanballpark', 'kauffmanstadium',
  'loandepotpark', 'nationalspark', 'oraclepark', 'orioleparkatcamdenyards', 'petcopark',
  'pncpark', 'progressivefield', 'ratefield', 'rogerscentre', 'sutterhealthpark',
  'tmobilepark', 'targetfield', 'tropicanafield', 'truistpark', 'wrigleyfield', 'yankeestadium',
]
// The three alias keys BALLPARKS also carried (they claimed MiLB keys too).
const OLD_ALIAS_KEYS = ['minutemaidpark', 'guaranteedratefield', 'uniqlofieldatdodgerstadium']

const MLB_SUFFIXES = ['', 'Name', 'Wordmark', 'Photo', 'Credit', 'Focus']
const MILB_SUFFIXES = MLB_SUFFIXES.slice(1)

const OLD_PARK_IDS = new Set([
  ...OLD_MLB_KEYS.flatMap((k) => MLB_SUFFIXES.map((s) => `ballpark.${k}${s}`)),
  // MiLB parks: every json key no MLB key (or alias) claims.
  ...Object.keys(MILB_BALLPARKS)
    .filter((k) => ![...OLD_MLB_KEYS, ...OLD_ALIAS_KEYS].includes(k))
    .flatMap((k) => MILB_SUFFIXES.map((s) => `ballpark.${k}${s}`)),
])

test('runtime and full sets carry exactly the park field ids main had', () => {
  const park = (ids) => new Set(ids.filter((id) => id.startsWith('ballpark.')))
  assert.equal(OLD_PARK_IDS.size, 770) // main's count (30 x 6 + 118 x 5)
  assert.deepEqual(park(RUNTIME_IDS), OLD_PARK_IDS)
  assert.deepEqual(park(FULL_FIELDS.map((f) => f.id)), OLD_PARK_IDS)
})

test('BALLPARKS is built from PARKS: same keys, names and shared alias records', () => {
  assert.deepEqual(Object.keys(BALLPARKS).sort(), [...PARK_KEYS].sort())
  for (const { key, name, aliases = [] } of PARKS) {
    assert.equal(BALLPARKS[key].name, name)
    for (const a of aliases) assert.equal(BALLPARKS[a], BALLPARKS[key])
  }
})

test('PARKS venue ids are the current layout configurations', () => {
  const cfg = Object.fromEntries(
    CONFIGURATIONS.filter((c) => c.park && c.to == null).map((c) => [c.venueId, c.park]),
  )
  assert.deepEqual(Object.fromEntries(PARKS.map((p) => [p.venueId, p.key])), cfg)
})

test('parkKey finds an unpinned current venue by id, with no geometry', () => {
  const { venueId, key } = PARKS.find((p) => p.key === 'fenwaypark')
  assert.equal(parkKey('Some New Sponsor Park', venueId), PINNED[venueId]?.key ?? key)
  // A venue id on no pin: the id still reaches the park's name.
  assert.equal(canonicalParkName('Whatever', venueId), 'Fenway Park')
  assert.equal(canonicalParkName('Whatever', 999999), null)
})

test('parkKey is a plain lookup: Object.prototype names do not throw or match', () => {
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.doesNotThrow(() => parkKey(name))
    assert.equal(parkKey(name), name.toLowerCase().replace(/[^a-z0-9]/g, ''))
    assert.equal(canonicalParkName(name), null)
  }
})

test('parkKeys.js re-exports the same parkKey', () => {
  assert.equal(reexported, parkKey)
})
