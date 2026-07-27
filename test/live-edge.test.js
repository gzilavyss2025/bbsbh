// Unit coverage for src/api/liveEdge.js (ADR-0026) — the half the live game has
// actually reached, which is what keeps a caught-up viewer pinned to the newest
// half while the spoilers-off pass is running. The invariants: the edge is null
// unless the user has actually consented AND the game has real play data, it
// never runs past what the linescore confirms, and a null edge is inert.
//
// Note what is NOT here any more: this selector no longer feeds the reveal
// ratchet. Under the pass every half already renders open, so the edge drives
// NAVIGATION only and nothing downstream of it writes a mark. mergeMark is still
// exercised below to pin that a null edge stays a no-op for any caller.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { selectLiveEdge, shouldFollowLiveEdge } from '../src/api/liveEdge.js'
import { halfIndex } from '../src/api/select.js'
import { mergeMark } from '../src/hooks/revealProgressCore.js'
import { isUnlocked, nextResetAt } from '../src/lib/scoresUnlocked.js'

// A minimal live-feed shape: allPlays (each with about.inning/halfInning),
// linescore.innings, and a status. Enough for selectLiveEdge's paths.
function buildFeed({ state = 'Live', plays = [], innings = [] } = {}) {
  return {
    gameData: { status: { abstractGameState: state } },
    liveData: { plays: { allPlays: plays }, linescore: { innings } },
  }
}
const play = (inning, halfInning) => ({ about: { inning, halfInning } })
// A linescore innings array 1..n, marking the last inning's home half present
// only if `homeReached`.
function innings(n, homeReached) {
  const arr = []
  for (let i = 1; i <= n; i++) {
    const isLast = i === n
    arr.push({ num: i, away: { runs: 0 }, home: isLast && !homeReached ? {} : { runs: 0 } })
  }
  return arr
}

// --------------------------------------------------------------------------
// The consent gate — no edge unless spoilers are actually off
// --------------------------------------------------------------------------
test('selectLiveEdge returns null unless the consent flag is exactly true', () => {
  const feed = buildFeed({ plays: [play(3, 'top')], innings: innings(3, false) })
  assert.equal(selectLiveEdge(feed, undefined), null)
  assert.equal(selectLiveEdge(feed, false), null)
  assert.equal(selectLiveEdge(feed, '1'), null) // a truthy non-boolean is not consent
  assert.equal(selectLiveEdge(feed, 1), null)
  assert.equal(selectLiveEdge(feed, true), halfIndex(3, 'top'))
})

// --------------------------------------------------------------------------
// Pre-first-pitch / empty plays — never advance
// --------------------------------------------------------------------------
test('a Preview game yields no edge', () => {
  assert.equal(selectLiveEdge(buildFeed({ state: 'Preview', plays: [play(1, 'top')] }), true), null)
})

test('empty allPlays yields no edge even with a posted linescore', () => {
  assert.equal(selectLiveEdge(buildFeed({ plays: [], innings: innings(2, true) }), true), null)
})

test('all-malformed plays yield no edge', () => {
  const feed = buildFeed({ plays: [{ about: {} }, { about: { inning: 0 } }], innings: innings(1, false) })
  assert.equal(selectLiveEdge(feed, true), null)
})

// --------------------------------------------------------------------------
// The frontier — the half of the last well-formed play
// --------------------------------------------------------------------------
test('mid-game edge is the last play half', () => {
  const feed = buildFeed({
    plays: [play(1, 'top'), play(1, 'bottom'), play(2, 'top')],
    innings: innings(2, false),
  })
  assert.equal(selectLiveEdge(feed, true), halfIndex(2, 'top'))
})

test('a trailing malformed entry is skipped for the real edge', () => {
  const feed = buildFeed({
    plays: [play(4, 'top'), play(4, 'bottom'), { about: { halfInning: 'bottom' } }],
    innings: innings(4, true),
  })
  assert.equal(selectLiveEdge(feed, true), halfIndex(4, 'bottom'))
})

