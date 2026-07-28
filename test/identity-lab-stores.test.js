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
  TREATMENT_SCALE,
  MAIN_OVERRIDES,
  mainTreatmentScale,
  teamTintColor,
  teamColorExtras,
  teamPrimaryColor,
  favoriteAccentColor,
  treatmentScale,
  treatmentOffsetX,
  treatmentOffsetY,
  treatmentOriginY,
} from '../src/lib/teams.js'
import { TEAM_COLOR_PAIRS } from '../src/lib/brandColors.js'
import { MILB_RESEARCHED_PAIRS } from '../src/lib/milbColors.js'
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

// --------------------------------------------------------------------------
// mlb-team-colors.json — the MLB counterpart of the move above
// --------------------------------------------------------------------------

// The MLB colour tables moved out of JS literals the same way the MiLB pairs
// did, and get the same guard: the exact pre-move values, pinned. A one-
// character typo in a 200-line JSON file otherwise silently retints every
// surface teamPrimaryColor/teamTintColor/favoriteAccentColor feeds, and lint's
// contrast guard only catches it if the result ALSO fails WCAG AA.
const PRE_MOVE_COLOR_PAIRS = {
  108: ['#003263', '#BA0021'], 109: ['#A71930', '#E3D4AD'], 110: ['#DF4601', '#000000'],
  111: ['#BD3039', '#0C2340'], 112: ['#0E3386', '#CC3433'], 113: ['#C6011F', '#000000'],
  114: ['#00385D', '#E50022'], 115: ['#333366', '#C4CED4'], 116: ['#0C2340', '#FA4616'],
  117: ['#002D62', '#EB6E1F'], 118: ['#004687', '#BD9B60'], 119: ['#005A9C', '#EF3E42'],
  120: ['#AB0003', '#14225A'], 121: ['#002D72', '#FF5910'], 133: ['#003831', '#EFB21E'],
  134: ['#27251F', '#FDB827'], 135: ['#2F241D', '#FFC425'], 136: ['#0C2C56', '#005C5C'],
  137: ['#FD5A1E', '#27251F'], 138: ['#C41E3A', '#0C2340'], 139: ['#092C5C', '#8FBCE6'],
  140: ['#003278', '#C0111F'], 141: ['#134A8E', '#1D2D5C'], 142: ['#002B5C', '#D31145'],
  143: ['#E81828', '#002D72'], 144: ['#CE1141', '#13274F'], 145: ['#27251F', '#C4CED4'],
  146: ['#00A3E0', '#EF3340'], 147: ['#003087', '#E4002C'], 158: ['#12284B', '#FFC52F'],
}

const PRE_MOVE_ACCENTS = {
  108: '#BA0021', 109: '#A71930', 110: '#DF4601', 111: '#BD3039', 112: '#0E3386',
  113: '#C6011F', 114: '#E31937', 115: '#333366', 116: '#0C2340', 117: '#EB6E1F',
  118: '#BD9B60', 119: '#005A9C', 120: '#AB0003', 121: '#002D72', 133: '#EFB21E',
  134: '#FDB827', 135: '#2F241D', 136: '#005C5C', 137: '#FD5A1E', 138: '#C41E3A',
  139: '#F5D130', 140: '#C0111F', 141: '#E8291C', 142: '#D31145', 143: '#E81828',
  144: '#CE1141', 145: '#27251F', 146: '#00A3E0', 147: '#003087', 158: '#FFC52F',
}

