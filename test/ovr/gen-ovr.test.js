// OVR step 6 (#1720): the pure half of scripts/gen-ovr.mjs. Fielding percentile with
// a plate-appearance floor, the career blend, the minimum-data rule, and the number
// guard. Inputs are literal season maps, no file reads.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FLD_MIN_PA, buildRatings, percentileAmong } from '../../scripts/lib/ovr/build.mjs'
import { blendCareer } from '../../src/api/ovr/career.js'
import { careerOvr, minorRating } from '../../src/api/ovr/minor.js'
import { potRating } from '../../src/api/ovr/pot.js'
import { percentileToRating, rateHitter } from '../../src/api/ovr/rating.js'

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)
// One regular with every Savant cell, and a floor-clearing PA total, in season 2026.
const full = { xwoba: 70, squaredUp: 60, ev: 65, hardHit: 55, brl: 75, batSpeed: 50, sprintSpeed: 40 }
const bat = (cells = full) => ({ 2026: cells })
const inputs = (over = {}) => ({
  bat: { 1: bat() },
  pit: {},
  fld: { 1: { 2026: 5 } },
  pa: { 1: { 2026: 600 } },
  birthYear: {},
  ...over,
})

test('percentileAmong gives tied values the middle rank, not the lowest', () => {
  const p = percentileAmong({ a: 0, b: 0, c: 0, d: 4 })
  near(p.a, 37.5) // (0 below + 3/2 tied) / 4
  assert.equal(p.a, p.c)
  near(p.d, 87.5)
})

test('Fielding ranks only hitters at or over the plate-appearance floor', () => {
  const out = buildRatings(
    inputs({
      bat: { 1: bat(), 2: bat(), 3: bat() },
      fld: { 1: { 2026: 5 }, 2: { 2026: -5 }, 3: { 2026: 50 } },
      pa: { 1: { 2026: FLD_MIN_PA }, 2: { 2026: FLD_MIN_PA + 100 }, 3: { 2026: FLD_MIN_PA - 1 } },
    }),
  )
  // Player 3's 50 runs sits under the floor: no Fielding bar, and he does not push 1 and 2 down.
  assert.equal(out.bat[3].bars.fielding, undefined)
  near(out.bat[1].bars.fielding, percentileToRating(75))
  near(out.bat[2].bars.fielding, percentileToRating(25))
})

test('a hitter under the floor in every season is rated without Fielding, weight shared', () => {
  const out = buildRatings(inputs({ pa: { 1: { 2026: 10 } } }))
  assert.equal(out.bat[1].bars.fielding, undefined)
  near(out.bat[1].ovr, rateHitter(blendCareer(bat(), undefined)).ovr)
})

test('Fielding blends the seasons that clear the floor, with the career weights', () => {
  const out = buildRatings(
    inputs({
      bat: { 1: { 2026: full, 2025: full }, 2: bat() },
      fld: { 1: { 2026: 0, 2025: 5 }, 2: { 2026: 10 } },
      pa: { 1: { 2026: 500, 2025: 500 }, 2: { 2026: 500 } },
    }),
  )
  // 2026: player 1 is 1st of 2 (25th pct); 2025: player 1 stands alone (50th).
  const want = rateHitter({ ...blendCareer({ 2026: full, 2025: full }), fld: blendCareer({ 2026: { fld: 25 }, 2025: { fld: 50 } }).fld })
  near(out.bat[1].bars.fielding, want.bars.fielding)
  assert.deepEqual(out.bat[1].seasons, [2026, 2025])
})

test('the minimum-data rule drops a hitter with no Power cell and a pitcher with no bb', () => {
  const noPower = { xwoba: 70, squaredUp: 60, sprintSpeed: 40 }
  const pitFull = { whiff: 60, k: 60, fbVelo: 60, hardHit: 60, xera: 60, bb: 60 }
  const out = buildRatings(
    inputs({
      bat: { 1: bat(noPower) },
      pit: { 8: { 2026: pitFull }, 9: { 2026: { ...pitFull, bb: null } } },
    }),
  )
  assert.equal(out.bat[1], undefined)
  assert.ok(out.pit[8])
  assert.equal(out.pit[9], undefined)
})

