// Unit coverage for src/api/liveEdge.js (Follow Live / ADR-0027) and the
// per-game follow flag's fail-closed expiry. The invariants: the edge is null
// unless the user is actually following AND the game has real play data, it
// never over-advances past what the linescore confirms, mergeMark drops a null
// edge, and the stored flag inherits the same 8am-expiry / fail-closed shape as
// the Scores Unlocked pass so a bare '1'/'true'/stale value never auto-follows.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { selectLiveEdge } from '../src/api/liveEdge.js'
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
// The consent gate — no edge unless following === true
// --------------------------------------------------------------------------
test('selectLiveEdge returns null unless following is exactly true', () => {
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
// The per-game follow flag inherits fail-closed 8am expiry (no bare '1')
// --------------------------------------------------------------------------
test('the follow flag stores an expiry that reads as following, and fails closed on junk', () => {
  const valid = String(nextResetAt())
  assert.equal(isUnlocked(valid), true) // a fresh flag = following
  assert.equal(isUnlocked('1'), false) // a bare boolean flag never auto-follows
  assert.equal(isUnlocked('true'), false)
  assert.equal(isUnlocked(String(Date.now() - 1000)), false) // past = not following
})
