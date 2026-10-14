import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'
import { MIN_CELL, OUTCOMES, fmtMph, fmtPct, outcomeFigures, pitchRows, pitchesVs, plateView } from '../src/screens/player/next/modules/plate/plateView.js'

// The batter Plate approach's pure view (#1887): swing, chase and in-zone rates, the way each
// pitch ended, and the 5 x 5 map, all from the hitter-grid counters. The board's numbers are samples.

const inZ = (row, col) => row > 0 && row < 4 && col > 0 && col < 4
const cells = (f) => Array.from({ length: 25 }, (_, i) => f(Math.floor(i / 5), i % 5))
// 10 pitches in every cell. A zone cell: 6 swings, 2 whiffs, 2 called, 2 in play (2 fouls, 2 balls).
// An outer cell: 2 swings, 1 whiff, 0 called, 0 in play (1 foul, 8 balls). Every pitch is 90 mph.
const counters = (over = {}) => ({
  pitches: cells(() => 10),
  swings: cells((r, c) => (inZ(r, c) ? 6 : 2)),
  whiffs: cells((r, c) => (inZ(r, c) ? 2 : 1)),
  calledStrikes: cells((r, c) => (inZ(r, c) ? 2 : 0)),
  inPlay: cells((r, c) => (inZ(r, c) ? 2 : 0)),
  speedSum: cells(() => 900),
  ...over,
})
const grid = (byCode, extra = {}) => ({ season: 2026, reg: { mlb: byCode }, post: null, plate: true, ...extra })
const one = (c) => grid({ FF: { R: { R: c } } })

test('the rates: swing, chase, in zone, whiff, speed', () => {
  const v = plateView(one(counters()))
  assert.equal(v.n, 250)
  assert.equal(v.rates.swing, 86 / 250)
  assert.equal(v.rates.chase, 32 / 160) // swings at the 16 outer cells over their pitches
  assert.equal(v.rates.zone, 90 / 250)
  assert.equal(v.rates.whiff, 34 / 86)
  assert.equal(v.rates.mph, 90)
})

test('how each pitch ended: in play, ball, foul, called, whiff', () => {
  assert.deepEqual(OUTCOMES, ['In play', 'Ball', 'Foul', 'Called', 'Whiff'])
  const v = plateView(one(counters()))
  assert.deepEqual(v.segs, [18, 146, 34, 18, 34])
  assert.equal(v.segs.reduce((a, b) => a + b), v.n)
  assert.equal(v.hit, (18 + 146) / 250)
  assert.equal(v.pitcher, (18 + 34) / 250)
})

test('no plate file: the three counters are null, so the mix and the speed are a dash, never 0', () => {
  const nul = { noPlate: true } // how joinPlate marks a path the plate file lacks
  const v = plateView(one(counters(nul)))
  assert.equal(v.segs, null)
  assert.equal(v.hit, null)
  assert.equal(v.rates.mph, null)
  assert.equal(v.rates.swing, 86 / 250) // the base shard still gives the rest
  assert.ok(v.cells.every((c) => c.hit == null && c.band == null))
  assert.equal(fmtPct(null), '—')
})

test('a cell under the floor prints nothing; the rest rank into five bands', () => {
  assert.equal(MIN_CELL, 10)
  const thin = counters({ pitches: cells((r, c) => (r === 0 && c === 0 ? 9 : 10)) })
  const v = plateView(one(thin))
  assert.equal(v.cells[0].hit, null)
  assert.equal(v.cells[0].band, null)
  assert.equal(v.cells[0].n, 9)
  // The outer cells are all balls and fouls (the hitter's outcomes); the zone cells are not.
  assert.ok(v.cells[12].band < v.cells[2].band)
  assert.equal(v.cells[12].band, v.cells[13].band) // equal shares, one band
  assert.ok(v.cells.every((c) => c.band == null || (c.band >= 0 && c.band <= 4)))
})

