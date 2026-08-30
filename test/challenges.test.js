// Unit coverage for ABS challenge tracking (src/api/challenges.js):
// challengeForPlay — the shared primitive that finds a play's ABS challenge
// (if any) and pins it to a pitch, either from an exact pitch-level review
// (playEvents[].reviewDetails, hasReview: true) or, for a play-level review
// with no pitch flagged, the at-bat's last pitch as a working heuristic — and
// selectChallengeState, which scans a half's plays through it and groups the
// results by side for AbsRow's pip row + expandable detail list.
//
// Field shapes verified live against gamePk 823036 (four real ABS challenges,
// two pitch-level, two play-level) before writing this — see challenges.js's
// own header comments for that game's specifics.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildFeed } from './fixtures/mini-game.js'
import { challengeForPlay, selectChallengeState, gameHasAbs } from '../src/api/challenges.js'

// A field-trimmed snapshot of statsapi's /api/v1.1/game/815863/feed/live —
// Buffalo at Rochester, 2026-08-26, a real TRIPLE-A game with three real ABS
// challenges. Built by .scratch/abs-aaa-gate/build-fixture.mjs; the suite reads
// it from disk, so these tests run offline and identically every time, the same
// arrangement invariant-real-game.test.js uses for the pinned MLB game.
const AAA = JSON.parse(
  readFileSync(new URL('./fixtures/game-815863.trimmed.json', import.meta.url), 'utf8'),
)

// A minimal feed carrying only what gameHasAbs looks at.
function levelFeed(sportId, leagueName, absChallenges) {
  return {
    gameData: {
      teams: {
        away: { id: 1, sport: { id: sportId }, league: { name: leagueName } },
        home: { id: 2, sport: { id: sportId }, league: { name: leagueName } },
      },
      ...(absChallenges === undefined ? {} : { absChallenges }),
    },
  }
}

// The bank a game starts with, as the feed itself reports it before a pitch is
// thrown — the pregame shape at every level that runs the system.
const PREGAME_BANK = {
  hasChallenges: false,
  away: { usedSuccessful: 0, usedFailed: 0, remaining: 2 },
  home: { usedSuccessful: 0, usedFailed: 0, remaining: 2 },
}

// mini-game.js's [0] top 1: Ashby strikeout, pitches C(1) S(2) S(3) — away
// (id 158) challenges pitch 2 and loses (upheld).
function withPitchLevelChallenge(feed) {
  const play = feed.liveData.plays.allPlays[0]
  const pitch2 = play.playEvents.find((e) => e.isPitch && e.pitchNumber === 2)
  pitch2.details.hasReview = true
  pitch2.reviewDetails = {
    isOverturned: false,
    reviewType: 'MJ',
    challengeTeamId: 158,
    player: { id: 1, fullName: 'Aaron Ashby' },
  }
  return feed
}

// mini-game.js's [6] bottom 1: Lowe strikeout, pitches C(1) C(2) S(3) — home
// (id 138) challenges the AT-BAT (no pitch flagged) and wins (overturned).
// The only working heuristic is "the deciding pitch" — pitch 3 here.
function withPlayLevelChallenge(feed) {
  const play = feed.liveData.plays.allPlays[6]
  play.reviewDetails = {
    isOverturned: true,
    reviewType: 'MJ',
    challengeTeamId: 138,
    player: { id: 12, fullName: 'Leo Lowe' },
  }
  return feed
}

test('challengeForPlay returns null for a play with no review', () => {
  const feed = buildFeed()
  assert.equal(challengeForPlay(feed, feed.liveData.plays.allPlays[0]), null)
})

test('challengeForPlay resolves a pitch-level review to its exact pitch, not a heuristic', () => {
  const feed = withPitchLevelChallenge(buildFeed())
  const c = challengeForPlay(feed, feed.liveData.plays.allPlays[0])
  assert.deepEqual(c, {
    side: 'away',
    teamId: 158,
    outcome: 'fail',
    pitchNumber: 2,
    isHeuristic: false,
    playerId: 1,
    playerName: 'Aaron Ashby',
  })
})

