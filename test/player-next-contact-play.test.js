import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'
import {
  DWELL_MS, afterDwell, byDate, counter, isAhead, nearestBall, playStart, seasonAxis,
} from '../src/screens/player/next/modules/contact/contactPlay.js'
import { SETTLE_MS } from '../src/screens/player/next/modules/contact/contactFlight.js'

// Play through the Contact balls (#2073, slice 19).
const m = (date, id) => ({ b: { date, id }, p: { x: 0, y: 0 } })

test('DWELL_MS is the canvas 1150ms, inside the flight clock tail', () => {
  assert.equal(DWELL_MS, 1150)
  assert.ok(DWELL_MS < SETTLE_MS)
})

test('byDate: season order, ties keep their order, an undated ball goes last', () => {
  const out = byDate([m('2026-05-02', 'a'), m(null, 'x'), m('2026-04-01', 'b'), m('2026-05-02', 'c')])
  assert.deepEqual(out.map((x) => x.b.id), ['b', 'a', 'c', 'x'])
})

test('playStart: the next ball, or the first when none is picked or the last one is', () => {
  assert.equal(playStart(-1, 5), 0)
  assert.equal(playStart(1, 5), 2)
  assert.equal(playStart(4, 5), 0)
})

test('afterDwell: the next ball, then the run ends', () => {
  assert.equal(afterDwell(0, 3), 1)
  assert.equal(afterDwell(2, 3), null)
})

test('isAhead: only while playing, only the balls after the current one', () => {
  assert.equal(isAhead(3, 1, true), true)
  assert.equal(isAhead(1, 1, true), false)
  assert.equal(isAhead(3, 1, false), false)
})

test('seasonAxis: first to last ball date, the first of each month between', () => {
  const ax = seasonAxis(['2026-03-26', null, '2026-05-26', '2026-04-25'])
  assert.equal(ax.pos('2026-03-26'), 0)
  assert.equal(ax.pos('2026-05-26'), 100)
  assert.equal(Math.round(ax.pos('2026-04-25')), 49)
  assert.deepEqual(ax.months.map((x) => x.t), ['Apr', 'May'])
  assert.equal(Math.round(ax.months[0].l * 10) / 10, 9.8)
  assert.equal(ax.pos(null), 0)
})

test('seasonAxis: one day has no span; no dates, no axis', () => {
  const ax = seasonAxis(['2026-06-01', '2026-06-01'])
  assert.equal(ax.pos('2026-06-01'), 0)
  assert.deepEqual(ax.months, [])
  assert.equal(seasonAxis([null]), null)
})

test('seasonAxis: a span across a new year rolls the month', () => {
  assert.deepEqual(seasonAxis(['2026-11-20', '2027-02-10']).months.map((x) => x.t), ['Dec', 'Jan', 'Feb'])
})

test('nearestBall: the ball whose tick is nearest the scrubber', () => {
  assert.equal(nearestBall([0, 20, 50, 100], 33), 1)
  assert.equal(nearestBall([0, 20, 50, 100], 36), 2)
})

test('counter: "3 of 9", or the count when no ball is picked', () => {
  assert.equal(counter(2, 9), '3 of 9')
  assert.equal(counter(-1, 9), '9 balls')
  assert.equal(counter(-1, 1), '1 ball')
})

// ---- the sheet and the wiring ----
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CSS = stripComments(read('src/styles/player-next/batter/contact.css'))
const JSX = read('src/screens/player/next/modules/contact/ContactModule.jsx')
const FLIGHT = read('src/screens/player/next/modules/contact/ContactFlight.jsx')
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('the balls not played yet sit at .1', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__dot--ahead'), 'opacity'), '0.1')
})

test('the player buttons: a 3px shadow; a press moves 2px and drops it to 1px over 120ms', () => {
  const b = ruleBody(CSS, '.fcontact__ic')
  assert.equal(decl(b, 'box-shadow'), 'calc(var(--bw-heavy) * 1.5) calc(var(--bw-heavy) * 1.5) 0 var(--border-stamped)')
  assert.match(decl(b, 'transition'), /^transform var\(--dur-fast\) var\(--ease-stamp\),\s*box-shadow var\(--dur-fast\) var\(--ease-stamp\)$/)
  const a = ruleBody(CSS, '.fcontact__ic:active')
  assert.equal(decl(a, 'transform'), 'translate(var(--bw-heavy), var(--bw-heavy))')
  assert.equal(decl(a, 'box-shadow'), 'var(--bw-hair) var(--bw-hair) 0 var(--border-stamped)')
})

test('the timeline fill glides over 320ms; the wrapper wears the house focus ring', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__tl-fill'), 'transition'), 'width calc(var(--dur-unfold) * 0.8) var(--ease-stamp)')
  assert.equal(decl(ruleBody(CSS, '.fcontact__tl:focus-within'), 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
  assert.match(CSS, /prefers-reduced-motion: reduce\)\s*\{\s*\.fcontact__ic,\s*\.fcontact__tl-fill\s*\{\s*transition: none;?\s*\}/)
})

test('the module plays in date order and holds each ball DWELL_MS after it lands', () => {
  assert.match(JSX, /byDate\(/)
  assert.match(FLIGHT, /t >= end \+ DWELL_MS \? 'rest'/)
  assert.match(FLIGHT, /phase === 'rest' \? 0/)
  assert.match(JSX, /<ContactPlayer/)
  assert.match(JSX, /setPlaying\(false\) \}/)
})
