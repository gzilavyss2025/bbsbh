// The Command module's pure view (src/screens/player/next/modules/command/commandModView.js, #2014).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { commandModView, levelOf } from '../src/screens/player/next/modules/command/commandModView.js'

// Robert Gasser's 2026 entry and the league block, from the stores on disk.
const shard = JSON.parse(readFileSync(new URL('../public/data/pitch-command/2026/07.json', import.meta.url), 'utf8'))
const league = JSON.parse(readFileSync(new URL('../public/data/pitch-command/2026/league.json', import.meta.url), 'utf8'))
const gasser = shard.pit['688107']
const byKey = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]))

test('no grid at the level: no view', () => {
  assert.equal(commandModView(null), null)
  assert.equal(commandModView({ throws: 'R', mlb: {} }), null)
  assert.equal(commandModView({ throws: 'R', aaa: { FF: { R: { cells: new Array(25).fill(0) } } } }), null)
})

test('the level: MLB when he has an MLB grid, else Triple-A', () => {
  assert.equal(levelOf(gasser), 'mlb')
  assert.equal(levelOf({ aaa: gasser.aaa }), 'aaa')
  assert.equal(levelOf({ mlb: {}, aaa: gasser.aaa }), 'aaa')
  assert.equal(levelOf({ mlb: { FF: { R: { cells: Array(25).fill(0) } } }, aaa: gasser.aaa }), 'aaa')
})

test('Gasser, all pitches, both hands: counts, chips, and the MLB line on the tiles', () => {
  const v = commandModView(gasser, { league })
  assert.equal(v.total, 1815)
  assert.deepEqual(v.hands.map((h) => [h.stand, h.label, h.n]), [[null, 'Both', 1815], ['L', 'vs LHB', 550], ['R', 'vs RHB', 1265]])
  assert.deepEqual(v.chips.map((c) => [c.code, c.n, c.thin]), [
    [null, 1815, false], ['ST', 459, false], ['FF', 425, false], ['SI', 408, false], ['FC', 333, false], ['CH', 187, false], ['SL', 3, true],
  ])
  const t = byKey(v.tiles, 'key')
  assert.equal(t.zonePct.value, '44%')
  assert.equal(t.zonePct.caption, 'MLB 40% · 95th')
  assert.equal(t.zonePct.lead, true)
  assert.equal(t.heartPct.caption, 'MLB 6% · 64th')
  assert.equal(t.firstZonePct.value, '47%')
  assert.equal(t.firstZonePct.caption, 'MLB 43% · 81st')
  assert.equal(t.whiffPct.value, '20%')
  assert.equal(t.whiffPct.caption, 'MLB 23% · 25th')
  assert.match(v.note, /^The MLB middle and his rank are among 469 pitchers with 500\+ pitches\. /)
  assert.equal(v.thin, null)
  assert.equal(v.cells.length, 25)
})

test('a filter: captions give the base, never a league rank', () => {
  const v = commandModView(gasser, { league, stand: 'L' })
  const t = byKey(v.tiles, 'key')
  assert.equal(t.zonePct.value, '44%')
  assert.equal(t.zonePct.caption, 'of 550 pitches')
  assert.match(t.whiffPct.caption, /^of \d+ swings$/)
  assert.match(t.firstZonePct.caption, /^of \d+ first pitches$/)
  assert.ok(!/MLB middle/.test(v.note))
  assert.equal(v.label, 'All pitches · vs left-handed batters')
})

test('a missing league block: the caption shows the base count only; a null rank shows the median only', () => {
  assert.equal(byKey(commandModView(gasser).tiles, 'key').zonePct.caption, 'of 1,815 pitches')
  const unranked = { ...league, minPitches: 5000 }
  const u = commandModView(gasser, { league: unranked })
  assert.equal(byKey(u.tiles, 'key').zonePct.caption, 'MLB 40%')
  assert.match(u.note, /^The MLB middle is among 469 pitchers with 5,000\+ pitches\. /)
  // A Triple-A grid never reads the MLB pool.
  assert.match(byKey(commandModView({ aaa: gasser.aaa }, { league }).tiles, 'key').zonePct.caption, /^of /)
})

