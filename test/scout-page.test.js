// The Matchup Scout page's pure parts (#1410): its address, the pickers' role
// filter, the switch hitter's stance, the pitcher board, and the head-to-head
// labels. The region geometry is test/scout-regions.test.js; the Savant
// request and its cutoff are test/scout-head-to-head.test.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRoute } from '../src/lib/route.js'
import { scoutPath } from '../src/lib/scout/path.js'
import { canHit, canPitch, stanceFor } from '../src/lib/scout/roles.js'
import { ROUND_TAG, resultShort } from '../src/lib/scout/format.js'
import { MAX_TYPES, USAGE_FLOOR, boardRow, mapOf, pitcherBoard } from '../src/screens/scout/board.js'
import { MIN_COMMAND_PITCHES } from '../src/api/commandMap.js'

const skubal = { id: 669373, name: 'Tarik Skubal' }
const judge = { id: 592450, name: 'Aaron Judge' }

test('a Scout address round-trips through scoutPath and parseRoute', () => {
  const path = scoutPath({ pitcher: skubal, hitter: judge, view: 'hitter', scope: 'post', pitch: 'SL', d: '2026-09-01' })
  assert.equal(path, '/scout/tarik-skubal-669373/aaron-judge-592450?view=hitter&scope=post&pitch=SL&d=2026-09-01')
  assert.deepEqual(parseRoute(path), {
    name: 'scout', pitcherId: '669373', hitterId: '592450', asOf: '2026-09-01', view: 'hitter', scope: 'post', pitch: 'SL',
  })
})

test('defaults are never written, and an unknown value falls back', () => {
  assert.equal(scoutPath({ pitcher: skubal, hitter: judge, view: 'pitcher', scope: 'all' }), '/scout/tarik-skubal-669373/aaron-judge-592450')
  assert.equal(scoutPath({ pitcher: skubal }), '/scout')
  const r = parseRoute('/scout/a-1/b-2?view=sideways&scope=spring&pitch=slider&d=2026-02-30')
  assert.deepEqual([r.view, r.scope, r.pitch, r.asOf], [null, 'all', null, null])
  assert.equal(parseRoute('/scout').name, 'scout')
  assert.notEqual(parseRoute('/scout/only-one-1').name, 'scout')
})

test('the pitcher box lists pitchers, the hitter box everyone else, and a two-way player is in both', () => {
  const pitcher = { posCode: '1' }
  const fielder = { posCode: '9' }
  const twoWay = { posCode: 'Y' }
  assert.deepEqual([pitcher, fielder, twoWay].map(canPitch), [true, false, true])
  assert.deepEqual([pitcher, fielder, twoWay].map(canHit), [false, true, true])
})

test('a switch hitter stands opposite the pitcher’s hand; a one-sided hitter keeps his side', () => {
  assert.equal(stanceFor('S', 'R'), 'L')
  assert.equal(stanceFor('S', 'L'), 'R')
  assert.equal(stanceFor('L', 'R'), 'L')
  assert.equal(stanceFor('R', 'L'), 'R')
  assert.equal(stanceFor('S', ''), null)
  assert.equal(stanceFor('', 'R'), null)
})

// A pitch-arsenal shard entry and a pitch-command entry for one invented arm,
// shaped like public/data/pitch-arsenal and pitch-command (vs pairs, 25-cell
// counters by batter side).
function stores(pitchesByCode) {
  const mlb = Object.entries(pitchesByCode).map(([code, n]) => ({ code, pitches: n, avgVelo: 90, vs: { R: [n, 90] } }))
  const cells = (n) => Array.from({ length: 25 }, (_, i) => (i === 12 ? n : 0))
  return {
    arsenal: { pit: { 1: { mlb } } },
    command: { mlb: Object.fromEntries(Object.entries(pitchesByCode).map(([code, n]) => [code, { R: { cells: cells(n) } }])) },
  }
}

test('a type under the usage floor gets no pill but still counts in All; at most MAX_TYPES pills', () => {
  const { arsenal, command } = stores({ FF: 500, SL: 300, CH: 150, CU: 40, SI: 10 })
  const b = pitcherBoard({ arsenal, command, pitcherId: 1, stance: 'R' })
  assert.ok(b.types.every((t) => Number(t.pct) >= USAGE_FLOOR))
  assert.deepEqual(b.types.map((t) => t.code), ['FF', 'SL', 'CH'])
  assert.equal(b.all.n, 1000, 'All pools every type, pill or not')
  assert.equal(b.byType.SL.n, 300)
  const many = stores(Object.fromEntries(['FF', 'SI', 'SL', 'CH', 'CU', 'FC', 'ST', 'KC'].map((c) => [c, 100])))
  assert.equal(pitcherBoard({ ...many, pitcherId: 1, stance: 'R' }).types.length, MAX_TYPES)
})

test('no stores for this stance is "Not posted", never an empty map', () => {
  const { arsenal, command } = stores({ FF: 500 })
  assert.equal(pitcherBoard({ arsenal, command, pitcherId: 1, stance: 'L' }), null)
  assert.equal(pitcherBoard({ arsenal: null, command, pitcherId: 1, stance: 'R' }), null)
})

test('a map under the pitch floor prints counts only, never a share', () => {
  const thin = mapOf([Array.from({ length: 25 }, (_, i) => (i === 12 ? MIN_COMMAND_PITCHES - 1 : 0))])
  assert.equal(thin.thin, true)
  assert.ok(Object.values(thin.cells).every((c) => c.tone === 'gray' && c.value === undefined))
  assert.equal(thin.cells.r2c2.count, MIN_COMMAND_PITCHES - 1)
  const full = mapOf([Array.from({ length: 25 }, (_, i) => (i === 12 ? 60 : i === 0 ? 40 : 0))])
  assert.deepEqual([full.cells.r2c2.value, full.cells.high.value, full.cells.r2c2.tone], ['60', '40', 's4'])
})

test('the head-to-head labels: round tags and scorebook shorthand, an out read from its batted ball', () => {
  assert.deepEqual(['R', 'F', 'D', 'L', 'W'].map((g) => ROUND_TAG[g]), ['REG', 'WC', 'DS', 'LCS', 'WS'])
  assert.equal(resultShort({ event: 'strikeout' }), 'K')
  assert.equal(resultShort({ event: 'field_out', bbType: 'ground_ball' }), 'GO')
  assert.equal(resultShort({ event: 'field_out', bbType: 'popup' }), 'PO')
  assert.equal(resultShort({ event: 'force_out' }), 'Out')
})

test('a knuckle curve or slow curve reads the hitter’s curveball row, and says so', () => {
  const line = { CU: { pa: 50 }, FF: { pa: 90 } }
  assert.deepEqual(boardRow(line, 'KC'), { row: { pa: 50 }, as: 'CU' })
  assert.deepEqual(boardRow(line, 'CS'), { row: { pa: 50 }, as: 'CU' })
  assert.deepEqual(boardRow(line, 'FF'), { row: { pa: 90 }, as: null })
  assert.deepEqual(boardRow(line, 'SL'), { row: null, as: null })
  assert.deepEqual(boardRow(null, 'KC'), { row: null, as: 'CU' })
})
