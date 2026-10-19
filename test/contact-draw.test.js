// The contact replay's mark setters (lib/pitcherCard/contactDraw.js): pure functions of nodes and
// numbers, so a node here is a bag of attributes.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pitchCardInfo } from '../src/api/playbyplay/pitchInfo.js'
import { atBatScenePitches } from '../src/lib/pitcherCard/atBat.js'
import { pitchBeats } from '../src/lib/pitcherCard/contactTimeline.js'
import { battedPath, foulPath } from '../src/lib/pitcherCard/batted.js'
import {
  batShape, drawContact, hideMarks, sceneLabel, setBarrelPath, setBat, setExit, setFlash, setGround, setMitt, setSmear, setTag, swingScene,
} from '../src/lib/pitcherCard/contactDraw.js'
import { proj } from '../src/lib/pitcherCard/scene.js'
import { swingModel } from '../src/lib/pitcherCard/swing.js'

const node = () => ({ a: {}, textContent: '', setAttribute(k, v) { this.a[k] = String(v) } })
const nodes = (n) => Array.from({ length: n }, node)
const K = [0.2, 2.2, 2.5]
const hit = { exitVelo: 104.8, launchAngle: 25, distance: 312, trajectory: 'line_drive', coordX: 140, coordY: 80 }
const SW = swingModel({ batSide: 'L', swing: 'inplay', K })
const path = battedPath(hit, K)

test('sceneLabel: pitch, then the ball, then the call; a whiff says swing and miss', () => {
  const inPlay = { name: '3 · Four-seam', mph: '96.1', hit, swing: 'inplay', call: 'In play, out(s)' }
  assert.equal(sceneLabel(inPlay), 'Four-seam, 96.1 mph. Line drive, 104.8 mph off the bat, 312 feet. In play, out(s).')
  assert.equal(sceneLabel({ name: '7 · Slider', mph: '87.4', hit: null, swing: 'whiff', call: 'Swinging Strike' }), 'Slider, 87.4 mph. Swing and miss.')
  assert.equal(sceneLabel({ name: '1 · Sinker', mph: '—', hit: null, swing: null, call: '' }), 'Sinker.')
})

test('swingScene: null for a take, a swing for a hit, a bunt flagged, a tag from the trajectory', () => {
  const p = { swing: 'inplay', contact: { K }, hit, batSide: 'L' }
  assert.equal(swingScene({ ...p, swing: null }, { totalMs: 1 }), null)
  const s = swingScene(p, { contactMs: 900 })
  assert.equal(s.bunt, false)
  assert.equal(s.tag, 'LINE DRIVE')
  assert.ok(s.path.exitSec > 0)
  assert.equal(swingScene({ ...p, hit: { ...hit, exitVelo: 30 } }, { contactMs: 900 }).bunt, true)
  assert.equal(swingScene({ ...p, hit: { ...hit, coordX: null } }, { contactMs: 900 }).tag, 'LINE DRIVE · DIRECTION DRAWN')
  assert.equal(swingScene({ ...p, hit: null }, { contactMs: 900 }).tag, undefined)
})

test('batShape: eight polygon points, a cap at the barrel end', () => {
  const { points, cap } = batShape(SW.at(0))
  assert.equal(points.split(' ').length, 8)
  const end = proj(...SW.at(0).end)
  assert.ok(Math.abs(cap[0] - end[0]) < 1e-9 && Math.abs(cap[1] - end[1]) < 1e-9)
  assert.ok(cap[2] >= 0.8)
})

test('setBat: sets the shape and opacity, shows both nodes', () => {
  const [poly, cap] = nodes(2)
  setBat(poly, cap, SW.at(0), 0.95)
  assert.equal(poly.a.opacity, '0.95')
  assert.equal(cap.a.visibility, 'visible')
  assert.ok(poly.a.points)
})

test('setSmear: four bats mid-swing, none during the freeze or after the swing', () => {
  const polys = nodes(4)
  setSmear(polys, SW, -0.05, false)
  assert.deepEqual(polys.map((n) => n.a.opacity), ['0.30', '0.20', '0.12', '0.06'])
  setSmear(polys, SW, -0.05, true)
  assert.ok(polys.every((n) => n.a.visibility === 'hidden'))
  setSmear(polys, SW, 0.2, false)
  assert.ok(polys.every((n) => n.a.visibility === 'hidden'))
})

