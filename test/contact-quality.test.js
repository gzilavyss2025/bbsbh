// Contact replay phase B: the quality line's figures and verdict (docs/contact-replay.md §7.2),
// the swing-duration clamp (§6.2), squared-up (§3.4) and the MLB-only fetch (§2 decision 4).
import assert from 'node:assert/strict'
import test from 'node:test'
import { HARD_LUCK_XBA, LUCKY_XBA, qualityFigures, ringStrength, squaredUp, swingSeconds, verdictFor } from '../src/lib/pitcherCard/quality.js'
import { fetchAtBatTracking } from '../src/api/savant/gameFeed.js'

const inplay = { swing: 'inplay', mph: '90.0', hit: { exitVelo: 100 } }
const tr = (o) => ({ batSpeed: 72, xba: 0.3, barrel: false, hrParks: null, ...o })
const verdict = (eventType, o) => verdictFor(eventType, tr(o))

test('verdict: a hard-hit out is a Hard-luck out, at and above .500 only', () => {
  assert.equal(HARD_LUCK_XBA, 0.5)
  assert.equal(verdict('field_out', { xba: 0.5 }), 'Hard-luck out')
  assert.equal(verdict('line_out', { xba: 0.69 }), 'Hard-luck out')
  assert.equal(verdict('field_out', { xba: 0.499 }), null)
})

test('verdict: a weak hit is a Lucky hit, below .250 only', () => {
  assert.equal(LUCKY_XBA, 0.25)
  assert.equal(verdict('single', { xba: 0.249 }), 'Lucky hit')
  assert.equal(verdict('single', { xba: 0.25 }), null)
  assert.equal(verdict('field_out', { xba: 0.1 }), null)
})

test('verdict: Barrel when neither rule fires; a barrel out is a Hard-luck out first', () => {
  assert.equal(verdict('home_run', { xba: 0.96, barrel: true }), 'Barrel')
  assert.equal(verdict('field_out', { xba: 0.69, barrel: true }), 'Hard-luck out')
  assert.equal(verdict('single', { xba: 0.6, barrel: false }), null)
  assert.equal(verdict('field_error', { xba: 0.9 }), null)
  assert.equal(verdictFor('single', undefined), null)
})

test('squared up above 100% shows 100%; the ring caps at 1', () => {
  assert.ok(squaredUp(120, 60, 80) > 1)
  const { figs } = qualityFigures({ ...inplay, hit: { exitVelo: 120 } }, tr({ batSpeed: 60 }), { eventType: 'single', mlb: true })
  assert.deepEqual(figs[1], { num: '100%', label: 'squared up' })
  assert.equal(ringStrength(1.4), 1)
  assert.equal(ringStrength(null), 0.8)
})

test('swing duration: 0.16 s x 72 / bat speed, clamped to 0.14-0.18 s', () => {
  assert.equal(swingSeconds(72), 0.16)
  assert.equal(swingSeconds(40), 0.18)
  assert.equal(swingSeconds(100), 0.14)
  assert.equal(swingSeconds(null), 0.16)
})

test('in play, MLB: all figures, the HR parks, and the waiting figure before bat speed', () => {
  const full = qualityFigures(inplay, tr({ xba: 0.96, hrParks: 30 }), { eventType: 'home_run', mlb: true })
  assert.deepEqual(full.figs.map((f) => f.label), ['mph off the bat', 'squared up', 'xBA', 'HR parks'])
  assert.equal(full.figs[2].num, '.960')
  assert.equal(full.figs[3].num, '30/30')
  const wait = qualityFigures(inplay, undefined, { eventType: 'single', mlb: true })
  assert.deepEqual(wait.figs[1], { num: '—', label: 'squared up · waits for bat speed', wait: true })
})

test('MiLB: exit velocity only, no waiting figures', () => {
  assert.deepEqual(qualityFigures(inplay, undefined, { eventType: 'single', mlb: false }).figs, [{ num: '100.0', label: 'mph off the bat' }])
})

test('whiff and foul: bat speed (and a whiff, its horizontal break)', () => {
  const whiff = qualityFigures({ swing: 'whiff', breakH: -2.2 }, tr({ batSpeed: 71.4 }), { mlb: true })
  assert.deepEqual(whiff.figs, [{ num: '71.4', label: 'mph bat speed' }, { num: '2.2 in', label: 'horizontal break' }])
  assert.deepEqual(qualityFigures({ swing: 'foul' }, tr({ batSpeed: 71.4 }), { mlb: true }).figs, [{ num: '71.4', label: 'mph bat speed' }])
})

