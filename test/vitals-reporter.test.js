// The browser wiring of the vitals beacon, run in node with stubbed globals: what it reads
// from the page, what it sends, and that it sends once.
import assert from 'node:assert/strict'
import test from 'node:test'

import { installVitalsReporter } from '../src/lib/crash/vitals.js'

const KEYS = ['window', 'document', 'navigator', 'PerformanceObserver']

function setup({ visibility = 'visible', matchMedia, webdriver = false, userAgent = 'Mozilla/5.0 Chrome/130', unsupported = [], navEntry = null } = {}) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  const observers = {}
  const sent = []
  const docListeners = {}
  const win = { innerWidth: 390, addEventListener: (t, f) => (win[`on${t}`] = f) }
  if (matchMedia !== null) win.matchMedia = matchMedia ?? (() => ({ matches: false }))
  const define = (k, value) => Object.defineProperty(globalThis, k, { value, configurable: true, writable: true })
  define('window', win)
  define('document', {
    visibilityState: visibility,
    addEventListener: (t, f) => (docListeners[t] = f),
  })
  define('navigator', { sendBeacon: (url, blob) => sent.push({ url, blob }), webdriver, userAgent })
  define('PerformanceObserver', class {
    constructor(cb) { this.cb = cb }
    observe({ type }) {
      if (unsupported.includes(type)) throw new TypeError(`unsupported entry type ${type}`)
      observers[type] = this.cb
    }
  })
  const realEntries = performance.getEntriesByType
  performance.getEntriesByType = (type) => (type === 'navigation' && navEntry ? [navEntry] : [])
  const restore = () => KEYS.forEach((k) => (saved[k] ? Object.defineProperty(globalThis, k, saved[k]) : delete globalThis[k])) || (performance.getEntriesByType = realEntries)
  const feed = (type, entries) => observers[type]({ getEntries: () => entries })
  const hide = () => {
    document.visibilityState = 'hidden'
    docListeners.visibilitychange()
  }
  return { restore, feed, hide, sent, win }
}

const ctx = () => ({ route: 'home', build: 'abc1234', device: 'wide' })
const body = async (sent) => JSON.parse(await sent.blob.text()).vitals

test('it sends one beacon to /api/crash on the first hide, and never a second', async () => {
  const t = setup()
  try {
    installVitalsReporter(ctx)
    t.feed('paint', [{ name: 'first-contentful-paint', startTime: 1 }])
    t.hide()
    t.hide()
    t.win.onpagehide()
    assert.equal(t.sent.length, 1)
    assert.equal(t.sent[0].url, '/api/crash')
    const v = await body(t.sent[0])
    assert.equal(v.fcp, 1)
    assert.equal(v.route, 'home')
    assert.equal(v.device, 'wide') // the caller's class, not a width the module guesses
  } finally { t.restore() }
})

test('webdriver sets the bot flag, a normal browser does not', async () => {
  for (const [webdriver, want] of [[true, true], [false, false]]) {
    const t = setup({ webdriver })
    try {
      installVitalsReporter(ctx)
      t.feed('paint', [{ name: 'first-contentful-paint', startTime: 1 }])
      t.hide()
      assert.equal((await body(t.sent[0])).bot, want)
    } finally { t.restore() }
  }
})

test('a browser with no matchMedia still sends, with standalone false', async () => {
  const t = setup({ matchMedia: null })
  try {
    installVitalsReporter(ctx)
    t.feed('paint', [{ name: 'first-contentful-paint', startTime: 1 }])
    t.hide()
    assert.equal(t.sent.length, 1)
    assert.equal((await body(t.sent[0])).standalone, false)
  } finally { t.restore() }
})

test('a page opened in a hidden tab reports no paint timings', async () => {
  const t = setup({ visibility: 'hidden', navEntry: { type: 'back_forward', responseStart: 37 } })
  try {
    installVitalsReporter(ctx)
    t.feed('paint', [{ name: 'first-contentful-paint', startTime: 12300 }])
    t.feed('largest-contentful-paint', [{ startTime: 12400 }])
    t.win.onpagehide()
    const v = await body(t.sent[0])
    assert.equal(v.fcp, null)
    assert.equal(v.lcp, null)
    assert.equal(v.cls, null) // nothing painted, so there is no load to score
    assert.equal(v.ttfb, 37)
    assert.equal(v.nav, 'back_forward')
  } finally { t.restore() }
})

test('a report with no metric at all sends nothing', () => {
  const t = setup({ visibility: 'hidden' })
  try {
    installVitalsReporter(ctx)
    t.win.onpagehide() // hidden at load: no paints, and no navigation entry to give a TTFB
    assert.equal(t.sent.length, 0)
  } finally { t.restore() }
})

test('a browser that cannot observe layout shifts reports CLS as null, not a perfect 0', async () => {
  const t = setup({ unsupported: ['layout-shift', 'largest-contentful-paint', 'event'] }) // iOS Safari before 26
  try {
    installVitalsReporter(ctx)
    t.feed('paint', [{ name: 'first-contentful-paint', startTime: 154 }])
    t.hide()
    const v = await body(t.sent[0])
    assert.equal(v.cls, null)
    assert.equal(v.lcp, null)
    assert.equal(v.inp, null)
    assert.equal(v.fcp, 154)
  } finally { t.restore() }
})

test('a supported layout-shift observer with no shifts reports a real 0', async () => {
  const t = setup()
  try {
    installVitalsReporter(ctx)
    t.feed('paint', [{ name: 'first-contentful-paint', startTime: 154 }])
    t.hide()
    assert.equal((await body(t.sent[0])).cls, 0)
  } finally { t.restore() }
})
