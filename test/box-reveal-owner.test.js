// The shared-device guard on the box score's own bit (ADR-0049) —
// src/lib/account/boxReveal.js.
//
// THE LEAK. `bbsbh:boxreveal:{gamePk}` is keyed by gamePk and nothing else: no
// account, and nothing cleared it on sign-out. On a family iPad, user A signs
// in and opens a box score; A signs out and the bit stays, local-first by
// design; B signs in and opens that game, and the page renders OPEN for B.
//
// This one is not account hygiene. The other channels leak state; this leaks a
// RENDER OVERRIDE — the whole point of the bit is that the box score renders
// unsealed with no reveal mark. So B is shown a score they never asked to see,
// on a scoring surface, which is the thing this app exists to prevent. And the
// latch is one-directional, so B cannot get the seal back by signing out again.
// The bit has to be REMOVED.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BOX_REVEAL_OWNER_KEY,
  BOX_REVEAL_PREFIX,
  clearBoxRevealMarksIn,
  readBoxRevealOwnerIn,
  writeBoxRevealOwnerIn,
} from '../src/lib/account/boxReveal.js'
import { mergeStrategyFor } from '../src/lib/account/preferences.js'

// A localStorage stand-in with the two behaviours that matter here: `key(i)` is
// positional over insertion order, and a removal RE-INDEXES everything after
// it — which is the trap a sweep that removes while iterating falls into.
function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    get length() {
      return Object.keys(data).length
    },
    key(i) {
      return Object.keys(data)[i] ?? null
    },
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null
    },
    setItem(k, v) {
      data[k] = String(v)
    },
    removeItem(k) {
      delete data[k]
    },
  }
}

test('every box-reveal mark comes off, and nothing else does', () => {
  const storage = fakeStorage({
    [`${BOX_REVEAL_PREFIX}777747`]: '1',
    [`${BOX_REVEAL_PREFIX}777748`]: '1',
    [`${BOX_REVEAL_PREFIX}777749`]: '1',
    'bbsbh:reveal:777747': '13',
    'bbsbh:reveal-atbat:777747': '13:2',
    'bbsbh:stamps': '{}',
    'bbsbh:prefs': '{}',
    'unrelated:key': 'x',
  })

  const cleared = clearBoxRevealMarksIn(storage)

  assert.deepEqual(
    cleared.sort(),
    [`${BOX_REVEAL_PREFIX}777747`, `${BOX_REVEAL_PREFIX}777748`, `${BOX_REVEAL_PREFIX}777749`],
    'all three go — the re-indexing trap would have left the middle one behind',
  )
  assert.equal(storage.getItem(`${BOX_REVEAL_PREFIX}777748`), null)
  // This channel clears only its own keys. The reveal mark and the stamps are
  // separate channels with separate owner tags, and a device that reached one
  // endpoint but not another must not have both decided for it.
  assert.equal(storage.getItem('bbsbh:reveal:777747'), '13')
  assert.equal(storage.getItem('bbsbh:stamps'), '{}')
  assert.equal(storage.getItem('bbsbh:prefs'), '{}')
  assert.equal(storage.getItem('unrelated:key'), 'x')
})

test('the prefix is exact — a lookalike key is not a box-reveal mark', () => {
  const storage = fakeStorage({
    'bbsbh:boxreveal': '1',
    'bbsbh:boxrevealOwner': 'user_a',
    'bbsbh:boxreveal-notes:1': '1',
    [`${BOX_REVEAL_PREFIX}1`]: '1',
  })
  assert.deepEqual(clearBoxRevealMarksIn(storage), [`${BOX_REVEAL_PREFIX}1`])
  // The owner tag itself must survive its own sweep, or the very next read
  // would call a foreign device a guest's and backfill instead of adopting.
  assert.equal(storage.getItem(BOX_REVEAL_OWNER_KEY), 'user_a')
})

