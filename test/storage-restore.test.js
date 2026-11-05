import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { onStorageOrRestore } from '../src/lib/account/localStore.js'
import { useRecentSearches } from '../src/hooks/useRecentSearches.js'
import { RECENT_SEARCHES_KEY } from '../src/lib/recentSearches.js'

// #2937: a page restored from the back/forward cache missed every `storage` event fired
// while it sat there. `onStorageOrRestore` replays the handler on a persisted `pageshow`
// with each watched key's current value. Same stub window and createRoot probe as
// reveal-progress-game-switch.test.js (test/CLAUDE.md); node-only, no browser, no timers.
function stubWindow(initial = {}) {
  const store = { ...initial }
  const win = new EventTarget()
  win.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    },
  }
  win.HTMLIFrameElement = class {}
  globalThis.window = win
  return { win, store }
}
const pageshow = (win, persisted) =>
  win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }))

test('a persisted pageshow replays the watched key with its current value', (t) => {
  const { win, store } = stubWindow({ a: '1' })
  t.after(() => delete globalThis.window)
  const seen = []
  const off = onStorageOrRestore('a', (e) => seen.push([e.key, e.newValue]))
  win.dispatchEvent(Object.assign(new Event('storage'), { key: 'a', newValue: '1' }))
  assert.deepEqual(seen, [['a', '1']]) // a live `storage` event passes straight through
  store.a = '2' // another tab, while this page sat in the cache
  pageshow(win, false) // an ordinary load: nothing was missed
  assert.equal(seen.length, 1)
  pageshow(win, true)
  assert.deepEqual(seen.slice(1), [['a', '2']])
  off()
  pageshow(win, true)
  win.dispatchEvent(Object.assign(new Event('storage'), { key: 'a' }))
  assert.equal(seen.length, 2) // both listeners are gone
})

// Refused storage (Safari private mode): the hooks keep the session in memory, so a
// restore must leave them alone rather than replay "nothing stored" over it.
test('a restore with refused storage replays nothing', (t) => {
  const { win } = stubWindow()
  t.after(() => delete globalThis.window)
  win.localStorage.getItem = () => {
    throw new Error('SecurityError')
  }
  const seen = []
  const off = onStorageOrRestore('a', (e) => seen.push(e.key))
  pageshow(win, true)
  assert.deepEqual(seen, [])
  off()
})

test('a mounted hook picks up a change made while the page sat in the cache', async (t) => {
  const { win, store } = stubWindow()
  t.after(() => delete globalThis.window)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const doc = { nodeType: 9, nodeName: '#document', addEventListener() {}, removeEventListener() {} }
  const container = {
    nodeType: 1,
    nodeName: 'DIV',
    tagName: 'DIV',
    ownerDocument: doc,
    addEventListener() {},
    removeEventListener() {},
  }
  doc.documentElement = container
  const root = createRoot(container)
  const seen = {}
  function Probe() {
    seen.recent = useRecentSearches().recent
    return null
  }
  await act(async () => root.render(createElement(Probe)))
  assert.deepEqual(seen.recent, [])
  store[RECENT_SEARCHES_KEY] = JSON.stringify([{ kind: 'player', id: 7, name: 'Pat Doe', sub: 'SS' }])
  await act(async () => pageshow(win, true))
  assert.equal(seen.recent.length, 1)
  assert.equal(seen.recent[0].id, 7)
  await act(async () => root.unmount())
})