test('challengeForPlay falls back to the at-bat\'s last pitch for a play-level review', () => {
  const feed = withPlayLevelChallenge(buildFeed())
  const c = challengeForPlay(feed, feed.liveData.plays.allPlays[6])
  assert.deepEqual(c, {
    side: 'home',
    teamId: 138,
    outcome: 'success',
    pitchNumber: 3, // the play's last pitch — no pitch-level flag to read instead
    isHeuristic: true,
    playerId: 12,
    playerName: 'Leo Lowe',
  })
})

test('challengeForPlay ignores a manager\'s-replay review (reviewType "MA"), only "MJ" is ABS', () => {
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays[0]
  play.reviewDetails = { isOverturned: true, reviewType: 'MA', challengeTeamId: 158 }
  assert.equal(challengeForPlay(feed, play), null)
})

test('challengeForPlay returns null for a challengeTeamId belonging to neither club', () => {
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays[0]
  play.reviewDetails = { isOverturned: false, reviewType: 'MJ', challengeTeamId: 999 }
  assert.equal(challengeForPlay(feed, play), null)
})

test('selectChallengeState groups challenges by side, in chronological order', () => {
  const feed = withPlayLevelChallenge(withPitchLevelChallenge(buildFeed()))
  const state = selectChallengeState(feed, 2, 'bottom')
  assert.equal(state.away.teamId, 158)
  assert.equal(state.home.teamId, 138)
  assert.equal(state.away.outcomes.length, 1)
  assert.equal(state.away.outcomes[0].outcome, 'fail')
  assert.equal(state.away.outcomes[0].inning, 1)
  assert.equal(state.away.outcomes[0].half, 'top')
  assert.equal(state.home.outcomes.length, 1)
  assert.equal(state.home.outcomes[0].outcome, 'success')
  assert.equal(state.home.outcomes[0].playerName, 'Leo Lowe')
})

test('selectChallengeState clamps to the reached half — a later challenge never reaches the DOM', () => {
  const feed = withPlayLevelChallenge(withPitchLevelChallenge(buildFeed()))
  // Through top 1 only — the home challenge (bottom 1) is one half further out.
  const throughTop1 = selectChallengeState(feed, 1, 'top')
  assert.equal(throughTop1.away.outcomes.length, 1)
  assert.equal(throughTop1.home.outcomes.length, 0)
})

// --- gameHasAbs: which games run the ABS challenge system ----------------------
// The system is NOT a level. In 2026 it runs at MLB, at Triple-A and, inside
// Single-A, in the Florida State League alone — while Double-A, High-A and the
// other two Single-A leagues do not run it. The feed says so itself through
// gameData.absChallenges, which is present on exactly the games that run it.

test('gameHasAbs is true for an MLB game', () => {
  assert.equal(gameHasAbs(levelFeed(1, 'American League', PREGAME_BANK)), true)
})

test('gameHasAbs is true for a Triple-A game — the level does run challenges', () => {
  assert.equal(gameHasAbs(levelFeed(11, 'International League', PREGAME_BANK)), true)
})

test('gameHasAbs is true on the real captured Triple-A feed', () => {
  assert.equal(gameHasAbs(AAA), true)
  assert.equal(AAA.gameData.teams.away.sport.id, 11)
})

test('gameHasAbs is true for a Florida State League game, false for its Single-A siblings', () => {
  // Same sportId (14), opposite answers — a level allowlist cannot tell these
  // two apart, and would put a misleading "2 left" row on the Carolina game.
  assert.equal(gameHasAbs(levelFeed(14, 'Florida State League', PREGAME_BANK)), true)
  assert.equal(gameHasAbs(levelFeed(14, 'Carolina League', undefined)), false)
  assert.equal(gameHasAbs(levelFeed(14, 'California League', undefined)), false)
})

test('gameHasAbs is false at a level with no challenge data — no empty row', () => {
  assert.equal(gameHasAbs(levelFeed(12, 'Eastern League', undefined)), false)
  assert.equal(gameHasAbs(levelFeed(13, 'Midwest League', undefined)), false)
})

