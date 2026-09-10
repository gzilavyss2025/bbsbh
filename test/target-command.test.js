// Unit coverage for the OpenCommand reading layer — the pure helpers in
// scripts/lib/opencommand.mjs that every one of the three generators leans on,
// and src/api/targetCommand.js's row builder, which is what a reader actually
// sees.
//
// WHY THESE PIECES. The dataset itself is an outside file this repo does not
// control, so the parts worth pinning are the ones where a quiet wrong answer
// looks exactly like a right one: a percentile flipped the wrong way (a
// pitcher with the league's worst command shown at the 95th), a season mismatch
// silently printing last year's figures as this year's, and a scatter sample
// that redraws itself every night.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MIN_COMMAND_PITCHES,
  evenSample,
  median,
  percentileLowerIsBetter,
} from '../scripts/lib/opencommand.mjs'
import { targetCommandFor, targetCommandRows } from '../src/api/targetCommand.js'
import { pitchLabel } from '../src/api/pitchArsenal.js'

// ---------------------------------------------------------------------------
// median
// ---------------------------------------------------------------------------

test('median takes the middle of an odd run and the mean of an even one', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.equal(median([7]), 7)
})

test('median has nothing to say about an empty or missing sample', () => {
  assert.equal(median([]), null)
  assert.equal(median(undefined), null)
})

test('median does not disturb the caller array', () => {
  // The generators hold one array of misses and take several statistics off
  // it; a sort in place would silently reorder a scatter sample taken later.
  const misses = [9, 3, 12, 1]
  median(misses)
  assert.deepEqual(misses, [9, 3, 12, 1])
})

// ---------------------------------------------------------------------------
// percentileLowerIsBetter — the flip that makes the strip readable
// ---------------------------------------------------------------------------

test('a smaller miss ranks HIGHER, because lower is better', () => {
  const league = [8, 9, 10, 11, 12]
  const sharp = percentileLowerIsBetter(8, league)
  const wild = percentileLowerIsBetter(12, league)
  assert.ok(sharp > wild, `expected the 8in miss to outrank the 12in one, got ${sharp} vs ${wild}`)
  assert.ok(sharp >= 85, `the league's best command should sit near the top, got ${sharp}`)
  assert.ok(wild <= 15, `the league's worst should sit near the bottom, got ${wild}`)
})

test('the middle of the league lands near the middle of the scale', () => {
  const league = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  assert.equal(percentileLowerIsBetter(10.5, league), 50)
})

test('ties take the same rank, not the order they arrived in', () => {
  const league = [9, 9, 9, 12]
  const a = percentileLowerIsBetter(9, league)
  const b = percentileLowerIsBetter(9, [...league].reverse())
  assert.equal(a, b)
})

test('nobody is at the 0th or 100th percentile of a group holding him', () => {
  const league = Array.from({ length: 400 }, (_, i) => 8 + i / 100)
  assert.ok(percentileLowerIsBetter(8, league) <= 99)
  assert.ok(percentileLowerIsBetter(11.99, league) >= 1)
})

test('an unrankable value or an empty league yields no rank at all', () => {
  assert.equal(percentileLowerIsBetter(NaN, [1, 2]), null)
  assert.equal(percentileLowerIsBetter(9, []), null)
})

// ---------------------------------------------------------------------------
// evenSample — the scatter cap
// ---------------------------------------------------------------------------

test('a sample under the cap is kept whole', () => {
  assert.deepEqual(evenSample([1, 2, 3], 40), [1, 2, 3])
})

test('the cap is honoured exactly, and the same run twice gives the same dots', () => {
  const season = Array.from({ length: 517 }, (_, i) => i)
  const first = evenSample(season, 48)
  assert.equal(first.length, 48)
  assert.deepEqual(evenSample(season, 48), first)
})

test('the sample spans the whole season rather than only its opening', () => {
  // Taking the first N would draw April and call it a year. A stride has to
  // reach the far end of the run.
  const season = Array.from({ length: 500 }, (_, i) => i)
  const dots = evenSample(season, 50)
  assert.ok(dots[dots.length - 1] > 400, `expected the tail of the season, got ${dots[dots.length - 1]}`)
  assert.equal(dots[0], 0)
})

