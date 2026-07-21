// Unit coverage for the "due up" preview selectors (src/api/dueup.js):
// selectDueUpNow (the batting side's OWN half, previewed before it's
// revealed) and selectDueUpNext (the OTHER side's NEXT half, previewed once
// the current half is fully revealed). Both are thin wrappers over
// lineupEntering (battingorder.js, already covered by
// pre-pitch-selectors.test.js) plus this module's own `dueUpSlot` scan —
// which slot leads off, resolved from the side's last completed half of the
// same type. That scan's wraparound (slot 9 -> 1) and "no previous half yet"
// fallback are new logic this file adds, so they get their own pins here
// rather than riding on lineupEntering's existing coverage.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { selectDueUpNext, selectDueUpNow } from '../src/api/dueup.js'

const idsOf = (info) => info.batters.map((b) => b.id)
const slotsOf = (info) => info.batters.map((b) => b.slot)

// --------------------------------------------------------------------------
// The spoiler-safety gate — inherited wholesale from lineupEntering
// --------------------------------------------------------------------------
test('selectDueUpNow returns null for a half further out than the next reveal', () => {
  const feed = buildFeed()
  assert.equal(selectDueUpNow(feed, 2, 'top', 0), null)
  assert.ok(selectDueUpNow(feed, 2, 'top', 1))
})

test('selectDueUpNext returns null until the current half is fully revealed', () => {
  const feed = buildFeed()
  // Bottom 1 not yet fully revealed (revealedThrough still at top 1) — top 2
  // (away's next half) is two halves out from a revealedThrough of 0.
  assert.equal(selectDueUpNext(feed, 1, 'bottom', 0), null)
  assert.ok(selectDueUpNext(feed, 1, 'bottom', 1))
})

// --------------------------------------------------------------------------
// dueUpSlot — leadoff resolution, via selectDueUpNow's own half
// --------------------------------------------------------------------------
test('the game\'s first half for a side starts the due-up list at slot 1', () => {
  // Top 1 is away's very first turn — no previous top half to key off.
  const info = selectDueUpNow(buildFeed(), 1, 'top', -1)
  assert.equal(info.battingSide, 'away')
  assert.deepEqual(slotsOf(info), [1, 2, 3])
  assert.deepEqual(idsOf(info), [1, 2, 3])
})

test('a later half continues from one past the last completed PA in the side\'s previous half', () => {
  // Top 1 ends with slot 4 (Dan Diaz, id 4) having made the last PA — top 2
  // (announced pinch-hitter aside) should read due up starting at slot 5.
  const info = selectDueUpNow(buildFeed(), 2, 'top', 1)
  assert.equal(info.battingSide, 'away')
  assert.deepEqual(slotsOf(info), [5, 6, 7])
  assert.deepEqual(idsOf(info), [5, 6, 7])
})

test('the due-up list wraps from slot 9 back to slot 1', () => {
  // Same fixture, but top 1's last PA is re-pointed to slot 9 (id 9, Ike
  // Ivey) instead of slot 4 — the following top half must wrap to slot 1
  // rather than reading off the end of the order.
  const feed = buildFeed()
  const top1Plays = feed.liveData.plays.allPlays.filter(
    (p) => p.about.inning === 1 && p.about.halfInning === 'top',
  )
  top1Plays[top1Plays.length - 1].matchup.batter.id = 9

  const info = selectDueUpNow(feed, 2, 'top', 1)
  assert.equal(info.battingSide, 'away')
  assert.deepEqual(slotsOf(info), [1, 2, 3])
  assert.deepEqual(idsOf(info), [1, 2, 3])
})

test('selectDueUpNow returns null when the batting side has no lineup posted (MiLB gap)', () => {
  const feed = buildFeed()
  feed.liveData.boxscore.teams.away.players = {}
  assert.equal(selectDueUpNow(feed, 1, 'top', -1), null)
})

// --------------------------------------------------------------------------
// selectDueUpNext — the OTHER side's NEXT half
// --------------------------------------------------------------------------
test('selectDueUpNext previews the other side\'s next half, own-first-turn case', () => {
  // Current half is top 1 (away batting), fully revealed — the preview is
  // home's own first turn (bottom 1), starting at slot 1.
  const info = selectDueUpNext(buildFeed(), 1, 'top', 1)
  assert.equal(info.battingSide, 'home')
  assert.deepEqual(slotsOf(info), [1, 2, 3])
  assert.deepEqual(idsOf(info), [11, 12, 13])
})

test('selectDueUpNext previews the other side\'s next half, continuing case', () => {
  // Current half is bottom 1 (home batting), fully revealed — the preview is
  // away's next turn (top 2), continuing from top 1's last batter (slot 4).
  const info = selectDueUpNext(buildFeed(), 1, 'bottom', 1)
  assert.equal(info.battingSide, 'away')
  assert.deepEqual(slotsOf(info), [5, 6, 7])
  assert.deepEqual(idsOf(info), [5, 6, 7])
})