// --------------------------------------------------------------------------
// The linescore clamp — never advance past what the linescore confirms
// --------------------------------------------------------------------------
test('a future-half stray play is clamped to the linescore frontier', () => {
  // Plays claim bottom 5, but the linescore only shows through the top of 5.
  const feed = buildFeed({
    plays: [play(5, 'top'), play(5, 'bottom')],
    innings: innings(5, false), // home half of the 5th not yet reached
  })
  assert.equal(selectLiveEdge(feed, true), halfIndex(5, 'top'))
})

// --------------------------------------------------------------------------
// Final game — the last play is authoritative (pinned on a real captured feed)
// --------------------------------------------------------------------------
const REAL_FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)
test('a real Final feed reports its final half (823035 → bottom 9)', () => {
  assert.equal(selectLiveEdge(REAL_FEED, true), halfIndex(9, 'bottom')) // 17
})

// --------------------------------------------------------------------------
// Ratchet composition — a null edge is a no-op through mergeMark
// --------------------------------------------------------------------------
test('mergeMark drops a null edge and keeps the mark', () => {
  assert.equal(mergeMark(6, selectLiveEdge(buildFeed({ plays: [] }), true)), 6)
})

// --------------------------------------------------------------------------
// shouldFollowLiveEdge — InningViewer's navigation decision (option C: only
// jump on a half turning over while you're actually watching it, never when
// you page forward into a half the game already left behind). `prevSeenIdx`
// is where the viewer was sitting as of the PREVIOUS check, not `curIdx` —
// that distinction is the whole point, see the header comment in liveEdge.js.
// --------------------------------------------------------------------------
test('a null edge never follows', () => {
  assert.equal(shouldFollowLiveEdge(null, 4, 4, 4), false)
})

test('first read since activation jumps straight to the edge, from anywhere', () => {
  assert.equal(shouldFollowLiveEdge(6, null, null, 2), true)
  assert.equal(shouldFollowLiveEdge(6, null, null, 6), false) // already there — nothing to do
})

test('a half turning over while the viewer was already sitting on it follows', () => {
  // As of the last check the viewer was at 4, matching the then-current edge —
  // genuinely watching. It just turned over to 5.
  assert.equal(shouldFollowLiveEdge(5, 4, 4, 4), true)
})

test('a viewer who fell behind never gets pulled while reading', () => {
  // Last check: edge was 4, viewer was seen at 2 (already behind). Edge has
  // since moved to 6 while they're still reading half 2 — must not fire
  // regardless of where curIdx happens to be right now.
  assert.equal(shouldFollowLiveEdge(6, 4, 2, 2), false)
})

test('catching up by paging forward is never overtaken by the live edge that got there first', () => {
  // The viewer fell behind (last seen at 2 while edge was 6), then paged
  // themselves all the way forward to curIdx 6 (matching that edge) between
  // polls. The NEXT poll finds the game has moved again, to 7. Even though
  // curIdx (6) now equals prevEdge (6), prevSeenIdx (2) does not — this was
  // their own catch-up nav, not settled watching, so it must not fire. This
  // is the exact "sends you all over" case: without prevSeenIdx, a bare
  // curIdx === prevEdge check would wrongly fire here.
  assert.equal(shouldFollowLiveEdge(7, 6, 2, 6), false)
})

test('auto-follow resumes once a check confirms the viewer has genuinely settled', () => {
  // A later poll finds no further change (edge still 6, viewer still at 6) —
  // that check itself doesn't follow (nothing advanced) but DOES record them
  // as settled. The poll after that, a real turnover to 7 while they're still
  // there, follows normally.
  assert.equal(shouldFollowLiveEdge(6, 6, 6, 6), false)
  assert.equal(shouldFollowLiveEdge(7, 6, 6, 6), true)
})

test('an unchanged edge never re-fires', () => {
  assert.equal(shouldFollowLiveEdge(4, 4, 4, 4), false)
})

// --------------------------------------------------------------------------
// The consent that gates this selector is an expiry, never a bare flag
// --------------------------------------------------------------------------
test('the pass that gates the edge is an expiry and fails closed on junk', () => {
  const valid = String(nextResetAt())
  assert.equal(isUnlocked(valid), true) // a fresh pass = spoilers off
  assert.equal(isUnlocked('1'), false) // a bare boolean flag never unlocks
  assert.equal(isUnlocked('true'), false)
  assert.equal(isUnlocked(String(Date.now() - 1000)), false) // past = sealed
})
