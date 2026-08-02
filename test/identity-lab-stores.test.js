import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import MLB_TREATMENT_TUNING from '../src/lib/data/mlb-treatment-tuning.json' with { type: 'json' }
import MILB_TREATMENT_TUNING from '../src/lib/data/milb-treatment-tuning.json' with { type: 'json' }
import WPA_TUNING from '../src/lib/data/wpa-tuning.json' with { type: 'json' }
import MILB_COLORS from '../src/lib/data/milb-colors.json' with { type: 'json' }
import MLB_TEAM_COLORS from '../src/lib/data/mlb-team-colors.json' with { type: 'json' }
import { byTeam, byTreatment, treatmentRecord } from '../src/lib/tuningStore.js'
import {
  ALL_MLB_TEAM_IDS,
  MLB_TREATMENT_KEYS,
  TREATMENT_SCALE,
  MAIN_OVERRIDES,
  mainTreatmentScale,
  teamColorExtras,
  treatmentScale,
  treatmentOffsetX,
  treatmentOffsetY,
  treatmentOriginY,
} from '../src/lib/teams.js'
import { TEAM_COLOR_PAIRS } from '../src/lib/brandColors.js'
import { mergeTeamDraftIntoStore } from '../src/screens/identity-lab/saveStores.js'
import {
  applyColorsDraft,
  colorsDraftMatchesLanded,
} from '../src/screens/identity-lab/profiles/mlbColorRoles.js'
import { DEV_DATA_STORES } from '../scripts/lib/dev-data-stores.mjs'

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

// The stores with no `treatments` nesting — a fact about the CLUB, not about one
// of its jersey treatments. They share every outer-shape guard below with
// STORES, so they belong in one named list rather than being spread in by hand
// at each call site (which is how mlb-team-colors.json escaped all three when it
// was added).
const TEAM_LEVEL_STORES = {
  'milb-colors.json': MILB_COLORS,
  'mlb-team-colors.json': MLB_TEAM_COLORS,
}

const ALL_STORES = { ...STORES, ...TEAM_LEVEL_STORES }

// --------------------------------------------------------------------------
// Shape
// --------------------------------------------------------------------------

