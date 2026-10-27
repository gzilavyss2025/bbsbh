// The stage's pure parts (#2569): contact on the pitch's last sample, and a field view whose ball
// ends on the hit coordinate. Real data: gamePk 824716 (SEA @ BOS, Fenway), top 2nd, atBatIndex 13
// (a 382 ft home run, tier A) and 14 (a 4-3 groundout, tier A).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { HIT_COORD_ORIGIN, HIT_COORD_FT_PER_UNIT } from '../src/lib/ballpark/hitProjection.js'
import { wallFn } from '../src/screens/gameday/next/stage/scene.js'
import { stagePlay, stateAt } from '../src/screens/gameday/next/stage/play.js'
import { drawStage } from '../src/screens/gameday/next/stage/drawStage.js'
import { CONTACT } from '../src/screens/gameday/next/stage/swing.js'
import { S } from '../src/screens/gameday/next/stage/pixels.js'

const F = JSON.parse(readFileSync(new URL('./fixtures/gameday/stage-824716.json', import.meta.url)))
const layout = resolveBallparkLayout({ venueId: F.venue.id, venueName: F.venue.name, gameDate: F.officialDate })
const wall = wallFn(layout)
const [hr, groundout] = F.plays.map((p) => stagePlay(p, wall))
const coordFeet = (c) => [(c.coordX - HIT_COORD_ORIGIN.x) * HIT_COORD_FT_PER_UNIT, (HIT_COORD_ORIGIN.y - c.coordY) * HIT_COORD_FT_PER_UNIT]

test('the batter is at contact on the pitch\'s last sample', () => {
  for (const play of [hr, groundout]) {
    const st = stateAt(play, play.t.pitch)
    assert.ok(Math.abs(st.clock - CONTACT) < 1e-9)
    assert.equal(st.pitchU, 1)
    assert.deepEqual(st.pitchPos, play.last.at(1))
    // A hundredth of a second earlier he is still launching.
    assert.ok(stateAt(play, play.t.pitch - 0.01).clock < CONTACT)
  }
})

test('the field view cuts in at contact and the ball ends on the hit coordinate', () => {
  assert.equal(stateAt(hr, hr.t.pitch).view, 'pitch')
  assert.equal(stateAt(hr, hr.t.contact).view, 'field')
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
  assert.equal(stateAt(play, play.end).view, 'pitch')
})

test('drawStage is a pure function of the play and the time', () => {
  const w = 195, h = 300, at = (play, t) => drawStage(stateAt(play, t), w, h).px.slice() // the buffer is reused
  for (const [play, t] of [[hr, 0.3], [hr, hr.t.contact + 1], [groundout, groundout.t.chase - 0.2]]) {
    assert.deepEqual(at(play, t), at(play, t))
  }
  // Every pixel is a palette slot, and the two views differ.
  const px = at(hr, hr.t.contact + 1)
  assert.ok(px.every((v) => v <= S.frame))
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
