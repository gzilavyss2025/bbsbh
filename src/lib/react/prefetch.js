// Warm a route chunk on a touch. Repeat calls are cheap (the browser's module map dedupes)
// and a failed load retries on the next touch. Vite fires `vite:preloadError` with the very
// error this catch receives, a tick BEFORE the catch runs; main.jsx defers its repair one
// tick and skips errors marked here, so a flaky-network prefetch never reloads the app.
const failed = new WeakSet()

export const isPrefetchFailure = (err) => failed.has(err)

export function prefetch(loader) {
  loader().catch((err) => {
    if (err && typeof err === 'object') failed.add(err)
  })
}
