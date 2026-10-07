// Headshot loading policy (issue #1446): retry a failed load once before
// falling down the chain, load headshots as CORS images so the service worker
// can cache them, and keep a small log of failures so a "?" can be traced.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HEADSHOT_CROSS_ORIGIN,
  headshotStepUrl,
  headshotStepDelay,
} from '../src/lib/headshot/retry.js'
import { recordHeadshotEvent, HEADSHOT_LOG_CAP } from '../src/lib/headshot/log.js'
import {
  prefetchHeadshots,
  headshotsToWarm,
  MAX_PREFETCH_FAILURES,
} from '../src/lib/prefetchHeadshots.js'

const SILO = 'https://img.mlbstatic.com/x/silo/current'
const MILB = 'https://img.mlbstatic.com/x/milb/current'

// --------------------------------------------------------------------------
// Each source gets two tries (a step pair) before the chain moves on. The
// second try carries a marker so it is a different cache key from the first.
// --------------------------------------------------------------------------
test('headshotStepUrl: step 0 is the plain first source', () => {
  assert.equal(headshotStepUrl([SILO, MILB], 0), SILO)
})

test('headshotStepUrl: step 1 retries the same source with a retry marker', () => {
  assert.equal(headshotStepUrl([SILO, MILB], 1), `${SILO}?retry=1`)
})

test('headshotStepUrl: step 2 moves to the next source, plain', () => {
  assert.equal(headshotStepUrl([SILO, MILB], 2), MILB)
  assert.equal(headshotStepUrl([SILO, MILB], 3), `${MILB}?retry=1`)
})

test('headshotStepUrl: past the last source, or with no sources, there is no photo', () => {
  assert.equal(headshotStepUrl([SILO, MILB], 4), null)
  assert.equal(headshotStepUrl([SILO], 2), null)
  assert.equal(headshotStepUrl([], 0), null)
  assert.equal(headshotStepUrl(null, 0), null)
})

test('headshotStepDelay: waits before a retry, never before the next source', () => {
  // A failure on step 0 is followed by the retry, after a pause: an instant
  // retry fails the same way on a dropped connection.
  assert.ok(headshotStepDelay(0) >= 1000)
  // A failure on the retry step moves straight on.
  assert.equal(headshotStepDelay(1), 0)
  assert.ok(headshotStepDelay(2) >= 1000)
  assert.equal(headshotStepDelay(3), 0)
})

test('quickFirst: the first source gets one try, then milb gets its usual two', () => {
  // A prospect's silo is usually a clean 404, so retrying it only delays the
  // milb face. Steps: silo, milb, milb retry, then no photo.
  assert.equal(headshotStepUrl([SILO, MILB], 0, true), SILO)
  assert.equal(headshotStepUrl([SILO, MILB], 1, true), MILB)
  assert.equal(headshotStepUrl([SILO, MILB], 2, true), `${MILB}?retry=1`)
  assert.equal(headshotStepUrl([SILO, MILB], 3, true), null)
})

test('quickFirst: no pause after the silo miss, the pause stays before the milb retry', () => {
  assert.equal(headshotStepDelay(0, true), 0)
  assert.ok(headshotStepDelay(1, true) >= 1000)
  assert.equal(headshotStepDelay(2, true), 0)
})

test('headshots load as CORS images, so the service worker can cache them', () => {
  // A no-cors <img> yields an opaque response, which Workbox's CacheFirst
  // refuses to store (only status 200 is cached). Every headshot host sends
  // access-control-allow-origin: *, so anonymous CORS is safe.
  assert.equal(HEADSHOT_CROSS_ORIGIN, 'anonymous')
})

test('prefetchHeadshots: every warm-up image is a CORS image', () => {
  const made = []
  const RealImage = globalThis.Image
  globalThis.Image = class {
    constructor() {
      made.push(this)
    }
  }
  try {
    prefetchHeadshots([543807, 592450])
  } finally {
    globalThis.Image = RealImage
  }
  assert.equal(made.length, 2)
  for (const img of made) assert.equal(img.crossOrigin, HEADSHOT_CROSS_ORIGIN)
})

test('prefetchHeadshots: reports each id whose warm-up image fails to load', () => {
  const made = []
  const RealImage = globalThis.Image
  globalThis.Image = class {
    constructor() {
      made.push(this)
    }
  }
  const failed = []
  try {
    prefetchHeadshots([543807, 592450], 320, (id) => failed.push(id))
  } finally {
    globalThis.Image = RealImage
  }
  made[1].onerror()
  assert.deepEqual(failed, [592450])
})

// A failed warm-up must not stay marked as warmed (issue #1446): the next feed
// update tries that id again, but only a few times, so a face with no photo on
// file (a clean 404) does not refetch for the whole game.
test('headshotsToWarm: skips warmed ids and ids that failed too often', () => {
  const warmed = new Set([1])
  const failures = new Map([[2, MAX_PREFETCH_FAILURES], [3, 1]])
  assert.deepEqual(headshotsToWarm([1, 2, 3, 4], warmed, failures), [3, 4])
})

// --------------------------------------------------------------------------
// The failure log: newest last, capped, and it never throws.
// --------------------------------------------------------------------------
test('recordHeadshotEvent: appends an event with a timestamp', () => {
  const out = recordHeadshotEvent([], { kind: 'load-error', personId: 1, url: SILO }, 1000)
  assert.deepEqual(out, [{ at: 1000, kind: 'load-error', personId: 1, url: SILO }])
})

test('recordHeadshotEvent: keeps only the newest HEADSHOT_LOG_CAP events', () => {
  let log = []
  for (let i = 0; i < HEADSHOT_LOG_CAP + 5; i++) {
    log = recordHeadshotEvent(log, { kind: 'load-error', personId: i }, i)
  }
  assert.equal(log.length, HEADSHOT_LOG_CAP)
  assert.equal(log.at(-1).personId, HEADSHOT_LOG_CAP + 4)
  assert.equal(log[0].personId, 5)
})

test('recordHeadshotEvent: tolerates a missing or broken previous log', () => {
  assert.equal(recordHeadshotEvent(null, { kind: 'x' }, 1).length, 1)
  assert.equal(recordHeadshotEvent('nonsense', { kind: 'x' }, 1).length, 1)
})
