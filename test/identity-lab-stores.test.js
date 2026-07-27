import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import MLB_TREATMENT_TUNING from '../src/lib/data/mlb-treatment-tuning.json' with { type: 'json' }
import MILB_TREATMENT_TUNING from '../src/lib/data/milb-treatment-tuning.json' with { type: 'json' }
import WPA_TUNING from '../src/lib/data/wpa-tuning.json' with { type: 'json' }
import MILB_COLORS from '../src/lib/data/milb-colors.json' with { type: 'json' }
import { byTeam, byTreatment, treatmentRecord } from '../src/lib/tuningStore.js'
import {
  ALL_MLB_TEAM_IDS,
  TREATMENT_SCALE,
  MAIN_OVERRIDES,
  mainTreatmentScale,
  treatmentScale,
  treatmentOffsetX,
  treatmentOffsetY,
  treatmentOriginY,
} from '../src/lib/teams.js'
import { MILB_RESEARCHED_PAIRS } from '../src/lib/milbColors.js'

// The hand-tuned identity stores (src/lib/data/*.json) that PR 1 of the Team
// Identity Lab moved out of JS literals, and the readers that rebuild the
// lookup tables from them (src/lib/tuningStore.js). The per-resolver behaviour
// these feed is already pinned by teams.test.js / wpa-logo.test.js / winprob.
// What's pinned HERE is the store contract itself: the shape the lab's Save
// writes, the shape those resolvers read, and the one place the two disagree on
// purpose (Main's scale).

const STORES = {
  'mlb-treatment-tuning.json': MLB_TREATMENT_TUNING,
  'milb-treatment-tuning.json': MILB_TREATMENT_TUNING,
  'wpa-tuning.json': WPA_TUNING,
}

const MLB_TREATMENT_KEYS = new Set([
  'main',
  'alternate',
  'alternate-2',
  'alternate-3',
  'alternate-4',
  'city-connect',
])

// --------------------------------------------------------------------------
// Shape
// --------------------------------------------------------------------------

test('every store is keyed by numeric team id, in ascending order', () => {
  for (const [file, store] of Object.entries({ ...STORES, 'milb-colors.json': MILB_COLORS })) {
    const keys = Object.keys(store)
    assert.ok(keys.length > 0, `${file} is empty`)
    for (const k of keys) assert.match(k, /^\d+$/, `${file} has a non-numeric key ${k}`)
    const ids = keys.map(Number)
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), `${file} is not sorted by team id`)
  }
})

// The `name` on every entry is the per-entry comment these tables carried as JS
// literals. Nothing resolves it — it exists so a 900-line JSON diff still says
// which club moved.
test('every entry names its club', () => {
  for (const [file, store] of Object.entries({ ...STORES, 'milb-colors.json': MILB_COLORS })) {
    for (const [teamId, entry] of Object.entries(store)) {
      assert.equal(typeof entry.name, 'string', `${file} ${teamId} has no name`)
      assert.ok(entry.name.length > 0, `${file} ${teamId} has an empty name`)
    }
  }
})

test('MLB treatment keys stay in the jerseys.json vocabulary', () => {
  for (const [teamId, entry] of Object.entries(MLB_TREATMENT_TUNING)) {
    assert.ok(ALL_MLB_TEAM_IDS.includes(Number(teamId)), `${teamId} is not a current MLB club`)
    for (const key of Object.keys(entry.treatments ?? {})) {
      assert.ok(MLB_TREATMENT_KEYS.has(key), `${teamId} has an unknown treatment "${key}"`)
    }
  }
})

test('MiLB treatment keys are only the two variations that dimension has', () => {
  for (const [teamId, entry] of Object.entries(MILB_TREATMENT_TUNING)) {
    for (const key of Object.keys(entry.treatments ?? {})) {
      assert.ok(key === 'home' || key === 'away', `${teamId} has an unknown variant "${key}"`)
    }
  }
})

