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
import { buildFeed } from './fixtures/mini-game.js'
import { challengeForPlay, selectChallengeState } from '../src/api/challenges.js'

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