test('an empty season, or a cap of nothing, samples nothing', () => {
  assert.deepEqual(evenSample([], 10), [])
  assert.deepEqual(evenSample([1, 2, 3], 0), [])
})

// ---------------------------------------------------------------------------
// targetCommandFor — the season gate
// ---------------------------------------------------------------------------

const FILE = {
  season: 2026,
  median: { ALL: 9.9, FF: 9.4, SL: 10.2, CU: 11.0 },
  pit: {
    100: { ALL: [2000, 8.5, 95], FF: [1100, 7.8, 97], SL: [200, 10.6, 35] },
  },
}

test('a pitcher in the file for that season is found', () => {
  assert.ok(targetCommandFor(FILE, 100, 2026))
})

test("a page on a season the file does not hold shows nothing, rather than last year's command", () => {
  assert.equal(targetCommandFor(FILE, 100, 2025), null)
})

test('a pitcher absent from the file, or no file at all, degrades to nothing', () => {
  assert.equal(targetCommandFor(FILE, 999, 2026), null)
  assert.equal(targetCommandFor(null, 100, 2026), null)
  assert.equal(targetCommandFor({ season: null, pit: {} }, 100, 2026), null)
})

// ---------------------------------------------------------------------------
// targetCommandRows — what the strip draws
// ---------------------------------------------------------------------------

test('All pitches leads, then his own types by how often he threw them', () => {
  const rows = targetCommandRows(FILE.pit[100], FILE)
  assert.deepEqual(rows.map((r) => r.key), ['ALL', 'FF', 'SL'])
  assert.equal(rows[0].label, 'All pitches')
  assert.equal(rows[1].label, 'Fastball')
})

test('a row carries the pitcher figure, the league figure, and the rank', () => {
  const [all] = targetCommandRows(FILE.pit[100], FILE)
  assert.equal(all.value, '8.5')
  assert.equal(all.baseline, '9.9')
  assert.equal(all.percentile, 95)
  assert.equal(all.lowerIsBetter, true)
})

test('every row says a smaller number is better, since the arrow is what says so on screen', () => {
  for (const row of targetCommandRows(FILE.pit[100], FILE)) {
    assert.equal(row.lowerIsBetter, true, `${row.key} lost its down-arrow`)
  }
})

test('a pitch type with no league median still renders, without a baseline figure', () => {
  const rows = targetCommandRows({ ALL: [900, 9.1, 60], KN: [300, 12.0, 20] }, FILE)
  const kn = rows.find((r) => r.key === 'KN')
  assert.equal(kn.baseline, null)
  assert.ok(!/lighter number/.test(kn.def), 'the gloss should not describe a figure that is not printed')
})

test('an unranked pitch type is dropped rather than handed over with no track to draw', () => {
  // PercentileStrip renders a row's whole bar from its percentile and skips a
  // row without one; letting it through would leave a labelled blank line.
  const rows = targetCommandRows({ ALL: [900, 9.1, 60], FF: [500, 9.0, 55], KN: [80, 12.0, null] }, FILE)
  assert.deepEqual(rows.map((r) => r.key), ['ALL', 'FF'])
})

test('a one-pitch arsenal is not a strip — it would print the same figure twice', () => {
  assert.equal(targetCommandRows({ ALL: [600, 9.4, 50] }, FILE), null)
})

test('no entry at all draws nothing', () => {
  assert.equal(targetCommandRows(null, FILE), null)
})

test('the gloss names the sample the figure rests on', () => {
  const [all] = targetCommandRows(FILE.pit[100], FILE)
  assert.match(all.def, /2,000 pitches/)
})

test('an unknown pitch code falls back to the code rather than an empty label', () => {
  assert.equal(pitchLabel('ZZ'), 'ZZ')
  assert.equal(pitchLabel('FS'), 'Splitter')
})

test('the pitch floor is the same figure the command map uses', () => {
  assert.equal(MIN_COMMAND_PITCHES, 50)
})
