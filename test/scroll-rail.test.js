import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jumpScrollLeft } from '../src/hooks/scroll/useScrollRail.js'

// A fake track that records the `scroll-behavior` in force at the instant
// `scrollLeft` is assigned — the whole point of the helper.
function fakeTrack(scrollBehavior) {
  const seen = []
  const el = { style: { scrollBehavior } }
  Object.defineProperty(el, 'scrollLeft', {
    set(v) {
      seen.push([v, el.style.scrollBehavior])
    },
  })
  return { el, seen }
}

test('jumpScrollLeft assigns scrollLeft with smooth scrolling switched off', () => {
  const { el, seen } = fakeTrack('smooth')
  jumpScrollLeft(el, 240)
  assert.deepEqual(seen, [[240, 'auto']])
})

test('jumpScrollLeft puts the prior scroll-behavior back', () => {
  for (const prior of ['smooth', '']) {
    const { el } = fakeTrack(prior)
    jumpScrollLeft(el, 10)
    assert.equal(el.style.scrollBehavior, prior)
  }
})
