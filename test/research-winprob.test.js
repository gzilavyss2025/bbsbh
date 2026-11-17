import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attachWinProb, buildLeverage, coarseKey, encodeWinProb, leverageBucket, leverageOf, stateKey, winProbTotals } from '../src/api/research/winprob.js'
import { needsWinProb, parseQuery, buildQuery, unsupported } from '../src/api/research/filters.js'
import { hasWinProb } from '../src/api/research/store.js'
import { mergeIndex } from '../scripts/lib/research/store.mjs'

const pa = (o) => ({ inning: 9, top: false, outs: 2, runners: 7, margin: -1, ...o })

test('state keys cap the inning at 9 and clamp the margin to ±4', () => {
  assert.equal(stateKey(pa({ inning: 12, margin: -9 })), '9b27-4')
  assert.equal(coarseKey(pa({ inning: 3, top: true, margin: 6 })), '3t4')
})

test('encodeWinProb sums each PA over its pitches, home view x1000, RE x100', () => {
  const rows = [
    { game_pk: '1', at_bat_number: '1', delta_home_win_exp: '-0.010', delta_run_exp: '0.05' },
    { game_pk: '1', at_bat_number: '1', delta_home_win_exp: '-0.100', delta_run_exp: '1.10' },
    { game_pk: '1', at_bat_number: '2', delta_home_win_exp: '', delta_run_exp: '-0.2' },
  ]
  assert.deepEqual(encodeWinProb(rows, [{ key: '1-1' }, { key: '1-2' }]), { v: 1, n: 2, w: [-110, 0], re: [115, -20] })
})

test('attachWinProb flips WPA to the batting club and looks up LI', () => {
  const table = { states: { [stateKey(pa({ top: true }))]: 2.5 }, coarse: { [coarseKey(pa())]: 1.2 } }
  const pas = [pa({ top: true }), pa()]
  attachWinProb(pas, { n: 2, w: [-110, 40], re: [115, -20] }, table)
  assert.equal(pas[0].wpa, 0.11)
  assert.equal(pas[0].li, 2.5)
  assert.equal(pas[1].wpa, 0.04)
  assert.equal(pas[1].li, 1.2, 'falls back to the coarse state')
  assert.equal(leverageOf({ states: {}, coarse: {} }, pa()), null)
})

test('attachWinProb refuses a side file that does not line up', () => {
  assert.throws(() => attachWinProb([pa()], { n: 2, w: [1, 2], re: [1, 2] }, { states: {}, coarse: {} }), /holds 2 PAs/)
})

test('buildLeverage: a state mean |WPA| over the league mean, rare states dropped', () => {
  const hot = Array.from({ length: 30 }, () => ({ ...pa(), swing: 0.3 }))
  const calm = Array.from({ length: 30 }, () => ({ ...pa({ inning: 1, runners: 0, margin: 0 }), swing: 0.1 }))
  const t = buildLeverage([...hot, ...calm, { ...pa({ inning: 5 }), swing: 1 }])
  const avg = (9 + 3 + 1) / 61
  assert.equal(t.states[stateKey(pa())], Math.round((0.3 / avg) * 100) / 100)
  assert.equal(t.states[stateKey(pa({ inning: 5 }))], undefined)
})

test('leverage buckets: Low < 0.85, High > 2.0', () => {
  assert.deepEqual([0.84, 0.85, 2, 2.01, null].map(leverageBucket), ['low', 'med', 'med', 'high', null])
})

test('winProbTotals sums WPA and RE24 and averages LI', () => {
  const t = winProbTotals([{ wpa: 0.1, re24: 1, li: 2 }, { wpa: -0.05, re24: 0.5, li: null }, { wpa: null }])
  assert.ok(Math.abs(t.wpa - 0.05) < 1e-9)
  assert.equal(t.re24, 1.5)
  assert.equal(t.li, 2)
  assert.equal(winProbTotals([{ wpa: null }]), null)
})

test('the wp toggle and the Leverage card round-trip the URL and need the side files', () => {
  const q = parseQuery('?wp=1&lev=high')
  assert.equal(q.wp, true)
  assert.deepEqual(q.chips.lev.vals, ['high'])
  assert.match(buildQuery(q), /wp=1/)
  assert.equal(needsWinProb(q), true)
  assert.equal(needsWinProb(parseQuery('?out=2')), false)
  assert.ok(unsupported(2025, 2, false).some((b) => b.key === 'lev' && b.rebuild))
  assert.ok(!unsupported(2025, 2, true).some((b) => b.key === 'lev'))
})

test('a month built with its side file is marked wp; a season is ready only when every month is', () => {
  const shard = { v: 2, through: '2026-06-30', cols: { g: [] } }
  const index = mergeIndex(null, 2026, '06', shard, [], 'x')
  assert.equal(index.seasons[2026].months['06'].wp, 1)
  assert.equal(hasWinProb(index, [2026]), true)
  index.seasons[2026].months['05'] = { v: 2 }
  assert.equal(hasWinProb(index, [2026]), false)
})

test('an inverted Leverage chip never matches a PA with no LI', async () => {
  const { matcher } = await import('../src/api/research/filters.js')
  const m = matcher(parseQuery('?lev=!high'))
  assert.equal(m({ ...pa(), gameType: 'R', date: '2025-06-01', li: null }), false)
  assert.equal(m({ ...pa(), gameType: 'R', date: '2025-06-01', li: 1 }), true)
})