test('setBarrelPath: 29 points from -92 degrees; nothing before the swing', () => {
  const n = node()
  setBarrelPath(n, SW, SW.at(0.12).th, 0.75)
  assert.equal(n.a.points.split(' ').length, 29)
  assert.equal(n.a.opacity, '0.75')
  setBarrelPath(n, SW, null, 0.9)
  assert.equal(n.a.visibility, 'hidden')
})

test('setExit: a measured ball is 24 ink pieces; a foul is one dashed line; no path hides both', () => {
  const [segs, line] = [nodes(24), node()]
  setExit(segs, line, path, 0.1, false, false)
  assert.ok(segs.every((s) => s.a.visibility === 'visible'))
  assert.equal(line.a.visibility, 'hidden')
  assert.ok(Number(segs[23].a.opacity) > Number(segs[0].a.opacity), 'the newest piece is the darkest')
  setExit(segs, line, foulPath(K, 'L'), 0.1, true, false)
  assert.equal(line.a.visibility, 'visible')
  assert.ok(segs.every((s) => s.a.visibility === 'hidden'))
  setExit(segs, line, null, 0.1, false, false)
  assert.equal(line.a.visibility, 'hidden')
})

test('setGround: shadow and track while the ball flies, a drop line only above 1 ft', () => {
  const g = { track: node(), shadow: node(), drop: node() }
  setGround(g, path, 0.1, path.pos(0.1))
  assert.equal(g.shadow.a.visibility, 'visible')
  assert.equal(g.drop.a.visibility, path.pos(0.1)[2] > 1 ? 'visible' : 'hidden')
  setGround(g, path, 0.1, [0, 5, 0.5])
  assert.equal(g.drop.a.visibility, 'hidden')
  setGround(g, null, 0, null)
  assert.equal(g.track.a.visibility, 'hidden')
})

test('setFlash: ink ring with ticks; pencil and no ticks on a foul; faint with no ticks at rest', () => {
  const [ring, ticks, Kp] = [node(), nodes(8), proj(...K)]
  setFlash(ring, ticks, Kp, { q: 0.5, strength: 0.8, foul: false, rest: false })
  assert.equal(ring.a.class, 'pscene__flash')
  assert.equal(ring.a['stroke-width'], '1.80')
  assert.ok(ticks.every((t) => t.a.visibility === 'visible'))
  setFlash(ring, ticks, Kp, { q: 0.5, strength: 0.35, foul: true, rest: false })
  assert.match(ring.a.class, /pencil/)
  assert.ok(ticks.every((t) => t.a.visibility === 'hidden'))
  setFlash(ring, ticks, Kp, { q: 1, strength: 0.8, foul: false, rest: true })
  assert.equal(ring.a.opacity, '0.25')
  assert.ok(ticks.every((t) => t.a.visibility === 'hidden'))
})

test('setMitt: the ring grows from 0.7 to 1.6 ball diameters', () => {
  const n = node()
  setMitt(n, [100, 200, 10], 0, false)
  assert.equal(n.a.r, '7.0')
  setMitt(n, [100, 200, 10], 1, false)
  assert.equal(n.a.r, '16.0')
})

test('setTag: sized to the label, hidden with none; hideMarks leaves the tag children alone', () => {
  const [g, rect, text] = nodes(3)
  setTag(g, rect, text, 'FLY BALL', 0.5)
  assert.equal(text.textContent, 'FLY BALL')
  assert.equal(g.a.opacity, '0.50')
  assert.equal(Number(rect.a.width), 'FLY BALL'.length * 7 + 12)
  const mk = { tag: g, bat: node(), smear: nodes(2), parts: { rect, text } }
  hideMarks(mk)
  assert.equal(g.a.visibility, 'hidden')
  assert.equal(mk.smear[1].a.visibility, 'hidden')
  assert.equal(rect.a.visibility, undefined)
})

// Turang's at-bat (gamePk 849810, at-bat 2): pitch 6 a foul, pitch 7 a whiff, so no batted ball.
const game = JSON.parse(readFileSync(new URL('./fixtures/contact-replay/game-849810.trimmed.json', import.meta.url), 'utf8'))
const turang = atBatScenePitches(pitchCardInfo(game, game.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 1)).pitchDetails, 'hitter', 'L')
const marks = () => ({
  smear: nodes(4), arc: node(), segs: nodes(24), line: node(), track: node(), shadow: node(), drop: node(), bat: node(), cap: node(),
  ring: node(), ticks: nodes(8), mitt: node(), tag: node(), label: node(), parts: { rect: node(), text: node() },
})

