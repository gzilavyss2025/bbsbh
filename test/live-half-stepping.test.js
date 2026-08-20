// THE HALF YOU ARE IN IS NOT A HALF THAT IS OVER (ADR-0054).
//
// At-bat stepping (ADR-0016) stages a sealed half one plate appearance at a
// time and then, once the cap reaches the end of the entry list, promotes it to
// an ordinary full commit — `revealedThrough` advances, one-directionally and
// persisted, and everything gated on it opens.
//
// That promotion read the entry list as if it were the half. On a FINISHED half
// it is. On the half the game is being played in it is the half SO FAR, and a
// reader scoring along with a live game reaches its end within a tap or two of
// arriving. The half then committed on the strength of three batters, and every
// plate appearance that landed afterwards arrived already revealed — on this
// device and, for a signed-in reader, on every other one (ADR-0022). Leave the
// page mid-inning and come back and the whole half was open. The
// at-bat-by-at-bat reveal ended, silently, at the exact moment the reader
// caught up to the game they were watching.
//
// Two things fix it, and both are pinned here:
//   • `stepCommitReady` withholds the commit while the half is in progress.
//   • `selectLiveHalf` is what answers "in progress", from the linescore's own
//     live state rather than from the plays — a half whose third out has just
//     been recorded and a half whose next batter is still walking up look
//     identical in `allPlays`.
//
// Plus the other half of the same ask: "Catch up to live", the lineup page's
// one-tap ratchet to the half the game is in (`catchUpMarkIn`/`offerCatchUp`).
import assert from 'node:assert/strict'
import test from 'node:test'

import { halfIndex } from '../src/api/select.js'
import { selectCatchUpTarget, selectLiveHalf } from '../src/api/liveEdge.js'
import { stepCommitReady } from '../src/api/playbyplay.js'
import { catchUpMarkIn, offerCatchUp } from '../src/hooks/revealProgressCore.js'
import { REVEAL_MARK_PREFIX } from '../src/lib/account/revealOwner.js'

// A feed carrying nothing but the two structural facts these readers use: the
// coarse game state and the linescore's own live inning. No runs anywhere in
// here, which is the point — everything below is decided without one.
function feedAt(inningState, currentInning, abstractGameState = 'Live') {
  return {
    gameData: { status: { abstractGameState } },
    liveData: { linescore: { currentInning, inningState } },
  }
}

const atbat = { kind: 'atbat' }
const note = { kind: 'event' }

// ---------------------------------------------------------------- live half

test('a half being played reads as in progress, and is the catch-up target', () => {
  const top = selectLiveHalf(feedAt('Top', 4))
  assert.deepEqual(top, { idx: halfIndex(4, 'top'), inning: 4, half: 'top', inProgress: true })

  const bottom = selectLiveHalf(feedAt('Bottom', 4))
  assert.deepEqual(bottom, { idx: halfIndex(4, 'bottom'), inning: 4, half: 'bottom', inProgress: true })

  assert.deepEqual(selectCatchUpTarget(feedAt('Bottom', 4)), {
    idx: halfIndex(4, 'bottom'),
    inning: 4,
    half: 'bottom',
  })
})

test('between halves, the live half is the one just FINISHED and is not in progress', () => {
  // 'Middle' is the gap after the top ended; 'End' the gap after the bottom.
  // Both name a half that is over — which is where a reader catching up mid-gap
  // is meant to land, per the ask: "if it's between half innings, you would
  // start at the most recently completed half inning".
  const middle = selectLiveHalf(feedAt('Middle', 6))
  assert.deepEqual(middle, { idx: halfIndex(6, 'top'), inning: 6, half: 'top', inProgress: false })

  const end = selectLiveHalf(feedAt('End', 6))
  assert.deepEqual(end, { idx: halfIndex(6, 'bottom'), inning: 6, half: 'bottom', inProgress: false })

  assert.deepEqual(selectCatchUpTarget(feedAt('Middle', 6)), {
    idx: halfIndex(6, 'top'),
    inning: 6,
    half: 'top',
  })
})