test('gameHasAbs follows the feed, not the level — an MLB game with no bank shows nothing', () => {
  // The degrade-correctly property: a level that LOSES the system loses the key
  // and the row goes away on its own, with no code change here.
  assert.equal(gameHasAbs(levelFeed(1, 'American League', undefined)), false)
})

test('gameHasAbs reads presence, never the running counts — true before any challenge', () => {
  // hasChallenges is "one has been used", false until the first one; the row
  // still has to show the full bank pregame, so the gate must not read it.
  assert.equal(PREGAME_BANK.hasChallenges, false)
  assert.equal(gameHasAbs(levelFeed(11, 'International League', PREGAME_BANK)), true)
})

test('gameHasAbs degrades to false on a missing or empty feed', () => {
  assert.equal(gameHasAbs(null), false)
  assert.equal(gameHasAbs(undefined), false)
  assert.equal(gameHasAbs({}), false)
  assert.equal(gameHasAbs({ gameData: {} }), false)
})

// --- the reveal seal, on real Triple-A data ------------------------------------
// The level gate widened; the REVEAL gate did not. These pin that on the real
// Triple-A feed, exactly as the clamp is pinned on the mini fixture above.

test('the captured Triple-A game carries three real MJ challenges', () => {
  const full = selectChallengeState(AAA, Infinity, 'bottom')
  assert.equal(full.away.teamId, 422) // Buffalo
  assert.equal(full.home.teamId, 534) // Rochester
  // Our own derivation agrees with the tally the feed keeps for itself.
  //
  // THIS IS A FACT ABOUT THIS CAPTURE, NOT AN INVARIANT — do not read it as
  // "the derivation always matches the bank", and do not reuse the assertion
  // on a fresh gamePk without checking. challengeForPlay keeps at most ONE
  // challenge per play, and a plate appearance can carry two distinct ones
  // (both clubs, or one club twice), so the derived tally runs one light on
  // roughly a fifth of games at every level — 815489 and 823011 are worked
  // examples. This game happens to carry no such at-bat, which is what makes
  // it a clean fixture; if a refresh of it ever fails here, suspect that bug
  // rather than this assertion.
  const bank = AAA.gameData.absChallenges
  for (const side of ['away', 'home']) {
    const o = full[side].outcomes
    assert.equal(o.filter((c) => c.outcome === 'success').length, bank[side].usedSuccessful)
    assert.equal(o.filter((c) => c.outcome === 'fail').length, bank[side].usedFailed)
  }
  assert.equal(full.away.outcomes.length + full.home.outcomes.length, 3)
})

test('a Triple-A challenge from a sealed half never reaches the DOM', () => {
  // Rochester's Hayes challenges in the TOP 1st and wins it; Buffalo's two
  // come in the top 2nd and the top 3rd.
  const throughTop1 = selectChallengeState(AAA, 1, 'top')
  assert.equal(throughTop1.home.outcomes.length, 1)
  assert.equal(throughTop1.home.outcomes[0].outcome, 'success')
  assert.equal(throughTop1.away.outcomes.length, 0) // top 2nd is still sealed

  const throughTop2 = selectChallengeState(AAA, 2, 'top')
  assert.equal(throughTop2.away.outcomes.length, 1) // Sosa's, top 2nd
  assert.equal(throughTop2.away.outcomes[0].inning, 2)

  // Nothing at all before the first half is reached.
  const nothing = selectChallengeState(AAA, 0, 'bottom')
  assert.equal(nothing.away.outcomes.length, 0)
  assert.equal(nothing.home.outcomes.length, 0)
})

test('every Triple-A challenge returned sits at or before the reached half', () => {
  const order = (inning, half) => (half === 'bottom' ? inning * 2 : inning * 2 - 1)
  for (let i = 1; i <= 9; i += 1) {
    for (const half of ['top', 'bottom']) {
      const state = selectChallengeState(AAA, i, half)
      for (const side of ['away', 'home']) {
        for (const c of state[side].outcomes) {
          assert.ok(
            order(c.inning, c.half) <= order(i, half),
            `challenge in ${c.half} ${c.inning} leaked through ${half} ${i}`,
          )
        }
      }
    }
  }
})
