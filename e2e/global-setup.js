// Pay the dev server's first-request cost before any test's clock starts.
//
// `webServer.url` in playwright.config.js only waits for the port to ANSWER.
// A vite dev server answers long before it can serve the app: on the first
// real request for the entry it pre-bundles dependencies with esbuild (~10s on
// a worktree whose node_modules/.vite is empty) and transforms the entry's
// module graph. On a fresh worktree that work lands inside whichever test runs
// first, against its own 30s timeout, and is reported as a bare "Test timeout
// of 30000ms exceeded" naming the code under test — a reading that is wrong
// twice over, because nothing hung and the code is fine (issue #1095).
//
// Requesting the entry here moves that cost out of the tests. Vite's import
// analysis pre-transforms a module's STATIC imports as it transforms it, so
// one request for `/src/main.jsx` cascades through the whole eager graph.
//
// It deliberately stops there. Warming the LAZY routes as well — the 169
// modules under src/screens — measures SLOWER, not faster: those transforms
// compete for CPU with the three the first test actually asks for, and the
// first navigation to a route went from a 3.9s median to 5.9s across three
// cold starts each. The eager graph is the part every spec pays for; a route's
// own chunk is ~4s once, and `routeRendered` in fixtures.js is what keeps that
// from being reported dishonestly when it lands inside a wait.
export default async function globalSetup(config) {
  const base = config.projects[0]?.use?.baseURL
  if (!base) return

  const started = Date.now()
  for (const path of ['/', '/src/main.jsx']) {
    try {
      const res = await fetch(new URL(path, base), { headers: { Accept: '*/*' } })
      await res.text()
    } catch (err) {
      // A warm-up is an optimisation, never a gate. If the server is not
      // reachable the tests themselves will say so, with a better message
      // than this file could.
      console.warn(`[global-setup] could not warm ${path}: ${err.message}`)
      return
    }
  }
  console.log(`[global-setup] dev server warm in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}