test('no live half before first pitch, once Final, or on a feed that does not say', () => {
  assert.equal(selectLiveHalf(feedAt('Top', 1, 'Preview')), null)
  assert.equal(selectLiveHalf(feedAt('Bottom', 9, 'Final')), null)
  assert.equal(selectCatchUpTarget(feedAt('Bottom', 9, 'Final')), null)
  // A MiLB feed that posts no live inning state degrades to "no live half",
  // which leaves every half treated as finished — the pre-ADR-0054 behaviour,
  // and the safe direction to fail: assuming a half is live because we cannot
  // prove otherwise would leave one that can never commit.
  assert.equal(selectLiveHalf(feedAt(undefined, 4)), null)
  assert.equal(selectLiveHalf(feedAt('Top', undefined)), null)
  assert.equal(selectLiveHalf(feedAt('Warmup', 4)), null)
  assert.equal(selectLiveHalf(feedAt('Top', 0)), null)
  assert.equal(selectLiveHalf(null), null)
})

// ------------------------------------------------------ the withheld commit

test('a finished half commits once every entry is on screen', () => {
  const entries = [atbat, note, atbat, atbat]
  assert.equal(stepCommitReady(entries, 4, false), true)
  // Past the end too — a cap corrected forward by nextStepBoundary can overshoot.
  assert.equal(stepCommitReady(entries, 9, false), true)
})

test('THE FIX: the same half, still being played, does NOT commit', () => {
  const entries = [atbat, note, atbat, atbat]
  assert.equal(stepCommitReady(entries, 4, true), false)
  assert.equal(stepCommitReady(entries, 9, true), false)
})

test('a half short of its end never commits, live or not', () => {
  const entries = [atbat, note, atbat, atbat]
  assert.equal(stepCommitReady(entries, 3, false), false)
  assert.equal(stepCommitReady(entries, 0, false), false)
  assert.equal(stepCommitReady(entries, null, false), false)
})

test('entries with no plate appearance in them are not a half', () => {
  // Extra innings post the automatic placed-runner note before the leadoff
  // batter's own PA resolves; a cap that has "caught up" to a lone note has
  // caught up to no baseball at all.
  assert.equal(stepCommitReady([note], 1, false), false)
  assert.equal(stepCommitReady([note, note], 2, false), false)
  assert.equal(stepCommitReady([], 0, false), false)
  assert.equal(stepCommitReady(null, 0, false), false)
})

// ------------------------------------------------------------- catch up to live

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
  }
}

test('catching up goes THROUGH the ratchet — forward only', () => {
  const key = `${REVEAL_MARK_PREFIX}777`

  const fresh = fakeStorage()
  assert.equal(catchUpMarkIn(fresh, key, 12), 12)
  assert.equal(fresh.data[key], '12')

  // A reader already scored past the live half keeps their place: the catch-up
  // cannot walk the mark backward any more than a tap or a sync can.
  const ahead = fakeStorage({ [key]: '19' })
  assert.equal(catchUpMarkIn(ahead, key, 12), 19)
  assert.equal(ahead.data[key], '19')

  // A hand-mangled stored value parses to -1 and loses the merge, exactly as
  // it does for every other source of this mark.
  const mangled = fakeStorage({ [key]: 'nine' })
  assert.equal(catchUpMarkIn(mangled, key, 3), 3)
})

test('a nonsense catch-up writes nothing at all', () => {
  const key = `${REVEAL_MARK_PREFIX}777`
  for (const idx of [-1, 1.5, NaN, null, undefined, '4']) {
    const store = fakeStorage()
    assert.equal(catchUpMarkIn(store, key, idx), -1)
    assert.deepEqual(store.data, {})
  }
  const store = fakeStorage()
  assert.equal(catchUpMarkIn(store, '', 4), -1)
  assert.deepEqual(store.data, {})
})

test('the offer appears only when the tap would move something', () => {
  const target = { idx: halfIndex(6, 'bottom'), inning: 6, half: 'bottom' } // idx 11

  assert.equal(offerCatchUp(target, -1), true) // nothing revealed yet
  assert.equal(offerCatchUp(target, 9), true)
  assert.equal(offerCatchUp(target, 10), false) // already at the half before it
  assert.equal(offerCatchUp(target, 11), false) // already IN the live half
  assert.equal(offerCatchUp(target, 40), false) // further along than the game

  // Top of the 1st: the target IS half 0, so there is nothing before it to
  // reveal and no button is drawn.
  assert.equal(offerCatchUp({ idx: 0, inning: 1, half: 'top' }, -1), false)
  assert.equal(offerCatchUp(null, -1), false)
})