test('drawContact: a whiff has no batted ball; the bat passes, the ball runs on to the mitt, a pencil ring marks it', () => {
  const p = turang.at(-1)
  const b = pitchBeats(p, 3)
  const mk = marks()
  const early = drawContact(mk, p, b, swingScene(p, b), b.contactMs - 300, 3, false)
  assert.ok(early.progress < 1 && early.ball)
  assert.equal(mk.mitt.a.visibility, 'hidden')
  drawContact(mk, p, b, swingScene(p, b), b.totalMs, 3, true)
  assert.equal(mk.mitt.a.visibility, 'visible')
  assert.equal(mk.ring.a.visibility, 'hidden', 'a whiff has no contact ring')
  assert.equal(mk.line.a.visibility, 'hidden')
})

test('drawContact: a foul rests with a pencil ring and a dashed line, the ball gone', () => {
  const p = turang.at(-2)
  const b = pitchBeats(p, 3)
  const mk = marks()
  const rest = drawContact(mk, p, b, swingScene(p, b), b.totalMs, 3, true)
  assert.equal(rest.ball, null)
  assert.match(mk.ring.a.class, /pencil/)
  assert.equal(mk.line.a.visibility, 'visible')
  assert.equal(mk.smear[0].a.opacity, '0.22', 'the rest frame is a multiple exposure')
  assert.equal(mk.bat.a.opacity, '0.95')
})

test('drawContact: a bunt holds one pencil bat still at the contact pose, with no smear and no barrel path', () => {
  const p = { ...turang.at(-2), swing: 'inplay', hit: { exitVelo: 30, launchAngle: -20, distance: 20, trajectory: 'ground_ball', coordX: null, coordY: null } }
  const b = pitchBeats(p, 3)
  const m = swingScene(p, b)
  const [mk, held] = [marks(), marks()]
  drawContact(mk, p, b, m, b.contactMs - 300, 3, false)
  drawContact(held, p, b, m, b.contactMs + 200, 3, false)
  for (const k of [mk, held]) {
    assert.equal(k.bat.a.visibility, 'visible')
    assert.equal(k.bat.a.opacity, '0.95')
    assert.equal(k.arc.a.visibility, 'hidden')
    assert.ok(k.smear.every((n) => n.a.visibility === 'hidden'))
  }
  assert.equal(mk.bat.a.points, held.bat.a.points, 'the bat does not move')
  assert.equal(mk.bat.a.points, batShape(m.SW.at(0)).points)
  // the round cap sits at the barrel end of the held bat, and the rest frame leaks no smear or barrel path
  assert.equal(mk.cap.a.visibility, 'visible')
  assert.equal(mk.cap.a.cx, held.cap.a.cx)
  const rest = marks()
  drawContact(rest, p, b, m, b.totalMs, 3, true)
  assert.equal(rest.bat.a.points, mk.bat.a.points)
  assert.equal(rest.arc.a.visibility, 'hidden')
  assert.ok(rest.smear.every((n) => n.a.visibility === 'hidden'))
})

test('drawContact: a measured attack angle draws the bat at contact in ink with its label; before contact it is pencil', () => {
  const p = turang.at(-2)
  const b = pitchBeats(p, 3)
  const m = swingScene(p, b, { attackDeg: 9.4 })
  const [pre, rest, plain] = [marks(), marks(), marks()]
  drawContact(pre, p, b, m, b.contactMs - 300, 3, false)
  assert.doesNotMatch(pre.bat.a.class, /ink/)
  assert.equal(pre.label.a.visibility, 'hidden')
  drawContact(rest, p, b, m, b.totalMs, 3, true)
  assert.match(rest.bat.a.class, /ink/)
  assert.equal(rest.label.textContent, 'attack +9° · measured')
  assert.equal(rest.label.a.visibility, 'visible')
  drawContact(plain, p, b, swingScene(p, b), b.totalMs, 3, true)
  assert.doesNotMatch(plain.bat.a.class, /ink/)
  assert.equal(plain.label.a.visibility, 'hidden')
})

test('drawContact: a bunt stays pencil and says no attack angle, even with a measured one', () => {
  const p = { ...turang.at(-2), swing: 'inplay', hit: { exitVelo: 30, launchAngle: -20, distance: 20, trajectory: 'ground_ball', coordX: null, coordY: null } }
  const b = pitchBeats(p, 3)
  const m = swingScene(p, b, { attackDeg: 9.4 })
  const rest = marks()
  drawContact(rest, p, b, m, b.totalMs, 3, true)
  assert.doesNotMatch(rest.bat.a.class, /ink/)
  assert.equal(rest.label.a.visibility, 'hidden')
})
