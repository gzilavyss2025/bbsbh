import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useRevealProgress } from '../src/hooks/useRevealProgress.js'
import { REVEAL_KEY } from '../src/lib/account/revealMark.js'
import { ATBAT_MARK_PREFIX } from '../src/lib/account/revealOwner.js'

// #2891, item 2: a hook that stays mounted while `feed.gamePk` moves from game A to game B
// must read B's mark, not keep A's. The persist effect writes whatever it holds under the
// NEW key, so a carried-over mark would also be written into bbsbh:reveal:{B}.
//
// One server render, no DOM (test/CLAUDE.md): the probe switches its own feed with a
// render-phase update, which re-runs it with its hook state kept. That is the same thing a
// re-render with a new `feed` prop does to a mounted hook.
function withStorage(store, fn) {
  globalThis.window = { localStorage: { getItem: (k) => store[k] ?? null } }
  try { return fn() } finally { delete globalThis.window }
}

function afterSwitch(store) {
  const A = { gamePk: 111 }
  const B = { gamePk: 222 }
  let seen = null
  function Probe() {
    const [feed, setFeed] = useState(A)
    const r = useRevealProgress(feed, 9, 9)
    if (feed === A) setFeed(B)
    else seen = { through: r.revealedThrough, atBats: r.atBatCountFor(3, 'top') }
    return null
  }
  withStorage(store, () => renderToStaticMarkup(createElement(Probe)))
  return seen
}

test('a mounted hook does not carry game A\'s mark over to game B', () => {
  const seen = afterSwitch({ [`${REVEAL_KEY}111`]: '12', [`${ATBAT_MARK_PREFIX}111`]: '4:3' })
  assert.equal(seen.through, -1)
  assert.equal(seen.atBats, 0)
})

test('the switch reads game B\'s own stored mark', () => {
  const seen = afterSwitch({
    [`${REVEAL_KEY}111`]: '12',
    [`${REVEAL_KEY}222`]: '2',
    [`${ATBAT_MARK_PREFIX}222`]: '4:1',
  })
  assert.equal(seen.through, 2)
  assert.equal(seen.atBats, 1)
})
