// Express Lane — the download-speed readout (src/lib/expresslane/speed.js).
//
// Pure maths and a storage wrapper, so every test runs with no browser. The
// figure it reports is the speed of clips ALREADY downloaded. It never says
// which clip, how big the next one is, or how long a wait will last.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SPEED_KEY,
  addSample,
  formatMbps,
  loadSamples,
  saveSamples,
  summarizeSpeed,
} from '../src/lib/expresslane/speed.js'

const MB = 1_000_000

// A storage that lives in a Map, and one that throws like a private window.
function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value))
    },
  }
}
const brokenStorage = {
  getItem() {
    throw new Error('blocked')
  },
  setItem() {
    throw new Error('blocked')
  },
}

test('one clip: bytes over time, in megabits a second', () => {
  // 9,180,423 bytes in 2,107 ms is the sample taken on 2026-10-06.
  const summary = summarizeSpeed(addSample([], { bytes: 9_180_423, ms: 2107 }))
  assert.equal(Math.round(summary.mbps * 10) / 10, 34.9)
  assert.equal(summary.clips, 1)
})

test('the figure is the whole sample, not an average of averages', () => {
  // A 1 MB clip in 1 s (8 Mbps) and a 9 MB clip in 9 s (8 Mbps) agree.
  // A 1 MB clip in 0.1 s (80 Mbps) beside a 9 MB clip in 9 s (8 Mbps) must NOT
  // read 44: the long download is most of the wait, so it is most of the answer.
  const samples = addSample(addSample([], { bytes: 1 * MB, ms: 100 }), {
    bytes: 9 * MB,
    ms: 9000,
  })
  const summary = summarizeSpeed(samples)
  assert.equal(Math.round(summary.mbps * 10) / 10, 8.8)
})

test('nothing downloaded yet reads as no figure, not zero', () => {
  assert.equal(summarizeSpeed([]), null)
  assert.equal(summarizeSpeed(null), null)
})

test('a sample that cannot be a real download is dropped', () => {
  let samples = []
  samples = addSample(samples, { bytes: 0, ms: 500 })
  samples = addSample(samples, { bytes: 5 * MB, ms: 0 })
  samples = addSample(samples, { bytes: 5 * MB, ms: -4 })
  samples = addSample(samples, { bytes: Number.NaN, ms: 500 })
  // A few hundred bytes is an error page, not a clip, and would read as slow.
  samples = addSample(samples, { bytes: 900, ms: 300 })
  assert.deepEqual(samples, [])
})

test('only the latest clips count, so the figure follows the connection', () => {
  let samples = []
  for (let i = 0; i < 20; i += 1) samples = addSample(samples, { bytes: 4 * MB, ms: 16000 }) // 2 Mbps
  for (let i = 0; i < 8; i += 1) samples = addSample(samples, { bytes: 4 * MB, ms: 1000 }) // 32 Mbps
  assert.ok(samples.length <= 8, 'the window is bounded')
  assert.equal(Math.round(summarizeSpeed(samples).mbps), 32)
})

test('addSample never edits the list it was given', () => {
  const before = Object.freeze([Object.freeze({ bytes: 4 * MB, ms: 1000 })])
  const after = addSample(before, { bytes: 4 * MB, ms: 2000 })
  assert.equal(before.length, 1)
  assert.equal(after.length, 2)
})

test('the figure reads in whole numbers once it is large, and tenths below that', () => {
  assert.equal(formatMbps(2.06), '2.1 Mbps')
  assert.equal(formatMbps(0.84), '0.8 Mbps')
  assert.equal(formatMbps(34.86), '35 Mbps')
  assert.equal(formatMbps(100.4), '100 Mbps')
  assert.equal(formatMbps(null), '')
  assert.equal(formatMbps(Number.NaN), '')
})

test('samples survive a restart', () => {
  const storage = memoryStorage()
  saveSamples([{ bytes: 4 * MB, ms: 1000 }], storage)
  assert.deepEqual(loadSamples(storage), [{ bytes: 4 * MB, ms: 1000 }])
  assert.ok(storage.map.has(SPEED_KEY))
})

test('a damaged store reads as empty', () => {
  assert.deepEqual(loadSamples(memoryStorage({ [SPEED_KEY]: '{not json' })), [])
  assert.deepEqual(loadSamples(memoryStorage({ [SPEED_KEY]: '{"a":1}' })), [])
  assert.deepEqual(
    loadSamples(memoryStorage({ [SPEED_KEY]: JSON.stringify([{ bytes: 'x', ms: 5 }, null, 7]) })),
    [],
  )
})

test('a browser with no storage still works', () => {
  assert.deepEqual(loadSamples(brokenStorage), [])
  assert.deepEqual(loadSamples(null), [])
  assert.doesNotThrow(() => saveSamples([{ bytes: 4 * MB, ms: 1000 }], brokenStorage))
  assert.doesNotThrow(() => saveSamples([{ bytes: 4 * MB, ms: 1000 }], null))
})
