// Offline check before any live run. Prints counts only.
//   node selftest.mjs [--gamePk=823035]
// 1. shape.mjs lets no score-like value through.
// 2. patch.mjs is immutable and merges REAL patches from a finished game into
//    exactly the snapshot MLB serves for the same timecode.
import assert from 'node:assert/strict'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { applyPatch } from './patch.mjs'
import { shape, pathPrefix, classify } from './shape.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const gamePk = Number(args.gamePk || 823035)
const BASE = '/api/v1.1/game'

// ---- 1. redaction -----------------------------------------------------------
const secret = { updateId: '20261024_001530', homeRuns: 7, awayRuns: 12, text: 'Smith homered to left', flag: true, nested: { runs: 9, who: 'Jones' }, list: [{ runs: 4 }, { runs: 5 }] }
const printed = JSON.stringify(shape(secret))
for (const leak of ['Smith', 'Jones', 'homered', '"7"', ':7', ':12', ':9', ':4', ':5']) {
  assert.ok(!printed.includes(leak), `shape leaked ${leak}: ${printed}`)
}
assert.ok(printed.includes('20261024_001530'), 'a timecode must survive')
assert.equal(pathPrefix('/liveData/linescore/teams/home/runs'), '/liveData/linescore')
assert.equal(classify('Gameday5').ack, true)
assert.equal(classify('{"a":1}').json.a, 1)
console.log('redaction: ok')

// ---- 2a. applier rules ------------------------------------------------------
const base = { a: { b: [1, 2, 3] }, 'x/y': 1, 'm~n': 2 }
const frozen = JSON.stringify(base)
const out = applyPatch(base, [
  { op: 'add', path: '/a/b/-', value: 4 },
  { op: 'add', path: '/a/b/0', value: 0 },
  { op: 'replace', path: '/x~1y', value: 9 },
  { op: 'remove', path: '/m~0n' },
  { op: 'copy', from: '/a/b', path: '/c' },
  { op: 'move', from: '/c', path: '/d' },
  { op: 'test', path: '/d/0', value: 0 },
])
assert.equal(JSON.stringify(base), frozen, 'input mutated')
assert.deepEqual(out, { a: { b: [0, 1, 2, 3, 4] }, 'x/y': 9, d: [0, 1, 2, 3, 4] })
assert.notEqual(applyPatch(base, []), base, 'an empty patch must still return a new root')
assert.throws(() => applyPatch(base, [{ op: 'replace', path: '/nope', value: 1 }]))
assert.throws(() => applyPatch(base, [{ op: 'test', path: '/a/b/0', value: 99 }]))
console.log('applier rules: ok')

// ---- 2b. real patches vs real snapshots ------------------------------------
const get = (path) => getJson(path)
const stamps = await get(`${BASE}/${gamePk}/feed/live/timestamps`)
let merged = 0
let fallbacks = 0
for (const i of [60, 150, 240, 330]) {
  const [a, b] = [stamps[i], stamps[i + 3]]
  const start = await get(`${BASE}/${gamePk}/feed/live?timecode=${a}`)
  const patches = await get(`${BASE}/${gamePk}/feed/live/diffPatch?language=en&startTimecode=${a}&endTimecode=${b}`)
  if (!Array.isArray(patches)) { fallbacks++; continue }
  let doc = start
  for (const p of patches) doc = applyPatch(doc, p.diff)
  const want = await get(`${BASE}/${gamePk}/feed/live?timecode=${doc.metaData.timeStamp}`)
  assert.deepStrictEqual(doc, want, `merge differs at ${a} -> ${doc.metaData.timeStamp}`)
  assert.notEqual(doc, start)
  merged++
}
console.log(`real patches: ${merged} merged equal to the served snapshot, ${fallbacks} full-feed fallbacks`)
assert.ok(merged >= 2, 'too few real merges to trust the applier')
