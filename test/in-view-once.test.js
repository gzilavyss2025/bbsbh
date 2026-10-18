// The player page's one-shot entrance gate (#2073, slice 01c). The pure half is
// lib/motion/inViewOnce.js; the hook is read through one server render, the way
// test/callout-ledger.test.js reads a hook. No DOM, no observer runs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { firstPhase, hasSeen, markSeen, riseClass, viewKey } from '../src/lib/motion/inViewOnce.js'
import { IN_VIEW_THRESHOLD, useInViewOnce } from '../src/hooks/scroll/useInViewOnce.js'

// The Set lives for the module's life, as it does in the app. Each test uses
// its own keys, so no test depends on another.
const OBSERVE = { canObserve: true, reduced: false }

test('viewKey is <playerId>:<slotKey>', () => {
  assert.equal(viewKey(668930, 'splits'), '668930:splits')
})

test('a block not seen yet waits for the view', () => {
  assert.equal(firstPhase(viewKey(1, 'a'), OBSERVE), 'wait')
})

test('a seen block rests: Back in the same tab does not replay it', () => {
  const key = viewKey(2, 'a')
  assert.equal(markSeen(key), true)
  assert.equal(hasSeen(key), true)
  assert.equal(firstPhase(key, OBSERVE), 'rest')
})

test('markSeen is true only the first time', () => {
  const key = viewKey(3, 'a')
  assert.equal(markSeen(key), true)
  assert.equal(markSeen(key), false)
})

test('the key is per player and per slot', () => {
  markSeen(viewKey(4, 'a'))
  assert.equal(firstPhase(viewKey(4, 'b'), OBSERVE), 'wait')
  assert.equal(firstPhase(viewKey(5, 'a'), OBSERVE), 'wait')
})

test('reduced motion, or no IntersectionObserver, rests at once', () => {
  assert.equal(firstPhase(viewKey(6, 'a'), { canObserve: true, reduced: true }), 'rest')
  assert.equal(firstPhase(viewKey(6, 'b'), { canObserve: false, reduced: false }), 'rest')
})

test('riseClass maps each phase to the shared rise', () => {
  assert.equal(riseClass('wait'), 'player-rise--wait')
  assert.equal(riseClass('play'), 'player-rise')
  assert.equal(riseClass('rest'), '')
})

test('the observer: a tenth in view by default, no rootMargin', () => {
  assert.equal(IN_VIEW_THRESHOLD, 0.1)
  const src = readFileSync(fileURLToPath(new URL('../src/hooks/scroll/useInViewOnce.js', import.meta.url)), 'utf8')
    .replace(/\/\/.*$/gm, '') // code only: the comments name the option to rule it out
  // The default is the tenth; a caller may ask for more (#2295), and the observer reads that option.
  assert.match(src, /\{\s*threshold\s*=\s*IN_VIEW_THRESHOLD\s*\}\s*=\s*\{\}/)
  assert.match(src, /\{\s*threshold\s*\},?\s*\)/)
  assert.doesNotMatch(src, /rootMargin\s*:/, 'no rootMargin option')
})

function phaseOf(key) {
  function Probe() {
    const [, phase] = useInViewOnce(key)
    return createElement('i', { 'data-phase': phase })
  }
  return renderToStaticMarkup(createElement(Probe)).match(/data-phase="(\w+)"/)[1]
}

test('the hook: with no IntersectionObserver (node), the block rests', () => {
  assert.equal(typeof globalThis.IntersectionObserver, 'undefined')
  assert.equal(phaseOf(viewKey(7, 'a')), 'rest')
})

test('the hook: with an observer, a new block waits and a seen one rests', () => {
  globalThis.IntersectionObserver = class {}
  try {
    assert.equal(phaseOf(viewKey(8, 'a')), 'wait')
    markSeen(viewKey(8, 'b'))
    assert.equal(phaseOf(viewKey(8, 'b')), 'rest')
  } finally {
    delete globalThis.IntersectionObserver
  }
})
