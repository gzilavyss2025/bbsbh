// The player page's Pitches and Command scope (#1503): Regular, Postseason, All.
// All is the sum of the two parts (ADR-0094), and nothing is written over.
import test from 'node:test'
import assert from 'node:assert/strict'
import { arsenalScoped, pitchArsenalFor, postPitchesOf, heatView } from '../src/api/pitchArsenal.js'
import { combineCommandEntries } from '../src/lib/seasons/combine.js'
import { commandView } from '../src/api/commandMap.js'
import { parseRoute, playerTabPath } from '../src/lib/route.js'

const cells = (n) => Array.from({ length: 25 }, (_, i) => (i === 12 ? n : 0))
const data = () => ({
  pit: {
    7: {
      name: 'A',
      throws: 'R',
      mlb: [
        { code: 'FF', description: 'Four-Seam', pitches: 300, avgVelo: 96, century: 10, maxVelo: 99.5 },
        { code: 'SL', description: 'Slider', pitches: 100, avgVelo: 86, century: 0, maxVelo: 88 },
      ],
      aaa: [],
    },
  },
  post: {
    7: { name: 'A', throws: 'R', mlb: [{ code: 'FF', description: 'Four-Seam', pitches: 100, avgVelo: 98, century: 6, maxVelo: 101 }], aaa: [] },
    8: { name: 'B', throws: 'L', mlb: [{ code: 'CH', description: 'Changeup', pitches: 40, avgVelo: 84 }], aaa: [] },
  },
})

test('Regular is the shard itself, so every number is unchanged', () => {
  const d = data()
  assert.equal(arsenalScoped(d, 7, 'reg'), d)
  assert.deepEqual(pitchArsenalFor(arsenalScoped(d, 7), 7, true), pitchArsenalFor(d, 7, true))
})

test('regular plus postseason equals All, pitch for pitch', () => {
  const d = data()
  const reg = pitchArsenalFor(arsenalScoped(d, 7, 'reg'), 7, true)
  const post = pitchArsenalFor(arsenalScoped(d, 7, 'post'), 7, true)
  const all = pitchArsenalFor(arsenalScoped(d, 7, 'all'), 7, true)
  const count = (rows, code) => rows.find((t) => t.code === code)?.pitches ?? 0
  for (const code of ['FF', 'SL']) assert.equal(count(all, code), count(reg, code) + count(post, code))
  // Velocity is weighted by pitches: (300 * 96 + 100 * 98) / 400.
  assert.equal(all.find((t) => t.code === 'FF').avgVelo, 96.5)
  const heat = heatView(arsenalScoped(d, 7, 'all'), 7, true)
  assert.equal(heat.count, 16)
  assert.equal(heat.maxVelo, 101)
})

test('building a scope writes nothing over either bucket', () => {
  const d = data()
  const before = JSON.stringify(d)
  arsenalScoped(d, 7, 'all')
  arsenalScoped(d, 7, 'post')
  assert.equal(JSON.stringify(d), before)
})

test('a postseason-only arm has a Postseason and All card and no Regular one', () => {
  const d = data()
  assert.equal(postPitchesOf(d, 8), 40)
  assert.equal(pitchArsenalFor(arsenalScoped(d, 8, 'reg'), 8, true), null)
  assert.equal(pitchArsenalFor(arsenalScoped(d, 8, 'post'), 8, true)[0].pitches, 40)
  assert.equal(pitchArsenalFor(arsenalScoped(d, 8, 'all'), 8, true)[0].pitches, 40)
})

test('an arm with no postseason pitches has none to offer', () => {
  const d = data()
  d.post = {}
  assert.equal(postPitchesOf(d, 7), 0)
  assert.deepEqual(arsenalScoped(d, 7, 'post').pit, {})
  assert.equal(pitchArsenalFor(arsenalScoped(d, 7, 'post'), 7, true), null)
})

test('command: two buckets add cell by cell, a missing field adds zeros', () => {
  const reg = { throws: 'R', mlb: { FF: { R: { cells: cells(5), whiffs: cells(1) } } }, aaa: {} }
  const post = { throws: 'R', mlb: { FF: { R: { cells: cells(3) } }, SL: { L: { cells: cells(2) } } }, aaa: {} }
  const all = combineCommandEntries([reg, post])
  assert.equal(all.mlb.FF.R.cells[12], 8)
  assert.equal(all.mlb.FF.R.whiffs[12], 1)
  assert.equal(all.mlb.SL.L.cells[12], 2)
  assert.equal(commandView(reg).pitches + commandView(post).pitches, commandView(all).pitches)
  // The inputs are untouched.
  assert.equal(reg.mlb.FF.R.cells[12], 5)
  assert.equal(combineCommandEntries([null, null]), null)
})

test('the scope rides the address: absent is Regular, a bad value is dropped', () => {
  const at = (qs) => parseRoute(`/player/tarik-skubal-669373/analytics${qs}`)
  assert.equal('scope' in at(''), false)
  assert.equal(at('?scope=post').scope, 'post')
  assert.equal(at('?scope=all').scope, 'all')
  assert.equal('scope' in at('?scope=bogus'), false)
  assert.match(playerTabPath(669373, 'analytics', { scope: 'post' }), /\?scope=post$/)
  assert.doesNotMatch(playerTabPath(669373, 'analytics', { scope: 'reg' }), /scope/)
})
