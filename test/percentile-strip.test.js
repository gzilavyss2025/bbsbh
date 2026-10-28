// The Statcast percentile row join (src/api/savantPercentiles.js's
// percentileRows), pure so it can be pinned here rather than eyeballed in a
// browser. The strip's scale math went with the unused strip component.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { percentileRows } from '../src/api/savantPercentiles.js'

// ------------------------------------------------------------------ the rows

const BAT = { xwoba: 95, ev: 65, hardHit: 65, brl: 57, chase: 58, sprintSpeed: 9 }
const RAW_BAT = { xwoba: 0.38, ev: 90, hardHit: 43.8, brl: 9.2, chase: 28.6, sprintSpeed: 27.7 }

test('every qualifying metric gets a row', () => {
  // The point of ADR-0040. The five-spoke radar had no room for a hitter's
  // sprint speed, so a player whose worst tool was speed showed a well-rounded
  // shape with the bad number only in the grid below it.
  const rows = percentileRows(BAT, RAW_BAT, 'hitting')
  assert.equal(rows.length, 6)
  assert.ok(rows.some((r) => r.key === 'sprintSpeed'))
})

test('rows keep the canonical metric order, not a per-player one', () => {
  // A fixed order is what makes a rank comparable across players: row three is
  // the same metric on everyone's page. The radar's shape, by contrast, was a
  // function of the order its keys happened to be listed in.
  const a = percentileRows(BAT, RAW_BAT, 'hitting').map((r) => r.key)
  const shuffled = { chase: 58, xwoba: 95, sprintSpeed: 9, brl: 57, hardHit: 65, ev: 65 }
  const b = percentileRows(shuffled, RAW_BAT, 'hitting').map((r) => r.key)
  assert.deepEqual(a, b)
})

test('a metric under Savant’s sample floor is left out, not plotted', () => {
  const rows = percentileRows({ ...BAT, sprintSpeed: null }, RAW_BAT, 'hitting')
  assert.equal(rows.length, 5)
  assert.ok(!rows.some((r) => r.key === 'sprintSpeed'))
})

test('a row carries the formatted raw rate beside its rank', () => {
  const row = percentileRows(BAT, RAW_BAT, 'hitting').find((r) => r.key === 'chase')
  assert.equal(row.percentile, 58)
  assert.equal(row.value, '28.6%')
})

test('a missing raw-rate map costs the value column only', () => {
  const rows = percentileRows(BAT, null, 'hitting')
  assert.equal(rows.length, 6)
  assert.ok(rows.every((r) => r.value === null))
  assert.ok(rows.every((r) => Number.isFinite(r.percentile)))
})

test('lower-is-better metrics are flagged so the raw column can say so', () => {
  const rows = percentileRows(BAT, RAW_BAT, 'hitting')
  assert.equal(rows.find((r) => r.key === 'chase').lowerIsBetter, true)
  assert.equal(rows.find((r) => r.key === 'ev').lowerIsBetter, false)
})

test('fewer than three known metrics is not a profile', () => {
  assert.equal(percentileRows({ xwoba: 95, ev: 65 }, RAW_BAT, 'hitting'), null)
  assert.notEqual(percentileRows({ xwoba: 95, ev: 65, brl: 20 }, RAW_BAT, 'hitting'), null)
})

test('no savant map at all returns null rather than an empty strip', () => {
  assert.equal(percentileRows(null, RAW_BAT, 'hitting'), null)
})

// ------------------------------------------------- bat tracking (issue #937)

const BAT_WITH_TRACKING = { ...BAT, batSpeed: 71, squaredUp: 44, swingLength: 12 }
const RAW_BAT_WITH_TRACKING = { ...RAW_BAT, batSpeed: 71.2, squaredUp: 23.4, swingLength: 7.5 }

test('bat speed, squared-up %, and swing length join the batter strip', () => {
  const rows = percentileRows(BAT_WITH_TRACKING, RAW_BAT_WITH_TRACKING, 'hitting')
  assert.equal(rows.length, 9)
  for (const key of ['batSpeed', 'squaredUp', 'swingLength']) {
    assert.ok(rows.some((r) => r.key === key), `missing row for ${key}`)
  }
})

test('bat speed and squared-up % format as one-decimal numbers, mph and percent', () => {
  const rows = percentileRows(BAT_WITH_TRACKING, RAW_BAT_WITH_TRACKING, 'hitting')
  assert.equal(rows.find((r) => r.key === 'batSpeed').value, '71.2')
  assert.equal(rows.find((r) => r.key === 'squaredUp').value, '23.4%')
})

