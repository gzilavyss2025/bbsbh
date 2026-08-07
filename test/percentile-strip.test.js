// The Statcast percentile strip's scale math (src/lib/percentileStrip.js) and
// the row join behind it (src/api/savantPercentiles.js's percentileRows).
// Both are pure, so the axis can be pinned here rather than eyeballed in a
// browser — same footing the radar's geometry sat on before ADR-0040 replaced
// it.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LEAGUE_AVERAGE, deviationBar, dotFraction } from '../src/lib/percentileStrip.js'
import { percentileRows } from '../src/api/savantPercentiles.js'

// ---------------------------------------------------------------- the scale

test('the league-average reference is the 50th percentile', () => {
  // Not a tunable — it is what a percentile rank means. The single ruled line
  // down the strip depends on it being a constant.
  assert.equal(LEAGUE_AVERAGE, 50)
})

test('dotFraction maps the percentile scale onto the track linearly', () => {
  assert.equal(dotFraction(0), 0)
  assert.equal(dotFraction(50), 0.5)
  assert.equal(dotFraction(100), 1)
  assert.equal(dotFraction(37), 0.37)
})

test('dotFraction clamps out-of-range ranks instead of plotting off the track', () => {
  assert.equal(dotFraction(-5), 0)
  assert.equal(dotFraction(140), 1)
})

test('dotFraction answers null for an unknown rank rather than plotting zero', () => {
  // A metric under Savant's sample floor must not draw a dot at the worst end
  // of the track — that would read as "worst in the league" instead of "no
  // data". The radar this replaced plotted such a spoke at the average ring,
  // which read as a real, exactly-average measurement.
  for (const bad of [null, undefined, NaN, 'x']) assert.equal(dotFraction(bad), null)
})

test('the deviation bar runs from league average to the dot, either way', () => {
  const above = deviationBar(80)
  assert.equal(above.side, 'above')
  assert.equal(above.start, 0.5)
  assert.equal(above.width, 0.3)

  const below = deviationBar(20)
  assert.equal(below.side, 'below')
  assert.equal(below.start, 0.2)
  assert.equal(below.width, 0.3)
})

test('a player exactly at league average draws no deviation bar', () => {
  const bar = deviationBar(50)
  assert.equal(bar.width, 0)
  assert.equal(bar.start, 0.5)
})

test('equal distances from average draw equal bars on opposite sides', () => {
  // The property the radar could not have: the encoding is linear in the
  // quantity, so the same 30-point gap looks the same size wherever it sits.
  const a = deviationBar(50 + 30)
  const b = deviationBar(50 - 30)
  assert.equal(a.width, b.width)
  assert.notEqual(a.side, b.side)
})

test('deviationBar answers null for an unknown rank', () => {
  assert.equal(deviationBar(null), null)
})

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