test('a string percentile is read as its number and counted', () => {
  const asString = buildRatings(inputs({ bat: { 1: bat({ ...full, xwoba: '70' }) } }))
  const asNumber = buildRatings(inputs())
  near(asString.bat[1].ovr, asNumber.bat[1].ovr)
  assert.equal(asString.strings, 1)
  // '' and 'x' are no number: they must not read as 0.
  const junk = buildRatings(inputs({ bat: { 1: bat({ ...full, xwoba: '', squaredUp: 'x' }) } }))
  assert.equal(junk.bat[1], undefined) // Contact has no metric left
})

test('a blended percentile outside 0-100 is counted before it is clamped', () => {
  // A 23-year-old sprinter at 100 twice: the age shift lifts the old 100 past 100.
  const top = { ...full, sprintSpeed: 100 }
  const out = buildRatings(
    inputs({
      bat: { 1: { 2026: top, 2024: top } },
      birthYear: { 1: 2003 },
    }),
  )
  assert.ok(out.clamped >= 1)
})

test('a missing birth year skips the age shift and still rates', () => {
  const s = { 2026: full, 2024: { ...full, sprintSpeed: 90 } }
  const out = buildRatings(inputs({ bat: { 1: s } }))
  near(out.bat[1].bars.speed, percentileToRating(blendCareer(s).sprintSpeed))
})

// OVR step 7 (#1721): minor leaguers, minor-league seasons in the blend, and POT.
const row = (over = {}) => ({ season: 2026, sport: 12, group: 'hitting', n: 300, pct: 80, ...over })
const withMinors = (over) => buildRatings(inputs({ season: 2026, ...over }))

test('a minor leaguer with a current-season row gets OVR and level, no bars', () => {
  const out = withMinors({ minors: { 7: [row()], 8: [row({ group: 'pitching', sport: 14, pct: 100, n: 450 })] } })
  assert.deepEqual(out.bat[7], { ovr: minorRating(80, 12), seasons: [2026], level: 12 })
  assert.deepEqual(out.pit[8], { ovr: 39, seasons: [2026], level: 14 })
})

test('a player with minor-league rows but none this season gets no entry', () => {
  assert.equal(withMinors({ minors: { 7: [row({ season: 2025 })] } }).bat[7], undefined)
})

test('minor-league seasons pull an MLB rating toward them and leave the bars alone', () => {
  const base = withMinors({}).bat[1]
  const out = withMinors({ minors: { 1: [row({ season: 2025, pct: 0 })] } }).bat[1]
  assert.deepEqual(out.bars, base.bars)
  assert.ok(out.ovr < base.ovr)
  near(out.ovr, careerOvr({ ovr: base.ovr, years: base.seasons }, [row({ season: 2025, pct: 0 })]))
  assert.equal(out.level, undefined) // an MLB entry has no level
})

test('a player with no minor-league row rates exactly as before', () => {
  assert.deepEqual(withMinors({ minors: { 9: [row()] } }).bat[1], buildRatings(inputs()).bat[1])
})

test('POT goes only to Top 100 players that have a rating', () => {
  const out = withMinors({
    minors: { 7: [row()], 8: [row({ pct: 100 })] },
    top: { 7: { rank: 1, age: 19 }, 3: { rank: 2, age: 19 } },
  })
  near(out.bat[7].pot, potRating(out.bat[7].ovr, 1, 19))
  assert.equal(out.bat[8].pot, undefined) // a minor leaguer off the list
  assert.equal(out.bat[1].pot, undefined) // an MLB regular off the list
  assert.equal(out.bat[3], undefined) // on the list, no rating, no card
})

test('a Top 100 major leaguer gets POT on his MLB entry', () => {
  const out = withMinors({ top: { 1: { rank: 5, age: 22 } } })
  assert.ok(out.bat[1].pot >= out.bat[1].ovr)
})
