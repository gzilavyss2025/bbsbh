import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

import {
  DEV_DATA_STORES,
  DEV_DATA_MAX_BODY_BYTES,
  devDataStore,
  resolveStoreFile,
  serializeStore,
} from '../scripts/lib/dev-data-stores.mjs'

// The allowlist behind vite.config.js's devDataSave() middleware (ADR-0029).
// It is a security boundary — a request supplies a store KEY, never a path — so
// these pin both halves: that only known keys resolve, and that a malformed body
// is rejected before anything is written.

// --------------------------------------------------------------------------
// The allowlist itself
// --------------------------------------------------------------------------

test('every store writes inside the repo, to a real data path', () => {
  const repoRoot = path.resolve(import.meta.dirname, '..')
  for (const [key, store] of Object.entries(DEV_DATA_STORES)) {
    const abs = resolveStoreFile(store)
    assert.ok(abs.startsWith(repoRoot), `${key} escapes the repo`)
    assert.ok(
      store.file.startsWith('src/lib/data/') || store.file.startsWith('public/data/'),
      `${key} writes outside the data directories: ${store.file}`,
    )
    assert.equal(typeof store.validate, 'function', `${key} has no validator`)
  }
})

test('an unknown key resolves to no store at all', () => {
  assert.equal(devDataStore('nope'), null)
  assert.equal(devDataStore(''), null)
  assert.equal(devDataStore('../../etc/passwd'), null)
  assert.equal(devDataStore('src/lib/data/wpa-tuning.json'), null)
})

// The lookup must not fall through to Object.prototype: 'constructor' is a real
// property of every object literal, so a naive `STORES[key]` would hand back a
// function and the middleware would try to read `.file` off it.
test('a prototype key is not a store', () => {
  assert.equal(devDataStore('__proto__'), null)
  assert.equal(devDataStore('constructor'), null)
  assert.equal(devDataStore('toString'), null)
})

// store.file is always a literal from the allowlist, so this is defense in
// depth: it's what makes a careless future entry fail loudly at request time
// rather than quietly writing over source or CI config.
test('a store path outside the two data directories throws rather than resolving', () => {
  assert.throws(() => resolveStoreFile({ file: '../outside.json' }), /writable data directories/)
  assert.throws(() => resolveStoreFile({ file: 'src/lib/data/../../../../x.json' }), /writable data directories/)
  assert.throws(() => resolveStoreFile({ file: 'src/lib/teams.js' }), /writable data directories/)
  assert.throws(() => resolveStoreFile({ file: '.github/workflows/ci.yml' }), /writable data directories/)
  assert.throws(() => resolveStoreFile({ file: 'src/lib/data/nested/deep.json' }), /writable data directories/)
})

test('the body cap is a real ceiling, not a per-request setting', () => {
  assert.equal(DEV_DATA_MAX_BODY_BYTES, 256 * 1024)
})

// --------------------------------------------------------------------------
// Validators — a null return means "accepted"; a string is the 400's reason.
// --------------------------------------------------------------------------

const tuning = DEV_DATA_STORES['mlb-treatment-tuning'].validate
const colors = DEV_DATA_STORES['milb-colors'].validate
const names = DEV_DATA_STORES['uniform-names'].validate
const mlbColors = DEV_DATA_STORES['mlb-team-colors'].validate

test('a real tuning store shape is accepted', () => {
  assert.equal(
    tuning({
      158: {
        name: 'Milwaukee Brewers',
        treatments: {
          main: { bgHex: '#FFF5EA', note: 'cream, not one of the three brand swatches' },
          alternate: { scale: 0.86, offsetX: 4, pinstripeColor: 'rgba(0, 0, 0, 0.16)' },
          'city-connect': { header: { bar: '#0C436A', accent: '#ff6c58', onBar: '#FBF6E9' } },
        },
      },
    }),
    null,
  )
})

test('a tuning store with a team-level field (wpa-tuning bandColor) is accepted', () => {
  assert.equal(tuning({ 109: { name: 'Arizona Diamondbacks', bandColor: '#E3D4AD', treatments: {} } }), null)
})

test('an empty store is accepted — every entry can legitimately be cleared', () => {
  assert.equal(tuning({}), null)
})

test('a tuning store rejects a non-object, an array, and a non-team key', () => {
  assert.match(tuning([]), /object keyed by team id/)
  assert.match(tuning(null), /object keyed by team id/)
  assert.match(tuning('x'), /object keyed by team id/)
  assert.match(tuning({ brewers: { treatments: {} } }), /not a team id/)
})

test('a tuning store rejects a bad treatment key or a non-object record', () => {
  assert.match(tuning({ 158: { treatments: { 'Main Uniform!': {} } } }), /bad treatment key/)
  assert.match(tuning({ 158: { treatments: { main: 'blue' } } }), /is not an object/)
  assert.match(tuning({ 158: { treatments: [] } }), /treatments is not an object/)
})