test('swing length keeps Savant\'s order, so only chase % is lower-is-better', () => {
  const rows = percentileRows(BAT_WITH_TRACKING, RAW_BAT_WITH_TRACKING, 'hitting')
  assert.equal(rows.find((r) => r.key === 'swingLength').lowerIsBetter, false)
  assert.equal(rows.find((r) => r.key === 'batSpeed').lowerIsBetter, false)
  assert.equal(rows.find((r) => r.key === 'squaredUp').lowerIsBetter, false)
})

test('bat tracking has no pitcher analog: the pitching group never gets these rows', () => {
  const rows = percentileRows(
    { xera: 83, k: 88, bb: 3, whiff: 100, chase: 36, fbVelo: 27, hardHit: 100 },
    null,
    'pitching',
  )
  for (const key of ['batSpeed', 'squaredUp', 'swingLength']) {
    assert.ok(!rows.some((r) => r.key === key), `pitching strip unexpectedly carries ${key}`)
  }
})

test('the pitching group reads the pitcher metric list', () => {
  const rows = percentileRows(
    { xera: 83, k: 88, bb: 3, whiff: 100, chase: 36, fbVelo: 27, hardHit: 100 },
    null,
    'pitching',
  )
  assert.deepEqual(
    rows.map((r) => r.key),
    ['xera', 'k', 'bb', 'whiff', 'chase', 'fbVelo', 'hardHit'],
  )
  // Chase and fastball velo are the two the five-spoke radar had no room for.
  assert.ok(rows.some((r) => r.key === 'chase'))
  assert.ok(rows.some((r) => r.key === 'fbVelo'))
})

// ------------------------------------------------ league baseline (median)

const MEDIAN_BAT = { xwoba: 0.31, ev: 88.9, hardHit: 40.2, brl: 7.9, chase: 29.5, sprintSpeed: 27.3 }

test('a row carries the league median, formatted like the player\'s own value', () => {
  const rows = percentileRows(BAT, RAW_BAT, 'hitting', MEDIAN_BAT)
  const chase = rows.find((r) => r.key === 'chase')
  assert.equal(chase.baseline, '29.5%')
  const xwoba = rows.find((r) => r.key === 'xwoba')
  assert.equal(xwoba.baseline, '.310')
})

test('no median map at all leaves every row\'s baseline null, not an error', () => {
  const rows = percentileRows(BAT, RAW_BAT, 'hitting')
  assert.ok(rows.every((r) => r.baseline === null))
})

test('a metric missing from the median map gets a null baseline on its own row only', () => {
  const thin = { xwoba: 0.31 } // every other metric had too thin an intersection
  const rows = percentileRows(BAT, RAW_BAT, 'hitting', thin)
  assert.equal(rows.find((r) => r.key === 'xwoba').baseline, '.310')
  assert.equal(rows.find((r) => r.key === 'ev').baseline, null)
})

test('a row still renders fine with a baseline but no raw value', () => {
  const rows = percentileRows(BAT, null, 'hitting', MEDIAN_BAT)
  const chase = rows.find((r) => r.key === 'chase')
  assert.equal(chase.value, null)
  assert.equal(chase.baseline, '29.5%')
})

test('the definition explains the baseline only when a baseline is present', () => {
  const withMedian = percentileRows(BAT, RAW_BAT, 'hitting', MEDIAN_BAT).find((r) => r.key === 'chase')
  const withoutMedian = percentileRows(BAT, RAW_BAT, 'hitting').find((r) => r.key === 'chase')
  assert.match(withMedian.def, /median/i)
  assert.doesNotMatch(withoutMedian.def, /median/i)
  // The metric's own plain-language gloss is always still there, word for
  // word — the baseline sentence is appended, never a replacement.
  assert.ok(withMedian.def.startsWith(withoutMedian.def))
})

test('a lower-is-better metric\'s baseline is the raw figure, not a verdict', () => {
  // Chase % is lower-is-better: the median printed beside it must still be
  // Savant's own raw median rate, unflipped — the strip's dot position (not
  // the baseline number) is what already encodes direction.
  const chase = percentileRows(BAT, RAW_BAT, 'hitting', MEDIAN_BAT).find((r) => r.key === 'chase')
  assert.equal(chase.lowerIsBetter, true)
  assert.equal(chase.baseline, '29.5%')
})

test('swing length prints its raw median baseline without a lower-is-better flag', () => {
  const rows = percentileRows(BAT_WITH_TRACKING, RAW_BAT_WITH_TRACKING, 'hitting', {
    ...MEDIAN_BAT,
    swingLength: 7.3,
  })
  const swingLength = rows.find((r) => r.key === 'swingLength')
  assert.equal(swingLength.lowerIsBetter, false)
  assert.equal(swingLength.baseline, '7.3')
})
