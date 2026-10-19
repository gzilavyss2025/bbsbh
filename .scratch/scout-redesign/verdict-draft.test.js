// DRAFT for slice 1 (#2319). Copy to test/scout-verdict.test.js. Run it
// BEFORE matchupVerdict exists and watch it fail (CLAUDE.md test discipline),
// then add the function.
//
// The fixture is Pivetta (601713) vs Chourio (694192), 2026 regular season,
// read by the page's own pitcherBoard and hitterSide
// (.scratch/scout-polish/pair-601713-694192.json). Only the fields the verdict
// reads are kept.
import assert from 'node:assert/strict'
import test from 'node:test'
import { matchupVerdict } from '../src/screens/scout/hitterBoard.js'

const TYPES = [
  { code: 'FF', name: 'Fastball', n: 130, exp: 0.34818689390407553, typeVal: 0.3905771812080537, leagueFlat: 0.3297263244169585 },
  { code: 'ST', name: 'Sweeper', n: 61, exp: 0.2979259259259259, typeVal: 0.2979259259259259, leagueFlat: 0.26031285178236396 },
  { code: 'FC', name: 'Cutter', n: 44, exp: null, typeVal: 0.38762264150943393, leagueFlat: 0.3373811451706188 },
  { code: 'CU', name: 'Curveball', n: 24, exp: null, typeVal: 0.26652000000000003, leagueFlat: 0.2611441624365482 },
]
const pair = (types = TYPES) => ({
  board: {
    all: { n: 263 },
    types: types.map(({ code, name }) => ({ code, name })),
    byType: Object.fromEntries(types.map((t) => [t.code, { n: t.n }])),
  },
  side: { byType: Object.fromEntries(types.map(({ code, exp, typeVal, leagueFlat }) => [code, { exp, typeVal, leagueFlat }])) },
})
const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`)

test('Pivetta vs Chourio: .336 against .308, inside the Even band', () => {
  const { board, side } = pair()
  const v = matchupVerdict(board, side)
  near(v.value, 0.3355)
  near(v.league, 0.3083)
  near(v.gap, 0.0272)
  assert.equal(v.band, 0)
  near(v.covered, 259 / 263)
})

test('a mapped type uses its location value; a thin one its whole-type value', () => {
  const { board, side } = pair()
  const [ff, , fc] = matchupVerdict(board, side).rows
  assert.equal(ff.mapped, true)
  near(ff.value, 0.3482)
  assert.equal(fc.mapped, false)
  near(fc.value, 0.3876)
})

test('the pushes add up to the gap, one per pitch', () => {
  const { board, side } = pair()
  const v = matchupVerdict(board, side)
  near(v.rows.reduce((s, r) => s + r.push, 0), v.gap, 1e-9)
  assert.deepEqual(v.rows.map((r) => r.code), ['FF', 'ST', 'FC', 'CU'])
  near(v.rows[0].push, 0.0093)
  near(v.rows[3].push, 0.0005)
})

test('a type with no hitter value drops out and covered shrinks', () => {
  const types = TYPES.map((t) => (t.code === 'CU' ? { ...t, exp: null, typeVal: null } : t))
  const { board, side } = pair(types)
  const v = matchupVerdict(board, side)
  assert.deepEqual(v.rows.map((r) => r.code), ['FF', 'ST', 'FC'])
  near(v.covered, 235 / 263)
})

test('the band follows metrics.band: past .030 is Slight, past .070 Clear', () => {
  const lift = (d) => TYPES.map((t) => ({ ...t, exp: t.exp == null ? null : t.exp + d, typeVal: t.typeVal + d }))
  const at = (d) => {
    const { board, side } = pair(lift(d))
    return matchupVerdict(board, side).band
  }
  assert.equal(at(0.01), 1) // gap about .037
  assert.equal(at(0.05), 2) // gap about .077
  assert.equal(at(-0.06), -1) // gap about -.033: the pitcher's side
})

test('null with no board, no side, or nothing to weigh', () => {
  const { board, side } = pair()
  assert.equal(matchupVerdict(null, side), null)
  assert.equal(matchupVerdict(board, null), null)
  const empty = pair(TYPES.map((t) => ({ ...t, exp: null, typeVal: null })))
  assert.equal(matchupVerdict(empty.board, empty.side), null)
})