test('a tuning store rejects a value too deep to be a tuning field', () => {
  assert.match(
    tuning({ 158: { treatments: { main: { header: { bar: { nested: true } } } } } }),
    /is not a tuning value/,
  )
  assert.match(tuning({ 158: { treatments: { main: { scale: 'NaN-ish'.repeat(200) } } } }), /not a tuning value/)
})

// JSON can carry these keys, so the validators reject them rather than letting
// a save write a file that poisons Object.prototype on the next import. Built
// with JSON.parse, not an object literal: `{ __proto__: … }` in source SETS the
// prototype instead of creating the own property a posted body would have.
test('a tuning store rejects prototype-poisoning keys at every level', () => {
  assert.match(tuning(JSON.parse('{"__proto__":{"treatments":{}}}')), /object keyed by team id/)
  assert.match(tuning(JSON.parse('{"158":{"__proto__":{},"treatments":{}}}')), /is not an object/)
  assert.match(
    tuning(JSON.parse('{"158":{"treatments":{"__proto__":{}}}}')),
    /treatments is not an object/,
  )
  assert.match(
    tuning(JSON.parse('{"158":{"treatments":{"main":{"__proto__":{}}}}}')),
    /main is not an object/,
  )
})

test('a milb-colors entry needs a name and a two-color pair', () => {
  assert.equal(
    colors({ 234: { name: 'Durham Bulls', level: 'Triple-A', pair: ['#0054A4', '#B15C12'] } }),
    null,
  )
  assert.equal(colors({ 234: { name: 'Durham Bulls', level: null } }), null) // an unresolved club
  assert.match(colors({ 234: { pair: ['#0054A4', '#B15C12'] } }), /has no name/)
  assert.match(colors({ 234: { name: 'Durham Bulls', pair: ['#0054A4'] } }), /not two colors/)
  assert.match(colors({ 234: { name: 'Durham Bulls', pair: '#0054A4' } }), /not two colors/)
  assert.match(colors({ 234: { name: 'Durham Bulls', pair: [1, 2] } }), /not two colors/)
})

test('a milb-colors entry carries its provenance, checked rather than waved through', () => {
  assert.equal(
    colors({
      546: {
        name: 'Portland Sea Dogs',
        level: 'Double-A',
        pair: ['#e03a3e', '#003263'],
        third: '#cbccce',
        confidence: 'low',
        source: 'sportsfancovers.com',
        note: 'CONFLICTING sources: …', // caps-js-exempt
      },
    }),
    null,
  )
  assert.match(colors({ 234: { name: 'Durham Bulls', confidence: 'pretty sure' } }), /high\/medium\/low/)
  assert.match(colors({ 234: { name: 'Durham Bulls', third: 42 } }), /third is not a color/)
  assert.match(colors({ 234: { name: 'Durham Bulls', source: 42 } }), /source is not a string/)
  assert.match(colors({ 234: { name: 'Durham Bulls', found: 'no' } }), /found is not a boolean/)
})

test('a milb-colors entry may not be found:false AND carry a pair', () => {
  // The cross-field rule that keeps an unresolved club visibly unresolved —
  // an entry claiming both would put an invented hex on step 1 of the chain
  // while still reading as "research found nothing" everywhere else.
  assert.equal(colors({ 482: { name: 'Corpus Christi Hooks', found: false } }), null)
  assert.match(
    colors({ 482: { name: 'Corpus Christi Hooks', found: false, pair: ['#002D62', '#EB6E1F'] } }),
    /found:false but carries a pair/,
  )
})

test('a real mlb-team-colors entry is accepted, extras and all', () => {
  assert.equal(
    mlbColors({
      158: {
        name: 'Milwaukee Brewers',
        primary: '#12284B',
        secondary: '#FFC52F',
        accent: '#FFC52F',
        accent2: '#6CACE4',
        offDayTreatment: 'alternate',
        extras: [{ label: 'Powder Blue', hex: '#6CACE4' }],
        note: 'why this club is odd',
      },
    }),
    null,
  )
  // Every colour field is optional — a club may legitimately have only a pair,
  // and clearing a role in the lab writes an ABSENT field, never an empty one.
  assert.equal(mlbColors({ 108: { name: 'Los Angeles Angels' } }), null)
  assert.equal(mlbColors({}), null)
})

test('an mlb-team-colors store rejects a non-object, a bad key, and a blank colour', () => {
  assert.match(mlbColors(['not', 'a', 'map']), /object keyed by team id/)
  assert.match(mlbColors({ notATeam: { name: 'X' } }), /is not a team id/)
  assert.match(mlbColors({ 158: 'navy' }), /is not an object/)
  assert.match(mlbColors({ 158: {} }), /has no name/)
  // '' is the shape a naive "clear this swatch" write would produce; it must
  // bounce here so the delete-on-empty rule in the lab stays the only path.
  assert.match(mlbColors({ 158: { name: 'Brewers', primary: '' } }), /primary is not a color/)
  assert.match(mlbColors({ 158: { name: 'Brewers', accent: 42 } }), /accent is not a color/)
  assert.match(mlbColors({ 158: { name: 'Brewers', note: 7 } }), /note is not a string/)
  assert.match(
    mlbColors({ 158: { name: 'Brewers', offDayTreatment: 'throwback' } }),
    /offDayTreatment "throwback" is not a known treatment/,
  )
})

