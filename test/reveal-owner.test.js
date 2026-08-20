// The shared-device guard on the two channels ADR-0022 and ADR-0026 own — the
// scoring frontier (`bbsbh:reveal:*`) and the days the reader consented to
// spoil (`bbsbh:spoiledDays`) — plus the storage mechanics every owner tag
// shares (src/lib/account/deviceOwner.js).
//
// THE LEAK, for both. The state is keyed by gamePk, or by nothing at all: no
// account, and nothing cleared it on sign-out. On a family iPad user A signs in
// and scores six innings; A signs out and the marks stay, local-first by design;
// B signs in, opens that game, and the innings viewer renders six innings
// already unsealed — then publishes A's frontier into B's account, where the
// ratchet carries it to every device B owns.
//
// This is the pair the whole spoiler rule rests on, which is why #771 called it
// the highest-priority follow-up rather than account hygiene. And both are
// one-directional — a ratchet, and a consent that only grows by consenting — so
// neither undoes itself by signing out again.
import assert from 'node:assert/strict'
import test from 'node:test'

import { clearKeysWithPrefixIn, readOwnerIn, writeOwnerIn } from '../src/lib/account/deviceOwner.js'
import {
  ATBAT_MARK_PREFIX,
  REVEAL_MARK_PREFIX,
  REVEAL_OWNER_KEY,
  clearRevealMarksIn,
  readRevealOwnerIn,
  writeRevealOwnerIn,
} from '../src/lib/account/revealOwner.js'
import { SPOILED_DAYS_OWNER_KEY, parseSpoiledDays, serializeSpoiledDays } from '../src/lib/spoiledDays.js'
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

test('every reveal mark comes off, and the at-bat cursor goes with it', () => {
  const storage = fakeStorage({
    [`${REVEAL_MARK_PREFIX}777747`]: '13',
    [`${REVEAL_MARK_PREFIX}777748`]: '5',
    [`${REVEAL_MARK_PREFIX}777749`]: '0',
    [`${ATBAT_MARK_PREFIX}777747`]: '13:2',
    'bbsbh:boxreveal:777747': '1',
    'bbsbh:spoiledDays': '["2026-05-27"]',
    'bbsbh:stamps': '{}',
    'unrelated:key': 'x',
  })

  const cleared = clearRevealMarksIn(storage)

  assert.equal(cleared.length, 4, 'three marks and the cursor — the re-indexing trap would have skipped one')
  assert.equal(storage.getItem(`${REVEAL_MARK_PREFIX}777748`), null)
  assert.equal(
    storage.getItem(`${ATBAT_MARK_PREFIX}777747`),
    null,
    'a cursor left behind would point into a half B has never opened',
  )
  // Each channel clears only its own keys. They sync independently and carry
  // separate owner tags; a device that reached one endpoint but not another
  // must not have both decided for it.
  assert.equal(storage.getItem('bbsbh:boxreveal:777747'), '1')
  assert.equal(storage.getItem('bbsbh:spoiledDays'), '["2026-05-27"]')
  assert.equal(storage.getItem('bbsbh:stamps'), '{}')
  assert.equal(storage.getItem('unrelated:key'), 'x')
})

test('the reveal prefix is exact — the cursor is not a mark, and the tag is neither', () => {
  const storage = fakeStorage({
    'bbsbh:reveal': '3',
    'bbsbh:revealOwner': 'user_a',
    [`${REVEAL_MARK_PREFIX}1`]: '3',
    [`${ATBAT_MARK_PREFIX}1`]: '3:1',
  })
  const cleared = clearRevealMarksIn(storage)
  assert.deepEqual(cleared, [`${REVEAL_MARK_PREFIX}1`, `${ATBAT_MARK_PREFIX}1`])
  assert.equal(storage.getItem('bbsbh:reveal'), '3', 'a key with no trailing colon is not a mark')
  // The owner tag must survive its own sweep, or the very next read would call a
  // foreign device a guest's and backfill A's progress into whoever signs in.
  assert.equal(storage.getItem(REVEAL_OWNER_KEY), 'user_a')
})

test('a blocked or hostile storage is answered with nothing, never a throw', () => {
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
  assert.deepEqual(clearRevealMarksIn(hostile), [])
  assert.deepEqual(clearRevealMarksIn(null), [])
  assert.deepEqual(clearKeysWithPrefixIn(fakeStorage({ 'a:1': 'x' }), ''), [], 'an empty prefix sweeps nothing')
  assert.equal(readRevealOwnerIn(hostile), '')
  assert.equal(readRevealOwnerIn(null), '')
  assert.equal(writeRevealOwnerIn(hostile, 'user_a'), false)
})

