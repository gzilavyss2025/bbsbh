// The stage's pure parts: a fixed overhead field, short measured ball paths and completed runner routes. Real data: gamePk 824716 (SEA @ BOS, Fenway), top 2nd, atBatIndex 13
// (a 382 ft home run, tier A) and 14 (a 4-3 groundout, tier A).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { HIT_COORD_ORIGIN, HIT_COORD_FT_PER_UNIT } from '../src/lib/ballpark/hitProjection.js'
import { wallFn } from '../src/screens/gameday/next/stage/scene.js'
import { stagePlay, stateAt } from '../src/screens/gameday/next/stage/play.js'
import { drawStage, fieldFrame } from '../src/screens/gameday/next/stage/drawStage.js'
import { S, TOKENS } from '../src/screens/gameday/next/stage/pixels.js'

const F = JSON.parse(readFileSync(new URL('./fixtures/gameday/stage-824716.json', import.meta.url)))
const layout = resolveBallparkLayout({ venueId: F.venue.id, venueName: F.venue.name, gameDate: F.officialDate })
const wall = wallFn(layout)
const [hr, groundout] = F.plays.map((p) => stagePlay(p, wall))
const coordFeet = (c) => [(c.coordX - HIT_COORD_ORIGIN.x) * HIT_COORD_FT_PER_UNIT, (HIT_COORD_ORIGIN.y - c.coordY) * HIT_COORD_FT_PER_UNIT]

test('every phase stays overhead, with no close-up poses and a brief pitch', () => {
  for (const play of [hr, groundout, stagePlay({}, wall)]) {
    for (let t = 0; t <= play.end; t += 0.03) {
      const st = stateAt(play, t)
      assert.equal(st.view, 'field')
      assert.equal(st.batterPose, undefined)
      assert.equal(st.pitcherPose, undefined)
    }
    assert.ok(play.t.pitch - play.t.windup <= 0.23)
    assert.ok(play.t.chase - play.t.contact <= 0.85)
    assert.ok(play.end < 3)
  }
})

test('the abbreviated ball keeps its landing coordinate and the groundout throw', () => {
  assert.deepEqual(stateAt(hr, hr.t.chase).ballPos, hr.ball.at(hr.ball.T))
  // Over the wall: the path runs on to the coordinate, in the seats.
  const home = hr.ball.at(hr.ball.T)
  const [cx, cy] = coordFeet(F.plays[0].playEvents.at(-1).hitData.coordinates)
  assert.ok(Math.hypot(home[0] - cx, home[1] - cy) < 0.5)
  assert.equal(home[2], 0)
  assert.equal(hr.ball.wall.hit, false)
  // A ground ball ends on the fielder's coordinate, then the throw goes to first base.
  const g = groundout.ball
  assert.ok(g.throw && g.throw.by === '2B' && g.throw.to === '1B')
  const fielded = g.at(g.throw.start - 0.25)
  const [gx, gy] = coordFeet(F.plays[1].playEvents.at(-1).hitData.coordinates)
  assert.ok(Math.hypot(fielded[0] - gx, fielded[1] - gy) < 0.5)
  assert.ok(g.T > g.throw.start)
  assert.ok(Math.hypot(...g.at(g.T).slice(0, 2).map((v, i) => v - g.throw.target[i])) < 0.01)
})

test('a ball with no landing coordinate (tier C) has no chase', () => {
  const p = JSON.parse(JSON.stringify(F.plays[0]))
  delete p.playEvents.at(-1).hitData.coordinates
  const play = stagePlay(p, wall)
  assert.equal(play.ball, null)
  assert.equal(stateAt(play, play.end).view, 'field')
})

test('drawStage is a pure function of the play and the time', () => {
  const w = 195, h = 300, at = (play, t) => drawStage(stateAt(play, t), w, h).px.slice() // the buffer is reused
  for (const [play, t] of [[hr, 0.3], [hr, hr.t.contact + 1], [groundout, groundout.t.chase - 0.2]]) {
    assert.deepEqual(at(play, t), at(play, t))
  }
  // Every pixel is a palette slot, and play movement changes the frame.
  const px = at(hr, hr.t.contact + 1)
  assert.ok(px.every((v) => v < TOKENS.length))
  assert.notDeepEqual(px, at(hr, hr.t.pitch - 0.05))
  // A frame is not allocated per call, and a resize takes the new size.
  const a = drawStage(stateAt(hr, 0.3), w, h), b = drawStage(stateAt(hr, 0.4), w, h)
  assert.equal(a.px, b.px)
  assert.equal(drawStage(stateAt(hr, 0.3), 100, 150).px.length, 100 * 150)
  assert.equal(drawStage(stateAt(hr, 0.3), w, h).px.length, w * h)
})

