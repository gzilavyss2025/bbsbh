// Crash visibility (#2514): a small signal when the app breaks on a real phone, so a stale
// chunk after a deploy or a thrown card is not invisible. On for everyone (Gary, 2026-10-31).
//
// NO GAME DATA LEAVES THE DEVICE. buildCrashPayload rebuilds the payload from scratch and never
// spreads its input (ADR-0028's allowlist idea): four keys, each checked against an enum or a
// strict shape. The route is a parseRoute NAME ('player', 'game'), never a URL; no id, name,
// message or stack is ever read. api/crash.js runs the same builder again on the server.

const CRASH_KINDS = ['render', 'chunk', 'fetch', 'unhandled']
const ROUTE_NAME = /^[a-z][a-z-]{0,31}$/
const BUILD = /^[0-9a-f]{7,40}$/

export function buildCrashPayload(input) {
  const kind = CRASH_KINDS.includes(input?.kind) ? input.kind : null
  if (!kind) return null
  const route = typeof input.route === 'string' && ROUTE_NAME.test(input.route) ? input.route : ''
  const status = Number.isInteger(input.status) && input.status >= 100 && input.status <= 599 ? input.status : null
  const build = typeof input.build === 'string' && BUILD.test(input.build) ? input.build : ''
  return { kind, route, status, build }
}

// (send, { limit }) -> report(input). At most `limit` events a session, and each distinct
// kind/route/status once, so a render loop or a dead network cannot flood the log.
export function createCrashReporter(send, { limit = 5 } = {}) {
  const seen = new Set()
  return (input) => {
    const payload = buildCrashPayload(input)
    if (!payload || seen.size >= limit) return
    const key = `${payload.kind}|${payload.route}|${payload.status}`
    if (seen.has(key)) return
    seen.add(key)
    try { send(payload) } catch { /* a report must never throw */ }
  }
}

// The browser's reporter: a beacon to api/crash.js. Inert outside a browser (node tests, SSR).
// `context()` supplies the route name and build at report time.
let browserReport = null
export function installCrashReporter(context) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.sendBeacon) return
  const send = createCrashReporter((payload) => {
    navigator.sendBeacon('/api/crash', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  })
  browserReport = (input) => send({ ...context(), ...input })
  window.addEventListener('error', (e) => {
    // A <script> or stylesheet that failed to load is a chunk miss. An <img> miss is ordinary
    // (headshots and logos fall back all the time) and is not reported.
    const tag = e?.target?.tagName
    if (tag === 'SCRIPT' || tag === 'LINK') browserReport({ kind: 'chunk' })
    else if (!tag) browserReport({ kind: 'unhandled' })
  }, true)
  window.addEventListener('unhandledrejection', () => browserReport({ kind: 'unhandled' }))
  window.addEventListener('vite:preloadError', () => browserReport({ kind: 'chunk' }))
}

// For boundaries and the fetch layer. A no-op until installCrashReporter has run.
export function reportCrash(input) {
  browserReport?.(input)
}
