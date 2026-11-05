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
const WIDE_PX = 740 // the app's one wide step (ADR-0108)

const ms = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 600000 ? Math.round(v) : null)
const shift = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10 ? Math.round(v * 1000) / 1000 : null)

export function buildVitalsPayload(input) {
  if (!input || typeof input !== 'object') return null
  const out = {
    route: typeof input.route === 'string' && ROUTE_NAME.test(input.route) ? input.route : '',
    build: typeof input.build === 'string' && BUILD.test(input.build) ? input.build : '',
    standalone: input.standalone === true,
    sw: input.sw === true,
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
  return {
    paint: (entry) => {
      if (entry.name === 'first-contentful-paint') fcp = entry.startTime
    },
    lcp: (entry) => {
      lcp = entry.startTime
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
// many foregroundings reports once. Inert outside a browser (node tests, SSR).
export function installVitalsReporter(context) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (typeof PerformanceObserver === 'undefined' || !navigator.sendBeacon) return
  const v = createVitals()
  const watch = (type, onEntry, extra) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true, ...extra })
    } catch { /* this browser does not know this entry type */ }
  }
  watch('paint', v.paint)
  watch('largest-contentful-paint', v.lcp)
  watch('layout-shift', v.shift)
  watch('event', v.event, { durationThreshold: 40 })

  let sent = false
  const send = () => {
    if (sent) return
    sent = true
    try {
      const nav = performance.getEntriesByType('navigation')[0]
      const standalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches) || navigator.standalone === true
      const payload = buildVitalsPayload({
        ...context(),
        ...v.snapshot(),
        standalone,
        sw: Boolean(navigator.serviceWorker?.controller),
        nav: nav?.type,
        device: window.innerWidth >= WIDE_PX ? 'wide' : 'phone',
        ttfb: nav?.responseStart,
      })
      if (payload) navigator.sendBeacon('/api/crash', new Blob([JSON.stringify({ vitals: payload })], { type: 'application/json' }))
    } catch { /* a report must never throw */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send()
  })
  window.addEventListener('pagehide', send)
}
