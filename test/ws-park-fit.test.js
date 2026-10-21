// The "Park fit" card's model (#2316): the pull, centre and opposite-field share of each club's fly
// balls, from the spray store, and how many carry past each Series park's wall. Plus the card's
// rule: it shows on every day type that has data, at either park. Plus which park the card shows (parkView).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { carryRates, fitParks, flyShares, parkFitModel, parkView, MIN_CARRY, MIN_FLY } from '../src/lib/postseason/worldseries/scouting/parkFit.js'
import { scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'
import { HIT_COORD_ORIGIN } from '../src/lib/ballpark/hitProjection.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { wallDistanceAt, wallHeightAt } from '../src/lib/ballpark/ballparkGeometry.js'

const { x: ox, y: oy } = HIT_COORD_ORIGIN
// A ball at `deg` off dead centre (negative: left field), hit from `side`, at launch angle `la`.
const ball = (deg, side = 'R', la = 30, level = 'mlb') => ({
  x: ox + 100 * Math.sin((deg * Math.PI) / 180),
  y: oy - 100 * Math.cos((deg * Math.PI) / 180),
  side,
  launchAngle: la,
  level,
})
const many = (n, b) => Array.from({ length: n }, () => b)

// The two Series parks on the slate date: American Family Field (venue 32) and Tropicana Field (venue 12).
const DAY = '2026-10-22'
const MIL = resolveBallparkLayout({ venueId: 32, gameDate: DAY })
const TB = resolveBallparkLayout({ venueId: 12, gameDate: DAY })
// A fly ball at `deg` that travelled `ft` feet. What a ball must travel to carry is the wall's distance plus
// the wall's height there (no height on file: the distance alone).
const hit = (deg, ft, side = 'R') => ({ ...ball(deg, side), distance: ft })
const needs = (layout, deg) => wallDistanceAt(layout, deg) + (wallHeightAt(layout, deg) ?? 0)
// `n` balls `by` feet past (negative: short of) what `layout` asks of a ball at `deg`.
const pastWall = (layout, deg, by, n = MIN_CARRY) => many(n, hit(deg, needs(layout, deg) + by))
// A park drawn from five posted distances and one posted wall height, so a case does not depend on real park data.
const flat = (h) => ({
  measurements: { dist: { lf: 330, lc: 365, cf: 400, rc: 365, rf: 330 }, wall: h == null ? null : { lf: h, cf: h, rf: h }, measured: null },
  geometry: { fence: null, cfMarkerAngle: 0 },
})

test('a right-handed hitter pulls to left field, a left-handed one to right', () => {
  const s = flyShares([...many(15, ball(-30, 'R')), ...many(15, ball(30, 'L')), ...many(15, ball(0)), ...many(15, ball(30, 'R'))])
  assert.deepEqual(s, { n: 60, pull: 50, center: 25, oppo: 25 })
})

test('only fly balls count: 25 to 50 degrees; no launch angle is left out', () => {
  const s = flyShares([...many(30, ball(0, 'R', 30)), ball(-30, 'R', 10), ball(-30, 'R', 60), ball(-30, 'R', null), ball(-30, 'R', 24.9)])
  assert.equal(s.n, 30)
  assert.equal(s.center, 100)
})

test('Triple-A balls are not counted: the card is the regular season in the majors', () => {
  const s = flyShares([...many(30, ball(0)), ...many(50, ball(-30, 'R', 30, 'aaa'))])
  assert.equal(s.n, 30)
  assert.equal(s.center, 100)
  assert.equal(flyShares(many(60, ball(0, 'R', 30, 'aaa'))), null)
})

test('the three shares add up to 100', () => {
  const s = flyShares([...many(MIN_FLY, ball(-30)), ...many(MIN_FLY, ball(0)), ...many(MIN_FLY, ball(30))])
  assert.equal(s.pull + s.center + s.oppo, 100)
})

test('too few fly balls is no share', () => {
  assert.equal(flyShares(many(MIN_FLY - 1, ball(0))), null)
  assert.equal(flyShares([]), null)
  assert.equal(flyShares(null), null)
})

test('the model has a row per direction and one column per club, in the given order', () => {
  const m = parkFitModel({ 139: many(40, ball(-30)), 158: many(40, ball(30)) }, { clubA: 139, clubB: 158 })
  assert.deepEqual(m.rows.map((r) => r.key), ['pull', 'center', 'oppo'])
  assert.deepEqual(m.rows.map((r) => r.label), ['Pull', 'Center', 'Opposite field'])
  assert.deepEqual(m.rows[0].shares, [100, 0])
  assert.deepEqual(m.rows[2].shares, [0, 100])
  assert.deepEqual(m.counts, [40, 40])
})

test('no card when either club has no usable sample', () => {
  assert.equal(parkFitModel({ 139: many(40, ball(0)), 158: [] }, { clubA: 139, clubB: 158 }), null)
  assert.equal(parkFitModel({}, { clubA: 139, clubB: 158 }), null)
  assert.equal(parkFitModel(null, { clubA: 139, clubB: 158 }), null)
})

test('Park fit: on an off day and on a game day, at either park, and only with data', () => {
  const ids = (i) => scoutingModel(i).map((c) => c.id)
  // The card draws both clubs' parks now, so tonight's venue no longer decides it.
  assert.ok(ids({ dayType: 'off', parkFit: { rows: [] } }).includes('park-fit'))
  assert.ok(ids({ dayType: 'game', parkFit: { rows: [] } }).includes('park-fit'))
  assert.ok(!ids({ dayType: 'game', parkFit: null }).includes('park-fit'))
  assert.ok(!ids({ dayType: 'off', parkFit: null }).includes('park-fit'))
})

test('Park fit comes right after Platoon off day, and after Film room on a game day', () => {
  const all = { nineKeys: true, gloveLegs: [1], edges: [1], pitchByPitch: {}, plateUmpire: { name: 'A' }, meetings: [1], platoon: [1], parkFit: {} }
  const off = scoutingModel({ dayType: 'off', ...all }).map((c) => c.id)
  assert.equal(off.indexOf('park-fit'), off.indexOf('platoon') + 1)
  const g = scoutingModel({ dayType: 'game', ...all }).map((c) => c.id)
  assert.ok(g.indexOf('park-fit') > g.indexOf('film-room'))
})

test('a fly ball carries when it travels farther than the wall and its height on its own angle', () => {
  // Half the balls land 5 feet past what American Family's wall asks at dead center, half 5 feet short of it.
  const r = carryRates([...pastWall(MIL, 0, 5), ...pastWall(MIL, 0, -5)], MIL)
  assert.equal(r.center, 50)
  assert.equal(r.pull, null, 'no ball in a direction is a dash, not 0%')
  assert.equal(r.oppo, null)
})

test('the same fly balls carry in one park and not in the other', () => {
  // Ten degrees toward left, Tropicana's wall (and its top) stands well behind American Family's.
  const deg = -10
  const [near, deep] = [needs(MIL, deg), needs(TB, deg)]
  assert.ok(deep - near > 10, `Tropicana ${deep} ft, American Family ${near} ft`)
  const balls = many(MIN_CARRY, hit(deg, (near + deep) / 2))
  assert.equal(carryRates(balls, MIL).center, 100)
  assert.equal(carryRates(balls, TB).center, 0)
})

test('a ball past the wall but under its top does not carry: the wall height counts', () => {
  const h = wallHeightAt(MIL, 0)
  assert.ok(h > 3, `American Family's center wall is ${h} ft`)
  const wall = wallDistanceAt(MIL, 0)
  const rate = (ft) => carryRates(many(MIN_CARRY, hit(0, ft)), MIL).center
  assert.equal(rate(wall + h / 2), 0, 'past the wall sign, but the ball would meet the wall')
  assert.equal(rate(wall + h + 1), 100)
})

test('the same ball clears a low wall and not a tall one', () => {
  // Two parks with the same distances, walls of 8 and 37 feet (a Monster), and a ball 20 feet past the center sign.
  const balls = many(MIN_CARRY, hit(0, 420))
  assert.equal(carryRates(balls, flat(8)).center, 100)
  assert.equal(carryRates(balls, flat(37)).center, 0)
})

test('a park with no wall heights on file asks for the distance alone', () => {
  assert.equal(wallHeightAt(flat(null), 0), null)
  assert.equal(carryRates(many(MIN_CARRY, hit(0, 401)), flat(null)).center, 100)
  assert.equal(carryRates(many(MIN_CARRY, hit(0, 399)), flat(null)).center, 0)
})

test('wallHeightAt reads the heights the drawing uses: Savant\'s measured five, else the posted three', () => {
  assert.equal(wallHeightAt(MIL, 0), MIL.measurements.measured.height.cf)
  assert.equal(wallHeightAt(flat(8), 0), 8)
  assert.equal(wallHeightAt(flat(8), -45), 8)
})

test('the carry floor is 20 balls (Gary, 2026-10-21)', () => {
  assert.equal(MIN_CARRY, 20)
})

test('a direction under the floor has no carry figure; a ball with no distance or foul of the poles is not counted', () => {
  const few = pastWall(MIL, 0, 5, MIN_CARRY - 1)
  assert.equal(carryRates(few, MIL).center, null)
  assert.equal(carryRates([...few, { ...ball(0), distance: null }], MIL).center, null, 'no distance, not counted')
  // 60 degrees off center is foul of the pole: no wall to clear, so no carry and no count.
  assert.equal(carryRates([...few, hit(0, 999), hit(-60, 999)], MIL).pull, null)
  assert.equal(carryRates(pastWall(MIL, 0, 5), MIL).center, 100)
  // Only fly balls in the majors count, as for the shares.
  assert.equal(carryRates(many(MIN_CARRY, { ...hit(0, 999), level: 'aaa' }), MIL).center, null)
  assert.equal(carryRates(many(MIN_CARRY, { ...hit(0, 999), launchAngle: 10 }), MIL).center, null)
})

test('a left-handed hitter pulls toward right: the carry directions read the same way as the shares', () => {
  // 30 degrees toward right is the pull side of a lefty and the opposite side of a righty.
  const lefty = carryRates(pastWall(MIL, 30, 5).map((b) => ({ ...b, side: 'L' })), MIL)
  const righty = carryRates(pastWall(MIL, 30, 5), MIL)
  assert.equal(lefty.pull, 100)
  assert.equal(righty.oppo, 100)
})

test('the model has one carry block per layout, a rate per club in the given order', () => {
  const balls = { 139: many(40, hit(0, 600)), 158: many(40, hit(0, 100)) }
  const m = parkFitModel(balls, { clubA: 139, clubB: 158, layouts: [TB, MIL] })
  assert.equal(m.carry.length, 2)
  for (const block of m.carry) {
    assert.deepEqual(block.map((r) => r.key), ['pull', 'center', 'oppo'])
    assert.deepEqual(block[1].rates, [100, 0], 'the long balls carry in both parks, the short ones in neither')
    assert.deepEqual(block[0].rates, [null, null])
  }
  assert.deepEqual(parkFitModel(balls, { clubA: 139, clubB: 158 }).carry, [], 'no layouts, no carry blocks')
})

test('fitParks: one park per club in the given order; the focus game wins for its host; no club is named', () => {
  const venues = { 139: 12, 158: 32 }
  const ids = (sides, extra = {}) =>
    fitParks({ sides, venueByClub: venues, slateDate: DAY, ...extra }).map((p) => p.layout.venueId)
  assert.deepEqual(ids([139, 158]), [12, 32])
  assert.deepEqual(ids([158, 139]), [32, 12])
  assert.deepEqual(fitParks({ sides: [139, 158], venueByClub: venues, slateDate: DAY }).map((p) => p.clubId), [139, 158])
  // A game moved to another park draws the park it is played in (venue 14, Rogers Centre, is on file).
  assert.deepEqual(ids([139, 158], { game: { homeId: 158, venue: { id: 14 } } }), [12, 14])
  // A club whose park has no layout is left out, and a park two clubs share is drawn once.
  assert.deepEqual(ids([139, 158], { venueByClub: { 139: 999999, 158: 32 } }), [32])
  assert.deepEqual(ids([139, 158], { venueByClub: { 139: 32, 158: 32 } }), [32])
  assert.deepEqual(ids([139, 158], { venueByClub: null }), [])
})

test('fitParks: a club keeps its ink when away and home turn over, and when only one park resolves', () => {
  const inks = (sides, venueByClub = { 139: 12, 158: 32 }) =>
    Object.fromEntries(fitParks({ sides, venueByClub, slateDate: DAY }).map((p) => [p.clubId, p.ink]))
  assert.deepEqual(inks([139, 158]), { 139: 0, 158: 1 })
  assert.deepEqual(inks([158, 139]), { 139: 0, 158: 1 }, 'the order of sides does not move the ink')
  assert.deepEqual(inks([158, 139], { 139: 999999, 158: 32 }), { 158: 1 }, 'the other park is missing: the ink stays')
})

test('parkView: two parks open on both; a pick shows one park alone, and the carry block keeps the last pick', () => {
  const two = [{ clubId: 139 }, { clubId: 158 }]
  const start = parkView(two, 'both', null)
  assert.deepEqual([start.show, start.both, start.one, start.at], ['both', true, false, 0])
  assert.deepEqual(start.lit.map((p) => p.on), [true, true])
  const second = parkView(two, 158, 158)
  assert.deepEqual([second.show, second.both, second.at], [158, false, 1])
  assert.deepEqual(second.lit.map((p) => [p.clubId, p.on]), [[139, false], [158, true]])
  // Back to both: the carry block stays on the park it last showed while it folds away.
  assert.equal(parkView(two, 'both', 158).at, 1)
})

test('parkView: one park shows alone with nothing to pick; a pick whose park is gone reads as both', () => {
  const one = parkView([{ clubId: 158 }], 'both', null)
  assert.deepEqual([one.show, one.one, one.both, one.at], [158, true, false, 0])
  assert.deepEqual(one.lit.map((p) => p.on), [true])
  // The pair resolved again without the picked club: both parks, and the carry block falls back to the first.
  const gone = parkView([{ clubId: 158 }, { clubId: 160 }], 139, 139)
  assert.deepEqual([gone.show, gone.both, gone.at], ['both', true, 0])
  assert.deepEqual(gone.lit.map((p) => p.on), [true, true])
})

test('parkView keeps each park\'s own fields beside its on flag', () => {
  const parks = fitParks({ sides: [139, 158], venueByClub: { 139: 12, 158: 32 }, slateDate: DAY })
  const { lit } = parkView(parks, 139, 139)
  assert.deepEqual(lit.map((p) => [p.clubId, p.ink, p.layout.venueId, p.on]), [[139, 0, 12, true], [158, 1, 32, false]])
})
