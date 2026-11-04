import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useRevealProgress, useBoxScoreReveal } from '../src/hooks/useRevealProgress.js'
import { REVEAL_KEY } from '../src/lib/account/revealMark.js'
import { ATBAT_MARK_PREFIX } from '../src/lib/account/revealOwner.js'
import { BOX_REVEAL_PREFIX } from '../src/lib/account/boxReveal.js'

// #2891, item 2: a hook that stays mounted while `feed.gamePk` moves from game A to game B
// must read B's mark, never show A's on B, and never write A's under B's keys.
//
// The persist and storage-listener paths are effects, which a server render never runs,
// so this file mounts the hooks through react-dom/client's `createRoot` on a stub
// container. The probe renders null, so React touches no DOM beyond the container's
// event wiring; still node-only, no browser, no timers (test/CLAUDE.md).
const A = 111
const B = 222
const mark = (pk) => `${REVEAL_KEY}${pk}`
const cursor = (pk) => `${ATBAT_MARK_PREFIX}${pk}`
const box = (pk) => `${BOX_REVEAL_PREFIX}${pk}`

function setup(initial) {
  const store = { ...initial }
  const writes = []
  const win = new EventTarget()
  win.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      writes.push([k, String(v)])
      store[k] = String(v)
    },
    removeItem: (k) => {
      writes.push([k, null])
      delete store[k]
    },
  }
  globalThis.window = win
  win.HTMLIFrameElement = class {}
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
  function Reveal({ feed }) {
    seen.reveal = useRevealProgress(feed, 9, 9)
    return null
  }
  function Box({ gamePk }) {
    seen.box = useBoxScoreReveal(gamePk)
    return null
  }
  return {
    store,
    writes,
    seen,
    render: (el) => act(async () => root.render(el)),
    reveal: (feed) => act(async () => root.render(createElement(Reveal, { feed }))),
    box: (gamePk) => act(async () => root.render(createElement(Box, { gamePk }))),
    run: (fn) => act(async () => fn()),
    storage: (key, newValue) =>
      act(async () => win.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }))),
    done: async () => {
      await act(async () => root.unmount())
      delete globalThis.window
    },
  }
}

const writesTo = (writes, key) => writes.filter(([k]) => k === key)

test('a game switch reads B fresh and writes nothing of A under B', async () => {
  const t = setup({ [mark(A)]: '12', [cursor(A)]: '4:3' })
  await t.reveal({ gamePk: A })
  assert.equal(t.seen.reveal.revealedThrough, 12)
  await t.reveal({ gamePk: B })
  assert.equal(t.seen.reveal.revealedThrough, -1)
  assert.equal(t.seen.reveal.atBatCountFor(3, 'top'), 0)
  assert.deepEqual(writesTo(t.writes, mark(B)), [])
  assert.equal(t.store[cursor(B)], undefined)
  assert.equal(t.store[mark(A)], '12') // A is left exactly as it was
  await t.done()
})

test('the switch reads game B\'s own stored mark and cursor', async () => {
  const t = setup({ [mark(A)]: '12', [mark(B)]: '2', [cursor(B)]: '4:1' })
  await t.reveal({ gamePk: A })
  await t.reveal({ gamePk: B })
  assert.equal(t.seen.reveal.revealedThrough, 2)
  assert.equal(t.seen.reveal.atBatCountFor(3, 'top'), 1)
  assert.equal(t.store[mark(B)], '2')
  assert.equal(t.store[cursor(B)], '4:1')
  await t.done()
})

// The slow-cloud-GET and pre-flush-listener cases: both call the merge they were handed
// while game A was mounted, after the hook has moved on to B.
test('a late game-A merge lands on neither B\'s screen nor B\'s key', async () => {
  const t = setup({ [mark(A)]: '3' })
  await t.reveal({ gamePk: A })
  const mergeForA = t.seen.reveal.mergeRevealedThrough
  await t.reveal({ gamePk: B })
  await t.run(() => mergeForA(14))
  assert.equal(t.seen.reveal.revealedThrough, -1)
  assert.deepEqual(writesTo(t.writes, mark(B)), [])
  // B's own sources still work: a second tab on B advances it.
  await t.storage(mark(B), '5')
  assert.equal(t.seen.reveal.revealedThrough, 5)
  assert.equal(t.store[mark(B)], '5')
  await t.done()
})

// Before #2891 a hook mounted with no gamePk stayed at -1 when one arrived and wiped that
// game's cursor. Reading a mark the reader really made is right; this pins it.
test('a hook that mounts before its gamePk reads that game\'s mark when it arrives', async () => {
  const t = setup({ [mark(B)]: '6', [cursor(B)]: '8:2' })
  await t.reveal(null)
  assert.equal(t.seen.reveal.revealedThrough, -1)
  await t.reveal({ gamePk: B })
  assert.equal(t.seen.reveal.revealedThrough, 6)
  assert.equal(t.seen.reveal.atBatCountFor(5, 'top'), 2)
  assert.equal(t.store[cursor(B)], '8:2')
  await t.done()
})

test('the box score: a late game-A open does not open game B', async () => {
  const t = setup({})
  await t.box(A)
  const openA = t.seen.box.markBoxOpened
  await t.box(B)
  await t.run(() => openA())
  assert.equal(t.seen.box.boxOpened, false)
  assert.deepEqual(writesTo(t.writes, box(B)), [])
  await t.done()
})
