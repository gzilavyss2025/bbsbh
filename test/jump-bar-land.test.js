// The jump bar's landing (src/lib/jumpbar/land.js, #2073 decision 3): when a tap's
// scroll has landed, and the replay of a stamp class.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { QUIET_MS, createLanding, replayClass } from '../src/lib/jumpbar/land.js'

// A clock the test drives: setTimer and clearTimer over one pending callback list.
function clock() {
  let now = 0
  let id = 0
  const due = new Map()
  return {
    setTimer: (fn, ms) => (due.set(++id, { fn, at: now + ms }), id),
    clearTimer: (t) => due.delete(t),
    tick(ms) {
      now += ms
      for (const [k, t] of [...due]) if (t.at <= now) (due.delete(k), t.fn())
    },
  }
}

test('a tap that scrolls nowhere lands after the quiet time', () => {
  const c = clock()
  let lands = 0
  createLanding({ isThere: () => true, onLand: () => lands++, ...c })
  c.tick(QUIET_MS - 1)
  assert.equal(lands, 0)
  c.tick(1)
  assert.equal(lands, 1)
})

test('each scroll event restarts the quiet time', () => {
  const c = clock()
  let lands = 0
  const w = createLanding({ isThere: () => true, onLand: () => lands++, ...c })
  for (let i = 0; i < 10; i++) {
    c.tick(16)
    w.scrolled()
  }
  c.tick(QUIET_MS - 1)
  assert.equal(lands, 0)
  c.tick(1)
  assert.equal(lands, 1)
})

test('scrollend lands at once, and only once', () => {
  const c = clock()
  let lands = 0
  const w = createLanding({ isThere: () => true, onLand: () => lands++, ...c })
  w.scrolled()
  w.ended()
  assert.equal(lands, 1)
  w.ended()
  c.tick(QUIET_MS * 2)
  assert.equal(lands, 1)
})

test('a stop away from the section waits for the next stop', () => {
  const c = clock()
  let there = false
  let lands = 0
  const w = createLanding({ isThere: () => there, onLand: () => lands++, ...c })
  w.ended()
  c.tick(QUIET_MS)
  assert.equal(lands, 0)
  there = true
  w.scrolled()
  c.tick(QUIET_MS)
  assert.equal(lands, 1)
})

test('the reader moving first cancels the landing', () => {
  const c = clock()
  let lands = 0
  const w = createLanding({ isThere: () => true, onLand: () => lands++, ...c })
  w.cancel()
  w.ended()
  c.tick(QUIET_MS)
  assert.equal(lands, 0)
})

test('replayClass takes the class off, reads layout, and puts it back', () => {
  const log = []
  const classes = new Set(['card', 'card--stamp-in'])
  const el = {
    classList: {
      contains: (c) => classes.has(c),
      remove: (c) => (log.push(`-${c}`), classes.delete(c)),
      add: (c) => (log.push(`+${c}`), classes.add(c)),
    },
    get offsetWidth() {
      log.push('read')
      return 0
    },
  }
  replayClass(el, 'card--stamp-in')
  assert.deepEqual(log, ['-card--stamp-in', 'read', '+card--stamp-in'])
  log.length = 0
  replayClass(el, 'not-there')
  assert.deepEqual(log, [])
})

test('the player page opts in; the bar stays opt-in', () => {
  const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
  assert.match(read('src/screens/player/next/PlayerNextPage.jsx'), /<HubTabBar variant="anchor"[^>]* hold onLand=\{onLand\}/)
  assert.match(read('src/components/chrome/HubTabBar.jsx'), /hold = false, onLand \}/)
  assert.doesNotMatch(read('src/screens/team/next/TeamNextPage.jsx'), /onLand/)
  assert.match(read('src/screens/player/next/Slot.jsx'), /e\.animationName === 'card-stamp-in'/)
})
