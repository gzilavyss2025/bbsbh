// Round trips of POST /api/reveal's write path (storeReveal). The unit suite has
// no live Redis, so a fake records every command; the assertions pin how many
// SEQUENTIAL trips a reveal costs, because a reader is mid-game when this fires.
import assert from 'node:assert/strict'
import test from 'node:test'

import { storeReveal } from '../api/reveal.js'

function fakeRedis(hashes = {}) {
  const calls = []
  let inFlight = 0
  const tick = () => new Promise((resolve) => setImmediate(resolve))
  // Each command holds the line for one tick, so `peak` is how many were issued
  // without waiting on an earlier one: 1 means fully sequential.
  const log = async (name) => {
    calls.push(name)
    inFlight += 1
    fake.peak = Math.max(fake.peak, inFlight)
    await tick()
    inFlight -= 1
  }
  const fake = {
    peak: 0,
    execs: 0,
    calls,
    hashes,
    store: {},
    sets: {},
    async eval(_script, [key], [inc]) {
      await log('eval')
      const cur = this.store[key]
      if (cur === undefined || inc > cur) this.store[key] = inc
      return this.store[key]
    },
    async set(key, v) {
      await log('set')
      this.store[key] = v
    },
    async sadd(key, v) {
      await log('sadd')
      ;(this.sets[key] ??= new Set()).add(v)
    },
    async hset(key, obj) {
      await log('hset')
      this.hashes[key] = { ...(this.hashes[key] ?? {}), ...obj }
    },
    multi() {
      const queued = []
      const tx = {
        hset: (key, obj) => (queued.push(['hset', key, obj]), tx),
        hlen: (key) => (queued.push(['hlen', key]), tx),
        exec: async () => {
          await log('multi')
          fake.execs += 1
          const out = []
          for (const [name, ...args] of queued) {
            if (name === 'hset') {
              fake.hashes[args[0]] = { ...(fake.hashes[args[0]] ?? {}), ...args[1] }
              out.push(1)
            } else out.push(Object.keys(fake.hashes[args[0]] ?? {}).length)
          }
          return out
        },
      }
      return tx
    },
    async hlen(key) {
      await log('hlen')
      return Object.keys(this.hashes[key] ?? {}).length
    },
    async hgetall(key) {
      await log('hgetall')
      return this.hashes[key] ?? null
    },
    async hdel(key, ...fields) {
      await log('hdel')
      for (const f of fields) delete this.hashes[key]?.[f]
    },
  }
  return fake
}

const game = { date: '2026-08-06', away: 'PIT', home: 'MIL', finalHalfIndex: null }

test('a mark POST under the scorebook cap never reads the whole hash', async () => {
  const redis = fakeRedis()
  const out = await storeReveal(redis, 'u1', '100', { revealedThrough: 3, game })
  assert.deepEqual(out, { revealedThrough: 3, boxRevealed: false })
  assert.equal(redis.calls.includes('hgetall'), false)
  assert.ok(redis.hashes['scorebook:u1']['100'])
})

test('the scorebook write and its length check share one trip', async () => {
  const redis = fakeRedis()
  await storeReveal(redis, 'u1', '100', { revealedThrough: 3, game })
  assert.equal(redis.execs, 1)
  assert.equal(redis.calls.includes('hlen'), false)
  assert.equal(redis.calls.includes('hset'), false)
  assert.ok(redis.hashes['scorebook:u1']['100'])
})

test('an index write that throws synchronously is swallowed and the mark still returns', async () => {
  const redis = fakeRedis()
  redis.sadd = () => {
    throw new TypeError('bad argument')
  }
  const out = await storeReveal(redis, 'u1', '100', { revealedThrough: 3 })
  assert.deepEqual(out, { revealedThrough: 3, boxRevealed: false })
})

test('an index write that rejects is swallowed and the mark still returns', async () => {
  const redis = fakeRedis()
  redis.sadd = async () => {
    throw new Error('down')
  }
  const out = await storeReveal(redis, 'u1', '100', { revealedThrough: 3 })
  assert.deepEqual(out, { revealedThrough: 3, boxRevealed: false })
})

test('a failed ratchet surfaces to the caller instead of answering ok', async () => {
  const redis = fakeRedis()
  redis.eval = async () => {
    throw new Error('script error')
  }
  await assert.rejects(storeReveal(redis, 'u1', '100', { revealedThrough: 3 }), /script error/)
})

test('a mark POST makes its independent writes together, then the scorebook write', async () => {
  const redis = fakeRedis()
  await storeReveal(redis, 'u1', '100', { revealedThrough: 3, boxRevealed: true, game })
  // eval, set and sadd have no dependency on each other; they may land in any
  // order but must all precede the scorebook write that needs the ratcheted mark.
  const firstBook = redis.calls.indexOf('multi')
  assert.deepEqual([...redis.calls.slice(0, firstBook)].sort(), ['eval', 'sadd', 'set'])
  assert.equal(redis.peak, 3)
})

test('a box-only POST writes the bit and the index, and nothing else', async () => {
  const redis = fakeRedis()
  const out = await storeReveal(redis, 'u1', '100', { boxRevealed: true, game })
  assert.deepEqual(out, { revealedThrough: null, boxRevealed: true })
  assert.deepEqual([...redis.calls].sort(), ['sadd', 'set'])
})

test('over the cap, the oldest scorebook entries are pruned', async () => {
  const old = {}
  for (let i = 1; i <= 24; i++) old[String(i)] = { ...game, revealedThrough: 1, updatedAt: i }
  const redis = fakeRedis({ 'scorebook:u1': old })
  await storeReveal(redis, 'u1', '100', { revealedThrough: 3, game })
  const kept = Object.keys(redis.hashes['scorebook:u1'])
  assert.equal(kept.length, 24)
  assert.ok(kept.includes('100'))
  assert.equal(kept.includes('1'), false)
})

test('a malformed mark is refused before any write', async () => {
  const redis = fakeRedis()
  const out = await storeReveal(redis, 'u1', '100', { revealedThrough: -1 })
  assert.deepEqual(out, { error: 'revealedThrough out of range' })
  assert.deepEqual(redis.calls, [])
})
