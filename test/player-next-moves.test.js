import test from 'node:test'
import assert from 'node:assert/strict'
import { movesView, OPEN } from '../src/screens/player/next/modules/moves/movesView.js'

const row = (date, code, tone = 'add', extra = {}) => ({
  date, code, label: code, tone, description: `${code} on ${date}`, links: [], club: { id: 158, name: 'Brewers' }, year: Number(date.slice(0, 4)), ...extra,
})

test('chip shape follows tone; the IL code wins over its out tone and says Injured list', () => {
  const v = movesView([row('2023-06-29', 'REC'), row('2023-06-07', 'OPT', 'out'), row('2022-08-01', 'TR', 'move'), row('2025-02-12', 'IL', 'out', { label: '60-day IL' })].sort((a, b) => b.date.localeCompare(a.date)))
  const by = (code) => v.rows.find((r) => r.code === code)
  assert.deepEqual([by('REC').mark, by('OPT').mark, by('TR').mark, by('IL').mark], ['+', '−', '↔', ''])
  assert.equal(by('IL').chip, 'Injured list')
  assert.equal(by('IL').injured, true)
  assert.equal(by('OPT').injured, false)
})

test('dates read m/d/yy', () => {
  assert.equal(movesView([row('2023-06-29', 'REC')]).rows[0].date, '6/29/23')
})

test('a row with no date is dropped; a row after endDate is dropped', () => {
  const v = movesView([row('2023-06-29', 'REC'), row('', 'X'), row('2023-07-02', 'OPT')], '2023-06-30')
  assert.deepEqual(v.rows.map((r) => r.code), ['REC'])
})

test('two rows with one date and code get distinct keys', () => {
  const v = movesView([row('2023-06-29', 'REC'), row('2023-06-29', 'REC'), row('2023-06-29', 'OPT')])
  assert.equal(new Set(v.rows.map((r) => r.key)).size, 3)
})

test('a missing club is flagged, not dropped', () => {
  const v = movesView([row('2023-06-29', 'REC', 'add', { club: null })])
  assert.equal(v.rows[0].club, null)
})

test('year dividers carry the count of moves in that year', () => {
  const v = movesView([row('2023-06-29', 'REC'), row('2023-06-07', 'OPT'), row('2022-11-15', 'SEL')])
  assert.deepEqual(v.rows.map((r) => r.year), [2023, 2023, 2022])
  assert.deepEqual(v.rows.map((r) => r.yearHead), [{ year: 2023, n: 2 }, null, { year: 2022, n: 1 }])
})

test('shows OPEN rows, then the rest on request; the counts come from the data', () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(`2020-01-${String(20 - i).padStart(2, '0')}`, 'REC'))
  const v = movesView(rows)
  assert.equal(OPEN, 8)
  assert.equal(v.rows.length, 20)
  assert.equal(v.total, 20)
  assert.equal(v.showAll, 'Show all 20 moves')
  assert.equal(v.showFewer, 'Show fewer')
  assert.equal(v.count, 20)
  assert.equal(movesView(rows.slice(0, 8)).showAll, null)
  assert.equal(movesView(rows.slice(0, 1)).count, 1)
})

test('nothing usable gives null', () => {
  assert.equal(movesView([]), null)
  assert.equal(movesView(null), null)
  assert.equal(movesView([row('', 'X')]), null)
})
