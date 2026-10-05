// The season views (#1202): which season a page shows, how it is labelled,
// and how a compare column words a change. Pure — src/lib/seasons/view.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveSeasonView,
  seasonRangeLabel,
  seasonDelta,
  seasonValue,
  seasonOptions,
  compareOptions,
  compareColumn,
  boardCompare,
} from '../src/lib/seasons/view.js'

const TWO = { seasons: [2026, 2027], current: 2027 }

test('no season is the current one, which in winter is the last complete season', () => {
  // seasons.json's `current` is the latest season with data, so on Jan 1 it
  // still names last season (ADR-0086): the winter default needs no rule here.
  assert.deepEqual(resolveSeasonView({ seasons: [2026], current: 2026 }, {}), {
    seasons: [2026],
    current: 2026,
    shown: 2026,
    vs: null,
    label: '2026',
  })
  assert.equal(resolveSeasonView(TWO, {}).shown, 2027)
})

test('a year on file is that year; a year not on file is the current season', () => {
  assert.equal(resolveSeasonView(TWO, { seasonYear: 2026 }).shown, 2026)
  assert.equal(resolveSeasonView(TWO, { seasonYear: 2019 }).shown, 2027)
  assert.equal(resolveSeasonView(TWO, { seasonYear: 2019 }).label, '2027')
})

test('"all" is labelled with the years it covers, never only "All"', () => {
  const view = resolveSeasonView(TWO, { seasonYear: 'all' })
  assert.equal(view.shown, 'all')
  assert.equal(view.label, '2026–2027')
  // One season on file: "all" is that season, and says so.
  assert.equal(resolveSeasonView({ seasons: [2026], current: 2026 }, { seasonYear: 'all' }).label, '2026')
  assert.equal(seasonRangeLabel([2023, 2024, 2025, 2026]), '2023–2026')
  assert.equal(seasonRangeLabel([]), '')
})

test('compare is a second season on file, never "all" and never the season itself', () => {
  assert.equal(resolveSeasonView(TWO, { seasonYear: 2027, vs: 2026 }).vs, 2026)
  // No segment: the current season against the one named.
  assert.equal(resolveSeasonView(TWO, { vs: 2026 }).vs, 2026)
  assert.equal(resolveSeasonView(TWO, { seasonYear: 2027, vs: 2019 }).vs, null)
  assert.equal(resolveSeasonView(TWO, { seasonYear: 2027, vs: 2027 }).vs, null)
  assert.equal(resolveSeasonView(TWO, { seasonYear: 'all', vs: 2026 }).vs, null)
  // A year not on file is the current season, which can then be the vs year.
  assert.equal(resolveSeasonView(TWO, { seasonYear: 2019, vs: 2027 }).vs, null)
})

test('an empty index (no seasons.json yet) shows nothing and offers nothing', () => {
  const view = resolveSeasonView({ seasons: [], current: null }, { seasonYear: 2026, vs: 2025 })
  assert.equal(view.shown, null)
  assert.equal(view.vs, null)
  assert.deepEqual(seasonOptions(view), [])
  assert.deepEqual(compareOptions(view), [])
})

test('the picker offers each season and "all", only when there is more than one season', () => {
  assert.deepEqual(seasonOptions(resolveSeasonView({ seasons: [2026], current: 2026 }, {})), [])
  assert.deepEqual(seasonOptions(resolveSeasonView(TWO, {})), [
    { key: 2027, label: '2027' },
    { key: 2026, label: '2026' },
    { key: 'all', label: 'All 2026–2027' },
  ])
})

test('compare offers every other season, newest first, and nothing on "all"', () => {
  const three = { seasons: [2025, 2026, 2027], current: 2027 }
  assert.deepEqual(compareOptions(resolveSeasonView(three, { seasonYear: 2026 })), [
    { key: 2027, label: 'vs 2027' },
    { key: 2025, label: 'vs 2025' },
  ])
  assert.deepEqual(compareOptions(resolveSeasonView(three, { seasonYear: 'all' })), [])
})

test('a change says what it compares, in the figure\'s own unit', () => {
  assert.equal(seasonDelta(0.182, 0.151, 2026, 'pct'), '+3.1% vs 2026')
  assert.equal(seasonDelta(0.151, 0.182, 2026, 'pct'), '−3.1% vs 2026')
  assert.equal(seasonDelta(140, 128, 2026, 'count'), '+12 vs 2026')
  assert.equal(seasonDelta(3.4, 3.75, 2026, 'dec2'), '−0.35 vs 2026')
  assert.equal(seasonDelta(5, 5, 2026, 'count'), '±0 vs 2026')
  // A season he has no row in is no change: the caller prints its empty mark.
  assert.equal(seasonDelta(140, null, 2026, 'count'), null)
  assert.equal(seasonDelta(undefined, 12, 2026, 'count'), null)
  assert.equal(seasonDelta(NaN, 12, 2026, 'count'), null)
})

test('a side-by-side value prints in the same unit, and a missing season as a dash', () => {
  assert.equal(seasonValue(0.1512, 'pct'), '15.1%')
  assert.equal(seasonValue(128, 'count'), '128')
  assert.equal(seasonValue(3.751, 'dec2'), '3.75')
  assert.equal(seasonValue(3.75, 'dec1'), '3.8')
  assert.equal(seasonValue(null, 'pct'), '—')
})

test('a compare column is a change, or the other season beside this one', () => {
  const change = compareColumn(2026, 'change', 'pct')
  assert.equal(change.head, 'Change')
  assert.equal(change.cell(0.182, 0.151), '+3.1% vs 2026')
  assert.equal(change.cell(0.182, null), '—')
  const side = compareColumn(2026, 'side', 'pct')
  assert.equal(side.head, '2026')
  assert.equal(side.cell(0.182, 0.151), '15.1%')
  assert.equal(side.cell(0.182, undefined), '—')
  assert.equal(compareColumn(null, 'change', 'pct'), null)
})

test('a board compare finds each row in the vs season, and a row it cannot find gets the dash', () => {
  const prev = { 7: { fouls: 100, g: 50 } }
  const cmp = boardCompare({
    vs: 2026,
    mode: 'change',
    format: 'dec2',
    value: (r) => r.fouls / r.g,
    prevOf: (r) => prev[r.id],
  })
  assert.equal(cmp.head, 'Change')
  assert.equal(cmp.cell({ id: 7, fouls: 90, g: 30 }), '+1.00 vs 2026')
  // A 2027 rookie has no 2026 row: no change, not a zero change.
  assert.equal(cmp.cell({ id: 8, fouls: 90, g: 30 }), '—')
  assert.equal(boardCompare({ vs: null, mode: 'change', format: 'dec2', value: () => 1, prevOf: () => null }), null)
})