test('a thin pitch: hatched chip, the too-few box with words built from the count, no map, dashes', () => {
  const v = commandModView(gasser, { league, stand: 'L', code: 'CH' })
  assert.equal(byKey(v.chips, 'code').CH.thin, true)
  assert.equal(v.thin, 'Only 8 changeups vs left-handed batters. Too few to draw a map (the floor is 50).')
  assert.equal(v.cells, null)
  assert.ok(v.tiles.every((t) => t.value === '—' && t.caption === 'too few pitches' && !t.lead))
  assert.equal(commandModView(gasser, { code: 'SL' }).thin, 'Only 3 sliders. Too few to draw a map (the floor is 50).')
  // A name that ends in s, and a code with no name, are not pluralized by a bare s.
  const few = (code) => commandModView({ mlb: { FF: { R: { cells: Array(25).fill(4) } }, [code]: { R: { cells: [12, ...Array(24).fill(0)] } } } }, { code }).thin
  assert.equal(few('EP'), 'Only 12 eephus pitches. Too few to draw a map (the floor is 50).')
  assert.equal(few('XX'), 'Only 12 XX pitches. Too few to draw a map (the floor is 50).')
})

test('a code the hand never saw falls back to ALL', () => {
  const v = commandModView({ mlb: { FF: { R: { cells: Array(25).fill(4) } }, SL: { L: { cells: Array(25).fill(1) } } } }, { stand: 'R', code: 'SL' })
  assert.equal(v.code, null)
  assert.deepEqual(v.chips.map((c) => c.code), [null, 'FF'])
})

test('cells run in camera view: the stored column is mirrored, each cell has words, heat steps, a readout', () => {
  const cells = Array(25).fill(0)
  cells[5] = 50 // stored row 1 (top third), col 0: the third-base side, a righty's inside
  cells[12] = 10 // the heart
  const entry = { mlb: { FF: { R: { cells, whiffs: Array(25).fill(0).map((_, i) => (i === 5 ? 1 : 0)), homers: Array(25).fill(0) } } } }
  const v = commandModView(entry, { stand: 'R', cell: 5 })
  // View row 1, view column 4 (camera right) holds stored cell 5.
  const shown = v.cells[1 * 5 + 4]
  assert.equal(shown.i, 5)
  assert.equal(shown.n, 50)
  assert.equal(shown.step, 5)
  assert.equal(shown.label, 'Top third, off the plate, inside to a righty: 50 pitches, 83%')
  assert.equal(v.cells[12].label, 'Middle third, middle: 10 pitches, 17%')
  assert.equal(v.cells[12].step, 1)
  assert.equal(v.cells[0].step, 0)
  assert.deepEqual(v.readout, { where: 'Top third, off the plate, inside to a righty', facts: ['50 pitches', '83% of his 60', '1 whiff', '0 called strikes', '0 HR'] })
  // Both hands: field words, no batter.
  assert.equal(commandModView(entry).cells[1 * 5 + 4].label, 'Top third, off the plate, 3B side: 50 pitches, 83%')
  assert.equal(commandModView(entry).cells[1 * 5 + 3].label, 'Top third, 3B-side third: 0 pitches, 0%')
})

test('pitch marks sit at each mapped pitch centroid in view units, thin pitches left off', () => {
  const v = commandModView(gasser)
  assert.deepEqual(v.marks.map((m) => m.code), ['ST', 'FF', 'SI', 'FC', 'CH'])
  for (const m of v.marks) assert.ok(m.x > 0 && m.x < 100 && m.y > 0 && m.y < 100)
  const one = commandModView(gasser, { code: 'FF' })
  assert.deepEqual(one.marks.map((m) => m.code), ['FF'])
  // A single cell's pitches sit at that cell's centre, mirrored.
  const cells = Array(25).fill(0)
  cells[5] = 60
  const c = commandModView({ mlb: { FF: { R: { cells } } } }).marks[0]
  assert.deepEqual([c.x, c.y], [90, 30])
})

test('a rank at either end of the pool reads 1st or 99th, never 0th or 100th', () => {
  const at = (r) => ({ ...league, zonePct: { ...league.zonePct, rates: league.zonePct.rates.map(() => r) } })
  assert.match(byKey(commandModView(gasser, { league: at(99) }).tiles, 'key').zonePct.caption, / · 1st$/)
  assert.match(byKey(commandModView(gasser, { league: at(1) }).tiles, 'key').zonePct.caption, / · 99th$/)
})