test('an mlb-team-colors store rejects a malformed extras list', () => {
  const named = (extras) => ({ 158: { name: 'Brewers', extras } })
  assert.match(mlbColors(named({ label: 'Gold', hex: '#FEC52E' })), /extras is not a list/)
  assert.match(mlbColors(named(['#FEC52E'])), /malformed extra/)
  assert.match(mlbColors(named([{ hex: '#FEC52E' }])), /unlabeled extra/)
  assert.match(mlbColors(named([{ label: 'Gold' }])), /"Gold" extra is not a color/)
  assert.match(mlbColors(named([{ label: 'Gold', hex: '' }])), /"Gold" extra is not a color/)
})

test('an mlb-team-colors store rejects prototype-poisoning keys at every level', () => {
  assert.match(mlbColors(JSON.parse('{"__proto__": {"name": "x"}}')), /object keyed by team id/)
  assert.match(mlbColors(JSON.parse('{"158": {"name": "B", "__proto__": {"x": 1}}}')), /is not an object/)
  assert.match(
    mlbColors(JSON.parse('{"158": {"name": "B", "extras": [{"label": "G", "hex": "#fff", "__proto__": {"x": 1}}]}}')),
    /malformed extra/,
  )
})

test('uniform names must stay a flat code -> string map', () => {
  assert.equal(names({ '158_jersey_1_2026': 'Home Cream' }), null)
  assert.equal(names({}), null)
  assert.match(names(['not', 'a', 'map']), /flat \{ uniformAssetCode: string \} map/)
  assert.match(names({ '158_jersey_1_2026': { nested: true } }), /flat \{ uniformAssetCode: string \} map/)
  assert.match(names({ '158_jersey_1_2026': 3 }), /flat \{ uniformAssetCode: string \} map/)
})

// --------------------------------------------------------------------------
// Serialization — what actually lands on disk
// --------------------------------------------------------------------------

test('a team-keyed store is written sorted by team id, 2-space, trailing newline', () => {
  const out = serializeStore({ 158: { name: 'Brewers' }, 109: { name: 'Diamondbacks' }, 1956: {} })
  assert.equal(out, `${JSON.stringify({ 109: { name: 'Diamondbacks' }, 158: { name: 'Brewers' }, 1956: {} }, null, 2)}\n`)
  // Numeric, not lexical: 1956 sorts after 158, and 109 comes first.
  assert.ok(out.indexOf('"109"') < out.indexOf('"158"'))
  assert.ok(out.indexOf('"158"') < out.indexOf('"1956"'))
})

test('a store with non-numeric keys keeps the order it was posted in', () => {
  const posted = { b_jersey_2: 'Away', a_jersey_1: 'Home' }
  assert.equal(serializeStore(posted), `${JSON.stringify(posted, null, 2)}\n`)
})

// --------------------------------------------------------------------------
// mono-ink — which SHAPES of a club's logo art are the mark and which are the
// paper (src/lib/monoInk.js). The keys are shape ordinals and the values a
// closed two-word set, so a typo here would silently do nothing at generation
// time rather than fail — which is exactly why the validator catches it.
// --------------------------------------------------------------------------
const monoInk = DEV_DATA_STORES['mono-ink'].validate

test('a mono-ink entry pins numbered shapes to ink or knockout', () => {
  assert.equal(monoInk({}), null)
  assert.equal(
    monoInk({ 158: { name: 'Milwaukee Brewers', art: '5:1a2b3c', parts: { 0: 'ink', 3: 'knockout' } } }),
    null,
  )
  assert.match(monoInk({ 158: { parts: { 0: 'white' } } }), /not ink\/knockout/)
  assert.match(monoInk({ 158: { parts: { glove: 'ink' } } }), /bad part index/)
  assert.match(monoInk({ brewers: { parts: {} } }), /not a team id/)
  assert.match(monoInk({ 158: { art: 5 } }), /art is not a string/)
})

test('a mono-ink entry rejects a prototype-poisoning key at either level', () => {
  // Written through JSON.parse because an object LITERAL with a __proto__ key
  // sets the prototype instead of the key — a request body arrives parsed, and
  // that is the shape the validator has to answer for.
  assert.match(monoInk(JSON.parse('{"__proto__": {"parts": {}}}')), /expected an object keyed by team id/)
  assert.match(monoInk(JSON.parse('{"158": {"parts": {"__proto__": "ink"}}}')), /parts is not an object/)
})