test('a key that refuses to be removed is skipped, and the rest still go', () => {
  const storage = fakeStorage({
    [`${REVEAL_MARK_PREFIX}1`]: '1',
    [`${REVEAL_MARK_PREFIX}2`]: '2',
  })
  const { removeItem } = storage
  storage.removeItem = (k) => {
    if (k === `${REVEAL_MARK_PREFIX}1`) throw new Error('nope')
    removeItem.call(storage, k)
  }
  assert.deepEqual(clearRevealMarksIn(storage), [`${REVEAL_MARK_PREFIX}2`])
  assert.equal(storage.getItem(`${REVEAL_MARK_PREFIX}2`), null, 'the removable one still went')
})

test('an owner tag round-trips, and an empty user clears it', () => {
  const storage = fakeStorage()
  assert.equal(readRevealOwnerIn(storage), '', 'nobody’s yet')
  assert.equal(writeRevealOwnerIn(storage, 'user_a'), true)
  assert.equal(readRevealOwnerIn(storage), 'user_a')
  writeRevealOwnerIn(storage, null)
  assert.equal(storage.getItem(REVEAL_OWNER_KEY), null, 'signed out records no owner')
  assert.equal(readRevealOwnerIn(storage), '')
  // The generic pair the two new channels and the box-score bit all share.
  assert.equal(writeOwnerIn(storage, SPOILED_DAYS_OWNER_KEY, 'user_b'), true)
  assert.equal(readOwnerIn(storage, SPOILED_DAYS_OWNER_KEY), 'user_b')
  assert.equal(readOwnerIn(storage, REVEAL_OWNER_KEY), '', 'the two tags are independent')
})

// Every channel keeps its OWN tag. A single shared one would have the first
// channel to succeed vouch for the ones that failed — a device that reached the
// reveal endpoint but not the consent endpoint would be recorded as holding both.
test('the four owner keys are four distinct keys', () => {
  const keys = new Set([
    REVEAL_OWNER_KEY,
    SPOILED_DAYS_OWNER_KEY,
    'bbsbh:boxrevealOwner',
    'bbsbh:stampsOwner',
    'bbsbh:booksOwner',
    'bbsbh:prefsOwner',
  ])
  assert.equal(keys.size, 6, 'no two channels share a tag')
})

test('the reveal owner tag adopts only for a different account', () => {
  assert.equal(mergeStrategyFor('', 'user_a'), 'backfill', 'a guest’s own scoring progress is carried up')
  assert.equal(mergeStrategyFor('user_a', 'user_a'), 'backfill', 'the same scorer on the same device is ordinary')
  assert.equal(mergeStrategyFor('user_a', 'user_b'), 'adopt', 'a different account adopts, which here means clears')
  assert.equal(mergeStrategyFor('user_a', null), 'none', 'signed out reconciles nothing')
})

// The end-to-end shape of both leaks, in the terms the guards run in.
test('B signing in on A’s device inherits neither A’s innings nor A’s consent', () => {
  const storage = fakeStorage({
    [`${REVEAL_MARK_PREFIX}777747`]: '11',
    [`${ATBAT_MARK_PREFIX}777747`]: '11:3',
    'bbsbh:spoiledDays': serializeSpoiledDays(['2026-05-27', '2026-05-28']),
  })
  writeRevealOwnerIn(storage, 'user_a')
  writeOwnerIn(storage, SPOILED_DAYS_OWNER_KEY, 'user_a')

  // B signs in. Both guards see a foreign owner.
  assert.equal(mergeStrategyFor(readRevealOwnerIn(storage), 'user_b'), 'adopt')
  assert.equal(mergeStrategyFor(readOwnerIn(storage, SPOILED_DAYS_OWNER_KEY), 'user_b'), 'adopt')

  clearRevealMarksIn(storage)
  writeRevealOwnerIn(storage, 'user_b')
  storage.setItem('bbsbh:spoiledDays', serializeSpoiledDays([]))
  writeOwnerIn(storage, SPOILED_DAYS_OWNER_KEY, 'user_b')

  assert.equal(storage.getItem(`${REVEAL_MARK_PREFIX}777747`), null, 'A’s eleven halves are sealed again for B')
  assert.equal(storage.getItem(`${ATBAT_MARK_PREFIX}777747`), null)
  assert.deepEqual(parseSpoiledDays(storage.getItem('bbsbh:spoiledDays')), [], 'B consented to nothing')

  // And B's own scoring sticks, rather than being swept by a guard that fires
  // again on the next render.
  storage.setItem(`${REVEAL_MARK_PREFIX}900001`, '3')
  assert.equal(mergeStrategyFor(readRevealOwnerIn(storage), 'user_b'), 'backfill')
  assert.equal(storage.getItem(`${REVEAL_MARK_PREFIX}900001`), '3')
})
