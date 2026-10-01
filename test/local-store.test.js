import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { localStore, notifyStorage } from '../src/lib/account/localStore.js'

let store
let events
const saved = {}

function install({ throwing = false } = {}) {
  store = new Map()
  events = []
  const boom = () => {
    throw new Error('storage disabled')
  }
  globalThis.StorageEvent = class {
    constructor(type, init) {
      this.type = type
      Object.assign(this, init)
    }
  }
  globalThis.window = {
    localStorage: throwing
      ? { getItem: boom, setItem: boom, removeItem: boom }
      : {
          getItem: (k) => (store.has(k) ? store.get(k) : null),
          setItem: (k, v) => store.set(k, String(v)),
          removeItem: (k) => store.delete(k),
        },
    dispatchEvent: (e) => events.push(e),
  }
}

beforeEach(() => {
  saved.window = globalThis.window
  saved.StorageEvent = globalThis.StorageEvent
  install()
})

afterEach(() => {
  for (const k of ['window', 'StorageEvent']) {
    if (saved[k] === undefined) delete globalThis[k]
    else globalThis[k] = saved[k]
  }
})

const list = localStore('k', (raw) => (raw == null ? [] : JSON.parse(raw)), (v) => JSON.stringify(v))

test('write stores serialize(value) under the key and read parses it back', () => {
  list.write([1, 2])
  assert.equal(store.get('k'), '[1,2]')
  assert.deepEqual(list.read(), [1, 2])
})

test('read of an absent key answers what parse(null) answers', () => {
  assert.deepEqual(list.read(), [])
})

test('read whose parse throws on corrupt text falls back to parse(null)', () => {
  store.set('k', '{not json')
  assert.deepEqual(list.read(), [])
})

test('drop removes the key', () => {
  list.write([1])
  list.drop()
  assert.equal(store.has('k'), false)
})

test('notify dispatches a storage event carrying the key', () => {
  list.notify()
  notifyStorage('other')
  assert.deepEqual(events.map((e) => [e.type, e.key]), [['storage', 'k'], ['storage', 'other']])
})

test('nothing throws when storage is disabled, and a read falls back', () => {
  install({ throwing: true })
  assert.deepEqual(list.read(), [])
  list.write([1])
  list.drop()
})

test('notifyStorage does not throw when StorageEvent is missing', () => {
  delete globalThis.StorageEvent
  notifyStorage('k')
})

test('a serialize that throws is swallowed like a failed write', () => {
  const bad = localStore('k', (r) => r, () => {
    throw new Error('bad')
  })
  bad.write('x')
  assert.equal(store.has('k'), false)
})
