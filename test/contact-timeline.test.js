// Contact replay phase A (docs/contact-replay.md §8): the replay clock. gamePk 849810 (MIL @ LAD,
// 2026-10-15) supplies real swings: at-bat 2 (take, foul, whiff), 16 (whiff, home run), 1 (grounder).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pitchCardInfo } from '../src/api/playbyplay/pitchInfo.js'
import { atBatScenePitches } from '../src/lib/pitcherCard/atBat.js'
import { battedPath } from '../src/lib/pitcherCard/batted.js'
import { PLATE_FRONT, realFlight } from '../src/lib/pitcherCard/camera.js'
import { contactPoint, pitchBeats, replayFrame, sceneClock } from '../src/lib/pitcherCard/contactTimeline.js'
import { HOLD, SLOW, sceneFrame } from '../src/lib/pitcherCard/scene.js'
import { YC } from '../src/lib/pitcherCard/swing.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/contact-replay/game-849810.trimmed.json', import.meta.url), 'utf8'))
const details = (atBatIndex) => {
  const play = fixture.liveData.plays.allPlays.find((p) => p.about.atBatIndex === atBatIndex)
  return { details: pitchCardInfo(fixture, play).pitchDetails, batSide: play.matchup.batSide.code }
}
const scene = (atBatIndex) => {
  const { details: d, batSide } = details(atBatIndex)
  return atBatScenePitches(d, 'hitter', batSide)
}
const bySwing = (atBatIndex, swing) => scene(atBatIndex).find((p) => p.swing === swing)
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`)

test('contactPoint: the pitch path at y = YC, in front of the plate', () => {
  const { details: d } = details(15)
  const p = d.find((x) => x.cat === 'inplay')
  const flight = realFlight({ ...p, release: [0, p.releaseY, 0] })
  const c = contactPoint(flight)
  near(c.K[1], YC, 1e-6)
  assert.ok(c.K[1] > PLATE_FRONT)
  assert.ok(c.tc > 0 && c.tc < flight.T)
  assert.deepEqual(c.K, flight.at(c.tc / flight.T))
})

test('contactPoint: null when the path never reaches YC', () => {
  assert.equal(contactPoint({ T: 0.4, at: (u) => [0, 5 - u, 3] }), null)
})

test('atBatScenePitches: contact is on a swing and not on a take', () => {
  for (const p of scene(1)) assert.equal('contact' in p, p.swing != null, `pitch ${p.no}`)
  assert.ok(bySwing(1, 'whiff').contact.K.length === 3)
})

test('pitchBeats: a take fills the slot sceneFrame gives a one-pitch list', () => {
  const take = scene(1).find((p) => p.swing == null)
  const { totalMs, ...rest } = pitchBeats(take, SLOW)
  assert.deepEqual(rest, {})
  near(totalMs, (take.T * SLOW + HOLD) * 1000, 1e-9)
  const slot = totalMs / 1000
  assert.equal(sceneFrame([take], slot - 0.001, SLOW, true).done, undefined)
  assert.equal(sceneFrame([take], slot, SLOW, true).done, true)
})

test('pitchBeats: the beats of a ball in play are in order', () => {
  for (const [ab, swing] of [[0, 'inplay'], [15, 'inplay'], [36, 'inplay'], [61, 'inplay']]) {
    const b = pitchBeats(bySwing(ab, swing), SLOW, 3)
    assert.equal(b.freezeMs, 66)
    // The side view starts 140 ms after the ball leaves (§8.2), which can be before the bat's
    // follow-through ends: sceneEnd and sideStart are NOT ordered (see the PR).
    assert.ok(b.contactMs < b.exitMs && b.exitMs <= b.sceneEndMs, `ab ${ab + 1}`)
    assert.ok(b.exitMs < b.sideStartMs && b.sideStartMs < b.landMs && b.landMs < b.figsStartMs && b.figsStartMs <= b.totalMs, `ab ${ab + 1}`)
  }
})

test('pitchBeats: a foul freezes 33 ms, a whiff does not freeze and has no side beats', () => {
  const foul = pitchBeats(bySwing(1, 'foul'), SLOW)
  assert.equal(foul.freezeMs, 33)
  assert.equal(foul.sideStartMs, null)
  const whiff = pitchBeats(bySwing(1, 'whiff'), SLOW, 2)
  assert.equal(whiff.freezeMs, 0)
  assert.equal(whiff.sideStartMs, null)
  assert.equal(whiff.sideMs, null)
  assert.ok(whiff.contactMs < whiff.sceneEndMs && whiff.sceneEndMs < whiff.figsStartMs && whiff.figsStartMs <= whiff.totalMs)
  near(whiff.figsStartMs - whiff.sceneEndMs, 120, 1e-9)
})

test('sceneClock: holds during the freeze and runs after it', () => {
  const b = pitchBeats(bySwing(15, 'inplay'), SLOW)
  const { contactMs: c, freezeMs: f } = b
  assert.equal(sceneClock(b, c - 100), c - 100)
  assert.equal(sceneClock(b, c), c)
  assert.equal(sceneClock(b, c + f / 2), c)
  assert.equal(sceneClock(b, c + f), c)
  assert.equal(sceneClock(b, c + f + 100), c + 100)
  const whiff = pitchBeats(bySwing(1, 'whiff'), SLOW)
  assert.equal(sceneClock(whiff, whiff.contactMs + 40), whiff.contactMs + 40)
  assert.equal(sceneClock({ totalMs: 3000 }, 1234), 1234)
})

test('replayFrame: steps through pitches of different lengths, then is done', () => {
  const list = [{ totalMs: 1000 }, { totalMs: 3000 }, { totalMs: 500 }]
  assert.deepEqual(replayFrame(list, 0), { idx: 0, tau: 0, done: false })
  assert.deepEqual(replayFrame(list, 999), { idx: 0, tau: 999, done: false })
  assert.deepEqual(replayFrame(list, 1000), { idx: 1, tau: 0, done: false })
  assert.deepEqual(replayFrame(list, 3999), { idx: 1, tau: 2999, done: false })
  assert.deepEqual(replayFrame(list, 4000), { idx: 2, tau: 0, done: false })
  assert.deepEqual(replayFrame(list, 4500), { idx: 2, tau: 500, done: true })
  assert.deepEqual(replayFrame(list, 99999), { idx: 2, tau: 500, done: true })
  assert.deepEqual(replayFrame(list, null), { idx: 2, tau: 500, done: true })
})

test('replayFrame: a picked pitch plays alone', () => {
  const list = [{ totalMs: 1000 }, { totalMs: 3000 }, { totalMs: 500 }]
  assert.deepEqual(replayFrame(list, 0, 1), { idx: 1, tau: 0, done: false })
  assert.deepEqual(replayFrame(list, 2999, 1), { idx: 1, tau: 2999, done: false })
  assert.deepEqual(replayFrame(list, 3000, 1), { idx: 1, tau: 3000, done: true })
  assert.deepEqual(replayFrame(list, 10, 0), { idx: 0, tau: 10, done: false })
  assert.deepEqual(replayFrame(list, 10, -1), { idx: 0, tau: 10, done: false }) // no pick
  assert.deepEqual(replayFrame([], 10), { idx: 0, tau: 0, done: true })
})

test('gamePk 849810 at-bat 16: the home run is hit in front of the plate and lands at 428 ft', () => {
  const hr = bySwing(15, 'inplay')
  assert.ok(hr.contact.K[1] > PLATE_FRONT)
  const b = battedPath(hr.hit, hr.contact.K)
  const [x, y] = b.pos(b.T)
  near(Math.hypot(x - hr.contact.K[0], y - hr.contact.K[1]), 428, 1)
  assert.ok(x > hr.contact.K[0], 'hit to right field')
})
