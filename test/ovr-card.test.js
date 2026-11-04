import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

import { TIERS, tierFor } from '../src/lib/ovr/tiers.js'
import {
  SEGMENTS,
  countUpValue,
  filledSegments,
  meterMarks,
  ovrView,
  seasonsLine,
} from '../src/lib/ovr/card.js'

// The OVR card (#1703): a tile and a menu on the player page. The cut points are
// placeholders Gary tunes; these pin the edges so a retune moves them on purpose.

test('tierFor: every edge of every tier', () => {
  const at = (n) => tierFor(n).key
  assert.equal(at(20), 'bench')
  assert.equal(at(44), 'bench')
  assert.equal(at(45), 'starter')
  assert.equal(at(59), 'starter')
  assert.equal(at(60), 'regular')
  assert.equal(at(69), 'regular')
  assert.equal(at(70), 'allstar')
  assert.equal(at(79), 'allstar')
  assert.equal(at(80), 'mvp')
  assert.equal(at(89), 'mvp')
  assert.equal(at(90), 'legend')
  assert.equal(at(99), 'legend')
})

test('tierFor: a value off the band takes the nearest tier', () => {
  assert.equal(tierFor(0).key, 'bench')
  assert.equal(tierFor(100).key, 'legend')
})

test('TIERS: no tier name is a name from The Show', () => {
  const names = TIERS.map((t) => t.name.toLowerCase())
  for (const banned of ['bronze', 'silver', 'gold', 'diamond']) {
    assert.ok(!names.includes(banned), banned)
  }
})

test('filledSegments: 20 segments, the floor still shows some, the cap fills all', () => {
  assert.equal(SEGMENTS, 20)
  assert.equal(filledSegments(20), 4)
  assert.equal(filledSegments(74), 15)
  assert.equal(filledSegments(99), 20)
})

test('countUpValue: starts at 20, ends on exactly the value, never goes back', () => {
  assert.equal(countUpValue(0, 74), 20)
  assert.equal(countUpValue(1, 74), 74)
  assert.equal(countUpValue(2, 74), 74)
  let was = 20
  for (let i = 1; i <= 100; i += 1) {
    const v = countUpValue(i / 100, 74)
    assert.ok(v >= was && v <= 74)
    was = v
  }
  assert.equal(countUpValue(1, 99), 99)
  assert.equal(countUpValue(1, 20), 20)
})

test('meterMarks: OVR, POT and the level cap sit on the 20-99 scale', () => {
  const m = meterMarks({ ovr: 52, pot: 93, level: 12 })
  assert.equal(m.cap.value, 55)
  assert.ok(Math.abs(m.ovr - ((52 - 20) / 79) * 100) < 1e-9)
  assert.ok(Math.abs(m.pot - ((93 - 20) / 79) * 100) < 1e-9)
  assert.ok(m.ovr < m.cap.at && m.cap.at < m.pot)
})

test('meterMarks: no POT, no POT mark; a level with no cap, no cap mark', () => {
  const m = meterMarks({ ovr: 40, pot: null, level: 13 })
  assert.equal(m.pot, null)
  assert.equal(m.cap.value, 45)
  assert.equal(meterMarks({ ovr: 40, level: 99 }).cap, null)
})

test('meterMarks: the five caps', () => {
  const caps = [11, 12, 13, 14, 16].map((l) => meterMarks({ ovr: 30, level: l }).cap.value)
  assert.deepEqual(caps, [58, 55, 45, 39, 30])
})

test('seasonsLine: one season, a run, and a gap', () => {
  assert.equal(seasonsLine([2023]), 'Based on 2023')
  assert.equal(seasonsLine([2026, 2025, 2024, 2023]), 'Based on 2023-2026')
  assert.equal(seasonsLine([2026, 2025, 2023]), 'Based on 2023, 2025-2026')
  assert.equal(seasonsLine([2026, 2024]), 'Based on 2024, 2026')
  assert.equal(seasonsLine([2025, 2026]), 'Based on 2025-2026')
})

test('seasonsLine: no seasons, no line', () => {
  assert.equal(seasonsLine([]), '')
  assert.equal(seasonsLine(undefined), '')
})

const hitter = {
  ovr: 74,
  bars: { contact: 71, power: 82, speed: 58, fielding: 66 },
  seasons: [2026, 2025],
}

test('ovrView: a hitter gets four rows, in the menu order', () => {
  const v = ovrView({ rating: hitter, group: 'hitting' })
  assert.deepEqual(v.rows.map((r) => r.label), ['Power', 'Contact', 'Speed', 'Fielding'])
  assert.deepEqual(v.rows.map((r) => r.value), [82, 71, 58, 66])
  assert.equal(v.rows[0].tier.key, 'mvp')
  assert.equal(v.rows[0].filled, filledSegments(82))
  assert.equal(v.tier.key, 'allstar')
})

