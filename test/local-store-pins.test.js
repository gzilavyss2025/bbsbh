// Pins what the three localStorage hooks (useStamps, useBooks, usePreferences)
// put on a real device: the key names, the stored shape,
// the same-tab `storage` echo, and the private-mode degrade. Users' collections
// live under these keys, so a refactor of the read/write plumbing must not move
// any of it (issue #1308, item 3).
//
// There is no DOM in this suite, so each hook is server-rendered once to get
// its initial-state read, and its returned actions are then called on the dead
// render. That reaches every write that sits OUTSIDE a React state updater
// (`commit` in useStamps/useBooks) and every echo. A write inside an updater
// (usePreferences.commit) never runs on a dead render; that is covered by the
// key-name pins and by the lib round-trip tests. (A fourth hook, for the
// Scores Unlocked pass, was removed with the pass, ADR-0116.)

import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { useStamps, readStampsOwner, writeStampsOwner } from '../src/hooks/useStamps.js'
import { useBooks, readBooksOwner, writeBooksOwner } from '../src/hooks/useBooks.js'
import { usePreferences } from '../src/hooks/preferences/usePreferences.js'
import { STAMPS_KEY, STAMPS_OWNER_KEY, serializeStamps, addStamp } from '../src/lib/stamps.js'
import { BOOKS_KEY, BOOKS_OWNER_KEY, DEFAULT_BOOK_ID, serializeBooks, parseBooks } from '../src/lib/books.js'
import { PREFS_KEY, serializePreferences } from '../src/lib/account/preferences.js'

let store
let echoes
const saved = {}

function install({ throwing = false } = {}) {
  store = new Map()
  echoes = []
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
    dispatchEvent: (e) => echoes.push(e.key),
    addEventListener() {},
    removeEventListener() {},
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

// Server-render a component that calls `useHook` and hand back what it returned.
function renderHook(useHook) {
  let api
  renderToString(
    React.createElement(function Probe() {
      api = useHook()
      return null
    }),
  )
  return api
}

test('storage key names have not moved', () => {
  assert.equal(STAMPS_KEY, 'bbsbh:stamps')
  assert.equal(STAMPS_OWNER_KEY, 'bbsbh:stampsOwner')
  assert.equal(BOOKS_KEY, 'bbsbh:books')
  assert.equal(BOOKS_OWNER_KEY, 'bbsbh:booksOwner')
  assert.equal(PREFS_KEY, 'bbsbh:prefs')
})

test('useStamps reads the stored collection, writes it back under the same key, and echoes', () => {
  const seeded = addStamp({}, 777, { mode: 'watched', note: 'n', date: '2026-07-01', now: 5 })
  store.set(STAMPS_KEY, serializeStamps(seeded))
  const api = renderHook(useStamps)
  assert.equal(api.stampFor(777).note, 'n')

  api.stamp(888, { mode: 'watched', note: 'two', date: '2026-07-02' })
  const written = JSON.parse(store.get(STAMPS_KEY))
  assert.deepEqual(Object.keys(written).sort(), ['777', '888'])
  assert.equal(written['888'].state, 'on')
  assert.equal(written['888'].note, 'two')
  assert.equal(written['888'].date, '2026-07-02')
  assert.deepEqual(echoes, [STAMPS_KEY])
})

test('useStamps with storage disabled still renders an empty book and does not throw', () => {
  install({ throwing: true })
  const api = renderHook(useStamps)
  assert.deepEqual(api.stamps, {})
  api.stamp(1, { mode: 'watched', date: '2026-07-01' })
})

test('useBooks backfills the default book under the same key, then writes and echoes', () => {
  const api = renderHook(useBooks)
  assert.equal(JSON.parse(store.get(BOOKS_KEY))[DEFAULT_BOOK_ID].state, 'on')
  assert.equal(api.books.length, 1)

  const id = api.createBook({ title: 'Road trip', subtitle: '', coverTeamId: 158 })
  const written = parseBooks(store.get(BOOKS_KEY))
  assert.equal(written[id].title, 'Road trip')
  assert.deepEqual(echoes, [BOOKS_KEY])
})

test('useBooks reads the stored shelf as written', () => {
  const first = renderHook(useBooks)
  const id = first.createBook({ title: 'Kept', subtitle: '', coverTeamId: null })
  const raw = store.get(BOOKS_KEY)
  assert.equal(serializeBooks(parseBooks(raw)), raw)
  const again = renderHook(useBooks)
  assert.ok(again.books.some((b) => b.id === id && b.title === 'Kept'))
})

test('useBooks with storage disabled still renders a default book', () => {
  install({ throwing: true })
  assert.equal(renderHook(useBooks).books.length, 1)
})

test('usePreferences reads the stored document and echoes on set', () => {
  store.set(PREFS_KEY, serializePreferences({ club: { value: 147, updatedAt: 5 } }))
  const api = renderHook(usePreferences)
  assert.equal(api.club, 147)
  api.set('club', 111)
  assert.deepEqual(echoes, [PREFS_KEY])
})

test('owner tags: write stores the id as a string, a falsy id removes the tag, read gives "" when absent', () => {
  for (const [read, write, key] of [
    [readStampsOwner, writeStampsOwner, STAMPS_OWNER_KEY],
    [readBooksOwner, writeBooksOwner, BOOKS_OWNER_KEY],
  ]) {
    assert.equal(read(), '')
    assert.equal(write('user_1'), true)
    assert.equal(store.get(key), 'user_1')
    assert.equal(read(), 'user_1')
    assert.equal(write(null), true)
    assert.equal(store.has(key), false)
  }
})

test('owner tags with storage disabled read "" and report the failed write', () => {
  install({ throwing: true })
  for (const [read, write] of [
    [readStampsOwner, writeStampsOwner],
    [readBooksOwner, writeBooksOwner],
  ]) {
    assert.equal(read(), '')
    assert.equal(write('user_1'), false)
  }
})
