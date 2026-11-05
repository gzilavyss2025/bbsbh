// Field vitals: what the app reports about its own load speed. Like the crash signal, the
// payload is rebuilt from an allowlist, so no score, id, name or URL can leave the device.
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildVitalsPayload, createVitals } from '../src/lib/crash/vitals.js'

test('the builder keeps the allowed keys and drops everything else', () => {
  const out = buildVitalsPayload({
    route: 'home', build: 'abc1234', standalone: true, sw: true, nav: 'navigate', device: 'phone',
    fcp: 1043.7, lcp: 2044.2, inp: 88.4, ttfb: 12.9, cls: 0.0083,
    url: '/07052026/milari/box', message: 'Brewers 5, Cubs 3', gamePk: 823035,
  })
  assert.deepEqual(out, {
    route: 'home', build: 'abc1234', standalone: true, sw: true, nav: 'navigate', device: 'phone',
    fcp: 1044, lcp: 2044, inp: 88, ttfb: 13, cls: 0.008,
  })
})

test('the builder rejects a value outside its enum, range or shape', () => {
  const out = buildVitalsPayload({
    route: '/07052026/milari', build: 'not a sha!', standalone: 'yes', sw: 1, nav: 'Brewers 5', device: 'tablet',
    fcp: -5, lcp: Number.NaN, inp: '88', ttfb: 9e9, cls: 99,
  })
  assert.equal(out, null) // no valid metric is left, so there is nothing to log
  const part = buildVitalsPayload({ route: '/x', nav: 'x', device: 'x', fcp: 900, lcp: 'slow' })
  assert.deepEqual(part, {
    route: '', build: '', standalone: false, sw: false, nav: '', device: '',
    fcp: 900, lcp: null, inp: null, ttfb: null, cls: null,
  })
})

test('the builder needs at least one metric, and a non-object is null', () => {
  assert.equal(buildVitalsPayload(null), null)
  assert.equal(buildVitalsPayload('fcp'), null)
  assert.equal(buildVitalsPayload({ route: 'home' }), null)
})

test('the collector takes only first-contentful-paint from paint entries', () => {
  const v = createVitals()
  v.paint({ name: 'first-paint', startTime: 300 })
  assert.equal(v.snapshot().fcp, null)
  v.paint({ name: 'first-contentful-paint', startTime: 1040 })
  assert.equal(v.snapshot().fcp, 1040)
})

test('the collector keeps the last LCP candidate', () => {
  const v = createVitals()
  v.lcp({ startTime: 900 })
  v.lcp({ startTime: 2100 })
  assert.equal(v.snapshot().lcp, 2100)
})

test('CLS is the worst session window, and a shift after input does not count', () => {
  const v = createVitals()
  v.shift({ startTime: 100, value: 0.05, hadRecentInput: false })
  v.shift({ startTime: 600, value: 0.05, hadRecentInput: false }) // same window: 0.10
  v.shift({ startTime: 700, value: 0.4, hadRecentInput: true }) // tapped: ignored
  v.shift({ startTime: 9000, value: 0.03, hadRecentInput: false }) // a gap over 1 s opens a new window
  assert.equal(Math.round(v.snapshot().cls * 1000) / 1000, 0.1)
})

test('a window never grows past five seconds', () => {
  const v = createVitals()
  for (let t = 0; t <= 6000; t += 500) v.shift({ startTime: t, value: 0.01, hadRecentInput: false })
  // 0..4500 fits in the first window (10 shifts); 5000+ opens a second one (3 shifts)
  assert.equal(Math.round(v.snapshot().cls * 1000) / 1000, 0.1)
})

test('INP is the worst interaction, and a hover with no interaction id is ignored', () => {
  const v = createVitals()
  v.event({ interactionId: 0, duration: 900 })
  assert.equal(v.snapshot().inp, null)
  v.event({ interactionId: 7, duration: 64 })
  v.event({ interactionId: 8, duration: 152 })
  v.event({ interactionId: 9, duration: 80 })
  assert.equal(v.snapshot().inp, 152)
})