test('ovrView: a pitcher gets Stuff, Results, Control', () => {
  const v = ovrView({
    rating: { ovr: 60, bars: { control: 50, stuff: 66, results: 61 }, seasons: [2026] },
    group: 'pitching',
  })
  assert.deepEqual(v.rows.map((r) => r.label), ['Stuff', 'Results', 'Control'])
})

test('ovrView: a bar that does not exist draws no row', () => {
  const v = ovrView({
    rating: { ovr: 70, bars: { contact: 71, power: 82, speed: 58 }, seasons: [2026] },
    group: 'hitting',
  })
  assert.deepEqual(v.rows.map((r) => r.label), ['Power', 'Contact', 'Speed'])
})

test('ovrView: a minor leaguer has no bars, and a level meter instead', () => {
  const v = ovrView({
    rating: { ovr: 52, level: 12, pot: 93, seasons: [2026] },
    group: 'hitting',
  })
  assert.deepEqual(v.rows, [])
  assert.equal(v.minor.pot, 93)
  assert.equal(v.minor.levelLabel, 'AA')
  assert.equal(v.minor.marks.cap.value, 55)
})

test('ovrView: a minor leaguer off the Top 100 has a dash for POT and no POT mark', () => {
  const v = ovrView({ rating: { ovr: 33, level: 13, seasons: [2026] }, group: 'pitching' })
  assert.equal(v.minor.pot, null)
  assert.equal(v.minor.marks.pot, null)
})

test('ovrView: no change value draws no arrow and no zero', () => {
  const v = ovrView({ rating: hitter, group: 'hitting', history: [] })
  assert.equal(v.change, null)
  assert.equal(v.spark, null)
  // one real snapshot is not a change either
  const one = ovrView({ rating: hitter, group: 'hitting', history: [{ date: '2026-10-08', ovr: 74, bars: null, seeded: false }] })
  assert.equal(one.change, null)
})

const snap = (date, ovr, seeded = false) => ({ date, ovr, bars: null, seeded })

test('ovrView: a rise is a signed number with an up arrow, a fall with a down arrow', () => {
  const up = ovrView({ rating: hitter, group: 'hitting', history: [snap('2026-09-30', 71), snap('2026-10-08', 74)] })
  assert.deepEqual(up.change, { delta: 3, days: 8, dir: 'up', text: '+3' })
  const down = ovrView({ rating: hitter, group: 'hitting', history: [snap('2026-09-30', 76), snap('2026-10-08', 74)] })
  assert.deepEqual(down.change, { delta: -2, days: 8, dir: 'down', text: '-2' })
})

test('ovrView: a change of exactly zero shows the zero and no arrow', () => {
  const v = ovrView({ rating: hitter, group: 'hitting', history: [snap('2026-09-30', 74), snap('2026-10-08', 74)] })
  assert.deepEqual(v.change, { delta: 0, days: 8, dir: 'flat', text: '0' })
})

test('ovrView: a sparse history says how far back the change really reaches', () => {
  const v = ovrView({ rating: hitter, group: 'hitting', history: [snap('2026-08-20', 70), snap('2026-10-01', 74)] })
  assert.equal(v.change.days, 42)
})

test('ovrView: a seeded percentile is not a rating, so it makes no change and no sparkline', () => {
  const v = ovrView({
    rating: { ovr: 40, level: 12, seasons: [2026] },
    group: 'hitting',
    history: [snap('2026-09-30', 60, true), snap('2026-10-08', 62, true)],
  })
  assert.equal(v.change, null)
  assert.equal(v.spark, null)
})

test('ovrView: the sparkline is this season\'s real ratings, and needs two points', () => {
  const v = ovrView({
    rating: hitter,
    group: 'hitting',
    history: [snap('2025-09-01', 60), snap('2026-04-01', 66), snap('2026-07-01', 70), snap('2026-10-08', 74)],
  })
  assert.deepEqual(v.spark, [66, 70, 74])
})

test('ovrView: the footer line comes from the seasons in the data', () => {
  const v = ovrView({ rating: { ...hitter, seasons: [2026, 2025, 2023] }, group: 'hitting' })
  assert.equal(v.seasons, 'Based on 2023, 2025-2026')
})

test('no string the card can show says "official"', () => {
  const views = [
    ovrView({ rating: hitter, group: 'hitting' }),
    ovrView({ rating: { ovr: 52, level: 12, pot: 93, seasons: [2026] }, group: 'hitting' }),
  ]
  assert.ok(!/official/i.test(JSON.stringify(views)))
  const dirs = ['src/lib/ovr', 'src/components/ovr', 'src/styles/ovr']
  for (const dir of dirs) {
    for (const f of readdirSync(dir)) {
      assert.ok(!/official/i.test(readFileSync(`${dir}/${f}`, 'utf8')), `${dir}/${f}`)
    }
  }
})