// An entry either carries a real pair or is explicitly `found: false` — never
// both, and never neither. That's the whole guard against an unresolved club
// quietly acquiring an invented hex, so it's asserted on the committed file
// rather than only in the dev-save validator.
test('a milb-colors entry is either two hex colors or an explicit found:false', () => {
  for (const [teamId, entry] of Object.entries(MILB_COLORS)) {
    if (entry.found === false) {
      assert.equal(entry.pair, undefined, `${teamId} is found:false but carries a pair`)
      assert.ok(entry.note, `${teamId} is found:false with no note explaining why`)
      continue
    }
    assert.ok(Array.isArray(entry.pair), `${teamId} has no pair and no found:false`)
    assert.equal(entry.pair.length, 2, `${teamId}'s pair is not two colors`)
    for (const hex of entry.pair) assert.match(hex, /^#[0-9a-fA-F]{6}$/, `${teamId}: ${hex}`) // caps-js-exempt
  }
})

test('a milb-colors third color and confidence rating are well-formed', () => {
  for (const [teamId, entry] of Object.entries(MILB_COLORS)) {
    if (entry.third !== undefined) {
      assert.match(entry.third, /^#[0-9a-fA-F]{6}$/, `${teamId}: ${entry.third}`) // caps-js-exempt
    }
    assert.ok(
      ['high', 'medium', 'low'].includes(entry.confidence),
      `${teamId}'s confidence is "${entry.confidence}"`,
    )
  }
})

test('every WPA layout carries finite numbers only', () => {
  for (const [teamId, entry] of Object.entries(WPA_TUNING)) {
    for (const [treatment, fields] of Object.entries(entry.treatments ?? {})) {
      for (const [k, v] of Object.entries(fields.layout ?? {})) {
        assert.ok(Number.isFinite(v), `${teamId}.${treatment}.layout.${k} is ${v}`)
      }
    }
  }
})

test('each store file is 2-space pretty-printed with a trailing newline', async () => {
  for (const file of [...Object.keys(STORES), 'milb-colors.json']) {
    const raw = await readFile(new URL(`../src/lib/data/${file}`, import.meta.url), 'utf8')
    assert.ok(raw.endsWith('}\n'), `${file} has no trailing newline`)
    assert.ok(raw.includes('\n  "'), `${file} is not 2-space indented`)
  }
})

// --------------------------------------------------------------------------
// The readers
// --------------------------------------------------------------------------

test('byTreatment skips a cell whose pick returns undefined', () => {
  const store = {
    1: { name: 'A', treatments: { main: { scale: 2 }, alternate: { offsetX: 3 } } },
    2: { name: 'B', treatments: { alternate: {} } },
  }
  assert.deepEqual(byTreatment(store, (f) => f.scale), { 1: { main: 2 } })
  // A team whose every cell is skipped gets no key at all, exactly like the
  // hand-written literal did.
  assert.deepEqual(Object.keys(byTreatment(store, (f) => f.offsetX)), ['1'])
})

test('byTreatment can exclude Main, which is what keeps its scale from double-applying', () => {
  const store = { 1: { treatments: { main: { scale: 2 }, alternate: { scale: 3 } } } }
  assert.deepEqual(byTreatment(store, (f) => f.scale, { includeMain: false }), { 1: { alternate: 3 } })
})

test('byTeam reads a team-level field, treatmentRecord a per-treatment one', () => {
  const store = { 7: { name: 'C', bandColor: '#fff', treatments: { main: { band: '#000' } } } }
  assert.deepEqual(byTeam(store, (e) => e.bandColor), { 7: '#fff' })
  assert.deepEqual(treatmentRecord(store, 7, 'main'), { band: '#000' })
  assert.equal(treatmentRecord(store, 7, 'city-connect'), null)
  assert.equal(treatmentRecord(store, 999, 'main'), null)
})

// --------------------------------------------------------------------------
// The one deliberate asymmetry
// --------------------------------------------------------------------------

// Main's tile tuning has always lived in MAIN_OVERRIDES, and treatmentScale has
// always returned 1 for it — treatmentTile routes Main through the
// mainTreatment* readers instead. Merging the two stores into one JSON file put
// both scales in the same place, so this pins that they stay separate: a Main
// scale must NOT start leaking into treatmentScale, or every Main tile in the
// app would silently apply it twice.
test('Main scale resolves through mainTreatmentScale only, never treatmentScale', () => {
  const rangers = 140
  assert.equal(mainTreatmentScale(rangers), 0.75)
  assert.equal(treatmentScale(rangers, 'main'), 1)
  assert.equal(MLB_TREATMENT_TUNING[rangers].treatments.main.scale, 0.75)
  for (const teamId of Object.keys(TREATMENT_SCALE)) {
    assert.ok(!('main' in TREATMENT_SCALE[teamId]), `TREATMENT_SCALE[${teamId}] grew a main row`)
  }
})

test('a Main record with no tile fields yields no MAIN_OVERRIDES entry', () => {
  // Every club in the store that has ONLY prose/header/offset under `main`
  // must stay out of MAIN_OVERRIDES — that table drives the real slate card.
  for (const [teamId, entry] of Object.entries(MLB_TREATMENT_TUNING)) {
    const main = entry.treatments?.main
    const hasTileField =
      main &&
      ['bg', 'bgHex', 'recolor', 'pinstripe', 'pinstripeColor', 'scale'].some((k) => main[k] !== undefined)
    assert.equal(
      Boolean(MAIN_OVERRIDES[teamId]),
      Boolean(hasTileField),
      `MAIN_OVERRIDES and the store disagree about ${teamId}`,
    )
  }
})

// --------------------------------------------------------------------------
// The fields the lab moved out of its own page-local literals
// --------------------------------------------------------------------------

test('the lab-only offset/origin resolvers read the same store', () => {
  assert.equal(treatmentOffsetX(139, 'alternate'), -12) // Rays
  assert.equal(treatmentOffsetX(112, 'main'), 4) // Cubs — Main carries offsets too
  assert.equal(treatmentOffsetY(144, 'city-connect'), 4) // Braves
  assert.equal(treatmentOriginY(109, 'alternate'), '10%') // Diamondbacks
})

test('offset and origin default to no nudge for an untuned team or treatment', () => {
  assert.equal(treatmentOffsetX(158, 'alternate-3'), 0)
  assert.equal(treatmentOffsetY(999999, 'main'), 0)
  assert.equal(treatmentOriginY(158, 'main'), 'center')
})

// MILB_RESEARCHED_PAIRS is step 1 of the chain, so its keys are exactly the
// entries that HAVE a pair — three short of the store's 120 affiliates, which
// is the point: the unresolved three must not appear here at all, or they'd
// short-circuit the parent-org fallback with an undefined pair.
test('every researched MiLB pair survives the move to milb-colors.json', () => {
  const withPair = Object.values(MILB_COLORS).filter((e) => e.pair).length
  assert.equal(Object.keys(MILB_RESEARCHED_PAIRS).length, withPair)
  assert.equal(Object.keys(MILB_COLORS).length, withPair + 3)
  assert.deepEqual(MILB_RESEARCHED_PAIRS[234], ['#0054A4', '#B15C12']) // Durham Bulls
  assert.equal(MILB_RESEARCHED_PAIRS[999999], undefined)
  for (const teamId of [482, 553, 1956]) {
    assert.equal(MILB_RESEARCHED_PAIRS[teamId], undefined, `${teamId} should have no researched pair`)
  }
})
