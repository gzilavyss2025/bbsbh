// Field vitals: what the app reports about its own load speed. Like the crash signal, the
// payload is rebuilt from an allowlist, so no score, id, name or URL can leave the device.
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildVitalsPayload, createVitals, looksAutomated, withBotHint } from '../src/lib/crash/vitals.js'

test('the builder keeps the allowed keys and drops everything else', () => {
  const out = buildVitalsPayload({
    route: 'home', build: 'abc1234', standalone: true, sw: true, bot: true, nav: 'navigate', device: 'phone',
    fcp: 1043.7, lcp: 2044.2, inp: 88.4, ttfb: 12.9, cls: 0.0083,
    url: '/07052026/milari/box', message: 'Brewers 5, Cubs 3', gamePk: 823035, userAgent: 'Googlebot/2.1',
  })
  assert.deepEqual(out, {
    route: 'home', build: 'abc1234', standalone: true, sw: true, bot: true, nav: 'navigate', device: 'phone',
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
    route: '', build: '', standalone: false, sw: false, bot: false, nav: '', device: '',
    fcp: 900, lcp: null, inp: null, ttfb: null, cls: null,
  })
  assert.equal(buildVitalsPayload({ fcp: 900, bot: 'yes' }).bot, false) // only a real boolean counts
})

test('the automation hint is a boolean from the webdriver flag or a known crawler user agent', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  assert.equal(looksAutomated({ userAgent: IPHONE }), false)
  assert.equal(looksAutomated({ userAgent: DESKTOP, webdriver: false }), false)
  assert.equal(looksAutomated({ userAgent: DESKTOP, webdriver: true }), true)
  assert.equal(looksAutomated({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }), true)
  assert.equal(looksAutomated({ userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' }), true)
  assert.equal(looksAutomated({ userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36' }), true)
  assert.equal(looksAutomated({ userAgent: 'Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse' }), true)
  assert.equal(looksAutomated({}), false)
  assert.equal(looksAutomated(undefined), false)
})

test('a real phone whose model name contains "bot" is not flagged', () => {
  const CUBOT = 'Mozilla/5.0 (Linux; Android 13; CUBOT P80) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
  assert.equal(looksAutomated({ userAgent: CUBOT }), false)
})

test('the server adds the crawler hint from the User-Agent header, and never drops one the client set', () => {
  const base = buildVitalsPayload({ fcp: 900, bot: false })
  assert.equal(withBotHint(base, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').bot, true)
  assert.equal(withBotHint(base, 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Safari/537.36').bot, false)
  assert.equal(withBotHint({ ...base, bot: true }, 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0').bot, true) // client webdriver wins
  assert.equal(withBotHint(base, null).bot, false) // no header
  assert.equal(base.bot, false) // the input is not mutated
})

test('the payload never carries the user agent, in any field', () => {
  const UA = 'Mozilla/5.0 (Linux; Android 13; CUBOT P80) Chrome/130'
  const out = buildVitalsPayload({ fcp: 900, userAgent: UA, ua: UA, route: UA, build: UA, nav: UA, device: UA })
  assert.equal(JSON.stringify(out).includes('CUBOT'), false)
  assert.deepEqual(Object.keys(out).sort(), [
    'bot', 'build', 'cls', 'device', 'fcp', 'inp', 'lcp', 'nav', 'route', 'standalone', 'sw', 'ttfb',
  ])
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

test('a page that was hidden before its first paint reports no FCP or LCP', () => {
  const v = createVitals()
  v.hide(0) // opened in a background tab
  v.paint({ name: 'first-contentful-paint', startTime: 12300 })
  v.lcp({ startTime: 12400 })
  assert.equal(v.snapshot().fcp, null)
  assert.equal(v.snapshot().lcp, null)
})

test('paints before the first hide count, paints after it do not', () => {
  const v = createVitals()
  v.paint({ name: 'first-contentful-paint', startTime: 400 })
  v.lcp({ startTime: 900 })
  v.hide(1000)
  v.lcp({ startTime: 5000 }) // painted after the page was hidden
  v.hide(9000) // a later hide never moves the first one
  assert.equal(v.snapshot().fcp, 400)
  assert.equal(v.snapshot().lcp, 900)
})
