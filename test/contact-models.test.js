// Contact replay phase A (docs/contact-replay.md §11): the swing and the batted ball.
import assert from 'node:assert/strict'
import test from 'node:test'
import { HIT_COORD_FT_PER_UNIT, HIT_COORD_ORIGIN } from '../src/lib/ballpark/hitProjection.js'
import { battedPath, foulPath, isBunt, sideViewPath } from '../src/lib/pitcherCard/batted.js'
import { CENTRE_OFFSET, FOUL_OFFSET, WHIFF_OFFSET, YC, swingModel } from '../src/lib/pitcherCard/swing.js'

const K = [0.3, YC, 2.6]
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

test('swing: the drawing constants', () => {
  assert.equal(YC, 2.2)
  assert.deepEqual([WHIFF_OFFSET, FOUL_OFFSET, CENTRE_OFFSET], [0.42, 0.11, 2.25])
})

test('swing: at contact the sweet spot is on the target', () => {
  for (const swing of ['inplay', 'foul', 'whiff']) {
    const m = swingModel({ batSide: 'R', swing, K })
    const [x, y, z] = m.sweet(m.at(0).th)
    const [bx, by, bz] = m.Kb
    near(x, bx, 0.01, swing)
    near(y, by, 0.01, swing)
    near(z, bz, 0.01, swing)
  }
})

test('swing: the target sits over the ball for a foul and a whiff', () => {
  for (const [swing, over] of [['inplay', 0], ['foul', FOUL_OFFSET], ['whiff', WHIFF_OFFSET]]) {
    const m = swingModel({ batSide: 'L', swing, K })
    near(m.sweet(0)[2] - K[2], over, 0.01, swing)
  }
})

test('swing: a right-handed batter stands left of the plate, a left-handed one right', () => {
  const load = (batSide) => swingModel({ batSide, swing: 'inplay', K }).at(-1).knob[0]
  assert.ok(load('R') < 0)
  assert.ok(load('L') > 0)
})

test('swing: theta rises with time across the whole swing', () => {
  for (const swing of ['inplay', 'whiff']) {
    const m = swingModel({ batSide: 'R', swing, K, attackDeg: 14, swingSec: 0.14 })
    let last = -Infinity
    for (let dt = -m.SWING; dt <= m.FOLLOW + 1e-9; dt += 0.002) {
      const { th } = m.at(dt)
      assert.ok(th >= last, `${swing} reversed at ${dt}`)
      last = th
    }
    near(m.at(-m.SWING).th, m.TH0, 1e-9)
    near(m.at(m.FOLLOW).th, m.THE, 1e-9)
  }
})

const homer = { exitVelo: 113.1, launchAngle: 34, distance: 428, coordX: 187.05, coordY: 36.53 }

test('batted: the fitted flight lands at the measured distance', () => {
  for (const hit of [homer, { exitVelo: 100, launchAngle: 25, distance: 330, coordX: 100, coordY: 80 }]) {
    const b = battedPath(hit, K)
    near(dist(b.pos(b.T), K), hit.distance, 1)
    near(b.pos(b.T)[2], 0, 1e-6)
    assert.equal(b.pos(0).join(), K.join())
  }
})

test('batted: the spray sign follows coordX', () => {
  const at = (coordX) => battedPath({ ...homer, coordX }, K)
  const x = (coordX) => at(coordX).pos(at(coordX).T)[0] - K[0]
  assert.ok(x(HIT_COORD_ORIGIN.x + 40) > 0)
  assert.ok(x(HIT_COORD_ORIGIN.x - 40) < 0)
  near(x(HIT_COORD_ORIGIN.x), 0, 1e-9)
})

test('batted: a launch angle under 8 degrees never rises above the contact height', () => {
  for (const launchAngle of [-5, 0, null]) {
    const b = battedPath({ exitVelo: 100, launchAngle, distance: 150, coordX: 140, coordY: 120 }, K)
    for (let t = 0; t <= b.T; t += 0.01) assert.ok(b.pos(t)[2] <= K[2] + 1e-9, `${launchAngle} at ${t}`)
  }
})

test('batted: the exit ends inside 0.9 s', () => {
  const slow = battedPath({ exitVelo: 45, launchAngle: -2, distance: 60 }, K)
  const popup = battedPath({ exitVelo: 80, launchAngle: 70, distance: 150 }, K)
  for (const b of [battedPath(homer, K), slow, popup, foulPath(K, 'R'), foulPath(K, 'L')]) {
    assert.ok(b.exitSec > 0 && b.exitSec <= 0.9, `${b.exitSec}`)
  }
  assert.ok(battedPath(homer, K).exitSec < 0.3, 'a fly ball leaves in a flash')
})

test('batted: no distance uses the chord from the coordinates', () => {
  const hit = { exitVelo: 100, launchAngle: 25, distance: null, coordX: 100, coordY: 80 }
  const chord = Math.hypot(100 - HIT_COORD_ORIGIN.x, HIT_COORD_ORIGIN.y - 80) * HIT_COORD_FT_PER_UNIT
  const b = battedPath(hit, K)
  near(dist(b.pos(b.T), K), chord, 1)
})

test('batted: no coordinates goes straight out, no distance and no coordinates still draws', () => {
  const b = battedPath({ ...homer, coordX: null, coordY: null }, K)
  near(b.pos(b.T)[0], K[0], 1e-9)
  const bare = battedPath({ exitVelo: 95, launchAngle: 20 }, K)
  assert.ok(Number.isFinite(bare.T) && bare.pos(bare.T).every(Number.isFinite))
})

test('batted: no exit speed means no path; a hit under 40 mph is a bunt', () => {
  assert.equal(battedPath({ launchAngle: 20, distance: 200 }, K), null)
  assert.equal(battedPath(null, K), null)
  assert.equal(sideViewPath(null), null)
  assert.equal(isBunt({ exitVelo: 39.9 }), true)
  assert.equal(isBunt({ exitVelo: 40 }), false)
  assert.equal(isBunt({ exitVelo: null }), false)
})

test('foul: the drawn foul starts at the contact point and runs back over the camera', () => {
  const f = foulPath(K, 'R')
  assert.equal(f.pos(0).join(), K.join())
  assert.ok(f.pos(0.1)[1] < K[1])
  assert.ok(f.pos(0.1)[2] > K[2])
})

test('sideView: the §7.1 scale (0 to 450 ft over 304 units, baseline at y = 80)', () => {
  const s = sideViewPath(homer)
  near(s.pos(0)[0], 16, 1e-9)
  near(s.pos(0)[1], 80 - (3 * 304) / 450, 1e-9) // starts 3 ft up
  near(s.pos(s.T)[0], 16 + (428 * 304) / 450, 1)
  near(s.pos(s.T)[1], 80, 1e-6)
  assert.ok(s.apex.ft > 60 && s.apex.y < s.pos(0)[1])
  near(s.apex.y, 80 - (s.apex.ft * 304) / 450, 1e-9)
})

test('sideView: a grounder and a ball with no launch angle have no apex', () => {
  assert.equal(sideViewPath({ exitVelo: 100, launchAngle: -5, distance: 150 }).apex, null)
  assert.equal(sideViewPath({ exitVelo: 100, launchAngle: null, distance: 150 }).apex, null)
})
