// The Target command module's pure view (src/screens/player/next/modules/target/targetView.js, #2015).
import test from 'node:test'
import assert from 'node:assert/strict'
import { cloudFor, targetView } from '../src/screens/player/next/modules/target/targetView.js'

// Robert Gasser, 2026, from public/data/target-command.json: {CODE: [pitches, median inches, percentile]}.
const entry = { ALL: [1075, 9.52, 66], CH: [100, 10.3, 52], FC: [192, 9.45, 40], FF: [263, 8.85, 71], SI: [241, 9.18, 51], ST: [279, 10.22, 59] }
const data = { season: 2026, median: { ALL: 9.87, FC: 9.16, FF: 9.4, CH: 10.34, ST: 10.46, SI: 9.18 } }
// glove-target/NN.json: 48 dots a pitch; one dot far past the 30 in rim.
const dots = Array.from({ length: 48 }, (_, i) => [Math.cos(i) * 8, Math.sin(i) * 8])
dots[0] = [60, 0]
const glove = { ALL: { n: 1075, miss: 9.5, dots, bias: [0.1, -0.7] }, FF: { n: 263, miss: 8.8, dots, bias: [-3.2, 2.5] } }

test('rows: All pitches first, then most thrown, looked up by code', () => {
  const v = targetView({ entry, data })
  assert.deepEqual(v.rows.map((r) => r.key), ['ALL', 'ST', 'FF', 'SI', 'FC', 'CH'])
  const ff = v.rows.find((r) => r.key === 'FF')
  assert.equal(ff.value, '8.8') // 8.85 through the reader's toFixed(1)
  assert.equal(ff.mlb, '9.4')
  assert.equal(ff.n, '263')
  assert.equal(ff.pct, '71st')
  assert.equal(ff.percentile, 71)
  assert.equal(ff.mark.code, 'FF')
  assert.equal(v.rows[0].mark, null)
})

test('count tag is the All pitches sample; no All row means no count', () => {
  assert.equal(targetView({ entry, data }).count, '1,075 tracked')
  const { ALL, ...rest } = entry
  assert.equal(targetView({ entry: rest, data }).count, undefined)
})

test('a missing MLB middle prints a dash with no unit', () => {
  const v = targetView({ entry, data: { season: 2026, median: {} } })
  assert.equal(v.rows[0].mlb, '—')
})

test('under two ranked rows, or no entry, there is no view', () => {
  assert.equal(targetView({ entry: { ALL: entry.ALL }, data }), null)
  assert.equal(targetView({ entry: { ALL: [10, 9.1, 50], KN: [10, 9.1, null] }, data }), null)
  assert.equal(targetView({ entry: null, data }), null)
})

test('credit line names the source and the licence', () => {
  assert.match(targetView({ entry, data }).credit.text, /OpenCommand 2026 · CC BY-NC-SA 4\.0/)
})

test('cloud: 48 dots in the catcher’s view, the rim dot clamped, rings and readout', () => {
  const v = targetView({ entry, data })
  const c = cloudFor(glove, v.rows[0])
  assert.equal(c.dots.length, 48)
  // x as the feed has it, the catcher's view (first base right); z up is screen up (negative y).
  assert.equal(c.dots[0].x, 30)
  assert.equal(c.dots[0].clamped, true)
  assert.equal(c.dots[1].clamped, false)
  assert.deepEqual(c.rings, [10, 20, 30])
  assert.equal(c.median, 9.52)
  assert.equal(c.league, 9.87)
  assert.equal(c.mark, null)
  assert.equal(c.readout, '9.5 in median miss · MLB 9.9 · 66th pct · 48 of 1,075 drawn')
  assert.equal(c.lean, 'No lean: the cloud sits on the glove')
  assert.match(c.aria, /median 9\.5 inches/)
  assert.match(c.aria, /MLB middle 9\.9/)
  assert.match(c.aria, /No lean/)
})

test('cloud: a lean is said in words, and a pitch draws its own mark', () => {
  const v = targetView({ entry, data })
  const c = cloudFor(glove, v.rows.find((r) => r.key === 'FF'))
  assert.equal(c.mark.code, 'FF')
  assert.equal(c.lean, 'Leans to the third-base side and high')
  assert.match(c.aria, /third-base side and high/)
})

test('cloud: a pitch with no glove entry gets none, never the All cloud', () => {
  const v = targetView({ entry, data })
  assert.equal(cloudFor(glove, v.rows.find((r) => r.key === 'ST')), null)
  assert.equal(cloudFor(null, v.rows[0]), null)
})

test('cloud: no MLB middle leaves the league ring and the readout clause out', () => {
  const v = targetView({ entry, data: { season: 2026, median: {} } })
  const c = cloudFor(glove, v.rows[0])
  assert.equal(c.league, null)
  assert.equal(c.readout, '9.5 in median miss · 66th pct · 48 of 1,075 drawn')
})
