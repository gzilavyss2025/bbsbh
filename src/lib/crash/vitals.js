// Field vitals: how fast the app really loads on a real phone. Speed Insights (free) shows no
// mobile detail and cannot tell an installed app from a tab, so this beacon logs one
// `bbsbh-vitals` line a page, in the same runtime logs as the crash signal (api/crash.js).
//
// NO GAME DATA LEAVES THE DEVICE. Same shape as the crash signal (lib/crash/report.js,
// ADR-0028's allowlist idea): buildVitalsPayload rebuilds the payload from scratch and never
// spreads its input. The route is a parseRoute NAME, never a URL; each number is a rounded
// timing in a bounded range; each flag is a boolean or an enum. No id, name or URL is read.
//
// INP and CLS here are close to the web-vitals definitions, not identical: CLS is the worst
// 5-second session window (the standard rule); INP is the WORST interaction rather than the
// 98th percentile, so it can only read high. Both are meant for comparing launches to each
// other, not for matching Lighthouse to the digit.

const NAV_TYPES = ['navigate', 'reload', 'back_forward', 'prerender']
const DEVICES = ['phone', 'wide']
const ROUTE_NAME = /^[a-z][a-z-]{0,31}$/
const BUILD = /^[0-9a-f]{7,40}$/
// Known crawlers and test runners, matched by name, not by substring: a bare /bot/ also
// matches a real phone ("CUBOT P80"). Real browsers never put "+http" in their agent; crawlers
// nearly always do ("; +http://www.google.com/bot.html").
const AUTOMATED_UA = new RegExp(
  [
    'googlebot|bingbot|applebot|duckduckbot|yandexbot|petalbot|semrushbot|ahrefsbot|mj12bot',
    'slackbot|twitterbot|linkedinbot|facebookexternalhit',
    '\\b(?:crawler|spider|baiduspider|slurp)\\b',
    'headlesschrome|lighthouse|pagespeed',
    '\\+https?:\\/\\/',
  ].join('|'),
  'i',
)

// A coarse hint, so the log can separate crawlers from real visits. The server computes it
// from the User-Agent header (api/crash.js), so a fix to the list reaches every client at once,
// installed apps on an old build included. The client contributes only `navigator.webdriver`.
// Only the yes/no is ever logged, never the string. A crawler that hides its agent reads as a visit.
export function looksAutomated({ userAgent, webdriver } = {}) {
  return webdriver === true || (typeof userAgent === 'string' && AUTOMATED_UA.test(userAgent))
}

// The server's step: keep a client-set flag, add the header's verdict. Returns a new object.
export function withBotHint(payload, userAgent) {
  return { ...payload, bot: payload.bot === true || looksAutomated({ userAgent }) }
}

const ms = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 600000 ? Math.round(v) : null)
const shift = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10 ? Math.round(v * 1000) / 1000 : null)

export function buildVitalsPayload(input) {
  if (!input || typeof input !== 'object') return null
  const out = {
    route: typeof input.route === 'string' && ROUTE_NAME.test(input.route) ? input.route : '',
    build: typeof input.build === 'string' && BUILD.test(input.build) ? input.build : '',
    standalone: input.standalone === true,
    sw: input.sw === true,
    bot: input.bot === true,
    nav: NAV_TYPES.includes(input.nav) ? input.nav : '',
    device: DEVICES.includes(input.device) ? input.device : '',
    fcp: ms(input.fcp),
    lcp: ms(input.lcp),
    inp: ms(input.inp),
    ttfb: ms(input.ttfb),
    cls: shift(input.cls),
  }
  const hasMetric = [out.fcp, out.lcp, out.inp, out.ttfb, out.cls].some((v) => v !== null)
  return hasMetric ? out : null
}

// Folds PerformanceObserver entries into one snapshot. Pure, so the node suite can feed it
// entry-shaped objects. Every method is a closure (no `this`), so each can be handed straight
// to an observer.
export function createVitals() {
  let fcp = null
  let lcp = null
  let inp = null
  let best = 0 // the worst CLS session window so far
  let cur = 0
  let first = 0 // startTime of the window's first shift
  let last = 0
  // Paints from a page that was hidden before it painted (a background tab, a restore) carry
  // the time it sat unseen, not a load time. The web-vitals rule: ignore a paint at or after
  // the first moment the page was hidden. The first hide wins; a later one never moves it.
  let hiddenAt = Infinity
  return {
    hide: (at) => {
      hiddenAt = Math.min(hiddenAt, at)
    },
    paint: (entry) => {
      if (entry.name === 'first-contentful-paint' && entry.startTime < hiddenAt) fcp = entry.startTime
    },
    lcp: (entry) => {
      if (entry.startTime < hiddenAt) lcp = entry.startTime
    },
    shift: (entry) => {
      if (entry.hadRecentInput) return
      const t = entry.startTime
      if (cur > 0 && t - last < 1000 && t - first < 5000) {
        cur += entry.value
      } else {
        cur = entry.value
        first = t
      }
      last = t
      if (cur > best) best = cur
    },
    event: (entry) => {
      // A hover or scroll has no interaction id; only taps, clicks and keys count.
      if (entry.interactionId > 0) inp = Math.max(inp ?? 0, entry.duration)
    },
    snapshot: () => ({ fcp, lcp, inp, cls: best }),
  }
}

// The browser's reporter: one beacon a page load, sent the first time the page is hidden
// (backgrounded, closed, or switched away from). An installed app that stays alive across
// many foregroundings reports once. `context()` supplies route, build and device (the caller
// owns the width rule, WIDE_QUERY). Inert outside a browser (node tests, SSR).
export function installVitalsReporter(context) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (typeof PerformanceObserver === 'undefined' || !navigator.sendBeacon) return
  const v = createVitals()
  if (document.visibilityState === 'hidden') v.hide(0) // opened in the background
  // Whether the browser knows this entry type. A metric it cannot observe must read null,
  // not 0: iOS Safari (before 26) has no layout-shift, and its first field reports said
  // "CLS 0" for pages nobody measured.
  const watch = (type, onEntry, extra) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true, ...extra })
      return true
    } catch { /* this browser does not know this entry type */ }
    return false
  }
  watch('paint', v.paint)
  const seesLcp = watch('largest-contentful-paint', v.lcp)
  const seesShifts = watch('layout-shift', v.shift)
  const seesInput = watch('event', v.event, { durationThreshold: 40 })

  let sent = false
  const send = () => {
    if (sent) return
    sent = true
    try {
      const nav = performance.getEntriesByType('navigation')[0]
      const standalone = Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches) || navigator.standalone === true
      const m = v.snapshot()
      const payload = buildVitalsPayload({
        ...context(),
        fcp: m.fcp,
        lcp: seesLcp ? m.lcp : null,
        inp: seesInput ? m.inp : null,
        // A page that never painted (opened in a hidden tab) has no load to score a shift against.
        cls: seesShifts && m.fcp !== null ? m.cls : null,
        standalone,
        sw: Boolean(navigator.serviceWorker?.controller),
        bot: navigator.webdriver === true,
        nav: nav?.type,
        ttfb: nav?.responseStart,
      })
      if (payload) navigator.sendBeacon('/api/crash', new Blob([JSON.stringify({ vitals: payload })], { type: 'application/json' }))
    } catch { /* a report must never throw */ }
  }
  const leave = () => {
    v.hide(performance.now())
    send()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave()
  })
  window.addEventListener('pagehide', leave)
}
