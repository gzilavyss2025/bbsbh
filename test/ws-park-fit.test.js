// The "Park fit" card's model (#2316): the pull, centre and opposite-field share of each club's fly
// balls, from the spray store. Plus the card's rule: Milwaukee only, always off day, game day at home.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flyShares, parkFitModel, MIN_FLY } from '../src/lib/postseason/worldseries/scouting/parkFit.js'
import { scoutingModel } from '../src/lib/postseason/worldseries/scouting/scouting.js'
import { HIT_COORD_ORIGIN } from '../src/lib/ballpark/hitProjection.js'

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

test('Park fit: every off day; a game day only at Milwaukee (venue 32)', () => {
  const all = { parkFit: { rows: [] } }
  const ids = (i) => scoutingModel(i).map((c) => c.id)
  assert.ok(ids({ dayType: 'off', ...all, venueId: 12 }).includes('park-fit'))
  assert.ok(ids({ dayType: 'game', ...all, venueId: 32 }).includes('park-fit'))
  assert.ok(!ids({ dayType: 'game', ...all, venueId: 12 }).includes('park-fit'))
  assert.ok(!ids({ dayType: 'game', ...all, venueId: null }).includes('park-fit'))
  assert.ok(!ids({ dayType: 'off', parkFit: null }).includes('park-fit'))
})

test('Park fit comes right after Platoon off day, and after Film room on a game day', () => {
  const all = { nineKeys: true, gloveLegs: [1], edges: [1], pitchByPitch: {}, plateUmpire: { name: 'A' }, meetings: [1], platoon: [1], parkFit: {}, venueId: 32 }
  const off = scoutingModel({ dayType: 'off', ...all }).map((c) => c.id)
  assert.equal(off.indexOf('park-fit'), off.indexOf('platoon') + 1)
  const g = scoutingModel({ dayType: 'game', ...all }).map((c) => c.id)
  assert.ok(g.indexOf('park-fit') > g.indexOf('film-room'))
})
