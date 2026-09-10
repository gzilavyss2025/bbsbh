// Express Lane Tier 3 — the byte store (src/lib/expresslane/byteStore.js).
//
// Runs offline against a small in-memory IndexedDB stand-in. Every call in
// the module takes its `idb` as an option for exactly this reason, the same
// way clipIndex.js takes its fetcher.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkoutClip,
  clearGame,
  deleteClips,
  getClip,
  persistStorage,
  putClip,
  stagedBytes,
  stagedPlayIds,
  storageHeadroom,
} from '../src/lib/expresslane/byteStore.js'

// A stand-in for IndexedDB: enough of the shape for one object store with one
// index, with the asynchrony the real thing has. Requests settle on a
// microtask and a transaction completes on a macrotask, so a caller that
// assigns `onsuccess` or `oncomplete` AFTER issuing its request still hears
// about it — which is how the real API behaves and how the module is written.
function fakeIdb({ failWrites = null } = {}) {
  const rows = new Map()
  const settle = (request, value) => {
    queueMicrotask(() => {
      request.result = value
      request.onsuccess?.()
    })
    return request
  }
  const db = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction(unusedName, mode) {
      const tx = { error: null }
      let failed = null
      const store = {
        put(record) {
          if (failWrites) {
            failed = { name: failWrites }
            return
          }
          rows.set(record.key, record)
        },
        get(key) {
          return settle({}, rows.get(key))
        },
        delete(key) {
          rows.delete(key)
        },
        index() {
          return {
            getAllKeys(gamePk) {
              const keys = [...rows.values()]
                .filter((row) => row.gamePk === gamePk)
                .map((row) => row.key)
              return settle({}, keys)
            },
            getAll(gamePk) {
              return settle(
                {},
                [...rows.values()].filter((row) => row.gamePk === gamePk),
              )
            },
          }
        },
      }
      setTimeout(() => {
        if (failed) {
          tx.error = failed
          tx.onabort?.()
          return
        }
        if (mode === 'readwrite') tx.oncomplete?.()
      }, 0)
      return { ...tx, objectStore: () => store, get error() { return tx.error },
        set onabort(fn) { tx.onabort = fn },
        set onerror(fn) { tx.onerror = fn },
        set oncomplete(fn) { tx.oncomplete = fn } }
    },
  }
  return {
    open() {
      const request = {}
      queueMicrotask(() => {
        request.result = db
        request.onsuccess?.()
      })
      return request
    },
    rows,
  }
}

const blob = (bytes) => new Blob([new Uint8Array(bytes)])

// --- storing and reading back ---------------------------------------------

test('a clip goes in and comes back out', async () => {
  const idb = fakeIdb()
  assert.equal(await putClip(823035, 'p1', blob(64), { idb }), 'stored')
  const back = await getClip(823035, 'p1', { idb })
  assert.equal(back?.size, 64)
})

test('a clip that is not staged reads back null, which is an ordinary answer', async () => {
  const idb = fakeIdb()
  assert.equal(await getClip(823035, 'missing', { idb }), null)
})

test('two games do not see each other', async () => {
  const idb = fakeIdb()
  await putClip(823035, 'p1', blob(8), { idb })
  await putClip(823914, 'p1', blob(8), { idb })
  assert.deepEqual([...(await stagedPlayIds(823035, { idb }))], ['p1'])
  assert.equal(idb.rows.size, 2, 'the same playId in two games is two rows')
})

test('resume reads back every playId already staged', async () => {
  const idb = fakeIdb()
  await putClip(823035, 'p1', blob(8), { idb })
  await putClip(823035, 'p2', blob(8), { idb })
  const staged = await stagedPlayIds(823035, { idb })
  assert.deepEqual([...staged].sort(), ['p1', 'p2'])
})

test('a playId carrying a colon survives the key round trip', async () => {
  // The queue's fallback key is `atBatIndex:eventIndex`, so a colon in the
  // second half of the composite key is a real shape, not a hypothetical.
  const idb = fakeIdb()
  await putClip(823035, '57:3', blob(8), { idb })
  assert.deepEqual([...(await stagedPlayIds(823035, { idb }))], ['57:3'])
})

// --- eviction -------------------------------------------------------------

test('eviction deletes what it is given and reports how many', async () => {
  const idb = fakeIdb()
  await putClip(823035, 'p1', blob(8), { idb })
  await putClip(823035, 'p2', blob(8), { idb })
  assert.equal(await deleteClips(823035, ['p1'], { idb }), 1)
  assert.deepEqual([...(await stagedPlayIds(823035, { idb }))], ['p2'])
})

test('evicting nothing touches nothing', async () => {
  const idb = fakeIdb()
  assert.equal(await deleteClips(823035, [], { idb }), 0)
})