test('a MiLB game makes no /gf call', async () => {
  const real = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('no fetch') }
  try {
    assert.equal((await fetchAtBatTracking(1, 11, ['a'])).size, 0)
    assert.equal(calls, 0)
  } finally { globalThis.fetch = real }
})

// Savant's parse (gameFeed.js `num`) gives batSpeed: null for a swing whose bat speed has not arrived. `1.23 * null`
// is 0, so squaredUp read it as a measured zero and showed "100%" and a full ring instead of waiting.
test('squaredUp: a null bat speed or a null exit speed is unknown, not zero', () => {
  assert.equal(squaredUp(100, null, 90), null)
  assert.equal(squaredUp(100, 0, 90), null)
  assert.equal(squaredUp(null, 72, 90), null)
  assert.equal(squaredUp(100, undefined, 90), null)
})

test('a row with a null bat speed shows the waiting figure and the default ring', () => {
  const { figs } = qualityFigures(inplay, tr({ batSpeed: null }), { eventType: 'single', mlb: true })
  assert.deepEqual(figs[1], { num: '—', label: 'squared up · waits for bat speed', wait: true })
  assert.equal(ringStrength(squaredUp(100, null, 90)), 0.8)
})

// #1771 later pass (docs/contact-replay.md §7.3): the pencil notes.
import { BLAST_SUM, swingNotes } from '../src/lib/pitcherCard/quality.js'
import { atBatScenePitches } from '../src/lib/pitcherCard/atBat.js'

test('notes: Blast at squared-up % + bat speed >= 164, else Fast swing at 75 mph', () => {
  assert.equal(BLAST_SUM, 164)
  const p = { swing: 'inplay', mph: '90.0', hit: { exitVelo: 85 } }
  assert.deepEqual(swingNotes({ ...p, hit: { exitVelo: 111 } }, { batSpeed: 78 }), ['Blast']) // 111 / (1.23*78+19.04) ~ 98% + 78
  assert.deepEqual(swingNotes(p, { batSpeed: 76 }), ['Fast swing']) // ~76% + 76
  assert.deepEqual(swingNotes(p, { batSpeed: 70 }), [])
  assert.deepEqual(swingNotes({ swing: 'whiff' }, { batSpeed: 76 }), ['Fast swing'])
  assert.deepEqual(swingNotes(p, { batSpeed: null }), []) // waiting is no note
  assert.deepEqual(swingNotes(p, undefined), [])
})

test('notes: shortened up only at two strikes and 5 mph under his own norm', () => {
  const w = { swing: 'whiff', twoStrikes: true }
  assert.deepEqual(swingNotes(w, { batSpeed: 66 }, { norm: 71 }), ['Shortened up with two strikes'])
  assert.deepEqual(swingNotes(w, { batSpeed: 66.5 }, { norm: 71 }), [])
  assert.deepEqual(swingNotes({ swing: 'whiff' }, { batSpeed: 60 }, { norm: 71 }), [])
  assert.deepEqual(swingNotes(w, { batSpeed: 60 }, {}), [])
})

test('notes: topped and under come from launch minus attack angle, final tier only', () => {
  const p = (launchAngle) => ({ swing: 'inplay', mph: '90.0', hit: { exitVelo: 80, launchAngle } })
  assert.deepEqual(swingNotes(p(-12), { batSpeed: 65, attackDeg: 10 }), ['Topped it']) // -22
  assert.deepEqual(swingNotes(p(55), { batSpeed: 65, attackDeg: 8 }), ['Got under it']) // 47
  assert.deepEqual(swingNotes(p(20), { batSpeed: 65, attackDeg: 10 }), [])
  assert.deepEqual(swingNotes(p(-30), { batSpeed: 65 }), []) // no CSV row: pencil, no note
})

test('qualityFigures carries the notes; MiLB none', () => {
  const p = { swing: 'whiff', twoStrikes: false }
  assert.deepEqual(qualityFigures(p, { batSpeed: 77 }, { eventType: 'strikeout', mlb: true }).notes, ['Fast swing'])
  assert.deepEqual(qualityFigures(p, { batSpeed: 77 }, { eventType: 'strikeout', mlb: false }).notes, [])
})

test('scene pitches know the two-strike count from the pitch before', () => {
  const d = (no, strikes) => ({ no, strikes, balls: 0, typeCode: 'FF', mph: 95, cat: 'whiff' })
  const out = atBatScenePitches([d(1, 1), d(2, 2), d(3, 2)])
  assert.deepEqual(out.map((x) => x.twoStrikes), [false, false, true].slice(0, out.length))
})