// The feed lists one runner entry per movement, so a single sends a runner 1B to 2B then 2B to 3B
// as two entries, and a steal mid-at-bat adds another. One runner is one figure (#2662 review).
test('a runner who moves twice is one figure, from his first base to his last', () => {
  const p = JSON.parse(JSON.stringify(F.plays[1]))
  const idx = p.playEvents.at(-1).index
  const mv = (id, playIndex, start, end) => ({ details: { runner: { id }, playIndex }, movement: { originBase: start, start, end, isOut: false }, credits: [] })
  p.runners.push(
    mv(11, idx, '1B', '2B'), mv(11, idx, '2B', '3B'), // a single: two entries, one run
    mv(22, idx - 1, '1B', '2B'), mv(22, idx, '2B', '3B'), // stole second mid-at-bat, then moved on the hit
    mv(33, idx - 1, '2B', '3B'), // stole third mid-at-bat, then stayed
  )
  const rs = stagePlay(p, wall).runners
  assert.equal(rs.length, 4) // the batter and three runners
  assert.deepEqual(rs.slice(1).map((r) => [r.start, r.end]), [['1B', '3B'], ['2B', '3B'], ['3B', '3B']])
})

test('runners finish before settling, including all four bases of a home run', () => {
  const before = stateAt(hr, hr.t.contact)
  assert.deepEqual(before.runners[0].pos, [0, 0, 0])
  const rounding = stateAt(hr, hr.t.contact + 0.6)
  assert.ok(rounding.runners[0].moving)
  assert.ok(rounding.runners[0].pos[1] > 60)
  assert.equal(rounding.runners[0].gone, false)
  const settled = stateAt(hr, hr.t.settle)
  assert.ok(settled.runners.every((r) => !r.moving && r.gone))
  assert.deepEqual(settled.runners, stateAt(hr, hr.end + 1).runners)
  assert.deepEqual(stateAt(groundout, groundout.t.settle).fielders, stateAt(groundout, groundout.end + 1).fielders)
})

test('a walk and an untracked hit still advance runners and stop on their destination', () => {
  for (const tracked of [false, true]) {
    const p = structuredClone(F.plays[0])
    p.runners = [{ details: { runner: { id: 1 }, playIndex: p.playEvents.at(-1).index }, movement: { start: null, end: '1B', isOut: false } }]
    if (!tracked) delete p.playEvents.at(-1).hitData.coordinates
    const play = stagePlay(p, wall), end = stateAt(play, play.end).runners[0]
    assert.ok(stateAt(play, play.t.contact + 0.1).runners[0].moving)
    assert.deepEqual(end.pos, [90 / Math.SQRT2, 90 / Math.SQRT2, 0])
    assert.equal(end.moving, false)
    assert.equal(end.gone, false)
  }
  const walk = stagePlay({ runners: [{ details: { runner: { id: 1 } }, movement: { start: null, end: '1B' } }] }, wall)
  assert.deepEqual(stateAt(walk, walk.end).runners[0].pos, [90 / Math.SQRT2, 90 / Math.SQRT2, 0])
})

test('the entire field fits phone, desktop and landscape slots without following a result', () => {
  for (const [w, h] of [[195, 300], [256, 150], [360, 90]]) {
    const { fence, project } = fieldFrame(wall, w, h)
    for (const p of [...fence, [0, 0, 0]]) {
      const [x, y] = project(p)
      assert.ok(x >= 8 && x < w - 8, 'field stays inside the horizontal margins')
      assert.ok(y >= 8 && y < h - 8, 'field stays inside the vertical margins')
    }
    // Isolate the background: sprites and the ball can legitimately cover a line pixel.
    const fieldOnly = (t) => ({ ...stateAt(hr, t), fielders: {}, runners: [], ballPos: null, pitchPos: null })
    const rest = drawStage(fieldOnly(0), w, h).px.slice()
    assert.deepEqual(rest, drawStage(fieldOnly(hr.end), w, h).px)
    for (const slot of [S.sky, S.crowd1, S.crowd2, S.crowd3, S.crowd4]) assert.ok(!rest.includes(slot))
  }
})
