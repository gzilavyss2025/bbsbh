import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'
import {
  CANVAS_DOT_R, LEAD_MS, SETTLE_MS, UNIT, ZK, flightFrame, flightModel, flightOf, simFlight,
} from '../src/screens/player/next/modules/contact/contactFlight.js'

// The Contact ball flight (#2073, slice 18): the canvas drag-and-lift sketch and its frame.
const HOME = { x: 310, y: 505 }
const LAND = { x: 420, y: 140 }
const HR = { exitVelo: 105, launchAngle: 28, distance: 410, result: 'hr' }
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} is not near ${b}`)

test('simFlight: more lift carries the same swing further; it starts 3 ft up and lands', () => {
  assert.ok(simFlight(105, 28, 0.45).dist > simFlight(105, 28, 0).dist + 50)
  const f = simFlight(105, 28, 0.2)
  assert.equal(f.pts[0][1], 3)
  near(f.pts.at(-1)[1], 0, 2)
})

test('flightModel: a fly ball is fitted to its distance and sampled at 41 steps', () => {
  const f = flightModel(HR, 380)
  assert.equal(f.sf.length, 41)
  assert.equal(f.sz.length, 41)
  assert.equal(f.sf[0], 0)
  assert.equal(f.sf[40], 1)
  assert.equal(f.sz[40], 0)
  for (let i = 1; i <= 40; i++) assert.ok(f.sf[i] >= f.sf[i - 1], `sf rises at ${i}`)
  near(f.T, 4.854, 0.01)
  near(f.ms, f.T * 500, 0.01)
  near(Math.max(...f.sz), 81.6, 0.5)
})

test('flightModel: a ground ball (under 8°) hops low and takes the 700ms floor', () => {
  const f = flightModel({ exitVelo: 87, launchAngle: 5, distance: 74 }, 74)
  assert.equal(f.ms, 700)
  assert.ok(Math.max(...f.sz) <= 3)
  assert.equal(f.sz[40], 0)
})

test('flightModel: with no speed, angle or distance, the chord stands in', () => {
  near(flightModel({ exitVelo: null, launchAngle: null, distance: null }, 120).ms, 1217.5, 0.5)
})

test('flightModel: a flight lasts 2800ms at most', () => {
  assert.equal(flightModel({ exitVelo: 110, launchAngle: 30, distance: 480 }, 480).ms, 2800)
})

test('flightOf: one model per ball object', () => {
  const b = { ...HR }
  assert.equal(flightOf(b, 380), flightOf(b, 380))
})

test('scales: canvas units to diagram feet', () => {
  assert.equal(UNIT, 2.51)
  near(ZK, 0.24 * 2.51, 1e-9)
  assert.equal(CANVAS_DOT_R, 2.1)
})

const frame = (t, o = {}) => flightFrame(flightModel(HR, 380), t, { home: HOME, land: LAND, dotR: 11, hr: true, ...o })

test('frame at 0: the plate pulse starts at r3, no trace yet, the ball at the plate', () => {
  const f = frame(0)
  assert.equal(f.flying, true)
  assert.equal(f.pulse.r, 7.53)
  assert.equal(f.pulse.op, 0.8)
  assert.equal(f.trace.d, '')
  assert.equal(f.track.op, 0)
  assert.equal(f.ball.x, HOME.x)
  assert.equal(f.ring, null)
})

test('frame mid-flight: the ball is up, its shadow on the ground, a drop line between', () => {
  const m = flightModel(HR, 380)
  const f = frame(LEAD_MS + m.ms / 2)
  assert.equal(f.flying, true)
  assert.ok(f.fr > 0.4 && f.fr < 0.8)
  assert.ok(f.ball.y < f.shadow.y)
  assert.ok(f.drop)
  assert.ok(f.trace.d.startsWith('M310 503.2L'))
  assert.equal(f.track.op, 0.55)
  assert.equal(f.pulse.op, 0)
})

test('frame at landing: rings at r3, the selection ring at 1.6x and not yet shown', () => {
  const m = flightModel(HR, 380)
  const f = frame(LEAD_MS + m.ms)
  assert.equal(f.flying, false)
  assert.equal(f.fr, 1)
  assert.equal(f.ring.r, 13.26)
  assert.equal(f.ring.op, 0.9)
  assert.equal(f.ring2.op, 0.7)
  assert.equal(f.sel.r, 31.83)
  assert.equal(f.sel.op, 0)
  assert.equal(f.ball, null)
})

test('the second ring is for a home run only', () => {
  const m = flightModel(HR, 380)
  assert.equal(frame(LEAD_MS + m.ms, { hr: false }).ring2.op, 0)
})

test('settled (t = Infinity, the reduced-motion frame): no rings, no trace, selection ring at 1x', () => {
  const f = frame(Infinity)
  assert.equal(f.ring.op, 0)
  assert.equal(f.ring2.op, 0)
  assert.equal(f.trace.op, 0)
  assert.equal(f.track.op, 0.4)
  assert.equal(f.sel.r, 22.04)
  assert.equal(f.sel.op, 1)
  assert.equal(f.pulse.op, 0)
})

test('every landed beat ends inside SETTLE_MS, so the clock may stop there', () => {
  const m = flightModel(HR, 380)
  const f = frame(LEAD_MS + m.ms + SETTLE_MS)
  assert.equal(f.ring.op, 0)
  assert.equal(f.ring2.op, 0)
  assert.equal(f.trace.op, 0)
})

// ---- the sheet and the wiring ----
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CSS = stripComments(read('src/styles/player-next/batter/contact.css'))
const JSX = read('src/screens/player/next/modules/contact/ContactModule.jsx')
const FLIGHT = read('src/screens/player/next/modules/contact/ContactFlight.jsx')
const DETAIL = read('src/screens/player/next/modules/contact/ContactDetail.jsx')
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('the last stats rise in after the landing, 60ms apart, and wait unseen in flight', () => {
  const b = ruleBody(CSS, '.fcontact__rise')
  assert.equal(decl(b, 'animation'), 'fcontact-rise var(--dur-stamp-in) var(--ease-stamp) backwards')
  assert.equal(decl(b, 'animation-delay'), 'calc(var(--fcontact-i, 0) * var(--dur-fast) / 2)')
  const fly = ruleBody(CSS, '.fcontact__detail--fly .fcontact__rise')
  assert.equal(decl(fly, 'animation'), 'none')
  assert.equal(decl(fly, 'opacity'), '0')
  assert.match(CSS, /prefers-reduced-motion: reduce\)\s*\{\s*\.fcontact__rise\s*\{\s*animation: none;?\s*\}/)
})

test('the flying dot hides; the overlay takes no taps', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__dot--hide'), 'opacity'), '0')
  assert.equal(decl(ruleBody(CSS, '.fcontact__fx'), 'pointer-events'), 'none')
})

test('the module flies the tapped ball and speaks once, on landing', () => {
  assert.match(FLIGHT, /useFlightClock\(shot, model\)/)
  assert.match(FLIGHT, /<FlightMarks frame=\{frame\} home=\{HOME\} \/>/)
  assert.match(FLIGHT, /fcontact__dot--hide/)
  assert.match(DETAIL, /<span className="sr-only" aria-live="polite">/)
  assert.doesNotMatch(DETAIL, /className="fcontact__detail" aria-live/)
})

test('the flight clock lives in a child: ContactModule holds no per-frame state (#2073)', () => {
  assert.doesNotMatch(JSX, /useFlightClock|flightFrame|<FlightMarks/)
  assert.match(JSX, /<FlightClock\b/)
  assert.match(JSX, /<FlightLayer \/>/)
  assert.match(JSX, /<AutoAdvance\b/)
  assert.match(JSX, /<ContactDetail\b/)
  assert.match(FLIGHT, /export function FlightClock\(/)
  assert.match(FLIGHT, /useFlight\(\)/)
  // The root div stays the one element both branches return (the in-view ref survives).
  assert.match(JSX, /<div ref=\{fieldRef\} className="fcontact">\s*<FlightClock/)
})

test('isAirFlight is the one predicate for the flight model and its in-flight label', async () => {
  const { isAirFlight } = await import('../src/screens/player/next/modules/contact/contactFlight.js')
  assert.equal(isAirFlight({ launchAngle: 9, exitVelo: 90, distance: 150 }), true, '8 degrees and up is a fitted flight')
  assert.equal(isAirFlight({ launchAngle: 7, exitVelo: 90, distance: 150 }), false)
  assert.equal(isAirFlight({ launchAngle: null, exitVelo: 90, distance: 150 }), false, 'no angle hops')
  assert.equal(isAirFlight({ launchAngle: 25, exitVelo: null, distance: 150 }), false, 'no speed hops')
  assert.equal(isAirFlight({ launchAngle: 25, exitVelo: 90, distance: null }), false, 'no distance hops')
})

test('the Animation Lab shows the play-through on the real clock child', () => {
  const LAB = read('src/screens/animlab/PlayerMotionLab.jsx')
  assert.match(LAB, /title="Contact — play through the balls"/)
  assert.match(LAB, /<ContactPlayEntry \/>/)
  assert.match(LAB, /<FlightClock\b/)
})
