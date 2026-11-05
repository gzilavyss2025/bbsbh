import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { onStorageOrRestore } from '../src/lib/account/localStore.js'
import { useRecentSearches } from '../src/hooks/useRecentSearches.js'
import { useScorecardNotes } from '../src/hooks/useScorecardNotes.js'
import { usePitchMode } from '../src/screens/gameday/next/steps/subStep.js'
import { RECENT_SEARCHES_KEY } from '../src/lib/recentSearches.js'
import { SHEET_NOTES_KEY } from '../src/lib/scorecardNotes.js'

// #2937: a page restored from the back/forward cache missed every `storage` event fired
// while it sat there. `onStorageOrRestore` replays the handler on a persisted `pageshow`
// when the watched key's value changed meanwhile. Same stub window and createRoot probe
// as reveal-progress-game-switch.test.js (test/CLAUDE.md); node-only, no browser, no timers.
function stubWindow(t, initial = {}) {
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
  // Teardown runs last-in first-out, so a probe unmounts while its stub window still exists.
  const undo = [() => delete globalThis.window]
  t.after(async () => {
    while (undo.length) await undo.pop()()
  })
  return { win, store, undo }
}
const pageshow = (win, persisted) =>
  win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }))

// Mount `useHook(props)` through a probe; `seen.value` is what it returned last render.
async function mount({ undo }, useHook, props) {
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
  undo.push(async () => {
    await act(async () => root.unmount())
    delete globalThis.IS_REACT_ACT_ENVIRONMENT
  })
  const seen = { renders: 0 }
  function Probe(p) {
    seen.value = useHook(p)
    seen.renders += 1
    return null
  }
  const render = (p) => act(async () => root.render(createElement(Probe, p)))
  await render(props)
  return { seen, render, run: (fn) => act(async () => fn()) }
}

test('a persisted pageshow replays the watched key when its value changed', (t) => {
  const { win, store } = stubWindow(t, { a: '1' })
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
  store.a = '3'
  pageshow(win, true)
  win.dispatchEvent(Object.assign(new Event('storage'), { key: 'a' }))
  assert.equal(seen.length, 2) // both listeners are gone
})

test('an unchanged value means no replay', (t) => {
  const { win, store } = stubWindow(t, { a: '1' })
  const seen = []
  onStorageOrRestore('a', (e) => seen.push(e.newValue))
  pageshow(win, true)
  assert.deepEqual(seen, [])
  // A live event (the same-tab echo carries no newValue) moves what the helper last saw.
  store.a = '2'
  win.dispatchEvent(Object.assign(new Event('storage'), { key: 'a' }))
  pageshow(win, true)
  assert.deepEqual(seen, [undefined])
})

// Refused storage (Safari private mode): the hooks keep the session in memory, so a
// restore must leave them alone rather than replay "nothing stored" over it.
test('a restore with refused storage replays nothing', (t) => {
  const { win } = stubWindow(t)
  win.localStorage.getItem = () => {
    throw new Error('SecurityError')
  }
  const seen = []
  onStorageOrRestore('a', (e) => seen.push(e.key))
  pageshow(win, true)
  assert.deepEqual(seen, [])
})

test('a mounted hook picks up a change made while the page sat in the cache', async (t) => {
  const env = stubWindow(t)
  const { win, store } = env
  const h = await mount(env, useRecentSearches)
  assert.deepEqual(h.seen.value.recent, [])
  store[RECENT_SEARCHES_KEY] = JSON.stringify([{ kind: 'player', id: 7, name: 'Pat Doe', sub: 'SS' }])
  await h.run(() => pageshow(win, true))
  assert.equal(h.seen.value.recent.length, 1)
  assert.equal(h.seen.value.recent[0].id, 7)
  const renders = h.seen.renders
  await h.run(() => pageshow(win, true)) // nothing changed since: no re-render
  assert.equal(h.seen.renders, renders)
})

// Writes refused but reads work (a full quota; old iOS private mode): the in-memory list
// is the only copy, and storage still holds the stale value. A restore must not copy it over.
test('a restore with failing writes keeps the in-memory state', async (t) => {
  const env = stubWindow(t)
  const { win } = env
  win.localStorage.setItem = () => {
    throw new Error('QuotaExceededError')
  }
  const h = await mount(env, useRecentSearches)
  await h.run(() => h.seen.value.remember({ kind: 'team', id: 158, name: 'Brewers', sub: '' }))
  assert.equal(h.seen.value.recent.length, 1)
  await h.run(() => pageshow(win, true))
  assert.equal(h.seen.value.recent.length, 1)
})

test('scorecard notes restore from the replayed newValue', async (t) => {
  const env = stubWindow(t)
  const { win, store } = env
  const h = await mount(env, ({ gamePk }) => useScorecardNotes(gamePk), { gamePk: 5 })
  store[`${SHEET_NOTES_KEY}5`] = JSON.stringify({ v: 1, cells: { 12: { outcome: 'F8' } } })
  await h.run(() => pageshow(win, true))
  assert.equal(h.seen.value.notes.cells['12'].outcome, 'F8')
})

test('pitch mode replays its own game\'s key, and follows a game switch', async (t) => {
  const env = stubWindow(t)
  const { win, store } = env
  const h = await mount(env, ({ gamePk }) => usePitchMode(gamePk), { gamePk: 1 })
  assert.equal(h.seen.value[0], false)
  store['bbsbh:pitchmode:1'] = '1'
  await h.run(() => pageshow(win, true))
  assert.equal(h.seen.value[0], true)
  await h.render({ gamePk: 2 })
  assert.equal(h.seen.value[0], false)
  store['bbsbh:pitchmode:2'] = '1'
  await h.run(() => pageshow(win, true))
  assert.equal(h.seen.value[0], true)
})