test('every store is keyed by numeric team id, in ascending order', () => {
  for (const [file, store] of Object.entries(ALL_STORES)) {
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
  for (const [file, store] of Object.entries(ALL_STORES)) {
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
  for (const file of Object.keys(ALL_STORES)) {
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
  assert.equal(mainTreatmentScale(rangers), 0.85)
  assert.equal(treatmentScale(rangers, 'main'), 1)
  assert.equal(MLB_TREATMENT_TUNING[rangers].treatments.main.scale, 0.85)
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
      ['bg', 'bgHex', 'pinstripe', 'pinstripeColor', 'scale'].some((k) => main[k] !== undefined)
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

// --------------------------------------------------------------------------
// mlb-team-colors.json — structural checks only. Exact per-team hex values
// are NOT pinned here (colors legitimately change); format/shape invariants
// still are.
// --------------------------------------------------------------------------

// `accent` is NOT a third brand colour, and the store must not quietly become a
// place where those two ideas are the same field. For most clubs the accent
// deliberately restates the pair — that's the pick working as designed, not a
// value waiting to be replaced with something distinct.
test('the accent is either one of the brand pair or a genuinely distinct colour', () => {
  for (const id of ALL_MLB_TEAM_IDS) {
    const [p, s] = TEAM_COLOR_PAIRS[id]
    const a = MLB_TEAM_COLORS[id].accent
    assert.match(a, /^#[0-9a-fA-F]{6}$/, `${id} accent`) // caps-js-exempt
    assert.ok(p && s, `${id} missing a brand pair`)
  }
})

test('every researched MLB extra colour is well-formed and distinct from the accent', () => {
  for (const teamId of ALL_MLB_TEAM_IDS) {
    for (const extra of teamColorExtras(teamId)) {
      assert.match(extra.hex, /^#[0-9a-fA-F]{6}$/, `${teamId}: ${extra.hex}`) // caps-js-exempt
      assert.ok(extra.label, `${teamId} has an unlabeled extra`)
    }
  }
  assert.deepEqual(teamColorExtras(999999), [])
})

// The promotion itself: a club's first researched extra becomes a real,
// editable `accent2` field — not a copy sitting alongside the still-read-only
// `extras` entry, which would let the two drift.
test('a club with a researched extra has it promoted to accent2, not duplicated', () => {
  for (const teamId of ALL_MLB_TEAM_IDS) {
    const accent2 = MLB_TEAM_COLORS[teamId].accent2
    if (accent2 !== undefined) {
      assert.match(accent2, /^#[0-9a-fA-F]{6}$/, `${teamId} accent2`) // caps-js-exempt
    }
  }
})

// offDayTreatment (the club-level pick OffDaySection.jsx's tile reads via
// offDayTreatmentFor) stays in the same closed jerseys.json vocabulary every
// other treatment key on file already answers to — never a free string a
// resolver can't route.
test('a curated offDayTreatment stays in the jerseys.json treatment vocabulary', () => {
  for (const teamId of ALL_MLB_TEAM_IDS) {
    const offDay = MLB_TEAM_COLORS[teamId].offDayTreatment
    if (offDay !== undefined) {
      assert.ok(MLB_TREATMENT_KEYS.has(offDay), `${teamId} has an unknown offDayTreatment "${offDay}"`)
    }
  }
})

// Same vocabulary guard as offDayTreatment above, for the per-side
// predictive-fallback pick defaultTreatmentFor consults
// (defaultHomeTreatmentFor/defaultAwayTreatmentFor).
test('a curated defaultHomeTreatment/defaultAwayTreatment stays in the jerseys.json treatment vocabulary', () => {
  for (const teamId of ALL_MLB_TEAM_IDS) {
    for (const field of ['defaultHomeTreatment', 'defaultAwayTreatment']) {
      const value = MLB_TEAM_COLORS[teamId][field]
      if (value !== undefined) {
        assert.ok(MLB_TREATMENT_KEYS.has(value), `${teamId} has an unknown ${field} "${value}"`)
      }
    }
  }
})

// --------------------------------------------------------------------------
// The lab's save merge (saveStores.js)
// --------------------------------------------------------------------------

test('a team-level merge lands touched fields and leaves every other club alone', () => {
  const store = {
    108: { name: 'Angels', primary: '#003263', secondary: '#BA0021' },
    158: { name: 'Brewers', primary: '#12284B' },
  }
  const next = mergeTeamDraftIntoStore(store, { 108: { primary: '#111111' } }, applyColorsDraft)
  assert.equal(next[108].primary, '#111111')
  assert.equal(next[108].secondary, '#BA0021', 'an untouched field survives')
  assert.deepEqual(next[158], store[158], 'an untouched club survives')
  assert.equal(store[108].primary, '#003263', 'the source store is not mutated')
})

// Clearing a swatch has to mean "this club has no such colour", which is a
// DELETED field — not an empty string. An empty string fails the dev-save
// validator's isColorish check, so writing one would bounce the whole store and
// the owner would see "108's primary is not a color" for an edit that was only
// ever a clear.
test('clearing a colour deletes the field rather than writing an empty string', () => {
  const store = { 108: { name: 'Angels', primary: '#003263', accent: '#BA0021' } }
  const next = mergeTeamDraftIntoStore(store, { 108: { accent: '' } }, applyColorsDraft)
  assert.equal('accent' in next[108], false, 'a cleared role must not survive as ""')
  assert.equal(next[108].primary, '#003263')
  // …and what that write produces must then validate, or Save bounces.
  assert.equal(DEV_DATA_STORES['mlb-team-colors'].validate(next), null)
})

// The other half of the same rule: after that save lands, the still-pending
// draft (`{ accent: '' }`) has to read as "already on disk" so the tile drops
// its unsaved-changes state. A raw `landed[role] === value` comparison never
// matches, because the landed entry has no `accent` key at all.
test('a cleared colour reads as landed once the store has dropped the field', () => {
  assert.equal(colorsDraftMatchesLanded({ accent: '' }, { name: 'Angels', primary: '#003263' }), true)
  assert.equal(colorsDraftMatchesLanded({ accent: '#BA0021' }, { accent: '#BA0021' }), true)
  assert.equal(colorsDraftMatchesLanded({ accent: '#111111' }, { accent: '#BA0021' }), false)
  assert.equal(colorsDraftMatchesLanded({ accent: '' }, { accent: '#BA0021' }), false)
  assert.equal(colorsDraftMatchesLanded({ accent: '' }, undefined), false)
})

test('a team-level merge names a club the store has never seen', () => {
  const next = mergeTeamDraftIntoStore({}, { 158: { primary: '#12284B' } }, applyColorsDraft, {
    name: (id) => `Team name for ${id}`,
  })
  assert.deepEqual(next[158], { name: 'Team name for 158', primary: '#12284B' })
})

test('a team-level merge skips a club whose draft has no touched fields', () => {
  const store = { 108: { name: 'Angels', primary: '#003263' } }
  assert.deepEqual(mergeTeamDraftIntoStore(store, { 108: {}, 158: null }, applyColorsDraft), store)
})
