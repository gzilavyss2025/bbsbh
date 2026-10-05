// How a headshot <img> loads and retries (issue #1446). Pure, so the policy is
// unit-testable without a DOM (test/headshot.test.js).
//
// Every headshot request is a CORS request (`crossOrigin`). A plain <img> is
// "no-cors", and the service worker sees an OPAQUE response: Workbox's
// CacheFirst stores only status 200, so it dropped every headshot and the
// `bbsbh-headshots` cache stayed empty. Every host here sends
// `access-control-allow-origin: *` (checked live, 404s included), so anonymous
// CORS is safe and lets that cache fill.
export const HEADSHOT_CROSS_ORIGIN = 'anonymous'

// Pause before retrying a failed load. An instant retry fails the same way on
// a dropped connection, and a phone at a ballpark drops often.
const RETRY_PAUSE_MS = 2000

// A step is one try. Each photo source gets two: step 2n is source n as is,
// step 2n+1 is source n again with a marker, which is a new cache key and so
// cannot be answered by a bad cached copy of the first try.
//
// `quickFirst` gives the FIRST source one try only. It is for a player with a
// fallback photo behind a silo that a prospect usually lacks (a clean 404): the
// silo's pause-and-retry cost about 2 s before the milb face showed. A dropped
// connection on that one try still lands on the next source, which keeps its
// own retry. The steps after the first shift down by one.
const logicalStep = (step, quickFirst) => (quickFirst && step > 0 ? step + 1 : step)

export function headshotStepUrl(sources, step, quickFirst = false) {
  const n = logicalStep(step, quickFirst)
  const url = sources?.[Math.floor(n / 2)]
  if (!url) return null
  if (n % 2 === 0) return url
  return `${url}${url.includes('?') ? '&' : '?'}retry=1`
}

// How long to wait before moving PAST a failed step: a first try is retried
// after a pause; a failed retry moves straight on to the next source. A
// `quickFirst` first try has no retry to wait for.
export function headshotStepDelay(step, quickFirst = false) {
  if (quickFirst && step === 0) return 0
  return logicalStep(step, quickFirst) % 2 === 0 ? RETRY_PAUSE_MS : 0
}
