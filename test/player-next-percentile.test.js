// The Percentile rank module's pure view (src/screens/player/next/modules/percentile/percentileView.js, #2011).
import test from 'node:test'
import assert from 'node:assert/strict'
import { percentileView, tierOf } from '../src/screens/player/next/modules/percentile/percentileView.js'

// Brice Turang and Robert Gasser, from public/data/savant-percentiles.json (2026), trimmed to the rows under test.
const data = {
  season: 2026,
  bat: {
    668930: { xwoba: 80, ev: 71, hardHit: 54, brl: 48, chase: 80, sprintSpeed: 81, batSpeed: 22, squaredUp: 51, swingLength: 8 },
    1: { xwoba: 50, ev: 50, hardHit: 50 },
    2: { xwoba: 50, ev: 50 },
  },
  rawBat: {
    668930: { xwoba: 0.344, ev: 90.3, hardHit: 41.6, brl: 7.7, chase: 24.8, sprintSpeed: 28.5, batSpeed: 70.087789278, squaredUp: 25.117150890346768, swingLength: 6.782167273 },
  },
  midBat: { xwoba: 0.3, ev: 89.3, hardHit: 40.9, brl: 7.8, chase: 29.7, sprintSpeed: 27.5, batSpeed: 72.2, squaredUp: 25, swingLength: 7.3 },
  pit: { 688107: { xera: 40, k: 49, bb: 67, whiff: 28, chase: 22, fbVelo: 23, hardHit: 82 } },
  rawPit: { 688107: { xera: 4.27, k: 22.3, bb: 7.4, whiff: 22.5, chase: 28.1, fbVelo: 91.6, hardHit: 34 } },
  midPit: { xera: 4.1, k: 22.3, bb: 8.5, whiff: 25.2, chase: 30.3, fbVelo: 93.9, hardHit: 38.3 },
}
// The real file ranks 612 hitters; pad the pool so the count is the file's own.
for (let i = 10; i < 619; i++) data.bat[i] = { xwoba: 50 }
const row = (v, key) => v.rows.find((r) => r.key === key)

test('thirds: top third mint with a triangle up, bottom third clay with a triangle down', () => {
  assert.deepEqual(tierOf(80), { tier: 'top', mark: '▲' })
  assert.deepEqual(tierOf(67), { tier: 'top', mark: '▲' })
  assert.deepEqual(tierOf(54), { tier: 'mid', mark: '' })
  assert.deepEqual(tierOf(34), { tier: 'mid', mark: '' })
  assert.deepEqual(tierOf(33), { tier: 'low', mark: '▼' })
  assert.deepEqual(tierOf(8), { tier: 'low', mark: '▼' })
})

test('Turang: the nine rows, in the app order, with the checked numbers', () => {
  const v = percentileView(data, 668930, 'hitting', 2026)
  assert.deepEqual(v.rows.map((r) => r.key), ['xwoba', 'ev', 'hardHit', 'brl', 'chase', 'sprintSpeed', 'batSpeed', 'swingLength', 'squaredUp'])
  assert.equal(v.pool, '612 hitters')
  assert.equal(v.tag, 'vs 612 hitters')
  assert.equal(v.season, 2026)
  const x = row(v, 'xwoba')
  assert.deepEqual([x.value, x.baseline, x.percentile, x.ord, x.tier], ['.344', '.300', 80, '80th', 'top'])
  assert.equal(row(v, 'ev').value, '90.3')
  assert.equal(row(v, 'hardHit').value, '41.6%')
  assert.equal(row(v, 'brl').value, '7.7%')
  assert.equal(row(v, 'sprintSpeed').ord, '81st')
  assert.equal(row(v, 'batSpeed').value, '70.1')
  assert.equal(row(v, 'batSpeed').ord, '22nd')
  assert.equal(row(v, 'squaredUp').value, '25.1%')
  assert.equal(row(v, 'squaredUp').ord, '51st')
})

test('chase carries the down arrow; swing length does not and reads 8th', () => {
  const v = percentileView(data, 668930, 'hitting', 2026)
  assert.equal(row(v, 'chase').lowerIsBetter, true)
  assert.equal(row(v, 'chase').percentile, 80)
  const s = row(v, 'swingLength')
  assert.equal(s.lowerIsBetter, false)
  assert.equal(s.value, '6.8')
  assert.equal(s.ord, '8th')
  assert.equal(s.tier, 'low')
})

test('Gasser: seven rows, a pitcher pool of all pitchers', () => {
  const v = percentileView(data, 688107, 'pitching', 2026)
  assert.deepEqual(v.rows.map((r) => r.key), ['xera', 'k', 'bb', 'whiff', 'chase', 'fbVelo', 'hardHit'])
  assert.equal(v.tag, 'vs all pitchers')
  const x = row(v, 'xera')
  assert.deepEqual([x.value, x.ord, x.lowerIsBetter], ['4.27', '40th', true])
  assert.deepEqual([row(v, 'bb').value, row(v, 'bb').ord], ['7.4%', '67th'])
  assert.equal(row(v, 'fbVelo').ord, '23rd')
  assert.equal(row(v, 'hardHit').ord, '82nd')
  assert.equal(row(v, 'chase').lowerIsBetter, false)
})

test('the detail line and the spoken label come from the numbers', () => {
  const v = percentileView(data, 668930, 'hitting', 2026)
  const x = row(v, 'xwoba')
  assert.equal(x.detail, 'His .344 · MLB median .300 · better than 80% of 612 hitters')
  assert.match(x.aria, /xwOBA/)
  assert.match(x.aria, /\.344/)
  assert.match(x.aria, /80th percentile/)
  assert.match(row(v, 'chase').aria, /lower is better/)
  const p = percentileView(data, 688107, 'pitching', 2026)
  assert.equal(row(p, 'k').detail, 'His 22.3% · MLB median 22.3% · better than 49% of all pitchers')
})

test('the sentence is the bare gloss, and swing length says Savant ranks a longer swing higher', () => {
  const v = percentileView(data, 668930, 'hitting', 2026)
  assert.doesNotMatch(row(v, 'xwoba').def, /lighter number/)
  assert.match(row(v, 'swingLength').def, /longer swing/)
  assert.doesNotMatch(row(v, 'swingLength').def, /shorter swing gets there/)
})

test('a missing raw number or median prints a dash with no unit, never 0', () => {
  const noRaw = percentileView({ ...data, rawBat: {}, midBat: null }, 668930, 'hitting', 2026)
  const x = row(noRaw, 'hardHit')
  assert.equal(x.value, '—')
  assert.equal(x.baseline, '—')
  assert.equal(x.detail, 'His — · MLB median — · better than 54% of 612 hitters')
})

test('no view: another season, a player not on file, under three rows, no file', () => {
  assert.equal(percentileView(data, 668930, 'hitting', 2025), null)
  assert.equal(percentileView(data, 999, 'hitting', 2026), null)
  assert.equal(percentileView(data, 2, 'hitting', 2026), null)
  assert.equal(percentileView(null, 668930, 'hitting', 2026), null)
  assert.equal(percentileView({ season: null, bat: {}, pit: {} }, 668930, 'hitting', 2026), null)
})