test('clearing a game leaves the other game standing', async () => {
  const idb = fakeIdb()
  await putClip(823035, 'p1', blob(8), { idb })
  await putClip(823914, 'p1', blob(8), { idb })
  assert.equal(await clearGame(823035, { idb }), true)
  assert.equal((await stagedPlayIds(823035, { idb })).size, 0)
  assert.equal((await stagedPlayIds(823914, { idb })).size, 1)
})

test('bytes are reported and a count deliberately is not', async () => {
  const idb = fakeIdb()
  await putClip(823035, 'p1', blob(100), { idb })
  await putClip(823035, 'p2', blob(50), { idb })
  assert.equal(await stagedBytes(823035, { idb }), 150)
})

// --- refusals -------------------------------------------------------------

test('a quota refusal is told apart from a failure, because the queue must be', async () => {
  const idb = fakeIdb({ failWrites: 'QuotaExceededError' })
  assert.equal(await putClip(823035, 'p1', blob(8), { idb }), 'quota')
})

test('any other write failure is a failure, not a full disk', async () => {
  const idb = fakeIdb({ failWrites: 'UnknownError' })
  assert.equal(await putClip(823035, 'p1', blob(8), { idb }), 'failed')
})

test('no IndexedDB at all degrades rather than throwing', async () => {
  for (const idb of [undefined, null, {}]) {
    assert.equal(await putClip(823035, 'p1', blob(8), { idb }), 'unavailable')
    assert.equal(await getClip(823035, 'p1', { idb }), null)
    assert.equal((await stagedPlayIds(823035, { idb })).size, 0)
    assert.equal(await deleteClips(823035, ['p1'], { idb }), 0)
    assert.equal(await stagedBytes(823035, { idb }), 0)
  }
})

test('a store that throws on open is the same as no store', async () => {
  const hostile = {
    open() {
      throw new Error('refused')
    },
  }
  assert.equal(await getClip(823035, 'p1', { idb: hostile }), null)
  assert.equal(await putClip(823035, 'p1', blob(8), { idb: hostile }), 'unavailable')
})

test('a clip with no bytes is refused before it reaches the store', async () => {
  const idb = fakeIdb()
  assert.equal(await putClip(823035, 'p1', null, { idb }), 'failed')
  assert.equal(await putClip(823035, '', blob(8), { idb }), 'failed')
})

// --- the storage probe ----------------------------------------------------

test('the probe reports headroom, and says when the browser told it nothing', async () => {
  const known = await storageHeadroom({
    storage: { estimate: async () => ({ quota: 1000, usage: 400 }) },
  })
  assert.deepEqual(known, { known: true, quota: 1000, usage: 400, free: 600 })

  for (const storage of [undefined, {}, { estimate: async () => ({}) }]) {
    const unknown = await storageHeadroom({ storage })
    assert.equal(unknown.known, false, 'silence is not a refusal')
    assert.equal(unknown.free, null)
  }
})

test('a probe that throws reports unknown rather than stopping staging', async () => {
  const result = await storageHeadroom({
    storage: {
      estimate: async () => {
        throw new Error('no')
      },
    },
  })
  assert.equal(result.known, false)
})

test('persistence is asked for, and a refusal changes nothing', async () => {
  assert.equal(await persistStorage({ storage: { persist: async () => true } }), true)
  assert.equal(await persistStorage({ storage: { persist: async () => false } }), false)
  assert.equal(await persistStorage({ storage: {} }), false)
  assert.equal(
    await persistStorage({
      storage: {
        persist: async () => {
          throw new Error('no')
        },
      },
    }),
    false,
  )
})

// --- object URLs ----------------------------------------------------------

test('a checked-out clip hands back the call that revokes it', () => {
  const revoked = []
  const urls = {
    createObjectURL: () => 'blob:fake-1',
    revokeObjectURL: (url) => revoked.push(url),
  }
  const { url, release } = checkoutClip(blob(8), { urls })
  assert.equal(url, 'blob:fake-1')
  release()
  release()
  assert.deepEqual(revoked, ['blob:fake-1'], 'releasing twice revokes once')
})

test('no Blob and no URL support both give a URL of null, never a throw', () => {
  const urls = { createObjectURL: () => 'blob:x', revokeObjectURL() {} }
  assert.equal(checkoutClip(null, { urls }).url, null)
  assert.equal(checkoutClip(blob(8), { urls: {} }).url, null)
  checkoutClip(null, { urls }).release()
})

test('a revoke that throws does not take the screen down', () => {
  const { release } = checkoutClip(blob(8), {
    urls: {
      createObjectURL: () => 'blob:x',
      revokeObjectURL() {
        throw new Error('no')
      },
    },
  })
  release()
})
