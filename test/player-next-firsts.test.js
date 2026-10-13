import test from 'node:test'
import assert from 'node:assert/strict'
import { firstsView, FIRSTS_ORDER, PITCHER_FIRSTS_ORDER } from '../src/screens/player/next/modules/firsts/firstsView.js'

const f = (label, date, extra = {}) => ({ label, date, gamePk: 1, path: '/g/1', isHome: false, oppId: 112, oppAbbr: 'CHC', ...extra })

test('a batter reads the batter order and leaves off a first he has not reached', () => {
  const firsts = { so: f('First Strikeout', '2023-04-01'), debut: f('MLB Debut', '2023-03-30'), hit: f('First Hit', '2023-03-30'), hr: null }
  const v = firstsView({ firsts, role: 'hitting' })
  assert.deepEqual(v.rows.map((r) => r.key), ['debut', 'hit', 'so'])
  assert.equal(v.count, '3 firsts')
})

test('a pitcher reads the pitcher order; batter-only keys are ignored', () => {
  const firsts = { save: f('First Save', '2026-08-01'), debut: f('MLB Debut', '2026-05-17'), win: f('First Win', '2026-06-21'), hr: f('First Home Run', '2026-06-01') }
  const v = firstsView({ firsts, role: 'pitching' })
  assert.deepEqual(v.rows.map((r) => r.key), ['debut', 'win', 'save'])
})

test('the orders match the live tab', () => {
  assert.deepEqual(FIRSTS_ORDER, ['debut', 'start', 'hit', 'xbh', 'hr', 'run', 'so'])
  assert.deepEqual(PITCHER_FIRSTS_ORDER, ['debut', 'start', 'win', 'loss', 'save', 'so'])
})

test('a row has the short date, at/vs, the opponent and the game path', () => {
  const v = firstsView({ firsts: { debut: f('MLB Debut', '2023-03-30'), hr: f('First Home Run', '2023-04-03', { isHome: true, oppAbbr: 'NYM', oppId: 121 }) }, role: 'hitting' })
  assert.equal(v.rows[0].date, '3/30/23')
  assert.equal(v.rows[0].where, 'at CHC')
  assert.equal(v.rows[1].where, 'vs NYM')
  assert.equal(v.rows[1].path, '/g/1')
  assert.equal(v.rows[1].oppId, 121)
})

test('one first reads singular; none gives null', () => {
  assert.equal(firstsView({ firsts: { debut: f('MLB Debut', '2023-03-30') }, role: 'hitting' }).count, '1 first')
  assert.equal(firstsView({ firsts: { hr: null }, role: 'hitting' }), null)
  assert.equal(firstsView({ firsts: null, role: 'pitching' }), null)
  assert.equal(firstsView({ firsts: { hr: f('First Home Run', '2023-04-03') }, role: 'pitching' }), null)
})

test('a first with no date is left off', () => {
  assert.equal(firstsView({ firsts: { hit: f('First Hit', '') }, role: 'hitting' }), null)
})
