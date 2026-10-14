// The Animation Lab's room for the player motion work (#2073, slice 01d).
// AnimationLab.jsx is at the 600-line cap, so the player entries live in
// animlab/PlayerMotionLab.jsx, and Frame moved to animlab/Entry.jsx so both
// files share it. Asserted from the source text: node runs no JSX.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ruleBody, stripComments } from './helpers/css.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8')
const lab = src('screens/AnimationLab.jsx')

test('Frame lives in Entry.jsx, and AnimationLab imports it', () => {
  assert.match(src('screens/animlab/Entry.jsx'), /export function Frame\(/)
  assert.doesNotMatch(lab, /function Frame\(/)
  assert.match(lab, /import \{ Entry, Frame \} from '\.\/animlab\/Entry\.jsx'/)
})

test('AnimationLab renders the player motion entries from their own file', () => {
  assert.match(lab, /import \{ PlayerMotionLab \} from '\.\/animlab\/PlayerMotionLab\.jsx'/)
  assert.match(lab, /<PlayerMotionLab \/>/)
  assert.ok(lab.split('\n').length < 600, 'AnimationLab.jsx stays under the 600-line cap')
})

test('the stamp-in entry reads 380ms, the token since slice 01a', () => {
  assert.match(lab, /in\s+380ms\. Off under reduced motion\./)
  assert.match(lab, /The stamp-in, 0 → 380ms/)
  assert.match(lab, /\[0, 60, 120, 240, 380\]/)
  // Other entries (the settle, the count fade) keep their own 360ms. Only the
  // stamp-in's three mentions move.
  assert.doesNotMatch(lab, /The stamp-in, 0 → 360ms|\[0, 60, 120, 240, 360\]/)
})

test('the rise demo wears the real class and steps its rows', () => {
  const demo = src('screens/animlab/PlayerMotionLab.jsx')
  assert.match(demo, /className="player-rise"/)
  assert.match(demo, /'--rise-i': i/)
})

test('a frozen rise adds the frame offset to its own stagger', () => {
  const css = stripComments(src('styles/46-consent-modal.css'))
  const body = ruleBody(css, '.animlab__frame .player-rise')
  assert.ok(body, 'the rise is in the freeze list')
  assert.match(body, /animation-play-state:\s*paused;/)
  assert.match(
    body.replace(/\s+/g, ' '),
    /animation-delay: calc\(var\(--stagger-step\) \* var\(--rise-i, 0\) \+ var\(--animlab-delay, 0s\)\);/,
  )
})
