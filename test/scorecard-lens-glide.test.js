import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { EASE_OUT, durationMs, easeOut, glideAt } from '../src/lib/scorecard/glide.js'

// The lens glide (#724, L7): after a tap the pane scrolls to the next sealed
// box in a requestAnimationFrame tween on the --ease-out curve. These pin the
// pure part: the curve and the position at a given time.

test('easeOut: starts at 0 and ends at 1', () => {
  assert.equal(easeOut(0), 0)
  assert.equal(easeOut(1), 1)
})

test('easeOut: is front-loaded, so the box is still soon after the tap', () => {
  // cubic-bezier(0.16, 1, 0.3, 1): most of the distance in the first third.
  assert.ok(easeOut(0.2) > 0.6, `easeOut(0.2) = ${easeOut(0.2)}`)
  assert.ok(easeOut(0.5) > 0.9, `easeOut(0.5) = ${easeOut(0.5)}`)
})

test('easeOut: never goes back and never overshoots', () => {
  let was = 0
  for (let i = 1; i <= 100; i += 1) {
    const y = easeOut(i / 100)
    assert.ok(y >= was, `easeOut fell at ${i / 100}`)
    assert.ok(y <= 1)
    was = y
  }
})

test('easeOut: matches the --ease-out token, so the glide and the CSS motion agree', () => {
  const css = readFileSync(new URL('../src/tokens/effects.css', import.meta.url), 'utf8')
  const m = css.match(/--ease-out:\s*cubic-bezier\(([^)]*)\)/)
  assert.ok(m, '--ease-out is a cubic-bezier in effects.css')
  assert.deepEqual(m[1].split(',').map(Number), EASE_OUT)
})

test('glideAt: from the start, to the end, and the eased point between', () => {
  assert.equal(glideAt(100, 400, 0, 300), 100)
  assert.equal(glideAt(100, 400, 300, 300), 400)
  assert.equal(glideAt(100, 400, 999, 300), 400)
  assert.equal(glideAt(100, 400, 150, 300), 100 + 300 * easeOut(0.5))
})

test('glideAt: a frame stamped before the start holds the start', () => {
  // The first rAF frame can carry a time a little before the tween began.
  assert.equal(glideAt(100, 400, -8, 300), 100)
})

test('glideAt: runs backwards as well (a glide up the sheet)', () => {
  assert.equal(glideAt(400, 100, 300, 300), 100)
  assert.ok(glideAt(400, 100, 60, 300) < 400)
})

test('durationMs: reads a CSS time in ms or s, and falls back when it cannot', () => {
  assert.equal(durationMs('300ms', 1), 300)
  assert.equal(durationMs(' 300ms', 1), 300)
  // A token written in seconds, as --dur-highlight is: not 0.3 ms.
  assert.equal(durationMs('0.3s', 1), 300)
  assert.equal(durationMs('', 300), 300)
  assert.equal(durationMs('fast', 300), 300)
})

test('the --dur-glide token is 300ms', () => {
  const css = readFileSync(new URL('../src/tokens/effects.css', import.meta.url), 'utf8')
  assert.match(css, /--dur-glide:\s*300ms;/)
})