test('a storage that refuses is answered with nothing, never a throw', () => {
  const hostile = {
    get length() {
      throw new Error('blocked')
    },
    key() {
      throw new Error('blocked')
    },
    getItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
    removeItem() {
      throw new Error('blocked')
    },
  }
  assert.deepEqual(clearBoxRevealMarksIn(hostile), [])
  assert.deepEqual(clearBoxRevealMarksIn(null), [])
  assert.equal(readBoxRevealOwnerIn(hostile), '')
  assert.equal(readBoxRevealOwnerIn(null), '')
  assert.equal(writeBoxRevealOwnerIn(hostile, 'user_a'), false)
})

test('a key that refuses to be removed is skipped, and the rest still go', () => {
  const storage = fakeStorage({
    [`${BOX_REVEAL_PREFIX}1`]: '1',
    [`${BOX_REVEAL_PREFIX}2`]: '1',
  })
  const { removeItem } = storage
  storage.removeItem = (k) => {
    if (k === `${BOX_REVEAL_PREFIX}1`) throw new Error('nope')
    removeItem.call(storage, k)
  }
  assert.deepEqual(clearBoxRevealMarksIn(storage), [`${BOX_REVEAL_PREFIX}2`])
  assert.equal(storage.getItem(`${BOX_REVEAL_PREFIX}2`), null, 'the removable one still went')
})

test('the owner tag round-trips, and an empty user clears it', () => {
  const storage = fakeStorage()
  assert.equal(readBoxRevealOwnerIn(storage), '', 'nobody’s yet')
  assert.equal(writeBoxRevealOwnerIn(storage, 'user_a'), true)
  assert.equal(storage.getItem(BOX_REVEAL_OWNER_KEY), 'user_a')
  assert.equal(readBoxRevealOwnerIn(storage), 'user_a')
  writeBoxRevealOwnerIn(storage, null)
  assert.equal(storage.getItem(BOX_REVEAL_OWNER_KEY), null, 'signed out records no owner')
  assert.equal(readBoxRevealOwnerIn(storage), '')
})

// The guard must not fire on the ordinary paths, or it would re-seal a page a
// reader opened before signing in — the case the owner tag exists to CARRY, not
// to throw away.
test('the box-reveal owner tag adopts only for a different account', () => {
  assert.equal(mergeStrategyFor('', 'user_a'), 'backfill', 'a guest’s own opened box scores stay open')
  assert.equal(mergeStrategyFor('user_a', 'user_a'), 'backfill', 'the same reader on the same device is ordinary')
  assert.equal(mergeStrategyFor('user_a', 'user_b'), 'adopt', 'a different account adopts, which here means clears')
  assert.equal(mergeStrategyFor('user_a', null), 'none', 'signed out reconciles nothing')
})

// The end-to-end shape of the leak, in the terms the guard runs in.
test('B signing in on A’s device leaves no box score open', () => {
  const storage = fakeStorage({
    [`${BOX_REVEAL_PREFIX}777747`]: '1',
    [`${BOX_REVEAL_PREFIX}777748`]: '1',
  })
  writeBoxRevealOwnerIn(storage, 'user_a')

  // B signs in.
  assert.equal(mergeStrategyFor(readBoxRevealOwnerIn(storage), 'user_b'), 'adopt')
  clearBoxRevealMarksIn(storage)
  writeBoxRevealOwnerIn(storage, 'user_b')

  assert.equal(storage.getItem(`${BOX_REVEAL_PREFIX}777747`), null, 'A’s opened page is sealed again for B')
  assert.equal(storage.getItem(`${BOX_REVEAL_PREFIX}777748`), null)
  assert.equal(readBoxRevealOwnerIn(storage), 'user_b')

  // And B's own tap sticks, rather than being swept by a guard that fires twice.
  storage.setItem(`${BOX_REVEAL_PREFIX}900001`, '1')
  assert.equal(mergeStrategyFor(readBoxRevealOwnerIn(storage), 'user_b'), 'backfill')
  assert.equal(storage.getItem(`${BOX_REVEAL_PREFIX}900001`), '1')
})