test('pitch rows: by pitch type, biggest first, a type under the floor left out; a hand filter narrows them', () => {
  const small = counters({ pitches: cells((r, c) => (r === 0 && c < 2 ? 1 : 0)) })
  const g = grid({
    FF: { R: { R: counters() } },
    SL: { L: { R: counters({ pitches: cells(() => 4) }) }, R: { R: counters({ pitches: cells(() => 4) }) } },
    CH: { R: { R: small } },
  })
  assert.deepEqual(pitchRows(g, null).map((r) => [r.code, r.n]), [['FF', 250], ['SL', 200]])
  assert.deepEqual(pitchRows(g, 'L').map((r) => r.code), ['SL'])
  assert.equal(pitchesVs(g, 'L'), 100)
  assert.equal(pitchesVs(g, 'R'), 352) // FF 250, SL 100, CH 2
  assert.equal(pitchesVs(g, null), 452)
})

test('a pitch type view reads that type alone; an empty view is null', () => {
  const g = grid({ FF: { R: { R: counters() } }, SL: { R: { R: counters({ pitches: cells(() => 4) }) } } })
  assert.equal(plateView(g, { code: 'SL' }).n, 100)
  assert.equal(plateView(g, { hand: 'L' }), null)
  assert.equal(plateView(null), null)
  assert.equal(plateView(one(counters({ pitches: cells(() => 0) }))), null)
})

test('a percent with no number is a dash with no unit', () => {
  assert.equal(fmtPct(0.2306), '23.1%')
  assert.equal(fmtPct(null), '—')
})

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const MOD = 'screens/player/next/modules/plate/'

test('a cut prints the figures the table printed: labels from 8%, both sides, count, speed, whiff', () => {
  const f = outcomeFigures('Four-seam', plateView(one(counters())))
  // segs [18, 146, 34, 18, 34] of 250: 7.2% prints nothing, 58.4% prints 58.
  assert.deepEqual(f.segs.map((s) => s.label), ['', '58', '14', '', '14'])
  assert.deepEqual(f.segs.map((s) => s.n), [18, 146, 34, 18, 34])
  assert.equal(f.good, "66% hitter's")
  assert.equal(f.bad, "21% pitcher's")
  assert.equal(f.n, '250')
  assert.equal(f.mph, '90.0')
  assert.equal(f.whiff, '39.5%')
  assert.equal(f.aria, "Four-seam: Pitches 250, MPH 90.0, Whiff 39.5%, 21% pitcher's")
})

test('no plate file: no bar, both sides and the speed are a dash', () => {
  const f = outcomeFigures('Four-seam', plateView(one(counters({ noPlate: true }))))
  assert.deepEqual(f.segs, [])
  assert.equal(f.good, '—')
  assert.equal(f.bad, '—')
  assert.equal(f.mph, '—')
  assert.equal(fmtMph(null), '—')
})

test('the pitch mix is the shared MenuRail; the stretch table stays the Form trend\'s', () => {
  const jsx = read(`${MOD}PlateModule.jsx`)
  assert.match(jsx, /import \{ MenuRail \} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/components\/ui\/control\/MenuRail\.jsx'/)
  assert.doesNotMatch(jsx, /StretchTable/)
  assert.match(jsx, /picked=\{code\}/) // null is "All pitches", as the table's row 0 was
  assert.match(jsx, /backLabel="All pitches"/)
  assert.match(jsx, /onPick=\{\(key\) => \{ setPick\(key\); setCell\(-1\) \}\}/)
  assert.match(jsx, /label: f\.aria/)
  // Form trend still draws the table.
  assert.match(read('screens/player/next/modules/form/FormModule.jsx'), /StretchTable/)
  assert.match(read('screens/player/next/modules/pform/index.jsx'), /StretchTable/)
})

test('the module loads the bar classes itself now that it drops StretchTable', () => {
  const idx = read(`${MOD}index.jsx`)
  assert.ok(idx.indexOf('both/formchart.css') > -1)
  assert.ok(idx.indexOf('both/formchart.css') < idx.indexOf('batter/plate.css'))
})

test('the glyph and the panel head are drawn in plate.css with tokens', () => {
  const c = stripComments(read('styles/player-next/batter/plate.css'))
  assert.equal(ruleBody(c, '.fplate__glyph').match(/fill:\s*([^;]+);/)[1].trim(), 'var(--pitch, var(--text-caption))')
  assert.match(ruleBody(c, '.fplate__pname'), /font-size:\s*var\(--fs-hero-sm\)/)
  assert.match(ruleBody(c, '.fplate__menu'), /margin-top:\s*var\(--space-3\)/)
})