test('every MLB brand pair and accent survives the move to mlb-team-colors.json', () => {
  assert.deepEqual(TEAM_COLOR_PAIRS, PRE_MOVE_COLOR_PAIRS)
  for (const teamId of ALL_MLB_TEAM_IDS) {
    assert.equal(teamPrimaryColor(teamId), PRE_MOVE_COLOR_PAIRS[teamId][0], `${teamId} primary`)
    assert.equal(MLB_TEAM_COLORS[teamId].accent, PRE_MOVE_ACCENTS[teamId], `${teamId} accent`)
    // The accent reaches its consumers through TEAM_COLORS, which is rebuilt
    // from that field — assert the resolver, not just the stored hex.
    assert.equal(teamTintColor(teamId, 1), hexToRgb(PRE_MOVE_ACCENTS[teamId]), `${teamId} tint`)
  }
  // The Brewers are the one club whose favorite accent deliberately ISN'T the
  // distinctiveness pick, so the override has to survive the move too.
  assert.equal(favoriteAccentColor(158), '#12284B')
  assert.equal(favoriteAccentColor(108), PRE_MOVE_ACCENTS[108])
})

const hexToRgb = (hex) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, 1)`

// `accent` is NOT a third brand colour, and the store must not quietly become a
// place where those two ideas are the same field. For most clubs the accent
// deliberately restates the pair — that's the pick working as designed, not a
// value waiting to be replaced with something distinct.
test('the accent is the distinctiveness pick, deliberately restating the pair for most clubs', () => {
  const restates = ALL_MLB_TEAM_IDS.filter((id) => {
    const [p, s] = TEAM_COLOR_PAIRS[id]
    const a = MLB_TEAM_COLORS[id].accent
    return a === p || a === s
  })
  assert.equal(restates.length, 27)
  // The three whose accent is a colour the pair doesn't carry at all.
  assert.deepEqual(ALL_MLB_TEAM_IDS.filter((id) => !restates.includes(id)), [114, 139, 141])
})

// The counterpart of the MiLB guard above: these hexes were researched against
// Wikipedia infoboxes and teamcolorcodes.com and skipped rather than guessed
// where sources disagreed, so a refactor must not be able to drop them silently
// (an earlier pass deleted the table outright). Each club's FIRST extra was
// later promoted to the editable `accent2` role (see the ACCENT2 test below);
// only a club with a SECOND extra still has anything left here.
test('every researched MLB extra colour beyond accent2 survives, and stays distinct from the accent', () => {
  const withExtras = ALL_MLB_TEAM_IDS.filter((id) => teamColorExtras(id).length > 0)
  assert.equal(withExtras.length, 5)
  assert.deepEqual(teamColorExtras(137), [{ label: 'Metallic Gold', hex: '#AE8F6F' }]) // Giants, Cream promoted
  assert.deepEqual(teamColorExtras(146), [{ label: 'Black', hex: '#000000' }]) // Marlins
  assert.deepEqual(teamColorExtras(999999), [])
  for (const teamId of withExtras) {
    for (const extra of teamColorExtras(teamId)) {
      assert.match(extra.hex, /^#[0-9a-fA-F]{6}$/, `${teamId}: ${extra.hex}`) // caps-js-exempt
      assert.ok(extra.label, `${teamId} has an unlabeled extra`)
    }
  }
})

// The promotion itself: a club's first researched extra becomes a real,
// editable `accent2` field — not a copy sitting alongside the still-read-only
// `extras` entry, which would let the two drift.
test('a club with a researched extra has it promoted to accent2, not duplicated', () => {
  const withAccent2 = ALL_MLB_TEAM_IDS.filter((id) => MLB_TEAM_COLORS[id].accent2 !== undefined)
  assert.equal(withAccent2.length, 14)
  assert.equal(MLB_TEAM_COLORS[108].accent2, '#C4CED4') // Angels — Silver
  assert.equal(MLB_TEAM_COLORS[109].accent2, '#30CED8') // Diamondbacks — Teal
  assert.equal(MLB_TEAM_COLORS[137].accent2, '#EFD19F') // Giants — Cream (first of its two extras)
  for (const teamId of withAccent2) {
    assert.match(MLB_TEAM_COLORS[teamId].accent2, /^#[0-9a-fA-F]{6}$/, `${teamId} accent2`) // caps-js-exempt
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
